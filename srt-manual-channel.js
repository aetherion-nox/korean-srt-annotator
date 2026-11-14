import {runSentencePipeline} from './annotation-pipeline.js';
import {createManualReviewSession} from './manual-review.js';
import {engineStatus,analyzeLocal} from './local-engine.js';

// Human-paced review belongs to the visible workspace. The background is used
// only for short dictionary requests, so its suspension cannot expire a batch.
export function createSrtManualChannel(settings){
 const listeners=new Set(),disconnectListeners=new Set(),controller=new AbortController();
 let started=false,closed=false,operationId,session;
 const post=event=>{if(!closed)for(const listener of listeners)listener(event);};
 return {
  onMessage:{addListener:listener=>listeners.add(listener)},
  onDisconnect:{addListener:listener=>disconnectListeners.add(listener)},
  disconnect(){
   if(closed)return;closed=true;controller.abort();
   for(const listener of disconnectListeners)listener();
  },
  postMessage(message){
   if(closed)throw Error('手动审核已结束。');
   if(message.type==='KEEPALIVE'){post({type:'PONG',operationId});return;}
   if(message.type==='CANCEL'){if(message.operationId===operationId)controller.abort();return;}
   if(message.type==='MANUAL_REVIEW_RESPONSE'){session?.submit(message);return;}
   if(started||message.type!=='START')return;
   started=true;operationId=message.operationId;
   session=createManualReviewSession({operationId,post,signal:controller.signal});
   const allowNoDictionary=settings.enableModelReview&&((settings.experimentalHanja===true&&message.modes?.hanja===true)||(settings.experimentalLoanword===true&&message.modes?.loanword===true));
   runSentencePipeline({...message,nameProtection:settings.nameProtection,filterDictionaryPeople:settings.filterDictionaryPeople,experimentalHanjaAudit:settings.enableModelReview===true&&settings.experimentalHanja===true,experimentalLoanwordAudit:settings.enableModelReview===true&&settings.experimentalLoanword===true,reviewAllCandidates:settings.reviewAllCandidates,smartSegmentation:settings.smartSegmentation,reviewLocalConversions:settings.enableModelReview&&settings.reviewLocalConversions},post,{
    signal:controller.signal,
    enabled:settings.enableModelReview,
    status:(signal,progress)=>engineStatus(signal,progress,{allowNoDictionary}),
    analyze:(text,modes,signal,progress)=>analyzeLocal(text,{...modes,allowNoDictionary},signal,progress),
    modelConfig:async()=>({provider:'manual',model:'manual-chat',endpoint:'manual://chat',manualReview:true,request:session.request,batchContextTier:settings.batchContextTier,manualOutputTokenLimit:settings.manualOutputTokenLimit,apiOutputTokenLimit:settings.apiOutputTokenLimit,reviewPosFilter:settings.reviewPosFilter,experimentalHanja:settings.experimentalHanja,experimentalLoanword:settings.experimentalLoanword,hanjaReadingCheck:settings.hanjaReadingCheck,smartSegmentation:settings.smartSegmentation})
   }).catch(error=>{if(!controller.signal.aborted)post({type:'ERROR',operationId,error:error.message});});
  }
 };
}
