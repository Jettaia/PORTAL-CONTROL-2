# FIN-04 — Substituição do financeiro antigo e integração do fluxo completo

Status: implementado, integrado, validado e aplicado ao piloto local em 30/10/2026. Migrações 33 → 34 → 35 executadas com backup verificado; piloto reaberto e saudável. Sem commit, push ou deploy externo.

Fonte canônica: [FINANCEIRO-SPEC](../../../docs/FINANCEIRO-SPEC.md).

## Resultado

O portal passa a usar somente o financeiro novo para contratações, com dados financeiros anteriores zerados no ambiente alvo da execução autorizada, preservando contratações e cadastros. O fluxo completo funciona com os três perfis e sem caminhos antigos que contornem suas regras.

## Escopo e delta sobre a base

- Levantar consumidores reais do financeiro anterior: pagamentos e anexos, recibos, ajustes/ledger, extratos, provisionamentos, autorizações, carteiras, rotas, flags, navegação, instalador e runtime local. A base mistura caminhos operacionais e laboratoriais; retirar somente os ligados ao financeiro substituído.
- Revisar especialmente a ligação entre contratação e ledger antigo. Não apagar um módulo compartilhado sem preservar a liberação, revisão e cancelamento operacionais que ainda o chamam.
- Consolidar a navegação em uma entrada para a tela financeira única, disponível a financeiro/admin e gestor conforme escopo. Remover atalhos e gravações financeiras antigas incompatíveis.
- Preparar a alteração de esquema e a limpeza dos registros financeiros antigos, delimitadas por tabelas/colunas e dependências verificadas. Preservar dados operacionais, usuários, vínculos e auditoria operacional.
- Conciliar marcadores de baixa antigos nas contratações com o reset financeiro, sem deixar contratação paga órfã ou registro antigo misturado ao histórico novo. O reset não cria pagamentos fictícios no novo modelo.
- Reapresentar contratações com liberação vigente como Aguardando pagamento, sem exigir nova liberação pelo gestor, após remover seus registros financeiros anteriores conforme o reset.
- Validar o procedimento em base de teste com dados antigos antes de aplicar ao ambiente alvo. A execução no banco real depende de autorização de implementação/aplicação compatível com aquele ambiente; este pedido de tickets não executa nem autoriza publicação externa.
- Atualizar instalador/configuração/documentação diretamente atingidos para que instalação nova e atualização não reativem o financeiro antigo.
- Integrar FIN-01/02/03 e remover descrições laboratoriais antigas que contradigam o novo registro de pagamentos externos, sem alegar integração bancária.

## Critérios observáveis

1. A navegação oferece uma única tela financeira e não expõe os fluxos antigos de agrupamento, autorização extra, ajustes ou extratos incompatíveis.
2. Rotas antigas não permitem gravar pagamentos/recibos em paralelo ao modelo novo nem contornar suas autorizações.
3. A limpeza remove somente os dados financeiros delimitados; quantidades/identidades de contratações, prestadores, depósitos, atividades, usuários e vínculos são preservadas, ressalvados os marcadores financeiros explicitamente reconciliados.
4. Liberações vigentes aparecem na fila nova uma única vez e sem baixa órfã. Contratações não liberadas/canceladas permanecem inelegíveis.
5. O fluxo completo funciona: liberar → consultar → emitir/imprimir → anexar → confirmar → consultar Pago → substituir anexo → desfazer com motivo.
6. Gestor lê somente seu depósito, incluindo documentos; financeiro/admin operam todos. A tentativa de acesso direto alheio e de mutação pelo gestor é negada.
7. Contratação paga continua protegida contra alterações operacionais indevidas e os dados/datas do recibo permanecem preservados nas reimpressões.
8. Instalação/atualização e runtime adotam os mesmos contratos do novo fluxo; erros materiais nas integrações atingidas são resolvidos antes de declarar a reconstrução concluída.

Cobertura da SPEC: critério 26 e integração dos critérios 1–25 já verificados nos tickets anteriores. Reutilizar provas equivalentes dos predecessores e repetir apenas o que a integração/limpeza possa invalidar.

## Dependências por etapa

- Inventário dos consumidores antigos e preparação da limpeza: podem começar antes de FIN-01/02/03 concluírem; preservar as alterações desses tickets nos arquivos compartilhados.
- Aplicação da limpeza e ativação do novo fluxo: dependem dos contratos persistidos de fila, recibo e baixa de FIN-01/02/03 estarem implementados e verificados nas fronteiras pertinentes.
- Prova de migração/reset: base SQL Server de teste com financeiro antigo e cadastros/contratações representativos; não usar runtime como pré-requisito para produzir esta fila documental.
- Publicação/deploy: fora desta fila, dependente de instrução específica para o ambiente solicitado. Não criar ticket de deploy por suposição.

## Verificação focal

