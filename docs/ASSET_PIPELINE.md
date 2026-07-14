# Xenowake Forge Asset Pipeline

Release 2.0 memakai paket aset 3D orisinal yang dibuat secara deterministik di Blender 5.2 LTS. Pipeline menghasilkan GLB yang langsung dibaca Three.js dan PNG render untuk inspeksi visual.

## Paket aset

| Asset | Peran di game |
| --- | --- |
| `nix-alien.glb` | Karakter pemain NIX |
| `ari-scout.glb` | NPC scout ARI |
| `guardian-drone.glb` | Musuh alien terbang |
| `mars-crawler.glb` | Musuh darat berkaki enam |
| `signal-beacon.glb` | Tiga objective tower |
| `frontier-outpost.glb` | Landmark habitat |
| `crash-portal.glb` | Portal finale di Crash Basin |
| `xenite-cluster.glb` | Collectible energi |
| `martian-rock.glb` | Formasi batu hero |
| `wrecked-shuttle.glb` | Kapal jatuh di area pembuka |

## Arah seni

Bahasa material memakai Mars rust, keramik dust-ivory, obsidian metal, kulit violet, dan satu aksen Xenite cyan. Siluet dan bidang material diperbesar agar tetap jelas pada layar ponsel. Detail mikro berbasis tekstur sengaja dibatasi untuk menghindari shimmering, memory pressure, dan payload berlebihan di Safari iOS.

## Regenerasi

```powershell
& "$env:LOCALAPPDATA\CodexTools\Blender-5.2.0\blender-5.2.0-windows-x64\blender.exe" `
  --background --python tools/blender/generate_assets.py
```

Output produksi ditulis ke `public/models`. Render QA 560 × 560 ditulis ke `docs/renders`. Concept art sumber berada di `docs/concepts`.

Validasi ulang seluruh GLB dengan importer Blender dan budget checker:

```powershell
& "$env:LOCALAPPDATA\CodexTools\Blender-5.2.0\blender-5.2.0-windows-x64\blender.exe" `
  --background --python tools/blender/validate_assets.py
```

## Aturan runtime

- `AssetLibrary` memuat sepuluh GLB secara paralel.
- Clone memakai geometry/material bersama agar penggunaan memori tetap rendah.
- Procedural fallback tetap terlihat hingga model terkait berhasil dimuat.
- Low mode mematikan shadow map dan menurunkan DPR; model tidak membutuhkan post-processing.
- Service worker v3 melakukan precache semua GLB untuk reload offline setelah kunjungan pertama.
