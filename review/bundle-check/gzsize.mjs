import { gzipSync, constants } from 'node:zlib';
import { readFileSync } from 'node:fs';

for (const arg of process.argv.slice(2)) {
  const buf = readFileSync(arg);
  const gz = gzipSync(buf, { level: constants.Z_BEST_COMPRESSION });
  console.log(`${arg}: raw=${buf.length} gz=${gz.length}`);
}
