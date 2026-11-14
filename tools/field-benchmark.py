"""One-minute Chromium software-GL benchmark; CPU throttling defaults to 4x.
Not a real weak-device/GPU measurement. Requires npm run dev and Playwright.
"""
import json
import argparse
import time
from playwright.sync_api import sync_playwright

def walk(page,x,y):
    for axis,target,pos,neg in [('x',x,'d','a'),('y',y,'s','w')]:
        current=page.evaluate('(axis)=>window.rs.snaps.curr.astronauts[0][axis]',axis)
        if abs(current-target)<5:continue
        direction=1 if target>current else -1
        key=pos if direction>0 else neg
        page.keyboard.down(key)
        page.wait_for_function('(v)=>{const a=window.rs.snaps.curr.astronauts[0];return Math.abs(a[v.axis]-v.target)<5 || (a[v.axis]-v.target)*v.direction>=0}',arg={'axis':axis,'target':target,'direction':direction},timeout=30000)
        page.keyboard.up(key);page.wait_for_timeout(100)
args=argparse.ArgumentParser();args.add_argument('--cpu',type=float,default=4);args=args.parse_args()
if args.cpu<1:raise ValueError('--cpu must be at least 1')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=b.new_page(viewport={'width':1280,'height':900});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    try:
        page.goto('http://localhost:5173/?debug=1');page.get_by_role('button',name='Play solo (offline)',exact=True).click();page.get_by_role('button',name='Solo (both)',exact=True).click();page.get_by_role('button',name='Quick start',exact=True).click()
        page.wait_for_function('window.rsGame && window.rs.snaps.curr && window.rs.snaps.curr.t>=0')
        session=page.context.new_cdp_session(page);session.send('Emulation.setCPUThrottlingRate',{'rate':args.cpu})
        page.evaluate('''async()=>{const {frameStats}=await import('/src/state/frameStats.ts');window.fieldMeasure={ms:[],intervals:[],particles:0,objects:0,terrainMs:frameStats.terrainMs};let prev=performance.now();const sample=(now)=>{const m=window.fieldMeasure;m.ms.push(frameStats.scriptMs??0);m.intervals.push(now-prev);prev=now;m.particles=Math.max(m.particles,frameStats.particles);m.objects=Math.max(m.objects,frameStats.objects);window.fieldMeasureRaf=requestAnimationFrame(sample)};requestAnimationFrame(sample)}''')
        start=time.monotonic()
        page.keyboard.down('d');page.wait_for_timeout(900);page.keyboard.up('d')
        site=page.evaluate('window.rs.snaps.curr.sites.reduce((best,s)=>Math.hypot(s.x-768,s.y-768)<Math.hypot(best.x-768,best.y-768)?s:best)')
        walk(page,site['x'],site['y'])
        page.keyboard.down('Space');page.wait_for_timeout(4600);page.screenshot(path='/tmp/rs-b6-dig.png');page.keyboard.up('Space')
        assert page.evaluate('window.rs.snaps.curr.astronauts[0].carrying.length')>=1
        assert page.evaluate('window.rsGame.scene.getScene("field").juice.trackCount')>0
        page.evaluate("async()=>{const {prefs}=await import('/src/state/prefs.ts');prefs.setState({reduceMotion:true})}")
        page.keyboard.down('d');page.wait_for_timeout(900);page.keyboard.up('d');page.wait_for_timeout(700)
        assert page.evaluate('window.rsGame.registry.get("juiceParticles")')==0
        walk(page,768,768);page.keyboard.press('e')
        page.wait_for_timeout(max(0,60000-(time.monotonic()-start)*1000))
        data=page.evaluate('window.fieldMeasure');page.evaluate('cancelAnimationFrame(window.fieldMeasureRaf)')
        def pct(values,p):return sorted(values)[min(len(values)-1,int(len(values)*p))]
        result={'seconds':round(time.monotonic()-start,1),'cpu_throttle':args.cpu,'renderer':'Chromium software GL','frames':len(data['intervals']),'fps':round(1000*len(data['intervals'])/sum(data['intervals']),1),'render_js_mean_ms':round(sum(data['ms'])/len(data['ms']),3),'render_js_p95_ms':round(pct(data['ms'],.95),3),'frame_p95_ms':round(pct(data['intervals'],.95),2),'terrain_ms':round(data['terrainMs'],1),'max_particles':data['particles'],'max_objects':data['objects'],'page_errors':errors}
        assert data['particles']>0 and data['particles']<=160,result
        assert data['objects']<=60,result
        assert not errors,errors
        print(json.dumps(result),flush=True)
    finally:b.close()
