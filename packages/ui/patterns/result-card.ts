import { RESULT_CARD } from '@hamdastan/config';

/**
 * The journey's character card, drawn on a canvas at Instagram-story size
 * (1080 × 1920) — so it can be saved or shared as a real image, never a
 * screenshot. The panel's preview and the product's export call this same
 * function, so the admin sees exactly what people will get.
 *
 * Colours are the design tokens, read from the page at draw time; the only
 * colour from outside them is the admin's own card colour, and the words on
 * it take whichever of the two token tones reads on it.
 */

export type ResultCardContent = {
  name: string;
  title: string;
  description: string;
  /** The person's first name, when it may be printed. */
  userName: string | null;
  brandName: string;
  /** The admin's `#rrggbb`, or null for the product's surface. */
  background: string | null;
};

export type ResultCardImages = { character: HTMLImageElement | null; logo: HTMLImageElement | null };

const { WIDTH, HEIGHT } = RESULT_CARD;

/** A token as a CSS colour: `--foreground` holds `H S% L%`. */
function token(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return value ? `hsl(${value})` : '';
}

/** Relative luminance of a colour the canvas understands. */
function luminance(ctx: CanvasRenderingContext2D, colour: string): number {
  ctx.fillStyle = colour;
  const hex = ctx.fillStyle; // the canvas normalises any colour to #rrggbb
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Lines of `text` no wider than `width`, at most `max` — the last one ending in «…» if cut. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= max) return lines;
  return [...lines.slice(0, max - 1), `${lines[max - 1]}…`];
}

/** Draws `image` whole inside the box, centred, without stretching it. */
function contain(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function drawResultCard(canvas: HTMLCanvasElement, content: ResultCardContent, images: ResultCardImages): void {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const surface = content.background ?? token('background');
  // Of the two token tones, the one that reads on this surface.
  const [light, dark] = [token('background'), token('foreground')].sort((a, b) => luminance(ctx, b) - luminance(ctx, a));
  const ink = luminance(ctx, surface) > 0.4 ? dark : light;
  const soft = (alpha: number) => {
    ctx.globalAlpha = alpha;
  };

  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink;

  // The brand at the top: its logo, or its name.
  if (images.logo) contain(ctx, images.logo, WIDTH / 2 - 160, 110, 320, 120);
  else if (content.brandName) {
    ctx.font = `700 56px ${font}`;
    ctx.fillText(content.brandName, WIDTH / 2, 190);
  }

  // The character, in a soft panel.
  soft(0.08);
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.roundRect(110, 300, WIDTH - 220, 820, 64);
  ctx.fill();
  soft(1);
  if (images.character) contain(ctx, images.character, 150, 340, WIDTH - 300, 740);

  ctx.fillStyle = ink;
  let y = 1240;
  if (content.userName) {
    soft(0.7);
    ctx.font = `500 44px ${font}`;
    ctx.fillText(`شخصیت ${content.userName}:`, WIDTH / 2, y);
    soft(1);
    y += 110;
  } else {
    y += 40;
  }

  ctx.font = `800 104px ${font}`;
  ctx.fillText(content.name, WIDTH / 2, y, WIDTH - 160);
  y += 86;

  if (content.title) {
    soft(0.75);
    ctx.font = `600 54px ${font}`;
    ctx.fillText(content.title, WIDTH / 2, y, WIDTH - 160);
    soft(1);
    y += 90;
  }

  if (content.description) {
    soft(0.7);
    ctx.font = `400 42px ${font}`;
    for (const line of wrap(ctx, content.description, WIDTH - 220, 5)) {
      ctx.fillText(line, WIDTH / 2, y);
      y += 66;
    }
    soft(1);
  }

  // The brand again at the foot, where a story's reader looks last.
  if (content.brandName) {
    soft(0.55);
    ctx.font = `600 40px ${font}`;
    ctx.fillText(content.brandName, WIDTH / 2, HEIGHT - 110);
    soft(1);
  }
}

/** An image ready to draw; null if it cannot be loaded (the card is drawn without it). */
export function loadCardImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    // Our API serves the files with CORS, so drawing them keeps the canvas exportable.
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** The card as a PNG file, named for saving. */
export function cardFile(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ? new File([blob], `${name}.png`, { type: 'image/png' }) : null), 'image/png')
  );
}
