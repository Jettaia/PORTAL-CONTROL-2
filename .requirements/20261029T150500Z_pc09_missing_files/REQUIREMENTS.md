# As Is
tests/pc09.test.mjs importa pc09-routes.js e pc09-document.js ausentes inclusive no HEAD. O teste falha com ERR_MODULE_NOT_FOUND. Ha requisitos PC09 ja definidos, modelo DOCX e fluxos PC04/08/10 existentes.

# To Be
Restituir backend funcional de emissao/reimpressao de recibos conforme o contrato existente, com schema protegido e numeracao persistente. Resolver o bloqueio da suite, sem alterar politica PowerShell ou instalar banco permanente.

# Requirements
1. Implementar os modulos ausentes usando autenticacao/roles/MFA existentes; negar campos extras e acesso indevido.
2. Persistir snapshot imutavel, numero global NO CYCLE, autoria e versao; serializar com PC04/PC08; emitir nao faz baixa. Repeticao retorna mesmo documento; apos invalidacao PC10 preservar original e exigir nova assinatura.
3. Renderizar HTML imprimivel conforme texto do modelo, escapar campos, valores exatos por extenso, cidade/UF do endereco confirmada e campos pessoais manuais vazios. Data de quitacao permanece vazia antes do pagamento.
4. Disponibilizar rotas no servidor quando pc09 estiver explicitamente habilitado e incluir schema aditivo no manifesto para novas instalacoes.

# Acceptance Criteria
1. Testes HTTP reais das rotas cobrem autorizacao, MFA, validacao, erros e rollback. Nao excluir nem enfraquecer testes existentes.
2. SQL descartavel prova concorrencia, sequencia entre filiais, reimpressao persistida, falha sem gravacao parcial e ausencia de baixa. Historico invalido continua imprimivel e identificado.
3. Testes de documento e renderizacao headless demonstram impressao sem cortes em duas localidades, campos manuais e texto seguro.
4. Suite geral verde e regressao adjacente PC04/PC08/PC10. Nenhuma migracao no banco permanente.

# Principal Regression Test
node --test tests/pc09.test.mjs: RED observado por modulo ausente. GREEN deve exercitar rotas Express reais e renderizacao. Teste SQL adicional deve exercer createApp e persistencia reais, pois mocks ODBC nao provam atomicidade.

# Testing Plan
Red existente; implementar documento/servico/rotas; executar green. Testes extras negativos, concorrencia e schema em instancia local descartavel; validar HTML/PDF em Chromium e inspecionar imagem. Reexecutar suite geral e sintaxe. Serena/Lad indisponiveis nesta sessao.

# Implementation Plan
1. Implementar os modulos, schema e montagem condicional; verificar testes existentes.
2. Adicionar testes reais SQL e limites do documento; corrigir falhas observadas.
3. Validar impressao e regressoes; documentar limites. Nova UI de navegacao e integracao do extrato PC11 permanecem fora deste reparo dos arquivos ausentes.

# Sources
Modelo: recibos/MODELO DE RECIBO.docx (texto extraido do XML). CREATE SEQUENCE/NO CYCLE: https://learn.microsoft.com/en-us/sql/t-sql/statements/create-sequence-transact-sql . res.type/send: https://expressjs.com/en/4x/api/response/ .
