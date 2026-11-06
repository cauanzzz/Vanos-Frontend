import type { Passenger } from './tracking';

export interface DriverProfile { id: number; fullname: string; licensePlate: string; isActive: boolean }
export interface DriverRoster { driver: DriverProfile; passengers: Passenger[] }
export interface CapturedPosition { latitude: number; longitude: number; capturedAt: number; accuracy: number }
export type CaptureMode = 'foreground' | 'background';
export interface DriverCapture {
  start(mode: CaptureMode, receive: (value: CapturedPosition) => void, fail: (message: string, fatal?: boolean) => void): Promise<void>;
  stop(): Promise<void>;
}
