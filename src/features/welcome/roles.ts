import type { Role } from '@/types/roles';

export const profiles: { role: Role; title: string; description: string; detail: string }[] = [
  {
    role: 'Parent', title: 'Sou responsável',
    description: 'Mais tranquilidade para acompanhar quem importa.',
    detail: 'Seu acesso será vinculado aos perfis dos seus dependentes. Você poderá selecionar quem acompanhar e informar as preferências de ida e volta.',
  },
  {
    role: 'Student', title: 'Sou estudante',
    description: 'Meu transporte, mais perto da minha rotina.',
    detail: 'Você terá uma conta de estudante e poderá cadastrar seu perfil de passageiro. O acompanhamento depende do vínculo com um motorista.',
  },
  {
    role: 'Driver', title: 'Sou motorista',
    description: 'Passageiros e operação no mesmo lugar.',
    detail: 'Seu cadastro solicitará os dados do motorista e da van. A localização será compartilhada apenas durante uma sessão de rastreamento iniciada por você.',
  },
];
