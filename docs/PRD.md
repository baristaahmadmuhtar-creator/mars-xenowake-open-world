# Product Requirements Document — Mars: Xenowake

Status: Release 2.1 “Living Mars” diimplementasikan
Platform: Safari iOS, browser Android, dan browser desktop  
Bahasa antarmuka: Indonesia  

## 1. Ringkasan produk

Mars: Xenowake adalah game action-exploration 3D third-person yang langsung berjalan di browser. Pemain mengendalikan NIX, alien yang terbangun di dekat kapal jatuh di Mars. Pemain bebas menjelajahi satu open-zone padat, menyerap energi Xenite, mengaktifkan tiga menara sinyal dalam urutan apa pun, melumpuhkan drone penjaga, lalu membuka portal untuk pulang.

Satu sesi pertama ditargetkan selesai dalam 5–10 menit. Game tidak membutuhkan akun, login, instalasi, pembayaran, atau tutorial eksternal.

## 2. Sasaran produk

- Memberikan rasa open world melalui open-zone luas dengan landmark yang terbaca, bukan koridor linear.
- Membuat core loop dapat dipahami dalam 30 detik pada perangkat sentuh.
- Menghadirkan alur lengkap: start, eksplorasi, collectible, combat, damage, respawn, kemenangan, replay, pengaturan, dan penyimpanan lokal.
- Menargetkan minimal 30 FPS yang stabil pada kelas perangkat iPhone 12 dan Pixel 6.
- Dapat diselesaikan hanya dengan sentuhan di Safari iOS dan browser Android.

## 3. Batasan MVP

Tidak termasuk dalam MVP:

- Multiplayer, akun, cloud save, toko, crafting, atau inventory kompleks.
- Dunia prosedural tanpa batas, interior, kendaraan, atau dialog bercabang.
- Rendering fotorealistis dan post-processing berat.
- Precision aiming atau sistem banyak senjata.

## 4. Pilar pengalaman

1. **Mars yang asing dan indah** — gurun karat, debu, reruntuhan tajam, dua bulan, dan teknologi hidup berwarna cyan.
2. **Kebebasan yang terarah** — tiga menara adalah landmark dan dapat diselesaikan dalam urutan bebas.
3. **Mobile-first game feel** — kontrol sedikit dan besar, radial combat yang toleran, kamera stabil, serta feedback instan.
4. **Ekspedisi pendek yang utuh** — kebangkitan, penemuan, eskalasi, klimaks, hasil, dan replay.

## 5. Core loop

```text
Baca landmark → jelajah → serap Xenite → hindari/lumpuhkan drone
→ aktifkan menara → ancaman meningkat → aktifkan ketiga menara
→ kembali ke portal → menang → lihat waktu/skor → main lagi
```

## 6. Alur sesi

1. Pemain menekan **Mulai Ekspedisi**; gesture ini sekaligus membuka Web Audio.
2. NIX muncul di Crash Basin. Beacon dan kristal terlihat di dunia dan minimap.
3. Pemain menyerap Xenite dengan mendekatinya.
4. Satu Xenite digunakan untuk mengaktifkan satu menara.
5. Setiap menara aktif menambah intensitas audio dan jumlah drone patroli.
6. Pulse melumpuhkan drone sementara; Dash membantu kabur dan memberi invulnerability singkat.
7. Health nol memicu respawn di Crash Basin, tetapi progres menara tetap tersimpan selama sesi.
8. Setelah tiga menara aktif, portal di crash site menyala.
9. Interaksi dengan portal menampilkan waktu, rekor, Xenite, damage, dan tombol replay.

## 7. Fitur MVP

### Dunia dan navigasi

- Open-zone prosedural sekitar 190 × 190 unit dengan batas natural berupa tebing/badai.
- Micro-biome Crash Basin, Crystal Ravine, dan Ancient Ring.
- Terrain low-poly, formasi batu instanced, kristal, wreck, tiga menara tinggi, portal, debu, langit shader, bintang, dan dua bulan.
- Minimap, kompas, beacon beam, dan bahasa visual cyan untuk objective.

### Pemain dan kontrol

- Alien third-person dengan idle, jalan/lari, animasi anggota tubuh, damage feedback, dan respawn.
- Desktop: WASD/panah, drag mouse, Space, Shift, E, dan Escape.
- Mobile: joystick kiri, drag area kanan, Pulse, Dash, dan tombol interaksi kontekstual.
- Kamera auto-follow dengan smoothing dan pitch clamp.
- Pointer Events multi-touch dengan ownership per pointer ID, pointer capture, serta cleanup pada `pointercancel`, blur, dan tab tersembunyi.

### Objective dan challenge

- Tujuh Xenite collectible; satu energi diperlukan per menara.
- Tiga menara dapat diaktifkan dalam urutan bebas.
- Guardian terbang dan Mars Crawler darat memiliki state patrol, detect, chase, attack, stunned, dan reset.
- NPC ARI membuka panel transmisi sinematik dan memberi directive yang berubah mengikuti progres beacon.
- Tiga segmen health; damage memiliki invulnerability window.
- Pulse radial, Dash dengan cooldown, kondisi mati/respawn, portal, menang, dan replay.

### UI, audio, dan persistence

- Title poster, briefing, onboarding toast, objective, health, Xenite, cooldown, minimap, pause, respawn, dan win screen.
- Pengaturan mute serta kualitas Low/High.
- Audio ambient dan efek dibuat secara procedural dengan Web Audio; tidak ada file audio eksternal.
- Best time dan preference disimpan di `localStorage` dengan validasi/fallback in-memory.
- Pesan kompatibilitas jika WebGL2 tidak tersedia.

