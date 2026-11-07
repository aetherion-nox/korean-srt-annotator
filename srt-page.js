import {parseSrt,renderSrt,decodeSrt,mergeSrtResults,fingerprintSrt} from './srt-core.js';
import {engineConfig} from './local-engine.js';
import {createSrtManualChannel} from './srt-manual-channel.js';
const $=id=>document.getElementById(id);
let documentState=null,fileName='',results=new Map(),running=false,activePort=null,abortBatch=null,manualRequest=null,operationId='',hasRun=false,loading=false;
let stats={},currentStats={},previewTimer,loadGeneration=0,runGeneration=0;
let inputFingerprint='';
const fields={local_determined:'localCount',pending:'pendingCount',model_resolved:'modelCount',unresolved:'unresolvedCount'};
const report=message=>{$('status').textContent=message;};
const log=message=>{const lines=$('logs').textContent.split('\n').filter(Boolean);lines.push(`${new Date().toLocaleTimeString()} ${message}`);$('logs').textContent=lines.slice(-200).join('\n');};
function setBusy(value){running=value;for(const id of ['subtitleFile','encoding','filterUntimedLines','hanja','loanword'])$(id).disabled=value;$('start').disabled=value||!documentState||loading;$('cancel').disabled=!value;$('download').disabled=value||!documentState||!hasRun;}
function updateStats(){for(const [key,id] of Object.entries(fields))$(id).textContent=(stats[key]||0)+(currentStats[key]||0);}
function previewSource(text){const limit=Number($('previewLimit').value);if(!limit)return text;const parsed=parseSrt(text);if(parsed.cues.length<=limit)return text;const blocks=text.split(/(?:\r\n|\n|\r)[ \t]*(?:\r\n|\n|\r)/u);return blocks.slice(0,limit).join('\n\n')+'\n\n…（完整字幕见下载文件）';}
function refreshPreview(){clearTimeout(previewTimer);previewTimer=null;if(!documentState)return;$('original').textContent=previewSource(documentState.source);$('output').textContent=previewSource(renderSrt(documentState,results));}
function schedulePreview(){if(!previewTimer)previewTimer=setTimeout(()=>{try{refreshPreview();}catch(e){log(e.message);}},250);}
function saveFile(text,name,type='text/plain;charset=utf-8'){
 const url=URL.createObjectURL(new Blob([text],{type})),anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function loadFile(){
 if(running)return;
 const file=$('subtitleFile').files?.[0];if(!file)return;
 const generation=++loadGeneration,encoding=$('encoding').value,filterUntimedLines=$('filterUntimedLines').checked;
 loading=true;documentState=null;results=new Map();hasRun=false;stats={};currentStats={};updateStats();setBusy(false);$('fileInfo').textContent='正在读取字幕…';
 $('original').textContent='';$('output').textContent='';$('progress').value=0;$('manual').hidden=true;manualRequest=null;$('logs').textContent='';
 try{
  if(file.size>20*1024*1024)throw Error('SRT 文件超过 20 MiB，请先拆分字幕。');
  const bytes=await file.arrayBuffer();const digest=await fingerprintSrt(bytes);if(generation!==loadGeneration)return;
  inputFingerprint=digest;
  const decoded=decodeSrt(bytes,encoding);documentState=parseSrt(decoded.text,{filterUntimedLines});fileName=file.name;
  $('fileInfo').textContent=`${fileName} · ${documentState.cues.length} 条字幕 · ${documentState.sentences.length} 段韩语 · ${decoded.encoding} → UTF-8${filterUntimedLines?` · 已过滤 ${documentState.removedLineCount} 行无时间轴文字`:""}`;
  report(documentState.sentences.length?'已导入，可开始标注。':'未检测到需要分析的韩语；可直接导出原字幕。');refreshPreview();
 }catch(error){if(generation!==loadGeneration)return;$('fileInfo').textContent=error.message;report('导入失败，请检查 SRT 格式或编码。');}
 finally{if(generation===loadGeneration){loading=false;setBusy(false);}}
}
$('filterUntimedLines').addEventListener('change',()=>loadFile());
$('subtitleFile').addEventListener('change',()=>loadFile());$('encoding').addEventListener('change',()=>loadFile());
$('settings').addEventListener('click',()=>chrome.runtime.openOptionsPage());
$('previewLimit').addEventListener('change',()=>{try{refreshPreview();}catch(error){report(error.message);}});
$('start').addEventListener('click',async()=>{
 if(running||!documentState||loading)return;
 const generation=++runGeneration;
 const modes={hanja:$('hanja').checked,loanword:$('loanword').checked};
 if(!modes.hanja&&!modes.loanword){report('请至少启用一种标注。');return;}
 results=new Map();stats={};currentStats={};hasRun=true;manualRequest=null;$('manual').hidden=true;$('progress').value=0;setBusy(true);updateStats();refreshPreview();
 try{
  report('正在启动词典引擎…');
  const [{progressiveAnnotation=false},settings]=await Promise.all([chrome.storage.local.get('progressiveAnnotation'),engineConfig()]);
  const parsedFingerprint=await fingerprintSrt(documentState.source);
  log('运行依据 '+JSON.stringify({input_sha256:inputFingerprint,parsed_sha256:parsedFingerprint,extension_version:chrome.runtime.getManifest().version,modes,nameProtection:settings.nameProtection,reviewAllCandidates:settings.reviewAllCandidates,manualModelReview:settings.manualModelReview,batchContextTier:settings.batchContextTier,filterUntimedLines:$('filterUntimedLines').checked}));
  const sentences=documentState.sentences;
  if(generation!==runGeneration)return;
  // Bound the existing pipeline operation; review batching still follows its saved tier.
  for(let start=0;start<sentences.length;start+=1000){
   if(generation!==runGeneration)throw new DOMException('已停止','AbortError');
   await runBatch(sentences.slice(start,start+1000),modes,progressiveAnnotation,start,sentences.length,settings);
   for(const key of Object.keys(currentStats))stats[key]=(stats[key]||0)+(currentStats[key]||0);
   currentStats={};updateStats();
  }
  mergeSrtResults(results,{type:'ROLLBACK_PREVIEWS'});refreshPreview();$('progress').value=100;
  const count=[...results.values()].reduce((n,rows)=>n+rows.length,0);
  report(`完成：${documentState.cues.length} 条字幕，${count} 处标注。${stats.unresolved?'有未解决的词，已保留原文；详情见日志。':''}`);
 }catch(error){if(generation!==runGeneration)return;mergeSrtResults(results,{type:'ROLLBACK_PREVIEWS'});refreshPreview();report(error.name==='AbortError'?'已停止，可下载已经确认的部分结果。':`处理失败：${error.message}\n可下载已经确认的部分结果；详情见日志。`);log(error.message);}
 finally{if(generation===runGeneration){activePort=null;abortBatch=null;manualRequest=null;$('manual').hidden=true;setBusy(false);}}
});
function runBatch(sentences,modes,progressiveAnnotation,offset,total,settings){
 return new Promise((resolve,reject)=>{
  const port=settings.manualModelReview?createSrtManualChannel(settings):chrome.runtime.connect({name:'KRA_SENTENCE_STREAM_V1'});activePort=port;const batchOperationId=crypto.randomUUID();operationId=batchOperationId;let finished=false;
  const finish=error=>{if(finished)return;finished=true;clearInterval(keepalive);if(activePort===port)activePort=null;abortBatch=null;port.disconnect();error?reject(error):resolve();};
  const keepalive=settings.manualModelReview?null:setInterval(()=>{try{port.postMessage({type:'KEEPALIVE'});}catch(error){finish(error);}},15000);
  abortBatch=()=>{try{port.postMessage({type:'CANCEL',operationId});}catch{}finish(new DOMException('已停止','AbortError'));};
  port.onDisconnect.addListener(()=>{if(!finished)finish(Error('字幕处理连接中断，请重试。'));});
  port.onMessage.addListener(event=>{
   if(finished||event.operationId!==batchOperationId)return;
   try{
    if(event.type==='ERROR'){finish(Error(event.error||'标注失败'));return;}
    if(event.stats){currentStats=event.stats;updateStats();}
    if(event.type==='RESULTS'){
     mergeSrtResults(results,event);$('progress').value=(offset+(event.completedSentences||0))/total*100;
     report(`分析韩语 ${offset+(event.completedSentences||0)} / ${total} 段${event.source==='model'?' · 模型结果已返回':''}`);if(progressiveAnnotation)schedulePreview();
    }else if(event.type==='LOCAL_PROGRESS'){report(event.stage==='dictionary'?'加载词典…':event.stage==='tokenizer'?'初始化分词器…':`正在分析第 ${offset+event.currentSentence}/${total} 段（${event.sentenceCharacters} 字符）`);}
    else if(event.type==='MODEL_PROGRESS')report(event.modelTotal?`模型审核 ${event.modelCompleted||0} / ${event.modelTotal}`:'本批无需模型审核。');
    else if(event.type==='DIAGNOSTIC')log(`${event.diagnostic?.message||''}${event.diagnostic?.detail?' '+event.diagnostic.detail:''}`);
    else if(event.type==='MANUAL_REVIEW_REQUEST'){
     manualRequest=event;$('batchLabel').textContent=`第 ${event.batchNumber} / ${event.batchTotal||'?'} 批 · ${event.targetCount} 个词`;
     $('prompt').value=event.text;$('answer').value='';$('answerFile').value='';$('manualStatus').textContent='等待本批结果（无等待超时）；请保留本页面。';$('submitAnswer').disabled=false;$('manual').hidden=false;
     report('等待手动聊天审核（无等待超时）；保留本页面，导入结果后继续。');
    }else if(event.type==='MANUAL_REVIEW_ERROR'){$('manualStatus').textContent=event.error;$('submitAnswer').disabled=false;}
    else if(event.type==='MANUAL_REVIEW_ACCEPTED'){manualRequest=null;$('manual').hidden=true;report('本批校验通过，正在继续…');}
    else if(event.type==='DONE'){if(!progressiveAnnotation)refreshPreview();finish();}
   }catch(error){finish(error);}
  });
  port.postMessage({type:'START',operationId,sentences,modes,nameProtection:settings.nameProtection,progressiveAnnotation,deepAnalysis:true});
 });
}
$('cancel').addEventListener('click',()=>{if(!running)return;++runGeneration;abortBatch?.();activePort=null;abortBatch=null;manualRequest=null;$('manual').hidden=true;mergeSrtResults(results,{type:'ROLLBACK_PREVIEWS'});refreshPreview();setBusy(false);report('已停止，可下载已经确认的部分结果。');});
$('download').addEventListener('click',()=>{try{saveFile(renderSrt(documentState,results),fileName.replace(/\.srt$/iu,'')+'-annotated.srt','application/x-subrip;charset=utf-8');}catch(error){report(error.message);}});
$('copyPrompt').addEventListener('click',async()=>{try{const response=await chrome.runtime.sendMessage({type:'KRA_COPY_TEXT',text:$('prompt').value});if(!response?.ok)throw Error(response?.error||'复制失败，请下载 TXT。');$('manualStatus').textContent='提示词已复制。';}catch(error){$('manualStatus').textContent=error.message;}});
$('exportPrompt').addEventListener('click',()=>saveFile($('prompt').value,`Korean-SRT-manual-${manualRequest?.batchNumber||1}.txt`));
$('answerFile').addEventListener('change',async()=>{const file=$('answerFile').files?.[0];if(!file)return;try{if(file.size>5*1024*1024)throw Error('答案超过 5 MiB。');$('answer').value=await file.text();$('manualStatus').textContent='答案已导入，请校验并应用。';}catch(error){$('manualStatus').textContent=error.message;}finally{$('answerFile').value='';}});
$('submitAnswer').addEventListener('click',()=>{try{if(!manualRequest||!activePort)throw Error('当前没有等待审核的批次。');if(!$('answer').value.trim())throw Error('请先粘贴或导入本批 JSON 结果。');$('submitAnswer').disabled=true;activePort.postMessage({type:'MANUAL_REVIEW_RESPONSE',operationId,requestId:manualRequest.requestId,text:$('answer').value});}catch(error){$('submitAnswer').disabled=false;$('manualStatus').textContent=error.message;}});
window.addEventListener('beforeunload',event=>{if(running){event.preventDefault();event.returnValue='';}});
