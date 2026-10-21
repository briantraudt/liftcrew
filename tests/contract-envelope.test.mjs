import test from 'node:test';
import assert from 'node:assert/strict';
import {contractEnvelope,requiredContractEnvelope} from '../src/contract-envelope.js';
const valid={id:'33333333-3333-4333-8333-333333333333',body:'Complete personalized test agreement',sha256:'a'.repeat(64)};
test('an empty database composite is not a prepared agreement',()=>{for(const value of [null,undefined,{}, {id:null,body:null,sha256:null,provider_signed_at:null}])assert.equal(contractEnvelope(value),null);});
test('persisted envelopes require body and hash',()=>{assert.deepEqual(contractEnvelope(valid),valid);assert.throws(()=>contractEnvelope({...valid,sha256:null}));assert.throws(()=>contractEnvelope({...valid,body:''}));});
test('preparation and signing cannot falsely succeed on empty results',()=>{assert.throws(()=>requiredContractEnvelope({id:null}));assert.throws(()=>requiredContractEnvelope(valid,{signed:true}));assert.equal(requiredContractEnvelope({...valid,provider_signed_at:'2026-10-21T20:00:00Z'},{signed:true}).id,valid.id);});
