import type { CapturedPosition } from '../types/driver';

export const DRIVER_LOCATION_TASK = 'vanos-driver-location-v1';
let listener: { receive(value: CapturedPosition): void; fail(message: string): void } | null = null;

export function bindLocationTask(value: NonNullable<typeof listener>) {
  listener = value;
  return () => { if (listener === value) listener = null; };
}
export function deliverTaskLocations(locations: CapturedPosition[], error: boolean): boolean {
  const target = listener;
  if (!target) return false; // Cold/headless restart has no authorized local tracking session.
  if (error) target.fail('O sistema interrompeu a captura de GPS. Confira as permissões e inicie novamente.');
  else {
    // Batches may contain delayed fixes. Only the newest one can be considered by the sender's TTL check.
    const newest = locations.reduce<CapturedPosition | null>((best, value) => !best || value.capturedAt > best.capturedAt ? value : best, null);
    if (newest) target.receive(newest);
  }
  return true;
}
