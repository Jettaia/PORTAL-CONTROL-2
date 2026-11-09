# As Is
Extrato agrupado por depósito e prestador possui impressão/PDF individual, sem exportação Excel integral.
# To Be
Botão Exportar em Excel na toolbar baixa XLSX completo com depósitos, prestadores, CPF/CNPJ formatado e respectivas contratações, respeitando filtros aplicados.
# Requirements
1. Exportar todo extrato filtrado autorizado, inclusive páginas não carregadas e prestadores recolhidos.
2. Organizar uma planilha em blocos depósito > prestador (CPF/CNPJ mascarado) > contratações, com subtotais por prestador/depósito e total geral.
3. Incluir número, serviço, criação, centro de custo, atividade, devido, pagamento, pago e saldo; manter centavos exatos, zeros de CPF e proteção contra fórmulas.
4. Preservar opção somente movimentação e autorização por persona; exportação consistente sem escrita e sem arquivos truncados (limite explícito).
5. Usar filtros aplicados, tratar erro e cancelar download antigo em mudança de filtros/logout. Disponibilizar localmente após testes/reinício.
# Acceptance Criteria
1. Mais de100 pares/contratações presentes no arquivo; cada contratação pertence ao depósito/prestador correto.
2. Ordem visual de blocos, CPF/CNPJ com máscara e totais conferem com tela; vínculo sem movimento aparece quando permitido.
3. Identificadores e documentos como texto, valores monetários como números quando precisos, texto quando necessário; nenhum dado vira fórmula.
4. Admin/financeiro autorizado, gestor/coordenador vê só seus depósitos; filtros inválidos/pagina rejeitados, limite413 sem arquivo parcial.
5. Download válido XLSX pelo botão; erros visíveis e sem download após invalidação; HTTP local200.
# Principal Regression Test
Testes do gerador inspecionam OOXML real; fluxo de UI dispara download com filtros aplicados; integração HTTP/SQL inspeciona arquivo além das páginas100 e escopos reais.
# Testing Plan
Red antes dos implementadores, green depois; regressão agrupamento/impressão e exportações financeiras; revisão independente focada nas novas fronteiras de exportação e dinheiro.
# Implementation Plan
1. Testar consulta integral autorizada em transação e endpoint exportar.xlsx.
2. Gerador OOXML por blocos com testes do conteúdo e precisão.
3. Botão download e testes de filtros/erro/invalidação.
4. Revisar, reiniciar runtime local e confirmar arquivos servidos.

# Results
- RED: gerador inexistente, UI sem botão/download e endpoint HTTP404 antes da implementação.
- GREEN: node --test tests/fin05-export-xlsx.test.mjs tests/fin01-export.test.mjs tests/fin01-export-artifacts.test.mjs integration/fin05-grouped-ui.test.mjs, 8/8; última UI1/1 confirma última contratação202 literal e cancelamento de download ao aplicar filtros.
- FIN05_SQL_TESTS=YES node --test integration/fin05.integration.mjs, 1/1 em77s. XLSX real209contratos/104pares, totais352.41, CPF mascarado e zero movimentos, período, escopo ADMIN/FINANCEIRO/GESTOR/COORDENADOR/COORDENADOR+FINANCEIRO e limites independentes413. Teste respeita Retry-After do limiter nativo.
- Revisão independente Sol medium: APROVADO, sem achados materiais; gates independentes8/8.
- ZIP/XML do arquivo sintético artifacts/fin05-export/extrato-exemplo.xlsx analisados com zipfile/ElementTree; XMLs válidos e endereços de células únicos. Não usado Excel nativo.
- Runtime local reiniciado com backup automático existente; PID29824, página e script atualizado HTTP200 em127.0.0.1:3211.
- Sem deploy remoto, migrations ou escrita operacional adicionada.
