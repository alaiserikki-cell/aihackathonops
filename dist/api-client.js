'use strict';
// Right Pin cloud client. Same-origin /api only. Each browser gets a random workspace ID; there is no login.
(function(root){
const KEY='right-pin-workspace',TIMEOUT=8000,uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function makeId(){try{if(root.crypto&&typeof root.crypto.randomUUID==='function')return root.crypto.randomUUID();}catch(e){}let b=new Uint8Array(16);try{root.crypto.getRandomValues(b);}catch(e){for(let i=0;i<16;i++)b[i]=Math.floor(Math.random()*256);}b[6]=b[6]&15|64;b[8]=b[8]&63|128;let h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
let workspaceId=null;try{workspaceId=root.localStorage.getItem(KEY);}catch(e){}
if(!workspaceId||!uuid.test(workspaceId)){workspaceId=makeId();try{root.localStorage.setItem(KEY,workspaceId);}catch(e){}}
// Network problems, timeouts and non-JSON answers (plain static hosting) get status 0 and network=true.
async function request(method,path,body,withWorkspace=true){let ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),TIMEOUT),res,data=null;let headers={accept:'application/json'};if(withWorkspace)headers['x-workspace-id']=workspaceId;if(body!==undefined)headers['content-type']='application/json';
 try{res=await fetch(path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:ctl.signal,cache:'no-store',credentials:'same-origin'});try{data=await res.json();}catch(e){data=null;}}
 catch(e){let err=new Error(e&&e.name==='AbortError'?'The server did not respond in time.':'The server could not be reached.');err.status=0;err.network=true;throw err;}
 finally{clearTimeout(timer);}
 if(!res.ok){let err=new Error((data&&typeof data.error==='string'&&data.error)||`Request failed (${res.status}).`);err.status=res.status;err.blocked=res.status===409;err.network=!data;err.data=data;throw err;}
 if(data===null||typeof data!=='object'){let err=new Error('The server did not return JSON.');err.status=0;err.network=true;throw err;}
 return data;}
root.RightPinAPI={get workspaceId(){return workspaceId;},health:()=>request('GET','/api/health',undefined,false),get:path=>request('GET',path),post:(path,body)=>request('POST',path,body===undefined?{}:body)};
})(typeof globalThis!=='undefined'?globalThis:this);
