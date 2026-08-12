import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = 8173;
const server = spawn('python3', ['-m','http.server',String(PORT),'--bind','127.0.0.1'], { stdio:'ignore' });
await new Promise(r=>setTimeout(r,700));
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:640,height:360} });
page.on('pageerror', e=>console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(()=>!!window.game,{timeout:20000});
await page.click('#btnStart');
await page.waitForFunction(()=>document.getElementById('floorCardLoad').textContent.includes('CLICK'),{timeout:20000});
await page.mouse.click(320,200);
await page.waitForTimeout(1500);
const info = await page.evaluate(()=>{
  const g=window.game;
  return { calls:g.renderer.info.render.calls, tris:g.renderer.info.render.triangles,
           geoms:g.renderer.info.memory.geometries, tex:g.renderer.info.memory.textures,
           progs:g.renderer.info.programs.length, rooms:g.level.rooms.length };
});
console.log('render info:', info);
// measure frame time
const fps = await page.evaluate(()=>new Promise(res=>{
  let n=0; const t0=performance.now();
  function tick(){ n++; if(n<60) requestAnimationFrame(tick); else res(1000/((performance.now()-t0)/n)); }
  requestAnimationFrame(tick);
}));
console.log('fps baseline:', fps.toFixed(1));
const measure = async (label, setup) => {
  await page.evaluate(setup);
  await page.waitForTimeout(300);
  const f = await page.evaluate(()=>new Promise(res=>{let n=0;const t0=performance.now();
    function tick(){n++; if(n<45) requestAnimationFrame(tick); else res(1000/((performance.now()-t0)/n));}
    requestAnimationFrame(tick);}));
  console.log(label, f.toFixed(1));
};
await measure('  no room lights:', ()=>{ for(const l of window.game.roomLights) l.visible=false; });
await measure('  no torch:', ()=>{ window.game.torch.visible=false; });
await measure('  no decor:', ()=>{ window.game.level.decorGroup.visible=false; });
await measure('  no walls:', ()=>{ window.game.level.wallMesh.visible=false; });
await measure('  world hidden:', ()=>{ window.game.level.group.visible=false; });
await browser.close(); server.kill();
