import { useStore } from 'zustand';

import { createAuthApi } from '../services/authApi';
import { credentialStorage } from '../services/credentialStorage';
import { createHttpClients } from '../services/http';
import { clearSessionResources } from '../services/sessionCleanup';
import { createAuthStore, type AuthState } from './createAuthStore';

const clients = createHttpClients({
  origin: () => process.env.EXPO_PUBLIC_API_URL,
  getSession: () => authStore.getState().session,
  onUnauthorized: (session) => authStore.getState().invalidate(session),
});
export const authStore = createAuthStore({
  storage: credentialStorage,
  gateway: createAuthApi(clients.publicApi),
  onSessionEnd: () => { clients.cancelPending(); return clearSessionResources(); },
});
export const api = clients.api;
export function useAuth<T>(selector: (state: AuthState) => T): T {
  return useStore(authStore, selector);
}
