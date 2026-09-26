import type {Role} from './domain';

/**
 * Shapes that cross from server components to client components. Everything
 * passes through JSON, so dates arrive as ISO strings.
 */

export type ActorState={userId:string;membershipId:string;tenantId:string;role:Role;name:string;email:string;tenantStatus:string;platformOperator:boolean};

export type ShellState={
 actor:ActorState;
 tenant:{id:string;nameAr:string;nameEn:string;brandColor:string;hasLogo:boolean;kind:string;timezone:string};
 memberships:{id:string;tenantId:string;role:Role;tenant:{nameAr:string;nameEn:string}}[];
 notifications:{id:string;titleAr:string;titleEn:string;href:string;read:boolean;createdAt:string}[];
 learning:number;
 billing:{status:string;daysLeft:number|null}|null;
};

export type Choice={id:string;text:string};

export type LessonState={id:string;moduleId:string;title:string;kind:'Text'|'Pdf'|'Video'|'Link';body:string;url:string|null;assetId:string|null;durationSeconds:number;required:boolean;position:number};
export type ModuleState={id:string;title:string;position:number;lessons:LessonState[]};
export type QuestionState={id:string;kind:'Single'|'TrueFalse';prompt:string;choices:Choice[];correct:string;points:number;position:number};
export type AssetState={id:string;name:string;mime:string;size:number;status:string};

export type VersionSummary={id:string;number:number;status:string;title:string;publishedAt:string|null;createdAt:string;enrollments:number};
export type VersionState=VersionSummary&{description:string;coverAssetId:string|null;estimatedMinutes:number;quizEnabled:boolean;passPercent:number;maxAttempts:number;timeLimitMinutes:number|null;version:number;modules:ModuleState[];questions:QuestionState[];locked:boolean};

export type CourseRow={id:string;title:string;category:string;archivedAt:string|null;createdAt:string;instructorIds:string[];latest:{id:string;number:number;status:string;title:string;coverAssetId:string|null};published:{id:string;number:number}|null;lessons:number;enrolled:number;completed:number;overdue:number};

export type MemberRow={id:string;userId:string;name:string;email:string;role:Role;title:string;active:boolean;verified:boolean;supportGrant:boolean;expiresAt:string|null;createdAt:string;lastSeenAt:string|null;groupIds:string[]};
export type GroupRow={id:string;name:string;description:string;archivedAt:string|null;memberIds:string[]};

export type EnrollmentRow={id:string;membershipId:string;name:string;email:string;courseId:string;courseTitle:string;versionId:string;versionNumber:number;groupId:string|null;status:string;startsAt:string;dueAt:string|null;createdAt:string;startedAt:string|null;completedAt:string|null;requiredDone:number;requiredTotal:number;quizEnabled:boolean;quizPassed:boolean;bestScore:number|null;attempts:number;certificate:{id:string;serial:string;status:string}|null};

export type CertificateRow={id:string;serial:string;verifyToken:string;learnerName:string;courseTitle:string;tenantName:string;score:number|null;issuedAt:string;status:string;revokedAt:string|null;revokeReason:string|null;enrollmentId:string;email?:string};

export type LearnerCourse={
 enrollment:{id:string;status:string;startsAt:string;dueAt:string|null;requiredDone:number;requiredTotal:number;quizPassed:boolean;bestScore:number|null;completedAt:string|null};
 version:{id:string;number:number;title:string;description:string;coverAssetId:string|null;estimatedMinutes:number;quizEnabled:boolean;passPercent:number;maxAttempts:number;timeLimitMinutes:number|null;questionCount:number};
 modules:ModuleState[];
 progress:Record<string,{completedAt:string|null;position:number;watchedSeconds:number}>;
 attempts:{id:string;number:number;startedAt:string;deadlineAt:string|null;submittedAt:string|null;score:number|null;passed:boolean|null}[];
 certificate:{id:string;serial:string;status:string}|null;
 assets:Record<string,AssetState>;
};

export type AttemptState={
 id:string;number:number;startedAt:string;deadlineAt:string|null;submittedAt:string|null;serverNow:string;
 answers:Record<string,string>;score:number|null;passed:boolean|null;earned:number;total:number;
 enrollmentId:string;courseTitle:string;passPercent:number;
 questions:{id:string;kind:string;prompt:string;choices:Choice[];points:number;correct?:string}[];
};

export type AuditRow={id:string;actorId:string;actorName:string;action:string;entityId:string;detail:Record<string,unknown>;createdAt:string};
export type ExportRow={id:string;type:string;status:string;rows:number;expiresAt:string;createdAt:string;downloadedAt:string|null};

export type StaffDashboard={
 totals:{enrolled:number;notStarted:number;inProgress:number;completed:number;overdue:number;withdrawn:number;courses:number;published:number;groups:number};
 members:Record<string,number>;
 byCourse:{id:string;title:string;status:string;enrolled:number;started:number;completed:number;overdue:number}[];
 weeks:{start:string;end:string;completed:number;assigned:number}[];
 recent:EnrollmentRow[];
};
