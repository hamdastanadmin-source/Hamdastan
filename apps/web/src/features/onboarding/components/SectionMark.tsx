import { cn } from '@hamdastan/shared/cn';

/**
 * The questionnaire's one piece of artwork: four dots, one per section, on a
 * thin line. Finishing a section fills the next dot and draws the line up to
 * it — a small, quiet sign of progress that changes a little every time,
 * instead of a different illustration per screen.
 *
 * `reached` is how many sections are done (0–4). The newest dot is the only
 * coloured thing on it. Decorative: the heading beside it says the same in
 * words. With reduced motion it simply appears in its final state.
 */

const DOTS = 4;
const WIDTH = 96;
const CY = 8;
const xOf = (index: number) => 8 + (index * (WIDTH - 16)) / (DOTS - 1);

export function SectionMark({ reached, className }: { reached: number; className?: string }) {
  const newest = reached - 1;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} 16`}
      width={WIDTH}
      height={16}
      aria-hidden="true"
      // rtl-ok: SVG coordinates are physical; mirroring makes the first
      // section sit at the reading start (right) in RTL.
      className={cn('overflow-visible rtl:-scale-x-100', className)}
    >
      <line x1={xOf(0)} y1={CY} x2={xOf(DOTS - 1)} y2={CY} className="stroke-foreground/10" strokeWidth={1.5} />
      {reached > 1 && (
        <line
          x1={xOf(0)}
          y1={CY}
          x2={xOf(newest)}
          y2={CY}
          pathLength={1}
          strokeDasharray={1}
          strokeWidth={1.5}
          strokeLinecap="round"
          className="stroke-foreground/35 animate-draw motion-reduce:animate-none"
        />
      )}
      {Array.from({ length: DOTS }, (_, index) =>
        index === newest ? (
          // The animation sits on a wrapper: through `cn`, tailwind-merge
          // reads `fill-mode-backwards` as a fill colour and would drop the
          // circle's `fill-foreground`.
          <g
            key={index}
            className="origin-center [transform-box:fill-box] animate-in fade-in zoom-in-50 delay-300 duration-500 fill-mode-backwards motion-reduce:animate-none"
          >
            <circle cx={xOf(index)} cy={CY} r={4} className="fill-foreground" />
          </g>
        ) : (
          <circle
            key={index}
            cx={xOf(index)}
            cy={CY}
            r={3}
            className={index < newest ? 'fill-foreground/60' : 'fill-foreground/15'}
          />
        )
      )}
    </svg>
  );
}
