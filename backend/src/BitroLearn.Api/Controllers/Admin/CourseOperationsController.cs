using System.Security.Claims;
using BitroLearn.Api.Data;
using BitroLearn.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static BitroLearn.Api.Services.CourseContracts;

namespace BitroLearn.Api.Controllers.Admin;

[Route("admin/")]
public sealed class CourseOperationsController(AppDbContext db,CommerceService commerce,MediaService media) : AdminAreaController
{
    #region Administration
    [HttpGet("animations")]
    public IActionResult Animations() => Ok(AnimationRegistry.Keys.Select(key => new { key,schemaVersion = 1,defaults = AnimationRegistry.Defaults(key) }));
    [HttpGet("app-users")]
    public async Task<IActionResult> Users(CancellationToken ct,string? phone = null) => Ok(await db.AppUsers.Where(u => phone == null || u.PhoneNumber == phone).Select(u => new { u.Id,u.FullName,u.PhoneNumber }).Take(50).ToArrayAsync(ct));
    [HttpPost("app-users/{userId}/courses/{courseId}/activate")]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<IActionResult> Activate(string userId,string courseId,ActivateRequest request,CancellationToken ct)
    {
        Require(request.LicenseMode is "manual" or "api","Invalid license mode.");
        Require(request.LicenseMode != "manual" || !string.IsNullOrWhiteSpace(request.LicenseKey),"Manual license key required.");
        await commerce.Activate(userId,courseId,"admin:" + User.FindFirstValue(ClaimTypes.NameIdentifier),request.LicenseMode == "manual" ? request.LicenseKey : null,ct);
        return Accepted();
    }
    [HttpGet("app-users/{userId}/courses/{courseId}/license")]
    [Authorize(Roles = "admin,superadmin")]
    [ResponseCache(NoStore = true,Location = ResponseCacheLocation.None)]
    public Task<LicenseDto> License(string userId,string courseId,CancellationToken ct) => commerce.License(userId,courseId,ct);
    [HttpPost("app-users/{userId}/courses/{courseId}/license/reconcile")]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<IActionResult> Reconcile(string userId,string courseId,ActivateRequest request,CancellationToken ct) { await commerce.Reconcile(userId,courseId,request.LicenseKey ?? "",User.FindFirstValue(ClaimTypes.NameIdentifier)!,ct); return NoContent(); }
    [HttpGet("invoices")]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<ActionResult<InvoiceDto[]>> Invoices(CancellationToken ct) => (await db.Invoices.AsNoTracking().OrderByDescending(i => i.CreatedAt).Take(100).ToArrayAsync(ct)).Select(Dto).ToArray();
    [HttpGet("invoices/{id}/audit")]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<IActionResult> Audit(string id,CancellationToken ct) => Ok(await db.ProviderAudits.Where(a => a.CorrelationId == id).OrderBy(a => a.StartedAt).Select(a => new { a.Id,a.Operation,a.RequestJson,a.ResponseJson,a.Status,a.HttpStatus,a.StartedAt,a.FinishedAt }).ToArrayAsync(ct));
    [HttpPost("videos/uploads")]
    public Task<object> Begin(VideoUploadRequest request,CancellationToken ct) => media.Begin(request,ct);
    [HttpPost("videos/register")]
    public Task<object> Register([FromBody] string objectKey,CancellationToken ct) => media.Register(objectKey,ct);
    [HttpPost("media/images")]
    [RequestSizeLimit(10485760)]
    public async Task<IActionResult> Image(CancellationToken ct) => Ok(new { fileId = await media.Image(Request.Body,User.FindFirstValue(ClaimTypes.NameIdentifier)!,ct) });
    [HttpGet("videos/uploads/{id}")]
    public Task<object> Parts(string id,CancellationToken ct) => media.Parts(id,ct);
    [HttpPut("videos/uploads/{id}/parts/{number:int}")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> Part(string id,int number,CancellationToken ct) { await media.Upload(id,number,Request.Body,Request.ContentLength,ct); return NoContent(); }
    [HttpPost("videos/uploads/{id}/complete")]
    public async Task<IActionResult> Complete(string id,CancellationToken ct) { await media.Complete(id,ct,false); return Accepted(); }
    [HttpDelete("videos/uploads/{id}")]
    public async Task<IActionResult> Abort(string id,CancellationToken ct) { await media.Abort(id,ct); return NoContent(); }
    #endregion
}
