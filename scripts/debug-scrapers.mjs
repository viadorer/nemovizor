import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  viewport: { width: 1920, height: 1080 },
  locale: "en-GB",
});
const page = await ctx.newPage();

// ===== RIGHTMOVE =====
console.log("=== RIGHTMOVE ===");
await page.goto("https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=REGION%5E87490&sortType=6&index=0", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(5000);
try { await page.locator("#onetrust-accept-btn-handler").click({ timeout: 3000 }); } catch {}
await page.waitForTimeout(1000);

const rmProps = await page.evaluate(() => {
  const results = [];
  document.querySelectorAll("[class*='propertyCard'][class*='Wrapper']").forEach(el => {
    const link = el.querySelector("a[href*='/properties/']");
    const href = link ? link.href : "";
    const idMatch = href.match(/\/properties\/(\d+)/);
    const id = idMatch ? idMatch[1] : "";
    if (id === "") return;

    const priceEl = el.querySelector("[class*='price'], [class*='Price']");
    const priceText = priceEl ? priceEl.textContent.trim() : "0";
    const price = Number(priceText.replace(/[^0-9]/g, "")) || 0;

    const addressEl = el.querySelector("[class*='address'], address");
    const address = addressEl ? addressEl.textContent.trim() : "";

    const typeEl = el.querySelector("[class*='propertyType'], [class*='PropertyType']");
    const propertyType = typeEl ? typeEl.textContent.trim() : "";

    const imgEl = el.querySelector("img");
    const imgSrc = imgEl ? imgEl.src : "";

    const bedsMatch = el.textContent.match(/(\d+)\s*bed/i);
    const bedrooms = bedsMatch ? parseInt(bedsMatch[1]) : 0;

    results.push({ id, price, address, propertyType, bedrooms, imgSrc: imgSrc.slice(0, 100) });
  });
  return results.slice(0, 5);
});

console.log(`Found ${rmProps.length} properties`);
for (const p of rmProps) {
  console.log(`  #${p.id}: ${p.price} GBP - ${p.address} - ${p.propertyType} - ${p.bedrooms} bed`);
}

// ===== IMMOSCOUT24 =====
console.log("\n=== IMMOSCOUT24 ===");
try {
  await page.goto("https://www.immobilienscout24.de/Suche/de/berlin/berlin/wohnung-kaufen", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(5000);
  try { await page.locator("#uc-btn-accept-banner").click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(1000);

  const is24Title = await page.title();
  console.log("Title:", is24Title);

  const is24Selectors = await page.evaluate(() => {
    const counts = {};
    ["[data-item='result']", "article", "[class*='result-list']", "[class*='Result']", "[class*='listing']", "[class*='expose']", "a[href*='/expose/']"].forEach(sel => {
      counts[sel] = document.querySelectorAll(sel).length;
    });
    // Get expose links
    const links = [...document.querySelectorAll("a[href*='/expose/']")].slice(0, 3).map(a => a.href);
    counts.exposeLinks = links;
    return counts;
  });
  console.log(JSON.stringify(is24Selectors, null, 2));
} catch (e) {
  console.log("IS24 error:", e.message);
}

// ===== IMMOWEB =====
console.log("\n=== IMMOWEB ===");
try {
  await page.goto("https://www.immoweb.be/en/search/house-and-apartment/for-sale?countries=BE&page=1&orderBy=newest", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(5000);
  try { await page.locator("[data-testid='uc-accept-all-button']").click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(2000);

  const iwTitle = await page.title();
  console.log("Title:", iwTitle);

  const iwSelectors = await page.evaluate(() => {
    const counts = {};
    ["article", "[class*='card']", "[class*='result']", "[class*='classified']", "a[href*='/classified/']", "a[href*='/annonce/']", "[class*='search']"].forEach(sel => {
      counts[sel] = document.querySelectorAll(sel).length;
    });
    const links = [...document.querySelectorAll("a[href*='/classified/'], a[href*='/annonce/']")].slice(0, 3).map(a => a.href);
    counts.links = links;
    // Check for iframes or shadow DOM
    counts.iframes = document.querySelectorAll("iframe").length;
    counts.bodyHTML = document.body.innerHTML.length;
    counts.bodyText = document.body.innerText.slice(0, 200);
    return counts;
  });
  console.log(JSON.stringify(iwSelectors, null, 2));
} catch (e) {
  console.log("Immoweb error:", e.message);
}

await browser.close();
