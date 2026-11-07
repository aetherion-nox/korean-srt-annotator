import test from 'node:test';import assert from 'node:assert/strict';
import {parseSrt,renderSrt,mergeSrtResults} from '../srt-core.js';
test('one cue keeps multiline Korean intact and maps second-line annotations exactly',()=>{
 const source='1\r\n00:00:01,000 --> 00:00:02,000\r\n나는 네가 어제\r\n학교에 갔는지 안다.\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\n다음 학교\r\n';
 const doc=parseSrt(source);assert.equal(doc.sentences.length,2);
 assert.equal(doc.sentences[0].text,'나는 네가 어제\r\n학교에 갔는지 안다');
 assert.ok(!doc.sentences[0].adjacentContext);
 const s=doc.sentences[0],start=s.text.indexOf('학교');
 assert.equal(renderSrt(doc,new Map([[s.id,[{start,end:start+2,surface:'학교',replacement:'學校',type:'hanja'}]]])),source.replace('학교에','學校(학교)에'));
});
test('bilingual and protected gaps never get joined into invented Korean context',()=>{
 const source='1\n00:00:01,000 --> 00:00:02,000\n학교\nEnglish subtitle\n한국\n漢字(한자)\n학교\n';
 const doc=parseSrt(source);assert.deepEqual(doc.sentences.map(s=>s.text),['학교','한국','학교']);assert.equal(renderSrt(doc,new Map()),source);
});
test('long SRT honors sentence then space before newline, preserves text and chunk results',()=>{
 const body='가'.repeat(11000)+'. '+'나'.repeat(2000)+'\n'+'다'.repeat(1000)+' '+'라'.repeat(9000);
 const source='1\n00:00:01,000 --> 00:00:02,000\n'+body+'\n';const doc=parseSrt(source);
 assert.equal(doc.sentences[0].text,'가'.repeat(11000)+'. ');
 assert.equal(doc.sentences.map(s=>s.text).join(''),body);
 assert.ok(doc.sentences.every(s=>s.text.length<=20000));
 assert.ok(doc.sentences[0].adjacentContext.after.length<=1000);
 assert.ok(doc.sentences[1].adjacentContext.before.length<=1000);
 const results=new Map();for(const s of doc.sentences){
  assert.equal(doc.source.slice(s.start,s.start+s.text.length),s.text);
  mergeSrtResults(results,{type:'RESULTS',source:'local',results:[{id:s.id,annotations:[{start:0,end:1,surface:s.text[0],replacement:'可',type:'hanja'}]}]});
 }
 const rendered=renderSrt(doc,results);assert.equal((rendered.match(/可\(/g)||[]).length,doc.sentences.length);
 assert.ok(rendered.startsWith('1\n00:00:01,000 --> 00:00:02,000\n'));
});
