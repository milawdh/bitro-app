using System.Security.Claims;
using BitroLearn.Api.Data;
using BitroLearn.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static BitroLearn.Api.Services.CourseContracts;

namespace BitroLearn.Api.Controllers.App;

[Route("app/catalog")]
public sealed class LearningContentController(AppDbContext db,ContentCache cache) : AppAreaController
{
    #region Published learner content
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    [HttpGet("labs")]
    public async Task<IActionResult> Labs(CancellationToken ct) => Ok(await db.Labs.AsNoTracking().Where(l => l.Status == "published").OrderBy(l => l.Title).Select(l => new { l.Id,l.Slug,l.Title,l.Description,l.Category,l.Duration,l.Concept }).Take(100).ToArrayAsync(ct));
    [HttpGet("labs/{slug}")]
    public async Task<IActionResult> Lab(string slug,CancellationToken ct)
    {
        var lab = await db.Labs.AsNoTracking().SingleOrDefaultAsync(l => l.Slug == slug && l.Status == "published",ct);
        Require(lab is not null,"Lab not found.",404);
        return Ok(await cache.Get("lab:"+lab!.Id+":"+lab.Version,(_,_)=>Task.FromResult(new LabDto(lab.Id,lab.Version,lab.Slug,lab.Title,lab.Description,lab.Concept,Json(lab.ConfigJson))),ct));
    }
    [HttpGet("challenges")]
    public async Task<IActionResult> Challenges(CancellationToken ct) => Ok(await db.Challenges.AsNoTracking().Where(c => c.Status == "published" && db.Courses.Any(course => course.Id == c.CourseId && course.Status == "published") && db.CourseEnrollments.Any(e => e.UserId == UserId && e.CourseId == c.CourseId)).OrderBy(c => c.Title).Select(c => new { c.Id,c.Slug,c.Title,c.Description,c.CourseId,c.Difficulty,c.Duration }).Take(100).ToArrayAsync(ct));
    [HttpGet("challenges/{slug}")]
    public async Task<IActionResult> Challenge(string slug,CancellationToken ct)
    {
        var challenge = await db.Challenges.AsNoTracking().SingleOrDefaultAsync(c => c.Slug == slug && c.Status == "published" && db.Courses.Any(course => course.Id == c.CourseId && course.Status == "published") && db.CourseEnrollments.Any(e => e.UserId == UserId && e.CourseId == c.CourseId),ct);
        Require(challenge is not null,"Challenge unavailable; enrollment required.",404);
        return Ok(await cache.Get("challenge:"+challenge!.Id+":"+challenge.Version,(_,_)=>
        {
            var questions=Json(challenge.QuestionsJson).EnumerateArray().Select(q=>new ChallengeQuestionDto(q.GetProperty("id").GetString()!,q.GetProperty("prompt").GetString()!,q.TryGetProperty("code",out var code)?code.GetString()??"":"",q.GetProperty("options").EnumerateArray().Select(o=>new ChallengeOptionDto(o.GetProperty("id").GetString()!,o.GetProperty("label").GetString()!)).ToArray())).ToArray();
            return Task.FromResult(new ChallengeDto(challenge.Id,challenge.Version,challenge.Slug,challenge.Title,challenge.Description,challenge.Hint,questions));
        },ct));
    }
    [HttpGet("project-templates")]
    public async Task<IActionResult> Projects(CancellationToken ct)
    {
        var projects = await db.ProjectTemplates.AsNoTracking().Where(p => p.Status == "published" && db.Courses.Any(c => c.Id == p.CourseId && c.Status == "published") && db.CourseEnrollments.Any(e => e.UserId == UserId && e.CourseId == p.CourseId)).OrderBy(p => p.Title).Take(100).ToArrayAsync(ct);
        var output=new List<ProjectTemplateDto>();
        foreach(var p in projects)output.Add(await cache.Get("template:"+p.Id+":"+p.Version,(_,_)=>Task.FromResult(new ProjectTemplateDto(p.Id,p.Version,p.Slug,p.Title,p.Description,p.CourseId,p.Duration,p.Difficulty,Json(p.ObjectivesJson),Json(p.FilesJson))),ct));
        return Ok(output);
    }
    #endregion
}
