import test from 'node:test';import assert from 'node:assert/strict';
import {encryptedSecret,decryptedSecret,base32} from '../src/mfa-b2b.js';
import {newTotpSecret,hotp,verifyTotp} from '../src/totp.js';
process.env.JETTA_MFA_KEY_HEX='a'.repeat(64);
test('AES-GCM round trip',()=>{const s=newTotpSecret();assert.deepEqual(decryptedSecret(encryptedSecret(s)),s);});
test('cifra com IV aleatorio',()=>{const s=newTotpSecret();assert.notDeepEqual(encryptedSecret(s),encryptedSecret(s));});
test('base32 correto',()=>{assert.equal(base32(Buffer.from('foobar')),'MZXW6YTBOI');});
test('TOTP nega reutilizacao do passo',()=>{const s=newTotpSecret();const t=Date.now();const step=Math.floor(t/30000);const code=hotp(s,step);assert.equal(verifyTotp(s,code,t,step).valid,false);});
