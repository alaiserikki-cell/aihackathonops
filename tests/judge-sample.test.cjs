const {test,before}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const E=require('../dist/engine.js'),JSZip=require('../dist/vendor/jszip.min.js');
let context={window:{},Engine:E};vm.runInNewContext(fs.readFileSync('dist/xlsx.js','utf8'),context);const importRows=context.window.WorkbookReader.importRows;
const stores=[['ST-01','Bengaluru','560001'],['ST-02','Bengaluru','560034'],['ST-03','Bengaluru','560038'],['ST-04','Bengaluru','560066'],['ST-05','Bengaluru','560076'],['ST-06','Mysuru','570009'],['ST-07','Mysuru','570017'],['ST-08','Mangaluru','575001'],['ST-09','Hubballi-Dharwad','580020'],['ST-10','Belagavi','590001']].map(([id,city,pin])=>({id,city,pin,year:2019}));

const unesc=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const texts=x=>[...x.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>unesc(m[1])).join('');
function readSheet(xml,shared){let rows=[];for(const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)){const r=Number(rm[1].match(/\br="(\d+)"/)[1]),values=[];
 for(const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){const attrs=cm[1],inner=cm[2]||'',ref=attrs.match(/\br="([A-Z]+)\d+"/)[1],t=(attrs.match(/\bt="(\w+)"/)||[])[1];let col=0;for(const ch of ref)col=col*26+ch.charCodeAt(0)-64;
  const v=(inner.match(/<v>([\s\S]*?)<\/v>/)||[])[1];values[col-1]=t==='s'?shared[Number(v)]:t==='inlineStr'?texts(inner):v===undefined?null:t==='str'?unesc(v):Number.isFinite(Number(v))?Number(v):unesc(v);}
 if(values.some(v=>v!==null&&v!==undefined&&v!==''))rows.push({row:r,values});}return rows;}

let imported,results,byId,dec;
before(async()=>{const z=await JSZip.loadAsync(fs.readFileSync('dist/sample-judge-test.xlsx'));const ssx=await z.file('xl/sharedStrings.xml').async('string');
 const shared=[...ssx.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>texts(m[1]));
 const sheets={Applications:readSheet(await z.file('xl/worksheets/sheet1.xml').async('string'),shared),Territories:readSheet(await z.file('xl/worksheets/sheet2.xml').async('string'),shared)};
 imported=importRows(sheets);results=E.assess(imported.apps,imported.territories,stores,E.benchmarks(imported.apps),E.defaultPolicy);
 byId=Object.fromEntries(results.map(r=>[r.id,r]));dec=id=>E.decision(byId[id]).label;});

test('imports 20 applications and 6 territories, excluding the row-3 example',()=>{a.equal(imported.apps.length,20);a.equal(imported.territories.length,6);a.ok(!imported.apps.some(x=>x.id==='APP-001'));a.ok(!imported.territories.some(t=>t.issues.length),'territories import cleanly');});
const expected={'APP-002':'Approve','APP-003':'Approve','APP-006':'Approve','APP-020':'Approve','APP-015':'Conditional',
 'APP-004':'Waitlist','APP-005':'Waitlist','APP-013':'Waitlist','APP-008':'Redirect',
 'APP-007':'Hold (needs site size)','APP-009':'Hold (needs confirmed investment)','APP-010':'Hold (needs feasible launch date)','APP-012':'Hold (needs a site)',
 'APP-016':'Hold (needs site confirmation)','APP-017':'Hold (needs experience)','APP-018':'Hold (needs actual floor)','APP-019':'Hold (needs confirmed investment)',
 'APP-011':'Not eligible','APP-014':'Not eligible','APP-021':'Not eligible'};
test('every applicant gets the expected decision label',()=>{a.equal(Object.keys(expected).length,20);for(const [id,label] of Object.entries(expected))a.equal(dec(id),label,id+': '+byId[id]?.primary);});
test('APP-015 is conditional on business history',()=>a.match(E.decision(byId['APP-015']).need,/business history/));
test('waitlists name the right constraint',()=>{a.match(byId['APP-004'].reasons.join(' '),/TER-02/);a.match(byId['APP-005'].reasons.join(' '),/560101/);a.match(byId['APP-005'].reasons.join(' '),/APP-002/);a.match(byId['APP-013'].reasons.join(' '),/TER-04/);});
test('APP-008 is redirected away from the ST-06 pin to open TER-01 pins',()=>{const r=byId['APP-008'];a.match(r.reasons.join(' '),/ST-06/);a.ok(r.reasons.some(x=>x.includes('Pins 570002 and 570008 in TER-01 (High priority) are open.')),r.reasons.join(' | '));});
test('APP-011 fails the investment minimum by ₹10 lakh',()=>{const t=byId['APP-011'].reasons.join(' ');a.match(t,/20/);a.match(t,/30/);a.match(t,/10 lakh/);});
test('APP-014 pin is outside any territory and APP-021 city has no territory',()=>{a.match(byId['APP-014'].reasons.join(' '),/580105/);a.match(byId['APP-021'].reasons.join(' '),/Tumakuru/);});
test('APP-009 rupee text proposes 25 lakh without silently accepting it',()=>{const r=byId['APP-009'];a.equal(r.investment,null);a.equal(r.pending[0].field,'investment');a.equal(r.pending[0].proposed,25);});
test('APP-019 "40 lakhs" text proposes 40 lakh pending confirmation',()=>{a.equal(byId['APP-019'].pending[0].proposed,40);});
test('open slots flag TER-05 Davanagere and leave one TER-01 slot',()=>{const o=E.openSlots(imported.territories,stores,results),f=id=>o.find(x=>x.id===id);a.equal(f('TER-05').flag,true);a.equal(f('TER-05').city,'Davanagere');a.equal(f('TER-05').recommended,0);a.equal(f('TER-01').open,1);});
