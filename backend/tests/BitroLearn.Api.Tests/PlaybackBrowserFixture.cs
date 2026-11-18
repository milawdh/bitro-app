using System.Net.Http.Json;
using System.Text.Json;
using Amazon.S3;
using Amazon.S3.Model;
using BitroLearn.Api.Data;
using BitroLearn.Api.Entities;
using BitroLearn.Api.Infrastructure.Configuration;
using BitroLearn.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BitroLearn.Api.Tests;

public sealed class PlaybackBrowserFactAttribute:FactAttribute
{
    public PlaybackBrowserFactAttribute(){if(Environment.GetEnvironmentVariable("BITRO_TEST_PLAYBACK_BROWSER")!="true")Skip="Opt-in real browser fixture; run the playback renewal script.";}
}

public sealed class PlaybackBrowserFixture(PostgresFixture database):IClassFixture<PostgresFixture>
{
    #region Real authenticated API and private storage fixture
    [PlaybackBrowserFact]
    public async Task Serve_one_minute_links_for_browser_expiry_and_access_recheck()
    {
        var original=new Uri(AppConfigurationStatic.GetS3Endpoint());
        var address=(await System.Net.Dns.GetHostAddressesAsync(original.Host)).First(a=>a.AddressFamily==System.Net.Sockets.AddressFamily.InterNetwork);
        var endpoint=new UriBuilder(original){Host=address.ToString()}.Uri.ToString().TrimEnd('/');
        var access=AppConfigurationStatic.GetS3AccessKey();var secret=AppConfigurationStatic.GetS3SecretKey();
        using var factory=new BackendTestFactory(database.ConnectionString);
        using var env=new EnvironmentScope(new Dictionary<string,string?>{
            [AppConfigurationStatic.S3EndpointKey]=endpoint,[AppConfigurationStatic.S3AccessKeyKey]=access,[AppConfigurationStatic.S3SecretKeyKey]=secret,
            [AppConfigurationStatic.StoragePublicEndpointKey]="http://localhost:7076",[AppConfigurationStatic.MediaLinkLifetimeSecondsKey]="60"
        });
        factory.UseKestrel(options=>options.ListenAnyIP(8080));
        using var client=factory.CreateClient();client.BaseAddress=new Uri("http://127.0.0.1:8080");var cookies=new Dictionary<string,string>();
        void Cookies(HttpResponseMessage response){if(response.Headers.TryGetValues("Set-Cookie",out var values))foreach(var value in values){var pair=value.Split(';')[0];cookies[pair.Split('=')[0]]=pair;}}
        async Task<string> Csrf()
        {
            using var response=await client.GetAsync("/public/auth/csrf?area=app");response.EnsureSuccessStatusCode();Cookies(response);
            var token=(await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("requestToken").GetString()!;
            client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");client.DefaultRequestHeaders.Add("X-CSRF-TOKEN",token);return token;
        }
        await Csrf();var phone="+989"+System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000,999999999);
        using var requested=await client.PostAsJsonAsync("/app/auth/otp/request",new {phoneNumber=phone});requested.EnsureSuccessStatusCode();Cookies(requested);
        var challenge=(await requested.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("challengeId").GetString();
        using var verified=await client.PostAsJsonAsync("/app/auth/otp/verify",new {challengeId=challenge,code=factory.Sms.Codes[phone]});verified.EnsureSuccessStatusCode();Cookies(verified);
        var csrf=await Csrf();
        await using var scope=factory.Services.CreateAsyncScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var storage=scope.ServiceProvider.GetRequiredService<IAmazonS3>();var media=scope.ServiceProvider.GetRequiredService<MediaService>();
        var bytes=await File.ReadAllBytesAsync(Path.Combine(AppContext.BaseDirectory,"Fixtures","course-preview.mp4"));
        var upload=JsonSerializer.SerializeToElement(await media.Begin(new("browser-test.mp4",bytes.Length),default));var videoId=upload.GetProperty("Id").GetString()!;
        var asset=await db.VideoAssets.SingleAsync(v=>v.Id==videoId);
        try
        {
            await media.Upload(videoId,1,new MemoryStream(bytes),bytes.Length,default);await media.Complete(videoId,default);
            var course=new Course {Slug=Guid.NewGuid().ToString("N"),Title="Playback expiry test",Status="published"};
            var module=new CourseModule {CourseId=course.Id,Title="Module"};
            var lesson=new Lesson {CourseId=course.Id,ModuleId=module.Id,Slug="video",Title="Video",Duration=1,VideoId=videoId,HasQuiz=false,Status="published"};
            db.AddRange(course,module,lesson);await db.SaveChangesAsync();
            using var enrolled=await client.PostAsync("/app/courses/"+course.Id+"/enroll",null);enrolled.EnsureSuccessStatusCode();
            var folder="/playback-artifacts";Directory.CreateDirectory(folder);
            var runId=Guid.NewGuid().ToString("N");
            await File.WriteAllTextAsync(Path.Combine(folder,"session.json"),JsonSerializer.Serialize(new {runId,apiOrigin="http://127.0.0.1:7080",lessonId=lesson.Id,cookie=string.Join("; ",cookies.Values),csrf},new JsonSerializerOptions(JsonSerializerDefaults.Web)));
            using var timeout=new CancellationTokenSource(TimeSpan.FromMinutes(5));
            while(true)
            {
                timeout.Token.ThrowIfCancellationRequested();
                var done=Path.Combine(folder,"done-"+runId+".json");
                if(File.Exists(done)){var result=JsonDocument.Parse(await File.ReadAllTextAsync(done,timeout.Token));Assert.True(result.RootElement.GetProperty("passed").GetBoolean());break;}
                await Task.Delay(250,timeout.Token);
            }
        }
        finally
        {
            try{await storage.AbortMultipartUploadAsync(AppConfigurationStatic.GetS3Bucket(),asset.ObjectKey,asset.UploadId);}catch(AmazonS3Exception e)when(e.StatusCode==System.Net.HttpStatusCode.NotFound){}
            await storage.DeleteObjectAsync(AppConfigurationStatic.GetS3Bucket(),asset.ObjectKey);
        }
    }
    #endregion
}
