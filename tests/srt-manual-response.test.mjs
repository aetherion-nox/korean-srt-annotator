import test from 'node:test';
import assert from 'node:assert/strict';
import {completeManualAnswer} from '../srt-manual-response.js';

test('SRT auto-submits only complete JSON; supports fenced pasted answers',()=>{
 assert.equal(completeManualAnswer(''),false);
 assert.equal(completeManualAnswer('{"batch_id":"x","results":['),false);
 assert.equal(completeManualAnswer('{"batch_id":"x","results":[]}'),true);
 assert.equal(completeManualAnswer('{"batch_id":"x","results":[{"t":"t0","c":null}]}'),true);
 assert.equal(completeManualAnswer('```json\\n{"batch_id":"x","results":[{"t":"t0","c":"c0"}]}\\n```'),true);
 assert.equal(completeManualAnswer('{"results":"invalid"}'),false);
 assert.equal(completeManualAnswer('[]'),false);
 assert.equal(completeManualAnswer('{"results":[{"t":"t0","c":null}]} garbage'),false);
 assert.equal(completeManualAnswer('z'.repeat(5*1024*1024+1)),false);
});
