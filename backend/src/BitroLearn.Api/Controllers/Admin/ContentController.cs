using System.Text.Json;
using BitroLearn.Api.Data;
using BitroLearn.Api.Entities;
using BitroLearn.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static BitroLearn.Api.Services.CourseContracts;

namespace BitroLearn.Api.Controllers.Admin;

[Route("admin/{kind}")]
public sealed class ContentController(AppDbContext db,MediaService? media = null,ContentCache? cache = null) : AdminAreaController
{
    #region Content management
    private static readonly Dictionary<string,Type> Kinds = new() { ["courses"] = typeof(Course),["lessons"] = typeof(Lesson),["labs"] = typeof(Lab),["challenges"] = typeof(Challenge),["projects"] = typeof(ProjectTemplate) };
    [HttpGet]
    public Task<IActionResult> List(string kind,CancellationToken ct,string? q = null,string? status = null,int page = 1) => Dispatch(kind,t => ListCore(t,q,status,page,ct));
    [HttpGet("{id}")]
    public Task<IActionResult> Get(string kind,string id,CancellationToken ct) => Dispatch(kind,t => GetCore(t,id,ct));
    [HttpPost]
    public Task<IActionResult> Create(string kind,JsonElement request,CancellationToken ct) => Dispatch(kind,t => Save(t,null,request,ct));
    [HttpPut("{id}")]
    public Task<IActionResult> Update(string kind,string id,JsonElement request,CancellationToken ct) => Dispatch(kind,t => Save(t,id,request,ct));
    private async Task<IActionResult> Dispatch(string kind,Func<Type,Task<IActionResult>> operation) { Require(Kinds.ContainsKey(kind),"Content kind not found.",404); return await operation(Kinds[kind]); }
    private IQueryable<ContentEntity> Query(Type type) => type == typeof(Course) ? db.Courses : type == typeof(Lesson) ? db.Lessons : type == typeof(Lab) ? db.Labs : type == typeof(Challenge) ? db.Challenges : db.ProjectTemplates;
    private async Task<IActionResult> ListCore(Type type,string? q,string? status,int page,CancellationToken ct)
    {
        var query = Query(type).AsNoTracking().Where(x => (q == null || x.Title.Contains(q)) && (status == null || x.Status == status));
        return Ok(new { total = await query.CountAsync(ct),items = (await query.OrderBy(x => x.Title).Skip((Math.Max(page,1)-1)*20).Take(20).ToArrayAsync(ct)).Select(Project) });
    }
    private async Task<IActionResult> GetCore(Type type,string id,CancellationToken ct) { var entity = await Query(type).AsNoTracking().SingleOrDefaultAsync(x => x.Id == id,ct); Require(entity is not null,"Content not found.",404); return Ok(Project(entity!)); }
    private static object Project(ContentEntity e) => e switch
    {
        Course c => Dto(c),Lesson l => Dto(l,true),
        Lab l => new { l.Id,l.Version,l.Slug,l.Title,l.Description,l.Status,l.Concept,l.Category,l.Duration,config = Json(l.ConfigJson) },
        Challenge c => new { c.Id,c.Version,c.Slug,c.Title,c.Description,c.Status,c.CourseId,c.Concept,c.Difficulty,c.Duration,c.Hint,questions = Json(c.QuestionsJson) },
        ProjectTemplate p => new { p.Id,p.Version,p.Slug,p.Title,p.Description,p.Status,p.CourseId,p.Difficulty,p.Duration,objectives = Json(p.ObjectivesJson),files = Json(p.FilesJson) },
        _ => throw new InvalidOperationException()
    };
    private async Task<IActionResult> Save(Type type,string? id,JsonElement r,CancellationToken ct)
    {
        string S(string name,string fallback = "") => r.TryGetProperty(name,out var value) ? value.GetString() ?? fallback : fallback;
        int N(string name,int fallback = 0) => r.TryGetProperty(name,out var value) ? value.GetInt32() : fallback;
        string J(string name,string fallback = "[]") => r.TryGetProperty(name,out var value) ? value.GetRawText() : fallback;
        var e = id is null ? (ContentEntity)Activator.CreateInstance(type)! : await Query(type).SingleOrDefaultAsync(x => x.Id == id,ct);
        Require(e is not null,"Content not found.",404);
        if (id is not null) Require(N("version") == e!.Version,"Content version conflict.",409);
        e!.Slug = S("slug"); e.Title = S("title"); e.Description = S("description"); e.Status = S("status","draft");
        Require(!string.IsNullOrWhiteSpace(e.Title) && System.Text.RegularExpressions.Regex.IsMatch(e.Slug,"^[a-z0-9]+(?:-[a-z0-9]+)*$") && new[] { "draft","published","archived" }.Contains(e.Status),"Invalid content metadata.");
        if (e is Course c)
        {
            c.Subtitle = S("subtitle"); c.Level = S("level","beginner"); c.Color = S("color","purple"); c.CommerceType = S("commerceType","free");
            c.PriceRial = r.TryGetProperty("priceRial",out var price) ? price.GetInt64() : 0;
            var provider = S("spotPlayerCourseId");
            Require(c.SpotPlayerCourseId == provider || !await db.SpotPlayerLicenses.AnyAsync(l => l.CourseId == c.Id,ct),"Existing licenses prevent changing the provider course.",409);
            c.SpotPlayerCourseId = provider; c.IntroVideoId = S("introVideoId") is { Length: > 0 } intro ? intro : null;
            c.AnimationsJson = J("animations"); AnimationRegistry.Validate(AnimationRegistry.Parse(c.AnimationsJson));
            if (r.TryGetProperty("cover",out var cover)) { c.CoverKind = cover.GetProperty("kind").GetString()!; c.CoverPresetKey = cover.TryGetProperty("presetKey",out var preset) ? preset.GetString() ?? "code" : "code"; c.CoverFileId = cover.TryGetProperty("fileId",out var file) ? file.GetString() : null; }
            Require(c.CoverKind is "preset" or "image" && new[] { "code","server","layers" }.Contains(c.CoverPresetKey),"Invalid cover.");
            Require(c.CommerceType == "free" && c.PriceRial == 0 || c.CommerceType is "mixed" or "paid" && c.PriceRial >= 1000 && !string.IsNullOrWhiteSpace(provider),"Invalid course pricing or SpotPlayer mapping.");
            if (c.Status == "published")
            {
                if (c.CoverKind == "image") Require(await db.StoredFiles.AnyAsync(f => f.Id == c.CoverFileId && f.ContentType.StartsWith("image/") && f.UploadedByAdminId != null,ct),"Valid uploaded cover required.");
                if (c.IntroVideoId is not null) Require(await db.VideoAssets.AnyAsync(v => v.Id == c.IntroVideoId && v.Status == "ready",ct),"Introduction video not ready.");
                if (c.IntroVideoId is not null) await media!.ValidateReference(c.IntroVideoId,ct);
                if (c.CoverKind == "image") await media!.Cover(c.CoverFileId!,ct);
                var delivery = await db.Lessons.Where(l => l.CourseId == c.Id && l.Status == "published").Select(l => l.Delivery).Distinct().ToArrayAsync(ct);
                Require(c.CommerceType == "free" ? !delivery.Contains("spotplayer") : c.CommerceType == "paid" ? !delivery.Contains("onsite") : delivery.Contains("onsite") && delivery.Contains("spotplayer"),"Course type differs from published syllabus.");
            }
        }
        else if (e is Lesson l)
        {
            l.CourseId = S("courseId"); l.ModuleId = S("moduleId"); l.Order = N("order"); l.Duration = N("duration",1); l.Delivery = S("delivery","onsite"); l.VideoId = S("videoId") is { Length: > 0 } video ? video : null;
            l.Concept = S("concept"); l.Intro = S("intro"); l.Analogy = S("analogy"); l.Experiment = S("experiment"); l.Code = S("code"); l.ObjectivesJson = J("objectives"); l.OutputJson = J("output"); l.ChoicesJson = J("choices"); l.Question = S("question"); l.Answer = N("answer"); l.Hint = S("hint"); l.Explanation = S("explanation"); l.HasQuiz = r.TryGetProperty("hasQuiz",out var hasQuiz) && hasQuiz.GetBoolean();
            l.AnimationsJson = J("animations"); AnimationRegistry.Validate(AnimationRegistry.Parse(l.AnimationsJson));
            Require(await db.CourseModules.AnyAsync(m => m.Id == l.ModuleId && m.CourseId == l.CourseId,ct),"Module does not belong to course.");
            var course = await db.Courses.SingleAsync(c => c.Id == l.CourseId,ct);
            Require(l.Duration > 0 && l.Order >= 0 && l.Delivery is "onsite" or "spotplayer","Invalid lesson.");
            Require(l.Delivery != "spotplayer" || l.VideoId is null && course.CommerceType != "free","Paid media belongs in SpotPlayer.");
            Require(l.Delivery != "onsite" || course.CommerceType != "paid","Onsite lessons require free or mixed course.");
            if (l.VideoId is not null) Require(await db.VideoAssets.AnyAsync(v => v.Id == l.VideoId && v.Status == "ready",ct),"Video not ready.");
            if (l.Status == "published" && l.VideoId is not null) await media!.ValidateReference(l.VideoId,ct);
            Require(!l.HasQuiz || Json(l.ChoicesJson).GetArrayLength() > l.Answer && l.Answer >= 0,"Invalid quiz answer.");
            if(l.Status=="published") AssessmentService.ValidateLesson(l);
        }
        else if (e is Lab lab) { lab.Concept = S("concept"); Require(AnimationRegistry.Keys.Contains(lab.Concept),"Unknown lab component."); lab.Category = S("category","fundamentals"); lab.Duration = N("duration",1); lab.ConfigJson = J("config","{}"); Require(Json(lab.ConfigJson).ValueKind == JsonValueKind.Object,"Lab settings must be an object."); }
        else if (e is Challenge challenge) { challenge.CourseId = S("courseId"); challenge.Concept = S("concept"); challenge.Duration = N("duration",1); challenge.Difficulty = S("difficulty","beginner"); challenge.Hint = S("hint"); challenge.QuestionsJson = J("questions"); if(challenge.Status=="published") AssessmentService.ValidateChallenge(challenge.QuestionsJson); }
        else if (e is ProjectTemplate project) { project.CourseId = S("courseId"); project.Duration = N("duration",1); project.Difficulty = S("difficulty","beginner"); project.FilesJson = J("files"); project.ObjectivesJson = J("objectives"); }
        if (id is null) db.Add(e);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new Infrastructure.Authentication.ApiException(409,"Content version conflict."); }
        catch (DbUpdateException) { throw new Infrastructure.Authentication.ApiException(400,"Content violates a database constraint."); }
        if(cache is not null)await cache.Invalidate(CancellationToken.None);
        return Ok(Project(e));
    }
    #endregion
    #region Modules
    [HttpDelete("{id}/modules/{moduleId}")]
    public async Task<IActionResult> DeleteModule(string kind,string id,string moduleId,int version,CancellationToken ct)
    {
        Require(kind == "courses","Not found.",404);
        Require(!await db.Lessons.AnyAsync(l => l.ModuleId == moduleId,ct),"Move lessons before removing their module.",409);
        Require(await db.CourseModules.Where(m => m.Id == moduleId && m.CourseId == id && m.Version == version).ExecuteDeleteAsync(ct) == 1,"Module missing or version conflict.",409);
        if(cache is not null)await cache.Invalidate(CancellationToken.None);
        return NoContent();
    }
    [HttpPut("{id}/order")]
    public async Task<IActionResult> Reorder(string kind,string id,CurriculumOrderRequest request,CancellationToken ct)
    {
        Require(kind == "courses","Not found.",404);
        var moduleIds = await db.CourseModules.Where(m => m.CourseId == id).Select(m => m.Id).ToArrayAsync(ct);
        var lessonIds = await db.Lessons.Where(l => l.CourseId == id).Select(l => l.Id).ToArrayAsync(ct);
        Require(request.ModuleIds.Length == moduleIds.Length && request.LessonIds.Length == lessonIds.Length && request.ModuleIds.Distinct().Count() == moduleIds.Length && request.LessonIds.Distinct().Count() == lessonIds.Length && request.ModuleIds.All(moduleIds.Contains) && request.LessonIds.All(lessonIds.Contains),"Ordering must include each course module and lesson exactly once.");
        var modules = JsonSerializer.Serialize(request.ModuleIds); var lessons = JsonSerializer.Serialize(request.LessonIds);
        var changed = await db.Database.ExecuteSqlInterpolatedAsync($"""
            WITH claimed AS (
                UPDATE "Courses" SET "Version"="Version"+1,"UpdatedAt"=now() WHERE "Id"={id} AND "Version"={request.Version} RETURNING "Id"
            ), modules AS (
                UPDATE "CourseModules" m SET "Order"=p.position::int-1,"Version"=m."Version"+1,"UpdatedAt"=now()
                FROM jsonb_array_elements_text({modules}::jsonb) WITH ORDINALITY AS p(id,position),claimed c
                WHERE m."Id"=p.id AND m."CourseId"=c."Id" RETURNING m."Id"
            ), lessons AS (
                UPDATE "Lessons" l SET "Order"=p.position::int-1,"Version"=l."Version"+1,"UpdatedAt"=now()
                FROM jsonb_array_elements_text({lessons}::jsonb) WITH ORDINALITY AS p(id,position),claimed c
                WHERE l."Id"=p.id AND l."CourseId"=c."Id" RETURNING l."Id"
            ) INSERT INTO "ProviderAudits" ("Id","CorrelationId","Operation","RequestJson","Status","StartedAt","FinishedAt")
                SELECT {Guid.NewGuid().ToString("N")},"Id",'curriculum:reorder',{modules},'completed',now(),now() FROM claimed
            """,ct);
        Require(changed == 1,"Course version conflict.",409); if(cache is not null)await cache.Invalidate(CancellationToken.None); return NoContent();
    }
    [HttpGet("{id}/modules")]
    public async Task<IActionResult> Modules(string kind,string id,CancellationToken ct) { Require(kind == "courses","Not found.",404); return Ok(await db.CourseModules.Where(m => m.CourseId == id).OrderBy(m => m.Order).Select(m => new ModuleDto(m.Id,m.Version,m.CourseId,m.Title,m.Order)).ToArrayAsync(ct)); }
    [HttpPost("{id}/modules")]
    public async Task<ActionResult<ModuleDto>> AddModule(string kind,string id,ModuleDto request,CancellationToken ct)
    { Require(kind == "courses" && !string.IsNullOrWhiteSpace(request.Title) && request.Order >= 0,"Invalid module."); var m = new CourseModule { CourseId = id,Title = request.Title,Order = request.Order }; db.CourseModules.Add(m); await db.SaveChangesAsync(ct); if(cache is not null)await cache.Invalidate(CancellationToken.None); return new ModuleDto(m.Id,m.Version,m.CourseId,m.Title,m.Order); }
    [HttpPut("{id}/modules/{moduleId}")]
    public async Task<ActionResult<ModuleDto>> UpdateModule(string kind,string id,string moduleId,ModuleDto request,CancellationToken ct)
    { Require(kind == "courses","Not found.",404); var m = await db.CourseModules.SingleOrDefaultAsync(m => m.Id == moduleId && m.CourseId == id,ct); Require(m is not null,"Module not found.",404); Require(m!.Version == request.Version,"Module version conflict.",409); Require(request.Order >= 0 && !string.IsNullOrWhiteSpace(request.Title),"Invalid module."); m.Order = request.Order; m.Title = request.Title; try { await db.SaveChangesAsync(ct); } catch (DbUpdateConcurrencyException) { throw new Infrastructure.Authentication.ApiException(409,"Module version conflict."); } if(cache is not null)await cache.Invalidate(CancellationToken.None); return new ModuleDto(m.Id,m.Version,m.CourseId,m.Title,m.Order); }
    #endregion
}
