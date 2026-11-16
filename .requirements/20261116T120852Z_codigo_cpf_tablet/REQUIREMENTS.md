# As Is
Tablet consome token temporário gerado para cada entrada/saída. Aba interna oferece geração/substituição.

# To Be
Prestador informa os quatro primeiros dígitos do CPF no tablet. A primeira leitura registra entrada e a próxima saída, sem geração, expiração ou divulgação de dados no tablet. Aba interna exibe código fixo.

# Requirements
1. Usar prefixo do CPF, com zeros iniciais, sem código alternativo para coincidências.
2. Buscar somente contratação aberta elegível nos depósitos autorizados do tablet e no escopo atual de quem o habilitou; entrada hoje, saída até o dia seguinte.
3. Exibir código permanente na aba atual e horários/status, removendo geração. Desativar emissão antiga; manter histórico existente.
   A geração em lote encontrada em Diárias passa a ser consulta dos códigos fixos, com cópia e sem POST.
4. Proteger duplicação: mesma requisição retorna sucesso sem nova escrita; repetição até dez segundos após entrada não vira saída. Saída manual de entrada existente é permitida.
5. Preservar diário/valor, conferência, autorização de tablet, aprovação de horários, auditoria e ausência de dados pessoais na resposta do tablet.

# Acceptance Criteria
1. Código 0123 encontra CPF iniciado em 0123. Coincidência de mais de uma contratação elegível retorna validação genérica sem apontar em nenhuma; não há exceções de código.
2. Datas inválidas, pendências, contratos concluídos/pagos/cancelados ou fora do escopo não são alterados.
3. Código disponível ao reabrir e atualizar; nenhum botão ou chamada de gerar. Emissão retorna 410 autenticado.
4. Concorrência/retry nunca grava saída como duplicação de entrada. Mesmo request id não muda de código. Nova leitura depois da proteção grava saída uma única vez.
5. Resposta de sucesso continua apenas ok/mensagem; relógio SQL, transação e eventos preservados.

# Principal Regression Test
tests/pc05.test.mjs: HTTP/serviço real com SQL simulado, prefixo sem emissão e entrada/saída/duplicação.
integration/pc05-token-copy-ui.test.mjs: UI real da contratação e tablet com resposta HTTP sintética; código visível e sem geração.
integration/pc05.integration.mjs: fluxo HTTP/auth/SQL em banco descartável local.
Red esperado: token inexistente recusado e UI exige geração; green: prefixo registra diretamente.

# Testing Plan
Red/green, casos negativos de escopo/estado/data/coincidência, recuperação de falha, UI desktop/mobile, SQL real descartável e regressões adjacentes PC04/tablets.

# Implementation Plan
1. Criar regressões principais e executar red.
2. Trocar consumo por identificação CPF; usar eventos existentes para idempotência sem nova tabela/migração.
3. Trocar geração por exibição interna; atualizar tablet para quatro dígitos e requisição identificada.
4. Adaptar cobertura antiga ao contrato aprovado, validar SQL/UI e reiniciar somente o runtime local.

# Validation Results
- Red: prefixo sem token emitido recusado no HTTP; UI sem campo de código fixo (logs em .scratch/pc05-cpf-red.log e pc05-cpf-ui-red.log).
- Green: testes focados de HTTP/serviço, UI de contratação/Diárias/tablet, exportação, multi seleção de depósitos, papéis, exclusão e navegação. Execução combinada: 150/151 passaram; o único caso restante usava o antigo rótulo Tokens, foi atualizado para Entrada e saída e passou separadamente. Total: 151 casos aprovados após atualização do contrato.
- SQL real: PC05_SQL_TESTS=YES PC05_SQL_SERVER=localhost\SQLEXPRESS node --test integration/pc05.integration.mjs. PASS: navegador→HTTP→SQL, prefixo com zero, sem emissões, entrada/saída, concorrência, replay tardio da proteção de dez segundos, rejeição de coincidência, valor/estado financeiro preservados, código interno e revogação.
- SQL real: JETTA_B3_RUN_SQL_TESTS=YES JETTA_B3_SQL_SERVER=localhost\SQLEXPRESS node --test integration/tablets-multidepot.integration.mjs. PASS: ambos os depósitos autorizados, isolamento de depósito não vinculado/inativo, emissor sem escopo e permissões de gestão do tablet.
- SQL executado somente em bancos descartáveis aleatórios, removidos ao finalizar. Nenhum apontamento sintético foi criado no banco instalado do usuário.
- Sintaxe dos módulos alterados aprovada. Capturas em artifacts/pc05-fixed-code, artifacts/diarias e artifacts/pc04-model-a-*.
- Sem migração de schema, commit, push ou publicação em produção. Serena e Lad indisponíveis no catálogo desta sessão.
- Runtime instalado reiniciado pelo sinal oficial, com backup verificado antes/depois. Portal em http://127.0.0.1:3211 responde HTTP 200 e serve tablet/contratação atualizados; stderr vazio.

# References
https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID — UUID das requisições no navegador, validado em Edge com localhost e no fluxo SQL real.
