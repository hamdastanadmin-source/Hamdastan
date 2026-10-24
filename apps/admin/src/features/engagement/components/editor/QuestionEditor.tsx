'use client';

import { ArrowDown, ArrowLeftRight, ArrowUp, Copy, Plus, Trash2, X } from 'lucide-react';

import {
  ENGAGEMENT_LIMITS,
  EXPLANATION_MAX,
  MOTION_DURATION,
  QUESTION_KIND_LABELS,
  QUESTION_KINDS,
  SCORED_KINDS,
  UNDIMENSIONED_KINDS,
  UNSCORED_LABEL,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityQuestion, AssessmentSettings, ChoiceOption, JourneyTrait, MatchingPair } from '@hamdastan/types';
import { motionOff } from '@hamdastan/validation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from '@hamdastan/ui';

import { MediaField, MotionSettingField } from '@/features/media';

import { emptyPair, emptyQuestion, newKey } from '../../utils/draft';
import { QUESTION_KIND_UI } from '../../utils/question-kinds';
import { Field, invalid, motionErrors, NEUTRAL_CHECKBOX, SwitchRow } from './Field';
import { OptionProfileWeights } from './OptionProfileWeights';
import { OptionTraitPoints } from './OptionTraitPoints';

/** The chosen position is told by a foreground border — never the brand colour. */
const POSITION = 'px-3 data-[state=on]:border-foreground data-[state=on]:bg-accent';

type QuestionEditorProps = {
  question: ActivityQuestion;
  number: number;
  /** Where its errors are filed, e.g. `definition.steps.0.questions.2`. */
  path: string;
  errors: Record<string, string>;
  /** The assessment being built, if any: decides the key and scoring fields. */
  assessment: AssessmentSettings | null;
  /** Mission: the step it belongs to, shown above it. */
  stepTitle?: string;
  /** A journey question can set its own motion after an answer. */
  journey?: boolean;
  /** A journey with a character card: the traits its options can give points to. */
  traits?: JourneyTrait[];
  onChange: (question: ActivityQuestion) => void;
  onDuplicate: (() => void) | null;
  onRemove: (() => void) | null;
};

/**
 * The selected question, in the builder's editing panel — beside the list
 * that orders, duplicates and removes them (Porsline's layout). The kinds are the ones the product's player
 * draws with its existing controls: options as toggle rows, a rating as a
 * row of numbers, a scale as the slider, text as a text area, matching as
 * two columns of tiles to pair.
 *
 * In a knowledge assessment each option can be marked correct; in a
 * personality assessment each question is tied to a dimension, can be
 * reverse-keyed, and each option carries points.
 */
