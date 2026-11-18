using System.Security.Claims;
using BitroLearn.Api.Data;
using BitroLearn.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static BitroLearn.Api.Services.CourseContracts;

namespace BitroLearn.Api.Controllers.App;

[Route("app/")]
[ResponseCache(NoStore = true,Location = ResponseCacheLocation.None)]
public sealed class CoursesController(AppDbContext db,CommerceService commerce,MediaService media,ContentCache cache) : AppAreaController
{
    #region Learner operations
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    [HttpGet("my-courses")]
    public async Task<ActionResult<MyCourseDto[]>> Mine(CancellationToken ct)
    {
        var courses = await db.Courses.AsNoTracking().Where(c => db.CourseEnrollments.Any(e => e.CourseId == c.Id && e.UserId == UserId)).OrderBy(c => c.Title).ToArrayAsync(ct);
        var paid = await db.CoursePaidAccess.Where(a => a.UserId == UserId).Select(a => a.CourseId).ToArrayAsync(ct);
        var licenses = await db.SpotPlayerLicenses.Where(l => l.UserId == UserId).Select(l => new { l.CourseId,l.Status }).ToDictionaryAsync(l => l.CourseId,l => l.Status,ct);
        return courses.Select(c => new MyCourseDto(Dto(c),"enrolled",paid.Contains(c.Id),licenses.GetValueOrDefault(c.Id,"locked"))).ToArray();
    }
    [HttpPost("courses/{courseId}/enroll")]
    public async Task<ActionResult<EnrollmentDto>> Enroll(string courseId,CancellationToken ct) { await commerce.Enroll(UserId,courseId,ct); return new EnrollmentDto(courseId,"enrolled"); }
    [HttpGet("lessons/{lessonId}")]
    public async Task<ActionResult<LessonDto>> Lesson(string lessonId,CancellationToken ct)
    {
        var l = await AvailableLesson(lessonId,ct);
        Require(l.Delivery == "onsite","Continue this syllabus in SpotPlayer.",403);
        var c = await db.Courses.SingleAsync(c => c.Id == l.CourseId,ct);
        return await cache.Get("lesson:"+l.Id+":"+l.Version+":"+c.Version,(_,_)=>Task.FromResult(Dto(l,false) with { Animations = System.Text.Json.JsonSerializer.SerializeToElement(AnimationRegistry.Resolve(c.AnimationsJson,l.AnimationsJson),new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)) }),ct);
    }
    [HttpPost("lessons/{lessonId}/playback")]
    public async Task<ActionResult<PlaybackDto>> Playback(string lessonId,CancellationToken ct) { var l = await AvailableLesson(lessonId,ct); Require(l.Delivery == "onsite" && l.VideoId is not null,"No onsite video.",404); return await media.Playback(l.VideoId!,ct); }
    [HttpGet("courses/{courseId}/license")]
    public Task<LicenseDto> License(string courseId,CancellationToken ct) => commerce.License(UserId,courseId,ct);
    [HttpPost("invoices")]
    public Task<InvoiceDto> Create(InvoiceRequest request,CancellationToken ct) => commerce.CreateInvoice(UserId,request,ct);
    [HttpGet("invoices/{id}")]
    public async Task<ActionResult<InvoiceDto>> Invoice(string id,CancellationToken ct) => Dto(await OwnedInvoice(id,ct));
    [HttpPost("invoices/{id}/verify")]
    public async Task<ActionResult<InvoiceVerificationDto>> Verify(string id,CancellationToken ct)
    {
        var i = await OwnedInvoice(id,ct); Require(i.TrackId is not null,"Payment session unavailable.",409);
        var response = await commerce.Inquiry(i,ct);
        await db.Entry(i).ReloadAsync(ct);
        var paid = await db.CoursePaidAccess.AnyAsync(a => a.UserId == UserId && a.CourseId == i.CourseId,ct);
        var licenseStatus = await db.SpotPlayerLicenses.Where(l => l.UserId == UserId && l.CourseId == i.CourseId).Select(l => l.Status).SingleOrDefaultAsync(ct) ?? "locked";
        return new InvoiceVerificationDto(i.Id,CommerceService.Observed(response),i.PaymentStatus,i.FulfillmentStatus,paid,licenseStatus);
    }
    private async Task<Entities.Invoice> OwnedInvoice(string id,CancellationToken ct) => await db.Invoices.SingleOrDefaultAsync(i => i.Id == id && i.UserId == UserId,ct) ?? throw new Infrastructure.Authentication.ApiException(404,"Invoice not found.");
    private async Task<Entities.Lesson> AvailableLesson(string id,CancellationToken ct)
    {
        var l = await db.Lessons.AsNoTracking().SingleOrDefaultAsync(l => l.Id == id && l.Status == "published" && db.Courses.Any(c => c.Id == l.CourseId && c.Status == "published"),ct);
        Require(l is not null,"Lesson unavailable.",404);
        Require(await db.CourseEnrollments.AnyAsync(e => e.UserId == UserId && e.CourseId == l!.CourseId,ct),"Enrollment required.",403); return l!;
    }
    #endregion
}
