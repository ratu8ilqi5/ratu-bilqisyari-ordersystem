"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { C, SHOP, APP_NAME, normalizeWA, makeOrderId } from "@/lib/constants";
import { NeoButton, NeoCard } from "@/components/ui";
import { IconSend, IconArrowRight, IconArrowLeft } from "@/components/icons";

const SIZES = ["S", "M", "L", "Jumbo"];

const COURIERS = [
  { label: "LionParcel - Jagopack", courier: "LionParcel", service: "Jagopack" },
  { label: "GrabSend — Instant", courier: "GrabSend", service: "Instant" },
  { label: "GrabSend — Same Day", courier: "GrabSend", service: "Same Day" },
  { label: "GoSend — Instant", courier: "GoSend", service: "Instant" },
  { label: "GoSend — Same Day", courier: "GoSend", service: "Same Day" },
];

const PAYMENT_OPTIONS = {
  pickup: [
    { key: "transfer", label: "Transfer Bank" },
    { key: "qris", label: "QRIS" },
    { key: "cash", label: "Cash" },
  ],
  kirim: [
    { key: "transfer", label: "Transfer Bank" },
    { key: "qris", label: "QRIS" },
  ],
};

const STEPS = ["Data Pemesan", "Pengambilan Pesanan", "Pembayaran", "Detail Pesanan", "Review"];

function createEmptyItem() {
  return { name: "", color: "", size: "", qty: 1 };
}

