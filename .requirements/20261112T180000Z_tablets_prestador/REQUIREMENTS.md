# Tablets e pesquisa de prestador

## As Is
Tablet aceita um depósito. Nova contratação separa busca de prestador e seleção em dois campos.

## To Be
Tablet aceita vários depósitos. Prestador concentra pesquisa por nome/CPF e seleção dos resultados abaixo, mantendo os estilos atuais do Portal Control.

## Requirements
1. Cadastrar, editar e exibir todos os depósitos de um tablet; validar vínculos autorizados no servidor e aceitar códigos dos depósitos vinculados.
2. Remover busca separada e disponibilizar pesquisa com lupa no campo Prestador, filtrada pelo depósito selecionado.
3. Preservar cores, campos, ações, responsividade e invalidação de autorização ao editar tablet.

## Acceptance Criteria
1. Salvar/reabrir dois vínculos; recusar vínculo não autorizado; permitir código de qualquer vínculo válido e negar fora deles.
2. Digitar nome ou CPF, selecionar resultado e enviar seu ID; mudança de texto ou depósito limpa seleção anterior; resultado vazio explícito; teclado acessível.
3. Capturas desktop/mobile sem overflow ou ações cortadas.

## Principal Regression Test
`node --test integration/tablets-provider-ui.test.mjs`: fluxo real dos componentes no navegador com APIs sintéticas. Deve falhar antes por ausência de combobox e múltiplos vínculos, passar após implementação. Backend acompanha teste HTTP/SQL descartável do agente responsável.

## Testing Plan
Interação por nome/CPF, teclado, vazio, troca de depósito, criação e reedição tablet. Regressão PC04 planned/model e backend PC05. Inspeção das capturas; APIs sintéticas não certificam persistência SQL, coberta separadamente.

## Implementation Plan
1. Testes de UI antes do código e execução red.
2. Compor pesquisa de prestador com ícone existente e opções acessíveis; executar teste.
3. Multisseleção tablets e exibição dos vínculos; executar teste.
4. Integrar backend/migração, testes SQL e revisão independente.

Serena/Lad/Kindly indisponíveis nesta sessão; runners nativos e documentação oficial quando necessária.

## Resultado e provas
- Red: teste UI falhou porque o campo separado ainda existia (1 !== 0); backend red HTTP 400 documentado no registro próprio.
- Green: lote com 148 testes PC04/PC05/UI passou sem skips; teste tablets.visual.mjs passou (cadastro/edição/reemissão/revogação, estados, navegação, sessão e mobile).
- UI nova: nome/CPF formatado, clique/touch, setas, Enter/Escape, vazio, troca depósito, payload prestadorId e tablet vários vínculos/releitura.
- Referência visual: imagens do pedido e public/pc04.css/index.html/tablets.css; capturas artifacts/tablets-provider, desktop 1440x1050 e mobile 390x844, Edge headless, tema claro, dados sintéticos. Inspeção de pixels por view_image: identidade preservada, lista abaixo do campo, sem overflow horizontal.
- SQL real: integration/tablets-multidepot.integration.mjs e tablets.integration.mjs PASS em bancos descartáveis; escopos distintos, código de vínculos válidos e inválidos, migração idempotente/preservação e rollback.
- Revisão independente Sol medium: sem achados materiais; correção menor ArrowUp aplicada e testada.
- Referência API acessibilidade: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- Migração operacional ainda não aplicada; procedimento docs/tablets-multidepot.md. Sem push/deploy.
