# Operação do motorista — Etapa 4

## Fluxo entregue

O motorista autenticado vê seu cadastro e os passageiros realmente vinculados. A tela usa `GET /api/drivers`, deriva o ID da resposta autenticada e consulta `GET /api/drivers/{id}/students`; não aceita ID digitado ou passado pela navegação. O 404 dessa segunda consulta significa lista vazia. O servidor também aplica autorização. CPF, Pix, endereço e telefones não são retidos pela nova tela.

“Iniciar rastreamento” solicita localização em primeiro plano. A sessão é **local ao aparelho**, começa parada em cada inicialização do processo e só publica depois de conectada ao Hub. “Encerrar rastreamento” pede confirmação, invalida callbacks imediatamente, remove captura, fecha conexão e apaga o estado. Logout/expiração fazem a mesma limpeza; uma nova conta só pode entrar depois da parada nativa. Falha ao parar gera aviso e nova tentativa, sem afirmar que o GPS foi encerrado.

O servidor auditado (`9fc0757d17e3595de840b22b859c6ef0c27807b8`) permanece somente leitura. Não há viagem persistida, rota, turno, início/fim de viagem, nem estados de chamada “Embarcou”, “Ausente” ou “Desembarcou”. A tela mostra apenas as preferências existentes `isGoingToday` e `isReturningToday`, sem transformá-las em chamada ou presumir reinício diário.

## Captura, memória e transporte

- Android/iOS: `expo-location` em primeiro plano; `expo-task-manager` define a tarefa global importada pelo layout raiz. Uma captura por vez; transições nativas serializadas e callbacks protegidos por geração.
- O motorista habilita segundo plano separadamente, após explicação. Android solicita primeiro plano antes de abrir a permissão “Permitir o tempo todo”; iOS requer Always. Android 13+ solicita também notificações nesse momento; se negadas, o aplicativo mantém primeiro plano para não iniciar captura escondida da gaveta de notificações. Essa é uma escolha do produto: o sistema permite foreground service mesmo sem essa permissão. Se negado, retoma primeiro plano. GPS desligado, permissão negada e erro de captura são visíveis, com acesso aos ajustes. O serviço só é iniciado com o aplicativo em estado ativo.
- Precisão High, intervalo mínimo solicitado de 5 s no Android e deslocamento de 5 m. O sistema decide a frequência efetiva; não se promete um ponto a cada 5 s quando parado. iOS usa AutomotiveNavigation, indicador de localização e sem pausa automática. Android usa foreground service com notificação, encerrado junto do processo (`killServiceOnDestroy`). As configurações anteriores de permissões/background em `app.json` foram preservadas.
- Web: captura enquanto a página está aberta por `navigator.geolocation`. O código web do Expo instalado ignora o callback de erro de `watchPosition`; o adaptador web explicita negação/timeout. Negação encerra; indisponibilidade transitória/timeout mostram aviso e mantêm a captura à espera de um sinal novo. O teste CDP revelou que trocar o provedor pode emitir um erro transitório antes do próximo ponto; há regressão para isso. Não há background web nem GPS sintético embutido no app.
- Transporte único: `UpdateLocation(latitude, longitude)` em `/hubs/tracking`. Nenhum endpoint novo foi inventado. `accessTokenFactory` só fornece o token da sessão que criou a conexão; não pode usar o de outra conta. Reconexão usa o cliente central com backoff 1/2/5/10/30 s, sem tentativas concorrentes.
- Coordenadas ficam somente na memória durante uma publicação. **Sem fila em disco e sem replay.** No máximo uma invocação em andamento; sinais concorrentes são descartados. Usa horário de captura, coordenadas finitas, limites geográficos, precisão até 100 m, idade máxima de 5 s, tolerância de relógio futuro de 1 s e ordem crescente. Rejeita sinais capturados antes do início local.
- Intervalo mínimo de envio de 1,5 s, acima do mínimo de 1 s imposto pelo Hub. Sem reenvio automático de uma posição recusada. Sem rede, desconectado ou pausado: descarta. Reconectou: aguarda GPS novo. Descarte é contado na interface, sem gravar coordenadas em logs.
- A resposta da invocação confirma aceite pelo serviço, não leitura pelo passageiro. A tela distingue horário da captura, última publicação confirmada, conexão e sinal antigo. O timestamp `recordedAtUtc` do evento do backend é o horário de processamento no servidor.
- Encerrar/logout bloqueiam novos envios imediatamente; uma publicação já aceita pelo servidor pode chegar ao destinatário depois do toque e não pode ser revogada. Não existe evento de fim no backend: o mapa mantém a última posição e a marca como desatualizada após 30 s.

