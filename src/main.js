import { suggestEquipment } from './catalog-data.js';
const toggle=document.querySelector('.menu-toggle');const nav=document.querySelector('.nav');toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));toggle.setAttribute('aria-label',open?'Open navigation':'Close navigation');nav.classList.toggle('open',!open)});document.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation')}));const year=document.querySelector('#year');if(year)year.textContent=new Date().getFullYear();const form=document.querySelector('#quote-form');
const review=document.querySelector('#equipment-review');
const jobStep=form?.querySelector('#job-step');
const contactStep=form?.querySelector('#contact-step');
let selectedMatch=null;
function setQuoteHeading(title,description){
  const heading=form?.parentElement.querySelector(':scope > h2');
  if(heading){heading.dataset.originalTitle ||= heading.textContent;heading.textContent=title;}
  const intro=heading?.nextElementSibling;
  if(intro?.tagName==='P' && description){intro.dataset.originalText ||= intro.textContent;intro.textContent=description;}
}
function validateStep(step){
  for(const field of step.querySelectorAll('input[required],select[required],textarea[required]')){
    if(!field.checkValidity()){field.reportValidity();field.focus({preventScroll:true});return false;}
  }
  return true;
}
function showJob(){
  jobStep.hidden=false;contactStep.hidden=true;form.hidden=false;
  form.parentElement.classList.remove('contact-view');
  setQuoteHeading('Tell us about the job.','These details help us suggest equipment that fits your load and worksite.');
  form.scrollIntoView({block:'start',behavior:'smooth'});
  form.querySelector('#loadDescription')?.focus({preventScroll:true});
}
async function showContact(){
  selectedMatch=await updateRecommendation();
  if(!selectedMatch)return;
  jobStep.hidden=true;contactStep.hidden=false;form.hidden=false;
  form.parentElement.classList.add('contact-view');
  form.scrollIntoView({block:'start',behavior:'smooth'});
  review.querySelector('#review-title').focus({preventScroll:true});
}
form?.addEventListener('submit',event=>{
  event.preventDefault();
  if(!contactStep.hidden){contactStep.querySelector('.contact-next').click();return;}
  if(!validateCalendarForm(form)||!validateStep(jobStep))return;
  syncDuration(form);
  void showContact();
});
contactStep?.querySelector('.contact-back').addEventListener('click',showJob);
contactStep?.querySelector('.contact-next').addEventListener('click',async()=>{
  if(!validateStep(contactStep))return;
  const button=contactStep.querySelector('.contact-next');
  const note=contactStep.querySelector('#form-note');
  button.disabled=true;button.textContent='Sending…';note.textContent='Sending your booking request…';
  try{
    const response=await fetch('/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(new FormData(form)),recommendation:selectedMatch?.title})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Unable to send your request.');
    form.hidden=true;
    const success=form.parentElement.querySelector('.booking-success');
    success.hidden=false;
    form.parentElement.classList.remove('contact-view');
    form.parentElement.classList.add('success-view');
    setQuoteHeading('Request received');
    success.scrollIntoView({block:'nearest',behavior:'smooth'});
  }catch(error){note.textContent=error.message;note.classList.remove('success');button.disabled=false;button.innerHTML='Request Booking <span aria-hidden="true">→</span>';}
});

let recommendationRequest=0;
async function updateRecommendation(){
  if(!form)return null;
  const request=++recommendationRequest;
  const match=await suggestEquipment(Object.fromEntries(new FormData(form)));
  if(request!==recommendationRequest)return null;
  const box=document.querySelector('#recommendation');
  box.querySelector('strong').textContent=match?match.title:'Complete the job details to see a suggested forklift.';
  box.querySelector('p').textContent=match?match.reason:'We’ll review the site and load requirements before confirming equipment and availability.';
  const example=box.querySelector('#equipment-example');
  if(example){example.hidden=!match?.sourceUrl;if(match?.sourceUrl)example.href=match.sourceUrl;}
  return match;
}

const params=new URLSearchParams(location.search);if(document.querySelector('#quote-form')&&params.size){for(const key of ['service','date','durationDays','location']){const field=document.querySelector(`#quote-form [name="${key}"]`);if(field&&params.has(key))field.value=params.get(key)}const summary=document.querySelector('#request-summary');if(summary){const values=[params.get('service'),params.get('location'),params.get('date')?prettyDate(params.get('date')):null,params.get('durationDays')?params.get('durationDays')+' days':null].filter(Boolean);summary.textContent=values.join(' · ')}}

