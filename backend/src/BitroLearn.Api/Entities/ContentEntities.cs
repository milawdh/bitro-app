namespace BitroLearn.Api.Entities;

public abstract class VersionedEntity
{
    #region Properties

    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public int Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    #endregion
}

public abstract class ContentEntity : VersionedEntity
{
    #region Properties

    public string Slug { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "draft";

    #endregion
}

public sealed class Course : ContentEntity
{
    #region Properties

    public string Subtitle { get; set; } = string.Empty;
    public string Level { get; set; } = "beginner";
    public string Color { get; set; } = "purple";

    #endregion
}

public sealed class CourseModule : VersionedEntity
{
    #region Properties

    public string CourseId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int Order { get; set; }

    #endregion
}

public sealed class Lesson : ContentEntity
{
    #region Properties

    public string CourseId { get; set; } = string.Empty;
    public string ModuleId { get; set; } = string.Empty;
    public int Order { get; set; }
    public int Duration { get; set; }
    public string Concept { get; set; } = string.Empty;
    public string Intro { get; set; } = string.Empty;
    public string Analogy { get; set; } = string.Empty;
    public string ObjectivesJson { get; set; } = "[]";
    public string Experiment { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string OutputJson { get; set; } = "[]";
    public string Question { get; set; } = string.Empty;
    public string ChoicesJson { get; set; } = "[]";
    public int Answer { get; set; }
    public string Hint { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;

    #endregion
}

public sealed class Lab : ContentEntity
{
    #region Properties

    public string Concept { get; set; } = string.Empty;
    public string Category { get; set; } = "fundamentals";
    public int Duration { get; set; }
    public string ConfigJson { get; set; } = "{}";

    #endregion
}

public sealed class Challenge : ContentEntity
{
    #region Properties

    public string CourseId { get; set; } = string.Empty;
    public string Concept { get; set; } = string.Empty;
    public string Difficulty { get; set; } = "beginner";
    public int Duration { get; set; }
    public string Hint { get; set; } = string.Empty;
    public string QuestionsJson { get; set; } = "[]";

    #endregion
}

public sealed class ProjectTemplate : ContentEntity
{
    #region Properties

    public string CourseId { get; set; } = string.Empty;
    public string Difficulty { get; set; } = "beginner";
    public int Duration { get; set; }
    public string ObjectivesJson { get; set; } = "[]";
    public string FilesJson { get; set; } = "[]";

    #endregion
}
