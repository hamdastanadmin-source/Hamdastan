import { Swords } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ThisOrThatCardStat } from '@hamdastan/types';
import { Card, Progress, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@hamdastan/ui';

import { MediaPreview, useMediaAsset } from '@/features/media';
import { formatCount, formatPercent } from '@/lib';

import { BAR } from './QuestionStats';

function Thumbnail({ id }: { id: string }) {
  const { asset } = useMediaAsset(id || null);
  return <div className="size-12 shrink-0 rounded-md bg-muted">{asset && <MediaPreview asset={asset} className="size-full p-0.5" />}</div>;
}

/**
 * «این یا اون»: the cards ranked by how many people ended on them — the
 * share is of those who finished — with every match each one won and played.
 */
export function CardRanking({ cards, responses }: { cards: ThisOrThatCardStat[]; responses: number }) {
  return (
    <Card className="gap-0 py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 ps-4">رتبه</TableHead>
            <TableHead>کارت</TableHead>
            <TableHead className="min-w-48">انتخاب نهایی</TableHead>
            <TableHead className="pe-4">برد در رقابت‌ها</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {responses === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Swords aria-hidden="true" className="size-8" />
                  هنوز کسی این فعالیت را تمام نکرده است
                </div>
              </TableCell>
            </TableRow>
          )}
          {cards.map((card, index) => (
            <TableRow key={card.id}>
              <TableCell className="ps-4 font-semibold tabular-nums">{toPersianDigits(index + 1)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Thumbnail id={card.imageId} />
                  <span className="font-medium">{card.title}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm tabular-nums">
                    {formatCount(card.finalWins)} نفر · {formatPercent(card.finalShare)}
                  </span>
                  <Progress value={card.finalShare * 100} className={BAR} aria-label={`سهم انتخاب نهایی ${card.title}`} />
                </div>
              </TableCell>
              <TableCell className="pe-4 text-sm tabular-nums text-muted-foreground">
                {formatCount(card.wins)} از {formatCount(card.matches)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
