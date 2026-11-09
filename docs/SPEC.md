# Especificação do Portal Control

Data: 28/10/2026. Origem: decisões da conversa de redefinição do produto.

> Atualização de 30/10/2026: o PC-09 antigo foi aposentado e substituído pelo FIN-02/03, conforme `FINANCEIRO-SPEC.md`. As menções ao PC-09, à sua implementação pendente e às provas anteriores abaixo são históricas. A regressão vigente é integral, sem o perfil de exceção; ver `BANCO-DE-DADOS.md`. Essa substituição não declara liberação para produção.

Status: especificação consolidada e decomposta em tickets locais; não autoriza implementação, migração, deploy ou publicação. As decisões confirmadas estão separadas das propostas técnicas e das pendências. Cada ticket identifica as etapas afetadas por decisões abertas, sem bloquear trabalho independente por pendências de outros módulos.

Destino: cópia local de trabalho. Não foi fornecida referência Obsidian nem configuração de rastreador de issues e vocabulário de triagem. A publicação prevista pela skill `to-spec` permanece pendente de configuração por `/setup-matt-pocock-skills`.

## Problem Statement

A empresa contrata freelancers, chapas e outros prestadores esporádicos. O gestor da filial combina o serviço, horário e valor, normalmente no dia anterior, por conversa ou WhatsApp. Não existe controle central suficiente dos acordos, comparecimento, conferência, valores devidos, recibos e pagamentos em dinheiro.

É necessário ligar cada contratação a uma pessoa, registrar entrada e saída, conferir o serviço e acompanhar o que deve ser pago e o que já foi quitado. Gestores precisam operar apenas suas filiais; financeiro e Administrativo precisam de visões compatíveis com suas responsabilidades. O mesmo prestador pode atender várias filiais sem ter cadastros duplicados.

O pagamento normalmente é uma diária negociada. Horários documentam o trabalho e não determinam automaticamente a remuneração. O produto não deve transformar uma saída antecipada em desconto automático.

## Solution

Aplicação web online para uso em computador e tablet, com adaptação a celular. Terá cadastros, contratações e registros operacionais, painel financeiro e extrato por prestador. Uma página exclusiva no tablet permitirá digitar tokens de entrada e saída sem conceder acesso administrativo ao prestador.

Cada contratação será um lançamento individual, vinculado a um único prestador, uma filial e um tipo de atividade. O gestor ou ADM informa data, horários previstos e valor. Os horários reais vêm do uso dos tokens ou de correção manual justificada. Após a conferência e liberação do gestor ou ADM, a contratação passa ao financeiro e gera um valor a receber no extrato.

O financeiro entrega dinheiro fora do aplicativo e registra a quitação no sistema, individualmente ou agrupando contratações do mesmo prestador. A data efetiva do pagamento é independente da data do serviço e da liberação. Haverá um recibo numerado por contratação e um extrato com recebíveis, pagamentos e ajustes preservados.

Não haverá prazo de pagamento, vencimento ou classificação de atraso nesta etapa.

## User Stories

1. Como ADM, quero cadastrar outros usuários ADM, para delegar a administração.
2. Como ADM, quero cadastrar gestores e usuários financeiros, para distribuir responsabilidades.
3. Como ADM, quero atribuir funções e filiais autorizadas a usuários, para limitar seu acesso.
4. Como usuário, quero entrar com e-mail individual e senha, para que minhas ações sejam identificadas.
5. Como ADM, quero desativar usuários e encerrar seu acesso, para impedir operações posteriores.
6. Como ADM, quero cadastrar filiais com nome, endereço e código interno, para identificar os locais de trabalho.
7. Como ADM, quero editar e desativar filiais, para manter a estrutura da empresa.
8. Como gestor, quero operar somente nas filiais autorizadas, para respeitar a separação entre unidades.
9. Como ADM, quero consultar e operar todas as filiais, para administrar a empresa.
10. Como gestor ou ADM, quero cadastrar prestadores com nome completo e CPF, para identificar cada pessoa.
11. Como gestor ou ADM, quero informar telefone e CNPJ opcionais, para complementar o cadastro quando disponíveis.
12. Como gestor ou ADM, quero vincular o prestador a pelo menos uma filial no cadastro, para permitir sua utilização inicial.
13. Como gestor, quero localizar um CPF já cadastrado e vinculá-lo às minhas filiais, para evitar duplicações.
14. Como gestor, quero atualizar dados comuns do prestador com histórico, para manter o cadastro compartilhado atualizado.
15. Como ADM, quero corrigir CPF com controle de unicidade, para reparar a identificação sem duplicar pessoas.
16. Como gestor, quero remover vínculos apenas das filiais autorizadas, para manter minha lista de prestadores.
17. Como gestor, quero remover vínculos mesmo com pendências, para impedir novas contratações sem perder o acompanhamento das anteriores.
18. Como ADM, quero preservar prestadores sem filiais vinculadas, para permitir reutilização futura do cadastro.
19. Como ADM, quero desativar prestadores sem apagar o histórico, para impedir novas contratações.
20. Como ADM, quero manter tipos de atividade compartilhados, para padronizar a classificação dos serviços.
21. Como ADM, quero desativar tipos de atividade preservando os registros existentes, para retirar opções de uso futuro.
22. Como gestor ou ADM, quero criar uma contratação para um prestador, para registrar o acordo individual.
23. Como gestor ou ADM, quero selecionar filial, data, tipo de atividade e prestador por busca, para associar corretamente o serviço.
24. Como gestor ou ADM, quero informar entrada e saída previstas e valor combinado, para documentar a contratação.
25. Como gestor, quero visualizar um alerta de valor acima da média do mesmo tipo e filial, para avaliar acordos fora do padrão.
26. Como gestor, quero saber quando falta histórico para calcular a média, para não interpretar ausência de dados como valor zero.
27. Como gestor, quero receber aviso cinco unidades antes do limite de utilização, para planejar novas contratações.
28. Como gestor, quero solicitar exceção ao ADM ao atingir o limite, para submeter uma contratação excepcional à decisão superior.
29. Como ADM, quero aprovar ou rejeitar exceções de limite com histórico, para controlar sua utilização.
30. Como gestor, quero gerar o token de entrada por botão, para comunicá-lo ao prestador fora do sistema.
31. Como gestor, quero gerar o token de saída por botão após gerar o de entrada, para controlar separadamente os registros.
32. Como gestor, quero substituir um token perdido e invalidar o anterior, para recuperar o processo sem manter códigos paralelos.
33. Como prestador, quero digitar um token em uma página com teclado numérico e confirmação, para registrar minha entrada ou saída.
34. Como prestador, quero receber confirmação de token aceito ou mensagem de erro, para saber se o registro ocorreu.
35. Como gestor ou ADM, quero habilitar inicialmente a página do tablet, para disponibilizar o acesso específico aos prestadores.
36. Como gestor, quero que o token identifique a contratação sem vincular o tablet a uma filial, para utilizar a página web conforme o fluxo definido.
37. Como gestor, quero registrar manualmente um horário esquecido com justificativa, para concluir a conferência.
38. Como gestor, quero cancelar uma contratação por falta ou outro motivo, para impedir cobranças indevidas.
39. Como gestor, quero conferir presença, horários e valor final, para liberar ao financeiro apenas serviços verificados.
40. Como gestor, quero justificar alterações e preservar os dados anteriores, para tornar as correções rastreáveis.
41. Como gestor ou ADM, quero corrigir o valor de uma contratação, para ajustar o acordo registrado.
42. Como financeiro, quero visualizar somente contratações conferidas e liberadas, para trabalhar com valores autorizados.
43. Como financeiro, quero ver filial seguida do nome do gestor em cada linha, para identificar o responsável operacional.
44. Como financeiro, quero filtrar o painel por filial, prestador, período e situação, para localizar pagamentos.
45. Como financeiro, quero abrir o painel em valores em aberto e acessar os pagos, para priorizar o trabalho.
46. Como financeiro, quero registrar quitação integral de uma contratação, para baixar seu valor em aberto.
47. Como financeiro, quero quitar várias contratações de um mesmo prestador juntas, para registrar uma entrega agrupada de dinheiro.
48. Como financeiro, quero informar a data efetiva de um pagamento realizado, inclusive em data passada permitida, para refletir o fato ocorrido.
49. Como financeiro, quero anexar evidência ao pagamento, para documentar a baixa conforme a regra de anexos.
50. Como financeiro, quero gerar um recibo por contratação autorizada, para imprimir e colher preenchimento manual e assinatura.
51. Como financeiro, quero imprimir um recibo antes da entrega sem marcar a contratação como paga, para preparar o documento.
52. Como financeiro, quero reimprimir o recibo com o mesmo número, para não criar documentos duplicados.
53. Como ADM, quero números globais distintos de contratação e recibo persistidos no banco, para controlar cada documento sem depender da filial.
54. Como financeiro, quero estornar uma baixa incorreta com justificativa, para corrigir o registro sem apagar o pagamento original.
55. Como financeiro, quero que alterações de valor sejam feitas pelo gestor ou ADM, para preservar a responsabilidade pela autorização.
56. Como financeiro ou ADM, quero consultar o extrato do prestador em todas as filiais, para conhecer o saldo global.
57. Como gestor, quero consultar o extrato somente das minhas filiais, para acompanhar meus serviços sem acessar outras unidades.
58. Como usuário autorizado, quero ver a liberação como valor a receber e a baixa como pagamento em datas próprias, para compreender a evolução do saldo.
59. Como usuário autorizado, quero ver ajustes e estornos no extrato, para reconstruir as mudanças de valor.
60. Como usuário autorizado, quero filtrar o extrato por nome do prestador, filial e período, para consultar o recorte desejado.
61. Como usuário autorizado, quero imprimir ou baixar o extrato em PDF com saldo anterior, movimentações e saldo final, para conferir os valores.
62. Como usuário autorizado, quero consultar as contratações e recibos de um pagamento agrupado, para verificar sua composição.

## Implementation Decisions

### Vocabulário e estrutura do produto

- Empresa única; não haverá atendimento a empresas clientes independentes.
- ADM e Administrativo representam o mesmo papel.
- Filial é a unidade operacional autorizada para o usuário e vinculada à contratação.
- Prestador é uma pessoa identificada por CPF, com cadastro único na empresa; não é usuário com login.
- Tipo de atividade é uma opção global mantida pelo ADM. Não é uma categoria do cadastro do prestador.
- Contratação é o lançamento individual de um serviço de um prestador. Na base existente há entidades chamadas atividade e participação; o mapeamento técnico deve ser definido antes de migrar, sem transportar automaticamente o modelo de vários participantes para a nova interface.
- Conferência é a validação operacional final que libera a contratação para pagamento; não se confunde com aprovação de exceção de limite.
- Pagamento é o registro de uma entrega de dinheiro já realizada fora do sistema.
- Recibo é um documento numerado por contratação; sua emissão não comprova que a baixa foi registrada.
- Extrato registra recebíveis liberados, pagamentos e ajustes, com saldo calculado no escopo de acesso.

### Acessos

| Ação | ADM | Gestor | Financeiro | Prestador |
|---|---|---|---|---|
| Cadastrar usuários e atribuir acessos | Sim | Não | Não | Não |
| Manter filiais e tipos de atividade | Sim | Não | Não | Não |
| Cadastrar prestador | Sim | Sim, nas filiais autorizadas | Não | Não |
| Alterar dados comuns do prestador | Sim | Sim, com histórico | Não | Não |
| Corrigir CPF ou desativar prestador | Sim | Não | Não | Não |
| Adicionar/remover vínculo com filial | Sim | Somente nas próprias filiais | Não | Não |
| Criar contratação, ajustar valor e conferir | Sim | Somente nas próprias filiais | Não | Não |
| Aprovar exceção de limite | Sim | Não | Não | Não |
| Registrar pagamentos e emitir recibos | Sim | Não pelo papel de gestor | Sim | Não |
| Consultar extrato | Todas as filiais | Apenas filiais autorizadas | Todas as filiais | Não |
| Inserir token | Pela página específica | Pela página específica | Pela página específica | Sim, sem login pessoal |

