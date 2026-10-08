-- Page 1 is the first 25 cat-classes in the source listing (pageLength=25).
-- Catalog classes are reference data, not inventory or approved lift configurations.
create table if not exists public.crane_catalog (
 source_class_code text primary key,
 source text not null default 'United Rentals',
 source_page integer not null check (source_page = 1),
 display_order integer not null unique check (display_order between 1 and 25),
 title text not null,
 crane_family text not null check (crane_family in ('carry_deck','truck','mini_crawler','walk_behind','mobile','rough_terrain')),
 rated_capacity_lb integer not null check (rated_capacity_lb > 0),
 vertical_reach_ft numeric check (vertical_reach_ft > 0),
 horizontal_reach_ft numeric check (horizontal_reach_ft > 0),
 boom_length_min_ft numeric check (boom_length_min_ft > 0),
 boom_length_max_ft numeric check (boom_length_max_ft > 0),
 max_tip_height_ft numeric check (max_tip_height_ft > 0),
 fuel_options text[] not null default '{}',
 source_url text not null,
 source_listing_url text not null,
 source_checked_at timestamptz not null,
 spec_notes text not null
);
alter table public.crane_catalog enable row level security;
revoke all on public.crane_catalog from anon, authenticated;
grant select on public.crane_catalog to anon, authenticated;
grant all on public.crane_catalog to service_role;
create policy "Read crane reference catalog" on public.crane_catalog for select to anon, authenticated using (true);

create table if not exists public.crane_quote_requests (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 details jsonb not null check (
   jsonb_typeof(details) = 'object'
   and octet_length(details::text) <= 50000
   and details ?& array['service','name','email','phone','location','date','siteAddress','loadDescription']
   and details->>'service' = 'Crane with operator'
   and length(details->>'name') between 1 and 3000
   and length(details->>'siteAddress') between 1 and 3000
   and length(details->>'loadDescription') between 1 and 3000
   and details->>'location' ~ '^[0-9]{5}$'
   and details->>'email' ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 )
);
alter table public.crane_quote_requests enable row level security;
revoke all on public.crane_quote_requests from anon, authenticated;
grant insert (id,details) on public.crane_quote_requests to anon, authenticated;
grant all on public.crane_quote_requests to service_role;
create policy "Submit crane inquiry" on public.crane_quote_requests for insert to anon, authenticated with check (true);
-- Customer contact details are never publicly readable; admins review in Supabase.