export function QuestionEditor({
  question,
  number,
  path,
  errors,
  assessment,
  stepTitle,
  journey = false,
  traits = [],
  onChange,
  onDuplicate,
  onRemove,
}: QuestionEditorProps) {
  const id = `q-${question.id}`;
  const error = (field: string) => errors[`${path}.${field}`];
  const knowledge = assessment?.mode === 'knowledge';
  const imageOptions = 'options' in question && question.optionStyle === 'image';
  const personality = assessment?.mode === 'personality';
  const profile = assessment?.mode === 'profile';
  const unscored = assessment !== null && !SCORED_KINDS[assessment.mode].includes(question.kind);

  const setOptions = (options: ChoiceOption[]) =>
    (question.kind === 'single' || question.kind === 'multiple') && onChange({ ...question, options });
  const moveOption = (index: number, offset: -1 | 1) => {
    if (question.kind !== 'single' && question.kind !== 'multiple') return;
    const options = [...question.options];
    [options[index], options[index + offset]] = [options[index + offset], options[index]];
    setOptions(options);
  };
  const setPairs = (pairs: MatchingPair[]) => question.kind === 'matching' && onChange({ ...question, pairs });

  const KindIcon = QUESTION_KIND_UI[question.kind].icon;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 border-b pb-4">
        <span className="flex size-9 items-center justify-center rounded-md bg-muted">
          <KindIcon aria-hidden="true" className="size-4" />
        </span>
        <div className="flex flex-col">
          <h3 className="text-base font-semibold">سؤال {toPersianDigits(number)}</h3>
          {stepTitle && <span className="text-xs text-muted-foreground">{stepTitle}</span>}
        </div>
        {!question.required && <Badge variant="outline">اختیاری</Badge>}
        {unscored && <Badge variant="outline">{UNSCORED_LABEL}</Badge>}
        <div className="ms-auto flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!onDuplicate}
            onClick={() => onDuplicate?.()}
            aria-label="تکثیر سؤال"
          >
            <Copy aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!onRemove}
            onClick={() => onRemove?.()}
            aria-label="حذف سؤال"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field
          label="نوع سؤال"
          htmlFor={`${id}-kind`}
          hint={
            unscored && assessment
              ? `پرسیده و ثبت می‌شود، اما در ${knowledge ? 'امتیاز و رتبه‌بندی' : 'نتیجه'} اثری ندارد؛ در این روش فقط سؤال‌های ${SCORED_KINDS[assessment.mode].map((kind) => QUESTION_KIND_LABELS[kind]).join('، ')} حساب می‌شوند.`
              : undefined
          }
        >
          <Select
            value={question.kind}
            onValueChange={(kind) => onChange(emptyQuestion(kind as ActivityQuestion['kind'], question))}
          >
            <SelectTrigger id={`${id}-kind`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_KINDS.map((kind) => {
                const Icon = QUESTION_KIND_UI[kind].icon;
                return (
                  <SelectItem key={kind} value={kind}>
                    <Icon aria-hidden="true" />
                    {QUESTION_KIND_LABELS[kind]}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </Field>
        <label className="flex h-9 items-center gap-2 text-sm">
          <Switch
            checked={question.required}
            onCheckedChange={(required) => onChange({ ...question, required })}
            aria-label="الزامی"
          />
          پاسخ الزامی
        </label>
      </div>

        <Field label="تصویر سؤال (اختیاری)" error={error('imageId')} hint="به‌صورت کامل و بدون برش یا کشیدگی نمایش داده می‌شود.">
          <MediaField
            value={question.imageId}
            onChange={(imageId) =>
              // Without an image there is no position to keep.
              onChange({ ...question, imageId: imageId ?? undefined, imagePosition: imageId ? question.imagePosition : undefined })
            }
            kind="image"
            category="question"
            pickerTitle="تصویر سؤال"
            invalid={Boolean(error('imageId'))}
          />
          {question.imageId && (
            <div className="flex flex-wrap items-center gap-3">
              <span id={`${id}-image-position`} className="text-sm text-muted-foreground">
                جای تصویر
              </span>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={question.imagePosition ?? 'above'}
                onValueChange={(value) =>
                  value && onChange({ ...question, imagePosition: value === 'below' ? 'below' : undefined })
                }
                aria-labelledby={`${id}-image-position`}
              >
                <ToggleGroupItem value="above" className={POSITION}>
                  بالای متن سؤال
                </ToggleGroupItem>
                <ToggleGroupItem value="below" className={POSITION}>
                  زیر متن، بالای گزینه‌ها
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}
        </Field>

        <Field label="متن سؤال" htmlFor={`${id}-title`} error={error('title')}>
          <Input
            id={`${id}-title`}
            value={question.title}
            onChange={(event) => onChange({ ...question, title: event.target.value })}
            {...invalid(error('title'))}
          />
        </Field>
        <Field label="توضیح (اختیاری)" htmlFor={`${id}-description`}>
          <Textarea
            id={`${id}-description`}
            rows={2}
            value={question.description ?? ''}
            onChange={(event) => onChange({ ...question, description: event.target.value || undefined })}
          />
        </Field>

        {(question.kind === 'single' || question.kind === 'multiple') && (
          <div className="flex flex-wrap items-center gap-3">
            <span id={`${id}-option-style`} className="text-sm text-muted-foreground">
              نوع گزینه‌ها
            </span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={question.optionStyle ?? 'text'}
              onValueChange={(value) =>
                value && onChange({ ...question, optionStyle: value === 'image' ? 'image' : undefined })
              }
              aria-labelledby={`${id}-option-style`}
            >
              <ToggleGroupItem value="text" className={POSITION}>
                متنی
              </ToggleGroupItem>
              <ToggleGroupItem value="image" className={POSITION}>
                تصویری
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}

        {(question.kind === 'single' || question.kind === 'multiple') && (
          <Field
            label="گزینه‌ها"
            error={error('options')}
            hint={imageOptions ? 'هر گزینه یک تصویر است. نام گزینه به کاربر نمایش داده نمی‌شود و فقط در نتایج می‌آید.' : undefined}
          >
            <ul className="flex flex-col gap-2">
              {question.options.map((option, index) => (
                <li key={option.id} className={imageOptions ? 'flex flex-col gap-2 rounded-lg border p-2' : undefined}>
                  <div className="flex items-center gap-2">
                    {knowledge && (
                      <Checkbox
                        checked={option.correct ?? false}
                        onCheckedChange={(checked) =>
                          setOptions(
                            question.options.map((o) =>
                              o.id === option.id
                                ? { ...o, correct: checked === true }
                                : question.kind === 'single' && checked === true
                                  ? { ...o, correct: false }
                                  : o
                            )
                          )
                        }
                        aria-label={`گزینه‌ی ${toPersianDigits(index + 1)} درست است`}
                        className={NEUTRAL_CHECKBOX}
                      />
                    )}
                    <Input
                      value={option.label}
                      placeholder={imageOptions ? `نام گزینه‌ی ${toPersianDigits(index + 1)} (اختیاری)` : `گزینه‌ی ${toPersianDigits(index + 1)}`}
                      aria-label={`${imageOptions ? 'نام' : 'متن'} گزینه‌ی ${toPersianDigits(index + 1)}`}
                      onChange={(event) =>
                        setOptions(question.options.map((o) => (o.id === option.id ? { ...o, label: event.target.value } : o)))
                      }
                      {...invalid(error(`options.${index}.label`))}
                    />
                    {personality && (
                      <Input
                        type="number"
                        min={-10}
                        max={10}
                        className="w-20 tabular-nums"
                        value={option.score ?? 0}
                        aria-label={`امتیاز گزینه‌ی ${toPersianDigits(index + 1)}`}
                        onChange={(event) =>
                          setOptions(
                            question.options.map((o) =>
                              o.id === option.id ? { ...o, score: Math.trunc(Number(event.target.value) || 0) } : o
                            )
                          )
                        }
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0}
                      onClick={() => moveOption(index, -1)}
                      aria-label={`بالا بردن گزینه‌ی ${toPersianDigits(index + 1)}`}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === question.options.length - 1}
                      onClick={() => moveOption(index, 1)}
                      aria-label={`پایین بردن گزینه‌ی ${toPersianDigits(index + 1)}`}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={question.options.length <= ENGAGEMENT_LIMITS.OPTIONS_MIN}
                      onClick={() => setOptions(question.options.filter((o) => o.id !== option.id))}
                      aria-label={`حذف گزینه‌ی ${toPersianDigits(index + 1)}`}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                  {imageOptions && (
                    <MediaField
                      value={option.imageId}
                      onChange={(imageId) =>
                        setOptions(question.options.map((o) => (o.id === option.id ? { ...o, imageId: imageId ?? undefined } : o)))
                      }
                      kind="image"
                      category="question"
                      pickerTitle={`تصویر گزینه‌ی ${toPersianDigits(index + 1)}`}
                      invalid={Boolean(error(`options.${index}.imageId`))}
                    />
                  )}
                  {error(`options.${index}.imageId`) && (
                    <p className="text-xs text-destructive">{error(`options.${index}.imageId`)}</p>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={question.options.length >= ENGAGEMENT_LIMITS.OPTIONS_MAX}
                onClick={() => setOptions([...question.options, { id: newKey(), label: '' }])}
              >
                <Plus aria-hidden="true" />
                گزینه‌ی جدید
              </Button>
              {knowledge && (
                <p className="text-xs text-muted-foreground">گزینه‌ی درست را با تیک مشخص کنید.</p>
              )}
              {personality && (
                <p className="text-xs text-muted-foreground">عدد کنار هر گزینه، امتیاز آن گزینه برای بُعد این سؤال است.</p>
              )}
            </div>
            {profile && (
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <Field
                    label="ضریب سؤال"
                    htmlFor={`${id}-weight`}
                    error={error('weight')}
                    hint={`وزن گزینه‌های این سؤال در این عدد ضرب می‌شود (۰ تا ${toPersianDigits(ENGAGEMENT_LIMITS.QUESTION_WEIGHT_MAX)}). صفر یعنی این سؤال در نتیجه اثری ندارد.`}
                  >
                    <Input
                      id={`${id}-weight`}
                      type="number"
                      min={0}
                      max={ENGAGEMENT_LIMITS.QUESTION_WEIGHT_MAX}
                      step={1}
                      className="w-24 tabular-nums"
                      value={question.weight ?? 1}
                      onChange={(event) =>
                        onChange({
                          ...question,
                          weight: Math.max(
                            0,
                            Math.min(ENGAGEMENT_LIMITS.QUESTION_WEIGHT_MAX, Math.trunc(Number(event.target.value) || 0))
                          ),
                        })
                      }
                      {...invalid(error('weight'))}
                    />
                  </Field>
                </div>
                <p className="text-sm font-medium">ماتریس امتیازدهی</p>
                <OptionProfileWeights
                  options={question.options}
                  profiles={assessment.profiles ?? []}
                  errors={errors}
                  path={path}
                  onChange={setOptions}
                />
              </div>
            )}
            {traits.length > 0 && (
              <OptionTraitPoints options={question.options} traits={traits} errors={errors} path={path} onChange={setOptions} />
            )}
          </Field>
        )}

        {question.kind === 'matching' && (
          <Field
            label="جفت‌ها"
            error={error('pairs')}
            hint="هر ردیف یک جفت درست است. ستون دوم برای کاربر جابه‌جا نمایش داده می‌شود."
          >
            <ul className="flex flex-col gap-2">
              {question.pairs.map((pair, index) => (
                <li key={pair.id} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                    {toPersianDigits(index + 1)}
                  </span>
                  <Input
                    value={pair.prompt}
                    maxLength={ENGAGEMENT_LIMITS.MATCHING_LABEL_MAX}
                    placeholder="مورد"
                    aria-label={`مورد ${toPersianDigits(index + 1)}`}
                    onChange={(event) =>
                      setPairs(question.pairs.map((p) => (p.id === pair.id ? { ...p, prompt: event.target.value } : p)))
                    }
                    {...invalid(error(`pairs.${index}.prompt`))}
                  />
                  <ArrowLeftRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <Input
                    value={pair.match}
                    maxLength={ENGAGEMENT_LIMITS.MATCHING_LABEL_MAX}
                    placeholder="جفت آن"
                    aria-label={`جفت مورد ${toPersianDigits(index + 1)}`}
                    onChange={(event) =>
                      setPairs(question.pairs.map((p) => (p.id === pair.id ? { ...p, match: event.target.value } : p)))
                    }
                    {...invalid(error(`pairs.${index}.match`))}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={question.pairs.length <= ENGAGEMENT_LIMITS.MATCHING_PAIRS_MIN}
                    onClick={() => setPairs(question.pairs.filter((p) => p.id !== pair.id))}
                    aria-label={`حذف جفت ${toPersianDigits(index + 1)}`}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={question.pairs.length >= ENGAGEMENT_LIMITS.MATCHING_PAIRS_MAX}
              onClick={() => setPairs([...question.pairs, emptyPair()])}
            >
              <Plus aria-hidden="true" />
              جفت جدید
            </Button>
          </Field>
        )}

        {knowledge && (question.kind === 'single' || question.kind === 'multiple' || question.kind === 'matching') && (
          <Field
            label="توضیح پاسخ (اختیاری)"
            htmlFor={`${id}-explanation`}
            error={error('explanation')}
            hint="چرا پاسخ درست، درست است. فقط وقتی نمایش داده می‌شود که «نمایش پاسخ درست و توضیح» روشن باشد."
          >
            <Textarea
              id={`${id}-explanation`}
              rows={2}
              maxLength={EXPLANATION_MAX}
              value={question.explanation ?? ''}
              onChange={(event) => onChange({ ...question, explanation: event.target.value || undefined })}
              {...invalid(error('explanation'))}
            />
          </Field>
        )}

        {question.kind === 'multiple' && (
          <Field
            label="سقف انتخاب (اختیاری)"
            htmlFor={`${id}-max`}
            error={error('maxSelections')}
            hint="اگر خالی بماند، محدودیتی ندارد."
          >
            <Input
              id={`${id}-max`}
              type="number"
              min={1}
              className="w-28 tabular-nums"
              value={question.maxSelections ?? ''}
              onChange={(event) =>
                onChange({ ...question, maxSelections: event.target.value ? Math.max(1, Math.trunc(Number(event.target.value))) : undefined })
              }
              {...invalid(error('maxSelections'))}
            />
          </Field>
        )}

        {question.kind === 'text' && (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={question.multiline}
              onCheckedChange={(multiline) => onChange({ ...question, multiline })}
              aria-label="پاسخ چندخطی"
            />
            پاسخ چندخطی (برای توضیح یا مدرک انجام کار)
          </label>
        )}

        {question.kind === 'rating' && (
          <Field label="بازه‌ی امتیاز" htmlFor={`${id}-rating`}>
            <Select value={String(question.max)} onValueChange={(max) => onChange({ ...question, max: Number(max) as 5 | 10 })}>
              <SelectTrigger id={`${id}-rating`} className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGAGEMENT_LIMITS.RATING_MAX_CHOICES.map((max) => (
                  <SelectItem key={max} value={String(max)}>
                    ۱ تا {toPersianDigits(max)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {question.kind === 'scale' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ابتدای طیف" htmlFor={`${id}-min`}>
              <Input
                id={`${id}-min`}
                type="number"
                min={ENGAGEMENT_LIMITS.SCALE_MIN_BOUND}
                max={ENGAGEMENT_LIMITS.SCALE_MAX_BOUND}
                value={question.min}
                onChange={(event) => onChange({ ...question, min: Math.trunc(Number(event.target.value) || 0) })}
              />
            </Field>
            <Field label="انتهای طیف" htmlFor={`${id}-maxv`} error={error('max')}>
              <Input
                id={`${id}-maxv`}
                type="number"
                min={ENGAGEMENT_LIMITS.SCALE_MIN_BOUND}
                max={ENGAGEMENT_LIMITS.SCALE_MAX_BOUND}
                value={question.max}
                onChange={(event) => onChange({ ...question, max: Math.trunc(Number(event.target.value) || 0) })}
                {...invalid(error('max'))}
              />
            </Field>
            <Field label="برچسب ابتدا" htmlFor={`${id}-minl`}>
              <Input id={`${id}-minl`} value={question.minLabel} onChange={(event) => onChange({ ...question, minLabel: event.target.value })} />
            </Field>
            <Field label="برچسب انتها" htmlFor={`${id}-maxl`}>
              <Input id={`${id}-maxl`} value={question.maxLabel} onChange={(event) => onChange({ ...question, maxLabel: event.target.value })} />
            </Field>
          </div>
        )}

        {personality && !UNDIMENSIONED_KINDS.includes(question.kind) && (
          <div className="flex flex-wrap items-end gap-4">
            <Field label="بُعد مورد سنجش" htmlFor={`${id}-dimension`} error={error('dimensionId')}>
              <Select
                value={question.dimensionId ?? ''}
                onValueChange={(dimensionId) => onChange({ ...question, dimensionId })}
              >
                <SelectTrigger id={`${id}-dimension`} className="w-48" {...invalid(error('dimensionId'))}>
                  <SelectValue placeholder="انتخاب بُعد" />
                </SelectTrigger>
                <SelectContent>
                  {assessment.dimensions.map((dimension) => (
                    <SelectItem key={dimension.id} value={dimension.id}>
                      {dimension.title || 'بُعد بی‌نام'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Switch
                checked={question.reverse ?? false}
                onCheckedChange={(reverse) => onChange({ ...question, reverse })}
                aria-label="سؤال معکوس"
              />
              سؤال معکوس
            </label>
          </div>
        )}
      {journey && (
        <Accordion type="single" collapsible defaultValue={question.motion ? 'motion' : undefined} className="rounded-lg border px-4">
          <AccordionItem value="motion" className="border-b-0">
            <AccordionTrigger>موشن بعد از پاسخ این سؤال</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4">
              <SwitchRow id={`${id}-own-motion`} label="موشن اختصاصی این سؤال" hint="اگر خاموش باشد، موشن روز (یا موشن عمومی چالش) پخش می‌شود.">
                <Switch
                  id={`${id}-own-motion`}
                  checked={Boolean(question.motion)}
                  onCheckedChange={(on) =>
                    onChange({ ...question, motion: on ? motionOff(MOTION_DURATION.ANSWER_MS) : undefined })
                  }
                />
              </SwitchRow>
              {question.motion && (
                <MotionSettingField
                  id={`${id}-motion`}
                  value={question.motion}
                  onChange={(motion) => onChange({ ...question, motion })}
                  errors={motionErrors(errors, `${path}.motion`)}
                />
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
