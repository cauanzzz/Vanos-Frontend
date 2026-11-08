# Entrega da Etapa 4 para outro desenvolvedor

## Referência da entrega

- Repositório mobile: https://github.com/cauanzzz/Vanos-Frontend (nome remoto preservado; produto Vanos Mobile).
- Branch a clonar: `feat/stage-4-driver-operations`. Não use `main`: ela contém o setup inicial.
- Na conferência inicial de 08/11/2026, HEAD era `95bfa73e116404b8f2e2831c77fa8200e03943db`, sem alterações locais. A revisão de entrega adiciona um commit posterior com isolamento das credenciais geradas e instruções portáveis. Não reescreve os commits anteriores.
- Backend auditado: https://github.com/cauanzzz/Vanos-Backend, commit `9fc0757d17e3595de840b22b859c6ef0c27807b8`. O colega precisa de acesso aos dois repositórios. Nenhum banco ou credencial deste computador precisa ser enviado.
- Para identificar exatamente a revisão recebida: `git rev-parse HEAD` e `git log -5 --oneline --decorate`. O hash final e sua confirmação no remoto acompanham a mensagem de entrega.

## Instalar em outro Windows

Pré-requisitos: Git; Node 22.13+ com npm (testado aqui com Node 24.14); .NET SDK 10; SQL Server Express local na instância `SQLEXPRESS`; `sqlcmd` com autenticação Windows. Sua conta deve poder criar/acessar o banco **local dedicado** `VanosMobile_LocalValidation`. Para Android: Android Studio/SDK/ADB/JDK e chave Maps próprios, conforme [android-stage-4.md](android-stage-4.md). Nenhum build remoto é necessário.

Crie uma pasta de trabalho à sua escolha. Exemplo PowerShell, sem depender do usuário/caminho original:

```powershell
$vanosWork = Join-Path $env:USERPROFILE 'source\vanos'
New-Item -ItemType Directory -Path $vanosWork -Force | Out-Null
Set-Location $vanosWork
git clone --branch feat/stage-4-driver-operations --single-branch https://github.com/cauanzzz/Vanos-Frontend.git vanos-mobile
git clone https://github.com/cauanzzz/Vanos-Backend.git Vanos-Backend
git -C .\Vanos-Backend switch --detach 9fc0757d17e3595de840b22b859c6ef0c27807b8
git -C .\Vanos-Backend status -sb
Set-Location .\vanos-mobile
git status -sb
git rev-parse HEAD
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edite apenas a linha de API do `.env` local para `EXPO_PUBLIC_API_URL=http://localhost:5108`. Sem `/api` no fim. A chave Maps pode ficar vazia para o navegador. No build Android, preencha `GOOGLE_MAPS_ANDROID_API_KEY` com sua própria chave restrita ao pacote/SHA-1. Não copie `.env`, keystore ou fixture do outro desenvolvedor. Use o lockfile; não atualize dependências ou execute `npm audit fix --force` durante a instalação.

Confira ferramentas e SQL local:

```powershell
dotnet --list-sdks
dotnet tool list --global
# Se dotnet-ef ainda não estiver instalado:
dotnet tool install --global dotnet-ef --version 10.0.9
# Se já estiver instalado, confira a versão com dotnet ef --version.
Get-Service 'MSSQL$SQLEXPRESS'
sqlcmd -S '.\SQLEXPRESS' -E -C -l 5 -b -Q 'SELECT @@SERVERNAME AS LocalServer;'
```

Se o serviço estiver parado, inicie **essa instância local** pelo SQL Server Configuration Manager/Serviços do Windows (pode exigir administrador). Se `sqlcmd`, SDK 10 ou EF 10.0.9 estiverem ausentes, instale-os antes de continuar. Esses comandos não configuram banco remoto ou login SQL. Não substitua a conexão por uma de produção.

## Executar API, proxy e aplicativo

Abra três terminais no clone `vanos-mobile`.

**Terminal 1 — API isolada:**

```powershell
$env:VANOS_BACKEND_ROOT = (Resolve-Path ..\Vanos-Backend).Path
npm.cmd run api:local
```

Também é possível passar um clone em outro caminho: `npm.cmd run api:local -- -BackendRoot 'D:\projetos\Vanos-Backend'`. O launcher aceita o parâmetro ou a variável; sem ambos, procura o clone irmão `Vanos-Backend` e depois o caminho legado no Desktop do usuário atual.

