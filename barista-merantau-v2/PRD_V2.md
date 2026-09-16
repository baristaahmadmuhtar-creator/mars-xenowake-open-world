# BARISTA MERANTAU — PRODUCT REQUIREMENTS DOCUMENT V2

**Version:** 2.1  
**Status:** Playable V2 / End-to-End Career Arc  
**Genre:** Open World Life Simulation / Job Simulator / RPG  
**Visual:** 3D believable realism; production target realistic PBR  
**Perspective:** Third Person  
**Mode:** Single Player  
**Target:** Desktop / Web 3D  
**Runtime prototype:** Three.js ES Modules, portable toward `@highfields` / GLTF scene integration  

---

## 1. Product Vision

**Barista Merantau** adalah life-sim 3D tentang seorang anak muda yang datang ke Kota Meranti dengan uang terbatas, kamar kos sederhana, belum punya relasi, dan belum mempunyai pengalaman kerja. Pemain membangun hidup melalui rutinitas yang saling terhubung: mencari kerja, membuat kopi, menjaga kebutuhan tubuh, menerima gaji dan tip, membeli makanan, meningkatkan alat kerja, memperbaiki kualitas tempat tinggal, membangun hubungan, dan menghadapi evaluasi karier.

V2 mengubah prototype satu-hari menjadi **story arc lima hari yang selesai dari awal sampai akhir**, lalu membuka **Free Play / Sandbox** agar pemain dapat melanjutkan kerja, menaikkan skill, dan membeli seluruh upgrade.

Target perasaan pemain:

> “Saya datang sebagai orang baru, bekerja untuk bertahan, membeli barang dari hasil kerja sendiri, dan mulai punya tempat di kota ini.”

---

## 2. Product Pillars V2

### 2.1 Work Feels Like Work
Shift memiliki clock-in/out, order target, customer patience, kebutuhan tubuh, kualitas minuman, tip, Career XP, dan shift report.

### 2.2 Money Has Meaning
Saldo dipakai untuk makanan, consumable, work gear, personal gear, home upgrade, dan mobility. Barang mahal bersaing dengan kebutuhan harian sehingga pemain harus menentukan prioritas.

### 2.3 Every Upgrade Changes Gameplay
Tidak ada item V2 yang hanya menjadi angka kosmetik. Semua 16 item memberi efek aktif pada coffee simulation, kebutuhan tubuh, inventory, perjalanan, atau recovery.

### 2.4 Progress Comes From Practice
Skill Espresso, Milk, Service, Speed, dan Knowledge naik dari aktivitas nyata. Gear memperbesar toleransi, tetapi tidak menggantikan skill pemain.

### 2.5 Story and Simulation Are One Loop
Story objective tidak berdiri sebagai minigame terpisah. Setiap chapter memanfaatkan sistem simulasi yang sama dengan Free Play.

---

## 3. Player Start State

- Saldo: **Rp1.500.000**
- Career: **Perantau Baru**
- Tempat tinggal: **Kos Meranti, kamar 07**
- Pekerjaan: belum ada
- Kendaraan: belum ada
- Skill: level dasar
- Relasi penting: Ibu Rina, Raka, Sari
- Needs: Energy, Hunger, Hygiene, Stress

---

## 4. Story V2 — End-to-End, 5 Hari

### Hari 1 — Datang dan Mendapat Pekerjaan
1. Pemain tiba di Kota Meranti.
2. Menemukan Kos Meranti.
3. Bertemu Ibu Rina dan mengambil kunci kamar 07.
4. Masuk kamar dan membuka smartphone.
5. Membuka JobFinder dan melamar posisi Trainee Barista.
6. Datang ke Bean Street Coffee.
7. Interview dengan Raka.
8. Diterima untuk trial shift.
9. Clock-in.
10. Menyelesaikan **3 order**.
11. Clock-out dan menerima pendapatan.
12. Membeli makan malam di Meranti Mart.
13. Pulang dan tidur.

### Hari 2 — Konsistensi dan Gear Pertama
1. Clock-in untuk Consistency Shift.
2. Menyelesaikan **4 order**.
3. Quality, tip, Career XP, dan relationship Raka dihitung.
4. Clock-out.
5. Pemain diwajibkan membeli minimal **1 Work Gear**.
6. Efek gear langsung aktif dan tersimpan.
7. Tidur.

