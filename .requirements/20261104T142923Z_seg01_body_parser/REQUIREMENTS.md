# SEG-01 — disponibilidade do parser HTTP

## As Is
O lockfile resolve body-parser 1.20.8. O relatório registra queda por gzip com bytes adicionais antes da autenticação.

## To Be
Uma requisição comprimida malformada sem sessão não encerra o processo; o mesmo servidor continua atendendo HTTP.

## Requirements
1. Atualizar somente a dependência vulnerável na série 1.x corrigida (>=1.20.9), preservando Express 4 e os contratos atuais.
2. Proteger a regressão com HTTP real no createApp em processo filho isolado, loopback e porta efêmera, sem banco ou efeitos externos.

## Acceptance Criteria
1. Lockfile e instalação resolvem versão corrigida; instalação reproduzível.
2. Após envio fragmentado de gzip/deflate com bytes adicionais, o mesmo PID atende health; JSON normal/comprimido válido mantém as respostas e entradas inválidas continuam recusadas.

## Principal Regression Test
`node --test tests/body-parser-dos.test.mjs`: parser real e requisição sem cookie. Antes: processo encerra por erro de descompressão e a prova de sobrevivência falha. Depois: health continua 200, sem reinício.

## Testing Plan
Executar red, atualização focal, green, npm test e npm run check. Cobrir persona anônima, JSON inválido, compressão válida e limite descomprimido. Revisão independente focal de segurança.

## Implementation Plan
1. Criar teste HTTP de regressão e executar contra a dependência atual.
2. Atualizar resolução do body-parser para 1.20.9; repetir teste e regressões nativas.
3. Registrar provas e status SEG-01 no relatório existente.

## Fontes
- https://github.com/advisories/GHSA-27r3-jxmh-p828 (consultado em 04/11/2026): série 1.x corrigida em 1.20.9.
- Serena e Lad indisponíveis; execução local com revisão independente por subagente.

## Resultado
- RED comprovado: processo filho encerrou com código 1 e Gunzip Z_DATA_ERROR.
- GREEN: 2/2 testes focais; suíte principal 381/381, sem pulos.
- npm run check: 718 arquivos, zero falhas.
- Instalação limpa em temporário com scripts desativados: 94 pacotes; Express 4.22.3 / body-parser 1.20.9.
- npm audit: zero vulnerabilidades conhecidas.
- Revisão independente: review_seg01 (GPT-6.1 Sol), PASS, repetição focal 2/2.
- Evidência consolidada em docs/Relatório.md; sem banco, commit, push ou deploy.
