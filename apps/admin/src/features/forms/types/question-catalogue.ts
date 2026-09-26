import {
  AlignLeft,
  AtSign,
  CalendarDays,
  CheckSquare,
  ChevronDownSquare,
  Clock,
  FileUp,
  Gauge,
  Grid3x3,
  Hash,
  Heading,
  Image as ImageIcon,
  Link as LinkIcon,
  ListOrdered,
  Minus,
  PenLine,
  Phone,
  SlidersHorizontal,
  SplitSquareVertical,
  Star,
  Text,
  ThumbsUp,
  ToggleLeft,
  Images,
  Type,
} from 'lucide-react';
import type { ComponentType } from 'react';

import type { FormQuestion, QuestionType } from '@hamdastan/types';

/**
 * The question library — what the builder's palette offers, and what each of
 * those things is when it lands on the canvas.
 *
 * One catalogue, so the palette, the "change type" menu and the defaults a new
 * question starts with cannot drift apart. Adding a type is an entry here plus
 * a branch in `QuestionField` (the design system renders it) and, if it needs
 * settings of its own, one in the configuration panel.
 *
 * `PAGE_BREAK` is deliberately absent: pages are first-class in the document,
 * so the palette's «صفحهٔ جدید» adds a page rather than a pretend question.
 */

export type PaletteItem = {
  type: QuestionType;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export type PaletteGroup = {
  title: string;
  items: PaletteItem[];
};

export const QUESTION_GROUPS: PaletteGroup[] = [
  {
    title: 'متنی',
    items: [
      { type: 'SHORT_TEXT', label: 'متن کوتاه', icon: Type },
      { type: 'LONG_TEXT', label: 'متن بلند', icon: AlignLeft },
      { type: 'NUMBER', label: 'عدد', icon: Hash },
      { type: 'EMAIL', label: 'ایمیل', icon: AtSign },
      { type: 'PHONE', label: 'شماره تماس', icon: Phone },
      { type: 'URL', label: 'نشانی وب', icon: LinkIcon },
    ],
  },
  {
    title: 'انتخابی',
    items: [
      { type: 'SINGLE_CHOICE', label: 'تک‌انتخابی', icon: CheckSquare },
      { type: 'MULTIPLE_CHOICE', label: 'چندانتخابی', icon: ListOrdered },
      { type: 'DROPDOWN', label: 'فهرست کشویی', icon: ChevronDownSquare },
      { type: 'IMAGE_CHOICE', label: 'انتخاب تصویری', icon: Images },
      { type: 'YES_NO', label: 'بله / خیر', icon: ToggleLeft },
    ],
  },
  {
    title: 'امتیازی',
    items: [
      { type: 'RATING_STARS', label: 'امتیاز ستاره‌ای', icon: Star },
      { type: 'NUMERIC_SCALE', label: 'طیف عددی', icon: Gauge },
      { type: 'NPS', label: 'شاخص NPS', icon: ThumbsUp },
      { type: 'SLIDER', label: 'اسلایدر', icon: SlidersHorizontal },
      { type: 'RANKING', label: 'اولویت‌بندی', icon: ListOrdered },
    ],
  },
  {
    title: 'پیشرفته',
    items: [
      { type: 'DATE', label: 'تاریخ', icon: CalendarDays },
      { type: 'TIME', label: 'ساعت', icon: Clock },
      { type: 'FILE_UPLOAD', label: 'بارگذاری فایل', icon: FileUp },
      { type: 'MATRIX', label: 'ماتریس', icon: Grid3x3 },
      { type: 'SIGNATURE', label: 'امضا', icon: PenLine },
    ],
  },
  {
    title: 'چیدمان',
    items: [
      { type: 'HEADING', label: 'عنوان', icon: Heading },
      { type: 'DESCRIPTION', label: 'متن توضیحی', icon: Text },
      { type: 'DIVIDER', label: 'جداکننده', icon: Minus },
      { type: 'IMAGE', label: 'تصویر', icon: ImageIcon },
    ],
  },
];

const BY_TYPE = new Map(
  QUESTION_GROUPS.flatMap((group) => group.items).map((item) => [item.type, item])
);

export function paletteItem(type: QuestionType): PaletteItem {
  return BY_TYPE.get(type) ?? { type, label: type, icon: Type };
}

/** The icon for «صفحهٔ جدید», which adds a page rather than a question. */
export const PageBreakIcon = SplitSquareVertical;

/** A new id. `crypto.randomUUID` is in every browser this app supports. */
export function newId(): string {
  return crypto.randomUUID();
}

function option(label: string) {
  return { id: newId(), label };
}

/**
 * A new question of this type, with the defaults that make it usable the moment
 * it lands: a choice question already has options, a scale already has ends.
 *
 * An empty title on purpose — the author types it, and publishing is what
 * refuses a form whose questions say nothing.
 */
export function createQuestion(
  type: QuestionType,
  pageId: string,
  order: number
): FormQuestion {
  const base: FormQuestion = {
    id: newId(),
    pageId,
    type,
    title: defaultTitle(type),
    required: false,
    order,
  };

  switch (type) {
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
    case 'DROPDOWN':
    case 'RANKING':
      return { ...base, options: [option('گزینهٔ ۱'), option('گزینهٔ ۲'), option('گزینهٔ ۳')] };

    case 'IMAGE_CHOICE':
      return { ...base, options: [option('تصویر ۱'), option('تصویر ۲')] };

    case 'YES_NO':
      return { ...base, options: [option('بله'), option('خیر')] };

    case 'RATING_STARS':
      return { ...base, validation: { scaleMax: 5 } };

    case 'NUMERIC_SCALE':
      return {
        ...base,
        validation: { scaleMax: 10, minLabel: 'کم', maxLabel: 'زیاد' },
      };

    case 'NPS':
      return { ...base, validation: { minLabel: 'اصلاً', maxLabel: 'حتماً' } };

    case 'SLIDER':
      return { ...base, validation: { min: 0, max: 100, step: 1 } };

    case 'LONG_TEXT':
      return { ...base, placeholder: 'پاسخ خود را بنویسید…', validation: { maxLength: 1000 } };

    case 'FILE_UPLOAD':
      return {
        ...base,
        validation: { allowedFileTypes: ['pdf', 'jpg', 'png'], maxFileSizeMb: 5 },
      };

    case 'MATRIX':
      return {
        ...base,
        settings: {
          rows: ['سطر ۱', 'سطر ۲'],
          columns: ['ستون ۱', 'ستون ۲', 'ستون ۳'],
        },
      };

    default:
      return base;
  }
}

/** Layout blocks carry their own text, so they start with something readable. */
function defaultTitle(type: QuestionType): string {
  switch (type) {
    case 'HEADING':
      return 'عنوان بخش';
    case 'DESCRIPTION':
      return 'متن توضیحی برای پاسخ‌دهنده';
    case 'DIVIDER':
      return 'جداکننده';
    case 'IMAGE':
      return 'تصویر';
    default:
      return '';
  }
}
