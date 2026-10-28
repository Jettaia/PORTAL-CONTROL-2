import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const root=path.resolve('..'),out=path.resolve('docs/final-lab'),read=name=>JSON.parse(fs.readFileSync(path.join(out,name),'utf8').replace(/^\uFEFF/,'')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const gate=read('uat-gate-run.json'),recovery=read('recovery-evidence.json'),capacity=read('capacity-evidence.json'),uat=read('uat-evidence.json'),integrated=read('integrated-evidence.json'),artifacts=read('artifacts-evidence.json'),demo=read('demo-session.json');
assert.equal(gate.status,'REGRESSIONS_PASS');assert.equal(gate.steps.filter(s=>/^final-reg-/.test(s.name)&&s.exitCode===0).length,33);for(const name of ['unit','final-unit','capacity','uat','recovery','integrated','artifacts','syntax'])assert.ok(gate.steps.some(s=>s.name===name&&s.exitCode===0),name);
for(const r of [recovery,capacity,uat,integrated,artifacts])assert.equal(r.status,'PASS');assert.equal(recovery.cleanupVerified,true);assert.equal(demo.status,'DISPONIVEL_PARA_HOMOLOGACAO');assert.match(demo.url,/^http:\/\/127\.0\.0\.1:\d+\/$/);assert.equal((await fetch(demo.url+'api/health',{signal:AbortSignal.timeout(5000)})).status,200);
const git=(...a)=>execFileSync('git',['-c','core.longpaths=true',...a],{cwd:root,encoding:'utf8'}).trim(),branch=git('branch','--show-current'),codeCommit=git('rev-parse','HEAD');assert.equal(branch,'codex/portal-completo-final-lab');
const candidates=execFileSync('git',['-c','core.longpaths=true','ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean),sources=candidates.filter(p=>/^lab-b4-2\/(?:src|public|scripts|integration)\//.test(p)||/^lab-b4-2\/package(?:-lock)?\.json$/.test(p)||p==='ABRIR_JETTA_LAB.cmd').sort();
const decisions=['lab-b4-2/docs/b5-3-f04/REGISTROS_D01_D14.json','lab-b4-2/docs/b5-3-f04/MATRIZ_D01_D14.md',...fs.readdirSync(path.join(root,'lab-b4-2/docs/b5-3-f04/deliberacoes')).filter(p=>/^D\d{2}\.md$/.test(p)).map(p=>'lab-b4-2/docs/b5-3-f04/deliberacoes/'+p)];for(const p of decisions)assert.equal(sha(path.join(root,p)),crypto.createHash('sha256').update(execFileSync('git',['-c','core.longpaths=true','show','05704f9:'+p],{cwd:root})).digest('hex'));
fs.copyFileSync(path.join(out,'laboratories.ndjson'),path.join(out,'laboratories-final.ndjson'));
const sourceManifest={codeCommit,branch,files:[...sources,...decisions].map(file=>({file,sha256:sha(path.join(root,file))}))};fs.writeFileSync(path.join(out,'source-integrity.json'),JSON.stringify(sourceManifest,null,2)+'\n');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const excluded=new Set(['source-integrity.json','evidence-integrity.json','final-validation.json','commit-attestation.json','demo-session.json','laboratories.ndjson']);const evidence=files(out).filter(p=>!excluded.has(path.basename(p))&&!p.endsWith('.log')&&!/\.(bak|mdf|ldf)$/.test(p));fs.writeFileSync(path.join(out,'evidence-integrity.json'),JSON.stringify({codeCommit,files:evidence.sort().map(p=>({file:path.relative(root,p).replaceAll('\\','/'),bytes:fs.statSync(p).size,sha256:sha(p)}))},null,2)+'\n');
const performanceRows=capacity.measurements.map(r=>'| '+r.name+' | '+r.volume+' | '+r.count+' | '+r.p50.toFixed(1)+' | '+r.p95.toFixed(1)+' | '+r.max.toFixed(1)+' |').join('\n');
const validation={status:'PASS',branch,codeCommit,sourceFiles:sourceManifest.files.length,evidenceFiles:evidence.length,sourceManifestHash:sha(path.join(out,'source-integrity.json')),evidenceManifestHash:sha(path.join(out,'evidence-integrity.json')),decisionsUnchanged:true,demoUrl:demo.url,aprovacaoUsuario:'PENDENTE',principalAccesses:0,classificacoes:{DESENVOLVIMENTO_FUNCIONAL_LAB:'BASE_ACEITA_ESTABILIZADA',ESTABILIDADE_TECNICA_LAB:'VALIDADA_COM_RESTRICOES_DE_DESEMPENHO',RECUPERACAO_LAB:'PASS_ENSAIO_SINTETICO',PRONTIDAO_PARA_UAT:'PRONTO',PRONTIDAO_PRODUCAO:'NO_GO_NAO_AUTORIZADA'}};fs.writeFileSync(path.join(out,'final-validation.json'),JSON.stringify(validation,null,2)+'\n');
const md=`# GATE_JETTA_CONTROL_PRONTO_UAT

Versão **7.0.0-lab.2**. Fechamento de laboratório em 26/10/2026, America/Sao_Paulo. Este documento sucede o gate 7.0.0-lab.1 para a missão de estabilização. A aceitação da base funcional pelo usuário foi registrada; sua homologação pessoal do produto continua **PENDENTE**.

| Dimensão | Classificação |
|---|---|
${Object.entries(validation.classificacoes).map(([k,v])=>'| '+k+' | '+v+' |').join('\n')}

## 1. Correções e limitações

Corrigida a condição de corrida entre a consulta inicial de sessão e o login, com teste de resposta anônima atrasada. Corrigidos o transporte de parâmetros de procedures B2 via variáveis tipadas (EXEC não recebe CONVERT inline), a representação de bits ODBC na interface, os acentos da exportação, o menu móvel, as indicações de atalhos indisponíveis e as páginas vazias na impressão do recibo. O laboratório passou a preparar os cadastros, procedimentos de administração, perfis e registros operacionais necessários às APIs existentes. Esses suportes são fixtures isoladas, sem instalação no portal principal.

Removidas leituras duplicadas do contexto na composição F03/B6.1 e reutilizadas consultas SELECT determinísticas idênticas somente dentro da mesma transação SERIALIZABLE de leitura. Não foram alterados isolamento, timeouts, regras fiscais, permissões reais ou bloqueios de obrigações. As limitações de carga e infraestrutura continuam explícitas abaixo.

## 2. Commit e integridade

Branch: **${branch}**. Commit de código e evidências técnicas: **${codeCommit}**. O commit que inclui este gate e os manifestos será registrado após o fechamento em [commit-attestation.json](lab-b4-2/docs/final-lab/commit-attestation.json), com o hash final e a confirmação da árvore limpa; esse atestado local fica fora do versionamento para evitar referência circular ao próprio commit.

[Manifesto de fontes](lab-b4-2/docs/final-lab/source-integrity.json): ${sourceManifest.files.length} arquivos SHA-256. [Manifesto de evidências](lab-b4-2/docs/final-lab/evidence-integrity.json): ${evidence.length} arquivos. [Validação consolidada](lab-b4-2/docs/final-lab/final-validation.json). Registros D01–D14 comparados com o commit e preservados. Nenhum push foi realizado. A [auditoria de ciclo de vida](lab-b4-2/docs/final-lab/lifecycle-audit.json) removeu dois bancos sintéticos órfãos de interrupções anteriores, preservando a demonstração ativa e os bancos sem propriedade comprovada.

## 3. Backup, restore e reconciliação

**PASS em laboratório sintético.** O diretório autorizado foi comprovado como existente e visível pelo serviço SQL. A chamada ODBC anterior retornava sem arquivo e sem histórico de backup; VERIFYONLY recebia SQL 3201/3013 e erro de SO 2 porque o arquivo não existia. SQLCMD, com a mesma autenticação Windows e o mesmo caminho, produziu o backup. A comparação está registrada nos diagnósticos, sem atribuir a falha a uma permissão que não foi demonstrada.

Backup COPY_ONLY com CHECKSUM, RESTORE VERIFYONLY, RESTORE para outro banco sintético e CHECKDB foram executados com SQLCMD. Reconciliados contagem e SHA-256 de contratos, participações, eventos de apontamento, auditoria, solicitações/decisões B5.2, processos/eventos simulados, recibos e anexos, antes de qualquer invalidação. As dez tabelas coincidiram. Nenhum pagamento ou obrigação real foi produzido.

Procedimento pós-restore exclusivo de laboratório rotaciona a época de recuperação, invalida contextos financeiros e revisões/cursores anteriores, revoga sessões/MFA e códigos/tablets, e exige nova validação sem apagar snapshots ou recibos históricos. A sessão anterior recebeu HTTP 401; o cursor anterior foi recusado; o contexto validado ficou pendente. RTO observado: **${recovery.rtoObservedMs} ms**, incluindo restore, reconciliação, CHECKDB e verificações de segurança. RPO observado: backup completo preservado e **1 evento de auditoria intencionalmente posterior não recuperado**, numa janela de ${recovery.rpo.janelaObservadaMs} ms. São medições deste ensaio, não metas empresariais aprovadas nem prova de recuperação em produção.

[Evidência completa](lab-b4-2/docs/final-lab/recovery-evidence.json), [saída SQLCMD](lab-b4-2/docs/final-lab/recovery-sqlcmd.txt), [script pós-restore](lab-b4-2/integration/final-lab-post-restore.sql).

## 4. Performance e concorrência

Volumes 10, 50 e 100 na carteira; 10, 50, 100, 500 e 1.000 na Diretoria. Carga construída somente em SQL sintético, com contratos fixados pelo trigger existente e sem fabricar auditoria de confirmação; não substitui a jornada completa testada separadamente. A carteira recusou 101 participações e a Diretoria recusou 1.001, exigindo recorte. Nenhum total truncado foi apresentado como total global.

| Cenário | Registros | Amostras | p50 ms | p95 ms | Máximo ms |
|---|---:|---:|---:|---:|---:|
${performanceRows}

O ensaio anterior às otimizações registrou máximos próximos de 31,7 s com 50 participações e 48,0 s em leitura concorrente. Esses resultados permanecem no histórico; não foram ocultados por um novo PASS. As medições finais acima são específicas desta máquina e amostra; não aprovam SLO, capacidade empresarial ou a causa da latência histórica de 32.455 ms.

SQL 1222 foi reproduzido por contenção controlada, retornou 503 e recuperou após liberação, com os timeouts e isolamento preservados. A causa do evento histórico original continua não demonstrada, por ausência do rastreio daquele instante. O relatório registra percentis, máximos, operações SQL, espera/contenção e amostras de locks. [Performance e carga](lab-b4-2/docs/final-lab/capacity-evidence.json).

## 5. Regressão final

[Execução após correções](lab-b4-2/docs/final-lab/uat-gate-run.json): **REGRESSIONS_PASS**. Passaram 79 testes unitários existentes, 7 próprios, os 33 programas de regressão B3–B6.1, 18 cenários da jornada final, o suporte Administração/B2 via APIs reais, a revisão das telas, volume, recuperação e artefatos. B1/B2 também são cobertos pelos testes unitários e pelas APIs de cadastros, autenticação, perfis, convite/ativação e negação de acesso do ensaio UAT.

As verificações incluem valor individual imutável, tablet real no navegador, conferência, fechamento, provisão, validação independente, programação/pagamento simulado, recibo, assinatura sintética, Excel, RBAC, MFA, auditoria, idempotência, rollback e concorrência. Contagens TAP podem incluir testes-pai; não foram somadas artificialmente às verificações internas.

Tentativas e correções foram preservadas em arquivos attempt e history e no [registro de correções](lab-b4-2/docs/final-lab/CORRECOES_E_REEXECUCOES.md), incluindo falhas de data e serialização nos próprios ensaios. [Jornada integrada](lab-b4-2/docs/final-lab/integrated-evidence.json), [revisão UAT](lab-b4-2/docs/final-lab/uat-evidence.json).

## 6. Telas revisadas

29 combinações de perfil e tela revisadas em desktop (1440), celular (390) e tablet (1024), além da página de apontamento. Abrangem Administração, Gestor, Financeiro e Diretoria. O menu móvel pode ser aberto/recolhido; tabelas conservam rolagem própria. Os atalhos sem operação foram rotulados como indisponíveis. Códigos direcionam ao apontamento existente; Relatórios da Diretoria direciona à visão autorizada. [Capturas por tela](lab-b4-2/docs/final-lab/screenshots/uat/).

## 7. Recibos e arquivos

Recibo A4 de **uma página**, sem páginas em branco, gerado na tela real e marcado como laboratório. Minuta não declara pagamento. Emissão posterior exige pagamento simulado e mantém o aviso de ausência de quitação real. Versões, substituição, invalidação, ocultação lógica, autoria, hashes, histórico e acesso por depósito foram verificados. Arquivos inválidos, conteúdo incompatível, PDF ativo, tamanho excessivo e hash divergente são recusados.

[PDF sintético](lab-b4-2/docs/final-lab/recibo-sintetico.pdf), [relatório Excel](lab-b4-2/docs/final-lab/relatorio-financeiro-simulado.xlsx), [exportação pela tela](lab-b4-2/docs/final-lab/exportacao-tela.xlsx), [validação dos artefatos](lab-b4-2/docs/final-lab/artifacts-evidence.json). Os Excel têm recorte/auditoria, valores reconciliados, acentos válidos e não contêm fórmulas, macros ou vínculos externos. Hash não autentica juridicamente assinatura. Impressora física e comportamento em cada versão instalada do Excel não foram homologados.

## 8. Riscos remanescentes

Performance depende de volume, cache e concorrência; não há SLO empresarial aprovado. A causa histórica específica do SQL 1222 e da latência não está demonstrada. Recuperação foi comprovada apenas em banco e infraestrutura sintéticos locais. Operação física de tablet/impressora, retenção/custódia empresarial e validade jurídica/fiscal dependem de validação própria. Recursos marcados como indisponíveis não fazem parte da capacidade entregue.

## 9. Demonstração final

**URL local verificada neste fechamento: ${demo.url}**

Um único comando na raiz: **ABRIR_JETTA_LAB.cmd** (duplo clique). Alternativa na pasta lab-b4-2: npm run demo:final. O comando prepara banco descartável, porta local efêmera e abre o cartão privado de acesso. Não aceita banco principal existente.

Cartão privado: lab-b4-2/secrets/final-lab/acessos-locais.html, fora do versionamento. Perfis fictícios: Gestor, Financeiro, Diretoria, Administrador, Configurador, Validador, Aprovador e Arquivo. Credenciais não estão neste documento. MFA muda a cada 30 segundos; após usar um código, aguardar o próximo para uma ação sensível. Tablet deve usar perfil de navegador exclusivo, sem sessão administrativa.

1. Gestor: consultar a jornada, confirmar o registro preparado, gerar códigos, parear o tablet, registrar entrada/saída, conferir e fechar.
2. Financeiro: consultar carteira, provisão e autorização; examinar processo completo, pagamento fictício, recibo e assinatura sintética; exportar o recorte.
3. Perfis independentes: ensaiar proposta, validação, liberação e arquivamento, preservando segregação.
4. Diretoria: custos, agrupamentos e recorrência no escopo permitido.
5. Administrador: cadastros, usuários pendentes/convites, perfis e abrangência de usuários fictícios.

O registro completo está na participação **${demo.participacoes.completa}**; a provisão gerencial na participação **${demo.participacoes.provisionada}**. Há registros operacionais preparados para percorrer as etapas restantes. Endereço muda a cada nova demonstração; conferir o cartão privado ou demo-session.json. Para encerrar e limpar seu banco próprio, criar encerrar.sinal em secrets/final-lab. Não encerrar servidores de outros projetos.

## 10. Aprovações empresariais e implantação futura

D01–D14 e estados reais preservados. D01/D02/D04/D05/D06/D12/D14 continuam propostas selecionadas sem aprovação formal; demais decisões seguem pendentes conforme [matriz](lab-b4-2/docs/b5-3-f04/MATRIZ_D01_D14.md). Não foram inventados tributos, dispensa fiscal, assinatura verdadeira ou autorização empresarial.

Dependem de decisão posterior: regras fiscais/jurídicas, documentação obrigatória, tratamento de beneficiário, alçadas empresariais, retenção e custódia, SLO/capacidade, plano operacional de recuperação e implantação. Não foram executados promoção, push, integração bancária, obrigação efetiva, pagamento, baixa ou quitação. Financeiro.ObrigacaoPreparada segue bloqueado e B2D não foi ativado.

**Pronto para uma única homologação funcional do usuário em laboratório, com as reservas técnicas acima. Produção permanece NO-GO.**
`;
fs.writeFileSync(path.join(root,'GATE_JETTA_CONTROL_PRONTO_UAT.md'),md,'utf8');console.log(JSON.stringify(validation));
