# Usuários — opção A com popups B

## As Is
PC01 reúne solicitações, tabela e formulário aberto; senhas geridas por pc01-password.js. Protótipo A aprovado com criação/edição centralizadas e busca corrigida para preservar ordem/cursor.

## To Be
Aplicar o desenho localmente, mantendo os formulários, endpoints, permissões, aprovação e revogação de sessão atuais.

## Requirements
1. Tabela com usuário/e-mail, funções, depósitos, situação e editar; busca nome/e-mail, filtros função/situação. Sem recriar o input ao digitar.
2. Criar e editar em modal central; funções múltiplas e depósitos com CC; erros mantêm campos não sensíveis e apagam senha segundo regra atual.
3. Solicitações em popup com aprovar/recusar e os mesmos contratos. Senha/exclusão preservadas; excluir própria conta proibido; salvamento próprio mantém revogação de sessão.
4. Bloquear ações duplicadas, limpar segredos e fechar popups ao sair ou encerrar sessão. Manter fluxo de senha de gestores/coordenadores.
5. Local apenas, cores atuais e layout responsivo. Sem testes de escrita em contas operacionais ou deploy.

## Acceptance Criteria
1. Digitar bruno sequencialmente produz bruno, edição no meio mantém cursor, filtros preservam foco.
2. Novo/Editar exibem dialog central; POST/PUT corretos; depósito inativo indisponível; máscara senha só na criação.
3. Aprovação bloqueia identidade/situação; exclusão tem confirmação; senha mantém endpoint e limpeza de campos; ADM e não ADM preservados.
4. Cancelar não grava, falha permite retry, logout em resposta pendente não restaura dados.
5. Desktop e 390 px sem overflow externo; HTTP local entrega fontes atualizados.

## Principal Regression Test
`node --test integration/user-table-modal-ui.test.mjs`: frontend real + HTTP sintético, interações reais com digitação, modal, salvar, requests, senha e sessão. Deve falhar antes por ausência da busca/modal.

## Testing Plan
Teste UI focal; testes API PC01/senha existentes; regressão de prévia, prestadores e depósitos. Capturas desktop/mobile. Não comprova mutações em SQL real.

## Implementation Plan
Reaproveitar IDs e handlers existentes; mover editores para dialogs; renderizar tabela/filtros independentemente; estilo restrito à tela ADM; validar e arquivar protótipo. Requisitos confirmados pelo usuário. Serena/Lad indisponíveis nesta sessão. Sem bibliotecas/APIs externas novas.

## Verification
- RED: teste focal aguardou #pc01Search inexistente antes da implementação.
- GREEN: `node --test integration/user-table-modal-ui.test.mjs tests/pc01.test.mjs tests/pc01-password.test.mjs` — 6/6. Após ampliar o teste de interface com recusa e exclusão/cancelamento, a mesma interface passou novamente.
- UI focal prova digitação sequencial bruno e inserção/backspace no meio, popup central novo/editar, POST/PUT, falha preservando campos não sensíveis, depósito inativo desabilitado, aprovação com identidade bloqueada, senha e limpeza de campos, recusa, confirmação/cancelamento de exclusão, própria conta protegida, duplo submit e resposta após logout.
- `node integration/pc01-password.visual.mjs` — PASS; administrador redefine senha em popup e gestor altera a própria senha, incluindo confirmação divergente, senha curta, falha da senha atual, limpeza e revogação da sessão. Expectativas adaptadas ao novo acionamento em popup e espera explícita pela visibilidade após troca de persona.
- `node --test integration/preview-ui.test.mjs integration/provider-split-ui.test.mjs integration/deposit-cards-ui.test.mjs` — 3/3, sem skips.
- Capturas inspecionadas em artifacts/user-table: desktop e modais 1440/390. Conteúdo longo do modal usa rolagem interna; sem overflow externo.
- Sintaxe frontend/teste aprovada. HTTP local 3211 retorna pc01.js/pc01.css iguais aos fontes atuais; sem reinício necessário (somente frontend).
- Testes de interface usam HTTP sintético; testes de API existentes mantêm autorização/origem/MFA. Nenhuma conta operacional ou senha real foi alterada; sem deploy.
- Fonte primária arquivada em `codex/prototype-usuarios-20261111-a`, com os cinco arquivos descartáveis e o veredito A + popups B + correção de busca. Índice isolado e autoria local Codex Agent; checkout, índice normal e demais alterações preservados. Sem push.
