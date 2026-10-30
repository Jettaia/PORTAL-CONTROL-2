# Especificação do financeiro de contratações

Data: 30/10/2026.

Status: escopo funcional confirmado pelo usuário; documento para orientar a reconstrução. Esta entrega é somente documentação: não executa exclusões, alterações de código, banco, commit ou deploy.

Origem: entrevista sobre a reconstrução do financeiro do Portal Control. Destino local solicitado explicitamente pelo usuário: pasta `docs`, sem publicação em rastreador externo.

Precedência: esta especificação substitui as decisões financeiras anteriores que conflitem com ela, inclusive pagamento agrupado, data efetiva independente e restrição do financeiro aos depósitos vinculados. As regras de cadastro, contratação e liberação continuam sendo responsabilidade dos respectivos módulos.

## Problem Statement

O financeiro existente não corresponde ao fluxo imaginado pelo usuário. Há diferentes telas e gerações de regras para pagamentos, recibos, ajustes e extratos, tornando necessário reconstruir o módulo com um fluxo simples, exclusivo para pagamentos de contratações.

A equipe precisa identificar contratações liberadas, emitir um recibo individual com dados do sistema, realizar o pagamento fora do portal e guardar o recibo assinado como evidência da baixa. Financeiro e admin precisam operar todos os depósitos, enquanto o gestor acompanha somente o depósito ao qual está vinculado.

## Solution

Uma única tela financeira apresenta as contratações liberadas e permite filtrar as situações Aguardando pagamento, Recibo gerado e Pago. Não haverá abas separadas por situação.

O fluxo será: gestor/admin libera na contratação; a contratação aparece automaticamente como Aguardando pagamento; financeiro/admin gera e imprime o recibo individual; o pagamento e a assinatura ocorrem fora do portal; financeiro/admin anexa o recibo assinado e confirma o pagamento; o registro passa para Pago e permanece consultável na mesma tela.

Gerar o recibo não confirma pagamento. Enquanto estiver em Aguardando pagamento ou Recibo gerado, o valor continua pendente. A data de pagamento adotada pelo sistema é a data de emissão original do recibo, sem campo separado para informar a data efetiva.

## User Stories

1. Como gestor, quero que a liberação para pagamento na contratação alimente automaticamente o financeiro, para evitar lançamentos duplicados.
2. Como admin, quero liberar uma contratação pela tela de contratações, para disponibilizá-la ao financeiro pelo mesmo fluxo do gestor.
3. Como financeiro, quero consultar contratações liberadas de todos os depósitos, para centralizar o trabalho de pagamento.
4. Como admin, quero executar todas as operações do financeiro em todos os depósitos, para administrar o processo completo.
5. Como gestor, quero consultar somente o depósito vinculado ao meu usuário, para acompanhar a minha operação.
6. Como gestor, quero consultar recibos, anexos e histórico desse depósito sem alterar registros financeiros, para acompanhar a quitação.
7. Como financeiro, quero trabalhar em uma única tela, para consultar pendências e pagamentos concluídos sem alternar abas.
8. Como usuário autorizado, quero filtrar por situação, para localizar contratações aguardando pagamento, com recibo gerado ou pagas.
9. Como usuário autorizado, quero filtrar por depósito, para concentrar a consulta na unidade desejada dentro do meu acesso.
10. Como usuário autorizado, quero filtrar por prestador, para localizar suas contratações.
11. Como usuário autorizado, quero filtrar por período, para reduzir a consulta às datas de interesse.
12. Como usuário autorizado, quero buscar pelo número da contratação, para abrir rapidamente um registro específico.
13. Como financeiro, quero ver as pendências pela liberação mais antiga, para atender primeiro o que aguarda há mais tempo.
14. Como usuário autorizado, quero ver número, prestador, depósito, atividade, data do serviço, valor e data da liberação na lista, para reconhecer cada obrigação.
15. Como usuário autorizado, quero abrir os dados completos da contratação, para entender a origem do pagamento.
16. Como usuário autorizado, quero identificar quem liberou a contratação, para consultar a responsabilidade pela autorização.
17. Como financeiro, quero gerar um recibo por contratação, para documentar cada pagamento individualmente.
18. Como financeiro, quero que o recibo use o valor liberado, para manter correspondência com a contratação autorizada.
19. Como financeiro, quero que o recibo use o tipo de atividade e a data de execução, para identificar o serviço prestado.
20. Como financeiro, quero que o recibo use cidade/UF do depósito, para indicar o local correspondente à contratação.
21. Como financeiro, quero que o recibo use o nome completo cadastrado do prestador, para identificar o recebedor.
22. Como financeiro, quero que o recibo registre o dia em que foi gerado, para documentar sua emissão.
23. Como financeiro, quero imprimir o recibo com os demais campos em branco, para o prestador preenchê-los manualmente.
24. Como financeiro, quero reimprimir o documento preservando seus dados e data originais, para obter outra via do mesmo recibo.
25. Como financeiro, quero identificar a situação Recibo gerado sem considerar o valor quitado, para acompanhar o que ainda depende do documento assinado.
26. Como financeiro, quero anexar o recibo assinado e confirmar o pagamento integral, para concluir a baixa da contratação.
27. Como financeiro, quero que a baixa use a data de emissão do recibo como data do pagamento, para evitar preenchimento separado.
28. Como usuário autorizado, quero consultar o recibo assinado de uma contratação paga, para verificar sua evidência.
29. Como financeiro ou admin, quero desfazer uma baixa com motivo obrigatório, para corrigir uma confirmação indevida.
30. Como financeiro ou admin, quero substituir um anexo incorreto preservando o histórico, para corrigir o arquivo sem apagar a rastreabilidade.
31. Como usuário autorizado, quero consultar quem realizou as ações e quando, para acompanhar emissão, baixa e correções.
32. Como responsável pelo produto, quero substituir o financeiro antigo preservando contratações e cadastros, para iniciar o novo módulo com o escopo aprovado.

