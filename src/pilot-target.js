export const pilotDatabase='JETTA_CONTROL_PILOTO_LOCAL';
export function isPilot(cfg){return cfg?.runtimeMode==='LOCAL_PILOT_V1'&&cfg.host==='127.0.0.1'&&cfg.database===pilotDatabase&&/^[a-f0-9]{64}$/.test(cfg.pilotInstance||'');}
export async function verifyPilotDatabase(cfg,db){
 if(cfg.runtimeMode!=='LOCAL_PILOT_V1')return;
 if(!isPilot(cfg))throw Error('Destino do piloto recusado');
 const row=(await db.query("SELECT DB_NAME() DatabaseName,CONVERT(varchar(64),(SELECT value FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE')) InstanceId,CONVERT(varchar(20),(SELECT value FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_STATE')) InstallState"))[0];
 if(row?.DatabaseName!==cfg.database||row.InstanceId!==cfg.pilotInstance||row.InstallState!=='READY')throw Error('Identidade ou estado do banco do piloto divergente');
}
