# Horários digitáveis — aplicação local

## As Is
Criação e edição usam datetime-local com seletor nativo de horas. O protótipo A foi aprovado para edição; a criação deve manter o layout compacto da imagem do usuário.

## To Be
Criação mantém modal, grade, rótulos, altura dos campos e ações existentes; cada campo de data/hora passa a conter calendário de data e texto HH:mm. Edição usa data e hora separadas (A), inclusive horários reais manuais.

## Requirements
1. Digitar horas sem seletor nativo em criação e edição; aceitar HH:mm e converter 0830 em 08:30.
2. Manter datas por calendário, formato de payload YYYY-MM-DDTHH:mm, períodos cruzando meia-noite e consulta de média pela data.
3. Bloquear hora inválida, data/hora ausente e respeitar bloqueios por situação/permissão.
4. Preservar estrutura, largura, espaçamentos, campos e botões da criação. Aplicar apenas localmente.

## Acceptance Criteria
1. Inputs de hora são text; 0830 gera 08:30 nos fluxos reais de criação/edição e no payload.
2. Criar com entrada 17/11 22:30 e saída 18/11 06:00 envia essas datas sem UTC; alteração da data atualiza consulta de média.
3. 24:10 e campos ausentes não enviam mutação; contratação liberada mantém campos desabilitados.
4. Campos de criação têm a mesma altura dos controles atuais; sem rótulos extras de Data/Hora, banners, estado de simulação ou seletor de versões. Edição apresenta rótulos Data/Hora e funciona em 390px.

## Principal Regression Test
node --test tests/pc04-hours-ui.test.mjs
Navegador usa HTML/CSS/JS reais do public e intercepta somente API com fixture em memória; cria e edita contratacao e inspeciona payloads. Red esperado: ausência de inputs de texto para horas.

## Testing Plan
Fluxo real de formulário em navegador, edição prevista/manual, validação negativa, hidratação, bloqueio, madrugada, consulta de média e layout desktop/mobile. Suítes adjacentes PC04 e verificação sintática.

## Implementation Plan
1. Adicionar regressão de navegador e executar red.
2. Adicionar campo composto no pc04.js, compacto na criação e separado na edição; CSS restrito a esses campos.
3. Executar green, suítes adjacentes e capturas visuais.

## API notes
MDN input date: valor é yyyy-mm-dd independentemente do locale; preservamos data civil, sem conversão UTC. https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date
Serena/Lad indisponíveis nesta sessão. Requisitos já autorizados no pedido do usuário.

## Resultado e decisão
Versão A aprovada para edição. Criação preserva a composição compacta original e usa hora digitável. Protótipo capturado em `codex/prototype-horarios` (`70c9bec6676fb1eba245f9375d22de992b2c78b3`), fora de main.
Red: controle Entrada prevista — Hora inexistente. Green: teste de UI passou; 87 testes adjacentes passaram; 818 arquivos com sintaxe válida. Capturas em artifacts/pc04-hours. API simulada em memória; nenhum cadastro real foi criado.
