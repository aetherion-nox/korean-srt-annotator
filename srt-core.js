import {projectAnnotation} from './local-engine.js';

const HANGUL=/[가-힣ㄱ-ㅎㅏ-ㅣ]/u;
const KOREAN_RUN=/[가-힣ㄱ-ㅎㅏ-ㅣ0-9]+(?:[ \t.,!?…，。！？、:;'"“”‘’·\-–—~〜]*[가-힣ㄱ-ㅎㅏ-ㅣ0-9]+)*/gu;
// Origin brackets are already annotated. Other parentheses remain dialogue.
const PROTECTED=/<[^>]*>|\{\\[^}]*\}|&(?:#\d+|#x[\da-f]+|[a-z]+);|[\p{Script=Han}]+\([가-힣]+\)/giu;
const TIME=/^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})\s+-->\s+(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})(?:[ \t].*)?$/u;

export async function fingerprintSrt(value){
 const bytes=typeof value==='string'?new TextEncoder().encode(value):value;
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}

export function decodeSrt(input,encoding='auto'){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 const decode=label=>new TextDecoder(label,{fatal:true,ignoreBOM:true}).decode(bytes);
 if(encoding!=='auto')return {text:decode(encoding),encoding};
 if(bytes[0]===255&&bytes[1]===254)return {text:decode('utf-16le'),encoding:'utf-16le'};
 if(bytes[0]===254&&bytes[1]===255)return {text:decode('utf-16be'),encoding:'utf-16be'};
 try{return {text:decode('utf-8'),encoding:'utf-8'};}catch{
  try{return {text:decode('euc-kr'),encoding:'CP949 / EUC-KR'};}catch{throw Error('无法识别字幕编码，请选择正确编码后重新导入。');}
 }
}

function sourceLines(source){
 return [...source.matchAll(/([^\r\n]*)(\r\n|\n|\r|$)/gu)].filter(m=>m[0]).map(m=>({text:m[1],start:m.index,end:m.index+m[0].length}));
}
const cueStart=block=>block.findIndex((line,i)=>/^\d+$/.test(line.text.trim())&&TIME.test(block[i+1]?.text.trim()||''));
const malformedCue=block=>block.some(line=>/-->|^\d{2,}:\d{2}:\d{2}/u.test(line.text.trim()))||(block.length>1&&/^\d+$/.test(block[0].text.trim()));
function filterOutsideCues(source){
 const removed=[];let block=[];
 const consume=()=>{
  if(!block.length)return;
  const header=cueStart(block),outside=header<0?block:block.slice(0,header);
  // Malformed timestamps remain visible to the parser as errors.
  if(outside.length&&!malformedCue(outside))removed.push(...outside);
  block=[];
 };
 for(const line of sourceLines(source)){if(!line.text.trim())consume();else block.push(line);}
 consume();
 let cleaned='',at=0;
 for(const line of removed){const start=line.start===0&&source.startsWith('\ufeff')?1:line.start;cleaned+=source.slice(at,start);at=line.end;}
 cleaned+=source.slice(at);
 return {source:cleaned,removedLineCount:removed.length};
}