export default function CustomerPage() {
  const [step, setStep] = useState(0);
  const [items, setItems] = useState([createEmptyItem()]);
  const [form, setForm] = useState({
    name: "",
    wa: "",
    pickupType: "", // "pickup" | "kirim"
    address: "",
    kecamatan: "",
    kelurahan: "",
    kodepos: "",
    courierLabel: "",
    paymentMethod: "",
  });
  const [successId, setSuccessId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Kalau customer balik ganti Pickup jadi Kirim (atau sebaliknya) setelah
  // sempat milih Cash, reset payment method-nya biar gak nyangkut pilihan
  // yang udah gak valid.
  useEffect(() => {
    if (form.pickupType === "kirim" && form.paymentMethod === "cash") {
      setForm((f) => ({ ...f, paymentMethod: "" }));
    }
  }, [form.pickupType]);

  function updateItem(index, field, value) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }
  function updateQty(index, delta) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, qty: Math.max(1, Number(item.qty || 1) + delta) } : item))
    );
  }
  function handleQtyInput(index, value) {
    const parsed = Number(value);
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item;
        if (value === "") return { ...item, qty: "" };
        return { ...item, qty: Number.isNaN(parsed) ? 1 : Math.max(1, parsed) };
      })
    );
  }
  function addItem() {
    setItems((current) => [...current, createEmptyItem()]);
  }
  function removeItem(index) {
    if (items.length === 1) return;
    setItems((current) => current.filter((_, i) => i !== index));
  }

  function stepValid(s) {
    if (s === 0) return !!(form.name.trim() && form.wa.trim());
    if (s === 1) {
      if (!form.pickupType) return false;
      if (form.pickupType === "pickup") return true;
      return !!(form.address.trim() && form.kecamatan.trim() && form.kelurahan.trim() && form.kodepos.trim() && form.courierLabel);
    }
    if (s === 2) return !!form.paymentMethod;
    if (s === 3) {
      return items.every((item) => item.name.trim() && item.color.trim() && item.size && Number(item.qty) >= 1);
    }
    return true;
  }

  function goNext() {
    if (!stepValid(step)) {
      setError("Mohon lengkapi bagian ini dulu ya.");
      return;
    }
    setError("");
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function goBack() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }

  async function submitOrder() {
    if (!stepValid(0) || !stepValid(1) || !stepValid(2) || !stepValid(3)) {
      setError("Ada bagian yang belum lengkap, coba cek lagi ya.");
      return;
    }
    setSaving(true);
    setError("");

    const isKirim = form.pickupType === "kirim";
    const chosenCourier = COURIERS.find((c) => c.label === form.courierLabel);
    const fullAddress = isKirim
      ? `${form.address.trim()}, Kel. ${form.kelurahan.trim()}, Kec. ${form.kecamatan.trim()} ${form.kodepos.trim()}`
      : "";

    const order = {
      id: makeOrderId(),
      name: form.name.trim(),
      wa: normalizeWA(form.wa),
      address: fullAddress,
      destination: isKirim ? form.kecamatan.trim() : null,
      delivery_type: isKirim ? "kirim" : "cod",
      courier: isKirim ? chosenCourier?.courier || null : null,
      shipping_method: isKirim ? chosenCourier?.service || null : null,
      payment_method: form.paymentMethod,
      items: items.map((item) => ({
        product_id: null,
        name: item.name.trim(),
        color: item.color.trim(),
        size: item.size,
        qty: Number(item.qty),
        price: 0, // diisi admin setelah review
      })),
      total: 0, // dihitung admin setelah harga + ongkir diisi
      status: "pending",
    };

    const { error: insertErr } = await supabase.from("orders").insert(order);
    if (insertErr) {
      console.error(insertErr);
      setError("Gagal menyimpan pesanan, coba lagi ya.");
      setSaving(false);
      return;
    }

    setSuccessId(order.id);
    setItems([createEmptyItem()]);
    setForm({
      name: "", wa: "", pickupType: "", address: "", kecamatan: "", kelurahan: "", kodepos: "", courierLabel: "", paymentMethod: "",
    });
    setStep(0);
    setSaving(false);
  }

  if (successId) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <NeoCard accent={C.coffee} style={{ textAlign: "center" }}>
          <div className="ff-display text-3xl mb-2" style={{ color: C.coffee }}>PESANAN TERKIRIM</div>
          <p className="mb-1">Nomor pesananmu:</p>
          <p className="ff-display text-4xl mb-4" style={{ color: C.grape }}>{successId}</p>
          <p className="text-sm mb-4">
            Admin {SHOP.name} akan mereview pesananmu dan mengirim link invoice via WhatsApp. Ditunggu ya!
          </p>
          <NeoButton color={C.olive} onClick={() => setSuccessId(null)}>Buat Pesanan Lagi</NeoButton>
        </NeoCard>
      </div>
    );
  }

  const paymentOptions = form.pickupType === "kirim" ? PAYMENT_OPTIONS.kirim : PAYMENT_OPTIONS.pickup;

  function ChipRow({ options, value, onChange }) {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {options.map((opt) => {
          const selected = value === (opt.key || opt.label);
          return (
            <label
              key={opt.key || opt.label}
              className="cursor-pointer text-center"
              style={{
                border: `2px solid ${C.midnight}`,
                background: selected ? C.grape : C.white,
                color: selected ? C.peony : C.midnight,
                fontWeight: selected ? 700 : 400,
              }}
            >
              <input
                type="radio"
                checked={selected}
                onChange={() => onChange(opt.key || opt.label)}
                className="sr-only"
              />
              <span className="block py-3 px-2">{opt.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div style={{ borderBottom: `4px solid ${C.midnight}`, background: C.white }} className="px-4 py-4 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="ff-display text-3xl sm:text-4xl" style={{ color: C.grape }}>{SHOP.name}</h1>
          <p className="text-xs opacity-60">{APP_NAME}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-8">
        {/* step indicator */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className="text-xs px-3 py-1 font-semibold"
              style={{
                border: `2px solid ${C.midnight}`,
                background: i === step ? C.grape : i < step ? C.olive : C.white,
                color: i <= step ? C.peony : C.midnight,
              }}
            >
              {i + 1}. {label}
            </div>
          ))}
        </div>

        {/* STEP 0 — Data Pemesan */}
        {step === 0 && (
          <NeoCard accent={C.olive}>
            <h2 className="ff-display text-2xl mb-3" style={{ color: C.olive }}>DATA PEMESAN</h2>
            <label className="text-xs font-semibold block mb-1">Nama Lengkap</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full mb-3 px-3 py-2"
              style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }}
              placeholder="Nama kamu"
            />
            <label className="text-xs font-semibold block mb-1">No. WhatsApp</label>
            <input
              type="tel"
              value={form.wa}
              onChange={(e) => setForm({ ...form, wa: e.target.value })}
              className="w-full px-3 py-2"
              style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }}
              placeholder="0812xxxxxxx"
            />
          </NeoCard>
        )}

        {/* STEP 1 — Pengambilan Pesanan */}
        {step === 1 && (
          <NeoCard accent={C.grape}>
            <h2 className="ff-display text-2xl mb-3" style={{ color: C.grape }}>PENGAMBILAN PESANAN</h2>
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              {[
                { key: "pickup", label: "Pickup / Ambil Sendiri" },
                { key: "kirim", label: "Kirim Kurir" },
              ].map((opt) => {
                const selected = form.pickupType === opt.key;
                return (
                  <label
                    key={opt.key}
                    className="cursor-pointer text-center"
                    style={{
                      border: `2px solid ${C.midnight}`,
                      background: selected ? C.grape : C.white,
                      color: selected ? C.peony : C.midnight,
                      fontWeight: selected ? 700 : 400,
                    }}
                  >
                    <input
                      type="radio"
                      checked={selected}
                      onChange={() => setForm({ ...form, pickupType: opt.key })}
                      className="sr-only"
                    />
                    <span className="block py-3">{opt.label}</span>
                  </label>
                );
              })}
            </div>

            {form.pickupType === "kirim" && (
              <>
                <label className="text-xs font-semibold block mb-1">Alamat Lengkap</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full mb-3 px-3 py-2"
                  style={{ border: `2px solid ${C.midnight}`, borderRadius: 0, minHeight: 80 }}
                  placeholder="Nama jalan, no. rumah, RT/RW"
                />
                <div className="grid sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Kecamatan</label>
                    <input
                      value={form.kecamatan}
                      onChange={(e) => setForm({ ...form, kecamatan: e.target.value })}
                      className="w-full px-3 py-2"
                      style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Kelurahan</label>
                    <input
                      value={form.kelurahan}
                      onChange={(e) => setForm({ ...form, kelurahan: e.target.value })}
                      className="w-full px-3 py-2"
                      style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Kode Pos</label>
                    <input
                      value={form.kodepos}
                      onChange={(e) => setForm({ ...form, kodepos: e.target.value })}
                      className="w-full px-3 py-2"
                      style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }}
                    />
                  </div>
                </div>

                <label className="text-xs font-semibold block mb-2">Pilihan Kurir</label>
                <div className="grid sm:grid-cols-2 gap-2 mb-1">
                  {COURIERS.map((c) => {
                    const selected = form.courierLabel === c.label;
                    return (
                      <label
                        key={c.label}
                        className="cursor-pointer text-center text-sm"
                        style={{
                          border: `2px solid ${C.midnight}`,
                          background: selected ? C.olive : C.white,
                          color: selected ? C.peony : C.midnight,
                          fontWeight: selected ? 700 : 400,
                        }}
                      >
                        <input
                          type="radio"
                          checked={selected}
                          onChange={() => setForm({ ...form, courierLabel: c.label })}
                          className="sr-only"
                        />
                        <span className="block py-2 px-2">{c.label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs opacity-60">Ongkir akan diinformasikan admin setelah pesanan direview.</p>
              </>
            )}
          </NeoCard>
        )}

        {/* STEP 2 — Pembayaran */}
        {step === 2 && (
          <NeoCard accent={C.olive}>
            <h2 className="ff-display text-2xl mb-3" style={{ color: C.olive }}>PEMBAYARAN</h2>
            {form.pickupType === "kirim" && (
              <p className="text-xs opacity-60 mb-3">Cash gak tersedia buat pesanan Kirim Kurir.</p>
            )}
            <ChipRow
              options={paymentOptions}
              value={form.paymentMethod}
              onChange={(key) => setForm({ ...form, paymentMethod: key })}
            />
          </NeoCard>
        )}

        {/* STEP 3 — Detail Pesanan */}
        {step === 3 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="ff-display text-2xl" style={{ color: C.grape }}>DETAIL PESANAN</h2>
              <span className="text-xs opacity-60">{items.length} item</span>
            </div>
            <div className="space-y-4">
              {items.map((item, index) => (
                <NeoCard key={index} accent={C.grape}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="ff-display text-xl" style={{ color: C.grape }}>ITEM {index + 1}</div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-xs font-semibold px-2 py-1"
                        style={{ border: `2px solid ${C.midnight}`, background: C.white }}
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                  <label className="text-xs font-semibold block mb-1">Nama Item</label>
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    className="w-full mb-3 px-3 py-2"
                    style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }}
                    placeholder="Contoh: Gamis Azzahra"
                  />
                  <label className="text-xs font-semibold block mb-1">Warna</label>
                  <input
                    value={item.color}
                    onChange={(e) => updateItem(index, "color", e.target.value)}
                    className="w-full mb-4 px-3 py-2"
                    style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }}
                    placeholder="Contoh: Hitam"
                  />
                  <fieldset className="mb-4">
                    <legend className="text-xs font-semibold block mb-2">Size</legend>
                    <div className="grid grid-cols-4 gap-2">
                      {SIZES.map((size) => {
                        const selected = item.size === size;
                        return (
                          <label
                            key={size}
                            className="cursor-pointer text-center"
                            style={{
                              border: `2px solid ${C.midnight}`,
                              background: selected ? C.grape : C.white,
                              color: selected ? C.peony : C.midnight,
                              fontWeight: selected ? 700 : 400,
                            }}
                          >
                            <input
                              type="radio"
                              name={`size-${index}`}
                              checked={selected}
                              onChange={() => updateItem(index, "size", size)}
                              className="sr-only"
                            />
                            <span className="block py-2">{size}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <div>
                    <label className="text-xs font-semibold block mb-2">Qty / Kuantitas</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQty(index, -1)}
                        disabled={Number(item.qty) <= 1}
                        className="ff-display text-xl w-10 h-10"
                        style={{ border: `2px solid ${C.midnight}`, borderRadius: 0, background: Number(item.qty) <= 1 ? "#eee" : C.white }}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => handleQtyInput(index, e.target.value)}
                        className="ff-display text-xl text-center w-20 h-10"
                        style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }}
                      />
                      <button
                        type="button"
                        onClick={() => updateQty(index, 1)}
                        className="ff-display text-xl w-10 h-10"
                        style={{ border: `2px solid ${C.midnight}`, borderRadius: 0, background: C.white }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </NeoCard>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="w-full mt-4 py-3 font-semibold"
              style={{ border: `2px dashed ${C.midnight}`, background: C.white }}
            >
              ＋ Tambah Item
            </button>
          </div>
        )}

        {/* STEP 4 — Review */}
        {step === 4 && (
          <NeoCard accent={C.coffee}>
            <h2 className="ff-display text-2xl mb-3" style={{ color: C.coffee }}>REVIEW PESANAN</h2>

            <div className="text-xs font-semibold opacity-60 mb-1">DATA PEMESAN</div>
            <div className="text-sm mb-3">{form.name} · {form.wa}</div>

            <div className="text-xs font-semibold opacity-60 mb-1">PENGAMBILAN</div>
            <div className="text-sm mb-3">
              {form.pickupType === "pickup" ? (
                "Pickup / Ambil Sendiri"
              ) : (
                <>
                  Kirim Kurir — {form.courierLabel}
                  <div className="opacity-70">{form.address}, Kel. {form.kelurahan}, Kec. {form.kecamatan} {form.kodepos}</div>
                </>
              )}
            </div>

            <div className="text-xs font-semibold opacity-60 mb-1">PEMBAYARAN</div>
            <div className="text-sm mb-3">
              {paymentOptions.find((p) => p.key === form.paymentMethod)?.label}
            </div>

            <div className="text-xs font-semibold opacity-60 mb-1">PESANAN</div>
            <div className="text-sm mb-4">
              {items.map((it, i) => (
                <div key={i} className="flex justify-between py-1" style={{ borderBottom: "1px dashed #ccc" }}>
                  <span>{it.name} ({it.color}, {it.size})</span>
                  <span>x{it.qty}</span>
                </div>
              ))}
            </div>

            <p className="text-xs opacity-60 mb-4">
              Harga tiap item dan ongkir (kalau ada) akan diinformasikan admin via WhatsApp setelah pesanan direview.
            </p>

            {error && <p className="text-sm mb-4" style={{ color: C.coffee }}>{error}</p>}

            <NeoButton full color={C.grape} disabled={saving} onClick={submitOrder}>
              {saving ? "Mengirim..." : <><IconSend /> Kirim Pesanan</>}
            </NeoButton>
          </NeoCard>
        )}

        {error && step !== 4 && (
          <p className="text-sm mt-4" style={{ color: C.coffee }}>{error}</p>
        )}

        {/* nav arrows */}
        <div className="flex justify-between mt-6">
          <NeoButton small color={C.olive} onClick={goBack} disabled={step === 0}>
            <IconArrowLeft /> Kembali
          </NeoButton>
          {step < STEPS.length - 1 && (
            <NeoButton small color={C.grape} onClick={goNext}>
              Lanjut <IconArrowRight />
            </NeoButton>
          )}
        </div>
      </div>
    </div>
  );
}
