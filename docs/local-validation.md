# Validação local da Etapa 2

Ambiente inspecionado em 26/10/2026. Etapa 3 não iniciada.

## Ambiente e isolamento

- Backend encontrado em `C:\Users\cauan\Desktop\Vanos-Limpo\Desktop\Vanos\Vanos.API`.
- Git local limpo, commit `9fc0757d17e3595de840b22b859c6ef0c27807b8`, igual ao auditado.
- SDKs .NET 10.0.103 e 10.0.301 instalados; dotnet-ef 10.0.9 disponível.
- Serviço `MSSQL$SQLEXPRESS` já estava em execução. Não foi necessário instalar/iniciar Docker ou SQL Browser.
- `launchSettings.json` real: perfil `http` em `http://localhost:5107`; perfil `https` em `https://localhost:7154` e `http://localhost:5107`.
- Configuração original de desenvolvimento aponta para `VanosDb` em `localhost\SQLEXPRESS`. **Essa base não foi usada.**
- Criado banco **`VanosMobile_LocalValidation`**, exclusivamente em `.\SQLEXPRESS`, com autenticação Windows. Aplicadas as oito migrations existentes. Nenhum banco remoto ou credencial SQL de produção foi usado.
- Backend original permanece somente leitura. A execução usa cópia em `.expo/backend-local`, com `UserSecretsId` de compilação separado e chave JWT aleatória temporária. Não são carregados os user-secrets do projeto original.
- Nenhuma alteração de código/configuração no repositório backend, serviço SQL ou firewall. Não há operação de excluir banco nos scripts.

## Endereços usados

| Serviço | Endereço |
| --- | --- |
| API real de desenvolvimento | `http://127.0.0.1:5107` |
| Swagger real | `http://127.0.0.1:5107/swagger` |
| Proxy local para o navegador | `http://localhost:5108` |
| Interface Expo web | `http://localhost:8081` |

O `.env` do mobile foi criado (ignorado pelo Git) com:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:5108
```

Essa origem é específica do **navegador neste Windows**. Não use localhost:5108 em celular ou emulador: o proxy só escuta no loopback do computador. Não foram alteradas permissões de HTTP/TLS nativas.

O backend não configura CORS. `scripts/local-api-proxy.mjs` só permite as origens exatas `http://localhost:8081` e `http://127.0.0.1:8081`, encaminha `/api/*` à API real na porta 5107 e não registra senhas/tokens. Não simula respostas de autenticação nem altera o backend. O proxy fica restrito a `127.0.0.1`.

Não foi encontrado certificado HTTPS de desenvolvimento válido no contexto de execução. Por isso esta validação local usa HTTP somente em loopback. A API é iniciada diretamente com um único endereço HTTP, sem o launch profile HTTPS; `UseHttpsRedirection` pode registrar aviso de porta HTTPS ausente e continuar o pedido, comportamento conferido nas respostas reais. Não foi instalado certificado nem desligada validação TLS globalmente.

## Iniciar no Windows — três terminais do VS Code

Abra `C:\Users\cauan\vanos-mobile`. Se os serviços iniciados pelo assistente ainda estiverem ativos, use os endereços acima; não inicie uma segunda instância na mesma porta. Para controlar os processos por conta própria, encerre as instâncias da validação e execute:

**Terminal 1 — API e banco dedicado:**

```powershell
cd C:\Users\cauan\vanos-mobile
npm.cmd run api:local
```

O script verifica o commit/estado limpo do backend, copia para `.expo`, compila com identidade de user-secrets isolada, aplica migrations somente ao banco dedicado e mantém a API em primeiro plano. O SQL Express precisa estar ativo e sua conta Windows precisa de acesso. Não reutiliza a connection string original. O bypass de ExecutionPolicy é somente no processo PowerShell filho, sem mudar a política do Windows. Caso a porta 5107 esteja ocupada, ele para e pede que você confira a instância existente.

**Terminal 2 — proxy do navegador:**

```powershell
cd C:\Users\cauan\vanos-mobile
npm.cmd run api:proxy
```

**Terminal 3 — mobile no navegador:**

```powershell
cd C:\Users\cauan\vanos-mobile
npm.cmd run web:local -- --clear
```

Abra **http://localhost:8081**. A primeira compilação pode levar alguns minutos. Não aceite uma porta alternativa sem também ajustar a lista de origens do proxy. Para encerrar, Ctrl+C no respectivo terminal. Não pare o serviço SQL Express inteiro: ele pode atender outros projetos.

Cada reinício da API gera uma chave JWT nova; sessões anteriores serão recusadas pelo servidor. Contas cadastradas permanecem no banco local dedicado.

## Testes exatos pela interface

Use dados fictícios somente neste ambiente. Sugestão: `manual.parent.2610@example.test` e senha `VanosLocal!2026` (credencial de teste local, nunca reutilizar em produção). Para repetir um cadastro, use outro e-mail; a conta anterior permanece no banco dedicado.

### 1. Cadastro

1. Na abertura, selecione **Sou responsável** e toque em **Conhecer meu acesso →**.
2. Toque em **Criar uma conta**. Confirme o perfil responsável no formulário.
3. Preencha o e-mail e a senha de teste e toque em **Criar minha conta**.
4. Espere a resposta: deve abrir `/passenger` e mostrar **Sua conta está conectada**.
5. O cadastro da conta não cria dependente/passageiro nem viagem. A tela não deve mostrar um mapa fictício.
6. Opcional: repita com e-mails diferentes para estudante/motorista. Motorista solicita nome, CPF, telefone, placa, capacidade 1–100 e chave Pix; use somente dados fictícios de teste.

### 2. Logout e login

