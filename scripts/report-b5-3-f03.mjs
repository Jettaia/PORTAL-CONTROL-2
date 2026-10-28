import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';const out='docs/b5-3-f03/',read=n=>JSON.parse(fs.readFileSync(out+n)),v=read('final-validation.json'),p=read('performance-evidence.json'),sql=read('sql-evidence.json'),sec=read('security-evidence.json'),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const cases=[...sql.steps.map(s=>({id:s.id,name:s.name,status:s.status})),{id:'H17',name:'Migração transacional, down vazio, down com dados recusado e reaplicação',status:'PASS'},...sec.steps.map((s,i)=>({id:'S0'+(i+1),name:s.name,status:s.status}))].sort((a,b)=>a.id.localeCompare(b.id));fs.writeFileSync(out+'CASOS_E_EVIDENCIAS.md','# Casos funcionais e evidências F03\n\nPASS significa comportamento técnico esperado em banco sintético, inclusive recusa; não é aceite empresarial.\n\n| ID | Caso executado | Resultado |\n|---|---|---|\n'+cases.map(c=>'| '+c.id+' | '+c.name+' | '+c.status+' |').join('\n')+'\n\n[Observações e snapshots SQL](sql-evidence.json), [segurança complementar](security-evidence.json), [migração](migration-evidence.json), [interface](visual-evidence.json). Unitários cobrem UTC/local em meses diferentes, fronteiras, serviços multidiários, ausência, correção, fuso, reabertura e precedência/empate. H06/H07 usam eventos novos semeados em SQL sintético com instantes UTC de fronteira; não alteram evento imutável, relógio real, sessão ou segredo real. O relatório registra o mês do fechamento sem usá-lo para calcular a competência.\n\nH20 verifica que repetir o novo fuso ou declarar novamente período não reaberto não apaga os impedimentos históricos. S03 altera somente concessões RBAC de identidades fictícias no banco descartável para comprovar segregação histórica; nenhuma permissão Windows/SQL real é alterada. S04 comprova que representação documental completa continua apenas LAB, com tributos e constituição bloqueados. H05/H12/H21 preservam snapshots/autorizações/comprovante anteriores.\n');
const md=`# GATE_B5_3_F03

**5.0.0-b5.3-f03.lab.1 — ${v.status}**. Base F02, commit 31fb1e5. Branch local ${v.branch}.

**GO somente para revisão e homologação das propostas em laboratório. NO-GO para implantação, habilitação jurídica/financeira efetiva, constituição, pagamentos, baixas ou quitação.** Nenhuma das sete propostas recebeu aprovação empresarial formal. JETTA_CONTROL e o portal principal não foram modificados.

## Entregas

| Item solicitado | Artefato |
|---|---|
| 1. Matriz D01–D14 | [Matriz atualizada](MATRIZ_D01_D14.md); sete propostas escolhidas, sem aprovação formal |
| 2. Especificação D01/D02/D05/D14 | [Especificação funcional](ESPECIFICACAO_E_CONTRATO.md) |
| 3. Contrato B5.3-F03 versionado | [Contrato HTTP, modelos e limites](ESPECIFICACAO_E_CONTRATO.md) |
| 4. Modelo de dados e justificativa | [Decisão anterior à implementação](ARQUITETURA_E_ALTERACOES.md); zero tabelas novas |
| 5. Casos e testes | [Casos/evidências](CASOS_E_EVIDENCIAS.md), [SQL](sql-evidence.json), [UI](visual-evidence.json) |
| 6. Segregação/autorização/concorrência | [Segurança complementar](security-evidence.json) e H13–H16/H19 |
| 7. Regressão integrada | [Mapa exato](regression-map.json), [execução](gate-run.json), [validação final](final-validation.json) |
| 8. Dependências/decisões pendentes | [Matriz, registros e roadmap condicionado](DEPENDENCIAS_E_GO_NO_GO.md) |
| 9. Performance/riscos | [Métricas](performance-evidence.json), [bloqueios controlados](preview-lock-evidence.json), [riscos](RISCOS_RESIDUAIS.md) |
| 10. SHA-256 e isolamento | [Fonte](source-integrity.json), evidence-integrity.json e [inventário/limpeza](final-validation.json) |
| 11. GO/NO-GO | Fundamentação abaixo e [portões condicionados](DEPENDENCIAS_E_GO_NO_GO.md) |

## Resultado funcional

D01: catálogo PF/PJ independente, sem deduzir enquadramento por documento/tipo operacional. D02: próprio documento declarado é candidato, terceiro exige exceção/representação; sem comprovação, bloqueia. D05: sugestão de mês da execução pelos apontamentos UTC e fuso declarado/versionado por participação; competência efetiva sempre null. D14: políticas comuns, de filial e depósito aparecem como candidatas; não há precedência empresarial automática. Simulação de ordem só existe em fixture explicitamente declarada e não ativa política.

D04/D06/D12 anteriores foram preservadas. Habilitação financeira permanece false; aprovação formal null. Configurar/publicar/validar LAB não aprova tributo, remuneração, obrigação ou pagamento. Documento com dígitos válidos ou referência/hash não autentica identidade, parecer ou representação.

A declaração F03 referencia prestador/participação existentes, beneficiário B5.2B exato e versões de políticas/fuso. Uma alteração de beneficiário/política/contexto não reescreve nem revalida autorização histórica. Repetir declaração não regulariza mudança anterior de fuso ou período reaberto. Contexto operacional não regular impede sugestão. Casos multidiários, travessia de mês, ausência e correção não rejeitada continuam sem regra complementar.

## Arquitetura e interface

Foram ampliados RegraFuncional/EventoRegraFuncional F01 e ProntidaoVersao/ProntidaoDecisao B5.2B; **nenhuma tabela, cadastro paralelo de pessoa/beneficiário ou motor financeiro novo**. Tipos F01 continuam por depósito; novos tipos MODALIDADE/CORRESPONDENCIA/COMPETENCIA suportam os três níveis. Dossiê CONTRATACAO fica isolado no contrato F03; APIs anteriores continuam expondo apenas seus tipos originais. São ${v.changeTrackingTables} tabelas com CT, sem retirar dependências de paginação.

A tela de laboratório foi ligada em Parâmetros → Contratação e competência, preservando identidade Jetta. Exibe modalidade/habilitação bloqueada, beneficiário/vínculo, documentos/pendências, UTC/local/origem/hash da competência, candidatas/conflitos e histórico. Não copia automaticamente identidade jurídica nem presume fuso. Desktop/mobile/tablet passaram; falha técnica/sessão ausente limpa dados e ações. Não há botão de constituição ou pagamento.

Configuração comum/filial exige concessão global explícita e acesso em todos os depósitos ativos descendentes. A leitura permanece recortada por depósito; ADMIN não burla RBAC. Autor/publicador e autor/validador são independentes. MFA, escopo, segregação atual/histórica, hash/versão e fonte são revalidados na transação SERIALIZABLE existente, com locks e timeouts preservados. Auditoria/gravação atômicas; concorrência/replay não duplicam comandos ou decisões.

## Homologação executada

| Verificação | Resultado |
|---|---:|
| Unitários finais | ${v.unit} PASS |
| SQL/HTTP próprios, migração e segurança | ${v.ownSql} PASS |
| Casos funcionais próprios documentados | ${v.functionalCases} PASS |
| Regressões SQL/HTTP críticas B3/B4/B5 até F01 | ${v.regressionSql} PASS em ${v.regressionSqlSuites} suítes |
| Demonstração integrada F02 reexecutada | ${v.regressionF02Cases} casos PASS |
| Interface própria F03 | ${v.ownUi} PASS |
| Interface crítica anterior | ${v.regressionUi} PASS em ${v.regressionUiSuites} suítes |
| Excel autorizado | 3 arquivos verificados com openpyxl |
| Sintaxe final | ${v.syntaxFiles} arquivos, zero falhas |
| Fontes/contratos com SHA-256 | ${v.sourceFiles} |
| Bancos sintéticos inventariados/removidos | ${v.laboratories.length} |

Foram executadas as suítes críticas SQL B3.3/B3.4 contratos/planejamento/observabilidade, B4.1/B4.2/B4.3, B5.1/B5.2/B5.2A/B5.2B/B5.2C, F01 principal/complementar/migração, além da demonstração F02 e casos F03. Interfaces anteriores reexecutadas: B5.2C, paginação B5.2A e F01. Paginação optativa, escopo, exportação **somente da página**, texto literal/sem fórmulas e valores exatos foram preservados. Não houve exportação da carteira completa por conversão da página.

**Não executado neste bloco:** todas as UIs históricas B3/B4/B5.1 ou painel documental estático F02, todas as migrações antigas, carga representativa/SLO produtivo, backup/restore completo, homologação física/dispositivos reais, aprovação empresarial/jurídica/contábil/fiscal ou implantação. O mapa lista exatamente as suítes selecionadas; não se declara regressão histórica total.

[SQL final](f03-sql.txt), [segurança final](final-security.txt), [unitários](final-unit.txt), [sintaxe](final-syntax.txt), [Excel](xlsx.txt). Migração: rollback transacional, aplicação idempotente, down sem dados e reaplicação preservam tabelas/valores/hashes anteriores; down com dados F03 é recusado (55301), evitando perda de evidência. Os bloqueios de ObrigacaoPreparada permaneceram ativos; tabela vazia.

## Falhas de desenvolvimento preservadas

first-sql.txt/sql-recheck.txt/sql-recheck-2.txt registram: expressão agregada com subconsulta não aceita pelo SQL Server (abrangência reescrita em consultas equivalentes), ordenação de coluna nvarchar(max) incompatível com o driver ODBC (JSON movido para o fim da projeção), e montagem de cenário B4 enquanto trigger de falha estava instalado (preparação movida para antes da injeção). Nenhum controle financeiro ou timeout foi reduzido. sql-recheck-3.txt e as execuções finais passaram.

A primeira regressão integrada falhou ao gravar evidência em diretório ainda inexistente; o gerador passou a preparar somente as pastas F03 necessárias. gate-first-attempt.json/run-first-attempt.txt preservam essa tentativa. run-resume.txt contém a retomada. Esses erros não são ocultados pelo PASS final.

## Performance e contenção

12 amostras por cenário, banco pequeno/sintético; não demonstra capacidade produtiva ou ganho causal:

| Cenário | p50 ms | p95 ms | máximo ms |
|---|---:|---:|---:|
| Prévia F01 de referência | ${p.f01.p50.toFixed(2)} | ${p.f01.p95.toFixed(2)} | ${p.f01.max.toFixed(2)} |
| F03: competência e candidata única | ${p.f03Single.p50.toFixed(2)} | ${p.f03Single.p95.toFixed(2)} | ${p.f03Single.max.toFixed(2)} |
| F03: candidatas conflitantes | ${p.f03Conflict.p50.toFixed(2)} | ${p.f03Conflict.p95.toFixed(2)} | ${p.f03Conflict.max.toFixed(2)} |
| Duas consultas F03 concorrentes | ${p.concurrent.p50.toFixed(2)} | ${p.concurrent.p95.toFixed(2)} | ${p.concurrent.max.toFixed(2)} |

O detalhe registra duração de transações/trava financeira, SQL, amostras de bloqueio e erros. A leitura usa Shared na mesma trava B51; escritor Exclusive aguarda/serializa conforme contrato. SQL 1222 foi reproduzido intencionalmente com bloqueador/correlação, resposta 503 e recuperação após rollback, sem relaxar isolamento ou aumentar timeout.

**Causas históricas do SQL 1222 e da latência de 32.455 ms continuam NÃO DEMONSTRADAS.** Ausência de repetição espontânea não prova resolução. CT/retenção, histórico crescente, autenticação, privilégio mínimo, restauração/reconciliação e homologação física continuam dependências operacionais, conforme matriz de riscos. Rollback/reaplicação não equivalem a restauração de backup.

## GO/NO-GO e isolamento

GO restrito à análise/homologação sintética destas propostas. **NO-GO financeiro/produtivo:** as sete propostas carecem de aprovação formal, D03/D09 continuam pendentes, precedência D14 e casos ambíguos de competência não foram resolvidos, e faltam homologação operacional/segurança/recuperação e autorização específica. A escolha do catálogo comum não escolheu a ordem de precedência. Nada deste bloco permite constituir obrigações.

Para reconsiderar o portão: registros nominais independentes, referências verificáveis, versões/vigências/escopos/exceções, requisitos jurídicos/documentais/fiscais aprovados, exemplos exatos para ambiguidades e transição de casos já autorizados; depois novo mandato para integração/constituição e homologação operacional. Pagamentos/quitação exigirão escopo próprio.

Branch independente e commits somente locais, sem push. SQL apenas em nomes aleatórios estritamente sintéticos; portas HTTP efêmeras. A verificação final confirmou remoção dos nomes inventariados; nenhum banco principal foi acessado. O catálogo master também apontou um banco sintético anterior à missão, criado em 21/10 e fora do inventário F03. Foi preservado sem leitura de conteúdo ou alteração; ver isolation-note.json. Não se declara limpeza geral de bancos de outras execuções. Evidências F01/F02 preservadas. Manifesta-se SHA-256 das fontes e artefatos (exceto o próprio manifesto); não é assinatura empresarial.

**Nenhuma credencial, identidade, permissão Windows/SQL real, sessão/segredo/flag MFA real foi alterada. Sem B2D, sem ativação de regra financeira real, obrigação, pagamento, baixa, quitação, recibo financeiro, integração bancária ou push remoto. JETTA_CONTROL e o portal principal permanecem intactos.**
`;
fs.writeFileSync(out+'GATE_B5_3_F03.md',md);fs.writeFileSync('../docs/GATE_B5_3_F03.md','# GATE_B5_3_F03\n\n5.0.0-b5.3-f03.lab.1 — '+v.status+'.\n\n[Relatório completo](../lab-b4-2/docs/b5-3-f03/GATE_B5_3_F03.md). Sete propostas sem aprovação formal. GO apenas laboratorial; NO-GO para constituição, pagamentos e produção.\n');const source=read('source-integrity.json');for(const f of source.files)if(hash(f.file)!==f.sha256)throw Error('Fonte alterada: '+f.file);const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name).replaceAll('\\','/');if(e.isDirectory())walk(file);else if(file!==out+'evidence-integrity.json')files.push({file,sha256:hash(file)});}}walk(out);files.push({file:'../docs/GATE_B5_3_F03.md',sha256:hash('../docs/GATE_B5_3_F03.md')});fs.writeFileSync(out+'evidence-integrity.json',JSON.stringify({algorithm:'sha256',sourceFilesVerified:source.files.length,files:files.sort((a,b)=>a.file.localeCompare(b.file))},null,2)+'\n');for(const f of files)if(hash(f.file)!==f.sha256)throw Error('Evidencia alterada '+f.file);console.log('GATE F03 e SHA256 PASS: '+source.files.length+' fontes, '+files.length+' evidencias');
