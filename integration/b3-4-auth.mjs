import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {login} from '../src/auth-db.js';import {enroll,verify} from '../src/mfa-b2b.js';import {hotp} from '../src/totp.js';import {decode} from './b3-3-fixture.mjs';
export async function authenticateSynthetic(cfg,user){
 process.env.JETTA_MFA_KEY_HEX??=crypto.randomBytes(32).toString('hex');
 user.token=(await login(cfg,user.email,user.password)).token;const setup=await enroll(cfg,user,user.token);user.secret=decode(setup.secret);
 // Preserve a real previous-step enrollment code without crossing its validity window.
 const remaining=30000-Date.now()%30000;if(remaining<12000)await new Promise(r=>setTimeout(r,remaining+100));
 assert.equal(await verify(cfg,user,user.token,hotp(user.secret,Math.floor(Date.now()/30000)-1),'ENROLL'),true);return user;
}
