// Recognize explicitly separated bilingual dialogue inside the KOREAN SRT.
// Other-language text is advisory evidence for LLM review, never a new target.
const HANGUL=/[가-힣ㄱ-ㅎㅏ-ㅣ]/u;
const OTHER_SCRIPT=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hebrew}\p{Script=Greek}]/u;
const LATIN=/\p{Script=Latin}/gu;
const clean=value=>String(value).replace(/<[^>]*>|\{\\[^}]*\}/gu,'')
 .replace(/&(?:amp|lt|gt|quot|apos);/gu,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[s]||s)
 .replace(/\s+/gu,' ').trim();

export function extractBilingualReference(lines){
 if(!Array.isArray(lines)||!lines.length)return '';
 let korean=false;
 const reference=[];
 for(const raw of lines){
  // Same-cue subtitles can appear as distinct lines, <br>, \N, or explicit pipes/slashes.
  const text=String(raw).replace(/<br\s*\/?>/giu,'\n').replace(/\\N/gu,'\n');
  for(const part of text.split(/\n|\s+[|｜/]\s+/u)){
   const line=clean(part);
   if(!line)continue;
   if(HANGUL.test(line)){korean=true;continue;}
   if(OTHER_SCRIPT.test(line)||[...line.matchAll(LATIN)].length>=2){
    if(!reference.includes(line))reference.push(line);
   }
  }
 }
 if(!korean||!reference.length)return '';
 return reference.join(' / ').slice(0,520);
}

export const countBilingualCues=document=>(document?.cues||[]).filter(cue=>!!cue.bilingualReference).length;

// Keep the same-cue translation before the loosely time-matched separate file;
// both remain lower-confidence than the actual Korean sentence.
export function mergeReferenceContexts(inline='',separate=''){
 const parts=[];
 if(inline)parts.push('SAME-CUE BILINGUAL TRANSLATION (approximate meaning only): '+inline.slice(0,520));
 if(separate)parts.push('NEARBY EXTERNAL SUBTITLES (approximate timing):\n'+separate);
 return parts.join('\n').slice(0,1400);
}
export function buildSrtReferenceSentences(document,{useBilingual=true,externalContexts=new Map()}={}){
 if(!document||!Array.isArray(document.sentences)||!Array.isArray(document.cues))
  throw Error('韩语字幕尚未导入。');
 if(!(externalContexts instanceof Map))throw Error('辅助字幕上下文格式无效。');
 return document.sentences.map(sentence=>{
  const own=useBilingual?document.cues[sentence.cueIndex]?.bilingualReference||'':'';
  const other=externalContexts.get(sentence.cueIndex)||'';
  const referenceContext=mergeReferenceContexts(own,other);
  return referenceContext?{...sentence,referenceContext}:sentence;
 });
}
