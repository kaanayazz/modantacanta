import fs from "fs";
import admin from "firebase-admin";

const SITE_URL = "https://modantacanta.com";
const SHOP_URL = `${SITE_URL}/alisveris.html`;
const BRAND = "Modanta Çanta";

const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountRaw) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT GitHub Secret bulunamadı.");
}

const serviceAccount = JSON.parse(serviceAccountRaw);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "modanta-canta.firebasestorage.app"
});

const db = admin.firestore();

function xmlEscape(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanPrice(value) {
  const number = Number(value || 0);
  return number > 0 ? `${number.toFixed(2)} TRY` : "0.00 TRY";
}

function availability(product) {
  const stock = Number(product.stock || 0);
  const status = String(product.stockStatus || "").toLowerCase();

  if (stock > 0 || status.includes("stokta")) {
    return {
      merchant: "in_stock",
      facebook: "in stock"
    };
  }

  return {
    merchant: "out_of_stock",
    facebook: "out of stock"
  };
}

function merchantItem(id, p) {
  const a = availability(p);

  return `
    <item>
      <g:id>${xmlEscape(p.code || id)}</g:id>
      <g:title>${xmlEscape(p.name || "Modanta Ürün")}</g:title>
      <g:description>${xmlEscape(p.description || p.name || "Modanta Çanta ürünü")}</g:description>
      <g:link>${xmlEscape(SHOP_URL)}</g:link>
      <g:image_link>${xmlEscape(p.imageUrl || "")}</g:image_link>
      <g:availability>${a.merchant}</g:availability>
      <g:price>${cleanPrice(p.price)}</g:price>
      <g:brand>${xmlEscape(p.brand || BRAND)}</g:brand>
      <g:condition>${xmlEscape(p.condition || "new")}</g:condition>
      <g:product_type>${xmlEscape(p.category || "Ürün")}</g:product_type>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
}

function facebookItem(id, p) {
  const a = availability(p);

  return `
    <item>
      <g:id>${xmlEscape(p.code || id)}</g:id>
      <g:title>${xmlEscape(p.name || "Modanta Ürün")}</g:title>
      <g:description>${xmlEscape(p.description || p.name || "Modanta Çanta ürünü")}</g:description>
      <g:link>${xmlEscape(SHOP_URL)}</g:link>
      <g:image_link>${xmlEscape(p.imageUrl || "")}</g:image_link>
      <g:availability>${a.facebook}</g:availability>
      <g:price>${cleanPrice(p.price)}</g:price>
      <g:brand>${xmlEscape(p.brand || BRAND)}</g:brand>
      <g:condition>${xmlEscape(p.condition || "new")}</g:condition>
      <g:product_type>${xmlEscape(p.category || "Ürün")}</g:product_type>
    </item>`;
}

async function main() {
  const snap = await db.collection("products").get();
  const products = [];

  snap.forEach(doc => {
    const p = doc.data();
    if (!p.name || !p.price || !p.imageUrl) return;
    products.push({ id: doc.id, ...p });
  });

  const merchantItems = products.map(p => merchantItem(p.id, p)).join("\n");
  const facebookItems = products.map(p => facebookItem(p.id, p)).join("\n");

  const merchantXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Modanta Çanta Ürün Feed</title>
    <link>${SITE_URL}</link>
    <description>Modanta Çanta Google Merchant ürünleri</description>
${merchantItems}
  </channel>
</rss>
`;

  const facebookXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Modanta Çanta Facebook Ürün Feed</title>
    <link>${SITE_URL}</link>
    <description>Modanta Çanta Meta katalog ürünleri</description>
${facebookItems}
  </channel>
</rss>
`;

  fs.writeFileSync("merchant.xml", merchantXml, "utf8");
  fs.writeFileSync("facebook.xml", facebookXml, "utf8");

  console.log(`Feed oluşturuldu. Ürün sayısı: ${products.length}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
