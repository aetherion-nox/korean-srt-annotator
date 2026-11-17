import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('SRT API and in-page manual channel both forward invalid-answer policies',()=>{
 const api=load('service-worker.js'),manual=load('srt-manual-channel.js');
 for(const name of ['retryInvalidDictionaryChoices','discardInvalidReviewResults']){
  assert.match(api,new RegExp(name+':config\\.'+name));
  assert.match(manual,new RegExp(name+':settings\\.'+name));
 }
});

test('SRT grouped settings expose and reset the two exclusive controls',()=>{
 const html=load('options.html');
 const engine=load('engine-settings.js');
 for(const id of ['retryInvalidDictionaryChoices','discardInvalidReviewResults']){
  assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(engine,new RegExp(id));
 }
 assert.match(engine,/resetEngineSwitches/);
 assert.match(engine,/discardInvalidReviewResults.*retryInvalidDictionaryChoices/);
});

test('subtitle time-axis and literal parentheses logic remain within SRT-owned modules',()=>{
 const core=load('srt-core.js'),page=load('srt-page.js');
 assert.match(core,/-->\\s+/);
 assert.match(core,/renderSrt/);
 assert.match(page,/mergeSrtResults/);
 assert.match(page,/filterUntimedLines/);
});
