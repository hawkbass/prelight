// Runtime-path consumer: uses verifyComponent with runtime: true.
import { verifyComponent } from '../../packages/react/dist/index.js';

export async function run() {
  return await verifyComponent({
    element: () => null,
    runtime: true,
    font: '16px Inter',
    maxWidth: 120,
    lineHeight: 20,
    constraints: { maxLines: 1 },
  });
}
