// Accessible LiftCrew-styled confirmations; no browser confirm() popups.
export function confirmOperatorAction({title='Confirm change',message='',confirmLabel='Confirm',danger=false}={}){
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');
    dialog.className='operator-confirm-dialog';
    dialog.setAttribute('aria-labelledby','operator-dialog-title');
    dialog.setAttribute('aria-describedby','operator-dialog-description');
    const content=document.createElement('div');content.className='operator-confirm-content';
    const h=document.createElement('h2');h.id='operator-dialog-title';h.textContent=title;
    const p=document.createElement('p');p.id='operator-dialog-description';p.textContent=message;
    const actions=document.createElement('form');actions.method='dialog';actions.className='operator-dialog-actions';
    const cancel=document.createElement('button');cancel.type='submit';cancel.value='cancel';cancel.className='btn secondary';cancel.textContent='Cancel';
    const accept=document.createElement('button');accept.type='submit';accept.value='confirm';accept.className=danger?'btn operator-dialog-danger':'btn';accept.textContent=confirmLabel;
    actions.append(cancel,accept);content.append(h,p,actions);dialog.append(content);document.body.append(dialog);
    let completed=false;
    const finish=answer=>{if(completed)return;completed=true;dialog.remove();resolve(answer);};
    dialog.addEventListener('close',()=>finish(dialog.returnValue==='confirm'),{once:true});
    dialog.addEventListener('cancel',()=>{dialog.returnValue='cancel';});
    if(typeof dialog.showModal==='function'){dialog.showModal();cancel.focus();}
    else {dialog.setAttribute('open','');dialog.setAttribute('role','alertdialog');actions.addEventListener('submit',e=>{e.preventDefault();finish(e.submitter?.value==='confirm');});cancel.focus();}
  });
}
