/**
 * Forms & surveys — the contract.
 *
 * One form is authored in `apps/admin`, answered in `apps/web`, and stored by
 * `apps/api`. All three compile against the definitions below, so a change here
 * is a change every side sees.
 *
 * The shapes are deliberately the ones the builder edits: a form owns its
 * pages, its questions and its settings as one document. That is what makes an
 * autosave a single PATCH, and what a document store would persist as one row —
 * see `docs/architecture/forms-data-model.md`.
 */

// ─── The form ────────────────────────────────────────────────────────────────

/**
 * Where a form is in its life.
 *
 * Only `PUBLISHED` is answerable, and only the backend decides that: a form
 * whose window has closed answers as `CLOSED` however the row reads.
 *
 * Three states, on purpose. An "archived" fourth one was tried and removed: it
 * did the same job as closing a form, and a form that is neither open nor
 * visible is a form nobody can explain.
 */
export type FormStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';

export type FormCategory =
  | 'FEEDBACK'
  | 'SURVEY'
  | 'CHECKLIST'
  | 'REQUEST'
  | 'ASSESSMENT'
  | 'OTHER';

/**
 * What a block on the canvas is.
 *
 * The first four groups collect an answer; `HEADING`, `DESCRIPTION`, `DIVIDER`
 * and `IMAGE` are layout only and never produce one. A page break is not a type
 * — pages are first class, below.
 */
export type QuestionType =
  // Text
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'EMAIL'
  | 'PHONE'
  | 'URL'
  // Choice
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'DROPDOWN'
  | 'IMAGE_CHOICE'
  | 'YES_NO'
  // Rating
  | 'RATING_STARS'
  | 'NUMERIC_SCALE'
  | 'NPS'
  | 'SLIDER'
  | 'RANKING'
  // Advanced
  | 'DATE'
  | 'TIME'
  | 'FILE_UPLOAD'
  | 'MATRIX'
  | 'SIGNATURE'
  // Layout
  | 'HEADING'
  | 'DESCRIPTION'
  | 'DIVIDER'
  | 'IMAGE';

/** The layout blocks, as a value — so "does this collect an answer?" is one check. */
export const LAYOUT_QUESTION_TYPES = [
  'HEADING',
  'DESCRIPTION',
  'DIVIDER',
  'IMAGE',
] as const satisfies readonly QuestionType[];

export function isLayoutQuestion(type: QuestionType): boolean {
  return (LAYOUT_QUESTION_TYPES as readonly QuestionType[]).includes(type);
}

export type FormOption = {
  id: string;
  label: string;
  /** For `IMAGE_CHOICE`. */
  imageUrl?: string;
};

/**
 * Everything a type-specific setting could need, in one optional bag.
 *
 * One shape rather than a union per question type: the builder swaps the panel
 * it renders, and a question that changes type keeps whatever still applies
 * instead of losing it. What is irrelevant is simply unset.
 */
export type QuestionValidation = {
  /** Text: characters. */
  minLength?: number;
  maxLength?: number;
  /** Number and slider. */
  min?: number;
  max?: number;
  step?: number;
  /** Rating, scale and NPS: the ends of the scale, and what they mean. */
  scaleMax?: number;
  minLabel?: string;
  maxLabel?: string;
  /** File upload. */
  allowedFileTypes?: string[];
  maxFileSizeMb?: number;
  /** Multiple choice: how many may be picked. */
  minSelections?: number;
  maxSelections?: number;
};

export type QuestionSettings = {
  /** Choice: offer a free-text «سایر». */
  allowOther?: boolean;
  /** Choice: shuffle the options per respondent. */
  randomize?: boolean;
  /** Matrix. */
  rows?: string[];
  columns?: string[];
  /** `IMAGE` blocks, and any question that wants an illustration. */
  imageUrl?: string;
  /**
   * A background behind the question, for both the builder and the respondent.
   *
   * Set by uploading through `POST /admin/forms/:id/assets`, which answers with
   * the URL to put here — the form document holds a reference, never the bytes.
   */
  backgroundImageUrl?: string;
};

