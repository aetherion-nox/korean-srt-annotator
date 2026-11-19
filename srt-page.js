import {parseSrt,renderSrt,decodeSrt,mergeSrtResults,fingerprintSrt} from './srt-core.js';
import {engineConfig} from './local-engine.js';
import {createSrtManualChannel} from './srt-manual-channel.js';
import {completeManualAnswer} from './srt-manual-response.js';
import {parseAuxiliarySrt,buildAuxiliaryContexts} from './srt-reference-context.js';
import {buildSrtReferenceSentences,countBilingualCues} from './srt-bilingual-context.js';
const $=id=>document.getElementById(id);
let documentState=null,fileName='',results=new Map(),running=false,activePort=null,abortBatch=null,manualRequest=null,operationId='',hasRun=false,loading=false;
let referenceState=null,referenceLoading=false,referenceGeneration=0;
let stats={},currentStats={},previewTimer,loadGeneration=0,runGeneration=0;
let inputFingerprint='',lastSubmittedAnswer=null;
const BILINGUAL_PREF='srtUseBilingualReference';
chrome.storage.local.get({[BILINGUAL_PREF]:true}).then(prefs=>{
 if(!running)$('useBilingualReference').checked=prefs[BILINGUAL_PREF]!==false;
}).catch(error=>log('双语辅助开关设置读取失败：'+error.message));
const fields={local_determined:'localCount',pending:'pendingCount',model_resolved:'modelCount',unresolved:'unresolvedCount'};
const report=message=>{$('status').textContent=message;};
const log=message=>{const lines=$('logs').textContent.split('\n').filter(Boolean);lines.push(`${new Date().toLocaleTimeString()} ${message}`);$('logs').textContent=lines.slice(-200).join('\n');};
function setBusy(value){running=value;for(const id of ['subtitleFile','encoding','filterUntimedLines','hanja','loanword','referenceFile','referenceEncoding','referenceOffsetSeconds','clearReference','useBilingualReference'])$(id).disabled=value||referenceLoading&&id.startsWith('reference');$('start').disabled=value||!documentState||loading||referenceLoading;$('cancel').disabled=!value;$('download').disabled=value||!documentState||!hasRun;}
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
  $('fileInfo').textContent=`${fileName} · ${documentState.cues.length} 条字幕 · ${documentState.sentences.length} 段韩语 · ${decoded.encoding} → UTF-8${countBilingualCues(documentState)?` · 检测到 ${countBilingualCues(documentState)} 条带其他语言的双语字幕`:""}${filterUntimedLines?` · 已过滤 ${documentState.removedLineCount} 行无时间轴文字`:""}`;
  report(documentState.sentences.length?'已导入，可开始标注。':'未检测到需要分析的韩语；可直接导出原字幕。');refreshPreview();
 }catch(error){if(generation!==loadGeneration)return;$('fileInfo').textContent=error.message;report('导入失败，请检查 SRT 格式或编码。');}
 finally{if(generation===loadGeneration){loading=false;setBusy(false);}}
}
function resetForReferenceChange(){
 if(!hasRun)return;
 hasRun=false;results=new Map();stats={};currentStats={};updateStats();$('progress').value=0;
 try{refreshPreview();}catch(error){log(error.message);}
 report('辅助上下文设置已改变。请重新开始标注，原韩语字幕保持不变。');
}
async function loadReferenceFile(){
 if(running)return;
 const file=$('referenceFile').files?.[0],generation=++referenceGeneration;
 referenceState=null;resetForReferenceChange();
 if(!file){$('referenceInfo').textContent='未使用辅助字幕（可选，不影响正常韩语标注）。';setBusy(false);return;}
 referenceLoading=true;$('referenceInfo').textContent='正在读取辅助字幕…';setBusy(false);
 try{
  if(file.size>20*1024*1024)throw Error('辅助字幕超过 20 MiB，请先拆分文件。');
  const bytes=await file.arrayBuffer();if(generation!==referenceGeneration)return;
  const encoding=$('referenceEncoding').value;
  const decoded=decodeSrt(bytes,encoding);
  const cues=parseAuxiliarySrt(decoded.text);
  if(generation!==referenceGeneration)return;
  referenceState={name:file.name,cues,encoding:decoded.encoding};
  $('referenceInfo').textContent=`${file.name} · ${cues.length} 条 · ${decoded.encoding} · 仅作模型语义参考，不会修改、翻译或导出辅助字幕。`;
 }catch(error){
  if(generation!==referenceGeneration)return;
  referenceState=null;$('referenceInfo').textContent='辅助字幕导入失败：'+error.message+'。韩语字幕仍可单独标注。';
 }finally{if(generation===referenceGeneration){referenceLoading=false;setBusy(false);}}
}
$('referenceFile').addEventListener('change',loadReferenceFile);
$('referenceEncoding').addEventListener('change',loadReferenceFile);
$('referenceOffsetSeconds').addEventListener('change',()=>{if(!running){resetForReferenceChange();if(referenceState)$('referenceInfo').textContent=`${referenceState.name} · ${referenceState.cues.length} 条 · 偏移 ${$('referenceOffsetSeconds').value} 秒，将在下次标注时应用。`;setBusy(false);}});
$('clearReference').addEventListener('click',()=>{if(running)return;++referenceGeneration;referenceLoading=false;$('referenceFile').value='';referenceState=null;resetForReferenceChange();$('referenceInfo').textContent='未使用辅助字幕（可选，不影响正常韩语标注）。';setBusy(false);});
$('useBilingualReference').addEventListener('change',()=>{
 if(running)return;
 const enabled=$('useBilingualReference').checked;
 chrome.storage.local.set({[BILINGUAL_PREF]:enabled}).catch(error=>log('保存双语辅助开关失败：'+error.message));
 resetForReferenceChange();setBusy(false);
});
$('filterUntimedLines').addEventListener('change',()=>loadFile());
$('subtitleFile').addEventListener('change',()=>loadFile());$('encoding').addEventListener('change',()=>loadFile());
$('settings').addEventListener('click',()=>chrome.runtime.openOptionsPage());
$('previewLimit').addEventListener('change',()=>{try{refreshPreview();}catch(error){report(error.message);}});
$('start').addEventListener('click',async()=>{
 if(running||!documentState||loading||referenceLoading)return;
 const generation=++runGeneration;
 const modes={hanja:$('hanja').checked,loanword:$('loanword').checked};
 if(!modes.hanja&&!modes.loanword){report('请至少启用一种标注。');return;}
 results=new Map();stats={};currentStats={};hasRun=true;manualRequest=null;$('manual').hidden=true;$('progress').value=0;setBusy(true);updateStats();refreshPreview();
 try{
  report('正在准备标注…');
  const [{progressiveAnnotation=false},settings]=await Promise.all([chrome.storage.local.get('progressiveAnnotation'),engineConfig()]);
  const parsedFingerprint=await fingerprintSrt(documentState.source);
  log('运行依据 '+JSON.stringify({input_sha256:inputFingerprint,parsed_sha256:parsedFingerprint,extension_version:chrome.runtime.getManifest().version,modes,nameProtection:settings.nameProtection,reviewAllCandidates:settings.reviewAllCandidates,manualModelReview:settings.manualModelReview,batchContextTier:settings.batchContextTier,smartSegmentation:settings.smartSegmentation,retryInvalidDictionaryChoices:settings.retryInvalidDictionaryChoices,discardInvalidReviewResults:settings.discardInvalidReviewResults,experimentalHanja:settings.experimentalHanja,experimentalLoanword:settings.experimentalLoanword,filterDictionaryPeople:settings.filterDictionaryPeople,hanjaReadingCheck:settings.hanjaReadingCheck,filterUntimedLines:$('filterUntimedLines').checked,useBilingualReference:$('useBilingualReference').checked,bilingualCuesDetected:countBilingualCues(documentState)}));
  // Auxiliary captions are advisory review context; annotation offsets and
  // replacement positions always come from the untouched Korean document.
  const referenceContexts=referenceState?
   buildAuxiliaryContexts(documentState,referenceState.cues,$('referenceOffsetSeconds').value):{contexts:new Map(),matched:0,total:documentState.cues.length};
  if(referenceState){
   log(`辅助字幕：${referenceState.name}，时间近邻匹配 ${referenceContexts.matched}/${referenceContexts.total} 条韩语字幕；偏移 ${$('referenceOffsetSeconds').value} 秒（正数将辅助字幕后移）。`);
   if(!referenceContexts.matched)log('提示：没有匹配到附近辅助台词，可调整偏移值，或移除辅助字幕后重新标注。');
  }
  const useBilingual=$('useBilingualReference').checked;
  const sentences=buildSrtReferenceSentences(documentState,{
   useBilingual,externalContexts:referenceContexts.contexts
  });
  if(useBilingual&&countBilingualCues(documentState))
   log(`双语字幕参考已启用：识别到 ${countBilingualCues(documentState)} 条同时间轴翻译，仅用于模型语义消歧。`);
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
    }else if(event.type==='LOCAL_PROGRESS'){report(event.stage==='dictionary'?'加载词典…':event.stage==='tokenizer'?'初始化分词器…':event.stage?.startsWith('analysis')?`正在分析第 ${Math.min(total,offset+(event.currentSentence||0))}/${total} 段（${event.sentenceCharacters||event.paragraphCharacters||0} 字符）`:'正在准备标注…');}
    else if(event.type==='MODEL_PROGRESS')report(event.modelTotal?`模型审核 ${event.modelCompleted||0} / ${event.modelTotal}`:'本批无需模型审核。');
    else if(event.type==='DIAGNOSTIC')log(`${event.diagnostic?.message||''}${event.diagnostic?.detail?' '+event.diagnostic.detail:''}`);
    else if(event.type==='MANUAL_REVIEW_REQUEST'){
     manualRequest=event;lastSubmittedAnswer=null;$('batchLabel').textContent=`第 ${event.batchNumber} / ${event.batchTotal||'?'} 批 · ${event.targetCount} 个词`;
     $('prompt').value=event.text;$('answer').value='';$('answerFile').value='';$('manualStatus').textContent='等待本批结果（无等待超时）；请保留本页面。';$('submitAnswer').disabled=false;$('manual').hidden=false;
     report('等待手动聊天审核（无等待超时）；保留本页面，导入结果后继续。');
    }else if(event.type==='MANUAL_REVIEW_ERROR'){
     $('manualStatus').textContent=event.error;
     // Keep already validated answers server-side; show only missing/invalid IDs.
     if(typeof event.repairPrompt==='string'&&event.repairPrompt){
      $('prompt').value=event.repairPrompt;
      lastSubmittedAnswer=null;
      $('answer').value='';$('answerFile').value='';
      log('手动审核已保留 '+(event.acceptedCount||0)+' 条已验证结果；补交 '+(event.invalidTargetIds?.length||0)+' 条。');
     }
     $('submitAnswer').disabled=false;
    }
    else if(event.type==='MANUAL_REVIEW_ACCEPTED'){manualRequest=null;$('manual').hidden=true;report('本批校验通过，正在继续…');}
    else if(event.type==='DONE'){if(!progressiveAnnotation)refreshPreview();finish();}
   }catch(error){finish(error);}
  });
  port.postMessage({type:'START',operationId,sentences,modes,nameProtection:settings.nameProtection,smartSegmentation:settings.smartSegmentation,progressiveAnnotation,deepAnalysis:true});
 });
}
$('cancel').addEventListener('click',()=>{if(!running)return;++runGeneration;abortBatch?.();activePort=null;abortBatch=null;manualRequest=null;$('manual').hidden=true;mergeSrtResults(results,{type:'ROLLBACK_PREVIEWS'});refreshPreview();setBusy(false);report('已停止，可下载已经确认的部分结果。');});
$('download').addEventListener('click',()=>{try{saveFile(renderSrt(documentState,results),fileName.replace(/\.srt$/iu,'')+'-annotated.srt','application/x-subrip;charset=utf-8');}catch(error){report(error.message);}});
function scrollToManualAnswer(){
 if(manualRequest&&!$('manual').hidden)$('answer').scrollIntoView({behavior:'smooth',block:'center'});
}
function submitManualAnswer(automatic=false){
 try{
  if(!manualRequest||!activePort){if(automatic)return;throw Error('当前没有等待审核的批次。');}
  const text=$('answer').value;
  if(!text.trim()){if(automatic)return;throw Error('请先粘贴或导入本批 JSON 结果。');}
  if(automatic&&!completeManualAnswer(text))return;
  const key=manualRequest.requestId+'\\u0000'+text;
  if($('submitAnswer').disabled||(automatic&&key===lastSubmittedAnswer))return;
  lastSubmittedAnswer=key;
  $('submitAnswer').disabled=true;
  $('manualStatus').textContent='正在校验本批 JSON…';
  activePort.postMessage({type:'MANUAL_REVIEW_RESPONSE',operationId,requestId:manualRequest.requestId,text});
 }catch(error){$('submitAnswer').disabled=false;$('manualStatus').textContent=error.message;}
}
$('answer').addEventListener('input',()=>submitManualAnswer(true));
$('submitAnswer').addEventListener('click',()=>submitManualAnswer(false));
$('copyPrompt').addEventListener('click',async()=>{
 try{
  const response=await chrome.runtime.sendMessage({type:'KRA_COPY_TEXT',text:$('prompt').value});
  if(!response?.ok)throw Error(response?.error||'复制失败，请下载 TXT。');
  $('manualStatus').textContent='提示词已复制。';
 }catch(error){$('manualStatus').textContent=error.message;}
 finally{scrollToManualAnswer();}
});
$('exportPrompt').addEventListener('click',()=>{
 try{saveFile($('prompt').value,`Korean-SRT-manual-${manualRequest?.batchNumber||1}.txt`);}
 catch(error){$('manualStatus').textContent=error.message;}
 scrollToManualAnswer();
});
$('answerFile').addEventListener('change',async()=>{
 const file=$('answerFile').files?.[0];if(!file)return;
 try{
  if(file.size>5*1024*1024)throw Error('答案超过 5 MiB。');
  $('answer').value=await file.text();
  $('manualStatus').textContent='答案已导入，正在检测 JSON…';
  submitManualAnswer(true);
 }catch(error){$('manualStatus').textContent=error.message;}
 finally{$('answerFile').value='';}
});
window.addEventListener('beforeunload',event=>{if(running){event.preventDefault();event.returnValue='';}});
