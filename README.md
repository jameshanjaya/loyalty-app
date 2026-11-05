# Loyalty Bos

Kartu stamp digital untuk kafe dan resto. Satu akun pelanggan dipakai di semua merek. Setiap merek punya kartu stamp sendiri.

Aplikasi ini jalan di Cloudflare versi gratis: Workers, database D1, dan tempat gambar R2. Tidak perlu aplikasi di Play Store. Pelanggan buka lewat browser HP, lalu bisa dipasang seperti aplikasi (PWA).

Aplikasi tidak mengirim SMS. Pelanggan bikin PIN sendiri. Verifikasi WhatsApp menyala hanya kalau secret-nya diisi.

## Yang perlu disiapkan

- Komputer dengan [Node.js](https://nodejs.org) versi 20 atau lebih baru.
- Akun Cloudflare gratis.
- Kalau kamu tidak biasa mengetik perintah, minta teman yang paham komputer. Kamu yang pegang akun Cloudflare dan semua password.

Perintah di bawah diketik di terminal, di dalam folder proyek ini.

## Coba di komputer dulu

1. Salin file contoh rahasia.

```bash
cp .dev.vars.example .dev.vars
```

2. Buka `.dev.vars` dan ganti ketiga isinya dengan kalimat panjang buatanmu. Jangan pakai contohnya kalau nanti mau dipakai sungguhan.

   - `OWNER_PASSWORD` password kamu untuk masuk dashboard.
   - `TOKEN_SECRET` kunci untuk QR kasir. Bebas, asal panjang dan acak.
   - `PIN_PEPPER` kunci untuk PIN pelanggan dan PIN outlet. Sekali dipakai, jangan diganti. Kalau diganti, semua PIN lama tidak bisa dipakai.

3. Pasang dan isi data contoh.

```bash
npm install
npm run setup
```

Kalau muncul pertanyaan migrasi, ketik `yes` lalu Enter.

4. Nyalakan.

```bash
npm run dev
```

5. Buka http://localhost:8787 di browser.

### Akun contoh

Ini hanya untuk latihan. Ganti PIN outlet sebelum pelanggan asli memakainya. Semua pelanggan contoh memakai PIN `2468`.

| Peran | Cara masuk | PIN |
| --- | --- | --- |
| Pelanggan Rina | 0812 3456 4567 | 2468 |
| Pelanggan Sari (stamp Loft25 sudah penuh) | 0813 1111 0088 | 2468 |
| Kasir Loft25 Senopati | pilih outlet itu di /kasir | 258025 |
| Kasir Soto Oseng Tebet | pilih outlet itu | 369136 |
| Kasir Krispyporkk Kemang | pilih outlet itu | 470247 |
| Owner | /admin | password di `.dev.vars` |

Di browser yang sama kamu bisa login sebagai kasir dan sebagai pelanggan sekaligus. Mereka punya cookie berbeda.

### Coba alurnya

1. Buka `/kasir`, masuk ke Loft25 Senopati.
2. Centang syarat transaksi, tap **Kasih Stamp**.
3. Muncul QR sekitar 60 detik.
4. Di tab lain, masuk sebagai Rina, lalu buka link yang ada di QR (atau scan pakai HP).
5. Stamp masuk. Layar kasir berubah jadi nama Rina yang disamarkan.
6. Kalau QR susah, kasir bisa ketik nomor WA lalu tap **+1**.
7. Sari sudah 10/10 di Loft25. Kasir bisa cari nomernya lalu tukar reward. Sisa stamp di atas kelipatan 10 tidak hangus.
8. Kasir bisa membatalkan entri terakhirnya sendiri, selama masih beberapa menit.
9. Dashboard owner ada di `/admin`.

QR stan untuk pelanggan baru ada di menu **QR Stan**. Cetak, tempel di kasir. Isinya link gabung, bukan QR sekali pakai.

## Pasang di akun Cloudflare kamu

Lakukan ini setelah percobaan di komputer sudah beres. Jangan deploy dari komputer orang lain.

1. Masuk ke Cloudflare lewat terminal. Browser akan terbuka.

```bash
npx wrangler login
```

2. Buat database. Namanya harus `loyalty-bos`.

```bash
npx wrangler d1 create loyalty-bos
```

Perintah itu menampilkan `database_id`. Salin ID-nya.

3. `database_id` di `wrangler.jsonc` yang ada di git sengaja tetap `00000000-0000-0000-0000-000000000001`. Itu placeholder, bukan database sungguhan. Saat deploy, pakai ID asli dari langkah 2 hanya di mesin yang memasang, dan jangan commit perubahan itu.

4. Buat tempat gambar banner.

```bash
npx wrangler r2 bucket create loyalty-banners
```

5. Pasang tabel ke database online. Ketik `yes` kalau ditanya.

```bash
npx wrangler d1 migrations apply loyalty-bos --remote
```

6. Jangan salin pelanggan contoh ke internet. Mereka memakai PIN `2468`. Merek dan banner promo sudah ikut saat migrasi. Outlet dibuat sendiri di dashboard.

7. Unggah tiga rahasia. Isi `.dev.vars` harus sudah password sungguhan, bukan contoh.

```bash
npx wrangler secret bulk .dev.vars
```

Perintah ini langsung memasang versi aplikasi. File `.dev.vars` tidak ikut terunggah ke git. Jangan tempel password di chat.

8. Pasang aplikasinya.

```bash
npx wrangler deploy
```

Selesai kalau muncul alamat `*.workers.dev`. Buka alamat itu.

9. Kalau mau alamat sendiri (misalnya `stamp.kafe.com`): di dashboard Cloudflare, buka Worker `loyalty-bos`, menu **Domains & Routes**, tambah domain. Domain itu harus sudah dipakai di akun Cloudflare yang sama.

Setelah deploy, masuk ke `/admin`, buka **Outlet & PIN**, lalu tambah satu outlet untuk tiap merek beserta PIN-nya. Merek (Loft25, Soto Oseng, Krispyporkk) dan aturan stamp-nya sudah ada.

## Login Google

Pelanggan bisa masuk dengan Google, atau tetap pakai nomor WA + PIN. Google-nya gratis.

1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat proyek baru, misalnya "Loyalty Bos".
3. Menu **APIs & Services** > **OAuth consent screen**.
   - User type: **External**.
   - Nama aplikasi: Loyalty Bos.
   - Email dukungan: email kamu.
   - Simpan. Kalau statusnya masih **Testing**, tambahkan email pelanggan percobaan di **Test users**.
4. Menu **APIs & Services** > **Credentials** > **Create credentials** > **OAuth client ID**.
5. Application type: **Web application**.
6. Di **Authorized redirect URIs**, tambahkan semua alamat yang dipakai:
   - `http://localhost:8787/auth/google/callback` untuk komputer kamu
   - `https://loyalty-bos.NAMA-AKUN.workers.dev/auth/google/callback` setelah deploy (ganti dengan alamat yang muncul dari `wrangler deploy`)
   - kalau pakai domain sendiri, tambah juga `https://stamp.kafe.com/auth/google/callback`
7. Salin **Client ID** dan **Client secret**. Tempel di `.dev.vars`:

```bash
GOOGLE_CLIENT_ID=tempel-client-id
GOOGLE_CLIENT_SECRET=tempel-client-secret
```

8. Restart `npm run dev`. Untuk yang sudah online, jalankan lagi `npx wrangler secret bulk .dev.vars`.

Jangan taruh Client secret di chat atau di git. Kalau Google belum diisi, tombol Google menampilkan pesan bahwa owner belum menyetelnya. Nomor WA + PIN tetap jalan.

Pelanggan baru dari Google mengisi nama, tanggal lahir, nomor WA, dan PIN dulu sebelum kartu terbuka. Tanggal lahir tidak bisa diubah sendiri setelah tersimpan. Owner bisa mengubahnya di halaman member. Kalau nomor WA itu sudah punya kartu, pelanggan memasukkan PIN kartu itu supaya akun Google-nya tersambung. Kalau nomor itu sudah tersambung ke Google lain, aplikasi menolak.

## Gaya bahasa

Tulisan buat pelanggan santai dan sama di semua merek. Pakai "kamu", kalimatnya pendek. Contoh: "Yeay, stamp kamu nambah!", "Dikit lagi dapet matcha gratis", "Poin kamu mau hangus nih, buruan tukar", "Kirim WA-nya ya, biar nomor kamu ke-verif". Dashboard dan kasir tetap jelas.

## Verifikasi nomor WA

Fitur ini mati sampai secret ini terisi. Kosongkan untuk mematikannya.

```
WA_BUSINESS_NUMBER=628xxxxxxxxxx
WA_VERIFY_TOKEN=kalimat-acak-panjang
WA_ACCESS_TOKEN=
WA_APP_SECRET=
WA_OTP_ENABLED=
```

`WA_ACCESS_TOKEN` disiapkan kalau nanti ada kirim pesan. `WA_OTP_ENABLED=1` hanya menampilkan tautan yang menjelaskan OTP belum disambungkan.

Setelah login Google dan profil lengkap, pelanggan mengetuk **Verifikasi via WA**. Aplikasi membuka `wa.me` dengan teks `VERIF-XXXXXX`. Webhook `GET` dan `POST /webhook/whatsapp` menerima pesan masuk WhatsApp Cloud API, mencocokkan kode dan nomor pengirim, lalu menandai nomor itu terverifikasi. Kode berlaku 10 menit. Satu nomor hanya untuk satu akun. Di Meta, callback URL-nya `https://domain-kamu/webhook/whatsapp` dan verify token-nya sama dengan `WA_VERIFY_TOKEN`. Kalau `WA_APP_SECRET` diisi, POST tanpa tanda tangan yang cocok ditolak.

## Stamp dari Side Quest

Side Quest menambah stamp di kartu merek itu, bukan saldo poin terpisah. Hadiah quest cuma 0,25, 0,5, 0,75, atau 1 stamp. Pecahan yang belum genap tampil sebagai `0,75/1 menuju stamp berikutnya`. Empat perempat jadi satu stamp utuh, lalu sisa pecahan tetap di kartu. Pecahan itu tidak hangus. Menu pelanggan: Kartu, Redeem, Profil. Misi ada di kartu, bagian Bonus Stamp. Koin poin dan tulisan hangus tidak ditampilkan. Tabel poin di database tetap ada, tapi tidak dipakai di aplikasi pelanggan.

## Tampilan merek

Di **Setting Program**, tiap merek punya warna utama, warna lembut, warna tombol, warna latar, pilihan ikon stamp (pengocok matcha, mangkuk, piring, atau upload), plus upload logo header dan ikon aplikasi. Ikon aplikasi masuk ke `/app.webmanifest`. Loft25 memakai hijau matcha, Soto Oseng biru dan merah, Krispyporkk pink dan hitam.

Merek dengan `active = 0` disembunyikan dari pelanggan, kasir, dan dashboard. Datanya tidak dihapus. Di **Setting Program**, bagian **Merek disembunyiin** punya tombol **Merek aktif** untuk menyalakan satu merek lagi. Kasir merek yang mati melihat “Merek ini lagi belum aktif”.

## Cara pakai sehari-hari

- Pelanggan scan QR stan, isi nama, nomor WA, dan PIN. Login di HP itu bertahan 365 hari. Kalau mereka membuka aplikasi lagi setelah sekitar sehari, cookie diperpanjang 365 hari dari kunjungan itu. Keluar tetap menghapus cookie. Di HP lain, mereka masuk dengan nomor WA + PIN.
- Di kartu, tombol **Collect Stamps** ada di bawah kotak stamp. Kamera belakang membuka di halaman itu untuk scan QR kasir (stamp, tukar, atau ultah). Kalau kamera ditolak, kasir ketik nomor WA. QR dari situs lain ditolak.
- Di kartu, tombol **Collect Stamps** ada tepat di bawah kotak stamp. Kamera belakang membuka di halaman itu untuk scan QR kasir (stamp, tukar, atau ultah). Kalau kamera ditolak, minta kasir ketik nomor WA. QR dari situs lain ditolak.
- Kasir masuk dengan PIN outlet. Satu outlet hanya memberi stamp untuk mereknya. Di **Outlet & PIN**, owner bisa menandai akun member sebagai **Staf** outlet itu (nomor WA atau email). Kasir outlet itu tidak bisa kasih stamp atau tukar ke akun staf. Percobaan yang ditolak muncul di dashboard, bagian **Yang perlu dicek**.
- Satu transaksi paling satu stamp. Kasir harus mencentang syarat. Teks centangnya diatur di **Setting Program**.
- Satu pelanggan paling 2 stamp per merek per hari. Angka ini bisa diubah di Setting Program.
- Stamp penuh: kasir tap **Tukar Reward**, pelanggan scan QR untuk setuju. Atau kasir cari nomor WA lalu tukar. Stamp yang lebih dari 10 tetap nyangkut.
- Birthday Freebies diatur di **Setting Program**. Default-nya **Hari H aja** (tanggal lahir, WIB). Bisa diganti ke bulan ultah atau ± N hari. Hitung mundurnya menarget awal jendela itu, di kartu dan di Redeem. Di luar jendela tidak ada tombol klaim. Kasir dan pelanggan dicek di server: tanggal lahir ada, hari ini masuk jendela, sekali per merek per tahun, merek aktif, dan tanggal lahir tidak baru disimpan (30 hari), kecuali owner mencentang boleh klaim tahun ini. Stamp tidak berkurang.
- Tombol **Booking / Order via WA** di kartu langsung membuka `https://wa.me/<nomor>?text=...` dengan nama merek dan outlet. Nomornya satu per outlet, di **Outlet & PIN**. Ketukan tetap tercatat lewat beacon, tanpa halaman perantara.
- Side Quest menambah pecahan stamp ke kartu merek itu. Owner mengatur quest di **Kelola Side Quest**: judul, penjelasan, langkah, stamp 0,25 / 0,5 / 0,75 / 1, ikon, tag, urutan, merek (wajib), dan tanggal. Buktinya foto, dan tiap pelanggan cuma sekali. Foto instruksi boleh beberapa. Bukti yang dikirim langsung masuk. Owner bisa menarik quest yang sudah disetujui; stamp utuh dan pecahannya balik, tercatat di buku. Kalau stamp itu sudah dipakai, kartu tidak jadi minus.
- Menu **Redeem** menukar stamp utuh. Owner mengaturnya di **Redeem**: nama, ikon atau foto, biaya stamp (pintasan 5 dan 10, atau angka lain), aktif, dan stok opsional. Pelanggan tap **Tukar**, stamp ditahan, lalu muncul kode 5 angka dan QR sekitar 10 menit. Kalau hangus, stamp kembali dan stok ikut kembali. Kasir mengetik kode itu, atau scan QR. Kode cuma sekali, cuma untuk merek outlet itu, dan tebakan dibatasi.
- Daftar pelanggan ada di **Member**: cari, filter merek, urutkan, buka detail, ganti nomor, hapus (dengan halaman konfirmasi, dan tercatat). Unduh CSV atau Excel.
- Tombol **Order / Booking** di kartu membuka chat WhatsApp outlet dengan pesan “Halo, mau order/booking di &lt;nama outlet&gt;”. Nomornya diisi di **Outlet & PIN**. Kalau merek punya beberapa outlet bernomor, pelanggan memilih outlet dulu. Nomor kosong menyembunyikan tombol itu. GoFood, GrabFood, dan ShopeeFood tidak ditampilkan.
- Banner promo di kartu pelanggan diatur di **Banner Promo**. Satu merek boleh punya beberapa foto, dengan urutan dan tanggal mulai/selesai. Bisa tempel tautan gambar https, atau unggah file (paling 2 MB, jpg/png/webp/gif). Judul, subjudul, dan teks tombol tampil di atas fotonya. Pelanggan menggeser fotonya, dan foto berganti sendiri. Warna kartu ikut merek yang dipilih: Loft25 hijau matcha, Soto Oseng merah tanah, Krispyporkk oranye di latar gelap.
- Log aktivitas ada di menu **Aktivitas**. Bisa diunduh sebagai CSV.
- Kalau kasir memberi stamp sangat banyak dalam waktu singkat, atau ada yang mentok batas harian, dashboard menampilkan **Yang perlu dicek**.

## Ganti password owner

Menu **Ganti Password** di dashboard. Isi password sekarang, password baru, dan ulangi password baru. Minimal 8 karakter. Hash-nya disimpan di D1. Setelah itu login memakai hash itu, dan password di `OWNER_PASSWORD` tidak berlaku lagi sampai hash-nya dihapus dari database. Sesi owner yang sedang dipakai tetap masuk. Sesi owner yang lain dikeluarkan. Login yang gagal di `/admin/masuk` tetap dikunci 5 kali per 15 menit per IP.

## Ganti PIN dan password

- PIN outlet diganti di **Outlet & PIN**. PIN lama tidak ditampilkan, karena tidak disimpan mentah.
- Password owner diganti dengan mengedit `.dev.vars`, lalu jalankan lagi `npx wrangler secret bulk .dev.vars`.
- Jangan ganti `PIN_PEPPER` setelah ada pelanggan. Kalau terpaksa, semua orang harus membuat PIN baru dan outlet perlu PIN baru.
- `TOKEN_SECRET` hanya mempengaruhi QR yang sedang tampil (paling lama sekitar 60 detik).

## Tes otomatis

```bash
npm test
npm run typecheck
```

Tes ini memeriksa QR yang hanya bisa dipakai sekali dan yang kedaluwarsa, aturan stamp, sisa stamp saat tukar, batas percobaan PIN, kelengkapan profil Google, jendela hadiah ulang tahun, dan unduhan CSV/Excel.

## Kalau macet

- `npm run dev` tidak jalan: pastikan `npm install` sudah, dan `.dev.vars` ada.
- Halaman bilang database kosong: jalankan `npm run setup`.
- Login owner ditolak: password di `.dev.vars` minimal 8 karakter, dan `PIN_PEPPER` minimal 16 karakter. Restart `npm run dev` setelah mengubah file itu.
- Pelanggan tidak bisa masuk setelah kamu mengganti `PIN_PEPPER`: itu diharapkan. Kembalikan pepper lama, atau buat PIN baru untuk semua orang.
- Deploy ditolak karena database: file di git memang menyimpan ID contoh. Di mesin deploy, isi `database_id` dengan ID dari `wrangler d1 create` tanpa mengcommitnya.

## Batas paket gratis

Cloudflare gratis cukup untuk satu grup kafe. Kira-kira 100.000 kunjungan Worker per hari, dan database D1 punya batas baca/tulis harian. Gambar banner disimpan di R2, yang juga ada jatah gratis. Aplikasi ini tidak memanggil layanan berbayar.

QR kasir hanya hidup sekitar 60 detik, disimpan di server, dan hanya bisa dipakai satu kali. PIN di-hash dengan kunci yang ada di secret, bukan ditulis di kode. Percobaan PIN yang salah dibatasi.

Huruf di layar memakai Nunito (lisensi SIL Open Font License).
