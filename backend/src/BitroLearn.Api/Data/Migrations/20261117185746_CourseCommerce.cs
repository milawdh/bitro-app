using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BitroLearn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CourseCommerce : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Lessons_Answer",
                table: "Lessons");

            migrationBuilder.AddColumn<string>(
                name: "AnimationsJson",
                table: "Lessons",
                type: "jsonb",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "Delivery",
                table: "Lessons",
                type: "text",
                nullable: false,
                defaultValue: "onsite");

            migrationBuilder.AddColumn<bool>(
                name: "HasQuiz",
                table: "Lessons",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "VideoId",
                table: "Lessons",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AnimationsJson",
                table: "Courses",
                type: "jsonb",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "CommerceType",
                table: "Courses",
                type: "text",
                nullable: false,
                defaultValue: "free");

            migrationBuilder.AddColumn<string>(
                name: "CoverFileId",
                table: "Courses",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CoverKind",
                table: "Courses",
                type: "text",
                nullable: false,
                defaultValue: "preset");

            migrationBuilder.AddColumn<string>(
                name: "CoverPresetKey",
                table: "Courses",
                type: "text",
                nullable: false,
                defaultValue: "code");

            migrationBuilder.AddColumn<string>(
                name: "IntroVideoId",
                table: "Courses",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "PriceRial",
                table: "Courses",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "SpotPlayerCourseId",
                table: "Courses",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CourseEnrollments",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    UserId = table.Column<string>(type: "character varying(160)", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(160)", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseEnrollments", x => x.Id);
                    table.CheckConstraint("CK_CourseEnrollments_Version", "\"Version\" >= 1");
                    table.ForeignKey(
                        name: "FK_CourseEnrollments_AppUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CourseEnrollments_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CoursePaidAccess",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    UserId = table.Column<string>(type: "character varying(160)", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(160)", nullable: false),
                    Source = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoursePaidAccess", x => x.Id);
                    table.UniqueConstraint("AK_CoursePaidAccess_UserId_CourseId", x => new { x.UserId, x.CourseId });
                    table.CheckConstraint("CK_CoursePaidAccess_Version", "\"Version\" >= 1");
                    table.ForeignKey(
                        name: "FK_CoursePaidAccess_AppUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CoursePaidAccess_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Invoices",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    UserId = table.Column<string>(type: "character varying(160)", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(160)", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "text", nullable: false),
                    AmountRial = table.Column<long>(type: "bigint", nullable: false),
                    CourseTitle = table.Column<string>(type: "text", nullable: false),
                    TrackId = table.Column<string>(type: "text", nullable: true),
                    PaymentStatus = table.Column<string>(type: "text", nullable: false),
                    FulfillmentStatus = table.Column<string>(type: "text", nullable: false),
                    LeaseUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LeaseToken = table.Column<string>(type: "text", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Invoices", x => x.Id);
                    table.CheckConstraint("CK_Invoices_Version", "\"Version\" >= 1");
                    table.ForeignKey(
                        name: "FK_Invoices_AppUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Invoices_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProviderAudits",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    CorrelationId = table.Column<string>(type: "text", nullable: false),
                    Operation = table.Column<string>(type: "text", nullable: false),
                    RequestJson = table.Column<string>(type: "text", nullable: false),
                    ResponseJson = table.Column<string>(type: "text", nullable: true),
                    HttpStatus = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    FinishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProviderAudits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VideoAssets",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    ObjectKey = table.Column<string>(type: "text", nullable: false),
                    FileName = table.Column<string>(type: "text", nullable: false),
                    UploadId = table.Column<string>(type: "text", nullable: false),
                    TotalBytes = table.Column<long>(type: "bigint", nullable: false),
                    PartBytes = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Error = table.Column<string>(type: "text", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VideoAssets", x => x.Id);
                    table.CheckConstraint("CK_VideoAssets_Version", "\"Version\" >= 1");
                });

            migrationBuilder.CreateTable(
                name: "SpotPlayerLicenses",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    UserId = table.Column<string>(type: "character varying(160)", nullable: false),
                    CourseId = table.Column<string>(type: "character varying(160)", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Source = table.Column<string>(type: "text", nullable: false),
                    EncryptedKey = table.Column<string>(type: "text", nullable: true),
                    ProviderId = table.Column<string>(type: "text", nullable: true),
                    Error = table.Column<string>(type: "text", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SpotPlayerLicenses", x => x.Id);
                    table.CheckConstraint("CK_SpotPlayerLicenses_Version", "\"Version\" >= 1");
                    table.ForeignKey(
                        name: "FK_SpotPlayerLicenses_CoursePaidAccess_UserId_CourseId",
                        columns: x => new { x.UserId, x.CourseId },
                        principalTable: "CoursePaidAccess",
                        principalColumns: new[] { "UserId", "CourseId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Lessons_Answer",
                table: "Lessons",
                sql: "jsonb_typeof(\"ChoicesJson\") = 'array' AND (NOT \"HasQuiz\" OR \"Status\" <> 'published' OR (\"Answer\" >= 0 AND \"Answer\" < jsonb_array_length(\"ChoicesJson\")))");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Lessons_Delivery",
                table: "Lessons",
                sql: "\"Delivery\" IN ('onsite','spotplayer') AND (\"Delivery\" <> 'spotplayer' OR \"VideoId\" IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Courses_Commerce",
                table: "Courses",
                sql: "(\"CommerceType\" = 'free' AND \"PriceRial\" = 0) OR (\"CommerceType\" IN ('mixed','paid') AND \"PriceRial\" >= 1000)");

            migrationBuilder.CreateIndex(
                name: "IX_CourseEnrollments_CourseId",
                table: "CourseEnrollments",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseEnrollments_UserId_CourseId",
                table: "CourseEnrollments",
                columns: new[] { "UserId", "CourseId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CoursePaidAccess_CourseId",
                table: "CoursePaidAccess",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_CoursePaidAccess_UserId_CourseId",
                table: "CoursePaidAccess",
                columns: new[] { "UserId", "CourseId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_CourseId",
                table: "Invoices",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_TrackId",
                table: "Invoices",
                column: "TrackId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_UserId_CourseId",
                table: "Invoices",
                columns: new[] { "UserId", "CourseId" },
                unique: true,
                filter: "\"PaymentStatus\" IN ('creating','pending','paid','requestUnknown')");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_UserId_IdempotencyKey",
                table: "Invoices",
                columns: new[] { "UserId", "IdempotencyKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProviderAudits_CorrelationId_StartedAt",
                table: "ProviderAudits",
                columns: new[] { "CorrelationId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SpotPlayerLicenses_UserId_CourseId",
                table: "SpotPlayerLicenses",
                columns: new[] { "UserId", "CourseId" },
                unique: true);
            migrationBuilder.Sql("""
                UPDATE "Lessons" SET "AnimationsJson" = jsonb_build_array(jsonb_build_object('key',"Concept",'enabled',true,'settings','{}'::jsonb));
                UPDATE "Courses" c SET "AnimationsJson" = COALESCE((SELECT jsonb_agg(DISTINCT jsonb_build_object('key',l."Concept",'enabled',true,'settings','{}'::jsonb)) FROM "Lessons" l WHERE l."CourseId"=c."Id"),'[]'::jsonb),
                    "CoverPresetKey" = CASE "Id" WHEN 'dotnet' THEN 'server' WHEN 'architecture' THEN 'layers' ELSE 'code' END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CourseEnrollments");

            migrationBuilder.DropTable(
                name: "Invoices");

            migrationBuilder.DropTable(
                name: "ProviderAudits");

            migrationBuilder.DropTable(
                name: "SpotPlayerLicenses");

            migrationBuilder.DropTable(
                name: "VideoAssets");

            migrationBuilder.DropTable(
                name: "CoursePaidAccess");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Lessons_Answer",
                table: "Lessons");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Lessons_Delivery",
                table: "Lessons");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Courses_Commerce",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "AnimationsJson",
                table: "Lessons");

            migrationBuilder.DropColumn(
                name: "Delivery",
                table: "Lessons");

            migrationBuilder.DropColumn(
                name: "HasQuiz",
                table: "Lessons");

            migrationBuilder.DropColumn(
                name: "VideoId",
                table: "Lessons");

            migrationBuilder.DropColumn(
                name: "AnimationsJson",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "CommerceType",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "CoverFileId",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "CoverKind",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "CoverPresetKey",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "IntroVideoId",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "PriceRial",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "SpotPlayerCourseId",
                table: "Courses");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Lessons_Answer",
                table: "Lessons",
                sql: "jsonb_typeof(\"ChoicesJson\") = 'array' AND (\"Status\" <> 'published' OR (\"Answer\" >= 0 AND \"Answer\" < jsonb_array_length(\"ChoicesJson\")))");
        }
    }
}
