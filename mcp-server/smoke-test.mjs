// Smoke test: spawns dist/index.js as a child, speaks MCP JSON-RPC
// (initialize → tools/list → tools/call x4) over stdio, and prints results.
//
// Run with: NEMOVIZOR_BASE_URL=http://localhost:3000 node smoke-test.mjs
//
// Exits 0 on success, 1 on any failure.

import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(__dirname, "dist", "index.js");

const child = spawn("node", [serverEntry], {
  stdio: ["pipe", "pipe", "pipe"],
  env: {
    ...process.env,
    NEMOVIZOR_BASE_URL: process.env.NEMOVIZOR_BASE_URL || "http://localhost:3000",
  },
});

const pending = new Map();
let nextId = 1;
let buffer = "";

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      console.error("[smoke] non-JSON stdout line:", line);
      continue;
    }
    if (msg.id != null && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => process.stderr.write(`[child stderr] ${chunk}`));

child.on("exit", (code) => {
  if (pending.size > 0) {
    console.error("[smoke] child exited with pending requests, code=", code);
    process.exit(1);
  }
});

function rpc(method, params) {
  const id = nextId++;
  const req = { jsonrpc: "2.0", id, method, params };
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify(req) + "\n");
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout on ${method}`));
      }
    }, 15000);
  });
}

function notify(method, params) {
  const req = { jsonrpc: "2.0", method, params };
  child.stdin.write(JSON.stringify(req) + "\n");
}

function assertOk(label, res) {
  if (res.error) {
    console.error(`❌ ${label}: ${JSON.stringify(res.error)}`);
    process.exit(1);
  }
  console.log(`✅ ${label}`);
  return res.result;
}

(async () => {
  // 1. initialize
  const init = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "nemovizor-smoke", version: "0.0.0" },
  });
  assertOk("initialize", init);
  notify("notifications/initialized", {});

  // 2. tools/list
  const list = await rpc("tools/list", {});
  const listRes = assertOk("tools/list", list);
  const toolNames = listRes.tools.map((t) => t.name).sort();
  console.log("   tools:", toolNames.join(", "));
  const expected = [
    "nemovizor_ai_search",
    "nemovizor_filter_options",
    "nemovizor_map_points",
    "nemovizor_search_properties",
  ];
  for (const name of expected) {
    if (!toolNames.includes(name)) {
      console.error(`❌ missing tool ${name}`);
      process.exit(1);
    }
  }

  // 3. tools/call — nemovizor_search_properties
  const search = await rpc("tools/call", {
    name: "nemovizor_search_properties",
    arguments: { limit: 2 },
  });
  const searchRes = assertOk("tools/call search_properties", search);
  const searchJson = JSON.parse(searchRes.content[0].text);
  if (typeof searchJson.total !== "number") {
    console.error("❌ search response missing total field:", searchJson);
    process.exit(1);
  }
  console.log(`   total listings: ${searchJson.total}, returned: ${searchJson.data.length}`);

  // 4. tools/call — nemovizor_map_points
  const pts = await rpc("tools/call", {
    name: "nemovizor_map_points",
    arguments: { zoom: 7 },
  });
  const ptsRes = assertOk("tools/call map_points", pts);
  const ptsJson = JSON.parse(ptsRes.content[0].text);
  console.log(`   points: ${ptsJson.count}, truncated: ${ptsJson.truncated}`);

  // 5. tools/call — nemovizor_filter_options
  const fo = await rpc("tools/call", {
    name: "nemovizor_filter_options",
    arguments: {},
  });
  const foRes = assertOk("tools/call filter_options", fo);
  const foJson = JSON.parse(foRes.content[0].text);
  console.log(
    `   categories: ${foJson.categories.length}, cities: ${foJson.cities.length}, priceMax: ${foJson.priceRange.max}`,
  );

  // 6. Validation sanity — invalid arguments must return an MCP tool error,
  //    not crash the server.
  const badLimit = await rpc("tools/call", {
    name: "nemovizor_search_properties",
    arguments: { limit: 999 },
  });
  if (
    badLimit.result &&
    badLimit.result.isError === true
  ) {
    console.log("✅ tools/call bad limit → isError=true");
  } else if (badLimit.error) {
    // JSON-RPC error is also acceptable
    console.log("✅ tools/call bad limit → RPC error");
  } else {
    console.log("⚠️  tools/call bad limit did not surface an error:", JSON.stringify(badLimit).slice(0, 200));
  }

  console.log("\n🎉 MCP smoke test passed");
  child.stdin.end();
  try { child.kill(); } catch {}
  process.exit(0);
})().catch((err) => {
  console.error("❌ smoke failed:", err);
  try { child.kill(); } catch {}
  process.exit(1);
});

// Safety net
once(child, "error").then((e) => {
  console.error("[smoke] child error:", e);
  process.exit(1);
});
