# As Is
PC05 autoriza tablets por8h e gerencia aparelhos dentro Contratações. Não há localização persistida.
# To Be
Cadastros > Tablets com cadastro/nome/localização (Depósito e Centro de Custo do cadastro), lista única, situação, gerar código e revogar. Autorização contínua até revogação; usuário confirmou SOMENTE depósito vinculado.
# Requirements
1. Painel separado, retirar gestão de aparelhos de Contratações preservando tokens por contratação.
2. Depósito obrigatório em novo cadastro; CC derivado do depósito, não digitado/duplicado. ADMIN enxerga tudo; GESTOR só locais autorizados; Financeiro nega gestão.
3. Pareamento5min singleuse; ativação permanente no servidor (ExpiraEmUtc NULL), cookie persistente renovado em status. Limpeza dos dados/navegador ou troca aparelho exige nova ativação. Revogação, troca local e novo código invalidam sessão anterior.
4. Tablet só registra token de contratação do próprio depósito e dentro das permissões dos emissores. Token8dígitos segue1h singleuse e entrada antes da saída. Concorrência conserva um único registro.
5. Migração aditiva idempotente, preservar registros legados e histórico. Legados sem depósito exibem SEM_DEPOSITO e precisam atribuição/novo código; não reativar revogados automaticamente.
# Acceptance Criteria
Painel real lista/rele cadastro, localização e situação; autorização funciona após8h/fechar reabrir navegador; outro depósito negado sem consumo; duas sessões independentes; revogar/reparear/mudar local nega cookie antigo; escopo e inputs inválidos sem escrita indevida; tokens/Contratações preservados.
# Principal Regression Test
node --test tests/pc05.test.mjs cobre HTTP real serviço com adaptadorSQL; integration/tablets.integration.mjs cobre SQL/API reais em banco descartável; integration/tablets.visual.mjs cobre painel/cliques com fixtures, captura desktop/mobile. Registrar red/green.
# Testing Plan
Luna frontend separado, principal backend/migração, teste SQL real separado; revisão independente Sol medium por autorização persistente. Não usar dados reais para fixture. Aplicar só migração aditiva no piloto após provas e backup; validar painel real autenticado. Sem deploy externo ou habilitar acesso de rede.
# Implementation Plan
1. Investigar contrato/cookie/escopo (usuário confirmou restrição depósito). 2. Testes red. 3. Expandir schema e implementarbackend/UI disjuntos. 4. Provas/revisão. 5. Upgrade local com parada/backup oficial; reiniciar e validar ambiente ativo.
# Compatibilidade e reversão
Schema adiciona DepositoId nullable+FK e permite ExpiraEmUtc NULL; mantém prazos antigos e todos dados. Código antigo falha fechado para sessões permanentes. Rollback de aplicação exige revogar credenciais permanentes antes, restaurar código e manter colunas aditivas; não apagar histórico nem restaurar banco silenciosamente. Migração não apaga/revoga sessões atuais implicitamente, mas sem localização serão bloqueadas até completar cadastro.
# Referência técnica
https://developer.chrome.com/blog/cookie-max-age-expires — limite400dias para cookie persistente, renovável a cada uso; servidor não expira autorização permanente. Cookie HttpOnly/SameSite, segredo só hash no banco.

# Resultado atual
Implementado e aplicado ao piloto local. Cadastros>Tablets permite cadastro com depósito/CC, edição, novo código, revogação e estados; gestão de aparelhos removida de Contratações, tokens individuais preservados. Painel só ADMIN/GESTOR com pc05 habilitado, servidor nega Financeiro. Schema32 mantém legados, adiciona DepositoId e aceita ExpiraEmUtc NULL para autorização contínua. Código temporário5min e singleuse; cookie HttpOnly400dias renovado com uso. Depósito diferente nunca consome token. Alterar local/cadastro ou novo código invalida sessão antiga.

