using BitroLearn.Api.Data;
using BitroLearn.Api.Entities;
using BitroLearn.Api.Infrastructure.Configuration;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace BitroLearn.Api.Tests;

public sealed class PostgresFactAttribute : FactAttribute
{
    #region Integration prerequisites

    public PostgresFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("BITRO_TEST_DB_CONNECTION_STRING")))
            Skip = "Set BITRO_TEST_DB_CONNECTION_STRING to run isolated PostgreSQL integration tests.";
    }

    #endregion
}

public sealed class PostgresFixture : IAsyncLifetime
{
    #region Fixture state

    private string? managementConnection;
    private string? databaseName;
    private EnvironmentScope? environment;
    public string ConnectionString { get; private set; } = string.Empty;
    public ContentCounts InitialCounts { get; private set; } = new(0, 0, 0, 0, 0, 0);
    public int InitialAdminUsers { get; private set; }
    public int InitialAppUsers { get; private set; }

    #endregion

    #region Isolated database initialization

    public async Task InitializeAsync()
    {
        var configured = Environment.GetEnvironmentVariable("BITRO_TEST_DB_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(configured)) return;
        var builder = new NpgsqlConnectionStringBuilder(configured);
        databaseName = "bitro_tests_" + Guid.NewGuid().ToString("N");
        builder.Database = "postgres";
        managementConnection = builder.ConnectionString;
        await using (var connection = new NpgsqlConnection(managementConnection))
        {
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"", connection);
            await command.ExecuteNonQueryAsync();
        }
        builder.Database = databaseName;
        ConnectionString = builder.ConnectionString;
        environment = new EnvironmentScope(new Dictionary<string, string?>
        {
            [AppConfigurationStatic.DbConnectionStringKey] = ConnectionString,
            [AppConfigurationStatic.SuperUserEmailKey] = "admin@bitrolearn.local",
            [AppConfigurationStatic.SuperUserPasswordKey] = "BitroTest!739284Aa"
        });
        await InitializeDatabaseAsync();
        await using var context = CreateContext();
        InitialCounts = await CountContentAsync(context);
        InitialAdminUsers = await context.Users.CountAsync();
        InitialAppUsers = await context.AppUsers.CountAsync();
    }

    public AppDbContext CreateContext() => new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(ConnectionString).Options);

    public async Task InitializeDatabaseAsync()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(ConnectionString));
        services.AddIdentityCore<AdminUser>().AddRoles<IdentityRole>().AddEntityFrameworkStores<AppDbContext>();
        services.AddScoped<DatabaseInitializer>();
        await using var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync();
    }

    public static async Task<ContentCounts> CountContentAsync(AppDbContext context) => new(
        await context.Courses.CountAsync(), await context.CourseModules.CountAsync(), await context.Lessons.CountAsync(),
        await context.Labs.CountAsync(), await context.Challenges.CountAsync(), await context.ProjectTemplates.CountAsync());

    #endregion

    #region Fixture cleanup

    public async Task DisposeAsync()
    {
        environment?.Dispose();
        if (databaseName is null || managementConnection is null) return;
        if (!databaseName.StartsWith("bitro_tests_", StringComparison.Ordinal)) throw new InvalidOperationException("Unsafe test database cleanup target.");
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(managementConnection);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{databaseName}\" WITH (FORCE)", connection);
        await command.ExecuteNonQueryAsync();
    }

    #endregion
}

#region Database fixture results
public sealed record ContentCounts(int Courses, int Modules, int Lessons, int Labs, int Challenges, int Projects);
#endregion
