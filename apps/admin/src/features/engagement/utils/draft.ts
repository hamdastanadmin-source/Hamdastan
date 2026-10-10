import type {
  ActivityDefinition,
  ActivityInput,
  ActivityQuestion,
  ActivityStep,
  ActivityType,
  AdminActivityDetail,
} from '@hamdastan/types';

/**
 * The builder's working copy and the blank pieces it starts from.
 *
 * The working copy is an `ActivityInput` with its two dates as the
 * `datetime-local` strings the inputs hold; `toInput` turns it back into
 * what the API takes. Nothing here validates — `activityInputSchema` does,
 * on save, exactly as the API will.
 */

export type EditorState = Omit<ActivityInput, 'startsAt' | 'endsAt'> & {
  startsAt: string;
  endsAt: string;
};

/** A short id for a step, question or option. Ids only have to be unique inside one activity. */
export const newKey = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

export function emptyQuestion(kind: ActivityQuestion['kind'], keep?: Partial<ActivityQuestion>): ActivityQuestion {
  const base = {
    id: keep?.id ?? newKey(),
    title: keep?.title ?? '',
    description: keep?.description,
    required: keep?.required ?? true,
    dimensionId: keep?.dimensionId,
    reverse: keep?.reverse,
  };
  switch (kind) {
    case 'single':
    case 'multiple':
      return {
        ...base,
        kind,
        options:
          keep && 'options' in keep && keep.options
            ? keep.options
            : [
                { id: newKey(), label: '' },
                { id: newKey(), label: '' },
              ],
      };
    case 'text':
      return { ...base, kind, multiline: true, dimensionId: undefined, reverse: undefined };
    case 'rating':
      return { ...base, kind, max: 5 };
    case 'scale':
      return { ...base, kind, min: 1, max: 5, minLabel: 'کاملاً مخالفم', maxLabel: 'کاملاً موافقم' };
  }
}

export const emptyStep = (title = ''): ActivityStep => ({
  id: newKey(),
  title,
  description: '',
  questions: [emptyQuestion('single')],
});

export function emptyDefinition(type: ActivityType): ActivityDefinition {
  return {
    steps: [emptyStep(type === 'mission' ? 'مرحله‌ی ۱' : '')],
    estimatedMinutes: type === 'survey' ? 3 : 5,
    maxSubmissions: 1,
    anonymous: false,
    review: type === 'mission' ? 'manual' : 'auto',
    assessment:
      type === 'assessment' ? { mode: 'knowledge', dimensions: [], passingScore: null, showResult: true } : null,
    xp: { enabled: true, amount: 20, showBeforeStart: true, maxAwards: 1, requirePass: false },
  };
}

export function emptyState(type: ActivityType = 'survey'): EditorState {
  return {
    type,
    title: '',
    summary: '',
    instructions: '',
    definition: emptyDefinition(type),
    audience: { kind: 'all' },
    startsAt: '',
    endsAt: '',
  };
}

/** A new type keeps the content that still fits it: the title and the questions. */
export function switchType(state: EditorState, type: ActivityType): EditorState {
  const blank = emptyDefinition(type);
  const steps = type === 'mission' ? state.definition.steps : state.definition.steps.slice(0, 1);
  return { ...state, type, definition: { ...blank, steps, xp: state.definition.xp } };
}

/** `datetime-local` holds local wall time without a zone; this is the local reading of an instant. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromDetail(detail: AdminActivityDetail): EditorState {
  return {
    type: detail.type,
    title: detail.title,
    summary: detail.summary,
    instructions: detail.instructions,
    definition: detail.definition,
    audience: detail.audience,
    startsAt: toLocalInput(detail.startsAt),
    endsAt: toLocalInput(detail.endsAt),
  };
}

export function toInput(state: EditorState): ActivityInput {
  return {
    ...state,
    startsAt: state.startsAt ? new Date(state.startsAt).toISOString() : null,
    endsAt: state.endsAt ? new Date(state.endsAt).toISOString() : null,
  };
}

/** The builder's seven steps, in order. */
export const EDITOR_STEPS = [
  { id: 'type', label: 'نوع' },
  { id: 'details', label: 'اطلاعات' },
  { id: 'questions', label: 'سؤال‌ها' },
  { id: 'audience', label: 'مخاطبان' },
  { id: 'xp', label: 'XP' },
  { id: 'schedule', label: 'زمان‌بندی' },
  { id: 'preview', label: 'پیش‌نمایش و انتشار' },
] as const;

export type EditorStepId = (typeof EDITOR_STEPS)[number]['id'];

/** The step whose fields an error path belongs to, so a failed save can open it. */
export function stepOfPath(path: string): EditorStepId {
  if (path.startsWith('type')) return 'type';
  if (path.startsWith('audience')) return 'audience';
  if (path.startsWith('startsAt') || path.startsWith('endsAt')) return 'schedule';
  if (path.startsWith('definition.xp')) return 'xp';
  if (path.startsWith('definition.steps') || path.startsWith('definition.assessment')) return 'questions';
  return 'details';
}
