import { EVENT_TYPES } from '@hamdastan/config';
import type { EventListQuery, EventType } from '@hamdastan/types';

/**
 * Discovery's state lives in the address: a filtered list can be shared,
 * reloaded and gone back to. These turn the URL into the API's query and
 * back. Anything unknown in the URL is dropped, not sent.
 */

export type DiscoveryState = EventListQuery & { date?: string };

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const list = (value: string | string[] | undefined) => first(value)?.split(',').filter(Boolean) ?? [];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDiscovery(params: Params): DiscoveryState {
  const date = first(params.date);
  const price = first(params.price);
  return {
    q: first(params.q)?.slice(0, 60) || undefined,
    category: list(params.category),
    type: list(params.type).filter((type): type is EventType => (EVENT_TYPES as readonly string[]).includes(type)),
    world: first(params.world) || undefined,
    city: first(params.city)?.slice(0, 60) || undefined,
    price: price === 'free' || price === 'paid' ? price : undefined,
    available: first(params.available) === 'true' || undefined,
    interested: first(params.interested) === 'true' || undefined,
    date: date && DAY.test(date) ? date : undefined,
    page: Math.max(1, Number.parseInt(first(params.page) ?? '1', 10) || 1),
  };
}

/** The API's query: a chosen day is a one-day range; the newest first, for now the only order. */
export function toListQuery(state: DiscoveryState): EventListQuery {
  const { date, ...query } = state;
  return { ...query, sort: 'newest', ...(date ? { from: date, to: date } : {}) };
}

/** The address for a state; empty values are left out. */
export function toSearch(state: DiscoveryState): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string | undefined | false) => value && params.set(key, value);
  set('q', state.q);
  set('category', state.category?.join(','));
  set('type', state.type?.join(','));
  set('world', state.world);
  set('city', state.city);
  set('price', state.price);
  set('available', state.available && 'true');
  set('interested', state.interested && 'true');
  set('date', state.date);
  set('page', (state.page ?? 1) > 1 && String(state.page));
  const search = params.toString();
  return search ? `?${search}` : '';
}

/** How many of the sheet's filters are on — the number on the «فیلترها» button. */
export const sheetFilterCount = (state: DiscoveryState) =>
  [state.type?.length, state.world, state.city, state.price, state.available, state.interested].filter(Boolean).length;