function localISO(date){
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
}
function prettyDate(value){
  if(!value)return 'Select date';
  const parts=value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(parts[0],parts[1]-1,parts[2]));
}
function endDateFromDays(date,days){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(Number(days))||Number(days)<1||Number(days)>30)return '';
  const [year,month,day]=date.split('-').map(Number);
  const result=new Date(Date.UTC(year,month-1,day+Number(days)-1));
  return result.toISOString().slice(0,10);
}
function syncDuration(target){
  if(!target)return;
  target.elements.endDate.value=endDateFromDays(target.elements.date.value,target.elements.durationDays.value);
}
function validateCalendarForm(target){
  const date=target.elements.date;
  if(!date.value||date.value<localISO(new Date())){
    target.querySelector('[data-calendar="start"]')?.click();
    return false;
  }
  return true;
}
function syncCalendarForm(target){
  if(!target)return;
  syncDuration(target);
  const button=target.querySelector('[data-calendar="start"]');
  if(button){
    button.querySelector('.calendar-trigger-text').textContent=prettyDate(target.elements.date.value);
    button.classList.toggle('has-date',!!target.elements.date.value);
  }
}
function enhanceDates(target){
  if(!target)return;
  const input=target.elements.date;
  const today=localISO(new Date());
  input.min=today;
  let month=new Date().getMonth(),year=new Date().getFullYear();
  const calendar=document.createElement('div');
  calendar.id=target.id+'-calendar';
  calendar.className='lift-calendar';
  calendar.setAttribute('role','dialog');
  calendar.setAttribute('aria-label','Choose date');
  calendar.setAttribute('aria-modal','true');
  calendar.hidden=true;
  const backdrop=document.createElement('div');
  backdrop.className='calendar-backdrop';
  backdrop.hidden=true;
  document.body.append(backdrop,calendar);
  const button=document.createElement('button');
  button.type='button';
  button.id=input.id+'-trigger';
  button.className='calendar-trigger';
  button.dataset.calendar='start';
  button.setAttribute('aria-haspopup','dialog');
  button.setAttribute('aria-controls',calendar.id);
  button.setAttribute('aria-expanded','false');
  button.setAttribute('aria-label','Choose date');
  button.innerHTML='<span class="calendar-trigger-text"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></svg>';
  input.after(button);
  const label=target.querySelector('label[for="'+input.id+'"]');
  if(label)label.htmlFor=button.id;
  input.required=false;
  target.classList.add('calendar-ready');
  syncCalendarForm(target);

  function place(){
    if(calendar.hidden)return;
    const rect=target.getBoundingClientRect();
    const width=calendar.getBoundingClientRect().width,height=calendar.getBoundingClientRect().height;
    calendar.style.left=Math.max(width/2+12,Math.min(rect.left+rect.width/2,window.innerWidth-width/2-12))+'px';
    calendar.style.top=Math.max(height/2+12,Math.min(rect.top+rect.height/2,window.innerHeight-height/2-12))+'px';
  }
  function close(){
    calendar.hidden=true;
    backdrop.hidden=true;
    button.setAttribute('aria-expanded','false');
    button.focus({preventScroll:true});
  }
  function render(focusDate){
    const first=new Date(year,month,1),count=new Date(year,month+1,0).getDate();
    const heading=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(first);
    let days='';
    for(let i=0;i<first.getDay();i++)days+='<span class="calendar-blank" aria-hidden="true"></span>';
    for(let day=1;day<=count;day++){
      const value=localISO(new Date(year,month,day));
      const selected=value===input.value;
      const label=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(year,month,day));
      days+='<button type="button" class="calendar-day'+(selected?' selected':'')+(value===today?' today':'')+'" data-date="'+value+'" aria-label="'+label+'" aria-pressed="'+selected+'" '+(value<today?'disabled':'')+'>'+day+'</button>';
    }
    calendar.innerHTML='<div class="calendar-top"><div><span class="calendar-kicker">CHOOSE DATE</span><strong class="calendar-month" aria-live="polite">'+heading+'</strong></div><div class="calendar-nav"><button type="button" data-action="prev" aria-label="Previous month" '+(localISO(first).slice(0,7)<=today.slice(0,7)?'disabled':'')+'>‹</button><button type="button" data-action="next" aria-label="Next month">›</button><button type="button" data-action="close" aria-label="Close calendar">×</button></div></div><div class="calendar-weekdays" aria-hidden="true"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div><div class="calendar-days">'+days+'</div><div class="calendar-bottom"><button type="button" data-action="clear">Clear date</button><button type="button" data-action="today">Today</button></div>';
    if(focusDate)calendar.querySelector('[data-date="'+focusDate+'"]')?.focus({preventScroll:true});
  }
  function open(){
    const selected=input.value||today;
    const [y,m]=selected.split('-').map(Number);
    year=y;month=m-1;
    calendar.hidden=false;backdrop.hidden=false;
    button.setAttribute('aria-expanded','true');
    render();place();
    (calendar.querySelector('[data-date="'+selected+'"]:not(:disabled)')||calendar.querySelector('.calendar-day:not(:disabled)'))?.focus({preventScroll:true});
  }
  function choose(value){
    input.value=value;
    syncCalendarForm(target);
    close();
    target.elements.durationDays.focus({preventScroll:true});
  }
  button.addEventListener('click',open);
  calendar.addEventListener('click',event=>{
    const selected=event.target.closest('[data-date]');
    if(selected){choose(selected.dataset.date);return;}
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='prev'||action==='next'){
      const next=new Date(year,month+(action==='prev'?-1:1),1);
      year=next.getFullYear();month=next.getMonth();render();
      calendar.querySelector('[data-action="'+action+'"]')?.focus({preventScroll:true});
    }else if(action==='clear'){input.value='';syncCalendarForm(target);close();}
    else if(action==='today')choose(today);
    else if(action==='close')close();
  });
  calendar.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key==='Tab'){
      const buttons=[...calendar.querySelectorAll('button:not(:disabled)')];
      if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus({preventScroll:true});}
      else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus({preventScroll:true});}
      return;
    }
    const focused=event.target.closest('[data-date]');
    const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
    if(!focused||offset===undefined)return;
    event.preventDefault();
    const [y,m,d]=focused.dataset.date.split('-').map(Number);
    const next=new Date(y,m-1,d+offset),value=localISO(next);
    if(value<today)return;
    year=next.getFullYear();month=next.getMonth();render(value);
  });
  backdrop.addEventListener('click',close);
  document.addEventListener('pointerdown',event=>{if(!calendar.hidden&&!target.contains(event.target)&&!calendar.contains(event.target)&&event.target!==backdrop)close()});
  window.addEventListener('resize',place);
  window.addEventListener('scroll',place,{passive:true});
  target.elements.durationDays.addEventListener('change',()=>syncDuration(target));
}
enhanceDates(document.querySelector('#booking-form'));
enhanceDates(document.querySelector('#quote-form'));

