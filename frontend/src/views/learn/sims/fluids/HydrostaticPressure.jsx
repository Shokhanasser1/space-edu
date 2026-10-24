import { BrickWall, Gauge, Shapes, Waves } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { useSimText } from '../kit/lang';
import { Rich } from './HydrostaticPressure.parts';
import ProbeSim from './HydrostaticPressure.probe';
import ParadoxSim from './HydrostaticPressure.paradox';
import WallsSim from './HydrostaticPressure.walls';
import SeaSim from './HydrostaticPressure.sea';

const TEXT = {
  uz: {
    Pa: 'Pa',
    kPa: 'kPa',
    MPa: 'MPa',
    N: 'N',
    kN: 'kN',
    MN: 'MN',
    kg: 'kg',
    t: 't',
    atm: 'atm',
    cm: 'sm',
    m2: 'm²',
    cm2: 'sm²',
    kgm3: 'kg/m³',
    L: 'l',
    card: {
      eyebrow: 'Virtual laboratoriya · Suyuqlik va gazlar mexanikasi',
      title: 'Gidrostatik bosim',
      tabsLabel: 'Tajribani tanlang',
      tabs: {
        probe: { label: 'Chuqurlik', sub: 'p = ρgh' },
        paradox: { label: 'Paradoks', sub: 'F = pS' },
        walls: { label: 'Devorlarga', sub: 'v = √(2gh)' },
        sea: { label: 'Dengiz tubiga', sub: 'p = p₀ + ρgh' },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    speedLabel: 'Vaqt tezligi',
    slowChip: (k) => (k === 0.5 ? 'Vaqt 2 marta sekinlashtirilgan' : 'Vaqt 4 marta sekinlashtirilgan'),
    liquids: {
      water: { name: 'Suv' },
      sea: { name: 'Dengiz suvi' },
      kerosene: { name: 'Kerosin' },
      mercury: { name: 'Simob' },
    },
    facts: {
      title: 'Eslab qoling',
      items: [
        {
          term: 'Gidrostatik bosim',
          text: "p = ρgh — suyuqlik ustunining og'irligi hosil qiladigan bosim. ρ — suyuqlik zichligi, h — sirtdan pastga hisoblangan chuqurlik, g = 9.8 m/s².",
        },
        {
          term: "Barcha yo'nalishlarda",
          text: "bir xil chuqurlikda bosim barcha yo'nalishlarda bir xil. U idishning shakliga ham, suyuqlik miqdoriga ham bog'liq emas (gidrostatik paradoks).",
        },
        { term: "To'liq bosim", text: 'p = p₀ + ρgh, bu yerda p₀ ≈ 101.3 kPa — atmosfera bosimi. Suvda har 10 m chuqurlikda bosim ≈ 1 atm ga ortadi.' },
        { term: 'Birliklar', text: '1 Pa = 1 N/m²; 1 kPa = 1000 Pa; 1 MPa = 1 000 000 Pa. Bosim kuchi F = pS.' },
      ],
    },
    probe: {
      presetsLabel: 'Tayyor tajribalar',
      presets: {
        water10: { name: 'Suv · 10 m', sub: 'ρgh = 98.0 kPa' },
        kero10: { name: 'Kerosin · 10 m', sub: 'ρgh = 78.4 kPa' },
        sea10: { name: 'Dengiz suvi · 10 m', sub: 'ρgh = 100.9 kPa' },
        hg76: { name: 'Simob · 76 sm', sub: 'ρgh = 101.3 kPa = p₀' },
      },
      liquidLabel: 'Suyuqlik',
      depth: 'Chuqurlik',
      depthHint: "Datchikni sahnada sudrab ham ko'chirish mumkin — pastga-yuqoriga va yon tomonga.",
      gauge: {
        title: 'Manometr',
        reads: "ko'rsatadi: ρgh",
        hydro: 'ρgh',
        total: 'p₀ + ρgh',
        orientLabel: 'Membrana qayoqqa qaragan',
        orient: { up: 'Yuqoriga', side: 'Yonga', down: 'Pastga' },
        orientTo: { up: 'yuqoriga', side: 'yonga', down: 'pastga' },
        note: "Membranani burang: manometr ko'rsatishi o'zgarmaydi — bosim barcha yo'nalishlarda bir xil.",
        aria: (p) => `Manometr ${p} kPa gidrostatik bosimni ko'rsatmoqda.`,
      },
      legend: { hydro: 'suyuqlik bosimi', atm: 'atmosfera bosimi p₀', wall: 'devorga bosim' },
      scene: {
        atm: (p) => `atmosfera bosimi p₀ = ${p} kPa`,
        hTag: (h) => `h = ${h} m`,
        pTag: (p) => `ρgh = ${p} kPa`,
        drag: '✥ sudrang',
        tube: 'manometrga →',
        depthAxis: 'h, m',
        scaleChip: 'Simob: strelkalar 10 marta qisqartirilgan',
        aria: (name, h, p, tot) => `${name} to'ldirilgan idish. Datchik ${h} m chuqurlikda: gidrostatik bosim ${p} kPa, to'liq bosim ${tot} kPa.`,
      },
      readouts: { h: 'Chuqurlik', hydro: 'Gidrostatik bosim', total: "To'liq bosim", rho: 'Zichlik' },
      sub: {
        h: 'suyuqlik sirtidan pastga',
        hydro: (pa) => `= ${pa} Pa`,
        total: (n) => `≈ ${n} atm`,
      },
      f: {
        hydro: { tag: 'Gidrostatik bosim', general: 'p = ρgh', filled: (rho, h, pa, kpa) => `= ${rho} · 9.8 · ${h} = ${pa} Pa ≈ ${kpa} kPa` },
        total: { tag: "To'liq bosim", general: 'p = p₀ + ρgh', filled: (p0, ph, p) => `= ${p0} + ${ph} = ${p} kPa` },
      },
      graph: {
        title: "Bosimning chuqurlikka bog'liqligi p(h)",
        hydro: 'ρgh',
        total: 'p₀ + ρgh',
        others: 'boshqa suyuqliklar (ρgh)',
        x: 'h, m',
        y: 'p, kPa',
        note: "Grafik — to'g'ri chiziq: bosim chuqurlikka to'g'ri proporsional. Zichroq suyuqlikning chizig'i tikroq. p₀ + ρgh chizig'i ρgh dan p₀ = 101.3 kPa yuqorida boradi.",
        aria: "Tanlangan suyuqlikda gidrostatik va to'liq bosimning chuqurlikka bog'liqlik grafigi",
      },
      explain: {
        surface:
          "Datchik suyuqlik sirtida: ustida suyuqlik ustuni yo'q, shuning uchun ρgh = 0 — manometr nolni ko'rsatadi. Sirtga faqat atmosfera bosimi p₀ ≈ 101.3 kPa ta'sir qiladi.",
        water10:
          "10 m suv ustuni p = ρgh = 1000 · 9.8 · 10 = 98 000 Pa = 98 kPa bosim beradi — bu deyarli bitta atmosfera (101.3 kPa)! To'liq bosim p₀ + ρgh ≈ 199 kPa, ya'ni sirtdagidan qariyb 2 marta katta.",
        kero10:
          "Kerosinning zichligi suvnikidan kichik (800 < 1000 kg/m³), shuning uchun xuddi shu 10 m chuqurlikda bosim ham kichik: ρgh = 800 · 9.8 · 10 = 78 400 Pa = 78.4 kPa — suvdagining 0.8 qismi.",
        sea10:
          "Dengiz suvi chuchuk suvdan biroz zichroq (1030 kg/m³): 10 m da ρgh = 100.9 kPa — atmosfera bosimiga (101.3 kPa) juda yaqin. G'avvoslarning «har 10 m da bosim 1 atm ga ortadi» degani shundan.",
        hg76:
          "Simob juda zich (13 600 kg/m³): atigi 76 sm simob ustuni ρgh = 13 600 · 9.8 · 0.76 ≈ 101 300 Pa bosim beradi — normal atmosfera bosimiga teng. Atmosfera bosimini «760 mm simob ustuni» deb o'lchash shundan.",
        orient: (dir, p) =>
          `Membranani ${dir} burdik — manometr ko'rsatishi o'zgarmadi: ρgh = ${p} kPa. Bir xil chuqurlikda suyuqlik yuqoridan ham, pastdan ham, yondan ham bir xil bosadi.`,
        side: (h, p) => `Datchikni yon tomonga surdik, chuqurlik esa o'sha-o'sha: h = ${h} m. Bosim ham o'zgarmadi — ${p} kPa: bir xil chuqurlikdagi barcha nuqtalarda bosim bir xil.`,
        deeper: (h, p) =>
          `Chuqurroqqa tushdik: h = ${h} m. Datchik ustidagi suyuqlik ustuni balandlashdi — bosim chiziqli ortdi: ρgh = ${p} kPa. Chuqurlik 2 marta ortsa, bosim ham 2 marta ortadi.`,
        shallower: (h, p) => `Yuqoriga ko'tarildik: h = ${h} m. Ustidagi suyuqlik ustuni pasaydi, bosim kamaydi: ρgh = ${p} kPa.`,
        liquid: (name, rho, h, p) => `${name}: ρ = ${rho} kg/m³. Xuddi shu h = ${h} m chuqurlikda bosim zichlikka proporsional: ρgh = ${p} kPa.`,
      },
    },
    paradox: {
      liquidLabel: 'Suyuqlik',
      refill: "Qayta to'ldirish",
      height: 'Suyuqlik balandligi',
      heightHint: 'Uchala idishga suyuqlik bir xil balandlikkacha quyiladi. Tub yuzi hammasida bir xil: S = 100 sm².',
      walls: { label: "Devorlarga bosimni ko'rsatish", sub: "Nega og'irlik har xil-u, tubga kuch bir xil?" },
      vessels: {
        cyl: { name: 'Silindr', short: 'silindr', note: "Devorlari tik: tubga bosim kuchi suyuqlik og'irligiga teng (F = P)." },
        wide: { name: 'Kengayuvchi idish', short: 'kengayuvchi', note: "Suyuqlik ko'p, ammo og'irlikning bir qismini qiya devorlar ko'taradi: F < P." },
        narrow: { name: 'Torayuvchi idish', short: 'torayuvchi', note: 'Suyuqlik kam, ammo qiya devorlar suyuqlikni pastga bosadi: F > P.' },
      },
      vesselLine: {
        m: (m) => `Suyuqlik massasi m = ${m} kg`,
        P: (v, u) => `Og'irligi P = ${v} ${u}`,
        F: (v, u) => `Tubga bosim kuchi F = ${v} ${u}`,
      },
      legend: { bottom: 'tubga bosim', walls: 'devorga bosim', level: 'bir xil sath', weight: "suyuqlik og'irligi P" },
      scene: {
        hTag: (h) => `h = ${h} sm`,
        weightTag: (v, u) => `P = ${v} ${u}`,
        forceTag: (v, u) => `F = ${v} ${u}`,
        scaleChip: 'Simob: strelkalar 10 marta qisqartirilgan',
        aria: (h, p, F, P1, P2, P3) =>
          `Uchta idish, suyuqlik balandligi ${h} sm. Tubga bosim ${p} Pa, bosim kuchi har birida ${F} N. Suyuqlik og'irliklari: ${P1}, ${P2} va ${P3} N.`,
      },
      readouts: { h: 'Balandlik', p: 'Tubga bosim', F: 'Tubga bosim kuchi', P: "Suyuqlik og'irligi" },
      sub: { h: 'uchala idishda bir xil', p: 'uchala idishda bir xil', F: 'S = 100 sm² — uchalasida bir xil', P: 'idishlarda har xil!' },
      bars: {
        title: "Bosim kuchi va og'irlik",
        F: 'F = pS — tubga',
        P: "P = mg — og'irlik",
        unit: 'N',
        note: 'Qizil ustunlar bir xil balandlikda (uzuq chiziq), pushti ustunlar esa har xil.',
        aria: "Uchala idishda tubga bosim kuchi va suyuqlik og'irligini taqqoslash diagrammasi",
      },
      explain: {
        fill: "Suyuqlik quyilyapti: sath ko'tarilgan sari tubga bosim p = ρgh ortadi. Idishlarga har xil miqdorda suyuqlik quyilmoqda (oqimlarning qalinligiga qarang), lekin uchala manometr strelkasi birga buriladi.",
        paradox: (h, p, F, P1, P2, P3) =>
          `Uchala idishda sath bir xil — h = ${h} sm, tub yuzi ham bir xil — S = 100 sm². Shuning uchun tubga bosim p = ρgh = ${p} Pa va bosim kuchi F = pS = ${F} N hammasida bir xil! Suyuqlik og'irligi esa har xil: ${P1}, ${P2} va ${P3} N. Bu — gidrostatik paradoks.`,
        walls:
          "Suyuqlik har bir devorni unga tik yo'nalishda bosadi. Kengayuvchi idishda strelkalar pastga og'gan: og'irlikning bir qismi qiya devorlarga tushadi, tubga esa faqat F = ρghS. Torayuvchi idishda strelkalar yuqoriga og'gan: devorlar ham suyuqlikni pastga bosadi, shuning uchun tubga suyuqlik og'irligidan katta kuch tushadi.",
        height: (h, p, F) =>
          `Balandlik h = ${h} sm: p = ρgh = ${p} Pa, F = ${F} N — yana uchala idishda bir xil. Bosim faqat suyuqlik ustunining balandligiga bog'liq: h ikki marta ortsa, p ham, F ham ikki marta ortadi.`,
        liquid: (name, rho, p, F) =>
          `${name} (ρ = ${rho} kg/m³): bosim zichlikka proporsional — p = ${p} Pa, F = ${F} N. Lekin u ham uchala idishda bir xil: idishning shakli ahamiyatsiz.`,
      },
    },
    walls: {
      modeLabel: 'Tajriba',
      modes: {
        jets: { name: 'Teshikli idish', sub: 'pastki oqim kuchliroq · v = √(2gh)' },
        dam: { name: "To'g'on", sub: 'pastda bosim eng katta' },
      },
      jets: {
        tap: { label: 'Kran ochiq', on: "Quyilayotgan suv sathni o'zgarmas ushlab turadi", off: 'Suv quyilmaydi — teshiklar ochilsa, sath pasayadi' },
        setup: 'Idish 40 sm balandlikdagi stolchada turibdi. Teshiklar tubdan 5, 15 va 25 sm balandlikda, diametri 8 mm.',
        open: 'Tiqinlarni olish',
        close: 'Tiqinlash',
        refill: "Qayta to'ldirish",
        holes: { low: '1-teshik (pastki)', mid: "2-teshik (o'rta)", high: '3-teshik (yuqori)' },
        readouts: { level: 'Suv sathi' },
        sub: {
          hole: (h, p) => `h = ${h} m · p = ${p} Pa`,
          levelTap: "kran ochiq — sath o'zgarmas",
          levelFall: 'sath pasaymoqda',
          levelIdle: 'teshiklar tiqinlangan',
        },
        levelLabel: 'Suv sathi (idish tubidan)',
        levelHint: "Sath qancha baland bo'lsa, teshiklar shuncha chuqurda qoladi.",
        legend: { wall: 'devorga bosim', v: 'oqim tezligi v', jet: 'suv oqimi' },
        scene: {
          floorAxis: 'devordan masofa, m',
          levelTag: (h) => `H = ${h} sm`,
          vTag: (v) => `v₁ = ${v} m/s`,
          plugged: 'teshiklar tiqinlangan',
          aria: (H, v1, v2, v3) => `Uchta teshikli idish, suv sathi ${H} sm. Oqimlar tezligi pastdan yuqoriga: ${v1}, ${v2} va ${v3} m/s.`,
        },
        graph: { title: 'Oqim tezligi va chuqurlik v(h)', x: 'h, m', y: 'v, m/s', aria: "Teshikdan chiqayotgan oqim tezligining teshik chuqurligiga bog'liqlik grafigi" },
        f: {
          p: { tag: '1-teshikdagi bosim', general: 'p = ρgh', filled: (h, p) => `= 1000 · 9.8 · ${h} = ${p} Pa` },
          v: { tag: 'Oqim tezligi', general: 'v = √(2gh)', filled: (h, v) => `= √(2 · 9.8 · ${h}) = ${v} m/s` },
        },
        explain: {
          idle: "Teshiklar tiqinlangan. Suv idish devorlarini ichkaridan bosadi va bu bosim chuqurlik bilan ortadi (chapdagi qizil strelkalar). Tiqinlarni oling — qaysi teshikdan suv kuchliroq otilib chiqadi?",
          steady: (v1, v2, v3) =>
            `Eng pastki teshikdan suv eng kuchli otiladi: u eng chuqurda, bosim u yerda eng katta. Oqim tezliklari ${v1}, ${v2} va ${v3} m/s — v = √(2gh). Kran sathni o'zgarmas ushlab turibdi, shuning uchun oqimlar barqaror.`,
          falling:
            "Kran yopiq: suv sathi pasaymoqda. Har bir teshikning chuqurligi kamaygan sari undagi bosim ham, oqim tezligi ham kamayadi — oqimlar idishga yaqinroq tushmoqda.",
          drained: "Sath eng pastki teshikkacha tushdi — oqimlar to'xtadi: teshik ustida suv ustuni qolmadi, demak bosim ham yo'q. «Qayta to'ldirish»ni bosing.",
        },
      },
      dam: {
        levelLabel: 'Suv chuqurligi',
        pointLabel: 'Nuqta chuqurligi',
        pointHint: "Nuqtani to'g'on devori bo'ylab sudrab ham siljitish mumkin.",
        legend: { p: 'devorga bosim', water: 'suv ombori', dam: "to'g'on (beton)" },
        scene: {
          dam: "TO'G'ON",
          depthAxis: 'h, m',
          pTag: (h, p) => `h = ${h} m: p = ${p} kPa`,
          aria: (H, pb, h, p) => `To'g'on, suv chuqurligi ${H} m, tagidagi bosim ${pb} kPa. ${h} m chuqurlikdagi nuqtada bosim ${p} kPa.`,
        },
        readouts: { H: 'Suv chuqurligi', base: 'Tagidagi bosim', point: 'Nuqtadagi bosim', F: '1 m kenglikka kuch' },
        sub: {
          H: (h) => `to'g'on balandligi ${h} m`,
          base: (a) => `≈ ${a} atm`,
          point: (h) => `h = ${h} m chuqurlikda`,
          F: "o'rtacha bosim ρgH/2 × yuza H · 1 m",
        },
        f: {
          p: { tag: 'Tagidagi bosim', general: 'p = ρgH', filled: (H, pa, kpa) => `= 1000 · 9.8 · ${H} = ${pa} Pa ≈ ${kpa} kPa` },
          F: { tag: '1 m kenglikka bosim kuchi', general: 'F = ρgH² / 2 · (1 m)', filled: (H, F) => `= 1000 · 9.8 · ${H}² / 2 = ${F}` },
        },
        graph: {
          title: "To'g'on devoriga bosim p(h)",
          x: 'h, m',
          y: 'p, kPa',
          note: "Bosim chuqurlikka chiziqli bog'liq. To'g'onga ta'sir etuvchi umumiy kuch qizil uchburchakning yuzasiga mos — u H² ga proporsional.",
          aria: "To'g'on devoriga suv bosimining chuqurlikka bog'liqlik grafigi",
        },
        explain: {
          base: (H, p, atm, b, top) =>
            `Suv to'g'onni bosadi: sirtda bosim nolga teng, chuqurlik bilan chiziqli ortib, tagida ρgH = ${p} kPa ≈ ${atm} atm ga yetadi (H = ${H} m). Shuning uchun to'g'on pastda qalin (${b} m), tepada esa ingichka (${top} m) quriladi.`,
          level: (H, p, F) =>
            `Suv chuqurligi H = ${H} m: tagidagi bosim ${p} kPa. To'g'onning har 1 m kengligiga ${F} kuch ta'sir qiladi. Bu kuch H² ga proporsional: H ikki marta ortsa, kuch to'rt marta ortadi.`,
          point: (h, p, kn, t) => `h = ${h} m chuqurlikda to'g'on devoriga p = ρgh = ${p} kPa bosim ta'sir qiladi: devorning har 1 m² yuzasiga ${kn} kN kuch — taxminan ${t} t yuk og'irligi!`,
        },
      },
    },
    sea: {
      presetsLabel: "Qayerga sho'ng'iymiz?",
      presets: {
        m10: { name: '10 m chuqurlik', sub: 'p ≈ 202 kPa ≈ 2 atm', dot: '10 m' },
        diver: { name: "G'avvos · 40 m", sub: 'p ≈ 505 kPa ≈ 5 atm', dot: '40 m' },
        sub: { name: 'Suv osti kemasi · 300 m', sub: 'p ≈ 3.13 MPa ≈ 31 atm', dot: '300 m' },
        trench: { name: "Mariana botig'i · 11 km", sub: 'p ≈ 111 MPa ≈ 1100 atm', dot: '11 km' },
      },
      dive: "Sho'ng'ish",
      again: "Yana sho'ng'ish",
      surface: 'Sirtga',
      vehicles: { diver: "g'avvos", sub: 'suv osti kemasi', bathy: 'batiskaf' },
      depthLabel: 'Chuqurlik',
      depthHint: 'Shkala notekis: boshida metrlar, oxirida kilometrlar — 0 dan 11 000 m gacha.',
      legend: { p: 'suv bosimi (har tomondan)', atm: 'atmosfera bosimi p₀', hatch: 'lyuk, S = 1 m²' },
      scene: {
        atm: (p) => `atmosfera bosimi p₀ = ${p} kPa`,
        depthAxis: 'h, m',
        atmAxis: 'p, atm',
        pTag: (p) => `p = ${p}`,
        hTag: (h) => `h = ${h} m`,
        trench: "Mariana botig'i tubi",
        noScale: 'kemalar masshtabsiz chizilgan',
        speedChip: (f) => `Tushish tezligi 1 m/s · vaqt ${f} marta tezlashtirilgan`,
        aria: (h, p, atm) => `Dengiz: ${h} m chuqurlikda bosim ${p}, ya'ni ${atm} atm.`,
      },
      readouts: { h: 'Chuqurlik', p: "To'liq bosim", atm: 'Atmosferalarda', F: '1 m² lyukka kuch' },
      sub: { p: (ph) => `ρgh = ${ph}, unga p₀ qo'shiladi`, atm: 'har 10 m da ≈ +1 atm', F: (t) => `≈ ${t} t yuk og'irligi` },
      graph: {
        title: "Bosimning chuqurlikka bog'liqligi p(h)",
        x: 'h, m',
        yk: 'p, kPa',
        yM: 'p, MPa',
        note: "To'g'ri chiziq p₀ dan boshlanadi: sirtda ham atmosfera bosimi bor. Grafik masshtabi sahna bilan birga o'zgaradi.",
        aria: "Dengizda to'liq bosimning chuqurlikka bog'liqlik grafigi",
      },
      f: {
        p: { tag: "To'liq bosim", general: 'p = p₀ + ρgh', filled: (h, ph, p) => `ρgh = 1030 · 9.8 · ${h} = ${ph}  →  p = ${p}` },
        F: { tag: '1 m² lyukka kuch (ichida 1 atm)', general: 'F = (p − p₀)·S = ρghS', filled: (F, t) => `= ${F} ≈ ${t} t yuk og'irligi` },
      },
      explain: {
        surface: "Sirtda faqat atmosfera bosimi ta'sir qiladi: p = p₀ ≈ 101.3 kPa = 1 atm. Sho'ng'ish joyini tanlang yoki «Sho'ng'ish»ni bosing.",
        down: (h, p) =>
          `Pastga tushyapmiz: h = ${h} m, p = ${p}. Ustimizdagi suv ustuni balandlashgan sari bosim chiziqli ortadi — har 10 m da taxminan 1 atm.`,
        up: (h, p) => `Yuqoriga ko'tarilyapmiz: h = ${h} m. Ustimizdagi suv ustuni qisqarmoqda — bosim kamaymoqda: p = ${p}.`,
        m10: (p, atm) =>
          `Atigi 10 m chuqurlikda dengiz suvi ustuni ρgh ≈ 101 kPa bosim beradi — butun atmosfera bosimicha! To'liq bosim p = p₀ + ρgh = ${p} ≈ ${atm} atm.`,
        diver: (p, atm) =>
          `40 m — havaskor g'avvoslar uchun chegara. p = p₀ + ρgh = ${p} ≈ ${atm} atm: g'avvos tanasiga har tomondan sirtdagidan 5 marta katta bosim ta'sir qiladi. Shuning uchun u ballondagi havoni ham shu bosimda nafas oladi.`,
        sub: (p, atm, F, t) =>
          `300 m: p = ${p} ≈ ${atm} atm. Ichida 1 atm bo'lgan 1 m² lyukka F = ρghS = ${F} kuch ta'sir qiladi — ${t} tonnalik yukning og'irligicha! Shuning uchun suv osti kemalarining korpusi qalin po'latdan yasaladi.`,
        trench: (p, atm, F, t) =>
          `Mariana botig'i tubi, ≈ 11 km: p = ${p} — atmosfera bosimidan ${atm} marta katta! 1 m² yuzaga ${F} kuch — ${t} tonnalik yukning og'irligicha. Bu yerga faqat qalin po'lat sharli batiskaflar tusha olgan.`,
        free: (h, p, atm, F, t) => `h = ${h} m chuqurlikda: p = p₀ + ρgh = ${p} ≈ ${atm} atm. 1 m² lyukka ${F} kuch ta'sir qiladi — ${t} t yuk og'irligicha.`,
      },
    },
  },
  ru: {
    Pa: 'Па',
    kPa: 'кПа',
    MPa: 'МПа',
    N: 'Н',
    kN: 'кН',
    MN: 'МН',
    kg: 'кг',
    t: 'т',
    atm: 'атм',
    cm: 'см',
    m2: 'м²',
    cm2: 'см²',
    kgm3: 'кг/м³',
    L: 'л',
    card: {
      eyebrow: 'Виртуальная лаборатория · Механика жидкостей и газов',
      title: 'Гидростатическое давление',
      tabsLabel: 'Выберите опыт',
      tabs: {
        probe: { label: 'Глубина', sub: 'p = ρgh' },
        paradox: { label: 'Парадокс', sub: 'F = pS' },
        walls: { label: 'На стенки', sub: 'v = √(2gh)' },
        sea: { label: 'В глубину моря', sub: 'p = p₀ + ρgh' },
      },
    },
    common: { start: 'Начать', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    speedLabel: 'Скорость времени',
    slowChip: (k) => (k === 0.5 ? 'Время замедлено в 2 раза' : 'Время замедлено в 4 раза'),
    liquids: {
      water: { name: 'Вода' },
      sea: { name: 'Морская вода' },
      kerosene: { name: 'Керосин' },
      mercury: { name: 'Ртуть' },
    },
    facts: {
      title: 'Запомните',
      items: [
        {
          term: 'Гидростатическое давление',
          text: 'p = ρgh — давление, создаваемое весом столба жидкости. ρ — плотность жидкости, h — глубина, отсчитанная от поверхности вниз, g = 9,8 м/с².',
        },
        {
          term: 'По всем направлениям',
          text: 'на одной глубине давление одинаково по всем направлениям. Оно не зависит ни от формы сосуда, ни от количества жидкости (гидростатический парадокс).',
        },
        { term: 'Полное давление', text: 'p = p₀ + ρgh, где p₀ ≈ 101,3 кПа — атмосферное давление. В воде на каждые 10 м глубины давление растёт примерно на 1 атм.' },
        { term: 'Единицы', text: '1 Па = 1 Н/м²; 1 кПа = 1000 Па; 1 МПа = 1 000 000 Па. Сила давления F = pS.' },
      ],
    },
    probe: {
      presetsLabel: 'Готовые опыты',
      presets: {
        water10: { name: 'Вода · 10 м', sub: 'ρgh = 98,0 кПа' },
        kero10: { name: 'Керосин · 10 м', sub: 'ρgh = 78,4 кПа' },
        sea10: { name: 'Морская вода · 10 м', sub: 'ρgh = 100,9 кПа' },
        hg76: { name: 'Ртуть · 76 см', sub: 'ρgh = 101,3 кПа = p₀' },
      },
      liquidLabel: 'Жидкость',
      depth: 'Глубина',
      depthHint: 'Датчик можно и перетаскивать на сцене — вверх-вниз и в сторону.',
      gauge: {
        title: 'Манометр',
        reads: 'показывает: ρgh',
        hydro: 'ρgh',
        total: 'p₀ + ρgh',
        orientLabel: 'Куда обращена мембрана',
        orient: { up: 'Вверх', side: 'Вбок', down: 'Вниз' },
        orientTo: { up: 'вверх', side: 'вбок', down: 'вниз' },
        note: 'Поверните мембрану: показание манометра не меняется — давление одинаково по всем направлениям.',
        aria: (p) => `Манометр показывает гидростатическое давление ${p} кПа.`,
      },
      legend: { hydro: 'давление жидкости', atm: 'атмосферное давление p₀', wall: 'давление на стенку' },
      scene: {
        atm: (p) => `атмосферное давление p₀ = ${p} кПа`,
        hTag: (h) => `h = ${h} м`,
        pTag: (p) => `ρgh = ${p} кПа`,
        drag: '✥ тяните',
        tube: 'к манометру →',
        depthAxis: 'h, м',
        scaleChip: 'Ртуть: стрелки укорочены в 10 раз',
        aria: (name, h, p, tot) => `Сосуд с жидкостью (${name}). Датчик на глубине ${h} м: гидростатическое давление ${p} кПа, полное давление ${tot} кПа.`,
      },
      readouts: { h: 'Глубина', hydro: 'Гидростатическое давление', total: 'Полное давление', rho: 'Плотность' },
      sub: {
        h: 'вниз от поверхности жидкости',
        hydro: (pa) => `= ${pa} Па`,
        total: (n) => `≈ ${n} атм`,
      },
      f: {
        hydro: { tag: 'Гидростатическое давление', general: 'p = ρgh', filled: (rho, h, pa, kpa) => `= ${rho} · 9,8 · ${h} = ${pa} Па ≈ ${kpa} кПа` },
        total: { tag: 'Полное давление', general: 'p = p₀ + ρgh', filled: (p0, ph, p) => `= ${p0} + ${ph} = ${p} кПа` },
      },
      graph: {
        title: 'Зависимость давления от глубины p(h)',
        hydro: 'ρgh',
        total: 'p₀ + ρgh',
        others: 'другие жидкости (ρgh)',
        x: 'h, м',
        y: 'p, кПа',
        note: 'График — прямая: давление прямо пропорционально глубине. У более плотной жидкости прямая круче. Прямая p₀ + ρgh идёт выше прямой ρgh на p₀ = 101,3 кПа.',
        aria: 'График зависимости гидростатического и полного давления от глубины в выбранной жидкости',
      },
      explain: {
        surface:
          'Датчик у поверхности жидкости: над ним нет столба жидкости, поэтому ρgh = 0 — манометр показывает ноль. На поверхность действует только атмосферное давление p₀ ≈ 101,3 кПа.',
        water10:
          'Столб воды высотой 10 м создаёт давление p = ρgh = 1000 · 9,8 · 10 = 98 000 Па = 98 кПа — почти целая атмосфера (101,3 кПа)! Полное давление p₀ + ρgh ≈ 199 кПа — почти вдвое больше, чем у поверхности.',
        kero10:
          'Плотность керосина меньше, чем воды (800 < 1000 кг/м³), поэтому на той же глубине 10 м и давление меньше: ρgh = 800 · 9,8 · 10 = 78 400 Па = 78,4 кПа — 0,8 от давления в воде.',
        sea10:
          'Морская вода немного плотнее пресной (1030 кг/м³): на 10 м ρgh = 100,9 кПа — очень близко к атмосферному давлению (101,3 кПа). Отсюда правило водолазов: «каждые 10 м — плюс 1 атм».',
        hg76:
          'Ртуть очень плотная (13 600 кг/м³): столб ртути всего 76 см создаёт давление ρgh = 13 600 · 9,8 · 0,76 ≈ 101 300 Па — как нормальное атмосферное давление. Поэтому атмосферное давление и измеряют «в 760 мм ртутного столба».',
        orient: (dir, p) =>
          `Повернули мембрану ${dir} — показание манометра не изменилось: ρgh = ${p} кПа. На одной глубине жидкость давит одинаково и сверху, и снизу, и сбоку.`,
        side: (h, p) => `Сдвинули датчик в сторону, а глубина прежняя: h = ${h} м. Давление тоже не изменилось — ${p} кПа: во всех точках на одной глубине давление одинаково.`,
        deeper: (h, p) =>
          `Опустились глубже: h = ${h} м. Столб жидкости над датчиком стал выше — давление выросло линейно: ρgh = ${p} кПа. Глубина в 2 раза больше — давление тоже в 2 раза больше.`,
        shallower: (h, p) => `Поднялись выше: h = ${h} м. Столб жидкости над датчиком стал ниже, давление уменьшилось: ρgh = ${p} кПа.`,
        liquid: (name, rho, h, p) => `${name}: ρ = ${rho} кг/м³. На той же глубине h = ${h} м давление пропорционально плотности: ρgh = ${p} кПа.`,
      },
    },
    paradox: {
      liquidLabel: 'Жидкость',
      refill: 'Налить заново',
      height: 'Высота жидкости',
      heightHint: 'Во все три сосуда жидкость наливают до одной высоты. Площадь дна у всех одинакова: S = 100 см².',
      walls: { label: 'Показать давление на стенки', sub: 'Почему вес разный, а сила на дно одинакова?' },
      vessels: {
        cyl: { name: 'Цилиндр', short: 'цилиндр', note: 'Стенки вертикальны: сила давления на дно равна весу жидкости (F = P).' },
        wide: { name: 'Расширяющийся сосуд', short: 'расширяющийся', note: 'Жидкости много, но часть её веса держат наклонные стенки: F < P.' },
        narrow: { name: 'Сужающийся сосуд', short: 'сужающийся', note: 'Жидкости мало, но наклонные стенки давят на жидкость вниз: F > P.' },
      },
      vesselLine: {
        m: (m) => `Масса жидкости m = ${m} кг`,
        P: (v, u) => `Вес P = ${v} ${u}`,
        F: (v, u) => `Сила давления на дно F = ${v} ${u}`,
      },
      legend: { bottom: 'давление на дно', walls: 'давление на стенки', level: 'одинаковый уровень', weight: 'вес жидкости P' },
      scene: {
        hTag: (h) => `h = ${h} см`,
        weightTag: (v, u) => `P = ${v} ${u}`,
        forceTag: (v, u) => `F = ${v} ${u}`,
        scaleChip: 'Ртуть: стрелки укорочены в 10 раз',
        aria: (h, p, F, P1, P2, P3) =>
          `Три сосуда, высота жидкости ${h} см. Давление на дно ${p} Па, сила давления в каждом ${F} Н. Вес жидкости: ${P1}, ${P2} и ${P3} Н.`,
      },
      readouts: { h: 'Высота', p: 'Давление на дно', F: 'Сила давления на дно', P: 'Вес жидкости' },
      sub: { h: 'одинакова во всех трёх', p: 'одинаково во всех трёх', F: 'S = 100 см² — одинакова', P: 'в сосудах разный!' },
      bars: {
        title: 'Сила давления и вес',
        F: 'F = pS — на дно',
        P: 'P = mg — вес',
        unit: 'Н',
        note: 'Красные столбики одной высоты (пунктир), а розовые — разные.',
        aria: 'Диаграмма: сила давления на дно и вес жидкости в трёх сосудах',
      },
      explain: {
        fill: 'Жидкость наливается: чем выше уровень, тем больше давление на дно p = ρgh. В сосуды льётся разное количество жидкости (посмотрите на толщину струй), а стрелки всех трёх манометров поворачиваются вместе.',
        paradox: (h, p, F, P1, P2, P3) =>
          `Во всех трёх сосудах уровень одинаков — h = ${h} см, и площадь дна одинакова — S = 100 см². Поэтому давление на дно p = ρgh = ${p} Па и сила давления F = pS = ${F} Н везде одинаковы! А вес жидкости разный: ${P1}, ${P2} и ${P3} Н. Это гидростатический парадокс.`,
        walls:
          'Жидкость давит на каждую стенку перпендикулярно к ней. В расширяющемся сосуде стрелки наклонены вниз: часть веса жидкости приходится на наклонные стенки, а на дно — только F = ρghS. В сужающемся сосуде стрелки наклонены вверх: стенки тоже давят на жидкость вниз, поэтому сила на дно больше веса жидкости.',
        height: (h, p, F) =>
          `Высота h = ${h} см: p = ρgh = ${p} Па, F = ${F} Н — снова одинаково во всех трёх сосудах. Давление зависит только от высоты столба жидкости: h больше в 2 раза — p и F тоже больше в 2 раза.`,
        liquid: (name, rho, p, F) =>
          `${name} (ρ = ${rho} кг/м³): давление пропорционально плотности — p = ${p} Па, F = ${F} Н. Но и оно одинаково во всех трёх сосудах: форма сосуда не важна.`,
      },
    },
    walls: {
      modeLabel: 'Опыт',
      modes: {
        jets: { name: 'Сосуд с отверстиями', sub: 'нижняя струя сильнее · v = √(2gh)' },
        dam: { name: 'Плотина', sub: 'внизу давление больше всего' },
      },
      jets: {
        tap: { label: 'Кран открыт', on: 'Подливаемая вода держит уровень постоянным', off: 'Воду не подливают — при открытых отверстиях уровень падает' },
        setup: 'Сосуд стоит на подставке высотой 40 см. Отверстия — на высоте 5, 15 и 25 см от дна, диаметр 8 мм.',
        open: 'Вынуть пробки',
        close: 'Закрыть пробками',
        refill: 'Налить заново',
        holes: { low: 'Отверстие 1 (нижнее)', mid: 'Отверстие 2 (среднее)', high: 'Отверстие 3 (верхнее)' },
        readouts: { level: 'Уровень воды' },
        sub: {
          hole: (h, p) => `h = ${h} м · p = ${p} Па`,
          levelTap: 'кран открыт — уровень постоянен',
          levelFall: 'уровень понижается',
          levelIdle: 'отверстия закрыты пробками',
        },
        levelLabel: 'Уровень воды (от дна сосуда)',
        levelHint: 'Чем выше уровень, тем глубже оказываются отверстия.',
        legend: { wall: 'давление на стенку', v: 'скорость струи v', jet: 'струя воды' },
        scene: {
          floorAxis: 'расстояние от стенки, м',
          levelTag: (h) => `H = ${h} см`,
          vTag: (v) => `v₁ = ${v} м/с`,
          plugged: 'отверстия закрыты пробками',
          aria: (H, v1, v2, v3) => `Сосуд с тремя отверстиями, уровень воды ${H} см. Скорости струй снизу вверх: ${v1}, ${v2} и ${v3} м/с.`,
        },
        graph: { title: 'Скорость струи и глубина v(h)', x: 'h, м', y: 'v, м/с', aria: 'График зависимости скорости струи от глубины отверстия' },
        f: {
          p: { tag: 'Давление у отверстия 1', general: 'p = ρgh', filled: (h, p) => `= 1000 · 9,8 · ${h} = ${p} Па` },
          v: { tag: 'Скорость струи', general: 'v = √(2gh)', filled: (h, v) => `= √(2 · 9,8 · ${h}) = ${v} м/с` },
        },
        explain: {
          idle: 'Отверстия закрыты пробками. Вода давит на стенки сосуда изнутри, и это давление растёт с глубиной (красные стрелки слева). Выньте пробки — из какого отверстия вода бьёт сильнее?',
          steady: (v1, v2, v3) =>
            `Сильнее всего бьёт струя из нижнего отверстия: оно глубже всех, давление там больше всего. Скорости струй ${v1}, ${v2} и ${v3} м/с — v = √(2gh). Кран держит уровень постоянным, поэтому струи не меняются.`,
          falling: 'Кран закрыт: уровень воды понижается. Глубина каждого отверстия уменьшается — падают и давление, и скорость струи: струи падают всё ближе к сосуду.',
          drained: 'Уровень опустился до нижнего отверстия — струи иссякли: над отверстием не осталось столба воды, значит, нет и давления. Нажмите «Налить заново».',
        },
      },
      dam: {
        levelLabel: 'Глубина воды',
        pointLabel: 'Глубина точки',
        pointHint: 'Точку можно и перетаскивать вдоль стенки плотины.',
        legend: { p: 'давление на стенку', water: 'водохранилище', dam: 'плотина (бетон)' },
        scene: {
          dam: 'ПЛОТИНА',
          depthAxis: 'h, м',
          pTag: (h, p) => `h = ${h} м: p = ${p} кПа`,
          aria: (H, pb, h, p) => `Плотина, глубина воды ${H} м, давление у основания ${pb} кПа. В точке на глубине ${h} м давление ${p} кПа.`,
        },
        readouts: { H: 'Глубина воды', base: 'Давление у основания', point: 'Давление в точке', F: 'Сила на 1 м ширины' },
        sub: {
          H: (h) => `высота плотины ${h} м`,
          base: (a) => `≈ ${a} атм`,
          point: (h) => `на глубине h = ${h} м`,
          F: 'среднее давление ρgH/2 × площадь H · 1 м',
        },
        f: {
          p: { tag: 'Давление у основания', general: 'p = ρgH', filled: (H, pa, kpa) => `= 1000 · 9,8 · ${H} = ${pa} Па ≈ ${kpa} кПа` },
          F: { tag: 'Сила давления на 1 м ширины', general: 'F = ρgH² / 2 · (1 м)', filled: (H, F) => `= 1000 · 9,8 · ${H}² / 2 = ${F}` },
        },
        graph: {
          title: 'Давление на стенку плотины p(h)',
          x: 'h, м',
          y: 'p, кПа',
          note: 'Давление линейно зависит от глубины. Полная сила, действующая на плотину, соответствует площади красного треугольника — она пропорциональна H².',
          aria: 'График зависимости давления воды на стенку плотины от глубины',
        },
        explain: {
          base: (H, p, atm, b, top) =>
            `Вода давит на плотину: у поверхности давление равно нулю, с глубиной оно растёт линейно и у основания достигает ρgH = ${p} кПа ≈ ${atm} атм (H = ${H} м). Поэтому плотину строят толстой внизу (${b} м) и тонкой вверху (${top} м).`,
          level: (H, p, F) =>
            `Глубина воды H = ${H} м: давление у основания ${p} кПа. На каждый 1 м ширины плотины действует сила ${F}. Она пропорциональна H²: H больше в 2 раза — сила больше в 4 раза.`,
          point: (h, p, kn, t) => `На глубине h = ${h} м на стенку плотины действует давление p = ρgh = ${p} кПа: на каждый 1 м² стенки — сила ${kn} кН, примерно вес груза ${t} т!`,
        },
      },
    },
    sea: {
      presetsLabel: 'Куда погружаемся?',
      presets: {
        m10: { name: 'Глубина 10 м', sub: 'p ≈ 202 кПа ≈ 2 атм', dot: '10 м' },
        diver: { name: 'Водолаз · 40 м', sub: 'p ≈ 505 кПа ≈ 5 атм', dot: '40 м' },
        sub: { name: 'Подводная лодка · 300 м', sub: 'p ≈ 3,13 МПа ≈ 31 атм', dot: '300 м' },
        trench: { name: 'Марианская впадина · 11 км', sub: 'p ≈ 111 МПа ≈ 1100 атм', dot: '11 км' },
      },
      dive: 'Погрузиться',
      again: 'Погрузиться снова',
      surface: 'На поверхность',
      vehicles: { diver: 'водолаз', sub: 'подводная лодка', bathy: 'батискаф' },
      depthLabel: 'Глубина',
      depthHint: 'Шкала неравномерная: в начале метры, в конце километры — от 0 до 11 000 м.',
      legend: { p: 'давление воды (со всех сторон)', atm: 'атмосферное давление p₀', hatch: 'люк, S = 1 м²' },
      scene: {
        atm: (p) => `атмосферное давление p₀ = ${p} кПа`,
        depthAxis: 'h, м',
        atmAxis: 'p, атм',
        pTag: (p) => `p = ${p}`,
        hTag: (h) => `h = ${h} м`,
        trench: 'дно Марианской впадины',
        noScale: 'аппараты нарисованы не в масштабе',
        speedChip: (f) => `Скорость спуска 1 м/с · время ускорено в ${f} раз`,
        aria: (h, p, atm) => `Море: на глубине ${h} м давление ${p}, то есть ${atm} атм.`,
      },
      readouts: { h: 'Глубина', p: 'Полное давление', atm: 'В атмосферах', F: 'Сила на люк 1 м²' },
      sub: { p: (ph) => `ρgh = ${ph}, плюс p₀`, atm: 'каждые 10 м ≈ +1 атм', F: (t) => `≈ вес груза ${t} т` },
      graph: {
        title: 'Зависимость давления от глубины p(h)',
        x: 'h, м',
        yk: 'p, кПа',
        yM: 'p, МПа',
        note: 'Прямая начинается с p₀: и у поверхности есть атмосферное давление. Масштаб графика меняется вместе со сценой.',
        aria: 'График зависимости полного давления в море от глубины',
      },
      f: {
        p: { tag: 'Полное давление', general: 'p = p₀ + ρgh', filled: (h, ph, p) => `ρgh = 1030 · 9,8 · ${h} = ${ph}  →  p = ${p}` },
        F: { tag: 'Сила на люк 1 м² (внутри 1 атм)', general: 'F = (p − p₀)·S = ρghS', filled: (F, t) => `= ${F} ≈ вес груза ${t} т` },
      },
      explain: {
        surface: 'У поверхности действует только атмосферное давление: p = p₀ ≈ 101,3 кПа = 1 атм. Выберите место погружения или нажмите «Погрузиться».',
        down: (h, p) => `Погружаемся: h = ${h} м, p = ${p}. Чем выше столб воды над нами, тем больше давление — оно растёт линейно, примерно на 1 атм каждые 10 м.`,
        up: (h, p) => `Поднимаемся: h = ${h} м. Столб воды над нами становится ниже — давление уменьшается: p = ${p}.`,
        m10: (p, atm) =>
          `Всего на глубине 10 м столб морской воды создаёт ρgh ≈ 101 кПа — столько же, сколько вся атмосфера! Полное давление p = p₀ + ρgh = ${p} ≈ ${atm} атм.`,
        diver: (p, atm) =>
          `40 м — предел для водолазов-любителей. p = p₀ + ρgh = ${p} ≈ ${atm} атм: на тело водолаза со всех сторон давит в 5 раз сильнее, чем у поверхности. Поэтому и воздух из баллона он вдыхает под таким же давлением.`,
        sub: (p, atm, F, t) =>
          `300 м: p = ${p} ≈ ${atm} атм. На люк площадью 1 м² (внутри 1 атм) действует сила F = ρghS = ${F} — как вес груза ${t} т! Поэтому корпус подводной лодки делают из толстой стали.`,
        trench: (p, atm, F, t) =>
          `Дно Марианской впадины, ≈ 11 км: p = ${p} — в ${atm} раз больше атмосферного! На 1 м² действует сила ${F} — как вес груза ${t} т. Сюда опускались только батискафы с толстостенной стальной сферой.`,
        free: (h, p, atm, F, t) => `На глубине h = ${h} м: p = p₀ + ρgh = ${p} ≈ ${atm} атм. На люк 1 м² действует сила ${F} — как вес груза ${t} т.`,
      },
    },
  },
  en: {
    Pa: 'Pa',
    kPa: 'kPa',
    MPa: 'MPa',
    N: 'N',
    kN: 'kN',
    MN: 'MN',
    kg: 'kg',
    t: 't',
    atm: 'atm',
    cm: 'cm',
    m2: 'm²',
    cm2: 'cm²',
    kgm3: 'kg/m³',
    L: 'L',
    card: {
      eyebrow: 'Virtual lab · Mechanics of fluids and gases',
      title: 'Hydrostatic pressure',
      tabsLabel: 'Choose an experiment',
      tabs: {
        probe: { label: 'Depth', sub: 'p = ρgh' },
        paradox: { label: 'Paradox', sub: 'F = pS' },
        walls: { label: 'On walls', sub: 'v = √(2gh)' },
        sea: { label: 'Deep sea', sub: 'p = p₀ + ρgh' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Again', reset: 'Reset' },
    speedLabel: 'Time speed',
    slowChip: (k) => (k === 0.5 ? 'Time slowed down 2 times' : 'Time slowed down 4 times'),
    liquids: {
      water: { name: 'Water' },
      sea: { name: 'Sea water' },
      kerosene: { name: 'Kerosene' },
      mercury: { name: 'Mercury' },
    },
    facts: {
      title: 'Remember',
      items: [
        {
          term: 'Hydrostatic pressure',
          text: 'p = ρgh — the pressure made by the weight of a liquid column. ρ is the density of the liquid, h the depth measured down from the surface, g = 9.8 m/s².',
        },
        {
          term: 'In all directions',
          text: 'at one depth the pressure is the same in all directions. It depends neither on the shape of the vessel nor on the amount of liquid (the hydrostatic paradox).',
        },
        { term: 'Total pressure', text: 'p = p₀ + ρgh, where p₀ ≈ 101.3 kPa is the atmospheric pressure. In water the pressure grows by about 1 atm every 10 m.' },
        { term: 'Units', text: '1 Pa = 1 N/m²; 1 kPa = 1000 Pa; 1 MPa = 1 000 000 Pa. Pressure force F = pS.' },
      ],
    },
    probe: {
      presetsLabel: 'Ready-made experiments',
      presets: {
        water10: { name: 'Water · 10 m', sub: 'ρgh = 98.0 kPa' },
        kero10: { name: 'Kerosene · 10 m', sub: 'ρgh = 78.4 kPa' },
        sea10: { name: 'Sea water · 10 m', sub: 'ρgh = 100.9 kPa' },
        hg76: { name: 'Mercury · 76 cm', sub: 'ρgh = 101.3 kPa = p₀' },
      },
      liquidLabel: 'Liquid',
      depth: 'Depth',
      depthHint: 'You can also drag the sensor in the scene — up and down and sideways.',
      gauge: {
        title: 'Manometer',
        reads: 'reads: ρgh',
        hydro: 'ρgh',
        total: 'p₀ + ρgh',
        orientLabel: 'Membrane faces',
        orient: { up: 'Up', side: 'Side', down: 'Down' },
        orientTo: { up: 'up', side: 'sideways', down: 'down' },
        note: 'Turn the membrane: the manometer reading stays the same — the pressure is equal in all directions.',
        aria: (p) => `The manometer shows a hydrostatic pressure of ${p} kPa.`,
      },
      legend: { hydro: 'liquid pressure', atm: 'atmospheric pressure p₀', wall: 'pressure on the wall' },
      scene: {
        atm: (p) => `atmospheric pressure p₀ = ${p} kPa`,
        hTag: (h) => `h = ${h} m`,
        pTag: (p) => `ρgh = ${p} kPa`,
        drag: '✥ drag',
        tube: 'to the manometer →',
        depthAxis: 'h, m',
        scaleChip: 'Mercury: arrows drawn 10 times shorter',
        aria: (name, h, p, tot) => `A tank of ${name}. The sensor is ${h} m deep: hydrostatic pressure ${p} kPa, total pressure ${tot} kPa.`,
      },
      readouts: { h: 'Depth', hydro: 'Hydrostatic pressure', total: 'Total pressure', rho: 'Density' },
      sub: {
        h: 'down from the liquid surface',
        hydro: (pa) => `= ${pa} Pa`,
        total: (n) => `≈ ${n} atm`,
      },
      f: {
        hydro: { tag: 'Hydrostatic pressure', general: 'p = ρgh', filled: (rho, h, pa, kpa) => `= ${rho} · 9.8 · ${h} = ${pa} Pa ≈ ${kpa} kPa` },
        total: { tag: 'Total pressure', general: 'p = p₀ + ρgh', filled: (p0, ph, p) => `= ${p0} + ${ph} = ${p} kPa` },
      },
      graph: {
        title: 'Pressure against depth p(h)',
        hydro: 'ρgh',
        total: 'p₀ + ρgh',
        others: 'other liquids (ρgh)',
        x: 'h, m',
        y: 'p, kPa',
        note: 'The graph is a straight line: pressure is directly proportional to depth. A denser liquid gives a steeper line. The p₀ + ρgh line runs p₀ = 101.3 kPa above the ρgh line.',
        aria: 'Graph of the hydrostatic and the total pressure against depth in the chosen liquid',
      },
      explain: {
        surface:
          'The sensor is at the surface: there is no liquid column above it, so ρgh = 0 — the manometer reads zero. Only the atmospheric pressure p₀ ≈ 101.3 kPa acts on the surface.',
        water10:
          'A 10 m column of water gives p = ρgh = 1000 · 9.8 · 10 = 98 000 Pa = 98 kPa — almost a whole atmosphere (101.3 kPa)! The total pressure p₀ + ρgh ≈ 199 kPa is nearly twice that at the surface.',
        kero10:
          'Kerosene is less dense than water (800 < 1000 kg/m³), so at the same 10 m the pressure is smaller too: ρgh = 800 · 9.8 · 10 = 78 400 Pa = 78.4 kPa — 0.8 of the pressure in water.',
        sea10:
          "Sea water is a little denser than fresh water (1030 kg/m³): at 10 m ρgh = 100.9 kPa — very close to the atmospheric pressure (101.3 kPa). That is the divers' rule: “every 10 m adds 1 atm”.",
        hg76:
          'Mercury is very dense (13 600 kg/m³): a column of only 76 cm gives ρgh = 13 600 · 9.8 · 0.76 ≈ 101 300 Pa — the normal atmospheric pressure. That is why air pressure is measured “in 760 mm of mercury”.',
        orient: (dir, p) =>
          `We turned the membrane ${dir} — the manometer reading did not change: ρgh = ${p} kPa. At one depth the liquid pushes equally from above, from below and from the side.`,
        side: (h, p) => `We moved the sensor sideways, but the depth is the same: h = ${h} m. The pressure did not change either — ${p} kPa: at one depth the pressure is the same at every point.`,
        deeper: (h, p) =>
          `We went deeper: h = ${h} m. The liquid column above the sensor got taller — the pressure grew linearly: ρgh = ${p} kPa. Twice the depth gives twice the pressure.`,
        shallower: (h, p) => `We moved up: h = ${h} m. The liquid column above the sensor got shorter, the pressure fell: ρgh = ${p} kPa.`,
        liquid: (name, rho, h, p) => `${name}: ρ = ${rho} kg/m³. At the same depth h = ${h} m the pressure is proportional to the density: ρgh = ${p} kPa.`,
      },
    },
    paradox: {
      liquidLabel: 'Liquid',
      refill: 'Fill again',
      height: 'Liquid height',
      heightHint: 'All three vessels are filled to the same height. The bottom area is the same in all of them: S = 100 cm².',
      walls: { label: 'Show the pressure on the walls', sub: 'Why are the weights different but the force on the bottom the same?' },
      vessels: {
        cyl: { name: 'Cylinder', short: 'cylinder', note: 'Straight walls: the force on the bottom equals the weight of the liquid (F = P).' },
        wide: { name: 'Flaring vessel', short: 'flaring', note: 'Lots of liquid, but the slanted walls carry part of its weight: F < P.' },
        narrow: { name: 'Narrowing vessel', short: 'narrowing', note: 'Little liquid, but the slanted walls push the liquid down: F > P.' },
      },
      vesselLine: {
        m: (m) => `Mass of liquid m = ${m} kg`,
        P: (v, u) => `Weight P = ${v} ${u}`,
        F: (v, u) => `Force on the bottom F = ${v} ${u}`,
      },
      legend: { bottom: 'pressure on the bottom', walls: 'pressure on the walls', level: 'same level', weight: 'weight of liquid P' },
      scene: {
        hTag: (h) => `h = ${h} cm`,
        weightTag: (v, u) => `P = ${v} ${u}`,
        forceTag: (v, u) => `F = ${v} ${u}`,
        scaleChip: 'Mercury: arrows drawn 10 times shorter',
        aria: (h, p, F, P1, P2, P3) =>
          `Three vessels, liquid height ${h} cm. Pressure on the bottom ${p} Pa, force on each bottom ${F} N. Weights of the liquid: ${P1}, ${P2} and ${P3} N.`,
      },
      readouts: { h: 'Height', p: 'Pressure on the bottom', F: 'Force on the bottom', P: 'Weight of liquid' },
      sub: { h: 'the same in all three', p: 'the same in all three', F: 'S = 100 cm² — the same', P: 'different in each vessel!' },
      bars: {
        title: 'Pressure force and weight',
        F: 'F = pS — on the bottom',
        P: 'P = mg — weight',
        unit: 'N',
        note: 'The red bars are all the same height (dashed line), the pink ones are not.',
        aria: 'Chart comparing the force on the bottom and the weight of the liquid in the three vessels',
      },
      explain: {
        fill: 'Liquid is being poured in: the higher the level, the greater the pressure on the bottom p = ρgh. Different amounts of liquid flow into the vessels (look at the thickness of the streams), yet all three gauge needles turn together.',
        paradox: (h, p, F, P1, P2, P3) =>
          `The level is the same in all three vessels — h = ${h} cm, and so is the bottom area — S = 100 cm². So the pressure on the bottom p = ρgh = ${p} Pa and the force F = pS = ${F} N are the same everywhere! But the weights of the liquid differ: ${P1}, ${P2} and ${P3} N. This is the hydrostatic paradox.`,
        walls:
          'A liquid pushes on every wall at right angles to it. In the flaring vessel the arrows tilt down: part of the weight rests on the slanted walls, and the bottom gets only F = ρghS. In the narrowing vessel the arrows tilt up: the walls push the liquid down as well, so the bottom gets a force larger than the weight of the liquid.',
        height: (h, p, F) =>
          `Height h = ${h} cm: p = ρgh = ${p} Pa, F = ${F} N — again the same in all three vessels. The pressure depends only on the height of the liquid column: twice the h gives twice the p and twice the F.`,
        liquid: (name, rho, p, F) =>
          `${name} (ρ = ${rho} kg/m³): the pressure is proportional to the density — p = ${p} Pa, F = ${F} N. But it is still the same in all three vessels: the shape does not matter.`,
      },
    },
    walls: {
      modeLabel: 'Experiment',
      modes: {
        jets: { name: 'Bottle with holes', sub: 'the lowest jet is strongest · v = √(2gh)' },
        dam: { name: 'Dam', sub: 'the pressure is greatest at the bottom' },
      },
      jets: {
        tap: { label: 'Tap open', on: 'Incoming water keeps the level constant', off: 'No water comes in — with the holes open the level falls' },
        setup: 'The bottle stands on a 40 cm stand. The holes are 5, 15 and 25 cm above its bottom, 8 mm across.',
        open: 'Pull the plugs',
        close: 'Plug the holes',
        refill: 'Fill again',
        holes: { low: 'Hole 1 (low)', mid: 'Hole 2 (middle)', high: 'Hole 3 (high)' },
        readouts: { level: 'Water level' },
        sub: {
          hole: (h, p) => `h = ${h} m · p = ${p} Pa`,
          levelTap: 'tap open — level constant',
          levelFall: 'the level is falling',
          levelIdle: 'holes plugged',
        },
        levelLabel: 'Water level (above the bottom)',
        levelHint: 'The higher the level, the deeper the holes are.',
        legend: { wall: 'pressure on the wall', v: 'jet speed v', jet: 'water jet' },
        scene: {
          floorAxis: 'distance from the wall, m',
          levelTag: (h) => `H = ${h} cm`,
          vTag: (v) => `v₁ = ${v} m/s`,
          plugged: 'holes plugged',
          aria: (H, v1, v2, v3) => `A bottle with three holes, water level ${H} cm. Jet speeds from the bottom up: ${v1}, ${v2} and ${v3} m/s.`,
        },
        graph: { title: 'Jet speed against depth v(h)', x: 'h, m', y: 'v, m/s', aria: 'Graph of the jet speed against the depth of the hole' },
        f: {
          p: { tag: 'Pressure at hole 1', general: 'p = ρgh', filled: (h, p) => `= 1000 · 9.8 · ${h} = ${p} Pa` },
          v: { tag: 'Jet speed', general: 'v = √(2gh)', filled: (h, v) => `= √(2 · 9.8 · ${h}) = ${v} m/s` },
        },
        explain: {
          idle: 'The holes are plugged. The water pushes on the walls of the bottle from inside, and this pressure grows with depth (the red arrows on the left). Pull the plugs — from which hole will the water spurt hardest?',
          steady: (v1, v2, v3) =>
            `The lowest hole gives the strongest jet: it is the deepest, so the pressure there is the greatest. Jet speeds ${v1}, ${v2} and ${v3} m/s — v = √(2gh). The tap keeps the level constant, so the jets stay steady.`,
          falling: 'The tap is closed: the water level is falling. As each hole gets shallower, both the pressure and the jet speed fall — the jets land closer and closer to the bottle.',
          drained: 'The level has dropped to the lowest hole — the jets have stopped: no water column is left above the hole, so there is no pressure. Press “Fill again”.',
        },
      },
      dam: {
        levelLabel: 'Water depth',
        pointLabel: 'Depth of the point',
        pointHint: 'You can also drag the point along the face of the dam.',
        legend: { p: 'pressure on the wall', water: 'reservoir', dam: 'dam (concrete)' },
        scene: {
          dam: 'DAM',
          depthAxis: 'h, m',
          pTag: (h, p) => `h = ${h} m: p = ${p} kPa`,
          aria: (H, pb, h, p) => `A dam, water depth ${H} m, pressure at the foot ${pb} kPa. At the point ${h} m deep the pressure is ${p} kPa.`,
        },
        readouts: { H: 'Water depth', base: 'Pressure at the foot', point: 'Pressure at the point', F: 'Force per 1 m of width' },
        sub: {
          H: (h) => `dam height ${h} m`,
          base: (a) => `≈ ${a} atm`,
          point: (h) => `at depth h = ${h} m`,
          F: 'mean pressure ρgH/2 × area H · 1 m',
        },
        f: {
          p: { tag: 'Pressure at the foot', general: 'p = ρgH', filled: (H, pa, kpa) => `= 1000 · 9.8 · ${H} = ${pa} Pa ≈ ${kpa} kPa` },
          F: { tag: 'Pressure force per 1 m of width', general: 'F = ρgH² / 2 · (1 m)', filled: (H, F) => `= 1000 · 9.8 · ${H}² / 2 = ${F}` },
        },
        graph: {
          title: 'Pressure on the dam face p(h)',
          x: 'h, m',
          y: 'p, kPa',
          note: 'The pressure grows linearly with depth. The total force on the dam matches the area of the red triangle — it is proportional to H².',
          aria: 'Graph of the water pressure on the dam face against depth',
        },
        explain: {
          base: (H, p, atm, b, top) =>
            `The water pushes on the dam: at the surface the pressure is zero, it grows linearly with depth and reaches ρgH = ${p} kPa ≈ ${atm} atm at the foot (H = ${H} m). That is why a dam is built thick at the bottom (${b} m) and thin at the top (${top} m).`,
          level: (H, p, F) =>
            `Water depth H = ${H} m: the pressure at the foot is ${p} kPa. Every 1 m of the dam's width takes a force of ${F}. This force is proportional to H²: twice the H gives four times the force.`,
          point: (h, p, kn, t) => `At a depth of h = ${h} m the water presses on the dam with p = ρgh = ${p} kPa: every 1 m² of the wall takes ${kn} kN — about the weight of a ${t} t load!`,
        },
      },
    },
    sea: {
      presetsLabel: 'Where shall we dive?',
      presets: {
        m10: { name: '10 m deep', sub: 'p ≈ 202 kPa ≈ 2 atm', dot: '10 m' },
        diver: { name: 'Diver · 40 m', sub: 'p ≈ 505 kPa ≈ 5 atm', dot: '40 m' },
        sub: { name: 'Submarine · 300 m', sub: 'p ≈ 3.13 MPa ≈ 31 atm', dot: '300 m' },
        trench: { name: 'Mariana Trench · 11 km', sub: 'p ≈ 111 MPa ≈ 1100 atm', dot: '11 km' },
      },
      dive: 'Dive',
      again: 'Dive again',
      surface: 'To the surface',
      vehicles: { diver: 'diver', sub: 'submarine', bathy: 'bathyscaphe' },
      depthLabel: 'Depth',
      depthHint: 'The scale is uneven: metres at the start, kilometres at the end — from 0 to 11 000 m.',
      legend: { p: 'water pressure (from all sides)', atm: 'atmospheric pressure p₀', hatch: 'hatch, S = 1 m²' },
      scene: {
        atm: (p) => `atmospheric pressure p₀ = ${p} kPa`,
        depthAxis: 'h, m',
        atmAxis: 'p, atm',
        pTag: (p) => `p = ${p}`,
        hTag: (h) => `h = ${h} m`,
        trench: 'floor of the Mariana Trench',
        noScale: 'vehicles not drawn to scale',
        speedChip: (f) => `Descent 1 m/s · time sped up ${f} times`,
        aria: (h, p, atm) => `The sea: at a depth of ${h} m the pressure is ${p}, that is ${atm} atm.`,
      },
      readouts: { h: 'Depth', p: 'Total pressure', atm: 'In atmospheres', F: 'Force on a 1 m² hatch' },
      sub: { p: (ph) => `ρgh = ${ph}, plus p₀`, atm: 'every 10 m ≈ +1 atm', F: (t) => `≈ the weight of ${t} t` },
      graph: {
        title: 'Pressure against depth p(h)',
        x: 'h, m',
        yk: 'p, kPa',
        yM: 'p, MPa',
        note: 'The line starts at p₀: there is atmospheric pressure at the surface too. The graph rescales together with the scene.',
        aria: 'Graph of the total pressure in the sea against depth',
      },
      f: {
        p: { tag: 'Total pressure', general: 'p = p₀ + ρgh', filled: (h, ph, p) => `ρgh = 1030 · 9.8 · ${h} = ${ph}  →  p = ${p}` },
        F: { tag: 'Force on a 1 m² hatch (1 atm inside)', general: 'F = (p − p₀)·S = ρghS', filled: (F, t) => `= ${F} ≈ the weight of ${t} t` },
      },
      explain: {
        surface: 'At the surface only the atmospheric pressure acts: p = p₀ ≈ 101.3 kPa = 1 atm. Pick a dive site or press “Dive”.',
        down: (h, p) => `Going down: h = ${h} m, p = ${p}. The taller the water column above us, the greater the pressure — it grows linearly, about 1 atm every 10 m.`,
        up: (h, p) => `Coming up: h = ${h} m. The water column above us is getting shorter — the pressure falls: p = ${p}.`,
        m10: (p, atm) =>
          `At only 10 m the column of sea water gives ρgh ≈ 101 kPa — as much as the whole atmosphere! The total pressure p = p₀ + ρgh = ${p} ≈ ${atm} atm.`,
        diver: (p, atm) =>
          `40 m is the limit for recreational divers. p = p₀ + ρgh = ${p} ≈ ${atm} atm: the water presses on the diver's body from all sides 5 times harder than at the surface. That is why the air from the tank is breathed at the same pressure.`,
        sub: (p, atm, F, t) =>
          `300 m: p = ${p} ≈ ${atm} atm. A 1 m² hatch with 1 atm inside takes F = ρghS = ${F} — the weight of a ${t} t load! That is why a submarine's hull is made of thick steel.`,
        trench: (p, atm, F, t) =>
          `The floor of the Mariana Trench, ≈ 11 km: p = ${p} — ${atm} times the atmospheric pressure! Every 1 m² takes ${F} — the weight of a ${t} t load. Only bathyscaphes with a thick steel sphere have been down here.`,
        free: (h, p, atm, F, t) => `At a depth of h = ${h} m: p = p₀ + ρgh = ${p} ≈ ${atm} atm. A 1 m² hatch takes ${F} — the weight of a ${t} t load.`,
      },
    },
  },
};

/**
 * Lesson "Gidrostatik bosim" (Mechanics of fluids and gases, 2):
 *  1. depth probe: p = ρgh depends only on depth and density, is the same in
 *     all directions and sideways; p = p₀ + ρgh (water 10 m → 98.0 kPa,
 *     kerosene 10 m → 78.4 kPa, sea water 10 m → 100.9 kPa, mercury
 *     0.76 m → 101.3 kPa = p₀);
 *  2. hydrostatic paradox: three vessels, same bottom S = 100 cm², same
 *     h = 30 cm of water → p = 2940 Pa, F = 29.4 N in all three, while the
 *     liquid weighs 29.4 / 86.5 / 9.55 N; wall arrows explain why;
 *  3. pressure on the walls: jets from a bottle (h = 0.30 / 0.20 / 0.10 m →
 *     v = √(2gh) = 2.42 / 1.98 / 1.40 m/s) and a dam (H = 100 m →
 *     ρgH = 980 kPa, 49.0 MN per metre of width);
 *  4. deep sea: p = p₀ + ρgh in sea water — 10 m ≈ 2 atm, diver 40 m ≈
 *     5 atm, submarine 300 m ≈ 3.13 MPa, Mariana Trench 11 km ≈ 111 MPa,
 *     with the force on a 1 m² hatch.
 * g = 9.8 m/s², p₀ = 101 300 Pa. Every word lives in TEXT.
 */
export default function HydrostaticPressure() {
  const T = useSimText(TEXT);
  const tabs = [
    { id: 'probe', ...T.card.tabs.probe, icon: Gauge, render: () => <ProbeSim T={T} /> },
    { id: 'paradox', ...T.card.tabs.paradox, icon: Shapes, render: () => <ParadoxSim T={T} /> },
    { id: 'walls', ...T.card.tabs.walls, icon: BrickWall, render: () => <WallsSim T={T} /> },
    { id: 'sea', ...T.card.tabs.sea, icon: Waves, render: () => <SeaSim T={T} /> },
  ];
  const facts = { title: T.facts.title, items: T.facts.items.map((f) => ({ term: f.term, text: <Rich>{f.text}</Rich> })) };
  return <SimCard eyebrow={T.card.eyebrow} title={T.card.title} tabsLabel={T.card.tabsLabel} tabs={tabs} facts={facts} icon={Gauge} idPrefix="hydro" />;
}
