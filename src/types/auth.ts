import type { Role } from './roles';

export interface LoginRequest { email: string; password: string }
export type RegisterRequest = LoginRequest & (
  | { role: 'Parent' | 'Student' }
  | { role: 'Driver'; fullname: string; cpf: string; phoneNumber: string;
      licensePlate: string; studentCapacity: number; pixKey: string;
      latitude?: number; longitude?: number }
);
export interface AuthResponse { token: string; role: Role }
export interface Session extends AuthResponse { expiresAt: number }

export interface CredentialStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  remove(): Promise<void>;
}
export interface AuthGateway {
  login(input: LoginRequest, signal: AbortSignal): Promise<unknown>;
  register(input: RegisterRequest, signal: AbortSignal): Promise<unknown>;
}