- E-mail único e senha por usuário; nenhuma conta compartilhada é requisito do produto.
- Atribuição explícita de funções e filiais pelo ADM. O acúmulo de funções foi aceito, sujeito à autorização do ADM; o papel de gestor isolado não concede poderes financeiros.
- O primeiro ADM depende de configuração inicial. O procedimento técnico ainda não foi desenhado.
- Restrições de filial e papel precisam valer também na API, consultas, exportações e anexos.
- Um gestor não poderá bloquear prestadores como política local de contratação.

### Cadastros

| Entidade | Campos e regras confirmados |
|---|---|
| Usuário | Nome de identificação, e-mail único, senha, funções, filiais autorizadas e situação. Obrigatoriedade detalhada do nome e recuperação de senha ainda são propostas a fechar. |
| Prestador | Nome completo e CPF obrigatórios; telefone e CNPJ opcionais; pelo menos uma filial na criação. CPF único na empresa. |
| Filial | Nome, endereço e código interno. Somente ADM mantém o cadastro. |
| Tipo de atividade | Nome obrigatório, descrição opcional e situação ativo/inativo. Catálogo global mantido somente pelo ADM. |

- Buscar CPF existente deve permitir reaproveitar o cadastro e adicionar vínculo autorizado, sem expor atividades de outras filiais ao gestor.
- Dados comuns editados afetam o cadastro compartilhado e precisam de histórico de autor e alteração.
- CPF somente pode ser corrigido pelo ADM, mantendo unicidade.
- Remover vínculo é permitido mesmo com contratações ou pagamentos pendentes. Essas pendências continuam acessíveis para conclusão; o vínculo removido impede novos lançamentos na filial.
- O último vínculo pode ser removido: o prestador fica sem filial e continua localizável por CPF para nova vinculação.
- Desativação impede novos lançamentos e preserva existentes para conclusão ou cancelamento explícito. Não apagar históricos de cadastros utilizados.
- Desativação de usuário encerra o acesso imediatamente.
- Não cadastrar endereço nem dados bancários do prestador nesta etapa. O endereço da filial continua obrigatório.

### Contratação e fluxo operacional

- Campos: número automático, filial, data de início do serviço, prestador por busca, tipo de atividade, entrada prevista, saída prevista, valor combinado e conferência. Horários reais são preenchidos por registros de token ou manualmente com justificativa.
- Não haverá prazo, data de vencimento, previsão de pagamento ou indicador de atraso no escopo atual. Essa decisão substitui propostas anteriores sobre vencimento.
- Dentro dos limites, gestor ou ADM pode salvar e gerar tokens sem aprovação superior. Exceções de limite exigem ADM.
- Não calcular remuneração automaticamente pelas horas. Alterar horário não implica alterar diária; mudanças no valor são explícitas, por gestor ou ADM, com justificativa.
- Conferência apresenta presença, horários e valor final e libera a contratação para pagamento.
- Exigir entrada e saída reais antes de liberar. Registros faltantes podem ser preenchidos manualmente, identificados como manuais, com motivo e autor.
- Cancelamento exige motivo. Antes de pago, retira o valor em aberto aplicável. Depois de pago, preservar a baixa e registrar ajustes/devoluções quando pertinentes; não apagar a entrega de dinheiro.
- Gestor ou ADM pode corrigir o registro sem aprovação superior. Alteração de valor já liberado e ainda não pago retira temporariamente a contratação da lista pagável e exige nova conferência; o extrato registra o ajuste.
- Alterações posteriores ao pagamento preservam valor e pagamento originais e tornam explícita eventual diferença a pagar ou devolver. O tratamento operacional detalhado dessa diferença depende de definição complementar.

### Limite de utilização do prestador

- Contagem deve considerar o prestador em toda a empresa, incluindo trabalhos de outras filiais.
- Alertar cinco unidades antes do limite configurado. O exemplo de 45 com aviso em 40 ilustra a distância do alerta, não define o limite real.
- Ao atingir o limite, o gestor não pode incluir a contratação como automaticamente autorizada. Se insistir, o lançamento excepcional depende de aprovação do ADM.
- Valor do limite, janela de contagem, unidade dias/contratações, dias consecutivos, eventos considerados e reinício da contagem estão pendentes. Não implementar regras presumidas.
- A aprovação de exceção precisa ser rastreável. Detalhes de rejeição, validade e edição após aprovação ainda exigem definição.

### Alerta de valor acima da média

- Comparar o valor informado com contratações anteriores conferidas do mesmo tipo de atividade na mesma filial.
- Exibir aviso para qualquer valor acima da média; não bloquear nem exigir aprovação apenas por esse motivo.
- Exibir média e quantidade de registros utilizados; sem amostra suficiente, mostrar ausência de base, sem tratar como média zero.
- Janela de 90 dias foi aceita na conversa.
- Decisão confirmada pelo usuário na execução PC-07 em 28/10/2026: usar os últimos 20 registros conferidos do mesmo tipo e filial nos 90 dias anteriores à data do serviço, com mínimo de cinco. Janela inclui data do serviço menos 90 dias e exclui a data de referência; ordenação por data do serviço decrescente e ID decrescente no desempate. Excluir a própria contratação, canceladas e revisadas sem nova conferência; pagas permanecem na base.
- Não incluir a própria contratação na base de comparação. É proposta técnica para evitar comparação circular, sujeita à revisão dos critérios de teste.

### Tokens e página do tablet

- Página web online exclusiva com teclado numérico e botão de confirmação; não é aplicativo nativo nem login individual do prestador.
- Habilitação inicial pelo gestor ou ADM foi aceita. Não vincular o aparelho a uma filial; o token resolve a contratação, o prestador, a filial e a ação.
- Dois tokens distintos por contratação: entrada e saída. Gerados aleatoriamente, por botões acionados pelo gestor, após criação e autorização aplicável.
- Decisão atualizada pelo usuário em 28/10/2026 no PC-05: o token de entrada precisa ser usado e registrar a entrada antes de gerar o token de saída. A geração prévia da entrada, sozinha, não basta.
- Cada token tem validade de uma hora a partir da geração e uso único.
- Substituição permitida antes do uso; o token anterior deve perder a validade imediatamente.
- O gestor comunica o código oralmente ou por WhatsApp, fora do aplicativo. Não há mensageria interna nem envio automático.
- Aceitar o token grava o horário real de forma confiável no servidor e mostra confirmação simples, como “Token aceito”. Depois, limpar a tela.
- Códigos incorretos, expirados, substituídos ou utilizados não geram nova movimentação e recebem mensagem de erro apropriada, sem expor dados pessoais desnecessários.
- Como o tablet não informa filial ou pessoa, códigos simultaneamente válidos precisam resolver sem ambiguidade uma única ação. Decisão aprovada em 09/11/2026: novos tokens têm quatro dígitos, preservam zeros à esquerda e reservam o número até expirar, inclusive após uso ou substituição; podem reutilizá-lo depois sem remover histórico.
- Registro manual do horário invalida o token correspondente ainda utilizável.
- No PC-05, consumo de saída exige entrada registrada; geração de saída exige também token de entrada consumido. Correção manual justificada preserva histórico e invalida tokens pendentes. Reentradas e intervalos permanecem fora do escopo aprovado.
- Propostas técnicas: consumo atômico para impedir uso concorrente e proteção contra tentativas repetidas. Não escolher uma quantidade de dígitos ou limites operacionais sem dimensionar uso e validar a experiência.

### Painel financeiro e pagamentos

- Exibir apenas contratações finalizadas, conferidas e liberadas para pagamento, conforme a sequência operacional.
- Abertura padrão em “Em aberto”, com acesso a “Pagos”. Filtros por filial, prestador, período e situação; sem vencimentos.
- Cada linha representa uma contratação. Ordem informativa aceita: filial, nome do gestor e demais dados, incluindo prestador, tipo de atividade, data do serviço e valor.
- Gestor responsável precisa ser identificável. Qual usuário compõe essa coluna quando um ADM lança ou outro gestor confere é pendência de detalhe.
- Baixa individual ou agrupamento de contratações do mesmo prestador. Cada contratação é quitada integralmente; pagamento parcial está fora do escopo.
- Não executar transferência, Pix ou movimentação bancária no aplicativo. A entrega é em dinheiro e ocorre fora do software.
- Registrar data efetiva, valor integral devido e usuário responsável. Observação opcional, exceto justificativas exigidas em correções.
- Permitir data de pagamento retroativa, desde que não anteceda a data do serviço; recusar data futura. A data de registro da ação também é preservada, separadamente.
- Financeiro não altera valor contratado, não cria contratação e não cadastra prestador. Correção de valor pertence a gestor ou ADM; a forma da solicitação do financeiro ainda não foi definida.
- Baixa incorreta pode ser estornada com justificativa, preservando o registro original e refletindo o efeito no saldo.
- P04 confirmada pelo usuário na execução PC-08 em 28/10/2026: anexo obrigatório por contratação, inclusive no pagamento agrupado. Formatos variados são aceitos e baixados como arquivo inerte por usuário financeiro autorizado.
- Aceitar formatos variados não define tamanho máximo, quantidade, visualização, retenção e autorização de download; esses detalhes são propostas técnicas a definir. Arquivos anexados não devem ser executados pelo sistema.
- Proposta técnica: pagamento e itens quitados devem ser confirmados de forma atômica, com proteção contra baixa duplicada, inclusive em duas sessões concorrentes.

### Recibos e numeração

- Um recibo por contratação autorizada, inclusive se várias contratações forem quitadas em um pagamento agrupado.
- Usar o modelo fornecido pelo usuário, preservando o texto e o desenho como referência de produto. A leitura realizada nesta fase foi de conteúdo; fidelidade visual ainda deve ser verificada na implementação.
- Dados fixos da empresa no modelo: JETTA TRANSPORTES E LOGISTICA LTDA, CNPJ 15.387.508/0001-61. O usuário confirmou que serão os mesmos para todas as filiais.
- Localidade deve vir do endereço da filial; não manter “Sumaré/SP” fixo para todas. A extração/formatação da localidade a partir do endereço ainda precisa ser definida, sem acrescentar campos obrigatórios não aprovados.
- Preencher número do recibo, valor numérico e por extenso, serviço e data a partir da contratação, conforme a proposta aceita.
- Deixar em branco nome por extenso do recebedor, CPF e assinatura, para preenchimento manual após impressão. Nome por extenso do recebedor não é o valor monetário por extenso.
- Pode emitir/imprimir antes do pagamento; isso não executa a baixa. A data exibida no recibo quando a impressão anteceder o pagamento ainda está pendente.
- Contratações e recibos terão sequências globais independentes, sem separação por filial nem reinício anual, persistidas no banco.
- Números automáticos, únicos e não reutilizados, inclusive após cancelamento; reimpressão conserva número. Não foi exigida sequência sem lacunas.
- Proposta técnica: unicidade e geração concorrente garantidas no banco, sem cálculo pelo maior número exibido na interface.
- Recibos anteriores permanecem identificáveis após correção. Regras de cancelamento/substituição de recibo e exigência de nova assinatura ainda precisam de definição.

### Extrato do prestador

