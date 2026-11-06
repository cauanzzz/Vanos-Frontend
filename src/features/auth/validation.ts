import type { RegisterRequest } from '../../types/auth';
import type { Role } from '../../types/roles';

export const emptyForm = {
  email: '', password: '', fullname: '', cpf: '', phoneNumber: '',
  licensePlate: '', studentCapacity: '', pixKey: '',
};
export type AuthForm = typeof emptyForm;
export type FormErrors = Partial<Record<keyof AuthForm, string>>;

export function utf8Length(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const point = char.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function validateForm(form: AuthForm, register: boolean, role: Role): FormErrors {
  const errors: FormErrors = {};
  if (!form.email.trim() || form.email.trim().length > 254 || !/^[^@\s]+@[^@\s]+$/.test(form.email.trim())) errors.email = 'Informe um e-mail válido.';
  if (!form.password.trim()) errors.password = 'Informe sua senha.';
  else if (utf8Length(form.password) > 72) errors.password = 'A senha ultrapassa o limite de 72 bytes. Acentos e emojis ocupam mais de um byte.';
  else if (register && form.password.length < 8) errors.password = 'Use pelo menos 8 caracteres.';
  if (register && role === 'Driver') {
    for (const key of ['fullname', 'cpf', 'phoneNumber', 'licensePlate', 'pixKey'] as const) {
      if (!form[key].trim()) errors[key] = 'Preencha este campo.';
    }
    if (!/^\d+$/.test(form.studentCapacity) || Number(form.studentCapacity) < 1 || Number(form.studentCapacity) > 100) errors.studentCapacity = 'Informe uma capacidade inteira entre 1 e 100.';
  }
  return errors;
}

export function registrationInput(form: AuthForm, role: Role): RegisterRequest {
  const base = { email: form.email.trim().toLowerCase(), password: form.password };
  if (role !== 'Driver') return { ...base, role };
  return { ...base, role, fullname: form.fullname.trim(), cpf: form.cpf.trim(),
    phoneNumber: form.phoneNumber.trim(), licensePlate: form.licensePlate.trim(),
    studentCapacity: Number(form.studentCapacity), pixKey: form.pixKey.trim() };
}
