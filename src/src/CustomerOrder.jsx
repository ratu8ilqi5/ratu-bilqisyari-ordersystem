import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function CustomerOrder() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState({})
  const [customer, setCustomer] = useState({ name: '', whatsapp: '', address: '', note: '' })
  const [submitting, setSubmitting] = useState(false)
  const [completedOrderNum, setCompletedOrderNum] = useState(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    const { data, error } = await supabase.from('products').select('*').eq('active', true)
    if (!error) setProducts(data || [])
  }

  const handleQtyChange = (productId, delta) => {
    setCart((prev) => {
      const current = prev[productId] || 0
      const next = Math.max(0, current + delta)
      const product = products.find((p) => p.id === productId)
      if (next > product.stock) return prev
      if (next === 0) {
        const { [productId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [productId]: next }
    })
  }

  const calculateSubtotal = () => {
    return Object.entries(cart).reduce((total, [id, qty]) => {
      const prod = products.find((p) => p.id === id)
      return total + (prod ? prod.price * qty : 0)
    }, 0)
  }

  const calculateTotalItems = () => {
    return Object.values(cart).reduce((a, b) => a + b, 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (Object.keys(cart).length === 0) {
      alert('🌸 Silakan pilih minimal 1 produk!')
      return
    }
    setSubmitting(true)

    try {
      let { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('whatsapp', customer.whatsapp)
        .maybeSingle()

      let customerId = existingCustomer?.id

      if (!customerId) {
        const { data: newCustomer, error: custErr } = await supabase
          .from('customers')
          .insert([{ name: customer.name, whatsapp: customer.whatsapp, address: customer.address }])
          .select()
          .single()
        if (custErr) throw custErr
        customerId = newCustomer.id
      }

      const orderNum = `ORD-${Math.floor(100000 + Math.random() * 900000)}`
      const subtotal = calculateSubtotal()

      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert([
          {
            order_number: orderNum,
            customer_id: customerId,
            subtotal,
            shipping_cost: 0,
            total: subtotal,
            customer_note: customer.note,
            status: 'NEW',
          },
        ])
        .select()
        .single()

      if (orderErr) throw orderErr

      const orderItemsData = Object.entries(cart).map(([prodId, qty]) => {
        const prod = products.find((p) => p.id === prodId)
        return {
          order_id: newOrder.id,
          product_id: prod.id,
          product_name_snapshot: prod.name,
          unit_price_snapshot: prod.price,
          quantity: qty,
          subtotal: prod.price * qty,
        }
      })

      const { error: itemsErr } = await supabase.from('order_items').insert(orderItemsData)
      if (itemsErr) throw itemsErr

      setCompletedOrderNum(orderNum)
    } catch (err) {
      alert(`Terjadi kesalahan: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (completedOrderNum) {
    return (
      <div className="min-h-screen bg-rose-50/50 p-6 flex flex-col items-center justify-center text-center">
        <div className="bg-white rounded-3xl p-8 shadow-xl max-w-md w-full border border-rose-100">
          <div className="text-5xl mb-4">✨🌸</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Pesanan Diterima!</h1>
          <p className="text-gray-600 mb-4">
            Terima kasih! Pesanan <span className="font-bold text-rose-600">#{completedOrderNum}</span> telah berhasil dibuat.
          </p>
          <div className="bg-rose-50 p-4 rounded-xl text-sm text-rose-800 font-medium mb-6">
            📦 Tim RATU BILQISYARI akan meninjau pesanan Anda dan mengonfirmasi ongkos kirim melalui WhatsApp.
          </div>
          <p className="text-xs text-gray-400">Silakan simpan nomor pesanan ini untuk referensi Anda.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-gradient-to-r from-rose-800 to-rose-950 text-white p-6 rounded-b-3xl shadow-md">
        <h1 className="text-2xl font-serif tracking-wide text-amber-200">RATU BILQISYARI</h1>
        <p className="text-xs text-rose-200 mt-1">Formulir Pemesanan Resmi 🌸</p>
      </div>

      <form onSubmit={handleSubmit} className="p-4 max-w-lg mx-auto space-y-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <span>📝</span> Data Pemesan
          </h2>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Nama Lengkap *</label>
            <input
              required
              type="text"
              className="w-full px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
              placeholder="Contoh: Ukhti Fatimah"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Nomor WhatsApp *</label>
            <input
              required
              type="tel"
              className="w-full px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
              placeholder="081234567890"
              value={customer.whatsapp}
              onChange={(e) => setCustomer({ ...customer, whatsapp: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Alamat Lengkap Pengiriman *</label>
            <textarea
              required
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
              placeholder="Jalan, Nomor Rumah, RT/RW, Kecamatan, Kota/Kabupaten, Kode Pos"
              value={customer.address}
              onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Catatan Tambahan (Opsional)</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
              placeholder="Warna cadangan, request khusus, dll."
              value={customer.note}
              onChange={(e) => setCustomer({ ...customer, note: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <span>🛍️</span> Katalog Produk
          </h2>
          {products.map((product) => {
            const isOutOfStock = product.stock <= 0
            const currentQty = cart[product.id] || 0

            return (
              <div key={product.id} className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-100 flex gap-4 items-center">
                <img
                  src={product.image_url || 'https://via.placeholder.com/100'}
                  alt={product.name}
                  className="w-20 h-20 object-cover rounded-xl bg-neutral-100"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 text-sm truncate">{product.name}</h3>
                  <p className="text-xs text-rose-700 font-bold mt-0.5">
                    Rp {Number(product.price).toLocaleString('id-ID')}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {isOutOfStock ? (
                      <span className="text-red-500 font-semibold">STOK HABIS ❌</span>
                    ) : (
                      `Stok: ${product.stock}`
                    )}
                  </p>
                </div>

                {!isOutOfStock && (
                  <div className="flex items-center gap-2 bg-neutral-100 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => handleQtyChange(product.id, -1)}
                      className="w-7 h-7 bg-white rounded-md flex items-center justify-center shadow-sm text-sm font-bold active:bg-rose-50"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold w-4 text-center">{currentQty}</span>
                    <button
                      type="button"
                      onClick={() => handleQtyChange(product.id, 1)}
                      className="w-7 h-7 bg-white rounded-md flex items-center justify-center shadow-sm text-sm font-bold active:bg-rose-50"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </form>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 shadow-2xl">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500">Total ({calculateTotalItems()} barang):</p>
            <p className="text-lg font-bold text-rose-800">
              Rp {calculateSubtotal().toLocaleString('id-ID')}
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || calculateTotalItems() === 0}
            className="bg-rose-800 hover:bg-rose-900 active:scale-95 text-white px-6 py-3 rounded-xl font-semibold text-sm shadow-md disabled:bg-neutral-300 disabled:scale-100 transition-all flex items-center gap-2"
          >
            {submitting ? 'Memproses...' : 'SUBMIT ORDER 🌸'}
          </button>
        </div>
      </div>
    </div>
  )
          }
