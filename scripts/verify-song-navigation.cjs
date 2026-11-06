const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');
(async()=>{
const out=process.env.OUT||'/tmp/bess-nav-before';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const width=Number(process.env.WIDTH||1000);
const page=await browser.newPage({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
if(process.env.NO_GL)await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
const events=[];await page.exposeFunction('report',e=>events.push(e));
await page.addInitScript(()=>{
 let last='';const sample=()=>{
 const home=document.querySelector('.bess-home-hero'),song=document.querySelector('.bess-song-hero');
 const image=document.querySelector('.bess-song-hero-image')||document.querySelector('.bess-featured-image img');
 const title=document.querySelector('.bess-song-heading .bess-letter-word>span');
 const data={path:location.pathname,nav:home?.dataset.navigating,image:!!image,complete:image?.complete,title:title?getComputedStyle(title).opacity:null,rect:image?.getBoundingClientRect().toJSON()};
 const sig=JSON.stringify(data);if(sig!==last){window.report({time:performance.timeOrigin+performance.now(),...data});last=sig;}requestAnimationFrame(sample);};requestAnimationFrame(sample);
});
const base=process.env.BASE_URL||'http://127.0.0.1:4174';
await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForTimeout(2500);
if(process.env.WARM){await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(2000);}
if(process.env.SLIDE){await page.locator('.bess-thumbnails button').nth(Number(process.env.SLIDE)).focus();await page.waitForTimeout(1400);}
const cdp=await page.context().newCDPSession(page);let n=0;const frames=[];
if(process.env.SLOW){await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:100000});}
cdp.on('Page.screencastFrame',async e=>{const name=`frame-${String(n++).padStart(4,'0')}.jpg`;fs.writeFileSync(`${out}/${name}`,Buffer.from(e.data,'base64'));frames.push({name,time:e.metadata.timestamp*1000});await cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId});});
await cdp.send('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:750,maxHeight:675,everyNthFrame:1});
const href=await page.locator('.bess-featured-image').getAttribute('href');
const click=Date.now();await page.locator('.bess-featured-image').click();await page.waitForURL(url=>url.pathname===href,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);
await cdp.send('Page.stopScreencast');fs.writeFileSync(`${out}/trace.json`,JSON.stringify({click,events,frames},null,2));
const firstTitle=events.find(e=>e.path===href&&Number(e.title)>.05)?.time-click;
console.log({click,firstTitle,frames:n,href,width});
await page.goto('about:blank');await page.setViewportSize({width:1200,height:1000});
const blankFrames=await page.evaluate(async sources=>{
 const bad=[];for(const {name,src} of sources){const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=100;canvas.height=90;const c=canvas.getContext('2d');c.drawImage(image,0,0,100,90);const p=c.getImageData(0,0,100,90).data;let same=0,total=0;for(let y=20;y<70;y+=2)for(let x=20;x<80;x+=2){const i=(y*100+x)*4;total++;if(Math.abs(p[i]-9)<8&&Math.abs(p[i+1]-19)<8&&Math.abs(p[i+2]-34)<8)same++;}if(same/total>.95)bad.push(name);}return bad;
},frames.map(f=>({name:f.name,src:`data:image/jpeg;base64,${fs.readFileSync(`${out}/${f.name}`).toString('base64')}`})));
console.log({blankFrames});fs.writeFileSync(`${out}/result.json`,JSON.stringify({blankFrames,firstTitle,href,width},null,2));
const picks=Array.from({length:16},(_,i)=>frames.reduce((a,b)=>Math.abs(b.time-click-i*150)<Math.abs(a.time-click-i*150)?b:a));
await page.setContent(`<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(4,300px);color:white">${picks.map(f=>`<div><img style="width:300px;height:225px;object-fit:contain" src="data:image/jpeg;base64,${fs.readFileSync(`${out}/${f.name}`).toString('base64')}"/><br>${Math.round(f.time-click)}ms</div>`).join('')}</body>`);await page.screenshot({path:`${out}/sheet.png`});
await browser.close();
if(blankFrames.length)throw new Error('Photo disappears during navigation');
if(!Number.isFinite(firstTitle))throw new Error('Destination title never appeared');
if(!process.env.SLOW&&firstTitle>1100)throw new Error('Destination title starts too late');
})();
