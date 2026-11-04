# Loyalty Bos

Kartu stamp digital untuk kafe dan resto. Satu akun pelanggan dipakai di semua merek. Setiap merek punya kartu stamp sendiri.

Aplikasi ini jalan di Cloudflare versi gratis: Workers, database D1, dan tempat gambar R2. Tidak perlu aplikasi di Play Store. Pelanggan buka lewat browser HP, lalu bisa dipasang seperti aplikasi (PWA).

Tidak ada SMS dan tidak ada OTP WhatsApp, karena itu berbayar. Pelanggan bikin PIN sendiri.

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

3. Buka `wrangler.jsonc`. Ganti `database_id` yang sekarang (`00000000-0000-0000-0000-000000000001`) dengan ID dari langkah 2. Simpan file.

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

## Cara pakai sehari-hari

- Pelanggan scan QR stan, isi nama, nomor WA, dan PIN. HP itu tetap masuk. Di HP lain, mereka masuk dengan nomor WA + PIN.
- Kasir masuk dengan PIN outlet. Satu outlet hanya memberi stamp untuk mereknya.
- Satu transaksi paling satu stamp. Kasir harus mencentang syarat. Teks centangnya diatur di **Setting Program**.
- Satu pelanggan paling 2 stamp per merek per hari. Angka ini bisa diubah di Setting Program.
- Stamp penuh: kasir tap **Tukar Reward**, pelanggan scan QR untuk setuju. Atau kasir cari nomor WA lalu tukar. Stamp yang lebih dari 10 tetap nyangkut.
- Hadiah ulang tahun diatur di **Setting Program** (teks hadiah, sepanjang bulan, atau N hari di sekitar ulang tahun, nyala/mati). Pelanggan melihatnya di kartu kalau sedang berlaku. Kasir menukarnya sekali per tahun per merek, lewat QR atau nomor WA. Stamp tidak berkurang.
- Misi memberi poin, terpisah dari stamp. Owner mengatur misi di menu **Misi** (judul, penjelasan, poin seperti 0.5, merek atau semua merek, bukti tangkapan layar dan/atau tautan, sekali saja atau sekali seminggu, nyala/mati). Pelanggan kirim bukti, statusnya menunggu, lalu owner setujui atau tolak di antrian yang sama. Poin masuk setelah disetujui.
- Katalog poin ada di **Katalog poin**. Contoh awal di Loft25: Upsize 1, Coffee 2, Milk tea 2.5, Matcha 3. Boleh ada stok dan gambar.
- Pelanggan tap **Tukar** di aplikasi. Poin (atau stamp, atau hadiah ultah) ditahan, lalu muncul kode 5 angka dan QR sekitar 10 menit. Kasir mengetik kode itu, atau scan QR yang membuka halaman kasir. Kalau hangus, poin atau stamp kembali. Kode cuma sekali, cuma untuk merek outlet itu, dan tebakan dibatasi. Kasir tetap bisa menukar dari sisi kasir kalau pelanggan tidak buka aplikasinya.
- Tingkat stamp diatur di **Tingkat stamp**. Contoh Loft25: 5 stamp = free upsize, 10 stamp = free matcha. Pelanggan boleh tukar tingkat yang lebih rendah sekarang, atau lanjut kumpulin.
- Daftar pelanggan ada di **Member**: cari, filter merek, urutkan, buka detail, ganti nomor, hapus (dengan halaman konfirmasi, dan tercatat). Unduh CSV atau Excel.
- Banner promo di kartu pelanggan diatur di **Banner Promo**. Bisa tempel tautan gambar https, atau unggah file (paling 2 MB, jpg/png/webp/gif).
- Log aktivitas ada di menu **Aktivitas**. Bisa diunduh sebagai CSV.
- Kalau kasir memberi stamp sangat banyak dalam waktu singkat, atau ada yang mentok batas harian, dashboard menampilkan **Yang perlu dicek**.

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
- Deploy ditolak karena database: `database_id` di `wrangler.jsonc` harus ID dari `wrangler d1 create`, bukan ID contoh.

## Batas paket gratis

Cloudflare gratis cukup untuk satu grup kafe. Kira-kira 100.000 kunjungan Worker per hari, dan database D1 punya batas baca/tulis harian. Gambar banner disimpan di R2, yang juga ada jatah gratis. Aplikasi ini tidak memanggil layanan berbayar.

QR kasir hanya hidup sekitar 60 detik, disimpan di server, dan hanya bisa dipakai satu kali. PIN di-hash dengan kunci yang ada di secret, bukan ditulis di kode. Percobaan PIN yang salah dibatasi.

Huruf di layar memakai Nunito (lisensi SIL Open Font License).
