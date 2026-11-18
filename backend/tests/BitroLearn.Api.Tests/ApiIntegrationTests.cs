using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BitroLearn.Api.Infrastructure.Configuration;
using BitroLearn.Api.Infrastructure.SMS;
using BitroLearn.Api.Data;
using BitroLearn.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BitroLearn.Api.Tests;

public sealed class ApiIntegrationTests(PostgresFixture database) : IClassFixture<PostgresFixture>
{
    #region HTTP security and documentation

    [RedisFact]
    public async Task Unauthenticated_area_requests_return_401_without_redirects()
    {
        using var factory = new BackendTestFactory(database.ConnectionString);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        foreach (var route in new[] { "/app/auth/me", "/admin/auth/me", "/app/lessons/unknown/progress", "/app/lessons/unknown/drafts/guided", "/app/project-templates/unknown/workspace", "/app/quiz-attempts" })
        {
            var response = await client.GetAsync(route);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Null(response.Headers.Location);
            Assert.Contains("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        }
    }

    [RedisFact]
    public async Task Login_without_csrf_is_rejected_before_credentials_are_processed()
    {
        using var factory = new BackendTestFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/admin/auth/login", new { username = "admin@bitrolearn.local", password = "not-used" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [RedisFact]
    public async Task Disabling_documentation_removes_both_ui_and_document()
    {
        using var factory = new BackendTestFactory(database.ConnectionString, docsEnabled: false);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/scalar")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/openapi/v1.json")).StatusCode);
    }

    #endregion

    #region Independent area sessions

    [RedisFact]
    public async Task Admin_and_app_sessions_remain_independent_in_one_browser()
    {
        using var factory = new BackendTestFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        await SetCsrfAsync(client, "admin");
        var login = await client.PostAsJsonAsync("/admin/auth/login", new { username = "admin@bitrolearn.local", password = "BitroTest!739284Aa" });
        login.EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/admin/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/app/auth/me")).StatusCode);

        var phone = "+989" + System.Security.Cryptography.RandomNumberGenerator.GetInt32(100_000_000, 1_000_000_000);
        await SetCsrfAsync(client, "app");
        var requested = await client.PostAsJsonAsync("/app/auth/otp/request", new { phoneNumber = phone });
        requested.EnsureSuccessStatusCode();
        using var requestBody = JsonDocument.Parse(await requested.Content.ReadAsStringAsync());
        Assert.False(requestBody.RootElement.TryGetProperty("code", out _));
        var challenge = requestBody.RootElement.GetProperty("challengeId").GetString();
        var verified = await client.PostAsJsonAsync("/app/auth/otp/verify", new { challengeId = challenge, code = factory.Sms.Codes[phone] });
        verified.EnsureSuccessStatusCode();
        using var appIdentity = JsonDocument.Parse(await verified.Content.ReadAsStringAsync());
        Assert.False(appIdentity.RootElement.TryGetProperty("roles", out _));
        Assert.False(appIdentity.RootElement.TryGetProperty("email", out _));
        Assert.Equal(phone, appIdentity.RootElement.GetProperty("phoneNumber").GetString());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/app/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/admin/auth/me")).StatusCode);

        await SetCsrfAsync(client, "admin");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/app/auth/logout", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/app/auth/me")).StatusCode);
        await SetCsrfAsync(client, "app");
        (await client.PostAsJsonAsync("/app/auth/logout", new { })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/app/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/admin/auth/me")).StatusCode);
    }

    #endregion

    #region Request validation and live account controls

    [RedisFact]
    public async Task Missing_request_fields_return_validation_errors()
    {
        using var factory = new BackendTestFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        foreach (var (route, area) in new[] { ("/admin/auth/login", "admin"), ("/app/auth/otp/request", "app"), ("/app/auth/otp/verify", "app") })
        {
            await SetCsrfAsync(client, area);
            var response = await client.PostAsJsonAsync(route, new { });
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            using var error = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.True(error.RootElement.TryGetProperty("errors", out _));
        }
    }

    [RedisFact]
    public async Task Suspended_app_account_loses_its_existing_cookie()
    {
        using var factory = new BackendTestFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        var id = await LoginAppAsync(factory, client);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.AppUsers.Where(user => user.Id == id).ExecuteUpdateAsync(update => update.SetProperty(user => user.IsActive, false));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/app/auth/me")).StatusCode);
    }

    [RedisFact]
    public async Task Removed_admin_role_is_not_retained_by_an_existing_cookie()
    {
        using var factory = new BackendTestFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        var (id, email) = await CreateAdminAsync(factory);
        await SetCsrfAsync(client, "admin");
        (await client.PostAsJsonAsync("/admin/auth/login", new { username = email, password = "BitroTest!739284Aa" })).EnsureSuccessStatusCode();
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.UserRoles.Where(role => role.UserId == id).ExecuteDeleteAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/admin/auth/me")).StatusCode);
    }

    [RedisFact]
    public async Task Admin_failed_attempt_limit_and_lock_duration_follow_environment()
    {
        using var settings = new EnvironmentScope(new Dictionary<string, string?>
        {
            [AppConfigurationStatic.AdminMaxAttemptsKey] = "2",
            [AppConfigurationStatic.AdminLockSecondsKey] = "1"
        });
        using var factory = new BackendTestFactory(database.ConnectionString);
        using var client = factory.CreateClient();
        var (_, email) = await CreateAdminAsync(factory);
        await SetCsrfAsync(client, "admin");
        for (var attempt = 0; attempt < 2; attempt++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/admin/auth/login", new { username = email, password = "wrong" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/admin/auth/login", new { username = email, password = "BitroTest!739284Aa" })).StatusCode);
        await Task.Delay(1100);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/admin/auth/login", new { username = email, password = "BitroTest!739284Aa" })).StatusCode);
    }

    #endregion

    #region CSRF request helpers

    private static async Task<string> LoginAppAsync(BackendTestFactory factory, HttpClient client)
    {
        var phone = "+989" + System.Security.Cryptography.RandomNumberGenerator.GetInt32(100_000_000, 1_000_000_000);
        await SetCsrfAsync(client, "app");
        var response = await client.PostAsJsonAsync("/app/auth/otp/request", new { phoneNumber = phone });
        response.EnsureSuccessStatusCode();
        using var issued = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var challenge = issued.RootElement.GetProperty("challengeId").GetString();
        var verified = await client.PostAsJsonAsync("/app/auth/otp/verify", new { challengeId = challenge, code = factory.Sms.Codes[phone] });
        verified.EnsureSuccessStatusCode();
        using var identity = JsonDocument.Parse(await verified.Content.ReadAsStringAsync());
        return identity.RootElement.GetProperty("id").GetString()!;
    }

    private static async Task<(string Id, string Email)> CreateAdminAsync(BackendTestFactory factory)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AdminUser>>();
        var id = Guid.NewGuid().ToString("N");
        var email = $"test-{id}@example.com";
        var user = new AdminUser { Id = id, UserName = email, Email = email, EmailConfirmed = true, IsActive = true };
        Assert.True((await users.CreateAsync(user, "BitroTest!739284Aa")).Succeeded);
        Assert.True((await users.AddToRoleAsync(user, "admin")).Succeeded);
        return (id, email);
    }

    private static async Task SetCsrfAsync(HttpClient client, string area)
    {
        var token = await client.GetFromJsonAsync<CsrfToken>("/public/auth/csrf?area=" + area);
        Assert.NotNull(token);
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token.RequestToken);
    }
    private sealed record CsrfToken(string RequestToken, string HeaderName);

    #endregion
}