1. Toque em **Sair da minha conta**: deve voltar à abertura.
2. Selecione **Sou motorista** na abertura, mas toque em **Entrar na minha conta** e use a conta Parent criada acima.
3. Deve abrir `/passenger`, pois a role retornada pelo backend prevalece sobre a sugestão inicial.
4. Saia novamente. Abra `http://localhost:8081/driver`: a área privada não deve aparecer sem sessão.

### 3. Senha incorreta e nova tentativa

1. Abra **Já tenho uma conta · Entrar**.
2. Informe o e-mail criado e uma senha errada. Toque em **Entrar na minha conta**.
3. Deve mostrar **E-mail ou senha inválidos**, permanecer no formulário e liberar nova tentativa. A senha é apagada após a falha.
4. Informe a senha correta e tente de novo: deve autenticar.
5. Para conferir o servidor, abra F12 → Network/Rede: POST `/api/auth/login` deve retornar 401 no erro e 200 no sucesso. Não compartilhe corpo de resposta/headers com JWT.

### 4. Restauração de sessão — limite do navegador

1. Entre e confira a área conectada.
2. Navegue dentro do app: a sessão em memória continua válida.
3. Pressione F5/recarregue: deve mostrar brevemente a preparação e voltar à abertura, exigindo novo login.
4. **Isso é o comportamento intencional do web.** Não existe persistência em localStorage/sessionStorage. Portanto o navegador não valida restauração persistente de SecureStore. Esse teste exige development build Android/iOS: entrar, encerrar o app e reabrir antes do exp do JWT. Os testes automatizados do store validam a lógica de restauração, mas não substituem esse teste nativo.

### 5. Logout definitivo

1. Entre novamente e toque em **Sair da minha conta**.
2. Use Voltar do navegador e tente abrir `/passenger` ou `/driver` diretamente.
3. Não deve recuperar uma área privada. Recarregue e confira que permanece desconectado.

### 6. Indisponibilidade e reconexão

1. Faça logout e carregue **a tela de login antes de desligar a rede**, para que os arquivos necessários já estejam no navegador.
2. Abra F12 → Network/Rede → selecione **Offline** no seletor de conectividade.
3. Informe e-mail e senha corretos e envie. Deve mostrar erro de conectividade, não navegar para a área privada e liberar nova tentativa.
4. Volte o seletor para **No throttling/Sem limitação**. Informe novamente a senha, que é limpa após falha, e envie: deve autenticar.
5. Alternativa de falha de API: com a tela de login carregada, Ctrl+C **apenas no Terminal 1 da API**, mantendo proxy e Metro. O envio terá 502 do proxy e a interface mostrará indisponibilidade. Reinicie `npm.cmd run api:local`, reentre e tente de novo. Não encerre o serviço SQL usado por outros projetos.

## Verificação HTTP repetível

Com API/proxy em execução:

```powershell
npm.cmd run api:check
```

Cria **três novas contas fictícias** (Parent/Student/Driver) no banco dedicado, com sufixo único e senha aleatória não registrada. Confere preflight CORS, cadastro/login 200, senha incorreta 401, duplicado 400, endpoint privado 200 e acesso indevido 401/403. Não usa mocks nem banco remoto. Os registros de teste não são apagados automaticamente.

## Observações reais

### Resultados executados

| Verificação | Resultado |
| --- | --- |
| Compilar a API real em cópia isolada | Passou, sem erros de compilação |
| Migrations no banco dedicado | 8 aplicadas; reinício confirmou banco atualizado |
| HTTP real Parent/Student/Driver | Cadastro/login 200, senha incorreta 401, duplicado 400 e leitura privada 200 |
| Autorização / CORS | Sem token 401; consumidor em endpoint de motorista 403; origem web não permitida recusada; preflight local 204 |
| Edge headless, interface Expo com API real | **8 verificações passaram**: cadastro, logout, erro de senha, role real após sugestão Driver, recarga web, offline, reconexão e URL privada |
| Sessão no navegador após F5 | Voltou à abertura, conforme o armazenamento web em memória |
| `npm.cmd test` | **23/23 testes passaram** |
| `npx.cmd expo lint` | Passou, sem erros/avisos |
| `npm.cmd run typecheck` | Passou para app e testes |
| Repositório original do backend | Git continua limpo |
| `.env` | Origem do proxy configurada e arquivo ignorado pelo Git |

O browser automatizado usou perfil temporário separado e criou somente contas fictícias no banco dedicado. A simulação de desconexão foi feita pela rede do próprio navegador; login e cadastro não foram simulados. Os primeiros ensaios do harness precisaram de mais tempo para compilar o Metro e de seleção apenas de controles visíveis (o navegador mantém telas anteriores ocultas no DOM). A execução final completou os oito cenários; não houve relaxamento de guards ou de autorização do aplicativo.

API, proxy e Expo web foram deixados em execução ao fim desta validação. Processos podem encerrar quando a sessão/Windows for fechado; os três comandos acima reproduzem o ambiente. Persistência nativa de SecureStore permanece pendente, pois nenhum aparelho foi utilizado.

- Build .NET passou, mas emitiu avisos existentes: duas referências possivelmente nulas no Hub e advisories moderado/alto em `System.Security.Cryptography.Pkcs` 9.0.4. Não foram alteradas dependências do backend nesta validação; esses avisos devem ser revistos no trabalho próprio do backend.
- Expo DevTools usou fallback porque seu cache fora do workspace não estava acessível; isso não impediu a interface web.
- O teste do navegador detectou um erro de tema NativeWind ao carregar CSS. Configurado `darkMode: 'class'` no Tailwind para que o observador web aceite a definição de color scheme; paleta e aparência clara preservadas.
- O `.env` não contém senha, token, conexão SQL ou chave de assinatura. Banco e chave temporária são configurados somente no processo isolado da API.
