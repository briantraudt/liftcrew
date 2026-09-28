import { matchCatalog } from './catalog-match.js';
import { recommendEquipment } from './equipment.js';
const endpoint='https://exokcxcxmmsnqejzhxwf.supabase.co/rest/v1/equipment_catalog?select=source_class_code,title,use_case,capacity_max_lb,max_fork_height_in,fuel_options,tire_options,features,source_url,example_model,example_matches_class&source=eq.United%20Rentals&order=capacity_max_lb.asc&limit=100';
const publishableKey='sb_publishable_CQ_TrF_hh8Lss9zmt6fh9Q_xNIbeHnk';
let cache;
export async function loadEquipmentCatalog(){
  if(!cache)cache=fetch(endpoint,{headers:{apikey:publishableKey}}).then(async response=>{if(!response.ok)throw Error('Equipment catalog unavailable');return response.json()}).catch(()=>{cache=null;return null});
  return cache;
}
export async function suggestEquipment(input){
  const rows=await loadEquipmentCatalog();
  return rows?matchCatalog(input,rows):recommendEquipment(input);
}
