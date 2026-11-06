# Auditoria de integração — Etapa 1

**Etapa 3:** GET de passageiros, PATCH de ida/volta e Hub integrados. O protocolo JSON `LocationUpdated` em camelCase, isolamento de destinatários e reconexão foram verificados contra a API local real no mesmo commit. Limitações de data/ETA/heading/snapshot permanecem. Veja [tracking.md](tracking.md).

**Validação local posterior:** repositório encontrado em `C:\Users\cauan\Desktop\Vanos-Limpo` no mesmo commit e sem alterações. API executada em cópia isolada, oito migrations aplicadas ao banco local dedicado e cadastro/login reais conferidos nos três perfis. Veja [local-validation.md](local-validation.md). Os bloqueios de acesso local descritos historicamente abaixo já foram superados; nada foi alterado no backend original.

**Atualização da Etapa 2:** branch padrão e contratos de autenticação reconfirmados no mesmo commit em 26/10/2026. Axios, login/cadastro, sessão e guards implementados no mobile; teste contra servidor em execução pendente (portas locais 5107/7154: ECONNREFUSED, sem URL configurada). Detalhes atuais em [authentication.md](authentication.md). A descrição abaixo preserva a auditoria original da Etapa 1.

Análise em 26/10/2026. Backend somente leitura, sem alterações remotas.

