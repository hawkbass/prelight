import { ensureCanvasEnv, correctCJKLayout, containsCJK } from '@prelight/core';
import { registerCorpusFonts } from '../corpus/fonts.js';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

await ensureCanvasEnv();
await registerCorpusFonts();

const cases = [
  { text: 'もっと読み込む', font: '14px Inter', maxWidth: 80, lineHeight: 20 },
  { text: '作業を保存してください。', font: '14px Inter', maxWidth: 80, lineHeight: 20 },
];
for (const c of cases) {
  const prep = prepareWithSegments(c.text, c.font);
  const laid = layoutWithLines(prep, c.maxWidth, c.lineHeight);
  console.log(`"${c.text}" @ ${c.maxWidth}px`);
  console.log(`  containsCJK: ${containsCJK(c.text)}`);
  console.log(`  Pretext: ${laid.lineCount} lines, ${laid.height}px`);
  console.log(`  Pretext lines:`, laid.lines.map((l) => ({ text: l.text, width: l.width })));
  const corrected = correctCJKLayout(laid, c.text, c.font, c.maxWidth, c.lineHeight);
  console.log(`  Corrected: ${corrected.lineCount} lines, ${corrected.height}px`);
  console.log(`  Corrected lines:`, corrected.lines.map((l) => ({ text: l.text, width: l.width })));
  console.log();
}
