'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { NotificationFilter, NotificationInbox, NotificationItem } from '@hamdastan/types';

import { notificationsService } from '@/services';

type Status = 'loading' | 'ready' | 'error';

/**
 * The Notification Center's list: one filter at a time, newest first, a
 * page more on request. The first page of «همه» arrives with the server
 * render; every other read, and every change, goes to the API and the list
 * shows what it answered.
 */
export function useInbox(initial: NotificationInbox | null) {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [items, setItems] = useState<NotificationItem[]>(initial?.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initial?.nextCursor ?? null);
  const [unread, setUnread] = useState(initial?.unread ?? 0);
  const [status, setStatus] = useState<Status>(initial ? 'ready' : 'loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloads, setReloads] = useState(initial ? 0 : 1);
  const skipFirst = useRef(Boolean(initial));

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    let active = true;
    setStatus('loading');
    notificationsService.inbox(filter).then(
      (page) => {
        if (!active) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setUnread(page.unread);
        setStatus('ready');
      },
      () => active && setStatus('error')
    );
    return () => {
      active = false;
    };
  }, [filter, reloads]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await notificationsService.inbox(filter, nextCursor);
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setUnread(page.unread);
    } finally {
      setLoadingMore(false);
    }
  }, [filter, nextCursor]);

  const markAllRead = useCallback(async () => {
    const answer = await notificationsService.markRead();
    setUnread(answer.unread);
    setItems((current) => (filter === 'unread' ? [] : current.map((item) => ({ ...item, read: true }))));
  }, [filter]);

  const dismiss = useCallback(async (id: string) => {
    const answer = await notificationsService.dismiss(id);
    setUnread(answer.unread);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  return { filter, setFilter, items, nextCursor, unread, status, loadingMore, reload, loadMore, markAllRead, dismiss };
}
