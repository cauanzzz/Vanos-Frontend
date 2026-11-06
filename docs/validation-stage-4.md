# Validação da Etapa 4 — 06/11/2026

## Versionamento e base

Antes de editar, foram executados `git status -sb`, `git branch -avv` e `git log -8 --oneline --decorate`. Só havia `main`/`origin/main` em `23bfc44` (setup inicial); as Etapas 1–3 estavam no working tree, sem commit ou branch de integração correspondente. Nenhum trabalho foi apagado, guardado em stash ou misturado ao commit da Etapa 4.

Foi criado o checkpoint local **`51797598eb5e645663e46064ca73e213dfd55fbb`**, na branch **`feat/stage-3-passenger-tracking`**, preservando o estado entregue até a Etapa 3 (inclui a fundação e autenticação anteriores, que também não tinham commits). A branch **`feat/stage-4-driver-operations`** parte desse checkpoint, sem merge. Backend separado: `master`, limpo em **`9fc0757d17e3595de840b22b859c6ef0c27807b8`**. Somente commits locais; nenhum push, merge, build remoto ou deploy.

Implementação/testes/scripts/lockfile da Etapa 4: **`ee0b6b9`** (`feat: add driver tracking operations and contextual background GPS`). A documentação e a evidência do audit ficam no commit local seguinte. Para conferir ambos: `git log --oneline 5179759..HEAD`. `main` e `origin/main` permaneceram no setup original.

## Verificações locais

| Verificação | Resultado / alcance |
| --- | --- |
| Lint | Passou, inclusive após atualizar o Zod transitivo do lint |
| TypeScript strict | Passou para aplicativo, configuração, testes e scripts tipados |
| Testes Node | **57 passaram**, 0 falhas/ignorados; sessão, isolamento, reconexão, GPS inválido/velho, precisão, ordem, frequência, parada, callbacks tardios, troca de conta, negação/perda transitória web e deadlock de 401 |
| Expo Doctor | **20/20 passaram** após `expo install --fix` dentro do SDK 58 |
| Export final | **Android, iOS e web passaram** com `--max-workers 2`; são bundles/export, não APK instalado nem teste de hardware |
| Config introspect | Package/scheme/config de plataformas preservados; permissões fine/coarse/background/foreground-service-location/notifications e modo iOS location presentes; chave Maps não fornecida |
| npm audit final | **12 moderados, 0 altos**. Zod corrigido seletivamente para 4.6.7; demais advisories de ferramentas documentados em [npm-audit.md](npm-audit.md). Nenhum force/override |
| Backend original | Fonte somente leitura; cópia isolada executada em 5107, proxy 5108, SQL Express `VanosMobile_LocalValidation`. Não houve migration nova; banco já estava atualizado |
| Navegador, duas interfaces | **5 cenários passaram, 0 exceções JavaScript**, Edge headless com GPS sintético CDP e API/Hub reais |

O primeiro Doctor apontou patches/minor recomendados para 11 pacotes. Alinhados Expo 58.0.23, React Native 0.88.1, Location 58.0.20, TaskManager 58.0.13, Safe Area 5.11.1 e demais versões do lockfile. NativeWind/Reanimated/Worklets/mapas e configurações existentes foram preservados. O primeiro export anterior ao alinhamento foi interrompido; os exports do conjunto atualizado passaram. Os testes precisaram de execução fora das limitações do sandbox do Windows, sem alterar configuração do app.

## API e Hub reais, captura sintética

`npm.cmd run driver:check` passou com as contas fictícias locais já vinculadas pela contratação/aceite reais da Etapa 3. API e SQL são reais; a origem de coordenadas desse script é **sintética**. Não foi apresentado como teste de GPS físico.

