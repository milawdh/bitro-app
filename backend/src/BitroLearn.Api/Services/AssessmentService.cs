using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BitroLearn.Api.Data;
using BitroLearn.Api.Entities;
using Microsoft.EntityFrameworkCore;
using static BitroLearn.Api.Services.CourseContracts;

namespace BitroLearn.Api.Services;

public sealed class AssessmentService(AppDbContext db,LearningService learning)
{
    #region Assessment definitions and validation
    public static void ValidateLesson(Lesson lesson)
    {
        if(!lesson.HasQuiz)return;
        var choices=Json(lesson.ChoicesJson);
        Require(choices.ValueKind==JsonValueKind.Array && choices.GetArrayLength()>=2 && choices.EnumerateArray().All(c=>c.ValueKind==JsonValueKind.String && !string.IsNullOrWhiteSpace(c.GetString())) && lesson.Answer>=0 && lesson.Answer<choices.GetArrayLength() && !string.IsNullOrWhiteSpace(lesson.Question),"Invalid lesson assessment.");
    }
    public static void ValidateChallenge(string json)
    {
        var questions=Json(json);Require(questions.ValueKind==JsonValueKind.Array && questions.GetArrayLength()>0,"Challenge requires questions.");
        var ids=new HashSet<string>();
        foreach(var q in questions.EnumerateArray())
        {
            Require(q.ValueKind==JsonValueKind.Object && q.TryGetProperty("id",out var id) && id.ValueKind==JsonValueKind.String && !string.IsNullOrWhiteSpace(id.GetString()) && ids.Add(id.GetString()!),"Invalid or duplicate question id.");
            Require(q.TryGetProperty("prompt",out var prompt) && prompt.ValueKind==JsonValueKind.String && !string.IsNullOrWhiteSpace(prompt.GetString()),"Question prompt required.");
            Require(q.TryGetProperty("options",out var options) && options.ValueKind==JsonValueKind.Array && options.GetArrayLength()>=2,"Question options required.");
            var optionIds=new HashSet<string>();
            foreach(var option in options.EnumerateArray()) Require(option.ValueKind==JsonValueKind.Object && option.TryGetProperty("id",out var oid) && oid.ValueKind==JsonValueKind.String && !string.IsNullOrWhiteSpace(oid.GetString()) && optionIds.Add(oid.GetString()!) && option.TryGetProperty("label",out var label) && label.ValueKind==JsonValueKind.String,"Invalid or duplicate option.");
            Require(q.TryGetProperty("correctOption",out var correct) && correct.ValueKind==JsonValueKind.String && optionIds.Contains(correct.GetString()!),"Correct option is missing.");
        }
    }
    private sealed record Question(string Id,string[] Options,string Answer,string Explanation);
    private static readonly JsonSerializerOptions Web=new(JsonSerializerDefaults.Web);
    private static AttemptDto Dto(QuizAttempt a)=>new(a.Id,a.LessonId,a.ChallengeId,a.ContentVersion,a.IsPassed,a.CorrectCount,a.TotalCount,JsonSerializer.Deserialize<QuestionFeedback[]>(a.FeedbackJson,Web)!,a.CreatedAt);
    #endregion

