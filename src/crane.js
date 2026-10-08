import { craneSections, validateCraneRequest } from './crane-fields.js';
import { loadCraneCatalog } from './crane-catalog.js';
const form=document.querySelector('#crane-form');
const note=document.querySelector('#crane-note');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderField(field){
  const {name,label,type='text',required,unknown,options,placeholder='',autocomplete='off',min,max,step='any'}=field;
  const attrs=`id="${name}" name="${name}" ${required?'required':''} autocomplete="${autocomplete}"`;
  const control=options?`<select ${attrs}><option value="">Select</option>${options.map(v=>`<option>${esc(v)}</option>`).join('')}</select>`:type==='textarea'?`<textarea ${attrs} maxlength="3000" rows="2" placeholder="${esc(placeholder)}"></textarea>`:`<input ${attrs} type="${type}" ${type==='number'?`min="${min}" max="${max}" step="${step}"`:'maxlength="3000"'} placeholder="${esc(placeholder)}">`;
  return `<div class="${type==='textarea'||field.wide?'wide':''}"><label for="${name}">${esc(label)}</label>${control}${unknown?`<label class="unknown-option"><input type="checkbox" name="${name}Unknown" value="yes" data-unknown="${name}">Not sure</label>`:''}${field.help?`<details class="field-info"><summary>How to measure</summary><p>${esc(field.help)}</p></details>`:''}</div>`;
}
document.querySelector('#crane-sections').innerHTML=craneSections.map(section=>`<section class="crane-card"><h2>${section.title}</h2><div class="crane-grid">${section.fields.map(renderField).join('')}</div></section>`).join('');
form.querySelectorAll('[data-unknown]').forEach(box=>box.addEventListener('change',()=>{const field=form.elements[box.dataset.unknown];field.disabled=box.checked;field.required=!box.checked;}));
const params=new URLSearchParams(location.search);
for(const key of ['location','date','durationDays'])if(params.has(key))form.elements[key].value=params.get(key);
const today=new Date();form.elements.date.min=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
document.querySelector('#year').textContent=today.getFullYear();
let catalog=[];
const catalogNote=document.querySelector('#catalog-note');
loadCraneCatalog().then(rows=>{
  catalog=rows;
  for(const row of rows){const option=document.createElement('option');option.value=row.source_class_code;option.textContent=row.title;form.elements.craneClass.append(option);}
}).catch(()=>{catalogNote.textContent='We’ll help select the crane. Catalog preferences are temporarily unavailable.';});
form.elements.craneClass.addEventListener('change',()=>{
  const row=catalog.find(r=>r.source_class_code===form.elements.craneClass.value);
  catalogNote.textContent=row?`Listed capacity: ${row.rated_capacity_lb.toLocaleString()} lb${row.vertical_reach_ft?` · Vertical reach: ${row.vertical_reach_ft} ft`:''}. Capacity varies with radius and configuration.`:'';
});
const submit=form.querySelector('[type=submit]');submit.disabled=false;
form.addEventListener('submit',async event=>{
  event.preventDefault();if(submit.disabled)return;
  if(!form.reportValidity())return;
  const payload=Object.fromEntries(new FormData(form));
  const validation=validateCraneRequest(payload);
  if(validation.error){note.textContent=validation.error;return;}
  submit.disabled=true;submit.textContent='Sending…';note.textContent='';
  try{
    const response=await fetch('/api/crane-quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const result=await response.json();
    if(!response.ok||!result.ok)throw Error(result.error||'We could not save your request. Please try again.');
    form.hidden=true;
    const success=document.querySelector('#crane-success');success.hidden=false;
    document.querySelector('#crane-reference').textContent=result.reference?`Reference: ${result.reference}`:'';
    success.focus();success.scrollIntoView({block:'start',behavior:'smooth'});
  }catch(error){note.textContent=error.message;submit.disabled=false;submit.textContent='Request Quote';}
});
