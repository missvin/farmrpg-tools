// Synthetic data through the real deployed receiver, only in a fresh isolated profile.
import net from 'node:net';
import {fileURLToPath} from 'node:url';
let buffer = Buffer.alloc(0), nextId = 0;
const pending = new Map();
const socket = net.connect(Number(process.argv[2]), '127.0.0.1');
socket.on('error', error => { for (const p of pending.values()) p.reject(error); });
socket.on('close', () => { for (const p of pending.values()) p.reject(new Error('Firefox socket closed')); pending.clear(); });
let greet;
const greeting = new Promise(done => { greet = done; });
socket.on('data', chunk => {
  buffer = Buffer.concat([buffer,chunk]);
  while (true) {
    const colon = buffer.indexOf(58);
    if (colon < 0) break;
    const size = Number(buffer.subarray(0,colon).toString());
    if (buffer.length < colon + 1 + size) break;
    const message = JSON.parse(buffer.subarray(colon+1,colon+1+size).toString());
    buffer = buffer.subarray(colon+1+size);
    if (!Array.isArray(message)) greet(message);
    else {
      const entry = pending.get(message[1]);
      if (entry) { pending.delete(message[1]); message[2] ? entry.reject(new Error(JSON.stringify(message[2]))) : entry.resolve(message[3]); }
    }
  }
});
function command(name,args={}) {
  const id = ++nextId;
  const data = Buffer.from(JSON.stringify([0,id,name,args]));
  const result = new Promise((resolve,reject) => { pending.set(id,{resolve,reject}); });
  socket.write(Buffer.concat([Buffer.from(data.length+':'), data]));
  return result;
}
const timer = setTimeout(() => { console.error('Isolated Firefox validation timed out'); socket.destroy(); process.exitCode = 1; }, 120000);
try {
  await greeting;
  await command('WebDriver:NewSession',{capabilities:{alwaysMatch:{acceptInsecureCerts:true}}});
  const addon = await command('Addon:Install',{path:fileURLToPath(new URL('../../local-data/firefox-companion/farmrpg-companion-test.xpi', import.meta.url)),temporary:true});
  console.log('Temporary installation:', JSON.stringify(addon));
  await command('Marionette:SetContext',{value:'chrome'});
  const policy = await command('WebDriver:ExecuteScript',{script:'const p = WebExtensionPolicy.getByID("farmrpg-planning-companion@missvin"); return {active: p.active, baseURL: p.getURL("")};',args:[]});
  console.log('Firefox extension policy:',JSON.stringify(policy));
  await command('Marionette:SetContext',{value:'content'});
  await command('WebDriver:Navigate',{url:policy.value.baseURL+'popup.html'});
  const status = await command('WebDriver:ExecuteAsyncScript',{script:'const done = arguments[arguments.length-1]; browser.runtime.sendMessage({type:"status"}).then(done, e=>done({error:e.message}));',args:[],scriptTimeout:5000});
  console.log('Popup to event-page status:',JSON.stringify(status));
  if (!status.value?.ok || typeof status.value.paired !== 'boolean') throw new Error('Popup/event-page handshake did not succeed');
  const popupHandle = (await command('WebDriver:GetWindowHandle')).value;
  const setup = await command('WebDriver:ExecuteAsyncScript',{script:`const done = arguments[arguments.length-1]; const capture = {schemaVersion:1,captureId:'firefox-transport-fixture',section:'inventory',scope:'full',sourceUrl:'https://farmrpg.com/index.php',observedAt:new Date().toISOString(),coverage:{activePage:true,settled:true,sections:[{id:'Inventory',loaded:true,expectedRows:1}]},rows:[{itemName:'Steel',count:12,sectionId:'Inventory'}]}; browser.storage.local.set({'companion-v1':{pairingKey:'ab'.repeat(32),captures:{inventory:capture},status:{state:'idle',message:'Synthetic transport fixture only'}}}).then(()=>done(true),e=>done({error:e.message}));`,args:[]});
  if (!setup.value) throw new Error('Could not seed isolated extension fixture');
  const paused = await command('WebDriver:ExecuteAsyncScript',{script:'const done=arguments[arguments.length-1]; browser.runtime.sendMessage({type:"set-paused",paused:true}).then(done,e=>done({error:e.message}));',args:[]});
  if (paused.value?.paused !== true) throw new Error('Persisted automatic-capture pause failed');
  const retry = async () => {
    await command('WebDriver:SwitchToWindow',{handle:popupHandle});
    const result = await command('WebDriver:ExecuteAsyncScript',{script:'const done=arguments[arguments.length-1]; browser.runtime.sendMessage({type:"retry",section:"inventory"}).then(done,e=>done({error:e.message}));',args:[]});
    return result.value;
  };
  const closed = await retry();
  if (closed?.status?.state !== 'waiting' || closed.lastAppliedAt) throw new Error('Closed tracker cache/retry check failed');
  console.log('Closed tracker: cached capture waits without claiming application.');
  const newWindow = await command('WebDriver:NewWindow',{type:'tab'});
  const trackerHandle = (newWindow.value || newWindow).handle;
  await command('WebDriver:SwitchToWindow',{handle:trackerHandle});
  await command('WebDriver:Navigate',{url:'https://farmrpg-tools.vercel.app/'});
  await command('WebDriver:ExecuteScript',{script:'localStorage.setItem("farmrpg-tools.capture-pairing.v1", "ab".repeat(32)); return true;',args:[]});
  await command('WebDriver:Refresh');
  await command('WebDriver:ExecuteScript',{script:`window.__transportEvidence = []; window.addEventListener('message', e => { if (e.data?.sender === 'farmrpg-tools-firefox') window.__transportEvidence.push({ownSource:e.source===window,origin:e.origin}); }); return true;`,args:[]});
  const transfer = await retry();
  console.log('Real deployed receiver result:',JSON.stringify(transfer));
  await command('WebDriver:SwitchToWindow',{handle:trackerHandle});
  const evidence = await command('WebDriver:ExecuteScript',{script:'return window.__transportEvidence;',args:[]});
  console.log('Actual content-script to page event authority:',JSON.stringify(evidence));
  if (transfer?.status?.state !== 'applied' || !evidence.value?.[0]?.ownSource || evidence.value[0].origin !== 'https://farmrpg-tools.vercel.app') throw new Error('Actual Firefox relay/source/ack test failed');
  await command('WebDriver:Refresh');
  const stored = await command('WebDriver:ExecuteScript',{script:'const state = JSON.parse(localStorage.getItem("farmrpg-tools.acquisitionPlannerState")); return {count:state?.inventory?.entries?.find(row=>row.itemName==="Steel")?.inventoryCount,captureId:state?.inventory?.observation?.captureId};',args:[]});
  if (stored.value?.count !== 12 || stored.value.captureId !== 'firefox-transport-fixture') throw new Error('Acknowledged inventory did not survive tracker reload');
  const duplicate = await retry();
  if (duplicate?.status?.state !== 'duplicate' || duplicate.lastAppliedAt !== transfer.lastAppliedAt) throw new Error('Duplicate retry incorrectly claimed a new application');
  console.log('Inventory persists after reload; duplicate retry retains the application timestamp.');
  await command('WebDriver:SwitchToWindow',{handle:trackerHandle});
  await command('WebDriver:ExecuteScript',{script:'localStorage.removeItem("farmrpg-tools.capture-pairing.v1"); return true;',args:[]});
  await command('WebDriver:Refresh');
  const revoked = await retry();
  if (!['waiting', 'rejected'].includes(revoked?.status?.state) || revoked.lastAppliedAt !== transfer.lastAppliedAt) throw new Error('Revoked pairing incorrectly claimed application');
  await command('WebDriver:SwitchToWindow',{handle:trackerHandle});
  await command('WebDriver:ExecuteScript',{script:'localStorage.setItem("farmrpg-tools.capture-pairing.v1", "cd".repeat(32)); return true;',args:[]});
  await command('WebDriver:Refresh');
  await command('WebDriver:SwitchToWindow',{handle:popupHandle});
  await command('WebDriver:ExecuteAsyncScript',{script:'const done=arguments[arguments.length-1]; browser.runtime.sendMessage({type:"pair",key:"cd".repeat(32)}).then(done,e=>done({error:e.message}));',args:[]});
  const repaired = await retry();
  if (repaired?.status?.state !== 'duplicate') throw new Error('Re-pairing failed to deliver the saved capture');
  const resumed = await command('WebDriver:ExecuteAsyncScript',{script:'const done=arguments[arguments.length-1]; browser.runtime.sendMessage({type:"set-paused",paused:false}).then(done,e=>done({error:e.message}));',args:[]});
  if (resumed.value?.paused !== false) throw new Error('Automatic-capture resume failed');
  console.log('Pause persists while manual retry works; resume restores automatic capture.');
  console.log('Disconnected tracker cannot confirm application; re-pairing delivers the cached capture without a second save.');
  await command('Addon:Uninstall',{id:'farmrpg-planning-companion@missvin'});
  console.log('Temporary install, real receiver, durable inventory, closed tracker, duplicate and pairing recovery verified; no game account used.');
} catch(error) { console.error(error.message); process.exitCode=1; }
finally {
  try { await command('Marionette:Quit',{flags:['eForceQuit']}); } catch { /* Firefox closes the socket during quit. */ }
  clearTimeout(timer);
  socket.destroy();
}
