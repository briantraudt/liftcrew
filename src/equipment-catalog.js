// Representative manufacturer families and links to their specifications and photos.
// These are examples, not an inventory feed or a rating for a particular truck.
export const equipmentCatalog = [
  {id:'electric-counterbalance',name:'Electric counterbalance forklift',environment:'Indoor smooth concrete',capacityRangeLb:[3000,6500],example:'Toyota Core Electric Forklift',sourceUrl:'https://www.toyotaforklift.com/lifts/electric-motor-rider-forklifts/core-electric-forklift'},
  {id:'large-electric',name:'Large electric forklift',environment:'Indoor smooth concrete',capacityRangeLb:[8000,12000],example:'Toyota Large Electric Forklift',sourceUrl:'https://www.toyotaforklift.com/lifts/electric-motor-rider-forklifts/large-electric-forklift'},
  {id:'electric-pneumatic',name:'Electric pneumatic tire forklift',environment:'Mixed indoor and outdoor',capacityRangeLb:[4000,17500],example:'Toyota 80V Electric Pneumatic Forklift',sourceUrl:'https://www.toyotaforklift.com/lifts/electric-motor-rider-forklifts/80v-electric-pneumatic-forklift'},
  {id:'ic-pneumatic',name:'Pneumatic tire forklift',environment:'Outdoor paved',capacityRangeLb:[3000,6500],example:'Toyota Core IC Pneumatic Forklift',sourceUrl:'https://www.toyotaforklift.com/lifts/internal-combustion-forklifts-pneumatic-tire/core-ic-pneumatic-forklift'},
  {id:'large-ic-pneumatic',name:'Large pneumatic tire forklift',environment:'Outdoor paved',capacityRangeLb:[13500,17500],example:'Toyota Large IC Pneumatic Forklift',sourceUrl:'https://www.toyotaforklift.com/lifts/internal-combustion-forklifts-pneumatic-tire/large-ic-pneumatic-forklift'},
  {id:'reach-truck',name:'Electric reach truck',environment:'Indoor smooth concrete',capacityRangeLb:[2500,4500],example:'Toyota Reach Truck',sourceUrl:'https://www.toyotaforklift.com/lifts/electric-reach-trucks/reach-truck'},
  {id:'rough-terrain',name:'Rough terrain forklift',environment:'Outdoor gravel or uneven',capacityRangeLb:null,example:'Manitou M 30-4',sourceUrl:'https://www.manitou.com/en-US/our-machines/mast-forklifts/m-30-4-1'},
  {id:'heavy-capacity',name:'Heavy capacity forklift',environment:'Specialized',capacityRangeLb:null,example:'Toyota High-Capacity IC Pneumatic',sourceUrl:'https://www.toyotaforklift.com/lifts/heavy-duty-forklifts/high-capacity-ic-pneumatic'}
];
export const catalogItem=id=>equipmentCatalog.find(item=>item.id===id);
