import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/home.css',import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const lower=html.slice(html.indexOf('<section class="lc-section'),html.indexOf('</main>'));
const originalNav='<nav class="nav" aria-label="Main navigation"><a href="#services">Services</a><a href="#industries">Industries</a><a href="#safety">Safety</a><a href="#how-it-works">How It Works</a><a href="#resources">Resources</a></nav>';
test('hero, header geometry, form and modal stay unchanged apart from section links',()=>{
  const protectedMarkup=html.slice(html.indexOf('<header'),html.indexOf('<section class="lc-section'))
    .replace('</a><span class="phone-badge"', '</a><button class="menu-toggle" aria-label="Open navigation" aria-expanded="false"><span></span><span></span><span></span></button>'+originalNav+'<span class="phone-badge"')
    .replace('class="explore-link" href="#how-it-works"','class="explore-link" href="#services"');
  assert.equal(hash(protectedMarkup),'7e1ae2e828eeb568b8f5bcc8c37ace4ad953eacf3bada4a6bab87959419ed549');
  assert.equal(hash(html.slice(html.indexOf('</main>'))),'c9acf4c033ed7f9dfbe0448f29bda31b96bc958076056d17cf8fa9b428d08609');
});
test('only requested compact sections remain below the hero',()=>{
  assert.deepEqual([...lower.matchAll(/<section[^>]* id="([^"]+)"/g)].map(m=>m[1]),['how-it-works','testimonials']);
  assert.equal((lower.match(/<footer/g)||[]).length,1);
  assert(!/star rating|five.star|trusted by|jobs completed|lc-close|lc-services|lc-industries|lc-resources/i.test(lower));
});
test('section anchors are unique and all local links resolve',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size);
  for(const [,href] of html.matchAll(/href="#([^"\s]+)"/g)) assert(ids.includes(href),`Missing target ${href}`);
  assert(!html.includes('aria-label="Main navigation"'));
  assert(!html.includes('class="menu-toggle"'));
});
test('two request steps are concise and honest',()=>{
  assert.equal((lower.match(/<li>/g)||[]).length,2);
  assert(lower.includes('Your submission is a request.'));
  assert(lower.includes('Nothing is booked until the details are confirmed.'));
  assert(!/bonded|insured|certified|guaranteed/i.test(lower));
});
test('footer returns to the original form without resetting its data',()=>{
  assert(lower.includes('class="lc-book-link" href="#booking-form"'));
  assert(!lower.includes('data-service='));
  assert(!lower.includes('<form'));
  assert(!lower.includes('↗')&&!lower.includes('↙'));
});
test('redesign CSS is isolated from hero, header and form classes',()=>{
  assert(!/\.(?:hero|site-header|header-inner|nav|booking-form|quote-modal|button)(?=[\s.:{,>])/m.test(css));
  assert(css.includes('@media(max-width:600px)'));
  assert(css.includes(':focus-visible'));
});
test('supporting labels remain at least 11px at default text size',()=>{
  for(const [,size] of css.matchAll(/font-size:(\.[0-9]+)rem/g)) assert(Number(size)>=.6875);
});
test('body copy and supporting labels meet contrast requirements',()=>{
  const luminance=hex=>{const rgb=hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  for(const [fg,bg] of [['53635b','f8f8f2'],['5e7064','f8f8f2'],['9cb5b2','112d36'],['edf5ed','112d36'],['fffaf4','b94d22'],['17363e','f3a573'],['713c24','f8dfcc'],['edb28a','183c43'],['e4c7ac','183c43'],['d5e2dc','183c43'],['f5f7ef','183c43']]){const a=luminance(fg),b=luminance(bg);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5);}
});

test('testimonial samples are visibly disclosed and never presented as real endorsements',()=>{
  assert(lower.includes('Illustrative placeholders — not real customer reviews'));
  assert.equal((lower.match(/SAMPLE COPY · NOT A CUSTOMER REVIEW/g)||[]).length,2);
  const samples=lower.slice(lower.indexOf('id="testimonials"'),lower.indexOf('<footer'));
  assert(!/<form|aggregateRating|itemReviewed|ratingValue/i.test(samples));
  assert.equal((samples.match(/class="lc-worker-portrait/g)||[]).length,2);
  assert.equal((samples.match(/Fictional name · illustrative stock photo/g)||[]).length,2);
});
test('site-wide safety palette changes colors without modifying hero layout or image',()=>{
  const shared=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
  const theme=shared.split('/* Safety-led site palette:')[1];
  assert(theme);
  assert(!/[;{]\s*(?:padding|margin|width|height|display|position|grid-template|font-size|background-image)\s*:/.test(theme));
  assert(!theme.includes('url('));
  assert(theme.includes('background-color:#112d36'));
  assert(theme.includes('.phone-badge{background:var(--lc-orange)'));
});

test('calendar selection styling never recolors the enhanced booking form',()=>{
  const theme=readFileSync(new URL('../src/style.css',import.meta.url),'utf8').split('/* Safety-led site palette:')[1];
  assert(!theme.includes('.calendar-ready'));
  assert(theme.includes('.calendar-day.selected,.calendar-day[aria-selected="true"]{background:var(--lc-orange-strong)'));
  assert(theme.includes('.hero-booking,.hero-quote,.quote-modal-panel,.lift-calendar{background:#f7f8f1'));
});

test('removed safety section leaves no homepage links or orphaned styles',()=>{
  assert(!/id="safety(?:-title)?"|href="#safety"|lc-safety|Plan the lift\.|SAFETY COMES FIRST/.test(html));
  assert(!css.includes('lc-safety'));
});

test('process illustrations match the two steps and stay decorative',()=>{
  const process=lower.slice(0,lower.indexOf('id="testimonials"'));
  assert.equal((process.match(/class="lc-step-art"/g)||[]).length,2);
  assert.equal((process.match(/viewBox="0 0 200 126" fill="none" aria-hidden="true" focusable="false"/g)||[]).length,2);
  assert(process.includes('<ol class="lc-steps">'));
  assert.deepEqual([...process.matchAll(/<h3>(.*?)<\/h3>/g)].map(m=>m[1]),['Call or book online','Your forklift and operator arrive']);
  assert(process.includes('data-illustration="phone-booking"'));
  assert(process.includes('data-illustration="forklift-operator"'));
  assert(!/When &amp; where|A few job details|We confirm the plan|Three clear steps|href="tel:/.test(process));
  assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
  assert.equal((process.match(/class="lc-step-number"/g)||[]).length,2);
  assert(!process.includes('<button'));
});
test('testimonial bubbles put a labeled sample name and quote after each portrait',()=>{
  assert.equal((lower.match(/class="lc-testimonial-card"/g)||[]).length,2);
  assert(lower.includes('Alex R. <span>(sample)</span>'));
  assert(lower.includes('Taylor M. <span>(sample)</span>'));
  assert(lower.includes('Stock models, fictional names and sample quotes.'));
  assert(css.includes('border-radius:50%'));
  assert(css.includes('.lc-testimonial-cards{grid-template-columns:1fr'));
});

test('every HTML page resolves its local links and fragments',()=>{
  const root=new URL('../',import.meta.url);
  for(const page of readdirSync(root).filter(name=>name.endsWith('.html'))){
    const source=readFileSync(new URL(page,root),'utf8');
    assert(!source.includes('href="/#safety"'),`${page} retains removed Safety navigation`);
    for(const [,href] of source.matchAll(/<a\b[^>]*href="([^"]+)"/g)){
      const url=new URL(href,`https://www.myliftcrew.com/${page}`);
      if(url.origin!=='https://www.myliftcrew.com')continue;
      const path=url.pathname==='/'?'index.html':url.pathname.slice(1);
      const file=new URL(path,root);
      assert(existsSync(file),`${page}: missing page ${href}`);
      if(url.hash && url.hash!=='#'){
        const target=readFileSync(file,'utf8');
        const ids=[...target.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
        assert(ids.includes(decodeURIComponent(url.hash.slice(1))),`${page}: missing fragment ${href}`);
      }
    }
  }
});
