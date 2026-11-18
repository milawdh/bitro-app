using BitroLearn.Api.Infrastructure.Configuration;

namespace BitroLearn.Api.Tests;

public sealed class ConfigurationTests
{
    #region Environment precedence
    [Theory]
    [InlineData(null,14400)]
    [InlineData("60",60)]
    [InlineData("14400",14400)]
    public void Media_link_lifetime_is_configurable_with_four_hour_default(string? value,int expected)
    {
        using var env=new EnvironmentScope(new Dictionary<string,string?> {[AppConfigurationStatic.MediaLinkLifetimeSecondsKey]=value});
        Assert.Equal(expected,AppConfigurationStatic.GetMediaLinkLifetimeSeconds());
    }
    [Theory]
    [InlineData("0")]
    [InlineData("59")]
    [InlineData("604801")]
    [InlineData("invalid")]
    public void Invalid_media_link_lifetime_is_rejected(string value)
    {
        using var env=new EnvironmentScope(new Dictionary<string,string?> {[AppConfigurationStatic.MediaLinkLifetimeSecondsKey]=value});
        Assert.Throws<InvalidOperationException>(()=>AppConfigurationStatic.GetMediaLinkLifetimeSeconds());
    }

    [Theory]
    [InlineData("process", "user", "machine", "process")]
    [InlineData(null, "user", "machine", "user")]
    [InlineData("  ", "", "machine", "machine")]
    [InlineData(null, null, null, null)]
    public void Environment_scopes_use_first_nonblank_value(string? process, string? user, string? machine, string? expected)
    {
        var result = AppConfigurationStatic.ReadEnv("BITRO_TEST_SETTING", (_, scope) => scope switch
        {
            EnvironmentVariableTarget.Process => process,
            EnvironmentVariableTarget.User => user,
            EnvironmentVariableTarget.Machine => machine,
            _ => throw new ArgumentOutOfRangeException(nameof(scope))
        });
        Assert.Equal(expected, result);
    }

    [Fact]
    public void Existing_process_value_does_not_read_lower_scopes()
    {
        var visited = new List<EnvironmentVariableTarget>();
        var value = AppConfigurationStatic.ReadEnv("BITRO_TEST_SETTING", (_, scope) =>
        {
            visited.Add(scope);
            return "process-value";
        });
        Assert.Equal("process-value", value);
        Assert.Equal([EnvironmentVariableTarget.Process], visited);
    }

    #endregion

    #region Environment file loading

    [Fact]
    public void Environment_file_fills_missing_values_without_overwriting_process()
    {
        var prefix = "BITRO_TEST_" + Guid.NewGuid().ToString("N").ToUpperInvariant();
        var preserved = prefix + "_EXISTING";
        var quoted = prefix + "_QUOTED";
        var unquoted = prefix + "_COMMENT";
        var file = Path.GetTempFileName();
        using var environment = new EnvironmentScope(new Dictionary<string, string?>
        {
            [preserved] = "inherited", [quoted] = null, [unquoted] = null
        });
        try
        {
            File.WriteAllText(file, $"{preserved}=file-value\nexport {quoted}=\"value with # inside\" # outside\n{unquoted}=plain # comment\n");
            AppConfigurationStatic.LoadEnvFile(file);
            Assert.Equal("inherited", preserved.ReadEnv());
            Assert.Equal("value with # inside", quoted.ReadEnv());
            Assert.Equal("plain", unquoted.ReadEnv());
        }
        finally { File.Delete(file); }
    }

    #endregion

    #region Typed settings validation

    [Fact]
    public void Required_connection_string_uses_the_process_override()
    {
        const string configured = "Host=test-only;Database=configuration-test;Password=not-a-production-secret";
        using var environment = new EnvironmentScope(new Dictionary<string, string?>
        {
            [AppConfigurationStatic.DbConnectionStringKey] = configured
        });
        Assert.Equal(configured, AppConfigurationStatic.GetDbConnectionString());
    }

    [Fact]
    public void Invalid_boolean_is_rejected_instead_of_enabling_documentation()
    {
        const string invalid = "invalid-and-not-a-secret";
        using var environment = new EnvironmentScope(new Dictionary<string, string?>
        {
            [AppConfigurationStatic.OpenApiEnabledKey] = invalid
        });
        var error = Assert.Throws<InvalidOperationException>(() => AppConfigurationStatic.GetOpenApiEnabled());
        Assert.Contains(AppConfigurationStatic.OpenApiEnabledKey, error.Message);
        Assert.DoesNotContain(invalid, error.Message);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("601")]
    [InlineData("not-an-integer")]
    public void Invalid_otp_lifetime_is_rejected(string value)
    {
        using var environment = new EnvironmentScope(new Dictionary<string, string?>
        {
            [AppConfigurationStatic.OtpTtlSecondsKey] = value
        });
        Assert.Throws<InvalidOperationException>(() => AppConfigurationStatic.GetOtpTtlSeconds());
    }

    [Theory]
    [InlineData("0")]
    [InlineData("21")]
    [InlineData("not-an-integer")]
    public void Invalid_admin_attempt_limit_is_rejected(string value)
    {
        using var environment = new EnvironmentScope(new Dictionary<string, string?>
        {
            [AppConfigurationStatic.AdminMaxAttemptsKey] = value
        });
        Assert.Throws<InvalidOperationException>(() => AppConfigurationStatic.GetAdminMaxAttempts());
    }

    [Fact]
    public void Invalid_lock_and_rate_window_are_not_silently_accepted()
    {
        using var environment = new EnvironmentScope(new Dictionary<string, string?>
        {
            [AppConfigurationStatic.OtpLockSecondsKey] = "0",
            [AppConfigurationStatic.OtpRateWindowSecondsKey] = "0"
        });
        Assert.Throws<InvalidOperationException>(() => AppConfigurationStatic.GetOtpLockSeconds());
        Assert.Throws<InvalidOperationException>(() => AppConfigurationStatic.GetOtpRateWindowSeconds());
    }

    #endregion
}

internal sealed class EnvironmentScope : IDisposable
{
    #region Environment lifecycle

    private readonly Dictionary<string, string?> previous;
    public EnvironmentScope(IReadOnlyDictionary<string, string?> settings)
    {
        previous = settings.Keys.ToDictionary(key => key, key => Environment.GetEnvironmentVariable(key, EnvironmentVariableTarget.Process));
        foreach (var (key, value) in settings) Environment.SetEnvironmentVariable(key, value, EnvironmentVariableTarget.Process);
    }
    public void Dispose()
    {
        foreach (var (key, value) in previous) Environment.SetEnvironmentVariable(key, value, EnvironmentVariableTarget.Process);
    }

    #endregion
}
