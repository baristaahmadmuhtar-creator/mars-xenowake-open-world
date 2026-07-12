# Mars: Xenowake

Game action-exploration 3D open-zone di Mars yang langsung berjalan di browser. Pemain mengendalikan NIX, menyerap Xenite, mengaktifkan tiga menara dalam urutan bebas, melumpuhkan drone penjaga, lalu kembali ke portal.

**Mainkan:** https://mars-xenowake-open-world.vercel.app  
**Repository:** https://github.com/baristaahmadmuhtar-creator/mars-xenowake-open-world

PRD lengkap ada di [`docs/PRD.md`](docs/PRD.md), sedangkan matriks pengujian mobile ada di [`docs/MOBILE_QA.md`](docs/MOBILE_QA.md).

## Release 1.1

- Objective HUD kini memilih target terdekat dan menampilkan jarak: Xenite, menara, lalu portal.
- Performance governor menurunkan kualitas High ke Low secara otomatis bila FPS rata-rata berada di bawah 27.
- PWA installable dengan ikon iOS/Android, service worker versioned, app-shell cache, dan offline reload setelah kunjungan pertama.
- Metadata share/mobile, favicon/touch icon, serta manifest standalone yang lengkap.
- Konfigurasi Vercel menyertakan build settings, CSP, anti-sniff, referrer policy, permissions policy, dan service-worker cache header.
- Fallback touch/pointer diperkuat untuk WebKit dan embedded browser.

## Menjalankan lokal

Persyaratan: Node.js 20.19+ atau 22.12+.

```bash
npm install
npm run dev
```

Buka URL yang ditampilkan Vite. Untuk menguji dari ponsel pada Wi-Fi yang sama, jalankan server dengan host jaringan (script `dev` sudah memakai `0.0.0.0`) lalu buka alamat LAN komputer dari Safari/Chrome ponsel.

Build produksi:

```bash
npm run build
npm run preview
```

Folder `dist/` adalah situs statis dan dapat dipasang di Vercel, Cloudflare Pages, Netlify, S3/CDN, atau server HTTPS biasa.

## Cara bermain

Tujuan sesi:

1. Dekati kristal cyan untuk menyerap Xenite.
2. Gunakan satu Xenite untuk mengaktifkan setiap menara.
3. Aktifkan ketiga menara dalam urutan apa pun.
4. Kembali ke cincin portal di Crash Basin dan masuk ke dalamnya.

Kontrol mobile:

- Joystick kiri: bergerak.
- Geser area kanan: putar kamera.
- `Pulse`: gelombang radial yang melumpuhkan drone sementara.
- `Dash`: dorongan cepat dengan invulnerability singkat.
- Tombol interaksi: muncul dekat menara dan portal.

Kontrol desktop:

- `WASD` / panah: bergerak.
- Drag mouse: putar kamera.
- `Space`: pulse.
- `Shift`: dash.
- `E`: interaksi.
- `Escape`: jeda.

## Yang sudah diimplementasikan

- Dunia Mars 3D prosedural 190 × 190 unit dengan terrain, biome kristal, batas badai/tebing, wreck, tiga landmark menara, portal, debu, langit shader, dan dua bulan.
- Alien third-person dengan animasi prosedural, kamera orbit, health, damage, dash, pulse, respawn, serta checkpoint objective.
- Xenite collectible, tiga beacon bebas urutan, eskalasi jumlah drone, portal finale, win stats, replay, dan best-time persistence.
- Guardian drone dengan patrol, detect, chase, attack, stun, dan reset setelah respawn.
- HUD, minimap, kompas, cooldown, onboarding toast, pause, mute, kualitas Low/High, error WebGL2, context-loss handling, dan layout safe-area.
- Input Pointer Events multi-touch: joystick, look, dan action dapat digunakan simultan; `pointercancel`, blur, page hide, serta visibility change dibersihkan.
- Audio procedural Web Audio tanpa file audio eksternal dan baru dibuka setelah gesture pengguna.
- Key art lokal WebP, geometri low-poly, instancing, satu shadow map pada High, DPR cap, fixed timestep, dan Low mode untuk perangkat lebih lemah.
- Objective berjarak, adaptive quality governor, indikator online/offline, dan PWA cache untuk bermain kembali tanpa jaringan.

## Dukungan mobile

Target utama:

- Safari iOS 16.4+.
- Chrome Android pada Android 10+.
- iPadOS dan Samsung Internet terbaru sebagai tier kedua.

Game membutuhkan WebGL2. Gunakan HTTPS pada deployment karena beberapa kemampuan browser mobile dibatasi pada secure context. Fullscreen dan orientation lock tidak dijadikan syarat; portrait tetap berjalan dan memberi saran untuk landscape.

## Verifikasi

```bash
npm run typecheck
npm run build
```

Smoke test browser yang dilakukan mencakup start, keyboard movement, Xenite pickup, ketiga beacon, combat pulse/dash, damage/respawn dengan objective tetap, portal victory, best-time `localStorage`, replay, pause/settings, viewport desktop, portrait, landscape mobile, serta dua pointer sentuh simultan. Build produksi juga dijalankan pada Chromium mobile (jalur Android) dan WebKit mobile (jalur Safari) dengan tap touch, WebGL2, dan console bersih. CPU throttling 10× memicu fallback High → Low, dan reload offline berhasil dari service-worker cache yang berisi bundle JS/CSS.

Emulasi browser tidak menggantikan release gate pada perangkat fisik. Sebelum rilis publik, jalankan checklist di `docs/MOBILE_QA.md` pada iPhone Safari dan Android Chrome nyata, khususnya thermal soak, context loss, notch/safe-area, background/resume, dan memory pressure.

## Struktur utama

```text
docs/
  PRD.md
  MOBILE_QA.md
public/
  assets/xenowake-key-art.webp
  icons/*.png
  favicon.svg
  manifest.webmanifest
  sw.js
src/
  game/AudioEngine.ts
  game/InputController.ts
  game/storage.ts
  game/XenowakeGame.ts
  main.ts
  styles.css
vercel.json
```
