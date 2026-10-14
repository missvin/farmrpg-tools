import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {describe, it, expect, vi} from 'vitest';
import {parseMasteryPaste} from '../../src/lib/parseMasteryPaste';
import {parseCurrentInventoryPaste} from '../../src/lib/parseCurrentInventoryPaste';
import {prepareCaptureImport} from '../../src/lib/captureImportAdapter';
import {CAPTURE_REQUIRED_SECTIONS} from '../../src/lib/captureBridge';

const source = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const time = '2026-10-10T01:00:00.000Z';
function fixture(html) {
  const dom = new JSDOM(html, {url: 'https://farmrpg.com/index.php?token=private#!/inventory.php', runScripts: 'outside-only', pretendToBeVisual: true});
  Object.defineProperty(dom.window, 'TextEncoder', {value: TextEncoder});
  Object.defineProperty(dom.window, 'crypto', {value: webcrypto});
  for (const file of ['upstream-layout.js', 'shared.js', 'extractor.js']) dom.window.eval(source(file));
  return dom;
}
// Row structure follows Rebecca's sanitized My Inventory DOM evidence (2026-10-14).
const inventory = (counts = [12, 3]) => `<div class="page page-current" data-page="inventory"><h1>My Inventory</h1>${counts.map((n,i) => `<li><div class="item-content"><div class="item-media"><img class="itemimg"></div><div class="item-inner"><div class="item-title"><strong>${['Steel', 'Board'][i]}<span class="tw-badge">308</span></strong><br><span>Item description<br><div class="chip inv-mastery-chip inv-mastery-m"><div class="chip-label">Mastered</div></div></span></div><div class="item-after">${n}</div></div></div></li>`).join('')}<div class="content-block-title">Inventory Stats</div><p>Your inventory contains <strong>${counts.filter(n => n > 0).length}</strong> unique items and <strong>${counts.reduce((a,b) => a+b,0)}</strong> items in total.</p></div>`;
const tierRows = [
  ['Tier V (MM)', '1000000', '234567', 'Corn'], ['Tier IV (GM)', '100000', '12345', 'Fancy Violin'],
  ['Tier III (M)', '10000', '1234', 'Steel'], ['Tier II', '1000', '111', 'Board'], ['Tier I', '100', '11', 'Apple'], ['No Tier', '10', '1', 'Pear'],
  ['Mega Mastered', '∞', '1234567', 'Corn Oil'],
];
const mastery = () => `<div class="page page-current"><h1>Mastery In-Progress</h1><p>So far, you have 3 items Mastered, 2 items Grand Mastered and 1 items Mega Mastered</p>${tierRows.map(([heading, target,count,name]) => `<h2>${heading}</h2><div style="display:none"><strong>${name}</strong><p>${count} / ${target} Progress</p></div>`).join('')}</div>`;
function extract(dom, id = 'fixture') { return dom.window.FarmExtractor.extract(dom.window.document, dom.window.location.href, time, id); }

