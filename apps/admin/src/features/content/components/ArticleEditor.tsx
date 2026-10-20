'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { ARTICLE_KIND_LABELS, ARTICLE_KINDS, ARTICLE_LIMITS, IMAGE_FRAMES, WEB_BASE_URL } from '@hamdastan/config';
import type { AdminArticleDetail, AdminArticleHistoryEntry, ArticleInput, ArticleKind, ArticleStatusAction, ArticleStatusInput } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from '@hamdastan/ui';
import { articleInputSchema, articlePublishProblems, type z } from '@hamdastan/validation';

import { NEUTRAL_TAB, NEUTRAL_TOGGLE, WorldsField } from '@/components';
import { useAdminCan } from '@/features/auth';
import { MediaField, MediaPreview, useMediaAsset } from '@/features/media';
import { errorMessage, fieldErrors, formatDateTime } from '@/lib';
import { adminContentService } from '@/services';

import { useArticleEditor } from '../hooks/use-article-editor';
import { useWorldOptions } from '@/hooks';
import { ARTICLE_ACTION_LABELS, ARTICLE_ACTIONS_FOR, ARTICLE_HISTORY_LABELS, ARTICLE_STATUS_LABELS } from '../utils/labels';
import { ArticleStatusDialog } from './ArticleStatusDialog';

type FormInput = z.input<typeof articleInputSchema>;

const STATUS_BADGE = { draft: 'outline', scheduled: 'info', published: 'success', unpublished: 'warning', archived: 'secondary' } as const;

const FIELDS = ['kind', 'slug', 'title', 'summary', 'body', 'category', 'coverId', 'coverAlt', 'thumbnailId', 'worldIds'] as const;

const toForm = (detail: AdminArticleDetail | undefined, kind: ArticleKind, worldId: string | undefined): FormInput => ({
  kind: detail?.kind ?? kind,
  slug: detail?.slug ?? '',
  title: detail?.title ?? '',
  summary: detail?.summary ?? '',
  body: detail?.body ?? '',
  category: detail?.category ?? '',
  coverId: detail?.coverId ?? null,
  coverAlt: detail?.coverAlt ?? '',
  thumbnailId: detail?.thumbnailId ?? null,
  worldIds: detail?.worldIds ?? (worldId ? [worldId] : []),
});

/** A blank line starts a paragraph — the product reads the body the same way. */
const paragraphs = (body: string) => body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);

/**
 * The news and knowledge editor: kind, text, images and the worlds it is
 * filed under, checked with the schema the API parses with. «ذخیره» keeps a
 * draft as it is; «انتشار» saves and publishes (now or at a date ahead), and
 * the publish checklist says what is still missing. Opened from a world, the
 * world comes preselected.
 */
