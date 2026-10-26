(function(root){
'use strict';
const fields=['id','name','city','state','pin','investment','experience','business','space','area','floor','launch','language','notes'];
const numeric=['investment','experience','area','launch'];
const cities={'Bengaluru':['560','Tier 1'],'Mysuru':['570','Tier 2'],'Mangaluru':['575','Tier 2'],'Hubballi-Dharwad':['580','Tier 2'],'Belagavi':['590','Tier 2'],'Tumakuru':['572','Tier 3'],'Davanagere':['577','Tier 3']};
const labels={id:'Application ID',name:'Applicant name',city:'City',state:'State',pin:'Pin code',investment:'Investment capacity (₹ lakh)',experience:'Retail experience (years)',business:'Current / past business',space:'Space available',area:'Space size (sq ft)',floor:'Floor',launch:'Target launch (months)',language:'Preferred language',notes:'Notes from applicant'};
function parseNumber(field,input){
 if(input===null||input===undefined||String(input).trim()==='')return {value:null,proposed:null,reason:'Missing value'};
 if(typeof input==='number')return Number.isFinite(input)&&input>=0?{value:input}:{value:null,proposed:null,reason:'Use a non-negative finite number'};
 let text=String(input).trim(),clean=text.replace(/,/g,'').trim();
 if(/^\d+(\.\d+)?$/.test(text)&&Number.isFinite(Number(text)))return {value:Number(text)};
 let m,proposed=null,reason='Confirm the value and its units';
 if(field==='investment'){
  m=clean.match(/^(?:(₹|rs\.?|inr)\s*)?(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|l|crores?|cr|rupees?|inr|rs\.?)?$/i);
  if(m){let n=Number(m[2]),unit=(m[3]||'').toLowerCase();proposed=/^(crore|cr)/.test(unit)?n*100:/^(lakh|lac|l$)/.test(unit)?n:m[1]||/^(rupee|inr|rs)/.test(unit)?n/100000:n;reason='Confirm amount in lakh';}
 }else{const units={area:'sq\\.?\\s*ft\\.?|sqft|square feet',experience:'years?|yrs?',launch:'months?|mos?'};m=clean.match(new RegExp('^(\\d+(?:\\.\\d+)?)\\s*(?:'+units[field]+')?$','i'));if(m){proposed=Number(m[1]);reason='Confirm '+labels[field];}}
 if(!Number.isFinite(proposed)||proposed<0)proposed=null;return {value:null,proposed,reason};
}
function normalize(raw,key){const r={key,raw:{...raw},pending:[],...Object.fromEntries(fields.map(f=>[f,null]))};
for(const f of fields){let v=raw[f];if(v===null||v===undefined||String(v).trim()==='')continue;
 if(numeric.includes(f)){let p=parseNumber(f,v);r[f]=p.value;if(p.value===null)r.pending.push({field:f,raw:v,proposed:p.proposed,reason:p.reason});}
 else{let v2=String(v).trim();if(f==='pin'&&/^\d{6}(\.0)?$/.test(v2))v2=String(Number(v2));r[f]=v2;}}
return r;}
function percentile(v,values){let a=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!Number.isFinite(v)||a.length<5||new Set(a).size<2)return null;
 let groups=[];for(let i=0;i<a.length;){let j=i;while(j+1<a.length&&a[j+1]===a[i])j++;groups.push({value:a[i],rank:(i+j)/2/(a.length-1)});i=j+1;}
 let equal=groups.find(g=>g.value===v);if(equal)return equal.rank;if(v<groups[0].value)return 0;if(v>groups.at(-1).value)return 1;
 for(let i=1;i<groups.length;i++)if(v<groups[i].value){let l=groups[i-1],h=groups[i];return l.rank+(v-l.value)/(h.value-l.value)*(h.rank-l.rank);}return 1;
}
function band(p){return p===null?null:p>=.9?3:p>=.5?2:p>=.3?1:0;}
function benchmarks(apps){let counts=Object.create(null);for(let a of apps){let id=String(a.id||'').trim().toUpperCase();counts[id]=(counts[id]||0)+1;}apps=apps.filter(a=>a.id&&counts[String(a.id).trim().toUpperCase()]===1&&cities[a.city]);let all={},tiers={};for(let f of numeric)all[f]=apps.map(a=>a[f]).filter(Number.isFinite);for(let tier of ['Tier 1','Tier 2','Tier 3']){tiers[tier]={};for(let f of numeric)tiers[tier][f]=apps.filter(a=>cities[a.city]?.[1]===tier).map(a=>a[f]).filter(Number.isFinite);}return {all,tiers};}
function businessPoints(s){if(!s)return null;
if(/^(?:no|none|na|n\/a|nil|not applicable)\b|\bno (?:previous |prior )?business\b|\bnever (?:owned|run)\b|first.time entrepreneur|only (?:an? )?employee|\b(?:do not|don't|never)\s+(?:own|run|operate)(?:\s+\w+){0,3}\s+(?:business|shop|store)\b/i.test(s))return 0;
if(/\b(?:father|mother|brother|sister|spouse|family|friend)\b/i.test(s)&&! /\bI (?:own|run|operate|founded)|\bmy (?:own |previous |past )?(?:business|shop|store)\b/i.test(s))return null;
return /\b(?:runs?|ran|owns?|owned|founded|operat(?:es?|ed|ing))\b.{0,45}\b(?:shop|store|business|retail|outlet|restaurant|cafe|agency|company|firm|enterprise)\b|\bbusiness owner|\bproprietor|\bself.employed/i.test(s)?1:null;}
function territoryCapacity(territories,stores=[]){let occupied=new Set(stores.map(s=>String(s.pin))),byTerritory={};let total=0;for(let t of territories){let valid=Array.isArray(t.pins)&&!t.issues?.length&&t.city in cities&&t.state==='Karnataka'&&Number.isInteger(t.slots)&&t.slots>=0&&territories.filter(x=>x.id===t.id).length===1;let pins=valid?[...new Set(t.pins)].filter(p=>/^\d{6}$/.test(p)&&p.startsWith(cities[t.city][0])&&!occupied.has(p)&&territories.filter(x=>x.pins?.includes(p)).length===1):[];let available=valid?Math.min(t.slots,pins.length):0;Object.defineProperty(byTerritory,t.id,{value:available,enumerable:true,configurable:true});total+=available;}return {total,byTerritory};}
const priorityOrder={High:0,Medium:1,Low:2};
function priorityRank(p){return priorityOrder[p]??3;}
// Open capacity per territory, High priority first. A High territory with unfilled slots is flagged.
function openSlots(territories,stores,results){let cap=territoryCapacity(territories,stores).byTerritory;return territories.map(t=>{let available=cap[t.id]||0,recommended=results.filter(a=>a.status==='Recommended'&&a.territory===t.id).length,open=Math.max(available-recommended,0);return {id:t.id,city:t.city,priority:t.priority||'Unknown',slots:t.slots,available,recommended,open,flag:t.priority==='High'&&open>0,issues:t.issues||[]};}).sort((a,b)=>priorityRank(a.priority)-priorityRank(b.priority)||b.open-a.open||String(a.id).localeCompare(String(b.id)));}
// Onboarding and launch sequence: territory priority, then sooner launch, then score, then ID.
function onboardingOrder(results,territories){let pr=a=>priorityRank(territories.find(t=>t.id===a.territory)?.priority);return results.filter(a=>a.status==='Recommended').sort((a,b)=>pr(a)-pr(b)||(Number.isFinite(a.launch)?a.launch:Infinity)-(Number.isFinite(b.launch)?b.launch:Infinity)||b.score-a.score||String(a.id).localeCompare(String(b.id)));}
function policyErrors(p){let errors=[];
 if(p.weights!==undefined){let w=weightsOf(p),sum=Object.values(w).reduce((a,b)=>a+b,0);if(typeof p.weights!=='object'||Object.keys(defaultWeights).some(k=>!(Number(p.weights[k])>=0)))errors.push('Each weight must be zero or more.');else if(Math.abs(sum-100)>0.01)errors.push(`Weights must add up to 100 (now ${num(sum)}).`);}
 for(let [group,keys] of [['tiers',['Tier 1','Tier 2','Tier 3']],['cities',Object.keys(cities)]])if(p[group]!==undefined){if(!p[group]||typeof p[group]!=='object'||Array.isArray(p[group])){errors.push('Invalid '+group+' rules.');continue;}for(let [k,o] of Object.entries(p[group])){if(!keys.includes(k)||!o||typeof o!=='object'){errors.push('Unknown geography: '+k+'.');continue;}for(let f of ['minInvestment','minArea'])if(has(o[f])&&!(Number(o[f])>0))errors.push(`${k}: ${f==='minInvestment'?'investment':'area'} rule must be a positive number or blank.`);}}
 if(p.acceptFloors!==undefined&&(!Array.isArray(p.acceptFloors)||p.acceptFloors.some(x=>!optionalFloors.includes(x))))errors.push('Accepted floors can only be Upper or Mall unit.');for(let f of ['minInvestment','minArea','minLaunch','targetLaunch'])if(!(Number(p[f])>0)||!Number.isFinite(Number(p[f])))errors.push(labels[f]||f);if(Number(p.targetLaunch)<Number(p.minLaunch))errors.push('Target latest launch must be at least the minimum feasible launch.');return errors;}
const defaultPolicy={model:'industry-v2',minInvestment:30,minArea:400,minLaunch:3,targetLaunch:6};
const num=n=>String(+Number(n).toFixed(2)),lakh=n=>'₹'+num(n)+' lakh',clip=s=>{s=String(s).replace(/\s+/g,' ').trim();return s.length>80?s.slice(0,77)+'...':s;};
const has=v=>v!==''&&v!=null;
// Editable decision rules. Geography: a city rule beats a tier rule, which beats the base rule. Weights must add up to 100.
const defaultWeights={funds:35,premises:30,operator:25,launch:10},optionalFloors=['Upper','Mall unit'];
function policyFor(a,s={}){let p={minInvestment:s.minInvestment,minArea:s.minArea,minLaunch:s.minLaunch,targetLaunch:s.targetLaunch,scope:{}},tier=cities[a.city]?.[1];
 for(let [src,key] of [[s.tiers,tier],[s.cities,a.city]]){let o=key&&src&&typeof src==='object'?src[key]:null;if(o&&typeof o==='object')for(let f of ['minInvestment','minArea'])if(has(o[f])&&Number(o[f])>0){p[f]=Number(o[f]);p.scope[f]=key;}}return p;}
function weightsOf(s={}){let w={...defaultWeights};if(s.weights&&typeof s.weights==='object')for(let k of Object.keys(defaultWeights))if(has(s.weights[k])&&Number(s.weights[k])>=0)w[k]=Number(s.weights[k]);return w;}
// Ground, First and Other confirmed always count as a known floor; Upper and Mall unit only when the brand accepts them.
function floorOK(a,s={}){return ['Ground','First','Other confirmed'].includes(a.floor)||(Array.isArray(s.acceptFloors)&&optionalFloors.includes(a.floor)&&s.acceptFloors.includes(a.floor));}
const forScope=(p,f)=>p.scope[f]?' for '+p.scope[f]:'';
// Applicant-level gates that do not depend on location: site, brand minimums, launch timing. Each text names field, value, requirement, gap and what unblocks it.
function personalGaps(a,settings){let g=[],p=policyFor(a,settings),minArea=has(p.minArea)?Number(p.minArea):null,minInv=has(p.minInvestment)?Number(p.minInvestment):null,minLaunch=has(settings.minLaunch)?Number(settings.minLaunch):null;
 let site=[];if(a.space==='Not yet identified')site.push('space is Not yet identified');else if(!a.area)site.push(`space is ${a.space||'blank'} but size is ${a.area===0?'0 sq ft':'blank'}`);
 if(!floorOK(a,settings))site.push(`floor is "${a.floor||'blank'}", which does not say which floor`);
 if(site.length)g.push({status:'Site needed',text:`Site not confirmed: ${site.join('; ')}. Unblocks when the applicant confirms an owned or rented site${minArea?' of at least '+num(minArea)+' sq ft':''} and its actual floor.`});
 else{let short=[];if(minInv!==null&&a.investment<minInv)short.push(`Investment ${lakh(a.investment)} vs ${lakh(minInv)} required${forScope(p,'minInvestment')} (gap ${lakh(minInv-a.investment)}). Unblocks if confirmed funds reach ${lakh(minInv)}.`);
  if(minArea!==null&&a.area<minArea)short.push(`Space ${num(a.area)} sq ft vs ${num(minArea)} sq ft required${forScope(p,'minArea')} (gap ${num(minArea-a.area)} sq ft). Unblocks with a site of at least ${num(minArea)} sq ft.`);
  if(short.length)g.push({status:'Requirements not met',text:short.join(' ')});}
 if(!g.length&&minLaunch!==null&&(!Number.isFinite(a.launch)||a.launch<minLaunch)){let m=n=>num(n)+' month'+(Number(n)===1?'':'s');g.push({status:'Timeline review',text:Number.isFinite(a.launch)?`Target launch ${m(a.launch)} vs ${m(minLaunch)} minimum preparation (gap ${m(minLaunch-a.launch)}). Unblocks if the launch target moves to ${m(minLaunch)} or later.`:`Target launch is blank; the minimum preparation time is ${m(minLaunch)}. Unblocks when a launch of ${m(minLaunch)} or later is agreed.`});}
 return g;}

// Up to 2 open pins in the same city: territory has a free slot, pin has no existing or recommended store. Suggestion only.
function redirectOptions(a,out,territories,stores){let cap=territoryCapacity(territories,stores).byTerritory,rec=out.filter(r=>r.status==='Recommended'),taken=new Set([...stores.map(s=>String(s.pin)),...rec.map(r=>r.pin)]),options=[];
for(let t of territories.filter(t=>t.city===a.city&&(cap[t.id]||0)-rec.filter(r=>r.territory===t.id).length>0).sort((x,y)=>priorityRank(x.priority)-priorityRank(y.priority)||(y.id===a.territory)-(x.id===a.territory)||String(x.id).localeCompare(String(y.id))))
 for(let p of [...new Set(t.pins)].sort())if(options.length<2&&p!==a.pin&&/^\d{6}$/.test(p)&&!taken.has(p)&&territories.filter(x=>x.pins?.includes(p)).length===1)options.push({pin:p,territory:t.id,priority:t.priority||'Unknown'});return options;}
function redirectText(options){let groups=[];for(let o of options){let g=groups.find(g=>g.territory===o.territory);if(g)g.pins.push(o.pin);else groups.push({territory:o.territory,priority:o.priority,pins:[o.pin]});}
return groups.map(g=>(g.pins.length>1?'Pins '+g.pins.join(' and '):'Pin '+g.pins[0])+' in '+g.territory+' ('+g.priority+' priority)').join('; ')+(options.length>1?' are':' is')+' open. Suggestion only: the applicant must agree and confirm a site there.';}
function assess(apps,territories,stores,reference,settings={}){let v2=settings.model==='industry-v2';let idCounts=Object.create(null);apps.forEach(a=>{let id=String(a.id||'').trim().toUpperCase();idCounts[id]=(idCounts[id]||0)+1;});let out=apps.map(a=>{let reasons=[],missing=[],components=[],tier=cities[a.city]?.[1],pending=a.pending||[];
const comp=(key,points,max,weight,detail)=>{components.push({key,label:labels[key]||key,points,max,weight,contribution:points===null?0:points/max*weight,detail});};
if(v2){
 let pol=policyFor(a,settings),w=weightsOf(settings),budget=Number(pol.minInvestment),areaMin=Number(pol.minArea),minTime=Number(settings.minLaunch),target=Number(settings.targetLaunch);
 comp('investment',Number.isFinite(a.investment)&&budget>0?Math.min(a.investment/budget,1):null,1,w.funds,`Declared funds / illustrative requirement ₹${budget||'?'} lakh, capped at 100%; funds not verified`);
 comp('space',a.space==='Owned'||a.space==='Rented'?1:a.space==='Not yet identified'?0:null,1,w.premises/2,`Identified premises ${num(w.premises/2)};`+' owned and rented receive equal points; legal control still needs verification');
 comp('area',Number.isFinite(a.area)&&areaMin>0?Math.min(a.area/areaMin,1):null,1,w.premises/2,`Area / configured minimum ${areaMin||'?'} sq ft, capped at 100%; bigger is not automatically better`);
 comp('experience',a.experience===null?null:a.experience===0?0:a.experience<1?1:a.experience<3?2:a.experience<5?3:4,4,w.operator*0.8,'Proposed anchors: 0 years 0; under 1 year 5; 1–under 3 years 10; 3–under 5 years 15; 5+ years 20');
 comp('business',businessPoints(a.business),1,w.operator*0.2,`Explicit prior operation or ownership ${num(w.operator*0.2)};`+' none 0; unclear remains unknown');
 comp('launch',Number.isFinite(a.launch)&&minTime>0&&target>=minTime?(a.launch<minTime?0:a.launch<=target?2:1):null,2,w.launch,`Illustrative feasible window ${minTime||'?'}–${target||'?'} months: 10; later 5; too soon 0 and timeline review`);
}else{
for(let [f,w] of [['investment',22.5],['area',22.5],['experience',15],['launch',10]]){let local=reference?.tiers?.[tier]?.[f], vals=local?.length>=5&&new Set(local).size>=2?local:reference?.all?.[f]||reference?.[f]||[];let p=percentile(a[f],vals);let pts=band(p===null?null:f==='launch'?1-p:p);if(a[f]===0&&f!=='launch')pts=0;comp(f,pts,3,w,p===null?'Insufficient reference data or missing value':`${Math.round(p*100)}th percentile${f==='launch'?' · fewer months scores higher':''} · ${local===vals?tier:'whole upload'}`);}
comp('space',a.space==='Owned'?2:a.space==='Rented'?1:a.space==='Not yet identified'?0:null,2,15,'Owned 2 · rented 1 · no space 0');
comp('floor',a.floor==='Ground'?2:a.floor==='First'?1:a.floor==='Other confirmed'?0:null,2,10,'Ground 2 · confirmed first 1 · other confirmed 0');
comp('business',businessPoints(a.business),1,5,'Awarded for explicit evidence of running or owning a business');
}
let score=components.reduce((s,c)=>s+c.contribution,0),high=score+components.filter(c=>c.points===null).reduce((s,c)=>s+c.weight,0);
for(let f of ['id','name','city','state','pin','investment','experience','space'])if(a[f]===null||a[f]===undefined||a[f]==='')missing.push(labels[f]);
let idCount=a.id?idCounts[String(a.id).trim().toUpperCase()]:0,note=String(a.notes||''),floorGiven=['Ground','First'].includes(a.floor);
if(idCount>1)reasons.push(`Application ID ${a.id} appears ${idCount} times in this upload. Unblocks when each record has its own ID.`);
if(a.city&&!cities[a.city])reasons.push(`City "${a.city}" is not one of the 7 supported cities (${Object.keys(cities).join(', ')}). Unblocks when the city is corrected.`);
if(a.state&&a.state!=='Karnataka')reasons.push(`State "${a.state}" vs Karnataka required. Unblocks when the state is Karnataka.`);
if(a.pin&&!/^\d{6}$/.test(a.pin))reasons.push(`Pin code "${a.pin}" is not 6 digits. Unblocks when a valid pin is given.`);
else if(a.pin&&cities[a.city]&&!a.pin.startsWith(cities[a.city][0]))reasons.push(`Pin ${a.pin} does not match ${a.city} (${a.city} pins start with ${cities[a.city][0]}). Unblocks when the pin and city agree.`);
if(a.space&&!['Owned','Rented','Not yet identified'].includes(a.space))reasons.push(`Space available "${a.space}" is not Owned, Rented or Not yet identified. Unblocks when the applicant picks one.`);
if(a.language&&!['Kannada','English','Hindi'].includes(a.language))reasons.push(`Preferred language "${a.language}" is not Kannada, English or Hindi. Unblocks when a training language is confirmed.`);
if(a.space!=='Not yet identified'&&/still (searching|looking)|not (yet )?(found|identified)|no (shop|space|premises)/i.test(note))reasons.push(`Space is "${a.space||'blank'}" but notes say "${clip(note)}". Unblocks when the applicant confirms whether a site exists.`);
if(a.floor==='Ground'&&/\b(?:shop|space|premises|unit)\b.{0,30}\b(?:first|upper|second)[ -]floor\b/i.test(note))reasons.push(`Floor is Ground but notes say "${clip(note)}". Unblocks when the actual floor is confirmed.`);
if(a.space==='Not yet identified'&&(a.area>0||floorGiven))reasons.push(`Space is "Not yet identified" but ${[a.area>0?`size ${a.area} sq ft`:'',floorGiven?`floor ${a.floor}`:''].filter(Boolean).join(' and ')} ${a.area>0&&floorGiven?'are':'is'} given. Unblocks when the applicant confirms whether a site exists and whether it is owned or rented.`);
for(let p of pending)reasons.push(`${labels[p.field]} written as "${p.raw}"${p.proposed!==null?`; proposed reading ${p.proposed}${p.field==='investment'?' lakh':''}`:'; no safe reading'}. Unblocks when the value is confirmed in Data review.`);
if(missing.length)reasons.push(`Missing: ${missing.join(', ')}. Unblocks when ${missing.length>1?'these are':'this is'} provided.`);
const matches=territories.filter(t=>t.pins?.includes(a.pin));let t=matches.length===1?matches[0]:null,status='Eligible',uncovered=false;
let policyOK=!v2||(Number(settings.minInvestment)>0&&Number(settings.minArea)>0&&Number(settings.minLaunch)>0&&Number(settings.targetLaunch)>=Number(settings.minLaunch));
let gaps=personalGaps(a,settings),store=stores.find(s=>String(s.pin)===a.pin);
if(reasons.length)status='Clarification needed';
else if(store){status='Location unavailable';reasons.push(`Pin ${a.pin} already has a store${store.id?' ('+store.id+')':''}. The brand never opens two stores in one pin. Unblocks if the applicant moves to an open pin.`);}
else if(!t||matches.length>1){status='Territory review';uncovered=!matches.length;let inCity=territories.filter(x=>x.city===a.city).map(x=>x.id);reasons.push(matches.length>1?`Pin ${a.pin} is in ${matches.map(x=>x.id).join(' and ')}. Unblocks when the brand assigns it to one territory.`:`Pin ${a.pin} is not in any uploaded territory${inCity.length?' ('+a.city+' territories: '+inCity.join(', ')+')':' and no territory covers '+(a.city||'this city')}. Unblocks if the brand adds this pin to a territory or the applicant moves to a covered pin.`);}
else if(t.issues?.length||t.city!==a.city||t.state!==a.state||!Number.isInteger(t.slots)||t.slots<0){status='Territory review';let problems=[...(t.issues||[])];if(t.city!==a.city)problems.push(`territory city ${t.city} vs application city ${a.city}`);if(t.state!==a.state)problems.push(`territory state ${t.state} vs ${a.state}`);if(!(Number.isInteger(t.slots)&&t.slots>=0)&&!problems.includes('Invalid open slots'))problems.push(`open slots "${t.slots??'blank'}"`);reasons.push(`Territory ${t.id} cannot allocate: ${problems.join('; ')}. Unblocks when the brand fixes this territory row.`);}
else if(!policyOK){status='Policy needed';reasons.push('Configure a positive investment requirement, area minimum and feasible launch window before allocating. These are brand assumptions, not universal standards.');}
else if(gaps.length){status=gaps[0].status;reasons.push(gaps[0].text);}
let primary=status==='Eligible'?null:status==='Clarification needed'?reasons[0]:reasons[reasons.length-1];
if(['Location unavailable','Territory review'].includes(status)&&policyOK)for(let g of gaps)reasons.push('Also: '+g.text);
return {...a,tier,uncovered,primary,gaps:gaps.map(g=>g.status),model:v2?'industry-v2':'legacy',grade:v2?(components.some(c=>c.points===null)?'U':score>=80?'A':score>=65?'B':score>=50?'C':'D'):null,territory:t?.id||null,components,score:+score.toFixed(1),high:+high.toFixed(1),status,reasons,missing};});
let usedPins=new Set(stores.map(s=>String(s.pin))),counts=Object.create(null),pinWinner=Object.create(null),allocated=Object.create(null);let candidates=out.filter(a=>a.status==='Eligible').sort((a,b)=>b.score-a.score||(Number.isFinite(a.launch)?a.launch:Infinity)-(Number.isFinite(b.launch)?b.launch:Infinity)||String(a.id).localeCompare(String(b.id))||a.key.localeCompare(b.key));
let s=settings,gates=a=>{let p=policyFor(a,s);return v2?`investment ${lakh(a.investment)} vs ${lakh(p.minInvestment)} required${forScope(p,'minInvestment')}, ${num(a.area)} sq ft vs ${num(p.minArea)} sq ft${forScope(p,'minArea')}, launch ${num(a.launch)} months within the ${num(s.minLaunch)} to ${num(s.targetLaunch)} month window`:'data, site, pin and territory checks pass';};
for(let a of candidates){let t=territories.find(t=>t.id===a.territory),pr=(t.priority||'Unknown')+' priority';if(usedPins.has(a.pin)){let w=pinWinner[a.pin];a.status='Waitlisted';a.reasons.push(`Pin ${a.pin} is provisionally allocated to ${w.id} (score ${w.score} vs ${a.score}${w.score===a.score?', tie broken by sooner launch then ID':''}). One store per pin. Unblocks if ${w.id} drops out.`);}else if((counts[t.id]||0)>=t.slots){let held=allocated[t.id]||[];a.status='Waitlisted';a.reasons.push(held.length?`${t.id} (${pr}) has ${t.slots} slot${t.slots===1?'':'s'}, all provisionally allocated: ${held.map(w=>w.id+' ('+w.score+')').join(', ')}. Lowest allocated score ${Math.min(...held.map(w=>w.score))} vs ${a.score}. Unblocks if a slot opens or the brand adds one.`:`${t.id} (${pr}) has 0 open slots. Unblocks if the brand opens a slot here.`);}else{a.status='Recommended';usedPins.add(a.pin);pinWinner[a.pin]=a;counts[t.id]=(counts[t.id]||0)+1;(allocated[t.id]??=[]).push(a);a.reasons.push(`Meets every gate: ${gates(a)}. Ranked ${counts[t.id]} of ${t.slots} slot${t.slots===1?'':'s'} in ${t.id} (${pr}). Declared funds and site still need verification; this is not final approval.`);}}
for(let a of candidates)a.primary=a.reasons[a.reasons.length-1];
for(let a of out)if((a.status==='Waitlisted'||(a.status==='Location unavailable'&&!a.gaps.length)||(a.status==='Territory review'&&a.uncovered&&!a.gaps.length))&&a.city in cities){let options=redirectOptions(a,out,territories,stores);if(options.length){a.redirect=options;a.redirectText=redirectText(options);a.reasons.push(a.redirectText);}else if(a.status!=='Waitlisted')a.reasons.push(`No open pin with a free slot in ${a.city} right now.`);}
return out;}
function parseUpdate(text,apps){
 let t=String(text).trim(),lower=t.toLowerCase();
 const mentioned=apps.filter(a=>a.id&&new RegExp('(^|[^a-z0-9_-])'+String(a.id).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^a-z0-9_-])','i').test(t));
 let ids=[...new Set(mentioned.map(a=>a.id.toUpperCase()))];if(ids.length!==1||mentioned.length!==1)return {error:ids.length>1?'Please update one applicant at a time, or ask me to compare them.':mentioned.length?'Resolve duplicate application IDs first.':'Include a unique application ID, for example APP-012.'};
 let a=mentioned[0],hypothetical=/\bwhat if\b|\bsuppose\b|\bhypothetical\b/i.test(t),patch={};
 if(!hypothetical&&(/^(?:why|explain|what|how|is|does|can|which|who|where|when)\b/i.test(t)||/\?$/.test(t)))return {explain:true,key:a.key};
 let body=t.replace(new RegExp(String(a.id).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig'),'').trim();
 if((body.match(/\b(?:investment(?:\s+capacity)?|budget|capacity|invest)\b/gi)||[]).length>1||(body.match(/\d[\d,]*(?:\.\d+)?\s*(?:lakhs?|crores?|rupees?)\b/gi)||[]).length>1)return {error:'More than one investment amount was mentioned. Confirm one current usable amount.'};
 if(/(?:^|\s)[−-]\s*\d|\d\s*(?:[-–—]|to)\s*\d|\b(?:about|around|approximately|maybe|roughly|or|possibly|not|isn't|isnt|doesn't|don't|no longer)\b/i.test(body))return {error:'This statement is negative, approximate or ambiguous. Please give one confirmed non-negative value for each field. I have not changed anything.'};
 if(/\bground[ -]floor\b/i.test(body))patch.floor='Ground';if(/\bfirst[ -]floor\b/i.test(body)){if(patch.floor)return {error:'Two floors were mentioned. Confirm the actual floor.'};patch.floor='First';}
 if(/\b(?:upper|second|third)[ -]floor\b/i.test(body))return {error:'Please confirm the actual floor in Edit application. Upper does not necessarily mean first floor.'};
 if(/\b(?:owned|owns|own)\b/i.test(body))patch.space='Owned';if(/\b(?:rented|renting|leased|on rent|for rent|on lease|rental)\b/i.test(body)){if(patch.space)return {error:'Both ownership and rental were mentioned. Which applies to this site?'};patch.space='Rented';}
 let inv=body.match(/\b(?:investment|invest|capacity|budget)\b(?:\s+(?:capacity|is|to|of|now|has|can|increased|available))*\s*[:=]?\s*((?:₹|rs\.?|inr)?\s*\d[\d,]*(?:\.\d+)?\s*(?:lakhs?|lacs?|l\b|crores?|cr\b|rupees?|inr|rs\.?)?)/i);
 if(inv&&/^\s*(?:sq\.?\s*ft|sqft|square feet|months?|years?)\b/i.test(body.slice(inv.index+inv[0].length)))return {error:'That unit does not describe investment. Confirm the investment in lakh or rupees.'};
 if(inv){let p=parseNumber('investment',inv[1]);patch.investment=p.value??p.proposed;if(patch.investment===null)return {error:'Confirm the investment amount and units, for example 25 lakh or ₹25,00,000.'};}
 let areaValues=[...body.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|sqft|square feet)\b/gi)];if(areaValues.length>1)return {error:'More than one area was mentioned. Confirm one usable site area.'};if(areaValues[0])patch.area=Number(areaValues[0][1].replace(/,/g,''));
 let launchValue=body.match(/\b(?:launch|open|opening)(?:\s+(?:is|in|to|now|target|time|of))*\s*[:=]?\s*(\d+(?:\.\d+)?)\s*months?\b/i);if(launchValue)patch.launch=Number(launchValue[1]);else if(!/\b(?:lease|loan|term|rent|agreement|tenure)\b/i.test(body)&&!(/\b(?:launch|open|opening)\b/i.test(body))){let vals=[...body.matchAll(/(\d+(?:\.\d+)?)\s*months?\b/gi)];if(vals.length===1)patch.launch=Number(vals[0][1]);}
 let experienceValue=body.match(/\bexperience(?:\s+(?:is|of|now|to|has))*\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i)||body.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:of\s+)?(?:retail\s+)?experience\b/i);if(experienceValue)patch.experience=Number(experienceValue[1]);else if(!/\b(?:lease|loan|term|rent|agreement|tenure|experience)\b/i.test(body)){let vals=[...body.matchAll(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/gi)];if(vals.length===1)patch.experience=Number(vals[0][1]);}

 let area=body.match(/\barea\s*(?:(?:is|to|of|now)\s*)?[:=]?\s*(\d[\d,]*(?:\.\d+)?)(?:\s*(sq\.?\s*ft\.?|sqft|square feet))?\s*(?=$|[,.!?])/i);if(area&&!('area'in patch))patch.area=Number(area[1].replace(/,/g,''));
 if(/\b(?:launch|open|opening)\b/i.test(body)&&!('launch'in patch))return {error:'Confirm launch time in months.'};
 if(/\bexperience\b/i.test(body)&&!('experience'in patch))return {error:'Confirm experience in years.'};
 if(/\barea\b/i.test(body)&&!('area'in patch))return {error:'Confirm the area in square feet; no part of this update has been applied.'};
 let pin=body.match(/\bpin(?:\s+code)?\s*(?:(?:is|to|now)\s*)?[:=]?\s*(\d{6})\b/i);if(pin)patch.pin=pin[1];
 for(let lang of ['English','Kannada','Hindi'])if(new RegExp('\\b'+lang+'\\b','i').test(body))patch.language=lang;
 let siteFound=/\b(?:found|got|secured|identified|located|finali[sz]ed)\b.{0,50}\b(?:space|shop|site|premises|unit|place|store)\b/i.test(body);
 if(!Object.keys(patch).length&&!siteFound)return {error:'Please give a specific confirmed update, such as investment is 25 lakh, area is 500 sq ft, launch in 3 months, experience is 4 years, rented, ground floor, pin code or training language. I have not changed anything.'};
 if(/\b(?:investment|budget|capacity|invest)\b/i.test(body)&&!('investment'in patch))return {error:'The investment amount is unclear. Please give a number with lakh or rupee units.'};
 if(/\b(?:sq metres?|square met(?:er|re)s?|sqm)\b/i.test(body))return {error:'Please give the confirmed area in square feet. I have not converted or applied this update.'};
 const entries=Object.entries(patch);return {key:a.key,id:a.id,patch,hypothetical,siteFound,...(entries.length===1?{field:entries[0][0],value:entries[0][1]}:{})};
}
function invalidateTasks(tasks,patch){let start=7;if(['id','name','investment'].some(k=>k in patch))start=0;else if(['city','state','pin','space','area','floor','launch','notes'].some(k=>k in patch))start=1;else if(['language','experience','business'].some(k=>k in patch))start=5;let next={...tasks};for(let i=start;i<7;i++)next[i]=false;return next;}
function validState(s){try{
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x), str=x=>typeof x==='string', num=x=>Number.isFinite(x)&&x>=0;
if(s.messages!==undefined&&(!Array.isArray(s.messages)||s.messages.length>100||s.messages.some(m=>!obj(m)||!str(m.text)||(m.user!==undefined&&typeof m.user!=='boolean'))))return false;
if(s.botContext!==undefined&&s.botContext!==null&&!str(s.botContext))return false;
if(!obj(s)||!str(s.source)||!Array.isArray(s.apps)||s.apps.length>20000||!Array.isArray(s.territories)||!obj(s.reference)||!obj(s.settings)||!obj(s.tasks)||!obj(s.taskDates)||!Array.isArray(s.audit)||!Array.isArray(s.warnings)||!s.warnings.every(str))return false;
let keys=new Set();for(let a of s.apps){if(!obj(a)||!str(a.key)||!/^[-a-zA-Z0-9_]+$/.test(a.key)||['__proto__','constructor','prototype'].includes(a.key)||keys.has(a.key)||!obj(a.raw)||!Array.isArray(a.pending))return false;keys.add(a.key);for(let f of fields)if(a[f]!==null&&a[f]!==undefined&&!(numeric.includes(f)?num(a[f]):str(a[f])))return false;for(let p of a.pending)if(!obj(p)||!numeric.includes(p.field)||!(p.proposed===null||num(p.proposed))||!(str(p.raw)||Number.isFinite(p.raw)))return false;}
for(let t of s.territories){if(!obj(t)||!str(t.id)||!str(t.city)||!str(t.state)||!Array.isArray(t.pins)||!t.pins.every(str)||!(t.slots===null||Number.isFinite(t.slots))||(t.issues!==undefined&&(!Array.isArray(t.issues)||!t.issues.every(str))))return false;}
if(!obj(s.reference.all)||!obj(s.reference.tiers))return false;for(let group of [s.reference.all,...Object.values(s.reference.tiers)]){if(!obj(group))return false;for(let f of numeric)if(!Array.isArray(group[f])||!group[f].every(num))return false;}
for(let [k,v] of Object.entries(s.settings)){if(k==='model'||k==='preset'){if(!str(v)||v.length>60)return false;continue;}if(['tiers','cities','weights','acceptFloors'].includes(k)){if(policyErrors({...defaultPolicy,[k]:v}).length)return false;continue;}if(v!==''&&!(typeof v==='number'?num(v):str(v)&&/^\d+(\.\d+)?$/.test(v)))return false;}
for(let [key,task] of Object.entries(s.tasks)){if(!keys.has(key)||!obj(task)||Object.entries(task).some(([k,v])=>!/^([0-6])$/.test(k)||typeof v!=='boolean'))return false;}
for(let [key,dates] of Object.entries(s.taskDates)){if(!keys.has(key)||!obj(dates)||Object.entries(dates).some(([k,v])=>!/^([0-6])$/.test(k)||!str(v)||!/^$|^\d{4}-\d{2}-\d{2}$/.test(v)))return false;}
if(s.audit.some(a=>!obj(a)||!str(a.text)||!str(a.at)||!Number.isFinite(Date.parse(a.at))))return false;return true;
}catch(e){return false;}}
// Personalised onboarding plan. Admin steps run from week 1; fit-out, training and opening are worked back from the target launch month.
const planSteps=[['Funding check','Finance',1,'Verify bank statements or a loan sanction for the declared amount.'],['Site check','Expansion',1,'Visit the site: address, usable area, floor, frontage and legal right to use it.'],['Offer','Expansion',1,'Issue a conditional offer once funding and site are checked.'],['Agreement','Legal',2,'Signed franchise agreement and lease or ownership papers on file.'],['Fit-out','Operations',5,'Interiors, signage, utilities, billing system and opening stock.'],['Training','Training',2,'Brand standards, billing and POS, inventory, customer service.'],['Opening','Operations',1,'Final readiness check, soft launch, then opening day.']];
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
const festivals={diwali:['2026-11-08','2027-10-29','2028-10-17'],deepavali:['2026-11-08','2027-10-29','2028-10-17'],christmas:'12-25',sankranti:'01-14','new year':'01-01'};
const utc=d=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
const addDays=(d,n)=>new Date(d.getTime()+n*86400000);
function addMonths(d,n){let whole=Math.floor(n),r=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+whole,d.getUTCDate()));return addDays(r,Math.round((n-whole)*30));}
function fmtDate(d){return d.getUTCDate()+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]+' '+d.getUTCFullYear();}
// Reads a deadline phrase from the notes. Returns null when there is none. Notes never change a decision; they only raise a flag.
function deadlineFromNotes(notes,today){let t=String(notes||''),m,now=utc(today);
 if((m=t.match(/\b(before|by|ahead of|in time for|for)\s+(diwali|deepavali|christmas|sankranti|new year)\b/i))){let key=m[2].toLowerCase(),f=festivals[key],date=Array.isArray(f)?f.map(x=>new Date(x+'T00:00:00Z')).find(x=>x>=now):[0,1].map(k=>new Date(Date.UTC(now.getUTCFullYear()+k,+f.slice(0,2)-1,+f.slice(3)))).find(x=>x>=now);return {phrase:m[0],date:date||null,label:m[2][0].toUpperCase()+m[2].slice(1).toLowerCase(),assumed:true};}
 if((m=t.match(new RegExp('\\b(before|by)\\s+('+months.join('|')+')(?:\\s+(\\d{4}))?\\b','i')))){let mi=months.indexOf(m[2].toLowerCase()),y=m[3]?+m[3]:now.getUTCFullYear(),date=m[1].toLowerCase()==='before'?new Date(Date.UTC(y,mi,1)):new Date(Date.UTC(y,mi+1,0));if(!m[3]&&date<now)date=new Date(Date.UTC(date.getUTCFullYear()+1,date.getUTCMonth(),date.getUTCDate()));return {phrase:m[0],date,label:fmtDate(date),assumed:false};}
 if((m=t.match(/\bwithin\s+(\d+)\s+(weeks?|months?)\b/i))){let n=+m[1],date=/^w/i.test(m[2])?addDays(now,n*7):addMonths(now,n);return {phrase:m[0],date,label:fmtDate(date),assumed:false};}
 if((m=t.match(/\b(?:before|by|ahead of|in time for)\s+(?:the\s+)?([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/)))return {phrase:m[0],date:null,label:m[1],assumed:false};
 return null;}
function onboardingPlan(a,{today=new Date(),stores=[],settings=defaultPolicy}={}){let now=utc(today),assumedLaunch=!Number.isFinite(a.launch),launchMonths=assumedLaunch?Number(settings.targetLaunch)||6:a.launch,launchDate=addMonths(now,launchMonths),weeks=Math.max(1,Math.round((launchDate-now)/(7*86400000)));
 let newToRetail=!(a.experience>=1),steps=planSteps.map(([title,owner,len,detail])=>({title,owner,len:title==='Training'&&newToRetail?3:len,detail}));
 let need=steps.reduce((n,s)=>n+s.len,0),admin=steps.slice(0,4).reduce((n,s)=>n+s.len,0),tail=need-admin,tailStart=Math.max(admin+1,weeks-tail+1),openWeek=tailStart+tail-1,week=1;
 steps.forEach((s,i)=>{if(i===4)week=tailStart;s.start=week;s.end=week+s.len-1;week=s.end+1;s.from=fmtDate(addDays(now,(s.start-1)*7));s.to=fmtDate(addDays(now,s.end*7-1));});
 let openDate=addDays(now,openWeek*7-1),flags=[];
 if(assumedLaunch)flags.push(`Target launch is blank, so this plan assumes ${launchMonths} months. Confirm the launch month.`);
 if(openWeek>weeks)flags.push(`Target launch of ${launchMonths} month${launchMonths===1?'':'s'} gives ${weeks} weeks, but this plan needs ${need}. Earliest realistic opening: ${fmtDate(openDate)}.`);
 let deadline=deadlineFromNotes(a.notes,now);
 if(deadline&&deadline.date&&openDate>deadline.date)flags.push(`Notes say "${deadline.phrase}" (${deadline.label}${deadline.assumed?', assumed '+fmtDate(deadline.date):''}), but the planned opening is ${fmtDate(openDate)}. Agree a realistic date with the partner.`);
 else if(deadline&&!deadline.date)flags.push(`Notes mention a deadline ("${deadline.phrase}") that the plan cannot date. Confirm the date with the partner.`);
 let lang=['Kannada','English','Hindi'].includes(a.language)?a.language:null,shadow=stores.find(s=>s.city===a.city),tr=steps[5];
 let training={language:lang,weeks:tr.len,from:tr.from,to:tr.to,text:`Training in ${lang||'a language still to be confirmed (Kannada, English or Hindi)'}: ${tr.len} weeks, weeks ${tr.start} to ${tr.end} (${tr.from} to ${tr.to}). Modules: brand standards, billing and POS, inventory, customer service.`+(newToRetail?` ${a.experience===0?'No':'Under 1 year of'} retail experience, so 1 extra week of supervised shifts at ${shadow?'existing store '+shadow.id+' ('+shadow.city+')':'an existing brand store (none in '+(a.city||'this city')+'; brand to assign one)'}.`:` ${a.experience} years of retail experience, so training focuses on brand systems rather than retail basics.`)};
 let needed=[`Proof of funds for ₹${Number.isFinite(a.investment)?a.investment:'?'} lakh (bank statement or loan sanction letter)`];
 if(a.space==='Owned')needed.push('Ownership document for the site');else if(a.space==='Rented')needed.push('Signed lease or landlord letter of intent');else needed.push('An identified site: owned or rented, size in sq ft and floor');
 if(a.space==='Owned'||a.space==='Rented')needed.push('Site photos and a floor plan');
 if(!a.area&&a.space!=='Not yet identified')needed.push('Usable size of the site in sq ft');
 if(!floorOK(a,settings)&&a.space!=='Not yet identified')needed.push(`Actual floor of the site (recorded as "${a.floor||'blank'}")`);
 if(!lang)needed.push('Training language: Kannada, English or Hindi');
 if(businessPoints(a.business)===null)needed.push('Whether the partner has personally owned or run a business');
 for(let p of a.pending||[])needed.push(`Confirmed ${labels[p.field]} (sheet says "${p.raw}")`);
 for(let m of a.missing||[])needed.push(m);
 if(assumedLaunch)needed.push('Target launch month');
 if(deadline&&(!deadline.date||openDate>deadline.date))needed.push(`Agreement on the opening date (notes: "${deadline.phrase}")`);
 return {launchMonths,assumedLaunch,launchDate:fmtDate(launchDate),weeks,need,openWeek,openDate:fmtDate(openDate),steps,training,deadline:deadline&&{...deadline,date:deadline.date&&fmtDate(deadline.date)},flags,needed:[...new Set(needed)]};}
// Judge-facing decision label, one-line reason and next step, mapped from the internal status. Never reads free text.
const shortField={id:'unique ID',name:'name',city:'city',state:'state',pin:'pin code',investment:'investment',experience:'experience',space:'space status',area:'site size',floor:'floor',launch:'launch month',language:'training language'};
const firstSentence=s=>String(s||'').match(/^.*?\.(?=\s|$)/)?.[0]||String(s||'');
const reasonOnly=s=>String(s||'').replace(/\s*Unblocks[^.]*\./,'').trim();
const unblockOf=s=>String(s||'').match(/Unblocks[^.]*\./)?.[0]||'';
function holdNeed(a){let p=a.primary||'';if(a.status==='Clarification needed'){if(/appears \d+ times/.test(p))return 'unique ID';if(a.pending?.length)return 'confirmed '+[...new Set(a.pending.map(x=>shortField[x.field]))].join(', ');if(a.missing?.length)return [...new Set(a.missing.map(m=>shortField[Object.keys(labels).find(k=>labels[k]===m)]||m))].join(', ');if(/notes say|Not yet identified" but/.test(p))return 'site confirmation';if(/does not match|not 6 digits/.test(p))return 'pin check';if(/language/.test(p))return 'training language';return 'clarification';}
 if(a.status==='Site needed')return a.space==='Not yet identified'?'a site':!a.area?'site size':'actual floor';if(a.status==='Timeline review')return 'feasible launch date';if(a.status==='Territory review')return 'territory fix';if(a.status==='Policy needed')return 'brand policy';return 'review';}
function decision(a){let st=a.status,unblock=unblockOf(a.primary);
 if(st==='Recommended'){let cond=a.components.filter(c=>c.points===null).map(c=>c.key==='business'?'business history':shortField[c.key]||c.label.toLowerCase());if(!['Kannada','English','Hindi'].includes(a.language))cond.push('training language');let funds=`Start the funding check: proof of funds for ₹${num(a.investment)} lakh.`;
  return cond.length?{label:'Conditional',need:cond.join(', '),headline:`Approved subject to confirming ${cond.join(' and ')}. ${firstSentence(a.primary)}`,next:`Confirm ${cond.join(' and ')}, then ${funds[0].toLowerCase()+funds.slice(1)}`}:{label:'Approve',headline:a.primary,next:funds};}
 if(a.redirect)return {label:'Redirect',headline:firstSentence(a.primary)+' '+firstSentence(a.redirectText),next:`Offer pin ${a.redirect.map(o=>o.pin).join(' or ')} (suggestion only; the applicant must confirm a site there).`};
 if(st==='Waitlisted')return {label:'Waitlist',headline:reasonOnly(a.primary),next:'Keep on the waitlist. '+(unblock||'Moves up if a slot opens.')};
 if(st==='Requirements not met')return {label:'Not eligible',headline:reasonOnly(a.primary),next:'Decline for now. '+unblock};
 if(st==='Location unavailable'||(st==='Territory review'&&a.uncovered))return {label:'Not eligible',headline:reasonOnly(a.primary),next:a.gaps?.length?'Decline for now. Fix the applicant gaps first, then look for an open pin.':`Decline for this pin. ${unblock}`};
 let need=holdNeed(a);return {label:`Hold (needs ${need})`,need,headline:reasonOnly(a.primary),next:unblock||'Resolve the reason above.'};}
const api={policyFor,weightsOf,floorOK,defaultWeights,optionalFloors,decision,holdNeed,onboardingPlan,deadlineFromNotes,planSteps,personalGaps,redirectOptions,priorityRank,openSlots,onboardingOrder,territoryCapacity,policyErrors,defaultPolicy,parseNumber,invalidateTasks,validState,fields,numeric,cities,labels,normalize,percentile,band,benchmarks,assess,parseUpdate,businessPoints};if(typeof module!=='undefined')module.exports=api;root.Engine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
