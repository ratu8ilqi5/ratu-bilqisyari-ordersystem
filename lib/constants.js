export const APP_NAME = "Customer Order Management System";

// Edit these to match the real shop details.
export const SHOP = {
  name: "Ratu Bilqis Syar'i",
  address: "Jl. Merpati No. 12, Bandung",
  phone: "0812-3456-7890",
};

export const C = {
  midnight: "#21324F", // ink — borders, text
  olive: "#4A69B3", // Navy — secondary accent
  coffee: "#FFEC89", // Butter — tertiary accent / "verified" status
  grape: "#BA3801", // Rust — primary accent / CTA
  parchment: "#ADBBDD", // soft tint of Navy, used for the 4th rotating accent
  peony: "#FFEC89", // Butter — bold page background
  white: "#FFFBF0", // ivory — card fill
};
export const ACCENTS = [C.grape, C.olive, C.coffee, C.parchment];

export function rupiah(n) {
  return "Rp" + Number(n || 0).toLocaleString("id-ID");
}
export function normalizeWA(num) {
  let n = (num || "").replace(/[^0-9]/g, "");
  if (n.startsWith("0")) n = "62" + n.slice(1);
  if (!n.startsWith("62")) n = "62" + n;
  return n;
}
export function makeOrderId() {
  return "ORD-" + Date.now().toString(36).toUpperCase().slice(-5);
}
export function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
