'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {execFileSync}=require('node:child_process');
const Chrome=require('./chrome');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function paragraphs(text,cls=''){return String(text).split('\n').map(line=>`<p class="${cls}">${esc(line)||'&nbsp;'}</p>`).join('');}
async function main(){
  execFileSync('python3',[path.join(root,'scripts/build-doc-sources.py')]);
  execFileSync('python3',[path.join(root,'scripts/build-report-content.py')]);
  const submission=read('docs/submission.json'),verification=read('docs/verification.json'),content=read('docs/report-content.json');
  const teamName=submission.teamName || 'Project team';
  const team=submission.teamId===null||submission.teamId===undefined?'':String(submission.teamId);
  if(team&&!/^[A-Za-z0-9_-]{1,20}$/.test(team))throw new Error('Use a simple team ID without slashes or spaces.');
  const demo=submission.demoUrl;
  if(demo&&!/^https?:\/\//.test(demo))throw new Error('The demo must be a viewable HTTP(S) URL.');
  if(demo){
    const readme=path.join(root,'README.md');
    fs.writeFileSync(readme,fs.readFileSync(readme,'utf8').replace(/^\*\*Demo video:\*\*.*$/m,'**Demo video:** '+demo));
  }
  const pending=[!team?'team ID':null,!demo?'viewable demo-video link':null].filter(Boolean);
  const banner=pending.length?`<aside class="draft">Submission information pending: ${esc(pending.join(' and '))}. The application test results below describe completed checks; this report must be renamed and linked after the team supplies these items.</aside>`:'';
  const video=()=>demo?`<p>Demo video: <a href="${esc(demo)}">${esc(demo)}</a></p>`:'<p class="pending">Demo video: pending recording/upload and a viewable URL (maximum seven minutes).</p>';
  const pages=content.pages.map((page,index)=>{
    let body='';
    if(index===0)body+=banner+`<p><strong>${esc(teamName)}</strong>${team?' · Team ID: '+esc(team):''}</p>`;
    if(page.diagram)body+=fs.readFileSync(path.join(root,'docs/er-diagram.svg'),'utf8')+'<p>Both named prerequisite roles point to courses. See the next page for every minimum/maximum and its foreign key.</p>';
    if(page.verification){
      body+=`<p>Verification status: <strong>${esc(verification.status)}</strong>. Observed ${esc(verification.date||'not yet recorded')}.</p>`;
      for(const key of ['operatingSystem','browser','database','node','framework'])body+=`<p><strong>${esc(key)}:</strong> ${esc(typeof verification[key]==='object'?JSON.stringify(verification[key]):verification[key]||'Pending')}</p>`;
      body+='<h2>Checks performed</h2><ul>'+(verification.results||[]).map(result=>`<li>${esc(typeof result==='string'?result:JSON.stringify(result))}</li>`).join('')+'</ul>';
      body+='<h2>Reproduction commands</h2><pre>'+esc((verification.commands||[]).join('\n'))+'</pre><h2>Limits and remaining submission items</h2><ul>'+(verification.limitations||[]).map(item=>`<li>${esc(item)}</li>`).join('')+'</ul>';
    }
    for(const block of page.blocks||[]){
      if(block.kind==='h')body+=`<h2>${esc(block.text)}</h2>`;
      else if(block.kind==='code')body+=`<pre>${esc(block.text)}</pre>`;
      else if(block.kind==='schema')body+=`<div class="schema">${paragraphs(block.text)}</div>`;
      else if(block.kind==='demo')body+=video();
      else body+=paragraphs(block.text,block.kind==='small'?'small':'');
    }
    return `<section class="page${page.diagram?' diagram-page':''}${page.verification?' verification-page':''}"><div class="eyebrow">College Course Registration · Enterprise Database Web Application</div><h1>${esc(page.title)}</h1>${page.subtitle?`<p class="subtitle">${esc(page.subtitle)}</p>`:''}${body}</section>`;
  }).join('');
  const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>College Course Registration report</title><style>
  @page{size:Letter;margin:.6in .65in} @page diagram{size:Letter landscape;margin:.4in}
  *{box-sizing:border-box}body{margin:0;color:#172e2b;font:10pt/1.42 Arial,sans-serif}.page{break-before:page}.page:first-child{break-before:auto}.diagram-page{page:diagram}
  .verification-page{font-size:9.3pt;line-height:1.35}
  h1{font-size:22pt;line-height:1.15;color:#174b3d;margin:12px 0 17px}h2{font-size:12pt;margin:16px 0 6px;break-after:avoid}p{margin:0 0 8px}a{color:#174b3d;overflow-wrap:anywhere}.eyebrow{font-size:7pt;text-transform:uppercase;letter-spacing:1px;color:#64756c;border-bottom:1px solid #ccd7d0;padding-bottom:7px}.subtitle{font-size:12pt}.schema{font:9pt/1.35 'Courier New',monospace;background:#f2f5f0;padding:7px 9px;margin:7px 0;break-inside:avoid}.schema p{margin:0}pre{font:8.2pt/1.36 'Courier New',monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f5f0;padding:10px;border-left:3px solid #8bb09a;break-inside:avoid}.small{font-size:8.5pt}.draft{background:#fff3d9;border:1px solid #d5ba7c;padding:10px;font-size:9pt;margin:10px 0 15px}.pending{color:#7d4e1b}li{margin:6px 0}.diagram-page svg{width:100%;height:auto;max-height:6.3in;display:block}.diagram-page h1{font-size:17pt;margin:10px 0}.diagram-page p{font-size:9pt}ul{padding-left:20px}
  </style><body>${pages}</body></html>`;
  const htmlPath=path.join(root,'docs/report.html');fs.writeFileSync(htmlPath,html);
  const file=path.join(root,team?`team${team}.pdf`:'report.pdf');
  const browser=await new Chrome().start();
  try{
    await browser.navigate(pathToFileURL(htmlPath).href);
    const pdf=await browser.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
    fs.writeFileSync(file,Buffer.from(pdf.data,'base64'));
    await browser.send('Emulation.setDeviceMetricsOverride',{width:1660,height:1030,deviceScaleFactor:1,mobile:false});
    await browser.navigate(pathToFileURL(path.join(root,'docs/er-diagram.svg')).href);
    await browser.screenshot(path.join(root,'docs/er-diagram.png'));
  }finally{await browser.close();}
  console.log('Generated '+file);
  if(pending.length)console.log('Pending submission metadata: '+pending.join(', '));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
