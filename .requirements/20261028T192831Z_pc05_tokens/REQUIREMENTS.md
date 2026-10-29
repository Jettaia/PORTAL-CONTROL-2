# PC-05 — Tokens e tablet

## As Is
PC-01 a PC-04 presentes com alterações não commitadas que devem ser preservadas. Tablet legado exige depósito e identificadores de participação; incompatível com contratação individual. Banco SQL local indisponível. Serena ativada; símbolos falharam (Active language servers: []). LAD não expõe ferramentas; README de instalação informa desabilitado por credencial pendente. Não houve revisão LAD.

## To Be
Gestor/ADM gera token numérico individual; tablet habilitado registra horários uma única vez sem acesso administrativo nem seleção de filial. Usuário confirmou em 28/10/2026 que **entrada precisa ser usada antes de gerar saída**, substituindo a ordem anterior da SPEC. Consumo da saída também exige entrada. Valor da diária permanece inalterado.

## Requirements
1. Emissão e substituição por gestor/ADM com escopo atual, MFA recente, versão e contratação aberta não paga. Saída exige token de entrada consumido e horário de entrada existente. Não gerar após horário já registrado para a ação.
2. Tokens de oito dígitos com randomInt criptográfico, validade de 60 minutos pelo relógio SQL, uso único; hash HMAC com chave privada estável cfg.token, nunca texto puro no banco/log/histórico. Unicidade global com repetição limitada em colisões, sem reutilizar códigos anteriores. Substituição invalida anterior na mesma transação.
3. Tablet habilitado por pareamento aleatório de 256 bits emitido com MFA por gestor/ADM, válido cinco minutos e uso único. Sessão independente HttpOnly/SameSite Strict de oito horas, sem filial; revogação pelo emissor ou ADM e saída local. Atividade/papel do emissor revalidado a cada uso. Perfil com sessão pessoal recusado na API tablet.
4. Código resolve contratação/ação; relógio servidor em America/Sao_Paulo compatível com datetime2 local PC04. Entrada na data do serviço, saída posterior até dia seguinte. Operações serializadas com mesma trava PC04; consumo, horário, versão, evento e auditoria atômicos. Não liberar financeiramente. Origem TOKEN e autoria emissor/tablet preservadas. Sem reentrada/intervalos.
5. Horários manuais invalidam tokens ainda utilizáveis; cancelamento também. Gerar entrada nova não pode apagar uso anterior. Tentativas inválidas persistem: cinco falhas bloqueiam a sessão tablet (nova habilitação necessária), limite HTTP adicional por IP para habilitar/apontar. Respostas sem CPF/nomes/valores.
6. UI gestor integrada à contratação; tablet exclusivo com teclado numérico, confirmação, limpeza e restauração de sessão/status. Preservar legado quando pc05 desativado. Schema/flag opt-in exige PC01-04 provisionados. PC06 continua pendente; sem inventar regra de limite ou ativar piloto instalado.

## Acceptance Criteria
1. HTTP real com serviço real recusa financeiro, filial alheia, MFA vencido, versão divergente, saída antes de uso da entrada e estado fechado; aceita geração/substituição autorizada.
2. Antes da expiração aceita; fronteira exata de uma hora recusa; replay/substituído/manual não alteram registro. Concorrência aceita exatamente uma requisição, a demonstrar em SQL descartável.
3. Pareamento único, expiração, revogação, separação de cookies e revalidação emissor; tablet aceita códigos de duas filiais sem parâmetro filial.
4. Fluxo entrada → gerar saída → saída atualiza os horários e mantém valor; erros/auditoria falha revertem. SQL isolado prova persistência/constraints/travas se instância disponível; SKIP não é PASS.
5. Cinco falhas persistidas bloqueiam sessão; manual invalida tokens atomicamente; UI não apresenta dados administrativos ao prestador.
6. Browser com API sintética exercita cliques/teclado/limpeza/erro/logout em 1440/768/390. Suites adjacentes PC04 e nativa continuam aprovadas.

## Principal Regression Test
`node --test tests/pc05.test.mjs`: HTTP + serviço produção com transporte ODBC controlado. RED inicial por módulo ausente; casos de regra observável e estado/transação. `integration/pc05.integration.mjs` usa SQL local descartável para concorrência real e fronteiras. Browser `node integration/pc05.visual.mjs` testa interação real com transporte HTTP sintético.

## Testing Plan
Testes antes dos módulos; RED/GREEN por backend e UI. Negativos de autenticação, papel, escopo, MFA, token e estado. Revisão independente de segurança/integridade Sol medium após autoverificação. SQL opt-in somente localhost banco aleatório restrito; indisponibilidade registrada sem homologação presumida.

## Implementation Plan
1. Principal: testes HTTP/serviço RED; backend/schema/routes, invalidar no PC04, instalar flag e manifesto; GREEN.
2. Agente UI exclusivo: public/pc04.js, tablet-pc05 HTML/JS/CSS e integration/pc05.visual.mjs; RED/GREEN. Contrato compartilhado acima, sem ownership sobre backend.
3. Principal integra servidor/instalador, prepara SQL opt-in, roda regressão e revisão independente; corrige achados materiais e registra resultado no ticket original. Sem commit/push/deploy ou alteração do banco instalado.

## Referências verificadas
[Node crypto.randomInt](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback) (limite superior exclusivo). [AT TIME ZONE](https://learn.microsoft.com/en-us/sql/t-sql/queries/at-time-zone-transact-sql) e [SYSUTCDATETIME](https://learn.microsoft.com/en-us/sql/t-sql/functions/sysutcdatetime-transact-sql) para tempo confiável no servidor. LAD system_design_review/code_review indisponíveis no inventário; revisão própria/subagente não substitui LAD.

## Resultado atual
Implementação local pronta, revisão independente por subagente Sol medium sem achados materiais. RED inicial por módulo ausente; GREEN 39 testes PC05 HTTP/serviço +1 integração createApp. RED/GREEN adicional para invalidação manual/cancelamento e quinta falha que exige nova habilitação. Casos de colisão/zeros iniciais acrescentados como cobertura adjacente. Suite completa:205 PASS; unidade piloto:2 PASS (207 testes locais). Browser PC05 e regressão PC04 PASS, três larguras; captura390 inspecionada. SQL PC04/05:dois SKIP; nenhum serviço local disponível. Sem homologar autenticação/persistência/travas/constraints SQL reais. LAD não executado por indisponibilidade, sem aprovação. Banco/configuração privada instalados preservados; sem commit/push/deploy. PC06 continua pendente para exceções de limite. Registro canônico de entrega e condição de retomada: docs/PC-05-TOKENS.md.
