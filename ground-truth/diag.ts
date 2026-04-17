import { ensureCanvasEnv, loadBundledFont } from '@prelight/core';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

async function main() {
  await ensureCanvasEnv();
  await loadBundledFont('../corpus/fonts/InterVariable.ttf', 'Inter');
  const font = '14px Inter';
  const cases = ['تسجيل الدخول', 'تسجيل الخروج', 'الإعدادات', 'تحميل المزيد', 'احفظ عملك.'];
  for (const text of cases) {
    const prep = prepareWithSegments(text, font);
    const natural = layoutWithLines(prep, Number.POSITIVE_INFINITY, 20);
    const naturalWidth = natural.lines[0]?.width ?? 0;
    const prep2 = prepareWithSegments(text, font);
    const laid80 = layoutWithLines(prep2, 80, 20);
    const C = (globalThis as { OffscreenCanvas: new (w: number, h: number) => { getContext: (t: string) => { font: string; measureText: (t: string) => { width: number } } } }).OffscreenCanvas;
    const canvas = new C(100, 20);
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    const canvasWidth = ctx.measureText(text).width;
    console.log(`"${text}" → natural=${naturalWidth.toFixed(2)} canvas=${canvasWidth.toFixed(2)} laid@80={lines:${laid80.lineCount}, w:[${laid80.lines.map((l) => l.width.toFixed(1)).join(',')}]}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
