import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderAgreementPreview} from '../src/agreement-preview.js';

test('full published agreement is visible, even without a personalized application',()=>{
 const contract='PUBLIC CONTRACT HEADER\n\n'+('full agreement clause\n').repeat(400);
 const html=renderAgreementPreview({body:contract,version:'published-v2'});
 assert(html.includes('Published terms — read-only preview'));
 assert(html.includes('PUBLIC CONTRACT HEADER'));
 assert(html.includes(contract.trimEnd()));
 assert(html.includes('Complete provider agreement, read only'));
 assert(!html.includes('data-sign-contract'));
});

test('published agreement preview escapes HTML and does not synthesize a signature',()=>{
 const html=renderAgreementPreview({body:'Full contract <script>alert(1)</script> \\ {signature}',version:'v2'});
 assert(html.includes('&lt;script&gt;'));
 assert(!html.includes('<script>'));
 assert(!html.includes('data-prepare'));
 assert(!html.includes('data-sign-contract'));
});

test('operator portal fetches full published text separately from personalized envelope',()=>{
 const js=readFileSync(new URL('../src/operators.js',import.meta.url),'utf8');
 assert(js.includes("db.rpc('current_provider_agreement')"));
 assert(js.includes('validatePublishedAgreement'));
 assert(js.includes("crypto.subtle.digest('SHA-256'"));
 assert(js.includes('const preview=envelope?.body?envelope:publishedAgreement'));
 assert(js.includes('beforeAgreementIssues()'));
 assert(js.includes('if(issues.length)return heading+visibleTerms'));
 assert(js.includes("step=stepIds.indexOf('finish')"));
});

test('business form and portal heading are not duplicated',()=>{
 const source=readFileSync(new URL('../src/onboarding-ui.js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../src/operators.js',import.meta.url),'utf8');
 assert(!source.includes('<h2>Your business</h2>'));
 assert(!source.includes('Tell us who operates your business'));
 assert(page.includes('Join the LiftCrew family'));
 assert(!page.includes('Join the LiftCrew network'));
});

test('personalized agreement hides preparation caption and version while retaining complete terms',()=>{
 const body='Complete synthetic agreement';
 const html=renderAgreementPreview({body,version:'provider-unique-version'},{personalized:true});
 assert(html.includes(body));
 assert(!html.includes('Prepared for your business'));
 assert(!html.includes('provider-unique-version'));
 assert(html.includes('aria-label="Complete provider agreement, read only"'));
});
