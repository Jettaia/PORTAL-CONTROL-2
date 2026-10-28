import crypto from 'node:crypto';
// Biblioteca isolada para homologacao. NAO integrada ao login nesta versao.
export function hotp(secret, counter, digits=6) {
  if (!Buffer.isBuffer(secret) || secret.length<20) throw new TypeError('Segredo invalido');
  if (!Number.isSafeInteger(counter)||counter<0) throw new TypeError('Contador invalido');
  if (digits!==6 && digits!==8) throw new TypeError('Digitos invalidos');
  const buffer=Buffer.alloc(8); buffer.writeBigUInt64BE(BigInt(counter));
  const hmac=crypto.createHmac('sha1',secret).update(buffer).digest();
  const offset=hmac[hmac.length-1]&15;
  const n=(hmac.readUInt32BE(offset)&0x7fffffff) % (10**digits);
  return String(n).padStart(digits,'0');
}
export function verifyTotp(secret, code, nowMs=Date.now(), lastAccepted=-1) {
  if (typeof code!=='string'|| !/^\d{6}$/.test(code)) return {valid:false};
  const step=Math.floor(nowMs/30000);
  for(const delta of [-1,0,1]) {
    const candidate=step+delta;
    if(candidate<0 || candidate<=lastAccepted) continue;
    const expected=hotp(secret,candidate);
    if(crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(code))) return {valid:true,step:candidate};
  }
  return {valid:false};
}
export function newTotpSecret(){return crypto.randomBytes(20);}
// Requisito para integracao: atualizar UltimoPassoAceito com lock atomico; nunca somente confiar no retorno desta funcao.
