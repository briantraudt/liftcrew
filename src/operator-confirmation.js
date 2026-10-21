/**
 * LiftCrew-branded confirmation dialog for operator-portal actions.
 * The caller performs the actual data mutation only after the promise resolves true.
 * Variable content is assigned via textContent to avoid HTML injection.
 */
export function confirmOperatorAction({
 title,
 message,
 confirmLabel='Remove',
 intent='danger',
 showIcon=true,
}){
 return new Promise(resolve=>{
  if(document.querySelector('dialog.lc-confirm-dialog[open]')){resolve(false);return;}
  const priorFocus=document.activeElement;
  const dialog=document.createElement('dialog');
  dialog.className='lc-confirm-dialog';
  dialog.setAttribute('aria-labelledby','lc-confirm-title');
  dialog.setAttribute('aria-describedby','lc-confirm-description');
  dialog.innerHTML=`<div class="lc-confirm-content">
    ${showIcon?'<span class="lc-confirm-icon" aria-hidden="true">!</span>':''}
    <h2 id="lc-confirm-title"></h2>
    <p id="lc-confirm-description"></p>
    <div class="lc-confirm-actions">
      <button type="button" class="lc-confirm-cancel">Cancel</button>
      <button type="button" class="lc-confirm-accept"></button>
    </div>
  </div>`;
  dialog.querySelector('#lc-confirm-title').textContent=String(title||'Confirm this action');
  dialog.querySelector('#lc-confirm-description').textContent=String(message||'');
  const cancel=dialog.querySelector('.lc-confirm-cancel');
  const accept=dialog.querySelector('.lc-confirm-accept');
  accept.textContent=String(confirmLabel);
  if(intent==='caution')dialog.classList.add('is-caution');
  let settled=false;
  function finish(accepted){
   if(settled)return;
   settled=true;
   if(dialog.open)dialog.close();
   dialog.remove();
   if(priorFocus?.isConnected&&typeof priorFocus.focus==='function')priorFocus.focus({preventScroll:true});
   resolve(accepted);
  }
  cancel.addEventListener('click',()=>finish(false));
  accept.addEventListener('click',()=>finish(true));
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
  dialog.addEventListener('click',event=>{if(event.target===dialog)finish(false);});
  document.body.append(dialog);
  dialog.showModal();
  cancel.focus({preventScroll:true});
 });
}
