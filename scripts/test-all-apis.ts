/**
 * Comprehensive API Health & Provenance Test Suite
 * Tests all 22+ API endpoints across the PHC Resilience Grid against real data.
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

interface TestResult {
  name: string;
  method: string;
  url: string;
  status: number;
  passed: boolean;
  durationMs: number;
  dataOriginFound?: string;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

async function testEndpoint(
  name: string,
  method: "GET" | "POST",
  path: string,
  body?: any,
  headers?: Record<string, string>,
  validate?: (data: any) => { valid: boolean; message?: string }
) {
  const start = Date.now();
  const url = `${BASE_URL}${path}`;

  try {
    const opts: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
    };
    if (body && method === "POST") {
      opts.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const res = await fetch(url, opts);
    const durationMs = Date.now() - start;

    let responseData: any = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      responseData = await res.json();
    } else {
      const text = await res.text();
      responseData = { rawText: text.slice(0, 200) };
    }

    let passed = res.status >= 200 && res.status < 300;
    let details = `Status ${res.status}`;
    let dataOriginFound: string | undefined = undefined;

    // Check for data_origin or dataOrigin in response
    if (responseData) {
      if (responseData.data_origin) dataOriginFound = responseData.data_origin;
      else if (responseData.dataOrigin) dataOriginFound = responseData.dataOrigin;
      else if (responseData.data?.data_origin) dataOriginFound = responseData.data.data_origin;
      else if (responseData.data?.dataOrigin) dataOriginFound = responseData.data.dataOrigin;
      else if (Array.isArray(responseData.data) && responseData.data[0]?.dataOrigin) {
        dataOriginFound = responseData.data[0].dataOrigin;
      } else if (Array.isArray(responseData.data) && responseData.data[0]?.data_origin) {
        dataOriginFound = responseData.data[0].data_origin;
      }
    }

    if (validate && passed) {
      const v = validate(responseData);
      if (!v.valid) {
        passed = false;
        details = v.message || "Custom validation failed";
      }
    }

    results.push({
      name,
      method,
      url: path,
      status: res.status,
      passed,
      durationMs,
      dataOriginFound,
      details,
    });
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({
      name,
      method,
      url: path,
      status: 0,
      passed: false,
      durationMs,
      error: err.message,
    });
  }
}

async function runAllTests() {
  console.log(`\n============================================================`);
  console.log(`🚀 RUNNING PHC RESILIENCE GRID API SUITE against ${BASE_URL}`);
  console.log(`============================================================\n`);

  // 1. Core Surveillance & Dashboard
  await testEndpoint(
    "Dashboard Aggregated Stats",
    "GET",
    "/api/dashboard/stats",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && d.data?.totalPhcs >= 100,
      message: `Expected >= 100 PHCs, got ${d.data?.totalPhcs}`,
    })
  );

  // 2. Facilities
  await testEndpoint(
    "All PHCs List (Real Facilities)",
    "GET",
    "/api/phcs",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && Array.isArray(d.data) && d.data.length >= 100,
      message: `Expected >= 100 PHCs, got ${d.data?.length}`,
    })
  );

  // 3. Facility Detail
  await testEndpoint(
    "Single PHC Detail (in_kar_bengaluru_nelamangala)",
    "GET",
    "/api/phcs/in_kar_bengaluru_nelamangala",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && d.data?.name?.includes("Nelamangala"),
      message: `PHC name: ${d.data?.name}`,
    })
  );

  // 4. Medicines
  await testEndpoint(
    "NLEM 2022 Essential Medicines Catalog",
    "GET",
    "/api/medicines",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && Array.isArray(d.data) && d.data.length >= 7,
      message: `Expected >= 7 NLEM medicines, got ${d.data?.length}`,
    })
  );

  // 5. Weather
  await testEndpoint(
    "Open-Meteo ERA5 Weather & 16-Day Forecast",
    "GET",
    "/api/weather?district=Bengaluru%20Urban",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && d.data?.data_origin === "real" && d.data?.historical?.length > 0,
      message: `Historical count: ${d.data?.historical?.length}`,
    })
  );

  // 6. Seasonality Priors
  await testEndpoint(
    "IDSP & NVBDCP Epidemiological Priors",
    "GET",
    "/api/seasonality",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && d.data_origin === "real",
      message: `Origin: ${d.data_origin}`,
    })
  );

  // 7. Data Provenance Audit
  await testEndpoint(
    "Data Provenance Audit Coverage",
    "GET",
    "/api/provenance",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && Array.isArray(d.data?.tables) && d.data?.tables.length >= 8,
      message: `Tables audited: ${d.data?.tables?.length}`,
    })
  );

  // 8. Forecast (Demand Forecasting)
  await testEndpoint(
    "14-Day Demand Forecast (Nelamangala / ORS)",
    "GET",
    "/api/forecast?phcId=in_kar_bengaluru_nelamangala&medicineId=MED_ORS",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && d.data?.predictions?.length === 14,
      message: `Predictions count: ${d.data?.predictions?.length}`,
    })
  );

  // 9. Alerts List
  await testEndpoint(
    "Surveillance Alerts List",
    "GET",
    "/api/alerts",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && Array.isArray(d.data),
      message: `Alerts found: ${d.data?.length}`,
    })
  );

  // 10. Alerts Scan
  await testEndpoint(
    "Alerts Anomaly Detection Scan",
    "POST",
    "/api/alerts",
    { action: "scan", node: "node_in_karnataka" },
    undefined,
    (d) => ({
      valid: d.success === true && typeof d.scannedFacilitiesCount === "number",
      message: `Facilities scanned: ${d.scannedFacilitiesCount}`,
    })
  );

  // 11. Redistribution Plans List
  await testEndpoint(
    "Redistribution Plans List",
    "GET",
    "/api/redistribution",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && Array.isArray(d.data),
      message: `Plans found: ${d.data?.length}`,
    })
  );

  // 12. Redistribution Plan Generation
  await testEndpoint(
    "Redistribution Plan Solver (OR-Tools / Min-Cost)",
    "POST",
    "/api/redistribution",
    { action: "generate", medicineId: "MED_ORS", node: "node_in_karnataka" },
    undefined,
    (d) => ({
      valid: d.success === true && d.plan?.id !== undefined,
      message: `Generated plan ID: ${d.plan?.id}`,
    })
  );

  // 13. Federation Rounds History
  await testEndpoint(
    "Federated Learning Rounds History",
    "GET",
    "/api/federation",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && Array.isArray(d.history),
      message: `History rounds: ${d.history?.length}`,
    })
  );

  // 14. Federation Round Execution
  await testEndpoint(
    "Federated Round Execution (FedAvg + DP ε=1.0)",
    "POST",
    "/api/federation",
    { epsilon: 1.0 },
    undefined,
    (d) => ({
      valid: d.success === true && d.result?.round_number > 0,
      message: `Round executed: ${d.result?.round_number}`,
    })
  );

  // 15. Impact Backtest
  await testEndpoint(
    "Impact & Economic Backtest",
    "GET",
    "/api/impact",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && d.data?.methodologyNotes?.disclaimer !== undefined,
      message: `Disclaimer verified: ${d.data?.methodologyNotes?.title}`,
    })
  );

  // 16. Simulation Emergency State
  await testEndpoint(
    "Simulation Emergency Cluster State",
    "GET",
    "/api/simulation/emergency",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && typeof d.state?.isEmergencyActive === "boolean",
      message: `Emergency active: ${d.state?.isEmergencyActive}`,
    })
  );

  // 17. Simulation Scenario Run
  await testEndpoint(
    "Simulation Scenario Execution (Monsoon 1.8x, Absenteeism 15%)",
    "POST",
    "/api/simulation/run",
    {
      monsoonIntensity: 1.8,
      staffAbsentPercent: 15,
      roadClosureActive: true,
      district: "All Districts",
    },
    undefined,
    (d) => ({
      valid: d.success === true && d.comparison?.simulatedScore !== undefined,
      message: `Simulated Score: ${d.comparison?.simulatedScore}`,
    })
  );

  // 18. Offline PWA Sync
  await testEndpoint(
    "Offline PWA Queue Sync",
    "POST",
    "/api/phc/sync",
    {
      node: "node_in_karnataka",
      entries: [
        {
          id: `sync_test_${Date.now()}`,
          phcId: "in_kar_bengaluru_nelamangala",
          type: "stock",
          timestamp: new Date().toISOString(),
          payload: {
            medicineId: "MED_ORS",
            qty: 450,
          },
        },
      ],
    },
    undefined,
    (d) => ({
      valid: d.success === true && d.count === 1,
      message: `Synced count: ${d.count}`,
    })
  );

  // 19. Ingestion CSV Upload
  await testEndpoint(
    "CSV Ingestion Adapter",
    "POST",
    "/api/ingestion/upload",
    {
      targetType: "stock",
      node: "node_in_karnataka",
      csvContent: `time,phc_id,medicine_code,qty,reorder_threshold,expiry_date,days_of_cover,source\n2026-09-30,in_kar_bengaluru_nelamangala,PARA-500,2850,1500,2028-09-29,24.5,manual_audit\n`,
    },
    undefined,
    (d) => ({
      valid: d.success === true && d.data?.rowsProcessed === 1,
      message: `Processed: ${d.data?.rowsProcessed}`,
    })
  );

  // 20. Ingestion Webhook
  await testEndpoint(
    "Webhook Ingestion Adapter",
    "POST",
    "/api/ingestion/webhook",
    {
      sourceSystem: "hmis",
      node: "node_in_karnataka",
      timestamp: new Date().toISOString(),
      records: [
        {
          type: "footfall",
          phcId: "in_kar_bengaluru_nelamangala",
          data: {
            opdCount: 42,
            symptomCategory: "fever",
          },
        },
      ],
    },
    undefined,
    (d) => ({
      valid: d.success === true && d.data?.rowsProcessed === 1,
      message: `Processed: ${d.data?.rowsProcessed}`,
    })
  );

  // 21. Copilot Executive Briefing
  await testEndpoint(
    "Copilot Executive Briefing (Kalaburagi)",
    "GET",
    "/api/copilot/briefing?district=Kalaburagi",
    undefined,
    undefined,
    (d) => ({
      valid: d.success === true && d.briefing !== undefined,
      message: `Briefing available`,
    })
  );

  // 22. Copilot Natural Language Chat
  await testEndpoint(
    "Copilot Conversational Agent (Autonomous Fallback / Native)",
    "POST",
    "/api/copilot/chat",
    {
      message: "What are the critical alerts and what is our stock posture in Kalaburagi?",
      history: [],
      node: "node_in_karnataka",
    },
    undefined,
    (d) => ({
      valid: d.success === true && typeof d.text === "string" && d.text.length > 50,
      message: `Agent response length: ${d.text?.length} chars`,
    })
  );

  // 23. Copilot Voice Parser
  await testEndpoint(
    "Copilot Multilingual Voice Parser",
    "POST",
    "/api/copilot/voice-parse",
    {
      transcript: "We received 400 packets of ORS and 200 strips of paracetamol today at the dispensary.",
      language: "en",
      phcId: "in_kar_bengaluru_nelamangala",
    },
    undefined,
    (d) => ({
      valid: d.success === true && Array.isArray(d.updates) && d.updates.length > 0,
      message: `Parsed ${d.updates?.length} items`,
    })
  );

  // 24. Copilot Vision
  await testEndpoint(
    "Copilot Multimodal Vision Parser",
    "POST",
    "/api/copilot/vision",
    {
      imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      mimeType: "image/png",
      phcId: "in_kar_bengaluru_nelamangala",
    },
    undefined,
    (d) => ({
      valid: d.success === true && Array.isArray(d.items) && d.items.length > 0,
      message: `Detected ${d.items?.length} items`,
    })
  );

  // Summary Report
  console.log(`\n============================================================`);
  console.log(`📊 API TEST EXECUTION RESULTS SUMMARY`);
  console.log(`============================================================\n`);

  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    const symbol = r.passed ? "✅ PASS" : "❌ FAIL";
    const originBadge = r.dataOriginFound ? `[origin: ${r.dataOriginFound}]` : "";
    console.log(`${symbol} [${r.method} ${r.url}] - ${r.name} (${r.durationMs}ms) ${originBadge}`);
    if (!r.passed) {
      failedCount++;
      console.log(`   └─ ERROR: ${r.error || r.details || "Unknown failure"}`);
    } else {
      passedCount++;
      if (r.details) console.log(`   └─ ${r.details}`);
    }
  }

  console.log(`\n------------------------------------------------------------`);
  console.log(`TOTAL: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log(`PASS RATE: ${Math.round((passedCount / results.length) * 100)}%`);
  console.log(`------------------------------------------------------------\n`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
