import { useEffect } from 'react';
import { AppState } from 'react-native';

import { authStore } from '@/store/auth';

export function useSessionLifecycle() {
  useEffect(() => {
    void authStore.getState().restore();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') authStore.getState().checkExpiration();
    });
    return () => listener.remove();
  }, []);
}
