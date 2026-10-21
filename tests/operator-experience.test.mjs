import test from 'node:test';
import assert from 'node:assert/strict';
import {onboardingStages,stageForStep,machineRadius,businessRadiusForMachines,priceWarnings,renewalAlerts,ratePreviewMarkup} from '../src/onboarding-experience.js';

test('four displayed stages preserve every original step exactly once',()=>{
 const ids=onboardingStages.flatMap(stage=>stage.steps);
 assert.deepEqual(ids,['business','equipment','operators','insurance','documents','agreement','finish']);
 assert.equal(stageForStep('insurance'),2);
 assert.equal(stageForStep('finish'),3);
});
test('each machine radius is independent and legacy radius is a fallback',()=>{
 assert.equal(machineRadius(100,''),100);
 assert.equal(machineRadius(100,40),40);
 assert.equal(machineRadius(100,300),300);
 assert.equal(machineRadius(100,'invalid'),100);
 assert.equal(machineRadius(100,'1e2'),100);
 assert.equal(machineRadius(0,20),20);
});
test('the legacy ceiling follows the largest machine radius without expanding individual machines',()=>{
 const p={business:{radiusMiles:50},equipment:[{radiusMilesOverride:25},{radiusMilesOverride:75}]};
 assert.equal(businessRadiusForMachines(p),75);
 assert.equal(machineRadius(75,25),25);
 assert.equal(businessRadiusForMachines({business:{radiusMiles:50},equipment:[{}]}),50);
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
 assert.deepEqual(alerts.map(x=>x.label),['inspection.pdf','Practical evaluation — Alex','Verified insurance coverage / provider clearance']);
 assert.equal(alerts[0].severity,'urgent');
 assert.equal(alerts[1].severity,'soon');
 assert.equal(alerts[1].step,'operators');
});
