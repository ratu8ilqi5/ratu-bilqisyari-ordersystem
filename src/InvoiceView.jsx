import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function InvoiceView() {
  const { token } = useParams()
  const [order, setOrder] = useState(null)
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInvoiceData()
  }, [token])

  async function loadInvoiceData() {
    try {
      const { data: storeData } = await supabase.from('store_settings').select('*').limit(1).single()
      setStore(storeData)

      const { data: orderData, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          items:order_items(*)
        `)
        .eq('invoice_token', token)
        .single()

      if (error) throw error
      setOrder(orderData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Memuat Tagihan... 🌸</div>
  if (!order) return <div className="p-8 text-center text-red-500">Tagihan tidak ditemukan / Token invalid.</div>

  return (
    <div className="min-h-screen bg-neutral-100 p-4 sm:p-6 flex justify-center">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-xl overflow-hidden border border-neutral-200">
        <div className="bg-gradient-to-br from-rose-900 to-amber-950 p-6 text-white text-center relative">
          <h1 className="font-serif text-2xl tracking-wide text-amber-200">{store?.store_name}</h1>
          <p className="text-xs text-rose-200 mt-1">INVOICE PEMBAYARAN 🌸</p>
          <div className="mt-4 bg-white/10 backdrop-blur-md rounded-xl py-2 px-4 inline-block text-xs font-mono">
            No: #{order.order_number}
          </div>
        </div>

        <div className="p-6 space-y-6 text-sm">
          <div className="flex justify-between items-start border-b border-dashed pb-4">
            <div>
              <p className="text-xs text-gray-400 uppercase">Ditujukan Kepada:</p>
              <p className="font-bold text-gray-800 mt-0.5">{order.customer?.name}</p>
              <p className="text-xs text-gray-500">{order.customer?.whatsapp}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase">Status Invoice:</p>
              <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold ${
                order.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {order.payment_status === 'PAID' ? 'LUNAS ✅' : 'MENUNGGU PEMBAYARAN 💳'}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Rincian Pesanan</p>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-xs">
                <div>
                  <p className="font-semibold text-gray-800">{item.product_name_snapshot}</p>
                  <p className="text-gray-400">{item.quantity} x Rp {Number(item.unit_price_snapshot).toLocaleString('id-ID')}</p>
                </div>
                <p className="font-bold text-gray-700">Rp {Number(item.subtotal).toLocaleString('id-ID')}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal Produk</span>
              <span>Rp {Number(order.subtotal).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Ongkos Kirim</span>
              <span>Rp {Number(order.shipping_cost).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-rose-900 pt-2 border-t">
              <span>Total Tagihan</span>
              <span>Rp {Number(order.total).toLocaleString('id-ID')}</span>
            </div>
          </div>

          {order.payment_status !== 'PAID' && (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 space-y-4">
              <h3 className="font-bold text-amber-900 text-xs uppercase flex items-center gap-1.5">
                <span>💳</span> Instruksi Pembayaran
              </h3>

              {store?.qris_image_url && (
                <div className="text-center bg-white p-3 rounded-xl shadow-inner">
                  <img src={store.qris_image_url} alt="QRIS" className="w-44 h-44 mx-auto object-contain" />
                  <p className="text-[10px] text-gray-400 mt-1">Scan QRIS menggunakan Mobile Banking / E-Wallet</p>
                </div>
              )}

              <div className="bg-white p-3 rounded-xl text-xs space-y-1">
                <p className="text-gray-400 text-[10px] uppercase">Transfer Bank</p>
                <p className="font-bold text-gray-800">{store?.bank_name}</p>
                <p className="font-mono text-sm font-bold text-rose-800">{store?.account_number}</p>
                <p className="text-gray-600 text-[11px]">a.n. {store?.account_holder}</p>
              </div>

              <p className="text-[11px] text-amber-800 leading-relaxed text-center">
                Setelah melakukan transfer, mohon kirimkan <strong>Bukti Transfer</strong> melalui WhatsApp ke admin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