describe('manual full-page Firefox extraction', () => {
  it('matches the inventory paste importer and strips URL secrets, badge and unrelated chrome', () => {
    const dom = fixture('<aside>Chat private</aside>' + inventory());
    const capture = extract(dom);
    const paste = parseCurrentInventoryPaste('Steel, 12\nBoard, 3');
    expect(capture.rows.map(row => [row.itemName,row.count]).sort()).toEqual(paste.entries.map(row => [row.itemName,row.inventoryCount]).sort());
    expect(capture.sourceUrl).toBe('https://farmrpg.com/index.php');
    expect(JSON.stringify(capture)).not.toMatch(/private|Chat|308/);
    expect(dom.window.FarmCapture.SECTIONS.inventory).toEqual(CAPTURE_REQUIRED_SECTIONS.inventory);
    expect(prepareCaptureImport(capture, {now: time, requiredSections: CAPTURE_REQUIRED_SECTIONS.inventory, lookup: null}).ok).toBe(true);
    dom.window.close();
  });
  it('accepts genuine depletion and explicit zero without row-shrink heuristics', () => {
    const dom = fixture(inventory([0, 1]));
    expect(extract(dom).rows.map(row => row.count)).toEqual([0,1]);
    dom.window.close();
  });
  it('reads the supplied My Inventory row shape and split summary text with exact comma quantities', () => {
    const dom = fixture(inventory([8110, 1]).replace('Steel', 'Bone Broth').replace('Board', 'Pig Collar').replace('>8110<', '>8,110<').replace('>8111<', '>8,111<'));
    expect(extract(dom).rows.map(row => [row.itemName, row.count])).toEqual([['Bone Broth', 8110], ['Pig Collar', 1]]);
    expect(extract(dom).coverage.sections).toEqual([{id: 'Inventory', loaded: true, expectedRows: 2}]);
    dom.window.close();
  });
  it.each(['#!/everything.php', '#!/inventory.php?category=meals', '#!/item.php?id=1', ''])('rejects inventory-like rows on unsupported route %s', route => {
    const dom = fixture(inventory());
    dom.window.location.hash = route;
    expect(() => extract(dom)).toThrow(/Open My Inventory/);
    dom.window.close();
  });
  it('ignores retained catalogue rows and checks only owned inventory totals', () => {
    const catalogue = '<div class="page page-on-left" data-page="everything"><h1>Everything</h1>Every single item (1,573)<img class="itemimg"></div>';
    const dom = fixture(catalogue + inventory().replace('page page-current', 'page page-on-center'));
    expect(extract(dom).rows).toHaveLength(2);
    dom.window.close();
  });
  it.each([
    html => html.replace('>15<', '>16<'),
    html => html.replace('>2<', '>3<'),
    html => html.replace('data-page="inventory"', ''),
  ])('rejects inconsistent Inventory Stats or missing page identity', change => {
    const dom = fixture(change(inventory()));
    expect(() => extract(dom)).toThrow();
    dom.window.close();
  });
  it('rejects old catalogue-labelled cached inventory at both boundaries', () => {
    const dom = fixture(inventory());
    const capture = extract(dom);
    const legacy = {...capture, coverage: {...capture.coverage, sections: [{id: 'Everything', loaded: true, expectedRows: 2}]}, rows: capture.rows.map(row => ({...row, sectionId: 'Everything'}))};
    expect(() => dom.window.FarmCapture.validate(legacy, time)).toThrow(/section/);
    expect(prepareCaptureImport(legacy, {now: time, requiredSections: CAPTURE_REQUIRED_SECTIONS.inventory, lookup: null}).ok).toBe(false);
    dom.window.close();
  });
  it.each([
    ['wrong category', html => html.replace('data-page="inventory"', 'data-page="crops"')],
    ['missing totals', html => html.replace(/Your inventory contains.*?<\/p>/, '</p>')],
    ['unloaded row', html => html.replace(/<li>.*?<\/li>/, '')],
    ['malformed count', html => html.replace('>12<', '>1.2K<')],
    ['loading', html => html.replace('<h1>', '<span class="preloader"></span><h1>')],
    ['duplicate active page', html => html + html],
    ['missing quantity', html => html.replace('class="item-after"', 'class="missing"')],
    ['duplicate item', html => html.replace('Board', 'Steel')],
  ])('rejects %s', (_label, change) => {
    const dom = fixture(change(inventory()));
    expect(() => extract(dom)).toThrow();
    dom.window.close();
  });
  it('uses only the active Framework7 page, never the biggest retained page', () => {
    const stale = mastery().replace('page page-current', 'page page-on-left');
    const dom = fixture(stale + inventory());
    expect(extract(dom).section).toBe('inventory');
    dom.window.close();
  });
  it('matches mastery paste rows including already-loaded folded tiers', () => {
    const dom = fixture(mastery());
    const capture = extract(dom);
    const text = dom.window.FarmExtractor.pageText(dom.window.document.querySelector('.page-current'));
    const paste = parseMasteryPaste(text);
    expect(capture.rows.map(row => [row.itemName,row.count,row.targetTier])).toEqual(paste.parsedRows.map(row => [row.rawItemName,row.count,row.targetTier]));
    expect(prepareCaptureImport(capture, {now: time, requiredSections: dom.window.FarmCapture.SECTIONS.mastery, lookup: null}).ok).toBe(true);
    dom.window.close();
  });
  it.each([inventory, mastery])('reads a centered page alongside the observed retained page layout', makePage => {
    const html = '<div class="pages"><div class="page">Retained page</div>' +
      inventory().replace('page page-current', 'page page-on-left') +
      makePage().replace('page page-current', 'page page-on-center') + '</div>';
    const dom = fixture(html);
    const baseline = fixture(makePage());
    expect(extract(dom)).toEqual(extract(baseline));
    dom.window.close();
    baseline.window.close();
  });
  it('counts a page bearing both active markers only once', () => {
    const dom = fixture(inventory().replace('page page-current', 'page page-current page-on-center'));
    expect(extract(dom).section).toBe('inventory');
    dom.window.close();
  });
  it.each([
    ['mixed active markers', inventory() + mastery().replace('page page-current', 'page page-on-center')],
    ['two centered pages', (inventory() + mastery()).replaceAll('page page-current', 'page page-on-center')],
    ['hidden centered page', inventory().replace('page page-current"', 'page page-on-center" style="display:none"')],
    ['transitioning centered page', inventory().replace('page page-current', 'page page-on-center page-transitioning')],
    ['conflicting stale marker', inventory().replace('page page-current', 'page page-on-center page-on-left')],
  ])('rejects %s', (_label, html) => {
    const dom = fixture(html);
    expect(() => extract(dom)).toThrow();
    dom.window.close();
  });
  it('rejects a centered page becoming stale during capture', async () => {
    const dom = fixture(inventory().replace('page page-current', 'page page-on-center'));
    await expect(dom.window.FarmExtractor.stableCapture(dom.window.document, dom.window, async () => {
      dom.window.document.querySelector('.page').className = 'page page-on-left';
      await Promise.resolve();
    })).rejects.toThrow(/changed/);
    dom.window.close();
  });
  it('rejects unloaded folded rows, absent tiers and bad summary totals', () => {
    for (const html of [mastery().replace('<h2>Tier I</h2>', ''), mastery().replace(/<strong>Apple<\/strong><p>11 \/ 100 Progress<\/p>/, ''), mastery().replace('3 items Mastered','4 items Mastered')]) {
      const dom = fixture(html);
      expect(() => extract(dom)).toThrow();
      dom.window.close();
    }
  });
  it('requires No Tier separately from Tier I and retains both targets through tracker preparation', () => {
    const dom = fixture(mastery());
    const capture = extract(dom);
    expect(dom.window.FarmCapture.SECTIONS.mastery).toEqual(CAPTURE_REQUIRED_SECTIONS.mastery);
    const prepared = prepareCaptureImport(capture, {now: time, requiredSections: CAPTURE_REQUIRED_SECTIONS.mastery, lookup: null});
    expect(prepared.ok).toBe(true);
    expect(prepared.parsed.parsedRows.filter(row => row.targetTier <= 100).map(row => [row.rawItemName, row.targetTier])).toEqual([['Apple', 100], ['Pear', 10]]);
    for (const change of [
      html => html.replace('<h2>No Tier</h2>', ''),
      html => html.replace('11 / 100 Progress', '11 / 10 Progress'),
      html => html.replace('1 / 10 Progress', '1 / 100 Progress'),
    ]) {
      const invalid = fixture(change(mastery()));
      expect(() => extract(invalid)).toThrow();
      invalid.window.close();
    }
    const legacy = {...capture, coverage: {...capture.coverage, sections: capture.coverage.sections.filter(section => section.id !== '100')}, rows: capture.rows.filter(row => row.sectionId !== '100')};
    expect(() => dom.window.FarmCapture.validate(legacy, time)).toThrow(/required section/);
    expect(prepareCaptureImport(legacy, {now: time, requiredSections: CAPTURE_REQUIRED_SECTIONS.mastery, lookup: null}).ok).toBe(false);
    dom.window.close();
  });
  it('requires explicit empty-tier evidence; does not infer loaded from an empty accordion', () => {
    const html = mastery().replace('<strong>Pear</strong><p>1 / 10 Progress</p>', 'No items in this tier');
    const dom = fixture(html);
    expect(extract(dom).coverage.sections.find(section => section.id === '10').expectedRows).toBe(0);
    dom.window.close();
  });
  it('rejects a route change or mutation during the settling window', async () => {
    const dom = fixture(inventory());
    await expect(dom.window.FarmExtractor.stableCapture(dom.window.document, dom.window, async () => {
      dom.window.document.querySelector('h1').textContent = 'Crops';
      await Promise.resolve();
    })).rejects.toThrow(/changed/);
    dom.window.close();
  });
  it('rejects unsafe origins and hidden/nonactive pages', () => {
    const dom = fixture(inventory());
    expect(() => dom.window.FarmExtractor.extract(dom.window.document, 'https://evil.test/')).toThrow();
    Object.defineProperty(dom.window.document, 'visibilityState', {value: 'hidden'});
    return expect(dom.window.FarmExtractor.stableCapture(dom.window.document, dom.window)).rejects.toThrow(/visible/).finally(() => dom.window.close());
  });
});

