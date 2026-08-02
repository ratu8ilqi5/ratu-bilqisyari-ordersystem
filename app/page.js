'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [view, setView] = useState('order'); // 'order', 'admin', 'invoice'
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [paymentInfo, setPaymentInfo] = useState({ bank_details: '', qris_url: '' });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const [formData, setFormData] = useState({
    customer_name: '',
    whatsapp: '',
    address: '',
    postal_code: '',
    product_id: '',
    quantity: 1,
    payment_method: 'BANK'
  });
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchPaymentInfo();
    
    if (window.location.hash === '#admin') setView('admin');
    if (window.location.hash.startsWith('#invoice-')) {
      const id = window.location.hash.replace('#invoice-', '');
      fetchInvoice(id);
    }
  }, []);

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  }

  async function fetchOrders() {
    const { data } = await supabase.from('orders').select('*, products(name)').order('created_at', { ascending: false });
    if (data) setOrders(data);
  }

  async function fetchPaymentInfo() {
    const { data } = await supabase.from('payment_info').select('*').eq('id', 1).single();
    if (data) setPaymentInfo(data);
  }

  async function fetchInvoice(id) {
    const { data } = await supabase.from('orders').select('*, products(name, price)').eq('id', id).single();
    if (data) {
      setSelectedInvoice(data);
      setView('invoice');
    }
  }

  async function handleSubmitOrder(e) {
    e.preventDefault();
    setSubmitting(true);
    
    const selectedProd = products.find(p => p.id === formData.product_id);
    if (!selectedProd || selectedProd.stock < formData.quantity) {
      alert('Stok tidak mencukupi!');
      setSubmitting(false);
      return;
    }

    const totalPrice = selectedProd.price * formData.quantity;

    const { error } = await supabase.from('orders').insert([{
      ...formData,
      total_price: totalPrice
    }]);

    if (!error) {
      setOrderSuccess(true);
      setFormData({ customer_name: '', whatsapp: '', address: '', postal_code: '', product_id: '', quantity: 1, payment_method: 'BANK' });
    } else {
      alert('Gagal mengirim pesanan. Coba lagi.');
    }
    setSubmitting(false);
  }

  async function handleUpdateStock(id, newStock) {
    await supabase.from('products').update({ stock: parseInt(newStock) || 0 }).eq('id', id);
    fetchProducts();
  }

  async function handleStatusChange(id, status) {
    await supabase.from('orders').update({ status }).eq('id', id);
    if (status === 'paid') {
      const order = orders.find(o => o.id === id);
      if (order) {
        const prod = products.find(p => p.id === order.product_id);
        if (prod) {
          await supabase.from('products').update({ stock: Math.max(0, prod.stock - order.quantity) }).eq('id', prod.id);
          fetchProducts();
        }
      }
    }
    fetchOrders();
  }

  // FITUR 2 & 3: Auto Text Invoice WA + Link Invoice
  function sendWAInvoice(order) {
    const invoiceUrl = `${window.location.origin}/#invoice-${order.id}`;
    const text = `Halo Kak ${order.customer_name},\n\nPesanan Kakak sudah kami terima ya! Silakan lakukan pembayaran melalui link invoice berikut:\n\n${invoiceUrl}\n\nTerima kasih!`;
    const waUrl = `https://wa.me/${order.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
    handleStatusChange(order.id, 'reviewed');
  }

  // FITUR 1: Cetak Label Pengiriman Langsung
  function printLabel(order) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Label Pengiriman - ${order.customer_name}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; background: #fff; }
            .label { border: 3px solid #000; padding: 20px; width: 340px; box-shadow: 4px 4px 0px #000; }
            .title { font-weight: 900; font-size: 20px; border-bottom: 3px solid #000; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
            .field { margin: 12px 0; font-size: 14px; }
            .bold { font-weight: bold; }
            hr { border: 1px solid #000; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="title">LABEL PENGIRIMAN 📦</div>
            <div class="field"><span class="bold">PENERIMA:</span> ${order.customer_name} (${order.whatsapp})</div>
            <div class="field"><span class="bold">ALAMAT:</span><br/>${order.address}<br/><span class="bold">KODE POS:</span> ${order.postal_code}</div>
            <hr/>
            <div class="field"><span class="bold">ISI PAKET:</span> ${order.products?.name} x ${order.quantity}</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  const neoCardStyle = {
    background: '#FFF',
    border: '3px solid #121212',
    borderRadius: '12px',
    boxShadow: '4px 4px 0px #121212',
    padding: '20px',
    marginBottom: '20px'
  };

  const neoButtonStyle = (bgColor = '#FFDE59') => ({
    background: bgColor,
    color: '#121212',
    border: '2px solid #121212',
    borderRadius: '8px',
    boxShadow: '3px 3px 0px #121212',
    padding: '10px 16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '14px',
  });

  const neoInputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '2px solid #121212',
    borderRadius: '8px',
    boxShadow: '2px 2px 0px #121212',
    outline: 'none',
    fontWeight: '500',
    marginTop: '6px',
    boxSizing: 'border-box'
  };

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: '-apple-system, sans-serif', color: '#121212', padding: '20px 15px' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{ background: '#121212', color: '#FFF', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', letterSpacing: '1px' }}>
            ORDER SYSTEM
          </span>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button onClick={() => { setView('order'); window.location.hash = ''; }} style={neoButtonStyle(view === 'order' ? '#FF5757' : '#FFF')}>
            Order Form
          </button>
          <button onClick={() => { setView('admin'); window.location.hash = '#admin'; if(isAdmin) fetchOrders(); }} style={neoButtonStyle(view === 'admin' ? '#5E17EB' : '#FFF')}>
            Admin Portal
          </button>
        </div>

        {/* 1. FORM ORDER CUSTOMER */}
        {view === 'order' && (
          <div style={neoCardStyle}>
            <h2 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 16px 0', borderBottom: '2px solid #121212', paddingBottom: '8px' }}>
              Form Pemesanan 🛍️
            </h2>
            
            {orderSuccess ? (
              <div style={{ background: '#7EDB84', border: '2px solid #121212', padding: '16px', borderRadius: '8px', boxShadow: '3px 3px 0px #121212' }}>
                <h3 style={{ margin: '0 0 8px 0', fontWeight: '900' }}>🎉 Order Success!</h3>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
                  Pesananmu sudah masuk! Admin akan konfirmasi via WhatsApp.
                </p>
                <button onClick={() => setOrderSuccess(false)} style={neoButtonStyle('#FFF')}>
                  + Pesan Baru
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '800' }}>NAMA LENGKAP</label>
                  <input required type="text" value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} style={neoInputStyle} />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '800' }}>NO. WHATSAPP</label>
                  <input required type="text" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} style={neoInputStyle} />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '800' }}>PILIH PRODUK</label>
                  <select required value={formData.product_id} onChange={e => setFormData({...formData, product_id: e.target.value})} style={neoInputStyle}>
                    <option value="">-- Pilih Item --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                        {p.name} - Rp{Number(p.price).toLocaleString('id-ID')} {p.stock <= 0 ? '(HABIS)' : `[Stok: ${p.stock}]`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '800' }}>JUMLAH (QTY)</label>
                  <input type="number" min="1" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 1})} style={neoInputStyle} />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '800' }}>ALAMAT LENGKAP PENGIRIMAN</label>
                  <textarea required rows={3} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} style={neoInputStyle} />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '800' }}>KODE POS</label>
                  <input required type="text" value={formData.postal_code} onChange={e => setFormData({...formData, postal_code: e.target.value})} style={neoInputStyle} />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '800' }}>OPSI PEMBAYARAN</label>
                  <select value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})} style={neoInputStyle}>
                    <option value="BANK">Transfer Bank</option>
                    <option value="QRIS">QRIS</option>
                  </select>
                </div>

                <button type="submit" disabled={submitting} style={{ ...neoButtonStyle('#FFDE59'), marginTop: '10px', padding: '14px', fontSize: '16px' }}>
                  {submitting ? 'Memproses...' : '🚀 Submit Order'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* 2. TAMPILAN INVOICE */}
        {view === 'invoice' && selectedInvoice && (
          <div style={neoCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0 }}>INVOICE</h2>
              <span style={{ background: selectedInvoice.status === 'paid' ? '#7EDB84' : '#FFDE59', border: '2px solid #121212', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '800' }}>
                {selectedInvoice.status.toUpperCase()}
              </span>
            </div>
            
            <p style={{ margin: '4px 0', fontSize: '14px' }}><b>Penerima:</b> {selectedInvoice.customer_name}</p>
            <p style={{ margin: '4px 0', fontSize: '14px' }}><b>Item:</b> {selectedInvoice.products?.name} (x{selectedInvoice.quantity})</p>
            
            <div style={{ background: '#FAF8F5', border: '2px solid #121212', padding: '12px', borderRadius: '8px', margin: '14px 0' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#666' }}>TOTAL TAGIHAN:</span>
              <div style={{ fontSize: '20px', fontWeight: '900' }}>
                Rp{Number(selectedInvoice.total_price).toLocaleString('id-ID')}
              </div>
            </div>

            <h3 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '8px' }}>INSTRUKSI BAYAR:</h3>
            {selectedInvoice.payment_method === 'BANK' ? (
              <div style={{ background: '#E0F2FE', border: '2px solid #121212', padding: '12px', borderRadius: '8px', fontWeight: 'bold' }}>
                💳 {paymentInfo.bank_details || 'BCA 1234567890 a/n Toko'}
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                {paymentInfo.qris_url ? <img src={paymentInfo.qris_url} alt="QRIS" style={{ maxWidth: '200px', border: '2px solid #121212', borderRadius: '8px' }} /> : <p>QRIS belum diset.</p>}
              </div>
            )}
          </div>
        )}

        {/* 3. DASHBOARD ADMIN */}
        {view === 'admin' && (
          <div>
            {!isAdmin ? (
              <div style={neoCardStyle}>
                <h3 style={{ margin: '0 0 12px 0', fontWeight: '900' }}>🔒 Access Admin</h3>
                <input type="password" placeholder="Passkey" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} style={neoInputStyle} />
                <button onClick={() => { if(passwordInput === 'admin123') { setIsAdmin(true); fetchOrders(); } else alert('Password Salah!'); }} style={{ ...neoButtonStyle('#FFDE59'), marginTop: '12px', width: '100%' }}>
                  Unlock
                </button>
              </div>
            ) : (
              <div>
                {/* Stok Real-time */}
                <div style={neoCardStyle}>
                  <h3 style={{ margin: '0 0 12px 0', fontWeight: '900', fontSize: '15px' }}>📦 Stok Real-Time</h3>
                  {products.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '14px' }}>
                      <span>{p.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Stok:</span>
                        <input type="number" defaultValue={p.stock} onBlur={e => handleUpdateStock(p.id, e.target.value)} style={{ width: '50px', padding: '4px', border: '2px solid #121212', borderRadius: '6px' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* List Orders */}
                <h3 style={{ fontSize: '15px', fontWeight: '900', margin: '0 0 12px 0' }}>📋 PESANAN MASUK</h3>
                {orders.length === 0 ? <p style={{ fontSize: '14px', color: '#666' }}>Belum ada pesanan.</p> : orders.map(o => (
                  <div key={o.id} style={{ ...neoCardStyle, padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '900' }}>{o.customer_name}</span>
                      <span style={{ background: '#FFDE59', border: '1px solid #121212', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800' }}>{o.status.toUpperCase()}</span>
                    </div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>WA: {o.whatsapp}</p>
                    <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>Item: {o.products?.name} (x{o.quantity})</p>
                    <p style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800' }}>Total: Rp{Number(o.total_price).toLocaleString('id-ID')}</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button onClick={() => sendWAInvoice(o)} style={neoButtonStyle('#25D366')}>
                        💬 1. Kirim Invoice WA
                      </button>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {o.status !== 'paid' && (
                          <button onClick={() => handleStatusChange(o.id, 'paid')} style={{ ...neoButtonStyle('#7EDB84'), flex: 1 }}>
                            ✅ 2. Paid
                          </button>
                        )}
                        <button onClick={() => printLabel(o)} style={{ ...neoButtonStyle('#FFF'), flex: 1 }}>
                          🖨️ 3. Cetak Label
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
