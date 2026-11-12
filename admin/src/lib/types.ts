export type ContentStatus = 'draft' | 'published' | 'archived';
export type ConceptSlug = 'variables' | 'references' | 'objects' | 'oop' | 'threads' | 'async' | 'http' | 'di' | 'transactions' | 'loops';
export interface BaseContent {id:string;slug:string;title:string;description:string;status:ContentStatus;createdAt:string;updatedAt:string}
export interface CourseModule {id:string;title:string}
export interface AdminCourse extends BaseContent {subtitle:string;level:'beginner'|'intermediate'|'advanced';color:'purple'|'cyan'|'amber';modules:CourseModule[]}
export interface AdminLesson extends BaseContent {courseId:string;moduleId:string;order:number;duration:number;concept:ConceptSlug;intro:string;analogy:string;objectives:string[];experiment:string;code:string;output:string[];question:string;choices:string[];answer:number;hint:string;explanation:string}
export interface AdminLab extends BaseContent {concept:ConceptSlug;category:'fundamentals'|'oop'|'advanced'|'backend';duration:number;config:Record<string,string|number|boolean>}
export interface ChallengeOption {id:string;label:string}
export interface ChallengeQuestion {id:string;prompt:string;code:string;options:ChallengeOption[];correctOption:string;explanation:string}
export interface AdminChallenge extends BaseContent {difficulty:'beginner'|'intermediate';duration:number;concept:ConceptSlug;courseId:string;hint:string;questions:ChallengeQuestion[]}
export interface ProjectFile {path:string;content:string}
export interface AdminProject extends BaseContent {difficulty:'beginner'|'intermediate'|'advanced';courseId:string;duration:number;files:ProjectFile[];objectives:string[]}
export interface AdminUser {id:string;name:string;email:string;role:'learner'|'editor'|'admin';status:'active'|'suspended';joinedAt:string;lastActiveAt:string;enrolledCourseIds:string[];completedLessonIds:string[];completedChallengeIds:string[];avatarColor:string;notes:string}
export interface LearningEvent {id:string;userId:string;lessonId:string;date:string;durationMinutes:number;kind:'lesson_started'|'lesson_completed'|'challenge_completed'}
export interface AdminSettings {workspaceName:string;adminName:string;email:string;theme:'dark'|'light';defaultContentStatus:'draft'|'published';notificationsEnabled:boolean}
export interface AdminActivity {id:string;entityType:string;entityId:string;title:string;action:'created'|'updated'|'published'|'archived'|'restored'|'user_updated'|'settings_updated';at:string;actor:string}
export interface AdminData {courses:AdminCourse[];lessons:AdminLesson[];labs:AdminLab[];challenges:AdminChallenge[];projects:AdminProject[];users:AdminUser[];learningEvents:LearningEvent[];activity:AdminActivity[];settings:AdminSettings}
export interface ContentEntityMap {courses:AdminCourse;lessons:AdminLesson;labs:AdminLab;challenges:AdminChallenge;projects:AdminProject}
export type ContentKind = keyof ContentEntityMap;
export interface SaveResult {ok:boolean;error?:string;errors?:Record<string,string>}
export interface AdminRepository<T extends {id:string}> {list():T[];get(id:string):T|undefined;save(entity:T):SaveResult;archive(ids:string[]):SaveResult}
