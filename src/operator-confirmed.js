import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL,SUPABASE_KEY} from './operator-config.js';
import {confirmationParameters,LOGIN_PATH} from './operator-auth.js';
const heading=document.querySelector('#confirmation-title'),message=document.querySelector('#confirmation-message'),link=document.querySelector('#confirmation-login');
link.href=LOGIN_PATH;
const params=confirmationParameters(location.href);
// Never retain confirmation credentials in the URL, browser history or page links.
history.replaceState(null,'',location.pathname);
const client=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
try{
 if(params.error)throw Error('This confirmation link is invalid or has expired.');
 let result;
 if(params.tokenHash){if(!['email','signup'].includes(params.type))throw Error('This is not an email confirmation link.');result=await client.auth.verifyOtp({token_hash:params.tokenHash,type:params.type});}
 else if(params.accessToken&&params.refreshToken){result=await client.auth.setSession({access_token:params.accessToken,refresh_token:params.refreshToken});}
 else if(params.code){result=await client.auth.exchangeCodeForSession(params.code);}
 else {heading.textContent='Continue your onboarding';message.textContent='Log in to finish your LiftCrew operator application. To verify a new email address, open the confirmation link from your inbox.';}
 if(result){
  if(result.error)throw result.error;
  const verified=await client.auth.getUser();
  if(verified.error||!verified.data.user?.email_confirmed_at)throw Error('We could not verify this email confirmation.');
  await client.auth.signOut({scope:'local'});
  heading.textContent='Email confirmed.';
  message.textContent='Your email is verified. Log in to finish your business details, add equipment and operators, and complete onboarding.';
 }
}catch{
 heading.textContent='Let’s get you back on track.';
 message.textContent='This link could not be verified. It may have expired or already been used. Log in if you have already confirmed your email, or choose “Resend confirmation” on the login page.';
}finally{document.querySelector('#confirmation-card').removeAttribute('aria-busy');link.hidden=false;}
