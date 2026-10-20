'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { WORLD_STATUS_LABELS } from '@hamdastan/config';
import type { AdminWorldDetail, WorldInput, WorldStatusAction } from '@hamdastan/types';
import { Alert, AlertDescription, Badge, Button, Card, CardContent, Form, Tabs, TabsContent, TabsList, TabsTrigger } from '@hamdastan/ui';
import { worldInputSchema, worldPublishProblems } from '@hamdastan/validation';

import { NEUTRAL_TAB } from '@/components';
import { useAdminCan } from '@/features/auth';
import { ContentIndexPanel } from '@/features/content';
import { errorMessage, fieldErrors, formatCount } from '@/lib';

import { useWorld } from '../hooks/use-world';
import { WORLD_ACTION_DONE, WORLD_ACTION_LABELS, WORLD_ACTIONS_FOR, WORLD_STATUS_BADGE, WORLD_TABS, type WorldTab } from '../utils/labels';
import { HomeTab } from './world/HomeTab';
import { IdentityTab } from './world/IdentityTab';
import { NavigationTab } from './world/NavigationTab';
import { PreviewTab } from './world/PreviewTab';
import type { WorldFormInput } from './world/types';
import { WorldStatusDialog } from './WorldStatusDialog';

const TAB_LABELS: Record<WorldTab, string> = {
  identity: 'هویت',
  menu: 'منو',
  home: 'خانه',
  content: 'محتوا',
  preview: 'پیش‌نمایش',
};

const FIELDS = ['slug', 'name', 'summary', 'tagline', 'description', 'coverId', 'logoId', 'theme', 'navigation'] as const;

const toForm = (world: AdminWorldDetail): WorldFormInput => ({
  slug: world.slug,
  name: world.name,
  summary: world.summary,
  tagline: world.tagline,
  description: world.description,
  coverId: world.coverId,
  logoId: world.logoId,
  theme: world.theme,
  navigation: world.navigation.map((item) => ({ ...item })),
});

/**
 * One world's page in the panel: its identity and menu (one form, saved
 * together), its home (arranged and saved on its own), everything filed
 * under it — with «ایجاد» that files a new item here — and a preview of
 * its home. Publishing saves what is on the screen first, and the checklist
 * above says what a world needs before it can be published.
 */
