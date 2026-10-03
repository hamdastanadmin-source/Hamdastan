import type { QuestionnaireResult, ResultDimension, ResultInsight } from '@hamdastan/types';

import type { Dimension, SocialProfile } from './onboarding.scoring';

/**
 * The result card: a short, friendly reading of the profile, made from the
 * person's actual scores.
 *
 * It is deliberately a simplification — a title, a sentence or two, three
 * plain-language insights, and five bars kept behind «جزئیات بیشتر». The profile itself (`SocialProfile`) is what matching uses and is
 * never cut down to this. No clinical vocabulary, no fixed personality
 * types: the title is built from whichever of the person's preferences are
 * furthest from the middle of their scale.
 */

type Trait = {
  dimension: Dimension;
  /** The word for each end, for the title. Null where that end says nothing friendly. */
  high: { word: string; phrase: string } | null;
  low: { word: string; phrase: string } | null;
};

/** In priority order — the tie-break when two traits are equally strong. */
const TRAITS: readonly Trait[] = [
  {
    dimension: 'SE',
    high: { word: 'پرانرژی', phrase: 'از بودن کنار آدم‌های جدید انرژی می‌گیری' },
    low: { word: 'آروم', phrase: 'جمع‌های آروم‌تر و صمیمی‌تر رو ترجیح می‌دی' },
  },
  {
    dimension: 'NV',
    high: { word: 'کنجکاو', phrase: 'دوست داری چیزهای تازه رو امتحان کنی' },
    low: { word: 'اهل تجربه‌های آشنا', phrase: 'تجربه‌های آشنا و مطمئن بیشتر بهت می‌چسبه' },
  },
  {
    dimension: 'SP',
    high: { word: 'ماجراجو', phrase: 'فعالیت‌های پرهیجان رو دوست داری' },
    low: { word: 'آرامش‌طلب', phrase: 'فعالیت‌های آروم و بی‌دغدغه رو ترجیح می‌دی' },
  },
  {
    dimension: 'AO',
    high: { word: 'اهل فعالیت', phrase: 'توی یه تجربه گروهی، خود فعالیت برات مهم‌تره' },
    low: { word: 'گفتگومحور', phrase: 'توی یه تجربه گروهی، گفتگو برات اصل ماجراست' },
  },
  {
    dimension: 'SI',
    high: { word: 'اجتماعی', phrase: 'توی جمع‌های جدید معمولاً خودت یخ رو می‌شکنی' },
    low: { word: 'شنونده', phrase: 'اول گوش می‌دی و بعد وارد گفتگو می‌شی' },
  },
  {
    dimension: 'CD',
    high: { word: 'اهل گفتگوی عمیق', phrase: 'گفتگوهای عمیق و داستان‌های واقعی رو دوست داری' },
    low: { word: 'خوش‌صحبت', phrase: 'گفتگوهای سبک و بی‌تکلف بیشتر بهت می‌چسبه' },
  },
  {
    dimension: 'ST',
    high: { word: 'برنامه‌ریز', phrase: 'با یه برنامه مشخص راحت‌تری' },
    low: { word: 'اهل بداهه', phrase: 'تصمیم‌های لحظه‌ای رو دوست داری' },
  },
  {
    dimension: 'CP',
    high: { word: 'رقابتی', phrase: 'یه کم رقابت، تجربه رو برات هیجان‌انگیزتر می‌کنه' },
    low: { word: 'اهل همکاری', phrase: 'همراهی و همکاری رو به رقابت ترجیح می‌دی' },
  },
  {
    dimension: 'FL',
    high: { word: 'منعطف', phrase: 'با تصمیم گروه راحت همراه می‌شی' },
    low: null,
  },
];

/** The middle of a 1–10 scale. */
const MIDPOINT = 5.5;
/** Closer to the middle than this, a preference is not strong enough to name. */
const MIN_STRENGTH = 1.5;

const FALLBACK = {
  title: 'متعادل و اهل تجربه',
  description: 'بین آرامش و هیجان، گفتگو و فعالیت، تعادل خوبی داری و با جمع‌های مختلف کنار میای.',
};

type Picked = { word: string; phrase: string; isHigh: boolean };