internal sealed class BackendTestFactory : WebApplicationFactory<Program>
{
    #region Test host lifecycle

    private readonly EnvironmentScope environment;
    public RecordingSmsProvider Sms { get; } = new();

    public BackendTestFactory(string databaseConnection, bool docsEnabled = true)
    {
        var apiRoot = FindApiRoot();
        environment = new EnvironmentScope(new Dictionary<string, string?>
        {
            [AppConfigurationStatic.DbConnectionStringKey] = databaseConnection,
            [AppConfigurationStatic.RedisConnectionStringKey] = Environment.GetEnvironmentVariable("BITRO_TEST_REDIS_CONNECTION_STRING"),
            [AppConfigurationStatic.OpenApiEnabledKey] = docsEnabled ? "true" : "false",
            [AppConfigurationStatic.CookieSecureKey] = "false",
            [AppConfigurationStatic.OtpHmacKey] = "isolated-api-test-otp-key-" + Guid.NewGuid().ToString("N"),
            [AppConfigurationStatic.OtpIpHourlyLimitKey] = "1000",
            [AppConfigurationStatic.S3EndpointKey] = "http://127.0.0.1:1",
            [AppConfigurationStatic.S3AccessKeyKey] = "integration-test",
            [AppConfigurationStatic.S3SecretKeyKey] = "integration-test",
            ["ASPNETCORE_TEST_CONTENTROOT_BITROLEARN_API"] = apiRoot
        });
    }
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<ISMSProvider>();
            services.AddSingleton<ISMSProvider>(Sms);
        });
    }
    protected override void Dispose(bool disposing)
    {
        try { base.Dispose(disposing); }
        finally { if (disposing) environment.Dispose(); }
    }

    #endregion

    #region Content root discovery
    private static string FindApiRoot()
    {
        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            for (var current = new DirectoryInfo(start); current is not null; current = current.Parent)
            {
                var candidate = Path.Combine(current.FullName, "src", "BitroLearn.Api");
                if (File.Exists(Path.Combine(candidate, "BitroLearn.Api.csproj"))) return candidate;
                candidate = Path.Combine(current.FullName, "backend", "src", "BitroLearn.Api");
                if (File.Exists(Path.Combine(candidate, "BitroLearn.Api.csproj"))) return candidate;
            }
        }
        throw new InvalidOperationException("The API project content root was not found.");
    }

    #endregion
}
