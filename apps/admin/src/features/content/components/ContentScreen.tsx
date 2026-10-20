'use client';

import { useWorldOptions } from '@/hooks';
import { ContentIndexPanel } from './ContentIndexPanel';

/**
 * The central content area: every article, event and activity filed under
 * worlds, with the filters to find one and «ایجاد» for each kind. Editing
 * opens the kind's own editor.
 */
export function ContentScreen() {
  const worlds = useWorldOptions();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">محتوا</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          اخبار، دانستنی‌ها، رویدادها و فعالیت‌های همه‌ی دنیاها در یک فهرست. ویرایش هر مورد در ویرایشگر مخصوص خودش انجام می‌شود.
        </p>
      </div>
      <ContentIndexPanel worlds={worlds} />
    </div>
  );
}
