# As Is
SQL Express local acessivel; 28 migrations e ensaio sintetico previo aprovados. Instalacao persistente inexistente. Teste PC09 importa modulos ausentes; instalador depende de liberacao e script de ACL bloqueado por politica PowerShell.

# To Be
Integrar e iniciar piloto local com SQL persistente separado, sem PC09, conforme autorizacao atual. Preservar teste e trabalho parcial de recibos. Financeiro simulado.

# Requirements
1. Validar todos os testes existentes exceto tests/pc09.test.mjs em perfil explicito LOCAL_PILOT_WITHOUT_PC09; nao declarar suite integral aprovada.
2. Liberacao exige regressao desse perfil, sintaxe, prova SQL/backup/restore atual e hashes do runtime. PC09 permanece desativado.
3. Executar ACL somente pelo script conhecido com ExecutionPolicy restrita ao subprocesso. Nao mudar politica persistente.
4. Instalar apenas em JETTA_CONTROL_PILOTO_LOCAL vazio, sem sobrepor banco/configuracao; iniciar loopback 3211 e deixar senha para usuario.

# Acceptance Criteria
Perfil exclui exatamente PC09; perfil integral continua incluindo seu teste. Gates recusam provas falhas/antigas ou escopo errado. SQL descartavel cobre instalacao, persistencia e recuperacao; limpeza confirmada. Banco permanente nao recebe fixtures. Health/status e persistencia confirmados; nenhum segredo em logs.

# Principal Regression Test
node --test pilot-local/release-scope.test.mjs: red por modulo de perfil ausente; green valida selecao e rejeicoes do gate real.

# Testing Plan
Testes de contrato/gate, regressao automatizada sem PC09, sintaxe, integration.mjs SQL descartavel com recuperacao, testes SQL PC01/02/03/04/05/07/10 quando disponiveis; instalacao e smoke real sem criar senha pelo agente.

# Implementation Plan
Implementar perfil explicito e gate; corrigir invocacao ACL; executar provas, gerar liberacao verificavel, instalar e iniciar. Atualizar registro existente com alcance e pendencias. Serena/LAD indisponiveis; runtime ERP Move nao se aplica a este repositorio Jetta Control.
