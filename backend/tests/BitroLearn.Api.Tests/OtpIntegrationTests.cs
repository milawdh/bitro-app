using System.Security.Cryptography;
using System.Text;
using BitroLearn.Api.Infrastructure.Authentication;
using BitroLearn.Api.Infrastructure.Caching;
using BitroLearn.Api.Infrastructure.Configuration;
using BitroLearn.Api.Infrastructure.SMS;
using BitroLearn.Api.Services;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace BitroLearn.Api.Tests;

public sealed class RedisFactAttribute : FactAttribute
{
    #region API integration prerequisites
    public RedisFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("BITRO_TEST_DB_CONNECTION_STRING"))
            || string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("BITRO_TEST_REDIS_CONNECTION_STRING")))
            Skip = "Set BITRO_TEST_DB_CONNECTION_STRING and BITRO_TEST_REDIS_CONNECTION_STRING for API integration tests.";
    }
    #endregion
}

public sealed class OtpIntegrationTests
{
    #region Single use and expiry

    [RedisOnlyFact]
    public async Task Code_requested_on_first_instance_is_consumed_only_once_across_two_instances()
    {
        await using var pair = await OtpPair.CreateAsync();
        var response = await pair.First.RequestAsync(pair.Phone, pair.Ip, CancellationToken.None);
        pair.Track(response.ChallengeId);
        var code = pair.Sms.Codes[pair.Phone];
        var outcomes = await Task.WhenAll(Consume(pair.First, response.ChallengeId, code), Consume(pair.Second, response.ChallengeId, code));
        Assert.Single(outcomes, status => status == 200);
        Assert.Single(outcomes, status => status == 400);
    }

    [RedisOnlyFact]
    public async Task Expired_code_is_rejected_without_waiting_for_a_real_timeout()
    {
        await using var pair = await OtpPair.CreateAsync();
        var response = await pair.First.RequestAsync(pair.Phone, pair.Ip, CancellationToken.None);
        pair.Track(response.ChallengeId);
        pair.Clock.Advance(TimeSpan.FromSeconds(121));
        Assert.Equal(400, await Consume(pair.Second, response.ChallengeId, pair.Sms.Codes[pair.Phone]));
    }

    #endregion

    #region Shared admission limits

    [RedisOnlyFact]
    public async Task Resend_cooldown_is_shared_between_instances()
    {
        await using var pair = await OtpPair.CreateAsync();
        var response = await pair.First.RequestAsync(pair.Phone, pair.Ip, CancellationToken.None);
        pair.Track(response.ChallengeId);
        var error = await Assert.ThrowsAsync<ApiException>(() => pair.Second.RequestAsync(pair.Phone, pair.Ip, CancellationToken.None));
        Assert.Equal(429, error.StatusCode);
        Assert.Equal(1, pair.Sms.Sends);
    }

    [RedisOnlyFact]
    public async Task Ip_limit_is_shared_for_different_phone_numbers_and_resets_after_the_window()
    {
        await using var pair = await OtpPair.CreateAsync();
        using var limits = new EnvironmentScope(new Dictionary<string, string?> { [AppConfigurationStatic.OtpIpHourlyLimitKey] = "1" });
        pair.Track((await pair.First.RequestAsync(pair.Phone, pair.Ip, CancellationToken.None)).ChallengeId);
        var secondPhone = pair.AddPhone();
        Assert.Equal(429, (await Assert.ThrowsAsync<ApiException>(() => pair.Second.RequestAsync(secondPhone, pair.Ip, CancellationToken.None))).StatusCode);
        pair.Clock.Advance(TimeSpan.FromSeconds(3601));
        pair.Track((await pair.Second.RequestAsync(secondPhone, pair.Ip, CancellationToken.None)).ChallengeId);
        Assert.Equal(2, pair.Sms.Sends);
    }

    [RedisOnlyFact]
    public async Task Phone_limit_survives_cooldown_and_resets_only_after_its_window()
    {
        await using var pair = await OtpPair.CreateAsync();
        using var limits = new EnvironmentScope(new Dictionary<string, string?> { [AppConfigurationStatic.OtpPhoneHourlyLimitKey] = "1" });
        pair.Track((await pair.First.RequestAsync(pair.Phone, pair.Ip, CancellationToken.None)).ChallengeId);
        pair.Clock.Advance(TimeSpan.FromSeconds(61));
        Assert.Equal(429, (await Assert.ThrowsAsync<ApiException>(() => pair.Second.RequestAsync(pair.Phone, pair.Ip, CancellationToken.None))).StatusCode);
        pair.Clock.Advance(TimeSpan.FromSeconds(3540));
        pair.Track((await pair.Second.RequestAsync(pair.Phone, pair.Ip, CancellationToken.None)).ChallengeId);
        Assert.Equal(2, pair.Sms.Sends);
    }

    #endregion

    #region Atomic attempts and account lock

