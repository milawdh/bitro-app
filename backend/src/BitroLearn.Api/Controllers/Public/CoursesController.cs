using BitroLearn.Api.Data;
using BitroLearn.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static BitroLearn.Api.Services.CourseContracts;

namespace BitroLearn.Api.Controllers.Public;

[Route("public/courses")]
public sealed class CoursesController(AppDbContext db,MediaService media,ContentCache cache) : PublicAreaController
{
    #region Public catalog
    [HttpGet,AllowAnonymous]
    public async Task<ActionResult<CourseDto[]>> List(CancellationToken ct,int page = 1)
    {
        page=Math.Clamp(page,1,10000);
        return await cache.Get("courses:page:"+page,async (database,token)=>(await database.Courses.AsNoTracking().Where(c=>c.Status=="published").OrderBy(c=>c.Title).ThenBy(c=>c.Id).Skip((page-1)*20).Take(20).ToArrayAsync(token)).Select(PublicDto).ToArray(),ct);
    }
    [HttpGet("{slug}"),AllowAnonymous]
    public async Task<IActionResult> Get(string slug,CancellationToken ct)
    {
        var c = await Find(slug,ct);
        return Ok(await cache.Get("course:"+c.Id+":"+c.Version,async (database,token)=>
        {
            var modules=await database.CourseModules.AsNoTracking().Where(m=>m.CourseId==c.Id).OrderBy(m=>m.Order).Select(m=>new ModuleDto(m.Id,m.Version,m.CourseId,m.Title,m.Order)).ToArrayAsync(token);
            var syllabus=await database.Lessons.AsNoTracking().Where(l=>l.CourseId==c.Id && l.Status=="published").OrderBy(l=>l.Order).Select(l=>new SyllabusItemDto(l.Id,l.ModuleId,l.Title,l.Slug,l.Duration,l.Delivery)).ToArrayAsync(token);
            return new PublicCourseDetailDto(PublicDto(c),modules,syllabus);
        },ct));
    }
    [HttpGet("{slug}/intro-playback"),AllowAnonymous]
    public async Task<ActionResult<PlaybackDto>> Intro(string slug,CancellationToken ct) { var c = await Find(slug,ct); Require(c.IntroVideoId is not null,"No introduction video.",404); return await media.Playback(c.IntroVideoId!,ct); }
    [HttpGet("{slug}/cover"),AllowAnonymous]
    public async Task<IActionResult> Cover(string slug,CancellationToken ct) { var c = await Find(slug,ct); Require(c.CoverKind == "image" && c.CoverFileId is not null,"No image cover.",404); return Redirect((await media.Cover(c.CoverFileId!,ct)).Url); }
    private async Task<Entities.Course> Find(string slug,CancellationToken ct) => await db.Courses.AsNoTracking().SingleOrDefaultAsync(c => c.Slug == slug && c.Status == "published",ct) ?? throw new Infrastructure.Authentication.ApiException(404,"Course not found.");
    private static CourseDto PublicDto(Entities.Course course) => Dto(course) with { SpotPlayerCourseId = null,Animations = Json("[]") };
    #endregion
}
