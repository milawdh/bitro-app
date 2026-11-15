using System.Diagnostics;
using System.Net;
using Amazon.Runtime;
using Amazon.S3;
using BitroLearn.Api.Data;
using BitroLearn.Api.Infrastructure.Authentication;
using BitroLearn.Api.Infrastructure.Caching;
using BitroLearn.Api.Infrastructure.Configuration;
using BitroLearn.Api.Infrastructure.Health;
using BitroLearn.Api.Infrastructure.Http;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.OpenApi.Models;
using Scalar.AspNetCore;
using StackExchange.Redis;

#region Command Line Health Probe
if (args.Contains("--healthcheck", StringComparer.Ordinal))
{
    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
    try { Environment.ExitCode = (await client.GetAsync("http://127.0.0.1:8080/public/health/live")).IsSuccessStatusCode ? 0 : 1; }
    catch { Environment.ExitCode = 1; }
    return;
}
#endregion

#region Configuration and Core Services
AppConfigurationStatic.LoadEnvFile();
var initialize = args.Contains("--initialize", StringComparer.Ordinal);
AppConfigurationStatic.Validate(initialize);
var builder = WebApplication.CreateBuilder(args.Where(argument => argument != "--initialize").ToArray());
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole(options => options.IncludeScopes = true);
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(AppConfigurationStatic.GetDbConnectionString(), postgres => postgres.CommandTimeout(30)));
builder.Services.AddBitroAuthentication();
builder.Services.AddScoped<DatabaseInitializer>();
builder.Services.AddDataProtection().SetApplicationName(AppConfigurationStatic.GetDataProtectionApplicationName()).PersistKeysToDbContext<AppDbContext>();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "bitro.csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = AppConfigurationStatic.GetCookieSecure() ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
});
builder.Services.AddControllers(options => options.Filters.Add<CsrfValidationFilter>())
    .ConfigureApiBehaviorOptions(options => options.InvalidModelStateResponseFactory = context =>
    {
        var details = new ValidationProblemDetails(context.ModelState) { Status = 400, Title = "Request validation failed.", Instance = context.HttpContext.Request.Path };
        details.Extensions["requestId"] = context.HttpContext.TraceIdentifier;
        return new BadRequestObjectResult(details) { ContentTypes = { "application/problem+json" } };
    });
builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
    context.ProblemDetails.Extensions["requestId"] = context.HttpContext.TraceIdentifier);
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
{
    var options = ConfigurationOptions.Parse(AppConfigurationStatic.GetRedisConnectionString());
    options.AbortOnConnectFail = false; options.ConnectTimeout = 3000; options.AsyncTimeout = 3000;
    return ConnectionMultiplexer.Connect(options);
});
builder.Services.AddSingleton<IRedisStore, RedisStore>();
#endregion

