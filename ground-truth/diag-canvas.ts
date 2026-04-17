import { ensureCanvasEnv, loadBundledFont } from '@prelight/core';

await ensureCanvasEnv();
await loadBundledFont('../corpus/fonts/InterVariable.ttf', 'Inter');

const G = globalThis as unknown as {
  OffscreenCanvas: new (w: number, h: number) => {
    getContext(t: string): { font: string; measureText(t: string): { width: number } };
  };
};
const canvas = new G.OffscreenCanvas(100, 20);
const ctx = canvas.getContext('2d');

for (const font of ['14px Inter', '14px sans-serif', '14px Arial']) {
  ctx.font = font;
  for (const text of ['تسجيل الدخول', 'الإعدادات', 'Hello world']) {
    console.log(`${font.padEnd(20)} | "${text.padEnd(15)}" → ${ctx.measureText(text).width.toFixed(2)}px`);
  }
}

// Direct napi canvas check
const napi = (await import('@napi-rs/canvas')) as any;
const c2 = napi.createCanvas(100, 20);
const x2 = c2.getContext('2d');
for (const font of ['14px Inter', '14px sans-serif']) {
  x2.font = font;
  for (const text of ['تسجيل الدخول', 'الإعدادات']) {
    console.log(`DIRECT ${font.padEnd(16)} | "${text.padEnd(15)}" → ${x2.measureText(text).width.toFixed(2)}px`);
  }
}
