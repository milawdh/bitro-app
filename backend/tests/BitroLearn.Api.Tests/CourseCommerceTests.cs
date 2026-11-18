using System.Text.Json.Nodes;
using BitroLearn.Api.Entities;
using BitroLearn.Api.Services;
using BitroLearn.Api.Infrastructure.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace BitroLearn.Api.Tests;

public sealed class CourseCommerceTests(PostgresFixture fixture) : IClassFixture<PostgresFixture>
{
    #region Registry and media contracts
    [Fact]
    public void Disabled_course_animation_cannot_be_reenabled_by_lesson()
    {
        Assert.Empty(AnimationRegistry.Resolve("[{\"key\":\"variables\",\"enabled\":false,\"settings\":{}}]","[{\"key\":\"variables\",\"enabled\":true,\"settings\":{}}]"));
    }
    [Fact]
    public void Lesson_settings_override_course_and_unknown_settings_fail()
    {
        var resolved = AnimationRegistry.Resolve("[{\"key\":\"variables\",\"enabled\":true,\"settings\":{\"initialValue\":12}}]","[{\"key\":\"variables\",\"enabled\":true,\"settings\":{\"initialValue\":25}}]");
        Assert.Equal(25,resolved[0].Settings["initialValue"]!.GetValue<int>());
        Assert.Throws<ApiException>(()=>AnimationRegistry.Validate([new("variables",true,new JsonObject { ["unknown"] = 1 })]));
        AnimationRegistry.Validate([new("references",true,new JsonObject { ["shared"] = false })]);
    }
    [Fact]
    public void Multipart_size_grows_instead_of_capping_video_size()
    {
        var size = 400L*1024*1024*1024;
        Assert.True((size-1)/MediaService.PartSize(size)+1 <= 10000);
        Assert.True(MediaService.PartSize(size) > 16L*1024*1024);
    }
    [Theory]
    [InlineData(2,"success")]
    [InlineData(1,"success")]
    [InlineData(-1,"unpaid")]
    [InlineData(-2,"unknown")]
    public void Inquiry_result_is_distinct_from_payment_status(int status,string expected)
        => Assert.Equal(expected,CommerceService.Observed(CourseContracts.Json($"{{\"result\":100,\"status\":{status}}}")));
    #endregion
    #region Real database membership and manual activation
    [PostgresFact]
    public async Task Manual_activation_enrolls_and_repeats_without_duplicate_access_or_license()
    {
        await using var db = fixture.CreateContext();
        var user = new AppUser { PhoneNumber = "+989" + System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000,999999999) };
        var course = new Course { Slug = Guid.NewGuid().ToString("N"),Title = "Mixed course",CommerceType = "mixed",PriceRial = 1000,SpotPlayerCourseId = "provider-course",Status = "published" };
        db.AddRange(user,course); await db.SaveChangesAsync();
        var service = new CommerceService(db,new NoNetwork(),new EphemeralDataProtectionProvider());
        await service.Activate(user.Id,course.Id,"admin:test","manual-secret",CancellationToken.None);
        await service.Activate(user.Id,course.Id,"admin:test","manual-secret",CancellationToken.None);
        Assert.Equal(1,await db.CourseEnrollments.CountAsync(e=>e.UserId==user.Id));
        Assert.Equal(1,await db.CoursePaidAccess.CountAsync(e=>e.UserId==user.Id));
        Assert.Equal(1,await db.SpotPlayerLicenses.CountAsync(e=>e.UserId==user.Id));
        var license = await service.License(user.Id,course.Id,CancellationToken.None);
        Assert.Equal("ready",license.Status); Assert.Equal("manual-secret",license.Key);
        Assert.DoesNotContain("manual-secret",await db.SpotPlayerLicenses.Where(l=>l.UserId==user.Id).Select(l=>l.EncryptedKey!).SingleAsync());
    }
    [PostgresFact]
    public async Task Enrollment_alone_never_activates_paid_content()
    {
        await using var db = fixture.CreateContext();
        var user = new AppUser { PhoneNumber = "+989" + System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000,999999999) };
        db.AppUsers.Add(user); await db.SaveChangesAsync();
        var course = await db.Courses.FirstAsync(c=>c.Status=="published");
        var service = new CommerceService(db,new NoNetwork(),new EphemeralDataProtectionProvider());
        await service.Enroll(user.Id,course.Id,CancellationToken.None); await service.Enroll(user.Id,course.Id,CancellationToken.None);
        Assert.False(await db.CoursePaidAccess.AnyAsync(a=>a.UserId==user.Id));
        Assert.Equal("locked",(await service.License(user.Id,course.Id,CancellationToken.None)).Status);
    }
    private sealed class NoNetwork : IHttpClientFactory { public HttpClient CreateClient(string name) => throw new InvalidOperationException("No network calls allowed."); }
    [PostgresFact]
    public async Task Observation_never_activates_and_worker_replay_has_one_business_effect()
    {
        await using var db = fixture.CreateContext();
        var user = new AppUser { PhoneNumber = "+989" + System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000,999999999) };
        var course = new Course { Slug = Guid.NewGuid().ToString("N"),Title = "Paid course",CommerceType = "paid",PriceRial = 1000,SpotPlayerCourseId = "provider",Status = "published" };
        var invoice = new Invoice { UserId = user.Id,CourseId = course.Id,AmountRial = 1000,IdempotencyKey = Guid.NewGuid().ToString("N"),TrackId = System.Security.Cryptography.RandomNumberGenerator.GetInt32(1,int.MaxValue).ToString(),PaymentStatus = "pending",LeaseToken = "worker",LeaseUntil = DateTimeOffset.UtcNow.AddMinutes(2) };
        db.AddRange(user,course,invoice); await db.SaveChangesAsync();
        var service = new CommerceService(db,new FakeGateway(invoice.Id),new EphemeralDataProtectionProvider());
        Assert.Equal("success",CommerceService.Observed(await service.Inquiry(invoice,CancellationToken.None)));
        Assert.False(await db.CoursePaidAccess.AnyAsync(a=>a.UserId==user.Id));
        await service.ProcessInvoice(invoice.Id,"worker",CancellationToken.None);
        await service.ProcessInvoice(invoice.Id,"worker",CancellationToken.None);
        Assert.Equal(1,await db.CoursePaidAccess.CountAsync(a=>a.UserId==user.Id));
        Assert.Equal(1,await db.SpotPlayerLicenses.CountAsync(a=>a.UserId==user.Id));
        await db.Entry(invoice).ReloadAsync(); Assert.Equal("paid",invoice.PaymentStatus); Assert.Equal("completed",invoice.FulfillmentStatus);
    }
    [PostgresFact]
    public async Task Content_list_projects_without_serializing_entities()
    {
        await using var db = fixture.CreateContext();
        var controller = new Controllers.Admin.ContentController(db);
        Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(await controller.List("courses",CancellationToken.None));
        Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(await controller.List("lessons",CancellationToken.None));
    }
    private sealed class FakeGateway(string invoiceId) : HttpMessageHandler,IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(this,false);
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct) => Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new StringContent(System.Text.Json.JsonSerializer.Serialize(new { result = 100,status = request.RequestUri!.AbsolutePath.EndsWith("verify") ? 1 : 2,amount = 1000,orderId = invoiceId })) });
    }
    [PostgresFact]
    public async Task Curriculum_reorder_is_complete_and_version_guarded()
    {
        await using var db = fixture.CreateContext();
        var course = await db.Courses.AsNoTracking().FirstAsync(c=>c.Id=="csharp");
        var modules = await db.CourseModules.Where(m=>m.CourseId==course.Id).OrderByDescending(m=>m.Order).Select(m=>m.Id).ToArrayAsync();
        var lessons = await db.Lessons.Where(l=>l.CourseId==course.Id).Select(l=>l.Id).ToArrayAsync();
        var controller = new Controllers.Admin.ContentController(db);
        Assert.IsType<Microsoft.AspNetCore.Mvc.NoContentResult>(await controller.Reorder("courses",course.Id,new(course.Version,modules,lessons),CancellationToken.None));
        var stale = await Assert.ThrowsAsync<ApiException>(()=>controller.Reorder("courses",course.Id,new(course.Version,modules,lessons),CancellationToken.None));
        Assert.Equal(409,stale.StatusCode);
        Assert.Equal(modules,await db.CourseModules.Where(m=>m.CourseId==course.Id).OrderBy(m=>m.Order).Select(m=>m.Id).ToArrayAsync());
    }
    [PostgresFact]
    public async Task Lost_license_response_never_triggers_a_second_create()
    {
        using var env = new EnvironmentScope(new Dictionary<string,string?> { [Infrastructure.Configuration.AppConfigurationStatic.SpotApiKey] = "fake-key" });
        await using var db = fixture.CreateContext();
        var user = new AppUser { PhoneNumber = "+989" + System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000,999999999) };
        var course = new Course { Slug = Guid.NewGuid().ToString("N"),Title = "License course",CommerceType = "paid",PriceRial = 1000,SpotPlayerCourseId = "provider",Status = "published" };
        db.AddRange(user,course); await db.SaveChangesAsync();
        var provider = new LostResponse(); var service = new CommerceService(db,provider,new EphemeralDataProtectionProvider());
        await service.Activate(user.Id,course.Id,"admin:test",null,CancellationToken.None);
        var id = await db.SpotPlayerLicenses.Where(l=>l.UserId==user.Id).Select(l=>l.Id).SingleAsync();
        await service.IssueLicense(id,CancellationToken.None); await service.IssueLicense(id,CancellationToken.None);
        Assert.Equal(1,provider.Calls);
        Assert.Equal("needsReconciliation",(await service.License(user.Id,course.Id,CancellationToken.None)).Status);
        Assert.True(await db.CoursePaidAccess.AnyAsync(a=>a.UserId==user.Id));
    }
    private sealed class LostResponse : HttpMessageHandler,IHttpClientFactory
    {
        public int Calls { get; private set; }
        public HttpClient CreateClient(string name) => new(this,false);
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct) { Calls++; throw new HttpRequestException("Lost response"); }
    }
    [PostgresFact]
    public async Task Unknown_checkout_can_resume_without_creating_another_invoice()
    {
        await using var db = fixture.CreateContext();
        var user = new AppUser { PhoneNumber = "+989" + System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000,999999999) };
        var course = new Course { Slug = Guid.NewGuid().ToString("N"),Title = "Checkout retry",CommerceType = "paid",PriceRial = 1000,SpotPlayerCourseId = "provider",Status = "published" };
        var invoice = new Invoice { UserId = user.Id,CourseId = course.Id,AmountRial = 1000,IdempotencyKey = Guid.NewGuid().ToString("N"),PaymentStatus = "requestUnknown" };
        db.AddRange(user,course,invoice,new CourseEnrollment { UserId = user.Id,CourseId = course.Id }); await db.SaveChangesAsync();
        var gateway = new RequestGateway(); var service = new CommerceService(db,gateway,new EphemeralDataProtectionProvider());
        var first = await service.CreateInvoice(user.Id,new(course.Id,invoice.IdempotencyKey),CancellationToken.None);
        var again = await service.CreateInvoice(user.Id,new(course.Id,invoice.IdempotencyKey),CancellationToken.None);
        Assert.Equal(invoice.Id,first.Id); Assert.Equal(first.Id,again.Id); Assert.Equal("pending",again.PaymentStatus);
        Assert.NotNull(again.PaymentUrl); Assert.Equal(1,gateway.Calls);
        Assert.Equal(1,await db.Invoices.CountAsync(i=>i.UserId==user.Id));
        Assert.DoesNotContain("merchant",(await db.ProviderAudits.SingleAsync(a=>a.CorrelationId==invoice.Id)).RequestJson);
    }
    private sealed class RequestGateway : HttpMessageHandler,IHttpClientFactory
    {
        public int Calls { get; private set; }
        public HttpClient CreateClient(string name) => new(this,false);
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
        { Calls++; return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new StringContent("{\"result\":100,\"trackId\":123456}") }); }
    }
    #endregion
}
