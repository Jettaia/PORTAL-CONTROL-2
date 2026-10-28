import {procedureSql,withDb,nvarcharLiteral,intLiteral} from './auth-db.js';
export const permissions={tipos:'tiposprestador.visualizar',criar:'tiposprestador.cadastrar',vincular:'prestadores.tipos.atribuir'};
export async function listTypes(cfg){return withDb(cfg,db=>db.query('SELECT TOP (200) TipoPrestadorId,Nome,Ativo FROM Cadastro.TipoPrestador ORDER BY Nome'));}
export async function createType(cfg,uid,nome){const n=String(nome||'').trim();if(n.length<2||n.length>120)throw Error('Nome invalido');return withDb(cfg,db=>db.query(procedureSql('Cadastro.sp_B24B_CriarTipoPrestador',{AtorId:intLiteral(uid),Nome:n})));}
export async function linkType(cfg,uid,prestador,tipo){return withDb(cfg,db=>db.query(procedureSql('Cadastro.sp_B24B_VincularTipoPrestador',{AtorId:intLiteral(uid),PrestadorId:intLiteral(prestador),TipoPrestadorId:intLiteral(tipo)})));}
export async function providerTypes(cfg){return withDb(cfg,db=>db.query(`SELECT TOP (500) pt.PrestadorId,tp.TipoPrestadorId,tp.Nome FROM Cadastro.PrestadorTipo pt JOIN Cadastro.TipoPrestador tp ON tp.TipoPrestadorId=pt.TipoPrestadorId ORDER BY pt.PrestadorId,tp.Nome`));}
