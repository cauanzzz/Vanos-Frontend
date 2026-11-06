# Vanos Mobile

Aplicativo Expo / React Native em TypeScript strict. **Etapa 3: acompanhamento do passageiro implementado; API/Hub reais validados localmente e interface web testada.**

Veja [acompanhamento, testes e limites da Etapa 3](docs/tracking.md). Android/iOS e desempenho do marcador ainda precisam de validação física; Android requer chave Maps e um novo development build.

Backend encontrado em `C:\Users\cauan\Desktop\Vanos-Limpo`. Para testar agora no Windows, siga o [roteiro local completo](docs/local-validation.md): `npm.cmd run api:local`, `npm.cmd run api:proxy` e `npm.cmd run web:local -- --clear` em três terminais, abrindo `http://localhost:8081`. A execução usa SQL Express e banco dedicado `VanosMobile_LocalValidation`; preserva o backend original e o banco `VanosDb`.

Implementado: Expo Router em `src/app`, NativeWind 4, tema e primitivas nativas, seleção de perfil (responsável, estudante, motorista), tela explicativa de acesso, rota não encontrada e configuração nativa de localização/development build. O aplicativo abre sem API e sem pedir permissões.

Login e cadastro enviam os contratos reais do backend por Axios. Sessão usa Zustand, SecureStore nativo, restauração antes de navegar, proteção por perfil, expiração/401 e logout com remoção de credenciais. Veja [autenticação](docs/authentication.md). Passageiros têm mapa, SignalR, seleção, estado do sinal e preferências de ida/volta. O mobile não gera posições fictícias nem captura GPS nesta etapa; os scripts de validação publicam pontos sintéticos explicitamente, somente no ambiente local isolado.

## Executar no Windows / VS Code

1. Abra `C:\Users\cauan\vanos-mobile` no VS Code. Use Node **22.13+** (ambiente validado com 24.14.0) e npm.
2. No terminal PowerShell, use os executáveis `.cmd` se a política de scripts bloquear `npm.ps1`/`npx.ps1`; não é necessário mudar a ExecutionPolicy.
3. Restaure e prepare a configuração pública:

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Para autenticar, preencha `EXPO_PUBLIC_API_URL` no `.env` com a origem real da API, sem `/api`, query ou credenciais, e reinicie o Metro. Sem URL, as telas abrem e o envio mostra serviço não configurado. Não existe fallback ou login de demonstração.

Para revisar as telas no navegador:

```powershell
npm.cmd run web
```

Abra a URL mostrada pelo Metro. Escolha cada perfil, toque em “Conhecer meu acesso” e abra login/cadastro. No login, vale o perfil retornado pelo servidor, não a escolha inicial. No cadastro, Driver exige dados da van. Confira 320 px, tablet, fonte ampliada e teclado. A API auditada não configura CORS, portanto o login no browser depende de permitir a origem no backend/proxy de desenvolvimento. A sessão web usa apenas memória e termina ao recarregar; SecureStore/restauração persistente devem ser testados no aplicativo.

Para Android/iOS com o **development build já instalado**:

```powershell
npm.cmd start
```

Use `a` para o emulador Android ou abra o QR/link no development client do celular na mesma rede. Libere a porta mostrada pelo Metro no firewall da rede privada, se necessário. Em Windows não há simulador iOS: use iPhone físico com build assinada.

## Preparar o development build

`expo-dev-client` e os perfis de `eas.json` já estão configurados. Android package e iOS bundle identifier: `com.cauanzzz.vanos`; scheme: `vanos`. São identificadores iniciais e devem ser conferidos antes da distribuição.

**Nenhum build remoto, login EAS, push, deploy ou publicação foi executado.** Quando você decidir gerar o binário na sua conta, os comandos são:

```powershell
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest build:configure
npx.cmd eas-cli@latest build --platform android --profile development
# Para iPhone físico (requer provisionamento Apple):
npx.cmd eas-cli@latest build --platform ios --profile development
```

Esses comandos criam/configuram recursos na conta Expo; não são necessários para a revisão web. Instale o APK/binário resultante e rode `npm.cmd start`. Para o simulador iOS em um Mac, use o perfil `development-simulator`.

Se preferir compilar Android localmente, configure JDK/Android SDK/emulador e execute `npx.cmd expo run:android`. O Expo gera os diretórios nativos; não edite `ios/` ou `android/` à mão. Mudanças de plugins/dependências nativas exigem novo binário. Windows não compila iOS localmente.

## Localização e mapas

O plugin Location configura mensagens em português, background mode `location` no iOS e permissões Android de background/foreground service. Isso **só prepara o binário**: não pede permissão, não registra tarefa e não começa a capturar GPS nesta etapa.

Na Etapa 4, a tarefa será definida no escopo global e iniciada explicitamente pelo motorista após consentimento contextual/progressivo. Android precisa de foreground service com notificação durante rastreamento. Logout e encerramento deverão parar a tarefa. Esses comportamentos ainda não foram implementados ou testados.

O sistema pode restringir ou encerrar o processo, especialmente após encerramento forçado/economia de bateria. WebSocket JavaScript não garante envio com aplicativo suspenso. O backend atual só oferece SignalR e substitui o horário de captura pelo horário do envio; a [auditoria](docs/backend-audit.md) documenta por que não podemos prometer entrega em background ou reenviar uma fila de posições antigas como atuais.

