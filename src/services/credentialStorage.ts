import * as SecureStore from 'expo-secure-store';

import type { CredentialStorage } from '../types/auth';

const key = 'vanos.session.v1';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const credentialStorage: CredentialStorage = {
  read: () => SecureStore.getItemAsync(key, options),
  write: (value) => SecureStore.setItemAsync(key, value, options),
  remove: () => SecureStore.deleteItemAsync(key, options),
};
