# Customer Order Management System — Ratu Bilqis Syar'i

Next.js + Supabase. Tiga halaman utama:
- `/` — katalog + form order buat customer (link yang kamu sebar)
- `/admin` — dashboard admin (pesanan, stok, QRIS/rekening, laporan penjualan)
- `/invoice/[id]` — invoice publik per order (link yang dikirim admin ke customer)
- `/label/[id]` — generate label pengiriman JPG

## Kenapa sebelumnya blank putih

Kalau sebelumnya kamu paste kode dari artifact Claude langsung ke repo ini,
itu penyebabnya: artifact pakai `window.storage`, API yang cuma ada di
sandbox preview Claude, gak eksis di browser/Vercel biasa. Semua bagian
itu udah diganti jadi query Supabase beneran di project ini.

## 1. Jalankan SQL schema

Buka **Supabase Dashboard > SQL Editor**, paste isi `supabase-schema.sql`,
lalu Run. Ini bikin 3 tabel (`products`, `orders`, `payment_info`),
nyalain Row Level Security + realtime, dan isi 3 produk contoh.

## 2. Environment variables

File `.env.local` udah aku isiin sesuai API URL & key yang kamu kasih:

```
NEXT_PUBLIC_SUPABASE_URL=https://bygvlittjrnjidjnyuko.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_EzolvT7HcZR-Hg3F-tkDPg_9lF3r04B
ADMIN_PASSWORD=gantipasswordini123
```

**Ganti `ADMIN_PASSWORD` ke password yang cuma kamu & admin lain yang tau.**
Ini password buat masuk `/admin` — beda dari 2 variable Supabase di atasnya,
variable ini sengaja **tanpa** awalan `NEXT_PUBLIC_` supaya nilainya cuma
diperiksa di server (lewat `middleware.js` + `/api/admin-login`) dan gak
pernah ikut ter-bundle ke kode yang bisa diintip lewat browser. Semua
admin (device manapun) pakai password yang sama ini buat masuk.

**Penting:** `.env.local` sengaja ada di `.gitignore` — jangan di-commit ke
GitHub. Yang perlu kamu lakukan di **Vercel**:
Project Settings → Environment Variables → tambahin dua variable di atas
(persis nama & valuenya) → Redeploy.

Ini kemungkinan besar penyebab kedua kenapa halamannya putih: kalau env
var ini belum diset di Vercel, `createClient()` gagal jalan dan app crash
diam-diam di browser.

## 3. Push ke GitHub

```bash
cd coms-app
git init
git add .
git commit -m "Customer Order Management System"
git remote add origin <url-repo-kamu>
git push -u origin main
```

Kalau repo kamu sudah ada isinya, ganti langkah di atas dengan copy semua
file dari folder ini ke folder repo kamu, lalu commit & push seperti
biasa.

## 4. Vercel

Karena Vercel udah connect ke GitHub repo kamu, tinggal push ke branch
utama → otomatis build & deploy. Pastikan:
- Framework preset: **Next.js** (biasanya auto-detect)
- Environment variables (langkah 2) sudah ke-set, termasuk `ADMIN_PASSWORD`
- Build command default (`next build`) — gak perlu diubah

## Password admin

`/admin` sekarang dikunci password (halaman login di `/admin-login`).
Ini proteksi sederhana (satu password dipakai bareng semua admin, bukan
akun terpisah per orang) tapi diperiksa di server sehingga passwordnya
sendiri gak pernah kekirim ke browser customer. Kalau ke depannya perlu
tau "siapa admin yang ngerjain apa", itu perlu upgrade ke akun terpisah
pakai Supabase Auth — bisa nanti kalau sudah dibutuhkan.

Semua admin, di device manapun, login pakai password yang sama dari
`ADMIN_PASSWORD`. Begitu login, sesi tersimpan 30 hari di device itu.

## 5. Testing alur lengkap

1. Buka `/` → pilih produk, isi data, submit → order masuk ke `orders`
2. Buka `/admin` → tab **Pesanan** → klik "Tandai Reviewed"
3. Isi QRIS + rekening dulu di tab **QRIS & Rekening** (sekali aja)
4. Klik "Salin Link Invoice" atau "Kirim Link via WA"
5. Buka link `/invoice/[id]` itu (bisa dari device lain) → cek tampil
   QRIS/rekening, coba upload bukti transfer
6. Balik ke `/admin` → thumbnail bukti transfer harusnya muncul otomatis
   (real-time, gak perlu refresh)
7. Klik "Verifikasi Pembayaran" → cek tab **Laporan Penjualan** buat lihat
   rekap omzet & produk terlaris

## Catatan keamanan (penting dibaca)

Policy Supabase saat ini **dibuka penuh** (siapa aja yang punya publishable
key bisa baca/tulis semua tabel) — sengaja biar cepat jalan tanpa perlu
bikin sistem login admin dulu. Untuk publishable/anon key ini memang
didesain aman dipakai di sisi browser, tapi kombinasi dengan policy
"allow all" berarti data order/stok bisa diubah siapa saja yang tahu
endpoint-nya, bukan cuma dari halaman `/admin` kamu.

Kalau sudah jalan stabil, langkah lanjutan yang disarankan: tambah
**Supabase Auth** dan kasih login sederhana di depan `/admin`, lalu ubah
policy `orders`/`products`/`payment_info` supaya cuma user yang login
(role admin) yang boleh insert/update/delete — customer tetap cuma boleh
`select` + insert order baru.

## Reservasi stok

Stok dikurangi begitu customer submit order (bukan pas payment
diverifikasi), pakai conditional update (`gte stock`) supaya dua orang
gak bisa sama-sama dapet unit terakhir. Kalau customer batal bayar,
belum ada auto-restock — kamu bisa tambahkan logic "kalau status masih
pending lebih dari 24 jam, kembalikan stok" belakangan kalau perlu.
