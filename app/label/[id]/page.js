"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { C, SHOP } from "@/lib/constants";
import { NeoButton, NeoCard } from "@/components/ui";
import { IconDownload } from "@/components/icons";

const PRESETS = [
  { key: "80", label: "Thermal 80mm", w: 80, h: null },
  { key: "58", label: "Thermal 58mm", w: 58, h: null },
  { key: "custom", label: "Custom", w: null, h: null },
];
const PX_PER_MM = 8; // ~203dpi, standard thermal printer resolution

function tint(hex, amt) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(g + (255 - g) * amt)},${Math.round(b + (255 - b) * amt)})`;
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  let line = "", yy = y, lines = 0;
  for (let n = 0; n < words.length; n++) {
    const test = line + words[n] + " ";
    if (ctx.measureText(test).width > maxWidth && n > 0) {
      ctx.fillText(line, x, yy);
      line = words[n] + " ";
      yy += lineHeight;
      lines++;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
  return lines + 1;
}
function drawBarcode(ctx, x, y, w, h, seedStr) {
  let seed = 1;
  for (let i = 0; i < seedStr.length; i++) seed += seedStr.charCodeAt(i) * (i + 7);
  let cx = x;
  ctx.fillStyle = C.midnight;
  while (cx < x + w) {
    seed = (seed * 9301 + 49297) % 233280;
    const bw = 2 + (seed % 4);
    if (seed % 3 !== 0) ctx.fillRect(cx, y, bw, h);
    cx += bw + 2;
  }
}

// Layout uses fixed pixel offsets scaled by width only, so height can grow
// automatically to fit however many items are in the order (thermal rolls
// print continuously anyway — no fixed page size to worry about). When hMm
// is given (custom mode), the canvas is locked to that height instead.
async function generateLabelDataURL(order, wMm, hMm, store) {
  await document.fonts.ready;
  const W = Math.round(wMm * PX_PER_MM);
  const autoHeight = !hMm;
  const H_GUESS = autoHeight ? Math.round(2400 * (W / 640)) : Math.round(hMm * PX_PER_MM);

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H_GUESS;
  const ctx = canvas.getContext("2d");
  const pad = Math.round(W * 0.04);
  ctx.setLineDash([Math.max(4, W * 0.018), Math.max(3, W * 0.01)]); // broken-line style for every stroke below

  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H_GUESS);

  const barH = Math.round(W * 0.14);
  ctx.fillStyle = tint(C.coffee, 0.78);
  ctx.fillRect(pad * 0.5, pad * 0.5, W - pad, barH);
  ctx.strokeStyle = C.midnight; ctx.lineWidth = Math.max(1, W * 0.004);
  ctx.beginPath(); ctx.moveTo(pad * 0.5, pad * 0.5 + barH); ctx.lineTo(W - pad * 0.5, pad * 0.5 + barH); ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = `700 ${Math.round(W * 0.045)}px 'Bricolage Grotesque'`;
  ctx.fillStyle = C.midnight;
  ctx.fillText(store.sender_name, pad, pad * 0.5 + barH * 0.55);
  ctx.font = `${Math.round(W * 0.022)}px 'Bricolage Grotesque'`;
  ctx.fillText(`${order.items.length} produk${store.contact_number ? " · " + store.contact_number : ""}`, pad, pad * 0.5 + barH * 0.85);

  let cy = pad * 0.5 + barH + Math.round(W * 0.13);
  ctx.textAlign = "center";
  ctx.font = `700 ${Math.round(W * 0.09)}px 'Bricolage Grotesque'`;
  ctx.fillStyle = C.grape;
  ctx.fillText("PRIORITY GIFT", W / 2, cy);
  cy += Math.round(W * 0.03);
  ctx.strokeStyle = C.grape; ctx.lineWidth = Math.max(1, W * 0.006);
  ctx.beginPath(); ctx.moveTo(pad * 1.2, cy); ctx.lineTo(W - pad * 1.2, cy); ctx.stroke();
  cy += Math.round(W * 0.07);

  function section(title, name, addr, boxH) {
    ctx.strokeStyle = C.midnight; ctx.lineWidth = Math.max(1, W * 0.004);
    ctx.strokeRect(pad, cy, W - pad * 2, boxH);
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.round(W * 0.03)}px 'Bricolage Grotesque'`;
    ctx.fillStyle = C.olive;
    ctx.fillText(title.toUpperCase(), pad * 1.5, cy + boxH * 0.22);
    ctx.font = `${Math.round(W * 0.036)}px 'Bricolage Grotesque'`;
    ctx.fillStyle = C.midnight;
    ctx.fillText(name, pad * 1.5, cy + boxH * 0.46);
    ctx.font = `${Math.round(W * 0.026)}px 'Bricolage Grotesque'`;
    wrapText(ctx, addr, pad * 1.5, cy + boxH * 0.68, W - pad * 3, W * 0.042);
    cy += boxH + Math.round(W * 0.02);
  }
  const boxH = Math.round(W * 0.24);
  section("Kirim dari", store.sender_name, store.sender_address || "-", boxH);
  section("Kirim ke", order.name, order.address + " · " + order.wa, boxH);
  cy += Math.round(W * 0.03);

  // Daftar item — dicetak biar kurir/checker tau isi paket tanpa buka bungkus.
  ctx.textAlign = "left";
  ctx.font = `700 ${Math.round(W * 0.03)}px 'Bricolage Grotesque'`;
  ctx.fillStyle = C.olive;
  ctx.fillText("ISI PAKET", pad, cy);
  cy += Math.round(W * 0.02);
  ctx.strokeStyle = C.midnight; ctx.lineWidth = Math.max(1, W * 0.004);
  ctx.beginPath(); ctx.moveTo(pad, cy); ctx.lineTo(W - pad, cy); ctx.stroke();
  cy += Math.round(W * 0.045);

  ctx.font = `${Math.round(W * 0.032)}px 'Bricolage Grotesque'`;
  ctx.fillStyle = C.midnight;
  const lineH = Math.round(W * 0.044);
  order.items.forEach((it, idx) => {
    const detail = [it.color, it.size].filter(Boolean).join(", ");
    const label = `${idx + 1}. ${it.name}${detail ? ` — ${detail}` : ""}`;
    ctx.textAlign = "left";
    const lines = wrapText(ctx, label, pad, cy, W - pad * 2 - Math.round(W * 0.14), lineH);
    ctx.textAlign = "right";
    ctx.fillText(`x${it.qty}`, W - pad, cy);
    ctx.textAlign = "left";
    cy += lineH * lines + Math.round(W * 0.012);
  });
  cy += Math.round(W * 0.03);

  drawBarcode(ctx, pad, cy, W - pad * 2, Math.round(W * 0.09), order.id);
  cy += Math.round(W * 0.14);
  ctx.textAlign = "center";
  ctx.font = `${Math.round(W * 0.04)}px 'Bitcount Prop Single'`;
  ctx.fillStyle = C.midnight;
  ctx.fillText(`TRACKING: ${order.id}`, W / 2, cy);

  if (store.receipt_footer) {
    cy += Math.round(W * 0.06);
    ctx.font = `${Math.round(W * 0.024)}px 'Bricolage Grotesque'`;
    ctx.fillStyle = C.midnight;
    ctx.textAlign = "left";
    wrapText(ctx, store.receipt_footer, pad, cy, W - pad * 2, Math.round(W * 0.035));
  }

  cy += Math.round(W * 0.08); // bottom breathing room
  ctx.strokeStyle = C.midnight; ctx.lineWidth = Math.max(2, W * 0.008);
  ctx.setLineDash([]);
  ctx.strokeRect(pad * 0.5, pad * 0.5, W - pad, Math.min(cy, H_GUESS) - pad);

  const finalH = autoHeight ? Math.min(H_GUESS, Math.round(cy)) : H_GUESS;
  if (finalH === H_GUESS) return canvas.toDataURL("image/jpeg", 0.95);

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = W; finalCanvas.height = finalH;
  finalCanvas.getContext("2d").drawImage(canvas, 0, 0, W, finalH, 0, 0, W, finalH);
  return finalCanvas.toDataURL("image/jpeg", 0.95);
}

