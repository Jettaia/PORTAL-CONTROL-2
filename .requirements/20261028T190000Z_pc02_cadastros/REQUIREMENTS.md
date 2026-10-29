# PC-02 — Filiais e tipos de atividade

## As Is
Cadastros B24 existentes têm nome/código/situação, mas não endereço da filial ou descrição do tipo. PC-01 está em andamento no workspace e deve ser preservado. Consultas operacionais filtram filial ativa, ocultando histórico. Sem SQL Server local disponível.

## To Be
ADM mantém filiais com nome/endereço/código interno e tipos globais com nome/descrição opcional/situação. Inativar impede novos lançamentos sem excluir referências.

## Requirements
1. Reutilizar Cadastro.Filial e Cadastro.TipoServico; acrescentar somente Endereco e Descricao, sem categoria no prestador.
2. Proteger toda mutação por ADM real, sessão, origem e MFA recente; auditar atomicamente e rejeitar edição desatualizada.
3. Manter formato de código existente (maiúsculas A-Z, 0-9, _ e -, até 30), unicidade inclusive inativos e nomes de tipos únicos. Preservar IDs e referências.
4. Listar históricos independentemente da situação cadastral; catálogos para novos lançamentos apenas ativos. Integração da conclusão do novo fluxo PC-04 permanece responsabilidade daquele ticket.
5. Não migrar banco instalado, publicar ou executar deploy. Ativação explícita PC-02 exige PC-01 e schema provisionado.

## Acceptance Criteria
1. Formulários/API persistem os campos e permitem descrição vazia; filial nova/editada exige endereço.
2. Anônimo, gestor e financeiro não gravam; origem/MFA inválidos são recusados; atualização concorrente retorna conflito.
3. Inativação mantém registros e histórico; duplicações não sobrescrevem cadastro.
4. Consulta histórica conserva registros; novo lançamento com filial/tipo inativo é recusado. Endereço fica acessível no contrato de filial para PC-09.
5. Extensão SQL só integra instalador protegido/teste descartável; nenhuma execução em banco instalado.

## Principal Regression Test
`node --test tests/pc02.test.mjs`: HTTP público de filiais e tipos, dados adicionais, validação, atualização e permissão; deve falhar antes por módulo inexistente e passar após. `integration/pc02.visual.mjs` usa formulário real e HTTP sintético; SQL real é teste opt-in isolado.

## Testing Plan
RED/GREEN HTTP, suíte adjacente, syntax check, interação visual desktop/tablet/celular com erro/edição/inativação/troca de cadastro. SQL opt-in cobre persistência, conflitos, referências e bloqueio de novos lançamentos; sem instância não declarar aceite SQL.

## Implementation Plan
1. Teste HTTP antes do código; serviço e rotas sobre endpoints B24 existentes.
2. Extensão SQL aditiva guardada e configuração explícita; conferir geração sem instalar.
3. Formulários existentes e histórico; validar UI real com API sintética.
4. Regressão e revisão independente; atualizar SPEC com resultado e limitações.

## Technical references
Microsoft SQL Server: ALTER TABLE nullable columns e sp_getapplock com LockOwner Transaction, verificados na documentação oficial MicrosoftDocs/sql-docs.

## Results
RED confirmado por módulo ausente; GREEN 10 testes PC02, suíte 92/92 e piloto 2/2. UI real com HTTP sintético PASS nos 3 viewports. SQL real SKIP por ausência de instância. Revisão própria + subagente independente aprovou com ressalva SQL/integração PC04. LAD desabilitado em config.toml; Serena não exposta na sessão. Nenhuma chamada LAD/Serena executada. Resultado canônico: docs/PC-02-CADASTROS.md e registro no ticket PC-02 em docs/SPEC.md.