O launcher verifica commit/working tree do backend, copia a API para `.expo/backend-local`, compila sem carregar os user-secrets originais, gera chave JWT aleatória por processo e aplica as migrations existentes **somente** em `.\SQLEXPRESS / VanosMobile_LocalValidation`, com autenticação Windows. A fonte do backend permanece intacta. Aguarde `API local: http://127.0.0.1:5107/swagger`. Não inicie outra API na 5107.

**Terminal 2 — proxy:**

```powershell
npm.cmd run api:proxy
```

Escuta loopback 5108 e encaminha HTTP/SignalR para a API real 5107. CORS limitado ao navegador em localhost/127.0.0.1:8081. Não altere firewall ou binding para esse roteiro.

**Terminal 3 — recriar contas e iniciar web:**

```powershell
npm.cmd run tracking:check
npm.cmd run driver:check
Get-Content .expo\tracking-fixture.json
npm.cmd run web:local -- --clear
```

`tracking:check` cria escola fictícia se necessário, contas Parent/Driver/outra Parent com e-mails únicos e **senha aleatória a cada execução**, passageiros A/B e vínculo A→Driver pelos endpoints reais de contratação/aceite. O outro proprietário permite testar isolamento. Dados persistem somente no banco local dedicado. Uma nova execução cria outro conjunto e substitui a fixture local; não depende de contas ou IDs de outro PC. Se houver falha, não publique saída com token/senha: confira API/proxy/SQL e repita. Nenhuma conta de produção é necessária.

E-mails, senha e IDs ficam em `.expo/tracking-fixture.json`, ignorado pelo Git, **sem JWT**. Consulte `driverEmail`/`password` no motorista, `parentEmail`/`password` no responsável. `otherEmail` não pode receber a posição. O script de autenticação `api:check`, opcional, cria também os três perfis reais com senha aleatória. Parent e Student compartilham o contrato de acompanhamento; o fixture vinculado deste roteiro é Parent.

Abra `http://localhost:8081/login`; a escolha inicial de perfil não concede acesso. Para duas contas simultâneas no PC, use navegadores/janelas independentes. Recarregar a web apaga a sessão em memória. A restauração persistente é nativa, via SecureStore. Reiniciar a API muda a chave JWT de teste: entre novamente; as contas locais continuam no SQL.

Os scripts `tracking:check`, `driver:check` e `tracking:publish` usam pontos **sintéticos**, identificados como tal. Termine esses scripts e não execute publicadores sintéticos durante a medição física.

## Android e roteiro físico curto

Use os comandos de [android-stage-4.md](android-stage-4.md) a partir do seu clone: SDK 37/Build Tools 37.0.0/NDK conforme lockfile, JDK 17, chave Maps própria, SHA-1 debug, `expo prebuild` e `expo run:android --device --no-bundler`. Diretórios nativos são gerados pelo Expo, não copiados de outro PC. No terminal com ADB:

```powershell
adb devices -l
adb reverse tcp:5108 tcp:5108
adb reverse tcp:8081 tcp:8081
```

No Terminal 3, substitua a execução web por Metro nativo, **sem dois servidores na 8081**:

```powershell
npx.cmd expo start --dev-client --localhost --port 8081 --max-workers 2 --clear
```

Entre como Driver no celular e Parent no navegador do PC, selecionando passageiro A. Faça o teste parado ou com acompanhante operando o app.

| Cenário | Ação | Resultado esperado |
| --- | --- | --- |
| Antes de iniciar | Abrir a lista do motorista | Passageiro A real; rastreamento encerrado, sem pedido automático de GPS |
| Negação/GPS desligado | Negar localização ou desligar GPS antes de iniciar | Erro claro, sem publicar; permitir/ligar e tentar novamente funciona |
| Tela ligada | Iniciar, permitir GPS preciso e mover pelo menos 5 m em área aberta | Sessão **local** ativa; captura/publicação avançam; Parent vê novo sinal no mapa; B/outra conta não vê |
| Background negado | Negar habilitação de segundo plano/notificações | Permanece somente primeiro plano, sem alegar captura em background |
| Tela bloqueada | Habilitar permissões, bloquear 2–5 min e mover-se | Critério de aprovação: mapa continua recebendo sinais novos. Se só captura continuar ou SignalR parar, registrar falha/limitação de background; notificação isolada não prova entrega |
| Sem rede e retorno | Remover reverse 5108, aguardar sinal antigo e restaurar | Sem novos envios durante falha; reconexão e somente GPS novo após retorno, sem replay de percurso |
| Encerrar | Confirmar encerramento e mover por 35 s | Captura/notificação terminam; horário do mapa não avança; última posição fica antiga após 30 s |
| Logout/troca de conta | Iniciar, publicar, sair e entrar em outra conta | Sem novos sinais da sessão anterior, sem operação ou ponto herdado; dados privados removidos |
| Processo encerrado | Force-stop e reabrir | Não se promete envio após force-stop; login pode restaurar, mas rastreamento exige novo início |

