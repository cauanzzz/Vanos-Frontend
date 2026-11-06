import type { AxiosInstance } from 'axios';

import type { AuthGateway } from '../types/auth';

export function createAuthApi(client: AxiosInstance): AuthGateway {
  return {
    login: async (input, signal) => (await client.post<unknown>('/api/auth/login', input, { signal })).data,
    register: async (input, signal) => (await client.post<unknown>('/api/auth/register', input, { signal })).data,
  };
}
