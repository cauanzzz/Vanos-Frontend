# Revisão do npm audit — Etapa 2

**Atualização da Etapa 4 — 06/11/2026:** após `expo install --fix` dentro do SDK 58, houve 13 pacotes sinalizados (12 moderados e 1 alto). A atualização transitiva compatível `npm update zod --ignore-scripts` levou Zod de 3.25.76 para **4.6.7**, aceito por **ambos** os pais (`^3.25.0 || ^4.0.0`). A consulta final retorna **12 moderados, 0 altos**, propagados a partir dos dois advisories de glob/minimatch. O histórico abaixo descreve a Etapa 2; a evidência atual está em [npm-audit-stage-4.json](npm-audit-stage-4.json). Sem `audit fix --force`, downgrades ou overrides.

| Origem atual | Pacotes afetados / caminho instalado | Gravidade | Impacto analisado e correção |
| --- | --- | --- | --- |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | `glob@13.0.7` via `@expo/cli`, `@expo/fingerprint`, `expo` | Moderada | Varredura de arquivos pode continuar após cancelamento. Ferramentas de desenvolvimento/build; não há import dessa biblioteca no código de sessão/GPS. Patch publicado em glob 14.0.2, fora do major 13 usado pelo Expo: aguardar atualização compatível upstream, sem forçar major nem aceitar sugestão de downgrade para Expo 52. |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | `minimatch@10.2.6` via fingerprint/glob e cadeia TypeScript ESLint | Moderada | Amplificação de padrões com possibilidade de negação de serviço em ferramentas. A aplicação não recebe padrões glob do backend/usuário. Correção publicada em 11.0.1, fora das faixas instaladas; requer atualização dos pacotes pais com validação de build/lint. Inclui avisos propagados para `@typescript-eslint/{parser,eslint-plugin,type-utils,typescript-estree,utils}`, `eslint-plugin-expo`, `eslint-config-expo`. |
| [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | Zod transitivo via `eslint-plugin-react-hooks` e `zod-validation-error`, agora **4.6.7** | Alta na consulta intermediária; corrigida | Exaustão de memória ao validar coleções grandes. Cadeia de lint, sem import nos contratos/GPS do app. Correção publicada em 4.6.6; manifests dos dois pais aceitam Zod 4. Atualização seletiva sem override nem nova dependência direta; lint conferido após atualizar. |

Essa avaliação do caminho de execução é uma inferência a partir de `npm ls ... --all` e dos imports do projeto, não uma declaração de ausência de risco. Os 12 avisos restantes foram preservados no relatório. As versões recomendadas de Expo e módulos passaram no Doctor; isso não elimina os avisos de segurança. O backend local também mantém os avisos preexistentes de `System.Security.Cryptography.Pkcs` 9.0.4 (moderado/alto); foi mantido somente leitura.

Consultas em 26/10/2026. O relatório inicial continha **10 pacotes sinalizados, 5 altos e 5 moderados**, associados a **três advisories de origem**. A última consulta, repetida com `--include=dev`, retorna **5 altos e 0 moderados**. Os avisos dos pacotes pais são propagados; não representam dez falhas independentes.

**A queda na contagem não foi uma correção aplicada:** parser 6.1.5, postcss-nested 6.2.0, Tailwind 3.4.17, css-interop 0.2.7 e NativeWind 4.2.7 mantêm as mesmas versões. A causa da diferença de reporte não foi confirmada; o advisory CSS consultado continua listando `<7.1.6`. Por isso os cinco avisos moderados iniciais continuam analisados abaixo, sem afirmar que foram resolvidos. Evidências: [relatório inicial](npm-audit-initial.json) e [relatório final incluindo dev](npm-audit-final.json).

Nenhum `npm audit fix --force`, downgrade de Expo/NativeWind ou override de versão principal foi aplicado. Lockfile mantido. O campo `fixAvailable` do npm não comprova que a alteração preserve a compatibilidade do conjunto Expo/NativeWind.

## Cada dependência afetada

| Pacote instalado | Gravidade npm | Origem / impacto neste projeto | Correção compatível verificada |
| --- | --- | --- | --- |
| `node-forge` 1.4.0 | Alta | Advisory de verificação RSA PKCS#1 v1.5. Usado pela CLI/certificados; não implementa o JWT do app (HS256 verificado no backend). Risco ao tooling que processe assinaturas/certificados maliciosos. | Advisory informa **nenhuma versão corrigida**; registro tem 1.4.0 como última. Aguardar correção upstream; downgrade do SDK não é solução compatível. |
| `zod` 3.25.76 | Alta | Exaustão de memória com coleções adversariais na validação. Cadeia da CLI Expo; formulários e resposta de autenticação não usam Zod. | Correção publicada em **4.6.6**, enquanto CLI 58.1.15 exige `^3.25.76`. Não há patch na faixa atual; atualizar CLI/Expo quando adotarem correção suportada. Não impor Zod 4 por override. |
| `@expo/code-signing-certificates` 0.0.7 | Alta | Aviso herdado de node-forge, tooling de certificados/assinatura. | Depende da correção node-forge e atualização suportada deste pacote; nenhuma disponível que resolva o advisory. |
| `@expo/cli` 58.1.15 | Alta | Herda node-forge/Zod e certificados; afeta ferramentas de desenvolvimento/build, não uma rotina de autenticação adicionada nesta etapa. | Última CLI consultada ainda exige `node-forge ^1.4.0` e `zod ^3.25.76`; sem correção compatível publicada nessa árvore. |
| `expo` 58.0.19 | Alta | Marcado pela dependência de CLI; isso não comprova uma falha executável no runtime Expo do aparelho. | 58.0.19 é a última versão consultada na faixa `~58.0.19`. Npm sugere Expo 44.0.6, que quebra o conjunto e não foi aplicado. |
| `postcss-selector-parser` 6.1.5 | Moderada | Consumo quadrático de CPU ao analisar seletor CSS malicioso. Executado na compilação de CSS confiável do repositório; aplicativo não recebe CSS de passageiros/servidor para compilar. | Correção em **7.1.6** (última consultada 7.1.7). Tailwind e postcss-nested atuais exigem **6.x**; não há patch publicado nessa faixa. |
| `postcss-nested` 6.2.0 | Moderada | Herda parser 6.x, mesma cadeia de build CSS. | Aguardar pacote compatível com Tailwind 3 que adote parser corrigido ou backport suportado. Não trocar versão principal silenciosamente. |
| `tailwindcss` 3.4.17 | Moderada | Herda parser/postcss-nested; tooling de estilos. | 3.4.19 ainda usa `postcss-selector-parser ^6.1.2`; atualizar apenas o patch não resolve. Tailwind 4 requer outra configuração/integração e não foi misturado ao NativeWind 4. |
| `react-native-css-interop` 0.2.7 | Moderada | Aviso propagado do peer Tailwind usado pelo NativeWind. Não comprova que o parser vulnerável execute no aparelho. | Depende de cadeia Tailwind corrigida que preserve o contrato do NativeWind. Sem correção compatível disponível para a configuração atual. |
| `nativewind` 4.2.7 | Moderada | Herda css-interop/Tailwind; mesma causa de parsing CSS. | Registro ainda aponta 4.2.7 como estável. Npm sugere downgrade para 2.0.11; rejeitado por incompatibilidade. Aguardar patch ou planejar migração completa após estabilidade/validação. |

As gravidades da tabela são as do relatório inicial; os cinco pacotes da cadeia CSS não aparecem no último relatório. Classificação do impacto em runtime acima é uma **análise da árvore e dos imports usados**, não prova de ausência de exploração em toda a plataforma. A gravidade dos advisories consultados permanece. `expo-doctor` e export passarem não eliminam esses riscos.

## Evidência e próximos passos

Executados `npm audit --json`, consultas de versões no registro e inspeção dos manifests locais. Expo CLI requer node-forge `^1.4.0`, Zod `^3.25.76`; Tailwind 3.4.17/3.4.19 requer parser `^6.1.2`, postcss-nested requer `^6.1.1`. Não existe correção de patch verificável para aplicar neste conjunto hoje. Nenhum aviso foi ocultado.

Reavaliar quando os mantenedores publicarem fixes nas faixas usadas. Confirmar os manifests e changelogs, instalar com `expo install`, repetir lint/typecheck/testes, Doctor e export; depois validar Android/iOS. Até lá, compilar somente CSS/dependências confiáveis e não tratar o servidor de desenvolvimento como um serviço público. Não há import de node-forge/Zod/parser CSS no código de autenticação.

Advisories primários:

- [node-forge — GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv): versão afetada até 1.4.0, sem patch listado.
- [Zod — GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5): correção 4.6.6.
- [PostCSS selector parser — GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf): correção 7.1.6; advisory distingue parsing de entrada não confiável de build de fontes confiáveis.
