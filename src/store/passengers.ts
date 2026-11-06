import { createStore } from 'zustand/vanilla';

import { errorMessage } from '../services/errors';
import type { Passenger } from '../types/tracking';

export function createPassengersStore(gateway: {
  list(): Promise<Passenger[]>;
  updateStatus(id: number, going: boolean, returning: boolean): Promise<Passenger>;
}) {
  let revision = 0;
  let pending: Promise<void> | null = null;
  return createStore<{
    items: Passenger[];
    selectedId: number | null;
    phase: 'idle' | 'loading' | 'ready' | 'error';
    refreshing: boolean;
    saving: boolean;
    error: string | null;
    notice: string | null;
    load(): Promise<void>;
    select(id: number): void;
    updateStatus(going: boolean, returning: boolean): Promise<void>;
    reset(): void;
  }>()((set, get) => ({
    items: [], selectedId: null, phase: 'idle', refreshing: false, saving: false, error: null, notice: null,
    load() {
      if (pending) return pending;
      if (get().saving) return Promise.resolve();
      const version = revision;
      set({ refreshing: true, ...(get().phase === 'idle' || get().phase === 'error' ? { phase: 'loading' as const } : {}) });
      pending = gateway.list().then((items) => {
        if (version !== revision) return;
        set({ items, selectedId: items.some((item) => item.id === get().selectedId) ? get().selectedId : items[0]?.id ?? null,
          phase: 'ready', error: null });
      }).catch((error: unknown) => {
        if (version === revision) set({ error: errorMessage(error), phase: get().items.length ? 'ready' : 'error' });
      }).finally(() => {
        if (version === revision) { pending = null; set({ refreshing: false }); }
      });
      return pending;
    },
    select(id) { if (get().items.some((item) => item.id === id)) set({ selectedId: id, notice: null, error: null }); },
    async updateStatus(going, returning) {
      const id = get().selectedId;
      if (id === null || get().saving || get().refreshing) return;
      const version = revision;
      set({ saving: true, error: null, notice: null });
      try {
        const passenger = await gateway.updateStatus(id, going, returning);
        if (version !== revision) return;
        set({ items: get().items.map((item) => item.id === id ? passenger : item), notice: get().selectedId === id ? 'Preferências salvas.' : null });
      } catch (error: unknown) {
        if (version === revision) set({ error: errorMessage(error) });
      } finally { if (version === revision) set({ saving: false }); }
    },
    reset() {
      ++revision; pending = null;
      set({ items: [], selectedId: null, phase: 'idle', refreshing: false, saving: false, error: null, notice: null });
    },
  }));
}
