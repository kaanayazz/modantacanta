import fs from "fs";
import path from "path";
import admin from "firebase-admin";

const SITE_URL = "https://modantacanta.com";
const BRAND = "Modanta Çanta";
const OUT_DIR = process.cwd();

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeAvailability(stock, status, target) {
  const s = String(status || "").toLowerCase();
  const inStock = Number(stock || 0) > 0 && !s.includes("yok") && !s.includes("tükendi");
  return target === "facebook"
    ? inStock ? "in stock" : "out of stock"
    : inStock ? "in_stock" : "out_of_stock";
}

function productCategory(category = "") {
  if (category === "Çanta") return "Apparel & Accessories > Handbags, Wallets & Cases > Handbags";
  if (category === "Gözlük") return "Apparel & Accessories > Clothing Accessories > Sunglasses";
  if (category === "Saat") return "Apparel & Accessories > Jewelry > Watches";
  return "Apparel & Accessories";
}

function itemXml(p, target) {
  const id = p.code || p.id;
  const title = p.name || p.title || "Modanta Ürün";
  const desc = p.description || `${BRAND} koleksiyonunda yer alan ürün.`;
  const price = Number(p.price || 0).toFixed(2);
  const category = p.category || "Çanta";
  const image = p.imageUrl || p.image || p.photoUrl || "";
  const availability = normalizeAvailability(p.stock, p.stockStatus, target);

  return `    <item>
      <g:id>${esc(id)}</g:id>
      <g:title>${esc(title)}</g:title>
      <g:description>${esc(desc)}</g:description>
      <g:link>${SITE_URL}/</g:link>
      <g:image_link>${esc(image)}</g:image_link>
      <g:availability>${availability}</g:availability>
      <g:price>${price} TRY</g:price>
      <g:brand>${esc(BRAND)}</g:brand>
      <g:condition>new</g:condition>
      <g:product_type>${esc(category)}</g:product_type>
      <g:google_product_category>${esc(productCategory(category))}</g:google_product_category>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
}

function feedXml(products, target) {
  const title = target === "facebook"
    ? `${BRAND} Facebook Ürün Feed`
    : `${BRAND} Google Merchant Ürün Feed`;

  const description = target === "facebook"
    ? `${BRAND} Meta katalog ürünleri`
    : `${BRAND} Google Merchant Center ürün kataloğu`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${esc(title)}</title>
    <link>${SITE_URL}/</link>
    <description>${esc(description)}</description>

${products.map(p => itemXml(p, target)).join("\n\n")}
  </channel>
</rss>
`;
}

async function main() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT GitHub secret eksik.");
  }

  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccountJson))
  });

  const snap = await admin.firestore()
    .collection("products")
    .get();

  const products = snap.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    .filter(p => {
      const status = String(p.stockStatus || "").toLowerCase();
      const price = Number(p.price || 0);
      const image = p.imageUrl || p.image || p.photoUrl || "";
      return !status.includes("tükendi") && price > 0 && image;
    });

  fs.writeFileSync(path.join(OUT_DIR, "merchant.xml"), feedXml(products, "merchant"), "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "facebook.xml"), feedXml(products, "facebook"), "utf8");

  console.log(`Feed hazır: ${products.length} ürün`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
