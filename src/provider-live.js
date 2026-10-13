// Keep the read-only decision screen current without replacing forms being edited.
import {db} from './operator-api.js';
let observed=null,owner=null,timer=null,inFlight=false;
function reset(){observed=null;owner=null;}
db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN')reset();});
async function tick(){
 if(inFlight||document.hidden||!document.querySelector('#app [data-refresh]'))return;
 inFlight=true;
 try{
  const session=await db.auth.getSession();const userId=session.data.session?.user.id;
  if(!userId){reset();return;}
  if(owner!==userId){owner=userId;observed=null;}
  const {data,error}=await db.rpc('provider_status');
  if(error||!data||owner!==userId)return;
  const next=JSON.stringify(data);
  if(next!==observed){const button=document.querySelector('#app [data-refresh]');if(button&&!button.disabled){observed=next;button.click();}}
 }catch{/* Temporary outages preserve the last known state; they do not approve or deny. */}
 finally{inFlight=false;}
}
timer=setInterval(tick,10000);
setTimeout(tick,2000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void tick();});
window.addEventListener('pagehide',()=>clearInterval(timer));
