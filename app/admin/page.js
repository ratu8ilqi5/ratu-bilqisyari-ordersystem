"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { C, ACCENTS, rupiah, fileToBase64, APP_NAME } from "@/lib/constants";
import { NeoButton, NeoCard, Badge } from "@/components/ui";
import { IconCheck, IconLink, IconWhatsapp, IconDownload, IconDelete } from "@/components/icons";

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
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState(emptySettings);
  const [copiedId, setCopiedId] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [dateFilter, setDateFilter] = useState("today");
  const [drafts, setDrafts] = useState({}); // per-order price/ongkir draft while status is "pending"

  useEffect(() => {
    loadOrders();
    loadSettings();
    const ch1 = supabase.channel("orders-admin").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders).subscribe();
    return () => { supabase.removeChannel(ch1); };
  }, []);

  // Seed a price/ongkir draft the first time a "pending" order shows up, so
  // admin's typing doesn't get clobbered by the realtime refresh.
  useEffect(() => {
    if (!orders) return;
    setDrafts((prev) => {
      const next = { ...prev };
      orders.forEach((o) => {
        if (o.status === "pending" && !next[o.id]) {
          next[o.id] = {
            items: o.items.map((it) => ({ ...it, price: it.price || "" })),
            shipping_cost: o.shipping_cost || 0,
          };
        }
      });
      return next;
    });
  }, [orders]);

  async function loadOrders() {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
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

  function updateDraftItemPrice(orderId, idx, value) {
    setDrafts((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        items: prev[orderId].items.map((it, i) => (i === idx ? { ...it, price: value } : it)),
      },
    }));
  }
  function updateDraftShipping(orderId, value) {
    setDrafts((prev) => ({ ...prev, [orderId]: { ...prev[orderId], shipping_cost: value } }));
  }
  function draftTotals(orderId, order) {
    const d = drafts[orderId];
    if (!d) return { subtotal: 0, shipping: 0, total: 0 };
    const subtotal = d.items.reduce((s, it) => s + (Number(it.price) || 0) * it.qty, 0);
    const shipping = order.delivery_type === "kirim" ? Number(d.shipping_cost) || 0 : 0;
    return { subtotal, shipping, total: subtotal + shipping };
  }
  async function savePricing(o) {
    const d = drafts[o.id];
    if (!d) return;
    const items = d.items.map((it) => ({ ...it, price: Number(it.price) || 0 }));
    const shipping_cost = o.delivery_type === "kirim" ? Number(d.shipping_cost) || 0 : 0;
    const total = items.reduce((s, it) => s + it.price * it.qty, 0) + shipping_cost;
    await supabase.from("orders").update({
      items,
      shipping_cost,
      total,
      status: "reviewed",
    }).eq("id", o.id);
    loadOrders();
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

  if (!orders) return <div className="ff-heading text-2xl p-8">MEMUAT...</div>;

  const TABS = [
    { key: "orders", label: `📋 ORDERS (${orders.length})`, color: C.grape },
    { key: "rekap", label: "📊 REKAP", color: C.parchment },
    { key: "setting", label: "⚙️ SETTING", color: C.coffee },
  ];

  return (
    <div>
      <div style={{ borderBottom: `4px solid ${C.midnight}`, background: C.white }} className="px-4 py-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex justify-between items-start">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="w-10 h-10 sm:w-12 sm:h-12" style={{ flexShrink: 0 }} />
            <div>
              <h1 className="ff-heading text-3xl sm:text-4xl">{APP_NAME}</h1>
              <p className="text-xs opacity-60">Dashboard Admin</p>
            </div>
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
            <NeoButton key={t.key} small color={tab === t.key ? t.color : "#ccc"} textColor={C.midnight} onClick={() => setTab(t.key)}>
              {t.label}
            </NeoButton>
          ))}
        </div>

        {tab === "orders" && (
          filteredOrders.length === 0 ? <NeoCard accent={C.parchment}><p>Belum ada pesanan.</p></NeoCard> : (
            <div className="grid gap-4">
              {orders.map((o, i) => {
                const accent = ACCENTS[i % ACCENTS.length];
                const isPending = o.status === "pending";
                const draft = drafts[o.id];
                const totals = isPending ? draftTotals(o.id, o) : null;

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

                    {o.payment_method && (
                      <div className="text-xs mb-2 opacity-70">Metode bayar: <span className="font-semibold">{o.payment_method === "qris" ? "QRIS" : o.payment_method === "cash" ? "Cash" : "Transfer Bank"}</span></div>
                    )}

                    {isPending && draft ? (
                      // Order baru masuk: admin isi harga tiap item + ongkir dulu sebelum lanjut ke invoice.
                      <div className="mb-3">
                        <div className="text-xs font-semibold mb-2" style={{ color: accent }}>ISI HARGA & ONGKIR</div>
                        <div className="grid gap-2 mb-3">
                          {draft.items.map((it, idx) => (
                            <div key={idx} className="flex flex-wrap items-center gap-2 text-sm p-2" style={{ border: `1px dashed ${C.midnight}` }}>
                              <div className="flex-1 min-w-[140px]">
                                <div className="font-semibold">{it.name}</div>
                                <div className="text-xs opacity-70">{it.color}{it.size ? ` · ${it.size}` : ""} · x{it.qty}</div>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs opacity-60">Rp</span>
                                <input
                                  type="number"
                                  value={it.price}
                                  onChange={(e) => updateDraftItemPrice(o.id, idx, e.target.value)}
                                  placeholder="0"
                                  className="w-28 px-2 py-1 text-sm"
                                  style={{ border: `2px solid ${C.midnight}` }}
                                />
                                <span className="text-xs opacity-60">/pcs</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs font-semibold mb-1">Pengambilan Pesanan</div>
                        <div className="text-sm mb-3 p-2" style={{ border: `1px dashed ${C.midnight}` }}>
                          {o.delivery_type === "kirim" ? (
                            <>
                              <div className="font-semibold">Kirim Kurir — {o.courier}{o.shipping_method ? ` ${o.shipping_method}` : ""}</div>
                              <div className="text-xs opacity-70">{o.address}{o.destination ? ` (Kec. ${o.destination})` : ""}</div>
                            </>
                          ) : (
                            <div className="font-semibold">Pickup / Ambil Sendiri</div>
                          )}
                        </div>

                        {o.delivery_type === "kirim" && (
                          <div className="flex items-center gap-2 text-sm mb-3">
                            <label className="font-semibold">Ongkir</label>
                            <span className="text-xs opacity-60">Rp</span>
                            <input
                              type="number"
                              value={draft.shipping_cost}
                              onChange={(e) => updateDraftShipping(o.id, e.target.value)}
                              placeholder="0"
                              className="w-28 px-2 py-1 text-sm"
                              style={{ border: `2px solid ${C.midnight}` }}
                            />
                          </div>
                        )}

                        <div className="text-xs mb-1 opacity-70 flex justify-between"><span>Subtotal</span><span>{rupiah(totals.subtotal)}</span></div>
                        <div className="text-xs mb-2 opacity-70 flex justify-between"><span>Ongkir</span><span>{rupiah(totals.shipping)}</span></div>
                        <div className="ff-display text-2xl mb-3 flex justify-between" style={{ color: accent }}><span>TOTAL</span><span>{rupiah(totals.total)}</span></div>
                        <NeoButton small color={C.grape} onClick={() => savePricing(o)}>
                          <IconCheck /> Simpan Harga & Kirim ke Review
                        </NeoButton>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm mb-2">
                          {o.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{it.name}{it.color ? ` (${it.color}${it.size ? ", " + it.size : ""})` : ""} x{it.qty}</span>
                              <span>{rupiah(it.price * it.qty)}</span>
                            </div>
                          ))}
                          {!!o.shipping_cost && (
                            <div className="flex justify-between opacity-70">
                              <span>Ongkir{o.courier ? ` (${o.courier}${o.shipping_method ? " " + o.shipping_method : ""})` : ""}</span>
                              <span>{rupiah(o.shipping_cost)}</span>
                            </div>
                          )}
                          {o.delivery_type === "cod" && (
                            <div className="opacity-70">Pickup / Ambil Sendiri</div>
                          )}
                        </div>
                        <div className="ff-display text-2xl mb-3" style={{ color: accent }}>TOTAL {rupiah(o.total)}</div>

                        {o.proof_image && o.status !== "verified" && (
                          <div className="mb-3 flex items-center gap-3">
                            <img src={o.proof_image} alt="bukti" className="w-14 h-14 object-cover cursor-pointer" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0 }} onClick={() => setProofPreview(o.proof_image)} />
                            <span className="text-xs font-semibold" style={{ color: C.grape }}>Bukti transfer masuk — cek dulu</span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-3 items-center">
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
                      </>
                    )}
                  </NeoCard>
                );
              })}
            </div>
          )
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
            <h3 className="ff-heading text-xl mb-2" style={{ color: C.coffee }}>PRODUK TERLARIS</h3>
            <NeoCard accent={C.coffee}>
              {recap.topItems.length === 0 ? <p className="text-sm opacity-60">Belum ada data.</p> : recap.topItems.map(([name, qty]) => (
                <div key={name} className="flex justify-between text-sm py-1"><span>{name}</span><span className="font-semibold">{qty} terjual</span></div>
              ))}
            </NeoCard>
            <h3 className="ff-heading text-xl mt-6 mb-2" style={{ color: C.midnight }}>DETAIL TRANSAKSI</h3>
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
              <h3 className="ff-heading text-xl mb-2" style={{ color: C.coffee }}>INFO PEMBAYARAN</h3>
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
              <h3 className="ff-heading text-xl mb-2" style={{ color: C.grape }}>INFO TOKO & LABEL</h3>
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
