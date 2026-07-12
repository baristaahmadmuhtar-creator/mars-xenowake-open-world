# Mobile QA & Release Contract — Mars: Xenowake

Dokumen ini adalah kontrak QA untuk MVP **Mars: Xenowake**. Tujuannya bukan sekadar memastikan halaman dapat dibuka, tetapi memastikan satu ekspedisi utuh—mulai dari poster judul, eksplorasi, tiga beacon, portal, layar menang, sampai replay—dapat diselesaikan hanya dengan sentuhan di browser mobile.

## 1. Ringkasan audit

Tanggal audit awal: 12 Juli 2026  
Lingkungan audit: Windows, Chromium/Node lokal; **bukan** perangkat iOS atau Android fisik.

Temuan statis yang sudah dapat dikonfirmasi:

- `index.html` sudah memakai `viewport-fit=cover`, membatasi zoom browser, memasang theme color, dan mendeklarasikan kemampuan standalone Apple.
- Manifest meminta orientasi landscape dan membuka game dari `/`.
- Key art WebP berukuran 131.000 byte, cukup kecil untuk tidak menjadi risiko utama waktu muat.
- Kontrak produk memang menyediakan permainan portrait dengan anjuran rotasi, bukan memblokir portrait.
- Instalasi PWA/offline **bukan** bagian dukungan rilis saat ini: manifest belum memiliki ikon dan produk belum menjanjikan service worker/offline play.

Status build, gameplay, dan browser smoke harus diisi dari hasil build final. Hasil desktop tidak boleh diberi label “mobile pass”; lihat bagian 10.

## 2. Kontrak dukungan

### Tier A — wajib lulus sebelum rilis

| Platform | Baseline | Browser | Kontrak |
| --- | --- | --- | --- |
| iPhone | iOS 16.4 atau lebih baru | Safari versi bawaan OS | Start-to-win dengan touch, landscape; portrait tetap dapat dimainkan dengan anjuran rotasi non-blocking |
| Android | Android 10 atau lebih baru | Chrome stable saat rilis dan satu versi mayor sebelumnya | Start-to-win dengan touch, landscape dan portrait |
| Android Samsung | Android 12 atau lebih baru | Samsung Internet stable saat rilis | Start-to-win dengan touch; boleh ada degradasi visual yang tidak mengganggu permainan |
| Desktop QA | Windows/macOS | Chrome/Edge/Firefox stable | Keyboard/mouse, build sanity, console, dan smoke otomatis; bukan pengganti Tier A mobile |

Perangkat referensi performa adalah **iPhone 12** dan **Pixel 6**. Perangkat yang lebih lama dari baseline atau GPU yang diblokir browser boleh menerima layar kegagalan WebGL yang jelas; layar kosong/crash tidak diterima.

### Tier B — best effort

- iPadOS Safari, Firefox Android, browser OEM selain Samsung Internet, dan perangkat lipat.
- WebGL1 fallback, jika WebGL2 tidak tersedia. Fitur inti sebaiknya tetap berjalan, tetapi visual dapat disederhanakan.

### Di luar kontrak rilis

- In-app browser/WebView dari Instagram, TikTok, Facebook, LINE, dan aplikasi lain.
- Mode offline, instalasi PWA, sinkronisasi cloud, dan pemulihan save lintas perangkat.
- Perangkat jailbroken/rooted, browser dengan WebGL atau JavaScript dimatikan, serta mode desktop yang dipaksakan di ponsel.

### Perilaku yang dijanjikan

