import { prepare, layout } from '@chenglou/pretext'

try {
  const prepared = prepare('Hello, world!', '16px Inter')
  const result = layout(prepared, 400, 20)
  console.log('OK', result)
} catch (e) {
  console.log('ERROR', e instanceof Error ? e.message : String(e))
}
