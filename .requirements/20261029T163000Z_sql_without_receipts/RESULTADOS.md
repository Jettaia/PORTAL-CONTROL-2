# Resultado — 29/10/2026

Instalado e iniciado o piloto persistente em http://127.0.0.1:3211/, banco JETTA_CONTROL_PILOTO_LOCAL na instancia local SQLEXPRESS. Aplicadas as 28 migrations do manifesto em banco novo, sem fixtures operacionais. Financeiro SIMULADO; pc09:false. A janela de configuracao inicial foi aberta pelo iniciador privado; senha nao criada pelo agente.

## Verificacao

- `node scripts/validate-pilot-without-pc09.mjs`: 304 testes aprovados, zero falhas; 649 arquivos de sintaxe aprovados; 8 testes do piloto/conexao/gate aprovados. Perfil LOCAL_PILOT_WITHOUT_PC09 exclui exatamente tests/pc09.test.mjs. Suite integral nao declarada aprovada.
- Oito jornadas SQL reais aprovadas: PC01/02/03/04/05 em pilot-local/tickets-sql-final.txt; PC07/08/10 em pilot-local/tickets-sql-final-remaining.txt. PC11 incluido no percurso PC10. Casos incluem ADM/gestores/financeiro, escopos, autenticacao/MFA, concorrencia, atomicidade, anexos e persistencia.
- `JETTA_B3_RUN_SQL_TESTS=YES node pilot-local/integration.mjs`: 16 verificacoes PASS, restore, CHECKDB, reconciliacao e revogacao aprovados; cleanupVerified:true; hashes iguais ao runtime atual. Evidencia: pilot-local/integration-evidence.json. Primeira tentativa preservada como diagnostico de falta de memoria; nova execucao aprovada apos usuario fechar aplicativos e serializacao das provas.
- Gate de liberacao checou evidencias atuais; instalador respondeu INSTALLED_AWAITING_USER_PASSWORD. ACL aplicada pelo script com ExecutionPolicy Bypass somente no subprocesso; nenhuma politica persistente alterada.
- Backup com checksum e VERIFYONLY aprovado antes da abertura do servidor. Health UP, setupPending:true, somente loopback:3211. Usuarios, prestadores, contratacoes e pagamentos vazios no banco permanente. Zero bancos sinteticos restantes. Prova: pilot-local/installed-smoke.json.
- Revisao independente GPT-6.1 Sol/medium encerrou achado de frescura da regressao (hashes dos testes e runner agora verificados) e nao encontrou defeitos materiais nos deltas BIGINT/fixtures. Testes focais executados pelo reviewer: 148 PASS.
- `git -c core.whitespace=cr-at-eol diff --check`: PASS.

## Correcoes e red/green

Gate de perfil: red por modulo ausente, green validando selecao exata, evidencias antigas/falhas e hashes. PC03: red HTTP503 ao auditar BIGINT ODBC, green com serializacao exata. PC04: red HTTP400 para ator BIGINT, green com validacao de inteiro seguro preservada. PC08/10/11: red HTTP400 para IDs internos BIGINT, green 73 testes focais. Fixtures atualizadas para PC10 instalado, timestamps SQL com segundos, IDs enviados como strings JSON e janela movel correta de 90 dias. Corrigido shadow de variavel no teste PC08 que impedia cleanup; banco vazio daquela falha removido apos confirmar origem e ausencia de tabelas.

## Limites e continuidade

PC09 nao implementado nem aceito nesta etapa; teste original e interface parcial preservados. PC06 e homologacao integral do conjunto de tickets nao foram certificados. Nenhum push/deploy ou acesso ao banco legado JETTA_CONTROL. O servidor fica ativo para configuracao pelo usuario; preservar secrets/pilot-local/runtime.json e backups privados. Reabrir com `node pilot-local/start.mjs --open`; para encerrar com backup, criar secrets/pilot-local/encerrar.sinal.
