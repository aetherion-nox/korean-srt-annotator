// A complete JSON object can be validated immediately on input. The review
// session remains the authority on batch ownership, target IDs and choices.
export function completeManualAnswer(text){
 if(typeof text!=='string'||!text.trim()||text.length>5*1024*1024)return false;
 let source=text.trim();
 const fenced=/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(source);
 if(fenced)source=fenced[1].trim();
 try{
  const answer=JSON.parse(source);
  return !!answer&&typeof answer==='object'&&!Array.isArray(answer)&&Array.isArray(answer.results);
 }catch{return false;}
}
