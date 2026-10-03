/**
 * Onboarding stage 2: the social questionnaire — its questions, their option
 * codes, the four sections they are shown in, and the copy.
 *
 * Here rather than in `apps/web` because both sides depend on it: the browser
 * renders it, and the API validates every answer against it and scores it.
 * The scoring weights themselves are not here — they are the API's business
 * (`apps/api/src/modules/onboarding/onboarding.scoring.ts`).
 *
 * Two things are contracts and must not be renamed once answers are saved:
 *
 * - **Question ids** (`Q1`–`Q20`) are the ids from the source questionnaire,
 *   not the order the questions are shown in. `QUESTIONNAIRE_ORDER` is the
 *   presentation order; nothing scores off a position.
 * - **Option codes** are what `v2_questionnaire_answers` stores. A label can
 *   be reworded freely; a code cannot.
 */

/** Bumped whenever the scoring changes, so profiles can be recomputed. */
export const QUESTIONNAIRE_SCORING_VERSION = 'social-matching-v1';

export const QUESTION_IDS = [
  'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10',
  'Q11', 'Q12', 'Q13', 'Q14', 'Q15', 'Q16', 'Q17', 'Q18', 'Q19', 'Q20',
] as const;

export type QuestionId = (typeof QUESTION_IDS)[number];

export type SectionId = 1 | 2 | 3 | 4;

/**
 * - `single`  one option; the screen saves and moves on by itself.
 * - `multi`   up to `maxSelections`; the person continues by hand.
 * - `ranked`  a `multi` whose picks are then put in order of importance.
 * - `slider`  an integer from 1 to 10.
 */
export type QuestionKind = 'single' | 'multi' | 'ranked' | 'slider';

export type QuestionOption = { code: string; label: string };

type QuestionBase = { id: QuestionId; section: SectionId; title: string; helper?: string };

export type ChoiceQuestion = QuestionBase & {
  kind: 'single' | 'multi' | 'ranked';
  options: readonly QuestionOption[];
  /** `multi` and `ranked` only. Absent means "as many as apply". */
  maxSelections?: number;
};

export type SliderQuestion = QuestionBase & {
  kind: 'slider';
  /** The label at 1, shown at the reading start of the scale. */
  minLabel: string;
  /** The label at 10. */
  maxLabel: string;
};

export type Question = ChoiceQuestion | SliderQuestion;

export const SLIDER_MIN = 1;
export const SLIDER_MAX = 10;

export type QuestionnaireSection = {
  id: SectionId;
  /** The short beat after the section. The last section has none. */
  reward?: { title: string; body: string; cta: string };
};

export const QUESTIONNAIRE_SECTIONS: readonly QuestionnaireSection[] = [
  {
    id: 1,
    reward: {
      title: 'کم‌کم داریم می‌شناسیمت.',
      body: 'حالا ببینیم چطور با آدم‌ها ارتباط می‌گیری.',
      cta: 'ادامه',
    },
  },
  {
    id: 2,
    reward: {
      title: 'خوبه، نصف راه.',
      body: 'حالا بریم سراغ تجربه‌هایی که بیشتر باهات جورند.',
      cta: 'ادامه',
    },
  },
  {
    id: 3,
    reward: {
      title: 'تقریباً کامل شد.',
      body: 'فقط چند انتخاب آخر مونده.',
      cta: 'بریم بخش آخر',
    },
  },
  { id: 4 },
];

