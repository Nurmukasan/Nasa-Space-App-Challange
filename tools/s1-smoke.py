"""Local S1 acceptance, using two browsers and two actual CLI bots.
Requires Python Playwright, Chromium, and npm run dev. Not a public/two-network test.
"""
import json
import os
import re
import signal
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]

def walk_to(page, x, y):
    for _ in range(3):
        a = page.evaluate('window.rs.snaps.curr.astronauts.find(a=>a.id===window.rs.store.getState().playerId)')
        speed = page.evaluate('window.rs.store.getState().room.params.walkSpeed')
        if abs(a['x']-x)<6 and abs(a['y']-y)<6:
            return
        for delta, positive, negative in [(x-a['x'],'d','a'),(y-a['y'],'s','w')]:
            if abs(delta)<4:
                continue
            key=positive if delta>0 else negative
            page.keyboard.down(key)
            page.wait_for_timeout(abs(delta)/speed*1000)
            page.keyboard.up(key)
            page.wait_for_timeout(160)
    a = page.evaluate('window.rs.snaps.curr.astronauts.find(a=>a.id===window.rs.store.getState().playerId)')
    assert abs(a['x']-x)<14 and abs(a['y']-y)<14,(a,x,y)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':1400,'height':1000})
    errors=[]
    context.on('page',lambda tab:tab.on('pageerror',lambda error:errors.append(str(error))))
    bots=None
    try:
        demo=context.new_page()
        demo.add_init_script("window.mapLabels=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.mapLabels.push(String(text));if(window.mapLabels.length>2000)window.mapLabels.shift();return original.call(this,text,...args)}")
        demo.goto('http://localhost:5173/?dev=console')
        demo.wait_for_function("window.mapLabels.some(s=>s.startsWith('LOST'))")
        assert demo.evaluate("window.mapLabels.some(s=>s.startsWith('ROCKFALL')) && window.mapLabels.some(s=>s.startsWith('STORM'))")
        demo.screenshot(path='/tmp/rs-c1-map.png',full_page=True)
        demo.close()
        control=context.new_page();control.goto('http://localhost:5173/?debug=1')
        control.get_by_placeholder('Call sign').fill('Control')
        control.get_by_role('button',name='Create room',exact=True).click()
        control.get_by_role('button',name='Mission Control',exact=True).wait_for()
        code=control.evaluate('window.rs.store.getState().room.code')
        crew=context.new_page();crew.goto('http://localhost:5173/?debug=1')
        crew.get_by_placeholder('Call sign').fill('Pilot')
        crew.get_by_placeholder('Room code').fill(code)
        crew.get_by_role('button',name='Join',exact=True).click()
        crew.get_by_role('button',name='EVA astronaut',exact=True).click()
        control.get_by_role('button',name='Mission Control',exact=True).click()
        log=open('/tmp/rs-s1-bots.log','w')
        bots=subprocess.Popen(['npm','run','bots','--','--code',code,'--n','2'],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        control.wait_for_function('window.rs.store.getState().room.players.length===4 && window.rs.store.getState().room.players.every(p=>p.role)')
        control.get_by_role('button',name='Design mission',exact=True).click()
        control.get_by_text('MISSION DESIGN',exact=True).wait_for()
        control.get_by_role('button',name='5. Review',exact=True).click()
        control.get_by_role('button',name=re.compile('^drill')).click()
        crew.wait_for_function('window.rs.store.getState().room.design.modules.includes("drill")')
        control.get_by_label('Launch vehicle',exact=False).select_option('medium')
        expect(control.get_by_role('button',name='LAUNCH',exact=True)).to_be_disabled()
        control.get_by_role('button',name=re.compile('^drill')).click()
        expect(control.get_by_role('button',name='LAUNCH',exact=True)).to_be_enabled()
        control.get_by_role('button',name='LAUNCH',exact=True).click()
        control.get_by_text('MISSION CONTROL',exact=True).wait_for()
        crew.wait_for_function('window.rs.snaps.curr && window.rs.snaps.curr.t>=0')
        before=control.evaluate('window.rs.snaps.curr.astronauts.filter(a=>a.id!==window.rs.store.getState().playerId).map(a=>a.x)')
        control.wait_for_timeout(800)
        after=control.evaluate('window.rs.snaps.curr.astronauts.map(a=>a.x)')
        assert before!=after
        control.keyboard.press('1')
        canvas=control.locator('canvas.console-map')
        canvas.click(position={'x':100,'y':100})
        crew.wait_for_function('window.rs.snaps.curr.astronauts.find(a=>a.id===window.rs.store.getState().playerId).waypoint!==null')
        canvas.click(button='right')
        crew.wait_for_function('window.rs.snaps.curr.astronauts.find(a=>a.id===window.rs.store.getState().playerId).waypoint===null')
        get_a='window.rs.snaps.curr.astronauts.find(a=>a.id===window.rs.store.getState().playerId)'
        first=crew.evaluate(get_a)
        crew.keyboard.down('d');crew.wait_for_timeout(800);crew.keyboard.up('d');crew.wait_for_timeout(150)
        walking=crew.evaluate(get_a)
        crew.keyboard.down('Shift');crew.keyboard.down('d');crew.wait_for_timeout(800);crew.keyboard.up('d');crew.keyboard.up('Shift');crew.wait_for_timeout(150)
        running=crew.evaluate(get_a)
        assert walking['o2']<first['o2'] and running['o2']<walking['o2']
        assert running['x']-walking['x'] > (walking['x']-first['x'])*1.2
        site=crew.evaluate('''()=>{const snap=window.rs.snaps.curr,id=window.rs.store.getState().playerId;const others=snap.astronauts.filter(a=>a.id!==id&&a.status==='active');const candidates=snap.sites.filter(s=>s.depth===0&&others.every(a=>Math.hypot(a.x-s.x,a.y-s.y)>250));if(!candidates.length)throw Error('no unoccupied digging site');return candidates.reduce((best,s)=>Math.hypot(s.x-768,s.y-768)<Math.hypot(best.x-768,best.y-768)?s:best)}''')
        walk_to(crew,site['x'],site['y'])
        crew.keyboard.down('Space');crew.wait_for_timeout(4600);crew.keyboard.up('Space')
        assert crew.evaluate(get_a+'.carrying.length')>=1
        walk_to(crew,768,768)
        oxygen_before=crew.evaluate(get_a+'.o2')
        store_before=control.evaluate('window.rs.snaps.curr.lander.o2Store')
        crew.keyboard.press('e');crew.wait_for_timeout(900)
        assert crew.evaluate(get_a+'.o2')>oxygen_before
        assert control.evaluate('window.rs.snaps.curr.lander.o2Store')<store_before
        assert control.evaluate('window.rs.snaps.curr.lander.cache.length')>=1
        crew.wait_for_function('window.rs.snaps.curr.astronauts.find(a=>a.id===window.rs.store.getState().playerId).o2>=window.rs.snaps.curr.astronauts.find(a=>a.id===window.rs.store.getState().playerId).o2Max*.98')
        crew.keyboard.press('e')
        control.get_by_role('button',name=re.compile('^LIFTOFF')).hover();control.mouse.down();control.wait_for_timeout(1150);control.mouse.up()
        control.get_by_role('button',name='REDESIGN',exact=True).wait_for()
        crew.get_by_text(re.compile('Grade|GRADE')).wait_for()
        assert control.evaluate('window.rs.store.getState().room.report.score.science')>0
        control.get_by_role('button',name='REDESIGN',exact=True).click()
        crew.get_by_text('MISSION DESIGN',exact=True).wait_for()
        assert not errors,errors
        print(json.dumps({'status':'passed','room':code,'checks':['fixture ghost/rockfall/forecast','two clients plus two CLI bots','shared design, mass blocking','launch and real movement','waypoint/clear','walk/run oxygen','keyboard dig/deposit/refill','science report and redesign'],'page_errors':errors}))
    finally:
        if bots and bots.poll() is None:
            os.killpg(bots.pid,signal.SIGTERM)
            bots.wait(timeout=5)
        browser.close()