export function parseSrt(source,{filterUntimedLines=true}={}){
 if(typeof source!=='string'||!source.trim())throw Error('SRT 文件为空。');
 let removedLineCount=0;
 if(filterUntimedLines){const filtered=filterOutsideCues(source);source=filtered.source;removedLineCount=filtered.removedLineCount;}
 const lines=sourceLines(source);
 const cues=[],sentences=[];let block=[];
 const consume=()=>{
  if(!block.length)return;
  const header=cueStart(block);
  if(header<0){if(malformedCue(block))throw Error(`SRT 格式无效：第 ${cues.length+1} 条字幕需要序号和有效时间轴。`);block=[];return;}
  if(header>0&&malformedCue(block.slice(0,header)))throw Error('SRT 格式无效：时间轴或序号不完整。');
  block=block.slice(header);
  const index=block[0].text.trim(),time=TIME.exec(block[1]?.text.trim()||'');
  if(!/^\d+$/.test(index)||!time)throw Error(`SRT 格式无效：第 ${cues.length+1} 条字幕需要序号和有效时间轴。`);
  const ms=offset=>((Number(time[offset])*60+Number(time[offset+1]))*60+Number(time[offset+2]))*1000+Number(time[offset+3]);
  if(ms(5)<ms(1))throw Error(`第 ${index} 条字幕的结束时间早于开始时间。`);
  const cue={index,time:block[1].text,lineCount:Math.max(0,block.length-2)};cues.push(cue);
  for(const line of block.slice(2)){
   const add=(start,end)=>{
    const text=line.text.slice(start,end);
    for(const match of text.matchAll(KOREAN_RUN)){
     // Keep sentences below the existing engine's 20,000 UTF-16 unit limit.
     for(let at=0;at<match[0].length;at+=20000){
      const part=match[0].slice(at,at+20000);
      if(HANGUL.test(part))sentences.push({id:`srt-${sentences.length}`,text:part,start:line.start+start+match.index+at,cueIndex:cues.length-1});
     }
    }
   };
   const protectedRanges=[...line.text.matchAll(PROTECTED)].map(m=>({start:m.index,end:m.index+m[0].length}));
   for(const match of line.text.matchAll(/[가-힣]+\(/gu)){
    const open=match.index+match[0].length-1;let depth=1,end=open+1;
    for(;end<line.text.length&&depth;end++){if(line.text[end]==='(')depth++;if(line.text[end]===')')depth--;}
    const origin=line.text.slice(open+1,end-1);
    if(depth===0&&Array.from(origin).some(c=>/\p{L}/u.test(c)&&!HANGUL.test(c)))protectedRanges.push({start:match.index,end});
   }
   let at=0;
   for(const range of protectedRanges.sort((a,b)=>a.start-b.start)){if(range.start>at)add(at,range.start);at=Math.max(at,range.end);}
   add(at,line.text.length);
  }
  block=[];
 };
 for(const line of lines){if(!line.text.trim())consume();else block.push(line);}
 consume();
 if(!cues.length)throw Error('没有找到有效 SRT 字幕。');
 return {source,cues,sentences,removedLineCount};
}

function loanwordDisplay(value) {
    return value.replace(/[←→]/g, '');
  }

  export function renderSrt(document,results){
 const edits=[];
 for(const sentence of document.sentences){
  if(!Number.isInteger(sentence.start)||sentence.start<0||document.source.slice(sentence.start,sentence.start+sentence.text.length)!==sentence.text)throw Error('SRT 原文与分析位置不一致，已停止导出。');
  const annotations=results.get(sentence.id)||[],seen=new Set();
  for(const raw of annotations)for(const a of projectAnnotation(sentence.text,raw)){
   const signature=JSON.stringify([a.start,a.end,a.surface,a.replacement,a.type]);
   if(seen.has(signature))continue;seen.add(signature);
   if(!HANGUL.test(a.surface))throw Error('标注必须对应原韩语。');
   const display=a.type==='loanword'?loanwordDisplay(a.replacement):a.replacement;
   if(a.type==='loanword'&&!display)continue;
   const text=a.type==='loanword'?`${a.surface}(${display})`:`${display}(${a.surface})`;
   edits.push({start:sentence.start+a.start,end:sentence.start+a.end,text});
  }
 }
 edits.sort((a,b)=>a.start-b.start||a.end-b.end);
 for(let i=1;i<edits.length;i++)if(edits[i].start<edits[i-1].end)throw Error('标注范围重叠，已停止导出以保护原字幕。');
 const parts=[];let at=0;
 for(const edit of edits){parts.push(document.source.slice(at,edit.start),edit.text);at=edit.end;}
 parts.push(document.source.slice(at));return parts.join('');
}

// The visible array stays the Map value; private source layers allow a final
// model event to replace a streaming preview without retaining duplicate edits.
export function mergeSrtResults(state,event){
 if(event.type==='ROLLBACK_PREVIEWS'){
  for(const [id,value] of state){const layers=value.layers;if(layers){layers.model=layers.committedModel||[];const visible=[...layers.local.filter(a=>!layers.model.some(b=>b.start<a.end&&b.end>a.start)),...layers.model];Object.defineProperty(visible,'layers',{value:layers});state.set(id,visible);}}
  return;
 }
 if(event.type!=='RESULTS')return;
 for(const item of event.results||[]){
  const previous=state.get(item.id),layers=previous?.layers||{local:[],model:[]};
  const source=event.source==='model'?'model':'local';
  layers[source]=item.annotations||[];
  if(source==='model'&&event.provisional!==true)layers.committedModel=layers.model;
  const visible=[...layers.local.filter(a=>!layers.model.some(b=>b.start<a.end&&b.end>a.start)),...layers.model];
  Object.defineProperty(visible,'layers',{value:layers});state.set(item.id,visible);
 }
}
