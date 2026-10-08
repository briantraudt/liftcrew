import { SUPABASE_URL, SUPABASE_KEY } from './operator-config.js';
export async function loadCraneCatalog(){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/crane_catalog?select=source_class_code,title,crane_family,rated_capacity_lb,vertical_reach_ft,horizontal_reach_ft,boom_length_max_ft,max_tip_height_ft,source_url&source_page=eq.1&order=display_order.asc`,{headers:{apikey:SUPABASE_KEY},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('Crane catalog unavailable');
  const rows=await response.json();
  if(!Array.isArray(rows)||!rows.length)throw Error('Crane catalog unavailable');
  return rows;
}