const bookingForm=document.querySelector('#booking-form');
const quoteModal=document.querySelector('#quote-modal');
if(bookingForm&&quoteModal&&form){
  const closeButton=quoteModal.querySelector('.quote-modal-close');
  const editButton=quoteModal.querySelector('.summary-edit');
  const editPanel=quoteModal.querySelector('#booking-edit');
  const summary=quoteModal.querySelector('#request-summary');
  function refreshBookingSummary(){
    summary.textContent=[form.elements.service.value,form.elements.location.value,
      prettyDate(form.elements.date.value),form.elements.durationDays.value+' '+(form.elements.durationDays.value==='1'?'day':'days')].join(' · ');
  }
  function setEditing(open){
    editPanel.hidden=!open;
    editButton.setAttribute('aria-expanded',String(open));
    editButton.textContent=open?'Cancel editing':'Edit';
  }
  editButton.addEventListener('click',()=>{
    const opening=editPanel.hidden;
    setEditing(opening);
    if(opening)form.elements.service.focus({preventScroll:true});
    else{
      for(const key of ['service','location','date','durationDays'])form.elements[key].value=bookingForm.elements[key].value;
      syncCalendarForm(form);
      refreshBookingSummary();
      editButton.focus({preventScroll:true});
    }
  });
  quoteModal.querySelector('.summary-done').addEventListener('click',()=>{
    const fields=[form.elements.service,form.elements.location];
    const invalid=fields.find(field=>!field.checkValidity());
    if(invalid){invalid.reportValidity();return;}
    if(!validateCalendarForm(form))return;
    for(const key of ['service','location','date','durationDays'])bookingForm.elements[key].value=form.elements[key].value;
    syncCalendarForm(bookingForm);
    refreshBookingSummary();
    setEditing(false);
    editButton.focus({preventScroll:true});
  });
  const closeQuote=()=>{
    quoteModal.hidden=true;
    form.hidden=false;selectedMatch=null;
    jobStep.hidden=false;contactStep.hidden=true;
    form.parentElement.classList.remove('contact-view');
    form.parentElement.classList.remove('success-view');
    form.parentElement.querySelector('.booking-success').hidden=true;
    contactStep.querySelector('.contact-next').disabled=false;
    contactStep.querySelector('.contact-next').innerHTML='Request Booking <span aria-hidden="true">→</span>';
    const heading=form.parentElement.querySelector(':scope > h2');
    if(heading?.dataset.originalTitle)heading.textContent=heading.dataset.originalTitle;
    const intro=heading?.nextElementSibling;
    if(intro?.dataset.originalText)intro.textContent=intro.dataset.originalText;
    bookingForm.querySelector('.booking-go').focus({preventScroll:true});
  };
  bookingForm.addEventListener('submit',event=>{
    event.preventDefault();
    if(!validateCalendarForm(bookingForm)||!bookingForm.reportValidity())return;
    for(const key of ['service','location','date','durationDays']){
      form.elements[key].value=bookingForm.elements[key].value;
    }
    syncCalendarForm(form);
    refreshBookingSummary();
    setEditing(false);
    form.hidden=false;jobStep.hidden=false;contactStep.hidden=true;
    form.parentElement.classList.remove('contact-view');
    form.parentElement.classList.remove('success-view');
    form.parentElement.querySelector('.booking-success').hidden=true;
    quoteModal.hidden=false;
    quoteModal.scrollTop=0;
    closeButton.focus({preventScroll:true});
  });
  closeButton.addEventListener('click',closeQuote);
  quoteModal.addEventListener('click',event=>{if(event.target===quoteModal)closeQuote()});
  quoteModal.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();closeQuote();return;}
    if(event.key!=='Tab')return;
    const focusable=[...quoteModal.querySelectorAll('button:not(:disabled),input:not([type=hidden]):not(.honeypot),select,textarea')].filter(el=>el.getClientRects().length);
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
}