- Comparar dados protegidos antes/depois do reset em base de teste e consultar referências financeiras para detectar órfãos. Incluir contratação liberada com pagamento antigo e contratação não liberada.
- Executar uma prova integrada com persistência e sessões dos três perfis cobrindo o fluxo do critério 5; aproveitar a mesma execução para autorização e consistência.
- Verificar navegação, tela única e impressão, incluindo um depósito fora de Sumaré. Reutilizar imagens/provas válidas de FIN-01/02/03 quando não afetadas.
- Rodar regressões focadas em autenticação/escopo, liberação/revisão/cancelamento e instalador/runtime alterados. Ajustar testes de regras aposentadas sem mascarar falhas operacionais.

## Fora desta entrega

Migração do histórico financeiro antigo para a nova interface, recursos além da SPEC, commit, push e deploy automático.

## Registro de execução

Resultado: FIN-04 concluído no checkout e aplicado ao piloto autorizado. Única entrada Financeiro usa FIN-01/02/03. Rotas antigas de carteira, autorizações, prontidão, consolidação, provisionamentos, laboratório, pagamentos agrupados, recibos legados, ajustes e extratos estão desativadas (GET/HEAD/OPTIONS 410; mutações autenticadas 409, sem sessão 401). Páginas/assets antigos também retornam 410, incluindo URLs codificadas e barras duplicadas. Atalhos internos antigos convergem à tela única. Contratações preservam ações/histórico e deixam de escrever no ledger PC10 com FIN01 ativo, mesmo se uma flag PC10 obsoleta for enviada.

Configuração/instalador/runtime desabilitam as flags financeiras legadas. O início do piloto exige tabelas FIN02/03 e marcador JETTA_FIN04_RESET=1. Instalação nova aplica as 35 migrações em ordem e termina no contrato novo. Textos visíveis identificam registro de pagamentos externos, sem execução bancária. Configuração privada histórica SIMULADO permanece compatível; novas instalações usam REGISTRO_EXTERNO.

Limpeza delimitada: 23 tabelas explícitas Financeiro.PC08*, PC10*, carteira/autorização/prontidão/regras antigas e Simulacao.Processo/Evento/ReciboVersao/Anexo, conforme lista em pilot-local/fin04-reset.mjs e SQL35. Nenhuma exclusão de Seguranca.Auditoria, dados operacionais ou tabelas FIN02/03. Contratações só têm PagoEmUtc reconciliado com ConfirmadoEmUtc da baixa nova ativa; não são criados pagamentos fictícios. Snapshot completo comprova preservação de todas as tabelas restantes e de todas as colunas das contratações exceto esse marcador. O reset usa transação, applock PC04, preflight de FKs e restauração exata dos estados anteriores dos gatilhos. Reexecução é idempotente e não apaga o histórico novo.

### Aplicação instalada

Destino exato: localhost\SQLEXPRESS, banco JETTA_CONTROL_PILOTO_LOCAL, identidade privada conferida, porta 3211. O piloto foi encerrado pelo sinal oficial antes dos upgrades. scripts/upgrade-fin02.mjs aplicou 33 com backup verificado e 69 tabelas existentes preservadas; depois scripts/upgrade-fin03.mjs aplicou 34 com backup verificado e 70 tabelas existentes preservadas. Após ensaio descartável e revisão, scripts/upgrade-fin04.mjs aplicou 35: PASS, 23 tabelas financeiras antigas esvaziadas, 48 tabelas protegidas preservadas por conteúdo, contratações preservadas exceto marcador conciliado, FIN02/03/auditoria preservados. Backup pré-reset: secrets/pilot-local/backups/JETTA_CONTROL_PILOTO_LOCAL-2026-10-30T14-08-13-600Z.bak, COPY_ONLY/CHECKSUM + RESTORE VERIFYONLY PASS. O iniciador verificou outro backup antes da reabertura.

Piloto reaberto pelo iniciador oficial, sem janela extra. Smoke no serviço instalado: health UP, desafio HMAC de identidade correto, esquema 33/34/35 pronto, zero marcadores de baixa órfãos, HTML com financeiro novo, rotas/páginas antigas 410 e fila exige autenticação 401. URL http://127.0.0.1:3211/. Nenhum pagamento real ou usuário de teste foi criado no banco instalado; jornadas autenticadas e mutações de prova ocorreram somente em bancos descartáveis.

### Verificação

