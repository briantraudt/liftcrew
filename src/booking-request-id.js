// Give retries an idempotent reference without changing the customer's form fields.
// The capture listener runs before the existing form-submit listener creates FormData.
const states=new WeakMap();
document.addEventListener('submit',event=>{
 const form=event.target;if(!(form instanceof HTMLFormElement)||!form.matches('.details-form'))return;
 const entries=[...new FormData(form)].filter(([k])=>k!=='requestId');
 const fingerprint=JSON.stringify(entries);let saved=states.get(form);
 if(!saved||saved.fingerprint!==fingerprint){saved={fingerprint,id:crypto.randomUUID()};states.set(form,saved);}
 let field=form.elements.namedItem('requestId');
 if(!field){field=document.createElement('input');field.type='hidden';field.name='requestId';form.append(field);}
 field.value=saved.id;
},true);
