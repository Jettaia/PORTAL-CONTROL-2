# PC-03 — Prestadores e vínculos com filiais

## As Is
PC-01/PC-02 estão implementados com homologação SQL pendente. Prestador já tem ID, CPF único, nome, telefone e situação. A tela legada não oferece busca por CPF nem vínculo com filial; edição é restrita ao ADM. Trabalho existente deve ser preservado.

## To Be
Cadastro compartilhado por CPF, com CNPJ/telefone opcionais, vínculos individuais com filiais autorizadas e histórico atômico. Implementar somente PC-03 já autorizado, conforme docs/SPEC.md, sem migração do banco instalado.

## Requirements
1. Criar exige nome completo, CPF e ao menos uma filial ativa autorizada; não exige categoria, endereço ou banco.
2. Busca exata por CPF reutiliza a pessoa global, inclusive sem vínculos. Duplicidade concorrente é recusada sem sobrescrever dados.
3. Gestor edita nome/telefone/CNPJ de pessoa vinculada a seu escopo, com autoria; somente ADM corrige CPF ou altera situação. Edição concorrente obsoleta é recusada.
4. Gestor adiciona/remove somente vínculos de suas filiais; pode remover o último e vínculos com pendências. Links de outras filiais não são expostos nem substituídos. ADM opera globalmente.
5. Preservar contratos anteriores e impedir novos lançamentos de pessoa inativa ou desvinculada. Conclusão após inativação permanece integração com PC-04.

## Acceptance Criteria
1. API recusa campos obrigatórios ausentes e filial forjada; opcionais vazios são aceitos.
2. CPF existente retorna o mesmo ID; criação duplicada retorna 409. Busca global exata não divulga contratos nem vínculos alheios.
3. Financeiro isolado/anônimo não gravam; gestor não altera CPF/situação nem dados sem vínculo autorizado. Alterações e vínculos têm auditoria na mesma transação.
4. Remoção do último vínculo conserva pessoa e busca. Operações idempotentes não duplicam vínculo; uma filial não pode remover a de outra.
5. Histórico não depende de vínculo atual; seleção e inclusão nova validam vínculo ativo. Não declarar integração PC-04 ou SQL aprovada sem executar.

## Principal Regression Test
`node --test tests/pc03.test.mjs`: fluxo HTTP com o serviço real e transporte ODBC substituído, incluindo criação, edição, busca, vínculos e negações. RED esperado: módulo PC-03 ausente; GREEN: comportamento e rollback. SQL simulado não demonstra semântica SQL/concorrência real; teste descartável opt-in separado.

## Testing Plan
Testes de contrato e serviço real com ODBC controlado; UI real com backend sintético para buscar/vincular, remover último, editar e negar ações; regressão PC-01/PC-02/suíte nativa. Preparar SQL descartável com dois gestores, CPF concorrente e preservação. Executar quando instância local disponível.

## Implementation Plan
1. Testes RED; módulo e rotas opt-in PC-03 com transações, autorização persistida, MFA, unicidade e auditoria; GREEN focal.
2. Extensão aditiva CNPJ, versão e PrestadorFilial, gerador e configuração de novos pilotos; proteger inclusão operacional, mantendo consulta histórica.
3. Interface própria no painel existente, sem interferir nos cadastros PC-02; testar interação e formatos desktop/tablet/celular.
4. Revisão independente de segurança e regressão; registrar resultados no ticket canônico.

## Ferramentas e referências
Serena ativada; símbolos indisponíveis porque TypeScript não encontra npm no PATH. LAD não exposto: README local informa enabled=false por credencial pendente; system_design_review/code_review não executados, sem aprovação LAD. Revisão própria e revisão independente serão identificadas separadamente.
Documentação verificada: [sp_getapplock](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql): dono Transaction exige transação aberta, retorno negativo exige recusa. Unicidade CPF existente permanece como última defesa.

## Resultado atual
Implementação local pronta; 28 testes focais GREEN e UI headless PASS. Revisão independente Sol medium sem achados materiais. Provas/limites/QA registrados uma vez em docs/PC-03-PRESTADORES.md e resumidos em docs/SPEC.md. SQL SKIP, aceite integrado pendente e conclusão após inativação depende PC-04. Sem migração instalada/deploy.
