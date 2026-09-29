# Data Sources & Provenance Registry
> **PHC Resilience Grid — BRICS Track 3: Smart Health & Supply Chain Resilience**  
> *Authoritative inventory of public data sources, licenses, collection methodologies, and known limitations.*

---

## Provenance Classification Standards
Every data table, API response, and visualization metric in the platform carries an explicit `data_origin` tag:
- **`real`**: Direct unadulterated ingestion from public government portals, open spatial databases, or weather sensors.
- **`derived`**: Deterministic mathematical calculations, solver outputs, aggregations, or algorithms computed over real data.
- **`simulated`**: Honestly calibrated synthetic time-series generated from real geographic, demographic, and meteorological baselines.

---

## 1. Open-Meteo Historical Weather Archive & 16-Day Forecast API
- **Source Name:** Open-Meteo Historical Weather Archive & Operational Forecast
- **Source URL:** [https://open-meteo.com/](https://open-meteo.com/) (Archive: `https://archive-api.open-meteo.com/v1/archive`, Forecast: `https://api.open-meteo.com/v1/forecast`)
- **License / Terms of Use:** Attribution 4.0 International (CC BY 4.0). Free non-commercial and commercial use permitted under standard API rate limits.
- **Date Fetched:** 2026-09-30 (Updated daily / cached locally)
- **Local Cache Path:** `data/raw/weather/karnataka_weather_daily.json`
- **Application in Platform:**
  - Ingested directly into `weather_daily` table with `data_origin: "real"`.
  - Daily precipitation (mm) and temperature extremes (max/min °C) from 2023 to present across Karnataka district centroids, Bahia, and KwaZulu-Natal.
  - Used as an input feature vector in the parametric Ridge demand forecasting model and the CUSUM epidemic anomaly detector (rainfall-lagged diarrhea & vector fever spikes).
- **Known Limitations:** Spatial grid resolution of 0.25° (~25 km) derived from ECMWF ERA5 reanalysis and GFS weather models. Micro-climate cloudbursts in deep Western Ghats valleys (e.g. Shiradi/Sampaje) are interpolated between grid nodes.

---

## 2. OpenStreetMap Healthcare Features (Karnataka Master)
- **Source Name:** OpenStreetMap Healthcare Facilities (Karnataka Bounding Geometry)
- **Source URL:** [https://overpass-api.de/](https://overpass-api.de/) via Overpass QL Query (`healthcare=*`, `amenity=clinic|hospital`)
- **License / Terms of Use:** Open Database License (ODbL) 1.0 by the OpenStreetMap Foundation. Attribution: *"© OpenStreetMap contributors"*.
- **Date Fetched:** 2026-09-30
- **Local Cache Path:** `data/raw/facilities/karnataka_osm_facilities.json`
- **Application in Platform:**
  - Provides real facility names, administrative districts, spatial coordinates (lat/lng), and facility tiers (PHC, CHC, UPHC) for all 5 focus districts (Bengaluru Urban, Belagavi, Kalaburagi, Mysuru, Dakshina Kannada) and wider Karnataka.
  - Stored in `phcs` table with `data_origin: "real"` and `source_dataset: "osm_overpass_healthcare"`.
- **Known Limitations:** Crowdsourced spatial coverage may have minor spelling variations across Kannada-English transliterations. Deduplicated via Haversine distance threshold (500m) and verified against official district gazettes.

---

## 3. Lok Sabha Official Health Facility Census (Unstarred Question 1924)
- **Source Name:** Lok Sabha Unstarred Question No. 1924 (Answered on 6 Dec 2024, Annexure I)
- **Authority:** Ministry of Health and Family Welfare (MoHFW), Government of India
- **Source URL:** [Parliament of India Question Search](https://sansad.in/ls/questions/questions-and-answers) / MoHFW Rural Health Statistics (RHS)
- **License / Terms of Use:** Government Open Data (Official Parliamentary Record / Gazette of India)
- **Date Fetched:** 2026-09-30
- **Local Path:** `docs/RECONCILIATION.md`
- **Application in Platform:**
  - Serves as the authoritative ground-truth validation benchmark for functional PHCs (2,359 functional rural PHCs and 207 functional CHCs in Karnataka as of 31 March 2023).
  - Used to generate the official facility reconciliation report (`docs/RECONCILIATION.md`).
- **Known Limitations:** Official parliamentary returns reflect functional status as of 31 March 2023. Newly constructed Health and Wellness Centres (Ayushman Arogya Mandirs) commissioned in late 2023–2024 are cataloged under primary care extensions.

---

## 4. National List of Essential Medicines 2022 (NLEM 2022)
- **Source Name:** National List of Essential Medicines (NLEM 2022), Government of India
- **Authority:** Standing National Committee on Medicines (SNCM) / Central Drugs Standard Control Organisation (CDSCO)
- **Source URL:** [https://cdsco.gov.in/](https://cdsco.gov.in/)
- **License / Terms of Use:** Public domain government health document
- **Date Fetched:** 2026-09-30
- **Local Cache Path:** `data/processed/nlem_primary_care.json`
- **Application in Platform:**
  - Ingested directly into `medicines` table with `data_origin: "real"` and `source_dataset: "nlem_2022"`.
  - Restricts medicine catalog to primary healthcare level ("P" level of care):
    - Paracetamol 500mg Tablets (NLEM Section 2.1, Analgesics, p. 12)
    - Amoxicillin 500mg Capsules (NLEM Section 6.2, Beta-lactam Antibiotics, p. 28)
    - Azithromycin 500mg Tablets (NLEM Section 6.3, Macrolides, p. 34)
    - Oral Rehydration Salts 21g Sachets (NLEM Section 26.2, Electrolyte Solutions, p. 118)
    - Iron & Folic Acid Tablets (NLEM Section 10.1, Antianemia Preparations, p. 52)
    - Artemether-Lumefantrine 80/480mg Tablets (NLEM Section 6.5, Antimalarials, p. 41)
    - Insulin Regular 100 IU/mL Vials (NLEM Section 18.5, Insulins, p. 86)
- **Known Limitations:** Specifies generic chemical entities, strengths, and primary level classification, but leaves packaging unit costs to state procurement tender variations (KDLWS rate contracts).

---

## 5. Census of India 2011 District Populations (Karnataka)
- **Source Name:** Primary Census Abstract (PCA), Census of India 2011
- **Authority:** Office of the Registrar General & Census Commissioner, Ministry of Home Affairs, Government of India
- **Source URL:** [https://censusindia.gov.in/](https://censusindia.gov.in/)
- **License / Terms of Use:** Open Government Data (OGD) License India
- **Date Fetched:** 2026-09-30
- **Local Cache Path:** `data/raw/population/karnataka_census_2011.json`
- **Application in Platform:**
  - Used to derive facility-level catchment populations:
    $$\text{Catchment Population}_{\text{PHC}} = \frac{\text{District Population}}{\text{Total Functional PHCs in District}}$$
  - Stored in `phcs.catchment_population` with `data_origin: "derived"`.
- **Known Limitations:** Decennial Census 2011 is the most recent complete official enumeration. Figures represent baseline population without inter-censal rural-to-urban migration adjustments.

---

## 6. Integrated Disease Surveillance Programme (IDSP) Seasonality Parameters
- **Source Name:** IDSP Weekly Outbreak Surveillance Summaries & NVBDCP Reports
- **Authority:** National Centre for Disease Control (NCDC), MoHFW, New Delhi
- **Source URL:** [https://idsp.mohfw.gov.in/](https://idsp.mohfw.gov.in/)
- **License / Terms of Use:** Public health epidemiological surveillance reports
- **Date Fetched:** 2026-09-30
- **Local Cache Path:** `data/raw/seasonality/disease_seasonality_karnataka.json`
- **Application in Platform:**
  - Calibrates seasonal epidemic surge coefficients:
    - Coastal monsoon diarrheal spike: $2.4\times$ multiplier in Dakshina Kannada (June–September)
    - Post-monsoon vector-borne fever surge: $2.8\times$ antimalarial demand in Kalaburagi/Belagavi (July–October)
    - Festival mobility bumps: $1.3\times$ OPD demand during Dasara/Diwali
  - Stored as calibration priors for the operational telemetry simulator, flagged `data_origin: "real"` (parameters) and `data_origin: "simulated"` (generated daily records).
- **Known Limitations:** Represents macro-epidemiological parameters rather than facility-specific patient files to prevent privacy violations.

---

## 7. Brazil CNES / OpenStreetMap Healthcare (Bahia Node)
- **Source Name:** Cadastro Nacional de Estabelecimentos de Saúde (CNES / DATASUS) & OSM Bahia
- **Authority:** Ministério da Saúde, Governo Federal do Brasil
- **Source URL:** [https://datasus.saude.gov.br/](https://datasus.saude.gov.br/) / OSM Overpass
- **License / Terms of Use:** Creative Commons / ODbL
- **Date Fetched:** 2026-09-30
- **Local Cache Path:** `data/raw/facilities/bahia_cnes_facilities.json`
- **Application in Platform:**
  - Primary care facilities (Unidades Básicas de Saúde - UBS) in Salvador and Feira de Santana for `node_br_bahia`.
  - Tagged `data_origin: "real"` and `source_dataset: "datasus_cnes_osm"`.
- **Known Limitations:** Focuses on metropolitan primary care clinics.

---

## 8. South Africa Health Sites / National Department of Health (KZN Node)
- **Source Name:** South Africa National Health Facility List (KwaZulu-Natal)
- **Authority:** National Department of Health, Republic of South Africa / Healthsites.io
- **Source URL:** [https://healthsites.io/](https://healthsites.io/) / [https://www.health.gov.za/](https://www.health.gov.za/)
- **License / Terms of Use:** Open Data Commons Open Database License (ODbL)
- **Date Fetched:** 2026-09-30
- **Local Cache Path:** `data/raw/facilities/kzn_health_facilities.json`
- **Application in Platform:**
  - Primary health clinics and community health centers in eThekwini and uMgungundlovu for `node_za_kzn`.
  - Tagged `data_origin: "real"` and `source_dataset: "sahis_healthsites"`.
- **Known Limitations:** Geocoded coordinates mapped to public municipal centroids.
