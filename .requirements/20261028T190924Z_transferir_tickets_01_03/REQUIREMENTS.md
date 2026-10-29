# Transferir PC-01, PC-02 e PC-03 para PORTAL CONTROL 2

## As Is
Os três tickets e sua base estão em PORTAL CONTROL. PORTAL CONTROL 2 contém apenas configuração Serena. O comando focal nesta pasta falha por ausência dos arquivos de teste.

## To Be
PORTAL CONTROL 2 contém uma cópia independente do projeto completo com o estado atual dos três tickets, capaz de executar suas verificações nesta pasta.

## Requirements
1. Copiar a base, alterações não commitadas e novos arquivos, incluindo testes, SQL, documentação e dependências locais.
2. Preservar a origem e a configuração Serena já existente no destino.
3. Manter o histórico Git e não executar commit, push, deploy ou migração de banco.

## Acceptance Criteria
1. Todos os arquivos copiados possuem o mesmo SHA-256 da origem; os testes dos tickets e a regressão passam no destino.
2. Nenhum arquivo da origem é removido ou alterado; .serena do destino é preservada.
3. Git funciona no destino com as mesmas alterações; SQL real indisponível é explicitamente registrado.

## Principal Regression Test
node --test tests/pc01.test.mjs tests/pc02.test.mjs tests/pc03.test.mjs
Antes: falha por arquivos ausentes (executado). Depois: valida os contratos dos três tickets no destino. Trata-se de transferência de implementação existente, sem alteração de comportamento novo.

## Testing Plan
Comparação SHA-256 de todos os arquivos transferidos; suíte tests; testes do piloto; verificações de sintaxe; testes de integração SQL (SKIP quando indisponível); fluxos visuais dos três tickets.

## Implementation Plan
1. Copiar o projeto completo sem sobrescrever .serena. Comparar hashes.
2. Executar os testes e validações no destino.
3. Registrar resultado e limitações.

## Reviews
Serena: initial_instructions e activate_project executados para PORTAL CONTROL 2.
LAD: system_design_review e code_review ausentes do inventário; README do mcp-setup informa enabled=false por credencial de provedor pendente. Nenhuma revisão LAD ou revisão por subagente nesta transferência. Revisão própria e testes serão registrados.

## Resultado da transferência
- 2.165 arquivos copiados, incluindo histórico Git, dependências locais, código, testes, SQL, documentos e evidências. Comparação SHA-256 após a cópia: zero diferenças.
- Origem preservada; .serena do destino preservada. Git confirma PORTAL CONTROL 2 como raiz e mantém o commit base 13c54f9 e os deltas não commitados.
- node scripts/test-all.mjs: 120 PASS.
- node --test pilot-local/unit.test.mjs integration/pc01.integration.mjs integration/pc02.integration.mjs integration/pc03.integration.mjs: 2 PASS, 3 SKIP (SQL real não configurado).
- integration/pc01.visual.mjs, pc02.visual.mjs e pc03.visual.mjs: PASS nesta pasta. UI real com HTTP sintético; SQL não exercitado.
- git -c core.whitespace=cr-at-eol diff --check: PASS.
- Documentos PC-01/02/03 copiados sem reescrever sua referência histórica à pasta de implementação original. A pasta correta para continuar o trabalho agora é PORTAL CONTROL 2.
- Revisão própria da transferência: sem diferença de conteúdo. Nenhum subagente usado. LAD indisponível por servidor desabilitado sem credencial, conforme diagnóstico local; nenhuma aprovação LAD declarada.
- node scripts/check-all.mjs: 606 arquivos, zero falhas.
