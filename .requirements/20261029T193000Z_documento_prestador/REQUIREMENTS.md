# CPF ou CNPJ único no prestador
## As Is
PC03 exige CPF e apresenta CNPJ separado opcional. CPF no SQL é char(11), único.
## To Be
Um campo obrigatório CPF ou CNPJ aceita documento numérico de 11 ou 14 dígitos, com ou sem pontuação, no cadastro, edição, lista e busca.
## Requirements
1. Um campo documento em vez de CPF e CNPJ separados.
2. Identificar CPF/CNPJ pela quantidade de dígitos; rejeitar vazio, letras e quantidade diferente de 11/14; não introduzir regra nova de dígitos verificadores.
3. Persistir ambos integralmente, impedir duplicidade e manter permissões, auditoria, versão e depósitos.
4. Atualizar piloto local preservando conta e dados, sem reset.
## Acceptance Criteria
CPF e CNPJ criam e reabrem no mesmo campo; valores inválidos não escrevem; documento repetido gera conflito; gestor não altera documento; filtro encontra ambos; cancelamento não grava.
## Principal Regression Test
PC03 HTTP/serviço e SQL real: criar CNPJ usando documento sem CPF separado. Deve falhar no contrato/char11 antes e persistir 14 dígitos depois.
## Testing Plan
Red/green em HTTP real com transporte SQL scripted; instalação SQL descartável e salvar/reler CPF/CNPJ/duplicidade; UI headless campo único/cadastro/edição/filtro. Testes existentes PC03 para escopo e concorrência.
## Implementation Plan
Testes de documento; normalização/API; migração aditiva de largura e constraint; UI; provas focais e aplicação no piloto com backup/reinício.
## Ferramentas
Serena/Lad indisponíveis conforme inventário anterior. APIs ODBC/Node existentes verificadas no trabalho anterior; nenhuma dependência nova.

## Resultado
- Implementado: único campo obrigatório `documento` na UI/API, aceita CPF/CNPJ com ou sem máscara; lista, busca e edição usam a mesma identidade. Compatibilidade de leitura interna mantida pela coluna CPF ampliada para varchar(14); coluna CNPJ antiga não é apresentada como segundo campo.
- Red `node --test tests/pc03.test.mjs`: novos casos CPF/CNPJ unificados recusados com CAMPOS_INVALIDOS (400 em vez de 201). Green após normalização e largura SQL corrigidas.
- Lote focal PC03/PC04/PC08/PC11/depot-legacy: 138 PASS, sem falhas. Permissões de alteração de documento e isolamento por depósito preservados.
- SQL real `PC03_SQL_TESTS=YES PC03_SQL_SERVER=localhost\\SQLEXPRESS node --test integration/pc03.integration.mjs`: PASS; criar CNPJ formatado sem CPF separado, releitura integral 14 dígitos, filtro documento, duplicidade 409, editar/reler, inválidos sem escrita; casos existentes de CPF concorrente, histórico e autorização. Banco descartável removido.
- `integration/provider-document.visual.mjs`: PASS no componente real com HTTP sintético, 1440/390 inspecionados; CPF/CNPJ, edição/cancelamento, inválido sem escrita, busca e ausência dos dois inputs antigos.
- Migration 30 instalada no piloto local após encerramento e backup verificado; comparação de snapshots das 68 tabelas confirmou todas as linhas preservadas. Sem reset, sem alteração de senha.
- Portal reiniciado e validado por identidade HMAC, health 200, coluna de 14 dígitos e script servido com campo único. Checks de sintaxe dos arquivos alterados PASS.
- Sem commit/push/publicação externa. Screenshots e logs locais em artifacts/provider-document.
