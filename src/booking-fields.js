import { CRANE_SERVICE } from './crane-fields.js';

export const bookingServices = ['Forklift only', 'Forklift with operator', CRANE_SERVICE];

// Every entry to the second step must have a complete homepage booking.
export function validateBooking(input, today = new Date()) {
  if (!input || !bookingServices.includes(input.service)) return 'Choose a service.';
  if (!/^\d{5}$/.test(input.location || '')) return 'Enter a five-digit ZIP code.';
  const days = Number(input.durationDays);
  if (!Number.isInteger(days) || days < 1 || days > 30) return 'Choose the number of days.';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ? new Date(input.date + 'T00:00:00Z') : null;
  const minimum = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.date || input.date < minimum) return 'Choose today or a future date.';
  return null;
}

export const forkliftSections = [
  {title: 'The load', fields: [
    {name: 'loadDescription', label: 'What are we lifting?', type: 'textarea', required: true, placeholder: 'Pallets, machinery, building materials…'},
    {name: 'loadWeight', label: 'Heaviest item (lb)', type: 'number', min: 1, max: 100000, required: true},
    {name: 'loadLengthIn', label: 'Load length (in, optional)', type: 'number', min: 1, max: 1200},
    {name: 'loadWidthIn', label: 'Load width (in, optional)', type: 'number', min: 1, max: 1200},
  ]},
  {title: 'The lift', fields: [
    {name: 'liftHeight', label: 'Maximum lift height (ft)', type: 'number', min: 0, max: 100, required: true},
  ]},
  {title: 'The site', fields: [
    {name: 'surface', label: 'Ground surface', options: ['Indoor smooth concrete', 'Outdoor paved', 'Outdoor gravel or uneven', 'Mixed indoor and outdoor'], required: true},
    {name: 'space', label: 'Working space', options: ['Open area', 'Narrow aisles', 'Not sure'], required: true},
    {name: 'entryWidth', label: 'Narrowest entry width (in, optional)', type: 'number', min: 1, max: 1200},
    {name: 'siteNotes', label: 'Access, obstacles & site requirements', type: 'textarea', placeholder: 'Doorways, slopes, trailer access, special handling…'},
  ]},
  {title: 'Your details', fields: [
    {name: 'name', label: 'Name', required: true, autocomplete: 'name'},
    {name: 'company', label: 'Company', autocomplete: 'organization'},
    {name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email'},
    {name: 'phone', label: 'Phone', type: 'tel', required: true, autocomplete: 'tel'},
  ]},
];
