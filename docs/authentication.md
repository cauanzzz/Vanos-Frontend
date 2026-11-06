# Etapa 2 — Sessão e autenticação

**Validação local posterior:** backend encontrado em `Desktop\Vanos-Limpo`, compilado em cópia isolada e executado com SQL Express/banco dedicado. Cadastro/login reais foram verificados para os três perfis. O [roteiro local](local-validation.md) substitui a limitação de API inacessível registrada ao fim deste documento; os limites de SecureStore no web e teste físico permanecem.

Implementação HTTP dos contratos reais, reconfirmados em 26/10/2026 na branch padrão `master`, commit [`9fc0757d17e3595de840b22b859c6ef0c27807b8`](https://github.com/cauanzzz/Vanos-Backend/tree/9fc0757d17e3595de840b22b859c6ef0c27807b8). Foram relidos AuthController, LoginRequest, RegisterRequest, AuthResponse, JwtTokenService, Roles e Program.cs. Backend somente leitura.

## O que foi implementado

- POST `/api/auth/login`: `{email,password}` → `{token,role}`.
- POST `/api/auth/register`: base `{email,password,role}`; Driver também envia `fullname,cpf,phoneNumber,licensePlate,studentCapacity,pixKey`. Latitude/longitude são opcionais no servidor e não são coletadas no cadastro mobile.
- Validação de resposta em runtime, contratos TypeScript e roles exatas `Driver`, `Parent`, `Student`. Role do JWT confrontada com a resposta; seleção inicial não altera o login nem concede acesso.
- Formulários com estados de validação, envio, erro e nova tentativa; campos extras do motorista; senha nunca é normalizada ou persistida. Limites reais: mínimo de 8 caracteres no cadastro, máximo de 72 bytes UTF-8 e capacidade inteira de 1–100. Sem validações de CPF/telefone/placa inventadas.
- SecureStore nativo com `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, armazenando somente `{token,role}`. Expiração derivada de `exp`; JWT decodificado localmente **sem verificar assinatura**. Assinatura/conta/perfil/autorização continuam responsabilidade da API.
- Zustand vanilla com estados `restoring`, `anonymous`, `authenticated`, `signingOut`, `storageError`. Rotas só são montadas depois da restauração; nenhuma decisão antecipada de redirecionamento.
- `Stack.Protected` no layout raiz protege `(auth)`, `(driver)` e `(passenger)`. Driver acessa `/driver`; Parent/Student acessam `/passenger`. A rota inicial redireciona segundo a sessão retornada. Links diretos não contornam os guards.
- Axios público para login/cadastro, sem bearer; cliente autenticado exportado em `store/auth.ts` para os próximos recursos. Interceptor consulta a sessão atual a cada chamada. Origem fixa da configuração, timeout de 15 s, sem retries automáticos nem refresh.
- Expiração por timer e conferência ao voltar ao foreground, antes do envio HTTP e antes de entregar respostas autenticadas. 401 autenticado encerra a sessão sem repetir requisição. 401 do login mostra credenciais inválidas e não dispara logout global.
- Logout limpa a sessão da memória imediatamente, cancela login e requests autenticados, cancela timer e remove o SecureStore. Escritas são serializadas: logout durante gravação garante que a remoção venha depois dela. Respostas tardias de sessões antigas são descartadas e não derrubam um login novo.
- Falha de leitura do armazenamento bloqueia a navegação e oferece retry ou remoção. Falha de remoção também bloqueia novo login até conseguir apagar as credenciais, em vez de afirmar que o logout persistiu.

Não há endpoint de refresh, recuperação de senha, revogação/logout ou `/me`. Nenhum foi inventado. Restaurar valida o formato/role/exp localmente; não comprova que a conta continua autorizada no banco. A primeira requisição protegida terá a validação do servidor. O app não faz uma chamada fictícia de validação.

No **web**, SecureStore não está disponível: o adaptador usa memória apenas, sem localStorage/sessionStorage. Recarregar a página exige novo login. A interface informa esse comportamento. Persistência segura/restauração nativa precisa ser validada no Android/iOS.

Não há store de passageiros, conexão SignalR ou tarefa de GPS ativa nesta etapa. Portanto, nenhum desses dados/recursos é criado ou mantido após logout. Etapas 3/4 deverão conectar sua limpeza a `onSessionEnd` e manter o descarte de respostas antigas. Não há promessa de limpeza de recursos que ainda não foram implementados.

## Arquivos principais

| Responsabilidade | Arquivo |
| --- | --- |
| Contratos | `src/types/auth.ts`, `src/types/roles.ts` |
| Máquina de sessão testável | `src/store/createAuthStore.ts` |
| Composição nativa e hook | `src/store/auth.ts` |
| Persistência por plataforma | `src/services/credentialStorage.ts`, `.web.ts` |
| HTTP / gateway | `src/services/http.ts`, `src/services/authApi.ts`, `errors.ts` |
| JWT e validação | `src/features/auth/session.ts`, `validation.ts` |
| Formulários / restauração / área da conta | `src/features/auth/*` |
| Guards e rotas | `src/app/_layout.tsx`, `(auth)`, `(driver)`, `(passenger)` |
| Testes | `tests/session.test.ts`, `http.test.ts`, `validation.test.ts`, `storage-web.test.ts` |

Mantidos Expo 58, NativeWind 4, Reanimated/Worklets, configurações Android/iOS, scheme e identificadores. Adicionados apenas jwt-decode (leitura do JWT), tsx e tipos Node (testes). Nenhum novo módulo nativo nesta etapa.

## Como testar no Windows

1. Use Node 24 (ambiente desta entrega), execute `npm.cmd ci` no terminal do VS Code.
2. Copie `.env.example` para `.env`, se ainda não existir; defina `EXPO_PUBLIC_API_URL` com a **origem real sem `/api`**, query ou credenciais: por exemplo `https://seu-tunel-da-api.example.com`. A aplicação não tem URL de fallback.
3. Execute `npm.cmd run lint`, `npm.cmd run typecheck` e `npm.cmd test`.
4. Execute `npm.cmd run web`, escolha um perfil e abra login/cadastro. O formulário de login não pede role. No cadastro é possível revisar a escolha.
5. Sem URL configurada, confirme a mensagem de serviço não configurado. Com origem inacessível, confirme erro de conectividade e possibilidade de reenviar. Não haverá sessão de demonstração.
6. Com backend acessível: crie contas de teste Parent, Student e Driver (e-mails diferentes); confirme a área correta após cada resposta. Driver exige os campos extras. Saia e entre com senha errada para testar credenciais inválidas. Confira e-mail duplicado e validação de campos.
7. Selecione motorista na tela inicial e faça login com conta Parent: o resultado deve ser `/passenger`. Abra `/driver` diretamente com Parent/Student: deve voltar à área permitida. Sem login, `/driver` e `/passenger` devem voltar ao início.
8. No web, recarregue e confira que o login foi encerrado. Não use esse comportamento para avaliar a persistência nativa.

**CORS:** Program.cs auditado não configura uma política para o navegador. Mesmo com URL correta, o browser pode bloquear login/cadastro até que o backend ou um proxy local de desenvolvimento permita a origem exata do Metro. O mobile não depende de CORS. Essa necessidade é documentada, sem editar o backend.

## Como testar no Android

1. Prepare/instale o development build descrito no README. Se já tinha o binário da Etapa 1 com SecureStore, nenhuma alteração nativa desta etapa exige novo build. Nenhum EAS build foi iniciado pelo assistente.
2. Configure a origem HTTPS alcançável no `.env` e reinicie com `npm.cmd start -- --clear`. Pressione `a` para o emulador ou abra o development client no celular.
3. Emulador Android alcança o computador por `10.0.2.2`; celular usa IP/hostname da rede. `localhost` no celular não é o Windows. As portas originais são HTTP 5107 e HTTPS 7154, com redirecionamento HTTPS no backend.
4. Prefira túnel HTTPS confiável para a API ou certificado confiável no dispositivo cobrindo o hostname/IP. `dotnet dev-certs` de localhost não é automaticamente aceito pelo Android. App não libera HTTP globalmente nem desativa TLS. Binding, firewall, portas, certificado e proxy estão explicados no README. O túnel do Metro não expõe a API.
5. Cadastre/entre, encerre o app e reabra antes de expirar: deve restaurar a sessão após a tela de preparação, sem mostrar formulário ou área de outro perfil durante a leitura.
6. Faça logout, feche e reabra: deve continuar desconectado. Botão Voltar não deve abrir área privada.
7. Para expiração real, mantenha a conta até o `exp` emitido (duas horas no backend), deixe o app em segundo plano e retorne após esse horário: deve pedir login. Não altere tokens ou relógio do aparelho para declarar uma validação real.

Os testes determinísticos cobrem o limite de expiração e 401 sem esperar duas horas. Não há tela de forçar 401 nesta etapa porque não há recurso privado de negócio implementado; o interceptor é testado com adapters isolados.

## Validação real e limites

Não há `.env` local nem origem fornecida/configurada no ambiente desta entrega. Tentativas de conexão às portas locais **5107 e 7154 retornaram ECONNREFUSED**. Portanto não foram criadas contas nem realizadas chamadas de login/cadastro contra um servidor em execução. O código envia os contratos reais; os testes usam dependências/adapters isolados e não comprovam integração live.

Nenhum dispositivo físico/emulador foi usado. SecureStore, teclado, autofill, acessibilidade e fluxo nativo precisam de teste no development build. A área autenticada mostra apenas o estado da conta e o escopo das próximas etapas; não finge exibir viagens, passageiros ou mapa.

Referências de implementação: [SecureStore SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [Protected Routes](https://docs.expo.dev/router/advanced/protected/), [Zustand createStore](https://zustand.docs.pmnd.rs/reference/apis/create-store), [jwt-decode](https://github.com/auth0/jwt-decode).
