"""Natural-time four-client soak: browser MC + three actual CLI EVA bots.
Run against a separately started npm start instance so dev reloads cannot reset it.
This is automated traffic; it does not replace a human playtest or two networks.
"""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import time
from playwright.sync_api import sync_playwright
args=argparse.ArgumentParser();args.add_argument('--url',default='http://localhost:3101');args=args.parse_args()
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':960});errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    bots=None
    try:
        page.goto(args.url+'/?debug=1')
        page.get_by_placeholder('Call sign').fill('SOAK CONTROL');page.get_by_role('button',name='Create room',exact=True).click();page.get_by_role('button',name='Mission Control',exact=True).click()
        code=page.evaluate('window.rs.store.getState().room.code')
        log=open('/tmp/rs-soak-bots.log','w')
        bots=subprocess.Popen(['npm','run','bots','--','--code',code,'--n','3','--url',args.url],cwd=root,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        page.wait_for_function('window.rs.store.getState().room.players.length===4 && window.rs.store.getState().room.players.every(p=>p.role)')
        page.get_by_role('button',name='Quick start',exact=True).click()
        page.wait_for_function('window.rs.snaps.curr!==null')
        page.evaluate('window.rs.send({t:"mc:power",alloc:{moxie:.7,comms:.15,scan:.15}})')
        duration=page.evaluate('window.rs.snaps.curr.durationS')
        start=time.monotonic();last_log=-30;answered=set()
        while True:
            state=page.evaluate('({room:window.rs.store.getState().room,snap:window.rs.snaps.curr})')
            if state['room']['phase']=='report':break
            snap=state['snap'];elapsed=time.monotonic()-start
            if elapsed>snap['durationS']+120:raise RuntimeError('Mission did not finish within its wall-time budget')
            for event in snap['seismic']:
                if event['id'] in answered or event['guess'] is not None or snap['t']>=event['deadline']:continue
                signal_data=event['signals'][0]
                kind='wind' if any(s['pressureDip']>0 for s in event['signals']) else 'impact' if signal_data['riseS']<1 else 'quake'
                page.evaluate('(r)=>window.rs.send({t:"mc:classify",eventId:r.id,kind:r.kind})',{'id':event['id'],'kind':kind});answered.add(event['id'])
            if elapsed-last_log>=30:
                print(json.dumps({'elapsed_s':round(elapsed),'mission_s':round(snap['t']),'deposited':len(snap['lander']['cache']),'crew':[a['status'] for a in snap['astronauts']],'o2_store':round(snap['lander']['o2Store'])}),flush=True);last_log=elapsed
            assert not errors,errors
            page.wait_for_timeout(500)
        report=state['room']['report'];elapsed=time.monotonic()-start
        assert elapsed>=duration-1,('early report',elapsed,report)
        assert report['stats']['samplesDeposited']>0,report
        assert report['stats']['allAboard'],report
        assert not errors,errors
        print(json.dumps({'status':'passed','elapsed_s':round(elapsed,1),'stats':report['stats'],'score':report['score'],'page_errors':errors}),flush=True)
    finally:
        if bots and bots.poll() is None:os.killpg(bots.pid,signal.SIGTERM);bots.wait(timeout=5)
        browser.close()