## Implementation Decisions

### Escopo e substituição do módulo

- Reconstruir o financeiro exclusivamente para contratações. Não ampliar o escopo para outras despesas ou recebimentos.
- O usuário confirmou começar do zero, incluindo zerar os registros financeiros antigos; não há requisito de manter o histórico do financeiro anterior na nova interface.
- Preservar contratações, prestadores, depósitos, tipos de atividade, usuários e vínculos operacionais.
- Na implementação, levantar dependências entre pagamentos, recibos, ajustes, extratos, navegação e marcadores de pagamento nas contratações. A substituição deve eliminar referências incompatíveis e não deixar contratações com baixa antiga sem registro correspondente no novo fluxo.
- Delimitar a limpeza aos dados financeiros antigos. A execução dessa limpeza não faz parte da entrega desta especificação.
- As contratações com liberação vigente devem alimentar a fila nova, sem exigir que o gestor faça uma segunda liberação apenas por causa da reconstrução.

### Perfis e autorização

| Perfil | Consulta | Operações financeiras |
|---|---|---|
| Financeiro | Todos os depósitos | Todas as ações deste escopo |
| Admin | Todos os depósitos | Todas as ações deste escopo |
| Gestor | Depósito vinculado ao usuário | Somente leitura |

- A leitura do gestor inclui detalhe, recibo emitido, recibo assinado e histórico, sempre dentro do vínculo autorizado.
- A restrição precisa valer na interface, nas consultas, nos detalhes e no acesso direto aos documentos e anexos.
- Gestor não gera recibo, confirma pagamento, desfaz baixa ou substitui anexo pelo financeiro.
- Financeiro não depende de vínculo com um depósito para operar esse depósito.
- Acesso amplo no financeiro não concede novas permissões para editar contratações ou cadastros de outros módulos.

### Origem da fila

- A fonte é a liberação para pagamento feita por gestor/admin na tela de contratações.
- Cada contratação liberada corresponde a um registro individual na fila, sem duplicação por nova consulta ou atualização de página.
- Valor, prestador, depósito, atividade e data do serviço vêm da contratação e dos cadastros relacionados, sem redigitação no financeiro.
- O valor financeiro é o valor vigente liberado. Horas trabalhadas não recalculam automaticamente esse valor.
- A elegibilidade acompanha a liberação vigente. A integração deve respeitar as revisões e cancelamentos já admitidos pelo módulo de contratações, sem criar neste escopo um fluxo novo de devolução para correção.

### Situações e transições

| Situação | Condição | Valor pendente | Ação principal |
|---|---|---|---|
| Aguardando pagamento | Contratação liberada sem recibo emitido | Sim | Gerar recibo |
| Recibo gerado | Recibo emitido, sem baixa confirmada | Sim | Anexar recibo assinado e confirmar pagamento |
| Pago | Baixa confirmada com recibo assinado anexado | Não | Consultar documento e histórico |