O mapa nativo usa `react-native-maps`; o web usa Leaflet/OpenStreetMap. Android exige `GOOGLE_MAPS_ANDROID_API_KEY` restrita ao package/SHA-1, configurada por `app.config.ts` no plugin `react-native-maps`. Sem chave, mostra indisponibilidade do mapa, preservando as outras funções. iOS usa Apple Maps. `expo-network` foi adicionado nesta etapa: gere novo development build. Nunca coloque segredo de servidor em `EXPO_PUBLIC_*`; chaves de mapas no binário precisam de restrições do provedor. Detalhes em [tracking.md](docs/tracking.md).

Expo Go não comprova funcionamento de background. Validação física Android/iOS, consumo de bateria, suspensão e desempenho ainda pendentes.

## Acesso à API: emulador e celular

O `.env.example` define `EXPO_PUBLIC_API_URL` como **origem sem `/api`**. É configuração pública incorporada ao bundle; não use para JWT, senha, conexão SQL ou chave de assinatura. Depois de alterá-la, reinicie o Metro.

O backend auditado usa `http://localhost:5107` e `https://localhost:7154` em `Properties/launchSettings.json`. O repositório foi inspecionado remotamente; não existe cópia em `C:\Users\cauan\Desktop\Vanos` neste ambiente.

| Ambiente | Como alcançar o computador que roda a API |
| --- | --- |
| Navegador no próprio Windows | `https://localhost:7154`, após confiar no certificado local |
| Emulador Android padrão | Host via `10.0.2.2`; por exemplo, porta HTTP `5107`, apenas para diagnóstico de conectividade |
| Celular físico | IP/hostname LAN do computador, por exemplo `192.168.1.50`; celular e computador na mesma rede |

`localhost` no celular/emulador aponta para ele mesmo. Um túnel do **Metro** não expõe automaticamente a API.

Para disponibilizar a API na rede, em seu clone separado, uma opção de execução sem editar código é `dotnet run --no-launch-profile --urls "http://0.0.0.0:5107"` no diretório `Desktop/Vanos/Vanos.API`, com ambiente Development e configuração SQL/JWT preparados. Isso é orientação, não foi executado aqui. Confira o binding, IP usando `ipconfig`, firewall Windows e conectividade antes do login. Não exponha SQL Server ao celular.

O backend tem `UseHttpsRedirection`: um HTTP acessível pode redirecionar para uma porta HTTPS não acessível. Para desenvolvimento mobile, prefira **túnel HTTPS confiável/reverse proxy para a porta 5107**, sem laço de redirecionamento e com suporte a WebSockets, ou certificado TLS confiável no dispositivo que inclua o hostname/IP usado. O certificado `dotnet dev-certs` de localhost não é automaticamente confiável no Android/iOS e normalmente não cobre o IP LAN. Não desative verificação TLS nem suponha que `https://10.0.2.2:7154` funcionará.

O app não libera cleartext globalmente nem enfraquece ATS. Caso se opte por HTTP local, será necessária uma exceção de desenvolvimento explícita e um novo binário. Para futura revisão web integrada, o backend também precisa de CORS para a origem do frontend (não há política CORS no Program.cs auditado); native não depende de CORS.

## Verificações

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npx.cmd expo install --check
npx.cmd --yes expo-doctor
npx.cmd expo export --platform all
```

Para iniciar uma verificação sem telemetria, use `$env:EXPO_NO_TELEMETRY='1'`. `typecheck` verifica app e testes; `test` usa node:test/tsx. Os resultados atuais estão em [validation-stage-2.md](docs/validation-stage-2.md). A [revisão dos 10 avisos do npm audit](docs/npm-audit.md) informa impacto e alternativas por dependência: a última consulta retorna 5 altos; os moderados deixaram de ser reportados sem atualização das versões afetadas e não são considerados corrigidos.

## Organização e próximas etapas

`src/app` contém somente rotas/layout. `src/features/welcome` preserva a abertura; `src/features/auth` contém a sessão; `src/features/tracking` contém mapa, Bottom Sheet e ciclo de acompanhamento; `src/components/ui` as primitivas; `src/services` HTTP, armazenamento e SignalR; `src/store` sessão/passageiros/posições; `src/theme` os tokens; `src/types` os contratos. `tasks` será criado na etapa de GPS.

- [Matriz e contratos reais do backend](docs/backend-audit.md), commit `9fc0757d17e3595de840b22b859c6ef0c27807b8`.
- [Versões, referências e decisões visuais](docs/design-and-stack.md).
- [Etapa 2 implementada: sessão, SecureStore, Axios, login/cadastro e proteção por perfil](docs/authentication.md). [Validação com API real local e roteiro de navegador](docs/local-validation.md); persistência nativa ainda exige development build em aparelho.
- [Etapa 3 implementada: acompanhamento autorizado, mapa, ausência e estados de conexão](docs/tracking.md), com [resultados de validação](docs/validation-stage-3.md).
- Etapa 4: operação do motorista e captura GPS, com limites do backend explícitos.

Cada etapa depende da autorização para avançar; a seleção de perfil inicial não cria sessão nem substitui a role validada pelo servidor.
