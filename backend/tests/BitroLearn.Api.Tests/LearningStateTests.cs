using BitroLearn.Api.Data;
using BitroLearn.Api.Entities;
using BitroLearn.Api.Infrastructure.Authentication;
using BitroLearn.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;

namespace BitroLearn.Api.Tests;

public sealed class LearningStateTests(PostgresFixture fixture):IClassFixture<PostgresFixture>
{
    #region Real database setup
    private async Task<(string User,Lesson Lesson,ProjectTemplate Project,Challenge Challenge)> Setup(AppDbContext db,bool quiz=true)
    {
        var user=new AppUser {PhoneNumber="+989"+System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000,999999999)};
        var course=new Course {Slug=Guid.NewGuid().ToString("N"),Title="Learning",Status="published"};
        var module=new CourseModule {CourseId=course.Id,Title="Module"};
        var lesson=new Lesson {CourseId=course.Id,ModuleId=module.Id,Slug="lesson",Title="Lesson",Duration=1,HasQuiz=quiz,Question="Which?",ChoicesJson="[\"A\",\"B\"]",Answer=1,Explanation="B is correct",Status="published"};
        var project=new ProjectTemplate {CourseId=course.Id,Slug=Guid.NewGuid().ToString("N"),Title="Project",Duration=1,FilesJson="[{\"path\":\"Program.cs\",\"content\":\"original\"}]",Status="published"};
        var challenge=new Challenge {CourseId=course.Id,Slug=Guid.NewGuid().ToString("N"),Title="Challenge",Duration=1,Status="published",QuestionsJson="[{\"id\":\"q\",\"prompt\":\"Which?\",\"options\":[{\"id\":\"a\",\"label\":\"A\"},{\"id\":\"b\",\"label\":\"B\"}],\"correctOption\":\"b\",\"explanation\":\"B wins\"}]"};
        db.AddRange(user,course,module,lesson,project,challenge,new CourseEnrollment {UserId=user.Id,CourseId=course.Id});await db.SaveChangesAsync();return(user.Id,lesson,project,challenge);
    }
    private static AttemptRequest Answer(int version,string option,string? key=null,string question="lesson")=>new(version,key??Guid.NewGuid().ToString("N"),[new(question,option)]);
    #endregion
    #region Ownership, independent modes and optimistic writes
    [PostgresFact]
    public async Task Drafts_are_independent_owned_persistent_and_conflicting_writes_preserve_data()
    {
        await using var db=fixture.CreateContext();var data=await Setup(db);var service=new LearningService(db);
        var guided=await service.SaveDraft(data.User,data.Lesson.Id,"guided",new(0,"guided text"),default);
        await service.SaveDraft(data.User,data.Lesson.Id,"explore",new(0,"explore text"),default);
        await using var another=fixture.CreateContext();var reopened=new LearningService(another);
        Assert.Equal("guided text",(await reopened.Draft(data.User,data.Lesson.Id,"guided",default)).Code);
        Assert.Equal("explore text",(await reopened.Draft(data.User,data.Lesson.Id,"explore",default)).Code);
        Assert.Equal(guided,await service.SaveDraft(data.User,data.Lesson.Id,"guided",new(0,"guided text"),default));
        var conflict=await Assert.ThrowsAsync<ApiException>(()=>service.SaveDraft(data.User,data.Lesson.Id,"guided",new(0,"stale"),default));Assert.Equal(409,conflict.StatusCode);
        Assert.Equal(403,(await Assert.ThrowsAsync<ApiException>(()=>service.Draft("another-user",data.Lesson.Id,"guided",default))).StatusCode);
        Assert.Equal(2,await db.CodeDrafts.CountAsync(d=>d.UserId==data.User));
    }
    [PostgresFact]
    public async Task Progress_cannot_forge_completion_and_noquiz_completion_is_idempotent()
    {
        await using var db=fixture.CreateContext();var data=await Setup(db,false);var service=new LearningService(db);
        var progress=await service.SaveProgress(data.User,data.Lesson.Id,new(0,4,null),default);Assert.Null(progress.CompletedAt);
        var done=await service.Complete(data.User,data.Lesson.Id,new(data.Lesson.Version),default);
        var repeat=await service.Complete(data.User,data.Lesson.Id,new(data.Lesson.Version),default);
        Assert.Equal(done.CompletedAt,repeat.CompletedAt);Assert.Equal(1,await db.UserProgress.CountAsync(p=>p.UserId==data.User));
        Assert.Equal(409,(await Assert.ThrowsAsync<ApiException>(()=>service.SaveProgress(data.User,data.Lesson.Id,new(progress.Version,1,null),default))).StatusCode);
        var summary=await service.CourseProgress(data.User,data.Lesson.CourseId,default);Assert.NotNull(Assert.Single(summary.Lessons).CompletedAt);
    }
    [PostgresFact]
    public async Task Workspace_survives_template_changes_and_rejects_stale_or_unsafe_files()
    {
        await using var db=fixture.CreateContext();var data=await Setup(db);var service=new LearningService(db);
        var original=await service.Workspace(data.User,data.Project.Id,default);Assert.Equal(0,original.Version);
        var saved=await service.SaveWorkspace(data.User,data.Project.Id,new(0,[new("Program.cs","my code")],"Program.cs",2),default);
        data.Project.FilesJson="[{\"path\":\"New.cs\",\"content\":\"new\"}]";await db.SaveChangesAsync();
        var restored=await service.Workspace(data.User,data.Project.Id,default);Assert.Equal("my code",Assert.Single(restored.Files).Content);Assert.True(restored.CurrentTemplateVersion>restored.TemplateVersion);
        Assert.Equal(409,(await Assert.ThrowsAsync<ApiException>(()=>service.SaveWorkspace(data.User,data.Project.Id,new(0,[new("Program.cs","stale")],"Program.cs",0),default))).StatusCode);
        Assert.Throws<ApiException>(()=>LearningService.ValidateFiles([new("../secret.txt","x")],null,0));
        Assert.Throws<ApiException>(()=>LearningService.ValidateFiles([new("A.cs","x"),new("a.cs","y")],null,0));
    }
    #endregion
    #region Server grading, atomic completion and question revisions
    [PostgresFact]
    public async Task Only_correct_server_grade_completes_and_retries_replay_the_original_result()
    {
        await using var db=fixture.CreateContext();var data=await Setup(db);var learning=new LearningService(db);var grading=new AssessmentService(db,learning);
        Assert.Equal(409,(await Assert.ThrowsAsync<ApiException>(()=>learning.Complete(data.User,data.Lesson.Id,new(1),default))).StatusCode);
        Assert.False((await grading.Submit(data.User,data.Lesson.Id,true,Answer(1,"0"),default)).IsPassed);
        Assert.Null((await learning.Progress(data.User,data.Lesson.Id,default)).CompletedAt);
        var request=Answer(1,"1");var success=await grading.Submit(data.User,data.Lesson.Id,true,request,default);
        Assert.True(success.IsPassed);var completed=(await learning.Progress(data.User,data.Lesson.Id,default)).CompletedAt;Assert.NotNull(completed);
        data.Lesson.Answer=0;await db.SaveChangesAsync();
        var replay=await grading.Submit(data.User,data.Lesson.Id,true,request,default);
        Assert.Equal(System.Text.Json.JsonSerializer.Serialize(success),System.Text.Json.JsonSerializer.Serialize(replay));
        Assert.Equal(409,(await Assert.ThrowsAsync<ApiException>(()=>grading.Submit(data.User,data.Lesson.Id,true,Answer(1,"1"),default))).StatusCode);
        Assert.False((await grading.Submit(data.User,data.Lesson.Id,true,Answer(data.Lesson.Version,"1"),default)).IsPassed);
        Assert.Equal(completed,(await learning.Progress(data.User,data.Lesson.Id,default)).CompletedAt);
        Assert.Equal(409,(await Assert.ThrowsAsync<ApiException>(()=>grading.Submit(data.User,data.Lesson.Id,true,request with {Answers=[new("lesson","0")]},default))).StatusCode);
        Assert.Equal(3,await db.QuizAttempts.CountAsync(a=>a.UserId==data.User));
    }
    [PostgresFact]
    public async Task Concurrent_same_attempt_has_one_record_and_one_completion()
    {
        await using var db=fixture.CreateContext();var data=await Setup(db);var request=Answer(1,"1");
        async Task<AttemptDto> Send(){await using var scoped=fixture.CreateContext();return await new AssessmentService(scoped,new(scoped)).Submit(data.User,data.Lesson.Id,true,request,default);}
        var results=await Task.WhenAll(Send(),Send());Assert.Equal(results[0].Id,results[1].Id);
        Assert.Equal(1,await db.QuizAttempts.CountAsync(a=>a.UserId==data.User));Assert.Equal(1,await db.UserProgress.CountAsync(p=>p.UserId==data.User));
    }
    [PostgresFact]
    public async Task Challenge_success_is_derived_from_attempts_and_invalid_options_are_not_recorded()
    {
        await using var db=fixture.CreateContext();var data=await Setup(db);var learning=new LearningService(db);var grading=new AssessmentService(db,learning);
        Assert.Equal(400,(await Assert.ThrowsAsync<ApiException>(()=>grading.Submit(data.User,data.Challenge.Id,false,Answer(1,"unknown",question:"q"),default))).StatusCode);
        Assert.True((await grading.Submit(data.User,data.Challenge.Id,false,Answer(1,"b",question:"q"),default)).IsPassed);
        data.Challenge.QuestionsJson=data.Challenge.QuestionsJson.Replace("\"correctOption\":\"b\"","\"correctOption\":\"a\"");await db.SaveChangesAsync();
        Assert.Contains(data.Challenge.Id,(await learning.CourseProgress(data.User,data.Lesson.CourseId,default)).CompletedChallengeIds);
        Assert.Empty(await grading.History("another-user",1,default));Assert.Single(await grading.History(data.User,1,default));
    }
    [Fact]
    public void Invalid_assessment_definitions_cannot_be_published()
    {
        Assert.Throws<ApiException>(()=>AssessmentService.ValidateLesson(new Lesson {HasQuiz=true,ChoicesJson="[]"}));
        Assert.Throws<ApiException>(()=>AssessmentService.ValidateChallenge("[{\"id\":\"x\",\"prompt\":\"x\",\"options\":[{\"id\":\"a\",\"label\":\"A\"},{\"id\":\"a\",\"label\":\"A\"}],\"correctOption\":\"a\"}]"));
    }
    [PostgresFact]
    public async Task Question_edit_between_read_and_insert_is_rejected_without_partial_completion()
    {
        await using var setup=fixture.CreateContext();var data=await Setup(setup);
        var fence=new EditDuringSubmission(async()=>{await using var editor=fixture.CreateContext();await editor.Lessons.Where(l=>l.Id==data.Lesson.Id).ExecuteUpdateAsync(s=>s.SetProperty(l=>l.Version,l=>l.Version+1).SetProperty(l=>l.Answer,0));});
        await using var db=new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(fixture.ConnectionString).AddInterceptors(fence).Options);
        var service=new AssessmentService(db,new(db));
        Assert.Equal(409,(await Assert.ThrowsAsync<ApiException>(()=>service.Submit(data.User,data.Lesson.Id,true,Answer(1,"1"),default))).StatusCode);
        Assert.False(await setup.QuizAttempts.AnyAsync(a=>a.UserId==data.User));Assert.False(await setup.UserProgress.AnyAsync(p=>p.UserId==data.User));
    }
    private sealed class EditDuringSubmission(Func<Task> edit):DbCommandInterceptor
    {
        private bool edited;
        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,CommandEventData eventData,InterceptionResult<DbDataReader> result,CancellationToken cancellationToken=default)
        {
            if(!edited && command.CommandText.Contains("WITH eligible AS")){edited=true;await edit();}
            return result;
        }
    }
    #endregion
}
