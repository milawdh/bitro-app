using System.Security.Claims;
using BitroLearn.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace BitroLearn.Api.Controllers.App;

[Route("app/")]
[ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
public sealed class LearningStateController(LearningService learning,AssessmentService assessments):AppAreaController
{
    #region Account-owned state
    private string UserId=>User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    [HttpGet("courses/{id}/progress")]
    public Task<CourseProgressDto> Course(string id,CancellationToken ct)=>learning.CourseProgress(UserId,id,ct);
    [HttpGet("lessons/{id}/progress")]
    public Task<ProgressDto> Progress(string id,CancellationToken ct)=>learning.Progress(UserId,id,ct);
    [HttpPut("lessons/{id}/progress")]
    public Task<ProgressDto> SaveProgress(string id,ProgressRequest request,CancellationToken ct)=>learning.SaveProgress(UserId,id,request,ct);
    [HttpPost("lessons/{id}/complete")]
    public Task<ProgressDto> Complete(string id,CompleteLessonRequest request,CancellationToken ct)=>learning.Complete(UserId,id,request,ct);
    [HttpGet("lessons/{id}/drafts/{mode}")]
    public Task<DraftDto> Draft(string id,string mode,CancellationToken ct)=>learning.Draft(UserId,id,mode,ct);
    [HttpPut("lessons/{id}/drafts/{mode}")]
    public Task<DraftDto> SaveDraft(string id,string mode,DraftRequest request,CancellationToken ct)=>learning.SaveDraft(UserId,id,mode,request,ct);
    [HttpGet("project-templates/{id}/workspace")]
    public Task<WorkspaceDto> Workspace(string id,CancellationToken ct)=>learning.Workspace(UserId,id,ct);
    [HttpPut("project-templates/{id}/workspace")]
    public Task<WorkspaceDto> SaveWorkspace(string id,WorkspaceRequest request,CancellationToken ct)=>learning.SaveWorkspace(UserId,id,request,ct);
    #endregion
    #region Server assessments
    [HttpPost("lessons/{id}/attempts")]
    public Task<AttemptDto> LessonAttempt(string id,AttemptRequest request,CancellationToken ct)=>assessments.Submit(UserId,id,true,request,ct);
    [HttpPost("challenges/{id}/attempts")]
    public Task<AttemptDto> ChallengeAttempt(string id,AttemptRequest request,CancellationToken ct)=>assessments.Submit(UserId,id,false,request,ct);
    [HttpGet("quiz-attempts")]
    public Task<AttemptDto[]> History(CancellationToken ct,int page=1)=>assessments.History(UserId,page,ct);
    #endregion
}
