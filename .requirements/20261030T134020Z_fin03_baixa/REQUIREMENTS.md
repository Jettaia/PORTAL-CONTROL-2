# FIN-03 — baixa e correções

## As Is
FIN-01 oferece fila/detalhe autorizados; FIN-02 persiste recibo e origem imutáveis. Não existe baixa no fluxo novo. Checkout contém alterações prévias que devem ser preservadas. Escritas financeiras antigas já são bloqueadas quando fin01 está ativo.

## To Be
Aplicar somente FIN-03 de `.scratch/financeiro/issues/03-baixa-e-correcoes.md`, autorizado pelo usuário em 30/10/2026. Financeiro/admin confirmam pagamento integral com recibo assinado, substituem evidência e desfazem baixa com motivo; gestor lê somente seu depósito.

## Requirements
1. Exigir recibo compatível com liberação vigente e arquivo PDF/PNG/JPEG até 5 MiB, validado no servidor, para baixa individual integral.
2. Persistir baixa/evidência/marcador operacional/auditoria atomicamente; data do pagamento igual à emissão original, autor/instante real separados; serializar com revisão/cancelamento e impedir duplicatas.
3. Desfazer com motivo obrigatório conserva recibo e histórico e restaura pendência; substituir anexo preserva versões e estado Pago, usando controle de concorrência.
4. Autorizar globalmente admin/financeiro; gestor somente lê seu depósito, inclusive acesso direto a todas as versões de anexo e histórico.
5. Integrar ações, limites, estados, evidências e histórico no detalhe existente, sem data/valor editável e sem telas adicionais.

## Acceptance Criteria
1. Ausência de recibo/arquivo, conteúdo inválido, origem divergente e valores/listas forjados são recusados sem escrita.
2. Lista/detalhe mostram Pago após confirmação e emissão original como data; concorrência/reenvio não duplica; falha SQL reverte evidência/baixa/marcador/histórico.
3. Desfazer sem motivo falha; com motivo retorna Recibo gerado; troca conserva Pago e acesso à versão antiga; ações com versão antiga falham.
4. HTTP autenticado comprova permitir/negar com identidades distintas, revogação e ausência de efeitos indevidos.
5. Teste headless executa anexar/confirmar/trocar/desfazer, falha recuperável e leitura gestor; capturas desktop/mobile são inspecionadas.

## Principal Regression Test
`$env:FIN03_SQL_TESTS='YES'; node --test integration/fin03.integration.mjs`: HTTP autenticado e SQL Express em banco aleatório descartável. RED esperado por rotas ausentes antes da implementação; GREEN exige persistência releitura e negativos. `node integration/fin03.visual.mjs` comprova interação real dos scripts e CSS, com HTTP sintético.

## Testing Plan
Exercitar autorização, data, integralidade, snapshots, reenvios, disputas, CAS, rollback e proteção PC04. Executar regressões FIN01/02 e testes PC04/PC08/piloto pertinentes. Revisão independente Standards/Spec por risco financeiro e autorização. Não alterar banco instalado, resetar legado, publicar ou fazer deploy.

## Implementation Plan
1. Adicionar testes HTTP e UI; executar RED.
2. Adicionar schema/serviço/rotas transacionais e wiring; executar GREEN SQL real.
3. Integrar UI e lista/detalhe; executar GREEN UI e capturas.
4. Executar regressões focais e revisão independente, corrigir achados e registrar resultados no ticket canônico.

Controle técnico de concorrência: GET pagamento publica ultimaBaixaId e POST de confirmação envia baixaAnteriorId (null inicialmente). Uma confirmação atrasada anterior ao desfazimento é recusada; nova confirmação da versão atual continua possível. Correções usam baixaId/anexoId esperados. Upload binário é parametrizado via ODBC, evitando parse de literal SQL de 10 MiB para arquivo de 5 MiB.

## Ferramentas e referências
Serena/LAD não disponíveis no inventário. APIs Express 4 verificadas em https://expressjs.com/en/4x/api/express/ e https://expressjs.com/en/4x/api/request/ (parser com limite explícito e validação de req.body). UI segue `public/fin01.js` e `public/fin01.css`, pertencentes ao Portal Control; Nosso Design exclui este produto. Limpeza/ativação definitiva permanecem FIN-04. Migrações preparadas, sem execução no piloto instalado.
