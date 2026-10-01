import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const home=readFileSync(new URL('../src/home.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const token=name=>css.match(new RegExp(`--${name}:(#[0-9a-f]{6})(?=[;}])`))?.[1];
const luminance=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
test('main orange matches the established logo hue with one accessible state family',()=>{
 assert.equal(token('lc-orange'),'#ff5b13');
 assert.equal(token('lc-orange-hover'),'#ff7938');
 assert.equal(token('lc-orange-strong'),'#ad4317');
 for(const old of ['#f3a573','#ffb185','#b94d22','#edb28a']) assert(![css,home,html].some(s=>s.includes(old)),old);
});
test('normal and hover actions and small labels meet text contrast',()=>{
 for(const [a,b] of [[token('lc-on-orange'),token('lc-orange')],[token('lc-on-orange'),token('lc-orange-hover')],[token('lc-orange-strong'),'#f7f8f1'],[token('lc-orange-hover'),'#183c43']]) assert(contrast(a,b)>=4.5,`${a} on ${b}`);
});
test('both illustrations use the same accent tokens and skin tones remain unchanged',()=>{
 assert(html.includes('fill="var(--lc-orange)"'));
 assert(html.includes('fill="#e4ac7b"'));
 assert(home.includes('.lc-stories .lc-kicker,.lc-sample-quotes figcaption{color:var(--lc-orange-hover)}'));
});
