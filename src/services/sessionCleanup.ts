const listeners = new Set<() => void | Promise<void>>();

export function registerSessionCleanup(cleanup: () => void | Promise<void>) {
  listeners.add(cleanup);
  return () => { listeners.delete(cleanup); };
}
export async function clearSessionResources() {
  // Invoke every listener immediately, then await native teardown before allowing another login.
  const results = await Promise.allSettled([...listeners].map((cleanup) => {
    try { return cleanup(); } catch (error: unknown) { return Promise.reject(error); }
  }));
  if (results.some((result) => result.status === 'rejected')) throw new Error('Session resource cleanup failed');
}