## Background: limite e proposta mínima

Enquanto o processo JavaScript estiver vivo, os callbacks de segundo plano tentam publicar pelo SignalR existente e aplicam as mesmas regras de autenticação, validade e frequência. A notificação indica **captura**, não garantia de entrega. Suspensão de JavaScript/WebSocket, Doze, economia de bateria e políticas do fabricante podem interromper o envio. Forçar parada impede execução; não há promessa de reinício automático. Um runtime iniciado a frio não tem autorização para restaurar rastreamento: a tarefa órfã para a captura, sem ler JWT ou enviar. O bootstrap também limpa tarefa anterior antes de restaurar login. O usuário deve iniciar novamente.

**Não foi observado comportamento em tela bloqueada neste trabalho:** não havia SDK/ADB/aparelho acessível. Captura nativa, continuidade do transporte, notificação e cancelamento nativo ainda precisam do [roteiro Android](android-stage-4.md). Testes Node de callbacks em background representam apenas o controle de ciclo de vida; não provam execução do Android.

Se o roteiro mostrar captura continuando e mapa parando de atualizar quando o sistema suspende o SignalR, a menor evolução proposta no backend é um **endpoint HTTP autenticado de ingestão de um ponto**. Por exemplo, proposta ainda inexistente: `POST /api/tracking/locations` com `{latitude,longitude,capturedAtUtc,accuracyMeters,trackingSessionId,sequence}`. Derivar motorista do JWT, conferir conta ativa e vínculos a cada envio, validar limites/idade/relógio, deduplicar por motorista+sessão+sequência, limitar frequência e publicar o evento aos mesmos destinatários. Preservar `capturedAtUtc` distinto de `recordedAtUtc`, evoluindo também o consumidor para avaliar frescor pela captura. Isso permite uma tarefa tentar HTTP curto quando ganhar tempo de execução, sem depender de socket vivo e sem fazer pontos antigos parecerem atuais. Não garante execução após force-stop, nem substitui uma futura viagem persistida. Nenhuma dessas mudanças foi aplicada ao backend ou usada pelo mobile.

## Arquivos e verificações

Contratos em `src/types/driver.ts` e `src/services/driverApi.ts`; operação testável em `src/features/driver/createDriverOperation.ts`; captura por plataforma em `src/services/driverCapture*`; envio em `driverPublisher.ts`; tarefa em `src/tasks/driverLocationTask*`; composição e interface em `src/features/driver/`. A rota `(driver)/driver.tsx` continua enxuta.

Veja [resultados separados por tipo de teste](validation-stage-4.md). Para reproduzir com a API local, mantenha `api:local` e `api:proxy` ativos. Se não houver fixture, rode primeiro `npm.cmd run tracking:check` (cria somente dados fictícios no banco local isolado). Depois:

```powershell
npm.cmd run driver:check
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
```

`driver:check` usa o núcleo do aplicativo, autorização e Hub reais com captura sintética explicitamente identificada. `driver:browser`, com app web já servido em `http://localhost:8081`, usa Edge headless e GPS sintético CDP para testar as duas interfaces reais. Nenhum desses scripts mede GPS de aparelho ou background.

Referências das APIs consultadas: [Expo Location SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/location/), [TaskManager SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/task-manager/), [PermissionsAndroid](https://reactnative.dev/docs/permissionsandroid) e [permissão de notificações Android](https://developer.android.com/develop/ui/views/notifications/notification-permission).