export const QUESTIONS: Readonly<Record<QuestionId, Question>> = {
  // ─── Section 1 — Social energy ─────────────────────────────────────────
  Q2: {
    id: 'Q2',
    section: 1,
    kind: 'single',
    title: 'وقتی وارد جمعی می‌شی که هیچ‌کس رو نمی‌شناسی، معمولاً چه رفتاری داری؟',
    options: [
      { code: 'INITIATES', label: 'خودم معمولاً شروع‌کننده گفتگو هستم.' },
      { code: 'JOINS_EASILY', label: 'اگر کسی شروع کنه، راحت وارد گفتگو می‌شم.' },
      { code: 'OBSERVES_FIRST', label: 'اول کمی فضا رو می‌سنجم و بعد وارد گفتگو می‌شم.' },
      { code: 'LISTENER', label: 'ترجیح می‌دم بیشتر شنونده باشم.' },
    ],
  },
  Q4: {
    id: 'Q4',
    section: 1,
    kind: 'slider',
    title: 'بعد از چند ساعت تعامل با آدم‌های جدید معمولاً چه حسی داری؟',
    minLabel: 'خیلی خسته می‌شم',
    maxLabel: 'انرژی می‌گیرم',
  },
  Q5: {
    id: 'Q5',
    section: 1,
    kind: 'single',
    title: 'برای راحت شدن با آدم‌های جدید معمولاً چقدر زمان نیاز داری؟',
    options: [
      { code: 'MINUTES', label: 'چند دقیقه' },
      { code: 'HALF_HOUR', label: 'حدود نیم ساعت' },
      { code: 'ONE_TWO_HOURS', label: 'یک یا دو ساعت' },
      { code: 'SEVERAL_MEETINGS', label: 'معمولاً چند بار دیدن لازم دارم' },
    ],
  },
  Q19: {
    id: 'Q19',
    section: 1,
    kind: 'single',
    title: 'اندازه گروه ایده‌آل برای تو چقدره؟',
    options: [
      { code: 'SMALL', label: '۲ تا ۳ نفر' },
      { code: 'MEDIUM', label: '۴ تا ۶ نفر' },
      { code: 'LARGE', label: '۷ تا ۱۰ نفر' },
      { code: 'XL', label: 'بیشتر از ۱۰ نفر' },
    ],
  },
  Q3: {
    id: 'Q3',
    section: 1,
    kind: 'multi',
    maxSelections: 2,
    title: 'توی یک جمع جدید، معمولاً کدوم نقش‌ها بیشتر شبیه توئه؟',
    helper: 'حداکثر ۲ مورد',
    options: [
      { code: 'INITIATOR', label: 'شروع‌کننده گفتگو' },
      { code: 'FACILITATOR', label: 'کسی که باعث می‌شه همه مشارکت کنن' },
      { code: 'ENERGIZER', label: 'کسی که جو رو شاد می‌کنه' },
      { code: 'IDEATOR', label: 'کسی که ایده و پیشنهاد می‌ده' },
      { code: 'ORGANIZER', label: 'کسی که برنامه رو جلو می‌بره' },
      { code: 'LISTENER', label: 'کسی که بیشتر گوش می‌ده' },
      { code: 'ANALYST', label: 'کسی که تحلیل و نظر می‌ده' },
    ],
  },

  // ─── Section 2 — Connection style ──────────────────────────────────────
  Q6: {
    id: 'Q6',
    section: 2,
    kind: 'multi',
    maxSelections: 3,
    title: 'توی یه دورهمی، از چه مدل گفتگوهایی بیشتر لذت می‌بری؟',
    helper: 'حداکثر ۳ مورد',
    options: [
      { code: 'LIGHT', label: 'شوخی و گفتگوهای سبک' },
      { code: 'PERSONAL', label: 'تجربه‌های شخصی' },
      { code: 'INTEREST', label: 'فیلم، بازی، کتاب و هنر' },
      { code: 'DEEP', label: 'ایده‌ها و موضوعات عمیق' },
      { code: 'PROFESSIONAL', label: 'کار و تجربه‌های حرفه‌ای' },
      { code: 'STORY', label: 'داستان‌های زندگی' },
    ],
  },
  Q7: {
    id: 'Q7',
    section: 2,
    kind: 'single',
    title: 'کدوم حالت بیشتر شبیه توئه؟',
    options: [
      { code: 'ASKS_LISTENS', label: 'بیشتر سؤال می‌پرسم و گوش می‌دم.' },
      { code: 'SHARES_STORIES', label: 'بیشتر تجربه‌ها و داستان‌هام رو تعریف می‌کنم.' },
      { code: 'DEBATES', label: 'بحث و تبادل‌نظر رو دوست دارم.' },
      { code: 'CALM', label: 'گفتگوی آروم و بدون فشار رو ترجیح می‌دم.' },
    ],
  },
  Q18: {
    id: 'Q18',
    section: 2,
    kind: 'single',
    title: 'توی چه مدل گروهی احساس راحتی بیشتری می‌کنی؟',
    options: [
      { code: 'SIMILAR', label: 'آدم‌هایی شبیه خودم' },
      { code: 'MIXED', label: 'ترکیبی از آدم‌های مشابه و متفاوت' },
      { code: 'ANY', label: 'مهم نیست؛ فقط تجربه خوبی باشه' },
    ],
  },
  Q20: {
    id: 'Q20',
    section: 2,
    kind: 'multi',
    maxSelections: 3,
    title: 'چی می‌تونه یه جمع خوب رو برات خراب کنه؟',
    helper: 'حداکثر ۳ مورد',
    options: [
      { code: 'LOW_SI_LOW_SE', label: 'آدم‌های خیلی کم‌حرف' },
      { code: 'HIGH_DOMINANCE', label: 'کسی که کل گفتگو رو در دست می‌گیره' },
      { code: 'LIFESTYLE_DISTANCE', label: 'اختلاف زیاد در سبک زندگی' },
      { code: 'HIGH_CP', label: 'رقابت بیش از حد' },
      { code: 'LOW_INTEREST_OVERLAP', label: 'نداشتن موضوع یا علاقه مشترک' },
      { code: 'LOW_ST_LOW_PU', label: 'بی‌نظمی' },
      { code: 'HIGH_SE_SP_DISTANCE', label: 'اختلاف زیاد در سطح انرژی' },
    ],
  },
  Q1: {
    id: 'Q1',
    section: 2,
    kind: 'ranked',
    maxSelections: 3,
    title: 'از یه تجربه گروهی خوب، بیشتر دنبال چی هستی؟',
    helper: 'تا ۳ مورد انتخاب کن.',
    options: [
      { code: 'SOCIAL', label: 'آشنایی با آدم‌های جدید' },
      { code: 'FUN', label: 'خوش‌گذرونی و خندیدن' },
      { code: 'DISCOVERY', label: 'تجربه چیزهای جدید' },
      { code: 'LEARNING', label: 'یادگیری و گفتگو' },
      { code: 'COMPETITION', label: 'رقابت و چالش' },
      { code: 'FRIENDSHIP', label: 'پیدا کردن آدم‌هایی با علایق مشترک' },
      { code: 'NETWORKING', label: 'شبکه‌سازی حرفه‌ای' },
      { code: 'ESCAPE', label: 'خارج شدن از روزمرگی' },
      { code: 'MEMORABLE', label: 'داشتن یه تجربه خاص و متفاوت' },
    ],
  },

  // ─── Section 3 — Experience style ──────────────────────────────────────
  Q8: {
    id: 'Q8',
    section: 3,
    kind: 'slider',
    title: 'فعالیت آروم رو ترجیح می‌دی یا هیجان‌انگیز؟',
    minLabel: 'کاملاً آروم',
    maxLabel: 'خیلی هیجان‌انگیز',
  },
  Q9: {
    id: 'Q9',
    section: 3,
    kind: 'slider',
    title: 'توی یک تجربه گروهی، کدوم برات مهم‌تره؟',
    minLabel: 'خودِ گفتگو',
    maxLabel: 'خودِ فعالیت',
  },
  Q11: {
    id: 'Q11',
    section: 3,
    kind: 'slider',
    title: 'توی بازی یا فعالیت رقابتی، بردن چقدر برات مهمه؟',
    minLabel: 'برد مهم نیست',
    maxLabel: 'رقابت خیلی مهمه',
  },
  Q12: {
    id: 'Q12',
    section: 3,
    kind: 'single',
    title: 'توی فعالیت گروهی کدوم مدل رو بیشتر دوست داری؟',
    options: [
      { code: 'COOPERATIVE', label: 'همه با هم همکاری کنیم' },
      { code: 'FRIENDLY_COMPETITION', label: 'یه رقابت دوستانه هم داشته باشیم' },
      { code: 'SERIOUS_COMPETITION', label: 'رقابت جدی‌تر برام جذاب‌تره' },
    ],
  },
  Q13: {
    id: 'Q13',
    section: 3,
    kind: 'single',
    title: 'برای تجربه‌های جدید، کدوم حالت بیشتر شبیه توئه؟',
    options: [
      { code: 'FAMILIAR', label: 'بیشتر چیزهایی رو انتخاب می‌کنم که از قبل می‌شناسم.' },
      { code: 'MIXED', label: 'ترکیبی از تجربه‌های آشنا و تازه رو دوست دارم.' },
      { code: 'NEW', label: 'دوست دارم چیزهای کاملاً جدید رو امتحان کنم.' },
    ],
  },

  // ─── Section 4 — Group compatibility ───────────────────────────────────
  Q10: {
    id: 'Q10',
    section: 4,
    kind: 'single',
    title: 'معمولاً کدوم مدل برنامه رو ترجیح می‌دی؟',
    options: [
      { code: 'DETAILED', label: 'برنامه دقیق و مشخص' },
      { code: 'FLEXIBLE', label: 'یه چارچوب کلی داشته باشیم ولی انعطاف هم باشه' },
      { code: 'SPONTANEOUS', label: 'همون لحظه تصمیم بگیریم' },
    ],
  },
  Q14: {
    id: 'Q14',
    section: 4,
    kind: 'single',
    title: 'اگر گروه فعالیتی رو انتخاب کنه که انتخاب اول تو نیست، معمولاً چیکار می‌کنی؟',
    options: [
      { code: 'GOES_ALONG', label: 'معمولاً همراه می‌شم و امتحانش می‌کنم.' },
      { code: 'IF_GOOD_REASON', label: 'اگه دلیل خوبی داشته باشه، موافقم.' },
      { code: 'OWN_CHOICE', label: 'ترجیح می‌دم روی انتخاب خودم بمونم.' },
    ],
  },
  Q15: {
    id: 'Q15',
    section: 4,
    kind: 'multi',
    title: 'چه زمان‌هایی معمولاً برای فعالیت اجتماعی برات مناسب‌تره؟',
    helper: 'هر چند مورد که مناسبه انتخاب کن.',
    options: [
      { code: 'MORNING', label: 'صبح' },
      { code: 'AFTERNOON', label: 'بعدازظهر' },
      { code: 'EVENING', label: 'شب' },
      { code: 'WEEKEND', label: 'آخر هفته' },
    ],
  },
  Q16: {
    id: 'Q16',
    section: 4,
    kind: 'slider',
    title: 'توی فعالیت‌های اجتماعی، کدوم طرف بیشتر شبیه توئه؟',
    minLabel: 'اقتصادی‌تر',
    maxLabel: 'کیفیت تجربه مهم‌تره',
  },
  Q17: {
    id: 'Q17',
    section: 4,
    kind: 'slider',
    title: 'توی فعالیت گروهی، زمان‌بندی چقدر برات مهمه؟',
    minLabel: 'خیلی منعطفم',
    maxLabel: 'سر وقت بودن مهمه',
  },
};

