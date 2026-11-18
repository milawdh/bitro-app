using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using BitroLearn.Api.Infrastructure.Configuration;
using BitroLearn.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace BitroLearn.Api.Tests;

public sealed class StorageFactAttribute : FactAttribute
{
    #region Explicit integration prerequisite
    public StorageFactAttribute()
    {
        if (Environment.GetEnvironmentVariable("BITRO_TEST_OBJECT_STORAGE") != "true") Skip = "Set BITRO_TEST_OBJECT_STORAGE=true and provide ffprobe to test real object storage.";
    }
    #endregion
}

public sealed class MediaStorageTests(PostgresFixture database) : IClassFixture<PostgresFixture>
{
    #region Real streaming upload and private range playback
    [StorageFact]
    public async Task Nonseekable_upload_validates_and_supports_private_range_playback()
    {
        // The standalone integration-test probe has a static libc resolver. Use a
        // literal local address; the production image uses the distro probe.
        var originalEndpoint = new Uri(AppConfigurationStatic.GetS3Endpoint());
        var address = (await System.Net.Dns.GetHostAddressesAsync(originalEndpoint.Host)).First(a => a.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork);
        var endpoint = new UriBuilder(originalEndpoint) { Host = address.ToString() }.Uri.ToString().TrimEnd('/');
        using var env = new EnvironmentScope(new Dictionary<string,string?> { [AppConfigurationStatic.StoragePublicEndpointKey] = endpoint,[AppConfigurationStatic.S3EndpointKey] = endpoint });
        await using var db = database.CreateContext();
        using var storage = new AmazonS3Client(new BasicAWSCredentials(AppConfigurationStatic.GetS3AccessKey(),AppConfigurationStatic.GetS3SecretKey()),new AmazonS3Config { ServiceURL = AppConfigurationStatic.GetS3Endpoint(),ForcePathStyle = true,AuthenticationRegion = "us-east-1" });
        var media = new MediaService(db,storage);
        var bytes = await File.ReadAllBytesAsync(Path.Combine(AppContext.BaseDirectory,"Fixtures","course-preview.mp4"));
        var response = System.Text.Json.JsonSerializer.SerializeToElement(await media.Begin(new("test.mp4",bytes.Length),CancellationToken.None));
        var id = response.GetProperty("Id").GetString()!;
        var asset = await db.VideoAssets.SingleAsync(v=>v.Id==id);
        try
        {
            using var body = new Nonseekable(bytes);
            await media.Upload(id,1,body,bytes.Length,CancellationToken.None);
            await media.Complete(id,CancellationToken.None,false);
            var diagnosticUrl = storage.GetPreSignedURL(new GetPreSignedUrlRequest { BucketName = AppConfigurationStatic.GetS3Bucket(),Key = asset.ObjectKey,Expires = DateTime.UtcNow.AddMinutes(5),Protocol = Protocol.HTTP });
            using var diagnosticClient = new HttpClient();
            using var diagnosticResponse = await diagnosticClient.GetAsync(diagnosticUrl);
            Assert.True(diagnosticResponse.IsSuccessStatusCode,$"Signed storage read returned {(int)diagnosticResponse.StatusCode}.");
            await media.Complete(id,CancellationToken.None);
            Assert.Equal("ready",asset.Status);
            var playback = await media.Playback(id,CancellationToken.None);
            var remaining=playback.ExpiresAt-DateTimeOffset.UtcNow;
            Assert.InRange(remaining.TotalSeconds,AppConfigurationStatic.GetMediaLinkLifetimeSeconds()-5,AppConfigurationStatic.GetMediaLinkLifetimeSeconds());
            using var client = new HttpClient();
            using var request = new HttpRequestMessage(HttpMethod.Get,playback.Url);
            request.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0,31);
            using var result = await client.SendAsync(request);
            Assert.Equal(System.Net.HttpStatusCode.PartialContent,result.StatusCode);
            Assert.Equal(bytes.Take(32),await result.Content.ReadAsByteArrayAsync());
            var unsigned = new UriBuilder(playback.Url) { Query = "" }.Uri;
            using var denied = await client.GetAsync(unsigned);
            Assert.False(denied.IsSuccessStatusCode);
        }
        finally
        {
            try { await storage.AbortMultipartUploadAsync(AppConfigurationStatic.GetS3Bucket(),asset.ObjectKey,asset.UploadId); } catch (AmazonS3Exception e) when (e.StatusCode == System.Net.HttpStatusCode.NotFound) { }
            await storage.DeleteObjectAsync(AppConfigurationStatic.GetS3Bucket(),asset.ObjectKey);
        }
    }
    private sealed class Nonseekable(byte[] data) : Stream
    {
        private readonly MemoryStream inner = new(data);
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer,int offset,int count) => inner.Read(buffer,offset,count);
        public override ValueTask<int> ReadAsync(Memory<byte> buffer,CancellationToken ct = default) => inner.ReadAsync(buffer,ct);
        public override void Flush() { }
        public override long Seek(long offset,SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer,int offset,int count) => throw new NotSupportedException();
        protected override void Dispose(bool disposing) { if(disposing)inner.Dispose();base.Dispose(disposing); }
    }
    #endregion
}
