# As Is
PC09 foi substituído por FIN02/03, mas permanecem assets, navegação, teste com imports ausentes e uma exceção de regressão. O usuário aprovou a limpeza descrita na conversa.

# To Be
Retirar exclusivamente o PC09 antigo e exigir regressão integral atual, preservando FIN02/03, URLs aposentadas, migrações, dados e evidências históricas.

# Requirements
1. Excluir teste, assets e ensaio visual exclusivos de PC09; remover navegação e flag do instalador.
2. Substituir o perfil sem PC09 por relatório FULL, sem exclusões, vinculado aos arquivos e testes atuais.
3. Preservar bloqueios 410 e testes de desativação, financeiro vigente, PC08/10/11 e schema.
4. Documentar substituição sem reescrever aprovações históricas ou gerar liberação automática.

# Acceptance Criteria
Suíte geral verde sem pular testes; gate aceita provas FULL atuais e recusa perfil antigo, omissões, hashes antigos, etapas incompletas/falhas e integração sem limpeza. Aliases de recibos continuam abrindo Financeiro para ADMIN, FINANCEIRO e GESTOR. Banco operacional e configuração privada intactos.

# Principal Regression Test
node --test pilot-local/release-gate.test.mjs: usa relatórios temporários no gate real e rejeita manipulações; RED antes da substituição e GREEN depois. node scripts/test-all.mjs reproduz a falha PC09 anterior e comprova regressão completa posterior.

# Testing Plan
Testes do gate e aposentadoria HTTP; suíte geral; sintaxe; integration/fin04.visual.mjs para aliases por persona com API sintética e browser headless. Reutilizar provas SQL FIN02/03 da auditoria, pois não há delta nas regras/SQL. Revisão independente do gate. Sem deploy/restart/migração.

# Implementation Plan
1. Testar contrato integral e registrar RED. 2. Retirar legado e implementar runner/gate FULL. 3. Atualizar documentação vigente. 4. Rodar provas e review; registrar resultados aqui.

Serena/LAD não disponíveis no inventário. APIs de node:test conferidas em https://nodejs.org/api/test.html (somente recursos compatíveis já usados no projeto).

# Resultado
- Limpeza concluída: PC09 exclusivo removido; navegação/flag aposentadas; PC08/10/11, URLs bloqueadas e SQL preservados.
- Gate FULL com hashes atuais, lista integral e resumo TAP obrigatório. Recusa falhas, ausência de execução, skips, TODOs, cancelamentos, exclusões, etapas ausentes e evidências antigas.
- RED inicial: módulo FULL inexistente; RED de reforço reproduziu Missing expected exception no gate ao receber etapa sem resumo. GREEN focal: 5/5.
- node scripts/validate-pilot.mjs: REGRESSIONS_PASS; suíte geral 370/370, piloto/gate/conexão 7/7, zero falhas/skips/TODOs/cancelamentos; sintaxe 692 arquivos, zero falhas. Prova gerada conferida novamente contra os hashes atuais.
- integration/fin04.visual.mjs: PASS ADMIN/FINANCEIRO/GESTOR, alias recibos e demais aliases abrem Financeiro mesmo com pc09:true antigo, zero requests legados/erros JS, desktop/mobile. Harness atualizado para home sem dashboard e menu com FIN05 já existentes, após timeout em #homeStatus removido. Nenhuma regra visual ou financeira de produto alterada para adaptar o teste.
- Revisão independente GPT-6.1 Sol medium: APROVADO após corrigir achado de exitCode zero com skip.
- git diff --check aprovado com core.whitespace=cr-at-eol, preservando bytes CRLF existentes conforme .gitattributes.
- Relatórios antigos preservados e continuam recusados: nenhuma liberação de instalação/produção foi gerada. Sem migração, escrita de negócio, reinício, commit, push ou deploy.
