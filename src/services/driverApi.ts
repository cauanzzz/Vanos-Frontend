import { isAxiosError, type AxiosInstance } from 'axios';

import { isRecord } from '../features/auth/session';
import type { DriverProfile, DriverRoster } from '../types/driver';
import { AppError } from './errors';
import { parsePassenger } from './passengersApi';

export function createDriverApi(api: AxiosInstance) {
  return { async roster(): Promise<DriverRoster> {
    const { data } = await api.get<unknown>('/api/drivers');
    if (!Array.isArray(data) || data.length !== 1) throw new AppError('Não foi possível identificar seu cadastro de motorista.');
    const value: unknown = data[0];
    if (!isRecord(value) || !Number.isSafeInteger(value.id) || typeof value.id !== 'number' || value.id <= 0 ||
      typeof value.fullname !== 'string' || typeof value.licensePlate !== 'string' || typeof value.isActive !== 'boolean') {
      throw new AppError('O serviço retornou um cadastro de motorista inválido.');
    }
    const driver: DriverProfile = { id: value.id, fullname: value.fullname, licensePlate: value.licensePlate, isActive: value.isActive };
    try {
      const response = await api.get<unknown>(`/api/drivers/${driver.id}/students`);
      if (!Array.isArray(response.data)) throw new AppError('A lista de passageiros é inválida.');
      const passengers = response.data.map(parsePassenger);
      if (passengers.some((item) => item.driverId !== driver.id) || new Set(passengers.map((item) => item.id)).size !== passengers.length) {
        throw new AppError('O serviço retornou vínculos inconsistentes. Atualize a lista.');
      }
      return { driver, passengers };
    } catch (error: unknown) {
      // This exact authorized endpoint returns 404 for an empty roster.
      if (isAxiosError(error) && error.response?.status === 404) return { driver, passengers: [] };
      throw error;
    }
  } };
}