USB pode manter a API alcançável mesmo com Wi-Fi desligado. Para simular a perda apenas da API e manter Metro:

```powershell
adb reverse --remove tcp:5108
# Aguarde pelo menos 35 s e confira o responsável.
adb reverse tcp:5108 tcp:5108
```

Registre modelo/Android, permissões, economia de bateria, duração do bloqueio, horários/contagens e aprovado/falhou por cenário. Não compartilhe coordenadas, fixture, JWT ou senha no relatório. **Background, GPS e mapa nativos continuam sem validação física comprovada**; ainda não há aparelho usado nesta entrega. O backend só oferece SignalR; a proposta mínima de ingestão HTTP, caso o socket seja suspenso, está em [driver-operations.md](driver-operations.md). Sem viagem persistida, rota, turno ou chamada no servidor.

## Verificar e revisar o que compartilhar

```powershell
$env:EXPO_NO_TELEMETRY = '1'
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
git status -sb
git check-ignore .env .expo/tracking-fixture.json
```

Na revisão de entrega, `.env`, variantes privadas de ambiente, `.expo`, dump/banco local, credenciais de assinatura, APKs e fixture gerada ficam fora do Git. Só `.env.example` vazio é versionado. JWT de sessão usa SecureStore no nativo e memória na web. Chave JWT da API é gerada em memória; não é copiada do backend para o mobile.

O histórico anterior contém um **exemplo fixo de senha fictícia local**, removido dos arquivos atuais nesta revisão. Não foi encontrado segredo de produção na inspeção de arquivos e histórico; o histórico não foi reescrito para preservar as referências da Etapa 4. Não há promessa de detecção universal de segredos pela busca de padrões. Literais em `tests/` são fixtures unitárias sem contas reais; templates `example.test` e coordenadas sintéticas nos scripts são geradores de teste, não dados pessoais do usuário.

Os resultados anteriores da Etapa 4 (API real, GPS sintético e navegador) estão em [validation-stage-4.md](validation-stage-4.md). A revisão de entrega repete lint/TypeScript/testes e recriação local de fixtures. Em outro computador, o build Android e os cenários físicos precisam ser executados e registrados pelo desenvolvedor. Sem push forçado, merge, deploy, alteração de banco remoto ou envio de credenciais.

### Conferência executada em 08/11/2026

- Working tree inicialmente limpo; remoto `origin` conferido por `git remote -v` e `git ls-remote`, com apenas `main` em `23bfc44` antes da publicação desta branch.
- Arquivos versionados e os quatro commits existentes revisados por caminhos e padrões de chave privada, JWT literal, tokens de serviços e credenciais em URLs. As ocorrências de URL com usuário/senha foram adjudicadas como exemplo inválido em `tests/http.test.ts`, sem conta real. `.claude/settings.json` contém apenas habilitação de plugin, sem credenciais. Nenhuma `.env` real, fixture gerada, dump, chave de assinatura ou binário local foi encontrado no histórico; `.env.example` é o modelo vazio permitido.
- A senha fictícia fixa foi removida dos scripts/documentação atuais, mantendo o histórico explicitamente descrito acima. As credenciais recém-geradas foram comparadas com os arquivos versionados e não apareceram neles; o arquivo local ignorado não contém JWT.
- Sintaxe do launcher PowerShell conferida; API iniciada com `VANOS_BACKEND_ROOT` em caminho explícito; backend original permaneceu limpo. Migrations existentes já estavam aplicadas ao banco local dedicado. Nenhum banco remoto foi usado.
- `npm.cmd run lint`, `npm.cmd run typecheck` e **57 testes passaram**. `tracking:check` recriou contas/vínculos pela API real e `driver:check` passou nas cinco verificações de autorização/publicação/reconexão/parada/troca de sessão. Coordenadas sintéticas, não GPS físico.
- Não foi feita instalação em um segundo computador nem validação de aparelho: o roteiro é reproduzível a partir de clones e ferramentas próprias, sem copiar arquivos privados deste PC. Não foi necessário alterar código Expo/React Native, dependências ou configuração de plataformas nesta revisão.
