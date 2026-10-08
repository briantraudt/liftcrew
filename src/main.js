import { validateBooking, bookingServices } from './booking-fields.js';
const toggle=document.querySelector('.menu-toggle');const nav=document.querySelector('.nav');toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));toggle.setAttribute('aria-label',open?'Open navigation':'Close navigation');nav?.classList.toggle('open',!open)});document.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',()=>{nav?.classList.remove('open');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open navigation')}));const year=document.querySelector('#year');if(year)year.textContent=new Date().getFullYear();

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

const bookingForm = document.querySelector('#booking-form');
if (bookingForm) {
  // Links may preselect a service; dates and location always start on the homepage.
  const service = new URLSearchParams(location.search).get('service');
  if (bookingServices.includes(service)) bookingForm.elements.service.value = service;
  let details = null;
  let pagePosition = 0;
  const pageTitle = document.title;
  const continueButton = bookingForm.querySelector('.booking-go');
  const bookingNote = document.createElement('p');
  bookingNote.className = 'booking-entry-note';
  bookingNote.setAttribute('role', 'status');
  bookingNote.hidden = true;
  bookingForm.append(bookingNote);
  // A refresh / copied URL must return to step one, even with old history state.
  if (history.state?.liftcrewBooking) history.replaceState(null, '', location.href);

  function showDetails() {
    if (!details) return;
    details.element.hidden = false;
    document.body.classList.add('booking-details-open');
    document.title = 'Your booking | LiftCrew';
    window.scrollTo({top: 0, behavior: 'instant'});
    details.focus();
  }
  function showHomepage() {
    if (!details) return;
    if (!details.element.hidden) details.syncSchedule();
    details.element.hidden = true;
    document.body.classList.remove('booking-details-open');
    document.title = pageTitle;
    window.scrollTo({top: pagePosition, behavior: 'instant'});
    continueButton.focus({preventScroll: true});
  }
  function backToBooking() {
    if (history.state?.liftcrewBooking) history.back();
    else showHomepage();
  }
  function syncHomepage(schedule) {
    for (const key of ['location', 'date', 'durationDays']) bookingForm.elements[key].value = schedule[key];
    syncCalendarForm(bookingForm);
  }
  window.addEventListener('popstate', () => {
    if (history.state?.liftcrewBooking && details) showDetails();
    else showHomepage();
  });
  bookingForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (continueButton.disabled || !validateCalendarForm(bookingForm) || !bookingForm.reportValidity()) return;
    const booking = Object.fromEntries(new FormData(bookingForm));
    const error = validateBooking(booking);
    bookingNote.textContent = error || '';
    bookingNote.hidden = !error;
    if (error) return;
    continueButton.disabled = true;
    try {
      const { createBookingDetails } = await import('./booking-details.js');
      if (!details || details.service !== booking.service || details.completed) {
        details?.element.remove();
        details = createBookingDetails(booking, backToBooking, syncHomepage);
        document.body.append(details.element);
      } else details.updateSchedule(booking);
      pagePosition = window.scrollY;
      history.pushState({liftcrewBooking: true}, '', location.href);
      showDetails();
    } catch {
      bookingNote.textContent = 'The booking form could not load. Please try again.';
      bookingNote.hidden = false;
    } finally {continueButton.disabled = false;}
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
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav?.classList.contains('open')){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation');toggle.focus();}});
}