### Hari 3 — Rush Hour dan Hubungan Sosial
1. Clock-in untuk Rush Hour.
2. Menyelesaikan **5 order** dengan customer patience lebih pendek.
3. Clock-out.
4. Bertemu Sari di Taman Meranti.
5. Dialog pilihan mengubah relationship dan Stress.
6. Pulang dan tidur.

### Hari 4 — Problem Solving dan Upgrade Kos
1. Clock-in untuk Maintenance Shift.
2. Dynamic event: steam wand bermasalah.
3. Pemain memilih prosedur perbaikan atau memaksa workflow.
4. Pilihan memengaruhi quality bonus, Stress, Knowledge XP, dan relationship Raka.
5. Menyelesaikan **4 order**.
6. Clock-out.
7. Membeli minimal **1 Home Upgrade**.
8. Upgrade kos terlihat secara procedural dan memberi efek recovery/economy.
9. Tidur.

### Hari 5 — Promotion Assessment
1. Bertemu Raka untuk briefing.
2. Clock-in untuk assessment.
3. Menyelesaikan **5 order**.
4. Clock-out.
5. Raka mengevaluasi assessment quality + overall coffee quality.
6. Hasil akhir:
   - **Junior Barista** jika assessment ≥ 76 dan overall ≥ 74;
   - **Barista** jika overall ≥ 88 dan assessment lolos;
   - **Trainee Barista** jika belum lolos; training diperpanjang tanpa hard fail.
7. Ending screen menampilkan quality, XP, order, upgrade, relationship, dan saldo.
8. **Free Play / Sandbox terbuka.**

---

## 5. Free Play

Setelah story selesai, pemain dapat:

- menjalankan sandbox shift berulang;
- mengumpulkan uang dan tip;
- membeli seluruh 16 item;
- menaikkan semua skill;
- menggunakan sepeda untuk fast travel;
- mengembangkan relationship;
- mengejar kualitas kopi lebih tinggi;
- membuka recipe Junior ketika rank memenuhi syarat.

Tidak ada hard game-over dalam V2.

---

## 6. Core Gameplay Loop

**Wake → Check needs → Travel → Clock-in → Serve orders → Clock-out → Earn → Eat / Upgrade / Socialize → Return home → Sleep → Next day**

Loop jangka panjang:

**Work → Earn → Buy Gear → Improve Consistency → Gain XP → Improve Life → Rank Up → Unlock Better Coffee → Free Play**

---

## 7. Coffee Simulation V2

Parameter aktif:

- grind size;
- dose;
- tamping pressure;
- extraction time;
- milk temperature untuk milk drinks;
- customer patience;
- player Energy;
- player Stress;
- skill level;
- equipment modifiers;
- maintenance event modifier.

Target espresso:

- dose sekitar 18 g;
- extraction 25–30 detik;
- milk 55–65°C.

### Recipe

**Trainee:**
- Espresso
- Americano
- Cappuccino
- Café Latte

**Junior+:**
- Flat White
- Mocha

---

## 8. Customer & Service

Customer pool V2:

- Office Worker
- Student
- Regular Customer
- Designer
- Nurse
- Tourist

Customer memiliki patience timer. Rush shift mengurangi waktu toleransi. Speed skill dan Shift Smartwatch memberi waktu tambahan.

Tip berasal dari coffee quality dan memperoleh multiplier kecil dari relationship Sari sebagai representasi loyal regular customer.

---

## 9. Needs

### Energy
Turun saat bergerak, sprint, dan melayani order. Rendahnya Energy menurunkan kualitas.

### Hunger
Turun seiring waktu dan order. Dipulihkan oleh makanan atau Meal Pack.

### Hygiene
Turun seiring waktu dan aktivitas kerja. Apron mengurangi decay; Water Heater memperbaiki reset setelah tidur.

### Stress
Naik karena kualitas rendah dan event tertentu. Turun lewat tidur, thermos, dan interaksi sosial tertentu.

Needs dirancang memberi tekanan ringan, bukan survival punishment ekstrem.

