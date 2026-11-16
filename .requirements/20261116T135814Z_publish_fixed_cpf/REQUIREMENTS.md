# As Is
Publicacao autorizada do codigo CPF fixo, filtros multiplos e acompanhamento de Diarias. SQL PC05 e tablets multideposito passaram. Regressao 492/493: teste de paridade ainda procura aba Tokens, renomeada para Entrada e saida no produto aprovado.

# To Be
Publicar as mudancas com regressao atualizada, backup e prova publica, sem schema novo nem apontamentos sinteticos em producao.

# Requirements
1. Atualizar somente o rotulo de aba esperado pelo teste de paridade; manter layout, filtros/exportacao, duas linhas de horarios e ausencia de erros.
2. Gates completos e candidato/live aprovados; commit/push na main.
3. Preservar banco e acessos. Retorno automatico ao leitor temporario permitido apenas antes de apontamentos CPF_FIXO na producao.

# Acceptance Criteria
1. Teste antes falha procurando Tokens e depois passa com Entrada e saida, sem alterar produto ou remover assertions.
2. Suite integral sem falhas/skips, SQL descartavel aprovado, assets publicados iguais aos testados.
3. Emissao temporaria responde 410; verificacao publica usa ID inexistente e nao registra entrada/saida real. Backup criptografado verificado e baixado.

# Principal Regression Test
node --test integration/pc04-layout-parity-ui.test.mjs
RED comprovado na regressao: timeout esperando tab Tokens. GREEN esperado com o rotulo aprovado; fluxo real de UI com HTTP sintetico.

# Testing Plan
Focado de paridade e codigo fixo; regressao completa serial; SQL PC05 e multi deposito; candidato e live autenticados. Comparar integridade dos fontes com a evidencia final.

# Implementation Plan
Corrigir rotulo do teste; rodar focados e suite; commit/pacote/imagem; backup e troca somente API; validar health, consultas, assets, exportacoes e desativacao da emissao anterior.

Sem requisito funcional novo. Serena e Lad ausentes; skill TDD aplicada ao ajuste de teste. Nenhuma migracao de banco.
