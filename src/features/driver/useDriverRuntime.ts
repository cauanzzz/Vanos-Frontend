import * as Network from 'expo-network';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { driverOperation, loadDriverRoster } from './runtime';

export function useDriverRuntime() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let alive = true;
    let active = AppState.currentState === 'active' || AppState.currentState === null;
    let online = true;
    const update = () => driverOperation.presence(active, online);
    update(); void loadDriverRoster();
    const app = AppState.addEventListener('change', (value) => { active = value === 'active'; update(); if (active) void loadDriverRoster(); });
    const network = Network.addNetworkStateListener((value) => { const resumed = !online && value.isConnected !== false; online = value.isConnected !== false; update(); if (resumed) void loadDriverRoster(); });
    void Network.getNetworkStateAsync().then((value) => { if (alive) { online = value.isConnected !== false; update(); } }).catch(() => undefined);
    const timer = setInterval(() => { if (active) setNow(Date.now()); }, 1000);
    const refresh = setInterval(() => { if (active && online) void loadDriverRoster(); }, 30_000);
    return () => { alive = false; app.remove(); network.remove(); clearInterval(timer); clearInterval(refresh); void driverOperation.stop().catch(() => undefined); };
  }, []);
  return now;
}
