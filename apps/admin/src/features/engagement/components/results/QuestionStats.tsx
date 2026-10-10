import { QUESTION_KIND_LABELS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AssessmentStats, QuestionStat } from '@hamdastan/types';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from '@hamdastan/ui';

import { formatCount, formatPercent } from '@/lib';

/** A bar in foreground — figures are not the primary action. */
const BAR = 'bg-muted [&>[data-slot=progress-indicator]]:bg-foreground/70';

function Bars({ rows, total }: { rows: { key: string; label: string; count: number }[]; total: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const share = total > 0 ? row.count / total : 0;
        return (
          <li key={row.key} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-3 text-sm">
              <span>{row.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatCount(row.count)} · {formatPercent(share)}
              </span>
            </div>
            <Progress value={share * 100} className={BAR} aria-label={row.label} />
          </li>
        );
      })}
    </ul>
  );
}

/** One question's answers, drawn by kind. */
function QuestionStatCard({ stat, number }: { stat: QuestionStat; number: number }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardDescription className="flex flex-wrap items-center gap-2">
          سؤال {toPersianDigits(number)}
          {stat.stepTitle && <span>· {stat.stepTitle}</span>}
          <Badge variant="outline">{QUESTION_KIND_LABELS[stat.kind]}</Badge>
          <span className="ms-auto">{formatCount(stat.answered)} پاسخ</span>
        </CardDescription>
        <CardTitle className="text-base leading-relaxed">{stat.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {stat.options && (
          <Bars
            rows={stat.options.map((option) => ({ key: option.id, label: option.label, count: option.count }))}
            total={stat.answered}
          />
        )}
        {stat.distribution && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              میانگین:{' '}
              <strong className="tabular-nums">{stat.average === null ? '—' : toPersianDigits(stat.average ?? '')}</strong>
            </p>
            <Bars
              rows={stat.distribution.map((entry) => ({
                key: String(entry.value),
                label: toPersianDigits(entry.value),
                count: entry.count,
              }))}
              total={stat.answered}
            />
          </div>
        )}
        {stat.texts &&
          (stat.texts.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز جوابی نیومده.</p>
          ) : (
            <ul className="flex flex-col divide-y text-sm">
              {stat.texts.map((text, index) => (
                <li key={index} className="whitespace-pre-line py-2 leading-relaxed">
                  {text}
                </li>
              ))}
            </ul>
          ))}
      </CardContent>
    </Card>
  );
}

export function QuestionStats({ questions }: { questions: QuestionStat[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {questions.map((stat, index) => (
        <QuestionStatCard key={stat.questionId} stat={stat} number={index + 1} />
      ))}
    </div>
  );
}

/** An assessment's outcome: the knowledge score and pass rate, or how the personality types fell. */
export function AssessmentSummary({ stats, responses }: { stats: AssessmentStats; responses: number }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">نتایج آزمون</CardTitle>
        <CardDescription>
          {stats.mode === 'knowledge' ? 'آزمون دانش و مهارت' : 'آزمون شخصیت‌شناسی'} — نتیجه‌ی هر نفر فقط در خروجی CSV
          کنار نامش میاد.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stats.mode === 'knowledge' ? (
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">میانگین نمره</dt>
              <dd className="text-2xl font-bold tabular-nums">
                {stats.averageScore === null ? '—' : `${toPersianDigits(stats.averageScore)}٪`}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">نرخ قبولی</dt>
              <dd className="text-2xl font-bold tabular-nums">
                {stats.passRate === null ? '—' : formatPercent(stats.passRate)}
              </dd>
            </div>
          </dl>
        ) : (
          <Bars
            rows={stats.outcomes.map((outcome) => ({ key: outcome.dimensionId, label: outcome.title, count: outcome.count }))}
            total={responses}
          />
        )}
      </CardContent>
    </Card>
  );
}
