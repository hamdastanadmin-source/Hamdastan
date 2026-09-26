'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Check,
  CloudOff,
  Eye,
  GitBranch,
  LayoutGrid,
  Loader2,
  PanelRightOpen,
  Save,
  Settings2,
  Share2,
} from 'lucide-react';

import type { Form } from '@hamdastan/types';
import {
  Badge,
  Button,
  Input,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  toast,
} from '@hamdastan/ui';

import { useHasPermission } from '@/features/auth';

import { useFormBuilder, type SaveState } from '../../hooks/use-form-builder';
import { ShareDialog } from '../ShareDialog';
import { ConfigPanel } from './ConfigPanel';
import { FormCanvas } from './FormCanvas';
import { LogicPanel } from './LogicPanel';
import { PreviewPane } from './PreviewPane';
import { QuestionPalette } from './QuestionPalette';
import { SettingsPanel } from './SettingsPanel';

/**
 * The form builder — the screen this module is really about.
 *
 * Three columns, in the order an RTL hand reaches them: the component library
 * on the right, the form itself in the middle with the most room, and the
 * selected question's settings on the left. Both side panels collapse, because
 * on a laptop the canvas is what matters.
 *
 * Four tabs share the centre — build, logic, settings, preview — rather than
 * four pages, so switching never loses what is on screen or what is unsaved.
 *
 * Everything is autosaved. The toolbar says which of three states that is in,
 * and «ذخیره» is there for the moment somebody wants to be sure.
 */

type Tab = 'build' | 'logic' | 'settings' | 'preview';

export function FormBuilderScreen({
  initialForm,
  initialTab = 'build',
}: {
  initialForm: Form;
  initialTab?: Tab;
}) {
  const builder = useFormBuilder(initialForm);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(true);
  const [sharing, setSharing] = useState(false);

  const canPublish = useHasPermission('forms.publish');
  const canSeeResponses = useHasPermission('forms.responses.view');
  const { form } = builder;

  /** The page a dropped or clicked component lands on: the last one. */
  const currentPageId =
    builder.selected?.pageId ?? form.pages[form.pages.length - 1]?.id ?? '';

  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col sm:-m-6">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <Button variant="ghost" size="icon-sm" asChild aria-label="بازگشت به فهرست فرم‌ها">
          <Link href="/forms">
            {/* rtl-ok: in RTL, "back" points to the right. */}
            <ArrowRight className="size-4" />
          </Link>
        </Button>

        <Input
          value={form.title}
          onChange={(event) => builder.setMeta({ title: event.target.value })}
          aria-label="عنوان فرم"
          className="h-9 max-w-xs border-transparent bg-transparent font-medium hover:border-border focus-visible:border-input"
        />

        <SaveBadge state={builder.saveState} />

        <div className="flex-1" />

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList>
            <TabsTrigger value="build">
              <LayoutGrid className="size-4" />
              <span className="ms-1.5 hidden lg:inline">ساخت</span>
            </TabsTrigger>
            <TabsTrigger value="logic">
              <GitBranch className="size-4" />
              <span className="ms-1.5 hidden lg:inline">منطق</span>
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings2 className="size-4" />
              <span className="ms-1.5 hidden lg:inline">تنظیمات</span>
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="size-4" />
              <span className="ms-1.5 hidden lg:inline">پیش‌نمایش</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {canSeeResponses && form.responseCount > 0 && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/forms/${form.id}/responses`}>
              <BarChart3 className="size-4" />
              <span className="hidden sm:inline">پاسخ‌ها</span>
            </Link>
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void builder.saveNow().then(() => toast.success('تغییرات ذخیره شد'));
          }}
        >
          <Save className="size-4" />
          <span className="hidden sm:inline">ذخیره</span>
        </Button>

        {canPublish && (
          <Button
            size="sm"
            onClick={() => {
              // Whatever is unsaved goes first: publishing a form the server has
              // not seen yet would publish the previous version.
              void builder.saveNow().then(() => setSharing(true));
            }}
          >
            <Share2 className="size-4" />
            {form.status === 'PUBLISHED' ? 'اشتراک‌گذاری' : 'انتشار'}
          </Button>
        )}
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {tab === 'build' && (
          <>
            {configOpen ? (
              <aside className="hidden h-full w-72 shrink-0 border-e border-border bg-card/40 lg:block">
                <div className="flex h-12 items-center justify-between border-b border-border px-3">
                  <span className="text-sm font-semibold">تنظیمات پرسش</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="بستن پنل تنظیمات"
                    onClick={() => setConfigOpen(false)}
                  >
                    <PanelRightOpen className="size-4" />
                  </Button>
                </div>
                <div className="h-[calc(100%-3rem)]">
                  <ConfigPanel builder={builder} />
                </div>
              </aside>
            ) : (
              <CollapsedPanel label="تنظیمات پرسش" onOpen={() => setConfigOpen(true)} />
            )}

            <main className="min-w-0 flex-1 overflow-y-auto bg-muted/20">
              <FormCanvas builder={builder} />
            </main>

            {paletteOpen ? (
              <div className="hidden md:block">
                <QuestionPalette
                  onAdd={(type) => builder.addQuestion(type, currentPageId)}
                  onAddPage={builder.addPage}
                  onCollapse={() => setPaletteOpen(false)}
                />
              </div>
            ) : (
              <CollapsedPanel label="افزودن پرسش" onOpen={() => setPaletteOpen(true)} />
            )}
          </>
        )}

        {tab === 'logic' && (
          <main className="min-w-0 flex-1 overflow-hidden bg-muted/20">
            <LogicPanel builder={builder} />
          </main>
        )}

        {tab === 'settings' && (
          <main className="min-w-0 flex-1 overflow-hidden bg-muted/20">
            <SettingsPanel builder={builder} />
          </main>
        )}

        {tab === 'preview' && (
          <main className="min-w-0 flex-1 overflow-hidden">
            <PreviewPane form={form} />
          </main>
        )}
      </div>

      {sharing && (
        <ShareDialog
          form={form}
          details={form}
          open
          onOpenChange={setSharing}
          onPublished={(published) => void builder.applyStatus(published)}
        />
      )}
    </div>
  );
}

/** A closed panel, as a strip you can click to bring it back. */
function CollapsedPanel({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hidden w-9 shrink-0 items-center justify-center border-e border-border bg-card/40 text-xs text-muted-foreground hover:bg-muted/60 md:flex"
      style={{ writingMode: 'vertical-rl' }}
    >
      {label}
    </button>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'SAVING') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="size-3 animate-spin" />
        در حال ذخیره…
      </Badge>
    );
  }

  if (state === 'UNSAVED') {
    return <Badge variant="outline">ذخیره‌نشده</Badge>;
  }

  if (state === 'ERROR') {
    return (
      <Badge variant="error" className="gap-1">
        <CloudOff className="size-3" />
        ذخیره نشد
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1 text-muted-foreground">
      <Check className="size-3" />
      ذخیره شد
    </Badge>
  );
}

/** Needed by the page, which decides the initial tab from the query string. */
export type BuilderTab = Tab;