- A emissão não faz a baixa e não retira o valor das pendências.
- A baixa é integral e individual, para uma única contratação.
- A confirmação depende de recibo emitido e anexo do recibo assinado. O sistema exige o arquivo; não foi definido reconhecimento automático da assinatura.
- Desfazer a baixa exige motivo e devolve o registro à situação Recibo gerado, pois a emissão continua existindo. Esse retorno operacional decorre da preservação do recibo e deve constar no aceite da implementação.
- Substituir o arquivo de uma contratação paga preserva a situação Pago e registra a troca no histórico.
- Repetir uma confirmação já concluída não pode criar outro pagamento para a mesma contratação.

### Tela única

- Uma única tela/listagem, sem abas por situação.
- Filtros: situação, depósito, prestador e período; busca pelo número da contratação.
- O significado do filtro de período deve estar explícito na interface. Proposta de implementação: usar data do serviço como referência principal, sem confundi-la com emissão ou liberação; esse eixo não foi definido expressamente na entrevista.
- Ordenar pendências pela data da liberação mais antiga. Desempate técnico deve ser estável.
- Colunas: número da contratação, prestador, depósito, tipo de atividade, data do serviço, valor, data da liberação e situação.
- O detalhe reúne dados completos da contratação, responsável pela liberação, recibo emitido, recibo assinado e histórico das ações.
- Pagos permanecem consultáveis na mesma tela pelo filtro de situação; não há tela adicional de histórico nesta versão.
- Não foram aprovados indicadores, totais em cards, exportações ou relatórios adicionais como entregas obrigatórias.

### Recibo individual

- Utilizar o modelo fornecido pelo usuário como referência de conteúdo e apresentação, preservando o texto da empresa pagadora e a estrutura de declaração e campos.
- Empresa pagadora do modelo: JETTA TRANSPORTES E LOGISTICA LTDA, CNPJ 15.387.508/0001-61.
- Emitir um documento por contratação. Não agregar serviços ou pagamentos em um recibo coletivo.

| Campo do modelo | Preenchimento |
|---|---|
| Valor em R$ | Valor da contratação liberada |
| Valor por extenso entre parênteses | Manual após impressão |
| Prestação de serviço de | Tipo de atividade da contratação |
| Realizado na data | Data de execução do serviço registrada na contratação |
| Cidade/estado | Cidade/UF do depósito vinculado à contratação |
| Data após cidade/estado | Dia da geração original do recibo |
| Nome por extenso do recebedor | Nome completo do prestador no cadastro |
| Assinatura do recebedor | Manual após impressão |
| CPF do recebedor | Manual após impressão, mesmo que exista no cadastro |

- A cidade não fica fixa em Sumaré/SP: varia conforme o depósito.
- A data do serviço, a data de liberação e a data de emissão são conceitos distintos.
- A data de emissão usa o dia local da operação, com referência America/Sao_Paulo, evitando mudança de dia causada por formatação UTC.
- Reimpressão retorna o mesmo documento com a data original. Não atualizar a data pelo momento da consulta, impressão ou baixa.
- Preservar os dados usados na emissão para que alterações posteriores nos cadastros não modifiquem silenciosamente o documento já emitido.
- Não incluir preenchimento automático dos campos reservados ao prestador.
- O usuário considera a completude dos dados assegurada pelos módulos anteriores. Não criar nesta versão um fluxo financeiro de complementação cadastral ou uma nova etapa de bloqueio para essa hipótese. Dados inesperadamente inválidos não justificam inventar conteúdo no recibo.
- Numeração, caso usada na implementação, deve manter a identificação individual do documento; não foi definida uma nova política de numeração nesta entrevista.
- Não foi aprovado um fluxo separado de reemissão com novos dados ou nova data.

### Registro e correção do pagamento

- O pagamento ocorre fora do portal. O sistema registra a quitação; não executa Pix, transferência ou entrega de dinheiro.
- O único documento exigido para a baixa é o recibo assinado. Não exigir comprovante bancário adicional.
- O pagamento registrado corresponde ao valor integral liberado, sem edição para parcelas ou valores diferentes.
- A data de pagamento é a data original de emissão do recibo, inclusive quando o arquivo for anexado em outro dia.
- Registrar separadamente o instante real de confirmação no sistema e seu responsável, para auditoria. Esse instante não substitui a data de pagamento adotada pelo produto.
- Desfazer a baixa é uma correção do registro no portal; não movimenta dinheiro fora dele.
- Preservar histórico de emissão, confirmação, desfazimento com motivo e substituição de anexo. Não apagar a trilha das correções do novo módulo.
- Tipos de arquivo e limites de tamanho são escolhas técnicas de implementação ainda não fixadas. Devem permitir um recibo digitalizado legível e respeitar a segurança de upload e acesso.

