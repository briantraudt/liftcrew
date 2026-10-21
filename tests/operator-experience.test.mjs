import test from 'node:test';
import assert from 'node:assert/strict';
import {onboardingStages,stageForStep,machineRadius,priceWarnings,renewalAlerts,ratePreviewMarkup} from '../src/onboarding-experience.js';

test('four displayed stages preserve every original step exactly once',()=>{
 const ids=onboardingStages.flatMap(stage=>stage.steps);
 assert.deepEqual(ids,['business','equipment','operators','agreement','insurance','documents','finish']);
 assert.equal(stageForStep('insurance'),2);
 assert.equal(stageForStep('finish'),3);
});
test('a machine radius can narrow but never expand business-wide coverage',()=>{
 assert.equal(machineRadius(100,''),100);
 assert.equal(machineRadius(100,40),40);
 assert.equal(machineRadius(100,300),100);
 assert.equal(machineRadius(100,'invalid'),100);
 assert.equal(machineRadius(0,20),null);
});
test('pricing warnings are advisory, not rate rejection',()=>{
 assert.equal(priceWarnings({hourlyRate:100,fourHourRate:500,dailyRate:200}).length,2);
 assert.equal(priceWarnings({hourlyRate:100,fourHourRate:350,dailyRate:650}).length,0);
 assert.match(ratePreviewMarkup({hourlyRate:'25',fourHourRate:'95',dailyRate:'180'},100),/\$95\.00/);
 assert.doesNotMatch(ratePreviewMarkup({hourlyRate:'invalid'},100),/NaN/);
});
test('renewal notices show upcoming and overdue evidence without claiming approval',()=>{
 const now=new Date('2026-10-21T12:00:00Z');
 const profile={operators:[{name:'Alex',evaluationDate:'2023-11-01'}]};
 const docs=[{active:true,filename:'inspection.pdf',expires_on:'2026-10-19'}, {active:false,filename:'old.pdf',expires_on:'2020-01-01'}];
 const alerts=renewalAlerts(profile,docs,{validUntil:'2026-11-02'},now);
 assert.deepEqual(alerts.map(x=>x.label),['inspection.pdf','Verified insurance coverage / provider clearance','Practical evaluation — Alex']);
 assert.equal(alerts[0].severity,'urgent');
 assert.equal(alerts[1].severity,'soon');
 assert.equal(alerts[2].step,'operators');
});
