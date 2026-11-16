import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSrt,renderSrt,mergeSrtResults} from '../srt-core.js';
import {extractInlineHanjaPairs,applyInlineHanjaAnnotations} from '../inline-hanja-evidence.js';
import {createSessionHanjaGlossary,learnSessionHanjaGlossary,applySessionHanjaGlossary} from '../session-hanja-glossary.js';

const srt=[
 '1','00:00:01,000 --> 00:00:02,000','학교에 갔다.','',
 '2','00:00:02,000 --> 00:00:03,000','<i>학교(學校:1992~)에서 공부했다.</i>','English translation.','',
 '3','00:00:03,000 --> 00:00:04,000','학교가 좋아요.',''
].join('\r\n');
const empty=()=>({annotations:[],targets:[],stats:{local_determined:0,pending:0}});
test('SRT sends author-supplied Hangul(Hanja:note) through analysis without changing its source, timecodes or bilingual lines',()=>{
 const doc=parseSrt(srt,{filterUntimedLines:false});
 assert.equal(doc.sentences.length>=3,true);
 const first=doc.sentences.find(s=>s.cueIndex===0&&s.text.includes('학교'));
 const quoted=doc.sentences.find(s=>s.cueIndex===1&&s.text.includes('學校'));
 const later=doc.sentences.find(s=>s.cueIndex===2&&s.text.includes('학교'));
 assert.ok(first&&quoted&&later);
 const pairs=extractInlineHanjaPairs(quoted.text);
 assert.equal(pairs.length,1);
 assert.equal(pairs[0].surface,'학교');
 assert.equal(pairs[0].hanja,'學校');
 const local=applyInlineHanjaAnnotations(quoted.text,empty());
 assert.equal(local.stats.converted,1);
 const results=new Map();
 mergeSrtResults(results,{type:'RESULTS',source:'local',
  results:[{id:quoted.id,annotations:local.analysis.annotations}]});
 assert.equal(renderSrt(doc,results),srt,'author parenthesis is evidence and not a second SRT insertion');
 assert.match(renderSrt(doc,results),/English translation\./);
 assert.match(renderSrt(doc,results),/00:00:03,000 --> 00:00:04,000/);
 const glossary=createSessionHanjaGlossary();
 assert.equal(learnSessionHanjaGlossary(quoted.text,local.analysis,glossary,{paragraphIndex:1,pairs}),1);
 const before=applySessionHanjaGlossary(first.text,empty(),glossary,{paragraphIndex:0});
 assert.equal(before.analysis.targets.length,0,'do not backfill before evidence');
 const after=applySessionHanjaGlossary(later.text,empty(),glossary,{paragraphIndex:2});
 assert.ok(after.analysis.targets.some(t=>t.surface==='학교'),'later occurrence can be reviewed from previous Hanja');
});
test('already annotated Latin source parentheses remain protected and never repeated',()=>{
 const text='1\n00:00:00,000 --> 00:00:03,000\n컴퓨터(computer)를 사용했다.\n';
 const doc=parseSrt(text,{filterUntimedLines:false});
 assert.ok(doc.sentences.every(s=>!s.text.includes('(computer)')));
 assert.equal(renderSrt(doc,new Map()),text);
});
