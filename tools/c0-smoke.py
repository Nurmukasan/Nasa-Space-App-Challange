"""C0 browser acceptance. Requires Python Playwright and npm run dev on :5173.

No dependency manifests are changed. Discovery probes are C-owned temporary files
and are removed in finally. Override RS_TEST_URL or CHROMIUM_PATH if needed.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('RS_TEST_URL', 'http://localhost:5173')
PROBE = ROOT / 'client/src/dev/entries/console-c0-probe.tsx'
DICT = ROOT / 'client/src/i18n/en/console-c0-probe.ts'


def run():
    if PROBE.exists() or DICT.exists():
        raise RuntimeError('Refusing to overwrite existing probe files')
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
            headless=True,
            args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
                  '--enable-unsafe-swiftshader'],
        )
        errors = []
        context = browser.new_context(viewport={'width': 1280, 'height': 900})
        context.add_init_script("window.c0Error=null;window.addEventListener('error',(e)=>window.c0Error=e.message)")
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            page.goto(URL + '/?dev=nope')
            page.get_by_role('heading', name='Component playground').wait_for()
            page.get_by_role('link', name='field-hud', exact=True).wait_for()
            page.goto(URL + '/?dev=')
            page.get_by_text('Choose a component page.', exact=True).wait_for()
            page.get_by_role('link', name='field-hud', exact=True).click()
            page.get_by_role('button', name='CYCLE STATES', exact=True).wait_for()
            checks.append('Unknown/empty dev name lists B named-export entry; field-hud renders')

            DICT.write_text("export default {'c0.probe': 'Hello {name}: {n}/{n}'};\n")
            PROBE.write_text('''import { baseFixture, installFixture } from '../fixtures/base';
import { store } from '../../state/store';
import { snaps } from '../../state/snapshots';
import { t } from '../../i18n';
export default {name:'console-c0-probe',render:()=>{
 const fixture=baseFixture(); installFixture(fixture);
 const state=store.getState();
 return <pre id="c0-probe">{JSON.stringify({text:t('c0.probe',{name:'Crew',n:4}),
 eva:t('eva.oxygen'),phase:state.room?.phase,roles:state.room?.players.map(p=>p.role),
 time:snaps.curr?.t,tick:snaps.curr?.tick,crew:snaps.curr?.astronauts.length,
 real:fixture.room.simulation?.pub.tick===fixture.snap.tick,
 cloned:snaps.curr!==fixture.snap && snaps.curr!==fixture.room.simulation?.pub,
 shared:snaps.curr===state.hud})}</pre>;
}};
''')
            page.goto(URL + '/?dev=nope')
            page.get_by_role('link', name='console-c0-probe', exact=True).wait_for()
            page.get_by_role('link', name='console-c0-probe', exact=True).click()
            data = json.loads(page.locator('#c0-probe').inner_text())
            assert data['text'] == 'Hello Crew: 4/4', data
            assert data['eva'] == 'OXYGEN', data
            assert data['phase'] == 'eva' and data['roles'] == ['mc', 'eva', 'eva', 'eva'], data
            assert abs(data['time'] - 30) < .001 and data['tick'] == 525, data
            assert data['crew'] == 3 and data['real'] and data['cloned'] and data['shared'], data
            checks.append('Automatic default-export entry/dictionary, B dictionary, repeated interpolation')
            checks.append('Real four-player GameRoom at EVA 30s, cloned fixture/store/snapshots')

            for value, expected in [
                ('{"musicVolume":0.2,"sfxVolume":0.4,"muted":true,"reduceMotion":false}',
                 {'musicVolume': .2, 'sfxVolume': .4, 'muted': True, 'reduceMotion': False}),
                ('null', {'musicVolume': .35, 'sfxVolume': .7, 'muted': False, 'reduceMotion': True}),
                ('broken-json', {'musicVolume': .35, 'sfxVolume': .7, 'muted': False, 'reduceMotion': True}),
                ('{"musicVolume":99,"sfxVolume":-1}',
                 {'musicVolume': 1, 'sfxVolume': 0, 'muted': False, 'reduceMotion': True}),
                (None, {'musicVolume': .35, 'sfxVolume': .7, 'muted': False, 'reduceMotion': True}),
            ]:
                c = browser.new_context(reduced_motion='reduce')
                if value is None:
                    c.add_init_script("for (const key of ['getItem','setItem']) Object.defineProperty(Storage.prototype,key,{value(){throw new Error('storage blocked')}})")
                else:
                    c.add_init_script('localStorage.setItem("red-signal-prefs",' + json.dumps(value) + ')')
                tab = c.new_page()
                tab.on('pageerror', lambda error: errors.append(str(error)))
                tab.goto(URL + '/?dev=nope')
                actual = tab.evaluate("async()=>{const {prefs}=await import('/src/state/prefs.ts');return prefs.getState()}")
                assert actual == expected, (value, actual, expected)
                tab.evaluate("async()=>{const {prefs}=await import('/src/state/prefs.ts');prefs.setState({musicVolume:.6})}")
                if value is not None:
                    assert tab.evaluate('JSON.parse(localStorage.getItem("red-signal-prefs")).musicVolume') == .6
                c.close()
            checks.append('Preferences: valid/null/corrupt/out-of-range/denied storage; persistence; OS motion')

            page.goto(URL + '/?debug=1')
            page.get_by_placeholder('Call sign').fill('Control')
            page.get_by_role('button', name='Create room', exact=True).click()
            page.get_by_role('button', name='Mission Control', exact=True).wait_for()
            code = page.evaluate('window.rs.store.getState().room.code')
            crew = context.new_page()
            crew.on('pageerror', lambda error: errors.append(str(error)))
            crew.goto(URL + '/?debug=1')
            crew.get_by_placeholder('Call sign').fill('Pilot')
            crew.get_by_placeholder('Room code').fill(code)
            crew.get_by_role('button', name='Join', exact=True).click()
            crew.get_by_role('button', name='EVA astronaut', exact=True).wait_for()
            page.wait_for_function('window.rs.store.getState().room.players.length===2')
            page.get_by_role('button', name='Mission Control', exact=True).click()
            crew.get_by_role('button', name='EVA astronaut', exact=True).click()
            page.wait_for_function('window.rs.store.getState().room.players.every(p=>p.role!==null)')
            page.get_by_role('button', name='Design mission', exact=True).click()
            page.get_by_text('MISSION DESIGN', exact=True).wait_for()
            crew.get_by_text('MISSION DESIGN', exact=True).wait_for()
            checks.append('Two real online clients: create/join, roster, roles, design transition')
            crew.close()

            solo = context.new_page()
            solo.on('pageerror', lambda error: errors.append(str(error)))
            solo.route('**/socket.io/**', lambda route: route.abort())
            solo.goto(URL + '/?debug=1')
            solo.get_by_role('button', name='Play solo (offline)', exact=True).click()
            solo.get_by_role('button', name='Solo (both)', exact=True).wait_for()
            solo.get_by_role('button', name='Solo (both)', exact=True).click()
            solo.get_by_role('button', name='Quick start', exact=True).click()
            solo.wait_for_function('window.rs.snaps.curr !== null && window.rs.snaps.curr.t >= 0')
            solo.evaluate("""async()=>{const {fxBus}=await import('/src/fx/FxBus.ts');
 window.c0Effects=0;window.c0Off=fxBus.on('tremor',()=>window.c0Effects++);
 window.rs.send({t:'debug',cmd:'event_wind'});} """)
            solo.wait_for_function('window.c0Effects===1 || window.c0Error !== null')
            assert solo.evaluate('window.c0Effects') == 1 and not errors, errors
            solo.wait_for_timeout(700)
            assert solo.evaluate('window.c0Effects') == 1
            solo.evaluate('window.c0Off()')
            checks.append('First mission: real wind snapshot reaches B FxBus exactly once')
            solo.evaluate("window.rs.send({t:'mc:liftoff'})")
            solo.get_by_role('button', name='FLY AGAIN', exact=True).wait_for()
            solo.get_by_role('button', name='FLY AGAIN', exact=True).click()
            solo.wait_for_function('window.rs.snaps.curr !== null && window.rs.snaps.curr.t >= 0')
            solo.evaluate("""async()=>{const {fxBus}=await import('/src/fx/FxBus.ts');
 window.c0Effects=0;window.c0Off=fxBus.on('tremor',()=>window.c0Effects++);
 window.rs.send({t:'debug',cmd:'event_wind'});} """)
            solo.wait_for_function('window.c0Effects===1 || window.c0Error !== null')
            assert solo.evaluate('window.c0Effects') == 1 and not errors, errors
            solo.evaluate('window.c0Off()')
            checks.append('Local transport without sockets; actual wind snapshot reaches B FxBus exactly once in two sessions')
            assert not errors, errors
            print(json.dumps({'status': 'passed', 'checks': checks, 'page_errors': errors}, indent=2))
        except Exception:
            print(json.dumps({'status': 'failed', 'passed_checks': checks, 'page_errors': errors}, indent=2))
            raise
        finally:
            browser.close()
            PROBE.unlink(missing_ok=True)
            DICT.unlink(missing_ok=True)


if __name__ == '__main__':
    run()
