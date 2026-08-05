"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { C, SHOP, APP_NAME, normalizeWA, makeOrderId } from "@/lib/constants";
import { NeoButton, NeoCard } from "@/components/ui";
import { IconSend } from "@/components/icons";

const SIZES = ["S", "M", "L", "Jumbo"];

function createEmptyItem() {
  return {
    name: "",
    color: "",
    size: "",
    qty: 1,
  };
}

export default function CustomerPage() {
  const [items, setItems] = useState([createEmptyItem()]);
  const [form, setForm] = useState({
    name: "",
    wa: "",
    address: "",
    paymentMethod: "",
  });

  const [successId, setSuccessId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateItem(index, field, value) {
    setItems((current) =>
      current.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  function updateQty(index, delta) {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item;

        return {
          ...item,
          qty: Math.max(1, Number(item.qty || 1) + delta),
        };
      })
    );
  }

  function handleQtyInput(index, value) {
    const parsed = Number(value);

    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item;

        if (value === "") {
          return { ...item, qty: "" };
        }

        return {
          ...item,
          qty: Number.isNaN(parsed) ? 1 : Math.max(1, parsed),
        };
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

  function isFormValid() {
    if (!form.name || !form.wa || !form.address || !form.paymentMethod) {
      return false;
    }

    return items.every(
      (item) =>
        item.name.trim() &&
        item.color.trim() &&
        item.size &&
        Number(item.qty) >= 1
    );
  }

  async function submitOrder() {
    if (!isFormValid()) {
      setError("Mohon lengkapi semua data pesanan terlebih dahulu ya.");
      return;
    }

    setSaving(true);
    setError("");

    const order = {
      id: makeOrderId(),
      name: form.name.trim(),
      wa: normalizeWA(form.wa),
      address: form.address.trim(),
      payment_method: form.paymentMethod,

      // Harga belum diisi oleh customer.
      // Admin akan mengisi harga masing-masing item nanti.
      items: items.map((item) => ({
        product_id: null,
        name: item.name.trim(),
        color: item.color.trim(),
        size: item.size,
        qty: Number(item.qty),
        price: 0,
      })),

      // Harga dan ongkir akan ditentukan admin.
      total: 0,

      status: "pending",
    };

    const { error: insertErr } = await supabase
      .from("orders")
      .insert(order);

    if (insertErr) {
      console.error(insertErr);
      setError("Gagal menyimpan pesanan, coba lagi ya.");
      setSaving(false);
      return;
    }

    setSuccessId(order.id);
    setItems([createEmptyItem()]);
    setForm({
      name: "",
      wa: "",
      address: "",
      paymentMethod: "",
    });
    setSaving(false);
  }

  if (successId) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <NeoCard accent={C.coffee} style={{ textAlign: "center" }}>
          <div
            className="ff-display text-3xl mb-2"
            style={{ color: C.coffee }}
          >
            PESANAN TERKIRIM
          </div>

          <p className="mb-1">Nomor pesananmu:</p>

          <p
            className="ff-display text-4xl mb-4"
            style={{ color: C.grape }}
          >
            {successId}
          </p>

          <p className="text-sm mb-4">
            Admin {SHOP.name} akan mereview pesananmu dan mengirim link
            invoice via WhatsApp. Ditunggu ya!
          </p>

          <NeoButton
            color={C.olive}
            onClick={() => setSuccessId(null)}
          >
            Buat Pesanan Lagi
          </NeoButton>
        </NeoCard>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          borderBottom: `4px solid ${C.midnight}`,
          background: C.white,
        }}
        className="px-4 py-4 sm:px-8"
      >
        <div className="max-w-5xl mx-auto">
          <h1
            className="ff-display text-3xl sm:text-4xl"
            style={{ color: C.grape }}
          >
            {SHOP.name}
          </h1>

          <p className="text-xs opacity-60">{APP_NAME}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-8">
        <div className="mb-8">
          <h2
            className="ff-display text-2xl mb-3"
            style={{ color: C.olive }}
          >
            DATA CUSTOMER
          </h2>

          <NeoCard accent={C.olive}>
            <label
              htmlFor="customer-name"
              className="text-xs font-semibold block mb-1"
            >
              Nama Lengkap
            </label>

            <input
              id="customer-name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              className="w-full mb-3 px-3 py-2"
              style={{
                border: `2px solid ${C.midnight}`,
                borderRadius: 0,
              }}
              placeholder="Nama kamu"
            />

            <label
              htmlFor="customer-wa"
              className="text-xs font-semibold block mb-1"
            >
              No. WhatsApp
            </label>

            <input
              id="customer-wa"
              type="tel"
              value={form.wa}
              onChange={(e) =>
                setForm({ ...form, wa: e.target.value })
              }
              className="w-full mb-3 px-3 py-2"
              style={{
                border: `2px solid ${C.midnight}`,
                borderRadius: 0,
              }}
              placeholder="0812xxxxxxx"
            />

            <label
              htmlFor="customer-address"
              className="text-xs font-semibold block mb-1"
            >
              Alamat Pengiriman
            </label>

            <textarea
              id="customer-address"
              value={form.address}
              onChange={(e) =>
                setForm({ ...form, address: e.target.value })
              }
              className="w-full px-3 py-2"
              style={{
                border: `2px solid ${C.midnight}`,
                borderRadius: 0,
                minHeight: 100,
              }}
              placeholder="Alamat lengkap + kode pos"
            />
          </NeoCard>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2
              className="ff-display text-2xl"
              style={{ color: C.grape }}
            >
              PESANAN
            </h2>

            <span className="text-xs opacity-60">
              {items.length} item
            </span>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <NeoCard
                key={index}
                accent={C.grape}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="ff-display text-xl"
                    style={{ color: C.grape }}
                  >
                    ITEM {index + 1}
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-xs font-semibold px-2 py-1"
                      style={{
                        border: `2px solid ${C.midnight}`,
                        background: C.white,
                      }}
                    >
                      Hapus
                    </button>
                  )}
                </div>

                <label
                  htmlFor={`item-name-${index}`}
                  className="text-xs font-semibold block mb-1"
                >
                  Nama Item
                </label>

                <input
                  id={`item-name-${index}`}
                  value={item.name}
                  onChange={(e) =>
                    updateItem(index, "name", e.target.value)
                  }
                  className="w-full mb-3 px-3 py-2"
                  style={{
                    border: `2px solid ${C.midnight}`,
                    borderRadius: 0,
                  }}
                  placeholder="Contoh: Gamis Azzahra"
                />

                <label
                  htmlFor={`item-color-${index}`}
                  className="text-xs font-semibold block mb-1"
                >
                  Warna
                </label>

                <input
                  id={`item-color-${index}`}
                  value={item.color}
                  onChange={(e) =>
                    updateItem(index, "color", e.target.value)
                  }
                  className="w-full mb-4 px-3 py-2"
                  style={{
                    border: `2px solid ${C.midnight}`,
                    borderRadius: 0,
                  }}
                  placeholder="Contoh: Hitam"
                />

                <fieldset className="mb-4">
                  <legend className="text-xs font-semibold block mb-2">
                    Size
                  </legend>

                  <div className="grid grid-cols-4 gap-2">
                    {SIZES.map((size) => {
                      const selected = item.size === size;

                      return (
                        <label
                          key={size}
                          className="cursor-pointer text-center"
                          style={{
                            border: `2px solid ${C.midnight}`,
                            background: selected
                              ? C.grape
                              : C.white,
                            color: selected
                              ? C.peony
                              : C.midnight,
                            fontWeight: selected ? 700 : 400,
                          }}
                        >
                          <input
                            type="radio"
                            name={`size-${index}`}
                            value={size}
                            checked={selected}
                            onChange={(e) =>
                              updateItem(
                                index,
                                "size",
                                e.target.value
                              )
                            }
                            className="sr-only"
                          />

                          <span className="block py-2">
                            {size}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div>
                  <label
                    htmlFor={`item-qty-${index}`}
                    className="text-xs font-semibold block mb-2"
                  >
                    Qty / Kuantitas
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQty(index, -1)}
                      disabled={Number(item.qty) <= 1}
                      className="ff-display text-xl w-10 h-10"
                      style={{
                        border: `2px solid ${C.midnight}`,
                        borderRadius: 0,
                        background:
                          Number(item.qty) <= 1
                            ? "#eee"
                            : C.white,
                      }}
                      aria-label={`Kurangi jumlah item ${index + 1}`}
                    >
                      −
                    </button>

                    <input
                      id={`item-qty-${index}`}
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) =>
                        handleQtyInput(index, e.target.value)
                      }
                      className="ff-display text-xl text-center w-20 h-10"
                      style={{
                        border: `2px solid ${C.midnight}`,
                        borderRadius: 0,
                      }}
                      aria-label={`Jumlah item ${index + 1}`}
                    />

                    <button
                      type="button"
                      onClick={() => updateQty(index, 1)}
                      className="ff-display text-xl w-10 h-10"
                      style={{
                        border: `2px solid ${C.midnight}`,
                        borderRadius: 0,
                        background: C.white,
                      }}
                      aria-label={`Tambah jumlah item ${index + 1}`}
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
            style={{
              border: `2px dashed ${C.midnight}`,
              background: C.white,
            }}
          >
            ＋ Tambah Item
          </button>
        </div>

        <div className="mb-8">
          <h2
            className="ff-display text-2xl mb-3"
            style={{ color: C.olive }}
          >
            METODE PEMBAYARAN
          </h2>

          <NeoCard accent={C.olive}>
            <fieldset>
              <legend className="text-xs font-semibold block mb-3">
                Pilih metode pembayaran
              </legend>

              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  {
                    key: "transfer",
                    label: "Transfer",
                  },
                  {
                    key: "qris",
                    label: "Scan QRIS",
                  },
                ].map((option) => {
                  const selected =
                    form.paymentMethod === option.key;

                  return (
                    <label
                      key={option.key}
                      className="cursor-pointer text-center"
                      style={{
                        border: `2px solid ${C.midnight}`,
                        background: selected
                          ? C.grape
                          : C.white,
                        color: selected
                          ? C.peony
                          : C.midnight,
                        fontWeight: selected ? 700 : 400,
                      }}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={option.key}
                        checked={selected}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            paymentMethod: e.target.value,
                          })
                        }
                        className="sr-only"
                      />

                      <span className="block py-3">
                        {option.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </NeoCard>
        </div>

        {error && (
          <p
            className="text-sm mb-4"
            style={{ color: C.coffee }}
          >
            {error}
          </p>
        )}

        <NeoButton
          full
          color={C.grape}
          disabled={!isFormValid() || saving}
          onClick={submitOrder}
        >
          {saving ? (
            "Mengirim..."
          ) : (
            <>
              <IconSend /> Kirim Pesanan
            </>
          )}
        </NeoButton>
      </div>
    </div>
  );
                        }
