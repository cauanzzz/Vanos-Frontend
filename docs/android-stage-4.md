# Validar a Etapa 4 no Android pelo Windows

Este roteiro usa **development build local** e somente API/banco isolados no PC. Não precisa de push, EAS, deploy, credencial de produção, exposição da API na rede nem modificação do backend. Não foi executado em aparelho neste trabalho.

## 1. Preparar o PC e a chave Maps

Neste ambiente foram encontrados SQL Express ativo e Java 24. Não foram encontrados Android Studio no caminho padrão, SDK configurado ou `adb` no PATH. Para compilar, instale [Android Studio](https://developer.android.com/studio), SDK/Command-line Tools (latest)/Platform-Tools pelo SDK Manager e um JDK 17 (por exemplo Temurin 17). SDK/Build Tools/NDK abaixo vêm do catálogo **do React Native instalado**, não de um tutorial de outra versão.

No PowerShell do projeto, depois de instalar as ferramentas:

```powershell
Set-Location C:\Users\cauan\vanos-mobile
$env:EXPO_NO_TELEMETRY = '1'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$vanosJdk = Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -Filter 'jdk-17*' | Sort-Object Name -Descending | Select-Object -First 1
if (-not $vanosJdk) { throw 'Instale Temurin JDK 17 ou ajuste JAVA_HOME para seu JDK 17 real.' }
$env:JAVA_HOME = $vanosJdk.FullName
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
java -version
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" 'platform-tools' 'platforms;android-37' 'build-tools;37.0.0' 'ndk;27.1.12297006'
npm.cmd ci
```

Se o SDK Manager estiver instalado em outro caminho, ajuste `ANDROID_HOME`. Se o Gradle pedir CMake, instale a versão que ele indicar pelo SDK Manager. Mantenha estas variáveis no mesmo terminal para os comandos seguintes.

Crie uma chave no [Google Cloud](https://console.cloud.google.com/google/maps-apis/credentials), habilite **Maps SDK for Android** e o faturamento exigido pelo Google. Restrinja a chave à API Maps SDK for Android, pacote `com.cauanzzz.vanos` e SHA-1 do certificado debug que assinará o APK. A chave Maps é credencial pública restrita do cliente; não coloque JWT/chave de assinatura do backend no `.env`.

Edite o `.env` já existente, preservando outras linhas:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:5108
GOOGLE_MAPS_ANDROID_API_KEY=SUA_CHAVE_ANDROID_RESTRITA
```

Esse localhost funcionará **apenas depois do `adb reverse`** abaixo. O `.env` é ignorado pelo Git. Alterar a chave exige recompilar o binário. Sem chave, o mapa Android mostra indisponibilidade; GPS e lista podem ser testados, mas não considere mapa validado.

## 2. Gerar e instalar o development build local

Ative Opções do desenvolvedor e Depuração USB no celular, conecte via USB, aceite a chave RSA do PC e confira que aparece como `device`, não `unauthorized`:

```powershell
adb devices -l
npx.cmd expo prebuild --platform android --no-install
Push-Location android
.\gradlew.bat signingReport
Pop-Location
```

Copie o SHA-1 da variante **debug** para a restrição da chave Maps. Os diretórios nativos são gerados pelo Expo e ignorados no Git; não edite arquivos nativos manualmente. Se já existir `android/` gerado com configuração anterior, regenere-o após preservar qualquer alteração manual que você tenha feito; não execute `--clean` em uma pasta com trabalho manual sem salvá-lo.

```powershell
adb reverse tcp:5108 tcp:5108
adb reverse tcp:8081 tcp:8081
adb reverse --list
npx.cmd expo run:android --device --no-bundler
```

O comando compila e instala o APK debug localmente; se houver vários aparelhos, selecione o desejado. Para reinstalar o mesmo APK depois:

```powershell
adb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
```

Em outro terminal, inicie o Metro:

```powershell
Set-Location C:\Users\cauan\vanos-mobile
$env:EXPO_NO_TELEMETRY = '1'
npx.cmd expo start --dev-client --localhost --port 8081 --max-workers 2 --clear
```

Abra o development client instalado e conecte à origem `http://localhost:8081`. Se precisar abrir o link pelo ADB, no terminal que tem ADB no PATH:

```powershell
adb shell am start -a android.intent.action.VIEW -d 'vanos://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'
```

O template **debug** do SDK 58 permite HTTP local para desenvolvimento; nenhuma exceção de HTTP foi adicionada à configuração de produção. Não use esse APK/debug HTTP como distribuição. iOS não compila no Windows: exige Mac ou build assinado próprio; suas permissões Always e captura ainda não foram testadas.

## 3. Iniciar a API isolada e preparar duas contas

Em dois terminais separados no projeto (se essas rotinas já estiverem ativas, reutilize-as):

```powershell
npm.cmd run api:local
```

```powershell
npm.cmd run api:proxy
```

Aguarde a mensagem da API em `127.0.0.1:5107`. Ela executa cópia do backend, sem user-secrets originais, com chave JWT aleatória do processo e banco `VanosMobile_LocalValidation` em `.\SQLEXPRESS`. `launchSettings.json` original define HTTP 5107 e HTTPS 7154; o proxy fixo 5108 atende navegador e USB reverse. Se reiniciar a API, faça login novamente, pois a chave JWT de teste muda.

Se necessário, crie fixtures (somente no banco local dedicado) e confira a integração:

```powershell
npm.cmd run tracking:check
npm.cmd run driver:check
Get-Content .expo\tracking-fixture.json
```

Esse JSON contém e-mails/senha **fictícios locais**, IDs e nenhum JWT. Use `driverEmail` no celular e `parentEmail` no navegador do PC. Nunca substitua por credenciais de produção. `tracking:check` publica pontos sintéticos para teste; termine-o antes de medir GPS real. Não execute `tracking:publish` durante o teste físico.

Com Metro na 8081, abra `http://localhost:8081/login` no PC e entre como responsável. No celular entre como motorista. Confira passageiro A vinculado e B sem vínculo no responsável. O teste usa o mesmo passageiro A e motorista nos dois clientes. Recarregar navegador exige novo login.

## 4. Roteiro físico e critérios

Realize parado ou com um acompanhante operando o celular; registre apenas horários/contagens, sem coordenadas ou tokens em relatórios compartilhados.

| Cenário | Ação | Conferir |
| --- | --- | --- |
| Antes de iniciar | Abrir motorista e lista | Sessão encerrada, sem solicitação automática de GPS/sem notificação; preferências de ida/volta reais |
| Permissão negada/GPS desligado | Negar ao iniciar; depois desligar GPS e repetir | Erro claro, captura parada; ajuste de permissão e nova tentativa disponíveis |
| Primeiro plano | Permitir GPS e iniciar; manter app aberto, mover alguns metros em área aberta | Sessão **local** ativa, conexão, captura e confirmação avançam; responsável vê marcador e horário recente; B sem vínculo não vê a van |
| Background negado | Abrir “Capturar com a tela bloqueada” e negar | Continua somente primeiro plano, sem afirmar permissão concedida |
| Background autorizado | Repetir, permitir notificações no Android 13+ e “Permitir o tempo todo” para localização; conferir notificação | Captura habilitada; motorista distingue coleta de publicação. Negar notificações mantém primeiro plano. Permissão aproximada pode gerar precisão >100 m e descarte |
| Tela bloqueada | Bloquear por 2–5 min com deslocamento e responsável aberto no PC | Registrar se horário do mapa continua avançando; desbloquear e comparar captura/publicação/descartes. Repetir com economia de bateria ativada e desativada. Não considerar notificação sozinha prova de envio |
| Perda e recuperação de rede | Cortar somente acesso à API conforme comandos abaixo, manter Metro disponível, mover-se e restaurar | Reconectando ou sem rede; mapa desatualizado; após retorno só ponto novo, sem replay de percurso antigo |
| Encerrar | Confirmar encerramento; mover-se por pelo menos 35 s | Notificação de captura desaparece, nenhuma nova publicação; horário no mapa deixa de avançar e sinal fica antigo. A última posição permanece no mapa, pois não há evento de fim |
| Logout | Iniciar de novo, confirmar um sinal e sair da conta; mover-se por 35 s | Credenciais/UI privada removidas, captura/notificação encerradas; mapa não recebe novos sinais. Outra conta Driver não herda operação nem ponto pendente |
| Processo morto | Durante sessão ativa: `adb shell am force-stop com.cauanzzz.vanos`; abrir de novo | Não promete envio após force-stop; próxima abertura exige **novo início local**, mesmo se login for restaurado |

Como há USB reverse, desligar Wi-Fi/dados pode **não cortar** acesso ao PC. Corte explicitamente o túnel da API, deixando Metro intacto:

```powershell
adb reverse --remove tcp:5108
# Aguarde detecção/timeout do SignalR (pode levar cerca de 30 s ou mais); confira o mapa após 35 s.
adb reverse tcp:5108 tcp:5108
```

Alternativa: Ctrl+C **no terminal do proxy** e depois `npm.cmd run api:proxy`. Isso também afeta o responsável; após recuperar, aguarde reconexão dos dois lados. Reconexão não publica a última posição guardada. O GPS pode precisar de novo deslocamento de 5 m para produzir um sinal.

Se precisar validar o mapa Android, use **outro aparelho Android** para Parent (com chave no build e seu próprio `adb -s SERIAL reverse ...`) enquanto o primeiro publica como Driver. Navegador no PC valida o fluxo completo, mas não prova o mapa nativo.

## 5. Registro do resultado

Preencha modelo/Android/versão do app, permissão precisa/aproximada, estado de bateria, duração do bloqueio, número e horários de capturas/publicações, comportamento do mapa, rede e resultado de encerramento/logout. Atualmente: **não executado em dispositivo**. Se capturar em background e não entregar pelo SignalR, registre exatamente esse resultado; a proposta mínima de ingestão HTTP está em [driver-operations.md](driver-operations.md), sem mudança unilateral no backend.

`localhost` no celular é o próprio celular. USB reverse resolve esse roteiro mantendo a API no loopback do PC. No emulador Android, também pode usar `adb reverse`; `10.0.2.2` é o alias do host quando o serviço estiver alcançável por esse caminho. Para teste físico sem cabo, precisa de origem HTTPS confiável alcançável pelo aparelho (certificado válido) ou binding/proxy LAN revisado; a API atual escuta só `127.0.0.1` e o proxy só loopback, logo trocar o `.env` pelo IP do Wi-Fi sozinho não basta. Nenhum firewall, certificado ou binding foi alterado automaticamente.
