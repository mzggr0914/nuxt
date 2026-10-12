import { H3Event } from 'nitro/h3'
import { useRequest } from 'nitro/context'
import { getRouteRules } from '../utils/route-rules.ts'
import type { H3Event as H3EventType } from 'nitro/h3'
import { kEvent, prepareLegacyEvent as prepareEvent } from './event-bridge.ts'

/**
 * v2 `useEvent`. Requires `experimental.asyncContext`, as it did in nitro v2. Returns the
 * event the compat wrapper prepared where there is one, so response mutations are not lost.
 */
export function useEvent (): H3EventType {
  const request = useRequest()
  const context = (request as { context?: Record<string | symbol, any> }).context
  return context?.[kEvent] || new H3Event(request as any)
}

export function prepareLegacyEvent (event: H3EventType): H3EventType {
  return prepareEvent(event, getRouteRules)
}