- Seluruh loop dapat diselesaikan tanpa keyboard: mulai, bergerak, orbit kamera, ambil Xenite, Pulse, Dash, interaksi, aktivasi tiga beacon dalam urutan apa pun, masuk portal, menang, dan replay.
- Target sentuh utama minimal 48 × 48 CSS px dan tidak tertutup notch, Dynamic Island, home indicator, atau gesture bar.
- Tidak ada scroll halaman, pull-to-refresh, seleksi teks, pinch zoom, atau gerakan kamera akibat menyentuh tombol HUD.
- Background/tab switch otomatis menghentikan simulasi dan audio; resume tidak menggandakan loop, listener, musuh, atau suara.
- Mute, kualitas, dan best time bertahan setelah reload jika `localStorage` tersedia. Kegagalan/quota `localStorage` harus ditangani tanpa crash.
- Audio baru dimulai dari gesture langsung pada tombol **Mulai Ekspedisi**.

## 3. Smoke otomatis

### Pemeriksaan build yang wajib

Jalankan dari root proyek pada commit kandidat rilis:

```powershell
npm ci
npm run typecheck
$qaOut = Join-Path $env:TEMP "xenowake-qa-dist"
npm run build -- --outDir $qaOut --emptyOutDir
```

Kriteria lulus:

- Semua perintah exit code `0`.
- Tidak ada TypeScript error, import hilang, atau asset 404 pada hasil produksi.
- Build dilakukan ke direktori sementara agar artefak QA tidak tercampur dengan source.

### Browser smoke minimum

Smoke harus dijalankan terhadap **production preview**, bukan hanya dev server, sedikitnya pada Chromium desktop dengan viewport sentuh 844 × 390 dan 390 × 844. Gunakan pointer/touch emulation dan kumpulkan `console.error`, `pageerror`, request gagal, serta screenshot setiap state utama.

| ID | Langkah otomatis | Ekspektasi |
| --- | --- | --- |
| A01 | Buka `/` pada cold context | HTTP 200; poster judul dan tombol mulai terlihat; tidak ada error konsol |
| A02 | Tap **Mulai Ekspedisi** | Canvas/HUD muncul; AudioContext boleh `running`; frame terus berubah |
| A03 | Kirim pointer drag pada joystick kiri | Posisi/avatar atau state gerak berubah tanpa scroll dokumen |
| A04 | Drag sisi kanan lalu tap **Pulse** dan **Dash** | Kamera berubah; cooldown memberi feedback; touch tombol tidak memutar kamera |
| A05 | Ubah viewport 844 × 390 → 390 × 844 → 844 × 390 | Canvas di-resize; HUD tetap di dalam viewport; rekomendasi rotasi tidak memblokir permainan |
| A06 | Buka pause/pengaturan, ubah mute dan kualitas, lalu resume | State tersimpan; hanya satu render loop aktif |
| A07 | Reload | Preferensi kembali; game dapat dimulai lagi; tidak ada listener/AudioContext ganda |
| A08 | Jalankan replay tiga kali | Jumlah entity kembali ke baseline; tidak ada pertumbuhan heap terus-menerus atau error berulang |

Catatan: emulasi touch Chromium hanya smoke. Aksi multidirectional joystick + kamera + tombol secara bersamaan harus diuji pada perangkat fisik karena emulasi mouse tidak mewakili multi-touch.

Repository harus menyediakan smoke browser yang repeatable sebelum CI diberi status hijau. Bila belum ada script E2E, A01–A08 berstatus **NOT RUN**, bukan pass berdasarkan inspeksi visual.

## 4. Skenario end-to-end manual

Jalankan skenario ini pada setiap perangkat Tier A. Gunakan jaringan normal untuk run pertama dan throttling Fast 4G untuk cold-load terpisah.

