import fs from 'node:fs';import {b52Fixture} from './b5-2-fixture.mjs';
export async function b52aFixture(){const f=await b52Fixture();try{for(const b of fs.readFileSync(new URL('b5-2a-schema.sql',import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim()))await f.q(b);f.lab.cfg.b52a=true;return f;}catch(e){await f.lab.close();throw e;}}
