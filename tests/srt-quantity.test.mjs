import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSrt,renderSrt} from '../srt-core.js';
test('numeric context reaches analyzer without changing original SRT',()=>{
 const source='1\r\n00:00:00,000 --> 00:00:02,000\r\n수능 2주앞…\r\n2 주 남았다\r\nEnglish 123\r\n';
 const doc=parseSrt(source);
 assert.equal(doc.sentences[0].text,'수능 2주앞');
 assert.equal(doc.sentences[1].text,'2 주 남았다');
 assert.equal(doc.sentences.length,2);
 assert.equal(renderSrt(doc,new Map()),source);
 const s=doc.sentences[1];const start=s.text.indexOf('주');
 const output=renderSrt(doc,new Map([[s.id,[{surface:'주',replacement:'週',start,end:start+1,type:'hanja'}]]]));
 assert.equal(output,source.replace('2 주 남았다','2 週(주) 남았다'));
});