describe('manifest and protocol', () => {
  it('has an event page, stable ID, no broad host/download/network permissions', () => {
    const manifest = JSON.parse(source('manifest.json'));
    expect(manifest.background.service_worker).toBeUndefined();
    expect(manifest.background.persistent).toBeUndefined();
    expect(manifest.permissions).toEqual(['storage', 'activeTab']);
    expect(manifest.host_permissions).toEqual(['https://farmrpg.com/*', 'https://www.farmrpg.com/*', 'https://farmrpg-tools.vercel.app/*']);
    expect(manifest.browser_specific_settings.gecko.id).toBeTruthy();
    expect(manifest.content_scripts.every(script => script.all_frames === false)).toBe(true);
  });
  it('signs the exact BL-373 bytes and requires bound acknowledgment identity', async () => {
    const dom = fixture(inventory());
    const capture = extract(dom);
    const key = 'ab'.repeat(32);
    const envelope = await dom.window.FarmCapture.sign(capture, key, 'request-1');
    const imported = await webcrypto.subtle.importKey('raw', Buffer.from(key,'hex'), {name:'HMAC', hash:'SHA-256'}, false, ['verify']);
    expect(await webcrypto.subtle.verify('HMAC', imported, Buffer.from(envelope.signature,'hex'), new TextEncoder().encode('1\nfarmrpg-tools-firefox\n' + envelope.body))).toBe(true);
    expect(envelope.body).not.toContain(key);
    expect(dom.window.FarmCapture.validAck({channel:'farmrpg-tools.capture',version:1,sender:'farmrpg-tools-tracker',type:'ack',requestId:'request-1',state:'applied',message:'saved'}, 'other')).toBe(false);
    dom.window.close();
  });
});

