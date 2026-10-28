import fs from 'node:fs';
const out='docs/b5-3-f01/',read=n=>JSON.parse(fs.readFileSync(out+n)),v=read('final-validation.json'),p=read('performance-evidence.json'),locks=read('preview-lock-evidence.json');
const md=`# GATE_B5_3_F01

Versão **5.0.0-b5.3-f01.lab.1** — **${v.status}**.

Homologação exclusivamente laboratorial. **Nenhuma obrigação, pagamento, baixa, quitação, recibo financeiro ou integração bancária foi habilitado. JETTA_CONTROL e o portal principal não foram modificados. NO-GO para constituição e produção.**

## Escopo entregue

D04, D06 e D12 possuem propostas escolhidas para especificação, pendentes de aprovação formal. D01/D02/D03/D05/D07/D08/D09/D10/D11/D13/D14 permanecem pendentes. Fixtures, faixas, calendários e referências LAB não são políticas empresariais aprovadas.

- [Matriz D01–D14](MATRIZ_D01_D14.md): alternativas, impactos, dependências e registro formal exigido.
- [Especificação funcional e técnica](ESPECIFICACAO_FUNCIONAL.md): D04/D06/D12, dados, contratos, segregação, concorrência e reversão.
- [Checklist e plano condicionado](CHECKLIST_E_EVOLUCAO.md): responsáveis, aprovações, critérios GO/NO-GO e evolução futura.

## D04 — remuneração individual

B3 continua fonte do valor fixo individual por participação. Captura na confirmação, imutável por trigger SQL, vincula participação, prestador, atividade, valor, versão e contexto. Duas pessoas na mesma atividade conservam valores distintos (exemplo sintético 100,00 e 123,45; soma exata 223,45), sem multiplicação por tempo ou rateio. Indicadores de custo respeitam depósito e usam decimal SQL; valores monetários em contratos permanecem strings exatas/BigInt.

Contratos preexistentes sem prova da captura são BASELINE_NAO_VERIFICADA e bloqueiam pré-validação de alçada. Não se inventa valor original nem se altera autorização histórica. Cancelamentos e revisões remuneratórias futuras dependem de D07/D08/D11.

## D06 — vencimento e exceções

Regras versionadas por depósito possuem marco, prazo, contagem, calendário explícito/versionado, vigência, responsável, conteúdo hash, encaminhamento, publicação laboratorial independente e revogação. Ausência de dados não recebe padrão. Simulação exige data e referência declaradas, mantém data efetiva nula e não define competência D05.

Exceção conserva regra/data original, proposta, justificativa, contexto e auditoria; decisão única independente, MFA recente e transação atômica. Nova versão/revogação não reescreve exceções nem snapshots. Ensaios cobrem calendário, conflito, independência, concorrência e histórico.

## D12 — alçadas e segregação

Perfis/concessões explícitos, ação, depósito, faixa mínima inclusiva/máxima exclusiva, vigência, MFA e quantidade de aprovadores são configuráveis; um ou dois aprovadores é limite de homologação, sem faixa empresarial padrão. Autor/configurador, publicador, solicitante financeiro, histórico documental e de exceções não podem se autoaprovar. Duas etapas exigem identidades distintas e ordem; mudança/revogação/restauração de acesso invalida andamento por Change Tracking. Políticas simultâneas aplicáveis ao mesmo ator são bloqueadas como ambíguas; não se escolhe a menor exigência.

As etapas APTO_LAB são **pré-validação de governança**, sem escrever decisão financeira B5.2. Mesmo completas deixam a solicitação PENDENTE. Integração efetiva ao ponto decisório existente requer aprovação e autorização específica. Ações futuras de constituição/pagamento/quitação não estão disponíveis.

Bloqueio conservador soma capturas da mesma atividade e mesmo prestador/depósito/data; atingir teto com múltiplas participações impede pré-validação. Preserva capturas mesmo após mudança de status. Não demonstra detecção universal de fracionamento e pode gerar falsos positivos; agrupamento/precedência D14 permanecem pendentes.

## Modelo e compatibilidade

Seis tabelas novas: ContratoIndividual, RegraFuncional, EventoRegraFuncional, ExcecaoVencimentoLab, DecisaoExcecaoVencimentoLab e EtapaAlcadaLab. A especificação demonstra sua necessidade sem duplicar participação, comprovante, elegibilidade, solicitação/decisão ou conta a pagar. Contratos F01 usam schema B5.3-F01-1.0.0 e rotas /api/b53f01; B4.3/B5.1/B5.2/B5.2A/B5.2B/B5.2C continuam fontes.

Paginação optativa e exportação somente da página foram revalidadas. ObrigacaoPreparada permanece vazia e protegida pelos bloqueios anteriores. São 31 tabelas com CT no esquema integrado; down preserva CT de segurança preexistente e bloqueios financeiros, restando 25. Reaplicação não reconstrói prova histórica descartada. Down laboratorial exige arquivar registros F01 se for preciso recuperá-los.

## Interface

Administração em Parâmetros → Regras financeiras, preservando menu e identidade. Mostra valor individual/autorizado quando existente, regra/versionamento, pendências, exceções, candidatos e histórico. Desktop/mobile/tablet sem extravasamento horizontal; acesso tablet operacional às rotas financeiras continua negado. Não exibe líquido/retenções sem regra fiscal. Veja [evidência UI](visual-evidence.json) e screenshots/.

## Homologação e evidências

| Verificação | Resultado |
|---|---:|
| Unitários | ${v.unit} PASS |
| SQL/HTTP próprios, incluindo migração | ${v.ownSql} PASS |
| Regressão SQL B3/B4/B5 integrada | ${v.regressionSql} PASS |
| Interface própria | ${v.ownUi} PASS |
| Regressão interface | ${v.regressionUi} PASS |
| Suítes de regressão integradas | ${v.regressionSuites} |
| Sintaxe | ${v.syntaxFiles} arquivos, 0 falhas |
| Excel autorizado | 3 artefatos verificados |
| Bancos sintéticos inventariados e removidos | ${v.laboratories.length} |

[Execução integrada](gate-run.json), [SQL/HTTP final](final-sql.txt), [unitários finais](final-unit.txt), [migração/rollback/reaplicação](migration-evidence.json), [validação final e limpeza](final-validation.json), [Excel](xlsx.txt).

Cobertura inclui fixação/duplicidade, soma exata, políticas inválidas/ausentes, calendário, autor/publicador distintos, idempotência, concorrência, auditoria com falha/rollback, RBAC, MFA, abrangência, duas identidades, faixas, ambiguidade, segregação histórica, revogação/restauração CT, integridade de snapshots e bloqueios SQL diretos. Regressões de valor confirmado agora esperam recusa 55210 e usam mudança de horário para continuar verificando contexto; não removem trigger nem usam bypass. Testes de alteração anterior à confirmação conservam seu comportamento.

O primeiro ensaio SQL (first-sql.txt) incluiu o segundo prestador após a confirmação da atividade, contrariando o fluxo B3; a fixture foi corrigida para incluir ambos antes de confirmar (sql-recheck.txt). A primeira execução integrada falhou na contagem estrutural antiga de tabelas operacionais (17→18), preservada em gate-first-attempt.json/run-first-attempt.txt. A expectativa foi atualizada para o esquema integrado e a regressão repetida. Esses registros não são ocultados pelo resultado final. Ver final-sql.txt para reexecução dos controles finais acrescentados após o início da suíte longa.

## Desempenho e riscos residuais

Amostra pequena/sintética, 12 chamadas por cenário, sem equivalência de carga/cache que permita afirmar ganho causal:

| Cenário | p50 ms | p95 ms | máximo ms |
|---|---:|---:|---:|
| Consulta B5.2 de referência | ${p.legacy.p50.toFixed(2)} | ${p.legacy.p95.toFixed(2)} | ${p.legacy.max.toFixed(2)} |
| Prévia F01 | ${p.participant.p50.toFixed(2)} | ${p.participant.p95.toFixed(2)} | ${p.participant.max.toFixed(2)} |
| Simulação vencimento | ${p.due.p50.toFixed(2)} | ${p.due.p95.toFixed(2)} | ${p.due.max.toFixed(2)} |
| Pares concorrentes | ${p.concurrent.p50.toFixed(2)} | ${p.concurrent.p95.toFixed(2)} | ${p.concurrent.max.toFixed(2)} |

[Performance](performance-evidence.json) contém distribuição SQL/locks/transações. [Bloqueios controlados](preview-lock-evidence.json): ${locks.cases.length} cenários PASS, SQL 1222 reproduzido/correlacionado com bloqueador, HTTP 503 e recuperação após rollback, além de espera Shared/Exclusive sem reduzir isolamento. Isso **não demonstra a causa histórica eliminada**. A latência histórica de 32.455 ms também permanece com causa não demonstrada. Não há SLO/capacidade produtiva aprovada. SERIALIZABLE/trava global e CT exigem monitoramento/capacidade; retenção CT e perda de rastreamento podem invalidar consultas/andamento.

Outros riscos: aprovação jurídica/fiscal/documental ausente; referências de documentos não comprovam autenticidade; marco declarado precisa prova futura; calendário/políticas precisam dono e aprovação; captura histórica não verificada; heurística de agrupamento incompleta; limite de dois aprovadores é técnico; estados LAB nunca migram automaticamente para aprovação formal. Falha técnica/auditoria não produz resultado financeiro positivo.

## Integridade e governança

Branch codex/b5-3-f01-especificacao, commits exclusivamente locais, sem push. Somente bancos aleatórios sintéticos e portas efêmeras. Nenhuma credencial, sessão real, flag MFA, identidade ou permissão Windows/SQL real foi alterada; sem B2D e sem ativação de MFA obrigatório. As concessões de teste pertencem exclusivamente aos bancos descartáveis.

[source-integrity.json](source-integrity.json) registra SHA-256 dos ${v.sourceFiles} arquivos de código/contrato; evidence-integrity.json registra hashes dos artefatos, exceto ele próprio. Manifestos verificáveis por recomputação; não constituem assinatura externa de aprovação.

## GO/NO-GO e próximo bloco

GO restrito à revisão funcional/homologação deste laboratório. NO-GO para regras efetivas, constituição, pagamentos ou produção. Aprovação formal deve identificar versão, vigência, responsável, aprovador independente, referência e impactos; todas as dependências indispensáveis precisam estar resolvidas e os controles operacionais homologados.

O [plano condicionado](CHECKLIST_E_EVOLUCAO.md) exige decisões formais, integração autorizada da alçada ao B5.2 existente, cálculo fiscal/competência/vencimento aprovado, comando futuro idempotente de constituição e homologação operacional/migração própria. Pagamentos/quitação serão escopo separado. **A conclusão deste bloco não declara B5.3 financeiro ou produção aptos.**
`;
fs.writeFileSync(out+'GATE_B5_3_F01.md',md);fs.writeFileSync('../docs/GATE_B5_3_F01.md','# GATE_B5_3_F01\n\n5.0.0-b5.3-f01.lab.1 — '+v.status+'.\n\n[Relatório completo](../lab-b4-2/docs/b5-3-f01/GATE_B5_3_F01.md). Nenhuma obrigação ou pagamento habilitado. NO-GO para constituição e produção.\n');console.log('GATE escrito');
