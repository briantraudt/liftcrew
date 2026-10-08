import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { bookingServices, forkliftSections, validateBooking } from '../src/booking-fields.js';
const today = new Date(2026, 9, 8);
const valid = {service:'Forklift with operator', location:'78701', date:'2026-10-12', durationDays:'2'};

test('both services require complete booking details before the second step', () => {
  for (const service of bookingServices) {
    assert.equal(validateBooking({...valid, service}, today), null);
    for (const key of ['location', 'date', 'durationDays']) assert(validateBooking({...valid, service, [key]:''}, today));
  }
  for (const [key, value] of [['service','Crane'], ['service','Forklift only'], ['location','7870'], ['date','2026-02-30'], ['date','2026-10-07'], ['date','invalid'], ['durationDays','1.5'], ['durationDays','31'], ['durationDays','0']]) {
    assert(validateBooking({...valid, [key]:value}, today), `${key}=${value} must not enter step two`);
  }
  assert.equal(validateBooking({...valid, date:'2026-10-08'}, today), null);
});

test('public booking pages are removed and legacy routes return to the homepage', () => {
  const root = new URL('../', import.meta.url);
  const config = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'));
  const sitemap = readFileSync(new URL('public/sitemap.xml', root), 'utf8');
  const build = readFileSync(new URL('vite.config.js', root), 'utf8');
  for (const page of ['quote', 'crane']) {
    assert(!existsSync(new URL(`${page}.html`, root)));
    assert(!sitemap.includes(`/${page}.html`));
    assert(!build.includes(`'${page}.html'`));
    for (const source of [`/${page}`, `/${page}.html`]) assert.equal(config.redirects.find(r => r.source === source)?.destination, '/#booking-form');
  }
});

test('forklift details retain every field required by the existing quote endpoint', () => {
  const fields = forkliftSections.flatMap(s => s.fields);
  for (const name of ['loadDescription', 'loadWeight', 'liftHeight', 'surface', 'space', 'name', 'email', 'phone']) {
    assert(fields.find(f => f.name === name)?.required, `${name} is required`);
  }
});