export type FormQuestion = {
  id: string;
  /** The page it sits on. Every question belongs to exactly one. */
  pageId: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  /** Position within its page. Contiguous from 0 after any reorder. */
  order: number;
  placeholder?: string;
  defaultValue?: string;
  options?: FormOption[];
  validation?: QuestionValidation;
  settings?: QuestionSettings;
};

export type FormPage = {
  id: string;
  title: string;
  description?: string;
  order: number;
};

// ─── Conditional logic ───────────────────────────────────────────────────────

export type LogicOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'IS_ANSWERED'
  | 'IS_EMPTY';

export type LogicAction = 'SHOW' | 'HIDE' | 'JUMP_TO_PAGE' | 'END_FORM';

/**
 * One rule: *if* an answer looks like this, *then* do that.
 *
 * Rules live on the form rather than on the question they affect, because a
 * rule is a relationship between two questions and storing it twice is how the
 * two copies drift. The builder shows a question's rules by filtering on
 * `targetQuestionId`; the runtime evaluates them all in order.
 */
export type LogicRule = {
  id: string;
  /** The answer being tested. */
  whenQuestionId: string;
  operator: LogicOperator;
  /** Unused by `IS_ANSWERED` / `IS_EMPTY`. */
  value?: string;
  action: LogicAction;
  /** For `SHOW` / `HIDE`. */
  targetQuestionId?: string;
  /** For `JUMP_TO_PAGE`. */
  targetPageId?: string;
};

// ─── Audience and settings ───────────────────────────────────────────────────

export type AudienceMode = 'EVERYONE' | 'USERS' | 'ROLES' | 'GROUPS';

export type FormAudience = {
  mode: AudienceMode;
  /** Ids of the product's users, for `USERS`. */
  userIds?: string[];
  /** For `ROLES` — the product's roles, not the admin panel's. */
  roles?: string[];
  /** For `GROUPS`, once groups exist as an entity. */
  groupIds?: string[];
};

export type WelcomePageSettings = {
  enabled: boolean;
  title: string;
  description?: string;
  imageUrl?: string;
  buttonLabel: string;
};

export type ThankYouPageSettings = {
  title: string;
  description?: string;
  buttonLabel?: string;
  buttonUrl?: string;
};

export type AvailabilitySettings = {
  alwaysAvailable: boolean;
  /** ISO calendar dates, `YYYY-MM-DD`. Ignored when `alwaysAvailable`. */
  publishAt?: string;
  closeAt?: string;
};

export type ResponseSettings = {
  /** Answers are stored without a respondent. */
  anonymous: boolean;
  onePerUser: boolean;
  allowEditAfterSubmit: boolean;
};

export type NotificationSettings = {
  notifyAdminOnResponse: boolean;
  sendConfirmationToRespondent: boolean;
};

export type FormSettings = {
  welcome: WelcomePageSettings;
  thankYou: ThankYouPageSettings;
  availability: AvailabilitySettings;
  responses: ResponseSettings;
  notifications: NotificationSettings;
  /** Show the progress bar to respondents. */
  showProgress: boolean;
};

// ─── The document ────────────────────────────────────────────────────────────

export type Form = {
  id: string;
  title: string;
  description?: string;
  status: FormStatus;
  category: FormCategory;
  /** The admin who owns it. */
  ownerId: string;
  /** Their username — what identifies an admin account, and what the table shows. */
  ownerUsername: string;
  ownerName: string;
  pages: FormPage[];
  questions: FormQuestion[];
  conditionalLogic: LogicRule[];
  audience: FormAudience;
  settings: FormSettings;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  /** Denormalised for the dashboard, computed by the backend. */
  questionCount: number;
  responseCount: number;
};

/** A row in the forms dashboard: the document without its body. */
export type FormSummary = Omit<
  Form,
  'pages' | 'questions' | 'conditionalLogic' | 'audience' | 'settings'
>;

/** A starting point offered by «ساخت از الگو». */
export type FormTemplate = {
  id: string;
  title: string;
  description: string;
  category: FormCategory;
  questionCount: number;
};

// ─── Responses ───────────────────────────────────────────────────────────────

/** An answer's value, as it travels. Normalised per question type by the service. */
export type AnswerValue = string | number | string[] | Record<string, string> | null;

export type FormAnswer = {
  questionId: string;
  value: AnswerValue;
};

export type ResponseStatus = 'COMPLETE' | 'PARTIAL';

