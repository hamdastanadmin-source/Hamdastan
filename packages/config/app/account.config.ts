/**
 * The account area — levels, missions, the avatar catalog and the profile
 * fields' limits.
 *
 * Shared by `apps/api`, which decides (who has earned what, which item may be
 * worn) and `apps/web`, which only displays. Like the interest catalog, none
 * of this is a table: an id outside these lists is refused by the API.
 */

// ─── Levels ──────────────────────────────────────────────────────────────────

/**
 * The XP at which each level starts: level 1 at 0, level 2 at 100, and so
 * on. The last entry is the top level, which has no "next".
 */
export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000] as const;

// ─── Missions ────────────────────────────────────────────────────────────────

export const MISSION_IDS = ['personality_test', 'avatar_created', 'profile_completed'] as const;
export type MissionId = (typeof MISSION_IDS)[number];

export type MissionDefinition = {
  id: MissionId;
  /** What to do — on an open mission. */
  title: string;
  /** What was done — on a finished mission, and in the XP history. */
  doneTitle: string;
  description: string;
  xpReward: number;
  ctaLabel: string;
  ctaHref: string;
};

/**
 * In the order they are offered. A mission is finished exactly when the XP
 * ledger holds its reward — that row is also what stops it paying twice.
 */
export const MISSIONS: readonly MissionDefinition[] = [
  {
    id: 'personality_test',
    title: 'آزمون کوتاه شخصیت',
    doneTitle: 'آزمون شخصیت',
    description: 'چند سؤال کوتاه جواب بده تا بهتر بشناسیمت.',
    xpReward: 50,
    ctaLabel: 'شروع آزمون',
    ctaHref: '/onboarding/questionnaire',
  },
  {
    id: 'avatar_created',
    title: 'آواتارت رو بساز',
    doneTitle: 'ساخت آواتار',
    description: 'لباس و استایل خودت رو انتخاب کن.',
    xpReward: 20,
    ctaLabel: 'ساخت آواتار',
    ctaHref: '/profile/avatar',
  },
  {
    id: 'profile_completed',
    title: 'پروفایلت رو کامل کن',
    doneTitle: 'تکمیل پروفایل',
    description: 'یه نام کاربری و شهرت رو اضافه کن.',
    xpReward: 20,
    ctaLabel: 'تکمیل پروفایل',
    ctaHref: '/profile/edit',
  },
];

export const MISSION_BY_ID: ReadonlyMap<MissionId, MissionDefinition> = new Map(
  MISSIONS.map((mission) => [mission.id, mission])
);

// ─── Badges ──────────────────────────────────────────────────────────────────

/** Icon keys; `apps/web` maps each to its drawing, so a new key needs one line there. */
export const BADGE_ICONS = ['sparkles', 'palette', 'id-card'] as const;
export type BadgeIcon = (typeof BADGE_ICONS)[number];

export type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  icon: BadgeIcon;
  /** Earned once every one of these missions is done. */
  requires: readonly MissionId[];
};

/**
 * In the order they are shown. Like a mission, a badge is not stored: it is
 * earned exactly when its missions are, so a badge added here is granted at
 * once to everyone who already qualifies. Adding one is an entry here and
 * nothing else.
 */
export const BADGES: readonly BadgeDefinition[] = [
  {
    id: 'self_aware',
    title: 'خودشناس',
    description: 'آزمون شخصیت رو تموم کردی.',
    icon: 'sparkles',
    requires: ['personality_test'],
  },
  {
    id: 'stylist',
    title: 'خوش‌استایل',
    description: 'آواتار خودت رو ساختی.',
    icon: 'palette',
    requires: ['avatar_created'],
  },
  {
    id: 'introduced',
    title: 'معرفی‌شده',
    description: 'پروفایلت رو کامل کردی.',
    icon: 'id-card',
    requires: ['profile_completed'],
  },
];

/** What the questionnaire's cards say it takes. */
export const QUESTIONNAIRE_DURATION_LABEL = 'حدود ۵ دقیقه';

// ─── Profile fields ──────────────────────────────────────────────────────────

export const ACCOUNT_LIMITS = {
  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 30,
  USERNAME_MIN: 3,
  USERNAME_MAX: 20,
  CITY_MIN: 2,
  CITY_MAX: 40,
  BIO_MAX: 160,
} as const;

// ─── Avatar ──────────────────────────────────────────────────────────────────

export const AVATAR_SLOTS = ['base', 'top', 'bottom', 'shoes', 'accessory'] as const;
export type AvatarSlot = (typeof AVATAR_SLOTS)[number];

export type AvatarItem = {
  id: string;
  label: string;
  /**
   * The level that unlocks the item. Absent means always available. The API
   * refuses a locked item; nothing in today's catalog is locked.
   */
  unlockLevel?: number;
};

export const AVATAR_CATALOG: Readonly<Record<AvatarSlot, readonly AvatarItem[]>> = {
  base: [
    { id: 'base-1', label: 'روشن' },
    { id: 'base-2', label: 'گندمی' },
    { id: 'base-3', label: 'سبزه' },
    { id: 'base-4', label: 'تیره' },
  ],
  top: [
    { id: 'tee', label: 'تی‌شرت' },
    { id: 'shirt', label: 'پیراهن' },
    { id: 'hoodie', label: 'هودی' },
    { id: 'jacket', label: 'کاپشن' },
  ],
  bottom: [
    { id: 'jeans', label: 'جین' },
    { id: 'chinos', label: 'کتان' },
    { id: 'shorts', label: 'شلوارک' },
    { id: 'skirt', label: 'دامن' },
  ],
  shoes: [
    { id: 'sneakers', label: 'کتونی' },
    { id: 'boots', label: 'بوت' },
    { id: 'loafers', label: 'کالج' },
  ],
  accessory: [
    { id: 'none', label: 'هیچ' },
    { id: 'glasses', label: 'عینک' },
    { id: 'cap', label: 'کلاه' },
    { id: 'headphones', label: 'هدفون' },
  ],
};

export type AvatarConfig = Record<AvatarSlot, string>;

/** Shown until the person saves their own. */
export const DEFAULT_AVATAR: AvatarConfig = {
  base: 'base-2',
  top: 'tee',
  bottom: 'jeans',
  shoes: 'sneakers',
  accessory: 'none',
};

// ─── Settings ────────────────────────────────────────────────────────────────

export type AccountSettings = {
  /** Mission and progress notifications. */
  notifications: boolean;
  /** Whether other people may see the social-profile summary. */
  showSocialProfile: boolean;
};

export const DEFAULT_SETTINGS: AccountSettings = {
  notifications: true,
  showSocialProfile: true,
};
