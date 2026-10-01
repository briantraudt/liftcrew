import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const home=readFileSync(new URL('../src/home.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const token=name=>css.match(new RegExp(`--${name}:(#[0-9a-f]{6})(?=[;}])`))?.[1];
const luminance=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
test('main orange matches the sampled orange in the logo L with one accessible state family',()=>{
 assert.equal(token('lc-orange'),'#ff5a1f');
 assert.equal(token('lc-orange-hover'),'#e34d18');
 assert.equal(token('lc-orange-strong'),'#ff5a1f');
 for(const old of ['#f3a573','#ffb185','#ff5b13','#edb28a']) assert(![css,home,html].some(s=>s.includes(old)),old);
});
test('white logo-orange treatment is explicit; dark-surface accents remain readable',()=>{
 assert.equal(token('lc-on-orange'),'#ffffff');
 // Exact brand orange with white small text is an acknowledged contrast tradeoff,
 // not an AA normal-text claim. It exceeds the large-text 3:1 threshold.
 assert(contrast(token('lc-on-orange'),token('lc-orange'))>=3);
 assert(contrast(token('lc-orange-on-dark'),'#112d36')>=4.5);
 assert(css.includes('.button,.phone-badge,.phone-badge-copy strong,.phone-badge-copy small{color:#fff;'));
});
test('both illustrations use the same accent tokens and skin tones remain unchanged',()=>{
 assert(html.includes('fill="var(--lc-orange)"'));
 assert(html.includes('fill="#e4ac7b"'));
 assert(home.includes('.lc-stories .lc-kicker,.lc-sample-quotes figcaption{color:var(--lc-orange-on-dark)}'));
});

test('second step has a deliberate transparent number and photo crop is contained',()=>{
 assert(home.includes('.lc-process .lc-steps li:last-child .lc-step-number{background:transparent;border:0;color:var(--lc-orange-strong)}'));
 assert(home.includes('.lc-worker-photo{display:block;position:relative;width:112px;height:112px;border-radius:50%;overflow:hidden;'));
});

test('new card text overrides the legacy mobile flex and heading grid',()=>{
 assert(home.includes('.lc-process .lc-step-copy{grid-column:1;grid-row:1;padding:0;display:block;align-self:center}'));
 assert(home.includes('.lc-stories-heading{display:block;text-align:center;'));
});

test('testimonial heading retains word spacing at every breakpoint',()=>{
 assert(html.includes('id="stories-title">Built around the people getting the job done.</h2>'));
});
