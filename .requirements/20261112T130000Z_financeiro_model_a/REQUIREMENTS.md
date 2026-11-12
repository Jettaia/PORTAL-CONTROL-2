# Financeiro — aplicação local do modelo A

## As Is
FIN01 mantém filtros explícitos e tabela de dez colunas, detalhes inline, recibos oficiais FIN02 e importação FIN03 existente. Modelo A aprovado é uma prévia isolada. Workspace já possui alterações de outros trabalhos; preservar.

## To Be
Aplicar o desenho A na tela real, com filtros visíveis automáticos, manter aplicação manual, recibos oficiais e importação existente. Pedido e três anotações confirmam escopo; sem mudança de regras, schema, auth ou deploy.

## Requirements
1. Filtros por número exato, prestador, depósito, serviço desde/até e situação visíveis. Seleções atualizam automaticamente; digitação agrupa requisições. Botões aplicar/limpar continuam.
2. Manter lista única, ordenação/paginação/escopo vindos da API, situações reais e tabela compacta do modelo A. Detalhes completos em modal acessível.
3. Recibos emitidos/reimpressos usam o endpoint e documento oficial existente, incluindo QR. Nunca reutilizar a declaração simplificada da prévia.
4. Importar recibos assinados fica na toolbar com gerar recibos do período/exportar; preservar análise, conferência, vínculos, seleção e confirmação FIN03.
5. Preservar permissões, baixa integral/anexo/histórico, lote e exportação. Filtros inválidos não consultam. Consultas antigas ou timers após logout/troca de tela não atualizam outra sessão.

## Acceptance Criteria
1. Trocar cada select/data ou digitar número atualiza URL de consulta e registros sem clicar. Enviar manualmente cancela consulta agendada. Datas invertidas mostram orientação sem chamada inválida.
2. Desktop 1531×764 e celular 390×844 sem overflow da página; tabela rola localmente até ações, nomes longos legíveis. Modal fecha via botão/Escape e ao ocultar tela/logout.
3. Link de recibo aponta a /api/financeiro/contratacoes/:id/recibo/impressao; testes do renderizador oficial e QR preservados.
4. Botão visível para operador, oculto para gestor; fluxo público de importar/conferir/vincular/confirmar continua passando.
5. Cobertura de resposta tardia, exportação, reset, lote, permissões e logout passa nos testes adjacentes.

## Principal Regression Test
`node --test integration/fin01-model-a-ui.test.mjs`: browser real com FIN01 e FIN03 de produção e respostas HTTP controladas. Red esperado: select não provoca consulta automática. Green: tabela reflete filtro; integração de toolbar, modal e links oficiais conserva contratos. Não certifica SQL/MFA reais.

## Testing Plan
Regressão principal red/green, testes UI FIN01 situação/exportação, FIN02 lote, FIN03 importação; testes unitários oficiais de documentos/QR. Capturas do HTML real com dados sintéticos no runtime local para comparação visual. Smoke local de consulta sem mutações persistentes. Serena/LAD indisponíveis nas ferramentas da sessão.

## Implementation Plan
1. Registrar requisitos e teste browser principal, rodar red.
2. Reestruturar render FIN01 reaproveitando funções/IDs e importação; adicionar auto filtros e modal com invalidação de requisições; rodar teste principal.
3. CSS exclusivo ao FIN01 para fidelidade ao modelo, sem importar estilos do protótipo; provar viewports/estados.
4. Regressão adjacente, revisão do diff, evidências/hash e entrega local sem commit/deploy.

Referências técnicas verificadas: MDN HTMLElement change event (seleções/datas), HTMLDialogElement showModal (modal nativo, foco e backdrop), 12/11/2026. Regras de negócio: docs/FINANCEIRO-SPEC.md, FIN01/02/03 atuais.

## Implementação e evidências

- Aplicado em `public/fin01.js` e `public/fin01.css`, sem mudanças em backend, schema, documento oficial ou importador. Importação FIN03 segue com identificação QR/OCR, vínculo manual por depósito/número, conferência e confirmação selecionada. O novo botão usa o módulo existente.
- Filtros selecionados consultam sem clique; digitação usa 350 ms. Validação do intervalo ocorre antes do HTTP. Mudança de filtro invalida respostas antigas e exportações; aplicação manual cancela timer. Blur após consulta do número não dispara nova consulta nem fecha o detalhe aberto.
- Mantidos IDs/contratos FIN01, documento/QR do renderizador oficial FIN02 e autorizações do servidor. Detalhe em modal nativo com botão fechar durante carregamento/erro, Escape, descarte de resposta tardia e fechamento ao trocar tela/sessão. Horários ficam recolhidos, disponíveis no mesmo detalhe.
- Totais em centavos sobre registros carregados, explicitamente rotulados como valor/pendente exibidos para não representar falsamente toda a consulta paginada.
- Teste principal: RED inicial por ausência de atualização automática; GREEN após implementação. Regressão adicional RED por modal de erro sem botão fechar; GREEN após manter fechamento em loading/erro.
- Cinco suítes UI juntas passaram: modelo A, situação inicial/reset, exportação, lote e importação (5/5, sem skip). Outros nove testes focados de exportação, recibo oficial/documento e lote passaram (9/9). A suíte de importação com QR de páginas digitalizadas e OCR offline também passou nos seus quatro casos; a execução conjunta inicial teve falha no teste de lote por mensagem duplicada, corrigida e reexecutada verde. Fluxo visual FIN03: baixa, erro recuperável, substituição, desfazimento e gestor somente leitura, aprovado. Fluxo visual da coluna Recibo: emissão, erro/repetição, link/impressão, gestor, vazio e desktop/mobile, aprovado.
- Teste de exportação conserva a proteção contra rascunho programático não aplicado; a digitação do usuário é coberta pelo teste novo de filtros automáticos. Teste visual da coluna atualizado para oito colunas e fechamento do modal antes de acionar a linha.
- Evidência final: `artifacts/financeiro-local-2026-11-12T13-02-01-091Z/evidence.json`, 13 cenários com HTML real servido pelo piloto 3211, tema claro, viewports 1531×764 / 390×844 e documento oficial 1000×1250, hashes dos fontes e SHA base. Dados e identidade HTTP controlados para provas visuais determinísticas; zero erros JavaScript. Não certifica SQL/autenticação reais nem executa mutações persistentes. Sem overflow da página; ações provadas com rolagem horizontal local. Diferenças intencionais ao protótipo: importador real na toolbar, precisão de liberação, status de consulta, rótulos de totais carregados e shell do piloto.
- Detector Impeccable executado uma vez: apontou borda lateral legada de lote; removida. Ajustada interferência dos seletores compartilhados do piloto para tabela plana, alinhamento à esquerda e detalhe branco sem painel duplicado.
- Protótipos preservados como fonte primária na branch local `codex/prototype-financeiro-20261112`, commit `bcc3a2445cf46e1e3582cbfe95797af587d08a69`. Pergunta/decisão no commit e nos arquivos do estudo. Arquivamento usou índice Git isolado, sem alterar branch atual ou index do usuário; identidade Codex apenas no comando, sem configurar Git global. Removidos os arquivos descartáveis e comando de execução do checkout atual após captura. Implementação fica local e não commitada.
- Não houve push/deploy, alteração de dados operacionais ou modificações em trabalhos anteriores do workspace. Serena/LAD indisponíveis; nenhuma aprovação dessas ferramentas é alegada.
