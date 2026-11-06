# Direção visual e versões

Atualização da Etapa 4: mesmo tema, NativeWind 4.2.7, mapas, Reanimated 4.7.1 e Worklets 0.13.0. `expo install --fix` alinhou módulos ao SDK 58 atual: Expo 58.0.23, React Native 0.88.1, Location 58.0.20, TaskManager 58.0.13 e Safe Area 5.11.1, entre os demais patches recomendados. Nenhuma configuração de plataforma foi substituída. A operação do motorista usa lista virtualizada e uma sessão de rastreamento local explícita. Capacidades e pendências físicas estão em [driver-operations.md](driver-operations.md).

Atualização da Etapa 3: acompanhamento com `@gorhom/bottom-sheet 5.2.14` (peer Reanimated 4/Gesture Handler 3 verificado), `expo-network ~58.0.4` e Leaflet 1.9.4 apenas no web. Mapas nativos mantêm react-native-maps 1.29.11. Tokens visuais preservados; marcador tem animação finita e respeita redução de movimento. Nenhum benchmark de fps foi declarado. Mais detalhes em [tracking.md](tracking.md).

Atualização da Etapa 2: preservados tema, NativeWind e versões nativas. Adicionados `jwt-decode` para leitura local do JWT e `tsx`/`@types/node` para testes. Axios e Zustand agora implementam HTTP e sessão; SignalR permanece instalado para a Etapa 3. Formulários usam KeyboardAvoidingView, scroll, inputs com autofill e erros acessíveis. A área autenticada distingue Parent/Student/Driver sem simular dados de viagem.

## Referências consultadas

Nenhuma skill remota foi instalada. Princípios adaptados, sem copiar DOM/CSS para views nativas:

- [Impeccable](https://github.com/pbakaus/impeccable): hierarquia clara, identidade específica e evitar cards aninhados/gradientes genéricos. Aplicação: composição tipográfica, bloco verde profundo e trilho abstrato de percurso, sem fingir um mapa real.
- [Emil Kowalski](https://github.com/emilkowalski/skills): movimento com propósito, feedback imediato e cuidado com duração/curva. Aplicação atual: feedback de opacidade ao toque; nenhuma animação automática, compatível com redução de movimento. Transições de rotas desativadas nesta fundação.
- [React Native Reusables](https://github.com/mrzachnugent/react-native-reusables) (redireciona para founded-labs): primitivas pequenas e consistentes em ambiente nativo. Aplicação: Button, Typography, Notice e Screen próprios com NativeWind, sem instalar um kit inteiro.
- [Can it be done in React Native](https://github.com/wcandillon/can-it-be-done-in-react-native): gestos e animações declarativas. Aplicação futura: trabalho de animação fora de renders por frame; exemplos antigos não são prova de compatibilidade com SDK 58.

Todas as quatro referências principais estavam acessíveis. Um link auxiliar de anúncio NativeWind não respondeu; a página oficial de instalação e os manifests instalados forneceram a configuração utilizada.

## Fundação

Verde escuro `#182F2A`, floresta `#235C46`, fundo `#F6F5F0`, acento `#D8EE9B`; sem fontes remotas para abrir o app. Tipografia do sistema, espaçamento em múltiplos de 4, alvos de toque de pelo menos 48 dp, texto sem truncamento, scroll em telas pequenas e largura limitada em tablets. Perfis são radios com estado anunciado; desenho de percurso é decorativo e oculto do leitor de tela.

O tema é claro nesta etapa (declarado em app.json). Dark mode, verificação visual com fontes ampliadas, VoiceOver/TalkBack e medição em dispositivo continuam pendentes. Sem formulários, teclado ou rede neste estágio; os respectivos estados entram junto com as funcionalidades reais. Skeletons de dados serão adicionados com dimensões estáveis quando houver telas que carreguem dados, sem carregamento artificial.

## Compatibilidade

SDK 58 já estava no workspace e tem documentação estável: [referência versionada](https://docs.expo.dev/versions/v58.0.0/). Mantidos Expo ~58.0.19, React 19.3.0 e RN 0.88.0, correspondentes à tabela oficial. Node mínimo indicado pela documentação: 22.13.x; ambiente local usa 24.14.0.

Dependências nativas resolvidas por `npx.cmd expo install`, com versões exatas no lockfile:

| Grupo | Escolha |
| --- | --- |
| Navegação | Expo Router ~58.0.26, react-native-screens ~4.30.0, safe-area-context ~5.10.1 |
| Estilos | NativeWind **4.2.7 estável**, css-interop 0.2.7, Tailwind **3.4.17** |
| Movimento | Reanimated **4.7.1** + Worklets **0.13.0**, Gesture Handler ~3.3.0 |
| Nativo | Location ~58.0.19, TaskManager ~58.0.12, SecureStore ~58.0.2, Dev Client ~58.0.15 |
| Mapa (ainda não renderizado) | react-native-maps **1.29.11**, recomendado pelo SDK |
| Próximas etapas | Zustand 5, Axios 1, @microsoft/signalr 10; apenas instalados |

NativeWind v5 é RC na documentação consultada; não foi misturado com a configuração v4. A documentação de v4.2.7 confirma suporte ao SDK 57/Reanimated 4, e os peer ranges abrangem as dependências escolhidas; isso não substitui a validação em dispositivo com SDK 58. O Babel usa `nativewind/babel` como preset e `jsxImportSource: nativewind`. `babel-preset-expo` configura Worklets; não adicionar o plugin antigo de Reanimated manualmente. Metro usa `withNativeWind` com `global.css` e Tailwind varre `src/`.

Bottom Sheet será escolhido na Etapa 3, após conferir suporte às versões atuais de Gesture Handler/Reanimated. Não foi instalado preventivamente um pacote com compatibilidade não verificada.

Fontes: [NativeWind v4](https://www.nativewind.dev/docs/getting-started/installation), [Router](https://docs.expo.dev/router/installation/), [Reanimated SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/reanimated/), [Location SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/location/), [Mapas SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/map-view/).
