'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, CircleAlert, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  WORLD_HOME_SOURCE_LABELS,
  WORLD_HOME_SOURCES,
  WORLD_HOME_WHEN_EMPTY,
  WORLD_HOME_WHEN_EMPTY_LABELS,
  WORLD_LIMITS,
  WORLD_SECTION_LABELS,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { WorldHomeKind, WorldNavItem } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from '@hamdastan/ui';

import { Field, invalid, NEUTRAL_TOGGLE } from '@/components';
import { CONTENT_STATUS_BADGE, CONTENT_STATUS_LABELS } from '@/features/content';
import { errorMessage } from '@/lib';

import { useWorldHome } from '../../hooks/use-world-home';
import { FeaturedPicker } from './FeaturedPicker';

const LIMITS = Array.from({ length: WORLD_LIMITS.SECTION_ITEMS_MAX }, (_, index) => index + 1);

/**
 * «خانه»: the sections of the world's home, in order. Each is on or off,
 * has its title and size, takes the newest eligible items or only the ones
 * featured here, and hides or says «فعلاً چیزی نیست» when it has none. A
 * section whose tab is off in the menu is not shown, whatever it says here.
 */
export function HomeTab({
  worldId,
  navigation,
  writable,
  primary,
}: {
  worldId: string;
  navigation: WorldNavItem[];
  writable: boolean;
  /** Whether saving is the screen's one primary action (it is not while «انتشار» is offered). */
  primary: boolean;
}) {
  const home = useWorldHome(worldId);
  const [picking, setPicking] = useState<WorldHomeKind | null>(null);
  const [busy, setBusy] = useState(false);
  const tabOff = new Set(navigation.filter((item) => !item.enabled).map((item) => item.section));

  const save = async () => {
    setBusy(true);
    try {
      if (await home.save()) toast.success('چیدمان خانه ذخیره شد');
      else toast.error('چند مورد نیاز به اصلاح دارد');
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (home.loadError) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>چیدمان خانه بارگذاری نشد</AlertTitle>
        <AlertDescription>
          <p>{home.loadError}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={home.reload}>
            تلاش دوباره
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!home.sections) return <Skeleton className="h-96 w-full" />;
  const sections = home.sections;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          فقط محتوای منتشرشده، جاری و متصل به همین دنیا روی خانه می‌آید؛ مورد ویژه‌ای که منتشر نشده یا تمام شده، خودبه‌خود نمایش داده نمی‌شود.
        </p>
        {writable && (
          <Button variant={primary ? 'default' : 'outline'} onClick={save} loading={busy} disabled={!home.dirty}>
            ذخیره‌ی چیدمان
          </Button>
        )}
      </div>

      <ol className="flex flex-col gap-4">
        {sections.map((section, index) => {
          const label = WORLD_SECTION_LABELS[section.kind];
          const error = home.errors[section.kind];
          return (
            <li key={section.kind}>
              <Card aria-invalid={error ? true : undefined}>
                <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs tabular-nums text-muted-foreground">{toPersianDigits(index + 1)}</span>
                    <h3 className="font-semibold">{label}</h3>
                    {tabOff.has(section.kind) && <Badge variant="outline">تب این بخش در منو خاموش است</Badge>}
                    <div className="ms-auto flex items-center gap-1">
                      <Switch
                        checked={section.enabled}
                        disabled={!writable}
                        onCheckedChange={(enabled) => home.update(section.kind, { enabled })}
                        aria-label={`نمایش «${label}» در خانه`}
                      />
                      <Button variant="ghost" size="icon-sm" disabled={!writable || index === 0} onClick={() => home.moveSection(section.kind, -1)} aria-label={`بالا بردن «${label}»`}>
                        <ArrowUp aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={!writable || index === sections.length - 1}
                        onClick={() => home.moveSection(section.kind, 1)}
                        aria-label={`پایین بردن «${label}»`}
                      >
                        <ArrowDown aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  {section.enabled && (
                    <fieldset disabled={!writable} className="flex flex-col gap-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="عنوان بخش" htmlFor={`title-${section.kind}`} hint={`اگر خالی بماند: «${label}»`}>
                          <Input
                            id={`title-${section.kind}`}
                            value={section.title}
                            maxLength={WORLD_LIMITS.SECTION_TITLE_MAX}
                            onChange={(event) => home.update(section.kind, { title: event.target.value })}
                          />
                        </Field>
                        <Field label="حداکثر تعداد" htmlFor={`limit-${section.kind}`}>
                          <Select value={String(section.itemLimit)} onValueChange={(value) => home.update(section.kind, { itemLimit: Number(value) })}>
                            <SelectTrigger id={`limit-${section.kind}`} className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LIMITS.map((limit) => (
                                <SelectItem key={limit} value={String(limit)}>
                                  {toPersianDigits(limit)} مورد
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>

                      <Field label="منبع موارد">
                        <ToggleGroup
                          type="single"
                          value={section.source}
                          onValueChange={(source) => source && home.update(section.kind, { source: source as typeof section.source })}
                          spacing={2}
                          className="flex-wrap"
                          aria-label={`منبع موارد «${label}»`}
                        >
                          {WORLD_HOME_SOURCES.map((source) => (
                            <ToggleGroupItem key={source} value={source} className={NEUTRAL_TOGGLE}>
                              {WORLD_HOME_SOURCE_LABELS[source]}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </Field>

                      <Field label="وقتی موردی برای نمایش نیست">
                        <ToggleGroup
                          type="single"
                          value={section.whenEmpty}
                          onValueChange={(whenEmpty) => whenEmpty && home.update(section.kind, { whenEmpty: whenEmpty as typeof section.whenEmpty })}
                          spacing={2}
                          className="flex-wrap"
                          aria-label={`بخش خالی «${label}»`}
                        >
                          {WORLD_HOME_WHEN_EMPTY.map((value) => (
                            <ToggleGroupItem key={value} value={value} className={NEUTRAL_TOGGLE}>
                              {WORLD_HOME_WHEN_EMPTY_LABELS[value]}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </Field>

                      <Field
                        label="موارد ویژه"
                        error={error}
                        hint={
                          section.source === 'featured'
                            ? 'فقط همین موارد، به همین ترتیب، نمایش داده می‌شوند.'
                            : 'با منبع «جدیدترین»، این فهرست ذخیره می‌ماند ولی استفاده نمی‌شود.'
                        }
                      >
                        {section.featured.length === 0 ? (
                          <p className="text-sm text-muted-foreground" {...invalid(error)}>
                            موردی انتخاب نشده است.
                          </p>
                        ) : (
                          <ol className="flex flex-col divide-y rounded-lg border">
                            {section.featured.map((item, position) => (
                              <li key={item.id} className="flex items-center gap-2 p-2 ps-3">
                                <span className="min-w-0 flex-1 truncate text-sm">{item.title || 'بدون عنوان'}</span>
                                <Badge variant={CONTENT_STATUS_BADGE[item.status]}>{CONTENT_STATUS_LABELS[item.status]}</Badge>
                                {!item.live && <span className="hidden text-xs text-muted-foreground sm:inline">نمایش داده نمی‌شود</span>}
                                <Button variant="ghost" size="icon-sm" disabled={position === 0} onClick={() => home.moveFeatured(section.kind, item.id, -1)} aria-label={`بالا بردن «${item.title}»`}>
                                  <ArrowUp aria-hidden="true" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={position === section.featured.length - 1}
                                  onClick={() => home.moveFeatured(section.kind, item.id, 1)}
                                  aria-label={`پایین بردن «${item.title}»`}
                                >
                                  <ArrowDown aria-hidden="true" />
                                </Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => home.removeFeatured(section.kind, item.id)} aria-label={`برداشتن «${item.title}»`}>
                                  <X aria-hidden="true" />
                                </Button>
                              </li>
                            ))}
                          </ol>
                        )}
                        {writable && section.featured.length < WORLD_LIMITS.FEATURED_MAX && (
                          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setPicking(section.kind)}>
                            <Plus aria-hidden="true" />
                            افزودن مورد ویژه
                          </Button>
                        )}
                      </Field>
                    </fieldset>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <FeaturedPicker
        worldId={worldId}
        kind={picking}
        chosen={picking ? (sections.find((section) => section.kind === picking)?.featured.map((item) => item.id) ?? []) : []}
        onPick={(item) => picking && home.addFeatured(picking, item)}
        onClose={() => setPicking(null)}
      />
    </div>
  );
}
