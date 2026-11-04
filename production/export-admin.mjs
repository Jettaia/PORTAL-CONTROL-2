// Read-only source export. The credential never appears on stdout.
import fs from 'node:fs';
import {connectPilot} from '../pilot-local/database.mjs';
import {validateAdmin} from './bootstrap.mjs';
const cfg=JSON.parse(fs.readFileSync('secrets/pilot-local/runtime.json','utf8'));
const db=await connectPilot(cfg.database,cfg.server);
try{
 const rows=await db.query("SELECT u.UsuarioId id,u.Nome name,u.Email email,c.SaltHex saltHex,c.SenhaHashHex passwordHashHex FROM Seguranca.Usuario u JOIN Seguranca.Credencial c ON c.UsuarioId=u.UsuarioId JOIN Seguranca.UsuarioRaiz r ON r.UsuarioId=u.UsuarioId WHERE u.Perfil='ADMIN' AND u.Ativo=1 AND u.ExcluidoEmUtc IS NULL");
 if(rows.length!==1)throw Error('Exige exatamente um ADMIN raiz ativo na origem');
 const admin=validateAdmin({...rows[0],id:String(rows[0].id)});
 fs.writeFileSync('secrets/chapa-production/admin-import.json',JSON.stringify(admin),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({exportedAdmins:1,containsOperationalData:false,plaintextPassword:false}));
}finally{await db.close();}
