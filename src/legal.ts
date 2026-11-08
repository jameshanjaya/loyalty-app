import { esc } from "./format";

export const LEGAL_EFFECTIVE = "8 November 2026";
export const LEGAL_CONTACT = "mandalapangan.id@gmail.com";

function mail(): string {
  return `<a href="mailto:${esc(LEGAL_CONTACT)}">${esc(LEGAL_CONTACT)}</a>`;
}

function page(title: string, lede: string, body: string): string {
  return `<main class="phone legal">
    <header class="hero hero-plain">
      <div class="hero-big">${esc(title)}</div>
      <p class="hero-fine">Loyalty Club · berlaku ${esc(LEGAL_EFFECTIVE)}</p>
    </header>
    <article class="card legal-copy">
      <p>${lede}</p>
      ${body}
      <p>Pertanyaan tentang data atau aturan ini: ${mail()}.</p>
    </article>
    <p class="fine center legal-links"><a href="/">Ke beranda</a> · <a href="/privacy">Kebijakan Privasi</a> · <a href="/terms">Syarat Pakai</a></p>
  </main>`;
}

export function privacyDocument(): string {
  return page(
    "Kebijakan Privasi",
    `Loyalty Club adalah kartu stamp di <a href="https://loyalty-bos.mandalapangan-id.workers.dev/">loyalty-bos.mandalapangan-id.workers.dev</a>. Yang menjalankan aplikasi ini Mandala Pangan. Bentuk badan hukum yang terdaftar dan alamat kantor tidak tertulis di aplikasi.`,
    `
    <h2>Merek</h2>
    <p>Yang tampil untuk pelanggan sekarang Loft25. Krispyporkk dan Soto Oseng tetap tersimpan di sistem yang sama. Selama merek tidak aktif, kartu dan kasirnya disembunyikan. Menyembunyikan merek tidak menghapus datanya.</p>
    <h2>Data akun</h2>
    <p>Kalau kamu daftar, aplikasi menyimpan nama (paling 40 karakter), nomor WhatsApp, tanggal lahir kalau diisi, cara gabung, waktu gabung, waktu terakhir masuk, dan kode ajak teman. PIN 4–6 angka disimpan sebagai hash plus salt, bukan angka aslinya.</p>
    <p>Centang promo dan ucapan ulang tahun menyimpan persetujuan beserta waktunya. Centang itu wajib untuk menyelesaikan daftar baru. Akun lama bisa mencentangnya di profil. Tidak ada tombol untuk mencabut persetujuan. Cabut lewat email di bawah.</p>
    <p>Di profil, kamu melihat nama, nomor yang disamarkan, email kalau ada, dan tanggal lahir. Nomor dan tanggal lahir yang sudah tersimpan tidak bisa kamu ubah sendiri. Owner bisa mengubah nomor dan tanggal lahir di dashboard. Tidak ada layar untuk mengubah nama setelah akun jadi.</p>
    <p>Owner bisa melihat data member dan mengunduh daftar member serta riwayat aktivitas.</p>
    <h2>Masuk dengan Google</h2>
    <p>Tombol Masuk dengan Google meminta tiga izin: openid, email, dan profile. Yang disimpan dari token Google: ID akun Google (sub), nama, dan alamat email yang ikut di token. Token dicek tanda tangannya, penerbitnya (accounts.google.com), audiens aplikasi ini, masa berlaku, dan nonce.</p>
    <p>Aplikasi tidak meminta izin membaca Gmail, Drive, Kalender, Kontak, atau foto di akun Google. Aplikasi tidak membuka kotak masuk email.</p>
    <p>Tidak ada saringan domain email di kode. Akun Google mana saja bisa mencoba masuk, lalu harus melengkapi nama, tanggal lahir, nomor WhatsApp, PIN, dan centang persetujuan. Satu akun Google hanya untuk satu member. Kalau nomor itu sudah terhubung ke Google lain, aplikasi menolak.</p>
    <p>Sebelum profil selesai, nama, email, dan ID Google ada di antrean pendaftaran. Baris itu dihapus setelah profil selesai atau setelah akun Google dihubungkan ke kartu yang sudah ada. Tidak ada jadwal yang menghapus antrean yang ditinggal. Sesi pendaftaran Google berlaku sekitar 2 jam.</p>
    <h2>Kartu dan misi</h2>
    <p>Aplikasi menyimpan stamp, pecahan stamp misi, riwayat gabung, stamp, batal, tukar, ulang tahun, dan misi, plus catatan penukaran ulang tahun dan status ajakan teman.</p>
    <p>Bukti misi paling 3 foto, jenis jpeg, png, webp, atau gif, masing-masing paling 2 MB. Fotonya disimpan di Cloudflare R2. Untuk misi yang perlu dicek gambar, foto dikirim ke Cloudflare Workers AI (model Llama 3.2 11B Vision) supaya teks di gambar terbaca dan supaya terlihat ada struk atau produk. Nama, email, dan handle Instagram dibandingkan di aplikasi setelah itu, bukan dikirim sebagai pertanyaan ke model.</p>
    <p>Hasil yang lolos bisa langsung menambah stamp misi. Hasil yang ditolak bisa diunggah lagi. Kalau hasilnya ragu, atau AI tidak tersedia, bukti menunggu owner. Foto yang sudah masuk tetap tersimpan, termasuk yang ditolak.</p>
    <h2>WhatsApp dan order</h2>
    <p>Aplikasi tidak mengirim SMS. Verifikasi nomor hanya jalan kalau owner menyalakannya. Aplikasi membuka chat WhatsApp dengan kode VERIF- dan enam angka. Kode itu berlaku 10 menit. Kalau webhook WhatsApp terpasang, nomor pengirim dan teks yang berisi kode itu diterima untuk dicocokkan. Pengiriman OTP otomatis belum diaktifkan.</p>
    <p>Ada jalur kode untuk Convia, tetapi aplikasi tidak mengirim data ke server Convia.</p>
    <p>Tombol booking atau order membuka WhatsApp outlet lewat wa.me, dengan pesan yang sudah berisi nama merek dan outlet. Ketukan itu bisa tercatat: merek, outlet, kanal, waktu, dan akun kamu kalau sedang masuk. Tautan GoFood, GrabFood, dan ShopeeFood bisa tersimpan, tetapi tidak ditampilkan di kartu dan tidak dibuka dari kartu.</p>
    <h2>Cookie, sesi, dan log</h2>
    <p>Cookie sesi bersifat HttpOnly dan SameSite=Lax, plus Secure kalau halaman dibuka lewat HTTPS. Sesi pelanggan sekitar 365 hari, dan diperpanjang kalau kamu kembali setelah kira-kira sehari. Sesi kasir sekitar 16 jam. Sesi owner sekitar 12 jam. Cookie proses Google sekitar 10 menit. Cookie tautan ajakan sekitar 7 hari. Keluar menghapus cookie sesi pelanggan di perangkat itu.</p>
    <p>Alamat IP dipakai untuk membatasi percobaan yang gagal. Catatan batas itu, dan baris sesi yang sudah kedaluwarsa, dihapus saat dashboard owner dibuka kalau usianya sudah lewat aturan di kode (catatan batas yang lebih lama dari 2 hari). Login pelanggan yang gagal juga menulis alamat IP ke log Worker. Berapa lama Cloudflare menyimpan log itu tidak diatur di aplikasi.</p>
    <h2>Tempat penyimpanan</h2>
    <p>Aplikasi berjalan di Cloudflare Workers dengan smart placement. Database yang dipakai D1 loyalty-bos-apac di APAC. Gambar dan foto bukti ada di R2. Pengecekan foto bukti memakai Workers AI di Cloudflare. Kode tidak menambah tempat penyimpanan lain.</p>
    <p>Kasir outlet melihat nama dan nomor yang dibutuhkan untuk memberi atau menukar stamp. Di daftar aktivitas kasir, nama ditampilkan singkat. Owner melihat data member di dashboard. Tidak ada fitur menjual data pelanggan.</p>
    <h2>Berapa lama data disimpan</h2>
    <p>Tidak ada satu jangka waktu untuk semua data. Halaman ini tidak menjanjikan penghapusan otomatis dalam jumlah hari tertentu.</p>
    <ul>
      <li>Sesi, cookie, kode WhatsApp (10 menit), kode tukar (sekitar 10 menit), dan QR stamp kasir (sekitar 60 detik) mengikuti masa di bagian atas.</li>
      <li>Sesi yang sudah tidak berlaku tidak bisa dipakai. Barisnya dihapus saat dashboard owner dibuka.</li>
      <li>Stamp di kartu tidak hangus otomatis. Sisa stamp di atas jumlah yang ditukar tetap ada. Pecahan stamp misi juga tidak hangus lewat jadwal poin.</li>
      <li>Buku poin terpisah di database bisa hangus. Bawaannya 60 hari kalau pengaturan kosong atau tidak valid. Owner bisa mengatur 1 sampai 3650 hari. Saldo koin itu tidak ditampilkan di kartu pelanggan.</li>
      <li>Ajakan teman hanya melekat kalau pendaftaran terjadi dalam 7 hari setelah tautan dibuka.</li>
      <li>Tanggal lahir yang baru kamu simpan tidak bisa dipakai untuk klaim hadiah selama 30 hari, kecuali owner mengizinkan.</li>
    </ul>
    <p>Profil member, foto bukti, data merek yang disembunyikan, dan antrean Google yang belum selesai tetap ada sampai ada yang menghapusnya.</p>
    <h2>Akses dan hapus</h2>
    <p>Tidak ada tombol hapus akun untuk pelanggan.</p>
    <p>Owner bisa menghapus member dari dashboard. Yang ikut terhapus: profil, kartu stamp, riwayat aktivitas, catatan penukaran ulang tahun, dan sesi login. ID member pada token klaim dikosongkan.</p>
    <p>Yang tidak ikut terhapus otomatis: foto bukti misi dan baris pengirimannya, buku poin, kode tukar, data ajakan, klik order, kode verifikasi WhatsApp, penandaan staf, dan log admin. Log penghapusan menyimpan nama, nomor WhatsApp, dan email yang ada saat dihapus.</p>
    <p>Permintaan akses, perbaikan, atau penghapusan dikirim ke email di bawah. Aplikasi tidak punya batas waktu otomatis untuk menjawab.</p>
    <h2>Anak</h2>
    <p>Tidak ada pemeriksaan umur, dan tidak ada akun khusus anak.</p>
    <h2>Perubahan</h2>
    <p>Tanggal di atas adalah tanggal halaman ini berlaku. Kalau teksnya berubah, tanggalnya diganti.</p>`,
  );
}