1. Hapus site data, muat URL dalam portrait, lalu rotasi ke landscape. Pastikan poster, CTA, dan safe area benar.
2. Tap **Mulai Ekspedisi**. Pastikan ambience mulai hanya setelah tap dan tidak ada lonjakan volume.
3. Gerakkan joystick kiri sambil, dengan jari kedua, mengorbit kamera. Sambil kedua jari aktif, tap Pulse/Dash dengan jari ketiga bila perangkat mendukung.
4. Ambil minimal tiga Xenite. Pastikan counter bertambah sekali per pickup dan tidak dapat dipungut dua kali.
5. Aktifkan beacon dalam urutan berbeda antar perangkat, misalnya C → A → B. Setiap beacon harus mengurangi satu Xenite tepat sekali dan mengubah objective/beam/toast secara konsisten.
6. Picu drone: patroli → deteksi → kejar → damage. Gunakan Pulse untuk stun dan pastikan cooldown serta feedback visual/audio sinkron.
7. Sengaja habiskan tiga segmen health. Pastikan respawn di crash site mempertahankan beacon yang sudah aktif, membersihkan state tempur yang macet, dan tidak menggandakan entity.
8. Setelah semua beacon aktif, kembali ke portal dan selesaikan run. Pastikan waktu, best time, dan jumlah Xenite masuk akal.
9. Pilih replay, lalu selesaikan atau jalankan sebagian run kedua. Pastikan semua pickup, drone, beacon, cooldown, health, dan portal di-reset tepat satu kali.
10. Reload halaman. Pastikan best time, mute, dan kualitas bertahan, sedangkan run aktif dimulai bersih.

Variasi wajib selama skenario:

- Background selama 10 detik saat berjalan dan saat cooldown aktif, lalu foreground.
- Kunci layar 10 detik lalu buka kembali.
- Putar perangkat dua kali saat joystick sedang disentuh; `pointercancel` harus melepaskan input sehingga avatar tidak terus berjalan.
- Tarik Control Center/notification shade lalu kembali.
- Putus-sambung headphone/Bluetooth jika audio tersedia.
- Gunakan browser Back saat pause/menu. Browser tidak boleh terperangkap dalam history loop; bila keluar halaman, perilakunya harus konsisten dan tidak merusak save.

## 5. Matriks perangkat manual

`P0` berarti harus lulus pada perangkat fisik sebelum rilis. `P1` dapat menyusul bila tidak ada perangkat, tetapi risikonya harus diterima eksplisit.

| Prioritas | Perangkat representatif | OS/browser | Fokus uji |
| --- | --- | --- | --- |
| P0 | iPhone SE generasi ke-3 / layar kecil setara | iOS 16.4+ / Safari | HUD sempit, target 48 px, toolbar dinamis, portrait, performa batas bawah |
| P0 | iPhone 12 | iOS yang masih didukung / Safari | Baseline 30 FPS, notch/safe-area, audio unlock, lifecycle |
| P0 | iPhone generasi terkini dengan Dynamic Island | iOS current / Safari | Safe-area modern, `100dvh`, rotasi, memory pressure |
| P0 | Pixel 6 | Android current/current-1 / Chrome | Baseline 30 FPS, gesture navigation, multi-touch, audio focus |
| P0 | Samsung Galaxy A-series kelas menengah | Android 12+ / Chrome | GPU/memory lebih ketat, thermal, display scaling |
| P0 | Samsung Galaxy S/A-series | Android 12+ / Samsung Internet | Pointer Events, viewport toolbar, WebGL driver OEM |
| P1 | iPad 9th gen atau setara | iPadOS current / Safari | Aspect ratio lebar, safe-area, desktop-class viewport |
| P1 | Android RAM 4 GB / Adreno atau Mali kelas bawah | Android 10+ / Chrome | Low quality, context loss, stutter, reload karena memory pressure |
| P1 | Pixel/Samsung | Android current / Firefox | Fallback browser, input, audio, WebGL |

Untuk setiap baris catat: model pasti, versi OS, versi browser, mode kualitas, orientasi, average/median FPS, p95 frame time, hasil E2E, hasil lifecycle, bug ID, dan bukti video/screenshot.

## 6. Gerbang rilis

Kandidat rilis hanya boleh dipublikasikan bila seluruh syarat berikut terpenuhi:

