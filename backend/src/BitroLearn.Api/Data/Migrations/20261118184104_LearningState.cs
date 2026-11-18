using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BitroLearn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class LearningState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ActiveFile",
                table: "UserProjects",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Checkpoint",
                table: "UserProjects",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TemplateVersion",
                table: "UserProjects",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<double>(
                name: "VideoPositionSeconds",
                table: "UserProgress",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ContentVersion",
                table: "QuizAttempts",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "FeedbackJson",
                table: "QuizAttempts",
                type: "jsonb",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "IdempotencyKey",
                table: "QuizAttempts",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequestHash",
                table: "QuizAttempts",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProjects_Checkpoint",
                table: "UserProjects",
                sql: "\"Checkpoint\" >= 0 AND \"TemplateVersion\" >= 1");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProgress_VideoPosition",
                table: "UserProgress",
                sql: "\"VideoPositionSeconds\" IS NULL OR (\"VideoPositionSeconds\" >= 0 AND \"VideoPositionSeconds\" < 'Infinity'::float8)");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttempts_UserId_ChallengeId_IsPassed",
                table: "QuizAttempts",
                columns: new[] { "UserId", "ChallengeId", "IsPassed" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttempts_UserId_IdempotencyKey",
                table: "QuizAttempts",
                columns: new[] { "UserId", "IdempotencyKey" },
                unique: true,
                filter: "\"IdempotencyKey\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProjects_Checkpoint",
                table: "UserProjects");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProgress_VideoPosition",
                table: "UserProgress");

            migrationBuilder.DropIndex(
                name: "IX_QuizAttempts_UserId_ChallengeId_IsPassed",
                table: "QuizAttempts");

            migrationBuilder.DropIndex(
                name: "IX_QuizAttempts_UserId_IdempotencyKey",
                table: "QuizAttempts");

            migrationBuilder.DropColumn(
                name: "ActiveFile",
                table: "UserProjects");

            migrationBuilder.DropColumn(
                name: "Checkpoint",
                table: "UserProjects");

            migrationBuilder.DropColumn(
                name: "TemplateVersion",
                table: "UserProjects");

            migrationBuilder.DropColumn(
                name: "VideoPositionSeconds",
                table: "UserProgress");

            migrationBuilder.DropColumn(
                name: "ContentVersion",
                table: "QuizAttempts");

            migrationBuilder.DropColumn(
                name: "FeedbackJson",
                table: "QuizAttempts");

            migrationBuilder.DropColumn(
                name: "IdempotencyKey",
                table: "QuizAttempts");

            migrationBuilder.DropColumn(
                name: "RequestHash",
                table: "QuizAttempts");
        }
    }
}
