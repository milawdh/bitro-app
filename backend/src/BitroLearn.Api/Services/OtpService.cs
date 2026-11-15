using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BitroLearn.Api.DTOs.Auth;
using BitroLearn.Api.Infrastructure.Authentication;
using BitroLearn.Api.Infrastructure.Caching;
using BitroLearn.Api.Infrastructure.Configuration;
using BitroLearn.Api.Infrastructure.SMS;

namespace BitroLearn.Api.Services;

public sealed class OtpService(
    IRedisStore redis,
    ISMSProvider sms,
    ILogger<OtpService> logger,
    TimeProvider? timeProvider = null)
{
    #region Constants and Dependencies
    // All related keys share a cluster slot so the wrapper can commit their conditions together.
    private const string Prefix = "bitro:{auth}:otp:";
    private const int MaximumCasAttempts = 64;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly TimeProvider clock = timeProvider ?? TimeProvider.System;
    #endregion

    #region Public Methods
    public async Task<OtpRequestResponse> RequestAsync(string input, string clientIp, CancellationToken cancellationToken)
    {
        var phone = PhoneNumberNormalizer.Normalize(input);
        var phoneKey = PhoneKey(phone);
        var ipKey = IpKey(clientIp);
        var id = Guid.NewGuid().ToString("N");
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6", CultureInfo.InvariantCulture);
        var codeLifetime = AppConfigurationStatic.GetOtpTtlSeconds();
        var resendDelay = AppConfigurationStatic.GetOtpResendSeconds();
        try
        {
            for (var attempt = 0; attempt < MaximumCasAttempts; attempt++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var now = clock.GetUtcNow();
                var values = await redis.GetManyAsync([phoneKey, ipKey], cancellationToken);
                var phoneRaw = values[phoneKey];
                var ipRaw = values[ipKey];
                var phoneState = ReadState<PhoneState>(phoneRaw) ?? new PhoneState(phone, null, null, null, null, null, 0, now, 0);
                var ipState = ReadState<RateState>(ipRaw) ?? new RateState(now, 0);
                if (phoneState.LockedUntil > now) throw Limited(phoneState.LockedUntil.Value - now);
                if (phoneState.ResendAt > now) throw Limited(phoneState.ResendAt.Value - now);

                var window = TimeSpan.FromSeconds(AppConfigurationStatic.GetOtpRateWindowSeconds());
                if (phoneState.WindowStart + window <= now) phoneState = phoneState with { WindowStart = now, RequestCount = 0 };
                if (ipState.WindowStart + window <= now) ipState = new RateState(now, 0);
                if (phoneState.RequestCount >= AppConfigurationStatic.GetOtpPhoneHourlyLimit()) throw Limited(phoneState.WindowStart + window - now);
                if (ipState.Count >= AppConfigurationStatic.GetOtpIpHourlyLimit()) throw Limited(ipState.WindowStart + window - now);

                phoneState = phoneState with
                {
                    ChallengeId = id, CodeHash = CodeHash(id, phone, code), CodeExpiresAt = now.AddSeconds(codeLifetime),
                    ResendAt = now.AddSeconds(resendDelay), LockedUntil = null, FailedAttempts = 0,
                    RequestCount = phoneState.RequestCount + 1
                };
                ipState = ipState with { Count = ipState.Count + 1 };
                var committed = await redis.CompareExchangeAsync(
                    [new(phoneKey, phoneRaw), new(ipKey, ipRaw), new(ChallengeKey(id), null)],
                    [new(phoneKey, Serialize(phoneState), PhoneLifetime(phoneState, now)),
                     new(ipKey, Serialize(ipState), Positive(ipState.WindowStart + window - now)),
                     new(ChallengeKey(id), phoneKey, TimeSpan.FromSeconds(codeLifetime))], cancellationToken);
                if (!committed) continue;

                try { await sms.SendOTPSMS(phone, code); }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    await CancelUndeliveredChallengeAsync(phoneKey, id, cancellationToken);
                    logger.LogError("The SMS provider failed with {ExceptionType}.", exception.GetType().Name);
                    throw new ApiException(503, "ارسال کد در دسترس نیست.", "کمی بعد دوباره تلاش کنید.");
                }
                return new OtpRequestResponse(id, codeLifetime, resendDelay);
            }
            throw Unavailable();
        }
        catch (RedisStoreException exception)
        {
            logger.LogWarning("OTP storage is unavailable: {ExceptionType}.", exception.GetType().Name);
            throw Unavailable();
        }
    }

    public async Task<string> VerifyAndConsumeAsync(string challengeId, string code, CancellationToken cancellationToken)
    {
        try
        {
            var indexKey = ChallengeKey(challengeId);
            for (var attempt = 0; attempt < MaximumCasAttempts; attempt++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var phoneKey = await redis.GetStringAsync(indexKey, cancellationToken);
                if (phoneKey is null || !phoneKey.StartsWith(Prefix + "phone:", StringComparison.Ordinal)) throw InvalidCode();
                var raw = await redis.GetStringAsync(phoneKey, cancellationToken);
                var state = ReadState<PhoneState>(raw);
                var now = clock.GetUtcNow();
                if (state is null) throw InvalidCode();
                if (state.LockedUntil > now) throw Limited(state.LockedUntil.Value - now);
                if (state.ChallengeId != challengeId || state.CodeExpiresAt is null || state.CodeExpiresAt <= now || state.CodeHash is null)
                    throw InvalidCode();

                var correct = CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(state.CodeHash),
                    Encoding.UTF8.GetBytes(CodeHash(challengeId, state.PhoneNumber, code)));
                var failures = correct ? 0 : state.FailedAttempts + 1;
                var locked = !correct && failures >= AppConfigurationStatic.GetOtpMaxAttempts();
                var updated = correct
                    ? state with { ChallengeId = null, CodeHash = null, CodeExpiresAt = null, FailedAttempts = 0 }
                    : state with
                    {
                        FailedAttempts = failures,
                        LockedUntil = locked ? now.AddSeconds(AppConfigurationStatic.GetOtpLockSeconds()) : null
                    };
                RedisWrite[] writes = correct
                    ? [new(phoneKey, Serialize(updated), PhoneLifetime(updated, now)), new(indexKey, null)]
                    : locked
                        ? [new(phoneKey, Serialize(updated), PhoneLifetime(updated, now)),
                           new(indexKey, phoneKey, TimeSpan.FromSeconds(AppConfigurationStatic.GetOtpLockSeconds()))]
                        : [new(phoneKey, Serialize(updated), PhoneLifetime(updated, now))];
                var committed = await redis.CompareExchangeAsync([new(phoneKey, raw), new(indexKey, phoneKey)], writes, cancellationToken);
                if (!committed) continue;
                if (correct) return state.PhoneNumber;
                if (locked) throw Limited(TimeSpan.FromSeconds(AppConfigurationStatic.GetOtpLockSeconds()));
                throw InvalidCode();
            }
            throw Unavailable();
        }
        catch (RedisStoreException exception)
        {
            logger.LogWarning("OTP verification storage is unavailable: {ExceptionType}.", exception.GetType().Name);
            throw Unavailable();
        }
    }
    #endregion

    #region Private Methods
    private async Task CancelUndeliveredChallengeAsync(string phoneKey, string id, CancellationToken cancellationToken)
    {
        try
        {
            var indexKey = ChallengeKey(id);
            for (var attempt = 0; attempt < MaximumCasAttempts; attempt++)
            {
                var values = await redis.GetManyAsync([phoneKey, indexKey], cancellationToken);
                var raw = values[phoneKey];
                var state = ReadState<PhoneState>(raw);
                var now = clock.GetUtcNow();
                if (state is null || state.ChallengeId != id || values[indexKey] != phoneKey || state.LockedUntil > now) return;
                var updated = state with { ChallengeId = null, CodeHash = null, CodeExpiresAt = null, ResendAt = now };
                if (await redis.CompareExchangeAsync([new(phoneKey, raw), new(indexKey, phoneKey)],
                    [new(phoneKey, Serialize(updated), PhoneLifetime(updated, now)), new(indexKey, null)], cancellationToken)) return;
            }
        }
        catch (RedisStoreException)
        {
            logger.LogWarning("Undelivered OTP cleanup will be completed by expiration.");
        }
    }

    private static TimeSpan PhoneLifetime(PhoneState state, DateTimeOffset now)
    {
        var until = state.WindowStart.AddSeconds(AppConfigurationStatic.GetOtpRateWindowSeconds());
        foreach (var candidate in new[] { state.CodeExpiresAt, state.ResendAt, state.LockedUntil })
            if (candidate is { } value && value > until) until = value;
        return Positive(until - now);
    }
    private static TimeSpan Positive(TimeSpan value) => value > TimeSpan.Zero ? value : TimeSpan.FromMilliseconds(1);
    private static T? ReadState<T>(string? value) where T : class
    {
        if (value is null) return null;
        try { return JsonSerializer.Deserialize<T>(value, JsonOptions); }
        catch (JsonException exception) { throw new RedisStoreException("OTP state is invalid.", exception); }
    }
    private static string Serialize<T>(T value) => JsonSerializer.Serialize(value, JsonOptions);
    private static string ChallengeKey(string id) => Prefix + "challenge:" + id;
    private static string PhoneKey(string phone) => Prefix + "phone:" + Digest(phone);
    private static string IpKey(string ip) => Prefix + "ip:" + Digest(ip);
    private static string Digest(string value) => Convert.ToHexString(HMACSHA256.HashData(
        Encoding.UTF8.GetBytes(AppConfigurationStatic.GetOtpHmacKey()), Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    private static string CodeHash(string id, string phone, string code) => Digest($"{id}:{phone}:{code}");
    private static ApiException Limited(TimeSpan retry) => new(429, "تعداد درخواست‌ها بیش از حد مجاز است.",
        $"پس از {Math.Max(1, (int)Math.Ceiling(retry.TotalSeconds))} ثانیه دوباره تلاش کنید.");
    private static ApiException InvalidCode() => new(400, "کد نامعتبر یا منقضی شده است.", "کد تازه درخواست کنید یا کد صحیح را وارد کنید.");
    private static ApiException Unavailable() => new(503, "ورود پیامکی در دسترس نیست.", "کمی بعد دوباره تلاش کنید.");
    #endregion

    #region Internal State Models
    private sealed record PhoneState(string PhoneNumber, string? ChallengeId, string? CodeHash, DateTimeOffset? CodeExpiresAt,
        DateTimeOffset? ResendAt, DateTimeOffset? LockedUntil, int FailedAttempts, DateTimeOffset WindowStart, int RequestCount);
    private sealed record RateState(DateTimeOffset WindowStart, int Count);
    #endregion
}
