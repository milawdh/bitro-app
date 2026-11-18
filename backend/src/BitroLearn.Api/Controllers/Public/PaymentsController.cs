using BitroLearn.Api.Data;
using BitroLearn.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BitroLearn.Api.Controllers.Public;

[Route("public/payments/zibal")]
public sealed class PaymentsController(AppDbContext db) : PublicAreaController
{
    #region Provider callback receipt only
    [HttpGet("callback"),AllowAnonymous]
    public async Task<IActionResult> Callback(string? orderId,string? trackId,string? status,string? success,CancellationToken ct)
    {
        db.ProviderAudits.Add(new ProviderAudit { CorrelationId = orderId ?? "unknown",Operation = "zibal:callback",RequestJson = System.Text.Json.JsonSerializer.Serialize(new { orderId,trackId,status,success,requestId = HttpContext.TraceIdentifier }),Status = "received",FinishedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync(ct);
        return Redirect(Infrastructure.Configuration.AppConfigurationStatic.GetAppPublicUrl()+"/payments/result?invoiceId="+Uri.EscapeDataString(orderId??""));
    }
    #endregion
}
