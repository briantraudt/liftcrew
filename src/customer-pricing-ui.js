// Display server-calculated pricing only. Never calculate or trust a price from browser fields.
const currency=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const money=value=>Number.isFinite(Number(value))?currency.format(Number(value)):'—';

export function attachPricingPreview(form,box){
 if(!box)return ()=>{};
 const output=box.querySelector('[data-price-output]');
 const create=(tag,cls,content)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=String(content);return el;};
 let generation=0,timer;
 function clear(message){output.replaceChildren(create('p','field-note',message));}
 function draw(quote){
  if(quote?.status!=='matched'){clear(quote?.message||'Pricing will be confirmed by LiftCrew.');return;}
  const distance=Number(quote.distanceMiles);
  const days=Number(quote.durationDays);
  const equipment=quote.equipment||{},rates=quote.rates||{},totals=quote.totals||{};
  const title=create('p','price-equipment',[(equipment.make||''),(equipment.model||'')].filter(Boolean).join(' ')||equipment.category||'Nearby equipment');
  const detail=create('p','field-note',(equipment.category||'Equipment')+' · approximately '+distance.toFixed(1)+' miles from your ZIP code');
  const grid=create('div','price-estimate-grid');
  for(const [label,rate,total] of [
   ['Hourly',rates.hourly,days===1?totals.hourly:null],
   ['Half-day (4 hours)',rates.fourHour,days===1||days===0.5?totals.fourHour:null],
   ['Daily',rates.daily,days===0.5?null:totals.daily]
  ]){
   const card=create('div','price-estimate-option');
   card.append(create('span','price-estimate-label',label),create('strong','',money(rate)+(label==='Daily'?' / day':'')));
   if(total!==null)card.append(create('small','',label==='Daily'&&days>1?days+' days + delivery: '+money(total):'Including delivery: '+money(total)));
   grid.append(card);
  }
  if(days===0.5)grid.append(create('p','field-note','Four-hour equipment rate, plus applicable delivery.'));
  const fee=create('p','price-delivery',Number(quote.deliveryFee)>0?'Estimated round-trip travel: '+money(quote.deliveryFee)+' · '+Number(quote.excessRoundTripMiles).toFixed(1)+' billable miles × $2':'Estimated round-trip travel: Free within 25 miles');
  const foot=create('p','field-note',quote.basis||'Estimated using ZIP centers; final road mileage and availability must be confirmed.');
  output.replaceChildren(title,detail,grid,fee,foot);
 }
 function schedule(){
  const version=++generation;clearTimeout(timer);
  const service=form.elements.service?.value;
  if(service==='Crane with operator'){clear('Crane equipment and pricing require a specialty review. Request a quote and we will confirm availability and travel.');return;}
  const location=form.elements.location?.value||'';
  const weight=Number(form.elements.loadWeight?.value),height=Number(form.elements.liftHeight?.value),durationDays=Number(form.elements.durationDays?.value);
  if(!/^\d{5}$/.test(location)||!weight||weight<=0||!height||height<=0||!durationDays){
   clear('Enter your ZIP code, load weight and lift height to check nearby approved equipment and estimated delivery.');return;
  }
  clear('Checking qualified equipment near your ZIP…');
  timer=setTimeout(async()=>{
   try{
    const response=await fetch('/api/equipment-pricing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service,location,loadWeight:String(weight),liftHeight:String(height),durationDays:String(durationDays)})});
    const result=await response.json();
    if(version!==generation||!box.isConnected)return;
    if(!response.ok||!result.ok)throw Error(result.error||'Pricing is unavailable.');
    draw(result.quote);
   }catch(error){if(version===generation&&box.isConnected)clear('Live pricing is unavailable. You can still submit your quote request.');}
  },350);
 }
 form.addEventListener('input',event=>{if(['location','loadWeight','liftHeight','durationDays'].includes(event.target.name))schedule();});
 form.addEventListener('change',event=>{if(['location','loadWeight','liftHeight','durationDays'].includes(event.target.name))schedule();});
 return schedule;
}
