using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace BitroLearn.Api.Services;

public static class ContractExporter
{
    #region TypeScript DTO export
    public static string Export()
    {
        Type[] types = [typeof(CoverDto),typeof(CourseDto),typeof(ModuleDto),typeof(LessonDto),typeof(EnrollmentDto),typeof(MyCourseDto),typeof(InvoiceVerificationDto),typeof(InvoiceDto),typeof(LicenseDto),typeof(ActivateRequest),typeof(InvoiceRequest),typeof(CurriculumOrderRequest),typeof(VideoUploadRequest),typeof(PlaybackDto),typeof(AnimationBinding)];
        types = [..types,typeof(ProgressDto),typeof(ProgressRequest),typeof(CourseProgressDto),typeof(DraftDto),typeof(DraftRequest),typeof(ProjectFileDto),typeof(WorkspaceDto),typeof(WorkspaceRequest),typeof(CompleteLessonRequest),typeof(AttemptRequest),typeof(SubmittedAnswer),typeof(QuestionFeedback),typeof(AttemptDto)];
        var nullable = new NullabilityInfoContext();
        types = [..types,typeof(SyllabusItemDto),typeof(PublicCourseDetailDto),typeof(ChallengeOptionDto),typeof(ChallengeQuestionDto),typeof(ChallengeDto),typeof(LabDto),typeof(ProjectTemplateDto)];
        return "// Generated from backend DTOs by --export-contracts. Do not edit.\n" + string.Join("\n",types.Select(type => "export interface " + type.Name + " {\n" + string.Join("\n",type.GetProperties().Select(p => "  " + JsonNamingPolicy.CamelCase.ConvertName(p.Name) + ": " + Map(p.PropertyType) + (nullable.Create(p).ReadState == NullabilityState.Nullable && !p.PropertyType.IsValueType ? " | null" : "") + ";")) + "\n}")) + "\n";
    }
    private static string Map(Type type)
    {
        if (type.IsArray) return Map(type.GetElementType()!) + "[]";
        if (Nullable.GetUnderlyingType(type) is { } inner) return Map(inner) + " | null";
        if (type == typeof(string) || type == typeof(DateTimeOffset)) return "string";
        if (type == typeof(bool)) return "boolean";
        if (type == typeof(int) || type == typeof(long) || type == typeof(double) || type == typeof(float) || type == typeof(decimal)) return "number";
        if (type == typeof(JsonElement)) return "unknown";
        if (type == typeof(JsonObject)) return "Record<string, string | number | boolean>";
        return type.Name;
    }
    #endregion
}
