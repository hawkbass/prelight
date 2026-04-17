/**
 * Browser-side probe: what does Chrome *really* do with short Arabic strings?
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const playwright = (await import('playwright')) as unknown as {
  chromium: {
    executablePath(): string;
    connectOverCDP(ws: string): Promise<any>;
  };
};

const userDataDir = await mkdtemp(join(tmpdir(), 'prelight-diag-'));
const child = spawn(
  playwright.chromium.executablePath(),
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
const wsUrl = await new Promise<string>((resolve) => {
  child.stderr?.on('data', (buf: Buffer) => {
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf.toString());
    if (m) resolve(m[1]!);
  });
});

const browser = await playwright.chromium.connectOverCDP(wsUrl);
const context = browser.contexts()[0];
const page = await context.newPage();

const interB64 = (await readFile(new URL('../corpus/fonts/InterVariable.ttf', import.meta.url))).toString('base64');

await page.setContent(`<!doctype html><html><head><style>
@font-face { font-family: 'Inter'; src: url('data:font/ttf;base64,${interB64}') format('truetype'); }
body { margin:0; padding:0; }
#probe { font-family: Inter, sans-serif; display: inline-block; white-space: normal; word-wrap: break-word; overflow-wrap: break-word; }
</style></head><body><div id="probe"></div></body></html>`);

await page.evaluate(async () => (document as any).fonts.ready);

const cases = ['تسجيل الدخول', 'تسجيل الخروج', 'الإعدادات', 'تحميل المزيد', 'احفظ عملك.', 'يرجى حفظ عملك قبل المتابعة حتى.'];
for (const text of cases) {
  for (const w of [80, 120, 200]) {
    const info = await page.evaluate(
      ({ t, width }: { t: string; width: number }) => {
        const el = document.getElementById('probe')!;
        el.style.width = `${width}px`;
        el.style.font = '14px Inter';
        el.style.lineHeight = '20px';
        el.textContent = t;
        const rect = el.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(el);
        const rects = Array.from(range.getClientRects()).map((r) => ({
          top: Math.round(r.top),
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
        }));
        return {
          offsetWidth: el.offsetWidth,
          offsetHeight: el.offsetHeight,
          scrollWidth: el.scrollWidth,
          scrollHeight: el.scrollHeight,
          rectWidth: rect.width,
          rectHeight: rect.height,
          rects,
        };
      },
      { t: text, width: w },
    );
    console.log(`"${text}" @ ${w}: offsetH=${info.offsetHeight} scrollW=${info.scrollWidth} rects=${JSON.stringify(info.rects)}`);
  }
}

await browser.close();
child.kill();
await rm(userDataDir, { recursive: true, force: true });
