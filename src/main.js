import { recommendEquipment } from './equipment.js';
const toggle=document.querySelector('.menu-toggle');const nav=document.querySelector('.nav');toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));toggle.setAttribute('aria-label',open?'Open navigation':'Close navigation');nav.classList.toggle('open',!open)});document.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation')}));const year=document.querySelector('#year');if(year)year.textContent=new Date().getFullYear();const form=document.querySelector('#quote-form');form?.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity()||!validateCalendarForm(form))return;const match=updateRecommendation();if(!match)return;const button=form.querySelector('button[type=submit]');const note=document.querySelector('#form-note');button.disabled=true;button.textContent='Sending…';note.textContent='Sending your request…';try{const response=await fetch('/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(new FormData(form)),recommendation:match.title,recommendationReason:match.reason})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to send your request.');form.reset();syncCalendarForm(form);updateRecommendation();note.textContent='Thanks. Your request was sent. We’ll be in touch.';note.classList.add('success')}catch(error){note.textContent=error.message;note.classList.remove('success')}finally{button.disabled=false;button.innerHTML='Request Availability & Quote <span aria-hidden="true">→</span>'}});

function updateRecommendation(){
  if(!form)return null;
  const match=recommendEquipment(Object.fromEntries(new FormData(form)));
  const box=document.querySelector('#recommendation');
  box.querySelector('strong').textContent=match?match.title:'Complete the job details to see a suggested forklift.';
  box.querySelector('p').textContent=match?match.reason+' LiftCrew will confirm the equipment before scheduling.':'We’ll review the site and load requirements before confirming equipment and availability.';
  return match;
}
form?.addEventListener('input',updateRecommendation);
form?.addEventListener('change',updateRecommendation);
const params=new URLSearchParams(location.search);if(document.querySelector('#quote-form')&&params.size){for(const key of ['service','date','endDate','location']){const field=document.querySelector(`#quote-form [name="${key}"]`);if(field&&params.has(key))field.value=params.get(key)}const summary=document.querySelector('#request-summary');if(summary){const values=[params.get('service'),params.get('location'),params.get('date')&&params.get('endDate')?prettyDate(params.get('date'))+' – '+prettyDate(params.get('endDate')):null].filter(Boolean);summary.textContent=values.join(' · ')}}

