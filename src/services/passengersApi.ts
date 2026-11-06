import type { AxiosInstance } from 'axios';

import { isRecord } from '../features/auth/session';
import type { Passenger } from '../types/tracking';
import { AppError } from './errors';

export function parsePassenger(value: unknown): Passenger {
  if (!isRecord(value) || typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id <= 0 ||
    typeof value.fullName !== 'string' || typeof value.schoolId !== 'number' ||
    !(value.driverId === null || (typeof value.driverId === 'number' && Number.isSafeInteger(value.driverId) && value.driverId > 0)) ||
    typeof value.isGoingToday !== 'boolean' || typeof value.isReturningToday !== 'boolean') {
    throw new AppError('Não foi possível ler os dados do passageiro. Tente atualizar.');
  }
  return { id: value.id, fullName: value.fullName, schoolId: value.schoolId, driverId: value.driverId,
    isGoingToday: value.isGoingToday, isReturningToday: value.isReturningToday };
}

export function createPassengersApi(api: AxiosInstance) {
  return {
    async list(): Promise<Passenger[]> {
      const { data } = await api.get<unknown>('/api/students');
      if (!Array.isArray(data)) throw new AppError('Não foi possível ler sua lista de passageiros.');
      const passengers = data.map(parsePassenger);
      if (new Set(passengers.map((item) => item.id)).size !== passengers.length) throw new AppError('A lista de passageiros é inválida. Tente atualizar.');
      return passengers;
    },
    async updateStatus(id: number, isGoingToday: boolean, isReturningToday: boolean): Promise<Passenger> {
      const { data } = await api.patch<unknown>(`/api/students/${id}/status`, undefined, { params: { isGoingToday, isReturningToday } });
      const passenger = parsePassenger(data);
      if (passenger.id !== id || passenger.isGoingToday !== isGoingToday || passenger.isReturningToday !== isReturningToday) {
        throw new AppError('O serviço não confirmou a alteração. Atualize e tente novamente.');
      }
      return passenger;
    },
  };
}