- Repositório: [cauanzzz/Vanos-Backend](https://github.com/cauanzzz/Vanos-Backend).
- Branch padrão consultada pela API do GitHub: `master`.
- Commit: [`9fc0757d17e3595de840b22b859c6ef0c27807b8`](https://github.com/cauanzzz/Vanos-Backend/tree/9fc0757d17e3595de840b22b859c6ef0c27807b8), de 09/09/2026.
- Aplicação confirmada no repositório em `Desktop/Vanos/Vanos.API`: Controllers, DTOs, Models, Services, Hubs, Extensions, Data e Migrations; .NET 10 / SQL Server.
- `C:\Users\cauan\Desktop\Vanos\Vanos.API` não existe neste ambiente. A auditoria usou o código remoto fixado no commit acima, acessível pelo conector GitHub.
- Workspace mobile: template Expo sem frontend funcional prévio; npm e `package-lock.json`, sem Bun. Node local 24.14.0.
- Lidos todos os controllers e DTOs, modelos relevantes, `Program.cs`, `JwtTokenService`, `TrackingHub`, `launchSettings.json`, README, TESTAR-MVP e teste de integração de tracking.

## Matriz

“Disponível” significa implementado no código do backend, não testado contra uma API em execução. Nenhuma chamada de negócio está integrada no mobile nesta etapa. D = Driver; C = Parent ou Student. Todos os caminhos HTTP abaixo começam na origem da API.

| Funcionalidade | Endpoint / Hub | Contrato de dados | Autorização | Backend / mobile |
| --- | --- | --- | --- | --- |
| Login | POST `/api/auth/login` | `{email,password}` → `{token,role}` | Anônimo | Mobile implementado / HTTP real local validado |
| Cadastro | POST `/api/auth/register` | RegisterRequest → `{token,role}` | Anônimo; role validada | Mobile implementado / HTTP real local validado |
| Refresh / recuperar senha / perfil me | — | Não existem contratos | — | Pendente no backend |
| Perfis de passageiro / dependentes | GET `/api/students` | `Student[]`; `parentId?` só pode ser o próprio usuário | C, por proprietário | Disponível / futura integração |
| Criar passageiro | POST `/api/students` | Student → Student; servidor impõe id=0, parentId da conta e driverId=null | C | Disponível / futura integração |
| Não vou hoje | PATCH `/api/students/{id}/status?isGoingToday=false&isReturningToday=false` | Dois booleanos na query → Student | C, por proprietário | Parcial: sem data ou histórico / Etapa 3 |
| Perfil do motorista | GET `/api/drivers` | Driver[] filtrado ao próprio driverId | D | Disponível / Etapa 4 |
| Passageiros vinculados | GET `/api/drivers/{id}/students` | Student[]; 404 quando vazio | D, próprio driverId | Disponível / Etapa 4 |
| Instituições | GET `/api/schools` | School[] | D, C | Disponível / futura integração |
| Descobrir motoristas | GET `/api/drivers/marketplace` | `schoolId?,city?,neighborhood?,page=1,pageSize=20` → PageResult<DriverListing> | C | Disponível / fora das etapas iniciais |
| Busca por raio | GET `/api/drivers/search` | `schoolId?`, trio `lat,lng,radiusKm?` → dados públicos e vagas, sem coordenadas | C | Disponível / fora das etapas iniciais |
| Áreas atendidas | PUT `/api/drivers/{id}/service-areas` | `{city,neighborhood}[]` → 204 | D, próprio driverId | Disponível / futura integração |
| Instituições atendidas | PUT `/api/drivers/{id}/schools` | `number[]` → 204 | D, próprio driverId | Disponível / futura integração |
| Solicitar vínculo | POST `/api/hirerequests` | `{studentId,driverId}` → HireRequest | C, passageiro próprio sem motorista | Disponível / futura integração |
| Consultar solicitações | GET `/api/hirerequests` | `driverId` próprio ou `parentId` próprio obrigatório → HireRequest[] | D ou C segundo filtro | Disponível / futura integração |
| Aceitar / rejeitar | PATCH `/api/hirerequests/{id}/accept` ou `/reject` | Sem body → HireRequest; aceite transacional verifica vagas e vínculo | D, destinatário | Disponível / futura integração |
| Publicar localização | `/hubs/tracking`: `UpdateLocation(latitude,longitude)` | Dois doubles finitos nos limites geográficos | D ativo; vínculo da conta revalidado | Disponível / Etapa 4 |
| Receber localização | Evento `LocationUpdated` | DriverId, Latitude, Longitude, RecordedAtUtc gerados no Hub | C vinculado ao motorista via Student.ParentId | Disponível / Etapa 3 |
| Entrar no acompanhamento | Conexão ao Hub | Grupo atribuído pelo servidor em OnConnectedAsync | Conta autenticada; C entra no grupo próprio | Disponível, sem método de inscrição cliente |
| Última posição / envio HTTP | — | Não há GET de última posição nem POST de coordenadas | — | Pendente no backend |
| Viagens, rotas, turnos, start/end | — | Não há entidade/endpoint de viagem | — | Pendente no backend |
| Embarcou / ausente na chamada / desembarcou | — | Preferências de ida/volta não são chamada | — | Pendente no backend |
| Velocidade, heading e ETA | — | Ausentes no evento | — | Pendente; não exibir valores fabricados |
| Faturas pessoais | GET `/api/monthlyfees` ou `/mine` | `pendingOnly=true,page=1,pageSize=20` → PageResult<MonthlyFeeResponse> | C, passageiro próprio | Disponível / fora do escopo inicial |
| Criar fatura | POST `/api/monthlyfees` | `{studentId,amount,dueDate}` → 201 MonthlyFeeResponse | D ativo, passageiro vinculado | Disponível / fora do escopo inicial |
| Pagamento simulado | POST `/api/monthlyfees/{id}/simulate-payment` | Sem body → MonthlyFeeResponse com isSimulated | C proprietário; somente Development + flag | Somente simulação / não implementado no mobile |
| Avaliar motorista | POST `/api/ratings` | `{driverId,score:1..5,comment?}` → Rating | C, contratação aceita | Disponível / fora do escopo inicial |
| Consultar avaliações | GET `/api/drivers/{driverId}/ratings` | `{average,count,ratings}` | Autenticado | Disponível / fora do escopo inicial |

Os métodos `PostDriver` e `PostSchool` são `[NonAction]`: não são endpoints de criação.

## Contratos e autenticação

HTTP usa configuração padrão dos controllers ASP.NET Core (JSON camelCase); SignalR usa protocolo JSON padrão, sem customização em Program.cs. Os nomes PascalCase acima identificam propriedades C#; o casing efetivo do evento precisa ser coberto no teste do cliente JS na Etapa 3.

- RegisterRequest: `email`, `password`, `role`; para Driver: `fullname`, `cpf`, `phoneNumber`, `licensePlate`, `studentCapacity` (1–100), `pixKey` obrigatórios; `latitude` e `longitude` opcionais, sempre juntos. Parent e Student não recebem esses campos extras obrigatórios.
- E-mail normalizado pelo servidor; senha do cadastro com mínimo de 8 caracteres e máximo de 72 bytes UTF-8; login também rejeita mais de 72 bytes. Não criar regras de CPF ou telefone que o servidor não confirme.
- Roles exatas: `Driver`, `Parent`, `Student`. `Consumer` é apenas a constante `Parent,Student`, não uma quarta role. A escolha inicial na interface não autentica nem autoriza.
- JWT HS256 com duração de 2 horas; claims de identificador/role e `driverId` para motorista. Resposta não contém refresh token, expiresIn nem nome. Derivar exp do JWT e não presumir uma rota `/me`.
- O backend valida assinatura, issuer, audience, validade (tolerância de 30 segundos), conta e role atuais no banco; driverId também é confrontado com o banco.
- `Student.parentId` tem nome legado: é o proprietário da conta, Parent **ou** Student adulto. Student não tem vínculo automático por e-mail. Não misturar usuário autenticado com entidade passageiro.
- Student: `id,fullName,guardianName,guardianPhoneNumber,zipCode,street,number,complement,neighborhood,city,state,latitude?,longitude?,schoolId,parentId,driverId?,isGoingToday,isReturningToday`.
- Driver: `id,fullname,cpf,phoneNumber,licensePlate,studentCapacity,pixKey,isActive,latitude?,longitude?`. GET de perfil retorna dados privados somente ao próprio motorista.
- School: `id,name,zipCode,street,number,neighborhood,city,state,latitude?,longitude?`.
- HireRequest: `id,studentId,driverId,status,createdAt,respondedAt?`; enum numérico Pending=0, Accepted=1, Rejected=2 (sem conversor string configurado).
- PageResult: `page,pageSize,hasNextPage,items`; DriverListing: `id,fullname,studentCapacity,availableCapacity,averageRating?`.
- MonthlyFeeResponse: `id,studentId,driverId,amount,dueDate,isPaid,paymentDate?,isSimulated`.

## Realtime e GPS: decisões para as próximas etapas

- Hub autenticado em `/hubs/tracking`; `access_token` na query é aceito apenas nesse caminho. Program configura fechamento na expiração de autenticação. Limite de mensagem: 8192 bytes.
- `UpdateLocation` aceita no máximo uma publicação por segundo **por conexão**. Destinatários são recalculados a cada envio a partir dos vínculos atuais. Nenhum JoinGroup/Subscribe/StartTrip existe.
- RecordedAtUtc é horário de processamento no servidor, **não** timestamp de captura no dispositivo. O Hub não persiste a posição em Driver e não entrega uma última posição ao conectar.
- Após reconectar, o servidor refaz o grupo da conta; o cliente não deve invocar métodos de inscrição inventados. Aguardar nova localização e indicar indisponibilidade até recebê-la.
- Reanimated não deve ser presumido compatível com props do Marker. Na Etapa 3, verificar a versão instalada de react-native-maps e preferir API de animação documentada do marcador quando apropriado, sem estado React por frame. Testar em Android e iOS reais. Sem heading no contrato, não fabricar orientação. Não declarar 60fps sem medir.
- **Sem fila de reenvio de pontos antigos por SignalR:** isso faria o servidor carimbar dados antigos como atuais. A Etapa 4 precisa separar captura, armazenamento e transporte. Enquanto o contrato atual persistir, envio é oportunista de pontos recentes, com aviso explícito de interrupção; não garantir entrega em background.
- Configuração de permissões nativas está pronta; solicitação de permissões, defineTask em escopo global, foreground service em execução, retenção e envio ficam para a Etapa 4. Nesta etapa não há tarefa vazia nem captura automática.
- Android/iOS podem suspender execução, restringir bateria e interromper localização após encerramento forçado. WebSocket JS não é um serviço nativo contínuo. Requer development build e teste físico; Expo Go não valida background.
- Preferências diárias não têm data, fuso, histórico ou rotina de reset. A UI futura precisa explicar esse limite e aguardar resposta antes de confirmar alteração.

Propostas **não implementadas**, dependentes de aprovação/trabalho no backend: ingestão HTTP autenticada de localização com `{latitude,longitude,capturedAtUtc,sequence,accuracyMeters?}`, descarte de pontos antigos/fora de ordem e deduplicação; consulta autorizada de última posição; lifecycle persistido de viagem; chamada; ausência por data com regra de fuso e reset. Os nomes de rotas dessas propostas serão definidos pelo backend, não pelo cliente.

## Divergências e limites da auditoria

README diz que não existe projeto automatizado, mas `Desktop/Vanos/Vanos.API.Tests` e `.github/workflows/verify-mvp.yml` existem no commit auditado. Preservada a precedência do código. TESTAR-MVP descreve uma tentativa anterior e não comprova execução atual. Os testes do backend não foram executados aqui: não existe clone local/servidor SQL preparado e a etapa não altera o backend.

Não foi fornecida uma URL de API em execução nem contas de teste. Ler código remoto não valida conectividade, banco, certificado ou comportamento em dispositivo.