## 8. Arah visual

**Visual thesis:** kesunyian Mars bertemu teknologi alien yang hidup—gurun tembaga low-poly saat senja, dipotong cahaya cyan dan HUD ekspedisi tipis.

**Content plan:** title poster full-canvas; objective langsung di dunia; HUD pendukung yang ringkas; payoff portal yang jelas.

**Interaction thesis:** transisi sinematik poster ke dunia; depth dari debu dan parallax kamera; beacon beam, pulse ring, hit flash, cooldown, dan portal yang bereaksi terhadap progres. Makhluk, collectible, NPC, dan musuh memakai secondary motion agar dunia terasa hidup tanpa post-processing berat.

Palet utama adalah rust, oxblood, charcoal, dan pale sand. Cyan menjadi satu-satunya aksen interaksi. Siluet NIX membulat dan organik agar kontras dengan reruntuhan tajam. UI mengutamakan status dan aksi, bukan dekorasi.

## 9. Persyaratan UX mobile

- Target sentuh utama minimal 48 × 48 CSS px.
- Canvas mencegah scroll, text selection, pinch zoom, pull-to-refresh, dan callout pada permukaan game.
- Layout memakai `100dvh`, `viewport-fit=cover`, serta `env(safe-area-inset-*)`.
- Portrait tetap playable dan menampilkan rekomendasi landscape yang tidak memblokir kontrol.
- Fullscreen dan orientation lock bukan syarat.
- Audio dibuat/resume hanya dari gesture pengguna.
- `visibilitychange` dan `pagehide` menghentikan input/audio tanpa menggandakan loop saat kembali.
- Joystick, look, dan action dapat menerima beberapa pointer secara simultan.

## 10. Target teknis dan performa

- WebGL2 melalui Three.js; WebGPU tidak digunakan agar coverage Safari/Android lebih luas.
- Fixed timestep 60 Hz dengan frame delta clamp.
- DPR cap 1.5 pada High dan 1.0 pada Low.
- Performance governor mengukur FPS setelah warm-up dan menurunkan High ke Low bila rata-rata berada di bawah 27 FPS.
- InstancedMesh untuk batu/kristal berulang.
- Satu directional shadow map 1024 pada High; shadow dimatikan pada Low.
- Tidak memakai post-processing berat.
- Fog, LOD visual sederhana, dan batas dunia menjaga jumlah objek tampak.
- Target tipikal di bawah 100 draw calls dan minimal 30 FPS pada perangkat referensi.
- Sepuluh model GLB produksi berjumlah sekitar 1,43 MB sebelum kompresi transport; clone berbagi geometry/material.
- Mesh prosedural tetap tersedia sebagai fallback bila model gagal dimuat.
- Penanganan `webglcontextlost` dan `webglcontextrestored` disediakan.
- Manifest installable, ikon iOS/Android, dan service worker versioned membuat app shell dapat dimuat ulang secara offline setelah kunjungan pertama.

## 11. Acceptance criteria

MVP dianggap selesai secara implementasi apabila:

- [x] Pemain dapat memulai, bergerak, memutar kamera, mengambil Xenite, memakai Pulse/Dash, dan berinteraksi tanpa keyboard.
- [x] Ketiga menara dapat diselesaikan dalam urutan apa pun.
- [x] Drone dapat mendeteksi, mengejar, menyerang, dan dilumpuhkan.
- [x] Damage, mati, respawn, serta progres menara yang bertahan selama respawn berfungsi.
- [x] Portal terbuka hanya setelah 3/3 menara dan menghasilkan win screen.
- [x] Replay mengembalikan session state ke 0/3 tanpa listener atau loop ganda.
- [x] Pause, mute, quality, best time, dan fallback storage berfungsi.
- [x] Portrait/landscape tidak menyebabkan overflow dan kontrol tetap di dalam viewport.
- [x] Build production berhasil tanpa error TypeScript.
- [x] Chromium dan WebKit mobile emulation membuka WebGL2, start melalui touch, serta menjalankan action touch tanpa console error/warning.
- [x] CPU throttling memicu adaptive quality High → Low; service worker menyimpan bundle dan lulus offline reload.
- [ ] Safari iOS dan Chrome Android pada perangkat fisik lolos matriks `docs/MOBILE_QA.md`.
- [ ] Soak test FPS, thermal, memory pressure, lifecycle, dan context loss dijalankan pada perangkat fisik.

Dua item terakhir adalah release gate perangkat, bukan kekurangan core implementation. Emulasi Windows tidak boleh dilaporkan sebagai bukti perangkat fisik.

## 12. Risiko dan mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Scope “open world” membesar | Satu authored open-zone dengan objective bebas urutan dan landmark kuat. |
| Safari kehabisan GPU memory | Low-poly, instancing, DPR cap, Low mode, tanpa post-processing berat. |
| Gesture browser mengambil input | Pointer ownership, `touch-action`, safe-area, cancel/blur cleanup, touch fallback. |
| Navigasi membingungkan | Beacon beam, minimap, cyan objective, dan onboarding toast. |
| Combat sulit pada layar kecil | Pulse radial, radius toleran, Dash, tanpa precision aiming. |
| Audio diblokir | AudioContext dibuat/resume langsung dari gesture start/resume. |
| Tab background membuat simulasi lompat | Pause otomatis, fixed step, delta clamp, dan reset accumulator saat resume. |
| Storage ditolak/rusak | Seluruh read/write dibungkus validasi, `try/catch`, dan fallback memory. |
