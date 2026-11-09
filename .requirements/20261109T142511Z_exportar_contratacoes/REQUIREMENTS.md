# As Is
PC04 tem8colunas/filtros, lista200porpágina e escopo por perfil. Não há exportação. ZIP OOXML e Playwright já disponíveis.
# To Be
Exportar .xlsx e PDF reais de todos registros dos filtros aplicados, mesmas permissões,8colunas sem Editar, Jetta/filtros/dataBrasília/quantidade/soma.
# Requirements
1. Reusar listFilters/visibility/ordenação semcursor. Limites explícitos: PDF10000registros, Excel100000; acima pedir filtros, nunca truncar arquivo.
2. XLSX tipa datas/valores usuais, autofiltro/freeze/estilos. Acima15dígitos Excel preservar texto com nota, total BigInt sem arredondamento.
3. PDFbaixável A4horizontal com cabeçalho de tabela repetido/rodapé, texto escapado, dados/total conferidos. Browserlocal semJS/rede e1PDFporvez.
4. UIExportar juntoAtualizar, respeita filtrosaplicados e todaspáginas, semantes. Tratar rascunhos, erro,duploclique,logout e resposta tardia. Não limpar token exibido para uma operação somente leitura.
5. Sólocal, sem escrita negócio/migração/commit/push/deploy. Preservar diffsanteriores; extenso permanece foraescopo.
# Acceptance Criteria
Maisde200incluídos; ADMglobal,Gestorsódepósitosvinculados,Financeirosóliberadasvinculadas.8filtrosválidos coerentes, inválidosrejeitados. XLSXabre emleitor independente com datas/números/autofiltro/freeze e strings seguras. PDFválido ehorizontal contém início/fim/metadata,semclipping. Snapshotbanco inalterado. UIbaixa e descartarespostaantiga.
# Principal Regression Test
PC04_EXPORT_SQL_TESTS=YES node --test integration/pc04-export.integration.mjs: HTTPautenticado/SQLsintético205+linhas/personas, REDrota404, GREENarquivos/escopo. integration/pc04-export-ui.test.mjs: scriptreal/downloadnativo.
# Testing Plan
TDDartefatos eUI; SQLisoladoautorizado com snapshotantes/depois. openpyxl/pypdf/renderindependente paraQA. RegressõesPC04 e suitecompleta serial (paralelo anterior saturou browsers), revisãoindependente.
# Implementation Plan
TestesRED; consultaePDFprincipal; XLSX eUIemarquivosexclusivosdelegados; GREEN/QAvisual/revisão; reiniciarportal combackuphabitual.
# Notas
Serena/Lad indisponíveis. Geradores fazemparte do runtime doapp, não autoriaavulsa deplanilha. Bundledlibs sópara inspeçãoindependente. Playwrightexistente passa a dependência runtimePDF.

# Resultado final
Implementado e integrado no checkout local. Menu Exportar com Excel e PDF, filtros aplicados e todas as páginas, sem alteração de dados. Playwright existente promovido a dependência de execução. Documentação atualizada. Sem commit, push ou deploy.

# Verificação
- RED antes da implementação dos artefatos/rota/UI; RED adicional confirmou ausência da mensagem para limite de registros antes da correção.
- GREEN: node --test integration/pc04-export-ui.test.mjs tests/pc04-export.test.mjs tests/pc04-export-xlsx.test.mjs — 12/12, sem skip. Inclui download nativo, filtros, cursor, sessão, erro, concorrência PDF, escape e tipagem XLSX.
- PC04_EXPORT_SQL_TESTS=YES node --test integration/pc04-export.integration.mjs — 1/1 com SQL real descartável: 207 registros, 205 no depósito A, escopos ADMIN/GESTOR/FINANCEIRO, oito filtros, entradas inválidas, arquivos reais, resultado vazio, snapshots de contratos/auditoria inalterados e banco removido no finally.
- openpyxl e pypdf independentes: 205 registros nos dois arquivos; datas e dinheiro nativos no Excel, soma 2050.00, autofiltro A5:H210, freeze A6, nenhuma fórmula; PDF com dez páginas A4 horizontais, oito cabeçalhos repetidos, logo, total e 205 linhas; PDF vazio válido de uma página. Evidência local: artifacts/pc04-export/independent-validation.json.
- Inspeção visual das páginas 1 e 2 do PDF e capturas desktop/mobile: sem corte das oito colunas no PDF; controles de exportação legíveis e responsivos. A tabela conserva sua rolagem horizontal habitual no celular.
- Regressão integral do inventário regressionTests(), usando --test-concurrency=1: 448/448, zero falhas/skip/TODO/cancelados. Log: artifacts/pc04-export/regression-serial.txt. Execução serial evita saturação de browsers observada previamente, sem remover testes.
- Revisão independente final review_contracts_export: APROVADO; único achado (mensagem específica para refinar filtros acima do limite) corrigido e testado RED/GREEN.
- Portal reiniciado pelo iniciador oficial com backup verificado. GET / = 200; exports sem sessão = 401. Ativo em http://127.0.0.1:3211/ para teste do usuário.

# Limitações explícitas
PDF até 10.000 linhas e uma geração simultânea por processo; Excel até 100.000. Excesso retorna erro orientando refinar filtros, sem truncamento. PDF depende de Edge/Chromium disponível. Valor por extenso permanece pendente conforme decisão anterior do usuário.
- Verificação final: node scripts/check-all.mjs aprovou 743 arquivos, zero falhas de sintaxe; git diff --check aprovado com core.whitespace=cr-at-eol.