/**
 * The order the questions are shown in — four short chapters rather than the
 * source's numbering. A question's position here is its
 * `presentation_index` (1-based) and nothing more.
 */
export const QUESTIONNAIRE_ORDER: readonly QuestionId[] = [
  'Q2', 'Q4', 'Q5', 'Q19', 'Q3',
  'Q6', 'Q7', 'Q18', 'Q20', 'Q1',
  'Q8', 'Q9', 'Q11', 'Q12', 'Q13',
  'Q10', 'Q14', 'Q15', 'Q16', 'Q17',
];

/** 1-based position in `QUESTIONNAIRE_ORDER`. */
export function presentationIndexOf(questionId: QuestionId): number {
  return QUESTIONNAIRE_ORDER.indexOf(questionId) + 1;
}

/** The first slider shown — the only one that explains how to use a slider. */
export const FIRST_SLIDER_ID: QuestionId = QUESTIONNAIRE_ORDER.find(
  (id) => QUESTIONS[id].kind === 'slider'
)!;

export function isQuestionId(value: string): value is QuestionId {
  return (QUESTION_IDS as readonly string[]).includes(value);
}

/** The funnel events the questionnaire reports. `v2_onboarding_events.event`. */
export const ONBOARDING_EVENTS = [
  'quiz_started',
  'quiz_question_viewed',
  'quiz_question_answered',
  'quiz_back_clicked',
  'quiz_section_completed',
  'quiz_abandoned',
  'quiz_resumed',
  'quiz_completed',
  'quiz_result_viewed',
  'quiz_result_continue_clicked',
] as const;

export type OnboardingEventName = (typeof ONBOARDING_EVENTS)[number];
