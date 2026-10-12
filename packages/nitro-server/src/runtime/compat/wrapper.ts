import { getRouteRules } from '../utils/route-rules.ts'
import { wrapLegacyHandler as wrapHandler } from './handler.ts'

/** Wrap a Nitro runtime handler with the runtime route-rules fallback. */
export function wrapLegacyHandler (input: unknown, base?: string): unknown {
  return wrapHandler(input, base, getRouteRules)
}