export function ArticleEditor({ initial, kind = 'news', worldId }: { initial?: AdminArticleDetail; kind?: ArticleKind; worldId?: string }) {
  const router = useRouter();
  const can = useAdminCan();
  const worlds = useWorldOptions();
  const editor = useArticleEditor(initial);
  const [tab, setTab] = useState('edit');
  const [confirming, setConfirming] = useState<ArticleStatusAction | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<FormInput, unknown, ArticleInput>({
    resolver: zodResolver(articleInputSchema),
    defaultValues: toForm(initial, kind, worldId),
  });
  const values = useWatch({ control: form.control }) as FormInput;

  const status = editor.saved?.status;
  const writable = can('content.write') && status !== 'archived';
  const live = status === 'published' || status === 'scheduled';
  const actions = can('content.publish') ? ARTICLE_ACTIONS_FOR[status ?? 'draft'] : [];
  const problems = articlePublishProblems({
    title: values.title ?? '',
    summary: values.summary ?? '',
    body: values.body ?? '',
    worldIds: values.worldIds ?? [],
  });

  /** The API's per-field answer, under the fields; true when it had one. */
  const showFieldErrors = (error: unknown): boolean => {
    const byField = fieldErrors(error);
    const known = FIELDS.filter((field) => byField[field]);
    known.forEach((field, index) => form.setError(field, { message: byField[field] }, { shouldFocus: index === 0 }));
    if (known.length > 0) setTab('edit');
    return known.length > 0;
  };

  const afterWrite = (detail: AdminArticleDetail) => {
    form.reset(toForm(detail, detail.kind, undefined));
    if (!initial) router.replace(`/content/articles/${detail.id}`);
  };

  const save = form.handleSubmit(
    async (input) => {
      setBusy(true);
      try {
        const detail = await editor.save(input);
        toast.success(editor.saved ? 'تغییرات ذخیره شد' : 'پیش‌نویس ذخیره شد');
        afterWrite(detail);
      } catch (error) {
        if (!showFieldErrors(error)) toast.error(errorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    () => setTab('edit')
  );

  const runStatus = async (statusInput: ArticleStatusInput) => {
    // Publishing carries what is on the screen; taking an article back does not need a save.
    const input = statusInput.action === 'publish' && writable ? await validInput() : null;
    if (statusInput.action === 'publish' && writable && !input) return;
    try {
      const detail = await editor.changeStatus(input, statusInput);
      toast.success(statusInput.action === 'publish' && detail.status === 'scheduled' ? 'انتشار زمان‌بندی شد' : `«${detail.title}» ${ARTICLE_STATUS_LABELS[detail.status]} شد`);
      afterWrite(detail);
    } catch (error) {
      if (!showFieldErrors(error)) toast.error(errorMessage(error));
    }
  };

  /** The form's values, parsed — or null, with the problems shown under their fields. */
  const validInput = () =>
    new Promise<ArticleInput | null>((resolve) => {
      form.handleSubmit(resolve, () => {
        setTab('edit');
        resolve(null);
      })();
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="sm" className="-ms-2 w-fit text-muted-foreground">
            <Link href="/content">
              {/* rtl-ok: "back" is rightwards in an RTL layout. */}
              <ArrowRight aria-hidden="true" />
              محتوا
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {initial ? `ویرایش ${ARTICLE_KIND_LABELS[initial.kind]}` : `${ARTICLE_KIND_LABELS[values.kind ?? kind]} جدید`}
            {status && <Badge variant={STATUS_BADGE[status]}>{ARTICLE_STATUS_LABELS[status]}</Badge>}
          </h1>
          {status === 'scheduled' && <p className="text-sm text-muted-foreground">انتشار در {formatDateTime(editor.saved?.publishAt ?? null)}</p>}
          {status === 'archived' && <p className="text-sm text-muted-foreground">محتوای بایگانی‌شده قابل ویرایش نیست.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {actions
            .filter((action) => action !== 'publish')
            .map((action) => (
              <Button key={action} variant="outline" onClick={() => setConfirming(action)}>
                {ARTICLE_ACTION_LABELS[action]}
              </Button>
            ))}
          {writable && (
            <Button variant={live || !actions.includes('publish') ? 'default' : 'outline'} onClick={save} loading={busy}>
              {live ? 'ذخیره‌ی تغییرات' : 'ذخیره'}
            </Button>
          )}
          {actions.includes('publish') && (
            <Button variant={live ? 'outline' : 'default'} onClick={() => setConfirming('publish')} disabled={problems.length > 0}>
              {status === 'scheduled' ? 'تغییر زمان انتشار' : 'انتشار'}
            </Button>
          )}
        </div>
      </div>

      {actions.includes('publish') && problems.length > 0 && (
        <Alert>
          <AlertDescription>
            <p className="font-medium">برای انتشار:</p>
            <ul className="mt-1 list-disc ps-5">
              {problems.map((problem) => (
                <li key={problem.field}>{problem.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="edit" className={NEUTRAL_TAB}>
            محتوا
          </TabsTrigger>
          <TabsTrigger value="preview" className={NEUTRAL_TAB}>
            پیش‌نمایش
          </TabsTrigger>
          {editor.saved && (
            <TabsTrigger value="history" className={NEUTRAL_TAB}>
              تاریخچه
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="edit" className="mt-4">
          <Form {...form}>
            <form onSubmit={save} noValidate>
              <fieldset disabled={!writable} className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardContent className="flex flex-col gap-5 p-4 sm:p-6">
                    <FormField
                      control={form.control}
                      name="kind"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>نوع</FormLabel>
                          <ToggleGroup
                            type="single"
                            value={field.value}
                            onValueChange={(next) => next && field.onChange(next)}
                            spacing={2}
                            aria-label="نوع محتوا"
                          >
                            {ARTICLE_KINDS.map((item) => (
                              <ToggleGroupItem key={item} value={item} className={NEUTRAL_TOGGLE}>
                                {ARTICLE_KIND_LABELS[item]}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>عنوان</FormLabel>
                          <FormControl>
                            <Input {...field} maxLength={ARTICLE_LIMITS.TITLE_MAX} autoComplete="off" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="summary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>خلاصه</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={2} maxLength={ARTICLE_LIMITS.SUMMARY_MAX} />
                          </FormControl>
                          <FormDescription>روی کارت، زیر عنوان نمایش داده می‌شود.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="body"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>متن</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={14} maxLength={ARTICLE_LIMITS.BODY_MAX} />
                          </FormControl>
                          <FormDescription>متن ساده؛ هر خط خالی یک پاراگراف تازه شروع می‌کند.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="worldIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>دنیاها</FormLabel>
                          <WorldsField worlds={worlds} value={field.value ?? []} onChange={field.onChange} disabled={!writable} />
                          <FormDescription>محتوا در صفحه‌ی این دنیاها نمایش داده می‌شود؛ برای انتشار دست‌کم یک دنیا لازم است.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex flex-col gap-5 p-4 sm:p-6">
                    <FormField
                      control={form.control}
                      name="coverId"
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <FormLabel>کاور</FormLabel>
                          <MediaField
                            value={field.value}
                            onChange={field.onChange}
                            kind="image"
                            category="cover"
                            pickerTitle="کاور محتوا"
                            invalid={Boolean(fieldState.error)}
                            frame={IMAGE_FRAMES.articleCover}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="coverAlt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>متن جایگزین کاور</FormLabel>
                          <FormControl>
                            <Input {...field} maxLength={ARTICLE_LIMITS.ALT_MAX} />
                          </FormControl>
                          <FormDescription>برای کسی که تصویر را نمی‌بیند.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="thumbnailId"
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <FormLabel>تصویر کوچک</FormLabel>
                          <MediaField
                            value={field.value}
                            onChange={field.onChange}
                            kind="image"
                            category="cover"
                            pickerTitle="تصویر کوچک"
                            invalid={Boolean(fieldState.error)}
                            frame={IMAGE_FRAMES.articleThumbnail}
                          />
                          <FormDescription>در فهرست‌ها؛ اگر خالی بماند، کاور استفاده می‌شود.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>دسته</FormLabel>
                          <FormControl>
                            <Input {...field} maxLength={ARTICLE_LIMITS.CATEGORY_MAX} placeholder="مثلاً: پشت صحنه" />
                          </FormControl>
                          <FormDescription>اختیاری؛ روی کارت نمایش داده می‌شود.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>نامک</FormLabel>
                          <FormControl>
                            <Input {...field} dir="ltr" autoComplete="off" maxLength={ARTICLE_LIMITS.SLUG_MAX} />
                          </FormControl>
                          <FormDescription>بخشی از نشانی صفحه؛ اگر خالی بماند ساخته می‌شود.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </fieldset>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="preview" className="mt-4 flex flex-col gap-4">
          {editor.saved && (
            <Button asChild variant="outline" size="sm" className="w-fit">
              <a href={`${WEB_BASE_URL}/preview/articles/${editor.saved.id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                نمای کامل در اپلیکیشن (آخرین نسخه‌ی ذخیره‌شده)
              </a>
            </Button>
          )}
          <ArticlePreview values={values} />
        </TabsContent>

        {editor.saved && (
          <TabsContent value="history" className="mt-4">
            <ArticleHistory id={editor.saved.id} />
          </TabsContent>
        )}
      </Tabs>

      <ArticleStatusDialog
        key={confirming ?? 'none'}
        pending={confirming && { action: confirming, title: values.title || 'بدون عنوان' }}
        onCancel={() => setConfirming(null)}
        onConfirm={async (input) => {
          await runStatus(input);
          setConfirming(null);
        }}
      />
    </div>
  );
}

/** The article in the product's column, from what is on the screen now. */
function ArticlePreview({ values }: { values: FormInput }) {
  const { asset } = useMediaAsset(values.coverId ?? null);
  const body = paragraphs(values.body ?? '');
  return (
    <Card className="mx-auto w-full max-w-shell gap-0 overflow-hidden py-0">
      <div className="aspect-video bg-muted/50">{asset && <MediaPreview asset={asset} className="size-full" />}</div>
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="text-xs text-muted-foreground">
          {ARTICLE_KIND_LABELS[values.kind ?? 'news']}
          {values.category ? ` / ${values.category}` : ''}
        </p>
        <h2 className="text-xl font-bold leading-relaxed">{values.title || 'بدون عنوان'}</h2>
        {values.summary && <p className="text-sm leading-relaxed text-muted-foreground">{values.summary}</p>}
        {body.length === 0 ? (
          <p className="text-sm text-muted-foreground">متنی نوشته نشده است.</p>
        ) : (
          body.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line text-sm leading-loose">
              {paragraph}
            </p>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ArticleHistory({ id }: { id: string }) {
  const [entries, setEntries] = useState<AdminArticleHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminContentService.history(id).then(
      (list) => active && setEntries(list),
      (caught) => active && setError(errorMessage(caught))
    );
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">تاریخچه</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!entries && !error && <Skeleton className="h-20 w-full" />}
        {entries?.length === 0 && <p className="text-sm text-muted-foreground">سابقه‌ای ثبت نشده است.</p>}
        <ul className="flex flex-col divide-y">
          {entries?.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                {ARTICLE_HISTORY_LABELS[entry.action] ?? entry.action}
                {entry.admin && <span className="text-muted-foreground"> — {entry.admin}</span>}
              </span>
              <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