function localISO(date){
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
}
function prettyDate(value){
  if(!value)return 'Select date';
  const parts=value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(parts[0],parts[1]-1,parts[2]));
}
function validateCalendarForm(target){
  if(!target.classList.contains('calendar-ready'))return true;
  const start=target.querySelector('[name="date"]');
  const end=target.querySelector('[name="endDate"]');
  const missing=!start.value?'start':((target.id==='booking-form'||target.id==='quote-form')&&!end.value?'end':null);
  const invalidEnd=end.value&&start.value&&end.value<start.value;
  if(missing||invalidEnd){
    const field=missing||'end';
    target.querySelector('[data-calendar="'+field+'"]').click();
    const note=target.querySelector('#form-note');
    if(note)note.textContent=invalidEnd?'End date must be on or after the start date.':'Please choose a '+field+' date.';
    return false;
  }
  return true;
}
function syncCalendarForm(target){
  if(!target.classList.contains('calendar-ready'))return;
  for(const kind of ['start','end']){
    const input=target.querySelector('[name="'+(kind==='start'?'date':'endDate')+'"]');
    const button=target.querySelector('[data-calendar="'+kind+'"]');
    button.querySelector('.calendar-trigger-text').textContent=prettyDate(input.value);
    button.classList.toggle('has-date',!!input.value);
  }
}
function enhanceDates(target){
  if(!target)return;
  const start=target.querySelector('[name="date"]');
  const end=target.querySelector('[name="endDate"]');
  const today=localISO(new Date());
  start.min=today;end.min=start.value||today;
  let mode='start';
  let month=new Date().getMonth();
  let year=new Date().getFullYear();
  let activeTrigger=null;
  const calendar=document.createElement('div');
  calendar.id=target.id+'-calendar';
  calendar.className='lift-calendar';
  calendar.setAttribute('role','dialog');
  calendar.setAttribute('aria-label','Choose a date');
  calendar.setAttribute('aria-modal','true');
  calendar.hidden=true;
  const backdrop=document.createElement('div');
  backdrop.className='calendar-backdrop';
  backdrop.hidden=true;
  document.body.append(backdrop,calendar);
  for(const [kind,input] of [['start',start],['end',end]]){
    const button=document.createElement('button');
    button.type='button';
    button.id=input.id+'-trigger';
    button.className='calendar-trigger';
    button.dataset.calendar=kind;
    button.setAttribute('aria-haspopup','dialog');
    button.setAttribute('aria-controls',calendar.id);
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-label','Choose '+kind+' date');
    button.innerHTML='<span class="calendar-trigger-text"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></svg>';
    input.after(button);
    const label=target.querySelector('label[for="'+input.id+'"]');
    if(label)label.htmlFor=button.id;
    input.required=false;
    button.addEventListener('click',()=>open(kind));
  }
  target.classList.add('calendar-ready');
  syncCalendarForm(target);

  function close(restoreFocus=false){
    calendar.hidden=true;
    backdrop.hidden=true;
    target.querySelectorAll('.calendar-trigger').forEach(button=>button.setAttribute('aria-expanded','false'));
    if(restoreFocus&&activeTrigger)activeTrigger.focus({preventScroll:true});
  }
  function open(kind){
    mode=kind==='end'&&!start.value?'start':kind;
    activeTrigger=target.querySelector('[data-calendar="'+mode+'"]');
    const selected=(kind==='end'?end.value:start.value)||start.value||today;
    const parts=selected.split('-').map(Number);
    year=parts[0];month=parts[1]-1;
    calendar.hidden=false;
    backdrop.hidden=false;
    target.querySelectorAll('.calendar-trigger').forEach(button=>button.setAttribute('aria-expanded',String(button===activeTrigger)));
    calendar.setAttribute('aria-label','Choose '+kind+' date');
    render();
    placeCalendar();
    (calendar.querySelector('[data-date="'+selected+'"]:not(:disabled)')||calendar.querySelector('.calendar-day:not(:disabled)'))?.focus({preventScroll:true});
  }
  function placeCalendar(){
    if(calendar.hidden)return;
    const rect=target.getBoundingClientRect();
    const width=calendar.getBoundingClientRect().width;
    const height=calendar.getBoundingClientRect().height;
    const x=Math.max(width/2+12,Math.min(rect.left+rect.width/2,window.innerWidth-width/2-12));
    const y=Math.max(height/2+12,Math.min(rect.top+rect.height/2,window.innerHeight-height/2-12));
    calendar.style.left=x+'px';
    calendar.style.top=y+'px';
  }
  window.addEventListener('resize',placeCalendar);
  window.addEventListener('scroll',placeCalendar,{passive:true});
  function render(focusDate){
    const first=new Date(year,month,1);
    const count=new Date(year,month+1,0).getDate();
    const heading=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(first);
    const minMonth=mode==='end'&&start.value&&start.value>today?start.value.slice(0,7):today.slice(0,7);
    const currentMonth=localISO(first).slice(0,7);
    let days='';
    for(let i=0;i<first.getDay();i++)days+='<span class="calendar-blank" aria-hidden="true"></span>';
    for(let day=1;day<=count;day++){
      const value=localISO(new Date(year,month,day));
      const disabled=value<today||(mode==='end'&&!!start.value&&value<start.value);
      const selected=value===start.value||value===end.value;
      const inRange=!!start.value&&!!end.value&&value>start.value&&value<end.value;
      const classes=['calendar-day',selected?'selected':'',inRange?'in-range':'',value===today?'today':''].filter(Boolean).join(' ');
      const label=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(year,month,day));
      days+='<button type="button" class="'+classes+'" data-date="'+value+'" aria-label="'+label+'" aria-pressed="'+selected+'" '+(disabled?'disabled':'')+'>'+day+'</button>';
    }
    calendar.innerHTML='<div class="calendar-top"><div><span class="calendar-kicker">'+(mode==='start'?'CHOOSE START DATE':'NOW CHOOSE END DATE')+'</span><strong aria-live="polite">'+heading+'</strong></div><div class="calendar-nav"><button type="button" data-action="prev" aria-label="Previous month" '+(currentMonth<=minMonth?'disabled':'')+'>‹</button><button type="button" data-action="next" aria-label="Next month">›</button><button type="button" data-action="close" aria-label="Close calendar">×</button></div></div><div class="calendar-weekdays" aria-hidden="true"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div><div class="calendar-days">'+days+'</div><div class="calendar-bottom"><button type="button" data-action="clear">Clear dates</button><button type="button" data-action="today" '+(mode==='end'&&start.value>today?'disabled':'')+'>Today</button></div>';
    if(focusDate)calendar.querySelector('[data-date="'+focusDate+'"]')?.focus({preventScroll:true});
  }
  function choose(value){
    if(mode==='start'){
      start.value=value;
      end.min=value;
      if(end.value&&end.value<value)end.value='';
      syncCalendarForm(target);
      if(target.id==='booking-form'){
        mode='end';
        activeTrigger=target.querySelector('[data-calendar="end"]');
        target.querySelectorAll('.calendar-trigger').forEach(button=>button.setAttribute('aria-expanded',String(button===activeTrigger)));
        calendar.setAttribute('aria-label','Choose end date');
        render(start.value);
        placeCalendar();
        calendar.querySelector('[data-date="'+start.value+'"]')?.focus({preventScroll:true});
      }else close(true);
    }else{
      end.value=value;
      syncCalendarForm(target);
      close(true);
    }
  }
  calendar.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button)return;
    if(button.dataset.date){choose(button.dataset.date);return;}
    const action=button.dataset.action;
    if(action==='prev'||action==='next'){
      const delta=action==='prev'?-1:1;
      const next=new Date(year,month+delta,1);
      year=next.getFullYear();month=next.getMonth();render();
      calendar.querySelector('[data-action="'+action+'"]')?.focus({preventScroll:true});
    }else if(action==='close'){close(true);
    }else if(action==='clear'){
      start.value='';end.value='';end.min=today;syncCalendarForm(target);close(true);
    }else if(action==='today')choose(today);
  });
  calendar.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close(true);return;}
    if(event.key==='Tab'){
      const buttons=[...calendar.querySelectorAll('button:not(:disabled)')];
      const first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus({preventScroll:true});}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus({preventScroll:true});}
      return;
    }
    const focused=event.target.closest('[data-date]');
    if(!focused)return;
    const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
    if(offset===undefined)return;
    event.preventDefault();
    const parts=focused.dataset.date.split('-').map(Number);
    const next=new Date(parts[0],parts[1]-1,parts[2]+offset);
    const value=localISO(next);
    if(value<today||(mode==='end'&&start.value&&value<start.value))return;
    year=next.getFullYear();month=next.getMonth();render(value);
  });
  backdrop.addEventListener('click',()=>close(true));
  document.addEventListener('pointerdown',event=>{if(!calendar.hidden&&!target.contains(event.target)&&!calendar.contains(event.target)&&event.target!==backdrop)close()});
  if(target.id==='booking-form')target.addEventListener('submit',event=>{if(!validateCalendarForm(target))event.preventDefault()});
}
enhanceDates(document.querySelector('#booking-form'));
enhanceDates(document.querySelector('#quote-form'));updateRecommendation();
