import type { AvatarConfig, AvatarSlot } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import { avatarColors as c } from '@hamdastan/ui/tokens';

/**
 * The avatar, drawn from its five catalog ids as flat layered SVG.
 *
 * One drawing serves every size: `frame` picks which part of it the viewBox
 * shows — the whole figure in the studio, head and shoulders in the
 * identity block, one garment's region in an item preview — so a preview is
 * always exactly what that item looks like on this person.
 *
 * Every colour is an avatar token (`avatarColors`), never a literal.
 */

export type AvatarFrame = 'full' | 'portrait' | AvatarSlot;

const VIEW_BOX: Record<AvatarFrame, string> = {
  full: '0 0 120 250',
  portrait: '24 8 72 72',
  base: '24 8 72 72',
  accessory: '22 4 76 64',
  top: '12 54 96 96',
  bottom: '14 128 92 108',
  shoes: '24 196 72 44',
};

const SKIN: Record<string, string> = {
  'base-1': c.skin1,
  'base-2': c.skin2,
  'base-3': c.skin3,
  'base-4': c.skin4,
};

const TOP: Record<string, string> = { tee: c.stone, shirt: c.sand, hoodie: c.olive, jacket: c.navy };
const BOTTOM: Record<string, string> = { jeans: c.denim, chinos: c.sand, shorts: c.slate, skirt: c.rust };

/** A darker fold or a pocket, laid over a garment's own colour. */
const shade = { fill: c.hair, fillOpacity: 0.22 };

function Bottom({ id }: { id: string }) {
  const fill = BOTTOM[id] ?? c.denim;
  if (id === 'skirt') return <path d="M36 134 H84 L92 188 Q60 194 28 188 Z" fill={fill} />;
  const legHeight = id === 'shorts' ? 32 : 80;
  return (
    <g fill={fill}>
      <rect x="34" y="132" width="52" height="22" rx="4" />
      <rect x="35" y="146" width="24" height={legHeight} rx="6" />
      <rect x="61" y="146" width="24" height={legHeight} rx="6" />
    </g>
  );
}

function Shoe({ id, x }: { id: string; x: number }) {
  if (id === 'boots') {
    return (
      <g>
        <rect x={x + 1} y="208" width="25" height="25" rx="5" fill={c.rust} />
        <rect x={x} y="230" width="27" height="4" rx="2" fill={c.ink} />
      </g>
    );
  }
  if (id === 'loafers') return <rect x={x} y="223" width="27" height="10" rx="5" fill={c.navy} />;
  return (
    <g>
      <rect x={x} y="220" width="27" height="12" rx="6" fill={c.sole} />
      <rect x={x} y="229" width="27" height="4" rx="2" fill={c.stone} />
    </g>
  );
}

function Top({ id, skin }: { id: string; skin: string }) {
  const fill = TOP[id] ?? c.stone;
  const longSleeves = id !== 'tee';
  return (
    <g>
      {/* Sleeves, over the arms. */}
      <g fill={fill}>
        <rect x="21" y="68" width="14" height={longSleeves ? 66 : 26} rx="6.5" />
        <rect x="85" y="68" width="14" height={longSleeves ? 66 : 26} rx="6.5" />
      </g>
      <path d="M35 71 Q35 64 44 64 H76 Q85 64 85 71 L87 140 H33 Z" fill={fill} />

      {id === 'tee' && <path d="M52 64 Q60 73 68 64 Z" fill={skin} />}
      {id === 'shirt' && (
        <g>
          <path d="M54 64 L60 73 L66 64 Z" fill={skin} />
          <path d="M51 64 L60 75 L55 64 Z M69 64 L60 75 L65 64 Z" fill={c.stone} />
          <g fill={c.ink} fillOpacity={0.45}>
            {[86, 100, 114, 128].map((y) => (
              <circle key={y} cx="60" cy={y} r="1.3" />
            ))}
          </g>
        </g>
      )}
      {id === 'hoodie' && (
        <g>
          <path d="M45 65 Q60 53 75 65 Q60 72 45 65 Z" {...shade} />
          <path d="M56 68 V84 M64 68 V84" stroke={c.stone} strokeWidth="1.4" strokeLinecap="round" />
          <rect x="43" y="110" width="34" height="18" rx="6" {...shade} />
        </g>
      )}
      {id === 'jacket' && (
        <g>
          <path d="M50 64 L56 77 L60 66 L64 77 L70 64 Z" {...shade} />
          <path d="M60 67 V140" stroke={c.stone} strokeWidth="1.2" strokeOpacity={0.7} />
        </g>
      )}
    </g>
  );
}

function Accessory({ id }: { id: string }) {
  if (id === 'glasses') {
    return (
      <g fill="none" stroke={c.ink} strokeWidth="1.8">
        <circle cx="52" cy="41" r="6" />
        <circle cx="68" cy="41" r="6" />
        <path d="M58 41 H62" />
      </g>
    );
  }
  if (id === 'cap') {
    return (
      <g fill={c.navy}>
        <path d="M38 33 C38 18 49 12 60 12 C71 12 82 18 82 33 Z" />
        <ellipse cx="60" cy="33" rx="25" ry="4.5" />
      </g>
    );
  }
  if (id === 'headphones') {
    return (
      <g fill={c.ink}>
        <path d="M37 40 C37 12 83 12 83 40" fill="none" stroke={c.ink} strokeWidth="4" strokeLinecap="round" />
        <rect x="32" y="33" width="9" height="16" rx="4" />
        <rect x="79" y="33" width="9" height="16" rx="4" />
      </g>
    );
  }
  return null;
}

export function AvatarFigure({
  avatar,
  frame = 'full',
  className,
  label = 'آواتار',
}: {
  avatar: AvatarConfig;
  frame?: AvatarFrame;
  className?: string;
  /** Empty for a purely decorative copy, such as an item preview beside its own label. */
  label?: string;
}) {
  const skin = SKIN[avatar.base] ?? c.skin2;

  return (
    <svg
      viewBox={VIEW_BOX[frame]}
      className={cn('block', className)}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {/* Legs and arms in skin, under whatever covers them. */}
      <g fill={skin}>
        <rect x="38" y="146" width="18" height="80" rx="6" />
        <rect x="64" y="146" width="18" height="80" rx="6" />
        <rect x="22" y="70" width="12" height="66" rx="6" />
        <rect x="86" y="70" width="12" height="66" rx="6" />
        <circle cx="28" cy="140" r="6.5" />
        <circle cx="92" cy="140" r="6.5" />
        <rect x="53" y="54" width="14" height="14" rx="3" />
      </g>

      <Bottom id={avatar.bottom} />
      <Shoe id={avatar.shoes} x={33} />
      <Shoe id={avatar.shoes} x={60} />
      <Top id={avatar.top} skin={skin} />

      {/* Head. */}
      <g fill={skin}>
        <circle cx="39" cy="40" r="4" />
        <circle cx="81" cy="40" r="4" />
        <circle cx="60" cy="38" r="21" />
      </g>
      <path d="M39 38 C39 22 49 15 60 15 C71 15 81 22 81 38 C77 30 70 27 60 27 C50 27 43 30 39 38 Z" fill={c.hair} />
      <g fill={c.ink}>
        <circle cx="52" cy="41" r="1.8" />
        <circle cx="68" cy="41" r="1.8" />
      </g>
      <path d="M54 49 Q60 53 66 49" fill="none" stroke={c.ink} strokeWidth="1.6" strokeLinecap="round" />

      <Accessory id={avatar.accessory} />
    </svg>
  );
}