function background() {
  const dom = fixture('');
  let listener;
  let stored = {};
  const api = {
    runtime: {id: 'test-id', getURL: path => 'moz-extension://test/' + path, onMessage: {addListener: fn => { listener = fn; }}},
    storage: {local: {get: vi.fn(async () => structuredClone(stored)), set: vi.fn(async value => { stored = structuredClone(value); })}},
    tabs: {query: vi.fn(async query => query.active ? [{id: 1, url: 'https://farmrpg.com/index.php'}] : [{id: 2, url: 'https://farmrpg-tools.vercel.app/'}]), get: vi.fn(async () => ({id:1,url:'https://farmrpg.com/index.php'})), sendMessage: vi.fn()},
  };
  dom.window.browser = api;
  dom.window.eval(source('background.js'));
  const sender = {id:'test-id',url:'moz-extension://test/popup.html'};
  const call = message => listener(message, sender);
  const state = () => stored['companion-v1'];
  const captureDom = fixture(inventory());
  const capture = extract(captureDom);
  captureDom.window.close();
  api.tabs.sendMessage.mockImplementation(async (_tab,message) => message.type === 'capture-active-page' ? {ok:true,capture} : {state:'applied',message:'Saved',receipt:{captureId:capture.captureId,section:capture.section,observedAt:capture.observedAt}});
  return {dom,api,call,listener,state,capture};
}

