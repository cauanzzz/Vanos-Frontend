# Validação da Etapa 3 — 26/10/2026

## Resultado

| Verificação | Resultado |
| --- | --- |
| Lint / TypeScript | Passaram para app, config e testes/scripts tipados |
| Testes automatizados | **39 passaram**, sem testes ignorados ou falhos |
| `expo-doctor --verbose` | **20/20 checks passaram** |
| `expo export --platform all --max-workers 2` | Android, iOS e web exportados com sucesso |
| Configuração Expo | Name/scheme/plugins anteriores preservados; mapsAndroidConfigured=false quando não há chave |
| API local real | Vínculo criado por contratação/aceite reais; lista e alteração de ausência conferidas |
| SignalR real | camelCase, isolamento, publicação restrita a Driver e recuperação após reconexão confirmados |
| Browser com export web | **7 cenários passaram**, 0 exceções JavaScript |
| Repositório backend | Permanece limpo, commit `9fc0757d17e3595de840b22b859c6ef0c27807b8` |

O teste web usou Edge headless em viewport 390×1000 com preferência de redução de movimento. Conferiu:

1. Login, lista vinculada e conexão SignalR autenticada.
2. Eventos recebidos pelo Hub real renderizando marcador SVG no Leaflet (pontos de teste sintéticos).
3. Ausência enviada pela interface e confirmada por novo GET real de passageiros.
4. Dependente sem vínculo removendo do mapa o transporte do anterior.
5. Transição para sinal desatualizado após 30 s, sem extrapolação indefinida.
6. Offline/online com reconexão, sem tornar a posição antiga recente automaticamente.
7. Logout removendo nomes/dados privados da interface e sem exceções JavaScript.

Fixtures existem apenas no banco dedicado `VanosMobile_LocalValidation`, SQL Express desta máquina. Os testes usam usuários fictícios com `@example.test`, instituição identificada como validação e contratos reais para criar vínculo. Os scripts não alteram o código backend nem usam banco remoto. As coordenadas publicadas são sintéticas; não houve GPS físico. Nenhum mock alimenta o app de produção.

## Ajustes identificados nas verificações

- Declarações de Marker.Animated/AnimatedRegion não refletem corretamente RN 0.88: wrapper RN Animated com props inferidas e Animated.Value explícitos, sem `any`/`@ts-ignore`.
- Flags de lint React para refs durante render e estado em effect: valores animados usam inicialização lazy; formulário é reiniciado por chave de seleção/status, sem reset sincronizado por effect ou perda de edição a cada refresh.
- Primeiro export com muitos workers falhou por limite de memória do ambiente Windows. Dois workers permitiram export completo; `web:local` também usa dois workers. Não é uma medição de consumo/performance do aplicativo.
- CSS original Leaflet continha URLs relativas de ícones não suportadas pelo Metro. Usado CSS web de layout sem imagens, com marcador SVG e controles de texto. O export final não depende desses assets ausentes.
- Negociação SignalR no navegador precisou permitir `X-Requested-With` e `X-SignalR-User-Agent` no proxy CORS local. Acrescentados também encaminhamento WebSocket, rota do Hub e PATCH/DELETE. Backend preservado.

## Limites

- Nenhum dispositivo Android/iOS, development build ou medição 60fps foi executado. Precisão visual nativa, gestos, fontes ampliadas, TalkBack/VoiceOver e consumo de bateria ainda precisam de aparelho.
- Chave Google Maps Android não fornecida; native mostra estado explícito de mapa indisponível até configurar chave e rebuild. iOS usa Apple Maps, mas também precisa rebuild por expo-network.
- OSM no web depende da disponibilidade/rede do provedor; a verificação do marcador não comprova SLA da base de mapas.
- Hub não fornece heading, velocidade, ETA, timestamp de captura nem última posição persistida. Ausência não tem data/reset. Nenhuma dessas lacunas foi preenchida com campos/endpoints inventados.
- Criar dependente/contratar pela interface mobile não integra este recorte; contas sem perfil/vínculo mostram vazio explícito. Os testes preparam esse vínculo pelos endpoints existentes.
- Etapa 4 não iniciada; não há captura, fila de GPS ou transmissão em background pelo app. Nenhuma garantia de entrega com app suspenso/encerrado.
- Avisos de segurança já registrados nas etapas anteriores não foram ocultados ou corrigidos por upgrade forçado. Nenhum EAS build, push, deploy ou alteração remota foi realizado.

Instruções de reprodução: [tracking.md](tracking.md).
