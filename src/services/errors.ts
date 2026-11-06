import { isAxiosError, isCancel } from 'axios';

export class AppError extends Error {}

const safeServerMessages = new Set([
  'Este e-mail já está cadastrado.', 'Dados do motorista incompletos.',
  'E-mail inválido ou senha fora do limite (8 caracteres a 72 bytes UTF-8).',
]);

// Never show/log arbitrary server bodies, Axios configs, credentials or JWTs.
export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (isCancel(error)) return 'A solicitação foi interrompida. Tente novamente.';
  if (isAxiosError(error)) {
    if (!error.response) return 'Não foi possível acessar o serviço. Verifique a internet e tente novamente.';
    const { status, data } = error.response;
    if (status === 401) return 'E-mail ou senha inválidos.';
    if (status === 403) return 'Sua conta não tem permissão para esta ação.';
    if (typeof data === 'string' && safeServerMessages.has(data)) return data;
    if (status === 400) return 'Confira os dados informados e tente novamente.';
    if (status === 409) return 'Já existe um cadastro com estes dados. Tente entrar na sua conta.';
    if (status === 429) return 'Muitas tentativas. Aguarde um momento antes de tentar novamente.';
    return 'O serviço está indisponível no momento. Tente novamente mais tarde.';
  }
  return 'Não foi possível concluir. Tente novamente.';
}