export type FormResponse = {
  id: string;
  formId: string;
  /** Null when the form collects answers anonymously. */
  respondentId: string | null;
  respondentName: string | null;
  status: ResponseStatus;
  answers: FormAnswer[];
  startedAt: string;
  submittedAt: string | null;
  /** How long it took, in seconds. Null while incomplete. */
  completionSeconds: number | null;
};

// ─── Statistics ──────────────────────────────────────────────────────────────

export type ChoiceBreakdown = { label: string; count: number; percentage: number };

/**
 * One question's answers, already reduced to what a chart needs.
 *
 * Reduced by the backend rather than by the browser: the browser only ever has
 * the page of responses it asked for, so counting there would count a page.
 */
export type QuestionStats = {
  questionId: string;
  title: string;
  type: QuestionType;
  answerCount: number;
  skippedCount: number;
  /** Choice, yes/no and NPS-bucket questions. */
  breakdown?: ChoiceBreakdown[];
  /** Rating, scale, NPS and number questions. */
  average?: number;
  /** NPS only: promoters − detractors, −100…100. */
  npsScore?: number;
  /** Free-text questions: the answers themselves, newest first, capped. */
  textAnswers?: string[];
};

export type ResponseTrendPoint = {
  /** ISO calendar date. */
  date: string;
  count: number;
};

export type FormStats = {
  totalResponses: number;
  completedResponses: number;
  incompleteResponses: number;
  /** 0–100. Completed ÷ total. */
  completionRate: number;
  /** Seconds, over completed responses only. */
  averageCompletionSeconds: number;
  trend: ResponseTrendPoint[];
  questions: QuestionStats[];
};

/** The four cards above the forms dashboard. */
export type FormsOverview = {
  totalForms: number;
  publishedForms: number;
  draftForms: number;
  totalResponses: number;
};

// ─── Requests and responses ──────────────────────────────────────────────────

export type FormsQuery = {
  search?: string;
  status?: FormStatus;
  /** `updatedAt` newest first by default. */
  sort?: 'RECENT' | 'TITLE' | 'RESPONSES';
  page?: number;
  pageSize?: number;
};

export type CreateFormRequest = {
  title: string;
  description?: string;
  category?: FormCategory;
  /** Copies that template's pages and questions into the new form. */
  templateId?: string;
};

/**
 * What the builder autosaves.
 *
 * Every field is optional and replaces what is stored — the builder holds the
 * whole document in memory and sends back the parts it changed.
 */
export type UpdateFormRequest = Partial<
  Pick<
    Form,
    | 'title'
    | 'description'
    | 'category'
    | 'pages'
    | 'questions'
    | 'conditionalLogic'
    | 'audience'
    | 'settings'
  >
>;

export type SubmitResponseRequest = {
  answers: FormAnswer[];
  /** False while a respondent is still moving between pages. */
  complete: boolean;
  /** Seconds since they opened the form, for the completion-time statistic. */
  elapsedSeconds?: number;
};

export type ExportFormat = 'CSV' | 'EXCEL';

/**
 * An image an author uploaded for a question's background.
 *
 * Sent as base64 rather than multipart so the front-end keeps using the one
 * JSON client it has; the backend decodes, checks the type and the size, and
 * answers with a URL. Nothing about the bytes reaches the form document.
 */
export type UploadAssetRequest = {
  filename: string;
  /** `image/png`, `image/jpeg`, `image/webp` or `image/gif`. */
  contentType: string;
  /** base64, without a `data:` prefix. */
  data: string;
};

export type UploadAssetResponse = {
  /** Where the image is served from. Goes straight into a question's settings. */
  url: string;
};

/**
 * The `code` on an `ApiFailure` from the forms routes.
 *
 * The UI switches on these — a closed form and a form that this user has
 * already answered need different screens.
 */
export type FormErrorCode =
  | 'FORM_NOT_FOUND'
  | 'FORM_NOT_PUBLISHED'
  | 'FORM_CLOSED'
  | 'FORM_NOT_YET_OPEN'
  | 'FORM_ALREADY_ANSWERED'
  | 'FORM_AUDIENCE_DENIED'
  | 'FORM_HAS_NO_QUESTIONS'
  | 'FORM_ANSWER_INVALID';
