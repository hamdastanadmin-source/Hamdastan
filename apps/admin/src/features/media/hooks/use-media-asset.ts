'use client';

import { useEffect, useState } from 'react';

import type { MediaAsset } from '@hamdastan/types';

import { adminMediaService } from '@/services';

/** Assets already read in this tab, so a builder full of thumbnails asks once each. */
const known = new Map<string, MediaAsset>();

/** Remembers an asset the panel just received — after an upload or a replacement. */
export function rememberAsset(asset: MediaAsset): void {
  known.set(asset.id, asset);
}

/**
 * One library file by id, for a field that only holds the id. `missing`
 * when the library no longer has it.
 */
export function useMediaAsset(id: string | null | undefined) {
  const [state, setState] = useState<{ id: string; asset: MediaAsset | null } | null>(null);
  const cached = id ? known.get(id) : undefined;

  useEffect(() => {
    if (!id || known.has(id)) return;
    let active = true;
    adminMediaService.get(id).then(
      (asset) => {
        rememberAsset(asset);
        if (active) setState({ id, asset });
      },
      () => active && setState({ id, asset: null })
    );
    return () => {
      active = false;
    };
  }, [id]);

  if (!id) return { asset: null, missing: false };
  if (cached) return { asset: cached, missing: false };
  return { asset: null, missing: state?.id === id && state.asset === null };
}
