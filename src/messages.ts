export const ERR: Record<string, string> = {
  syarat: "Centang dulu syarat transakinya.",
  pin: "PIN-nya kurang tepat.",
  pinwait: "Terlalu banyak percobaan. Coba lagi nanti.",
  wa: "Nomor WhatsApp-nya belum beres. Contoh: 0812 3456 4567.",
  nama: "Isi nama dulu, ya. Huruf saja.",
  pinrule: "PIN harus 4 sampai 6 angka.",
  pinweak: "PIN-nya terlalu gampang. Jangan 1234 atau 0000.",
  pinmatch: "Dua PIN-nya belum sama.",
  ada: "Nomor ini sudah terdaftar. Masuk pakai PIN kamu.",
  tidak: "Nomor atau PIN-nya kurang tepat.",
  belum: "Nomor ini belum jadi member. Minta mereka scan QR gabung dulu.",
  cap: "Member ini sudah kena batas stamp hari ini.",
  cepat: "Terlalu cepat kasih stamp. Istirahat sebentar, atau hubungi owner.",
  claim: "QR ini tidak berlaku.",
  used: "QR ini sudah dipakai.",
  expired: "QR-nya sudah hangus. Minta kasir tap lagi.",
  cancelled: "QR ini dibatalkan kasir.",
  kurang: "Stamp-nya belum cukup buat ditukar.",
  batal: "Entri ini tidak bisa dibatalkan.",
  outlet: "Outlet-nya tidak ada atau sedang nonaktif.",
  secret: "Password owner belum disetel di secret Cloudflare.",
  gambar: "Gambar harus berupa file di bawah 2 MB, atau tautan https.",
  csrf: "Form-nya ditolak. Muat ulang halaman, lalu coba lagi.",
  umum: "Ada yang kurang pas. Coba lagi.",
  ultah: "Hadiah ulang tahunnya belum aktif untuk member ini.",
  "ultah-sudah": "Hadiah ulang tahun tahun ini sudah ditukar.",
  punya: "Nomor ini sudah punya kartu. Masukkan PIN-nya untuk menghubungkan Google.",
  "google-lain": "Nomor ini sudah terhubung ke akun Google lain.",
  lahir: "Tanggal lahirnya belum beres.",
  profil: "Lengkapi nama, tanggal lahir, dan nomor WA dulu.",
  "google-off": "Login Google belum disetel. Owner perlu mengisi rahasia Google.",
  google: "Login Google gagal. Coba lagi.",
  aturan: "Isian aturannya belum beres.",
  cari: "Terlalu sering cari nomor. Tunggu sebentar.",
  besar: "Filenya kebesaran. Maksimal 2 MB.",
  poin: "Poin kamu belum cukup.",
  stok: "Hadiah ini lagi habis.",
  kode: "Kodenya tidak berlaku. Cek merek outlet dan masa berlakunya.",
  bukti: "Buktinya belum lengkap, ya.",
  misi: "Quest ini sudah kamu kirim, atau lagi dikunci.",
  passpendek: "Password baru minimal 8 karakter, ya.",
  passbeda: "Password baru dan ulangi-nya belum sama.",
  passsalah: "Password sekarang kurang tepat.",
  sendiri: "Gak bisa kasih stamp ke akun sendiri ya",
};

export const OK: Record<string, string> = {
  stamp: "Yeay, stamp kamu nambah!",
  redeem: "Reward berhasil ditukar.",
  batal: "Entri terakhir dibatalkan.",
  simpan: "Tersimpan.",
  pin: "PIN outlet sudah diganti.",
  banner: "Banner disimpan.",
  outlet: "Outlet ditambah.",
  hapus: "Banner dihapus.",
  telepon: "Nomor WA diganti.",
  lahirsimpan: "Tanggal lahir disimpan.",
  "member-hapus": "Member dihapus. Catatannya tersimpan.",
  misi: "Yeay, poin kamu masuk!",
  setuju: "Misi disetujui. Poin masuk.",
  tarik: "Poin quest ditarik balik.",
  tolak: "Misi ditolak.",
  kode: "Kode dikonfirmasi.",
  password: "Password diganti. Sesi owner lain sudah dikeluarkan.",
};

export function errText(code: string | null): string | null {
  if (!code) return null;
  return ERR[code] ?? null;
}

export function okText(code: string | null): string | null {
  if (!code) return null;
  return OK[code] ?? null;
}
