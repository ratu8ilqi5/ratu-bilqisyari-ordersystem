"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { C, SHOP } from "@/lib/constants";
import { NeoButton, NeoCard } from "@/components/ui";
import { IconDownload } from "@/components/icons";

const PRESETS = [
  { key: "100x150", label: "Label Thermal 100 x 150 mm (paling umum)", w: 100, h: 150 },
  { key: "80x120", label: "Struk Thermal 80 x 120 mm", w: 80, h: 120 },
  { key: "58x90", label: "Struk Thermal 58 x 90 mm", w: 58, h: 90 },
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

// Layout scales proportionally to whatever W x H (in px) is passed in,
// so the same drawing works for a small 58mm roll or a big 100x150mm label.
async function generateLabelDataURL(order, wMm, hMm) {
  await document.fonts.ready;
  const W = Math.round(wMm * PX_PER_MM);
  const H = Math.round(hMm * PX_PER_MM);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const pad = Math.round(W * 0.04);
  ctx.setLineDash([Math.max(4, W * 0.018), Math.max(3, W * 0.01)]); // broken-line style for every stroke below

  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.midnight; ctx.lineWidth = Math.max(2, W * 0.008); ctx.strokeRect(pad * 0.5, pad * 0.5, W - pad, H - pad);

  const barH = H * 0.11;
  ctx.fillStyle = tint(C.coffee, 0.78);
  ctx.fillRect(pad * 0.5, pad * 0.5, W - pad, barH);
  ctx.strokeStyle = C.midnight; ctx.lineWidth = Math.max(1, W * 0.004);
  ctx.beginPath(); ctx.moveTo(pad * 0.5, pad * 0.5 + barH); ctx.lineTo(W - pad * 0.5, pad * 0.5 + barH); ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = `700 ${Math.round(W * 0.045)}px 'Space Grotesk'`;
  ctx.fillStyle = C.midnight;
  ctx.fillText(SHOP.name, pad, pad * 0.5 + barH * 0.5);
  ctx.font = `${Math.round(W * 0.024)}px 'Space Grotesk'`;
  ctx.fillText(`${order.items.length} produk`, pad, pad * 0.5 + barH * 0.82);

  let cy = pad * 0.5 + barH + H * 0.09;
  ctx.textAlign = "center";
  ctx.font = `${Math.round(W * 0.11)}px 'VT323'`;
  ctx.fillStyle = C.grape;
  ctx.fillText("PRIORITY GIFT", W / 2, cy);
  cy += H * 0.02;
  ctx.strokeStyle = C.grape; ctx.lineWidth = Math.max(1, W * 0.006);
  ctx.beginPath(); ctx.moveTo(pad * 1.2, cy); ctx.lineTo(W - pad * 1.2, cy); ctx.stroke();
  cy += H * 0.05;

  function section(title, name, addr, yy, boxH) {
    ctx.strokeStyle = C.midnight; ctx.lineWidth = Math.max(1, W * 0.004);
    ctx.strokeRect(pad, yy, W - pad * 2, boxH);
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.round(W * 0.032)}px 'Space Grotesk'`;
    ctx.fillStyle = C.olive;
    ctx.fillText(title.toUpperCase(), pad * 1.5, yy + boxH * 0.2);
    ctx.font = `${Math.round(W * 0.038)}px 'Space Grotesk'`;
    ctx.fillStyle = C.midnight;
    ctx.fillText(name, pad * 1.5, yy + boxH * 0.42);
    ctx.font = `${Math.round(W * 0.028)}px 'Space Grotesk'`;
    wrapText(ctx, addr, pad * 1.5, yy + boxH * 0.62, W - pad * 3, W * 0.045);
  }
  const boxH = H * 0.16;
  section("Kirim dari", SHOP.name, SHOP.address, cy, boxH);
  cy += boxH + H * 0.015;
  section("Kirim ke", order.name, order.address + " · " + order.wa, cy, boxH);
  cy += boxH + H * 0.06;

  drawBarcode(ctx, pad, cy, W - pad * 2, H * 0.07, order.id);
  cy += H * 0.1;
  ctx.textAlign = "center";
  ctx.font = `${Math.round(W * 0.045)}px 'VT323'`;
  ctx.fillStyle = C.midnight;
  ctx.fillText(`TRACKING: ${order.id}`, W / 2, cy);

  return canvas.toDataURL("image/jpeg", 0.95);
}

export default function LabelPage({ params }) {
  const orderId = params.id;
  const [order, setOrder] = useState(null);
  const [src, setSrc] = useState(null);
  const [presetKey, setPresetKey] = useState("100x150");
  const [customW, setCustomW] = useState(100);
  const [customH, setCustomH] = useState(150);

  useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("label-preset");
    if (saved) setPresetKey(saved);
    (async () => {
      const { data } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      setOrder(data || null);
    })();
  }, [orderId]);

  const build = useCallback(async () => {
    if (!order) return;
    const preset = PRESETS.find((p) => p.key === presetKey);
    const wMm = preset.key === "custom" ? Number(customW) : preset.w;
    const hMm = preset.key === "custom" ? Number(customH) : preset.h;
    setSrc(null);
    const url = await generateLabelDataURL(order, wMm, hMm);
    setSrc(url);
  }, [order, presetKey, customW, customH]);

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
          value={presetKey}
          onChange={(e) => choosePreset(e.target.value)}
          className="w-full mb-3 px-3 py-2 text-sm"
          style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }}
        >
          {PRESETS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>

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
