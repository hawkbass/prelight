import { ensureCanvasEnv } from '@prelight/core';
import { registerCorpusFonts } from '../corpus/fonts.js';

await ensureCanvasEnv();
const registered = await registerCorpusFonts();
console.log('registered:', registered);

const G = globalThis as unknown as {
  OffscreenCanvas: new (w: number, h: number) => {
    getContext(t: string): { font: string; measureText(t: string): { width: number } };
  };
};
const ctx = new G.OffscreenCanvas(100, 20).getContext('2d');
ctx.font = '14px Inter';
for (const text of ['تسجيل الدخول', 'تسجيل الخروج', 'الإعدادات', 'احفظ عملك.', 'Hello World', '你好世界']) {
  console.log(`"${text}" → canvas.measureText("Inter" family): ${ctx.measureText(text).width.toFixed(2)}`);
}