### Integração e consistência técnica

- Reutilizar autenticação, identidade do usuário, vínculos com depósitos e auditoria existentes, adaptando a autorização financeira ao novo escopo global de financeiro/admin.
- Substituir os comportamentos antigos de pagamento e recibos que conflitem com esta especificação. Ajustes e extratos antigos não podem impor novas etapas ao fluxo aprovado.
- Persistir o vínculo contratação–recibo–baixa–anexo e garantir que a listagem e o detalhe reflitam a mesma situação.
- Confirmar pagamento, registrar evidência e atualizar o estado como uma operação consistente. Falhas não podem deixar a contratação paga sem recibo anexado.
- Tratar ações concorrentes e reenvios sem duplicar recibos ou pagamentos e sem perder o histórico.
- Os contratos concretos de API e o desenho das tabelas serão definidos durante a implementação, aproveitando a infraestrutura existente. Esta especificação não obriga criar uma nova camada arquitetural.

## Testing Decisions

Proposta técnica de verificação; as ferramentas e fronteiras abaixo não foram submetidas a uma rodada separada de aprovação. A entrevista aprovou o comportamento funcional, não um desenho interno de testes.

- Priorizar o fluxo pela interface HTTP autenticada existente como fronteira principal: liberar contratação, consultar fila, emitir recibo, obter impressão, anexar documento, confirmar e desfazer baixa.
- Testar comportamento observável: registros visíveis, documentos retornados, situações, valores, datas, autorização e efeitos persistidos. Evitar testes que apenas reproduzam a ordem interna de consultas SQL.
- Usar testes integrados com persistência para provar consistência e isolamento; mocks existentes ajudam em erros e validações, mas não substituem a prova de persistência.
- Aproveitar os precedentes de testes de contratações, pagamentos, recibos e extratos, ajustando expectativas antigas que contradigam esta especificação. São precedentes de ferramentas, não autoridade para restaurar regras antigas.
- Complementar o fluxo HTTP com validação visual da tela única e da impressão baseada no modelo, principalmente preenchimento, campos manuais, legibilidade, quebras de página e reimpressão.
- Verificar a reconstrução com dados de teste: limpar somente o financeiro antigo, preservar cadastros/contratações e reapresentar liberações vigentes sem referências órfãs.

### Critérios de aceite

1. Liberar uma contratação como gestor/admin disponibiliza exatamente um registro na fila.
2. Contratação sem liberação vigente não pode iniciar o fluxo de recibo e baixa.
3. Financeiro e admin consultam e operam contratações de qualquer depósito, mesmo sem vínculo específico.
4. Gestor consulta apenas o depósito autorizado, inclusive por acesso direto a detalhe, impressão e anexo.
5. Gestor não consegue executar mutações financeiras por interface ou API.
6. A tela é única e os filtros e a busca funcionam em conjunto, sem ampliar o escopo de acesso.
7. Pendências são ordenadas pela liberação mais antiga.
8. A lista e o detalhe apresentam as informações especificadas.
9. Uma contratação recém-liberada aparece como Aguardando pagamento.
10. Gerar o recibo altera a situação para Recibo gerado e mantém o valor pendente.
11. O documento usa o valor liberado, atividade, data do serviço, cidade/UF do depósito, data de emissão e nome do prestador corretos.
12. Valor por extenso, CPF e assinatura permanecem disponíveis para preenchimento manual.
13. Um depósito diferente de Sumaré produz a cidade/UF correspondente, sem texto fixo indevido.
14. Reimprimir em outro dia preserva documento e data originais, sem criar outro recibo.
15. Alterações posteriores no cadastro não modificam o documento já emitido ao reimprimir.
16. Não é possível concluir a baixa sem anexar o recibo assinado ou sem recibo previamente emitido.
17. Confirmar com o anexo registra o valor integral e muda a situação para Pago.
18. A data do pagamento coincide com a emissão original, mesmo com confirmação posterior.
19. O instante e o usuário da confirmação ficam registrados separadamente para auditoria.
20. Tentativas repetidas ou concorrentes não geram baixa em duplicidade.
21. Não há pagamento parcial ou agrupamento de contratações.
22. Desfazer a baixa exige motivo, restaura a pendência e mantém a emissão e o histórico.
23. Substituir anexo preserva a trilha da troca e a situação financeira correta.
24. Pagos, recibos e correções permanecem consultáveis pelos usuários autorizados.
25. Falhas na gravação não deixam baixa parcial, pagamento sem evidência ou estados divergentes.
26. A retirada do financeiro anterior não apaga contratações/cadastros nem deixa ações antigas incompatíveis acessíveis na navegação.

