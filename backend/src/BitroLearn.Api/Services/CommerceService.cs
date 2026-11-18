using System.Net.Http.Json;
using System.Text.Json;
using BitroLearn.Api.Data;
using BitroLearn.Api.Entities;
using BitroLearn.Api.Infrastructure.Configuration;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using static BitroLearn.Api.Services.CourseContracts;

namespace BitroLearn.Api.Services;

public sealed class CommerceService(AppDbContext db, IHttpClientFactory clients, IDataProtectionProvider protection, IHttpContextAccessor? context = null)
{
    #region Membership and activation
    private IDataProtector Protector => protection.CreateProtector("Bitro.SpotPlayer.v1");
    public async Task Enroll(string userId, string courseId, CancellationToken ct)
    {
        Require(await db.Courses.AnyAsync(c => c.Id == courseId && c.Status == "published",ct),"Course not available.",404);
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "CourseEnrollments" ("Id","Version","CreatedAt","UpdatedAt","UserId","CourseId")
            VALUES ({Guid.NewGuid().ToString("N")},1,now(),now(),{userId},{courseId}) ON CONFLICT ("UserId","CourseId") DO NOTHING
            """,ct);
    }
    public async Task Activate(string userId, string courseId, string source, string? manualKey, CancellationToken ct)
    {
        if (manualKey is not null)
        {
            var existing = await db.SpotPlayerLicenses.AsNoTracking().SingleOrDefaultAsync(l => l.UserId == userId && l.CourseId == courseId,ct);
            Require(existing is null || existing.Status == "ready" && existing.EncryptedKey is not null && Protector.Unprotect(existing.EncryptedKey) == manualKey,"Use reconciliation for an existing or in-flight license.",409);
        }
        var course = await db.Courses.SingleOrDefaultAsync(c => c.Id == courseId,ct);
        Require(course is not null && course.CommerceType != "free" && !string.IsNullOrWhiteSpace(course.SpotPlayerCourseId),"Course has no paid content.");
        Require(await db.AppUsers.AnyAsync(u => u.Id == userId,ct),"Learner not found.",404);
        var encrypted = manualKey is null ? null : Protector.Protect(manualKey);
        var mode = manualKey is null ? "api" : "manual";
        var state = manualKey is null ? "pending" : "ready";
        var audit = JsonSerializer.Serialize(new { userId,courseId,source,licenseMode = mode });
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            WITH enrolled AS (
              INSERT INTO "CourseEnrollments" ("Id","Version","CreatedAt","UpdatedAt","UserId","CourseId")
              VALUES ({Guid.NewGuid().ToString("N")},1,now(),now(),{userId},{courseId}) ON CONFLICT ("UserId","CourseId") DO NOTHING
            ), access AS (
              INSERT INTO "CoursePaidAccess" ("Id","Version","CreatedAt","UpdatedAt","UserId","CourseId","Source")
              VALUES ({Guid.NewGuid().ToString("N")},1,now(),now(),{userId},{courseId},{source})
              ON CONFLICT ("UserId","CourseId") DO UPDATE SET "UpdatedAt"=now() RETURNING "UserId","CourseId"
            ), license AS (
              INSERT INTO "SpotPlayerLicenses" ("Id","Version","CreatedAt","UpdatedAt","UserId","CourseId","Status","Source","EncryptedKey")
              SELECT {Guid.NewGuid().ToString("N")},1,now(),now(),"UserId","CourseId",{state},{mode},{encrypted} FROM access
              ON CONFLICT ("UserId","CourseId") DO NOTHING
            )
            INSERT INTO "ProviderAudits" ("Id","CorrelationId","Operation","RequestJson","Status","StartedAt","FinishedAt")
            VALUES ({Guid.NewGuid().ToString("N")},{source},'activate',{audit},'completed',now(),now())
            """,ct);
    }
    public async Task<LicenseDto> License(string userId,string courseId,CancellationToken ct)
    {
        Require(await db.CourseEnrollments.AnyAsync(e => e.UserId == userId && e.CourseId == courseId,ct),"Enrollment required.",403);
        var row = await db.SpotPlayerLicenses.AsNoTracking().SingleOrDefaultAsync(l => l.UserId == userId && l.CourseId == courseId,ct);
        return row is null ? new("locked","none",null,null) : new(row.Status,row.Source,row.Status == "ready" && row.EncryptedKey is not null ? Protector.Unprotect(row.EncryptedKey) : null,row.Error);
    }
    public async Task Reconcile(string userId,string courseId,string key,string actor,CancellationToken ct)
    {
        Require(!string.IsNullOrWhiteSpace(key),"License key required.");
        var encrypted = Protector.Protect(key);
        var changed = await db.Database.ExecuteSqlInterpolatedAsync($"""
            WITH changed AS (
              UPDATE "SpotPlayerLicenses" SET "EncryptedKey"={encrypted},"Status"='ready',"Source"='manual',"Error"=NULL,"Version"="Version"+1,"UpdatedAt"=now()
              WHERE "UserId"={userId} AND "CourseId"={courseId} AND "Status" IN ('needsReconciliation','failed') RETURNING "Id"
            ) INSERT INTO "ProviderAudits" ("Id","CorrelationId","Operation","RequestJson","Status","StartedAt","FinishedAt")
              SELECT {Guid.NewGuid().ToString("N")},"Id",'reconcile',{actor},'completed',now(),now() FROM changed
            """,ct);
        Require(changed > 0,"License cannot be replaced in its current state.",409);
    }
    #endregion

    #region Provider calls and persistent audit
    public async Task<JsonElement> Call(string provider,string operation,string correlation,object request,CancellationToken ct)
    {
        var body = JsonSerializer.SerializeToElement(request);
        var safe = JsonSerializer.Deserialize<Dictionary<string,JsonElement>>(body.GetRawText())!;
        safe.Remove("merchant");
        safe["requestId"] = JsonSerializer.SerializeToElement(context?.HttpContext?.TraceIdentifier ?? Guid.NewGuid().ToString("N"));
        var audit = new ProviderAudit { CorrelationId = correlation,Operation = provider + ":" + operation,RequestJson = JsonSerializer.Serialize(safe) };
        db.ProviderAudits.Add(audit); await db.SaveChangesAsync(ct);
        try
        {
            using var message = new HttpRequestMessage(HttpMethod.Post,provider == "zibal" ? "https://gateway.zibal.ir/v1/" + operation : "https://panel.spotplayer.ir/license/edit/");
            if (provider == "spotplayer") { message.Headers.Add("$API",CommerceConfiguration.SpotKey); message.Headers.Add("$LEVEL","-1"); }
            message.Content = JsonContent.Create(request);
            using var response = await clients.CreateClient("commerce").SendAsync(message,ct);
            var text = await response.Content.ReadAsStringAsync(ct);
            audit.HttpStatus = (int)response.StatusCode;
            audit.ResponseJson = provider == "spotplayer" ? Protector.Protect(text) : text;
            audit.Status = response.IsSuccessStatusCode ? "completed" : "httpError";
            audit.FinishedAt = DateTimeOffset.UtcNow; await db.SaveChangesAsync(CancellationToken.None);
            response.EnsureSuccessStatusCode();
            return Json(text);
        }
        catch
        {
            audit.Status = "unknown"; audit.FinishedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None); throw;
        }
    }
    public Task<JsonElement> Inquiry(Invoice invoice,CancellationToken ct) => Call("zibal","inquiry",invoice.Id,new { merchant = CommerceConfiguration.Merchant,trackId = long.Parse(invoice.TrackId!) },ct);
    public static string Observed(JsonElement response) => !response.TryGetProperty("result",out var r) || r.GetInt32() != 100 ? "unknown" : response.GetProperty("status").GetInt32() switch { 1 or 2 => "success", -1 => "unpaid", -2 => "unknown", _ => "failed" };
    public static bool Matches(JsonElement response,Invoice i) => response.TryGetProperty("amount",out var a) && a.GetInt64() == i.AmountRial && response.TryGetProperty("orderId",out var o) && o.ToString() == i.Id;
    #endregion

    #region Invoice lifecycle
    public async Task<InvoiceDto> CreateInvoice(string userId,InvoiceRequest request,CancellationToken ct)
    {
        Require(!string.IsNullOrWhiteSpace(request.IdempotencyKey) && request.IdempotencyKey.Length <= 160,"Idempotency key required.");
        var previous = await db.Invoices.SingleOrDefaultAsync(i => i.UserId == userId && i.IdempotencyKey == request.IdempotencyKey,ct);
        if (previous is not null) { Require(previous.CourseId == request.CourseId,"Idempotency key belongs to another course.",409); return await ResumeCheckout(previous,ct); }
        var course = await db.Courses.SingleOrDefaultAsync(c => c.Id == request.CourseId && c.Status == "published",ct);
        Require(course is not null && course.CommerceType != "free","No purchasable course.",404);
        Require(await db.CourseEnrollments.AnyAsync(e => e.UserId == userId && e.CourseId == request.CourseId,ct),"Enrollment required.",403);
        Require(!await db.CoursePaidAccess.AnyAsync(e => e.UserId == userId && e.CourseId == request.CourseId,ct),"Paid content already active.",409);
        var active = await db.Invoices.SingleOrDefaultAsync(i => i.UserId == userId && i.CourseId == request.CourseId && new[] { "creating","pending","paid","requestUnknown" }.Contains(i.PaymentStatus),ct);
        if (active is not null) return await ResumeCheckout(active,ct);
        var invoice = new Invoice { UserId = userId,CourseId = course!.Id,CourseTitle = course.Title,AmountRial = course.PriceRial,IdempotencyKey = request.IdempotencyKey };
        db.Invoices.Add(invoice);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { throw new Infrastructure.Authentication.ApiException(409,"Checkout already in progress."); }
        return await RequestPaymentSession(invoice,ct);
    }
    private async Task<InvoiceDto> ResumeCheckout(Invoice invoice,CancellationToken ct)
    {
        // No URL was delivered for an unknown creation outcome. Retrying can create
        // another unexposed gateway session, but preserves one invoice and one grant.
        var stale = DateTimeOffset.UtcNow.AddMinutes(-2);
        if (invoice.TrackId is null && (invoice.PaymentStatus == "requestUnknown" || invoice.PaymentStatus == "creating" && invoice.UpdatedAt < stale))
        {
            Require(await db.Courses.AnyAsync(c => c.Id == invoice.CourseId && c.Status == "published" && c.CommerceType != "free",ct),"Course is no longer purchasable.",409);
            Require(!await db.CoursePaidAccess.AnyAsync(a => a.UserId == invoice.UserId && a.CourseId == invoice.CourseId,ct),"Paid content already active.",409);
            var claimed = await db.Invoices.Where(i => i.Id == invoice.Id && i.TrackId == null && (i.PaymentStatus == "requestUnknown" || i.PaymentStatus == "creating" && i.UpdatedAt < stale)).ExecuteUpdateAsync(s => s.SetProperty(i => i.PaymentStatus,"creating").SetProperty(i => i.UpdatedAt,DateTimeOffset.UtcNow),ct);
            await db.Entry(invoice).ReloadAsync(ct);
            if (claimed == 1) return await RequestPaymentSession(invoice,ct);
        }
        return Dto(invoice);
    }
    private async Task<InvoiceDto> RequestPaymentSession(Invoice invoice,CancellationToken ct)
    {
        try
        {
            var response = await Call("zibal","request",invoice.Id,new { merchant = CommerceConfiguration.Merchant,amount = invoice.AmountRial,orderId = invoice.Id,callbackUrl = CommerceConfiguration.CallbackUrl },ct);
            if (response.GetProperty("result").GetInt32() == 100)
            {
                var track = response.GetProperty("trackId").ToString();
                if (long.TryParse(track,out var trackId) && trackId > 0) { invoice.TrackId = track; invoice.PaymentStatus = "pending"; }
                else invoice.PaymentStatus = "requestUnknown";
            }
            else invoice.PaymentStatus = "failed";
        }
        catch (HttpRequestException) { invoice.PaymentStatus = "requestUnknown"; }
        catch (TaskCanceledException) { invoice.PaymentStatus = "requestUnknown"; }
        catch (JsonException) { invoice.PaymentStatus = "requestUnknown"; }
        catch (KeyNotFoundException) { invoice.PaymentStatus = "requestUnknown"; }
        await db.SaveChangesAsync(CancellationToken.None); return Dto(invoice);
    }
    public async Task ProcessInvoice(string id,string token,CancellationToken ct)
    {
        var invoice = await db.Invoices.AsNoTracking().SingleAsync(i => i.Id == id,ct);
        if (invoice.PaymentStatus != "paid")
        {
            var response = await Inquiry(invoice,ct);
            if (Observed(response) != "success")
            {
                if (Observed(response) == "failed") await SetPayment(id,token,response.GetProperty("status").GetInt32() is 15 or 16 or 18 ? "needsReview" : "failed",ct);
                return;
            }
            if (!Matches(response,invoice)) { await SetPayment(id,token,"needsReview",ct); return; }
            if (response.GetProperty("status").GetInt32() == 2)
            {
                response = await Call("zibal","verify",id,new { merchant = CommerceConfiguration.Merchant,trackId = long.Parse(invoice.TrackId!) },ct);
                if (response.GetProperty("result").GetInt32() == 201) response = await Inquiry(invoice,ct);
                if (response.GetProperty("result").GetInt32() != 100) return;
                if (!Matches(response,invoice) || !response.TryGetProperty("status",out var status) || status.GetInt32() != 1) return;
            }
            if (!await SetPayment(id,token,"paid",ct)) return;
        }
        await Activate(invoice.UserId,invoice.CourseId,invoice.Id,null,ct);
        await db.Invoices.Where(i => i.Id == id && i.LeaseToken == token).ExecuteUpdateAsync(s => s.SetProperty(i => i.FulfillmentStatus,"completed"),ct);
    }
    private async Task<bool> SetPayment(string id,string token,string state,CancellationToken ct) => await db.Database.ExecuteSqlInterpolatedAsync($"""
        WITH previous AS (
          SELECT "PaymentStatus" FROM "Invoices" WHERE "Id"={id} AND "LeaseToken"={token} AND "LeaseUntil">now()
        ), changed AS (
          UPDATE "Invoices" SET "PaymentStatus"={state},"Version"="Version"+1,"UpdatedAt"=now()
          WHERE "Id"={id} AND "LeaseToken"={token} AND "LeaseUntil">now() AND EXISTS (SELECT 1 FROM previous) RETURNING "Id"
        ) INSERT INTO "ProviderAudits" ("Id","CorrelationId","Operation","RequestJson","Status","StartedAt","FinishedAt")
          SELECT {Guid.NewGuid().ToString("N")},c."Id",'invoice:state',jsonb_build_object('previous',p."PaymentStatus",'next',{state})::text,'completed',now(),now() FROM changed c CROSS JOIN previous p
        """,ct) == 1;
    public async Task IssueLicense(string id,CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(CommerceConfiguration.SpotKey)) return;
        if (await db.SpotPlayerLicenses.Where(l => l.Id == id && l.Status == "pending").ExecuteUpdateAsync(s => s.SetProperty(l => l.Status,"issuing").SetProperty(l => l.UpdatedAt,DateTimeOffset.UtcNow),ct) == 0) return;
        var license = await db.SpotPlayerLicenses.SingleAsync(l => l.Id == id,ct);
        var course = await db.Courses.SingleAsync(c => c.Id == license.CourseId,ct);
        var user = await db.AppUsers.SingleAsync(u => u.Id == license.UserId,ct);
        try
        {
            var response = await Call("spotplayer","create",license.Id,new { test = CommerceConfiguration.SpotTest,course = new[] { course.SpotPlayerCourseId },name = string.IsNullOrWhiteSpace(user.FullName) ? user.PhoneNumber : user.FullName,payload = license.Id,watermark = new { texts = new[] { new { text = user.PhoneNumber } } } },ct);
            if (response.TryGetProperty("key",out var key) && !string.IsNullOrWhiteSpace(key.GetString()))
            { license.EncryptedKey = Protector.Protect(key.GetString()!); license.ProviderId = response.GetProperty("_id").GetString(); license.Status = "ready"; }
            else { license.Status = "needsReconciliation"; license.Error = "Provider did not return a license key."; }
        }
        catch (Exception e) when (e is not OperationCanceledException || !ct.IsCancellationRequested) { license.Status = "needsReconciliation"; license.Error = "Provider outcome unknown; reconcile existing license."; }
        await db.SaveChangesAsync(CancellationToken.None);
    }
    #endregion
}

public static class CommerceConfiguration
{
    #region Settings
    public static string Merchant => AppConfigurationStatic.ZibalMerchantKey.ReadEnv() ?? (AppConfigurationStatic.LocalEnvironmentKey.ReadEnv() == "Production" ? throw new InvalidOperationException("Zibal merchant required.") : "zibal");
    public static string CallbackUrl => AppConfigurationStatic.ZibalCallbackKey.ReadEnv() ?? "http://localhost:7075/public/payments/zibal/callback";
    public static string SpotKey => AppConfigurationStatic.SpotApiKey.ReadEnv() ?? "";
    public static bool SpotTest => AppConfigurationStatic.SpotTestKey.ReadEnv() != "false";
    #endregion
}
