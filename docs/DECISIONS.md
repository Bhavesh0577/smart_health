# Architectural Decisions: PHC Resilience Grid

## Context & Vision
"PHC Resilience Grid" is a federated AI platform for national-scale Primary Health Centre (PHC) supply chain resilience and epidemic surveillance, tailored for the BRICS Track 3 Smart Health challenge.

## Log of Key Decisions

### ADR-001: Multi-Tenant Federated Node Schema Architecture
- **Decision:** Model the three federated nodes (`node_in_karnataka`, `node_br_bahia`, `node_za_kzn`) as distinct PostgreSQL schemas within the same database instance for simulated federation, with strict schema-level data isolation.
- **Rationale:** Simulates true sovereign data boundaries where raw health records never leave national or state jurisdictions. Aggregators only receive model weights and gradient deltas, satisfying BRICS data privacy regulations.

### ADR-002: Dual-Mode Database Connection (TimescaleDB + Local Fallback)
- **Decision:** Support primary PostgreSQL 16 + TimescaleDB connection via `DATABASE_URL` (configured in `docker-compose.yml`), while providing an embedded `@electric-sql/pglite` WASM fallback if the local docker daemon is not active.
- **Rationale:** Ensures zero friction for development, CI/CD, seed scripts, and builds, while offering full native Timescale hypertable continuous aggregation in containerized production.

### ADR-003: Deterministic Synthetic Data Seeding (PRNG)
- **Decision:** Implement a seeded pseudo-random number generator (Mulberry32 / LCG) in `scripts/seed.ts` to generate exactly 90 days of reproducible longitudinal data.
- **Rationale:** Guarantees repeatable hackathon demos with specific, realistic epidemiological dynamics:
  1. Monsoon surges (June-September) with 2.5x ORS and antimalarial demand in coastal and northern Karnataka (Dakshina Kannada, Kalaburagi).
  2. Festival bumps during Dasara/Diwali.
  3. Pre-programmed near-stock-out trajectories for 3 specific PHCs (Ullal, Aland, Nelamangala).
  4. Near-expiry batches to demonstrate shelf-life-aware min-cost flow redistribution.
  5. Dormant outbreak cluster ready to be activated in "Emergency Mode".

### ADR-004: Parametric Model Selection for Machine Learning & FedAvg
- **Decision:** Use Ridge / SGD regression on standardized lagged consumption, seasonality (sin/cos of day-of-year), day-of-week, rainfall, and footfall features in the FastAPI `ml-service`.
- **Rationale:** Closed-form linear/parametric models allow true mathematical Federated Averaging (`FedAvg`) where parameter vectors $W_{global} = \sum \frac{n_k}{N} W_k$ are averaged, and Differential Privacy (Gaussian noise $\mathcal{N}(0, \sigma^2)$ calibrated to $\epsilon$) is injected directly onto the shared weight vector without leaking patient footfall or unit records.

### ADR-005: Client/Server State & Role Management
- **Decision:** Cookie-based role switcher (`state_officer`, `district_officer`, `phc_staff`) and active node switcher (`in_karnataka`, `br_bahia`, `za_kzn`).
- **Rationale:** Fast role-switching without authentication friction during judge evaluation, while providing strict server-side awareness for role-based dashboard filters.

### ADR-006: Server-Sent Events (SSE) for Real-Time Streaming
- **Decision:** Implement `/api/stream/updates` using standard Web Server-Sent Events (`text/event-stream`) in Next.js App Router.
- **Rationale:** Replaces heavy third-party real-time platforms (e.g. Firebase) with standard, lightweight HTTP streaming compatible with edge and self-hosted environments.
