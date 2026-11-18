using System.Diagnostics;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using BitroLearn.Api.Data;
using BitroLearn.Api.Entities;
using BitroLearn.Api.Infrastructure.Configuration;
using Microsoft.EntityFrameworkCore;
using static BitroLearn.Api.Services.CourseContracts;

namespace BitroLearn.Api.Services;

public sealed class MediaService(AppDbContext db,IAmazonS3 storage)
{
    #region Multipart upload
    private static string Bucket => AppConfigurationStatic.GetS3Bucket();
    public static long PartSize(long size) => Math.Max(16L*1024*1024,(size-1)/9999+1);
    public async Task<object> Begin(VideoUploadRequest request,CancellationToken ct)
    {
        Require(request.TotalBytes > 0 && !string.IsNullOrWhiteSpace(request.FileName),"Video file required.");
        await EnsureBucket(ct);
        var asset = new VideoAsset { FileName = Path.GetFileName(request.FileName),TotalBytes = request.TotalBytes,PartBytes = PartSize(request.TotalBytes),ObjectKey = "videos/" + Guid.NewGuid().ToString("N") + ".mp4" };
        var response = await storage.InitiateMultipartUploadAsync(new InitiateMultipartUploadRequest { BucketName = Bucket,Key = asset.ObjectKey,ContentType = "video/mp4" },ct);
        asset.UploadId = response.UploadId; db.VideoAssets.Add(asset); await db.SaveChangesAsync(ct);
        return new { asset.Id,asset.Status,asset.TotalBytes,asset.PartBytes };
    }
    public async Task<object> Parts(string id,CancellationToken ct)
    {
        var asset = await Find(id,ct); var parts = asset.Status == "uploading" ? await ReadParts(asset,ct) : [];
        return new { asset.Id,asset.Status,asset.TotalBytes,asset.PartBytes,asset.Error,parts = parts.Select(p => new { p.PartNumber,p.Size,p.ETag }) };
    }
    private async Task<List<PartDetail>> ReadParts(VideoAsset asset,CancellationToken ct)
    {
        var result = new List<PartDetail>(); int marker = 0;
        while (true)
        {
            var response = await storage.ListPartsAsync(new ListPartsRequest { BucketName = Bucket,Key = asset.ObjectKey,UploadId = asset.UploadId,PartNumberMarker = marker.ToString() },ct);
            result.AddRange(response.Parts); if (!response.IsTruncated) return result; marker = response.NextPartNumberMarker;
        }
    }
    public async Task Upload(string id,int number,Stream stream,long? length,CancellationToken ct)
    {
        var a = await Find(id,ct); Require(a.Status == "uploading","Upload not open.",409);
        var count = (a.TotalBytes-1)/a.PartBytes+1;
        Require(number >= 1 && number <= count,"Invalid part number.");
        var expected = number == count ? a.TotalBytes-(number-1)*a.PartBytes : a.PartBytes;
        Require(length == expected,"Part length differs from upload contract.");
        // SDK v3 PartialWrapperStream requires seeking. Stage only this part on disk;
        // never buffer a video (or an adaptive-sized part) in application memory.
        var temporary = Path.GetTempFileName();
        try
        {
            await using var part = new FileStream(temporary,FileMode.Open,FileAccess.ReadWrite,FileShare.None,65536,FileOptions.Asynchronous | FileOptions.DeleteOnClose);
            var buffer = new byte[65536]; long received = 0; int read;
            while ((read = await stream.ReadAsync(buffer,ct)) > 0)
            {
                received += read; Require(received <= expected,"Part exceeds expected length.");
                await part.WriteAsync(buffer.AsMemory(0,read),ct);
            }
            Require(received == expected,"Incomplete upload part.");
            await part.FlushAsync(ct); part.Position = 0;
            await storage.UploadPartAsync(new UploadPartRequest { BucketName = Bucket,Key = a.ObjectKey,UploadId = a.UploadId,PartNumber = number,InputStream = part,PartSize = expected,UseChunkEncoding = false },ct);
        }
        finally { File.Delete(temporary); }
        await db.VideoAssets.Where(v => v.Id == id).ExecuteUpdateAsync(s => s.SetProperty(v => v.UpdatedAt,DateTimeOffset.UtcNow),ct);
    }
    public async Task Complete(string id,CancellationToken ct,bool validate = true)
    {
        var a = await Find(id,ct); if (a.Status == "ready") return;
        Require(a.Status is "uploading" or "validating" or "processing" or "failed","Upload cannot be completed.",409);
        // Unique object keys make completed-object recovery safe after a lost response.
        var exists = false;
        try { exists = (await storage.GetObjectMetadataAsync(Bucket,a.ObjectKey,ct)).ContentLength == a.TotalBytes; }
        catch (AmazonS3Exception e) when (e.StatusCode == System.Net.HttpStatusCode.NotFound) { }
        if (!exists)
        {
            Require(!string.IsNullOrWhiteSpace(a.UploadId),"Original video object no longer exists.");
            var parts = await ReadParts(a,ct);
            var count = (a.TotalBytes-1)/a.PartBytes+1;
            Require(parts.Count == count && parts.Sum(p => p.Size) == a.TotalBytes && parts.OrderBy(p => p.PartNumber).Select(p => p.PartNumber).SequenceEqual(Enumerable.Range(1,checked((int)count))),"Missing or invalid parts.");
            await storage.CompleteMultipartUploadAsync(new CompleteMultipartUploadRequest { BucketName = Bucket,Key = a.ObjectKey,UploadId = a.UploadId,PartETags = parts.Select(p => new PartETag(p.PartNumber,p.ETag)).ToList() },ct);
        }
        Require(validate || a.Status != "processing","Video validation already in progress.",409);
        a.Status = validate ? "processing" : "validating"; await db.SaveChangesAsync(ct);
        if (!validate) return;
        try
        {
            var metadata = await storage.GetObjectMetadataAsync(Bucket,a.ObjectKey,ct); Require(metadata.ContentLength == a.TotalBytes,"Video size mismatch.");
            var url = storage.GetPreSignedURL(new GetPreSignedUrlRequest { BucketName = Bucket,Key = a.ObjectKey,Expires = DateTime.UtcNow.AddMinutes(10),Protocol = new Uri(AppConfigurationStatic.GetS3Endpoint()).Scheme == "http" ? Protocol.HTTP : Protocol.HTTPS });
            using var process = new Process { StartInfo = new ProcessStartInfo("ffprobe") { RedirectStandardOutput = true,RedirectStandardError = true,UseShellExecute = false,CreateNoWindow = true } };
            foreach (var arg in new[] { "-v","error","-show_entries","format=format_name:stream=codec_type,codec_name","-of","json",url }) process.StartInfo.ArgumentList.Add(arg);
            process.Start();
            var output = process.StandardOutput.ReadToEndAsync(ct); var errors = process.StandardError.ReadToEndAsync(ct);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromMinutes(2));
            try { await process.WaitForExitAsync(timeout.Token); }
            catch { process.Kill(true); throw; }
            var outputText = await output; var errorText = await errors;
            if (process.ExitCode != 0 || string.IsNullOrWhiteSpace(outputText))
            {
                var safeError = System.Text.RegularExpressions.Regex.Replace(errorText,@"https?://\S+","[redacted media URL]");
                throw new Infrastructure.Authentication.ApiException(400,"Video inspection failed.",safeError[..Math.Min(safeError.Length,500)]);
            }
            var json = Json(outputText);
            Require(process.ExitCode == 0 && json.GetProperty("format").GetProperty("format_name").GetString()!.Contains("mp4") && json.GetProperty("streams").EnumerateArray().Any(s => s.GetProperty("codec_type").GetString() == "video" && s.GetProperty("codec_name").GetString() == "h264") && json.GetProperty("streams").EnumerateArray().Where(s => s.GetProperty("codec_type").GetString() == "audio").All(s => s.GetProperty("codec_name").GetString() is "aac" or "mp3"),"Expected browser-compatible MP4/H.264 video and AAC/MP3 audio.");
            a.Status = "ready"; a.Error = null;
        }
        catch { a.Status = "failed"; a.Error = "Media validation failed; inspect the file and retry."; await db.SaveChangesAsync(CancellationToken.None); throw; }
        await db.SaveChangesAsync(ct);
    }
    public async Task Abort(string id,CancellationToken ct)
    {
        var a = await Find(id,ct); Require(a.Status == "uploading","Only open uploads can be aborted.",409);
        await storage.AbortMultipartUploadAsync(Bucket,a.ObjectKey,a.UploadId,ct); a.Status = "aborted"; await db.SaveChangesAsync(ct);
    }
    #endregion
    #region Private playback
    private async Task EnsureBucket(CancellationToken ct)
    {
        try { await storage.GetBucketLocationAsync(new GetBucketLocationRequest { BucketName = Bucket },ct); }
        catch (AmazonS3Exception e) when (e.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            try { await storage.PutBucketAsync(new PutBucketRequest { BucketName = Bucket },ct); }
            catch (AmazonS3Exception conflict) when (conflict.ErrorCode is "BucketAlreadyOwnedByYou" or "BucketAlreadyExists") { }
        }
    }
    public async Task<string> Image(Stream source,string adminId,CancellationToken ct)
    {
        var temp = Path.GetTempFileName();
        try
        {
            await using (var output = File.OpenWrite(temp))
            {
                var buffer = new byte[65536]; long total = 0; int read;
                while ((read = await source.ReadAsync(buffer,ct)) > 0) { total += read; Require(total <= 10*1024*1024,"Cover image exceeds 10 MiB."); await output.WriteAsync(buffer.AsMemory(0,read),ct); }
                Require(total > 0,"Image required.");
            }
            using var probe = new Process { StartInfo = new ProcessStartInfo("ffprobe") { RedirectStandardOutput = true,RedirectStandardError = true,UseShellExecute = false,CreateNoWindow = true } };
            foreach (var arg in new[] { "-v","error","-show_entries","stream=codec_name,width,height","-of","json",temp }) probe.StartInfo.ArgumentList.Add(arg);
            probe.Start(); var outputTask = probe.StandardOutput.ReadToEndAsync(ct); var errorTask = probe.StandardError.ReadToEndAsync(ct);
            await probe.WaitForExitAsync(ct); var result = Json(await outputTask); await errorTask;
            Require(probe.ExitCode == 0 && result.TryGetProperty("streams",out var streams) && streams.GetArrayLength() == 1,"Invalid image.");
            var stream = result.GetProperty("streams")[0]; var codec = stream.GetProperty("codec_name").GetString();
            Require(new[] { "png","mjpeg","webp" }.Contains(codec) && stream.GetProperty("width").GetInt32() is > 0 and <= 8192 && stream.GetProperty("height").GetInt32() is > 0 and <= 8192,"Unsupported image or dimensions.");
            var file = new StoredFile { UploadedByAdminId = adminId,ObjectKey = "covers/"+Guid.NewGuid().ToString("N"),Bucket = Bucket,FileName = "cover",Size = new FileInfo(temp).Length,ContentType = codec == "mjpeg" ? "image/jpeg" : "image/"+codec };
            await EnsureBucket(ct);
            await storage.PutObjectAsync(new PutObjectRequest { BucketName = Bucket,Key = file.ObjectKey,FilePath = temp,ContentType = file.ContentType },ct);
            db.StoredFiles.Add(file); await db.SaveChangesAsync(ct); return file.Id;
        }
        finally { File.Delete(temp); }
    }
    public async Task<PlaybackDto> Cover(string fileId,CancellationToken ct)
    {
        var file = await db.StoredFiles.SingleOrDefaultAsync(f => f.Id == fileId && f.ContentType.StartsWith("image/") && f.UploadedByAdminId != null,ct);
        Require(file is not null,"Cover not found.",404); await storage.GetObjectMetadataAsync(Bucket,file!.ObjectKey,ct); return Signed(file.ObjectKey);
    }
    public async Task<object> Register(string objectKey,CancellationToken ct)
    {
        Require(objectKey.StartsWith("videos/",StringComparison.Ordinal),"Video must belong to managed video prefix.");
        var metadata = await storage.GetObjectMetadataAsync(Bucket,objectKey,ct);
        var video = new VideoAsset { ObjectKey = objectKey,FileName = Path.GetFileName(objectKey),TotalBytes = metadata.ContentLength,Status = "validating" };
        db.VideoAssets.Add(video); await db.SaveChangesAsync(ct); return new { video.Id,video.Status };
    }
    public async Task<PlaybackDto> Playback(string id,CancellationToken ct)
    {
        var a = await Find(id,ct); await ValidateReference(id,ct);
        return Signed(a.ObjectKey);
    }
    public async Task ValidateReference(string id,CancellationToken ct)
    {
        var asset = await Find(id,ct); Require(asset.Status == "ready","Video is not ready.",409);
        var metadata = await storage.GetObjectMetadataAsync(Bucket,asset.ObjectKey,ct);
        Require(metadata.ContentLength == asset.TotalBytes,"Video object has changed.",409);
    }
    private static PlaybackDto Signed(string objectKey)
    {
        var endpoint = AppConfigurationStatic.StoragePublicEndpointKey.ReadEnv(); Require(endpoint is not null,"Public storage endpoint not configured.",503);
        using var signer = new AmazonS3Client(new BasicAWSCredentials(AppConfigurationStatic.GetS3AccessKey(),AppConfigurationStatic.GetS3SecretKey()),new AmazonS3Config { ServiceURL = endpoint,ForcePathStyle = true,AuthenticationRegion = "us-east-1" });
        var expiry = DateTimeOffset.UtcNow.AddSeconds(AppConfigurationStatic.GetMediaLinkLifetimeSeconds());
        return new(signer.GetPreSignedURL(new GetPreSignedUrlRequest { BucketName = Bucket,Key = objectKey,Expires = expiry.UtcDateTime,Protocol = new Uri(endpoint!).Scheme == "http" ? Protocol.HTTP : Protocol.HTTPS }),expiry);
    }
    private async Task<VideoAsset> Find(string id,CancellationToken ct) => await db.VideoAssets.SingleOrDefaultAsync(v => v.Id == id,ct) ?? throw new Infrastructure.Authentication.ApiException(404,"Video not found.");
    #endregion
}