1. `createDriverApi` leu motorista próprio e seu passageiro vinculado. Consultar ID de outro motorista retornou 403; Parent não acessou a lista de motoristas privados.
2. Consumer tentou `UpdateLocation` e foi recusado. Driver iniciou o núcleo mobile e publicou pelo `createDriverPublisher` usando o Hub real.
3. Parent vinculado recebeu `LocationUpdated`, o parser/store do mapa aceitou o ponto como recente. Outra conta sem vínculo recebeu zero eventos.
4. Offline interrompeu a conexão; após reconectar nenhum ponto anterior foi republicado. Novo ponto foi recebido pelo autorizado.
5. Encerrar bloqueou nova invocação a partir de callback tardio. Novo início funcionou. Logout/troca da sessão bloqueou callback anterior e limpou horários/contagens privados.

Evidência de execução local ignorada pelo Git: `.expo/stage4-api-results.json`. Não contém JWT, senha ou coordenada pessoal. O primeiro disparo ocorreu antes de a API terminar de subir e falhou; repetido após o servidor estar pronto, passou. As fixtures existentes ficam somente no banco dedicado e em `.expo/tracking-fixture.json`, sem JWT.

## Navegador, interfaces reais e GPS sintético

`npm.cmd run driver:browser` passou em cinco cenários, com 0 exceções JavaScript:

1. Lista vinculada carregada do servidor; rastreamento inicialmente encerrado, sem captura iniciada pelo app.
2. Toque em iniciar no motorista, captura sintética fornecida pelo CDP ao navegador, publicação pelo Hub e marcador Leaflet na tela real do responsável.
3. Confirmação de encerramento e nova coordenada sintética sem avanço do horário no mapa.
4. Novo início/publicação, logout pela interface, remoção da tela privada e sinal desatualizado após 30 s sem novos envios.
5. Novo login com permissão do navegador negada: erro visível, captura/envio encerrados.

O executor usa dois processos de Edge para manter as páginas visíveis. As primeiras execuções expuseram esperas de navegação e indisponibilidade transitória do provedor CDP ao substituir uma posição. A captura web foi corrigida para manter o watch após erro transitório/timeout e encerrá-lo após negação; o núcleo passou a distinguir esses casos, com teste de regressão. O cenário completo foi repetido com sucesso no export final. Evidências ignoradas: `.expo/stage4-browser-results.json` e `.expo/stage4-driver.png` (tela de erro de permissão). Não houve GPS físico, background Android ou medição de desempenho nesse teste.

O preview estático usado pelo teste foi encerrado ao terminar, liberando a porta 8081 para o Metro. API isolada e proxy foram deixados ativos nos seus terminais. Para abrir manualmente: `npm.cmd run web:local -- --clear`, depois `http://localhost:8081/login`. E-mails/senha das contas fictícias estão em `.expo/tracking-fixture.json`. No Android, use o roteiro abaixo; não execute publicadores sintéticos enquanto mede GPS real.

## Dependente de aparelho físico — não executado

Não havia `adb` no PATH, SDK Android configurado ou Android Studio no caminho padrão; nenhum aparelho acessível foi usado. Java encontrado: 24. O [roteiro Windows/Android](android-stage-4.md) explica JDK 17/SDK, chave Maps restrita, SHA-1, geração e instalação do development build local e API via USB reverse.

Não foram comprovados: captura nativa real, foreground service/notificação, GPS com tela bloqueada, permissões/revogação Android/iOS, Doze/economia de bateria, suspensão do SignalR, cancelamento nativo por logout, mapa Android ou fluidez/60 fps. O suporte de captura está implementado; a capacidade de entrega em background continua **pendente de medição física**. Não é possível registrar um comportamento observado do Android sem executá-lo.

O roteiro inclui testes de tela ligada, bloqueada, perda/recuperação da API e confirmação de ausência de novas publicações após encerrar/logout. Há proposta mínima de ingestão HTTP em [driver-operations.md](driver-operations.md), caso o transporte SignalR seja suspenso; backend não foi alterado. Viagem persistida, rota, turno e chamada permanecem lacunas reais de contrato.
