// Idempotent catalog extension: no users or credentials are created here.
export async function seedPc01Catalog(db){
 for(const role of ['ADMIN','COORDENADOR','GESTOR','FINANCEIRO']){
  await db.query(`IF NOT EXISTS(SELECT 1 FROM Seguranca.PerfilAcesso WHERE Codigo='PC01_${role}') INSERT Seguranca.PerfilAcesso(Codigo,Nome,Sistema,Ativo) VALUES('PC01_${role}',N'Portal Control - ${role}',1,1)`);
  // Coordinator capabilities are enforced by the current operational APIs;
  // do not inherit legacy gestor/financial grants or global administration.
  const sources=role==='ADMIN'?"'PILOTO_ADMIN','PILOTO_GESTOR','PILOTO_FINANCEIRO'":`'PILOTO_${role}'`;
  await db.query(`INSERT Seguranca.PerfilPermissao(PerfilId,PermissaoId) SELECT DISTINCT target.PerfilId,pp.PermissaoId FROM Seguranca.PerfilAcesso target CROSS JOIN Seguranca.PerfilAcesso source JOIN Seguranca.PerfilPermissao pp ON pp.PerfilId=source.PerfilId WHERE target.Codigo='PC01_${role}' AND source.Codigo IN(${sources}) AND NOT EXISTS(SELECT 1 FROM Seguranca.PerfilPermissao prior WHERE prior.PerfilId=target.PerfilId AND prior.PermissaoId=pp.PermissaoId)`);
 }
}
