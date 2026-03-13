/**
 * Quick test script: fetch a report by ID from the backend.
 * Usage: npx tsx scripts/get-report.ts
 */

const BASE_URL = process.env.VITE_API_URL ?? "http://localhost:8080";
const REPORT_ID = "report_20260311_211954";

async function main() {
  const url = `${BASE_URL}/reports/${REPORT_ID}`;
  console.log(`GET ${url}`);

  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`HTTP ${res.status}: ${text}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
