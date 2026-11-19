import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAuxiliarySrt,parseSrtTimecode,buildAuxiliaryContexts} from '../srt-reference-context.js';
import {parseSrt} from '../srt-core.js';
import {buildReviewPayload,buildReviewInstructions,buildManualPrompt} from '../review-payload.js';
import {describeBatchBudget} from '../batch-budget.js';
import {modelTargets} from '../choice-review.js';
import {readFileSync} from 'node:fs';

const source='1\n00:01:00,000 --> 00:01:04,000\n정부가 발표했다.\n\n2\n00:01:14,000 --> 00:01:17,000\n다음 회의.\n';
const aux='1\r\n00:01:07,000 --> 00:01:10,000\r\n<font color="white">政府已经公布。</font>\r\n\r\n2\r\n00:01:21,000 --> 00:01:24,000\r\n下次会议。\r\n';
const document=parseSrt(source);
const reference=parseAuxiliarySrt(aux);
const target={
 target_id:'t0',surface:'정부',start:0,end:2,context:'정부가 발표했다.',
 options:[{choice_id:'KEEP',type:'keep',replacement:'정부',entry_id:null,definitions:[]},
  {choice_id:'c0',type:'hanja',replacement:'政府',entry_id:1,definitions:['government']}]
};
test('auxiliary SRT accepts non-Korean captions and strips inline styling',()=>{
 assert.equal(reference.length,2);
 assert.equal(reference[0].text,'政府已经公布。');
 assert.deepEqual(parseSrtTimecode('00:00:01,000 --> 00:00:02,000'),{startMs:1000,endMs:2000});
 assert.equal(parseSrtTimecode('00:00:02,000 --> 00:00:01,000'),null);
 assert.throws(()=>parseAuxiliarySrt('only translation without timestamps'),/时间轴/);
});
test('time-neighborhood works with ~7 sec mismatch without changing Korean cue positions',()=>{
 const original=JSON.stringify(document);
 const out=buildAuxiliaryContexts(document,reference);
 assert.equal(out.matched,2);
 assert.match(out.contexts.get(0),/政府已经公布/);
 assert.match(out.contexts.get(1),/下次会议/);
 assert.equal(JSON.stringify(document),original);
});
test('user-supplied offsets correct large time shifts; wrong episodes are not guessed by ordinal cue index',()=>{
 const late=parseAuxiliarySrt('1\n00:03:01,000 --> 00:03:04,000\nTranslated voice\n');
 const none=buildAuxiliaryContexts(document,late);
 assert.equal(none.matched,0);
 const shifted=buildAuxiliaryContexts(document,late,-120);
 assert.equal(shifted.matched,2);
 assert.match(shifted.contexts.get(0),/Translated voice/);
 assert.throws(()=>buildAuxiliaryContexts(document,late,Infinity),/偏移/);
});
test('shared pool attaches reference only to its existing Korean sentence, not target or offsets',()=>{
 const ref='00:01:07 政府已经公布。';
 const targets=[{...target,reference_context:ref}];
 const p=buildReviewPayload('',targets,{}).payload;
 assert.equal(p.sentences[0].reference_context,ref);
 assert.equal(p.targets[0].reference_context,undefined);
 assert.equal(p.targets[0].surface,'정부');
 assert.equal(p.targets[0].start,0);
 assert.equal(p.targets[0].end,2);
 assert.equal(p.origin_mode,undefined);
 assert.equal(buildReviewPayload('',[target],{}).payload.sentences[0].reference_context,undefined);
 const wire=modelTargets(targets,{reviewPosFilter:false});
 assert.equal(wire[0].reference_context,ref);
});
test('API and manual prompts mark reference as lower-trust contextual evidence only when present',()=>{
 const refs=[{...target,reference_context:'00:01:07 Government announced.'}];
 const ordinary=buildReviewInstructions({});
 const withReference=buildReviewInstructions({referenceSubtitle:true});
 assert.doesNotMatch(ordinary,/AUXILIARY SUBTITLES/);
 assert.match(withReference,/AUXILIARY SUBTITLES/);
 assert.match(withReference,/not etymological proof/);
 assert.match(buildManualPrompt('',refs,'batch42',{}),/AUXILIARY SUBTITLES/);
 assert.doesNotMatch(buildManualPrompt('',[target],'batch42',{}),/AUXILIARY SUBTITLES/);
 assert.match(buildReviewInstructions({dictionaryCorrectionOnly:true,referenceSubtitle:true}),/AUXILIARY SUBTITLES/);
 const b0=describeBatchBudget('',[target],{tier:'32k'});
 const b1=describeBatchBudget('',refs,{tier:'32k'});
 assert.ok(b1.inputTokens>b0.inputTokens);
});
test('SRT module attaches reference per cue in both API and manual pipeline, and does not change output',()=>{
 const page=readFileSync(new URL('../srt-page.js',import.meta.url),'utf8');
 const pipeline=readFileSync(new URL('../annotation-pipeline.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../srt.html',import.meta.url),'utf8');
 for(const id of ['referenceFile','referenceEncoding','referenceOffsetSeconds','clearReference','referenceInfo'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(page,/referenceContext:referenceContexts\.contexts\.get\(s\.cueIndex\)/);
 assert.match(page,/port\.postMessage\(\{type:'START',operationId,sentences/);
 assert.match(pipeline,/reference_context:sentence\.referenceContext/);
 assert.match(pipeline,/reference_context/);
});