function strongestTraits(profile: SocialProfile): Picked[] {
  return TRAITS.flatMap((trait, order) => {
    const value = profile.dimensions[trait.dimension];
    if (value === null) return [];
    const isHigh = value >= MIDPOINT;
    const end = isHigh ? trait.high : trait.low;
    const strength = Math.abs(value - MIDPOINT);
    return end && strength >= MIN_STRENGTH ? [{ ...end, isHigh, strength, order }] : [];
  })
    .sort((a, b) => b.strength - a.strength || a.order - b.order)
    .map(({ word, phrase, isHigh }) => ({ word, phrase, isHigh }));
}

/** «و» when the two pull the same way, «ولی» when they pull apart — «آروم ولی کنجکاو». */
const joiner = (a: Picked, b: Picked) => (a.isHigh === b.isHigh ? ' و ' : '، ولی ');

function headline(traits: Picked[]): Pick<QuestionnaireResult, 'title' | 'description'> {
  const [first, second, third] = traits;
  if (!first) return FALLBACK;
  if (!second) {
    return { title: `${first.word} و متعادل`, description: `${first.phrase}.` };
  }

  const title = `${first.word}${joiner(first, second).replace('، ', ' ')}${second.word}`;
  const description = [
    `${first.phrase}${joiner(first, second)}${second.phrase}.`,
    third ? `${third.phrase}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return { title, description };
}

/**
 * The five bars. Two-ended scales are labelled at both ends; the label at
 * 1 sits at the reading start (right). «برنامه‌ریزی ↔ بداهه» reads from
 * the planned end, so ST is shown inverted.
 */
function bars(profile: SocialProfile): ResultDimension[] {
  const d = profile.dimensions;
  const list: (ResultDimension | null)[] = [
    d.SE === null ? null : { key: 'SE', label: 'انرژی اجتماعی', value: d.SE },
    d.NV === null ? null : { key: 'NV', label: 'تجربه‌های تازه', value: d.NV },
    d.AO === null
      ? null
      : { key: 'AO', label: 'گفتگو ↔ فعالیت', value: d.AO, minLabel: 'گفتگو', maxLabel: 'فعالیت' },
    d.CP === null ? null : { key: 'CP', label: 'رقابت', value: d.CP },
    d.ST === null
      ? null
      : {
          key: 'ST',
          label: 'برنامه‌ریزی ↔ بداهه',
          value: 11 - d.ST,
          minLabel: 'برنامه‌ریزی',
          maxLabel: 'بداهه',
        },
  ];
  return list.filter((bar): bar is ResultDimension => bar !== null);
}

/** Picks a phrase by where a 1–10 value falls: low, middle or high. */
const byLevel = (value: number, low: string, middle: string, high: string) =>
  value >= 7 ? high : value <= 4 ? low : middle;

/**
 * Three things the product learned, in words rather than numbers: where the
 * person's energy comes from (SE), what they look for in an experience (NV
 * with AO), and how they like a group to run (ST). Each reads as the end of
 * its label's sentence.
 */
function insights(profile: SocialProfile): ResultInsight[] {
  const d = profile.dimensions;
  const list: (ResultInsight | null)[] = [
    d.SE === null
      ? null
      : {
          key: 'energy',
          label: 'بیشتر انرژی می‌گیری از',
          value: byLevel(d.SE, 'جمع‌های کوچیک و آروم', 'جمع‌های صمیمی و به‌اندازه', 'آدم‌ها و تعامل'),
        },
    d.NV === null || d.AO === null
      ? null
      : {
          key: 'seeking',
          label: 'توی تجربه‌ها دنبال',
          value: `${byLevel(d.NV, 'آشنایی', 'تنوع', 'تازگی')} و ${byLevel(d.AO, 'گفتگو', 'حس خوب جمع', 'فعالیت')}`,
        },
    d.ST === null
      ? null
      : {
          key: 'structure',
          label: 'توی گروه ترجیح می‌دی',
          value: byLevel(d.ST, 'تصمیم‌های لحظه‌ای', 'ساختار منعطف', 'برنامه‌ی مشخص'),
        },
  ];
  return list.filter((insight): insight is ResultInsight => insight !== null);
}

export function buildResult(profile: SocialProfile): QuestionnaireResult {
  return {
    ...headline(strongestTraits(profile)),
    insights: insights(profile),
    dimensions: bars(profile),
  };
}
