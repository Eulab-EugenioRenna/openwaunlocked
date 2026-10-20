import { nativeInspectionSource } from './native-inspection.mjs';
// Read-only verification of current patch sources using isolated API objects. Never replaces WAPI.
import fs from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const sourcePath = process.env.DEV_PATCH_SOURCE_PATH ?? fileURLToPath(new URL('../patches/src/', import.meta.url));
import { createRequire } from 'node:module';
const requireApp = createRequire(new URL('./server.mjs', import.meta.url));
const puppeteer = createRequire(requireApp.resolve('@eulab/openwaunlocked-driver-puppeteer'))('puppeteer-core');
let browser, page;
for (const entry of fs.readdirSync('/tmp', { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const port = fs.readFileSync(`/tmp/${entry.name}/DevToolsActivePort`, 'utf8').split('\n')[0];
    const candidate = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, protocolTimeout: 10000 });
    const target = (await candidate.pages()).find(tab => tab.url().startsWith('https://web.whatsapp.com'));
    if (target) { browser = candidate; page = target; break; }
    candidate.disconnect();
  } catch {}
}
if (!page) throw new Error('No active development WhatsApp browser found.');
try {
  const runtime=fs.readFileSync(join(sourcePath,'runtime.js'),'utf8'),premium=fs.readFileSync(join(sourcePath,'premium.js'),'utf8');
  const values=await page.evaluate(nativeInspectionSource(runtime,premium));
  const {clientRegistry}=requireApp('@eulab/openwaunlocked-schema');
  for(const value of values){
    if(value.error){process.exitCode=1;console.log(JSON.stringify({method:value.method,ok:false,error:value.error.replace(/\d{7,}/g,'[redacted]')}));continue;}
    const parsed=await clientRegistry.resolve(value.method).meta.outputSchema.safeParseAsync(value.result);
    if(!parsed.success)process.exitCode=1;
    console.log(JSON.stringify({method:value.method,ok:true,outputSchema:parsed.success,...(Array.isArray(value.result)?{count:value.result.length}:{}),...(!parsed.success?{invalidFields:parsed.error.issues.slice(0,8).map(i=>({path:i.path,code:i.code}))}:{})}));
  }

} finally { browser.disconnect(); }
