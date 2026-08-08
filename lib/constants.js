export const APP_NAME = "Customer Order Management System";

// Edit these to match the real shop details.
export const SHOP = {
  name: "RATU BILQIS - ERBE",
  address: "Jl. Merpati No. 12, Bandung",
  phone: "0812-3456-7890",
};

export const C = {
  midnight: "#1A120B", // warm near-black — borders, text, headers (echoes the logo's dark backdrop)
  olive: "#7A3D26", // deep rust — secondary accent
  coffee: "#C98A56", // warm tan — tertiary accent / "verified" status
  grape: "#B25C38", // terracotta — matches the logo circle, primary accent / price / total
  parchment: "#EAC9AC", // light peach tint, 4th rotating accent
  peony: "#FBF1E7", // soft warm cream — page background
  white: "#FFFBF3", // ivory — card fill
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