# Evidências
- Red unit/UI: nova autorizaçãoNULL rejeitada na lógica antiga, cadastro semdepósito aceito incorretamente, menu Tablets inexistente. Registros artifacts/contracts-filters/tablets-red.log e artifacts/tablets/red.json quando disponível.
- node --test tests/pc05.test.mjs tests/pc05-app.test.mjs tests/pc04.test.mjs pilot-local/unit.test.mjs:125pass0fail0skip; artifacts/tablets/final-regressions.log.
- node integration/tablets.visual.mjs (Edge headless, API sintética): create/edit/reissue/revoke,6estados, vazio/erro, segredo30s/troca tela/logout, guarda perfil/pc05 e desktop/mobile. Tokens por contratação exercitados com pc04.js e sem GET tablets em Contratações. Capturas artifacts/tablets/desktop.png e mobile.png inspecionadas. Regressões da tabela e navegação também PASS.
- JETTA_B3_RUN_SQL_TESTS=YES JETTA_B3_SQL_SERVER=localhost\SQLEXPRESS node --test integration/tablets.integration.mjs:1pass0fail0skip em19.17s; criação/ativação persistida,12h/restart/cookie, legado e migração2x, perfil/escopo com ausência de efeitos, doisaparelhos, token1h/expiração/concorrência/singleuse/localtime, mudançaA→B, revogação/repareamento. Banco913f005f925f descartado e DB_IDNULL confirmado.
- SQL real inicialmente revelou listagem Financeiro200: corrigido403 antes consultas. Reviewer detectou projeção DepositoId ausente em activate: corrigido; SQL realGREEN comprovou ativação. Prova live detectou featureflagpc05 ausente em accountContext: acrescentada no padrão das outrasflags e servidor recarregado.
- JETTA_FILTERS_LIVE=YES node integration/tablets-live.mjs:PASS no piloto ativo, menu real por clique, catálogo/CC e Contratações sem gestão antiga, zeroerrosJS. Nenhuma escrita de negócio; sessão diagnóstica curta apagada porhash e COUNT0.
- Revisão independente GPT-6.1 Sol medium (auth/segurança/persistência/migração/UI): sem achados remanescentes, incluiu flagaccount posterior.
- Suíte geral node scripts/test-all.mjs:366testes,365pass1fail0skip. Falha preexistente PC09 por src/pc09-routes.js ausente noHEAD, já documentada em tarefa anterior; nenhum teste pulado para obter verde.

# Migração no piloto e preservação
Parada pelo sinal oficial e backup verificado. scripts/upgrade-tablets.mjs exige destino piloto/identidade correta, servidor parado e backup; transação compara contagem/hash de69tabelas e valores de colunas existentes do tablet. Primeira tentativa reverteu porque o guard comparava metadadosODBC de nulabilidade (mudança intencional), sem perda dedados; ajustado para comparar somente arrays de valores enquanto snapshot das outras tabelas permanece integral. Nova tentativa PASS69tabelas preservadas,0tabletsanteriores, backupVerifiedtrue. Reinício oficial com backup e flagaccount corrigida, processo17668,mesma porta3211. Sem deploy/redeexterna.

# Limites
Dois aparelhos físicos não foram usados; concorrência e sessões independentes provadas por clientesHTTP emSQL real descartável. Piloto permanece127.0.0.1; acesso de rede física não faz parte desta entrega. Limpar armazenamento/trocar navegador exige novo pareamento; legado semdepósito precisa edição e novocódigo. Token de contratação continua1h (pedido alterou autorização do aparelho, não token de serviço). Falha preexistentePC09 fora escopo.

# Regressão SQL adjacente final
PC05_SQL_TESTS=YES PC05_SQL_SERVER=localhost\SQLEXPRESS node --test integration/pc05.integration.mjs:1pass0fail0skip19.64s. Suíte atualizada somente para contrato novo autorizado de depósito, mantendo MFA/tokens/concorrência/manual/revogação; grantA+B do emissor não amplia o tabletA. Nenhum banco descartável restante em sys.databases.
