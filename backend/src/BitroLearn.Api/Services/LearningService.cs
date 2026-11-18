using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using BitroLearn.Api.Data;
using BitroLearn.Api.Entities;
using BitroLearn.Api.Infrastructure.Authentication;
using BitroLearn.Api.Infrastructure.Configuration;
using Microsoft.EntityFrameworkCore;
using static BitroLearn.Api.Services.CourseContracts;

namespace BitroLearn.Api.Services;

public sealed class LearningService(AppDbContext db)
{
    #region Access and progress
    public async Task<Lesson> Lesson(string user,string id,CancellationToken ct)
    {
        var lesson=await db.Lessons.AsNoTracking().SingleOrDefaultAsync(l=>l.Id==id && l.Status=="published" && l.Delivery=="onsite" && db.Courses.Any(c=>c.Id==l.CourseId && c.Status=="published"),ct);
        Require(lesson is not null,"Lesson unavailable.",404);
        await Enrollment(user,lesson!.CourseId,ct); return lesson;
    }
    public async Task Enrollment(string user,string course,CancellationToken ct)
    {
        Require(await db.Courses.AnyAsync(c=>c.Id==course && c.Status=="published",ct),"Course unavailable.",404);
        Require(await db.CourseEnrollments.AnyAsync(e=>e.UserId==user && e.CourseId==course,ct),"Enrollment required.",403);
    }
    private static ProgressDto Dto(UserProgress p)=>new(p.LessonId,p.Version,p.Step,p.VideoPositionSeconds,p.CompletedAt);
    private Task<UserProgress?> Row(string user,string id,CancellationToken ct)=>db.UserProgress.AsNoTracking().SingleOrDefaultAsync(p=>p.UserId==user && p.LessonId==id,ct);
    public async Task<ProgressDto> Progress(string user,string id,CancellationToken ct)
    { await Lesson(user,id,ct); return await Row(user,id,ct) is { } p?Dto(p):new(id,0,0,null,null); }
    public async Task<CourseProgressDto> CourseProgress(string user,string id,CancellationToken ct)
    {
        await Enrollment(user,id,ct);
        var lessons=await db.Lessons.AsNoTracking().Where(l=>l.CourseId==id && l.Status=="published" && l.Delivery=="onsite").OrderBy(l=>l.Order).Select(l=>l.Id).ToArrayAsync(ct);
        var progress=await db.UserProgress.AsNoTracking().Where(p=>p.UserId==user && lessons.Contains(p.LessonId)).ToDictionaryAsync(p=>p.LessonId,ct);
        var challenges=await db.QuizAttempts.AsNoTracking().Where(a=>a.UserId==user && a.IsPassed && a.ChallengeId!=null && db.Challenges.Any(c=>c.Id==a.ChallengeId && c.CourseId==id && c.Status=="published")).Select(a=>a.ChallengeId!).Distinct().ToArrayAsync(ct);
        return new(id,lessons.Select(l=>progress.TryGetValue(l,out var p)?Dto(p):new(l,0,0,null,null)).ToArray(),challenges);
    }
    public async Task<ProgressDto> SaveProgress(string user,string id,ProgressRequest request,CancellationToken ct)
    {
        var lesson=await Lesson(user,id,ct);
        Require(request.Version>=0 && request.Step is >=0 and <=4 && (request.VideoPositionSeconds is null || double.IsFinite(request.VideoPositionSeconds.Value) && request.VideoPositionSeconds>=0 && lesson.VideoId!=null),"Invalid checkpoint.");
        var previous=await Row(user,id,ct);
        if(previous is not null && previous.Step==request.Step && previous.VideoPositionSeconds==request.VideoPositionSeconds) return Dto(previous);
        var changed=await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "UserProgress" ("Id","Version","CreatedAt","UpdatedAt","UserId","LessonId","Step","VideoPositionSeconds")
            SELECT {Guid.NewGuid().ToString("N")},1,now(),now(),{user},{id},{request.Step},{request.VideoPositionSeconds} WHERE {request.Version}=0
            ON CONFLICT ("UserId","LessonId") DO NOTHING
            """,ct);
        if(changed==0) changed=await db.UserProgress.Where(p=>p.UserId==user && p.LessonId==id && p.Version==request.Version).ExecuteUpdateAsync(s=>s.SetProperty(p=>p.Step,request.Step).SetProperty(p=>p.VideoPositionSeconds,request.VideoPositionSeconds).SetProperty(p=>p.Version,p=>p.Version+1).SetProperty(p=>p.UpdatedAt,DateTimeOffset.UtcNow),ct);
        Require(changed==1,"Progress version conflict.",409);return Dto((await Row(user,id,ct))!);
    }
    public async Task<ProgressDto> Complete(string user,string id,CompleteLessonRequest request,CancellationToken ct)
    {
        var lesson=await Lesson(user,id,ct);
        Require(!lesson.HasQuiz,"Pass the server assessment to complete this lesson.",409);
        Require(lesson.Version==request.ContentVersion,"Content changed; reload the lesson.",409);
        var changed=await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "UserProgress" ("Id","Version","CreatedAt","UpdatedAt","UserId","LessonId","Step","CompletedAt")
            SELECT {Guid.NewGuid().ToString("N")},1,now(),now(),{user},{id},4,now()
            FROM "Lessons" l WHERE l."Id"={id} AND l."Version"={request.ContentVersion} AND NOT l."HasQuiz" AND l."Status"='published' AND l."Delivery"='onsite'
            ON CONFLICT ("UserId","LessonId") DO UPDATE SET "CompletedAt"=COALESCE("UserProgress"."CompletedAt",now()),"Step"=4,"Version"="UserProgress"."Version"+1,"UpdatedAt"=now()
            """,ct);
        Require(changed==1,"Content changed; reload the lesson.",409); return Dto((await Row(user,id,ct))!);
    }
    #endregion

    #region Independent code drafts
    public async Task<DraftDto> Draft(string user,string id,string mode,CancellationToken ct)
    {
        Require(mode is "guided" or "explore","Unknown code mode.");var lesson=await Lesson(user,id,ct);
        var row=await db.CodeDrafts.AsNoTracking().SingleOrDefaultAsync(d=>d.UserId==user && d.LessonId==id && d.Mode==mode,ct);
        return new(id,mode,row?.Version??0,row?.Code??lesson.Code);
    }
    public async Task<DraftDto> SaveDraft(string user,string id,string mode,DraftRequest request,CancellationToken ct)
    {
        var current=await Draft(user,id,mode,ct);
        Require(request.Version>=0 && request.Code is not null && Encoding.UTF8.GetByteCount(request.Code)<=AppConfigurationStatic.GetLearningCodeMaxBytes(),"Code exceeds the configured text limit.");
        if(current.Version>0 && current.Code==request.Code)return current;
        var changed=await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "CodeDrafts" ("Id","Version","CreatedAt","UpdatedAt","UserId","LessonId","Mode","Code")
            SELECT {Guid.NewGuid().ToString("N")},1,now(),now(),{user},{id},{mode},{request.Code} WHERE {request.Version}=0
            ON CONFLICT ("UserId","LessonId","Mode") DO NOTHING
            """,ct);
        if(changed==0)changed=await db.CodeDrafts.Where(d=>d.UserId==user && d.LessonId==id && d.Mode==mode && d.Version==request.Version).ExecuteUpdateAsync(s=>s.SetProperty(d=>d.Code,request.Code!).SetProperty(d=>d.Version,d=>d.Version+1).SetProperty(d=>d.UpdatedAt,DateTimeOffset.UtcNow),ct);
        Require(changed==1,"Draft version conflict; keep your local code.",409);return await Draft(user,id,mode,ct);
    }
    #endregion

    #region Small personal workspaces
    private async Task<ProjectTemplate> Template(string user,string id,CancellationToken ct)
    {
        var template=await db.ProjectTemplates.AsNoTracking().SingleOrDefaultAsync(p=>p.Id==id && p.Status=="published",ct);
        Require(template is not null,"Template unavailable.",404);await Enrollment(user,template!.CourseId,ct);return template;
    }
    public async Task<WorkspaceDto> Workspace(string user,string id,CancellationToken ct)
    {
        var template=await Template(user,id,ct);
        var row=await db.UserProjects.AsNoTracking().SingleOrDefaultAsync(p=>p.UserId==user && p.ProjectTemplateId==id,ct);
        var files=JsonSerializer.Deserialize<ProjectFileDto[]>(row?.FilesJson??template.FilesJson,new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        return new(id,row?.Version??0,row?.TemplateVersion??template.Version,template.Version,files,row is null?files.FirstOrDefault()?.Path:row.ActiveFile,row?.Checkpoint??0);
    }
    public static void ValidateFiles(ProjectFileDto[] files,string? active,int checkpoint)
    {
        Require(files is not null && files.Length<=AppConfigurationStatic.GetLearningProjectMaxFiles() && checkpoint>=0,"Invalid workspace.");
        var paths=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach(var file in files!) Require(file is not null && file.Path is not null && file.Path.Length<=256 && Regex.IsMatch(file.Path,@"^[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$") && paths.Add(file.Path) && file.Content is not null,"Invalid or duplicate project path.");
        Require(active is null || files.Any(f=>f.Path==active),"Active file is missing.");
        Require(Encoding.UTF8.GetByteCount(JsonSerializer.Serialize(files))<=AppConfigurationStatic.GetLearningProjectMaxBytes(),"Workspace exceeds the configured text limit.");
    }
    public async Task<WorkspaceDto> SaveWorkspace(string user,string id,WorkspaceRequest request,CancellationToken ct)
    {
        var current=await Workspace(user,id,ct);ValidateFiles(request.Files,request.ActiveFile,request.Checkpoint);Require(request.Version>=0,"Invalid version.");
        var json=JsonSerializer.Serialize(request.Files,new JsonSerializerOptions(JsonSerializerDefaults.Web));
        if(current.Version>0 && JsonSerializer.Serialize(current.Files,new JsonSerializerOptions(JsonSerializerDefaults.Web))==json && current.ActiveFile==request.ActiveFile && current.Checkpoint==request.Checkpoint)return current;
        var changed=await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "UserProjects" ("Id","Version","CreatedAt","UpdatedAt","UserId","ProjectTemplateId","FilesJson","ActiveFile","Checkpoint","TemplateVersion")
            SELECT {Guid.NewGuid().ToString("N")},1,now(),now(),{user},{id},{json}::jsonb,{request.ActiveFile},{request.Checkpoint},{current.TemplateVersion} WHERE {request.Version}=0
            ON CONFLICT ("UserId","ProjectTemplateId") DO NOTHING
            """,ct);
        if(changed==0)changed=await db.UserProjects.Where(p=>p.UserId==user && p.ProjectTemplateId==id && p.Version==request.Version).ExecuteUpdateAsync(s=>s.SetProperty(p=>p.FilesJson,json).SetProperty(p=>p.ActiveFile,request.ActiveFile).SetProperty(p=>p.Checkpoint,request.Checkpoint).SetProperty(p=>p.Version,p=>p.Version+1).SetProperty(p=>p.UpdatedAt,DateTimeOffset.UtcNow),ct);
        Require(changed==1,"Workspace version conflict; keep your local files.",409);return await Workspace(user,id,ct);
    }
    #endregion
}
