using System.Reflection;
using BitroLearn.Api.Infrastructure.Authentication;
using BitroLearn.Api.Infrastructure.Caching;
using BitroLearn.Api.Infrastructure.Configuration;
using BitroLearn.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace BitroLearn.Api.Tests;

public sealed class OtpFailureTests
{
    #region Required dependency failure

    [Fact]
    public async Task Unavailable_shared_store_does_not_send_or_accept_a_new_code()
    {
        using var environment = new EnvironmentScope(new Dictionary<string, string?>
        {
            [AppConfigurationStatic.OtpHmacKey] = "test-only-failure-key-longer-than-32-characters"
        });
        var sms = new RecordingSmsProvider();
        var store = DispatchProxy.Create<IRedisStore, UnavailableRedisProxy>();
        var service = new OtpService(store, sms, NullLogger<OtpService>.Instance);
        var failure = await Assert.ThrowsAsync<ApiException>(() => service.RequestAsync("09123456789", "test-ip", CancellationToken.None));
        Assert.Equal(503, failure.StatusCode);
        Assert.Equal(0, sms.Sends);
    }

    [Fact]
    public async Task Unavailable_shared_store_never_accepts_verification()
    {
        var store = DispatchProxy.Create<IRedisStore, UnavailableRedisProxy>();
        var service = new OtpService(store, new RecordingSmsProvider(), NullLogger<OtpService>.Instance);
        var failure = await Assert.ThrowsAsync<ApiException>(() => service.VerifyAndConsumeAsync(Guid.NewGuid().ToString("N"), "123456", CancellationToken.None));
        Assert.Equal(503, failure.StatusCode);
    }

    #endregion
}

public class UnavailableRedisProxy : DispatchProxy
{
    #region Infrastructure outage simulation
    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        => throw new RedisStoreException("Test store is unavailable.", new IOException("Simulated connection failure."));
    #endregion
}
