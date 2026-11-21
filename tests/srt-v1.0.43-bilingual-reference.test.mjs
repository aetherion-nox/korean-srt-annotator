import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseSrt,renderSrt} from '../srt-core.js';
import {extractBilingualReference,countBilingualCues,buildSrtReferenceSentences,mergeReferenceContexts} from '../srt-bilingual-context.js';
import {buildReviewPayload,buildManualPrompt,buildReviewInstructions} from '../review-payload.js';
import {modelTargets} from '../choice-review.js';
import {describeBatchBudget} from '../batch-budget.js';

const sample=['1','00:00:01,000 --> 00:00:03,000','학교에 갑니다.','我要去学校。','',
 '2','00:00:03,500 --> 00:00:05,000','다음 회의.', '<i>Next meeting.</i>','',
 '3','00:00:05,500 --> 00:00:08,000','학교(學校)를 생각했다.','',
 '4','00:00:09,000 --> 00:00:11,000','한글 대사만 있어요.','',''].join('\r\n');
const doc=parseSrt(sample);
const target=(ref)=>({
 target_id:'t0',start:0,end:2,surface:'학교',context:'학교에 갑니다.',
 ...(ref?{reference_context:ref}:{}),
 options:[{choice_id:null,type:'keep',replacement:'학교',entry_id:null,definitions:[]},
 {choice_id:'c0',type:'hanja',replacement:'學校',entry_id:1,definitions:['school']}]
});

test('automatically recognize distinct Korean + Chinese / English reference lines in same timed cue',()=>{
 assert.equal(countBilingualCues(doc),2);
 assert.equal(doc.cues[0].bilingualReference,'我要去学校。');
 assert.equal(doc.cues[1].bilingualReference,'Next meeting.');
 assert.equal(doc.cues[2].bilingualReference,undefined);
 assert.equal(doc.cues[3].bilingualReference,undefined);
 assert.equal(renderSrt(doc,new Map()),sample);
 assert.ok(doc.sentences.every(row=>!row.text.includes('我要去学校')&&!row.text.includes('Next meeting')));
});

test('other language may be Japanese, Russian or in a separated inline segment',()=>{
 assert.equal(extractBilingualReference(['안녕','こんにちは']), 'こんにちは');
 assert.equal(extractBilingualReference(['안녕','Привет мир']), 'Привет мир');
 assert.equal(extractBilingualReference(['안녕 | Hello world']), 'Hello world');
 assert.equal(extractBilingualReference(['안녕<br>你好']), '你好');
 assert.equal(extractBilingualReference(['안녕\\N你好']), '你好');
});

test('Korean-only captions, existing Hanja parentheses and loanword etymologies are not treated as translations',()=>{
 for(const lines of [
  ['학교에 갔다.'],
  ['학교(學校)에 갔다.'],
  ['컴퓨터(computer)를 사용했다.'],
  ['한국어와 English를 공부했다.'],
  ['漢字(한자)를 공부했다.']
 ])assert.equal(extractBilingualReference(lines),'');
 assert.equal(countBilingualCues(parseSrt('1\n00:00:00,000 --> 00:00:03,000\n학교(學校)에 갔다.\n')),0);
});

test('default-on own-cue reference is only a model-context field; OFF removes it',()=>{
 const a=buildSrtReferenceSentences(doc);
 const b=buildSrtReferenceSentences(doc,{useBilingual:false});
 const first=a.find(s=>s.cueIndex===0),off=b.find(s=>s.cueIndex===0);
 assert.match(first.referenceContext,/SAME-CUE BILINGUAL TRANSLATION/);
 assert.match(first.referenceContext,/我要去学校/);
 assert.equal(off.referenceContext,undefined);
 assert.ok(!a.some(s=>s.cueIndex===2&&s.referenceContext));
 assert.deepEqual(a.map(x=>[x.id,x.start,x.text]),b.map(x=>[x.id,x.start,x.text]));
 assert.equal(renderSrt(doc,new Map()),sample);
});

test('separately uploaded auxiliary subtitle remains functional when embedded-bilingual switch OFF',()=>{
 const external=new Map([[0,'00:00:01 The school'],[1,'00:00:04 A meeting']]);
 const one=buildSrtReferenceSentences(doc,{useBilingual:false,externalContexts:external});
 assert.match(one[0].referenceContext,/NEARBY EXTERNAL SUBTITLES/);
 assert.doesNotMatch(one[0].referenceContext,/我要去学校/);
 const two=buildSrtReferenceSentences(doc,{useBilingual:true,externalContexts:external});
 assert.match(two[0].referenceContext,/我要去学校/);
 assert.match(two[0].referenceContext,/The school/);
 assert.ok(two[0].referenceContext.indexOf('SAME-CUE')<two[0].referenceContext.indexOf('EXTERNAL'));
 assert.equal(mergeReferenceContexts('译文','X'.repeat(10000)).length,1400);
});

test('shared review-pool and manual request include same-cue translation as advisory sentence-only data',()=>{
 const sentence=buildSrtReferenceSentences(doc)[0],t=target(sentence.referenceContext);
 const payload=buildReviewPayload('',[t],{}).payload;
 assert.match(payload.sentences[0].reference_context,/我要去学校/);
 assert.equal(payload.targets[0].reference_context,undefined);
 assert.equal(payload.targets[0].surface,'학교');
 const wire=modelTargets([t],{reviewPosFilter:false});
 assert.match(wire[0].reference_context,/我要去学校/);
 assert.match(buildManualPrompt('',[t],'batch43',{}),/AUXILIARY SUBTITLES/);
 assert.match(buildReviewInstructions({referenceSubtitle:true}),/not etymological proof/);
 assert.doesNotMatch(buildManualPrompt('',[target()],'batch43',{}),/AUXILIARY SUBTITLES/);
 assert.ok(describeBatchBudget('',[t],{tier:'32k'}).inputTokens>
  describeBatchBudget('',[target()],{tier:'32k'}).inputTokens);
});

test('settings default on with saved preference and no additional API/words without auxiliary language',()=>{
 const page=readFileSync(new URL('../srt-page.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../srt.html',import.meta.url),'utf8');
 const core=readFileSync(new URL('../srt-core.js',import.meta.url),'utf8');
 assert.match(html,/id="useBilingualReference" type="checkbox" checked/);
 assert.match(page,/srtUseBilingualReference/);
 assert.match(page,/buildSrtReferenceSentences\(documentState/);
 assert.match(page,/useBilingual/);
 assert.match(core,/extractBilingualReference/);
 assert.equal(buildSrtReferenceSentences(parseSrt('1\n00:00:01,000 --> 00:00:02,000\n정부가 발표했다.\n'))[0].referenceContext,undefined);
});