    [RedisOnlyFact]
    public async Task Concurrent_wrong_attempts_are_counted_and_lock_blocks_resend_and_verification()
    {
        await using var pair = await OtpPair.CreateAsync();
        var response = await pair.First.RequestAsync(pair.Phone, pair.Ip, CancellationToken.None);
        pair.Track(response.ChallengeId);
        var actual = pair.Sms.Codes[pair.Phone]; var wrong = actual == "000000" ? "000001" : "000000";
        var outcomes = await Task.WhenAll(Enumerable.Range(0, 4).Select(index => Consume(index % 2 == 0 ? pair.First : pair.Second, response.ChallengeId, wrong)));
        Assert.All(outcomes, status => Assert.Equal(400, status));
        Assert.Equal(429, await Consume(pair.Second, response.ChallengeId, wrong));
        Assert.Equal(429, await Consume(pair.First, response.ChallengeId, actual));
        pair.Clock.Advance(TimeSpan.FromSeconds(61));
        Assert.Equal(429, (await Assert.ThrowsAsync<ApiException>(() => pair.Second.RequestAsync(pair.Phone, pair.Ip, CancellationToken.None))).StatusCode);
        pair.Clock.Advance(TimeSpan.FromSeconds(840));
        var fresh = await pair.Second.RequestAsync(pair.Phone, pair.Ip, CancellationToken.None);
        pair.Track(fresh.ChallengeId);
        Assert.Equal(200, await Consume(pair.First, fresh.ChallengeId, pair.Sms.Codes[pair.Phone]));
        Assert.Equal(400, await Consume(pair.Second, response.ChallengeId, actual));
    }

    #endregion

    #region Result helpers
    private static async Task<int> Consume(OtpService service, string id, string code)
    {
        try { await service.VerifyAndConsumeAsync(id, code, CancellationToken.None); return 200; }
        catch (ApiException exception) { return exception.StatusCode; }
    }
    #endregion
}

internal sealed class RecordingSmsProvider : ISMSProvider
{
    #region Captured delivery
    public Dictionary<string, string> Codes { get; } = new();
    public int Sends { get; private set; }
    public Task SendOTPSMS(string phoneNumber, string code)
    {
        Codes[phoneNumber] = code; Sends++;
        return Task.CompletedTask;
    }
    #endregion
}

internal sealed class ManualTimeProvider : TimeProvider
{
    #region Controlled UTC clock
    private DateTimeOffset now = DateTimeOffset.UtcNow;
    public override DateTimeOffset GetUtcNow() => now;
    public void Advance(TimeSpan elapsed) => now += elapsed;
    #endregion
}

internal sealed class OtpPair : IAsyncDisposable
{
    #region Shared state and independent instances
    private readonly ServiceProvider firstProvider;
    private readonly ServiceProvider secondProvider;
    private readonly IConnectionMultiplexer firstConnection;
    private readonly IConnectionMultiplexer secondConnection;
    private readonly EnvironmentScope environment;
    private readonly string key;
    private readonly List<string> challenges = [];
    private readonly List<string> phones = [];
    public IRedisStore Store { get; }
    public RecordingSmsProvider Sms { get; } = new();
    public ManualTimeProvider Clock { get; } = new();
    public OtpService First => firstProvider.GetRequiredService<OtpService>();
    public OtpService Second => secondProvider.GetRequiredService<OtpService>();
    public string Phone { get; }
    public string Ip { get; } = "integration-" + Guid.NewGuid().ToString("N");

    private OtpPair(IConnectionMultiplexer first, IConnectionMultiplexer second)
    {
        firstConnection = first; secondConnection = second; Store = new RedisStore(first);
        Phone = AddPhone(); key = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        environment = new EnvironmentScope(new Dictionary<string, string?>
        {
            [AppConfigurationStatic.OtpHmacKey] = key, [AppConfigurationStatic.OtpTtlSecondsKey] = "120",
            [AppConfigurationStatic.OtpResendSecondsKey] = "60", [AppConfigurationStatic.OtpMaxAttemptsKey] = "5",
            [AppConfigurationStatic.OtpLockSecondsKey] = "900", [AppConfigurationStatic.OtpRateWindowSecondsKey] = "3600",
            [AppConfigurationStatic.OtpPhoneHourlyLimitKey] = "5", [AppConfigurationStatic.OtpIpHourlyLimitKey] = "20"
        });
        firstProvider = CreateProvider(Store, Sms, Clock);
        secondProvider = CreateProvider(new RedisStore(second), Sms, Clock);
    }
    public static async Task<OtpPair> CreateAsync()
    {
        var connection = Environment.GetEnvironmentVariable("BITRO_TEST_REDIS_CONNECTION_STRING")!;
        return new OtpPair(await ConnectionMultiplexer.ConnectAsync(connection), await ConnectionMultiplexer.ConnectAsync(connection));
    }
    public void Track(string id) => challenges.Add(id);
    public string AddPhone()
    {
        var phone = "+989" + RandomNumberGenerator.GetInt32(100_000_000, 1_000_000_000);
        phones.Add(phone); return phone;
    }
    #endregion

    #region Dependency registration
    private static ServiceProvider CreateProvider(IRedisStore store, RecordingSmsProvider sms, TimeProvider clock)
    {
        var services = new ServiceCollection(); services.AddLogging();
        services.AddSingleton(store); services.AddSingleton<ISMSProvider>(sms); services.AddSingleton(clock);
        services.AddScoped<OtpService>(); return services.BuildServiceProvider();
    }
    #endregion

    #region Bounded cleanup
    public async ValueTask DisposeAsync()
    {
        try
        {
            var keys = phones.Select(phone => "bitro:{auth}:otp:phone:" + Digest(phone)).ToList();
            keys.Add("bitro:{auth}:otp:ip:" + Digest(Ip));
            keys.AddRange(challenges.Select(id => "bitro:{auth}:otp:challenge:" + id));
            await Store.DeleteManyAsync(keys);
        }
        finally
        {
            await firstProvider.DisposeAsync(); await secondProvider.DisposeAsync();
            firstConnection.Dispose(); secondConnection.Dispose(); environment.Dispose();
        }
    }
    private string Digest(string value) => Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    #endregion
}
