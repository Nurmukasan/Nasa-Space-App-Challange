"""Causal report UI smoke; debug clock jumps are intentional."""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=b.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    try:
        page.goto('http://localhost:5173/?debug=1');page.get_by_role('button',name='Play solo (offline)',exact=True).click();page.get_by_role('button',name='Solo (both)',exact=True).click();page.get_by_role('button',name='Quick start',exact=True).click()
        page.wait_for_function('window.rs.snaps.curr && window.rs.snaps.curr.t>=0')
        page.keyboard.press('e');page.wait_for_timeout(150)
        page.evaluate('window.rs.send({t:"debug",cmd:"set_time",n:599})')
        page.get_by_role('heading',name='Why this happened',exact=True).wait_for()
        assert page.locator('ol li').count()>=3
        page.get_by_role('heading',name='Mission twin',exact=True).wait_for()
        assert 'InSight' in page.inner_text('body') and 'insight.' not in page.inner_text('body')
        page.get_by_role('button',name='REDESIGN',exact=True).click();page.get_by_text('MISSION DESIGN',exact=True).wait_for()
        assert not errors,errors
        print('PASS: at least three rendered causal findings, mission twin, no raw keys, redesign, no JS errors')
    finally:b.close()
