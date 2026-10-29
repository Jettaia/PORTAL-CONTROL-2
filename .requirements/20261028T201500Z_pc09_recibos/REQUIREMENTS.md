# PC-09 — Recibos numerados e impressão

## As Is
PC-04 mantém contratações individuais e PC-08 registra baixas agrupadas. A página de recibos ainda usa o laboratório anterior, sem vínculo ao novo contrato. Referência canônica: docs/SPEC.md, PC-09; recibos/MODELO DE RECIBO.docx.

## To Be
ADM/Financeiro emitem um recibo persistido por contratação liberada, sem baixar pagamento, e reimprimem o documento original.

## Requirements
1. Emissão e leitura somente por ADM/Financeiro ativos; emissão exige sessão e MFA recente, origem válida e contratação liberada.
2. Sequência SQL global independente, NO CYCLE, unicidade por contratação; emissão serializada com PC04/PC08. Snapshot imutável identifica versão, autor e data de emissão.
3. Preservar texto/desenho do modelo, empresa/CNPJ, valor decimal e extenso, serviço/data; nome, CPF e assinatura manuais em branco.
4. Decisão confirmada pelo usuário: data de quitação em branco antes do pagamento; data do serviço preenchida. Cidade/UF extraídas do endereço e confirmadas na primeira emissão; erro explícito se endereço não oferecer localidade inequívoca.
5. Reimpressão preserva número e snapshot; emissão não altera contrato, saldo ou pagamento. Ciclo de substituição/cancelamento depende da decisão P07/PC10, sem política presumida.

## Acceptance Criteria
1. Testes HTTP permitem financeiro/ADM e negam gestor, inativo, anônimo e origem inválida antes de ler/escrever documento.
2. SQL isolado deve comprovar concorrência, persistência e números distintos por filial/contratação; reimpressão retorna mesmo snapshot.
3. Renderização imprimível de duas localidades e valores por extenso, sem dados pessoais preenchidos e sem cortes.
4. Confirmação inválida não escreve; documento pré-pagamento deixa quitação em branco.
5. Nenhuma baixa ou atualização de contratação ocorre na emissão; recibos de itens agrupados permanecem individuais.

## Principal Regression Test
node --test tests/pc09.test.mjs: rota pública real com serviço e adaptador ODBC controlado; emissão, reimpressão, autorização, entrada inválida e rollback. Red esperado: módulo PC09 ausente. SQL real obrigatório para certificar a fronteira de persistência/concorrência; mocks não certificam esse aceite.

## Testing Plan
Runner node:test já instalado, testes adjacentes PC04/PC08 e check. Playwright headless para formulário real, impressão, duas localidades, campos manuais e logout. SQL descartável somente se instância local disponível; nunca migrar banco instalado.

## Implementation Plan
1. Escrever testes HTTP e de documento; executar red.
2. Implementar serviço, schema protegido, renderização e rotas; executar green.
3. Integrar painel de recibos e flags seguindo padrões PC08; validar shell real em headless.
4. Revisar independentemente, corrigir achados e registrar provas neste registro e no ticket existente.

## Gates e fontes
- Serena ativada; símbolos indisponíveis: language_servers vazio; consulta get_symbols_overview falhou.
- LAD: tentativa real de inicialização via verify_mcp.py --lad falhou: No provider credentials configured. system_design_review e code_review não foram executados; gate LAD BLOCKED, sem aprovação presumida.
- SQL Server CREATE SEQUENCE confirmado em https://learn.microsoft.com/en-us/sql/t-sql/statements/create-sequence-transact-sql : NO CYCLE; rollback pode deixar lacunas e não reutiliza número.
