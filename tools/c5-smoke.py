"""C5 acceptance. --core-only checks session/health before the separate App hot-file PR."""
import argparse
import json
import re
from playwright.sync_api import sync_playwright, expect
args=argparse.ArgumentParser();args.add_argument('--core-only',action='store_true');args=args.parse_args()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    c=b.new_context(viewport={'width':1400,'height':1000});errors=[];c.on('page',lambda tab:tab.on('pageerror',lambda error:errors.append(str(error))))
    try:
        mc=c.new_page();mc.goto('http://localhost:5173/?debug=1');mc.get_by_placeholder('Call sign').fill('Control');mc.get_by_role('button',name='Create room',exact=True).click();mc.get_by_role('button',name='Mission Control',exact=True).click()
        code=mc.evaluate('window.rs.store.getState().room.code')
        crew=c.new_page();crew.goto('http://localhost:5173/?debug=1');crew.get_by_placeholder('Call sign').fill('Pilot');crew.get_by_placeholder('Room code').fill(code);crew.get_by_role('button',name='Join',exact=True).click();crew.get_by_role('button',name='EVA astronaut',exact=True).click()
        mc.wait_for_function('window.rs.store.getState().room.players.every(p=>p.role)');mc.get_by_role('button',name='Quick start',exact=True).click()
        crew.wait_for_function('window.rs.snaps.curr && window.rs.snaps.curr.t>=0');old=crew.evaluate('window.rs.store.getState().playerId');crew.reload()
        crew.wait_for_function('(id)=>window.rs.store.getState().playerId===id && window.rs.snaps.curr!==null',arg=old)
        assert crew.evaluate('window.rs.store.getState().room.players.length')==2
        offline=c.new_page();offline.route('**/healthz',lambda route:route.abort());offline.goto('http://localhost:5173/?debug=1')
        offline.get_by_text('Server offline — solo mode only',exact=True).wait_for();assert offline.get_by_role('button',name='Create room',exact=True).count()==0
        offline.get_by_role('button',name='Play solo (offline)',exact=True).click();offline.get_by_role('button',name='Solo (both)',exact=True).click();offline.get_by_role('button',name='Quick start',exact=True).click();offline.wait_for_function('window.rs.snaps.curr!==null')
        checks=['real EVA F5 restores the same slot, roster and snapshots','failed health check exposes solo only','offline local launch']
        if not args.core_only:
            mc.get_by_role('button',name='Settings',exact=True).click()
            mc.get_by_label('Music volume',exact=True).fill('0.2');mc.get_by_label('Effects volume',exact=True).fill('0.3');mc.get_by_label('Mute',exact=True).check();mc.get_by_label('Reduce motion',exact=True).check()
            mc.get_by_role('button',name='Close',exact=True).click();mc.reload();mc.get_by_role('button',name='Settings',exact=True).click()
            expect(mc.get_by_label('Music volume',exact=True)).to_have_value('0.2');expect(mc.get_by_label('Effects volume',exact=True)).to_have_value('0.3');expect(mc.get_by_label('Mute',exact=True)).to_be_checked();expect(mc.get_by_label('Reduce motion',exact=True)).to_be_checked()
            assert mc.evaluate('document.documentElement.dataset.reduceMotion')=='true'
            mc.keyboard.press('Escape');expect(mc.get_by_role('dialog')).to_have_count(0)
            mc.wait_for_function('document.querySelector(".debug-overlay")?.textContent.match(/renderer JS [0-9.]+ms.*ping [0-9]+ms/)')
            text=mc.locator('.debug-overlay').inner_text();assert 'snapshot 0B' not in text and 'tick 0 ' not in text,text
            mc.keyboard.press('F3');expect(mc.locator('.debug-overlay')).to_have_count(0);mc.keyboard.press('F3');expect(mc.locator('.debug-overlay')).to_have_count(1)
            checks+=['settings persist and use the B audio preference contract','Escape closes settings; reduced-motion flag applies','live measured script/ping/snapshot/tick diagnostics','F3 toggles diagnostics']
        assert not errors,errors
        print(json.dumps({'status':'passed','scope':'core only' if args.core_only else 'full C5','checks':checks,'page_errors':errors}))
    finally:b.close()
