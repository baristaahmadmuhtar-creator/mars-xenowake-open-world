# BARISTA MERANTAU — PRODUCT REQUIREMENTS DOCUMENT V2.1

**Status:** Playable V2 / Week One End-to-End  
**Genre:** Open World Life Simulation / Job Simulator / RPG  
**Visual target:** Realistic / believable realism  
**Perspective:** Third Person  
**Mode:** Single Player  
**Target:** Desktop / Web 3D  
**Implementation:** Three.js vertical slice, GLTF/@highfields-ready

## 1. Product Goal

V2 mengubah prototype awal menjadi satu **story arc tujuh hari yang dapat dimainkan dari awal sampai akhir**, lalu membuka Free Play. Pemain datang sebagai perantau tanpa pekerjaan, mendapat kos, diterima sebagai barista, melewati tujuh shift, membeli barang yang benar-benar mengubah gameplay, membangun hubungan, belajar dari café kompetitor, membayar sewa, menerima weekly review, lalu melanjutkan karier secara bebas.

North star experience:

> “Saya benar-benar sedang hidup sebagai perantau dan bekerja menjadi barista di kota besar.”

## 2. Core Pillars

1. **Realistic Barista Work** — grind, dose, tamp, extraction, milk, customer patience, tip, shift report.
2. **Life as a Renter** — Energy, Hunger, Hygiene, Stress, uang, food, bus, kos, rent.
3. **Meaningful Upgrades** — seluruh 16 item mengubah gameplay.
4. **Story & Relationships** — Raka, Sari, Ibu Rina, Juno.
5. **Career Progression** — Career XP, skill, recipe unlock, rank.

## 3. Week One Story

### Hari 1 — Arrival
Temukan kos → ambil kunci → smartphone → JobFinder → interview → Trial Shift (3 order) → clock-out → beli makan → tidur.

### Hari 2 — Consistency
Consistency Shift (4 order) → clock-out → beli minimal 1 Work Gear → tidur.

### Hari 3 — Rush & Social
Rush Hour (5 order) → clock-out → beli Non-slip Work Shoes → belajar coffee notes di taman → bicara dengan Sari → tidur.

### Hari 4 — Quality
Quality Challenge (5 order) → clock-out → tidur.

### Hari 5 — Assessment
Briefing Raka → Promotion Assessment (5 order) → clock-out → feedback Raka → tidur.

### Hari 6 — Stability & Competitor Learning
Stability Shift (5 order + steam-wand event) → clock-out → beli minimal 1 Home Upgrade → kunjungi North Star Coffee → temui Juno → tidur.

### Hari 7 — Responsibility & Final Review
Bayar sewa Rp900.000 lewat Bank → briefing Raka → Final Shift (6 order) → clock-out → final weekly review → Free Play.

## 4. Free Play

Sesudah Week One pemain dapat mengulang shift, melengkapi 16/16 upgrade, meningkatkan semua skill dan relationship, mengejar Head Barista, menggunakan food/home economy, serta mempersiapkan expansion menuju business ownership.

## 5. Career

| Rank | Career XP |
|---|---:|
| Trainee Barista | 0–199 |
| Junior Barista | 200–449 |
| Barista | 450–749 |
| Senior Barista | 750–1099 |
| Head Barista | 1100+ |

Career XP berasal dari order, shift quality, assessment, dan story learning.

## 6. Skills

Skills: **Espresso, Milk, Service, Speed, Knowledge**.

Order memberi XP otomatis. Setiap shift memberi 1 Skill Point; jika **Study Desk** dimiliki, shift memberi 2. Satu Skill Point dapat dialokasikan ke skill pilihan untuk +25 XP.

## 7. Coffee Recipe Progression

**Trainee:** Espresso, Americano, Cappuccino, Café Latte.  
**Junior:** Flat White, Mocha.  
**Barista:** Iced Latte, Caramel Latte.  
**Senior+:** Piccolo.

Coffee targets: grind 5.0, dose 18g, tamp 18–20kg, extraction 25–30s, milk 55–65°C. Equipment memperbesar toleransi/consistency tetapi tidak menggantikan input pemain.

## 8. Complete Upgrade Catalog — 16 Items

### Work Gear
| Item | Harga | Effect |
|---|---:|---|
| Precision Tamper | Rp165.000 | Tamping tolerance meningkat |
| Digital Espresso Scale | Rp210.000 | Dose tolerance + consistency |
| Pro Milk Pitcher | Rp185.000 | Milk tolerance + microfoam assist |
| Milk Thermometer | Rp95.000 | Milk temperature tolerance +2°C |
| Distribution Tool | Rp140.000 | Grind/distribution penalty -25% |

