import { watch, computed } from 'vue'
import { Event } from '../types'
import { ServiceStore } from './types'

interface QueuePromiseState {
  promise: Promise<any>
  isResolved: boolean
  getter: 'isCreatePending' | 'isUpdatePending' | 'isPatchPending' | 'isRemovePending'
}

const events = ['created', 'updated', 'patched', 'removed']
const state: { [key: string]: QueuePromiseState } = {}

export const makeGetterName = (event: Event): string =>
  `is${event.slice(0, 1).toUpperCase()}${event.slice(1, event.length - 1)}Pending`

export const makeState = (event: Event) => ({
  promise: null,
  isResolved: false,
  getter: makeGetterName(event)
})
export const resetState = (): void => {
  events.forEach((e) => {
    delete state[e]
  })
}
/**
 * Creates or reuses a promise for each event type, like "created". The promise
 * resolves when the matching `isPending` attribute, like "isCreatePending" becomes
 * false.
 * @param store
 * @param event
 * @returns
 */
export function useQueuePromise(
  store: ServiceStore, 
  event: Event
  ): Promise<unknown> {
  state[event] = state[event] || makeState(event)

  if (!state[event].promise || state[event].isResolved) {
    state[event].promise = new Promise((resolve) => {
      const stopWatching = watch(
        () => store[state[event].getter],
        async (isPending) => {
          if (!isPending) {
            setTimeout(() => {
              stopWatching()
              state[event].isResolved = true
              resolve(state[event].isResolved)
            }, 0)
          }
        },
        { immediate: true }
      )
    })
  }
  return state[event].promise
}
