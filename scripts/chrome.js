'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
class Chrome {
  constructor(){this.next=0;this.pending=new Map();this.events=[];this.session=null;}
  async start(){
    const binary=[process.env.CHROME_BIN,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&fs.existsSync(p));
    if(!binary)throw new Error('Chrome was not found. Set CHROME_BIN to its executable.');
    this.profile=fs.mkdtempSync(path.join(os.tmpdir(),'college-registration-chrome-'));
    this.process=spawn(binary,['--headless=new','--no-first-run','--no-default-browser-check',`--user-data-dir=${this.profile}`,'--remote-debugging-pipe','about:blank'],{stdio:['ignore','ignore','pipe','pipe','pipe']});
    this.stderr='';this.process.stderr.on('data',d=>this.stderr=(this.stderr+d).slice(-4000));
    this.process.on('error',error=>{for(const p of this.pending.values())p.reject(error);this.pending.clear();});
    this.process.on('exit',()=>{for(const p of this.pending.values())p.reject(new Error('Chrome closed: '+this.stderr));this.pending.clear();});
    let buffer='';
    this.process.stdio[4].on('data',chunk=>{
      buffer+=chunk.toString();let end;
      while((end=buffer.indexOf('\0'))>=0){const part=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!part)continue;
        const message=JSON.parse(part);const pending=this.pending.get(message.id);
        if(pending){clearTimeout(pending.timeout);this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);}
        else if(message.method)this.events.push(message);
      }
    });
    this.version=await this.send('Browser.getVersion',{},false);
    const target=await this.send('Target.createTarget',{url:'about:blank'},false);
    this.session=(await this.send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
    await this.send('Page.enable');await this.send('Runtime.enable');
    return this;
  }
  send(method,params={},session=true){
    return new Promise((resolve,reject)=>{
      const id=++this.next;
      const timeout=setTimeout(()=>{this.pending.delete(id);reject(new Error(`Chrome timed out: ${method}. ${this.stderr}`));},20000);
      this.pending.set(id,{resolve,reject,timeout});
      this.process.stdio[3].write(JSON.stringify({id,method,params,...(session&&this.session?{sessionId:this.session}:{})})+'\0');
    });
  }
  async evaluate(expression){
    const response=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(response.exceptionDetails)throw new Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);
    return response.result.value;
  }
  async wait(expression,timeout=15000){
    const end=Date.now()+timeout;let error;
    while(Date.now()<end){try{if(await this.evaluate(expression))return;}catch(e){error=e;}await new Promise(r=>setTimeout(r,80));}
    throw new Error(`Browser condition timed out: ${expression}${error?' / '+error.message:''}`);
  }
  async navigate(url){await this.send('Page.navigate',{url});await this.wait('document.readyState === "complete"');}
  async screenshot(file){const result=await this.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(file,Buffer.from(result.data,'base64'));}
  async close(){
    if(!this.process)return;
    const exited=new Promise(resolve=>this.process.once('exit',resolve));
    try{await this.send('Browser.close',{},false);}catch{}
    await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,1500))]);
    if(this.process.exitCode===null)this.process.kill();
    for(const p of this.pending.values()){clearTimeout(p.timeout);p.reject(new Error('Browser closed.'));}this.pending.clear();
    // Only this helper's newly created temporary browser profile is removed.
    if(this.profile){try{fs.rmSync(this.profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch{console.warn('Chrome left a temporary profile for system cleanup.');}}
  }
}
module.exports=Chrome;
