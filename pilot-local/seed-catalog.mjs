import {seedPc01Catalog} from './pc01-catalog.mjs';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const gestor=['atividades.visualizar','atividades.criar','atividades.confirmar','apontamentos.emitir','apontamentos.visualizar','apontamentos.conferir','apontamentos.correcao.solicitar','apontamentos.tablet.gerir','operacao.fechamento.visualizar','operacao.fechamento.encerrar','operacao.comprovante.visualizar','operacao.ocorrencia.registrar','prestadores.visualizar','prestadores.cadastrar','filiais.visualizar','servicos.visualizar','depositos.visualizar','tiposprestador.visualizar'];
const financeRead=['financeiro.carteira.consultar','financeiro.carteira.exportar','financeiro.autorizacao.consultar','financeiro.prontidao.consultar','financeiro.f01.consultar','financeiro.f03.consultar','financeiro.lab.consultar'];
const roles={GESTOR:gestor,ADMIN:['limites.configurar','atividades.visualizar'],FINANCEIRO:[...financeRead,'financeiro.elegibilidade.analisar','financeiro.autorizacao.solicitar',...['provisionar','preparar','programar','registrar','cancelar','estornar','recibos','anexar','consultararquivo','exportar'].map(x=>'financeiro.lab.'+x)],CONFIGURADOR:[...financeRead,'financeiro.prontidao.propor','financeiro.f01.configurar','financeiro.f03.configurar','financeiro.lab.configurar'],VALIDADOR:[...financeRead,'financeiro.prontidao.validar','financeiro.f03.validar','financeiro.lab.validar'],APROVADOR:[...financeRead,'financeiro.autorizacao.decidir','financeiro.lab.liberar'],ARQUIVO:[...financeRead,'financeiro.lab.conferirarquivo','financeiro.lab.ocultar','financeiro.lab.consultararquivo'],DIRETORIA:['atividades.visualizar','limites.excecao.aprovar','apontamentos.correcao.aprovar','diretoria.lab.consultar']};
roles.CONFIGURADOR.push('financeiro.f03.global');
roles.VALIDADOR.push('financeiro.f01.publicar','financeiro.f03.publicar','financeiro.f03.global');
roles.APROVADOR.push('financeiro.f01.excecao.decidir','financeiro.f01.alcada.simular');
roles.FINANCEIRO.push('financeiro.f01.excecao.solicitar');
export async function seedCatalog(db){
 const keys=new Set(Object.values(roles).flat());
 for(const folder of ['../src','sql'])for(const name of fs.readdirSync(path.join(here,folder)).filter(x=>/\.(js|sql)$/.test(x))){const source=fs.readFileSync(path.join(here,folder,name),'utf8');for(const match of source.matchAll(/'((?:financeiro|apontamentos|operacao|atividades|limites|prestadores|filiais|servicos|depositos|tiposprestador)\.[a-z.]+)'/g))if(!match[1].endsWith('.'))keys.add(match[1]);}
 for(const key of [...keys].sort()){const read=/\.(consultar|visualizar|exportar)$/.test(key)||key==='atividades.criar'||/^(prestadores|filiais|servicos|depositos|tiposprestador)\./.test(key);await db.query(`IF NOT EXISTS(SELECT 1 FROM Seguranca.Permissao WHERE Chave='${key}') INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) VALUES('${key}','PILOTO_LOCAL',N'${key}',${read?0:1})`);}
 for(const [role,permissions]of Object.entries(roles)){
  await db.query(`INSERT Seguranca.PerfilAcesso(Codigo,Nome,Sistema,Ativo) VALUES('PILOTO_${role}',N'Piloto - ${role}',1,1)`);
  for(const key of permissions)await db.query(`INSERT Seguranca.PerfilPermissao(PerfilId,PermissaoId) SELECT pa.PerfilId,p.PermissaoId FROM Seguranca.PerfilAcesso pa CROSS JOIN Seguranca.Permissao p WHERE pa.Codigo='PILOTO_${role}' AND p.Chave='${key}'`);
 }
 await seedPc01Catalog(db);
 return {roles:Object.keys(roles).length+3,permissions:keys.size};
}