---

## 10. Career & Skill System

Career V2:

- Perantau Baru
- Trainee Barista
- Junior Barista
- Barista

Future full game:

- Senior Barista
- Head Barista
- Coffee Specialist
- Café Manager
- Café Owner

### Skills

| Skill | Cara berkembang | Dampak V2 |
|---|---|---|
| Espresso | membuat setiap order | bonus stabilitas quality |
| Milk | membuat milk drink | bonus milk quality |
| Service | pelayanan berkualitas | progression service |
| Speed | menyelesaikan order | customer patience tambahan |
| Knowledge | praktik + maintenance | foundation specialty coffee |

Skill naik melalui praktik; tidak dapat dibeli langsung.

---

## 11. Economy

Pendapatan V2:

- base shift wage;
- quality bonus;
- customer tip.

Base wage meningkat ringan berdasarkan jumlah shift yang sudah selesai.

Pengeluaran V2:

- makanan;
- Meal Pack;
- Work Gear;
- Personal Gear;
- Home Upgrade;
- Mobility.

Bank app juga menampilkan **sewa Rp900.000** dan countdown bulanan. Pembayaran rent penuh disimpan sebagai scope full-game setelah Week One; story V2 lima hari tidak memaksa tagihan bulanan jatuh tempo secara tidak realistis.

---

## 12. Complete Upgrade Catalog — 16 Items

### 12.1 Work Gear

| Item | Harga | Efek aktif |
|---|---:|---|
| Pocket Digital Scale | Rp75.000 | dose penalty berkurang 35% |
| Precision Tamper | Rp120.000 | tamping tolerance +70% |
| Microfoam Pitcher | Rp95.000 | milk sweet-spot +30% |
| Practice Hand Grinder | Rp180.000 | grind penalty berkurang ±25% |
| Barista Apron Pro | Rp150.000 | Hygiene decay sekitar -35% |
| Non-slip Work Shoes | Rp180.000 | sprint drain lebih rendah dan Energy per order berkurang |

### 12.2 Personal Gear

| Item | Harga | Efek aktif |
|---|---:|---|
| Shift Smartwatch | Rp260.000 | customer patience +12 detik |
| Insulated Coffee Thermos | Rp135.000 | setiap awal shift Energy +6, Stress -3 |
| Work Backpack | Rp230.000 | kapasitas Meal Pack 1 → 2 |

### 12.3 Home Upgrade

| Item | Harga | Efek aktif |
|---|---:|---|
| Better Mattress | Rp350.000 | Energy setelah tidur 100 vs 88 |
| Quiet Desk Fan | Rp220.000 | Stress recovery setelah tidur +12 tambahan |
| Mini Fridge | Rp420.000 | efektivitas makanan +20% |
| Rice Cooker | Rp280.000 | harga nasi ayam turun dari Rp28.000 → Rp22.000 |
| Water Heater | Rp500.000 | Hygiene setelah tidur 100 vs 82 |
| Study Desk Upgrade | Rp240.000 | Knowledge XP per order +10% |

### 12.4 Mobility

| Item | Harga | Efek aktif |
|---|---:|---|
| City Bicycle | Rp850.000 | fast travel dari kos / smartphone menuju café |

### Upgrade Rules

1. Semua ownership disimpan permanen dalam `localStorage`.
2. Semua item memberi modifier atau fungsi yang benar-benar dipakai sistem.
3. Work/personal/home/mobility item utama memiliki representasi visual procedural di dunia V2.
4. Item tetap aktif dalam Sandbox.
5. Production asset pass mengganti placeholder procedural dengan GLTF/PBR tanpa mengubah ID atau logic item.

---

## 13. Inventory

### Meal Pack

- harga Rp24.000;
- default capacity 1;
- capacity 2 dengan Work Backpack;
- Hunger +42;
- Energy +6;
- dapat dimakan dari Inventory app.

Inventory adalah foundation untuk food, tools, gifts, dan ingredients pada V3.

---

## 14. Relationship System

NPC utama:

### Raka — Manager
Naik dari interview, shift berkualitas, dan problem solving benar.

### Sari — Regular Customer
Story sosial Hari 3. Relationship memberi bonus tip kecil pada regular-customer loop.

