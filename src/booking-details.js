import './booking-details.css';
import { CRANE_SERVICE, craneSections, validateCraneRequest } from './crane-fields.js';
import { forkliftSections, validateBooking } from './booking-fields.js';
import { loadCraneCatalog } from './crane-catalog.js';
import { suggestEquipment } from './catalog-data.js';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

function renderField(field) {
  const {name, label, type = 'text', required, unknown, options, placeholder = '', autocomplete = 'off', min, max, step = 'any'} = field;
  const attrs = `id="detail-${name}" name="${name}" ${required ? 'required' : ''} autocomplete="${autocomplete}"`;
  const control = options
    ? `<select ${attrs}><option value="">Select</option>${options.map(v => `<option>${esc(v)}</option>`).join('')}</select>`
    : type === 'textarea'
      ? `<textarea ${attrs} maxlength="3000" rows="2" placeholder="${esc(placeholder)}"></textarea>`
      : `<input ${attrs} type="${type}" ${type === 'number' ? `min="${min}" max="${max}" step="${step}"` : 'maxlength="3000"'} placeholder="${esc(placeholder)}">`;
  return `<div class="${type === 'textarea' || field.wide ? 'wide' : ''}"><label for="detail-${name}">${esc(label)}</label>${control}${unknown ? `<label class="unknown-option"><input type="checkbox" name="${name}Unknown" value="yes" data-unknown="${name}">Not sure</label>` : ''}${field.help ? `<details class="field-info"><summary>How to measure</summary><p>${esc(field.help)}</p></details>` : ''}</div>`;
}

