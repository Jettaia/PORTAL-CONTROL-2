import test from 'node:test';import assert from 'node:assert/strict';
import {reason,decisionInput,sqlContractError} from '../src/b3-contracts.js';
test('B3.2 decisao explicita, motivo e validade obrigatorios; identidade/MFA do cliente negados',()=>{
 const good={aprovar:true,motivo:'Necessidade operacional sintetica',validadeMinutos:60,contextoHash:'A'.repeat(64)};assert.equal(decisionInput(good).aprovar,true);
 for(const body of [{...good,aprovar:'true'},{...good,motivo:' '},{...good,validadeMinutos:0},{...good,validadeMinutos:1441},{...good,MfaConfirmado:true},{...good,DiretorId:1}])assert.throws(()=>decisionInput(body));
 assert.throws(()=>reason('x'.repeat(801)));
});
test('B3.2 erros SQL de limites/MFA nao expoem mensagens ou parametros',()=>{const e=sqlContractError({odbcErrors:[{code:54204,message:'nao expor'}]});assert.equal(e.code,'IMPACTO_CONFIRMADAS_BLOQUEADO');assert.equal(e.status,409);assert.equal(sqlContractError({odbcErrors:[{code:54203}]}).status,403);});