### Personal
| Item | Harga | Effect |
|---|---:|---|
| Non-slip Work Shoes | Rp320.000 | Movement +8%, work energy drain -12% |
| Premium Work Apron | Rp175.000 | Hygiene drain -25%, +1 reputation/shift |
| Smartwatch | Rp450.000 | Customer patience +12s |
| Thermos Coffee | Rp110.000 | Shift start Energy +6, Stress -3 |
| Work Backpack | Rp230.000 | Meal Pack capacity 1 → 2 |

### Home
| Item | Harga | Effect |
|---|---:|---|
| Comfort Mattress | Rp480.000 | Sleep Energy reset 100 |
| Quiet Room Fan | Rp260.000 | Stress recovery +12 saat tidur |
| Mini Fridge | Rp650.000 | Unlock home meal |
| Rice Cooker | Rp350.000 | Home meal Rp22k → Rp12k |
| Study Desk | Rp390.000 | +1 extra Skill Point/shift |
| Warm Desk Lamp | Rp160.000 | Stress recovery +6 saat tidur |

## 9. Economy

Starting cash **Rp1.500.000**. Income: base shift pay, quality bonus, tips. Expense: food, Meal Pack, bus, upgrades, rent.

- Meal Pack: Rp24.000, Hunger +42, Energy +6.
- Home Meal: membutuhkan Mini Fridge; Rp22.000 atau Rp12.000 dengan Rice Cooker; Hunger +52, Energy +8.
- Bus: Rp5.000 + sekitar 18 menit in-game.
- Rent Hari 7: Rp900.000.

## 10. Needs

**Energy:** turun dari waktu/sprint/work; shoes dan mattress membantu.  
**Hunger:** dipulihkan food/Meal Pack/home meal.  
**Hygiene:** turun dari waktu/work; apron mengurangi decay.  
**Stress:** dipengaruhi performa, event, social interaction, thermos, fan, lamp.

## 11. Relationships

- **Raka:** interview, shift feedback, assessment, final review.
- **Sari:** regular customer dan social-life arc.
- **Ibu Rina:** kos, key, rent.
- **Juno:** North Star competitor learning / Coffee Knowledge.

## 12. World V2

Satu distrik padat berisi Kos Meranti, Bean Street Coffee, Meranti Mart, Taman Meranti, North Star Coffee, dua halte bus, street lights, roads/sidewalks, filler buildings, pedestrian NPCs, day/night, dan rain.

## 13. Smartphone

Apps: Story, JobFinder/Career, Bank, Upgrade Shop, Inventory, People, Skills, Coffee Notes.

Bank menangani pembayaran rent Hari 7. Skills menangani Skill Point allocation. Upgrade Shop memuat semua 16 permanent upgrades.

## 14. Save / Resume

`localStorage` menyimpan story step, day/time, money, career/reputation, skill XP/points, relationships, needs, inventory, upgrades, story flags, position, dan shift progress. Mid-shift reload membangun kembali shift target dan order count tanpa merusak progression.

## 15. Art Direction / @highfields Path

Procedural meshes adalah production greybox. Production pass mengganti dengan realistic GLTF/PBR: café interior, kos, espresso equipment, realistic player/NPC rigs, hand IK, walk/run/work animations, wet-road materials, signage, props, dan audio emitters. Gameplay IDs tidak bergantung pada mesh agar replacement asset tidak membongkar logic.

## 16. Acceptance Criteria

V2 selesai jika pemain dapat: memulai sebagai perantau; mendapat kos; melamar dan diterima bekerja; menyelesaikan 7 hari story; menjalankan seluruh shift; merasakan efek upgrade; menggunakan inventory/home food/bus; membangun 4 relationships; membuka recipe melalui rank; memperoleh dan membelanjakan Skill Points; membayar rent; menerima Week One report; masuk Free Play; dan melanjutkan sampai 16/16 upgrades serta Head Barista.

## 17. V3 Priorities

Realistic @highfields/GLTF art pass, interior café penuh, navmesh queue AI, hand IK/animation blending, latte-art gestures, coworker AI, physical clothing/inventory, visual bus routes, multiple employers, monthly recurring economy, expanded district streaming, production audio, dan performance/accessibility QA.
