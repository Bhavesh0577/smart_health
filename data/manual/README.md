# Manual Dataset Intake Instructions

This directory (`data/manual/`) is reserved for datasets that require manual portal exports, CAPTCHA clearance, or government authentication. The data loaders in `scripts/` will automatically check this directory first before falling back to programmatic public mirrors.

---

## 1. All India Health Centres Directory (Karnataka PHC/CHC Master)
- **Source Portal:** [data.gov.in](https://data.gov.in/resource/all-india-health-centres-directory) / National Health Mission (NHM)
- **File Name:** `karnataka_health_centres_directory.csv` (or `.json`)
- **Required Columns:** `State_Name`, `District_Name`, `Facility_Type` (PHC, CHC, UPHC), `Facility_Name`, `Latitude`, `Longitude`
- **Destination:** `data/manual/karnataka_health_centres_directory.csv`
- **Fallback:** If not manually placed, `scripts/fetch-facilities.ts` automatically queries OpenStreetMap Overpass API (`healthcare=*`, `amenity=clinic|hospital`) and merges with the Lok Sabha official functional baseline.

---

## 2. NLEM 2022 Official Gazette Document
- **Source Portal:** [Ministry of Health and Family Welfare (MoHFW)](https://cdsco.gov.in/opencms/opencms/system/modules/CDSCO.WEB/elements/download_file_division.jsp?num_id=ODkxNQ==)
- **File Name:** `NLEM_2022_Official.pdf`
- **Destination:** `data/manual/NLEM_2022_Official.pdf`
- **Fallback:** The structured Primary Care extraction is programmatically provided in `data/processed/nlem_primary_care.json` with official page references.

---

## 3. Census of India 2011 District Population Tables (Karnataka)
- **Source Portal:** [Census of India 2011 Primary Census Abstract](https://censusindia.gov.in/census.website/)
- **File Name:** `karnataka_census_2011_pca.csv`
- **Destination:** `data/manual/karnataka_census_2011_pca.csv`
- **Fallback:** Curated 2011 Census district population records are maintained in `data/raw/population/karnataka_census_2011.json`.

---

## 4. IDSP Weekly Outbreak Surveillance Summaries
- **Source Portal:** [National Centre for Disease Control (NCDC) IDSP](https://idsp.mohfw.gov.in/)
- **File Name:** `idsp_karnataka_weekly_bulletins.csv`
- **Destination:** `data/manual/idsp_karnataka_weekly_bulletins.csv`
- **Fallback:** Seasonal epidemiology coefficients and outbreak threshold ratios are stored in `data/raw/seasonality/disease_seasonality_karnataka.json`.
