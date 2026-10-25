const {test}=require('node:test'),a=require('node:assert/strict'),E=require('../dist/engine.js');
const base={name:'P',city:'Mysuru',state:'Karnataka',investment:40,experience:5,business:'Runs a shop',space:'Rented',area:500,floor:'Ground',launch:4,language:'Kannada'};
const ts=[{id:'T-LOW',city:'Mysuru',state:'Karnataka',pins:['570101'],slots:1,priority:'Low'},{id:'T-HIGH',city:'Mysuru',state:'Karnataka',pins:['570201','570202'],slots:2,priority:'High'},{id:'T-MED',city:'Mysuru',state:'Karnataka',pins:['570301'],slots:1,priority:'Medium'}];
const apps=[E.normalize({...base,id:'APP-1',pin:'570101',launch:3},'k1'),E.normalize({...base,id:'APP-2',pin:'570201',launch:5},'k2'),E.normalize({...base,id:'APP-3',pin:'570301',launch:3},'k3')];
const rs=E.assess(apps,ts,[],{},E.defaultPolicy);
test('open slots are listed High first and unfilled High territory is flagged',()=>{let o=E.openSlots(ts,[],rs);a.deepEqual(o.map(x=>x.id),['T-HIGH','T-MED','T-LOW']);a.equal(o[0].open,1);a.equal(o[0].flag,true);a.ok(o.slice(1).every(x=>!x.flag));});
test('onboarding sequence puts High priority before an earlier Low launch',()=>a.deepEqual(E.onboardingOrder(rs,ts).map(x=>x.id),['APP-2','APP-3','APP-1']));
test('unknown priority sorts after Low',()=>a.ok(E.priorityRank(undefined)>E.priorityRank('Low')));
