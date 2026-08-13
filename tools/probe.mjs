import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT=8177;
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,700));
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const page=await browser.newPage({viewport:{width:512,height:288}});
page.on('pageerror',e=>console.log('[pageerror]',e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(()=>!!window.game,{timeout:20000});
await page.click('#btnStart');
await page.waitForFunction(()=>document.getElementById('floorCardLoad').textContent.includes('CLICK'),{timeout:20000});
await page.mouse.click(256,150);
await page.waitForTimeout(600);
const out = await page.evaluate(async ()=>{
  const g=window.game; const THREE=await import('/vendor/three.module.js');
  const F=await import('/src/world/floors.js');
  g.prologue=false; g._buildFloor(2,F.floorConfig(2)); g._enterFloor(F.floorConfig(2));
  g.prologueActive=false; g._lightRamp=null; g.hud.hide();
  const room=g.level.rooms.reduce((a,b)=>a.w*a.h>b.w*b.h?a:b);
  const c=g.level.roomCenter(room);
  g.player.pos.set(c.x,0,c.z+8); g.player.yaw=0; g.player.pitch=0;
  for(let i=g.enemies.length-1;i>=0;i--){g.enemies[i].dispose();g.enemies.splice(i,1);}
  for(let i=0;i<20;i++){ g.now+=1/60; g.update(1/60); g.input.endFrame(); }
  g.render();
  const rt=g.post.sceneRT;
  const buf=new Uint16Array(4);
  const read=(x,y,target)=>{ g.renderer.readRenderTargetPixels(target,x,y,1,1,buf); return Array.from(buf); };
  // half-float decode
  const h2f=(h)=>{ const s=(h&0x8000)?-1:1, e=(h>>10)&0x1f, m=h&0x3ff;
    if(e===0) return s*Math.pow(2,-14)*(m/1024);
    if(e===31) return m?NaN:s*Infinity;
    return s*Math.pow(2,e-15)*(1+m/1024); };
  const cx=Math.floor(rt.width/2), cy=Math.floor(rt.height/2);
  const scene=read(cx,cy,rt).map(h2f);
  const b0=read(Math.floor(g.post.levels[0].a.width/2),Math.floor(g.post.levels[0].a.height/2),g.post.levels[0].a).map(h2f);
  const b2=read(Math.floor(g.post.levels[2].a.width/2),Math.floor(g.post.levels[2].a.height/2),g.post.levels[2].a).map(h2f);
  // final canvas pixel
  const cnv=document.createElement('canvas'); cnv.width=g.canvas.width; cnv.height=g.canvas.height;
  const ctx=cnv.getContext('2d'); ctx.drawImage(g.canvas,0,0);
  const px=ctx.getImageData(Math.floor(cnv.width/2), Math.floor(cnv.height/2),1,1).data;
  return { scene: scene.map(v=>+v.toFixed(4)), bloom0: b0.map(v=>+v.toFixed(4)), bloom2: b2.map(v=>+v.toFixed(4)), canvas: Array.from(px),
           uniforms: { exposure:g.post.compositeMat.uniforms.exposure.value, bloom:g.post.compositeMat.uniforms.bloomStrength.value,
                       tint:g.post.compositeMat.uniforms.tint.value.toArray().map(v=>+v.toFixed(3)),
                       hurt:g.post.compositeMat.uniforms.hurt.value, glitch:g.post.compositeMat.uniforms.glitch.value } };
});
console.log(JSON.stringify(out,null,1));
await browser.close(); server.kill();
