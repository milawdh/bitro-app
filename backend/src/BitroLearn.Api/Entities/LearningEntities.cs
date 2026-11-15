namespace BitroLearn.Api.Entities;

public sealed class UserProgress : VersionedEntity
{
    #region Properties

    public string UserId { get; set; } = string.Empty;
    public string LessonId { get; set; } = string.Empty;
    public int Step { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    #endregion
}

public sealed class CodeDraft : VersionedEntity
{
    #region Properties

    public string UserId { get; set; } = string.Empty;
    public string LessonId { get; set; } = string.Empty;
    public string Mode { get; set; } = "guided";
    public string Code { get; set; } = string.Empty;

    #endregion
}

public sealed class UserProject : VersionedEntity
{
    #region Properties

    public string UserId { get; set; } = string.Empty;
    public string ProjectTemplateId { get; set; } = string.Empty;
    public string FilesJson { get; set; } = "[]";

    #endregion
}

public sealed class QuizAttempt : VersionedEntity
{
    #region Properties

    public string UserId { get; set; } = string.Empty;
    public string? LessonId { get; set; }
    public string? ChallengeId { get; set; }
    public string AnswersJson { get; set; } = "{}";
    public bool IsPassed { get; set; }
    public int CorrectCount { get; set; }
    public int TotalCount { get; set; } = 1;

    #endregion
}

public sealed class StoredFile : VersionedEntity
{
    #region Properties

    public string? OwnerId { get; set; }
    public string? UploadedByAdminId { get; set; }
    public string ObjectKey { get; set; } = string.Empty;
    public string Bucket { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public bool IsPublic { get; set; }

    #endregion
}
