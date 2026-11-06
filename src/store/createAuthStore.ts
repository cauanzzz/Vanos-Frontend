import { createStore } from 'zustand/vanilla';

import { parseSession, serializeSession } from '../features/auth/session';
import { AppError } from '../services/errors';
import type { AuthGateway, CredentialStorage, LoginRequest, RegisterRequest, Session } from '../types/auth';

type Phase = 'restoring' | 'anonymous' | 'authenticated' | 'signingOut' | 'storageError';
export interface AuthState {
  phase: Phase;
  session: Session | null;
  busy: boolean;
  notice: string | null;
  recovery: 'restore' | 'clear';
  restore(): Promise<void>;
  login(input: LoginRequest): Promise<void>;
  register(input: RegisterRequest): Promise<void>;
  logout(): Promise<void>;
  invalidate(session: Session): Promise<void>;
  checkExpiration(): void;
}

interface Dependencies {
  storage: CredentialStorage;
  gateway: AuthGateway;
  onSessionEnd?: () => void;
  now?: () => number;
  schedule?: (fn: () => void, delay: number) => () => void;
}

export function createAuthStore({ storage, gateway, onSessionEnd, now = Date.now,
  schedule = (fn, delay) => { const timer = setTimeout(fn, delay); return () => clearTimeout(timer); },
}: Dependencies) {
  let revision = 0;
  let restorePending: Promise<void> | null = null;
  let clearPending: Promise<void> | null = null;
  let authController: AbortController | null = null;
  let cancelExpiry: (() => void) | undefined;
  let storageQueue = Promise.resolve();
  function persist(action: () => Promise<void>) {
    const pending = storageQueue.then(action);
    storageQueue = pending.catch(() => undefined);
    return pending;
  }

  const store = createStore<AuthState>()((set, get) => {
    function activate(session: Session) {
      cancelExpiry?.();
      set({ session, phase: 'authenticated', busy: false, notice: null });
      cancelExpiry = schedule(() => get().checkExpiration(), Math.min(session.expiresAt - now(), 2_147_483_647));
    }

    function clear(notice: string | null): Promise<void> {
      if (clearPending) return clearPending;
      ++revision;
      authController?.abort();
      authController = null;
      cancelExpiry?.();
      cancelExpiry = undefined;
      set({ session: null, busy: false, phase: 'signingOut', notice, recovery: 'clear' });
      onSessionEnd?.();
      clearPending = persist(() => storage.remove()).then(
        () => { set({ phase: 'anonymous' }); },
        () => { set({ phase: 'storageError', notice: 'Não foi possível apagar as credenciais do aparelho. Tente novamente antes de continuar.' }); },
      ).finally(() => { clearPending = null; });
      return clearPending;
    }

    async function authenticate(request: (signal: AbortSignal) => Promise<unknown>, register = false) {
      if (get().phase !== 'anonymous' || get().busy) throw new AppError('Aguarde a solicitação atual.');
      const version = ++revision;
      const controller = new AbortController();
      authController = controller;
      set({ busy: true, notice: null });
      try {
        const response = await request(controller.signal);
        if (version !== revision) return;
        const session = parseSession(response, now());
        try {
          await persist(async () => { if (version === revision) await storage.write(serializeSession(session)); });
        } catch {
          const message = register
            ? 'A conta foi criada, mas não foi possível guardar sua sessão. Entre com seu e-mail e senha.'
            : 'Não foi possível salvar sua sessão com segurança. Tente entrar novamente.';
          await clear(message);
          throw new AppError(message);
        }
        if (version !== revision) return;
        if (session.expiresAt <= now()) { await clear('Sua sessão expirou. Entre novamente.'); return; }
        activate(session);
      } finally {
        if (version === revision) { authController = null; set({ busy: false }); }
      }
    }

    return {
      phase: 'restoring', session: null, busy: false, notice: null, recovery: 'restore',
      restore() {
        if (restorePending) return restorePending;
        if (get().phase !== 'restoring' && !(get().phase === 'storageError' && get().recovery === 'restore')) return Promise.resolve();
        const version = ++revision;
        set({ phase: 'restoring', notice: null });
        restorePending = (async () => {
          let raw: string | null;
          try { raw = await persistRead(); }
          catch {
            if (version === revision) set({ phase: 'storageError', recovery: 'restore', notice: 'Não foi possível ler sua sessão com segurança.' });
            return;
          }
          if (version !== revision) return;
          if (raw === null) { set({ phase: 'anonymous' }); return; }
          try { activate(parseSession(JSON.parse(raw) as unknown, now())); }
          catch { await clear('Sua sessão expirou ou é inválida. Entre novamente.'); }
        })().finally(() => { restorePending = null; });
        return restorePending;
      },
      login: (input) => authenticate((signal) => gateway.login(input, signal)),
      register: (input) => authenticate((signal) => gateway.register(input, signal), true),
      logout: () => clear(null),
      invalidate: (session) => get().session === session ? clear('Sua sessão expirou ou foi recusada. Entre novamente.') : Promise.resolve(),
      checkExpiration() {
        const session = get().session;
        if (!session) return;
        if (session.expiresAt <= now()) { void get().invalidate(session); }
        else {
          cancelExpiry?.();
          cancelExpiry = schedule(() => get().checkExpiration(), Math.min(session.expiresAt - now(), 2_147_483_647));
        }
      },
    };
  });
  async function persistRead() { await storageQueue; return storage.read(); }
  return store;
}
