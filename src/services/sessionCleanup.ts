const listeners = new Set<() => void>();

export function registerSessionCleanup(cleanup: () => void) {
  listeners.add(cleanup);
  return () => { listeners.delete(cleanup); };
}
export function clearSessionResources() {
  // Each listener clears memory synchronously and starts its own guarded teardown.
  for (const cleanup of listeners) cleanup();
}
