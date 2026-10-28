import fs from 'node:fs';
const out='docs/b5-2b/',r=JSON.parse(fs.readFileSync(out+'final-validation.json')),p=JSON.parse(fs.readFileSync(out+'performance-evidence.json'));const ms=v=>Math.round(v*100)/100;
fs.writeFileSync(out+'GATE_B5_2B.md',`# GATE_B5_2B

Versão **5.0.0-b5.2b.lab.1** · branch **codex/b5-2b-prontidao** · base **1912c1f / B5.2A** · 23/10/2026.

**Resultado técnico: PASS_LAB_WITH_RESERVATIONS. Exclusivamente laboratório. NO-GO para B5.3 efetivo e produção. Implantação no JETTA_CONTROL NÃO AUTORIZADA.**

## Entrega

Dossiês versionados de beneficiário e política por participação, com identidade jurídica própria, vínculo explícito ao prestador/contexto, documentação referenciada, vigência, impacto, responsáveis, decisão independente e auditoria. Não se presume que o prestador operacional seja o beneficiário financeiro. Nenhuma consulta cadastral externa, aprovação jurídica ou enquadramento fiscal é fabricado.

Propostas de valor fixo por participação, atividade ou turno; competência e vencimento somente quando explicitamente informados. O valor proposto é separado do contratado/autorizado. Bruto, retenções e líquido permanecem nulos. Rateio, tributos, descontos, adicionais, alterações retroativas e regras relativas/calendários não foram ativados. A validação de proposta não torna a política juridicamente aprovada ou aplicável a pagamento.

Avaliação determinística informa beneficiário não validado, documentação incompleta/vencida, política ausente/inválida/fora de vigência, competência/vencimento indefinidos, contexto desatualizado e autorização inválida/ausente. Além disso, mantém bloqueios incondicionais de regra tributária não aprovada, segurança operacional pendente e constituição não autorizada. O contrato B5.2B-1.0.0 tem hash de resultado/referências, sem efeito financeiro.

Duas tabelas novas: Financeiro.ProntidaoVersao e ProntidaoDecisao. Histórico imutável com hash, predecessor, UTC e auditoria; uma decisão por versão; autoaprovação bloqueada no serviço e SQL. Nova versão não reaproveita a validação anterior. Campos extras fiscais/retroativos são recusados. Escrita e auditoria são atômicas, com predecessor otimista, chave idempotente de proposta, serialização financeira e revalidação transacional de RBAC, abrangência e MFA recente. Decisões repetidas são recusadas e exigem consulta, sem retry automático.

[Modelo de beneficiários, documentação, políticas, prontidão, segregação e rollback](MODELO_E_GOVERNANCA.md). [Matriz de 12 decisões pendentes, evolução e critérios GO/NO-GO](DECISOES_E_GO_NO_GO.md).

## Interface e compatibilidade

Financeiro > Autorizações financeiras contém acesso à prontidão por participação. Formulários de beneficiário/política, pendências legíveis, histórico, documento mascarado e validação independente. Testadas telas desktop, mobile e tablet, sem overflow, autoaprovação negada, sessão ausente e falha de rede limpando resultados. O validador independente completa os formulários de decisão, mas os bloqueios fiscais/constituição permanecem.

B5.1, B5.2 e paginação optativa B5.2A preservados. Teste próprio compara a autorização completa antes/depois do dossiê e confirma igualdade dos snapshots/estado B5.2. A nova escrita participa do Change Tracking global e pode invalidar cursor, exigindo reinício explícito. Exportação de página continua identificada SOMENTE_PAGINA; não foi convertida em exportação da carteira completa. Regressões validam Excel, escopo autorizado e ausência de fórmulas executáveis.

## Homologação

|Grupo|Resultado final|
|---|---|
|Unitários|${r.unit} PASS|
|SQL/HTTP e migração B5.2B, incluindo agrupador|${r.ownSql} PASS|
|Regressões SQL/HTTP e migrações B3/B4/B5.1/B5.2/B5.2A|${r.regressionSql} PASS|
|Jornadas de interface anteriores|${r.regressionUi} PASS|
|Jornadas próprias B5.2B|${r.ownUi} PASS|
|Suítes de regressão|${r.regressionSuites} executadas|
|Sintaxe JavaScript|${r.syntaxFiles} arquivos; zero falhas|
|Excel/OOXML|3 arquivos verificados com openpyxl|

Contagens seguem os runners e incluem agrupadores; reexecuções não são somadas como testes novos. Migrações dos blocos anteriores exercitam também os respectivos esquemas de origem, rollback/reaplicação; jornadas de negócio/interface usam o esquema integrado com as duas tabelas B5.2B. As duas asserções estruturais que esperavam cinco tabelas financeiras reconhecem agora sete; regras de negócio e segurança não foram afrouxadas.

Cobertura própria: identificação distinta do prestador, formato/dígitos inválidos, checklist ausente/incompleto/vencido, política inválida, vigência, nova versão sem validação herdada, contexto alterado, integridade histórica, aprovação financeira anterior preservada, autorização ausente, RBAC/abrangência, MFA ausente/expirado, segregação, autoaprovação no serviço e SQL, proposta/decisão concorrentes, replay, chave reutilizada, origem/sessão/tablet, auditoria com rollback, DDL idempotente/down/reaplicação e ausência de obrigação. As referências formais das fixtures são sintéticas; não constituem aceite empresarial.

## Desempenho e riscos históricos

Ensaio no mesmo laboratório/participação: 12 medições por cenário, incluindo abertura de conexão/transação. Contratos e workloads diferentes; comparação de custo observado, sem alegar ganho causal ou certificação de escala.

|Cenário|p50 ms|p95 ms|Máximo ms|
|---|---:|---:|---:|
|Detalhe B5.2 legado|${ms(p.legacy.p50)}|${ms(p.legacy.p95)}|${ms(p.legacy.max)}|
|Prontidão B5.2B|${ms(p.readiness.p50)}|${ms(p.readiness.p95)}|${ms(p.readiness.max)}|
|Par de leituras B5.2B concorrentes|${ms(p.concurrent.p50)}|${ms(p.concurrent.p95)}|${ms(p.concurrent.max)}|

${p.sql.sqlOperations} operações SQL observadas: p95 ${p.sql.sqlLatencyMs.p95} ms, máximo ${p.sql.sqlLatencyMs.max} ms; nenhum erro SQL e ${p.sql.blockedSamples} amostras bloqueadas nesse ensaio. Trava financeira: máximo observado ${p.sql.financialLockHeldMs.max} ms. Amostragem 75 ms fornece limites inferiores de CPU/leituras e pode perder operações curtas. O ensaio usa poucos registros e não certifica histórico extenso ou capacidade produtiva.

SQL 1222 foi reproduzido separadamente por bloqueio controlado e correlacionado com espera/bloqueador e recuperação após rollback; espera de applock foi observada separadamente. SERIALIZABLE e LOCK_TIMEOUT 5000 mantidos. **A causa espontânea histórica do SQL 1222 e da latência de 32.455 ms continua NÃO DEMONSTRADA.** A ausência de repetição não elimina os riscos herdados. Não houve aumento de timeout para obter aprovação dos testes.

## Evidências e isolamento

[Resultado final/limpeza](final-validation.json), [gate integral](gate-run.json), [SQL próprio e snapshots](sql-evidence.json), [compatibilidade, checklist e Change Tracking](additional-evidence.json), [migração/rollback](migration-evidence.json), [interface](visual-evidence.json), [performance/correlação](performance-evidence.json), [locks](inherited-run-lock-evidence.json), [manifesto de fontes](source-integrity.json), [manifesto de evidências](evidence-integrity.json).

[Desktop](screenshots/prontidao-desktop.png), [mobile](screenshots/prontidao-mobile.png), [tablet](screenshots/prontidao-tablet.png). Logs finais final-unit.txt, final-sql.txt, additional.txt, final-ui.txt, final-syntax.txt e xlsx.txt. O gate inicial e reexecuções são preservados; a primeira tentativa sem acesso externo ao sandbox não localizou a instância SQL, e a execução autorizada fora do sandbox conectou normalmente. Houve correções de sintaxe/variável antes do primeiro gate integrado, cobertas pelos resultados finais.

${r.laboratories.length} nomes sintéticos identificados nos artefatos B5.2B (incluindo referências herdadas preservadas) foram conferidos ausentes por DB_ID ao final. Cada fixture encerrou o banco próprio. Evidências anteriores B5.2A preservadas; as saídas herdadas foram copiadas para B5.2B. HTTP loopback e portas efêmeras. Banco principal/portal instalado, dados reais, credenciais/sessões/MFA reais e permissões Windows/SQL não foram modificados. Nenhuma dependência instalada, B2D, MFA obrigatório, constituição efetiva, pagamento, baixa, recibo financeiro, integração bancária, promoção ou push.

## Limitações e GO/NO-GO

Dossiês são por participação, não cadastro jurídico global/política comum com herança por filial. Interface registra um documento por proposta; o serviço aceita até vinte documentos por versão. Não há upload, verificação do arquivo/hash em custódia, consulta cadastral oficial ou suporte a identificador alfanumérico neste incremento; formatos não suportados ficam bloqueados. Competência/vencimento são propostas explícitas, sem motor de calendário. Retenção documental, governança de concessões críticas em operação, capacidade, concorrência acima do ensaio, revisão global CT e política/propriedade de retenção CT exigem homologação adicional.

**GO restrito à revisão/homologação laboratorial do B5.2B. NO-GO para B5.3 efetivo e produção.** Beneficiários, remuneração, tributos, vencimento e segurança operacional precisam de aprovação formal, além de autorização específica de evolução/implantação. Os scripts atuais recusam JETTA_CONTROL e não devem ser usados removendo guardas. ObrigacaoPreparada continua vazia e protegida; não existe flag deste incremento que a libere.
`);
fs.writeFileSync('../docs/GATE_B5_2B.md','# GATE_B5_2B\n\nVersão 5.0.0-b5.2b.lab.1 — PASS_LAB_WITH_RESERVATIONS.\n\n[Gate completo](../lab-b4-2/docs/b5-2b/GATE_B5_2B.md).\n\nNO-GO B5.3 efetivo e produção. Constituição e pagamentos bloqueados. JETTA_CONTROL preservado.\n');