#region Cache Storage Health and Documentation Services
if (!initialize)
{
    builder.Services.AddMemoryCache();
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = AppConfigurationStatic.GetRedisConnectionString();
        options.InstanceName = "bitro:cache:";
    });
    builder.Services.AddHybridCache(options =>
    {
        options.MaximumPayloadBytes = 1024 * 1024;
        options.MaximumKeyLength = 256;
        options.DefaultEntryOptions = new HybridCacheEntryOptions
        {
            Expiration = TimeSpan.FromSeconds(AppConfigurationStatic.GetCacheDistributedSeconds()),
            LocalCacheExpiration = TimeSpan.FromSeconds(AppConfigurationStatic.GetCacheLocalSeconds())
        };
    });
    builder.Services.AddSingleton<IAmazonS3>(_ => new AmazonS3Client(
        new BasicAWSCredentials(AppConfigurationStatic.GetS3AccessKey(), AppConfigurationStatic.GetS3SecretKey()),
        new AmazonS3Config { ServiceURL = AppConfigurationStatic.GetS3Endpoint(), ForcePathStyle = true, AuthenticationRegion = "us-east-1" }));
    builder.Services.AddHealthChecks()
        .AddCheck<PostgresHealthCheck>("postgres", timeout: TimeSpan.FromSeconds(4))
        .AddCheck<RedisHealthCheck>("redis", timeout: TimeSpan.FromSeconds(4))
        .AddCheck<ObjectStorageHealthCheck>("storage", timeout: TimeSpan.FromSeconds(4));
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(options =>
    {
        options.SwaggerDoc("v1", new OpenApiInfo { Title = "BitroLearn API", Version = "v1", Description = "Independent backend — Public, Admin and App areas. Admin and learner accounts and cookies are separate." });
        options.CustomSchemaIds(type => type.FullName?.Replace('+', '.'));
        options.SupportNonNullableReferenceTypes();
        options.TagActionsBy(description => [description.ActionDescriptor.RouteValues.TryGetValue("area", out var area) ? area ?? "Public" : "Public"]);
        options.AddSecurityDefinition("AdminCookie", new OpenApiSecurityScheme { Type = SecuritySchemeType.ApiKey, In = ParameterLocation.Cookie, Name = "bitro.admin.auth", Description = "Administrator session, issued by /admin/auth/login." });
        options.AddSecurityDefinition("AppCookie", new OpenApiSecurityScheme { Type = SecuritySchemeType.ApiKey, In = ParameterLocation.Cookie, Name = "bitro.app.auth", Description = "Learner session, issued after OTP verification." });
        options.OperationFilter<ApiDocumentationFilter>();
    });
}
#endregion

#region Trusted Proxy Configuration
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    if (AppConfigurationStatic.GetTrustedProxyNetwork() is { } network)
    {
        var parts = network.Split('/');
        if (parts.Length != 2 || !IPAddress.TryParse(parts[0], out var address) || !int.TryParse(parts[1], out var prefix))
            throw new InvalidOperationException("Invalid trusted proxy network.");
        options.KnownIPNetworks.Add(new System.Net.IPNetwork(address, prefix));
    }
});
#endregion

#region One-Time Database Initialization
var app = builder.Build();
if (initialize)
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync(CancellationToken.None);
    return;
}
#endregion

#region HTTP Pipeline
app.UseForwardedHeaders();
app.Use(async (context, next) =>
{
    context.TraceIdentifier = Guid.NewGuid().ToString("N");
    context.Response.Headers["X-Request-ID"] = context.TraceIdentifier;
    var start = Stopwatch.GetTimestamp();
    using var scope = app.Logger.BeginScope(new Dictionary<string, object?> { ["requestId"] = context.TraceIdentifier });
    try { await next(context); }
    finally { app.Logger.LogInformation("HTTP {Method} {Path} -> {StatusCode} in {ElapsedMs}ms", context.Request.Method, context.Request.Path.Value, context.Response.StatusCode, Stopwatch.GetElapsedTime(start).TotalMilliseconds); }
});
app.UseExceptionHandler();
app.UseStatusCodePages(async context =>
{
    await Results.Problem(statusCode: context.HttpContext.Response.StatusCode,
        extensions: new Dictionary<string, object?> { ["requestId"] = context.HttpContext.TraceIdentifier }).ExecuteAsync(context.HttpContext);
});
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
#endregion

#region Optional API Documentation
if (AppConfigurationStatic.GetOpenApiEnabled())
{
    app.MapSwagger("/openapi/{documentName}.json").AllowAnonymous();
    app.MapScalarApiReference("/scalar", options => options.WithTitle("BitroLearn API").WithOpenApiRoutePattern("/openapi/{documentName}.json")).AllowAnonymous();
}
else
{
    app.MapGet("/scalar", () => Results.NotFound()).AllowAnonymous().ExcludeFromDescription();
    app.MapGet("/scalar/{**path}", () => Results.NotFound()).AllowAnonymous().ExcludeFromDescription();
    app.MapGet("/openapi/{**path}", () => Results.NotFound()).AllowAnonymous().ExcludeFromDescription();
}
#endregion

#region Application Lifetime
await app.RunAsync();

public partial class Program;
#endregion
