using BitroLearn.Api.Entities;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BitroLearn.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AdminUser>(options), IDataProtectionKeyContext
{
    #region DbSets

    public DbSet<DataProtectionKey> DataProtectionKeys { get; set; } = null!;
    public DbSet<AdminUser> AdminUsers => Users;
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<CourseModule> CourseModules => Set<CourseModule>();
    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<Lab> Labs => Set<Lab>();
    public DbSet<Challenge> Challenges => Set<Challenge>();
    public DbSet<ProjectTemplate> ProjectTemplates => Set<ProjectTemplate>();
    public DbSet<UserProgress> UserProgress => Set<UserProgress>();
    public DbSet<CodeDraft> CodeDrafts => Set<CodeDraft>();
    public DbSet<UserProject> UserProjects => Set<UserProject>();
    public DbSet<QuizAttempt> QuizAttempts => Set<QuizAttempt>();
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();
    public DbSet<CourseEnrollment> CourseEnrollments => Set<CourseEnrollment>();
    public DbSet<CoursePaidAccess> CoursePaidAccess => Set<CoursePaidAccess>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<SpotPlayerLicense> SpotPlayerLicenses => Set<SpotPlayerLicense>();
    public DbSet<ProviderAudit> ProviderAudits => Set<ProviderAudit>();
    public DbSet<VideoAsset> VideoAssets => Set<VideoAsset>();

    #endregion

    #region Model Configuration

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<AdminUser>(entity =>
        {
            entity.ToTable("AdminUsers");
            entity.Property(user => user.FullName).HasMaxLength(150);
            entity.HasIndex(user => user.NormalizedEmail).IsUnique()
                .HasFilter("\"NormalizedEmail\" IS NOT NULL");
        });
        builder.Entity<IdentityRole>().ToTable("AdminRoles");
        builder.Entity<IdentityUserRole<string>>().ToTable("AdminUserRoles");
        builder.Entity<IdentityUserClaim<string>>().ToTable("AdminUserClaims");
        builder.Entity<IdentityUserLogin<string>>().ToTable("AdminUserLogins");
        builder.Entity<IdentityRoleClaim<string>>().ToTable("AdminRoleClaims");
        builder.Entity<IdentityUserToken<string>>().ToTable("AdminUserTokens");

        builder.Entity<AppUser>(entity =>
        {
            entity.ToTable("AppUsers");
            entity.HasKey(user => user.Id);
            entity.Property(user => user.Id).HasMaxLength(160);
            entity.Property(user => user.FullName).HasMaxLength(150);
            entity.Property(user => user.PhoneNumber).HasMaxLength(20);
            entity.Property(user => user.SecurityStamp).HasMaxLength(64);
            entity.HasIndex(user => user.PhoneNumber).IsUnique()
                .HasDatabaseName("IX_AppUsers_PhoneNumber");
            entity.ToTable(table => table.HasCheckConstraint("CK_AppUsers_PhoneNumber", "\"PhoneNumber\" ~ '^\\+[1-9][0-9]{7,14}$'"));
        });

        ConfigureContent(builder.Entity<Course>(), "Courses");
        ConfigureCommerce(builder);
        builder.Entity<Course>(entity =>
        {
            entity.HasIndex(course => course.Slug).IsUnique();
            entity.Property(course => course.Subtitle).HasMaxLength(250);
            entity.Property(course => course.Level).HasMaxLength(30);
            entity.Property(course => course.Color).HasMaxLength(30);
        });

        ConfigureVersioned(builder.Entity<CourseModule>(), "CourseModules");
        builder.Entity<CourseModule>(entity =>
        {
            entity.Property(module => module.CourseId).HasMaxLength(160);
            entity.Property(module => module.Title).HasMaxLength(250);
            entity.HasAlternateKey(module => new { module.Id, module.CourseId });
            entity.HasOne<Course>().WithMany().HasForeignKey(module => module.CourseId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(module => new { module.CourseId, module.Order });
            entity.ToTable(table => table.HasCheckConstraint("CK_CourseModules_Order", "\"Order\" >= 0"));
        });

        ConfigureContent(builder.Entity<Lesson>(), "Lessons");
        builder.Entity<Lesson>(entity =>
        {
            entity.Property(lesson => lesson.CourseId).HasMaxLength(160);
            entity.Property(lesson => lesson.ModuleId).HasMaxLength(160);
            entity.Property(lesson => lesson.Concept).HasMaxLength(80);
            Json(entity.Property(lesson => lesson.ObjectivesJson));
            Json(entity.Property(lesson => lesson.OutputJson));
            Json(entity.Property(lesson => lesson.ChoicesJson));
            entity.HasOne<Course>().WithMany().HasForeignKey(lesson => lesson.CourseId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<CourseModule>().WithMany()
                .HasForeignKey(lesson => new { lesson.ModuleId, lesson.CourseId })
                .HasPrincipalKey(module => new { module.Id, module.CourseId })
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(lesson => new { lesson.CourseId, lesson.Slug }).IsUnique();
            entity.HasIndex(lesson => new { lesson.ModuleId, lesson.Order });
            entity.ToTable(table =>
            {
                table.HasCheckConstraint("CK_Lessons_Duration", "\"Duration\" > 0");
                table.HasCheckConstraint("CK_Lessons_Order", "\"Order\" >= 0");
                table.HasCheckConstraint("CK_Lessons_Answer", "jsonb_typeof(\"ChoicesJson\") = 'array' AND (NOT \"HasQuiz\" OR \"Status\" <> 'published' OR (\"Answer\" >= 0 AND \"Answer\" < jsonb_array_length(\"ChoicesJson\")))");
            });
        });

        ConfigureContent(builder.Entity<Lab>(), "Labs");
        builder.Entity<Lab>(entity =>
        {
            entity.HasIndex(lab => lab.Slug).IsUnique();
            entity.Property(lab => lab.Concept).HasMaxLength(80);
            entity.Property(lab => lab.Category).HasMaxLength(30);
            Json(entity.Property(lab => lab.ConfigJson));
            entity.ToTable(table => table.HasCheckConstraint("CK_Labs_Duration", "\"Duration\" > 0"));
        });

        ConfigureContent(builder.Entity<Challenge>(), "Challenges");
        builder.Entity<Challenge>(entity =>
        {
            entity.HasIndex(challenge => challenge.Slug).IsUnique();
            entity.Property(challenge => challenge.CourseId).HasMaxLength(160);
            entity.Property(challenge => challenge.Concept).HasMaxLength(80);
            entity.Property(challenge => challenge.Difficulty).HasMaxLength(30);
            Json(entity.Property(challenge => challenge.QuestionsJson));
            entity.HasOne<Course>().WithMany().HasForeignKey(challenge => challenge.CourseId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.ToTable(table => table.HasCheckConstraint("CK_Challenges_Duration", "\"Duration\" > 0"));
        });

        ConfigureContent(builder.Entity<ProjectTemplate>(), "ProjectTemplates");
        builder.Entity<ProjectTemplate>(entity =>
        {
            entity.HasIndex(project => project.Slug).IsUnique();
            entity.Property(project => project.CourseId).HasMaxLength(160);
            entity.Property(project => project.Difficulty).HasMaxLength(30);
            Json(entity.Property(project => project.ObjectivesJson));
            Json(entity.Property(project => project.FilesJson));
            entity.HasOne<Course>().WithMany().HasForeignKey(project => project.CourseId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.ToTable(table => table.HasCheckConstraint("CK_ProjectTemplates_Duration", "\"Duration\" > 0"));
        });

        ConfigureVersioned(builder.Entity<UserProgress>(), "UserProgress");
        builder.Entity<UserProgress>(entity =>
        {
            entity.ToTable(t => t.HasCheckConstraint("CK_UserProgress_VideoPosition", "\"VideoPositionSeconds\" IS NULL OR (\"VideoPositionSeconds\" >= 0 AND \"VideoPositionSeconds\" < 'Infinity'::float8)"));
            UserForeignKey(entity, progress => progress.UserId);
            entity.Property(progress => progress.LessonId).HasMaxLength(160);
            entity.HasOne<Lesson>().WithMany().HasForeignKey(progress => progress.LessonId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(progress => new { progress.UserId, progress.LessonId }).IsUnique();
            entity.ToTable(table => table.HasCheckConstraint("CK_UserProgress_Step", "\"Step\" >= 0"));
        });

        ConfigureVersioned(builder.Entity<CodeDraft>(), "CodeDrafts");
        builder.Entity<CodeDraft>(entity =>
        {
            UserForeignKey(entity, draft => draft.UserId);
            entity.Property(draft => draft.LessonId).HasMaxLength(160);
            entity.Property(draft => draft.Mode).HasMaxLength(20);
            entity.HasOne<Lesson>().WithMany().HasForeignKey(draft => draft.LessonId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(draft => new { draft.UserId, draft.LessonId, draft.Mode }).IsUnique();
            entity.ToTable(table => table.HasCheckConstraint("CK_CodeDrafts_Mode", "\"Mode\" IN ('guided', 'explore')"));
        });

        ConfigureVersioned(builder.Entity<UserProject>(), "UserProjects");
        builder.Entity<UserProject>(entity =>
        {
            entity.ToTable(t => t.HasCheckConstraint("CK_UserProjects_Checkpoint", "\"Checkpoint\" >= 0 AND \"TemplateVersion\" >= 1"));
            UserForeignKey(entity, project => project.UserId);
            entity.Property(project => project.ProjectTemplateId).HasMaxLength(160);
            Json(entity.Property(project => project.FilesJson));
            entity.HasOne<ProjectTemplate>().WithMany().HasForeignKey(project => project.ProjectTemplateId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(project => new { project.UserId, project.ProjectTemplateId }).IsUnique();
        });

        ConfigureVersioned(builder.Entity<QuizAttempt>(), "QuizAttempts");
        builder.Entity<QuizAttempt>(entity =>
        {
            entity.Property(a => a.IdempotencyKey).HasMaxLength(160);
            entity.HasIndex(a => new { a.UserId,a.IdempotencyKey }).IsUnique().HasFilter("\"IdempotencyKey\" IS NOT NULL");
            entity.HasIndex(a => new { a.UserId,a.ChallengeId,a.IsPassed });
            Json(entity.Property(a => a.FeedbackJson));
            UserForeignKey(entity, attempt => attempt.UserId);
            entity.Property(attempt => attempt.LessonId).HasMaxLength(160);
            entity.Property(attempt => attempt.ChallengeId).HasMaxLength(160);
            Json(entity.Property(attempt => attempt.AnswersJson));
            entity.HasOne<Lesson>().WithMany().HasForeignKey(attempt => attempt.LessonId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Challenge>().WithMany().HasForeignKey(attempt => attempt.ChallengeId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(attempt => new { attempt.UserId, attempt.CreatedAt });
            entity.ToTable(table =>
            {
                table.HasCheckConstraint("CK_QuizAttempts_Target", "(\"LessonId\" IS NOT NULL) <> (\"ChallengeId\" IS NOT NULL)");
                table.HasCheckConstraint("CK_QuizAttempts_Score", "\"TotalCount\" > 0 AND \"CorrectCount\" >= 0 AND \"CorrectCount\" <= \"TotalCount\"");
            });
        });

        ConfigureVersioned(builder.Entity<StoredFile>(), "StoredFiles");
        builder.Entity<StoredFile>(entity =>
        {
            entity.Property(file => file.OwnerId).HasMaxLength(160);
            entity.Property(file => file.UploadedByAdminId).HasMaxLength(450);
            entity.Property(file => file.ObjectKey).HasMaxLength(1024);
            entity.Property(file => file.Bucket).HasMaxLength(128);
            entity.Property(file => file.FileName).HasMaxLength(255);
            entity.Property(file => file.ContentType).HasMaxLength(150);
            entity.HasOne<AppUser>().WithMany().HasForeignKey(file => file.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<AdminUser>().WithMany().HasForeignKey(file => file.UploadedByAdminId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(file => new { file.Bucket, file.ObjectKey }).IsUnique();
            entity.ToTable(table => table.HasCheckConstraint("CK_StoredFiles_Size", "\"Size\" >= 0"));
        });
    }

    #endregion

    #region Save Methods

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        PrepareVersionedEntities();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        PrepareVersionedEntities();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    #endregion

    #region Private Configuration And Versioning

    private static void ConfigureCommerce(ModelBuilder builder)
    {
        ConfigureVersioned(builder.Entity<CourseEnrollment>(), "CourseEnrollments");
        ConfigureVersioned(builder.Entity<CoursePaidAccess>(), "CoursePaidAccess");
        ConfigureVersioned(builder.Entity<Invoice>(), "Invoices");
        ConfigureVersioned(builder.Entity<SpotPlayerLicense>(), "SpotPlayerLicenses");
        ConfigureVersioned(builder.Entity<VideoAsset>(), "VideoAssets");
        builder.Entity<CourseEnrollment>(e => { e.HasIndex(x => new { x.UserId, x.CourseId }).IsUnique(); e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId); e.HasOne<Course>().WithMany().HasForeignKey(x => x.CourseId); });
        builder.Entity<CoursePaidAccess>(e => { e.HasIndex(x => new { x.UserId, x.CourseId }).IsUnique(); e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId); e.HasOne<Course>().WithMany().HasForeignKey(x => x.CourseId); });
        builder.Entity<SpotPlayerLicense>(e => { e.HasIndex(x => new { x.UserId, x.CourseId }).IsUnique(); e.HasOne<CoursePaidAccess>().WithMany().HasForeignKey(x => new { x.UserId, x.CourseId }).HasPrincipalKey(x => new { x.UserId, x.CourseId }); });
        builder.Entity<Invoice>(e => { e.HasIndex(x => new { x.UserId, x.IdempotencyKey }).IsUnique(); e.HasIndex(x => x.TrackId).IsUnique(); e.HasIndex(x => new { x.UserId, x.CourseId }).IsUnique().HasFilter("\"PaymentStatus\" IN ('creating','pending','paid','requestUnknown')"); e.HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId); e.HasOne<Course>().WithMany().HasForeignKey(x => x.CourseId); });
        builder.Entity<ProviderAudit>(e => { e.HasKey(x => x.Id); e.HasIndex(x => new { x.CorrelationId, x.StartedAt }); });
        builder.Entity<Course>().Property(x => x.AnimationsJson).HasColumnType("jsonb");
        builder.Entity<Lesson>().Property(x => x.AnimationsJson).HasColumnType("jsonb");
        builder.Entity<Course>().ToTable(t => t.HasCheckConstraint("CK_Courses_Commerce", "(\"CommerceType\" = 'free' AND \"PriceRial\" = 0) OR (\"CommerceType\" IN ('mixed','paid') AND \"PriceRial\" >= 1000)"));
        builder.Entity<Lesson>().ToTable(t => t.HasCheckConstraint("CK_Lessons_Delivery", "\"Delivery\" IN ('onsite','spotplayer') AND (\"Delivery\" <> 'spotplayer' OR \"VideoId\" IS NULL)"));
    }

    private void PrepareVersionedEntities()
    {
        foreach (var entry in ChangeTracker.Entries<VersionedEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.Version = 1;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.Version = checked(entry.Property(entity => entity.Version).OriginalValue + 1);
                entry.Entity.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }
    }

    private static void ConfigureVersioned<TEntity>(EntityTypeBuilder<TEntity> entity, string tableName)
        where TEntity : VersionedEntity
    {
        // Shared CLR properties do not imply one TPH database table.
        entity.HasBaseType((Type?)null);
        entity.ToTable(tableName);
        entity.HasKey(value => value.Id);
        entity.Property(value => value.Id).HasMaxLength(160);
        entity.Property(value => value.Version).IsConcurrencyToken();
        entity.ToTable(table => table.HasCheckConstraint($"CK_{tableName}_Version", "\"Version\" >= 1"));
    }

    private static void ConfigureContent<TEntity>(EntityTypeBuilder<TEntity> entity, string tableName)
        where TEntity : ContentEntity
    {
        ConfigureVersioned(entity, tableName);
        entity.Property(value => value.Slug).HasMaxLength(160);
        entity.Property(value => value.Title).HasMaxLength(250);
        entity.Property(value => value.Status).HasMaxLength(20);
        entity.ToTable(table => table.HasCheckConstraint($"CK_{tableName}_Status", "\"Status\" IN ('draft', 'published', 'archived')"));
        entity.HasIndex(value => value.Status);
    }

    private static void Json(PropertyBuilder<string> property) => property.HasColumnType("jsonb");

    private static void UserForeignKey<TEntity>(EntityTypeBuilder<TEntity> entity,
        System.Linq.Expressions.Expression<Func<TEntity, object?>> property)
        where TEntity : VersionedEntity => entity.HasOne<AppUser>().WithMany()
            .HasForeignKey(property).OnDelete(DeleteBehavior.Restrict);

    #endregion
}
