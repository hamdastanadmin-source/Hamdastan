import Image from 'next/image';

import type { RoleAvatarId } from '@hamdastan/types';
import { cn } from '@hamdastan/shared/cn';

/** How much of the character a box shows. */
export type RoleCharacterFrame = 'full' | 'portrait';

/**
 * A role character — the art for the person's primary role and gender
 * (`public/images/avatars/<role>-<gender>.webp`; masters in
 * `assets/avatars/roles/`).
 *
 * The art is drawn on white, so the box is `bg-avatar-backdrop` in both
 * themes. The caller sizes and shapes the box (`className`) and says how
 * wide it renders (`sizes`).
 */
export function RoleCharacter({
  avatarId,
  frame,
  sizes,
  priority,
  className,
}: {
  avatarId: RoleAvatarId;
  frame: RoleCharacterFrame;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const src = `/images/avatars/${avatarId}.webp`;
  return (
    <span className={cn('relative block overflow-hidden bg-avatar-backdrop', className)}>
      {frame === 'full' ? (
        <Image src={src} alt="" fill sizes={sizes} priority={priority} className="object-contain" />
      ) : (
        <Image
          src={src}
          alt=""
          width={640}
          height={800}
          sizes={sizes}
          priority={priority}
          // The head: the image widened past its box, anchored top-centre. Every
          // character shares one crop box, so one width fits all fourteen.
          // rtl-ok: centring via translate.
          className="absolute top-0 left-1/2 h-auto w-[180%] max-w-none -translate-x-1/2"
        />
      )}
    </span>
  );
}
