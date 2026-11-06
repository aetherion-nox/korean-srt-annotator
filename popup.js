document.getElementById('openSrt').addEventListener('click',async()=>{
 try{await chrome.tabs.create({url:chrome.runtime.getURL('srt.html')});window.close();}catch(error){document.getElementById('status').textContent=error.message;}
});
document.getElementById('openSettings').addEventListener('click',()=>chrome.runtime.openOptionsPage());
