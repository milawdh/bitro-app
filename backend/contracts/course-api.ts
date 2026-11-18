// Generated from backend DTOs by --export-contracts. Do not edit.
export interface CoverDto {
  kind: string;
  presetKey: string;
  fileId: string | null;
}
export interface CourseDto {
  id: string;
  version: number;
  slug: string;
  title: string;
  description: string;
  subtitle: string;
  status: string;
  level: string;
  color: string;
  commerceType: string;
  priceRial: number;
  spotPlayerCourseId: string | null;
  cover: CoverDto;
  introVideoId: string | null;
  animations: unknown;
}
export interface ModuleDto {
  id: string;
  version: number;
  courseId: string;
  title: string;
  order: number;
}
export interface LessonDto {
  id: string;
  version: number;
  courseId: string;
  moduleId: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  order: number;
  duration: number;
  delivery: string;
  videoId: string | null;
  concept: string;
  intro: string;
  analogy: string;
  objectives: unknown;
  experiment: string;
  code: string;
  output: unknown;
  hasQuiz: boolean;
  question: string;
  choices: unknown;
  answer: number | null;
  hint: string;
  explanation: string;
  animations: unknown;
}
export interface EnrollmentDto {
  courseId: string;
  status: string;
}
export interface MyCourseDto {
  course: CourseDto;
  enrollmentStatus: string;
  paidAccess: boolean;
  licenseStatus: string;
}
export interface InvoiceVerificationDto {
  invoiceId: string;
  observedPaymentStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  paidAccess: boolean;
  licenseStatus: string;
}
export interface InvoiceDto {
  id: string;
  courseId: string;
  amountRial: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentUrl: string | null;
}
export interface LicenseDto {
  status: string;
  source: string;
  key: string | null;
  error: string | null;
}
export interface ActivateRequest {
  licenseMode: string;
  licenseKey: string | null;
}
export interface InvoiceRequest {
  courseId: string;
  idempotencyKey: string;
}
export interface CurriculumOrderRequest {
  version: number;
  moduleIds: string[];
  lessonIds: string[];
}
export interface VideoUploadRequest {
  fileName: string;
  totalBytes: number;
}
export interface PlaybackDto {
  url: string;
  expiresAt: string;
}
export interface AnimationBinding {
  key: string;
  enabled: boolean;
  settings: Record<string, string | number | boolean>;
}
export interface ProgressDto {
  lessonId: string;
  version: number;
  step: number;
  videoPositionSeconds: number | null;
  completedAt: string | null;
}
export interface ProgressRequest {
  version: number;
  step: number;
  videoPositionSeconds: number | null;
}
export interface CourseProgressDto {
  courseId: string;
  lessons: ProgressDto[];
  completedChallengeIds: string[];
}
export interface DraftDto {
  lessonId: string;
  mode: string;
  version: number;
  code: string;
}
export interface DraftRequest {
  version: number;
  code: string;
}
export interface ProjectFileDto {
  path: string;
  content: string;
}
export interface WorkspaceDto {
  templateId: string;
  version: number;
  templateVersion: number;
  currentTemplateVersion: number;
  files: ProjectFileDto[];
  activeFile: string | null;
  checkpoint: number;
}
export interface WorkspaceRequest {
  version: number;
  files: ProjectFileDto[];
  activeFile: string | null;
  checkpoint: number;
}
export interface CompleteLessonRequest {
  contentVersion: number;
}
export interface AttemptRequest {
  contentVersion: number;
  idempotencyKey: string;
  answers: SubmittedAnswer[];
}
export interface SubmittedAnswer {
  questionId: string;
  optionId: string;
}
export interface QuestionFeedback {
  questionId: string;
  correct: boolean;
  explanation: string;
}
export interface AttemptDto {
  id: string;
  lessonId: string | null;
  challengeId: string | null;
  contentVersion: number;
  isPassed: boolean;
  correctCount: number;
  totalCount: number;
  feedback: QuestionFeedback[];
  createdAt: string;
}
export interface SyllabusItemDto {
  id: string;
  moduleId: string;
  title: string;
  slug: string;
  duration: number;
  delivery: string;
}
export interface PublicCourseDetailDto {
  course: CourseDto;
  modules: ModuleDto[];
  syllabus: SyllabusItemDto[];
}
export interface ChallengeOptionDto {
  id: string;
  label: string;
}
export interface ChallengeQuestionDto {
  id: string;
  prompt: string;
  code: string;
  options: ChallengeOptionDto[];
}
export interface ChallengeDto {
  id: string;
  version: number;
  slug: string;
  title: string;
  description: string;
  hint: string;
  questions: ChallengeQuestionDto[];
}
export interface LabDto {
  id: string;
  version: number;
  slug: string;
  title: string;
  description: string;
  concept: string;
  config: unknown;
}
export interface ProjectTemplateDto {
  id: string;
  version: number;
  slug: string;
  title: string;
  description: string;
  courseId: string;
  duration: number;
  difficulty: string;
  objectives: unknown;
  files: unknown;
}
