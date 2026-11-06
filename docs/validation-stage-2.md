# Validação da Etapa 2 — 26/10/2026

**Validação local posterior disponível:** o bloqueio de API foi superado. Backend encontrado, iniciado com banco local isolado e HTTP real validado para Parent/Student/Driver. Veja [resultados e roteiro de navegador](local-validation.md). O registro abaixo descreve a entrega anterior, quando a origem não estava configurada.

## Resultado

| Verificação | Resultado |
| --- | --- |
| `npx.cmd expo lint` | Passou, sem erros/avisos após ajuste dos imports Axios |
| `npm.cmd run typecheck` | Passou: app e testes em strict (`tsc --noEmit` + `tsconfig.tests.json`) |
| `npm.cmd test` | **23 testes passaram**, nenhum falhou ou foi ignorado |
| `npx.cmd expo install --check` | Passou: Dependencies are up to date |
| `npx.cmd --yes expo-doctor --verbose` | **20/20 checks passaram** após adicionar autenticação/jwt-decode/tsx; a adição posterior de tipos Node também passou install --check |
| `npx.cmd expo export --platform all` | Passou para Android, iOS e web, repetido após os ajustes finais de sessão/HTTP |
| `git diff --check` | Passou; somente aviso de normalização CRLF do ambiente Windows |
| Backend padrão / contratos | Reconfirmados na master, commit `9fc0757d17e3595de840b22b859c6ef0c27807b8` |
| API real | Não disponível: URL não configurada e portas 5107/7154 com ECONNREFUSED |
| `npm audit --include=dev --json` | Último relatório: 5 altos; relatório inicial: 5 altos + 5 moderados. Análise/evidências em [npm-audit.md](npm-audit.md) |

## Cobertura automatizada

- Restauração assíncrona única, nenhum acesso antes da leitura, sessão válida e timer único.
- Uso da role retornada, guards de Driver/Parent/Student e persistência somente token/role.
- Sessão expirada/corrompida, exp ausente/inválido, role desconhecida e divergente são rejeitados/apagados.
- Expiração local, retorno após suspensão e remoção de timer/credenciais.
- Invalidações repetidas e 401 de sessão antiga sem derrubar novo login.
- Erro de login/rede sem sessão residual; bloqueio de submit duplicado.
- Logout vence login tardio, restauração pendente e gravação lenta.
- Falhas de leitura/escrita/remoção bloqueiam acesso e permitem recuperação.
- Axios envia paths e bodies reais, não envia bearer no login/cadastro e não faz retry/refresh.
- Token atual em cada request, origem configurada, rejeição de URL externa, interceptação 401.
- Expiração antes do envio e durante a requisição; descarte de resposta de sessão encerrada; cancelamento de requests.
- Mensagens de erro não expõem corpo arbitrário do servidor/config/credenciais.
- Adaptador web sem persistência em disco e limpeza ao sair.
- Limite UTF-8 de senha, preservação exata de senha, campos obrigatórios/capacidade do motorista e ausência de coordenadas fabricadas.

Fixtures e adapters estão restritos a `tests/`. São testes determinísticos de comportamento/contrato, não autenticação bem-sucedida contra a API real. Nenhum mock está no fluxo de produção.

O tsx inicialmente não iniciou no ambiente restrito (`uv_os_get_passwd`/ENOMEM). A execução permitida dos mesmos testes fora dessa restrição passou. Não foi alterado o runner para ocultar erros. TypeScript 6 exigiu tipos Node explícitos para os testes; adicionados `@types/node` e tsconfig separado, preservando o conjunto de tipos do app.

## O que falta verificar

Não foram testados login/cadastro live, CORS do browser, SQL Server ou TLS da API. Não havia origem configurada; não foi criado servidor substituto, conta fictícia no app ou endpoint de demonstração.

Nenhum aparelho/emulador foi usado. Build exportado não comprova SecureStore real, teclado, autofill, leitor de tela ou comportamento no ciclo nativo. No web, a sessão é intencionalmente só em memória. Os passos manuais para Windows e Android estão em [authentication.md](authentication.md).

Sem push, deploy, EAS build ou alteração remota/local do backend. Etapa 3 não foi iniciada. Nenhum refresh token ou recuperação de senha foi implementado, pois não há contrato no servidor.