insert into public.crane_catalog
select * from jsonb_populate_recordset(null::public.crane_catalog, $cranes$[
  {
    "source_class_code": "170-3220",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 1,
    "title": "Carry Deck Crane, 2.5 Tons",
    "crane_family": "carry_deck",
    "rated_capacity_lb": 5000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/carry-deck-crane-25-tons",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-3235",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 2,
    "title": "Carry Deck Crane, 4 Tons",
    "crane_family": "carry_deck",
    "rated_capacity_lb": 8000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/carry-deck-crane-4-tons",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-3280",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 3,
    "title": "Carry Deck Crane, 8.5-9 Tons",
    "crane_family": "carry_deck",
    "rated_capacity_lb": 18000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/carry-deck-crane-85-9-tons",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-4400",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 4,
    "title": "Carry Deck Crane, 15 Tons",
    "crane_family": "carry_deck",
    "rated_capacity_lb": 30000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/carry-deck-crane-15-tons",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-4410",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 5,
    "title": "Carry Deck Crane, 18 Tons, Diesel Powered",
    "crane_family": "carry_deck",
    "rated_capacity_lb": 36000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/carry-deck-crane-18-tons-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-4150",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 6,
    "title": "Crane Truck, 15 Tons, Diesel Powered",
    "crane_family": "truck",
    "rated_capacity_lb": 30000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-truck-15-tons-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-4170",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 7,
    "title": "Crane Truck, 17 Tons, Diesel Powered",
    "crane_family": "truck",
    "rated_capacity_lb": 34000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-truck-17-tons-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-4175",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 8,
    "title": "Crane Truck, 18 Tons, Diesel Powered",
    "crane_family": "truck",
    "rated_capacity_lb": 36000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-truck-18-tons-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-4235",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 9,
    "title": "Crane Truck, 23.5 Tons, Diesel Powered",
    "crane_family": "truck",
    "rated_capacity_lb": 47000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-truck-235-tons-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-4250",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 10,
    "title": "Crane Truck, 25 Tons, Diesel Powered",
    "crane_family": "truck",
    "rated_capacity_lb": 50000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": 92,
    "boom_length_max_ft": 136,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-truck-25-tons-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-7190",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 11,
    "title": "Crane Truck, 19 Tons, Gas or Diesel Powered",
    "crane_family": "truck",
    "rated_capacity_lb": 38000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "gas",
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-truck-19-tons-gas-or-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-0950",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 12,
    "title": "Mini Crawler Crane, 1.25 Tons, Hybrid",
    "crane_family": "mini_crawler",
    "rated_capacity_lb": 2645,
    "vertical_reach_ft": 35,
    "horizontal_reach_ft": 31,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "hybrid"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/mini-crawler-crane-125-tons-hybrid",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-0975",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 13,
    "title": "Mini Crawler Crane, 42 ft., 2 Tons, Electric Powered",
    "crane_family": "mini_crawler",
    "rated_capacity_lb": 3998,
    "vertical_reach_ft": 42.5,
    "horizontal_reach_ft": 34.5,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "electric"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/mini-crawler-crane-42-ft-2-tons-electric-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-1000",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 14,
    "title": "Mini Crawler Crane, 3 Tons",
    "crane_family": "mini_crawler",
    "rated_capacity_lb": 6450,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/mini-crawler-crane-3-tons",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-1050",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 15,
    "title": "Mini Crawler Crane, 4 Tons, Diesel Powered",
    "crane_family": "mini_crawler",
    "rated_capacity_lb": 8000,
    "vertical_reach_ft": 44.75,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/mini-crawler-crane-4-tons-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius. Source title says 4 tons; use-case text says 3 tons. Confirm actual model rating."
  },
  {
    "source_class_code": "170-2500",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 16,
    "title": "Walk-behind Crane, 15 ft., 4,500 lbs.",
    "crane_family": "walk_behind",
    "rated_capacity_lb": 4500,
    "vertical_reach_ft": 15,
    "horizontal_reach_ft": 9,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "battery"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/walk-behind-crane-15-ft-4500-lbs",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-3190",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 17,
    "title": "Crane, 30 Tons, Diesel Powered",
    "crane_family": "mobile",
    "rated_capacity_lb": 60000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-30-tons-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-4415",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 18,
    "title": "Crane Truck, 20 Tons, Diesel Powered, 4WD",
    "crane_family": "truck",
    "rated_capacity_lb": 40000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-truck-20-tons-diesel-powered-4wd",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-6015",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 19,
    "title": "Crane, 60 ft., 15 Tons, Rough Terrain, Diesel Powered",
    "crane_family": "rough_terrain",
    "rated_capacity_lb": 30000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": 60,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-60-ft-15-tons-rough-terrain-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-6030",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 20,
    "title": "Crane, 102 ft., 30 Tons, Rough Terrain, Diesel Powered",
    "crane_family": "rough_terrain",
    "rated_capacity_lb": 60000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": 102,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-102-ft-30-tons-rough-terrain-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-6035",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 21,
    "title": "Crane, 145 ft., 35 Tons, Rough Terrain, Diesel Powered",
    "crane_family": "rough_terrain",
    "rated_capacity_lb": 70000,
    "vertical_reach_ft": 145,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-145-ft-35-tons-rough-terrain-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-6050",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 22,
    "title": "Crane, 50 Tons, Rough Terrain, Diesel Powered",
    "crane_family": "rough_terrain",
    "rated_capacity_lb": 100000,
    "vertical_reach_ft": 145,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-50-tons-rough-terrain-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius. Some source models are rated 55 tons; catalog class is 50 tons."
  },
  {
    "source_class_code": "170-6060",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 23,
    "title": "Crane, 172 ft., 60 Tons, Rough Terrain, Diesel Powered",
    "crane_family": "rough_terrain",
    "rated_capacity_lb": 120000,
    "vertical_reach_ft": 172,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-172-ft-60-tons-rough-terrain-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-6070",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 24,
    "title": "Crane, 200 ft., 75 Tons, Rough Terrain, Diesel Powered",
    "crane_family": "rough_terrain",
    "rated_capacity_lb": 150000,
    "vertical_reach_ft": 200,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": 36,
    "boom_length_max_ft": 141,
    "max_tip_height_ft": null,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-200-ft-75-tons-rough-terrain-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  },
  {
    "source_class_code": "170-6075",
    "source": "United Rentals",
    "source_page": 1,
    "display_order": 25,
    "title": "Crane, 230 ft., 80 Tons, Rough Terrain, Diesel Powered",
    "crane_family": "rough_terrain",
    "rated_capacity_lb": 160000,
    "vertical_reach_ft": null,
    "horizontal_reach_ft": null,
    "boom_length_min_ft": null,
    "boom_length_max_ft": null,
    "max_tip_height_ft": 230.75,
    "fuel_options": [
      "diesel"
    ],
    "source_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes/crane-230-ft-80-tons-rough-terrain-diesel-powered",
    "source_listing_url": "https://www.unitedrentals.com/marketplace/equipment/material-handling/cranes?page=1",
    "source_checked_at": "2026-10-08T13:30:00Z",
    "spec_notes": "Published class maximums are separate limits, not capacity at a given radius."
  }
]
$cranes$::jsonb)
on conflict (source_class_code) do update set
 source=excluded.source, source_page=excluded.source_page, display_order=excluded.display_order,
 title=excluded.title, crane_family=excluded.crane_family, rated_capacity_lb=excluded.rated_capacity_lb,
 vertical_reach_ft=excluded.vertical_reach_ft, horizontal_reach_ft=excluded.horizontal_reach_ft,
 boom_length_min_ft=excluded.boom_length_min_ft, boom_length_max_ft=excluded.boom_length_max_ft,
 max_tip_height_ft=excluded.max_tip_height_ft, fuel_options=excluded.fuel_options,
 source_url=excluded.source_url, source_listing_url=excluded.source_listing_url,
 source_checked_at=excluded.source_checked_at, spec_notes=excluded.spec_notes;
