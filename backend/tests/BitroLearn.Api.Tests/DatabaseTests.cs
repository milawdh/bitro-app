using System.Text.Json;
using BitroLearn.Api.Data;
using BitroLearn.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace BitroLearn.Api.Tests;

public sealed class DatabaseTests(PostgresFixture database) : IClassFixture<PostgresFixture>
{
    #region Initialization and curriculum

    [PostgresFact]
    public async Task Empty_database_migrates_and_receives_real_content_without_fake_learners()
    {
        Assert.Equal(new ContentCounts(3, 37, 8, 9, 4, 1), database.InitialCounts);
        Assert.Equal(1, database.InitialAdminUsers);
        Assert.Equal(0, database.InitialAppUsers);
        await using var context = database.CreateContext();
        Assert.Empty(await context.Database.GetPendingMigrationsAsync());
        var template = await context.ProjectTemplates.SingleAsync(project => project.Id == "my-first-api");
        using var files = JsonDocument.Parse(template.FilesJson);
        Assert.Equal(7, files.RootElement.GetArrayLength());
        Assert.False(await context.Users.AnyAsync(user => user.Email != null && user.Email.EndsWith("@example.com")));
        Assert.Equal("csharp-module-2", (await context.Lessons.SingleAsync(lesson => lesson.Id == "csharp-variables")).ModuleId);
        Assert.Equal("dotnet-module-3", (await context.Lessons.SingleAsync(lesson => lesson.Id == "dotnet-http")).ModuleId);
    }

    [PostgresFact]
    public async Task Repeated_initialization_preserves_edited_content_and_superuser_password()
    {
        string passwordHash;
        ContentCounts counts;
        await using (var context = database.CreateContext())
        {
            passwordHash = (await context.Users.SingleAsync(user => user.Id == "system-superadmin")).PasswordHash!;
            var course = await context.Courses.SingleAsync(item => item.Id == "architecture");
            course.Title = "Edited by integration test";
            await context.SaveChangesAsync();
            counts = await PostgresFixture.CountContentAsync(context);
        }
        await Task.WhenAll(database.InitializeDatabaseAsync(), database.InitializeDatabaseAsync());
        await using var reloaded = database.CreateContext();
        Assert.Equal(counts, await PostgresFixture.CountContentAsync(reloaded));
        Assert.Equal("Edited by integration test", (await reloaded.Courses.SingleAsync(item => item.Id == "architecture")).Title);
        Assert.Equal(passwordHash, (await reloaded.Users.SingleAsync(user => user.Id == "system-superadmin")).PasswordHash);
        Assert.Equal(3, await reloaded.Roles.CountAsync());
    }

    #endregion

    #region Optimistic editing

    [PostgresFact]
    public async Task Stale_edit_is_rejected_by_database_concurrency_token()
    {
        var id = "test-course-" + Guid.NewGuid().ToString("N");
        await using (var setup = database.CreateContext())
        {
            setup.Courses.Add(new Course { Id = id, Slug = id, Title = "Original" });
            await setup.SaveChangesAsync();
        }
        await using var first = database.CreateContext();
        await using var second = database.CreateContext();
        var firstCopy = await first.Courses.SingleAsync(course => course.Id == id);
        var staleCopy = await second.Courses.SingleAsync(course => course.Id == id);
        firstCopy.Title = "First editor";
        await first.SaveChangesAsync();
        Assert.Equal(2, firstCopy.Version);
        staleCopy.Title = "Stale editor";
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync());
    }

    #endregion

    #region Database constraints

    [PostgresFact]
    public async Task Course_slug_must_be_unique()
    {
        await using var context = database.CreateContext();
        var slug = "test-" + Guid.NewGuid().ToString("N");
        context.Courses.AddRange(new Course { Slug = slug, Title = "First" }, new Course { Slug = slug, Title = "Second" });
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        Assert.Equal(PostgresErrorCodes.UniqueViolation, Assert.IsType<PostgresException>(error.InnerException).SqlState);
    }

    [PostgresFact]
    public async Task Lesson_cannot_reference_another_courses_module()
    {
        await using var context = database.CreateContext();
        context.Lessons.Add(new Lesson
        {
            Slug = "test-" + Guid.NewGuid().ToString("N"), Title = "Wrong module", CourseId = "csharp",
            ModuleId = "dotnet-module-3", Duration = 10, ChoicesJson = "[\"a\",\"b\"]", Answer = 0
        });
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, Assert.IsType<PostgresException>(error.InnerException).SqlState);
    }

    [PostgresFact]
    public async Task A_quiz_attempt_must_target_exactly_one_lesson_or_challenge()
    {
        await using var context = database.CreateContext();
        var learner = new AppUser { PhoneNumber = "+989" + System.Security.Cryptography.RandomNumberGenerator.GetInt32(100_000_000, 1_000_000_000) };
        context.AppUsers.Add(learner);
        await context.SaveChangesAsync();
        context.QuizAttempts.Add(new QuizAttempt
        {
            UserId = learner.Id, LessonId = "csharp-variables",
            ChallengeId = await context.Challenges.Select(challenge => challenge.Id).FirstAsync(), TotalCount = 1
        });
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        var postgres = Assert.IsType<PostgresException>(error.InnerException);
        Assert.Equal(PostgresErrorCodes.CheckViolation, postgres.SqlState);
        Assert.Equal("CK_QuizAttempts_Target", postgres.ConstraintName);
    }

    [PostgresFact]
    public async Task Same_draft_cannot_be_inserted_twice_for_user_lesson_and_mode()
    {
        await using var context = database.CreateContext();
        var user = new AppUser { PhoneNumber = "+989" + System.Security.Cryptography.RandomNumberGenerator.GetInt32(100_000_000, 1_000_000_000) };
        context.AppUsers.Add(user);
        context.CodeDrafts.AddRange(
            new CodeDraft { UserId = user.Id, LessonId = "csharp-variables", Mode = "guided", Code = "first" },
            new CodeDraft { UserId = user.Id, LessonId = "csharp-variables", Mode = "guided", Code = "second" });
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        Assert.Equal(PostgresErrorCodes.UniqueViolation, Assert.IsType<PostgresException>(error.InnerException).SqlState);
    }

    #endregion
}
