import { POSTER } from '../core/types';
import type { ShareItem } from './share';

export type Verdict = 'must' | 'worth' | 'skip';

export const VERDICTS: { id: Verdict; label: string; color: string }[] = [
  { id: 'must', label: 'Must watch', color: '#f6b23c' },
  { id: 'worth', label: 'Worth it', color: '#7fe0b8' },
  { id: 'skip', label: 'Skip it', color: '#f0745e' },
];

const W = 1080;
const H = 1920;
const NIGHT = '#141633';
const NIGHT_2 = '#1c1f45';
const LAMP = '#f6b23c';
const MINT = '#d5f5e6';
const INK = '#163b44';
const DISPLAY = '"Big Shoulders Display", "Arial Narrow", sans-serif';
const BODY = '"Schibsted Grotesk", system-ui, sans-serif';
const MONO = '"Martian Mono", ui-monospace, monospace';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Wraps text into at most `max` lines that fit `width`, ending with an ellipsis if cut. */
function lines(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= width) line = test;
    else {
      if (line) out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  if (out.length > max) {
    const kept = out.slice(0, max);
    let last = kept[max - 1];
    while (ctx.measureText(`${last}…`).width > width && last.length) last = last.slice(0, -1);
    kept[max - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return out;
}

/**
 * Draws the 9:16 story card: a mint ticket with the poster, title and a verdict stamp, under
 * the booth's marquee lights. Everything is drawn locally; only the poster comes from TMDB.
 */
export async function drawStory(
  canvas: HTMLCanvasElement,
  item: ShareItem,
  opts: { name: string | null; verdict: Verdict; note: string; posterless?: boolean },
): Promise<void> {
  await Promise.all([
    document.fonts.load(`900 120px ${DISPLAY}`),
    document.fonts.load(`500 40px ${BODY}`),
    document.fonts.load(`400 30px ${MONO}`),
  ]).catch(() => undefined);
  const posterSrc = POSTER(item.poster, 'w500');
  // A separate URL keeps this CORS request apart from the plain <img> copy in the HTTP cache.
  const poster = posterSrc && !opts.posterless ? await loadImage(`${posterSrc}?story`) : null;

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Night sky with a warm projector glow.
  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 760, 80, W / 2, 760, 900);
  glow.addColorStop(0, 'rgba(246,178,60,0.22)');
  glow.addColorStop(1, 'rgba(246,178,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Marquee bulbs.
  for (let i = 0; i < 15; i++) {
    const x = 90 + i * (900 / 14);
    ctx.beginPath();
    ctx.arc(x, 120, 11, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? 'rgba(246,178,60,0.35)' : LAMP;
    ctx.shadowColor = LAMP;
    ctx.shadowBlur = i % 2 ? 0 : 24;
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  ctx.textAlign = 'center';
  ctx.fillStyle = LAMP;
  ctx.font = `900 76px ${DISPLAY}`;
  ctx.letterSpacing = '10px';
  const heading = opts.name ? `${opts.name} recommends`.toUpperCase() : 'TONIGHT’S PICK';
  ctx.fillText(lines(ctx, heading, 940, 1)[0], W / 2, 240);
  ctx.letterSpacing = '0px';

  // The ticket.
  const tx = 100;
  const ty = 300;
  const tw = 880;
  const th = 1250;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  roundRect(ctx, tx, ty, tw, th, 36);
  ctx.fillStyle = MINT;
  ctx.fill();
  ctx.restore();
  // Notches where the stub tears off.
  const tearY = ty + th - 230;
  ctx.fillStyle = NIGHT;
  for (const x of [tx, tx + tw]) {
    ctx.beginPath();
    ctx.arc(x, tearY, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.setLineDash([16, 14]);
  ctx.strokeStyle = 'rgba(22,59,68,0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(tx + 50, tearY);
  ctx.lineTo(tx + tw - 50, tearY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Poster.
  const pw = 520;
  const ph = 780;
  const px = (W - pw) / 2;
  const py = ty + 60;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 20);
  ctx.clip();
  if (poster) ctx.drawImage(poster, px, py, pw, ph);
  else {
    const g = ctx.createLinearGradient(px, py, px + pw, py + ph);
    g.addColorStop(0, '#3a3f78');
    g.addColorStop(1, NIGHT_2);
    ctx.fillStyle = g;
    ctx.fillRect(px, py, pw, ph);
  }
  ctx.restore();

  // Verdict stamp over the poster corner.
  const v = VERDICTS.find((x) => x.id === opts.verdict)!;
  ctx.save();
  ctx.translate(px + pw - 40, py + ph - 70);
  ctx.rotate(-0.16);
  ctx.font = `900 64px ${DISPLAY}`;
  const label = v.label.toUpperCase();
  const sw = ctx.measureText(label).width + 60;
  roundRect(ctx, -sw / 2, -50, sw, 100, 14);
  ctx.fillStyle = NIGHT;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = v.color;
  ctx.stroke();
  ctx.fillStyle = v.color;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 4);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';

  // Title and details.
  ctx.fillStyle = INK;
  ctx.font = `900 84px ${DISPLAY}`;
  const titleLines = lines(ctx, item.title.toUpperCase(), tw - 120, 2);
  let y = py + ph + 100;
  for (const l of titleLines) {
    ctx.fillText(l, W / 2, y);
    y += 82;
  }
  ctx.font = `400 30px ${MONO}`;
  const meta = [
    item.year ? String(item.year) : null,
    item.type === 'tv' ? 'Series' : 'Movie',
    item.rating ? `★ ${item.rating.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');
  ctx.fillText(meta, W / 2, Math.min(y + 4, tearY - 30));

  // The stub: the note, or the genres.
  ctx.font = `500 40px ${BODY}`;
  const note = opts.note.trim();
  const stubText = note ? `“${note}”` : (item.genres ?? []).slice(0, 3).join(' · ');
  const noteLines = lines(ctx, stubText, tw - 140, 3);
  let ny = tearY + 90 - (noteLines.length - 1) * 26;
  for (const l of noteLines) {
    ctx.fillText(l, W / 2, ny);
    ny += 52;
  }

  // Footer.
  ctx.fillStyle = LAMP;
  ctx.font = `900 56px ${DISPLAY}`;
  ctx.letterSpacing = '4px';
  ctx.fillText('WHAT TO WATCH?', W / 2, 1700);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = 'rgba(232,234,255,0.75)';
  ctx.font = `400 30px ${MONO}`;
  ctx.fillText('Roll your own pick at whattowatch.jsalonga.dev', W / 2, 1760);
}
