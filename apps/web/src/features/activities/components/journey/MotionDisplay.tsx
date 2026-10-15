'use client';

import { useMemo, useState } from 'react';

import { cn } from '@hamdastan/shared/cn';
import type { MotionSetting, PlayerMedia } from '@hamdastan/types';

import { playableOf } from '../../utils/journey';
import { BuiltinEffect } from './BuiltinEffect';
import { MediaView } from './MediaView';

/**
 * A mascot on a screen — the day's cover, the day-end page: a motion
 * setting drawn in place, looping, with nothing to wait for. A random set
 * picks once per visit; a file that fails simply leaves the space empty.
 */
export function MotionDisplay({
  setting,
  media,
  className,
}: {
  setting: MotionSetting;
  media: Record<string, PlayerMedia>;
  className?: string;
}) {
  const playable = useMemo(() => playableOf(setting, media), [setting, media]);
  const [failed, setFailed] = useState(false);
  if (!playable || failed || playable.kind === 'caption') return null;

  return (
    <div className={cn('flex items-center justify-center', className)}>
      {playable.kind === 'file' ? (
        <MediaView media={playable.media} sound={setting.sound} onError={() => setFailed(true)} className="size-full" />
      ) : (
        <BuiltinEffect effect={playable.setting.effect} />
      )}
    </div>
  );
}
