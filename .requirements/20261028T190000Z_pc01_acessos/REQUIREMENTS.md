# PC-01 — Acessos e administração de usuários

## As Is
Login com scrypt, sessão persistida, MFA e RBAC existentes. Piloto possui setup privado de uso único; convites legados não ativam ADM. Perfil-base único impede acúmulo funcional. Não há edição completa de contas nem desativação administrativa. Workspace inicial vazio; implementação no repositório que contém a SPEC indicada pelo usuário. SPEC.md e recibos/ já estavam não rastreados: preservar.

## To Be
Executar exclusivamente PC-01 de docs/SPEC.md. Reutilizar identidade, MFA e setup; ADM mantém contas, funções e filiais, com autorização também na API e revogação de sessões. Nenhuma instalação, migração de banco real ou publicação autorizada.

## Requirements
1. Somente ADM cria/edita contas com nome, e-mail normalizado único, senha forte e funções explícitas ADM/GESTOR/FINANCEIRO.
2. Gestor opera nas filiais concedidas; financeiro consulta globalmente e não ganha operação; funções acumulam apenas por concessão administrativa.
3. Desativação e alteração de acessos revogam sessões/convites sem apagar autoria; impedir remoção do último ADM ativo.
4. Preservar setup privado do primeiro ADM, MFA, cookies e proteção de origem. Não introduzir recuperação pública de senha; manter fluxo de ativação legado compatível.
5. Tela de usuários permite criar/editar funções, filiais e situação em computador/tablet. Funcionalidade ativada explicitamente após preparação do schema; instalações antigas permanecem no modo anterior.

## Acceptance Criteria
1. Chamadas sem autenticação retornam 401; gestor/financeiro recebem 403; duplicidade inclusive e-mail com caixa/espaços é recusada; hash e salt nunca saem na resposta/auditoria.
2. Chamadas forjadas de outra filial são recusadas, inclusive no planejamento; combo gestor/financeiro mantém operação restrita e financeiro global. ADM opera todas as filiais.
3. Sessão anterior deixa de autenticar após desativação/edição; usuário e fatos históricos permanecem; último ADM protegido sob transação serializada.
4. Setup usa identidade privada e token consumível existente, sem credenciais fixas; ações administrativas exigem MFA recente além dos gates existentes.
5. Estados de carregamento, erro, salvamento e edição aparecem; campos têm labels, senha não permanece após salvar/sair; verificar geometrias desktop/tablet.

## Principal Regression Test
tests/pc01.test.mjs: chamadas HTTP no roteador real, com sessão e adaptador de persistência de teste. Red inicial: módulo ausente. Integração SQL separada exercita createApp, login, persistência, MFA e sessão revogada, sem substituir SQL por mocks. Red/green local não comprova SQL.

## Testing Plan
Testes de contrato HTTP e validação; suites nativas adjacentes; integração SQL opt-in exclusivamente em banco descartável com identidade de teste. UI com navegação e submissão reais no navegador sobre API de teste quando SQL indisponível. Não declarar homologação SQL sem execução.

## Implementation Plan
1. Escrever e executar teste HTTP red; implementar validação, serviço transacional e rotas.
2. Preparar extensão de schema e contratos de funções/filiais, preservando permissões/MFA; ligar consumidores.
3. Acrescentar UI integrada à navegação existente e teste de interação.
4. Executar suites, revisão independente de segurança e SPEC; corrigir achados materiais e registrar limites no ticket.

## Fontes técnicas e ambiente
Microsoft Learn: https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql — lock com owner Transaction exige transação, retorno negativo representa falha.
Serena e Lad ausentes no inventário de ferramentas. Node 24 disponível; npm via pnpm dlx npm. SQL Server/sqlcmd não disponíveis: nenhuma conexão a banco operacional.

## Resultado atual
Implementação e UI verificadas; revisão independente GPT-6.1 Sol medium aprovada com ressalva SQL. Resultados, comandos e limites em docs/PC-01-ACESSOS.md. Integração SQL preparada e não executada (SKIPPED): aceite integrado pendente. Sem migrar dados existentes ou executar deploy. TDD parcial: red/green HTTP comprovado, SQL real ainda não comprovado.
