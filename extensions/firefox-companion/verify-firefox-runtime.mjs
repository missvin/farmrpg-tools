// Synthetic transport only. Run through verify-firefox-runtime.ps1 in an isolated profile.
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
const timer = setTimeout(() => { console.error('Isolated Firefox validation timed out'); socket.destroy(); process.exitCode = 1; }, 40000);
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
  const setup = await command('WebDriver:ExecuteAsyncScript',{script:`const done = arguments[arguments.length-1]; const capture = {schemaVersion:1,captureId:'firefox-transport-fixture',section:'inventory',scope:'full',sourceUrl:'https://farmrpg.com/index.php',observedAt:new Date().toISOString(),coverage:{activePage:true,settled:true,sections:[{id:'Everything',loaded:true,expectedRows:1}]},rows:[{itemName:'Steel',count:12,sectionId:'Everything'}]}; browser.storage.local.set({'companion-v1':{pairingKey:'ab'.repeat(32),captures:{inventory:capture},status:{state:'idle',message:'Synthetic transport fixture only'}}}).then(()=>done(true),e=>done({error:e.message}));`,args:[]});
  if (!setup.value) throw new Error('Could not seed isolated extension fixture');
  const newWindow = await command('WebDriver:NewWindow',{type:'tab'});
  const trackerHandle = (newWindow.value || newWindow).handle;
  await command('WebDriver:SwitchToWindow',{handle:trackerHandle});
  await command('WebDriver:Navigate',{url:'https://farmrpg-tools.vercel.app/'});
  await command('WebDriver:ExecuteScript',{script:`window.__transportEvidence = []; window.addEventListener('message', e => { if (e.data?.sender !== 'farmrpg-tools-firefox') return; window.__transportEvidence.push({ownSource:e.source===window,origin:e.origin}); const request=JSON.parse(e.data.body); window.postMessage({channel:'farmrpg-tools.capture',version:1,sender:'farmrpg-tools-tracker',type:'ack',requestId:request.requestId,state:'applied',message:'Synthetic transport acknowledgment, not a tracker save',receipt:{captureId:request.capture.captureId,section:request.capture.section,observedAt:request.capture.observedAt}},location.origin); }); return true;`,args:[]});
  await command('WebDriver:SwitchToWindow',{handle:popupHandle});
  const transfer = await command('WebDriver:ExecuteAsyncScript',{script:'const done=arguments[arguments.length-1]; browser.runtime.sendMessage({type:"retry",section:"inventory"}).then(done,e=>done({error:e.message}));',args:[],scriptTimeout:30000});
  console.log('Synthetic Firefox relay result:',JSON.stringify(transfer));
  await command('WebDriver:SwitchToWindow',{handle:trackerHandle});
  const evidence = await command('WebDriver:ExecuteScript',{script:'return window.__transportEvidence;',args:[]});
  console.log('Actual content-script to page event authority:',JSON.stringify(evidence));
  if (transfer.value?.status?.state !== 'applied' || !evidence.value?.[0]?.ownSource || evidence.value[0].origin !== 'https://farmrpg-tools.vercel.app') throw new Error('Actual Firefox relay/source/ack test failed');
  await command('Addon:Uninstall',{id:'farmrpg-planning-companion@missvin'});
  console.log('Temporary installation and popup/background messaging verified; no game account used.');
} catch(error) { console.error(error.message); process.exitCode=1; }
finally {
  try { await command('Marionette:Quit',{flags:['eForceQuit']}); } catch { /* Firefox closes the socket during quit. */ }
  clearTimeout(timer);
  socket.destroy();
}
