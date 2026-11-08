# Etapa 3 — Acompanhamento do passageiro

Backend reconfirmado no commit `9fc0757d17e3595de840b22b859c6ef0c27807b8`, em `C:\Users\cauan\Desktop\Vanos-Limpo`. Controllers, Student e TrackingHub foram relidos; nenhum arquivo do backend foi alterado.

## Implementado

- Lista de passageiros próprios por GET `/api/students`, sem parentId escolhido pelo cliente. Parent e Student usam a propriedade da conta definida no servidor; seleção restrita aos itens retornados.
- Mapa do transporte vinculado ao passageiro selecionado. Sem motorista ou sem sinal, mostra estado vazio explícito. Selecionar outro dependente não exibe o transporte do anterior.
- Uma conexão SignalR por sessão, compartilhada pelo runtime do passageiro. `accessTokenFactory` lê o token atual; logs de SignalR desligados. Grupos são atribuídos pelo servidor, sem JoinGroup ou seleção arbitrária de grupo.
- Falha inicial/queda usa backoff 1, 2, 5, 10, 30 segundos, sem starts concorrentes. Pausa no background/offline, retoma no foreground, recarrega os vínculos ao reconectar e a cada 30 segundos enquanto ativo/online. 401/403 na conexão invalida a sessão, sem refresh ou repetição ilimitada com credenciais recusadas.
- Reconexão mantém a última posição como desatualizada até receber **novo** evento. O servidor refaz o grupo automaticamente; não há chamada de reinscrição inventada.
- Bottom Sheet com seleção, status, última atualização, controle de acompanhar/livre, preferências de ida/volta e confirmação de “Não vou hoje”. Lista tem skeleton estático, estado vazio, erro e retry; operações são confirmadas somente pela resposta da API.
- Logout limpa passageiros/posições/candidatos/seleção, remove listener do evento, cancela retry e inicia encerramento da conexão. Respostas HTTP antigas e eventos de sessão anterior não repovoam dados privados.
- Não há captura de GPS do passageiro, localização do usuário no mapa, velocidade, ETA, heading, viagem persistida ou identificação de motorista inventada.

## Contrato confirmado em execução real

| Fluxo | Contrato | Resultado local |
| --- | --- | --- |
| Carregar passageiros | GET `/api/students` → Student[] | Somente os perfis da conta |
| Preferências | PATCH `/api/students/{id}/status?isGoingToday=false&isReturningToday=false`, sem body | Persistência conferida por novo GET; passageiro alheio recebe 404 |
| Conectar | `/hubs/tracking`, JWT | Conta vinculada entra no grupo atribuído pelo servidor |
| Receber | `LocationUpdated`: `{driverId,latitude,longitude,recordedAtUtc}` | **camelCase confirmado com cliente JS real** |
| Publicar (teste do motorista) | `UpdateLocation(latitude,longitude)` | Consumidores recusados; conta sem vínculo não recebe |
| Reconectar | Nova conexão normal | Grupo recuperado; nova posição recebida após reconexão |

RecordedAtUtc é o horário de processamento do backend, **não o instante de captura do GPS**. A UI diz “último sinal” e “posição recebida”. Não existe snapshot de última posição; ao abrir o app é preciso esperar um novo envio do motorista. O backend não atualiza/persiste Driver.Latitude/Longitude no Hub.

Os booleanos de ausência não incluem data/fuso/histórico nem reset diário. Por isso a interface avisa que ficam vigentes até nova alteração. “Não vou hoje” pede confirmação e desmarca ida e volta; não promete expirar amanhã ou que o motorista já leu o aviso.

## Movimento e qualidade do sinal

