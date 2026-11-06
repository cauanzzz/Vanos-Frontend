import type { CredentialStorage } from '../types/auth';

// SecureStore has no web implementation. Keep credentials in memory only.
// Reload closes the web session. Never fall back to localStorage/sessionStorage.
let credential: string | null = null;
export const credentialStorage: CredentialStorage = {
  read: async () => credential,
  write: async (value) => { credential = value; },
  remove: async () => { credential = null; },
};
