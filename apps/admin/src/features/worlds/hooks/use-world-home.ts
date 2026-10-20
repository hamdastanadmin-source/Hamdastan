'use client';

import { useCallback, useEffect, useState } from 'react';

import type { AdminWorldHomeSection, WorldHomeCandidate, WorldHomeKind } from '@hamdastan/types';
import { worldHomeInputSchema } from '@hamdastan/validation';

import { errorMessage, fieldErrors } from '@/lib';
import { adminWorldsService } from '@/services';

function move<T>(list: T[], from: number, by: -1 | 1): T[] {
  const to = from + by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/**
 * A world's home as the admin is arranging it: the sections in order, each
 * one's settings and featured items. Nothing is sent until «ذخیره»; the save
 * is checked with the schema the API parses with, and the API's answer
 * (a featured item that does not belong) lands on its section.
 */
export function useWorldHome(worldId: string) {
  const [sections, setSections] = useState<AdminWorldHomeSection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<WorldHomeKind, string>>>({});
  const [dirty, setDirty] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;
    adminWorldsService.home(worldId).then(
      (home) => {
        if (!active) return;
        setSections(home.sections);
        setLoadError(null);
        setDirty(false);
      },
      (caught) => active && setLoadError(errorMessage(caught))
    );
    return () => {
      active = false;
    };
  }, [worldId, reloads]);

  const edit = useCallback((change: (current: AdminWorldHomeSection[]) => AdminWorldHomeSection[]) => {
    setSections((current) => (current ? change(current) : current));
    setDirty(true);
  }, []);

  const update = useCallback(
    (kind: WorldHomeKind, patch: Partial<AdminWorldHomeSection>) => {
      edit((current) => current.map((section) => (section.kind === kind ? { ...section, ...patch } : section)));
      setErrors((current) => ({ ...current, [kind]: undefined }));
    },
    [edit]
  );

  const moveSection = useCallback(
    (kind: WorldHomeKind, by: -1 | 1) => edit((current) => move(current, current.findIndex((section) => section.kind === kind), by)),
    [edit]
  );

  const withFeatured = (kind: WorldHomeKind, change: (featured: WorldHomeCandidate[]) => WorldHomeCandidate[]) =>
    edit((current) => current.map((section) => (section.kind === kind ? { ...section, featured: change(section.featured) } : section)));

  const addFeatured = (kind: WorldHomeKind, item: WorldHomeCandidate) =>
    withFeatured(kind, (featured) => (featured.some((entry) => entry.id === item.id) ? featured : [...featured, item]));
  const removeFeatured = (kind: WorldHomeKind, id: string) => withFeatured(kind, (featured) => featured.filter((entry) => entry.id !== id));
  const moveFeatured = (kind: WorldHomeKind, id: string, by: -1 | 1) =>
    withFeatured(kind, (featured) => move(featured, featured.findIndex((entry) => entry.id === id), by));

  /** Answers true when saved; false with the problems on their sections. */
  const save = async (): Promise<boolean> => {
    if (!sections) return false;
    const input = {
      sections: sections.map(({ featured, ...section }) => ({ ...section, featuredIds: featured.map((item) => item.id) })),
    };
    const parsed = worldHomeInputSchema.safeParse(input);
    if (!parsed.success) {
      const byKind: Partial<Record<WorldHomeKind, string>> = {};
      for (const issue of parsed.error.issues) {
        const index = issue.path[1];
        if (typeof index === 'number') byKind[sections[index].kind] ??= issue.message;
      }
      setErrors(byKind);
      return false;
    }
    try {
      const home = await adminWorldsService.saveHome(worldId, parsed.data);
      setSections(home.sections);
      setErrors({});
      setDirty(false);
      return true;
    } catch (caught) {
      const byField = fieldErrors(caught);
      const byKind: Partial<Record<WorldHomeKind, string>> = {};
      for (const [path, message] of Object.entries(byField)) {
        const index = Number(path.split('.')[1]);
        if (sections[index]) byKind[sections[index].kind] = message;
      }
      if (Object.keys(byKind).length === 0) throw caught;
      setErrors(byKind);
      return false;
    }
  };

  return {
    sections,
    loadError,
    errors,
    dirty,
    reload: useCallback(() => setReloads((n) => n + 1), []),
    update,
    moveSection,
    addFeatured,
    removeFeatured,
    moveFeatured,
    save,
  };
}