- Tela própria para evolução do saldo por prestador, com funcionamento semelhante a um extrato bancário, sem representar conta bancária real.
- A liberação final cria o valor a receber na data da liberação; manter também a data original do serviço.
- O pagamento reduz o saldo na data efetiva informada na baixa, que pode diferir da data do serviço e da data de lançamento da baixa.
- Contratações não conferidas não compõem o saldo. Sua exibição em seção separada não foi aprovada como requisito.
- Exibir data, filial, gestor, tipo de atividade, referências da contratação e recibo quando existente, valor e saldo após cada movimentação.
- Pagamento agrupado permite consultar os itens quitados. Na visão do gestor, somente itens de suas filiais podem aparecer ou compor o saldo.
- Preservar ajustes, cancelamentos e estornos como movimentos rastreáveis. Não sobrescrever silenciosamente o histórico.
- Filtros por filial, prestador por nome e período; impressão e PDF com saldo anterior ao período, movimentos, totais pagos e em aberto e saldo final.
- Saldo anterior e totais obedecem ao mesmo escopo de acesso e filial do extrato.
- Proposta técnica: diferenciar data efetiva da movimentação e data de registro. Desempate de movimentos no mesmo instante, reprocessamento de saldos por baixas retroativas e exposição de saldo a devolver precisam ser especificados nos contratos antes da implementação.

### Persistência e interfaces propostas

- O projeto atual utiliza Node.js/Express e SQL Server por ODBC. O piloto documentado usa banco local dedicado, autenticação integrada Windows e financeiro simulado. Isso é contexto existente, não uma decisão de hospedagem definitiva.
- Não houve conexão ao banco instalado, consulta a dados reais, exportação ou alteração de schema nesta etapa.
- Reaproveitar a infraestrutura existente quando compatível; não assumir que as rotinas de laboratório ou a estrutura legada satisfazem os requisitos financeiros novos.
- Modelo lógico proposto: usuários/funções/escopos; filiais; prestadores e vínculos; tipos de atividade; contratações; exceções de limite; tokens e eventos de horário; conferências e revisões; pagamentos e itens; recibos; anexos; movimentos do extrato e auditoria.
- Trata-se de entidades conceituais, não de nomes finais de tabelas. A implementação deve avaliar entidades e relacionamentos existentes antes de propor migrations.
- Preservar relações entre contratação, prestador, filial, tipo, responsável, eventos, pagamento, recibo e ajustes. Uma baixa agrupada relaciona vários itens; cada item identifica a contratação e o valor integral quitado.
- Datas, horários, valores monetários e identificadores devem preservar precisão e histórico. Convenção de fuso e armazenamento será definida tecnicamente antes da implementação; a experiência da empresa usa horário de São Paulo.
- Contratos de API propostos por capacidade: autenticar; manter cadastros e vínculos; lançar/revisar/cancelar/conferir contratação; decidir exceção; gerar/substituir/consumir token; registrar horário manual; consultar painel; emitir/reimprimir recibo; anexar evidência; registrar/estornar pagamento; consultar/exportar extrato.
- URLs, payloads, códigos de erro e schemas físicos ainda não foram aprovados. As capacidades acima não são afirmação de que endpoints equivalentes já funcionam.
- Mudanças de estado, valores e relações sensíveis precisam ser auditáveis e consistentes sob concorrência. A estratégia de migração dos dados existentes é trabalho futuro, sem autorização nesta especificação.

## Testing Decisions

### Estratégia proposta para revisão

Os critérios de negócio abaixo derivam das decisões confirmadas. A fronteira de testes é uma proposta técnica e ainda não foi confirmada pelo usuário; não transformar sua existência em autorização de implementação.

Priorizar a maior fronteira comum disponível: fluxo pela API autenticada com SQL Server isolado, cobrindo cadastro, contratação, token, conferência, financeiro e extrato. Testar comportamento externo e persistência observável, sem acoplar testes a nomes internos de classes, consultas ou número de funções.

O projeto já possui testes com `node:test`, testes de RBAC, segurança, códigos de apontamento, módulos operacionais e financeiros, além de suítes de integração SQL e verificações visuais. Esses são precedentes a avaliar e reaproveitar; não foram executados nem certificados nesta entrega documental. Os testes do piloto também protegem destino de banco e condição de laboratório. Não remover essas proteções para executar o produto novo.

### Cenários de aceite

| ID | Cenário | Resultado observável esperado |
|---|---|---|
| T01 | Gestor tenta acessar filial não autorizada pela API ou exportação | Acesso negado e nenhum dado exposto. |
| T02 | Financeiro tenta cadastrar prestador, criar contratação ou alterar valor | Operação negada. |
| T03 | Dois gestores informam o mesmo CPF | Um cadastro único; vínculos autorizados sem duplicidade. |
| T04 | Cadastro sem filial ou sem nome/CPF | Criação recusada; telefone e CNPJ podem ficar vazios. |
| T05 | Remoção do último vínculo com pendências | Cadastro preservado e pendências acessíveis para conclusão; novos lançamentos na filial impedidos. |
| T06 | Desativação de usuário | Acesso posterior encerrado, inclusive por sessão existente. |
| T07 | Desativação de prestador/tipo | Novos lançamentos impedidos; históricos e conclusão dos existentes preservados. |
| T08 | Gestor altera CPF | Negado; ADM pode corrigir sem quebrar unicidade e histórico. |
| T09 | Contratação criada | Um prestador, filial e tipo, horários previstos, valor e número persistidos; nenhum prazo exigido. |
| T10 | Saída antecipada registrada | Horário real refletido; valor combinado não muda automaticamente. |
| T11 | Limite atingido | Sem liberação automática; exceção depende do ADM, conforme parâmetros ainda a definir. |
| T12 | Cinco unidades antes do limite | Aviso ao gestor, após definição da unidade/janela. |
| T13 | Valor acima da média com base suficiente | Aviso com média e amostra, sem bloqueio. |
| T14 | Amostra insuficiente | Mensagem de ausência de base; sem comparação enganosa com zero. |
| T15 | Geração de saída sem geração de entrada | Recusada. |
| T16 | Token válido utilizado | Um evento e horário real gravados; confirmação simples e tela limpa. |
| T17 | Token expirado, usado ou substituído | Nenhum novo evento. |
| T18 | Duas requisições simultâneas usam o mesmo token | Exatamente um consumo bem-sucedido. |
| T19 | Tablet sem vínculo de filial usa código válido | Contratação e filial corretas resolvidas pelo código. |
| T20 | Registro manual justificado | Origem manual, autor e motivo preservados; token correspondente invalidado. |
| T21 | Conferência sem entrada ou saída real | Liberação impedida até completar registros. |
| T22 | Conferência final válida | Contratação disponível ao financeiro e recebível na data de liberação. |
| T23 | Alteração de valor liberado e ainda não pago | Retirada temporária da lista pagável, histórico de ajuste e nova conferência necessária. |
| T24 | Emissão de recibo antes do pagamento | Número independente persistido; contratação continua em aberto. |
| T25 | Impressão do modelo | Campos manuais em branco, dados automáticos corretos, localidade da filial e texto de referência preservados. |
| T26 | Reimpressão ou emissão concorrente | Sem novo número indevido nem duplicação para a mesma contratação. |
| T27 | Baixa integral de contratação | Valor em aberto quitado e movimento no extrato na data efetiva. |
| T28 | Baixa agrupada do mesmo prestador | Todos os itens integrais relacionados; um recibo por contratação. |
| T29 | Seleção de prestadores diferentes no mesmo pagamento | Agrupamento recusado. |
| T30 | Baixa parcial ou duplicada, inclusive concorrente | Recusada sem alterar indevidamente o saldo. |
| T31 | Pagamento retroativo válido | Data efetiva e data de registro distintas, com saldo recalculado corretamente. |
| T32 | Pagamento futuro ou anterior ao serviço | Recusado. |
| T33 | Estorno justificado | Pagamento original preservado, efeito compensatório e saldo coerente. |
| T34 | Correção após pagamento | Original preservado; diferença demonstrável conforme política complementar. |
| T35 | Consulta de extrato por período | Saldo anterior, movimentos, pagos, em aberto e final reconciliáveis. |
| T36 | Gestor consulta pagamento agrupado de várias filiais | Somente itens e valores de filiais autorizadas são expostos e somados. |
| T37 | Cancelamento de contratação liberada e não paga | Recebível retirado por ajuste rastreável; não há baixa fictícia. |
| T38 | Anexo e acesso ao arquivo | Comportamento conforme decisão pendente; somente usuários autorizados acessam evidências. |

Para aparência e interação, validar teclado do tablet, limpeza após resposta, formulários em computador/tablet/celular, filtros, impressão do recibo e PDF do extrato. Conferir visualmente o recibo renderizado contra o modelo, inclusive quebras de página e campos de preenchimento manual. Não usar somente extração de texto para certificar fidelidade visual.

Antes de implementar, completar testes de fronteira da validade de uma hora, definição de limites, amostragem da média e datas conforme as decisões pendentes, evitando cristalizar suposições em testes.

## Out of Scope

- Implementação nesta entrega, commits, push, deploy e alterações no banco. A decomposição documental em tickets foi autorizada posteriormente e está na seção Tickets.
- Prazo de pagamento, vencimentos, previsões de pagamento e alertas de atraso.
- Transferências financeiras pelo sistema, Pix, integração bancária e dados bancários do prestador.
- Pagamento parcial de contratação.
- Mensagens internas ou envio automático por WhatsApp.
- Login pessoal do prestador, portal de autoatendimento além da página de tokens ou biometria.
- Operação offline e aplicativo nativo para tablet, computador ou celular.
- Atendimento a várias empresas clientes independentes.
- Cálculo automático de remuneração por horas ou desconto automático por saída antecipada.
- Categoria de atividade no cadastro do prestador.
- Bloqueio de prestador por decisão local do gestor.
- Endereço do prestador ou preenchimento automático de nome, CPF e assinatura do recebedor no recibo.
- Validação jurídica do texto do recibo ou definição de uma política trabalhista/legal de limite de utilização.
- Troca de tecnologia de banco, decisão definitiva de hospedagem e migração de dados existentes.

## Further Notes

### Pendências que impedem fechar determinados fluxos

| ID | Questão em aberto | Impacto |
|---|---|---|
| P01 | Regra exata de dias/contratações: limite, janela, unidade, estados contados e reinício | Impede implementar contagem, aviso e exceção corretos. O usuário ficou de verificar. |
| P02 | Resolvido para PC-04 em 28/10/2026: uma contratação por prestador/data em toda a empresa, com saída permitida no dia seguinte. | Não permitir vários lançamentos na mesma data; criação verifica também histórico legado. Modelagem de serviços com vários dias e efeitos na contagem de PC-06 permanecem fora desta decisão. |
| P03 | Resolvido em 28/10/2026 no PC-05: entrada precisa ser usada antes de gerar saída. | API e interface exigem token de entrada consumido e horário registrado para gerar saída; consumo de saída também exige entrada. Substitui a regra anterior de apenas gerar entrada primeiro. |
| P04 | Exigência e vínculo do anexo em pagamento agrupado | Resolvida pelo usuário em 28/10/2026: obrigatório por contratação, inclusive no agrupamento. |
| P05 | Resolvido em 28/10/2026 no PC-07: últimos 20 conferidos na janela anterior de 90 dias, mínimo cinco; excluir própria/canceladas/revisadas sem reconferência e incluir pagas. | Fórmula confirmada pelo usuário; testes SQL de amostragem preparados, homologação real depende de SQL Server local isolado. |
| P06 | Tratamento de diferença a pagar/devolver após correção de contratação paga | Resolvida em PC-10: regularização separada com data efetiva e comprovante. |
| P07 | Recibo emitido antes da entrega: data do documento, cancelamento, substituição e assinatura após correção | PC-10: preservar original cancelado/substituído e exigir nova assinatura. Integração PC-09 pendente; data pré-pagamento conforme requisitos PC-09. |
| P08 | Fronteira de testes proposta e autorização de implementação | A proposta inicial ainda não recebeu confirmação específica. Nesta decomposição aplica-se verificação proporcional por ticket; não se exige uma aprovação global adicional de testes para trabalho independente. O pedido atual autoriza documentação, não execução de produto. |

