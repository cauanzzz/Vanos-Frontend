# Validação da Etapa 1 — 26/10/2026

Registro histórico da fundação. A validação mais recente da Etapa 2 está em [validation-stage-2.md](validation-stage-2.md).

## Resultados finais

| Verificação | Resultado |
| --- | --- |
| `npx.cmd expo lint` | Passou, sem erros ou avisos de lint |
| `npx.cmd tsc --noEmit` | Passou, TypeScript strict |
| `npx.cmd expo install --check` | Passou: Dependencies are up to date |
| `npx.cmd --yes expo-doctor --verbose` | **20/20 checks passaram** |
| `npx.cmd expo export --platform all` | Passou para Android, iOS e web; repetido após ajuste final de tipografia |
| Render estático do Router | Geradas `/`, `/access`, `/_sitemap` e `/+not-found` |
| Conteúdo inicial e CSS | HTML exportado contém os três perfis e título inicial; CSS NativeWind emitido |
| `expo config --type introspect` | Passou; Android inclui permissões coarse/fine/background, foreground service/location e notificações; iOS inclui background mode location |
| `npm.cmd ls --depth=0` | Passou, sem dependências faltantes/inválidas |
| Metro web local na porta 8082 | Iniciou; requisição local retornou HTTP 200; servidor de verificação encerrado |
| `git diff --check` | Passou; apenas avisos de normalização LF/CRLF do Git no Windows |

O export gerou bundles Hermes de Android/iOS, bundles web e HTML renderizado pelo servidor. Isso verifica compilação, resolução de imports e renderização estática; não comprova gestos, aparência ou comportamento nativo em dispositivo.

Não foram adicionados testes que repetem a implementação das telas estáticas. Testes de sessão/expiração, reconexão e coordenadas acompanharão as respectivas implementações nas Etapas 2–4.

## Problemas resolvidos durante a verificação

- PowerShell bloqueia wrappers `.ps1`: usados executáveis `npm.cmd`/`npx.cmd`, sem alterar a política do sistema.
- Telemetria Expo tentou escrever fora do workspace: verificações usaram `EXPO_NO_TELEMETRY=1`.
- TypeScript 6 rejeitou `baseUrl` obsoleto: removido e mantidos aliases relativos em `paths`.
- TypeScript exigiu declaração do import de CSS: adicionado `src/types/styles.d.ts`.
- Primeira execução do Doctor falhou em DNS de `exp.host` e processos `npm explain`; nova execução após o bundle passou todos os checks. Uma tentativa de iniciar o Doctor também expirou na análise automática de permissões; o retry autorizado executou normalmente. Não há aprovação pendente.
- Conferência final eliminou classes conflitantes de cor de texto usando uma prop `tone` explícita em Typography.

## Avisos e limites reais

- `npm audit --json`: **10 avisos (5 altos, 5 moderados)** em cadeias transitivas de Expo CLI (`node-forge`, `zod`) e NativeWind/Tailwind/PostCSS. As soluções automáticas propostas incluem downgrade de Expo para 44 e NativeWind para 2 ou migração Tailwind 4, incompatíveis com a fundação escolhida. Não foi aplicado `audit fix --force` nem override de versões principais. Estes avisos permanecem e precisam de reavaliação com releases compatíveis; Doctor não é auditoria de segurança.
- Aviso de manutenção do ESLint 9.39.5 na instalação; versão resolvida compatível com eslint-config-expo 58 e lint executado com sucesso.
- O Metro tentou atualizar React Native DevTools em cache fora do workspace e usou fallback após acesso negado. Isso não impediu HTTP 200 nem export dos bundles.
- A tentativa de captura visual com Edge headless não produziu screenshot: houve falhas de GPU/permissões do ambiente. Não se declara inspeção visual automatizada ou teste interativo do navegador.
- Nenhum emulador/adb/Android SDK foi encontrado por PATH/variáveis; nenhum dispositivo Android/iOS foi usado.
- Nenhum build EAS, publicação, push, deploy ou alteração no backend foi executado.
- Sem URL de API em execução/credenciais fornecidas: auditoria de contratos por código, sem teste de integração live.
- Mapas, captura GPS, entrega em segundo plano, bateria, acessibilidade com leitor de tela e desempenho de 60fps não foram medidos/validados em aparelho. Login e GPS não estão implementados nesta etapa.

## Teste manual sugerido

1. Execute `npm.cmd run web` e abra a URL do Metro.
2. Selecione responsável, estudante e motorista, um de cada vez; abra os detalhes e retorne ao início.
3. Confira 320 px de largura, tablet e fonte ampliada. Confirme scroll, legibilidade e ausência de truncamentos.
4. Confira navegação por teclado e, no development build, TalkBack/VoiceOver. Nenhuma permissão de GPS deve ser solicitada na abertura.
5. Gere um development build somente quando decidir usar EAS, conforme README. Instale em aparelho para validar o binário; Expo Go não valida GPS em background.