- Aceita apenas ID autorizado, números finitos, latitude/longitude válidas e timestamp ISO com timezone. Rejeita sinais com 30 s ou mais, mais de 10 s no futuro e timestamps fora de ordem/duplicados.
- Um salto acima de `150 m + 45 m/s × intervalo` fica em quarentena. Segundo ponto consistente a menos de 100 m confirma nova base; intervalo de 30 s permite retomar a partir da nova posição. É filtro heurístico de GPS, **não cálculo de velocidade para a UI**.
- Interpolação limitada a 900 ms ou ao tempo restante até desatualizar. Sem extrapolação, atualização de estado React por frame ou deslocamento infinito. Redução de movimento usa duração zero.
- Um ponto por motorista e no máximo um candidato ficam somente em memória, limitados aos vínculos autorizados. Vínculos removidos são descartados no próximo refresh; a entrega futura é bloqueada pelo próprio servidor em cada publicação.
- Após 30 s sem sinal, marcador/legenda passam ao estado desatualizado. Offline/reconexão também não transformam automaticamente o ponto antigo em atual.

### Adaptação nativa

`react-native-maps` 1.29.11 possui um `Marker.Animated` criado com RN Animated. Sua declaração estática usa generic antigo; AnimatedRegion também omite latitude/longitude na declaração gerada. Para RN 0.88 foi usado o **mesmo wrapper suportado** com `Animated.createAnimatedComponent(Marker)` e dois `Animated.Value` tipados, sem casts `any` ou `@ts-ignore`.

O driver JS (`useNativeDriver: false`) atualiza props nativas sem renders React por frame; o Animated.stop interrompe a transição. Saltos/rebases e cruzamentos do antimeridiano fazem snap. Reanimated 4.7.1 é usado pelo Bottom Sheet, sem presumir suporte a animatedProps de coordenadas do mapa. Não há heading no contrato, portanto não se interpola/mostra orientação.

**60fps não foi medido.** Android/iOS, animação do marcador, gestos, fontes ampliadas e leitores de tela ainda precisam de teste físico. Compilar/exportar não substitui essa medição.

### Mapa web

Arquivo `.web.tsx` usa Leaflet 1.9.4, marcador SVG e requestAnimationFrame direto no marcador. CSS próprio de layout evita os assets relativos não suportados pelo Metro; não há DOM no componente nativo. A base vem do OpenStreetMap, com atribuição visível, sem prefetch/download em lote e cache normal do navegador. A base depende de internet e disponibilidade do provedor; seu erro é mostrado separadamente do sinal da van.

## Compatibilidade e arquivos

Mantidos SDK 58, React 19.3, RN 0.88 e configurações anteriores. Instalados via `expo install`: `expo-network ~58.0.4`, `@gorhom/bottom-sheet 5.2.14`, Leaflet 1.9.4 e seus tipos. O manifest do Bottom Sheet aceita Reanimated >=4 e Gesture Handler >=2.16.1, abrangendo 4.7.1/3.3.0 instalados. O texto geral do site ainda cita v1–3; manifest, tipos, export e teste web foram conferidos. Runtime nativo continua pendente.

| Responsabilidade | Arquivos |
| --- | --- |
| Tela, Bottom Sheet e preferências | `src/features/tracking/PassengerScreen.tsx`, `PassengerDetails.tsx` |
| Runtime único/lifecycle/rede | `runtime.ts`, `usePassengerRuntime.ts` |
| Mapas por plataforma | `TrackingMap.tsx`, `TrackingMap.web.tsx`, `map.web.css` |
| Validação e interpolação | `coordinates.ts` |
| Conexão/retry | `src/services/trackingConnection.ts`, `trackingClient.ts` |
| HTTP de passageiros | `src/services/passengersApi.ts` |
| Estado privado e cleanup | `src/store/passengers.ts`, `tracking.ts`, `src/services/sessionCleanup.ts` |
| Configuração de chave Android | `app.config.ts`, `.env.example` |
| Testes | `tests/tracking*.test.ts`, `passengers.test.ts`, `scripts/check-local-tracking.ts` |

## Testar no Windows

