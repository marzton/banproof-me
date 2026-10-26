import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){if(specifier==='cloudflare:workers')return{url:'data:text/javascript,export class WorkflowEntrypoint { constructor(ctx,env){this.env=env;} }',shortCircuit:true};return nextResolve(specifier,context)}});
const {default:worker}=await import('../src/index.ts');
const req=(path,method='GET',body)=>new Request('https://admin.banproof.me'+path,{method,headers:{'Authorization':'Bearer fixture-token'},...(body?{headers:{'Content-Type':'application/json','Authorization':'Bearer fixture-token'},body:JSON.stringify(body)}:{})});
test('root reports unavailable when an admin site is not configured',async()=>{const r=await worker.fetch(req('/'),{});assert.equal(r.status,503);assert.equal((await r.json()).ok,false);});
test('unknown API routes return JSON 404 without an assets binding',async()=>{const r=await worker.fetch(req('/api/unknown'),{});assert.equal(r.status,404);assert.equal((await r.json()).ok,false);});
test('preflight reads the request method',async()=>{const r=await worker.fetch(req('/api/poa/fixture','OPTIONS'),{});assert.equal(r.status,204);});
test('status retrieval uses the workflow binding',async()=>{let id;const r=await worker.fetch(req('/api/poa/fixture'),{POA_TOKEN:'fixture-token',CONTENT_WORKFLOW:{get:async value=>{id=value;return{status:async()=>({status:'complete'})}}}});assert.equal(r.status,200);assert.equal(id,'fixture');assert.equal((await r.json()).status.status,'complete');});
test('unsupported status methods are rejected',async()=>{const r=await worker.fetch(req('/api/poa/fixture','DELETE'),{POA_TOKEN:'fixture-token'});assert.equal(r.status,405);});
test('invalid submission is rejected before workflow creation',async()=>{const r=await worker.fetch(req('/api/poa/submit','POST',{contentType:'invalid'}),{POA_TOKEN:'fixture-token'});assert.equal(r.status,422);});
test('valid submission starts one workflow',async()=>{let calls=0;const r=await worker.fetch(req('/api/poa/submit','POST',{contentType:'text',payload:'hello'}),{POA_TOKEN:'fixture-token',CONTENT_WORKFLOW:{create:async({id,params})=>{calls++;assert.equal(params.contentType,'text');return{id,status:async()=>({status:'queued'})}}}});assert.equal(r.status,202);assert.equal(calls,1);});


test('workflow operations fail closed without a configured token',async()=>{const r=await worker.fetch(req('/api/poa/fixture'),{});assert.equal(r.status,503);});
test('workflow operations reject unauthenticated callers',async()=>{const r=await worker.fetch(new Request('https://admin.banproof.me/api/poa/fixture'),{POA_TOKEN:'fixture-token'});assert.equal(r.status,401);});