export function termsDocument(): string {
  return page(
    "Syarat Pakai",
    `Loyalty Club adalah kartu stamp untuk pelanggan resto. Ini bukan simpanan uang, bukan dompet digital, dan bukan tagihan. Halaman ini tidak menambah harga, denda, atau kewajiban bayar. Yang kamu bayar adalah pesanan di kasir, atau pesanan yang kamu lanjutkan sendiri di WhatsApp outlet.`,
    `
    <h2>Akun</h2>
    <p>Daftar dengan nama, nomor WhatsApp, dan PIN, atau dengan Google lalu lengkapi profil. Satu nomor untuk satu akun. Satu akun Google untuk satu member. PIN jangan diberikan ke orang lain. Stamp mengikuti akun yang memakainya.</p>
    <h2>Stamp dan hadiah</h2>
    <p>Kasir mencentang syarat transaksi dulu. Satu transaksi yang memenuhi syarat bisa menjadi satu stamp, selama batas harian merek itu belum penuh. Teks syarat, batas harian, jumlah stamp, dan nama hadiah diatur owner dan ditampilkan di kartu. Halaman ini tidak mengunci menu tertentu.</p>
    <p>Sisa stamp di atas jumlah yang ditukar tetap di kartu. Menukar lewat kasir, atau lewat kode dan QR yang berlaku sekitar 10 menit. Kalau kode itu hangus sebelum dikonfirmasi, stamp yang ditahan dikembalikan.</p>
    <p>Kasir bisa membatalkan entri terakhirnya dalam sekitar 5 menit, di sesi kasir yang sama. Akun yang ditandai staf di sebuah outlet tidak bisa menerima stamp atau tukar dari kasir outlet itu.</p>
    <p>Merek yang owner matikan tidak ditampilkan ke pelanggan dan kasir. Datanya tetap ada. Yang aktif untuk pelanggan saat ini Loft25. Krispyporkk dan Soto Oseng tetap nonaktif sampai owner menyalakannya.</p>
    <h2>Misi</h2>
    <p>Misi bonus memakai foto yang kamu unggah, paling tiga, dan tiap misi sekali sampai disetujui. Foto harus sesuai permintaan misi. Nama pada screenshot review harus mirip nama akunmu. Story harus memuat tag akun merek. Misi struk dan produk harus memperlihatkan struk dan produk. Bukti yang tidak lolos ditolak. Bukti yang meragukan menunggu owner. Owner bisa menarik stamp misi yang sudah diberikan. Kartu tidak dipaksa menjadi minus.</p>
    <h2>Ulang tahun</h2>
    <p>Hadiah ulang tahun mengikuti pengaturan merek, sekali per merek per tahun, dan tidak mengurangi stamp. Di luar jendela tanggal yang diatur, klaim tidak dibuka. Tanggal lahir yang baru kamu simpan menunggu 30 hari, kecuali owner mengizinkan klaim tahun itu. Setelah tersimpan, kamu tidak bisa mengubahnya sendiri.</p>
    <h2>Ajak teman</h2>
    <p>Teman dihitung kalau dia baru, daftar lewat tautan dalam 7 hari setelah tautan dibuka, profilnya lengkap, dan sudah mendapat satu stamp dari QR kasir. Tidak dihitung: mengajak diri sendiri, akun yang sama, staf, atau teman yang sudah pernah dihitung. Jumlah yang dipakai adalah angka di profil. Kalau pengaturan owner kosong atau tidak valid, bawaannya 4 teman untuk satu stamp. Bonus untuk teman bawaannya 0.</p>
    <h2>Pemakaian yang wajar</h2>
    <p>Jangan membuat akun ganda untuk mengambil stamp, jangan mengirim bukti palsu, jangan membagikan PIN, dan jangan menyalahgunakan QR kasir. Owner boleh menolak stamp, membatalkan entri yang masih dalam jendela batal, dan menghapus akun yang disalahgunakan. Stamp bukan uang. Tidak ada pengembalian uang untuk stamp yang hilang.</p>
    <h2>Di luar aplikasi</h2>
    <p>Booking atau order lewat WhatsApp outlet mengikuti WhatsApp setelah chat terbuka. Aplikasi mencatat ketukan tombol itu. Tautan GoFood, GrabFood, dan ShopeeFood tidak ditampilkan di kartu.</p>
    <h2>Layanan</h2>
    <p>Aplikasi bisa berubah, macet, atau mereknya disembunyikan. Hadiah tergantung stok dan konfirmasi di outlet. Rincian data ada di <a href="/privacy">Kebijakan Privasi</a>.</p>`,
  );
}