### Detalhes a resolver durante o desenho técnico, antes dos contratos finais

- Definido em 28/10/2026 no PC-04: gestor responsável escolhido explicitamente na criação, validado como usuário operacional ativo autorizado à filial; criador e conferente mantidos separadamente.
- Desenho PC-05: pareamento de uso único por cinco minutos; sessão do tablet por oito horas, revogável pelo emissor/ADM, sem filial e separada da sessão pessoal. Token de oito dígitos, validade de uma hora, HMAC e unicidade histórica com repetição limitada em colisões; cinco falhas bloqueiam a sessão e há limite HTTP adicional. Configuração privada instalada não foi ativada automaticamente.
- Política de anexos: tamanho, quantidade, armazenamento, retenção e visualização; formatos variados foram pedidos, mas não dimensionados.
- Obrigatoriedade detalhada de dados do usuário, unicidade do código interno de filial e procedimentos de recuperação de senha/primeiro ADM.
- Política de datas e horários para filiais, precisão monetária, geração transacional de números, concorrência, reversão e reconciliação do extrato.
- Extração da localidade para o recibo a partir do endereço da filial.
- Retenção e acesso ao histórico, sem presumir exclusão física de informações utilizadas.
- Mapeamento das entidades e regras do laboratório para o modelo de contratação individual; disponibilidade de SQL Server e hospedagem para acesso online.

### Referências locais e estado observado

- [Visão atual do projeto](../README.md).
- [Documentação do banco de dados](BANCO-DE-DADOS.md).
- [Modelo de recibo fornecido](../recibos/MODELO%20DE%20RECIBO.docx).
- Origem funcional: entrevista desta conversa, com prevalência das respostas mais recentes. Não houve referência Obsidian de origem.
- O repositório contém API e interface, módulos de operação/RBAC/apontamento/financeiro e manifesto SQL de 21 scripts. Há estrutura legada e estrutura de piloto; ambas precisam ser diferenciadas na implementação.
- A documentação atual declara financeiro simulado, execução do piloto em localhost e configuração SQL dependente de ambiente. Não afirmar disponibilidade operacional ou pagamento real com base apenas nos fontes.
- Nenhuma alteração no modelo Word nem na aplicação foi feita para produzir esta especificação.

## Tickets

Tickets criados em 28/10/2026 a pedido do usuário, diretamente neste arquivo. Cada subseção é o registro canônico do ticket; não há arquivos duplicados, tracker externo, controlador V2 nem fila de agentes. Estado inicial de todos: **planejado, não executado**.

Cada entrega inclui o ajuste pertinente de persistência, API e interface sobre a base existente, além de verificação focal. Começar identificando o que já funciona no módulo e alterar apenas o necessário. Não reescrever o sistema, criar um módulo paralelo ou assumir que o laboratório financeiro já atende à especificação.

As dependências abaixo são por contrato, implementação ou integração: não exigem fechamento administrativo de outro ticket para iniciar uma parte independente. Regras em aberto são resolvidas antes de implementar o comportamento afetado; não escolher respostas silenciosamente. O aceite de um ticket parcial não representa conclusão do produto enquanto outro ticket ainda detiver obrigações necessárias ao fluxo.

### Ordem sugerida e dependências

