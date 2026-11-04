import crypto from 'node:crypto';
export const hashToken = token => crypto.createHash('sha256').update(token,'utf8').digest('hex');
export const newToken = () => crypto.randomBytes(32).toString('hex');
export function hashPassword(password,saltHex){
 return crypto.scryptSync(password,Buffer.from(saltHex,'hex'),64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
}
export function passwordValid(password,saltHex,stored){
 if(!/^[a-f0-9]{32}$/i.test(saltHex||'')||!/^[a-f0-9]{128}$/i.test(stored||'')) return false;
 const got=Buffer.from(hashPassword(password,saltHex),'hex');
 return crypto.timingSafeEqual(got,Buffer.from(stored,'hex'));
}
export function cookieValue(raw,cfg={}){return `${cfg.cookieName||'jetta_session'}=${raw};${cfg.cookieSecure?' Secure;':''} HttpOnly; SameSite=Strict; Path=${cfg.cookiePath||'/api'}; Max-Age=28800`;}
export function clearCookie(cfg={}){return `${cfg.cookieName||'jetta_session'}=;${cfg.cookieSecure?' Secure;':''} HttpOnly; SameSite=Strict; Path=${cfg.cookiePath||'/api'}; Max-Age=0`;}
export function parseSessionCookie(header='',cfg={}){
 const name=cfg.cookieName||'jetta_session';
 const value=header.split(';').map(part=>part.trim()).find(part=>part.startsWith(name+'='))?.slice(name.length+1);
 return /^[a-f0-9]{64}$/i.test(value||'')?value:null;
}
