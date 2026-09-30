import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/home.css',import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const lower=html.slice(html.indexOf('<section class="lc-section'),html.indexOf('</main>'));
test('original header, hero, booking form, and booking modal stay byte-identical',()=>{
  assert.equal(hash(html.slice(html.indexOf('<header'),html.indexOf('<section class="lc-section'))),'7e1ae2e828eeb568b8f5bcc8c37ace4ad953eacf3bada4a6bab87959419ed549');
  assert.equal(hash(html.slice(html.indexOf('</main>'))),'c9acf4c033ed7f9dfbe0448f29bda31b96bc958076056d17cf8fa9b428d08609');
});
test('homepage section anchors are unique and all local links resolve',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,'IDs must be unique');
  for(const anchor of ['services','industries','safety','how-it-works','resources','use-cases','booking-form','top']) assert(ids.includes(anchor));
  for(const [,href] of lower.matchAll(/href="([^"]+)"/g)){
    if(href.startsWith('#')) assert(ids.includes(href.slice(1)),`Missing target ${href}`);
    else if(href.startsWith('/')) assert(existsSync(new URL('..'+href,import.meta.url)),`Missing file ${href}`);
  }
});
test('service choices feed the original booking selection values',()=>{
  const values=[...lower.matchAll(/data-service="([^"]+)"/g)].map(m=>m[1]);
  assert(values.includes('Forklift only'));assert(values.includes('Forklift with operator'));
  assert(values.every(v=>['Forklift only','Forklift with operator'].includes(v)));
  for(const match of lower.matchAll(/<a\b[^>]*data-service[^>]*>/g)) assert(match[0].includes('href="#booking-form"'));
});
test('FAQs remain native keyboard-operable disclosures and request status is explicit',()=>{
  assert.equal((lower.match(/<details>/g)||[]).length,7);
  assert.equal((lower.match(/<summary>/g)||[]).length,7);
  assert(lower.includes('Your online submission is a request.'));
  assert(lower.includes('An agent confirms pricing before you commit'));
  assert(!/testimonial|star rating|five.star|trusted by|jobs completed/i.test(lower));
});
test('redesign CSS is isolated from protected hero, header and form classes',()=>{
  assert(!/\.(?:hero|site-header|header-inner|nav|booking-form|quote-modal|button)(?=[\s.:{,>])/m.test(css));
  assert(css.includes('@media(max-width:600px)'));
  assert(css.includes('@media(prefers-reduced-motion:reduce)'));
  assert(css.includes(':focus-visible'));
});
test('illustration is local, lightweight, and decorative',()=>{
  assert(lower.includes('src="/lift-plan.svg" alt=""'));
  const svg=readFileSync(new URL('../public/lift-plan.svg',import.meta.url),'utf8');
  assert(svg.length<10000);assert(!/<script|https?:/i.test(svg.replace('http://www.w3.org/2000/svg','')));
});
test('small lower-page copy uses accessible contrast against its surface',()=>{
  const luminance=hex=>{const rgb=hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  const pairs=[['53615f','ffffff'],['53615f','f5f5ef'],['61706c','f5f5ef'],['62776b','ffffff'],['606f67','ffffff'],['5c7163','f0f2ea'],['bdd0d0','102d36'],['8da8ac','0c212a'],['302820','ed7138'],['ffffff','bd430b']];
  for(const [fg,bg] of pairs){const a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert(ratio>=4.5,`${fg} on ${bg}: ${ratio.toFixed(2)}`);}
});
