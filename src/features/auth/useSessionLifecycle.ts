import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { authStore } from '@/store/auth';
import { stopOrphanedDriverCapture } from '@/features/driver/runtime';

export function useSessionLifecycle() {
  const [startupError, setStartupError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    void stopOrphanedDriverCapture().then(() => { if (mounted) { setStartupError(false); void authStore.getState().restore(); } })
      .catch(() => { if (mounted) setStartupError(true); });
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') authStore.getState().checkExpiration();
    });
    return () => { mounted = false; listener.remove(); };
  }, [attempt]);
  return { startupError, retryStartup: () => { setStartupError(false); setAttempt((value) => value + 1); } };
}
