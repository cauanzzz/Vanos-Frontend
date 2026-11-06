import * as Network from 'expo-network';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

import { startPassengerRuntime } from './runtime';

export function usePassengerRuntime() {
  const runtime = useRef<ReturnType<typeof startPassengerRuntime>>(null);
  const [now, setNow] = useState(Date.now);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    let foreground = AppState.currentState === 'active' || AppState.currentState === null;
    let online = true;
    runtime.current = startPassengerRuntime();
    const presence = () => runtime.current?.presence(foreground, online);
    presence();
    const appListener = AppState.addEventListener('change', (state) => { foreground = state === 'active'; presence(); if (foreground) setNow(Date.now()); });
    const networkListener = Network.addNetworkStateListener((state) => { online = state.isConnected !== false; presence(); });
    void Network.getNetworkStateAsync().then((state) => { if (mounted) { online = state.isConnected !== false; presence(); } }).catch(() => undefined);
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduceMotion(value); }).catch(() => undefined);
    const motionListener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const timer = setInterval(() => { if (foreground) setNow(Date.now()); }, 1000);
    const refresh = setInterval(() => { if (foreground && online) runtime.current?.retry(); }, 30_000);
    return () => {
      mounted = false; clearInterval(timer); clearInterval(refresh);
      appListener.remove(); networkListener.remove(); motionListener.remove();
      runtime.current?.dispose(); runtime.current = null;
    };
  }, []);
  return { now, reduceMotion, retry: () => runtime.current?.retry() };
}