describe('background authority, durable cache and acknowledgments', () => {
  it('ignores game/frame/foreign senders even with a forged popup command', () => {
    const b = background();
    for (const sender of [{id:'other',url:'moz-extension://test/popup.html'}, {id:'test-id',url:'https://farmrpg.com/'}, {id:'test-id',url:'moz-extension://test/popup.html',frameId:1,tab:{id:1}}]) expect(b.listener({type:'capture'},sender)).toBeUndefined();
    expect(b.api.tabs.query).not.toHaveBeenCalled();
    b.dom.window.close();
  });
  it('never exposes pairing authority in status and captures only after explicit command', async () => {
    const b = background();
    expect(b.api.tabs.sendMessage).not.toHaveBeenCalled();
    await b.call({type:'pair',key:'ab'.repeat(32)});
    const status = await b.call({type:'status'});
    expect(JSON.stringify(status)).not.toContain('ab'.repeat(32));
    const result = await b.call({type:'capture'});
    expect(result.status.state).toBe('applied');
    expect(b.state().captures.inventory.captureId).toBe('fixture');
    expect(b.api.tabs.sendMessage.mock.calls.every(call => call[2].frameId === 0)).toBe(true);
    expect(JSON.stringify(b.api.tabs.sendMessage.mock.calls)).not.toContain('ab'.repeat(32));
    b.dom.window.close();
  });
  it('waits for durable tracker acknowledgment before publishing applied', async () => {
    const b = background();
    await b.call({type:'pair',key:'ab'.repeat(32)});
    let resolve;
    b.api.tabs.sendMessage.mockImplementation(async (_tab,message) => message.type === 'capture-active-page' ? {ok:true,capture:b.capture} : new Promise(done => { resolve = done; }));
    const pending = b.call({type:'capture'});
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
    expect(b.state().status.state).toBe('waiting');
    expect(b.state().lastAppliedAt).toBeUndefined();
    resolve({state:'applied',message:'Saved',receipt:{captureId:b.capture.captureId,section:'inventory',observedAt:time}});
    expect((await pending).status.state).toBe('applied');
    b.dom.window.close();
  });
  it('retains a validated capture while the tracker is closed; manual retry sends it once', async () => {
    const b = background();
    await b.call({type:'pair',key:'ab'.repeat(32)});
    b.api.tabs.query.mockImplementation(async query => query.active ? [{id:1,url:'https://farmrpg.com/index.php'}] : []);
    expect((await b.call({type:'capture'})).status.state).toBe('waiting');
    expect(b.state().captures.inventory).toBeTruthy();
    b.api.tabs.query.mockResolvedValue([{id:2,url:'https://farmrpg-tools.vercel.app/'}]);
    expect((await b.call({type:'retry',section:'inventory'})).status.state).toBe('applied');
    b.dom.window.close();
  });
  it('disconnects without losing the cached capture and allows manual retry after re-pairing', async () => {
    const b = background();
    await b.call({type:'pair',key:'ab'.repeat(32)});
    await b.call({type:'capture'});
    const previous = structuredClone(b.state());
    await b.call({type:'disconnect'});
    b.api.tabs.sendMessage.mockClear();
    expect((await b.call({type:'retry',section:'inventory'})).status.message).toMatch(/Pair with the tracker/);
    expect(b.api.tabs.sendMessage).not.toHaveBeenCalled();
    expect(b.state().captures).toEqual(previous.captures);
    expect(b.state().lastAppliedAt).toBe(previous.lastAppliedAt);
    await b.call({type:'pair',key:'cd'.repeat(32)});
    b.api.tabs.sendMessage.mockResolvedValue({state:'duplicate',message:'Already saved'});
    expect((await b.call({type:'retry',section:'inventory'})).status.state).toBe('duplicate');
    expect(b.state().lastAppliedAt).toBe(previous.lastAppliedAt);
    b.dom.window.close();
  });
  it.each(['rejected','duplicate'])('shows %s without fabricating a new successful application', async state => {
    const b = background();
    await b.call({type:'pair',key:'ab'.repeat(32)});
    b.api.tabs.sendMessage.mockImplementation(async (_tab,message) => message.type === 'capture-active-page' ? {ok:true,capture:b.capture} : {state,message:'Previous good data retained'});
    expect((await b.call({type:'capture'})).status.state).toBe(state);
    expect(b.state().lastAppliedAt).toBeUndefined();
    b.dom.window.close();
  });
  it('does not replace good cache on incomplete reads or a changed game tab', async () => {
    const b = background();
    await b.call({type:'pair',key:'ab'.repeat(32)});
    await b.call({type:'capture'});
    b.api.tabs.sendMessage.mockResolvedValue({ok:false,error:'Incomplete page'});
    expect((await b.call({type:'capture'})).status.state).toBe('rejected');
    expect(b.state().captures.inventory.captureId).toBe('fixture');
    expect(b.state().lastAppliedAt).toBeTruthy();
    b.api.tabs.sendMessage.mockResolvedValue({ok:true,capture:{...b.capture,captureId:'new',observedAt:'2026-10-10T02:00:00.000Z'}});
    b.api.tabs.get.mockResolvedValue({url:'https://farmrpg.com/other.php'});
    expect((await b.call({type:'capture'})).status.message).toMatch(/changed/);
    expect(b.state().captures.inventory.captureId).toBe('fixture');
    b.dom.window.close();
  });
  it('fails visibly when storage fails and never delivers an unsaved capture', async () => {
    const b = background();
    await b.call({type:'pair',key:'ab'.repeat(32)});
    b.api.storage.local.set.mockRejectedValue(new Error('Storage failed'));
    const result = await b.call({type:'capture'});
    expect(result.ok).toBe(false);
    expect(result.status.message).toMatch(/storage failed/i);
    expect(b.api.tabs.sendMessage).not.toHaveBeenCalled();
    b.dom.window.close();
  });
});

