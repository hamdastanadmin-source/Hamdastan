'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

import { Input } from '@hamdastan/ui';

import { useHasPermission } from '@/features/auth';

import { CreateUserForm } from './CreateUserForm';

/**
 * Search, and the button that opens «ایجاد کاربر».
 *
 * Searching is done by the backend, not in the browser: the table only ever
 * holds one page, so filtering what is on screen would quietly hide matches on
 * every other page. The term goes into the URL, which makes a search a
 * shareable, reloadable address and leaves the server component to fetch it.
 *
 * The create button is hidden from an admin without `users.create` — a
 * convenience, since the route itself refuses them.
 */
export function UsersToolbar({ search }: { search: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = useState(search);
  const canCreate = useHasPermission('users.create');

  // Debounced so a five-letter name is one request rather than five. The
  // dependency on `term` alone is deliberate: the effect re-runs when what was
  // typed changes, and the timer is what collapses a burst of keystrokes.
  useEffect(() => {
    if (term === search) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (term) next.set('search', term);
      else next.delete('search');
      // A new search starts at the first page; staying on page 4 of the old
      // result would usually land on an empty one.
      next.delete('page');

      router.replace(`${pathname}?${next.toString()}`);
    }, 300);

    return () => clearTimeout(timer);
  }, [term, search, params, pathname, router]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="search"
          type="search"
          placeholder="جستجو در نام، نام کاربری یا موبایل"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          className="ps-9"
        />
      </div>

      {canCreate && <CreateUserForm />}
    </div>
  );
}