export function WorldScreen({ initial, initialTab = 'identity' }: { initial: AdminWorldDetail; initialTab?: WorldTab }) {
  const can = useAdminCan();
  const { world, save, changeStatus } = useWorld(initial);
  const [tab, setTab] = useState<WorldTab>(initialTab);
  const [confirming, setConfirming] = useState<WorldStatusAction | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<WorldFormInput, unknown, WorldInput>({ resolver: zodResolver(worldInputSchema), defaultValues: toForm(initial) });
  const values = useWatch({ control: form.control }) as WorldFormInput;

  const manage = can('worlds.manage');
  const writable = manage && world.status !== 'archived';
  const actions = manage ? WORLD_ACTIONS_FOR[world.status] : [];
  const publishable = actions.includes('publish');
  const problems = worldPublishProblems({ name: values.name ?? '', summary: values.summary ?? '' });

  /** The API's per-field answer, under the fields; true when it had one. */
  const showFieldErrors = (error: unknown): boolean => {
    const byField = fieldErrors(error);
    const known = FIELDS.filter((field) => byField[field]);
    known.forEach((field, index) => form.setError(field, { message: byField[field] }, { shouldFocus: index === 0 }));
    if (known.length > 0) setTab(known.includes('navigation') && known.length === 1 ? 'menu' : 'identity');
    return known.length > 0;
  };

  /** Saves the identity and menu; answers false when something needs fixing. */
  const saveForm = () =>
    new Promise<boolean>((resolve) => {
      form.handleSubmit(
        async (input) => {
          try {
            const detail = await save(input);
            form.reset(toForm(detail));
            resolve(true);
          } catch (error) {
            if (!showFieldErrors(error)) toast.error(errorMessage(error));
            resolve(false);
          }
        },
        (errors) => {
          setTab(Object.keys(errors).every((key) => key === 'navigation') ? 'menu' : 'identity');
          resolve(false);
        }
      )();
    });

  const onSave = async () => {
    setBusy(true);
    if (await saveForm()) toast.success('تغییرات ذخیره شد');
    setBusy(false);
  };

  const runStatus = async (action: WorldStatusAction) => {
    setBusy(true);
    try {
      // What is published is what is on the screen.
      if (action === 'publish' && form.formState.isDirty && !(await saveForm())) return;
      await changeStatus(action);
      toast.success(`«${world.name}» ${WORLD_ACTION_DONE[action]}`);
    } catch (error) {
      if (!showFieldErrors(error)) toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="sm" className="-ms-2 w-fit text-muted-foreground">
            <Link href="/worlds">
              {/* rtl-ok: "back" is rightwards in an RTL layout. */}
              <ArrowRight aria-hidden="true" />
              دنیاها
            </Link>
          </Button>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            {world.name}
            <Badge variant={WORLD_STATUS_BADGE[world.status]}>{WORLD_STATUS_LABELS[world.status]}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatCount(world.eventCount)} رویداد، {formatCount(world.articleCount)} خبر و دانستنی، {formatCount(world.activityCount)} فعالیت
          </p>
          {world.status === 'archived' && <p className="text-sm text-muted-foreground">دنیای بایگانی‌شده تا بازگردانی قابل ویرایش نیست.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {actions
            .filter((action) => action !== 'publish')
            .map((action) => (
              <Button
                key={action}
                variant="outline"
                disabled={busy}
                onClick={() => (action === 'restore' ? runStatus(action) : setConfirming(action))}
              >
                {WORLD_ACTION_LABELS[action]}
              </Button>
            ))}
          {publishable && (
            <Button onClick={() => runStatus('publish')} loading={busy} disabled={problems.length > 0}>
              انتشار
            </Button>
          )}
        </div>
      </div>

      {publishable && problems.length > 0 && (
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

      <Tabs value={tab} onValueChange={(value) => setTab(value as WorldTab)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {WORLD_TABS.map((id) => (
            <TabsTrigger key={id} value={id} className={NEUTRAL_TAB}>
              {TAB_LABELS[id]}
            </TabsTrigger>
          ))}
        </TabsList>

        {(tab === 'identity' || tab === 'menu') && (
          <TabsContent value={tab} className="mt-4">
            <Card>
              <CardContent className="flex flex-col gap-6 p-4 sm:p-6">
                <Form {...form}>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void onSave();
                    }}
                    noValidate
                  >
                    <fieldset disabled={!writable}>
                      {tab === 'identity' ? <IdentityTab form={form} /> : <NavigationTab form={form} disabled={!writable} />}
                    </fieldset>
                  </form>
                </Form>
                {writable && (
                  <div className="flex justify-end border-t pt-4">
                    <Button variant={publishable ? 'outline' : 'default'} onClick={onSave} loading={busy} disabled={!form.formState.isDirty}>
                      ذخیره‌ی تغییرات
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="home" className="mt-4">
          {/* The saved menu decides which sections can show; an unsaved change applies once saved. */}
          <HomeTab worldId={world.id} navigation={world.navigation} writable={writable} primary={!publishable} />
        </TabsContent>

        <TabsContent value="content" className="mt-4">
          <ContentIndexPanel world={{ id: world.id, name: world.name }} />
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <PreviewTab worldId={world.id} />
        </TabsContent>
      </Tabs>

      <WorldStatusDialog
        key={confirming ?? 'none'}
        pending={confirming && { action: confirming, name: world.name }}
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          if (confirming) await runStatus(confirming);
          setConfirming(null);
        }}
      />
    </div>
  );
}