    #region Authoritative grading and replay
    public async Task<AttemptDto> Submit(string user,string id,bool isLesson,AttemptRequest request,CancellationToken ct)
    {
        Require(request.ContentVersion>0 && !string.IsNullOrWhiteSpace(request.IdempotencyKey) && request.IdempotencyKey.Length<=160 && request.Answers is not null && request.Answers.All(a=>a is not null && a.QuestionId is not null && a.OptionId is not null) && request.Answers.Select(a=>a.QuestionId).Distinct().Count()==request.Answers.Length,"Invalid assessment submission.");
        var canonical=JsonSerializer.Serialize(new {id,isLesson,request.ContentVersion,answers=request.Answers.OrderBy(a=>a.QuestionId,StringComparer.Ordinal)},Web);
        var hash=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
        var previous=await db.QuizAttempts.AsNoTracking().SingleOrDefaultAsync(a=>a.UserId==user && a.IdempotencyKey==request.IdempotencyKey,ct);
        if(previous is not null){Require(previous.RequestHash==hash,"Idempotency key belongs to a different submission.",409);return Dto(previous);}
        ContentEntity content;Question[] questions;
        if(isLesson)
        {
            var lesson=await learning.Lesson(user,id,ct);Require(lesson.HasQuiz,"Lesson has no assessment.",409);ValidateLesson(lesson);content=lesson;
            questions=[new("lesson",Json(lesson.ChoicesJson).EnumerateArray().Select((_,i)=>i.ToString(System.Globalization.CultureInfo.InvariantCulture)).ToArray(),lesson.Answer.ToString(System.Globalization.CultureInfo.InvariantCulture),lesson.Explanation)];
        }
        else
        {
            var challenge=await db.Challenges.AsNoTracking().SingleOrDefaultAsync(c=>c.Id==id && c.Status=="published",ct);
            Require(challenge is not null,"Challenge unavailable.",404);await learning.Enrollment(user,challenge!.CourseId,ct);ValidateChallenge(challenge.QuestionsJson);content=challenge;
            questions=Json(challenge.QuestionsJson).EnumerateArray().Select(q=>new Question(q.GetProperty("id").GetString()!,q.GetProperty("options").EnumerateArray().Select(o=>o.GetProperty("id").GetString()!).ToArray(),q.GetProperty("correctOption").GetString()!,q.TryGetProperty("explanation",out var e)?e.GetString()??"":"")).ToArray();
        }
        Require(content.Version==request.ContentVersion,"Assessment changed; reload before submitting.",409);
        Require(request.Answers.Length==questions.Length && request.Answers.All(a=>questions.Any(q=>q.Id==a.QuestionId && q.Options.Contains(a.OptionId))),"Answer every question using a valid option.");
        var feedback=questions.Select(q=>new QuestionFeedback(q.Id,request.Answers.Single(a=>a.QuestionId==q.Id).OptionId==q.Answer,q.Explanation)).ToArray();
        var correct=feedback.Count(f=>f.Correct);var passed=correct==questions.Length;
        var attemptId=Guid.NewGuid().ToString("N");string? lessonId=isLesson?id:null;string? challengeId=isLesson?null:id;
        var answers=JsonSerializer.Serialize(request.Answers,Web);var results=JsonSerializer.Serialize(feedback,Web);
        var inserted=await db.Database.SqlQuery<int>($"""
            WITH eligible AS (
                SELECT l."Id" FROM "Lessons" l JOIN "Courses" c ON c."Id"=l."CourseId"
                WHERE {isLesson} AND l."Id"={id} AND l."Version"={request.ContentVersion} AND l."HasQuiz" AND l."Delivery"='onsite' AND l."Status"='published' AND c."Status"='published'
                AND EXISTS (SELECT 1 FROM "CourseEnrollments" e WHERE e."UserId"={user} AND e."CourseId"=c."Id")
                UNION ALL
                SELECT q."Id" FROM "Challenges" q JOIN "Courses" c ON c."Id"=q."CourseId"
                WHERE NOT {isLesson} AND q."Id"={id} AND q."Version"={request.ContentVersion} AND q."Status"='published' AND c."Status"='published'
                AND EXISTS (SELECT 1 FROM "CourseEnrollments" e WHERE e."UserId"={user} AND e."CourseId"=c."Id")
            ), inserted AS (
                INSERT INTO "QuizAttempts" ("Id","Version","CreatedAt","UpdatedAt","UserId","LessonId","ChallengeId","AnswersJson","IsPassed","CorrectCount","TotalCount","IdempotencyKey","RequestHash","ContentVersion","FeedbackJson")
                SELECT {attemptId},1,now(),now(),{user},{lessonId},{challengeId},{answers}::jsonb,{passed},{correct},{questions.Length},{request.IdempotencyKey},{hash},{request.ContentVersion},{results}::jsonb FROM eligible
                ON CONFLICT ("UserId","IdempotencyKey") WHERE "IdempotencyKey" IS NOT NULL DO NOTHING RETURNING "Id"
            ), completed AS (
                INSERT INTO "UserProgress" ("Id","Version","CreatedAt","UpdatedAt","UserId","LessonId","Step","CompletedAt")
                SELECT {Guid.NewGuid().ToString("N")},1,now(),now(),{user},{id},4,now() FROM inserted WHERE {isLesson} AND {passed}
                ON CONFLICT ("UserId","LessonId") DO UPDATE SET "CompletedAt"=COALESCE("UserProgress"."CompletedAt",now()),"Version"="UserProgress"."Version"+1,"UpdatedAt"=now()
            ) SELECT count(*)::int AS "Value" FROM inserted
            """).ToListAsync(ct);
        if(inserted.Single()==0)
        {
            previous=await db.QuizAttempts.AsNoTracking().SingleOrDefaultAsync(a=>a.UserId==user && a.IdempotencyKey==request.IdempotencyKey,ct);
            Require(previous is not null && previous.RequestHash==hash,"Assessment changed or submission conflicts; reload.",409);return Dto(previous!);
        }
        return Dto(await db.QuizAttempts.AsNoTracking().SingleAsync(a=>a.Id==attemptId,ct));
    }
    public async Task<AttemptDto[]> History(string user,int page,CancellationToken ct)=>(await db.QuizAttempts.AsNoTracking().Where(a=>a.UserId==user).OrderByDescending(a=>a.CreatedAt).ThenBy(a=>a.Id).Skip((Math.Clamp(page,1,10000)-1)*20).Take(20).ToArrayAsync(ct)).Select(Dto).ToArray();
    #endregion
}
