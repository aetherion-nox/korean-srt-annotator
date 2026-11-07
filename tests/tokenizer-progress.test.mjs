import test from 'node:test';import assert from 'node:assert/strict';import {createKiwiManager} from '../kiwi-manager.js';
test('updated tokenizer reports initialization only when loading its model, builtin stays lazy',async()=>{
 const state={active:null};let phases=0,loads=0;
 const manager=createKiwiManager({store:async(action,key)=>key==='kiwi-runtime-state-v1'?state:{version:'fixture'},sandbox:()=>({load:async()=>loads++,tokenize:async text=>[{str:text,tag:'NNG',position:0,length:text.length}],close(){}})});
 assert.equal(await manager.tokenize('학교',()=>phases++),null);assert.equal(phases,0);
 state.active={key:'updated'};const first=await manager.tokenize('학교',()=>phases++),second=await manager.tokenize('학교',()=>phases++);
 assert.deepEqual(first,second);assert.equal(loads,1);assert.equal(phases,1);
});
