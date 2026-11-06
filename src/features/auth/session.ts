import { jwtDecode } from 'jwt-decode';

import { AppError } from '../../services/errors';
import type { Session } from '../../types/auth';
import { isRole } from '../../types/roles';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Decode only for local expiry/routing. Signature and authorization belong to the API.
export function parseSession(value: unknown, now: number): Session {
  if (!isRecord(value) || typeof value.token !== 'string' || !isRole(value.role)) {
    throw new AppError('O serviço retornou uma sessão inválida. Entre novamente.');
  }
  let claims: unknown;
  try { claims = jwtDecode<unknown>(value.token); }
  catch { throw new AppError('Não foi possível ler a sessão. Entre novamente.'); }
  if (!isRecord(claims) || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
    throw new AppError('A sessão não informa uma validade válida. Entre novamente.');
  }
  const role = claims.role ?? claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
  if (role !== value.role) throw new AppError('O perfil da sessão é inválido. Entre novamente.');
  const expiresAt = claims.exp * 1000;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) {
    throw new AppError('Sua sessão expirou. Entre novamente.');
  }
  return { token: value.token, role: value.role, expiresAt };
}

export function serializeSession(session: Session): string {
  return JSON.stringify({ token: session.token, role: session.role });
}

export function canAccess(session: Session | null, area: 'driver' | 'passenger'): boolean {
  return area === 'driver' ? session?.role === 'Driver' : session?.role === 'Parent' || session?.role === 'Student';
}
