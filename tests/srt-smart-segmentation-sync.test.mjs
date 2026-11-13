import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSrt, renderSrt, mergeSrtResults} from '../srt-core.js';
import {buildReviewInstructions,buildReviewPayload} from '../review-payload.js';
import {validateChoices,validateExperimentalChoices} from '../choice-review.js';

test('SRT keeps time, English, markup and positions when repaired annotations replace preview', () => {
 const original='1\r\n00:00:01,000 --> 00:00:03,000\r\n<i>경제가 발전했다.</i>\r\nThe economy grew.\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,500\r\n컴퓨터를 사용했다.\r\n';
 const doc=parseSrt(original,{filterUntimedLines:false});
 assert.equal(doc.cues.length,2);
 const first=doc.sentences.find(s=>s.text.includes('경제가'));
 const second=doc.sentences.find(s=>s.text.includes('컴퓨터'));
 assert.ok(first&&second);
 const results=new Map();
 mergeSrtResults(results,{type:'RESULTS',source:'local',results:[{id:first.id,annotations:[{start:0,end:2,surface:'경제',type:'hanja',replacement:'經濟'}]}]});
 mergeSrtResults(results,{type:'RESULTS',source:'model',replaceModel:true,provisional:true,results:[{id:first.id,annotations:[{start:0,end:2,surface:'경제',type:'hanja',replacement:'經濟'}]}]});
 mergeSrtResults(results,{type:'RESULTS',source:'model',replaceModel:true,results:[{id:second.id,annotations:[{start:0,end:3,surface:'컴퓨터',type:'loanword',replacement:'computer'}]}]});
 const out=renderSrt(doc,results);
 assert.match(out,/00:00:01,000 --> 00:00:03,000/);
 assert.match(out,/<i>經濟\(경제\)가 발전했다\.<\/i>/);
 assert.match(out,/The economy grew\./);
 assert.match(out,/컴퓨터\(computer\)를/);
 assert.equal(out.split(' --> ').length,3);
 mergeSrtResults(results,{type:'ROLLBACK_PREVIEWS'});
 const rolled=renderSrt(doc,results);
 assert.equal(rolled,out);
});

test('experimental prompt is opt-in and shares dictionary pools', () => {
 const target={target_id:'t0',start:0,end:2,surface:'경제',context:'경제',options:[{choice_id:'KEEP',type:'keep',replacement:'경제',entry_id:null,definitions:[]},{choice_id:'c0',type:'hanja',replacement:'經濟',entry_id:12,definitions:['economy']}]};
 const basic=buildReviewInstructions({});
 assert.doesNotMatch(basic,/repairs|actively check whether the dictionary/i);
 assert.match(buildReviewInstructions({smartSegmentation:true}),/repairs/);
 const payload=buildReviewPayload('경제',[target],{});
 assert.equal(payload.payload.format,'shared-pools-v3');
 assert.equal(payload.payload.targets.length,1);
 assert.equal(validateChoices([target],{results:[{target_id:'t0',choice_id:'c0'}]}).accepted.length,1);
 assert.equal(validateChoices([target],{results:[{target_id:'t0',choice_id:'invalid'}]}).unresolved.length,1);
 assert.equal(validateExperimentalChoices([target],{results:[{target_id:'t0',choice_id:'KEEP'}]},{experimentalHanja:false}).accepted.length,1);
});
