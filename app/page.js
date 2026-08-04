"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { C, ACCENTS, SHOP, APP_NAME, rupiah, normalizeWA, makeOrderId } from "@/lib/constants";
import { NeoButton, NeoCard } from "@/components/ui";
import { IconSend } from "@/components/icons";

export default function CustomerPage() {
  const [products, setProducts] = useState(null);
  const [cart, setCart] = useState({});
  const [form, setForm] = useState({ name: "", wa: "", address: "", paymentMethod: "" });
  const [successId, setSuccessId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProducts();
    // live stock updates so numbers stay accurate while someone is browsing
    const channel = supabase
      .channel("products-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, loadProducts)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function loadProducts() {
    const { data } = await supabase.from("products").select("*").order("created_at");
    setProducts(data || []);
  }

  function updateCart(id, delta, stock) {
    setCart((c) => {
      const cur = c[id] || 0;
      return { ...c, [id]: Math.max(0, Math.min(stock, cur + delta)) };
    });
  }

  const cartItems = products
    ? Object.entries(cart).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ ...products.find((p) => p.id === id), qty }))
    : [];
  const cartTotal = cartItems.reduce((s, it) => s + it.price * it.qty, 0);

  async function submitOrder() {
    if (!form.name || !form.wa || !form.address || !form.paymentMethod || cartItems.length === 0) return;
    setSaving(true);
    setError("");

    // Reserve stock first, per item, so two customers can't both grab the last unit.
    for (const it of cartItems) {
      const { data, error: stockErr } = await supabase
        .from("products")
        .update({ stock: it.stock - it.qty })
        .eq("id", it.id)
        .gte("stock", it.qty)
        .select();
      if (stockErr || !data || data.length === 0) {
        setError(`Stok "${it.name}" berubah/habis duluan. Silakan cek ulang keranjangmu.`);
        setSaving(false);
        loadProducts();
        return;
      }
    }

    const order = {
      id: makeOrderId(),
      name: form.name,
      wa: normalizeWA(form.wa),
      address: form.address,
      payment_method: form.paymentMethod,
      items: cartItems.map((it) => ({ product_id: it.id, name: it.name, price: it.price, qty: it.qty })),
      total: cartTotal,
      status: "pending",
    };
    const { error: insertErr } = await supabase.from("orders").insert(order);
    if (insertErr) {
      setError("Gagal menyimpan pesanan, coba lagi ya.");
      setSaving(false);
      return;
    }

    setSuccessId(order.id);
    setCart({});
    setForm({ name: "", wa: "", address: "", paymentMethod: "" });
    setSaving(false);
  }

  if (!products) {
    return <div className="ff-display text-2xl p-8">MEMUAT...</div>;
  }

  if (successId) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <NeoCard accent={C.coffee} style={{ textAlign: "center" }}>
          <div className="ff-display text-3xl mb-2" style={{ color: C.coffee }}>PESANAN TERKIRIM</div>
          <p className="mb-1">Nomor pesananmu:</p>
          <p className="ff-display text-4xl mb-4" style={{ color: C.grape }}>{successId}</p>
          <p className="text-sm mb-4">Admin {SHOP.name} akan mereview pesananmu dan mengirim link invoice via WhatsApp. Ditunggu ya!</p>
          <NeoButton color={C.olive} onClick={() => setSuccessId(null)}>Buat Pesanan Lagi</NeoButton>
        </NeoCard>
      </div>
    );
  }

  return (
    <div>
      <div style={{ borderBottom: `4px solid ${C.midnight}`, background: C.white }} className="px-4 py-4 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="ff-display text-3xl sm:text-4xl" style={{ color: C.grape }}>{SHOP.name}</h1>
          <p className="text-xs opacity-60">{APP_NAME}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-8 grid gap-8 md:grid-cols-5">
        <div className="md:col-span-3">
          <h2 className="ff-display text-2xl mb-3" style={{ color: C.grape }}>KATALOG PRODUK</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {products.map((p, i) => {
              const accent = ACCENTS[i % ACCENTS.length];
              const qty = cart[p.id] || 0;
              return (
                <NeoCard key={p.id} accent={accent}>
                  <div className="ff-body font-semibold mb-1">{p.name}</div>
                  <div className="ff-display text-2xl mb-1" style={{ color: accent }}>{rupiah(p.price)}</div>
                  <div className="text-xs mb-3 opacity-70">Stok: {p.stock}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateCart(p.id, -1, p.stock)} className="ff-display text-xl w-8 h-8" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0, background: C.white }}>-</button>
                    <span className="ff-display text-xl w-6 text-center">{qty}</span>
                    <button onClick={() => updateCart(p.id, 1, p.stock)} disabled={qty >= p.stock} className="ff-display text-xl w-8 h-8" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0, background: qty >= p.stock ? "#eee" : C.white }}>+</button>
                  </div>
                </NeoCard>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-2">
          <h2 className="ff-display text-2xl mb-3" style={{ color: C.olive }}>DATA PENGIRIMAN</h2>
          <NeoCard accent={C.olive}>
            <label className="text-xs font-semibold block mb-1">Nama Lengkap</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full mb-3 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} placeholder="Nama kamu" />
            <label className="text-xs font-semibold block mb-1">No. WhatsApp</label>
            <input value={form.wa} onChange={(e) => setForm({ ...form, wa: e.target.value })} className="w-full mb-3 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} placeholder="0812xxxxxxx" />
            <label className="text-xs font-semibold block mb-1">Alamat Pengiriman</label>
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full mb-4 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0, minHeight: 80 }} placeholder="Alamat lengkap + kode pos" />

            <label className="text-xs font-semibold block mb-2">Metode Pembayaran</label>
            <div className="flex gap-3 mb-4">
              {[{ key: "transfer", label: "Transfer Bank" }, { key: "qris", label: "QRIS" }].map((opt) => (
                <label
                  key={opt.key}
                  className="flex-1 text-center text-sm py-2 cursor-pointer"
                  style={{
                    border: `2px solid ${C.midnight}`, borderRadius: 0,
                    background: form.paymentMethod === opt.key ? C.grape : C.white,
                    color: form.paymentMethod === opt.key ? C.peony : C.midnight,
                    fontWeight: form.paymentMethod === opt.key ? 700 : 400,
                  }}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={opt.key}
                    checked={form.paymentMethod === opt.key}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    className="hidden"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <div className="ff-display text-xl mb-2" style={{ color: C.grape }}>KERANJANG</div>
            {cartItems.length === 0 ? (
              <p className="text-sm opacity-60 mb-4">Belum ada produk dipilih.</p>
            ) : (
              <div className="mb-3 text-sm">
                {cartItems.map((it) => (
                  <div key={it.id} className="flex justify-between py-1" style={{ borderBottom: "1px dashed #ccc" }}>
                    <span>{it.name} x{it.qty}</span>
                    <span>{rupiah(it.price * it.qty)}</span>
                  </div>
                ))}
                <div className="flex justify-between ff-display text-2xl mt-2" style={{ color: C.grape }}>
                  <span>TOTAL</span><span>{rupiah(cartTotal)}</span>
                </div>
              </div>
            )}
            {error && <p className="text-xs mb-3" style={{ color: C.grape }}>{error}</p>}
            <NeoButton full color={C.grape} disabled={!form.name || !form.wa || !form.address || !form.paymentMethod || cartItems.length === 0 || saving} onClick={submitOrder}>
              {saving ? "Mengirim..." : <><IconSend /> Kirim Pesanan</>}
            </NeoButton>
          </NeoCard>
        </div>
      </div>
    </div>
  );
}
