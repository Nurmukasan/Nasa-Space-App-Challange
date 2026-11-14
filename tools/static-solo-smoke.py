"""Run against python -m http.server 5174 --directory client/dist.
Verifies a built client with no game server and no Socket.IO requests.
"""
import hashlib
import re
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=b.new_page(viewport={'width':1280,'height':900});errors=[];sockets=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('request',lambda request:sockets.append(request.url) if '/socket.io/' in request.url else None)
    page.add_init_script('window.toneRequests=0;const create=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(...args){window.toneRequests++;return create.apply(this,args)}')
    try:
        page.goto('http://localhost:5174/?debug=1');page.get_by_text('Server offline — solo mode only',exact=True).wait_for();assert page.get_by_role('button',name='Create room',exact=True).count()==0
        page.get_by_role('button',name='Play solo (offline)',exact=True).click();page.get_by_role('button',name='Solo (both)',exact=True).click();page.get_by_role('button',name='Quick start',exact=True).click()
        page.wait_for_function('window.rs.snaps.curr && window.rs.snaps.curr.t>=0')
        first=page.evaluate('window.rs.snaps.curr.astronauts[0].x');page.keyboard.down('d');page.wait_for_timeout(550);page.keyboard.up('d');page.wait_for_timeout(100);assert page.evaluate('window.rs.snaps.curr.astronauts[0].x')>first
        page.keyboard.down('a');page.wait_for_timeout(550);page.keyboard.up('a')
        hashes=[]
        for t in [0,250,500]:
            page.evaluate('(t)=>window.rs.send({t:"debug",cmd:"set_time",n:t})',t);page.wait_for_timeout(650)
            data=page.screenshot(path=f'/tmp/rs-final-light-{t}.png');hashes.append(hashlib.sha256(data).hexdigest())
        assert len(set(hashes))==3
        page.keyboard.press('e');page.wait_for_timeout(500)
        if page.evaluate('window.rs.snaps.curr.astronauts[0].status')!='inside':page.keyboard.press('e')
        page.keyboard.press('Tab');page.get_by_text('MISSION CONTROL',exact=True).wait_for()
        page.get_by_role('button',name='HOLD',exact=True).click();page.wait_for_timeout(200);assert page.evaluate('window.toneRequests')>0
        page.get_by_role('button',name='Settings',exact=True).click();page.get_by_label('Mute',exact=True).check();page.get_by_role('button',name='Close',exact=True).click()
        count=page.evaluate('window.toneRequests');page.get_by_role('button',name='HOLD',exact=True).click();page.wait_for_timeout(200);assert page.evaluate('window.toneRequests')==count
        page.get_by_role('button',name=re.compile('^LIFTOFF')).hover();page.mouse.down();page.wait_for_timeout(1150);page.mouse.up()
        page.get_by_role('button',name='FLY AGAIN',exact=True).wait_for();page.get_by_role('button',name='FLY AGAIN',exact=True).click();page.wait_for_function('window.rs.snaps.curr && window.rs.snaps.curr.t>=0')
        assert not sockets,sockets
        assert not errors,errors
        print('PASS: built static client, offline-only lobby, no sockets, local movement, 0/250/500 lighting captures, TAB console, requested fallback tones, mute suppresses tones, held liftoff/report, second mission; no JS errors')
    finally:b.close()
