// Roles.cs, backend 9fc0757d17e3595de840b22b859c6ef0c27807b8.
export type Role = 'Parent' | 'Student' | 'Driver';

export function isRole(value: unknown): value is Role {
  return value === 'Parent' || value === 'Student' || value === 'Driver';
}