- **G1 — Build:** install bersih, typecheck, dan production build lulus.
- **G2 — Automated smoke:** A01–A08 lulus dua run berturut-turut tanpa `console.error`, `pageerror`, request gagal, atau screenshot kosong.
- **G3 — Core loop:** start-to-win dan replay lulus pada iPhone 12, Pixel 6, dan satu Samsung Internet; urutan beacon divariasikan.
- **G4 — Touch:** multi-touch gerak + kamera + aksi berfungsi; tidak ada stuck input setelah `pointercancel`, rotasi, background, atau sentuhan keluar layar.
- **G5 — Layout:** landscape dan portrait usable; seluruh kontrol primer berada dalam safe area; tidak ada scroll/zoom/pull-to-refresh yang tidak disengaja.
- **G6 — Lifecycle/audio:** pause/resume, lock/unlock, audio interruption, mute, dan reload tidak menggandakan simulasi/audio.
- **G7 — Persistence:** best time dan preferensi bertahan; storage unavailable tidak menyebabkan crash.
- **G8 — Performance:** semua hard budget di bagian 7 lulus pada iPhone 12 dan Pixel 6; Low mode lulus pada Android kelas menengah.
- **G9 — Stability:** soak 10 menit dan tiga replay tanpa crash, freeze, WebGL context loss yang tidak dipulihkan, atau pertumbuhan memori monoton.
- **G10 — Defect:** tidak ada bug Sev-0/Sev-1 terbuka. Sev-2 hanya boleh dirilis dengan workaround dan persetujuan eksplisit.

Klasifikasi defect:

- **Sev-0:** crash/hang luas, perangkat panas berbahaya, atau browser/tab tidak dapat dipulihkan.
- **Sev-1:** tidak dapat start-to-win, kontrol primer gagal, progress salah/hilang, layar tertutup safe area, atau performa di bawah batas keras.
- **Sev-2:** fungsi sekunder/visual/audio rusak tetapi loop masih dapat diselesaikan.
- **Sev-3:** kosmetik kecil tanpa dampak gameplay.

## 7. Budget performa

Ukur setelah cache dibersihkan untuk startup dan setelah warm-up 60 detik untuk gameplay. Run gameplay pengukuran minimal lima menit, mencakup semua micro-biome, tiga drone aktif, Pulse, aktivasi beacon, dan portal.

| Metrik | Hard budget rilis | Cara ukur |
| --- | --- | --- |
| Transfer awal terkompresi | ≤ 1,5 MB untuk HTML + CSS + JS + asset wajib title/game awal | Network panel/remote inspector, disable cache |
| Waktu CTA siap | ≤ 5 detik pada Fast 4G, cold cache, perangkat referensi | Navigation trace; tombol mulai harus responsif |
| Frame rate | Median ≥ 30 FPS dan ≥ 95% frame ≤ 50 ms | Performance trace/overlay internal selama 5 menit |
| Freeze | Tidak ada frame > 250 ms saat gameplay normal; satu hitch saat transisi awal maksimal 500 ms | Frame-time trace |
| Draw calls | ≤ 100 tipikal; ≤ 130 sesaat saat Pulse/beacon/portal | `renderer.info.render.calls` |
| Geometri | ≤ 250.000 triangle tampak pada kamera normal | `renderer.info.render.triangles` |
| Resolusi render | Low DPR cap ≤ 1,5; High DPR cap ≤ 2,0 | `renderer.getPixelRatio()` dan ukuran drawing buffer |
| Tekstur | Tidak ada tekstur > 2048²; total estimasi tekstur aktif ≤ 64 MiB | Asset audit + WebGL inspector bila tersedia |
| Memori/replay | Tidak bertambah > 15% dari baseline stabil setelah tiga replay | Heap snapshots; iOS Instruments untuk hasil final |
| Main-thread task | Tidak ada task > 200 ms selama gameplay; maksimal dua task > 100 ms per menit | Performance trace |
| Soak | 10 menit tanpa crash/context loss; FPS menit 10 tidak turun > 20% dari menit 2 | Device fisik, suhu ruang konsisten |

