# Data Integrity & Provenance Validation Audit Report
*Generated: 2026-09-30T14:00:29.174Z*

## 1. Table-by-Table Provenance Breakdown

| Schema | Table | Total Rows | Real (%) | Derived (%) | Simulated (%) | Missing Origin | Status |
|---|---|---|---|---|---|---|---|
| `node_in_karnataka` | `phcs` | 164 | 100.0% | 0.0% | 0.0% | 0 | PASS |
| `node_in_karnataka` | `medicines` | 7 | 100.0% | 0.0% | 0.0% | 0 | PASS |
| `node_in_karnataka` | `weather_daily` | 6,920 | 100.0% | 0.0% | 0.0% | 0 | PASS |
| `node_in_karnataka` | `stock_levels` | 1,03,404 | 0.0% | 0.0% | 100.0% | 0 | PASS |
| `node_in_karnataka` | `bed_status` | 14,772 | 0.0% | 0.0% | 100.0% | 0 | PASS |
| `node_in_karnataka` | `staff_attendance` | 14,760 | 0.0% | 0.0% | 100.0% | 0 | PASS |
| `node_in_karnataka` | `patient_footfall` | 59,076 | 0.0% | 0.0% | 100.0% | 0 | PASS |
| `node_in_karnataka` | `redistribution_plans` | 4 | 0.0% | 100.0% | 0.0% | 0 | PASS |
| `node_in_karnataka` | `alerts` | 14 | 0.0% | 100.0% | 0.0% | 0 | PASS |
| `node_in_karnataka` | `briefings` | 6 | 0.0% | 100.0% | 0.0% | 0 | PASS |

## 2. Facility Geographic Boundary Sanity

| Node | Facilities Checked | Min Lat | Max Lat | Min Lng | Max Lng | Out-of-Bounds | Sanity Status |
|---|---|---|---|---|---|---|---|
| `node_in_karnataka` (Karnataka, India) | 164 | 11.8500° | 17.5858° | 74.3808° | 77.7983° | 0 | PASS (Valid) |

## 3. Facility Deduplication Audit

| Node | Total Facilities | Unique IDs | Duplicate IDs | Name Clashes (<100m) | Status |
|---|---|---|---|---|---|
| `node_in_karnataka` | 164 | 164 | 0 | 0 | PASS (Zero Duplicates) |

## 4. Temporal Span & Historical Date Coverage

| Node | Domain | Min Date | Max Date | Days Span | Coverage Target | Status |
|---|---|---|---|---|---|---|
| `node_in_karnataka` | Weather Archive | 2022-12-31 | 2026-09-28 | 1368 days | >= 3 Years (ERA5) | PASS |
| `node_in_karnataka` | Operational Stock | 2026-07-02 | 2026-09-30 | 91 days | >= 90 Days Telemetry | PASS |

## 5. Critical Column Null Rate Analysis

| Table | Evaluated Column | Total Tested | Null Count | Null Rate (%) | Tolerance | Status |
|---|---|---|---|---|---|---|
| `phcs` | `id` | 164 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `phcs` | `name` | 164 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `phcs` | `district` | 164 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `phcs` | `lat` | 164 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `phcs` | `lng` | 164 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `phcs` | `bed_capacity` | 164 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `phcs` | `data_origin` | 164 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `medicines` | `id` | 7 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `medicines` | `code` | 7 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `medicines` | `name` | 7 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `medicines` | `unit_cost` | 7 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `medicines` | `data_origin` | 7 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `weather_daily` | `time` | 6,920 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `weather_daily` | `district` | 6,920 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `weather_daily` | `precipitation_sum_mm` | 6,920 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `weather_daily` | `temperature_max_c` | 6,920 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `weather_daily` | `data_origin` | 6,920 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `stock_levels` | `time` | 1,03,404 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `stock_levels` | `phc_id` | 1,03,404 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `stock_levels` | `medicine_id` | 1,03,404 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `stock_levels` | `qty` | 1,03,404 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `stock_levels` | `days_of_cover` | 1,03,404 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |
| `stock_levels` | `data_origin` | 1,03,404 | 0 | 0.00% | 0.00% | PASS (0.00% Nulls) |