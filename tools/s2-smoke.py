"""Local S2 integration with three real browser clients.
Debug clock jumps cover night/end; this is not a ten-minute human/public playtest.
"""
import json
import re
from playwright.sync_api import sync_playwright, expect

def astro(page):
    return page.evaluate('window.rs.snaps.curr.astronauts.find(a=>a.id===window.rs.store.getState().playerId)')

def walk(page,x,y):
    for _ in range(3):
        a=astro(page);speed=page.evaluate('window.rs.store.getState().room.params.walkSpeed')
        if abs(a['x']-x)<6 and abs(a['y']-y)<6:return
        for d,pos,neg in [(x-a['x'],'d','a'),(y-a['y'],'s','w')]:
            if abs(d)<3:continue
            key=pos if d>0 else neg
            page.keyboard.down(key);page.wait_for_timeout(abs(d)/speed*1000);page.keyboard.up(key);page.wait_for_timeout(100)

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    c=b.new_context(viewport={'width':1400,'height':1000});errors=[]
    c.on('page',lambda tab:tab.on('pageerror',lambda error:errors.append(str(error))))
    try:
        mc=c.new_page();mc.goto('http://localhost:5173/?debug=1')
        mc.get_by_placeholder('Call sign').fill('Control');mc.get_by_role('button',name='Create room',exact=True).click()
        mc.get_by_role('button',name='Mission Control',exact=True).click()
        code=mc.evaluate('window.rs.store.getState().room.code');crew=[]
        for index in range(2):
            tab=c.new_page();tab.goto('http://localhost:5173/?debug=1');tab.get_by_placeholder('Call sign').fill(f'Pilot{index+1}');tab.get_by_placeholder('Room code').fill(code);tab.get_by_role('button',name='Join',exact=True).click();tab.get_by_role('button',name='EVA astronaut',exact=True).click();crew.append(tab)
        mc.wait_for_function('window.rs.store.getState().room.players.length===3 && window.rs.store.getState().room.players.every(p=>p.role)')
        mc.get_by_role('button',name='Design mission',exact=True).click()
        for tab in [mc,*crew]:
            tab.get_by_text('MISSION DESIGN',exact=True).wait_for()
            assert tab.locator('.design-indicators').first.locator('output').count()==6
        before=mc.locator('.design-indicators').all_text_contents()
        mc.get_by_role('button',name='Budget project',exact=True).click()
        crew[0].wait_for_function('window.rs.store.getState().room.design.vehicle==="medium"')
        mc.wait_for_timeout(150)
        assert mc.locator('.design-indicators').all_text_contents()==crew[0].locator('.design-indicators').all_text_contents()
        assert before!=mc.locator('.design-indicators').all_text_contents()
        mc.get_by_role('button',name='Balanced project',exact=True).click()
        mc.get_by_role('button',name='5. Review',exact=True).click()
        mc.get_by_role('button',name=re.compile('^weather')).click()
        expect(mc.get_by_role('button',name='LAUNCH',exact=True)).to_be_enabled()
        for tab in [mc,*crew]:tab.get_by_role('button',name='Toggle ready',exact=True).click()
        mc.wait_for_function('window.rs.store.getState().room.players.every(p=>p.ready)')
        mc.get_by_role('button',name='LAUNCH',exact=True).click()
        mc.get_by_text('MISSION CONTROL',exact=True).wait_for()
        for tab in crew:tab.wait_for_function('window.rs.snaps.curr && window.rs.snaps.curr.t>=0')
        crew[1].keyboard.press('e')
        for kind in ['wind','quake','impact']:
            mc.evaluate('(kind)=>window.rs.send({t:"debug",cmd:"event_"+kind})',kind)
            mc.wait_for_function('window.rs.snaps.curr.seismic.some(e=>e.guess===null && e.truth===null)')
            mc.locator('button:enabled').filter(has_text=re.compile('^'+kind.upper())).first.click()
            mc.wait_for_function('(kind)=>window.rs.snaps.curr.seismic.some(e=>e.guess===kind)',arg=kind)
            if kind=='quake':
                mc.wait_for_function('window.rs.snaps.curr.hazards.length>0')
                hazard=mc.evaluate('window.rs.snaps.curr.hazards[0]')
                target=mc.evaluate('''async(h)=>{const {nearLedge,SITES}=await import('/@fs/workspace/Nasa-Space-App-Challange/shared/src/index.ts');const salt=SITES[window.rs.store.getState().room.params.site].terrainSalt;for(let dy=-24;dy<=24;dy+=8)for(let dx=-24;dx<=24;dx+=8)if(nearLedge(h.x+dx,h.y+dy,salt,28))return{x:h.x+dx,y:h.y+dy};throw Error('no ledge')}''',hazard)
                walk(crew[0],target['x'],target['y'])
                crew[0].wait_for_function('window.rs.snaps.curr.astronauts.find(a=>a.id===window.rs.store.getState().playerId).leak===true')
                walk(crew[0],768,768)
                mc.get_by_label('RATION',exact=True).click()
                mc.wait_for_function('window.rs.snaps.curr.lander.ration===true')
                crew[0].keyboard.press('e')
                mc.get_by_role('button',name='DISPENSE',exact=True).wait_for()
                before_o2=astro(crew[0])['o2'];mc.get_by_role('button',name='DISPENSE',exact=True).click()
                crew[0].wait_for_function('(before)=>window.rs.snaps.curr.astronauts.find(a=>a.id===window.rs.store.getState().playerId).o2>before',arg=before_o2)
                assert not astro(crew[0])['leak']
                crew[0].wait_for_function('window.rs.snaps.curr.astronauts.find(a=>a.id===window.rs.store.getState().playerId).o2>=window.rs.snaps.curr.astronauts.find(a=>a.id===window.rs.store.getState().playerId).o2Max*.98')
                crew[0].keyboard.press('e')
        mc.get_by_label('All crew',exact=True).check();mc.get_by_role('button',name='RETURN',exact=True).click()
        mc.wait_for_function('window.rs.snaps.curr.log.filter(e=>e.key==="alert.return").length>=2')
        mc.get_by_label('MOXIE',exact=True).fill('60');mc.wait_for_timeout(450)
        assert abs(mc.evaluate('window.rs.snaps.curr.lander.power.alloc.moxie')-.6)<.01
        mc.evaluate('window.rs.send({t:"debug",cmd:"set_time",n:500});window.rs.send({t:"debug",cmd:"storm"})')
        mc.wait_for_function('window.rs.snaps.curr.weather.storm && window.rs.snaps.curr.t>=window.rs.snaps.curr.weather.storm.tStart')
        assert crew[0].evaluate('window.rs.snaps.curr.weather.light')<.2
        assert mc.evaluate('window.rs.snaps.curr.seismic.filter(e=>e.truth!==null).length')>=3
        mc.evaluate('window.rs.send({t:"debug",cmd:"set_time",n:599})')
        mc.get_by_role('button',name='REDESIGN',exact=True).wait_for()
        report=mc.evaluate('window.rs.store.getState().room.report')
        assert report['stats']['classifyCorrect']>=3
        assert not errors,errors
        print(json.dumps({'status':'passed','room':code,'checks':['three clients, shared six resources and predictions','ready and launch','wind/quake/impact classification','real rockfall breach','RATION/dispense/refill/repair','all-crew radio commands','power','night and storm','timer report'],'page_errors':errors,'causal_insights':len(report['insights'])}))
    finally:b.close()
