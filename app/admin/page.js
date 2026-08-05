"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { C, ACCENTS, rupiah, fileToBase64, APP_NAME } from "@/lib/constants";
import { NeoButton, NeoCard, Badge } from "@/components/ui";
import { IconCheck, IconLink, IconWhatsapp, IconDownload, IconPlus, IconDelete } from "@/components/icons";

function invoiceLink(orderId) {
  return `${window.location.origin}/invoice/${orderId}`;
}

const emptySettings = {
  bank_name: "", bank_account: "", bank_holder: "",
  sender_name: "", sender_address: "", contact_number: "",
  receipt_footer: "", paper_width_mm: 80,
};

export default function AdminPage() {
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState(null);
  const [products, setProducts] = useState(null);
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState(emptySettings);
  const [newProd, setNewProd] = useState({ name: "", price: "", stock: "" });
  const [copiedId, setCopiedId] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [dateFilter, setDateFilter] = useState("today");

  useEffect(() => {
    loadOrders();
    loadProducts();
    loadSettings();
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
  async function loadSettings() {
    const { data } = await supabase.from("payment_info").select("*").eq("id", 1).maybeSingle();
    if (data) {
      setSettings(data);
      setSettingsForm({
        bank_name: data.bank_name || "", bank_account: data.bank_account || "", bank_holder: data.bank_holder || "",
        sender_name: data.sender_name || "", sender_address: data.sender_address || "", contact_number: data.contact_number || "",
        receipt_footer: data.receipt_footer || "", paper_width_mm: data.paper_width_mm || 80,
      });
    }
  }

  async function setOrderStatus(id, status) {
    await supabase.from("orders").update({ status }).eq("id", id);
    loadOrders();
  }
  async function deleteOrder(o) {
    const warn = o.status === "verified"
      ? `Order ${o.id} ini sudah LUNAS. Menghapusnya akan menghilangkan data ini dari Rekap penjualan juga. Yakin mau hapus?`
      : `Hapus order ${o.id}? Data ini gak bisa dikembalikan.`;
    if (!window.confirm(warn)) return;
    await supabase.from("orders").delete().eq("id", o.id);
    loadOrders();
  }
  async function addProduct() {
    if (!newProd.name || !newProd.price) return;
    await supabase.from("products").insert({ name: newProd.name, price: Number(newProd.price), stock: Number(newProd.stock) || 0 });
    setNewProd({ name: "", price: "", stock: "" });
    loadProducts();
  }
  async function bumpStock(p, delta) {
    const next = Math.max(0, p.stock + delta);
    await supabase.from("products").update({ stock: next }).eq("id", p.id);
  }
  async function removeProduct(id) {
    await supabase.from("products").delete().eq("id", id);
    loadProducts();
  }
  async function saveSettings() {
    await supabase.from("payment_info").upsert({ id: 1, ...settingsForm });
    loadSettings();
  }
  async function handleQrisUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    await supabase.from("payment_info").upsert({ id: 1, ...settingsForm, qris_image: b64 });
    loadSettings();
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
    return { omzet, orderCount: paid.length, totalItems: paid.reduce((s, o) => s + o.items.reduce((a, it) => a + it.qty, 0), 0), topItems };
  }, [filteredOrders]);

  if (!orders || !products) return <div className="ff-display text-2xl p-8">MEMUAT...</div>;

  const TABS = [
    { key: "orders", label: `📋 ORDERS (${orders.length})`, color: C.grape },
    { key: "stok", label: "📦 STOK", color: C.olive },
    { key: "rekap", label: "📊 REKAP", color: C.parchment },
    { key: "setting", label: "⚙️ SETTING", color: C.coffee },
  ];

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
          {TABS.map((t) => (
            <NeoButton key={t.key} small color={tab === t.key ? t.color : "#ccc"} textColor={tab === t.key ? C.midnight : C.midnight} onClick={() => setTab(t.key)}>
              {t.label}
            </NeoButton>
          ))}
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
                      <div className="flex items-start gap-2">
                        <Badge status={o.status} />
                        <button
                          onClick={() => deleteOrder(o)}
                          title="Hapus order"
                          style={{ border: `2px solid ${C.midnight}`, background: C.white, padding: "3px 6px" }}
                        >
                          <IconDelete />
                        </button>
                      </div>
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
                            <NeoButton small color={C.olive}><IconWhatsapp /> WA Invoice</NeoButton>
                          </a>
                          <NeoButton small color={C.coffee} onClick={() => setOrderStatus(o.id, "verified")}><IconCheck /> Tandai Paid</NeoButton>
                        </>
                      )}
                      {o.status === "verified" && (
                        <a href={`/label/${o.id}`} target="_blank" rel="noopener noreferrer">
                          <NeoButton small color={C.coffee}><IconDownload /> Print Label</NeoButton>
                        </a>
                      )}
                    </div>
                  </NeoCard>
                );
              })}
            </div>
          )
        )}

        {tab === "stok" && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="ff-display text-xl mb-2" style={{ color: C.olive }}>KELOLA STOK</h3>
              <div className="grid gap-3">
                {products.map((p, i) => (
                  <NeoCard key={p.id} accent={ACCENTS[i % ACCENTS.length]}>
                    <div className="flex justify-between items-center gap-3">
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs opacity-70">{rupiah(p.price)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => bumpStock(p, -1)} className="ff-display text-xl w-9 h-9" style={{ border: `2px solid ${C.midnight}`, background: C.white }}>-</button>
                        <span className="ff-display text-xl w-10 text-center">{p.stock}</span>
                        <button onClick={() => bumpStock(p, 1)} className="ff-display text-xl w-9 h-9" style={{ border: `2px solid ${C.midnight}`, background: C.white }}>+</button>
                        <button onClick={() => removeProduct(p.id)} className="text-xs underline opacity-60 ml-2">hapus</button>
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

        {tab === "rekap" && (
          <div>
            <div className="flex gap-2 mb-4">
              {["today", "week", "month", "all"].map((f) => (
                <NeoButton key={f} small color={dateFilter === f ? C.grape : "#ccc"} textColor={C.midnight} onClick={() => setDateFilter(f)}>
                  {f === "today" ? "Hari Ini" : f === "week" ? "7 Hari" : f === "month" ? "30 Hari" : "Semua"}
                </NeoButton>
              ))}
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <NeoCard accent={C.grape}>
                <div className="text-xs opacity-70 mb-1">TOTAL OMZET (LUNAS)</div>
                <div className="ff-display text-3xl" style={{ color: C.grape }}>{rupiah(recap.omzet)}</div>
              </NeoCard>
              <NeoCard accent={C.olive}>
                <div className="text-xs opacity-70 mb-1">JUMLAH PESANAN</div>
                <div className="ff-display text-3xl" style={{ color: C.olive }}>{recap.orderCount}</div>
              </NeoCard>
              <NeoCard accent={C.coffee}>
                <div className="text-xs opacity-70 mb-1">TOTAL ITEM TERJUAL</div>
                <div className="ff-display text-3xl" style={{ color: C.coffee }}>{recap.totalItems}</div>
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

        {tab === "setting" && (
          <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
            <div>
              <h3 className="ff-display text-xl mb-2" style={{ color: C.coffee }}>INFO PEMBAYARAN</h3>
              <NeoCard accent={C.coffee}>
                <label className="text-xs font-semibold block mb-1">Nama Bank / E-wallet</label>
                <input value={settingsForm.bank_name} onChange={(e) => setSettingsForm({ ...settingsForm, bank_name: e.target.value })} className="w-full mb-3 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} placeholder="BCA" />
                <label className="text-xs font-semibold block mb-1">No. Rekening</label>
                <input value={settingsForm.bank_account} onChange={(e) => setSettingsForm({ ...settingsForm, bank_account: e.target.value })} className="w-full mb-3 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} placeholder="1234567890" />
                <label className="text-xs font-semibold block mb-1">Atas Nama</label>
                <input value={settingsForm.bank_holder} onChange={(e) => setSettingsForm({ ...settingsForm, bank_holder: e.target.value })} className="w-full mb-4 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} placeholder="Ratu Bilqis Syar'i" />
                <div className="mb-1">
                  <label className="text-xs font-semibold block mb-2">Gambar QRIS Toko</label>
                  {settings?.qris_image && <img src={settings.qris_image} alt="QRIS" className="mb-2" style={{ width: 120, border: `2px solid ${C.midnight}`, borderRadius: 0 }} />}
                  <input type="file" accept="image/*" onChange={handleQrisUpload} className="text-sm" />
                </div>
              </NeoCard>
            </div>

            <div>
              <h3 className="ff-display text-xl mb-2" style={{ color: C.grape }}>INFO TOKO & LABEL</h3>
              <NeoCard accent={C.grape}>
                <label className="text-xs font-semibold block mb-1">Nama Pengirim (Toko)</label>
                <input value={settingsForm.sender_name} onChange={(e) => setSettingsForm({ ...settingsForm, sender_name: e.target.value })} className="w-full mb-3 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} placeholder="Ratu Bilqis Syar'i" />
                <label className="text-xs font-semibold block mb-1">Alamat Pengirim</label>
                <input value={settingsForm.sender_address} onChange={(e) => setSettingsForm({ ...settingsForm, sender_address: e.target.value })} className="w-full mb-3 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} placeholder="Jl. Merpati No. 12, Bandung" />
                <label className="text-xs font-semibold block mb-1">Nomor Kontak</label>
                <input value={settingsForm.contact_number} onChange={(e) => setSettingsForm({ ...settingsForm, contact_number: e.target.value })} className="w-full mb-3 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} placeholder="0812-3456-7890" />
                <label className="text-xs font-semibold block mb-1">Pesan Footer Resi</label>
                <input value={settingsForm.receipt_footer} onChange={(e) => setSettingsForm({ ...settingsForm, receipt_footer: e.target.value })} className="w-full mb-3 px-3 py-2" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} placeholder="Terima kasih sudah belanja!" />

                <label className="text-xs font-semibold block mb-2">Ukuran Kertas Thermal Default</label>
                <div className="flex gap-3 mb-4">
                  {[80, 58].map((w) => (
                    <button
                      key={w}
                      onClick={() => setSettingsForm({ ...settingsForm, paper_width_mm: w })}
                      className="flex-1 text-sm py-2"
                      style={{
                        border: `2px solid ${C.midnight}`,
                        background: settingsForm.paper_width_mm === w ? C.grape : C.white,
                        color: settingsForm.paper_width_mm === w ? C.white : C.midnight,
                        fontWeight: settingsForm.paper_width_mm === w ? 700 : 400,
                      }}
                    >
                      {w}mm
                    </button>
                  ))}
                </div>
                <NeoButton small color={C.grape} onClick={saveSettings}>Simpan Setting</NeoButton>
              </NeoCard>
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
