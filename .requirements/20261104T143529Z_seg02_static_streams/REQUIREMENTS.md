# SEG-02 — bloqueio dos arquivos financeiros legados no Windows

## As Is
Com fin01 ativo, /pc08.js recebe 410, mas o nome NTFS /pc08.js::$DATA contorna a comparação e serve o arquivo pelo middleware estático.

## To Be
Os nomes equivalentes do mesmo arquivo aposentado recebem 410 antes do acesso estático, preservando arquivos ativos e a configuração sem aposentadoria financeira.

## Requirements
1. Aplicar o bloqueio existente ao nome-base de arquivos com sufixo de stream NTFS, inclusive quando codificado na URL; preservar normalização de barras e case-insensitive. Considerar também pontos/espaços finais que o Win32 pode normalizar no nome-base do mesmo arquivo.
2. Preservar a resposta dos arquivos ativos e do modo fin01 desativado.

## Acceptance Criteria
1. HTTP real sem sessão: GET e HEAD de /pc08.js e /pc08.js::$DATA recebem 410; GET informa FINANCEIRO_LEGADO_DESATIVADO sem conteúdo JavaScript. Variantes codificadas e demais famílias aposentadas também são bloqueadas.
2. /fin01.js continua 200 quando fin01 ativo; /pc08.js continua 200 quando fin01 desativado. URLs malformadas continuam 400. Não acessar banco nem alterar dados.

## Principal Regression Test
Novo caso SEG-02 em tests/fin04-retirement.test.mjs, comando node --test tests/fin04-retirement.test.mjs. Deve falhar antes com status 200 no acesso NTFS e passar depois com 410 na rota real de createApp/express.static.

## Testing Plan
RED/GREEN em Windows no runner nativo; casos GET/HEAD e codificações, arquivos ativos e flag desligada; suíte principal e sintaxe dos arquivos alterados; revisão independente focal de segurança.

## Implementation Plan
1. Adicionar teste HTTP, confirmar falha antes da correção.
2. Comparar o nome-base antes do bloqueio existente, sem alterar o destino servido.
3. Executar provas e registrar resultado no relatório existente.

## Fonte
https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fscc/c54dec26-1551-4d3a-a0ea-4fa40f848eb3 — NTFS Streams: arquivo::$DATA identifica o stream padrão do arquivo (consulta em 04/11/2026).

## Resultado
- RED: HTTP real no Windows retornou 200 em GET /pc08.js::$DATA, em vez de 410.
- GREEN: 5/5 testes focais; 15 grafias em GET e HEAD recebem 410; arquivo ativo, flag desligada e codificação inválida preservados.
- Suíte principal: node scripts/test-all.mjs, 383/383, sem falhas/pulos; inclui SEG-01.
- Sintaxe dos dois arquivos alterados e diff check (CRLF preservado): aprovados.
- Revisão independente review_seg01 (GPT-6.1 Sol): PASS, teste focal 5/5 e variantes adicionais sem exposição.
- Registro existente atualizado em docs/Relatório.md. Sem banco, commit, push ou deploy.
