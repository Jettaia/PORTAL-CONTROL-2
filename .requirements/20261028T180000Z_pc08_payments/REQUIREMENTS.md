# PC-08 — Painel financeiro, pagamentos e anexos
## As Is
PC-04 persiste liberação, versão e valor. Financeiro legado é simulado e não quita contratos PC-04. Checkout contém trabalho anterior preservado.
## To Be
ADM/financeiro registram quitação integral de contratos liberados, com anexo obrigatório por contratação (P04 confirmada pelo usuário), sem transferência externa.
## Requirements
1. Painel aberto/pago com filial, gestor, prestador, tipo, data e valor; filtros por filial/prestador/período/situação e paginação.
2. Baixa de 1 a 10 contratos de um prestador, valor e versão explícitos por item; sem parcial; MFA recente.
3. Data efetiva válida entre serviço de todos os itens e hoje em America/Sao_Paulo; registro UTC e autor separados.
4. Transação atômica de cabeçalho/itens/anexos/auditoria e marca PC04; mesmo applock PC04 para revisão concorrente; unicidade por contrato.
5. Um arquivo obrigatório por item, qualquer formato, até 1 MiB cada; até 10 MiB por grupo. Bytes no SQL, sem execução, download autenticado apenas ADM/financeiro.
6. Financeiro não recebe permissões operacionais novas; recibos PC09 fora desta entrega.
## Acceptance Criteria
1. Consulta exclui aberta/cancelada e filtra antes da paginação. Campos exigidos visíveis.
2. Rejeitar gestor sem função financeira, prestadores misturados, item repetido, valor/versão obsoletos, contrato já pago/não liberado.
3. Recusar data impossível/futura/anterior ao serviço; aceitar retroativa permitida.
4. Falha em qualquer anexo/escrita causa rollback; duas baixas/revisão disputam mesmo lock; contrato pago permanece protegido no PC04.
5. Conteúdo inválido, vazio, excessivo ou sem nome é recusado antes de escrita; download força attachment/octet-stream/nosniff/sandbox. Nenhum blob em listagem.
6. Testes PC01–PC07 preservados.
## Principal Regression Test
node --test tests/pc08.test.mjs — HTTP real e serviço real, adaptador ODBC controlado para testar autorização, validação e commit/rollback. Red esperado: módulo de rotas ausente. Prova SQL real opt-in em integration/pc08.integration.mjs complementa persistência/concorrência; mock não certifica SQL.
## Testing Plan
Casos ADM/financeiro permitido, gestor/sem sessão negado; grupo, anexo por item, datas, conflito, falha de escrita; UI real headless com HTTP sintético e estados aberto/pago/filtros/anexo/conflito. SQL descartável somente em instância local explícita.
## Implementation Plan
Testes HTTP primeiro; schema aditivo guardado e serviço transacional; rotas opt-in/config; painel seguindo shell/pc04; regressões adjacentes, review independente e jetta-qa.
## Reviews / documentação
LAD não exposto nas ferramentas; README mcp-setup informa enabled=false por credencial ausente. system_design_review/code_review LAD indisponíveis, sem aprovação presumida. Serena ativada; símbolos indisponíveis: language_servers=[]. Não modificar configuração global.
Documentação: https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql?view=sql-server-ver17 confirma lock transacional e necessidade de transação aberta.

## Resultado atual e evidências
Candidato integrado no checkout. P04 refletida no SPEC. APIs opt-in pc08: GET /api/pc08/painel (filtros/antes), POST /api/pc08/pagamentos ({dataPagamento,itens:[{contratacaoId,versao,valor,anexo:{nome,conteudo base64}}]}), GET /api/pc08/anexos/:contratacaoId. Acesso ADM/financeiro; MFA recente na escrita. Schema SQL guardado, pc08 ativado somente em novos provisionamentos explicitamente executados; sem migração de banco existente.
Red: node --test tests/pc08.test.mjs falhou ERR_MODULE_NOT_FOUND pc08-routes.js antes da implementação; green 26 PASS. Red de fluxo: node integration/pc08.visual.mjs falhou "Adicionar item conserva anexo já selecionado: 0 !== 1"; correção preserva inputs existentes e green PASS.
QA final: suite geral 254 PASS e 1 FAIL externo em tests/pc09.test.mjs (novo trabalho concorrente, módulo pc09-routes.js ausente); execução anterior 246 PASS/zero falhas; sintaxe 631 arquivos; visual headless shell real/HTTP sintético PASS em 1440/820/390 com captura mobile inspecionada. Regressão PC04/PC07 incluída. Revisão independente por subagente Sol medium encontrou/reset de sessão e MFA; ambos corrigidos e encerrados após nova execução de 26 testes e headless. Sem achados materiais pendentes nessa revisão.
SQL real BLOCKED: connectPilot('master','localhost') falhou 08001/HYT00; nenhum serviço SQL local identificado. integration/pc08.integration.mjs é opt-in e ficou 1 SKIP. Retomada: instância local descartável e PC08_SQL_TESTS=YES/PC08_SQL_SERVER=localhost ou .\INSTANCIA; teste cria/remove JETTA_CONTROL_B3_TEST_<12hex>. Persistência, constraints e concorrência SQL não certificadas por mocks.
LAD BLOCKED por servidor desabilitado/credencial pendente conforme README mcp-setup; revisões LAD não executadas. Não chamar candidato de aceite completo enquanto SQL/LAD não forem validados. Sem commit/push/deploy/migração real.
Regressão focal final: node --test tests/pc08.test.mjs tests/pc04.test.mjs tests/pc07.test.mjs: 93 PASS, zero falhas (focused.log).
