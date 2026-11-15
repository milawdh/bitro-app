using System.Text.RegularExpressions;

namespace BitroLearn.Api.Infrastructure.Configuration;

public static class AppConfigurationStatic
{
    #region Environment Keys
    public const string EnvFileKey = "BITRO_ENV_FILE";
    public const string HttpPortKey = "BITRO_HTTP_PORT";
    public const string DbConnectionStringKey = "BITRO_DB_CONNECTION_STRING";
    public const string RedisConnectionStringKey = "BITRO_REDIS_CONNECTION_STRING";
    public const string OpenApiEnabledKey = "BITRO_OPENAPI_ENABLED";
    public const string SuperUserEmailKey = "BITRO_SUPERUSER_EMAIL";
    public const string SuperUserPasswordKey = "BITRO_SUPERUSER_PASSWORD";
    public const string AdminMaxAttemptsKey = "BITRO_ADMIN_MAX_ATTEMPTS";
    public const string AdminLockSecondsKey = "BITRO_ADMIN_LOCK_SECONDS";
    public const string OtpHmacKey = "BITRO_OTP_HMAC_KEY";
    public const string OtpTtlSecondsKey = "BITRO_OTP_TTL_SECONDS";
    public const string OtpResendSecondsKey = "BITRO_OTP_RESEND_SECONDS";
    public const string OtpMaxAttemptsKey = "BITRO_OTP_MAX_ATTEMPTS";
    public const string OtpLockSecondsKey = "BITRO_OTP_LOCK_SECONDS";
    public const string OtpRateWindowSecondsKey = "BITRO_OTP_RATE_WINDOW_SECONDS";
    public const string OtpPhoneHourlyLimitKey = "BITRO_OTP_PHONE_HOURLY_LIMIT";
    public const string OtpIpHourlyLimitKey = "BITRO_OTP_IP_HOURLY_LIMIT";
    public const string CookieSecureKey = "BITRO_COOKIE_SECURE";
    public const string CookieLifetimeHoursKey = "BITRO_COOKIE_LIFETIME_HOURS";
    public const string DataProtectionApplicationNameKey = "BITRO_DATA_PROTECTION_APPLICATION_NAME";
    public const string S3EndpointKey = "BITRO_S3_ENDPOINT";
    public const string S3AccessKeyKey = "BITRO_S3_ACCESS_KEY";
    public const string S3SecretKeyKey = "BITRO_S3_SECRET_KEY";
    public const string S3BucketKey = "BITRO_S3_BUCKET";
    public const string TrustedProxyNetworkKey = "BITRO_TRUSTED_PROXY_NETWORK";
    public const string PostgresPasswordKey = "BITRO_POSTGRES_PASSWORD";
    public const string RedisPasswordKey = "BITRO_REDIS_PASSWORD";
    public const string LocalEnvironmentKey = "ASPNETCORE_ENVIRONMENT";
    public const string ListenUrlsKey = "ASPNETCORE_URLS";
    public const string CacheLocalSecondsKey = "BITRO_CACHE_LOCAL_SECONDS";
    public const string CacheDistributedSecondsKey = "BITRO_CACHE_DISTRIBUTED_SECONDS";
    #endregion

    #region Environment Reading

    public static string? ReadEnv(this string key) => ReadEnv(key, Environment.GetEnvironmentVariable);