export default function LabelPage({ params }) {
  const orderId = params.id;
  const [order, setOrder] = useState(null);
  const [store, setStore] = useState(null);
  const [src, setSrc] = useState(null);
  const [presetKey, setPresetKey] = useState(null);
  const [customW, setCustomW] = useState(80);
  const [customH, setCustomH] = useState(150);

  useEffect(() => {
    (async () => {
      const { data: o } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      setOrder(o || null);
      const { data: p } = await supabase.from("payment_info").select("*").eq("id", 1).maybeSingle();
      const storeData = {
        sender_name: p?.sender_name || SHOP.name,
        sender_address: p?.sender_address || SHOP.address,
        contact_number: p?.contact_number || "",
        receipt_footer: p?.receipt_footer || "",
      };
      setStore(storeData);

      const saved = typeof window !== "undefined" && localStorage.getItem("label-preset");
      const defaultKey = p?.paper_width_mm === 58 ? "58" : "80";
      setPresetKey(saved || defaultKey);
    })();
  }, [orderId]);

  const build = useCallback(async () => {
    if (!order || !store || !presetKey) return;
    const preset = PRESETS.find((p) => p.key === presetKey);
    const wMm = preset.key === "custom" ? Number(customW) : preset.w;
    const hMm = preset.key === "custom" ? Number(customH) : preset.h;
    setSrc(null);
    const url = await generateLabelDataURL(order, wMm, hMm, store);
    setSrc(url);
  }, [order, store, presetKey, customW, customH]);

  useEffect(() => { build(); }, [build]);

  function choosePreset(key) {
    setPresetKey(key);
    if (typeof window !== "undefined") localStorage.setItem("label-preset", key);
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-8">
      <NeoCard accent={C.coffee}>
        <div className="ff-display text-2xl mb-3" style={{ color: C.coffee }}>LABEL {orderId}</div>

        <div className="text-xs font-semibold mb-1">Ukuran kertas printer thermal</div>
        <select
          value={presetKey || "80"}
          onChange={(e) => choosePreset(e.target.value)}
          className="w-full mb-3 px-3 py-2 text-sm"
          style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }}
        >
          {PRESETS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        <p className="text-xs opacity-60 mb-3">Default diambil dari Dashboard Admin → Setting. Pilihan di sini cuma buat sekali print ini aja.</p>

        {presetKey === "custom" && (
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="text-xs">Lebar (mm)</label>
              <input type="number" value={customW} onChange={(e) => setCustomW(e.target.value)} className="w-full px-2 py-1 text-sm" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} />
            </div>
            <div className="flex-1">
              <label className="text-xs">Tinggi (mm)</label>
              <input type="number" value={customH} onChange={(e) => setCustomH(e.target.value)} className="w-full px-2 py-1 text-sm" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} />
            </div>
          </div>
        )}

        {!src ? (
          <div className="ff-display text-xl py-10 text-center">MEMBUAT GAMBAR...</div>
        ) : (
          <>
            <img src={src} alt="label" className="w-full mb-4" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} />
            <div className="flex gap-3">
              <a href={src} download={`label-${orderId}.jpg`} className="flex-1">
                <NeoButton full color={C.olive}><IconDownload /> Download JPG</NeoButton>
              </a>
            </div>
            <p className="text-xs opacity-60 mt-3">
              Kalau printer kamu terpasang sebagai printer biasa di laptop, JPG ini juga bisa langsung di-print
              (buka file → Ctrl/Cmd+P → pilih printer thermal-nya, matikan margin/fit ke kertas).
            </p>
          </>
        )}
      </NeoCard>
    </div>
  );
}
