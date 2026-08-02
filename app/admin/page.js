"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { C, ACCENTS, rupiah, fileToBase64, APP_NAME } from "@/lib/constants";
import { NeoButton, NeoCard, Badge } from "@/components/ui";
import { IconCheck, IconLink, IconWhatsapp, IconDownload, IconPlus } from "@/components/icons";

function invoiceLink(orderId) {
  return `${window.location.origin}/invoice/${orderId}`;
}

export default function AdminPage() {
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState(null);
  const [products, setProducts] = useState(null);
  const [payment, setPayment] = useState(null);
  const [payForm, setPayForm] = useState({ bank_name: "", bank_account: "", bank_holder: "" });
  const [newProd, setNewProd] = useState({ name: "", price: "", stock: "" });
  const [copiedId, setCopiedId] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [dateFilter, setDateFilter] = useState("today");

  useEffect(() => {
    loadOrders();
    loadProducts();
    loadPayment();
    const ch1 = supabase.channel("orders-admin").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders).subscribe();
    const ch2 = supabase.channel("products-admin").on("postgres_changes", { event: "*", schema: "public", table: "products" }, loadProducts).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, []);

  async function loadOrders() {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
  }
  async function loadProducts() {
    const { data } = await supabase.from("products").select("*").order("created_at");
    setProducts(data || []);
  }
  async function loadPayment() {
    const { data } = await supabase.from("payment_info").select("*").eq("id", 1).maybeSingle();
    if (data) { setPayment(data); setPayForm({ bank_name: data.bank_name || "", bank_account: data.bank_account || "", bank_holder: data.bank_holder || "" }); }
  }

  async function setOrderStatus(id, status) {
    await supabase.from("orders").update({ status }).eq("id", id);
    loadOrders();
  }
  async function addProduct() {
    if (!newProd.name || !newProd.price) return;
    await supabase.from("products").insert({ name: newProd.name, price: Number(newProd.price), stock: Number(newProd.stock) || 0 });
    setNewProd({ name: "", price: "", stock: "" });
    loadProducts();
  }
  async function updateStock(id, val) {
    await supabase.from("products").update({ stock: Math.max(0, Number(val)) }).eq("id", id);
  }
  async function removeProduct(id) {
    await supabase.from("products").delete().eq("id", id);
    loadProducts();
  }
  async function savePaymentText() {
    await supabase.from("payment_info").upsert({ id: 1, ...payForm });
    loadPayment();
  }
  async function handleQrisUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    await supabase.from("payment_info").upsert({ id: 1, ...payForm, qris_image: b64 });
    loadPayment();
  }
  async function copyLink(orderId) {
    try {
      await navigator.clipboard.writeText(invoiceLink(orderId));
      setCopiedId(orderId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  }

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (dateFilter === "all") return orders;
    const now = new Date();
    const start = new Date();
    if (dateFilter === "today") start.setHours(0, 0, 0, 0);
    if (dateFilter === "week") start.setDate(now.getDate() - 7);
    if (dateFilter === "month") start.setMonth(now.getMonth() - 1);
    return orders.filter((o) => new Date(o.created_at) >= start);
  }, [orders, dateFilter]);

  const recap = useMemo(() => {
    const paid = filteredOrders.filter((o) => o.status === "verified");
    const omzet = paid.reduce((s, o) => s + o.total, 0);
    const itemCount = {};
    paid.forEach((o) => o.items.forEach((it) => { itemCount[it.name] = (itemCount[it.name] || 0) + it.qty; }));
    const topItems = Object.entries(itemCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { omzet, orderCount: paid.length, topItems };
  }, [filteredOrders]);

  if (!orders || !products) return <div className="ff-display text-2xl p-8">MEMUAT...</div>;

  return (
    <div>
      <div style={{ borderBottom: `4px solid ${C.midnight}`, background: C.white }} className="px-4 py-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex justify-between items-start">
          <div>
            <h1 className="ff-display text-3xl sm:text-4xl">{APP_NAME}</h1>
            <p className="text-xs opacity-60">Dashboard Admin</p>
          </div>
          <NeoButton
            small
            color={C.midnight}
            onClick={async () => {
              await fetch("/api/admin-logout", { method: "POST" });
              window.location.href = "/admin-login";
            }}
          >
            Keluar
          </NeoButton>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-8">
        <div className="flex gap-3 mb-6 flex-wrap">
          <NeoButton small color={tab === "orders" ? C.grape : "#ccc"} textColor={tab === "orders" ? C.grape : C.midnight} onClick={() => setTab("orders")}>Pesanan ({orders.length})</NeoButton>
          <NeoButton small color={tab === "catalog" ? C.olive : "#ccc"} textColor={tab === "catalog" ? C.olive : C.midnight} onClick={() => setTab("catalog")}>Katalog & Stok</NeoButton>
          <NeoButton small color={tab === "payment" ? C.coffee : "#ccc"} textColor={tab === "payment" ? C.coffee : C.midnight} onClick={() => setTab("payment")}>QRIS & Rekening</NeoButton>
          <NeoButton small color={tab === "report" ? C.parchment : "#ccc"} textColor={tab === "report" ? C.grape : C.midnight} onClick={() => setTab("report")}>Laporan Penjualan</NeoButton>
        </div>

        {tab === "orders" && (
          filteredOrders.length === 0 ? <NeoCard accent={C.parchment}><p>Belum ada pesanan.</p></NeoCard> : (
            <div className="grid gap-4">
              {orders.map((o, i) => {
                const accent = ACCENTS[i % ACCENTS.length];
                return (
                  <NeoCard key={o.id} accent={accent}>
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                      <div>
                        <div className="ff-display text-xl" style={{ color: accent }}>{o.id}</div>
                        <div className="text-sm font-semibold">{o.name} · {o.wa}</div>
                        <div className="text-xs opacity-70 max-w-md">{o.address}</div>
                        <div className="text-xs opacity-50">{new Date(o.created_at).toLocaleString("id-ID")}</div>
                      </div>
                      <Badge status={o.status} />
                    </div>
                    <div className="text-sm mb-2">
                      {o.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between"><span>{it.name} x{it.qty}</span><span>{rupiah(it.price * it.qty)}</span></div>
                      ))}
                    </div>
                    {o.payment_method && (
                      <div className="text-xs mb-2 opacity-70">Metode bayar: <span className="font-semibold">{o.payment_method === "qris" ? "QRIS" : "Transfer Bank"}</span></div>
                    )}
                    <div className="ff-display text-2xl mb-3" style={{ color: accent }}>TOTAL {rupiah(o.total)}</div>

                    {o.proof_image && o.status !== "verified" && (
                      <div className="mb-3 flex items-center gap-3">
                        <img src={o.proof_image} alt="bukti" className="w-14 h-14 object-cover cursor-pointer" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} onClick={() => setProofPreview(o.proof_image)} />
                        <span className="text-xs font-semibold" style={{ color: C.grape }}>Bukti transfer masuk — cek dulu</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 items-center">
                      {o.status === "pending" && <NeoButton small color={C.grape} onClick={() => setOrderStatus(o.id, "reviewed")}><IconCheck /> Tandai Reviewed</NeoButton>}
                      {o.status === "reviewed" && (
                        <>
                          <NeoButton small color={C.grape} onClick={() => copyLink(o.id)}><IconLink /> {copiedId === o.id ? "Link Disalin!" : "Salin Link Invoice"}</NeoButton>
                          <a href={`https://wa.me/${o.wa}?text=${encodeURIComponent(`Halo ${o.name}, ini invoice pesanan ${o.id} kamu:\n${invoiceLink(o.id)}\n\nDi situ juga sudah ada info QRIS/rekening buat bayar ya 🙏`)}`} target="_blank" rel="noopener noreferrer">
                            <NeoButton small color={C.olive}><IconWhatsapp /> Kirim Link via WA</NeoButton>
                          </a>
                          <NeoButton small color={C.coffee} onClick={() => setOrderStatus(o.id, "verified")}><IconCheck /> Verifikasi Pembayaran</NeoButton>
                        </>
                      )}
                      {o.status === "verified" && (
                        <a href={`/label/${o.id}`} target="_blank" rel="noopener noreferrer">
                          <NeoButton small color={C.coffee}><IconDownload /> Buat Label Pengiriman</NeoButton>
                        </a>
                      )}
                    </div>
                  </NeoCard>
                );
              })}
            </div>
          )
        )}

        {tab === "catalog" && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="ff-display text-xl mb-2" style={{ color: C.olive }}>PRODUK SAAT INI</h3>
              <div className="grid gap-3">
                {products.map((p, i) => (
                  <NeoCard key={p.id} accent={ACCENTS[i % ACCENTS.length]}>
                    <div className="flex justify-between items-center gap-3">
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs opacity-70">{rupiah(p.price)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" defaultValue={p.stock} onBlur={(e) => updateStock(p.id, e.target.value)} className="w-16 px-2 py-1 text-sm" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} />
                        <button onClick={() => removeProduct(p.id)} className="text-xs underline opacity-60">hapus</button>
                      </div>
                    </div>
                  </NeoCard>
                ))}
              </div>
            </div>
            <div>
              <h3 className="ff-display text-xl mb-2" style={{ color: C.grape }}>TAMBAH PRODUK</h3>
              <NeoCard accent={C.grape}>
                <input value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} placeholder="Nama produk" className="w-full mb-2 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} />
                <input type="number" value={newProd.price} onChange={(e) => setNewProd({ ...newProd, price: e.target.value })} placeholder="Harga" className="w-full mb-2 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} />
                <input type="number" value={newProd.stock} onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })} placeholder="Stok" className="w-full mb-3 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} />
                <NeoButton full color={C.grape} onClick={addProduct}><IconPlus /> Tambah Produk</NeoButton>
              </NeoCard>
            </div>
          </div>
        )}

        {tab === "payment" && (
          <div className="max-w-md">
            <NeoCard accent={C.coffee}>
              <label className="text-xs font-semibold block mb-1">Nama Bank / E-wallet</label>
              <input value={payForm.bank_name} onChange={(e) => setPayForm({ ...payForm, bank_name: e.target.value })} className="w-full mb-3 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} placeholder="BCA" />
              <label className="text-xs font-semibold block mb-1">No. Rekening</label>
              <input value={payForm.bank_account} onChange={(e) => setPayForm({ ...payForm, bank_account: e.target.value })} className="w-full mb-3 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} placeholder="1234567890" />
              <label className="text-xs font-semibold block mb-1">Atas Nama</label>
              <input value={payForm.bank_holder} onChange={(e) => setPayForm({ ...payForm, bank_holder: e.target.value })} className="w-full mb-4 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} placeholder="Ratu Bilqis Syar'i" />
              <NeoButton small color={C.coffee} onClick={savePaymentText}>Simpan</NeoButton>
              <div className="mt-5 pt-4" style={{ borderTop: `2px solid ${C.midnight}` }}>
                <label className="text-xs font-semibold block mb-2">Gambar QRIS Toko</label>
                {payment?.qris_image && <img src={payment.qris_image} alt="QRIS" className="mb-2" style={{ width: 140, border: `2px solid ${C.midnight}`, borderRadius: 0 }} />}
                <input type="file" accept="image/*" onChange={handleQrisUpload} className="text-sm" />
              </div>
            </NeoCard>
          </div>
        )}

        {tab === "report" && (
          <div>
            <div className="flex gap-2 mb-4">
              {["today", "week", "month", "all"].map((f) => (
                <NeoButton key={f} small color={dateFilter === f ? C.grape : "#ccc"} textColor={dateFilter === f ? C.grape : C.midnight} onClick={() => setDateFilter(f)}>
                  {f === "today" ? "Hari Ini" : f === "week" ? "7 Hari" : f === "month" ? "30 Hari" : "Semua"}
                </NeoButton>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <NeoCard accent={C.grape}>
                <div className="text-xs opacity-70 mb-1">TOTAL OMZET (LUNAS)</div>
                <div className="ff-display text-4xl" style={{ color: C.grape }}>{rupiah(recap.omzet)}</div>
              </NeoCard>
              <NeoCard accent={C.olive}>
                <div className="text-xs opacity-70 mb-1">JUMLAH PESANAN LUNAS</div>
                <div className="ff-display text-4xl" style={{ color: C.olive }}>{recap.orderCount}</div>
              </NeoCard>
            </div>
            <h3 className="ff-display text-xl mb-2" style={{ color: C.coffee }}>PRODUK TERLARIS</h3>
            <NeoCard accent={C.coffee}>
              {recap.topItems.length === 0 ? <p className="text-sm opacity-60">Belum ada data.</p> : recap.topItems.map(([name, qty]) => (
                <div key={name} className="flex justify-between text-sm py-1"><span>{name}</span><span className="font-semibold">{qty} terjual</span></div>
              ))}
            </NeoCard>
            <h3 className="ff-display text-xl mt-6 mb-2" style={{ color: C.midnight }}>DETAIL TRANSAKSI</h3>
            <div className="grid gap-2">
              {filteredOrders.map((o) => (
                <div key={o.id} className="text-xs flex flex-wrap justify-between gap-2 p-2" style={{ border: `1px solid ${C.midnight}`, borderRadius: 0 }}>
                  <span>{new Date(o.created_at).toLocaleString("id-ID")}</span>
                  <span>{o.name}</span>
                  <span>{o.items.map((it) => `${it.name} x${it.qty}`).join(", ")}</span>
                  <span className="font-semibold">{rupiah(o.total)}</span>
                  <Badge status={o.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {proofPreview && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(43,43,41,0.75)", zIndex: 50 }} onClick={() => setProofPreview(null)}>
          <img src={proofPreview} alt="bukti transfer" style={{ maxWidth: 420, width: "100%", border: `3px solid ${C.midnight}`, borderRadius: 0 }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