| Ordem | Ticket | Entrega | Dependência técnica principal | Pendência localizada |
|---|---|---|---|---|
| 1 | [PC-01](#pc-01--acessos-e-administração-de-usuários) | Acessos e administração de usuários | RBAC, autenticação e sessão existentes | Procedimento do primeiro ADM e detalhes de usuário |
| 2 | [PC-02](#pc-02--filiais-e-tipos-de-atividade) | Filiais e tipos de atividade | Autorização ADM de PC-01 | Nenhuma regra de produto crítica para o cadastro |
| 3 | [PC-03](#pc-03--prestadores-e-vínculos-com-filiais) | Prestadores compartilhados e vínculos | Escopos de PC-01 e filiais de PC-02 | Nenhuma regra de produto crítica para o cadastro |
| 4 | [PC-04](#pc-04--contratação-individual-e-conferência) | Contratação, horários manuais e liberação | Cadastros de PC-02/PC-03 e escopos de PC-01 | P02 e definição do gestor responsável |
| 5 | [PC-05](#pc-05--tokens-e-página-do-tablet) | Geração e consumo de tokens | Identidade e estados da contratação de PC-04 | P03 resolvida; homologação SQL local pendente |
| 6 | [PC-06](#pc-06--limite-de-utilização-e-exceções) | Contagem global, avisos e aprovação ADM | Contratações de PC-04; integração com PC-05 | P01/P02 e regras da exceção |
| 7 | [PC-07](#pc-07--alerta-de-valor-acima-da-média) | Comparação de valores por tipo e filial | Contratações conferidas de PC-04 | P05 resolvida; homologação SQL pendente |
| 8 | [PC-08](#pc-08--painel-financeiro-pagamentos-e-anexos) | Painel, baixa integral e agrupamento | Liberação e valores de PC-04 | P04 resolvida; limites técnicos e homologação SQL registrados no ticket |
| 9 | [PC-09](#pc-09--recibos-numerados-e-impressão) | Recibo individual conforme modelo | Contratação de PC-04 e endereço de PC-02 | P07 e formatação da localidade |
| 10 | [PC-10](#pc-10--correções-estornos-e-ajustes-financeiros) | Correções sem perda de histórico | Revisões de PC-04 e pagamentos de PC-08; integração PC-09 | P06/P07 |
| 11 | [PC-11](#pc-11--extrato-do-prestador-e-exportação) | Extrato, saldos, filtros e PDF | Eventos de PC-04/PC-08/PC-10 e referências PC-09 | Consome somente políticas resolvidas nos tickets de origem |

### PC-01 — Acessos e administração de usuários

**Resultado:** ADM administra contas, funções e filiais autorizadas; cada usuário acessa somente operações e dados permitidos.

**Escopo/delta:** adaptar login, sessões, RBAC e tela de usuários existentes aos papéis ADM, gestor e financeiro. E-mail individual único, senha, atribuição explícita de funções e filiais, acúmulo de funções autorizado pelo ADM e desativação com revogação de acesso. Reutilizar o mecanismo de primeiro administrador, corrigindo apenas incompatibilidades demonstradas. Não substituir mecanismos de segurança já presentes sem necessidade.

**Aceite observável:**

1. Somente ADM cria ADM, gestor e financeiro e altera seus acessos; e-mail duplicado é recusado.
2. Gestor isolado não administra usuários nem opera como financeiro; financeiro não cria prestadores/contratações nem altera valor. Funções acumuladas resultam apenas das concessões explícitas do ADM.
3. Restrições por filial valem na API e nas telas; tentar enviar manualmente identificador de outra filial não contorna a autorização.
4. Desativar usuário invalida seu acesso, inclusive sessão existente, preservando a autoria histórica.
5. Há procedimento verificável de configuração do primeiro ADM, sem identidade ou senha fixa publicada no código.

**Dependências por etapa:** aproveitar contratos atuais de autenticação/RBAC para desenvolvimento. A integração da atribuição de filiais requer o cadastro de PC-02; PC-02 pode desenvolver seu cadastro usando o contrato ADM deste ticket. Não há ciclo de fechamento: a autenticação e autorização ADM não dependem de concluir o cadastro de filiais.

**Pendências locais:** fechar apenas os detalhes necessários de primeiro ADM, dados obrigatórios de usuário e recuperação de acesso. Não ampliar o ticket para um novo sistema de identidade.

**Verificação focal:** testes existentes de RBAC/sessão mais chamadas autenticadas como ADM, gestor e financeiro, incluindo alteração forjada de filial e sessão desativada. Conferir a tela de administração e login nos formatos de computador/tablet.

**Rastreabilidade:** histórias 1–5, 8–9; cenários T01, T02 e T06. Os consumidores repetem somente a prova de acesso específica de sua superfície.

**Execução PC-01 — 28/10/2026:** implementado por autorização do usuário nesta conversa; validação local concluída e revisão independente aprovada com ressalva. 82 testes da suíte e 2 do piloto passaram; fluxo visual desktop/tablet passou. Homologação SQL está pendente por ausência de instância local: teste isolado preparado, mas não executado. Sem migração de banco instalado ou deploy. Resultado e ativação: [PC-01-ACESSOS.md](PC-01-ACESSOS.md). QA solicitado posteriormente reexecutou 84 testes locais e o fluxo visual com sucesso; o aceite integrado permanece INCONCLUSIVO/BLOCKED por ausência de SQL Server local, conforme o registro Jetta QA no mesmo documento.

### PC-02 — Filiais e tipos de atividade

**Resultado:** ADM mantém as unidades e a lista global de tipos usados nas contratações.

**Escopo/delta:** ajustar cadastros existentes para filial com nome, endereço e código interno; tipo de atividade com nome, descrição opcional e situação. Listagem, criação, edição e desativação pelo ADM. Preservar referências e histórico em vez de excluir entidades utilizadas.

**Aceite observável:**

1. ADM cadastra/edita filial com os três campos definidos; gestor e financeiro não conseguem alterar esse cadastro.
2. ADM cria tipos de atividade compartilhados, disponíveis nas filiais; não há categoria de atividade obrigatória no prestador.
3. Filial ou tipo desativado deixa de ser opção para novo lançamento; registros anteriores continuam consultáveis e aptos à conclusão ou cancelamento explícito.
4. O endereço cadastrado fica disponível para o recibo sem exigir endereço do prestador.

**Dependências por etapa:** integração protegida requer autorização ADM de PC-01. Os contratos de identidade/situação de filial e tipo precisam estar disponíveis antes de integrar PC-03/PC-04; não esperar recibos para entregar o cadastro.

**Pendências locais:** unicidade/formatação do código interno pode ser resolvida no desenho do cadastro, sem presumir política nova. Formatação da localidade do recibo pertence a PC-09 e não bloqueia o cadastro do endereço.

**Verificação focal:** API e SQL isolado para persistência, permissão e preservação das referências; conferir formulários e seleção de itens ativos. Exercitar a conclusão de registro preexistente após desativação na integração com PC-04.

**Rastreabilidade:** histórias 6–7 e 20–21; T07 na parte de tipo/filial.

**Execução PC-02 — 28/10/2026:** implementação local concluída por autorização do usuário. Filial com endereço e tipo global com descrição opcional; manutenção ADM com MFA, auditoria e controle de edição concorrente; histórico de atividades preservado após inativação e novos lançamentos limitados a ativos. 92 testes da suíte e 2 do piloto passaram; UI real com API sintética passou em desktop/tablet/celular. Revisão independente aprovada com ressalva. Homologação SQL pendente (teste descartável preparado, executado como SKIP por ausência de instância local); conclusão/cancelamento após inativação permanece integração obrigatória com PC-04, sem aceite presumido. LAD não executado (servidor desabilitado); Serena sem ferramentas na sessão. Sem migração do banco instalado ou deploy. Resultado, ativação e limites: [PC-02-CADASTROS.md](PC-02-CADASTROS.md). QA posterior com a skill Jetta QA reexecutou 94 testes locais com sucesso e o fluxo visual headless em 3 formatos; nenhuma falha observada nesse recorte. Aceite integrado permanece INCONCLUSIVE/BLOCKED: integração SQL executada como SKIP por falta de instância local, e conclusão/cancelamento pós-inativação depende de PC-04. Registro por persona no mesmo documento.

### PC-03 — Prestadores e vínculos com filiais

**Resultado:** cada CPF identifica um único prestador da empresa, reutilizável nas filiais autorizadas sem perder histórico.

**Escopo/delta:** adaptar cadastro, busca, edição e vínculo múltiplo existentes. Nome completo/CPF obrigatórios, telefone/CNPJ opcionais, ao menos uma filial na criação; correção de CPF e desativação só por ADM. Permitir remover todos os vínculos posteriormente, inclusive com pendências. Registrar autoria das alterações comuns.

**Aceite observável:**

1. Buscar CPF existente permite vincular o mesmo cadastro a outra filial autorizada, sem duplicá-lo, inclusive sob tentativas concorrentes.
2. Gestor edita dados comuns com histórico, mas não corrige CPF, desativa ou impõe bloqueio local ao prestador; ADM pode corrigir CPF sem violar unicidade.
3. Cadastro inicial sem nome, CPF ou filial é recusado; telefone/CNPJ podem permanecer vazios. Não exigir endereço ou dados bancários.
4. Gestor adiciona/remove somente vínculos das próprias filiais; o último vínculo pode ser removido, preservando cadastro e busca por CPF.
5. Remoção com pendências não apaga nem oculta contratações anteriores daquela filial. Desativação impede novos lançamentos, sem impedir conclusão dos existentes.

**Dependências por etapa:** contratos de escopo de PC-01 e identidade de filial de PC-02 para integrar cadastro/vínculos. A prova de preservação de pendências usa o contrato de contratação de PC-04 quando disponível; o restante do cadastro não precisa esperar esse ticket terminar.

**Pendências locais:** nenhuma nova decisão de produto necessária para os campos confirmados. Não confundir desvinculação de prestador com revogação de acesso do gestor à filial.

**Verificação focal:** cadastro/busca/edição por API com SQL isolado, dois gestores e filiais distintas; cenário de CPF concorrente e remoção do último vínculo. Conferir busca e seleção na interface.

**Rastreabilidade:** histórias 10–19; T03–T05, T08 e parte de T07.

**Execução PC-03 — 28/10/2026:** implementação local pronta e QA local PASS, preservando PC-01/PC-02. Cadastro único por CPF, CNPJ/telefone opcionais, busca global exata, vínculos individuais por filial autorizada, remoção do último vínculo, autoria, controle de versão e correção/inativação ADM. Inclusão operacional exige pessoa ativa/vinculada; histórico consultável sem vínculo atual. Testes HTTP/serviço com transporte SQL controlado e UI headless passaram; revisão independente sem achados materiais. Aceite integrado INCONCLUSIVE/BLOCKED: prova SQL descartável executada como SKIP por ausência de instância local; conclusão/cancelamento após inativação depende de PC-04. Serena ativada com falha no language server por npm ausente; LAD indisponível, sem aprovação. Sem migração do banco instalado ou deploy. Resultado e evidências: [PC-03-PRESTADORES.md](PC-03-PRESTADORES.md).

### PC-04 — Contratação individual e conferência

**Resultado:** gestor ou ADM registra um acordo individual, confere o serviço e libera um valor autorizado ao financeiro.

**Escopo/delta:** mapear atividade/participação existentes para a experiência de uma contratação por prestador, sem presumir recriação física de todas as tabelas. Adaptar formulário, consulta e ações; persistir número global de contratação independente do recibo, filial, prestador, tipo, data, horários previstos/reais, valor e responsáveis. Incluir horários manuais justificados, conferência, revisão antes do pagamento e cancelamento não pago. Disponibilizar às etapas seguintes o histórico de liberação/revisão com datas e valores.

**Aceite observável:**

1. Gestor ou ADM cria contratação para um único prestador vinculado à filial autorizada, seleciona tipo e informa data, entrada/saída previstas e valor. Não existe exigência de vencimento/prazo de pagamento.
2. Número automático global é persistido, único sob concorrência e não reutilizado após cancelamento; não reinicia por filial ou ano.
3. Horários reais podem ser preenchidos manualmente com motivo/autor; sem entrada e saída reais a conferência não libera para pagamento. Diferença de horas não altera automaticamente a diária.
4. Conferir libera exatamente o valor validado, preserva a data do serviço e registra a data de liberação; financeiro não executa alterações operacionais.
5. Alterar valor já liberado e ainda não pago exige justificativa, retira sua disponibilidade para baixa e requer nova conferência. Cancelar antes do pagamento preserva histórico e remove a obrigação aplicável.

**Dependências por etapa:** implementar sobre contratos de filiais/tipos de PC-02, prestadores/vínculos de PC-03 e autorização de PC-01. Contratos de identificação/estados/horários são fornecidos a PC-05; liberações e revisões fornecem origem para PC-08/PC-11. A integração do bloqueio de limite requer PC-06 e a do alerta requer PC-07, sem exigir que esses tickets estejam fechados para trabalhar no formulário e nos registros manuais.

**Decisões confirmadas durante a execução — 28/10/2026:** uma contratação por prestador/data em toda a empresa; saída no dia seguinte permitida. Gestor responsável escolhido no cadastro, com criador e conferente separados. Registros cancelados preservam a ocupação da data e a numeração; criação verifica também participações legadas. P01 é tratado em PC-06; P06 em PC-10. Serviços multidiários além do dia seguinte e sua contagem não foram definidos. Não declarar o fluxo completo liberado enquanto faltar regra necessária ao cenário em uso.

**Verificação focal:** fluxo de criação → horário manual → conferência → revisão/cancelamento pela API com SQL isolado, autorização e unicidade concorrente. Conferir formulário e consulta em computador/tablet/celular. Integrar uma vez as permissões de novos lançamentos após desativação/desvinculação.

**Rastreabilidade:** histórias 22–24, 37–41 e 55; T09, T10, T20–T23 e T37. A invalidação do token manual é integrada em PC-05; efeitos financeiros de revisão/cancelamento em PC-10/PC-11.

**Execução PC-04 — 28/10/2026:** implementação local pronta por autorização do usuário, com smart-orchestrator. Contratação individual, responsável escolhido explicitamente, uma contratação por prestador/data global, saída no dia seguinte, numeração global, horários manuais justificados, conferência, revisão e cancelamento não pago, eventos/auditoria e paginação. 167 testes locais aprovados; UI real com HTTP sintético passou em desktop/tablet/celular; revisão independente sem achados materiais após correções. Aceite integrado INCONCLUSIVE/BLOCKED: SQL descartável executado como SKIP por ausência de instância local. Serena ativada, símbolos indisponíveis por ausência de language server; LAD indisponível, sem aprovação. Sem migração do banco instalado ou deploy. Resultado, ativação e evidências: [PC-04-CONTRATACOES.md](PC-04-CONTRATACOES.md). QA posterior solicitado com Jetta QA reexecutou 167 testes locais e o browser headless em três tamanhos: PASS local, sem falhas observadas. Aceite integrado permanece INCONCLUSIVE/BLOCKED: prova SQL executada como SKIP por falta de instância local. Casos por persona e limites registrados no mesmo documento.

### PC-05 — Tokens e página do tablet

**Resultado:** gestor gera códigos temporários e o prestador registra horários em uma página simples, sem login pessoal nem vínculo fixo do aparelho com filial.

**Escopo/delta:** adaptar a página de tablet e os códigos de apontamento existentes. Habilitação inicial por gestor/ADM, botões de geração de entrada/saída, validade de uma hora, substituição, consumo único, integração dos horários e respostas de aceitação/erro. Remover a exigência de pareamento por depósito/filial apenas dessa experiência, preservando a autorização de habilitação.

**Aceite observável:**

1. Prestador vê teclado numérico e confirmação; não acessa cadastro, financeiro ou dados administrativos. Após habilitação, o aparelho aceita token válido de qualquer filial sem seleção de unidade.
2. Gerar entrada/saída é ação do gestor/ADM autorizado na contratação. Por decisão explícita do usuário em 28/10/2026, saída somente pode ser gerada depois de usar o token de entrada e registrar o horário. Esta decisão substitui a regra anterior que exigia apenas geração da entrada.
3. Token identifica sem ambiguidade contratação, prestador, filial e ação; expira em uma hora, é de uso único e a substituição invalida imediatamente o anterior.
4. Aceite grava o horário no servidor uma única vez, inclusive sob duas requisições simultâneas, confirma e limpa a tela. Código inválido/usado/expirado/substituído não altera horários.
5. Registro manual de horário invalida o token correspondente e mantém origem/autor/motivo. Sem envio de WhatsApp pelo aplicativo.

**Dependências por etapa:** contrato de identidade, estado e atualização de horário de PC-04 e habilitação autenticada de PC-01. Integrar a decisão de exceção de PC-06 antes de disponibilizar tokens para contratações que excedam limite; fluxo normal e interface podem ser desenvolvidos antes disso.

**Decisão P03 e desenho técnico:** usuário confirmou entrada registrada antes do consumo da saída e depois tornou obrigatório usar o token de entrada antes de gerar saída. Horário exclusivamente manual não substitui o uso do token para essa geração. Pareamento aleatório de 256 bits, cinco minutos, uso único; sessão de oito horas revogável, sem filial, com revalidação do emissor. Tokens numéricos de quatro dígitos armazenados como HMAC, reservados globalmente até expirar e reutilizáveis depois, preservando histórico; cinco falhas invalidam a sessão para apontamentos e exigem nova habilitação. Reentradas e intervalos não têm regra aprovada.

**Verificação focal:** adaptar testes existentes de códigos, provar consumo concorrente e fronteira de uma hora com tempo controlado mais persistência SQL; testar tablet habilitado, resposta/limpeza e duas filiais. Revalidar apenas os controles de acesso atingidos pela retirada do vínculo do aparelho.

**Rastreabilidade:** histórias 30–38; T15–T20 e interface específica do tablet.

**Execução PC-05 — 28/10/2026:** implementação local pronta com smart-orchestrator e TDD RED/GREEN. Geração/substituição, entrada usada antes de gerar saída, consumo único, expiração, horários TOKEN sem alterar diária, invalidação manual/cancelamento e tablet sem filial. Gestão com MFA/escopo, pareamento e sessão separados, revogação e proteção contra tentativas. Interface validada em 1440/768/390 e regressão PC-04 aprovada; revisão independente por subagente sem achados materiais. Homologação integrada INCONCLUSIVE/BLOCKED: SQL real executado como SKIP por ausência de instância local. LAD indisponível, sem aprovação; Serena ativada, símbolos indisponíveis. Sem migração do banco instalado, commit, push ou deploy. Integração da regra de limite continua em PC-06; não declarar operação integral de produção liberada. Evidências, ativação e limites: [PC-05-TOKENS.md](PC-05-TOKENS.md).

**Jetta QA PC-05 — 28/10/2026:** PASS local, 207 testes aprovados e fluxo do tablet headless em três larguras; nenhuma falha encontrada ou correção necessária. Gestor autorizado/alheio, financeiro, tablet, anônimo, perfil misto e negativos de MFA/token cobertos nos limites controlados descritos em [PC-05-TOKENS.md](PC-05-TOKENS.md). Aceite integrado permanece INCONCLUSIVE/BLOCKED: prova SQL executada como SKIP por ausência de instância local. Autenticação, persistência e concorrência SQL reais não homologadas; LAD permanece indisponível.

### PC-06 — Limite de utilização e exceções

**Resultado:** sistema conta utilização global, avisa antes do limite e submete novas contratações excepcionais à decisão do ADM.

**Escopo/delta:** adaptar políticas de limite e exceções existentes às regras que o usuário confirmar. Contagem por prestador em toda a empresa, aviso cinco unidades antes, contratação excepcional sem liberação automática, decisão ADM rastreável e integração com autorização de tokens.

**Aceite observável, após resolver as pendências:**

1. A contagem considera todas as filiais na unidade, janela e estados definidos, sem duplicação por edição/reconferência.
2. O aviso aparece cinco unidades antes do limite real; o exemplo 45/40 não vira parâmetro fixo.
3. Ao atingir limite, o gestor não libera contratação normal; insistir produz solicitação de exceção ao ADM.
4. Apenas ADM aprova/rejeita e a contratação excepcional não prossegue como autorizada sem a decisão exigida. Histórico registra atores, decisão e justificativas aplicáveis.
5. O gestor recebe o aviso/resultado necessário sem ganhar acesso ao histórico de serviços de outras filiais.

**Dependências por etapa:** P01 e a parte de P02 que altera contagem precisam de resposta antes da fórmula e dos testes. Para integrar, usar prestador único de PC-03, estados de PC-04 e pontos de geração de token de PC-05. Nenhum outro ticket precisa aguardar o fechamento deste para desenvolver partes independentes.

**Pendências locais:** limite, janela, unidade, estados contados, reinício, repetição no mesmo dia e validade/rejeição/edição da exceção. Este ticket está dependente dessas decisões; não propor número como se já tivesse sido aprovado.

**Verificação focal:** exemplos de contagem no marco de aviso, no limite e após a janela com dados de duas filiais; chamadas de solicitação/aprovação/rejeição por papéis distintos e tentativa de gerar token antes da autorização. Teste de função pode cobrir a fórmula; SQL/API deve cobrir escopo global e autorização.

**Rastreabilidade:** histórias 27–29; T11–T12 e integração da autorização de tokens.

### PC-07 — Alerta de valor acima da média

**Resultado:** gestor recebe comparação útil ao informar o valor, sem bloquear a contratação por preço.

**Escopo/delta:** integrar consulta de média ao formulário de contratação, reutilizando dados de serviços conferidos. Filtrar pelo mesmo tipo e filial, mostrar média/amostra ou ausência de base. Não criar categoria no prestador nem aprovação ADM por valor.

**Aceite observável:**

1. Contratações de outras filiais/tipos e ainda não conferidas não entram na base; a própria contratação não distorce a comparação conforme proposta técnica da especificação.
2. Qualquer valor acima da média aplicável exibe aviso com média e quantidade usada, permitindo prosseguir.
3. Abaixo do mínimo aprovado, aparece “Sem base para comparação”, sem tratar média como zero.
4. A seleção temporal/amostral reproduz a decisão final sobre 90 dias, mínimo inicial de cinco e evolução para os últimos 20, sem misturar fórmulas incompatíveis.

**Dependências por etapa:** contrato de contratações conferidas de PC-04 para consulta e integração no formulário. P05 resolvida pelo usuário nesta execução; a consulta usa os registros nativos PC-04 e seu estado corrente, sem importar automaticamente participações legadas ambíguas.

**Decisões locais confirmadas:** P05 resolvida conforme regra acima. Revisão/cancelamento PC-04 retiram o registro da base até nova conferência; pagamento conserva elegibilidade. Alterações futuras de estado em PC-10 precisam preservar esse contrato.

**Verificação focal:** conjunto pequeno e calculável de valores, filtros por tipo/filial/estado, fronteiras da amostra/janela e presença do aviso sem bloqueio no formulário. Evitar repetir todo o fluxo financeiro para testar uma média.

**Rastreabilidade:** histórias 25–26; T13–T14.

**Execução PC-07 — 28/10/2026:** implementação local concluída por autorização do usuário com smart-orchestrator e TDD RED/GREEN. P05 confirmada durante a execução. Consulta read-only GET `/api/pc04/media` integrada ao gate PC-04, com autorização operacional por filial e sem ampliação pelo perfil financeiro acumulado. Usa ValorLiberado corrente, amostra determinística e comparação exata em centavos antes do arredondamento da média exibida. Criação e revisão exibem média/amostra, ausência de base e erro técnico distintos; aviso e falha de consulta permitem prosseguir. Respostas antigas são descartadas após mudança de contexto, navegação e logout. Não exige schema/flag adicional. Preservadas as alterações anteriores PC-01–05; sem migração de banco instalado, commit, push ou deploy.

**Jetta QA PC-07 — 28/10/2026: PASS local; aceite integrado INCONCLUSIVE/BLOCKED.** Provas executadas sobre o candidato local com Node, Express, ODBC controlado e Edge headless existentes:

- `node --test tests/pc07.test.mjs` — RED inicial por rota ausente (404); GREEN **23 PASS** com HTTP/serviço de produção e transporte ODBC controlado. Gestor/ADM permitidos; gestor alheio, financeiro isolado, perfil misto fora da filial, revogado e anônimo negados. Entradas inválidas, contexto de revisão forjado, base 0/4/5/20, zero válido, igualdade/abaixo/acima, fração da média e valores grandes cobertos. Não certifica seleção SQL real.
- `node scripts/test-all.mjs` — **228 PASS**, incluindo PC-01–05 e PC-07. `node --test pilot-local/unit.test.mjs integration/pc07.integration.mjs` — **2 PASS e 1 SKIP**. Total: **230 testes locais aprovados**, sem falhas; SQL SKIP não é aprovação.
- `node integration/pc07.visual.mjs` — RED por ausência do estado de comparação; GREEN **PASS**, 15 consultas e três gravações. Criação/revisão acima permitidas, igualdade/abaixo, troca tipo/filial/data, valor inválido, sem base, falha técnica, resposta atrasada e logout. UI de produção com HTTP sintético em 1440/768/390. Capturas `artifacts/pc07/average-{1440,768,390}.png`; captura 390 inspecionada por agente implementador e principal, aviso/botão legíveis sem corte. Sem certificação de autenticação SQL.
- `node integration/pc04.visual.mjs` — **PASS**, sete gravações e três larguras; regressão executada pelo agente da UI. `node scripts/check-all.mjs` — **624 arquivos, zero falhas**. `git -c core.whitespace=cr-at-eol diff --check` — **PASS**.
- Revisão independente por subagente GPT-6.1 Sol medium: backend, autorização, precisão, SQL, UI e testes revisados, **sem achados materiais**, 23 testes PC-07 reexecutados. Principal realizou revisão própria e QA. Serena ativada; consulta de símbolos falhou por ausência de language server. LAD `system_design_review`/`code_review` indisponíveis: servidor desabilitado por credencial pendente conforme `C:/Users/Jetta/.codex/mcp-setup/README.md`. Nenhuma chamada/revisão/aprovação LAD bem-sucedida; revisão por subagente não a substitui.

**Condição de retomada:** executar `integration/pc07.integration.mjs` com `PC07_SQL_TESTS=YES` e `PC07_SQL_SERVER=localhost` ou instância local explícita. Teste preparado cria/remove apenas banco vazio aleatório `JETTA_CONTROL_B3_TEST_<12 hex>` e verifica autenticação, escopos, persistência/releitura, filtros, limites 90/91 dias, dia de referência/futuro, cinco/20/21 registros, desempate, pagamento e revisão/reconferência. Não há serviço SQL Server local disponível, portanto essa fronteira permanece não homologada. Ativar LAD exige credencial/configuração local e recarga das ferramentas. Requisitos/evidência de desenho: `.requirements/20261028T194459Z_pc07_media/REQUIREMENTS.md`.

### PC-08 — Painel financeiro, pagamentos e anexos

**Resultado:** financeiro consulta valores autorizados e registra entregas integrais de dinheiro por contratação ou por grupo do mesmo prestador.

**Escopo/delta:** adaptar módulos financeiros existentes e sua persistência de laboratório para o comportamento pedido em ambiente de validação isolado, sem produzir efeito monetário externo. Painel em aberto/pagos, filtros, itens de pagamento, data efetiva, usuário responsável, anexos e baixa atômica. Disponibilizar fatos de pagamento para extrato e referências para recibos.

**Aceite observável:**

1. Somente contratações conferidas/liberadas aparecem; cada linha mostra filial seguida de gestor, prestador, tipo, data e valor. Filtros por filial/prestador/período/situação; sem vencimento ou atraso.
2. Baixa individual quita o valor integral. Agrupamento permite várias contratações do mesmo prestador, inclusive de filiais diferentes para quem tem acesso, e rejeita prestadores misturados ou pagamento parcial.
3. Data efetiva passada é aceita se não anteceder o serviço; data futura é recusada. Registrar também a data da ação e o usuário; para grupo, cada item respeita a validação de data.
4. Duas baixas concorrentes não quitam duas vezes o mesmo item. Alteração/reconferência concorrente não permite pagar silenciosamente um valor desatualizado.
5. Anexos obedecem à decisão final de P04, aceitam formatos variados e só são consultáveis por usuários autorizados. Baixa e evidência obrigatória, quando aplicável, não podem ficar incoerentes por falha no registro.
6. Financeiro não muda valor contratado, cadastra prestador nem cria contratação; não executa transferências ou entrega dinheiro pelo software.

**Dependências por etapa:** PC-04 fornece elegibilidade, versão/valor liberado, responsáveis e datas. Anexos/referências precisam ser persistidos antes do aceite da baixa que os exija. Recibos de PC-09 são integração documental, não condição para implementar consulta/seleção de pagamentos; geração de recibo não efetua baixa.

**Decisão P04:** usuário confirmou anexo obrigatório por contratação em 28/10/2026, incluindo cada item agrupado. Implementação aceita um arquivo de qualquer formato por item, até 1 MiB, e até 10 contratações por baixa (10 MiB de conteúdo). Bytes ficam no SQL e download é protegido, forçado como attachment/octet-stream, sem execução. Gestor exibido é GestorResponsavelId de PC-04.

**Verificação focal:** fluxo autenticado com SQL isolado de lista → seleção → anexo aplicável → baixa, incluindo concorrência, dois prestadores, filiais distintas e datas-limite. Conferir interface em aberto/pagos e filtros; não conectar a serviços de pagamento reais.

**Rastreabilidade:** histórias 42–49 e 55; T02, T27–T32 e T38. T28 é concluído com recibos de PC-09; T36 com projeção restrita de PC-11.

**Execução PC-08 — 28/10/2026:** candidato implementado e integrado ao checkout, preservando trabalho anterior. Painel nativo em Pagamentos para configuração pc08, filtros e paginação, seleção do mesmo prestador entre filiais, baixa integral com data efetiva, versão/valor esperados, MFA recente e um anexo por contratação. Pagamento/itens/anexos/auditoria e marca PC-04 compartilham transação e applock PC04; unicidade do item protege duplicidade. Schema aditivo 27-pc08-payments.sql incluído no instalador; banco instalado não foi migrado. Configurações antigas mantêm pc08 desligado até provisionamento explícito. Recibos PC-09 e estornos PC-10 não foram antecipados.

**Verificação jetta-qa:** node --test tests/pc08.test.mjs: 26 PASS (HTTP/serviço reais, ODBC controlado), personas financeiro/ADM autorizados pelo predicado, gestor/sem sessão negados; anexos inválidos/ausentes, datas, grupo multi-filial, prestadores misturados, parcial, versão/valor obsoletos, já pago, lock/MFA recusados, rollback e download inerte. node scripts/test-all.mjs (checagem final): 254 PASS e 1 FAIL externo ao PC-08: tests/pc09.test.mjs foi criado durante a execução por trabalho concorrente e importa src/pc09-routes.js ainda ausente. A suíte anterior, antes desse teste externo e da ampliação focal PC08, teve 246 PASS/zero falhas. node scripts/check-all.mjs: 631 arquivos sem erro de sintaxe. node integration/pc08.visual.mjs: PASS, shell/DOM reais com HTTP sintético, seleção/arquivos/total/baixa/pagos/filtros/conflito, 1440/820/390 px e troca de sessão durante MFA/leitura. Capturas em artifacts/pc08; inspeção de pixels mobile confirmou hierarquia, campos, arquivos, seleção e botão acessíveis, tabela com rolagem horizontal local. Teste visual reproduziu perda de arquivo ao selecionar segundo item e passou após correção. Revisão independente por subagente GPT-6.1 Sol/medium encerrou achados de reset de sessão e acionamento MFA após correções e reexecução.

**Limites de aceite:** SQL real BLOCKED, não aprovado: node --test integration/pc08.integration.mjs: 1 SKIP, requer PC08_SQL_TESTS=YES e PC08_SQL_SERVER local explícito. Conexão de diagnóstico localhost falhou 08001/HYT00 (servidor inacessível/timeout), sem serviço SQL local detectado. Teste descartável preparado cobre sessões autenticadas, baixa multi-filial, persistência/download, concorrência baixa/baixa e baixa/revisão, rollback por falha real de trigger. Atomicidade/concorrência reais permanecem sem certificação até executá-lo. LAD indisponível: README local registra servidor desabilitado por credencial ausente; não houve system_design_review nem code_review LAD. Serena ativada; símbolos indisponíveis por language_servers vazio. Revisão própria e por subagente não substituem LAD. Registro TDD e contratos: .requirements/20261028T180000Z_pc08_payments/REQUIREMENTS.md. Sem migração do banco instalado, push, deploy ou pagamento externo.

### PC-09 — Recibos numerados e impressão

**Resultado:** cada contratação autorizada gera um recibo numerado conforme o modelo, imprimível sem baixar o pagamento.

**Escopo/delta:** adaptar emissão/arquivos já existentes ao documento de referência. Sequência global de recibos independente da contratação, campos automáticos, campos manuais em branco, localidade da filial, reimpressão e associação individual mesmo em pagamentos agrupados.

**Aceite observável:**

1. Recibo usa empresa/CNPJ confirmados, valor numérico/por extenso, serviço/data e localidade derivada do endereço da filial; não fixa Sumaré para todas as unidades.
2. Nome por extenso do recebedor, CPF e assinatura ficam em branco para preenchimento à mão, sem confundir nome com valor monetário por extenso.
3. Número global independente é persistido no banco, não reinicia por filial/ano nem é reutilizado; emissão concorrente não cria duplicações indevidas e reimpressão preserva o número.
4. Emitir antes da entrega não altera saldo nem situação de pagamento. Cada contratação mantém seu próprio recibo, ainda que integre baixa agrupada.
5. Documento impresso respeita o modelo, sem texto cortado ou campos manuais inutilizáveis; versões anteriores continuam identificáveis conforme a regra final de correção.

**Dependências por etapa:** contrato de contratação autorizada de PC-04 e endereço de PC-02. Associação a pagamentos agrupados integra com PC-08 sem exigir sua conclusão para produzir a impressão. Cancelamento/substituição após correção se integra com PC-10.

**Pendências locais:** P07 e formatação da localidade a partir do endereço. Não preencher uma data suposta no recibo emitido antes do pagamento nem inventar política de nova assinatura.

**Verificação focal:** emissão/reimpressão concorrente com SQL isolado; conferir que imprimir não baixa. Renderizar e comparar visualmente o documento com o modelo, cobrindo ao menos duas localidades, valores por extenso e campos manuais.

**Rastreabilidade:** histórias 50–53 e parte de 62; T24–T26 e parte de T28.

### PC-10 — Correções, estornos e ajustes financeiros

**Resultado:** erros operacionais e financeiros são corrigidos sem apagar pagamentos, valores originais ou documentos anteriores.

**Escopo/delta:** integrar revisões de contratação de PC-04 ao pagamento de PC-08, implementar estorno justificado de baixa e ajustes por alteração/cancelamento após pagamento. Manter identidade e rastreabilidade de recibos anteriores e publicar movimentos compensatórios ao extrato. A revisão anterior ao pagamento já pertence a PC-04; aqui se completa seu efeito financeiro.

**Aceite observável:**

1. Somente gestor autorizado ou ADM altera valor contratado, sem exigir aprovação superior adicional; financeiro pode registrar o estorno de sua operação conforme as permissões financeiras.
2. Estorno exige justificativa, preserva a baixa original e seu autor/data e produz o efeito compensatório correto, sem duplicar a reversão sob concorrência.
3. Revisão ou cancelamento de contratação liberada e não paga remove a elegibilidade anterior e gera ajuste rastreável; uma reconferência não duplica a obrigação.
4. Correção após pagamento conserva contratação/valor/pagamento anteriores e demonstra diferença a pagar ou devolver segundo P06, sem baixa fictícia ou apagamento do dinheiro entregue.
5. Recibo anterior permanece identificável; substituição/cancelamento e necessidade de assinatura obedecem a P07. Ajustes alimentam saldo e permitem consulta de origem.

**Dependências por etapa:** contratos de revisão/liberação de PC-04 e pagamento/itens de PC-08 para código e integração; PC-09 para o efeito documental. PC-11 consome os movimentos produzidos, sem determinar as regras de correção. Não há dependência circular de implementação.

**Decisões confirmadas em PC-10 — 28/10/2026:** P06: registrar diferença integral a pagar/devolver e regularizá-la em operação separada, com data efetiva e comprovante. P07: preservar o original, marcá-lo cancelado/substituído e exigir nova assinatura no substituto. Não recalcular o valor pelos horários nem apagar o dinheiro entregue.

**Execução PC-10 — 28/10/2026:** candidato integrado ao checkout, com movimentos de liberação/retirada/baixa/estorno/quitação/devolução, saldo por contratação, correção após pagamento, estorno do grupo pelo autor financeiro ou ADM, MFA e comprovante para regularização. Schema aditivo 28-pc10-adjustments.sql remove a constraint antiga que impedia estados revisados/cancelados pagos; banco instalado não foi migrado. Flag pc10 é explícita; em banco com ledger provisionado, PC04/PC08 recusam gravação com a flag desligada para impedir perda de escrituração. Original PC08 e seus anexos permanecem preservados; seu indicador PagoEmUtc representa a baixa original, e o painel Correções e ajustes demonstra o saldo atualizado.

**Validação/limitações PC-10:** TDD red por módulo ausente e green HTTP/ODBC controlado, com ADM, financeiro autor/outro, gestor no escopo/fora, inativo, MFA, validação, rollback e versão/saldo obsoletos; testes headless de painel e shell real com HTTP sintético em 1440/820/390. Revisão independente por subagente identificou constraint incompatível e risco de desligar a flag; ambas as causas corrigidas e rerevisadas. Persistência/concorrência SQL real BLOCKED: conexão localhost falhou 08001/HYT00 e não há instância local inventariada; integração opt-in em integration/pc10.integration.mjs. LAD BLOCKED: inicialização real rejeitada por ausência de credencial; system_design_review/code_review não executados. Integração documental BLOCKED: módulos PC09 ausentes; PC10 publica estado de invalidação por contratação/versão, aplicável aos documentos até essa versão, mas não substitui a implementação da emissão/reimpressão original e do substituto com nova assinatura. PC-10 não está integralmente aceito enquanto esses gates permanecerem pendentes.

**Verificação focal:** sequência liberação → revisão → reconferência, baixa → estorno e baixa → correção/cancelamento, com SQL isolado e concorrência nos pontos de duplicação. Reconciliar valores originais, ajustes e documentos sem testar detalhes internos do armazenamento.

**Rastreabilidade:** histórias 40–41, 54–55 e 59; T23, T33–T34 e T37.

### PC-11 — Extrato do prestador e exportação

**Resultado:** usuários autorizados consultam valores a receber, pagamentos e ajustes por prestador, com saldo explicável e exportável.

**Escopo/delta:** implementar a tela de extrato sobre os fatos persistidos das contratações/pagamentos, reaproveitando consultas e exportações existentes quando adequadas. Exibir movimentos, saldo anterior/final, totais pagos/em aberto, filtros por nome/filial/período e impressão/PDF. Consumir o histórico canônico; não criar segundo fluxo de baixa ou recalcular a diária pelos horários.

**Aceite observável:**

1. Valor a receber entra somente na data da liberação final; data do serviço permanece identificável. Baixa entra na data efetiva do pagamento, não na data da contratação ou do clique.
2. Cada movimento mostra data, filial, gestor, tipo, contratação, recibo quando existente, valor e saldo; pagamento agrupado permite consultar todos os itens autorizados.
3. ADM/financeiro consultam todas as filiais; gestor vê e soma apenas as suas, inclusive ao consultar grupo com itens de várias filiais. O PDF e os anexos relacionados respeitam o mesmo escopo.
4. Filtros por nome do prestador, filial e período mantêm saldo anterior ao recorte, movimentos e saldo final conciliáveis, além dos totais pagos/em aberto.
5. Revisão, cancelamento, estorno e pagamento retroativo aparecem sem perder a origem e produzem saldos coerentes, inclusive quando datas de registro/efetivação diferem.
6. Impressão/PDF reproduz filtros, escopo e valores da consulta, com leitura adequada. Telas são utilizáveis em computador/tablet e adaptadas ao celular.

**Dependências por etapa:** contratos de liberação de PC-04 e pagamento de PC-08 permitem desenvolver consulta básica; PC-10 fornece ajustes/estornos e PC-09 referências de recibos para completar a integração. A conclusão integral deste ticket exige verificar esses fatos juntos, sem que isso bloqueie a implementação anterior de filtros e apresentação.

**Pendências locais:** resolver tecnicamente ordenação/desempate, datas efetivas versus registro e recomposição por eventos retroativos. Para casos de diferença a devolver e recibo substituído, consumir P06/P07 resolvidas em seus tickets de origem, sem definir políticas novas nesta tela.

**Execução PC-11 — 28/10/2026:** candidato implementado e integrado neste checkout, autorizado pelo usuário com smart-orchestrator e validado com jetta-qa. Extrato nativo somente leitura do ledger PC10, com filtros por nome/código do prestador, filial e período; saldo anterior/final, pagos líquidos no período e valores em aberto/a devolver até o fim do recorte. Movimentos ordenados por data efetiva, registro UTC e ID, preservando data do serviço e recompondo pagamentos retroativos. Cálculos em centavos inteiros; grupos e comprovantes PC08/PC10 limitados no servidor pelas filiais autorizadas do gestor. ADM/financeiro têm escopo global. Não cria baixas, presume recibos ou recalcula diária. Tela responsiva e impressão/salvar PDF preservam os dados e filtros da consulta concluída. Limite explícito de 10.000 movimentos históricos, sem truncamento silencioso. Flag pc11 explícita exige pc04/pc08/pc10; instalações antigas permanecem desativadas até configuração própria. Sem nova migration ou alteração do banco instalado.

**QA PC-11:** TDD red por módulo/painel ausentes e green. `node --test tests/pc01.test.mjs tests/pc04.test.mjs tests/pc08.test.mjs tests/pc10.test.mjs tests/pc11.test.mjs integration/pc10.integration.mjs`: 120 PASS, zero falhas e uma integração SQL SKIP. PC11 cobre ADM, financeiro, gestor, anônimo/inativo, filtros inválidos, consulta/grupo/anexo fora do escopo, datas retroativas, revisão, estorno, saldo anterior sem movimentos no período, precisão decimal e comprovante inerte. Serviço/rotas reais com adaptador ODBC controlado; não certifica execução SQL. `node integration/pc11.visual.mjs`: PASS com shell real e HTTP sintético, consulta, filtros aplicados, grupo, anexos, XSS, erros, logout/resposta tardia, impressão/PDF e 1440/820/390. PDF extraído e capturas inspecionadas em artifacts/pc11. `node scripts/check-all.mjs`: 644 arquivos, zero erros de sintaxe; npm ausente do PATH, executado diretamente o script de check do package.json. Revisão independente por subagente encontrou interferência de impressão em outras telas; corrigida com preservação de hidden e página nomeada, testada e rerevisada sem achados materiais restantes.

**Aceite integral PC-11 BLOCKED:** SQL local indisponível (sondagem real localhost: 08001/HYT00; nenhum serviço SQL inventariado); jornada SQL existente de PC10 ampliada com extrato, duas filiais, grupo, comprovantes e estorno, mas não executada. LAD indisponível: tentativa real de inicialização falhou por ausência de credencial; system_design_review/code_review não executados, sem aprovação LAD. Integração PC09 pendente porque seus módulos/contrato de recibos persistidos não existem neste checkout; referências retornam indisponíveis explicitamente. Revisões própria e por subagente não substituem LAD nem SQL real. Requisitos/evidências em .requirements/20261028T201406Z_pc11_extrato/REQUIREMENTS.md. Sem push, deploy ou migração de dados reais.

**Verificação focal:** uma jornada integrada reutilizável com duas filiais, mesmo prestador, serviços/liberações/pagamentos em datas diferentes, baixa agrupada, revisão e estorno; conferir saldo por perfil e por período e o PDF correspondente. Essa jornada pode cobrir critérios de outros tickets ainda sem prova integrada, sem repetir testes equivalentes já válidos. Não declarar resultado antes de executar.

**Rastreabilidade:** histórias 56–62 e exportações restritas da história 8; T22, T27, T31, T33–T37.

### Cobertura e limites da fila

- Histórias 1–62 e cenários T01–T38 estão atribuídos acima. A repetição de referência indica integração compartilhada, não obrigação de executar o mesmo teste várias vezes.
- P01: PC-06. P02: PC-04/PC-06. P03: PC-05. P04: PC-08. P05: PC-07. P06: PC-10 e consumo em PC-11. P07: PC-09/PC-10 e consumo em PC-11. P08 permanece registro de proposta/autorização, sem criar um ticket de aprovação global.
- Não criar ticket separado só para escrever evidências ou instalar um controlador. Cada ticket registra uma vez sua verificação e limitações quando for executado.
- A fila descreve alterações de esquema pertinentes a cada capacidade, mas não autoriza migrar o banco instalado. Migração de dados reais, configuração de hospedagem e deploy precisam de pedido próprio e de seus contextos concretos.
- Registro da decomposição original: o pedido foi atendido com a separação documental, sem iniciar tickets ou resolver pendências por suposição. Posteriormente o usuário autorizou PC-01; sua execução e as limitações atuais estão registradas nesse ticket. Posteriormente o usuário autorizou PC-02, cujo resultado e limites estão registrados acima. Posteriormente o usuário autorizou PC-03, com implementação/QA e limites registrados acima. Posteriormente o usuário autorizou PC-04 neste checkout PORTAL CONTROL 2; resultado e limites registrados no ticket e em PC-04-CONTRATACOES.md. Posteriormente autorizou PC-05 e confirmou a ordem entrada usada antes de gerar saída; resultado local e limites registrados no ticket e em PC-05-TOKENS.md. Posteriormente autorizou PC-07 e confirmou P05; implementação e QA local registrados acima, com homologação SQL e revisão LAD pendentes. Posteriormente autorizou PC-08 e resolveu P04; candidato e QA local registrados acima, com homologação SQL e LAD pendentes. Posteriormente autorizou PC-10 e resolveu P06/P07 conforme registrado no ticket; candidato implementado com gates SQL/LAD/documental pendentes. Posteriormente autorizou PC-11, implementado e validado localmente com os gates SQL/LAD/PC09 pendentes registrados no ticket. PC-06 e PC-09 permanecem fora desta execução autorizada.

### QA global solicitado — 28/10/2026, 17:31 BRT

**Veredito: FAIL / aceite integral retido.** A premissa de 11 tickets implementados não corresponde ao checkout verificado: há candidatos de nove tickets, PC-06 permanece dependente de decisões e PC-09 tem testes/requisitos, mas não possui os módulos importados pelos testes. As aprovações abaixo se limitam à fronteira demonstrada; nenhuma delas homologa persistência SQL ou uma jornada completa com autenticação e banco reais.

Alvo: este diretório PORTAL CONTROL 2, HEAD `13c54f92606c49bb7f04269022a8d26d79252674` com alterações locais anteriores preservadas. Node v24.19.0, Windows, Edge headless e Playwright já disponível no runtime do Codex. Autorização: pedido do usuário para executar jetta-qa sobre o software completo. Nenhum código funcional foi alterado por esta auditoria. Fixtures sintéticas e servidores HTTP efêmeros de loopback; nenhum banco instalado foi migrado ou utilizado, nenhum envio externo, push ou deploy foi executado.

| Prova executada | Resultado desta rodada | Fronteira / evidência |
|---|---|---|
| `node scripts/test-all.mjs` | 301 PASS, 1 FAIL | Funções, rotas HTTP e serviços; nos novos módulos, ODBC controlado. `.requirements/qa-all-tests.log`. A falha é de carregamento de PC09, antes de executar seus casos. |
| `node --test pilot-local/unit.test.mjs integration/branch-edit.unit.test.mjs integration/final-lab.unit.test.mjs integration/mfa-enrollment-ui.unit.test.mjs` | 14 PASS | Guardas do piloto, estados e interação isolada. `.requirements/qa-support-tests.log`. |
| `node scripts/check-all.mjs` | 644 arquivos, zero erros de sintaxe | `.requirements/qa-check.log`; sintaxe não comprova resolução dos imports, conforme falha PC09. |
| Conferência SHA-256 de `pilot-local/sql/manifest.json` | 28 migrations, zero divergências | Arquivos conferidos contra o manifesto atual; não demonstra execução ou compatibilidade SQL. |
| `node --test` dos oito arquivos `integration/pc*.integration.mjs` | 0 PASS, 8 SKIP | `.requirements/qa-integration.log`; opt-in não habilitado após confirmação de indisponibilidade SQL. Não contabilizados como aprovação. |
| Sondagem ODBC de `master` em `localhost`, sem escrita | BLOCKED | `.requirements/qa-sql-probe.log`: estados 08001/HYT00/01S00/08001. Nenhum serviço SQL local encontrado; Driver 18 instalado. Não houve tentativa em servidor remoto. |
| `node integration/pc01.visual.mjs`, `pc02.visual.mjs`, `pc03.visual.mjs` | 3 PASS | UI real e HTTP sintético; execução final registrada em `.requirements/qa-visual-retry.log`. |
| `node integration/pc04.visual.mjs`, `pc05.visual.mjs`, `pc07.visual.mjs`, `pc08.visual.mjs`, `pc10-shell.visual.mjs`, `pc10.visual.mjs`, `pc11.visual.mjs` | 7 PASS | UI/painéis reais, HTTP sintético, asserções e capturas em `artifacts/pc04`, `pc05`, `pc07`, `pc08`, `pc10`, `pc11`. Saídas PASS observadas nas ferramentas desta conversa; o redirecionamento inicial do log desse lote falhou após as execuções, sem invalidar seus resultados. |

`npm` não está no PATH; foram executados diretamente os mesmos scripts Node declarados no package.json. Nos primeiros três roteiros visuais faltou informar `JETTA_PLAYWRIGHT_ROOT`; a segunda execução, com o caminho do runtime existente, passou. Esses erros de preparação não foram classificados como defeitos do produto e nenhuma dependência foi instalada.

Cobertura por ator e estado: ADM e financeiro autorizados conforme cada operação; gestor em filial autorizada e tentativas fora do escopo; perfil misto sem ampliação indevida; usuário inativo/anônimo, origem e MFA ausentes; prestador pela sessão separada do tablet. Os casos exercitados incluem cadastro/vínculo/desativação, contratação e preservação da diária, horários e conferência, tokens substituídos/consumidos/revogados, média e falta de amostra, baixa integral/grupo/anexos inválidos, conflito de versão/valor, rollback controlado, correção pós-pagamento, estorno, regularização e extrato com datas retroativas/saldos/escopo de comprovantes. Esses casos usam identidades e respostas SQL controladas; autenticação, autorização SQL persistida, atomicidade, locks e concorrência reais permanecem sem prova.

Os dez roteiros de interface cobrem desktop e tablet/celular conforme seus viewports: PC01 1440/1024/768; PC02–05 e PC07 1440/768/390; PC08/10/11 1440/820/390, além do roteiro do shell PC10. Incluem troca de sessão, erros e respostas tardias, seleção de arquivos, acesso às ações, impressão e PDF do extrato. Inspeção de pixels realizada nesta rodada em `artifacts/pc03/providers-1440.png`, `pc04/contracts-390.png`, `pc05/tablet-390.png`, `pc07/average-390.png`, `pc08/panel-390.png`, `pc10/panel-1440.png`, `pc11/panel-390.png` e `pc11/print.png`: campos e ações acessíveis, agrupamento legível e tabelas com rolagem local no mobile; impressão sem sidebar e com filtros/totais. Não é certificação de acessibilidade, auditoria de todos os estados visuais ou comparação contra baseline aprovado. O PDF usa fixture sintética.

| Achado / dependência | Evidência e impacto | Condição para aceite |
|---|---|---|
| QA-G01, P2, confirmado: PC09 ausente | `node scripts/test-all.mjs` falha com ERR_MODULE_NOT_FOUND em `src/pc09-routes.js`; `tests/pc09.test.mjs:5` também depende de `pc09-document.js`, ausente. Não há emissão/reimpressão nativa comprovada de recibo por contratação. | Concluir módulos, schema, rotas e UI PC09 e executar seus testes e provas SQL/impresso exigidos pelo ticket. Não remover o teste para obter suíte verde. |
| PC06 BLOCKED por definição/implementação pendente | O próprio ticket acima registra P01/P02 e ausência de regra final de limite/janela/estados/exceção. `public/pc04.js` informa que a verificação de limite não está disponível. Ausência não é homologada pelo legado B3. | Fechar decisões de negócio e implementar/testar o gate integrado na contratação e tokens. Não assumir limite 45 ou outra fórmula. |
| PC10/PC11 BLOCKED na integração documental | PC10 registra invalidação por versão, mas depende da emissão/substituição PC09. `src/pc11.js` retorna `integracaoRecibos: 'PENDENTE_PC09'`, com referência de recibo nula. Mesmo achado de origem QA-G01, sem duplicar a contagem de defeitos. | Validar recibo original, cancelado/substituído, nova assinatura e referências no extrato/grupo em conjunto. |
| Integração SQL BLOCKED | Sondagem real local falhou e oito jornadas opt-in não executaram. A integridade dos arquivos de migration e mocks aprovados não substituem essa fronteira. | Instância SQL Server local descartável acessível; executar os oito percursos existentes e as provas PC09 pendentes, com persistência/releitura, concorrência e limpeza. |
| Revisão LAD BLOCKED | Nenhuma ferramenta LAD exposta nesta sessão; README de `C:/Users/Jetta/.codex/mcp-setup/README.md` registra servidor desabilitado por ausência de credencial de provedor. | Disponibilizar LAD com credencial e executar realmente `system_design_review`/`code_review` quando aplicáveis. Nenhuma aprovação LAD foi presumida. |

Serena: instruções lidas e projeto ativado com sucesso; chamada real de `get_symbols_overview(src/server.js)` falhou porque não há language server ativo. A investigação complementar usou buscas e leitura focal. Revisão desta rodada é própria, sem subagente e sem revisão pelo LAD; os relatos históricos de outros tickets permanecem históricos.

Resultado por ticket: PC01/02/03/04/05/07/08 têm provas locais aprovadas, com aceite SQL retido; PC06 BLOCKED; PC09 FAIL; PC10/11 têm provas locais aprovadas, com aceite SQL/documental retido. A jornada completa dos onze tickets ainda não foi demonstrada. Não há aprovação global nem indicação de prontidão para produção.