## Out of Scope

- Contas a receber, despesas alheias às contratações, fluxo de caixa e saldo de contas bancárias.
- Integração bancária, Pix ou execução de pagamento pelo portal.
- Pagamento parcial, parcelado ou agrupado, mesmo para o mesmo prestador.
- Vencimento, atraso, prioridade manual ou programação de pagamentos.
- Nova aprovação financeira após a liberação da contratação.
- Fluxo de devolução à contratação para correção pelo financeiro.
- Alteração do valor contratado, do favorecido ou dos horários pelo financeiro.
- Campo independente de data efetiva do pagamento.
- Exigência de comprovante bancário além do recibo assinado.
- Assinatura eletrônica, leitura automática de assinatura, OCR e preenchimento automático dos campos manuais.
- Recebimento por terceiros e recibo coletivo.
- Novo fluxo de cadastro incompleto dentro do financeiro.
- Reemissão com alteração de conteúdo/data como funcionalidade separada.
- Relatórios, extratos, ajustes contábeis, indicadores e exportações adicionais herdados do módulo antigo.
- Implementação, exclusão efetiva de dados, publicação ou deploy nesta entrega documental.

## Further Notes

- Modelo de referência: [MODELO DE RECIBO.docx](../recibos/MODELO%20DE%20RECIBO.docx).
- Contexto geral anterior: [Especificação do Portal Control](SPEC.md). Em conflitos financeiros, prevalece este documento.
- Integração de origem: [Contratação individual e conferência](PC-04-CONTRATACOES.md).
- O usuário confirmou o escopo como suficiente para a primeira versão e informou que os módulos anteriores já asseguram os dados necessários à emissão.
- O filtro de período precisa ter seu eixo de data explicitado no aceite da implementação; data do serviço é a proposta registrada aqui, não uma decisão expressa do usuário.
- Este documento não altera a disponibilidade operacional real do ambiente nem converte automaticamente mecanismos legados de laboratório em um financeiro publicado.

## Tickets

Fila local criada em 30/10/2026 com `to-tickets`, em modo direto. Todos os tickets estão planejados; nenhum código, banco ou ambiente foi alterado por essa decomposição.

Execução autorizada em 30/10/2026: FIN-01 a FIN-04 implementados, integrados e validados com HTTP autenticado/SQL descartável, UI e revisão independente. Migrações 33 (recibos), 34 (baixas) e 35 (substituição financeira) aplicadas nessa ordem no SQL Express local, banco JETTA_CONTROL_PILOTO_LOCAL, com backups verificados. Limpeza delimitada concluída, contratações/cadastros/auditoria e FIN02/03 preservados, piloto reaberto com financeiro novo. Resultados, rastreabilidade e limitações nos registros dos tickets. Sem commit, push ou deploy externo.

1. [FIN-01 — Fila financeira única e permissões por perfil](../.scratch/financeiro/issues/01-fila-e-permissoes.md).
2. [FIN-02 — Emissão e reimpressão do recibo individual](../.scratch/financeiro/issues/02-recibo-individual.md).
3. [FIN-03 — Baixa integral com recibo assinado e correções rastreáveis](../.scratch/financeiro/issues/03-baixa-e-correcoes.md).
4. [FIN-04 — Substituição do financeiro antigo e integração do fluxo completo](../.scratch/financeiro/issues/04-substituicao-legado-integracao.md).

Ordem de integração: FIN-01 → FIN-02 → FIN-03 → FIN-04. Preparação de layout e levantamento do legado podem começar antes dos predecessores concluírem; cada ticket explicita a etapa realmente dependente. A limpeza e a ativação definitiva ficam em FIN-04, quando o fluxo substituto estiver implementado. Esta fila não inclui publicação ou deploy.
