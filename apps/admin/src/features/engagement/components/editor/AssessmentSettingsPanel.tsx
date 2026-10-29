'use client';

import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';

import { ENGAGEMENT_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityQuestion, AssessmentDimension, AssessmentProfile, AssessmentSettings, Gender, ProfileTieBreak } from '@hamdastan/types';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea } from '@hamdastan/ui';

import { MediaField } from '@/features/media';

import { newKey } from '../../utils/draft';
import { Field, invalid, SwitchRow } from './Field';

const GENDERS: { gender: Gender; label: string }[] = [
  { gender: 'male', label: 'مرد' },
  { gender: 'female', label: 'زن' },
];

/** The assessment's scoring: its mode, its dimensions, pass mark or profiles, and whether people see a result. */
export function AssessmentSettingsPanel({
  settings,
  errors,
  questions,
  competition = false,
  onChange,
}: {
  settings: AssessmentSettings;
  errors: Record<string, string>;
  /** Every question of the activity, in order: a profile assessment picks its priority questions from them. */
  questions: ActivityQuestion[];
  /** A competition is always a knowledge quiz: no mode to choose. */
  competition?: boolean;
  onChange: (settings: AssessmentSettings) => void;
}) {
  const dimensionsError = errors['definition.assessment.dimensions'];
  const setDimension = (id: string, patch: Partial<AssessmentDimension>) =>
    onChange({ ...settings, dimensions: settings.dimensions.map((d) => (d.id === id ? { ...d, ...patch } : d)) });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 border-b pb-4">
        <h3 className="text-base font-semibold">روش محاسبه‌ی نتیجه</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {competition
            ? 'هر سؤال گزینه‌ای یک پاسخ درست دارد و نمره، درصد پاسخ‌های درست است. رتبه با نمره و سپس با زمان از «شروع» تا ثبت تعیین می‌شود.'
            : 'دانشی: هر سؤال گزینه‌ای یک پاسخ درست دارد و نمره، درصد پاسخ‌های درست است. شخصیت‌شناسی: هر گزینه می‌تواند به یک یا چند بُعد امتیاز بدهد و بُعدی که بیشترین امتیاز را بگیرد، نتیجه است. پروفایل‌سنجی: هر گزینه برای هر پروفایل وزنی دارد و پروفایلی که بیشترین امتیاز وزن‌دار را بگیرد، نتیجه است.'}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {!competition && (
          <Field label="نوع آزمون" htmlFor="assessment-mode">
            <Select
              value={settings.mode}
              onValueChange={(mode) =>
                onChange(
                  mode === 'profile'
                    ? {
                        ...settings,
                        mode,
                        profiles: settings.profiles ?? [],
                        tieBreak: settings.tieBreak ?? { priorityQuestionIds: [], defaultProfileId: null },
                      }
                    : { ...settings, mode: mode as AssessmentSettings['mode'] }
                )
              }
            >
              <SelectTrigger id="assessment-mode" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="knowledge">دانش و مهارت</SelectItem>
                <SelectItem value="personality">شخصیت‌شناسی</SelectItem>
                <SelectItem value="profile">پروفایل‌سنجی (وزن‌دار)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        {settings.mode === 'knowledge' ? (
          <Field
            label="حداقل نمره‌ی قبولی (٪، اختیاری)"
            htmlFor="passing-score"
            hint="اگر خالی بماند، آزمون قبولی و ردی ندارد."
            error={errors['definition.assessment.passingScore']}
          >
            <Input
              id="passing-score"
              type="number"
              min={0}
              max={100}
              className="w-28 tabular-nums"
              value={settings.passingScore ?? ''}
              onChange={(event) =>
                onChange({
                  ...settings,
                  passingScore: event.target.value === '' ? null : Math.min(100, Math.max(0, Math.trunc(Number(event.target.value)))),
                })
              }
            />
          </Field>
        ) : settings.mode === 'profile' ? (
          <ProfileSettings
            profiles={settings.profiles ?? []}
            tieBreak={settings.tieBreak ?? { priorityQuestionIds: [], defaultProfileId: null }}
            questions={questions}
            errors={errors}
            onChange={(profiles, tieBreak) => onChange({ ...settings, profiles, tieBreak })}
          />
        ) : (
          <Field
            label="ابعاد ارزیابی"
            error={dimensionsError}
            hint="تصویر هر بُعد (اختیاری) همراه نتیجه به کاربری نمایش داده می‌شود که در آن بُعد قرار می‌گیرد. با «تصویر متفاوت بر اساس جنسیت»، مرد و زن هر کدام تصویر خودشان را می‌بینند؛ اگر جنسیت کاربر مشخص نباشد یا تصویرش انتخاب نشده باشد، تصویر عمومی بُعد نمایش داده می‌شود. امتیاز هر گزینه برای هر بُعد در ویرایش همان سؤال تعیین می‌شود."
          >
            <ul className="flex flex-col gap-3">
              {settings.dimensions.map((dimension, index) => (
                <li key={dimension.id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={dimension.title}
                      placeholder={`عنوان بُعد ${toPersianDigits(index + 1)} — مثلاً «اجتماعی»`}
                      aria-label={`عنوان بُعد ${toPersianDigits(index + 1)}`}
                      onChange={(event) => setDimension(dimension.id, { title: event.target.value })}
                      {...invalid(errors[`definition.assessment.dimensions.${index}.title`])}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onChange({ ...settings, dimensions: settings.dimensions.filter((d) => d.id !== dimension.id) })}
                      aria-label={`حذف بُعد ${toPersianDigits(index + 1)}`}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    value={dimension.description}
                    placeholder="متنی که کاربر در صورت قرار گرفتن در این بُعد می‌بیند"
                    aria-label={`توضیح بُعد ${toPersianDigits(index + 1)}`}
                    onChange={(event) => setDimension(dimension.id, { description: event.target.value })}
                  />
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor={`gendered-images-${dimension.id}`}>تصویر متفاوت بر اساس جنسیت</Label>
                    <Switch
                      id={`gendered-images-${dimension.id}`}
                      checked={Boolean(dimension.genderedImages)}
                      onCheckedChange={(genderedImages) => setDimension(dimension.id, { genderedImages })}
                    />
                  </div>
                  {dimension.genderedImages ? (
                    GENDERS.map(({ gender, label }) => (
                      <Field key={gender} label={`تصویر نتیجه برای ${label}`}>
                        <MediaField
                          value={dimension.genderImageIds?.[gender]}
                          onChange={(imageId) =>
                            setDimension(dimension.id, {
                              genderImageIds: { ...dimension.genderImageIds, [gender]: imageId ?? undefined },
                            })
                          }
                          kind="image"
                          category="result"
                          pickerTitle={`تصویر ${dimension.title || `بُعد ${toPersianDigits(index + 1)}`} برای ${label}`}
                          invalid={Boolean(errors[`definition.assessment.dimensions.${index}.genderImageIds.${gender}`])}
                        />
                      </Field>
                    ))
                  ) : (
                    <MediaField
                      value={dimension.imageId}
                      onChange={(imageId) => setDimension(dimension.id, { imageId: imageId ?? undefined })}
                      kind="image"
                      category="result"
                      pickerTitle={`تصویر ${dimension.title || `بُعد ${toPersianDigits(index + 1)}`}`}
                      invalid={Boolean(errors[`definition.assessment.dimensions.${index}.imageId`])}
                    />
                  )}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={settings.dimensions.length >= ENGAGEMENT_LIMITS.DIMENSIONS_MAX}
              onClick={() =>
                onChange({ ...settings, dimensions: [...settings.dimensions, { id: newKey(), title: '', description: '' }] })
              }
            >
              <Plus aria-hidden="true" />
              بُعد جدید
            </Button>
          </Field>
        )}

        <SwitchRow id="show-result" label="نمایش نتیجه به کاربر" hint="اگر خاموش باشد، کاربر فقط پیام تکمیل را می‌بیند.">
          <Switch
            id="show-result"
            checked={settings.showResult}
            onCheckedChange={(showResult) => onChange({ ...settings, showResult })}
          />
        </SwitchRow>

        {settings.mode === 'knowledge' && (
          <SwitchRow
            id="reveal-answers"
            label="نمایش پاسخ درست و توضیح هر سؤال"
            hint={
              competition
                ? 'پس از پایان مسابقه، هر شرکت‌کننده پاسخ درست و توضیح هر سؤال را می‌بیند — نه زودتر، تا به کسی که هنوز بازی می‌کند نرسد.'
                : 'وقتی کاربر از همه‌ی دفعات مجاز استفاده کرد، پاسخ درست و توضیح هر سؤال را می‌بیند.'
            }
          >
            <Switch
              id="reveal-answers"
              checked={settings.revealAnswers}
              onCheckedChange={(revealAnswers) => onChange({ ...settings, revealAnswers })}
            />
          </SwitchRow>
        )}
      </div>
    </div>
  );
}

/**
 * A profile assessment's results and its tie rules. Removing a profile
 * takes it out of the default too; its weights on options are dropped by
 * the question editor's matrix, which only shows profiles that exist, and
 * refused on save if left behind.
 */
function ProfileSettings({
  profiles,
  tieBreak,
  questions,
  errors,
  onChange,
}: {
  profiles: AssessmentProfile[];
  tieBreak: ProfileTieBreak;
  questions: ActivityQuestion[];
  errors: Record<string, string>;
  onChange: (profiles: AssessmentProfile[], tieBreak: ProfileTieBreak) => void;
}) {
  const choices = questions.filter((question) => question.kind === 'single' || question.kind === 'multiple');
  const questionLabel = (id: string) => {
    const index = questions.findIndex((question) => question.id === id);
    if (index < 0) return 'سؤال حذف‌شده';
    return `سؤال ${toPersianDigits(index + 1)}: ${questions[index].title || 'بی‌عنوان'}`;
  };
  const available = choices.filter((question) => !tieBreak.priorityQuestionIds.includes(question.id));

  const setProfiles = (next: AssessmentProfile[]) =>
    onChange(next, {
      ...tieBreak,
      defaultProfileId: next.some((profile) => profile.id === tieBreak.defaultProfileId) ? tieBreak.defaultProfileId : null,
    });
  const setPriority = (priorityQuestionIds: string[]) => onChange(profiles, { ...tieBreak, priorityQuestionIds });
  const movePriority = (index: number, offset: -1 | 1) => {
    const next = [...tieBreak.priorityQuestionIds];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setPriority(next);
  };

  return (
    <>
      <Field
        label="پروفایل‌های نتیجه"
        error={errors['definition.assessment.profiles']}
        hint="وزن هر گزینه برای هر پروفایل در ویرایش همان سؤال تعیین می‌شود."
      >
        <ul className="flex flex-col gap-3">
          {profiles.map((profile, index) => (
            <li key={profile.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={profile.title}
                  placeholder={`عنوان پروفایل ${toPersianDigits(index + 1)} — مثلاً «رهبر»`}
                  aria-label={`عنوان پروفایل ${toPersianDigits(index + 1)}`}
                  onChange={(event) =>
                    setProfiles(profiles.map((p) => (p.id === profile.id ? { ...p, title: event.target.value } : p)))
                  }
                  {...invalid(errors[`definition.assessment.profiles.${index}.title`])}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setProfiles(profiles.filter((p) => p.id !== profile.id))}
                  aria-label={`حذف پروفایل ${toPersianDigits(index + 1)}`}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              <Textarea
                rows={2}
                value={profile.description}
                placeholder="متنی که کاربر در صورت قرار گرفتن در این پروفایل می‌بیند"
                aria-label={`توضیح پروفایل ${toPersianDigits(index + 1)}`}
                onChange={(event) =>
                  setProfiles(profiles.map((p) => (p.id === profile.id ? { ...p, description: event.target.value } : p)))
                }
              />
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={profiles.length >= ENGAGEMENT_LIMITS.PROFILES_MAX}
          onClick={() => setProfiles([...profiles, { id: newKey(), title: '', description: '' }])}
        >
          <Plus aria-hidden="true" />
          پروفایل جدید
        </Button>
      </Field>

      <div className="flex flex-col gap-1 border-t pt-4">
        <h4 className="text-sm font-semibold">قوانین حل تساوی</h4>
        <p className="text-xs leading-relaxed text-muted-foreground">
          اگر چند پروفایل بالاترین امتیاز را با هم داشته باشند، ابتدا سؤال‌های اولویت‌دار به ترتیب بررسی می‌شوند: از بین پروفایل‌های
          مساوی، آن‌هایی که در آن سؤال امتیاز بیشتری گرفته‌اند باقی می‌مانند. اگر باز هم تساوی ماند، پروفایل پیش‌فرض نتیجه است.
        </p>
      </div>

      <Field
        label="۱. سؤال‌های اولویت‌دار (اختیاری)"
        error={errors['definition.assessment.tieBreak.priorityQuestionIds']}
        hint="فقط سؤال‌های تک‌گزینه‌ای و چندگزینه‌ای. ترتیب فهرست، ترتیب بررسی است."
      >
        {tieBreak.priorityQuestionIds.length > 0 && (
          <ol className="flex flex-col gap-2">
            {tieBreak.priorityQuestionIds.map((id, index) => (
              <li key={id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
                <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{toPersianDigits(index + 1)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{questionLabel(id)}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === 0}
                  onClick={() => movePriority(index, -1)}
                  aria-label="بالاتر"
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === tieBreak.priorityQuestionIds.length - 1}
                  onClick={() => movePriority(index, 1)}
                  aria-label="پایین‌تر"
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPriority(tieBreak.priorityQuestionIds.filter((questionId) => questionId !== id))}
                  aria-label={`حذف از اولویت‌ها: ${questionLabel(id)}`}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ol>
        )}
        <Select value="" onValueChange={(id) => setPriority([...tieBreak.priorityQuestionIds, id])} disabled={available.length === 0}>
          <SelectTrigger className="w-full sm:w-80" aria-label="افزودن سؤال اولویت‌دار">
            <SelectValue placeholder={available.length ? 'افزودن سؤال اولویت‌دار' : 'سؤال گزینه‌ای دیگری نیست'} />
          </SelectTrigger>
          <SelectContent>
            {available.map((question) => (
              <SelectItem key={question.id} value={question.id}>
                {questionLabel(question.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="۲. پروفایل پیش‌فرض"
        htmlFor="default-profile"
        error={errors['definition.assessment.tieBreak.defaultProfileId']}
        hint="اگر بعد از سؤال‌های اولویت‌دار هنوز تساوی بود، این پروفایل نتیجه است."
      >
        <Select
          value={tieBreak.defaultProfileId ?? ''}
          onValueChange={(defaultProfileId) => onChange(profiles, { ...tieBreak, defaultProfileId })}
        >
          <SelectTrigger
            id="default-profile"
            className="w-full sm:w-80"
            {...invalid(errors['definition.assessment.tieBreak.defaultProfileId'])}
          >
            <SelectValue placeholder="انتخاب پروفایل" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((profile, index) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.title || `پروفایل ${toPersianDigits(index + 1)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}