// Homepage section navigation keeps booking on the same page.
document.querySelectorAll('[data-service]').forEach(link=>link.addEventListener('click',()=>{
  if(bookingForm)bookingForm.elements.service.value=link.dataset.service;
}));
if(document.body.classList.contains('one-page')){
  const sectionLinks=[...document.querySelectorAll('.nav a[href^="#"]')];
  const sections=sectionLinks.map(link=>document.querySelector(link.hash)).filter(Boolean);
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(!visible)return;
      sectionLinks.forEach(link=>{
        if(link.hash==='#'+visible.target.id)link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      });
    },{rootMargin:'-100px 0px -35% 0px',threshold:[0,.2,.5]});
    sections.forEach(section=>observer.observe(section));
  }
  const backdrop=document.querySelector('[data-parallax]');
  const motion=matchMedia('(prefers-reduced-motion: no-preference) and (min-width: 851px)');
  let pending=false;
  function updateDepth(){
    pending=false;
    if(!motion.matches){backdrop.style.transform='';return;}
    const rect=backdrop.parentElement.getBoundingClientRect();
    if(rect.bottom<0||rect.top>innerHeight)return;
    const offset=Math.max(-65,Math.min(65,(innerHeight/2-rect.top-rect.height/2)*.12));
    backdrop.style.transform=`translate3d(0,${offset}px,0)`;
  }
  function scheduleDepth(){if(!pending){pending=true;requestAnimationFrame(updateDepth);}}
  if(backdrop){window.addEventListener('scroll',scheduleDepth,{passive:true});window.addEventListener('resize',scheduleDepth);motion.addEventListener('change',scheduleDepth);updateDepth();}
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('open')){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation');toggle.focus();}});
}