Jika High gagal tetapi Low lulus, game boleh memilih Low secara adaptif. Mengharuskan pemain membuka menu untuk memperbaiki layar yang sudah tidak playable tetap dianggap gagal.

## 8. Pitfall khusus iOS Safari

- **Audio gesture:** buat/resume `AudioContext` di call stack tap **Mulai Ekspedisi**, bukan setelah promise/timer. Setelah foreground, resume hanya bila pengguna tidak mute.
- **Dynamic viewport:** address bar mengubah tinggi visual. Gunakan `100dvh` dengan fallback yang aman dan resize renderer dari ukuran container aktual; jangan hanya membaca ukuran sekali saat load.
- **Safe area:** terapkan `env(safe-area-inset-*)` pada HUD interaktif, bukan hanya poster. Tes notch di kedua sisi landscape.
- **Gesture conflict:** `touch-action: none`, `overscroll-behavior`, dan `overflow: hidden` perlu berlaku pada permukaan game. Handler yang memanggil `preventDefault` tidak boleh passive.
- **Pointer cancellation:** rotasi, Control Center, dan browser chrome dapat mengirim `pointercancel`/kehilangan capture. Hapus pointer owner dan nolkan joystick.
- **Lifecycle/BFCache:** tangani `visibilitychange`, `pagehide`, dan `pageshow`; jangan membuat RAF, listener, atau AudioContext kedua ketika halaman kembali dari back-forward cache.
- **Memory/WebGL:** DPR tinggi dapat menghabiskan GPU memory. Cap DPR, hindari shadow/post-process di Low, dan sediakan handler `webglcontextlost`/`webglcontextrestored` atau pesan pemulihan yang jelas.
- **Storage:** `localStorage` dapat gagal atau dibersihkan pada private browsing/memory pressure. Seluruh get/set perlu fallback in-memory dan `try/catch`.
- **Orientation:** jangan bergantung pada Screen Orientation Lock atau fullscreen; keduanya tidak konsisten pada tab Safari biasa. Portrait harus tetap usable.
- **Silent switch/interruption:** jangan menyimpulkan audio rusak hanya dari silent mode. Uji speaker, headphone, lock/unlock, dan interupsi audio pada perangkat.

## 9. Pitfall khusus Android mobile browser

- Toolbar Chrome/Samsung Internet dan gesture bar mengubah visual viewport; resize canvas/HUD tanpa meregangkan aspect ratio.
- Pull-to-refresh dan edge-swipe Back dapat mengambil pointer dekat tepi. Sisakan inset operasional dan pastikan input dilepas ketika browser memenangkan gesture.
- Samsung Internet dan beberapa OEM mengirim urutan Pointer Events/capture yang berbeda. Selalu tangani `pointerup`, `pointercancel`, `lostpointercapture`, dan `blur`.
- Refresh rate 90/120 Hz tidak boleh mempercepat simulasi. Clamp delta setelah tab resume agar avatar/drone tidak teleport atau memberi damage beruntun.
- Mali/Adreno lama dapat mengompilasi shader secara lambat atau kehilangan context. Warm-up material penting sebelum gameplay dan uji Low mode pada hardware asli.
- Chrome dapat membekukan atau membuang tab ketika RAM sempit. Kembali ke tab harus menghasilkan pause/resume atau reload bersih, bukan HUD hidup di atas canvas mati.
- Audio focus dapat hilang karena notifikasi, panggilan, atau Bluetooth. Jangan membuat node/source ganda saat focus kembali.
- Display size/font scaling OEM dapat memperbesar HUD. Pastikan teks tidak menutupi joystick, Pulse, Dash, atau Interact pada 200% text scaling jika browser menerapkannya.
- Tombol Back harus memiliki perilaku konsisten: tutup overlay/pause terlebih dahulu bila overlay terbuka, lalu izinkan navigasi browser; jangan membuat history trap.

## 10. Yang tidak dapat divalidasi dari Windows

