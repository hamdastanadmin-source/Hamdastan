'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus2, LayoutTemplate, Plus } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared';
import type { FormTemplate } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@hamdastan/ui';
import { createFormSchema } from '@hamdastan/validation';

import { HttpError } from '@/services';

import { formsApi } from '../services/forms.api';

/**
 * «ساخت فرم جدید» — blank, or from one of the templates.
 *
 * A template is copied by the backend, ids and all, so two forms made from one
 * template never share a question id. Either way the new form is a draft and
 * the admin lands in the builder, because a form is not worth anything until
 * somebody has edited it.
 */
export function CreateFormDialog({ templates }: { templates: FormTemplate[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const create = async (chosenTemplate: FormTemplate | null) => {
    const parsed = createFormSchema.safeParse({
      title: title.trim() || chosenTemplate?.title || '',
      ...(chosenTemplate ? { templateId: chosenTemplate.id } : {}),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const { form } = await formsApi.create(parsed.data);
      // Straight into the builder: creating a form is the beginning of editing
      // one, not a destination.
      router.push(`/forms/${form.id}/edit`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof HttpError ? caught.message : 'ساخت فرم ممکن نشد. دوباره تلاش کنید.'
      );
      setIsPending(false);
    }
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setTitle('');
      setTemplateId(null);
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          ساخت فرم جدید
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ساخت فرم جدید</DialogTitle>
          <DialogDescription>
            از یک فرم خالی شروع کنید یا یکی از الگوها را بردارید و تغییرش دهید.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="blank">
          <TabsList className="w-full">
            <TabsTrigger value="blank" className="flex-1">
              <FilePlus2 className="size-4 me-2" />
              فرم خالی
            </TabsTrigger>
            <TabsTrigger value="template" className="flex-1">
              <LayoutTemplate className="size-4 me-2" />
              شروع از الگو
            </TabsTrigger>
          </TabsList>

          <TabsContent value="blank" className="space-y-4 pt-4">
            <FormField label="عنوان فرم" required>
              <Input
                name="title"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="مثلاً: نظرسنجی رضایت مشتریان"
              />
            </FormField>

            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                انصراف
              </Button>
              <Button loading={isPending} onClick={() => void create(null)}>
                ساخت و ویرایش
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="template" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((template) => {
                const selected = templateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setTemplateId(template.id)}
                    className={`rounded-lg border p-4 text-start transition-colors ${
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{template.title}</span>
                      <Badge variant="secondary" className="shrink-0">
                        {toPersianDigits(template.questionCount)} پرسش
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {template.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <FormField label="عنوان فرم" helperText="خالی بگذارید تا عنوان الگو استفاده شود.">
              <Input
                name="templateTitle"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="عنوان دلخواه"
              />
            </FormField>

            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                انصراف
              </Button>
              <Button
                loading={isPending}
                disabled={!templateId}
                onClick={() =>
                  void create(templates.find((template) => template.id === templateId) ?? null)
                }
              >
                ساخت از الگو
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