describe('Firefox content handlers', () => {
  function relay() {
    const dom = fixture('');
    let listener;
    dom.window.browser = {runtime:{id:'test-id',getURL:path=>'moz-extension://test/'+path,onMessage:{addListener:fn=>{listener=fn;}}}};
    dom.reconfigure({url:'https://farmrpg-tools.vercel.app/'});
    dom.window.eval(source('tracker-content.js'));
    const sender = {id:'test-id',url:'moz-extension://test/_generated_background_page.html'};
    const capture = {schemaVersion:1,captureId:'fixture',section:'inventory',scope:'full',observedAt:time,sourceUrl:'https://farmrpg.com/index.php',coverage:{activePage:true,settled:true,sections:[{id:'Inventory',loaded:true,expectedRows:1}]},rows:[{itemName:'Steel',count:12,sectionId:'Inventory'}]};
    const envelope = {channel:'farmrpg-tools.capture',version:1,sender:'farmrpg-tools-firefox',signature:'ab'.repeat(32),body:JSON.stringify({requestId:'relay-test',capture})};
    const ack = {channel:'farmrpg-tools.capture',version:1,sender:'farmrpg-tools-tracker',type:'ack',requestId:'relay-test',state:'applied',message:'Committed',receipt:{captureId:'fixture',section:'inventory',observedAt:time}};
    const send = (data=ack, origin='https://farmrpg-tools.vercel.app', eventSource=dom.window) => dom.window.dispatchEvent(new dom.window.MessageEvent('message',{data,origin,source:eventSource}));
    return {dom,listener,sender,envelope,ack,send};
  }
  it('publishes only to exact tracker origin and waits through applying for a bound receipt', async () => {
    const r = relay();
    const post = vi.spyOn(r.dom.window,'postMessage').mockImplementation(()=>{});
    const result = r.listener({type:'deliver-capture',envelope:r.envelope},r.sender);
    expect(post).toHaveBeenCalledWith(r.envelope,'https://farmrpg-tools.vercel.app');
    r.send({...r.ack,state:'applying'});
    expect(await r.listener({type:'deliver-capture',envelope:r.envelope},r.sender)).toMatchObject({state:'waiting'});
    r.send();
    expect(await result).toMatchObject({state:'applied',receipt:{captureId:'fixture'}});
    r.dom.window.close();
  });
  it('rejects wrong message authority, origin, source, request and receipt without acknowledging application', async () => {
    const r = relay();
    vi.spyOn(r.dom.window,'postMessage').mockImplementation(()=>{});
    r.dom.window.setTimeout = (fn) => setTimeout(fn,5);
    r.dom.window.clearTimeout = clearTimeout;
    expect(r.listener({type:'deliver-capture',envelope:r.envelope},{id:'test-id',url:'https://farmrpg.com/'})).toBeUndefined();
    const result = r.listener({type:'deliver-capture',envelope:r.envelope},r.sender);
    r.send(r.ack,'https://evil.test');
    r.send(r.ack,'https://farmrpg-tools.vercel.app',null);
    r.send({...r.ack,requestId:'wrong'});
    r.send({...r.ack,receipt:{captureId:'wrong'}});
    expect((await result).state).toBe('waiting');
    r.dom.window.close();
  });
  it('surfaces tracker rejection and removes its listener so retry works', async () => {
    const r = relay();
    vi.spyOn(r.dom.window,'postMessage').mockImplementation(()=>{});
    const first = r.listener({type:'deliver-capture',envelope:r.envelope},r.sender);
    r.send({...r.ack,state:'rejected',message:'Older observation'});
    expect((await first).state).toBe('rejected');
    const second = r.listener({type:'deliver-capture',envelope:r.envelope},r.sender);
    r.send({...r.ack,state:'duplicate',message:'Already saved'});
    expect((await second).state).toBe('duplicate');
    r.dom.window.close();
  });
  it('reads only on trusted manual background request and refuses overlapping reads', async () => {
    const dom = fixture(inventory());
    let listener, resolve;
    dom.window.browser = {runtime:{id:'test-id',getURL:path=>'moz-extension://test/'+path,onMessage:{addListener:fn=>{listener=fn;}}}};
    dom.window.FarmExtractor.stableCapture = vi.fn(()=>new Promise(done=>{resolve=done;}));
    dom.window.eval(source('farm-content.js'));
    expect(dom.window.FarmExtractor.stableCapture).not.toHaveBeenCalled();
    expect(listener({type:'capture-active-page'},{id:'other'})).toBeUndefined();
    const sender = {id:'test-id',url:'moz-extension://test/_generated_background_page.html'};
    const pending = listener({type:'capture-active-page'},sender);
    expect(await listener({type:'capture-active-page'},sender)).toMatchObject({ok:false});
    resolve(extract(dom));
    expect((await pending).ok).toBe(true);
    dom.window.close();
  });
  it('retains a compact actionable extractor failure instead of claiming capture success', async () => {
    const dom = fixture(inventory());
    let listener;
    dom.window.browser = {runtime:{id:'test-id',getURL:path=>'moz-extension://test/'+path,onMessage:{addListener:fn=>{listener=fn;}}}};
    dom.window.FarmExtractor.stableCapture = async () => { throw new dom.window.Error('All seven mastery sections must be loaded.'); };
    dom.window.eval(source('farm-content.js'));
    const result = await listener({type:'capture-active-page'},{id:'test-id',url:'moz-extension://test/_generated_background_page.html'});
    expect(result).toMatchObject({ok:false,error:'All seven mastery sections must be loaded.'});
    dom.window.close();
  });
});

describe('exact identity and hidden-page guards', () => {
  it('keeps legitimate trailing name digits rather than guessing they are Tower badges', () => {
    const dom = fixture(mastery().replace('Apple</strong>', 'Unknown Item 123</strong>'));
    expect(extract(dom).rows.find(row => row.targetTier === 100).itemName).toBe('Unknown Item 123');
    dom.window.close();
  });
  it('rejects a hidden page-current even when the document tab is visible', () => {
    const dom = fixture(inventory().replace('page page-current"', 'page page-current" style="display:none"'));
    expect(() => extract(dom)).toThrow(/hidden/);
    dom.window.close();
  });
  it('requires a string capture identity and exact quantities', () => {
    const dom = fixture(inventory());
    const capture = extract(dom);
    expect(() => dom.window.FarmCapture.validate({...capture,captureId:undefined})).toThrow(/identity/);
    expect(() => dom.window.FarmCapture.validate({...capture,rows:[{...capture.rows[0],count:-1}]})).toThrow(/quantity/);
    dom.window.close();
  });
});
