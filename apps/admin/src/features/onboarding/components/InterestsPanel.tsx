'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, CircleAlert, FileSpreadsheet, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { AdminInterestCategory, InterestCategoryInput } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hamdastan/ui';

import { useOrderedList } from '@/hooks';
import { errorMessage, formatCount } from '@/lib';
import { adminOnboardingService } from '@/services';

import { DeleteDialog } from './DeleteDialog';
import { ImportInterestsDialog } from './ImportInterestsDialog';
import { InterestCategoryFormDialog } from './InterestCategoryFormDialog';

const COLUMNS = 5;
const load = () => adminOnboardingService.interestCategories();
const reorder = (ids: string[]) => adminOnboardingService.reorderInterestCategories(ids);

/**
 * Stage 1's catalog: categories and the interests in each — add, edit,
 * order, delete. The API refuses a change that would leave fewer categories
 * than stage 1 asks people to pick from.
 */
export function InterestsPanel() {
  const { items, error, loading, reload, move } = useOrderedList(load, reorder);
  const [editing, setEditing] = useState<AdminInterestCategory | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminInterestCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  const save = async (input: InterestCategoryInput) => {
    if (editing === 'new') await adminOnboardingService.createInterestCategory(input);
    else if (editing) await adminOnboardingService.updateInterestCategory(editing.id, input);
    reload();
  };

  const onMove = async (id: string, by: -1 | 1) => {
    try {
      await move(id, by);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await adminOnboardingService.removeInterestCategory(deleting.id);
      toast.success(`«${deleting.title}» حذف شد`);
      setDeleting(null);
      reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">ترتیب این فهرست، ترتیب نمایش دسته‌ها در مرحله‌ی اول آنبوردینگ است.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}>
            <FileSpreadsheet aria-hidden="true" />
            ورود از اکسل
          </Button>
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            دسته‌ی جدید
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>دسته‌ها بارگذاری نشد</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={reload}>
              تلاش دوباره
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="gap-0 py-0">
          <Table aria-busy={loading}>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">دسته</TableHead>
                <TableHead>علاقه‌مندی‌ها</TableHead>
                <TableHead>انتخاب‌کنندگان</TableHead>
                <TableHead className="hidden sm:table-cell">ترتیب</TableHead>
                <TableHead className="pe-4 text-end">
                  <span className="sr-only">عملیات</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 6 }, (_, row) => (
                  <TableRow key={row}>
                    {Array.from({ length: COLUMNS }, (_, cell) => (
                      <TableCell key={cell}>
                        <Skeleton className="h-5 w-full max-w-28" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {items?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Tags aria-hidden="true" className="size-8" />
                      هنوز دسته‌ای تعریف نشده
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {items?.map((category, index) => (
                <TableRow key={category.id}>
                  <TableCell className="ps-4">
                    <span className="font-medium">{category.title}</span>
                    <span className="block max-w-md truncate text-xs text-muted-foreground">
                      {category.interests.map(({ label }) => label).join('، ')}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatCount(category.interests.length)}</TableCell>
                  <TableCell className="tabular-nums">{formatCount(category.pickedBy)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(category.id, -1)} aria-label={`بالا بردن «${category.title}»`}>
                        <ArrowUp aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === items.length - 1}
                        onClick={() => onMove(category.id, 1)}
                        aria-label={`پایین بردن «${category.title}»`}
                      >
                        <ArrowDown aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="pe-4 text-end">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(category)} aria-label={`ویرایش «${category.title}»`}>
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleting(category)}
                        aria-label={`حذف «${category.title}»`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {editing && (
        <InterestCategoryFormDialog
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          category={editing === 'new' ? undefined : editing}
          onSubmit={save}
        />
      )}

      <ImportInterestsDialog open={importing} onOpenChange={setImporting} catalog={items ?? []} onImported={reload} />

      <DeleteDialog
        title={deleting && `حذف «${deleting.title}»`}
        description={
          deleting?.pickedBy
            ? `${formatCount(deleting.pickedBy)} نفر از این دسته انتخاب کرده‌اند. انتخاب‌هایشان در سابقه می‌ماند، ولی این دسته و علاقه‌مندی‌هایش دیگر نمایش داده نمی‌شوند.`
            : 'این دسته و علاقه‌مندی‌هایش برای همیشه حذف می‌شوند.'
        }
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
