// Optional other-language subtitles are context, never Korean annotation input.
// Nearest-time matching tolerates small subtitle timing drift and user offsets.
// Cue time positions remain the Korean SRT's sole source of truth.
const TIME=/^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})\s+-->\s+(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})(?:[ \t].*)?$/u;
const CONTEXT_WINDOW_MS=45000, MAX_REFERENCE_CUES=12, MAX_REFERENCE_CHARS=1400;
export const parseSrtTimecode=(value)=>{
 const match=TIME.exec(String(value||'').trim());
 if(!match)return null;
 const ms=index=>((Number(match[index])*60+Number(match[index+1]))*60+Number(match[index+2]))*1000+Number(match[index+3]);
 const startMs=ms(1),endMs=ms(5);
 return endMs<startMs?null:{startMs,endMs};
};
const visibleText=value=>String(value).replace(/<[^>]*>|\{\\[^}]*\}/gu,'').replace(/&(?:amp|lt|gt|quot|apos);/gu,entity=>({ '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[entity]||entity).trim();
export function parseAuxiliarySrt(source){
 if(typeof source!=='string'||!source.trim())throw Error('辅助字幕为空。');
 const blocks=source.replace(/^\ufeff/,'').replace(/\r\n?/gu,'\n').split(/\n[ \t]*\n+/u);
 const cues=[];
 for(const block of blocks){
  const lines=block.split('\n');
  const i=lines.findIndex(line=>parseSrtTimecode(line)!==null);
  if(i<0)continue;
  const time=parseSrtTimecode(lines[i]);
  const text=lines.slice(i+1).map(visibleText).filter(Boolean).join(' / ');
  if(!text)continue;
  cues.push({...time,text:text.slice(0,800)});
  if(cues.length>100000)throw Error('辅助字幕超过 100,000 条，请拆分文件。');
 }
 if(!cues.length)throw Error('辅助字幕中没有找到有效的 SRT 时间轴及文字。');
 cues.sort((a,b)=>a.startMs-b.startMs||a.endMs-b.endMs);
 return cues;
}
const clock=ms=>{
 const sec=Math.max(0,Math.floor(ms/1000));
 return [Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(x=>String(x).padStart(2,'0')).join(':');
};
const lowerBound=(array,ms)=>{
 let lo=0,hi=array.length;
 while(lo<hi){const mid=(lo+hi)>>1;if(array[mid].startMs<ms)lo=mid+1;else hi=mid;}
 return lo;
};
// Sign convention: effective reference cue time = reference cue time + offset.
// Positive offset moves the reference subtitles later relative to Korean SRT.
export function buildAuxiliaryContexts(document,referenceCues,offsetSeconds=0){
 if(!document||!Array.isArray(document.cues)||!Array.isArray(document.sentences))throw Error('韩语字幕尚未导入。');
 if(!Array.isArray(referenceCues)||!referenceCues.length)return {contexts:new Map(),matched:0,total:document.cues.length};
 const seconds=Number(offsetSeconds);
 if(!Number.isFinite(seconds)||Math.abs(seconds)>3600)throw Error('辅助字幕偏移必须在 -3600～3600 秒之间。');
 const offset=Math.round(seconds*1000),contexts=new Map();
 let matched=0;
 for(let i=0;i<document.cues.length;i++){
  const time=parseSrtTimecode(document.cues[i].time);
  if(!time)continue;
  const midpoint=(time.startMs+time.endMs)/2-offset;
  const start=lowerBound(referenceCues,midpoint-CONTEXT_WINDOW_MS-10000);
  const nearby=[];
  for(let n=start;n<referenceCues.length;n++){
   const cue=referenceCues[n];
   if(cue.startMs>midpoint+CONTEXT_WINDOW_MS)break;
   // Accept neighboring dialogue, not an exact or line-for-line translation.
   if(cue.endMs<midpoint-CONTEXT_WINDOW_MS)continue;
   nearby.push(cue);
  }
  if(!nearby.length)continue;
  const chosen=nearby.sort((a,b)=>Math.abs((a.startMs+a.endMs)/2-midpoint)-Math.abs((b.startMs+b.endMs)/2-midpoint))
   .slice(0,MAX_REFERENCE_CUES).sort((a,b)=>a.startMs-b.startMs);
  const fragments=[];
  let characters=0;
  for(const cue of chosen){
   const part=clock(cue.startMs+offset)+' '+cue.text.slice(0,220);
   if(characters+part.length>MAX_REFERENCE_CHARS)break;
   fragments.push(part);characters+=part.length+1;
  }
  if(!fragments.length)continue;
  contexts.set(i,fragments.join('\n'));matched++;
 }
 return {contexts,matched,total:document.cues.length};
}
