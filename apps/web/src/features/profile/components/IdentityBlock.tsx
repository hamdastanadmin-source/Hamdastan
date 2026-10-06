import { DEFAULT_AVATAR } from '@hamdastan/config';
import type { AccountProfile, RoleAvatarId } from '@hamdastan/types';
import { Card } from '@hamdastan/ui';
import { cn } from '@hamdastan/shared/cn';

import { RoleCharacter } from '@/components';

import { AvatarFigure } from './AvatarFigure';

/**
 * The top of the hub, as one card: the avatar, large. The badges earned
 * are a card of their own (`BadgesCard`) under it. The avatar is not a link — there is no avatar screen
 * to open. The name is the screen's `h1` for assistive technology only; the
 * screen shows the avatar.
 *
 * Once the questionnaire has given the person a role character, that is the
 * avatar — full-body, with no frame, on a stage the same white as the art.
 * Before, the drawn avatar stands head to chest on a soft neutral disc.
 */
export function IdentityBlock({
  profile,
  character,
}: {
  profile: AccountProfile;
  character: RoleAvatarId | null;
}) {
  return (
    <section aria-label="هویت من">
      <h1 className="sr-only">{profile.displayName ?? 'دوست من'}</h1>

      <Card className="overflow-hidden rounded-2xl shadow-none">
        <div
          className={cn(
            'relative flex justify-center overflow-hidden pt-8',
            // The role art is drawn on white, so its stage is that white in both themes.
            character ? 'bg-avatar-backdrop pb-4' : 'bg-surface-stage'
          )}
        >
          {/* A soft disc behind the head, and a small spark beside it. */}
          {!character && <span aria-hidden="true" className="absolute top-6 size-56 rounded-full bg-secondary" />}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="absolute end-10 top-6 size-8 text-warning"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 3v5M4 9l4 3M20 9l-4 3" />
          </svg>

          {character ? (
            <RoleCharacter
              avatarId={character}
              frame="full"
              sizes="15rem"
              priority
              className="aspect-[4/5] h-72 animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none"
            />
          ) : (
            <AvatarFigure
              avatar={profile.avatar ?? DEFAULT_AVATAR}
              frame="bust"
              label=""
              className="relative size-64 animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none"
            />
          )}
        </div>
      </Card>
    </section>
  );
}