### Ibu Rina — Landlord
Memperkenalkan kos dan menjadi foundation untuk housing/rent storyline.

---

## 15. Smartphone — Meranti OS V2

Apps yang diimplementasikan:

- **Story** — hari, chapter, objective;
- **JobFinder** — career, application, shift summary, bicycle fast travel;
- **Bank** — saldo, salary earned, rent preview;
- **Upgrade Shop** — seluruh 16 permanent upgrades;
- **Inventory** — Meal Pack;
- **People** — relationship Raka/Sari/Rina;
- **Skills** — skill level dan XP;
- **Coffee Notes** — recipe dan teknik.

---

## 16. World V2

Playable district memiliki:

- Kos Meranti + interior kamar;
- Bean Street Coffee;
- Meranti Mart;
- Taman Meranti;
- jalan dan sidewalk;
- procedural buildings;
- pedestrian NPC;
- day/night lighting;
- street lights;
- conditional rain.

V2 berfokus pada distrik padat dan loop yang selesai, bukan luas map maksimum.

---

## 17. Save / Resume

Save memakai `localStorage` key `baristaMerantauV2`.

Disimpan:

- story step;
- day/time;
- money;
- player position;
- needs;
- career XP;
- quality history;
- skill XP;
- relationships;
- purchased upgrades;
- inventory;
- story flags;
- shift progress.

V2.1 memiliki **mid-shift recovery**: save yang dibuat saat shift aktif dapat direkonstruksi saat reload tanpa membuat objective macet.

---

## 18. Controls

- WASD — movement
- Shift — sprint
- Mouse — camera
- E — interact
- Tab — smartphone
- Esc — release pointer lock / close active non-ending UI

---

## 19. Art Direction

Prototype memakai procedural realistic-greybox style:

- physically based Three.js materials;
- directional + hemisphere lighting;
- ACES tone mapping;
- soft shadows;
- day/night ambience;
- rain particles;
- glass / wood / metal material separation.

Production target:

- realistic Southeast Asian city block;
- GLTF/PBR café and kos interiors;
- rigged human characters;
- realistic coffee props;
- hand interaction animation;
- richer wet-road reflections;
- optimized LOD and asset streaming.

---

## 20. @highfields Integration Contract

Gameplay IDs harus dipertahankan ketika visual diganti:

- `kos`
- `room`
- `cafe`
- `market`
- `park`
- `espresso-machine`
- `clock-in`
- `clock-out`
- item IDs pada catalog

Scene production dapat mengganti procedural meshes dengan @highfields/GLTF assets selama interaction points dan game-state API tetap sama.

---

## 21. V2 Acceptance Criteria

V2 dianggap end-to-end apabila pemain dapat:

1. mulai dari arrival;
2. mendapatkan kos;
3. mendapatkan pekerjaan;
4. menyelesaikan 5 hari story;
5. menjalankan semua tipe shift;
6. membuat kopi dan mendapat quality score;
7. menerima wage + tip;
8. membeli makanan/Meal Pack;
9. membeli Work Gear;
10. melihat efek Work Gear;
11. membeli Home Upgrade;
12. melihat efek dan visual upgrade;
13. membangun relationship;
14. menghadapi maintenance event;
15. menyelesaikan assessment;
16. memperoleh hasil career;
17. masuk Free Play;
18. reload save termasuk saat berada di tengah shift;
19. membeli seluruh 16 item dalam sandbox;
20. menggunakan City Bicycle fast travel.

---

## 22. V3 / Full Game Backlog

Setelah V2 stabil:

- actual monthly rent payment + late penalty;
- bus timetable and paid transport;
- laundry system;
- full café interior navigation;
- NPC queue/navmesh;
- coworker AI roles;
- latte-art gesture system;
- inventory ingredients;
- competitor specialty café;
- multiple jobs;
- apartment upgrade;
- bicycle/motorcycle physical traversal;
- dynamic events library;
- full 30-day economy;
- Café Manager path;
- business ownership.

---

## 23. Final Product Identity

**BARISTA MERANTAU**  
*A realistic open-world life simulator about starting again in a new city through coffee, work, money, relationships, and everyday life.*
