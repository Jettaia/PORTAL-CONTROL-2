export const B2C_ENV='JETTA_MFA_REQUIRE_PRIVILEGED';
export const PUBLIC_API=new Set(['/api/health','/api/auth/login','/api/auth/logout','/api/auth/me','/api/b25b/ativar','/api/mfa/status','/api/mfa/enroll','/api/mfa/verify']);
export function gateDecision({enforce,privileged,method,route,mfa}){
 if(!enforce || !privileged || PUBLIC_API.has(route))return {allow:true};
 if(!mfa?.enrolled)return {allow:false,reason:'MFA precisa ser configurado'};
 if(!mfa?.verified)return {allow:false,reason:'Confirme o segundo fator nesta sessao'};
 if(['POST','PUT','PATCH','DELETE'].includes(method)&&!mfa?.stepUp)return {allow:false,reason:'Confirme MFA recente para esta operacao'};
 return {allow:true};
}
export function validateKeyConfig(env){
 if(env[B2C_ENV]!=='true')return {enforced:false};
 if(!/^[a-fA-F0-9]{64}$/.test(env.JETTA_MFA_KEY_HEX||''))throw Error('MFA chave ausente/invalida');
 if(env.JETTA_MFA_ENFORCE_CRITICAL!=='true')throw Error('Protecao de escritas MFA deve estar ativa junto com gate privilegiado');
 return {enforced:true};
}
