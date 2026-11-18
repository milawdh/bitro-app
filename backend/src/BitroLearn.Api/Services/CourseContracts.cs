using System.Text.Json;
using System.Text.Json.Nodes;
using BitroLearn.Api.Entities;
using BitroLearn.Api.Infrastructure.Authentication;

namespace BitroLearn.Api.Services;

public record CoverDto(string Kind, string PresetKey, string? FileId);
public record CourseDto(string Id, int Version, string Slug, string Title, string Description, string Subtitle, string Status, string Level, string Color, string CommerceType, long PriceRial, string? SpotPlayerCourseId, CoverDto Cover, string? IntroVideoId, JsonElement Animations);
public record ModuleDto(string Id, int Version, string CourseId, string Title, int Order);
public record LessonDto(string Id, int Version, string CourseId, string ModuleId, string Slug, string Title, string Description, string Status, int Order, int Duration, string Delivery, string? VideoId, string Concept, string Intro, string Analogy, JsonElement Objectives, string Experiment, string Code, JsonElement Output, bool HasQuiz, string Question, JsonElement Choices, int? Answer, string Hint, string Explanation, JsonElement Animations);
public record EnrollmentDto(string CourseId, string Status);
public record MyCourseDto(CourseDto Course, string EnrollmentStatus, bool PaidAccess, string LicenseStatus);
public record InvoiceVerificationDto(string InvoiceId, string ObservedPaymentStatus, string PaymentStatus, string FulfillmentStatus, bool PaidAccess, string LicenseStatus);
public record InvoiceDto(string Id, string CourseId, long AmountRial, string PaymentStatus, string FulfillmentStatus, string? PaymentUrl);
public record LicenseDto(string Status, string Source, string? Key, string? Error);
public record ActivateRequest(string LicenseMode, string? LicenseKey);
public record InvoiceRequest(string CourseId, string IdempotencyKey);
public record VideoUploadRequest(string FileName, long TotalBytes);
public record CurriculumOrderRequest(int Version, string[] ModuleIds, string[] LessonIds);
public record PlaybackDto(string Url, DateTimeOffset ExpiresAt);
public record AnimationBinding(string Key, bool Enabled, JsonObject Settings);
public record SyllabusItemDto(string Id,string ModuleId,string Title,string Slug,int Duration,string Delivery);
public record PublicCourseDetailDto(CourseDto Course,ModuleDto[] Modules,SyllabusItemDto[] Syllabus);

public static class CourseContracts
{
    #region Projection
    public static JsonElement Json(string value) => JsonSerializer.Deserialize<JsonElement>(value);
    public static CourseDto Dto(Course c) => new(c.Id,c.Version,c.Slug,c.Title,c.Description,c.Subtitle,c.Status,c.Level,c.Color,c.CommerceType,c.PriceRial,c.SpotPlayerCourseId,new(c.CoverKind,c.CoverPresetKey,c.CoverFileId),c.IntroVideoId,Json(c.AnimationsJson));
    public static LessonDto Dto(Lesson l, bool admin) => new(l.Id,l.Version,l.CourseId,l.ModuleId,l.Slug,l.Title,l.Description,l.Status,l.Order,l.Duration,l.Delivery,l.VideoId,l.Concept,l.Intro,l.Analogy,Json(l.ObjectivesJson),l.Experiment,l.Code,Json(l.OutputJson),l.HasQuiz,l.Question,Json(l.ChoicesJson),admin ? l.Answer : null,l.Hint,admin ? l.Explanation : "",Json(l.AnimationsJson));
    public static InvoiceDto Dto(Invoice i) => new(i.Id,i.CourseId,i.AmountRial,i.PaymentStatus,i.FulfillmentStatus,i.TrackId is not null && i.PaymentStatus == "pending" ? $"https://gateway.zibal.ir/start/{i.TrackId}" : null);
    public static void Require([System.Diagnostics.CodeAnalysis.DoesNotReturnIf(false)] bool condition, string message, int status = 400) { if (!condition) throw new ApiException(status,message); }
    #endregion
}

public static class AnimationRegistry
{
    #region Registry and resolution
    private static readonly JsonObject Definitions = Load();
    public static readonly string[] Keys = Definitions.Select(p => p.Key).ToArray();
    private static JsonObject Load()
    {
        using var stream = typeof(AnimationRegistry).Assembly.GetManifestResourceStream("BitroLearn.Api.Data.animation-registry.json")!;
        return JsonNode.Parse(stream)!.AsObject();
    }
    public static JsonObject Defaults(string key) => Definitions[key]?.DeepClone().AsObject() ?? new();
    public static void Validate(IEnumerable<AnimationBinding> bindings)
    {
        var seen = new HashSet<string>();
        foreach (var b in bindings)
        {
            if (b is null || b.Settings is null) throw new ApiException(400,"Animation settings required.");
            CourseContracts.Require(Keys.Contains(b.Key) && seen.Add(b.Key), "Unknown or duplicate animation key.");
            var defaults = Defaults(b.Key);
            foreach (var setting in b.Settings)
            {
                CourseContracts.Require(defaults.ContainsKey(setting.Key) && setting.Value is JsonValue, "Unknown animation setting.");
                var expected = defaults[setting.Key]!.GetValueKind();
                var actual = setting.Value!.GetValueKind();
                CourseContracts.Require(actual == expected || expected is JsonValueKind.True or JsonValueKind.False && actual is JsonValueKind.True or JsonValueKind.False, "Invalid animation setting type.");
                if (expected == JsonValueKind.Number) CourseContracts.Require(setting.Value.GetValue<double>() is >= -999 and <= 999, "Animation number out of range.");
                if (setting.Key == "iterations") { var number = setting.Value.GetValue<double>(); CourseContracts.Require(number is >= 1 and <= 100 && Math.Floor(number) == number, "Invalid iteration count."); }
                if (setting.Key == "playbackSpeed") CourseContracts.Require(new[] { 0.5,1.0,2.0 }.Contains(setting.Value.GetValue<double>()),"Invalid playback speed.");
                if (setting.Key == "variableName") CourseContracts.Require(System.Text.RegularExpressions.Regex.IsMatch(setting.Value.GetValue<string>(),"^[a-zA-Z_][a-zA-Z0-9_]{0,49}$"),"Invalid variable name.");
                if (setting.Key == "schedule") CourseContracts.Require(new[] { "concurrent", "parallel", "sequential" }.Contains(setting.Value.GetValue<string>()), "Invalid schedule.");
                if (setting.Key == "lifetime") CourseContracts.Require(new[] { "scoped", "singleton", "transient" }.Contains(setting.Value.GetValue<string>()), "Invalid lifetime.");
            }
        }
    }
    public static AnimationBinding[] Parse(string json) => JsonSerializer.Deserialize<AnimationBinding[]>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? [];
    public static AnimationBinding[] Resolve(string courseJson, string lessonJson)
    {
        var courses = Parse(courseJson); var lessons = Parse(lessonJson);
        Validate(courses); Validate(lessons);
        return lessons.Where(l => l.Enabled && courses.Any(c => c.Key == l.Key && c.Enabled)).Select(l =>
        {
            var settings = Defaults(l.Key);
            foreach (var p in courses.Single(c => c.Key == l.Key).Settings) settings[p.Key] = p.Value?.DeepClone();
            foreach (var p in l.Settings) settings[p.Key] = p.Value?.DeepClone();
            return new AnimationBinding(l.Key,true,settings);
        }).ToArray();
    }
    #endregion
}
