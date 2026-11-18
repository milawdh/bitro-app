using System.Text.Json;
using BitroLearn.Api.Entities;
using BitroLearn.Api.Infrastructure.Configuration;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BitroLearn.Api.Data;

/// <summary>Run only from the explicit --initialize process, before starting web replicas.</summary>
public sealed class DatabaseInitializer(
    AppDbContext database,
    UserManager<AdminUser> users,
    RoleManager<IdentityRole> roles,
    ILogger<DatabaseInitializer> logger)
{
    #region Seed Constants

    public const string SuperUserId = "system-superadmin";
    public static readonly string[] SeedRoles = ["editor", "admin", "superadmin"];
    private const long InitializationLock = 82743563012;

    #endregion

    #region Initialization

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await database.Database.OpenConnectionAsync(cancellationToken);
        var locked = false;
        try
        {
            await AdvisoryLockAsync(true, cancellationToken);
            locked = true;
            await database.Database.MigrateAsync(cancellationToken);

            await SeedIdentityAsync(cancellationToken);
            var snapshot = await ReadSnapshotAsync(cancellationToken);
            foreach (var course in snapshot.Courses)
            {
                course.CoverPresetKey = course.Id == "dotnet" ? "server" : course.Id == "architecture" ? "layers" : "code";
                course.AnimationsJson = JsonSerializer.Serialize(snapshot.Lessons.Where(l => l.CourseId == course.Id).Select(l => l.Concept).Distinct().Select(key => new { key,enabled = true,settings = new { } }));
            }
            foreach (var lesson in snapshot.Lessons)
                lesson.AnimationsJson = JsonSerializer.Serialize(new[] { new { key = lesson.Concept,enabled = true,settings = new { } } });
            await InsertMissingAsync(snapshot.Courses, cancellationToken);
            await InsertMissingAsync(snapshot.Modules, cancellationToken);
            await InsertMissingAsync(snapshot.Lessons, cancellationToken);
            await InsertMissingAsync(snapshot.Labs, cancellationToken);
            await InsertMissingAsync(snapshot.Challenges, cancellationToken);
            await InsertMissingAsync(snapshot.ProjectTemplates, cancellationToken);
            logger.LogInformation("Database schema and initial curriculum are ready; existing content and credentials were preserved");
        }
        finally
        {
            try
            {
                if (locked) await AdvisoryLockAsync(false, CancellationToken.None);
            }
            finally
            {
                await database.Database.CloseConnectionAsync();
            }
        }
    }

    #endregion

    #region Private Seed Operations

    private async Task SeedIdentityAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        foreach (var role in SeedRoles)
        {
            if (!await roles.RoleExistsAsync(role))
                EnsureSuccess(await roles.CreateAsync(new IdentityRole(role)), "initial role");
        }

        var email = AppConfigurationStatic.GetSuperUserEmail().Trim();
        var user = await users.FindByIdAsync(SuperUserId);
        var emailOwner = await users.FindByEmailAsync(email);
        var usernameOwner = await users.FindByNameAsync(email);
        if ((emailOwner is not null && emailOwner.Id != SuperUserId)
            || (usernameOwner is not null && usernameOwner.Id != SuperUserId))
            throw new InvalidOperationException("The configured superuser email already belongs to another account. No account was promoted.");

        if (user is null)
        {
            user = new AdminUser
            {
                Id = SuperUserId,
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                FullName = "مدیر کل بیترو‌لرن",
                IsActive = true
            };
            EnsureSuccess(await users.CreateAsync(user, AppConfigurationStatic.GetSuperUserPassword()), "initial superuser");
            logger.LogInformation("Initial superuser account was created from environment settings");
        }
        else if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase)
                 || !string.Equals(user.UserName, email, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("The configured superuser email differs from the existing system account. Existing credentials were not changed.");
        }

        if (!await users.IsInRoleAsync(user, "superadmin"))
            EnsureSuccess(await users.AddToRoleAsync(user, "superadmin"), "superuser role");
    }

    private async Task InsertMissingAsync<TEntity>(IReadOnlyCollection<TEntity> seed, CancellationToken cancellationToken)
        where TEntity : VersionedEntity
    {
        var ids = seed.Select(entity => entity.Id).ToArray();
        var existing = (await database.Set<TEntity>().Where(entity => ids.Contains(entity.Id))
            .Select(entity => entity.Id).ToListAsync(cancellationToken)).ToHashSet(StringComparer.Ordinal);
        var missing = seed.Where(entity => !existing.Contains(entity.Id)).ToArray();
        if (missing.Length == 0) return;
        database.Set<TEntity>().AddRange(missing);
        await database.SaveChangesAsync(cancellationToken);
    }

    private static async Task<ContentSnapshot> ReadSnapshotAsync(CancellationToken cancellationToken)
    {
        await using var stream = typeof(DatabaseInitializer).Assembly
            .GetManifestResourceStream("BitroLearn.Api.Data.Seed.content.json")
            ?? throw new InvalidOperationException("The independent initial curriculum resource is missing.");
        return await JsonSerializer.DeserializeAsync<ContentSnapshot>(stream,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, cancellationToken)
            ?? throw new InvalidOperationException("The initial curriculum resource is empty.");
    }

    private async Task AdvisoryLockAsync(bool acquire, CancellationToken cancellationToken)
    {
        await using var command = database.Database.GetDbConnection().CreateCommand();
        command.CommandText = acquire ? "SELECT pg_advisory_lock(@key)" : "SELECT pg_advisory_unlock(@key)";
        command.CommandTimeout = 300;
        var parameter = command.CreateParameter();
        parameter.ParameterName = "key";
        parameter.Value = InitializationLock;
        command.Parameters.Add(parameter);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static void EnsureSuccess(IdentityResult result, string operation)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException($"Unable to create {operation}: {string.Join(", ", result.Errors.Select(error => error.Code))}.");
    }

    #endregion

    #region Seed Document

    private sealed class ContentSnapshot
    {
        #region Deserialization

        public ContentSnapshot() { }
        public Course[] Courses { get; init; } = [];
        public CourseModule[] Modules { get; init; } = [];
        public Lesson[] Lessons { get; init; } = [];
        public Lab[] Labs { get; init; } = [];
        public Challenge[] Challenges { get; init; } = [];
        public ProjectTemplate[] ProjectTemplates { get; init; } = [];

        #endregion
    }

    #endregion
}
