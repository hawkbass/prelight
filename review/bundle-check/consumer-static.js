// Static-only consumer: imports verifyComponent, never uses runtime probe.
// Reaches into the package's dist/ to simulate what a bundler resolves via
// the package.json "exports.import" entry for "@prelight/react" (index.js).
import { verifyComponent } from '../../packages/react/dist/index.js';

export function run() {
  return verifyComponent({
    element: () => null,
    font: '16px Inter',
    maxWidth: 120,
    lineHeight: 20,
    constraints: { maxLines: 1 },
  });
}