Chrome Device Mode di Windows hanya meniru viewport, DPR, user-agent, jaringan, dan sebagian event touch. Ia **bukan** emulasi Safari/iOS dan bukan bukti kompatibilitas mobile. Dari sesi Windows tanpa perangkat fisik, hal berikut tidak dapat dinyatakan lulus:

- Rendering WebKit/Safari iOS, shader compiler Apple GPU, batas memory WebGL, dan pemulihan context pada iPhone/iPad.
- Notch/Dynamic Island/home indicator nyata, perubahan address bar Safari, rubber-band scrolling, edge gestures, dan latency/multi-touch perangkat.
- Kebijakan Web Audio iOS, silent switch, routing speaker/headphone/Bluetooth, panggilan masuk, dan resume setelah lock screen.
- `pagehide`/BFCache/pembuangan tab di iOS, background throttling oleh OS, Low Power Mode, thermal throttling, serta FPS dan konsumsi memori berkelanjutan.
- Chrome/Samsung Internet pada driver GPU Android asli, gesture navigation OEM, notification shade, audio focus, font/display scaling, dan tab eviction pada RAM rendah.
- Instalasi/add-to-home-screen, standalone safe area, dan orientation behavior sebagai PWA—yang memang di luar kontrak MVP saat ini.

Karena itu, build hijau + smoke Chromium Windows hanya memenuhi G1/G2. **Rilis belum boleh disebut tervalidasi untuk iOS Safari atau Android mobile sampai G3–G9 dijalankan pada matriks perangkat fisik dan buktinya dicatat.**

## 11. Format laporan run

Gunakan satu baris per kombinasi perangkat/browser/build:

```text
Build/commit:
Tanggal & tester:
Perangkat / OS / browser:
Orientasi & quality:
Cold CTA ready:
Median FPS / p95 frame / draw-call peak:
Urutan beacon:
Respawn mempertahankan progress: PASS/FAIL
Portal + win + replay: PASS/FAIL
Rotate/background/lock/audio: PASS/FAIL
Console/context loss:
Bug ID & bukti:
Keputusan: PASS / FAIL / NOT RUN
```

`NOT RUN` tidak boleh diubah menjadi `PASS` berdasarkan asumsi, simulator viewport, atau hasil di platform lain.

## 12. Hasil otomatis build saat ini

Tanggal: 2026-07-12  
Lingkungan: Windows, production preview lokal, Playwright CLI

| Skenario | Hasil |
| --- | --- |
| `npm run build` (termasuk TypeScript strict check) | PASS |
| Chromium desktop: start → gerak → 3 Xenite → beacon Noctis/Eos/Valles → portal → win | PASS |
| Damage/death/respawn mempertahankan beacon; replay mengembalikan state 0/3 | PASS |
| Pause/resume, mute, quality Low/High, dan best time `localStorage` | PASS |
| Dua pointer ID simultan: joystick bergerak + Pulse | PASS |
| Chrome mobile emulation (Android): tap touch asli untuk start/Pulse, WebGL2, HUD, tanpa overflow | PASS |
| WebKit mobile emulation: start/Pulse touch, WebGL2, HUD, tanpa console error/warning | PASS |
| 844×390 landscape dan 390×844 portrait: canvas pas viewport, kontrol/pause aman, rotate hint tidak memblokir input | PASS |
| PWA manifest: 3 ikon, standalone, service worker aktif, bundle JS/CSS masuk cache | PASS |
| Offline reload setelah kunjungan pertama | PASS |
| CPU throttling 10× memicu adaptive quality High → Low | PASS |
| iPhone Safari dan Android Chrome pada perangkat fisik | NOT RUN |
| FPS/thermal/memory/context-loss soak pada perangkat fisik | NOT RUN |

WebKit Playwright di Windows memperkuat coverage lintas-engine, tetapi tetap bukan Safari iOS pada Apple GPU. Status dua baris `NOT RUN` harus tetap menjadi release gate sebelum publikasi luas.
