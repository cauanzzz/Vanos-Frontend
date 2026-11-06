import { create, isAxiosError } from 'axios';

import type { Session } from '../types/auth';
import { AppError } from './errors';

declare module 'axios' {
  interface AxiosRequestConfig {
    vanosSession?: Session;
    vanosController?: AbortController;
    vanosAbortCleanup?: () => void;
  }
}

export function normalizeApiOrigin(value: string | undefined): string {
  try {
    const url = new URL(value?.trim() ?? '');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) throw new Error();
    return url.origin;
  } catch { throw new AppError('O serviço ainda não está configurado neste ambiente.'); }
}

export function createHttpClients(deps: {
  origin: () => string | undefined;
  getSession: () => Session | null;
  onUnauthorized: (session: Session) => Promise<void>;
  now?: () => number;
}) {
  const publicApi = create({ timeout: 15_000 });
  const api = create({ timeout: 15_000 });
  const pending = new Set<AbortController>();
  const now = deps.now ?? Date.now;

  publicApi.interceptors.request.use((config) => {
    config.baseURL = normalizeApiOrigin(deps.origin());
    if (!config.url?.startsWith('/') || config.url.startsWith('//') || config.url.includes('\\')) throw new AppError('Endereço de solicitação inválido.');
    config.headers.delete('Authorization');
    config.headers.set('Accept', 'application/json');
    return config;
  });
  api.interceptors.request.use(async (config) => {
    config.baseURL = normalizeApiOrigin(deps.origin());
    if (!config.url?.startsWith('/') || config.url.startsWith('//') || config.url.includes('\\')) throw new AppError('Endereço de solicitação inválido.');
    const session = deps.getSession();
    if (!session) throw new AppError('Entre na sua conta para continuar.');
    if (session.expiresAt <= now()) {
      await deps.onUnauthorized(session);
      throw new AppError('Sua sessão expirou. Entre novamente.');
    }
    const controller = new AbortController();
    config.vanosSession = session;
    config.vanosController = controller;
    const callerSignal = config.signal;
    const abort = () => controller.abort();
    if (callerSignal?.aborted) abort();
    else callerSignal?.addEventListener?.('abort', abort, { once: true });
    config.vanosAbortCleanup = () => callerSignal?.removeEventListener?.('abort', abort);
    config.signal = controller.signal;
    pending.add(controller);
    config.headers.set('Authorization', `Bearer ${session.token}`);
    config.headers.set('Accept', 'application/json');
    return config;
  });
  api.interceptors.response.use(
    async (response) => {
      if (response.config.vanosController) pending.delete(response.config.vanosController);
      response.config.vanosAbortCleanup?.();
      if (response.config.vanosSession !== deps.getSession()) throw new AppError('A sessão foi encerrada.');
      const session = response.config.vanosSession;
      if (session && session.expiresAt <= now()) {
        await deps.onUnauthorized(session);
        throw new AppError('Sua sessão expirou. Entre novamente.');
      }
      return response;
    },
    async (error: unknown) => {
      if (isAxiosError(error)) {
        if (error.config?.vanosController) pending.delete(error.config.vanosController);
        error.config?.vanosAbortCleanup?.();
        const session = error.config?.vanosSession;
        if (error.response?.status === 401 && session) {
          await deps.onUnauthorized(session);
          throw new AppError('Sua sessão expirou ou foi recusada. Entre novamente.');
        }
      }
      throw error;
    },
  );
  return { publicApi, api, cancelPending() { pending.forEach((controller) => controller.abort()); pending.clear(); } };
}