export function createBookingDetails(booking, onBack, onScheduleChange) {
  const error = validateBooking(booking);
  if (error) throw Error(error);
  const isCrane = booking.service === CRANE_SERVICE;
  const sections = isCrane ? craneSections : forkliftSections;
  const label = isCrane ? 'Crane + Operator' : booking.service === 'Forklift with operator' ? 'Forklift + Operator' : 'Forklift Only';
  const element = document.createElement('div');
  element.className = 'booking-details-page';
  element.hidden = true;
  element.innerHTML = `<header class="details-header"><a class="brand" href="/" aria-label="LiftCrew home"><img src="/liftcrew-logo.png" alt="LiftCrew" width="1660" height="440"></a><a href="#booking-form" data-back>Back to booking</a></header>
    <main class="details-main"><div class="details-intro"><h1 tabindex="-1">Tell us about<br>your <em>lift.</em></h1><p>${label}</p></div>
    <form class="details-form" novalidate><input type="hidden" name="service" value="${esc(booking.service)}"><input class="honeypot" name="website" autocomplete="off" tabindex="-1" aria-hidden="true">
    <section class="details-card"><h2>Your booking</h2><div class="details-grid">
      <div><label for="detail-location">ZIP code</label><input id="detail-location" name="location" required pattern="[0-9]{5}" maxlength="5" inputmode="numeric" autocomplete="postal-code"></div>
      <div><label for="detail-date">Date</label><input id="detail-date" name="date" type="date" required></div>
      <div><label for="detail-durationDays">Number of days</label><select id="detail-durationDays" name="durationDays" required>${Array.from({length:30}, (_, i) => `<option value="${i + 1}">${i + 1} ${i ? 'days' : 'day'}</option>`).join('')}</select></div>
      ${isCrane ? '<div class="wide"><label for="detail-craneClass">Crane preference</label><select id="detail-craneClass" name="craneClass"><option value="">Help me choose</option></select><p class="field-note" data-catalog-note role="status"></p></div>' : ''}
    </div></section>
    ${sections.map(section => `<section class="details-card"><h2>${section.title}</h2><div class="details-grid">${section.fields.map(renderField).join('')}</div></section>`).join('')}
    ${isCrane ? '' : '<section class="details-card equipment-suggestion" hidden aria-live="polite"><h2>Suggested equipment</h2><strong></strong><p class="field-note"></p><a target="_blank" rel="noopener noreferrer" hidden>View equipment example</a></section>'}
    <div class="details-submit"><p>${isCrane ? 'We’ll confirm the unit after a load-chart and site review.' : 'We’ll confirm the unit after a load and site review.'}</p><button type="submit" class="button">Request Quote</button><p class="details-note" role="status" aria-live="polite"></p></div></form>
    <section class="details-card details-success" hidden tabindex="-1"><h2>Request received.</h2><p>We’ll review your lift and follow up with availability and a quote.</p><p data-reference></p><a class="button" href="#booking-form" data-back>Back to LiftCrew</a></section>
    </main><footer class="details-footer">© ${new Date().getFullYear()} LiftCrew</footer>`;

  const form = element.querySelector('form');
  const note = element.querySelector('.details-note');
  const submit = form.querySelector('[type=submit]');
  let completed = false;
  const today = new Date();
  form.elements.date.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  function updateSchedule(schedule) {
    const error = validateBooking(schedule);
    if (error || schedule.service !== booking.service) throw Error(error || 'Choose a service on the homepage.');
    for (const key of ['location', 'date', 'durationDays']) form.elements[key].value = schedule[key];
  }
  updateSchedule(booking);
  element.querySelectorAll('[data-back]').forEach(link => link.addEventListener('click', event => {event.preventDefault(); onBack();}));
  function syncSchedule() {
    const schedule = Object.fromEntries(new FormData(form));
    if (!validateBooking(schedule)) onScheduleChange(schedule);
  }
  for (const key of ['location', 'date', 'durationDays']) {
    form.elements[key].addEventListener('input', syncSchedule);
    form.elements[key].addEventListener('change', syncSchedule);
  }
  form.querySelectorAll('[data-unknown]').forEach(box => box.addEventListener('change', () => {
    const field = form.elements[box.dataset.unknown];
    field.disabled = box.checked;
    field.required = !box.checked;
  }));

  if (isCrane) {
    let catalog = [];
    const catalogNote = element.querySelector('[data-catalog-note]');
    loadCraneCatalog().then(rows => {
      catalog = rows;
      for (const row of rows) {
        const option = document.createElement('option');
        option.value = row.source_class_code;
        option.textContent = row.title;
        form.elements.craneClass.append(option);
      }
    }).catch(() => {catalogNote.textContent = 'We’ll help select the crane. Catalog preferences are temporarily unavailable.';});
    form.elements.craneClass.addEventListener('change', () => {
      const row = catalog.find(r => r.source_class_code === form.elements.craneClass.value);
      catalogNote.textContent = row ? `Listed capacity: ${row.rated_capacity_lb.toLocaleString()} lb${row.vertical_reach_ft ? ` · Vertical reach: ${row.vertical_reach_ft} ft` : ''}. Capacity varies with radius and configuration.` : '';
    });
  } else {
    let recommendationRequest = 0;
    form.addEventListener('change', async () => {
      const request = ++recommendationRequest;
      const payload = Object.fromEntries(new FormData(form));
      const box = element.querySelector('.equipment-suggestion');
      if (!['loadWeight', 'liftHeight', 'surface', 'space'].every(key => form.elements[key].value !== '' && form.elements[key].checkValidity())) {box.hidden = true; return;}
      try {
        const match = await suggestEquipment(payload);
        if (request !== recommendationRequest) return;
        box.hidden = !match;
        if (!match) return;
        box.querySelector('strong').textContent = match.title;
        box.querySelector('p').textContent = match.reason;
        const link = box.querySelector('a');
        link.hidden = !match.sourceUrl;
        if (match.sourceUrl) link.href = match.sourceUrl;
      } catch {if (request === recommendationRequest) box.hidden = true;}
    });
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled || !form.reportValidity()) return;
    const payload = Object.fromEntries(new FormData(form));
    const error = validateBooking(payload) || (isCrane ? validateCraneRequest(payload).error : null);
    if (error) {note.textContent = error; return;}
    submit.disabled = true;
    submit.textContent = 'Sending…';
    note.textContent = '';
    try {
      const response = await fetch(isCrane ? '/api/crane-quote' : '/api/quote', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      const result = await response.json();
      if (!response.ok || !result.ok) throw Error(result.error || 'We could not save your request. Please try again.');
      completed = true;
      form.hidden = true;
      const success = element.querySelector('.details-success');
      success.hidden = false;
      success.querySelector('[data-reference]').textContent = result.reference ? `Reference: ${result.reference}` : '';
      success.focus();
      success.scrollIntoView({block:'start', behavior:'smooth'});
    } catch (error) {
      note.textContent = error.message;
      submit.disabled = false;
      submit.textContent = 'Request Quote';
    }
  });

  return {element, service: booking.service, updateSchedule, syncSchedule, get completed() {return completed;}, focus() {element.querySelector('h1').focus({preventScroll:true});}};
}