    internal static string? ReadEnv(string key, Func<string, EnvironmentVariableTarget, string?> reader)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        foreach (var scope in new[] { EnvironmentVariableTarget.Process, EnvironmentVariableTarget.User, EnvironmentVariableTarget.Machine })
        {
            var value = reader(key, scope);
            if (!string.IsNullOrWhiteSpace(value)) return value;
        }
        return null;
    }

    #endregion

    #region Environment File Loading

    // The file is a fallback: an existing value at ANY OS scope has precedence.
    public static void LoadEnvFile(string? path = null)
    {
        var explicitPath = path ?? EnvFileKey.ReadEnv();
        var selected = explicitPath ?? new[]
        {
            Path.Combine(Directory.GetCurrentDirectory(), ".env"),
            Path.Combine(Directory.GetCurrentDirectory(), "backend", ".env"),
            Path.Combine(AppContext.BaseDirectory, ".env")
        }.FirstOrDefault(File.Exists);
        if (selected is null) return;
        if (!File.Exists(selected)) throw new InvalidOperationException("The configured environment file does not exist.");

        foreach (var rawLine in File.ReadLines(selected))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;
            if (line.StartsWith("export ", StringComparison.Ordinal)) line = line[7..].TrimStart();
            var separator = line.IndexOf('=');
            if (separator <= 0) throw new InvalidOperationException("Invalid environment file entry.");
            var key = line[..separator].Trim();
            if (!Regex.IsMatch(key, "^[A-Za-z_][A-Za-z0-9_]*$")) throw new InvalidOperationException("Invalid environment key.");
            var value = line[(separator + 1)..].Trim();
            if (value.StartsWith('"') || value.StartsWith('\''))
            {
                var quote = value[0];
                var end = value.LastIndexOf(quote);
                if (end == 0 || (value[(end + 1)..].Trim() is { Length: > 0 } suffix && !suffix.StartsWith('#')))
                    throw new InvalidOperationException($"Invalid quoted environment entry: {key}.");
                value = value[1..end];
            }
            else
            {
                var comment = value.IndexOf(" #", StringComparison.Ordinal);
                if (comment >= 0) value = value[..comment].TrimEnd();
            }
            if (key.ReadEnv() is null && !string.IsNullOrWhiteSpace(value))
                Environment.SetEnvironmentVariable(key, value, EnvironmentVariableTarget.Process);
        }
    }

    #endregion

    #region Typed Settings

    public static string GetDbConnectionString() => Required(DbConnectionStringKey);
    public static int GetHttpPort() => Integer(HttpPortKey, 7075, 1, 65535);
    public static string GetRedisConnectionString() => Required(RedisConnectionStringKey);
    public static string GetSuperUserEmail() => SuperUserEmailKey.ReadEnv() ?? "admin@bitrolearn.local";
    public static string GetSuperUserPassword() => Required(SuperUserPasswordKey);
    public static int GetAdminMaxAttempts() => Integer(AdminMaxAttemptsKey, 5, 1, 20);
    public static int GetAdminLockSeconds() => Integer(AdminLockSecondsKey, 900, 1, 86400);
    public static bool GetOpenApiEnabled() => Boolean(OpenApiEnabledKey, false);
    public static string GetOtpHmacKey() => Required(OtpHmacKey);
    public static int GetOtpTtlSeconds() => Integer(OtpTtlSecondsKey, 120, 30, 600);
    public static int GetOtpResendSeconds() => Integer(OtpResendSecondsKey, 60, 1, 600);
    public static int GetOtpMaxAttempts() => Integer(OtpMaxAttemptsKey, 5, 1, 10);
    public static int GetOtpLockSeconds() => Integer(OtpLockSecondsKey, 900, 1, 86400);
    public static int GetOtpRateWindowSeconds() => Integer(OtpRateWindowSecondsKey, 3600, 1, 86400);
    public static int GetOtpPhoneHourlyLimit() => Integer(OtpPhoneHourlyLimitKey, 5, 1, 100);
    public static int GetOtpIpHourlyLimit() => Integer(OtpIpHourlyLimitKey, 20, 1, 1000);
    public static bool GetCookieSecure() => Boolean(CookieSecureKey, true);
    public static int GetCookieLifetimeHours() => Integer(CookieLifetimeHoursKey, 8, 1, 168);
    public static int GetCacheLocalSeconds() => Integer(CacheLocalSecondsKey, 15, 1, 3600);
    public static int GetCacheDistributedSeconds() => Integer(CacheDistributedSecondsKey, 60, 1, 86400);
    public static string GetDataProtectionApplicationName() => DataProtectionApplicationNameKey.ReadEnv() ?? "BitroLearn.Backend";
    public static string GetS3Endpoint() => Required(S3EndpointKey);
    public static string GetS3AccessKey() => Required(S3AccessKeyKey);
    public static string GetS3SecretKey() => Required(S3SecretKeyKey);
    public static string GetS3Bucket() => S3BucketKey.ReadEnv() ?? "bitrolearn";
    public static string? GetTrustedProxyNetwork() => TrustedProxyNetworkKey.ReadEnv();

    #endregion

    #region Startup Validation

    public static void Validate(bool initializing)
    {
        _ = GetDbConnectionString();
        if (initializing)
        {
            if (!new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(GetSuperUserEmail()))
                throw new InvalidOperationException($"Invalid setting: {SuperUserEmailKey}.");
            _ = GetSuperUserPassword();
            return;
        }
        _ = GetRedisConnectionString(); _ = GetOpenApiEnabled(); _ = GetCookieSecure();
        _ = GetAdminMaxAttempts(); _ = GetAdminLockSeconds();
        _ = GetCookieLifetimeHours(); _ = GetOtpTtlSeconds(); _ = GetOtpResendSeconds();
        _ = GetOtpMaxAttempts(); _ = GetOtpLockSeconds(); _ = GetOtpRateWindowSeconds();
        _ = GetOtpPhoneHourlyLimit(); _ = GetOtpIpHourlyLimit();
        _ = GetCacheLocalSeconds(); _ = GetCacheDistributedSeconds();
        if (GetOtpHmacKey().Length < 32) throw new InvalidOperationException($"Setting must contain at least 32 characters: {OtpHmacKey}.");
        if (!Uri.TryCreate(GetS3Endpoint(), UriKind.Absolute, out var endpoint) || endpoint.Scheme is not ("http" or "https"))
            throw new InvalidOperationException($"Invalid endpoint setting: {S3EndpointKey}.");
        _ = GetS3AccessKey(); _ = GetS3SecretKey();
    }

    #endregion

    #region Parsing Helpers

    private static string Required(string key) => key.ReadEnv() ?? throw new InvalidOperationException($"Missing required environment setting: {key}.");
    private static bool Boolean(string key, bool fallback) => key.ReadEnv() is not { } value ? fallback :
        bool.TryParse(value, out var result) ? result : throw new InvalidOperationException($"Invalid boolean setting: {key}.");
    private static int Integer(string key, int fallback, int min, int max) => key.ReadEnv() is not { } value ? fallback :
        int.TryParse(value, out var result) && result >= min && result <= max ? result : throw new InvalidOperationException($"Invalid numeric setting: {key}.");

    #endregion
}
