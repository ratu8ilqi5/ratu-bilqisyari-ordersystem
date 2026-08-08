"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { C, SHOP, rupiah, fileToBase64 } from "@/lib/constants";
import { NeoCard } from "@/components/ui";

export default function InvoicePage({ params }) {
  const orderId = params.id;
  const [order, setOrder] = useState(undefined);
  const [payment, setPayment] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data: o } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    setOrder(o || null);
    const { data: p } = await supabase.from("payment_info").select("*").eq("id", 1).maybeSingle();
    setPayment(p || null);
  }, [orderId]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`order-${orderId}`).on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, load).subscribe();
    return () => supabase.removeChannel(ch);
  }, [load, orderId]);

  async function handleProofUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const b64 = await fileToBase64(file);
    await supabase.from("orders").update({ proof_image: b64 }).eq("id", orderId);
    await load();
    setUploading(false);
  }

  if (order === undefined) return <div className="ff-heading text-2xl p-8">MEMUAT...</div>;
  if (order === null) return <div className="p-8">Invoice tidak ditemukan. Cek kembali link yang dikirim admin.</div>;

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="text-center mb-4">
        <img src="/logo.png" alt="" className="w-14 h-14 mx-auto mb-2" />
        <h1 className="ff-heading text-3xl" style={{ color: C.grape }}>{SHOP.name}</h1>
        <p className="ff-heading text-xl" style={{ color: C.olive }}>Invoice Pesanan</p>
      </div>

      <NeoCard accent={C.grape}>
        <div className="flex justify-between text-sm mb-1"><span className="opacity-70">No. Order</span><span className="font-semibold">{order.id}</span></div>
        <div className="flex justify-between text-sm mb-1"><span className="opacity-70">Nama</span><span className="font-semibold">{order.name}</span></div>
        <div className="flex justify-between text-sm mb-4"><span className="opacity-70">Tanggal</span><span className="font-semibold">{new Date(order.created_at).toLocaleDateString("id-ID")}</span></div>
        <div style={{ borderTop: `2px solid ${C.midnight}` }} className="pt-3 mb-3">
          {order.items.map((it, i) => (
            <div key={i} className="flex justify-between text-sm py-1"><span>{it.name}{it.color ? ` (${it.color}${it.size ? ", " + it.size : ""})` : ""} x{it.qty}</span><span>{rupiah(it.price * it.qty)}</span></div>
          ))}
          {order.delivery_type === "kirim" ? (
            <div className="flex justify-between text-sm py-1 opacity-70">
              <span>Ongkir{order.courier ? ` (${order.courier}${order.shipping_method ? " " + order.shipping_method : ""})` : ""}</span>
              <span>{rupiah(order.shipping_cost)}</span>
            </div>
          ) : (
            <div className="text-sm py-1 opacity-70">Pickup / Ambil Sendiri</div>
          )}
        </div>
        <div className="flex justify-between ff-display text-3xl mb-1" style={{ color: C.grape, borderTop: `2px solid ${C.midnight}`, paddingTop: 10 }}>
          <span>TOTAL</span><span>{rupiah(order.total)}</span>
        </div>
      </NeoCard>

      <div className="mt-6">
        {order.status === "verified" ? (
          <NeoCard accent={C.coffee} style={{ textAlign: "center" }}>
            <div className="ff-heading text-2xl" style={{ color: C.coffee }}>PEMBAYARAN TERKONFIRMASI</div>
            <p className="text-sm mt-1">Terima kasih! Pesananmu sedang diproses.</p>
          </NeoCard>
        ) : (
          <NeoCard accent={C.olive}>
            <div className="ff-heading text-xl mb-2" style={{ color: C.olive }}>CARA BAYAR</div>
            {order.payment_method && (
              <div className="text-xs mb-3 opacity-70 text-center">
                Metode yang kamu pilih: <span className="font-semibold">{order.payment_method === "qris" ? "QRIS" : order.payment_method === "cash" ? "Cash" : "Transfer Bank"}</span>
              </div>
            )}

            {order.payment_method === "cash" ? (
              <p className="text-sm mb-4 text-center">Bayar tunai langsung pas ambil pesanan ya, gak perlu upload bukti transfer. 🤍</p>
            ) : (
              <>
                {(!order.payment_method || order.payment_method === "qris") && payment?.qris_image && (
                  <img src={payment.qris_image} alt="QRIS" className="mb-3" style={{ border: `2px solid ${C.midnight}`, borderRadius: 0, maxWidth: 240, margin: "0 auto", display: "block" }} />
                )}
                {(!order.payment_method || order.payment_method === "transfer") && (
                  payment?.bank_name ? (
                    <div className="text-sm mb-4 text-center">
                      <div>Transfer ke <span className="font-semibold">{payment.bank_name}</span></div>
                      <div className="ff-display text-2xl" style={{ color: C.grape }}>{payment.bank_account}</div>
                      <div className="opacity-70">a.n {payment.bank_holder}</div>
                    </div>
                  ) : (
                    <p className="text-sm mb-4 opacity-70">Info rekening belum diisi admin. Hubungi toko untuk detail pembayaran.</p>
                  )
                )}
                <div className="ff-heading text-xl mb-2" style={{ color: C.grape }}>UPLOAD BUKTI TRANSFER</div>
                {order.proof_image ? (
                  <p className="text-sm" style={{ color: C.coffee }}>✓ Bukti sudah diterima. Admin akan segera verifikasi.</p>
                ) : (
                  <>
                    <input type="file" accept="image/*" onChange={handleProofUpload} className="w-full text-sm" disabled={uploading} />
                    {uploading && <p className="text-xs mt-2 opacity-70">Mengunggah...</p>}
                  </>
                )}
              </>
            )}
          </NeoCard>
        )}
      </div>
    </div>
  );
}