1. Use os serviços locais descritos em [local-validation.md](local-validation.md). Reinicie `npm.cmd run api:proxy` se era a versão antiga: agora ele encaminha WebSocket, negociação, PATCH e DELETE, e permite os headers reais do SignalR. Continua somente no loopback e com duas origens web explícitas.
2. `npm.cmd run tracking:check` cria contas fictícias, escola e passageiros **somente no banco local `VanosMobile_LocalValidation`**, usa POST real de contratação/aceite para o vínculo e verifica Hub/ausência/isolamento/reconexão. Não altera o backend ou banco remoto. Deixa dados de teste para você inspecionar.
3. Leia e-mail e senha aleatória do responsável em `.expo/tracking-fixture.json` (arquivo ignorado, sem JWT), gerados na sua execução. Não compartilhe esse arquivo ou reutilize a senha em contas reais. Os nomes visíveis começam por **Validação local**.
4. Abra `http://localhost:8081`, entre nessa conta e espere “Conectado”. Haverá dois passageiros: A vinculado e B sem motorista. Inicialmente a localização pode estar indisponível, pois o servidor não guarda snapshot.
5. Em outro terminal rode `npm.cmd run tracking:publish`. Ele envia **cinco pontos sintéticos** pelo Hub real, respeitando mais de um segundo entre publicações, e encerra. Isso não é rastreamento GPS de dispositivo nem modo demo embutido no app.
6. Observe mapa, marcador, horário e “Sinal recente”. Mova o mapa para liberar o acompanhamento e toque em “Acompanhar a van” para recentrar. Sem novo envio, após 30 s deve mostrar “sinal desatualizado”.
7. Expanda “Ver detalhes”, alterne entre A/B e confirme que B não mostra o transporte de A. Confirme “Não vou hoje”; o aviso de sucesso depende da API. Confira ida/volta e salve novamente para reativar.
8. F12 → Network → Offline: mostra falta de rede. Volte a No throttling: reconecta, mas só outro `tracking:publish` torna a posição recente. Faça logout e confira que nome, ponto e vínculo não aparecem na abertura.

Uma conta nova comum continua vazia até o perfil de passageiro e o vínculo serem cadastrados no backend. O recorte desta etapa lista/seleciona perfis existentes; não adiciona telas de marketplace, contratação ou criação de dependentes. Os fixtures usam os contratos reais para permitir validação independente dessas telas.

Na entrega foi usado também um preview local do export web na porta 8081. Ele mostra a versão compilada e não tem hot reload. Para editar com Metro, encerre o preview e use `npm.cmd run web:local -- --clear`. O comando usa dois workers para conter memória no Windows.

## Testar Android/iOS

`expo-network` é um módulo nativo novo: **gere novo development build** antes de testar. Nenhum EAS build foi iniciado pelo assistente.

- Android: configure `GOOGLE_MAPS_ANDROID_API_KEY` no `.env`/ambiente de build. Restrinja a chave ao package `com.cauanzzz.vanos`, ao SHA-1 correto e ao Maps SDK for Android. O config plugin inclui a chave no binário; extra contém só o booleano de configuração. Reconstrua após mudar a chave. Sem chave, a tela mostra indisponibilidade do mapa, preservando lista/status/ausência.
- iOS: provider padrão Apple Maps, sem chave Google. Rebuild necessário pelo novo módulo de rede.
- Defina `EXPO_PUBLIC_API_URL` com origem HTTPS da API acessível ao aparelho. **Não use localhost:5108 do navegador**: o proxy local não escuta na rede. Emulador usa host `10.0.2.2`; físico usa LAN/hostname/túnel com certificado confiável. Detalhes no README.
- Confira somente o transporte autorizado, gesto de mover mapa, recentrar, ausência, troca de dependente, rede/background/foreground, expiração e logout. Teste fontes ampliadas, TalkBack/VoiceOver e redução de movimento.
- GPS do motorista/serviço Android/background da Etapa 4 não estão implementados. Não se promete rastreamento com app suspenso/encerrado nem desempenho medido.

Referências: [mapas SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/map-view/), [SignalR JS](https://learn.microsoft.com/en-us/aspnet/core/signalr/javascript-client?view=aspnetcore-10.0), [Bottom Sheet](https://gorhom.dev/react-native-bottom-sheet/), [Leaflet](https://leafletjs.com/reference.html), [política de tiles OSM](https://operations.osmfoundation.org/policies/tiles/).
