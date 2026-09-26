/**
 * Types internal to the Forms module — the shapes that get stored.
 *
 * A form is one document: its pages, its questions, its logic and its settings
 * travel together, because that is how the builder edits it and how a document
 * store would keep it. Responses are separate rows, because there are many of
 * them and they are written by a different audience entirely.
 *
 * Anything the front-end also has to agree on is in `@hamdastan/types`. What
 * stays here is what a client never sees: timestamps as `Date`, and the
 * respondent identity behind an anonymous response.
 */

import type {
  FormAnswer,
  FormAudience,
  FormCategory,
  FormPage,
  FormQuestion,
  FormSettings,
  FormStatus,
  LogicRule,
  ResponseStatus,
} from '@hamdastan/types';

export type FormRecord = {
  id: string;
  title: string;
  description?: string;
  status: FormStatus;
  category: FormCategory;
  /** The admin who created it. Both are denormalised so a list needs no join. */
  ownerId: string;
  ownerUsername: string;
  ownerName: string;
  pages: FormPage[];
  questions: FormQuestion[];
  conditionalLogic: LogicRule[];
  audience: FormAudience;
  settings: FormSettings;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
};

export type NewFormRecord = Omit<FormRecord, 'id' | 'createdAt' | 'updatedAt'>;

/** What an edit may change. Status moves through the service, not through here. */
export type FormUpdate = Partial<
  Pick<
    FormRecord,
    | 'title'
    | 'description'
    | 'category'
    | 'pages'
    | 'questions'
    | 'conditionalLogic'
    | 'audience'
    | 'settings'
    | 'status'
    | 'publishedAt'
  >
>;

export type FormListFilter = {
  search?: string;
  status?: FormStatus;
  sort: 'RECENT' | 'TITLE' | 'RESPONSES';
  page: number;
  pageSize: number;
};

export type ResponseRecord = {
  id: string;
  formId: string;
  /**
   * Who answered, or null.
   *
   * Null means one of two different things, and the form's settings say which:
   * the form collects answers anonymously, or nobody was signed in. Either way
   * there is nothing here to join back to a user.
   */
  respondentId: string | null;
  respondentName: string | null;
  status: ResponseStatus;
  answers: FormAnswer[];
  startedAt: Date;
  submittedAt: Date | null;
  completionSeconds: number | null;
};

export type NewResponseRecord = Omit<ResponseRecord, 'id'>;

/**
 * A starting point for a new form.
 *
 * The same document shape minus everything that belongs to an instance — no
 * owner, no status, no audience. Copying one is what «ساخت از الگو» does.
 */
export type FormTemplateRecord = {
  id: string;
  title: string;
  description: string;
  category: FormCategory;
  pages: FormPage[];
  questions: FormQuestion[];
};

/**
 * An image an author uploaded, as it is stored.
 *
 * Kept apart from the form document: a form is read on every page load and a
 * background is read once per render, so the bytes have no business travelling
 * with the questions.
 */
export type FormAssetRecord = {
  id: string;
  formId: string;
  filename: string;
  contentType: string;
  bytes: Buffer;
  createdAt: Date;
};
