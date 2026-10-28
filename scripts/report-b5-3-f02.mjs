import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const out='docs/b5-3-f02/',read=n=>JSON.parse(fs.readFileSync(out+n)),v=read('final-validation.json'),p=read('regression/performance-evidence.json'),locks=read('regression/preview-lock-evidence.json'),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const md=`# GATE_B5_3_F02

**5.0.0-b5.3-f02.lab.1 — ${v.status}**. Base técnica: F01, commit 8008eda. Branch local ${v.branch}.

GO restrito à apresentação e preparação da homologação funcional com dados sintéticos. **NO-GO para iniciar o desenvolvimento da constituição de obrigações neste momento**: decisões formais indispensáveis e autorização específica ainda ausentes. Integração efetiva/produtiva das alçadas, implantação no JETTA_CONTROL, obrigações, pagamentos e quitação permanecem não autorizados.

## Pacote para as áreas da Jetta

| Entrega | Documento / artefato |
|---|---|
| 1. Matriz executiva D01–D14 | [Matriz executiva](MATRIZ_EXECUTIVA_D01_D14.md) e [dados do painel](decisoes.json) |
| 2. Alternativas das seis decisões prioritárias | [D01/D02/D03/D05/D09/D14](DECISOES_PRIORITARIAS.md), impactos e casos para deliberação |
| 3. Demonstração integrada | [Painel somente leitura](DEMONSTRACAO.html), [roteiro](ROTEIRO_DEMONSTRACAO.md) e [evidência executada](demo-evidence.json) |
| 4. Casos de aceite e resultados | [C01–C16](CASOS_DE_ACEITE.md), ${v.functionalCases} PASS LAB; não são aceite empresarial |
| 5. Inventário de prontas, bloqueadas e pendentes | [Lacunas A/B/C/D/E](INVENTARIO_E_LACUNAS.md) |
| 6. Checklist de aprovação formal | [Checklist e registros exigidos](CHECKLIST_E_ROADMAP.md) |
| 7. Riscos técnicos e operacionais | [R01–R16](RISCOS_TECNICOS_E_OPERACIONAIS.md) |
| 8. Regressões críticas B3/B4/B5 até F01 | [Mapa das suítes](regression-map.json), [resultados](gate-run.json) e [validação final](final-validation.json) |
| 9. Roadmap operacional e implantação futura | [Portões G0–G4](CHECKLIST_E_ROADMAP.md), sem execução produtiva |
| 10. GO/NO-GO para desenvolver constituição | Fundamentação abaixo e condições G1 do checklist |

D04 (valor individual), D06 (vencimento configurável/exceções) e D12 (alçadas/segregação) continuam propostas escolhidas, **pendentes de aprovação empresarial formal**. Demais decisões permanecem pendentes. Nenhuma alternativa foi escolhida pela Jetta por inferência. Pessoas responsáveis, aprovadores, versões de decisão, vigências, escopos, exceções e referências precisam ser preenchidos nos registros reais; datas/valores LAB não são padrões empresariais.

## Jornada e significado dos estados

O ensaio executa ${v.journeySteps} etapas: cadastro → atividade → contratação individual → entrada → saída → conferência → fechamento → comprovante → elegibilidade → solicitação → decisão B5.2 → prontidão → vencimento simulado → tentativa de pré-validação após decisão.

A participação de 100,00 recebe decisão APROVADA B5.2 **somente no banco sintético**, por ator independente. A prévia continua BLOQUEADA. A simulação produz uma data de proposta, com data efetiva nula. Após a decisão B5.2, F01 recusa SOLICITACAO_PENDENTE_OBRIGATORIA, respeitando o contrato atual. Não reabre nem substitui autorização.

No ramo complementar, a segunda participação da mesma atividade (123,45) permanece PENDENTE B5.2 após duas identidades completarem etapas APTO_LAB. **APTO_LAB não é aprovação financeira.** Os snapshots C11 descrevem o instante do ensaio, anterior à revogação/restauração de acesso C12; não certificam validade corrente após mudanças. A integração das alçadas ao ponto B5.2 existente não foi feita. C16 verifica BLOQUEADA_POLITICA no serviço e recusa SQL, com ObrigacaoPreparada vazia/protegida.

C01–C16 cobrem valores diferentes, ausência sem desconto, divergência de horário, documento vencido, beneficiário distinto, alteração de valor recusada, ausência de marco, exceção recusada, autoaprovação, valor acima do teto, duas identidades, revogação/restauração de acesso, fracionamento conservador, baseline sem prova e alterações após fechamento/autorização. A demonstração contém observações reais dos contratos existentes, sem substituir resultados por mocks.

## Mudanças técnicas e compatibilidade

Nenhum motor, tabela, procedimento, endpoint financeiro ou fluxo operacional novo. Nenhuma alteração em src/public/sql do laboratório. Foram acrescentados roteiro executável, cópias das suítes críticas com saídas F02, documentos e painel HTML estático somente leitura. Dois helpers de registro de evidência ganharam destino F02 para preservar os artefatos anteriores; versão do pacote identifica esta entrega. O painel não chama APIs nem permite decisões/assinaturas. O portal principal não foi alterado.

As cópias críticas preservam adaptações F01: alteração de valor confirmado deve ser recusada (55210), sem remover trigger; teste independente de mudança operacional conserva a validação de contexto. Não houve aumento de timeouts. Migração/down/reaplicação e falhas de auditoria continuam apenas em SQL sintético.

## Resultados laboratoriais

| Verificação reexecutada | Resultado |
|---|---:|
| Unitários existentes | ${v.unit} PASS |
| Testes SQL/HTTP críticos, incluindo F01 e migração | ${v.sql} PASS em ${v.sqlSuites} suítes |
| Interface operacional/financeira crítica | ${v.regressionUi} PASS em ${v.regressionUiSuites} suítes |
| Painel documental desktop/mobile/tablet, busca e ausência de escrita | ${v.packageUi} PASS |
| Casos funcionais da demonstração | ${v.functionalCases} PASS |
| Sintaxe | ${v.syntaxFiles} arquivos; zero falhas |
| Bancos sintéticos inventariados e removidos | ${v.laboratories.length} |

[Log das regressões](run.txt), [demonstração](demo.txt), [UI do pacote](package-visual-evidence.json), [sintaxe](syntax.txt). RBAC, MFA, abrangência, imutabilidade, idempotência, concorrência, auditoria e rollback foram reexecutados. Paginação e exportação somente da página foram preservadas/testadas. Esta seleção é regressão **crítica**, não uma alegação de repetição de todas as suítes históricas ou homologação empresarial. Evidências F01 anteriores foram preservadas.

## Performance, concorrência e recuperação

Amostra sintética pequena, 12 medições por cenário; sem SLO/carga representativa aprovados e sem afirmar ganho causal:

| Consulta | p50 ms | p95 ms | máximo ms |
|---|---:|---:|---:|
| Referência B5.2 | ${p.legacy.p50.toFixed(2)} | ${p.legacy.p95.toFixed(2)} | ${p.legacy.max.toFixed(2)} |
| Participação F01 | ${p.participant.p50.toFixed(2)} | ${p.participant.p95.toFixed(2)} | ${p.participant.max.toFixed(2)} |
| Vencimento simulado | ${p.due.p50.toFixed(2)} | ${p.due.p95.toFixed(2)} | ${p.due.max.toFixed(2)} |
| Pares concorrentes | ${p.concurrent.p50.toFixed(2)} | ${p.concurrent.p95.toFixed(2)} | ${p.concurrent.max.toFixed(2)} |

[Detalhe de métricas](regression/performance-evidence.json). Os ${locks.cases.length} ensaios de [locks](regression/preview-lock-evidence.json) passaram: SQL 1222 controlado/correlacionado, HTTP 503 e recuperação por rollback, além de espera Shared/Exclusive sem reduzir isolamento. **Causas históricas do SQL 1222 e da latência de 32.455 ms continuam não demonstradas.** Ausência de repetição espontânea não significa eliminação.

Rollback transacional e down/reaplicação foram ensaiados; **backup/restore completo não foi executado**. Restauração e reconciliação de CT, capturas, auditoria, autorizações e contexto/sessões/cursores/andamento exigem homologação operacional autorizada. Retenção CT, capacidade, custódia e suporte permanecem dependências. Ver riscos R09–R15.

## GO/NO-GO fundamentado

**GO G0:** pacote pronto para reunião e revisão funcional sintética. Não significa que Gestão, Financeiro, Diretoria, Jurídico ou Contábil já homologaram o processo.

**NO-GO G1 neste momento:** D01/D02/D03/D05/D09/D14 estão indefinidos e D04/D06/D12 ainda não têm aprovação formal. Faltam nomes competentes, regras exatas, vigências, transição e exceções, matriz operacional e autorização específica de desenvolvimento. D07/D08/D10/D11 precisam ser resolvidos ou ter cenários expressamente excluídos antes de iniciar constituição. Não basta aprovação técnica do F02.

Para reconsiderar G1: apresentar registros formais e exemplos aprovados para escopo delimitado, resolver dependências indispensáveis, aprovar contratos/transições e receber autorização específica. G2/G3 ainda exigirão implementação/homologação e operação/segurança/capacidade/recuperação aprovadas; G4 pagamentos/quitação é escopo separado. O roadmap não executa nem autoriza essas etapas.

## Integridade e restrições

[source-integrity.json](source-integrity.json) registra SHA-256 de ${v.sourceFiles} arquivos de fonte/contrato; evidence-integrity.json registra hashes dos artefatos, exceto ele próprio. São verificações de integridade, não assinaturas empresariais. Bancos aleatórios sintéticos e portas efêmeras; ${v.principalAccesses} acessos ao banco principal no escopo executado. Sem mudança de identidades Windows, permissões SQL reais, credenciais/sessões/MFA reais, sem B2D, sem ativar MFA obrigatório e sem push.

**Nenhuma obrigação, pagamento, baixa, quitação, recibo financeiro ou integração bancária foi criada ou habilitada. JETTA_CONTROL e o portal principal permaneceram intactos. Produção não está pronta.**
`;
fs.writeFileSync(out+'GATE_B5_3_F02.md',md);fs.writeFileSync('../docs/GATE_B5_3_F02.md','# GATE_B5_3_F02\n\n5.0.0-b5.3-f02.lab.1 — '+v.status+'.\n\n[Relatório e pacote completos](../lab-b4-2/docs/b5-3-f02/GATE_B5_3_F02.md). GO para revisão funcional sintética; NO-GO para desenvolvimento de constituição sem decisões formais e autorização específica. Nenhuma obrigação ou pagamento habilitado.\n');
const source=read('source-integrity.json');for(const f of source.files)if(hash(f.file)!==f.sha256)throw Error('Fonte alterada '+f.file);const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name).replaceAll('\\','/');if(e.isDirectory())walk(file);else if(file!==out+'evidence-integrity.json')files.push({file,sha256:hash(file)});}}walk(out);files.push({file:'../docs/GATE_B5_3_F02.md',sha256:hash('../docs/GATE_B5_3_F02.md')});fs.writeFileSync(out+'evidence-integrity.json',JSON.stringify({algorithm:'sha256',sourceFilesVerified:source.files.length,files:files.sort((a,b)=>a.file.localeCompare(b.file))},null,2)+'\n');for(const f of files)if(hash(f.file)!==f.sha256)throw Error('Evidencia alterada '+f.file);console.log('GATE F02 escrito; SHA256 PASS: '+source.files.length+' fontes, '+files.length+' artefatos');