| Critérios | Comando/prova | Resultado |
|---|---|---|
| Limpeza, preservação, fila e instalação | FIN04_SQL_TESTS=YES node --test integration/fin04-reset.integration.mjs | PASS 1/1, 8,34s; schema completo novo, todas as 23 tabelas antigas preenchidas, baixa antiga exclusiva retorna AGUARDANDO_PAGAMENTO, nova baixa continua PAGO, aberta/cancelada fora da fila, snapshot de dados protegidos/FIN02/03/auditoria, FK inesperada recusada, falha injetada reverte toda limpeza, gatilhos preservados e repetição na mesma conexão. Bancos descartáveis removidos. |
| Fluxo integrado/perfis/regressão | FIN01_SQL_TESTS=YES FIN02_SQL_TESTS=YES FIN03_SQL_TESTS=YES FIN04_SQL_TESTS=YES node --test --test-concurrency=1 integration/fin01.integration.mjs integration/fin02.integration.mjs integration/fin03.integration.mjs integration/fin04.integration.mjs | PASS 4/4, 44,3s; HTTP autenticado/SQL real, ADMIN e FINANCEIRO globais sem vínculo, GESTOR A/B, acesso direto alheio e mutações negados, liberação sem ledger, fila, emissão/snapshot/impressão/reimpressão, baixa integral, anexos, troca/desfazimento, concorrência/rollback e proteção operacional paga. |
| Regressão focal | node --test tests/fin04-retirement.test.mjs tests/pc04.test.mjs tests/pc04-legacy.test.mjs tests/pc08.test.mjs pilot-local/unit.test.mjs | PASS 106/106. PC08 antigo testado somente em seu modo isolado de compatibilidade; runtime novo nega suas rotas. |
| UI | JETTA_PLAYWRIGHT_ROOT=C:/Users/Jetta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules; node integration/fin04.visual.mjs; node integration/fin03.visual.mjs | PASS, ADMIN/FINANCEIRO/GESTOR, desktop/mobile1440/390, navegação única/aliases, dashboard sem chamadas financeiras antigas, scripts reais com HTTP sintético, ações/correções e gestor leitura, sem erros JS/overflow. FIN01 visual anterior também revalidado pelo executor UI. Capturas artifacts/fin04 e artifacts/fin03; pixels mobile inspecionados. |
| Sintaxe/integridade | node scripts/check-all.mjs + node --check focal nos scripts/testes alterados após o lote | PASS 686 arquivos no lote, delta final verificado; manifesto 35/35 hashes conferidos independentemente. SQL final executado de verdade no ensaio e no piloto. |
| Revisão independente | fin04_review, GPT-6.1 Sol medium, Standards+Spec | APROVADO, sem achados materiais; runtime independente 3/3 PASS, review final do delta SQL e preservação/rollback/idempotência, manifesto35/35. Não repetiu mutações SQL. |

TDD: RED principal HTTP (503 ao criar com ledger PC10 provisionado e flag desativada); GREEN após desacoplamento. RED runtime por rotas antigas 404/200 em lugar de410 e flags antigas true; GREEN após aposentadoria. RED URL estática codificada 200; GREEN410. O ensaio SQL detectou colisão de #FIN04EnabledTriggers em repetição na mesma conexão (2714); correção libera a tabela temporária e o mesmo ensaio passou. Fixtures antigas inválidas foram corrigidas para respeitar os schemas antes de testar a limpeza.

Limitação ambiental resolvida: duas tentativas do ensaio foram interrompidas na instalação histórica29 sob pressão de memória do SQL, antes de executar a limpeza. Após o usuário liberar RAM, SQL process_physical_memory_low passou de1 para0 e os testes concluíram em segundos. O cursor29 foi tornado STATIC READ_ONLY para congelar definições antes de ALTER no mesmo catálogo (delta revisado); não atribuir exclusivamente a esse ajuste a resolução da lentidão. Nenhuma configuração global do SQL foi alterada. Os bancos interrompidos foram removidos pelos nomes exatos. Serena/LAD indisponíveis nesta sessão; ferramentas locais e revisão independente utilizadas.

Nenhum commit, push, deploy externo ou publicação. Provas de interface usam HTTP sintético; persistência e autorização são demonstradas separadamente pelo HTTP autenticado com SQL descartável. No piloto instalado, verificação final foi não destrutiva e sem novas credenciais.

Fingerprint SHA256 do candidato: e2f7fb122693e3fb2f1357db6ac2fbdc86feeb6b6439d6a45d710c24160e06de, sobre concatenação UTF-8 LF de caminho:sha256 na ordem: `src/server.js`, `src/pc04.js`, `pilot-local/runtime-config.mjs`, `pilot-local/start.mjs`, `pilot-local/install.mjs`, `pilot-local/app.mjs`, `public/index.html`, `public/navigation.js`, `public/home-summary.js`, `pilot-local/depot-model.sql`, `pilot-local/fin04-reset.mjs`, `pilot-local/fin04-retirement.sql`, `pilot-local/sql/35-fin04-retirement.sql`, `pilot-local/build-schema.mjs`, `pilot-local/sql/manifest.json`, `scripts/upgrade-fin04.mjs`, `integration/fin04-reset.integration.mjs`, `integration/fin04.integration.mjs`, `integration/fin04.visual.mjs`, `tests/fin04-retirement.test.mjs`.
