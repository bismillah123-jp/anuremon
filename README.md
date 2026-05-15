# POS INDAH CELL

POS ini dibuat untuk konter HP yang menjual aksesoris, paket data/pulsa, serta jasa seperti lem LCD/backdoor dan isi lagu. Aplikasi berjalan sebagai Google Apps Script Web App dan memakai Google Spreadsheet sebagai database.

## Fitur

- Dashboard penjualan, laba kotor, stok menipis, pengeluaran, dan order jasa aktif.
- Kasir cepat dengan pencarian produk/SKU, kategori, diskon nota, metode bayar Tunai/QRIS/Transfer/E-Wallet, kembalian, dan cetak struk.
- Produk dan stok: CRUD produk, tipe Barang/Paket/Jasa, stok minimum, koreksi stok, riwayat mutasi stok.
- Order jasa: tiket jasa lem, isi lagu, pasang tempered glass, setting HP, status pekerjaan, DP, sisa pembayaran, dan kirim ke kasir.
- Pelanggan: kontak, poin otomatis, total belanja.
- Supplier: kontak supplier aksesoris/sparepart/voucher.
- Pengeluaran: catatan operasional, pembelian stok, sewa, listrik, internet, dan lainnya.
- Laporan: filter tanggal, omzet, laba kotor, laba bersih, item terjual, kategori, produk teratas, ekspor CSV.
- Pengaturan toko: nama toko, nomor HP, alamat, kasir default, pajak, footer struk.
- Printer lengkap: dialog sistem untuk semua printer terpasang/ter-pairing, plus direct thermal ESC/POS via Bluetooth atau USB/Serial bila browser dan printer mendukung.
- Backup JSON untuk salinan data.

## Struktur Database Spreadsheet

Saat Web App pertama dibuka, Apps Script otomatis membuat file Spreadsheet bernama `INDAH CELL POS Database` dengan sheet:

- `Products`
- `Customers`
- `Suppliers`
- `Transactions`
- `TransactionItems`
- `StockMovements`
- `Expenses`
- `ServiceOrders`
- `Settings`

Data contoh produk juga otomatis dibuat, termasuk tempered glass, softcase, charger, paket data, jasa lem, isi lagu, dan pasang tempered glass.

## Cara Deploy ke Google Apps Script

1. Buka [script.google.com](https://script.google.com).
2. Klik `New project`.
3. Buat file `Code.gs`, lalu isi dengan kode dari [apps-script/Code.gs](apps-script/Code.gs).
4. Buat file HTML bernama `Index`, lalu isi dengan kode dari [apps-script/Index.html](apps-script/Index.html).
5. Klik `Deploy` lalu `New deployment`.
6. Pilih tipe `Web app`.
7. Isi:
   - `Execute as`: `Me`
   - `Who has access`: pilih sesuai kebutuhan, biasanya `Anyone with the link` untuk dipakai di beberapa perangkat.
8. Klik `Deploy`, lalu izinkan akses Google Sheets saat diminta.
9. Buka URL Web App. Spreadsheet database akan dibuat otomatis.

## Preview Lokal

File [apps-script/Index.html](apps-script/Index.html) bisa dibuka langsung untuk demo lokal. Dalam mode lokal, data disimpan di `localStorage` browser. Setelah dideploy ke Apps Script, data masuk ke Google Spreadsheet.

## Catatan Pemakaian

- Produk tipe `Jasa` tidak mengurangi stok.
- Produk tipe `Barang` dan `Paket` akan mengurangi stok saat checkout.
- Order jasa bisa dibuat dulu di menu `Order Jasa`, lalu tombol `Bayar` akan memasukkan sisa tagihan ke keranjang kasir.
- Menu `Spreadsheet` di kanan atas akan membuka database Google Spreadsheet jika app sudah dideploy.
- Untuk reset data demo lokal, buka menu `Pengaturan` lalu klik `Reset demo lokal`.

## Printer Bluetooth dan Kabel

POS menyediakan tiga mode printer di menu `Pengaturan`:

- `Dialog Sistem`: mode paling kompatibel. Semua printer yang sudah dikenali perangkat bisa dipakai, termasuk USB/kabel, Bluetooth yang sudah pairing, Wi-Fi, dan printer jaringan.
- `Thermal Bluetooth ESC/POS`: kirim struk langsung ke printer thermal Bluetooth BLE yang membuka channel Web Bluetooth.
- `Thermal USB/Serial ESC/POS`: kirim struk langsung ke printer thermal kabel yang muncul sebagai port serial/COM.

Untuk printer kasir thermal umum, mode `Dialog Sistem` tetap paling aman karena browser akan membuka pilihan printer dari sistem operasi. Mode direct Bluetooth/USB membutuhkan Chrome/Edge, izin browser, dan printer yang kompatibel dengan ESC/POS.
