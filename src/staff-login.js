import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL,SUPABASE_KEY} from './operator-config.js';
import {escapeHtml as h} from './operator-data.js';
const root=document.querySelector('#staff-login'),url=new URL(location.href),hash=new URLSearchParams(url.hash.slice(1));
const token=url.searchParams.get('token_hash'),type=url.searchParams.get('type')||hash.get('type');
const access=hash.get('access_token'),refresh=hash.get('refresh_token');
const callbackError=url.searchParams.get('error')||hash.get('error');
history.replaceState(null,'',location.pathname);
const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let setup=false,busy=false,reset=false,message='',error='';
const check=r=>{if(r.error)throw r.error;return r.data;};
async function verifyRole(){const {user}=check(await db.auth.getUser());if(!user?.email_confirmed_at||check(await db.rpc('is_operator_reviewer'))!==true)throw Error('This account does not have verified LiftCrew staff access.');return user;}
function render(){root.innerHTML=`<h1>${setup?'Set your password':reset?'Reset staff password':'Staff sign in'}</h1>${message?`<p class="notice success">${h(message)}</p>`:''}${error?`<p class="notice error" role="alert">${h(error)}</p>`:''}<form id="staff-form">${!setup?'<label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required maxlength="254"></label>':''}${!reset?`<label class="field"><span>${setup?'New password (12+ characters)':'Password'}</span><input name="password" type="password" autocomplete="${setup?'new-password':'current-password'}" required ${setup?'minlength="12"':''} maxlength="128"></label>${setup?'<label class="field"><span>Confirm password</span><input name="confirm" type="password" autocomplete="new-password" required minlength="12" maxlength="128"></label>':''}`:''}<button class="btn wide">${setup?'Save password':reset?'Send reset email':'Sign in'}</button></form>${!setup?`<p><button class="text-btn" id="switch">${reset?'Back to sign in':'Forgot password?'}</button></p>`:''}<p class="field-hint">Staff access is granted by LiftCrew. This page does not register you as an equipment provider.</p>`;root.querySelector('#switch')?.addEventListener('click',()=>{reset=!reset;error='';render();});root.querySelector('#staff-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=new FormData(e.target);busy=true;error='';e.submitter.disabled=true;try{
 if(setup){const password=String(f.get('password'));if(password.length<12||password!==f.get('confirm'))throw Error('Enter matching passwords of at least 12 characters.');await verifyRole();check(await db.auth.updateUser({password}));check(await db.auth.signOut({scope:'local'}));setup=false;message='Your staff password is saved. Sign in to review providers and customer requests.';render();}
 else if(reset){check(await db.auth.resetPasswordForEmail(String(f.get('email')).trim(),{redirectTo:'https://www.myliftcrew.com/staff-login.html'}));message='If the account exists, a password-reset email will be sent.';render();}
 else{check(await db.auth.signInWithPassword({email:String(f.get('email')).trim(),password:String(f.get('password'))}));try{await verifyRole();}catch(e){await db.auth.signOut({scope:'local'});throw e;}location.replace('/operator-review.html');}
 }catch(e){error=e.message||'Unable to sign in. Please try again.';render();}finally{busy=false;}};}
try{
 if(callbackError)throw Error('This invitation or reset link has expired. Request a new one.');
 if(token||access){if(!['invite','recovery'].includes(type))throw Error('This is not a staff invitation or password-reset link.');if(token)check(await db.auth.verifyOtp({token_hash:token,type}));else if(access&&refresh)check(await db.auth.setSession({access_token:access,refresh_token:refresh}));else throw Error('This link is incomplete.');await verifyRole();setup=true;}
 else{const session=check(await db.auth.getSession());if(session.session){await verifyRole();location.replace('/operator-review.html');}}
}catch(e){error=e.message;await db.auth.signOut({scope:'local'});}
render();
