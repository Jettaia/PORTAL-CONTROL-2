import fs from 'node:fs';const out='docs/b5-2c/',r=JSON.parse(fs.readFileSync(out+'final-validation.json')),p=JSON.parse(fs.readFileSync(out+'performance-evidence.json')),ms=x=>Math.round(x*100)/100;
fs.writeFileSync(out+'GATE_B5_2C.md',`# GATE_B5_2C

Versão **5.0.0-b5.2c.lab.1** · branch **codex/b5-2c-consolidacao** · base **b3a3996 / B5.2B** · 23/10/2026.

**Resultado técnico: PASS_LAB_WITH_RESERVATIONS, com reexecução documentada de interface. Somente laboratório. NO-GO para constituição efetiva B5.3, pagamento, quitação e produção. Implantação no JETTA_CONTROL NÃO AUTORIZADA.**

## 1. Arquitetura financeira consolidada

Prévia B5.2C-1.0.0 integra participação/fechamento/comprovante B4.3, elegibilidade B5.1, solicitação/decisão/snapshot B5.2 e beneficiário/documentação/política/prontidão B5.2B. rowDb continua executando o motor existente de elegibilidade e a comparação SQL/backend. detailFromRow e readinessDb foram compartilhados internamente para compor a mesma linha na mesma transação, sem duplicar cálculo ou alterar os contratos públicos anteriores.

O C não cria motor tributário/remuneratório nem reescreve valores históricos. Contratado/autorizado vêm dos contratos anteriores; proposto vem da versão de política; competência/vencimento são propostas explícitas; bruto, retido e líquido continuam nulos. [Arquitetura, origens, contratos e matriz de autorização](ARQUITETURA_E_CONTRATOS.md).

## 2. Decisões empresariais e fiscais

[Matriz para aprovação da Jetta](MATRIZ_DECISOES_JETTA.md), com 14 temas, alternativas, impactos/evidências e situação PENDENTE: PF/PJ, beneficiário/representação, documentos, remuneração por participação/atividade/turno, competência, vencimento, atrasos/faltas/divergências, descontos/adicionais, tributos/retenções, reabertura, cancelamentos/alterações históricas, segregação, pagamento/quitação e escopo/aprovação de políticas.

Nenhuma alternativa foi selecionada por padrão. O registro formal exige responsável/aprovador, referência verificável, versão, vigência, escopo, exceções, impactos e casos de aceite. Exemplos sintéticos não representam parecer jurídico/contábil/fiscal ou aprovação empresarial.

## 3. Parametrização e prévia de contas a pagar

Interface Financeiro > Autorizações financeiras > Consolidação e prévia de contas a pagar. A seção de prévia é somente leitura e mostra fontes operacionais, contratado/autorizado/proposto, beneficiário proposto com documento mascarado, documentação, competência/vencimento propostos, autorização e motivos impeditivos. Rastreabilidade contém versões, comprovante/hash, auditorias e histórico dos encaminhamentos. A seção de parametrização é separada e reutiliza o formulário/rota e validador de política B5.2B.

RASCUNHO é a versão POLITICA persistida sem encaminhamento daquela versão. Encaminhamento auditado produz PENDENTE_APROVACAO, sem efeito financeiro. A tabela adicional Financeiro.EncaminhamentoPolitica referencia a versão B5.2B e armazena apenas estado/ator/contexto/hash/comando/motivo/auditoria/UTC. FK, unicidade e triggers protegem origem POLITICA/hash/contexto e imutabilidade. O CHECK SQL aceita apenas PENDENTE_APROVACAO; não existe aprovação/publicação empresarial neste incremento.

Nova versão não herda encaminhamento ou validação. Validação documental B5.2B não equivale a aprovação empresarial, e encaminhamento não decide autorização B5.2. Contexto alterado, fonte incorreta ou proposta documentalmente recusada impedem encaminhamento. Campos de ativação empresarial/fiscal são recusados.

ObrigacaoPreparada permanece vazia e protegida pelo trigger B5.2. Não há POST de prévia, rota de constituir/pagar/quitar ou flag para liberar obrigação. Prontidão preserva exatamente os motivos B5.2B, inclusive os bloqueios incondicionais tributário, segurança operacional e constituição não autorizada.

## 4. Segurança e compatibilidade

Consulta exige FINANCEIRO ativo, RBAC explícito de prontidão e UsuarioDeposito atual. Salvar proposta mantém as exigências B5.2B. Encaminhar exige consultar + configurar + encaminhar, MFA de ação recente na sessão, escopo atual, segregação, versão/hash/contexto e motivo; tudo revalidado dentro da transação. O configurador não pode acumular concessões de decisão financeira ou autorização/execução de pagamento. ADMIN, Gestor, raiz ou MFA isolados não concedem bypass. A matriz empresarial completa continua pendente.

SERIALIZABLE, XACT_ABORT e LOCK_TIMEOUT 5000 preservados; trava financeira antes da participação; auditoria e INSERT atômicos. Mesmo ator/chave/comando é replay, sem duplicar. Reutilização diferente e comando concorrente para versão já encaminhada são recusados. Sem retry automático de mutação.

B5.2A mantém modo paginado optativo, padrão legado, filtros, validação de cursor e exportação SOMENTE_PAGINA. Change Tracking da tabela nova pode invalidar cursor pela revisão global, exigindo reinício explícito. Não transforma exportação da página em carteira completa. Os contratos antigos não ganham campos nem mudam semântica; o envelope C é novo.

## 5. Testes e regressão completa

|Grupo|Resultado final|
|---|---|
|Unitários|${r.unit} PASS|
|SQL/HTTP, concorrência e migração próprios C, incluindo agrupador|${r.ownSql} PASS|
|Regressões SQL/HTTP e migrações B3/B4/B5.1/B5.2/B5.2A/B5.2B|${r.regressionSql} PASS|
|Jornadas de interface anteriores|${r.regressionUi} PASS|
|Jornadas de interface próprias C|${r.ownUi} PASS|
|Suítes de regressão|${r.regressionSuites} executadas|
|Sintaxe JavaScript|${r.syntaxFiles} arquivos, zero falhas|
|Excel/OOXML|3 arquivos verificados com openpyxl|

Contagens seguem os runners, incluem agrupadores e não somam reexecuções como testes novos. Migrações anteriores também exercitam seus esquemas de origem e rollback/reaplicação; jornadas funcionais/interface usam esquema integrado. As duas asserções estruturais de sete tabelas financeiras passaram a reconhecer oito; regras e controles não foram relaxados.

Cobertura C: igualdade da prontidão com B5.2B; leitura sem novas auditorias/efeitos financeiros; comprovante e autorização prévia preservados; rascunho/pendência, nova versão sem herança, histórico, replay/chave reutilizada, comandos concorrentes, falha de auditoria/rollback, imutabilidade SQL, recusa de APROVADA empresarial e fonte BENEFICIARIO no encaminhamento, contexto desatualizado, RBAC/MFA ausente/expirado/escopo/segregação, sessão/origem/tablet, rotas de constituição inexistentes e ausência de obrigação. Migração idempotente, falha DDL, down e reaplicação preservam B5.2B.

Interface: desktop, mobile e tablet sem overflow; política salva pelo fluxo B5.2B, encaminhamento C sem liberar finanças, nova versão como rascunho, MFA expirado, falha de rede e sessão ausente limpam dados. Regressões completas cobrem operações, concorrência, autorização, MFA real, paginação e exportação dos blocos anteriores.

## 6. Reexecução e riscos observados

O primeiro gate interrompeu na interface B4.1 após 13 jornadas aprovadas, ao aguardar SAIDA_REGISTRADA na lista após navegar de Planejamento para Apontamentos: timeout de asserção de 30 segundos. A jornada passou na reexecução sequencial **sem alterar código, asserção ou timeout**. [Gate inicial](gate-first-attempt.json), [log inicial](run-first-attempt.txt) e [retomada](run-resume.txt) preservados. Causa não demonstrada; a reexecução não elimina o risco.

Durante múltiplos ensaios independentes no mesmo host, o teste adicional C durou 105.509 ms, e a fase de rascunho/encaminhamento/replay 26.686 ms; a suíte C integrada durou 127.285 ms. São durações de fases com várias operações/fixtures, **não medições de uma instrução SQL específica**. O adicional na retomada sequencial durou aproximadamente 37.674 ms. Não há evidência suficiente para atribuir causa raiz ou comparar essas durações diretamente com o SELECT histórico de 32.455 ms. Na retomada sequencial, a suíte integrada B5.1 também durou aproximadamente 84.285 ms. A variabilidade persistiu em nível de suíte; não é atribuída automaticamente à concorrência entre ensaios. Logs e diferenças foram preservados.

## 7. Desempenho e observabilidade

Ensaio final com uma participação, uma versão de beneficiário, uma versão de política e um encaminhamento PENDENTE_APROVACAO. Foram 12 medições por cenário, incluindo conexão/transação. Contratos/workloads distintos; não é certificação de escala ou prova de melhoria causal. A medição inicial sem dossiê preenchido foi preservada em performance-first-observation.json; as condições diferem e não se atribui causalidade à comparação.

|Cenário|p50 ms|p95 ms|Máximo ms|
|---|---:|---:|---:|
|Detalhe B5.2 legado|${ms(p.legacy.p50)}|${ms(p.legacy.p95)}|${ms(p.legacy.max)}|
|Prévia consolidada C|${ms(p.readiness.p50)}|${ms(p.readiness.p95)}|${ms(p.readiness.max)}|
|Par de leituras C concorrentes|${ms(p.concurrent.p50)}|${ms(p.concurrent.p95)}|${ms(p.concurrent.max)}|

${p.sql.sqlOperations} operações SQL observadas, incluindo preparação do cenário e medições; p95 ${p.sql.sqlLatencyMs.p95} ms, máximo ${p.sql.sqlLatencyMs.max} ms; nenhum erro SQL nesse ensaio. Trava financeira com máximo observado ${p.sql.financialLockHeldMs.max} ms; ${p.sql.blockedSamples} amostras bloqueadas. Waits observados: ${p.sql.waits.join(', ')}. Amostragem 75 ms fornece limites inferiores de CPU/leituras, podendo perder operações curtas.

Ensaio específico da prévia C reproduziu SQL 1222 por bloqueio controlado de participação, observou bloqueador/wait/correlação, retornou HTTP 503 e recuperou após rollback; espera de applock foi observada separadamente. O ensaio herdado B5.1/B5.2 também passou. [Bloqueios na prévia](preview-lock-evidence.json), [bloqueios legados](lock-evidence.json), [performance](performance-evidence.json).

**Causas espontâneas históricas de SQL 1222 e 32.455 ms continuam NÃO DEMONSTRADAS.** Os eventos controlados não provam as causas antigas. Risco de variação sob carga, serialização financeira, histórico/payload extensos, limites do ensaio, revisão global e propriedade/retencão CT permanecem abertos. Não houve aumento de timeout nem redução de isolamento para obter aprovação.

## 8. Evidências e isolamento

[Resultado final e limpeza](final-validation.json), [gate final](gate-run.json), [SQL próprio](sql-evidence.json), [snapshots/compatibilidade](additional-evidence.json), [migração/rollback](migration-evidence.json), [interface](visual-evidence.json), [fontes](source-integrity.json), [integridade das evidências](evidence-integrity.json). Logs finais final-sql.txt, final-ui.txt, final-unit.txt, final-syntax.txt, preview-locks.txt e xlsx.txt.

[Desktop](screenshots/consolidacao-desktop.png), [mobile](screenshots/consolidacao-mobile.png), [tablet](screenshots/consolidacao-tablet.png).

${r.laboratories.length} nomes de bancos sintéticos identificados nos artefatos/registro de ciclo de vida C, inclusive referências herdadas preservadas, foram confirmados ausentes por DB_ID ao final. Fixtures encerraram seus próprios bancos. HTTP loopback, portas efêmeras e dados fictícios. Evidências anteriores foram preservadas; saídas de ciclo de vida herdadas são arquivadas no C. Nenhum banco de outra tarefa foi removido.

Sem alteração no JETTA_CONTROL/portal instalado, dados reais, credenciais, identidades/permissões Windows/SQL, sessões/chaves/flags MFA reais. Sem dependência instalada, B2D, contas a pagar efetivas, pagamento, baixa, recibo financeiro, quitação, integração bancária, promoção ou push. Migrações catalogam a permissão nova sem concedê-la a usuários reais; fixtures usam papéis sintéticos separados.

## 9. Checklist funcional e critérios GO/NO-GO

[Checklist para aprovação funcional pela Jetta e plano condicionado B5.3](CHECKLIST_E_PLANO_B5_3.md).

GO somente para revisão/homologação laboratorial dos contratos, alternativas, rascunhos/encaminhamentos e prévia C. **NO-GO para constituição efetiva B5.3 e produção** enquanto beneficiários, remuneração, documentos, tributos, competência/vencimento, segregação e segurança operacional não forem formalmente aprovados e homologados, com autorização específica de escopo/implantação. Faltas de aprovação, contexto divergente, erro técnico, política/documentação inválida ou falha de auditoria bloqueiam o cenário; não geram aprovação implícita.

## 10. Evolução B5.3

Formalizar decisões D01–D14 e exemplos de aceite; especificar contrato da obrigação sem duplicar motores; desenvolver aprovação/publicação de políticas e cálculos somente com regras aprovadas; implementar comando explícito/idempotente/atômico de constituição com revalidação de contexto, beneficiário, documentos, valores/datas, autorização, escopo, segregação e MFA; homologar operação/carga/recuperação; preparar pacote próprio de implantação/rollback sob autorização distinta. Pagamento e quitação permanecem etapas independentes, fora desta entrega.

Limitações herdadas: dossiês por participação, sem catálogo global com precedência de filial; documentação apenas referenciada, sem upload/consulta oficial/autenticação de arquivo; formatos de identificador não suportados bloqueados; competência/vencimento explícitos, sem calendário automático; matriz empresarial/concessões críticas e conflitos históricos ainda não homologados. Rascunhos/pendentes não serão promovidos automaticamente. Scripts sintéticos não devem ser liberados removendo guardas.
`);
fs.writeFileSync('../docs/GATE_B5_2C.md','# GATE_B5_2C\n\nVersão 5.0.0-b5.2c.lab.1 — PASS_LAB_WITH_RESERVATIONS, com reexecução documentada.\n\n[Gate completo](../lab-b4-2/docs/b5-2c/GATE_B5_2C.md).\n\nNO-GO para B5.3 efetivo e produção. Prévia somente leitura; obrigações/pagamentos bloqueados.\n');
