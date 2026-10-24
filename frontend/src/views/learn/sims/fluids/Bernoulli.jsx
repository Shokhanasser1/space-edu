import { Droplets, Gauge, Plane, Waves } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { useSimText } from '../kit/lang';
import { Rich } from './Bernoulli.parts';
import VenturiSim from './Bernoulli.venturi';
import ContinuitySim from './Bernoulli.continuity';
import AppsSim from './Bernoulli.apps';

/**
 * Lesson "Suyuqlikning quvurlarda oqishi. Bernulli qonuni" (fluids, 6):
 *  1. Venturi tube: a tank (level H = 50 cm) feeds a horizontal pipe with a
 *     narrowing; manometer tubes show h = H − v²/(2g), i.e. p + ρv²/2 = const.
 *     S₁ = 10 cm², S₂ = 5 cm², v₁ = 1 m/s → v₂ = 2 m/s, Δp = 1500 Pa,
 *     Δh = 15.3 cm; a fast enough throat sucks air in (atomizer);
 *  2. continuity: Q = S·v is the same in every section (6 / 2 / 4 cm²,
 *     Q = 0.6 L/s → 1 / 3 / 1.5 m/s), equal-volume slices, and a nozzle
 *     (1 cm² → 6 m/s) throwing the jet L = v·√(2h/g) = 1.92 m from h = 0.5 m;
 *  3. applications: a wing (lift F ≈ Δp·S), two sheets of paper, two boats
 *     and a roof in a storm.
 * Water ρ = 1000 kg/m³, air ρ = 1.2 kg/m³, g = 9.8 m/s². Every word lives here.
 */

const TEXT = {
  uz: {
    cm: 'sm',
    cm2: 'sm²',
    cm3: 'sm³',
    m2: 'm²',
    Pa: 'Pa',
    kN: 'kN',
    kg: 'kg',
    kgm3: 'kg/m³',
    Ls: 'l/s',
    card: {
      eyebrow: 'Virtual laboratoriya · Suyuqlik va gazlar mexanikasi',
      title: 'Suyuqlikning quvurlarda oqishi. Bernulli qonuni',
      tabsLabel: 'Tajribani tanlang',
      tabs: {
        ven: { label: 'Venturi quvuri', sub: 'p + ρv²/2 = const' },
        cont: { label: 'Oqim uzluksizligi', sub: 'S₁v₁ = S₂v₂' },
        apps: { label: "Qo'llanilishi", sub: 'qanot, qayiqlar, tom' },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', reset: 'Qayta' },
    speedLabel: 'Vaqt tezligi',
    speedOpt: { 1: '×1', 0.25: '×¼', 0.1: '×⅒' },
    slowChip: (k) => `Vaqt ${Math.round(1 / k)} marta sekinlashtirilgan`,
    facts: {
      title: 'Eslab qoling',
      items: [
        {
          term: 'Oqim uzluksizligi',
          text: "siqilmaydigan suyuqlik quvurning har bir kesimidan 1 s da bir xil hajmda oqib o'tadi: Q = S·v = const, ya'ni S₁v₁ = S₂v₂. Quvur torayganda oqim tezlashadi.",
        },
        {
          term: 'Bernulli qonuni',
          text: "gorizontal quvurda p + ρv²/2 = const: oqim tez bo'lgan joyda statik bosim p kichik. ρv²/2 — dinamik bosim.",
        },
        {
          term: 'Manometrik naycha',
          text: "quvurga o'rnatilgan ochiq naychadagi suyuqlik ustuni statik bosimni ko'rsatadi: h = p/(ρg). Ustunlar farqi Δh = Δp/(ρg).",
        },
        {
          term: "Qo'llanilishi",
          text: "samolyot qanotining ko'tarish kuchi, purkagich (pulverizator), yaqin suzayotgan kemalarning bir-biriga tortilishi, bo'ronda tomning ko'tarilishi, dush pardasining ichkariga tortilishi.",
        },
      ],
    },
    ven: {
      presetsLabel: 'Tayyor tajribalar',
      presets: {
        main: { name: 'Asosiy misol', sub: 'S₂ = 5 sm² · v₁ = 1 m/s → Δh = 15.3 sm' },
        equal: { name: 'Toraymagan quvur', sub: 'S₂ = S₁ = 10 sm² · Δh = 0' },
        suck: { name: "So'rish (purkagich)", sub: 'v₁ = 1.5 m/s · S₂ = 4 sm²' },
      },
      tapOpen: "Jo'mrakni ochish",
      tapClose: "Jo'mrakni yopish",
      legend: {
        water: 'suv',
        stat: 'statik bosim p (ustun)',
        dyn: 'dinamik bosim ρv²/2',
        v: 'tezlik v',
        total: 'p + ρv²/2 = const',
      },
      scene: {
        thick: "Quvur yo'g'onligi masshtabsiz",
        hAxis: 'h, sm',
        tank: 'bak',
        hTank: (H) => `H = ${H} sm`,
        tapOpen: "jo'mrak ochiq",
        tapClosed: "jo'mrak yopiq",
        dynTag: 'ρv²/2',
        hTag: (s, h) => `h${s} = ${h} sm`,
        dhTag: (d) => `Δh = ${d} sm`,
        suckTag: "p₂ < p₀ — havo so'rilmoqda",
        vTag: (s, v) => `v${s} = ${v} m/s`,
        constTag: 'p + ρv²/2 = const',
        sTag: (a, b) => `S₁ = ${a} sm² → S₂ = ${b} sm²`,
        aria: (v1, v2, h1, h2) =>
          `Venturi quvuri: keng qismda tezlik ${v1} m/s, tor qismda ${v2} m/s. Naychalardagi suv ustunlari ${h1} sm va ${h2} sm.`,
      },
      explain: {
        closed: (H) =>
          `Jo'mrak yopiq — suv oqmayapti (v = 0). Hamma naychalarda suv bak sathida, ${H} sm balandlikda: tinch suyuqlikda bosim faqat chuqurlikka bog'liq (tutash idishlar kabi). «Jo'mrakni ochish»ni bosing.`,
        closing: "Jo'mrak yopilmoqda: oqim sekinlashadi, dinamik bosim kamayadi va naychalardagi ustunlar yana bak sathiga ko'tariladi.",
        opening: "Jo'mrak ochildi: suv tezlashmoqda. Naychalardagi ustunlar pasaymoqda — tezlik ortgan sari statik bosim kamayadi. Tor qismdagi ustun eng ko'p pasayadi.",
        equal: (v, h, d) =>
          `Quvur toraymagan: hamma joyda tezlik bir xil (${v} m/s), shuning uchun naychalardagi ustunlar ham bir xil — ${h} sm. Ular bak sathidan ${d} sm past: bu farq dinamik bosim ρv²/2 ga mos keladi.`,
        flow: (r, v2, dp, dh) =>
          `Tor qismning kesimi ${r} marta kichik — suv u yerda ${r} marta tez oqadi: v₂ = ${v2} m/s. Tezlik katta joyda statik bosim kichik: p₁ − p₂ = ${dp} Pa, shuning uchun 2-naychadagi ustun ${dh} sm past. Ustun + to'q sariq qism = bak sathi: p + ρv²/2 = const.`,
        suck: (v2, p2) =>
          `Tor qismda tezlik juda katta (v₂ = ${v2} m/s): statik bosim atmosfera bosimidan ham past bo'lib qoldi, p₂ − p₀ = ${p2} Pa. Ochiq naycha suvni ushlab turolmaydi — aksincha, tashqaridan havoni so'rib oladi. Purkagich (pulverizator) va suv-oqimli nasos shu tarzda ishlaydi.`,
      },
      readouts: { v1: 'Keng qismda tezlik', v2: 'Tor qismda tezlik', dp: 'Bosimlar farqi', dh: 'Ustunlar farqi' },
      sub: {
        v1: (S, Q) => `S₁ = ${S} sm² · Q = S₁v₁ = ${Q} l/s`,
        v2: (S, r) => `S₂ = ${S} sm² · v₁·S₁/S₂ (${r} marta tez)`,
        dp: 'Δp = ρ(v₂² − v₁²)/2',
        dh: (h1, h2) => `Δh = Δp/(ρg) · h₁ = ${h1} sm, h₂ = ${h2} sm`,
        dhSuck: (h1) => `h₁ = ${h1} sm · 2-naychada ustun yo'q: p₂ < p₀`,
      },
      v1: "Keng qismdagi tezlik (jo'mrak bilan)",
      v1Hint: (Q) => `Hajmiy sarf Q = S₁v₁ = ${Q} l/s`,
      s2: 'Tor qism kesimi',
      s2Hint: (d2, d1) => `Diametri d₂ = ${d2} sm (keng qismda d₁ = ${d1} sm)`,
      info: {
        title: "Bosimlar (atmosfera bosimidan ortig'i)",
        tank: 'Bak sathi H',
        total: "To'liq bosim ρgH",
        p1: 'p₁ − p₀ = ρgh₁',
        p2: 'p₂ − p₀ = ρgh₂',
      },
      graph: {
        title: "Quvur bo'ylab bosim",
        stat: 'statik p',
        dyn: 'dinamik ρv²/2',
        total: 'p + ρv²/2',
        x: 'x, m',
        y: 'p − p₀, Pa',
        note: "Ko'k chiziq — statik bosim, to'q sariq — dinamik bosim. Ularning yig'indisi (oq uzuq chiziq) quvurning hamma joyida bir xil: tor joyda dinamik bosim qancha ortsa, statik bosim shuncha kamayadi.",
        aria: "Quvur bo'ylab statik va dinamik bosim grafigi",
      },
      f: {
        cont: { tag: 'Uzluksizlik', general: 'S₁v₁ = S₂v₂  ⇒  v₂ = v₁·S₁/S₂', filled: (v1, S1, S2, v2) => `= ${v1} · ${S1} / ${S2} = ${v2} m/s` },
        bern: { tag: 'Bernulli qonuni', general: 'p₁ + ρv₁²/2 = p₂ + ρv₂²/2', filled: (v2, v1, dp) => `p₁ − p₂ = 1000 · (${v2}² − ${v1}²)/2 = ${dp} Pa` },
        dh: { tag: 'Ustunlar farqi', general: 'Δh = Δp/(ρg)', filled: (dp, m, cm) => `= ${dp} / (1000 · 9.8) = ${m} m = ${cm} sm` },
      },
    },
    cont: {
      presetsLabel: 'Tayyor tajribalar',
      presets: {
        main: { name: 'Asosiy misol', sub: 'Q = 0.6 l/s · soplo 1 sm² → L = 1.92 m' },
        open: { name: 'Soplosiz', sub: 'uchi 4 sm² → L = 0.48 m' },
        low: { name: 'Kam oqim', sub: 'Q = 0.3 l/s · soplo 1 sm²' },
      },
      legend: {
        water: 'suv',
        band: (dv) => `teng hajmli bo'laklar (${dv} sm³)`,
        v: 'tezlik v',
        jet: 'uchish uzoqligi L',
      },
      scene: {
        thick: "Quvur yo'g'onligi masshtabsiz",
        xAxis: 'm',
        pump: 'nasos',
        LTag: (L) => `L = ${L} m`,
        LTagFar: (L) => `L = ${L} m →`,
        hTag: (h) => `h = ${h} m`,
        STag: (S) => `S = ${S} sm²`,
        vTag: (v) => `v = ${v} m/s`,
        QTag: (Q) => `S·v = ${Q} l/s`,
        noNozzle: "soplo yo'q",
        nozzleTag: (S) => `soplo ${S} sm²`,
        aria: (q, vA, vB, vN, L) =>
          `Quvurda suv oqimi: sarf ${q} l/s. Keng qismda tezlik ${vA} m/s, tor qismda ${vB} m/s, soplodan ${vN} m/s; suv ${L} m uzoqqa tushadi.`,
      },
      explain: {
        paused: (dv, lA, lB) =>
          `To'xtatildi. Rangli bo'laklarni solishtiring: hajmi hammasida bir xil — ΔV = ${dv} sm³, uzunligi esa l = ΔV/S: keng A qismda ${lA} sm, tor B qismda ${lB} sm. Tor joydan suv uzunroq «ustun» bo'lib, tezroq o'tadi.`,
        noNozzle: (v, L) =>
          `Soplo yo'q: suv quvur uchidan ${v} m/s tezlikda chiqadi va atigi ${L} m uzoqqa tushadi. Shlang uchini barmoq bilan qisgandek, soplo kesimini kichraytiring — oqim tezlashadi.`,
        nozzle: (r, vB, dv, vN, L) =>
          `B qismda quvur ${r} marta tor — suv u yerda ${r} marta tez oqadi (${vB} m/s): har bir kesimdan 1 s da bir xil hajm o'tadi. Teng hajmli (${dv} sm³) bo'laklar tor joyda uzun, keng joyda kalta. Soplodan suv ${vN} m/s tezlikda otilib, ${L} m uzoqqa tushadi.`,
      },
      readouts: { q: 'Hajmiy sarf', vB: 'Eng tor qismda', vN: 'Soplodan chiqish', L: 'Uchish uzoqligi' },
      sub: {
        q: 'hamma kesimlarda bir xil: Q = S·v',
        vB: (S, vA) => `S_B = ${S} sm² · A qismda ${vA} m/s`,
        vN: (S) => `v = Q/S, soplo S = ${S} sm²`,
        L: (tf) => `L = v·t, t = √(2h/g) = ${tf} s`,
      },
      q: 'Nasos beradigan sarf',
      qHint: (lpm) => `≈ ${lpm} litr/minut`,
      sn: 'Soplo kesimi',
      snSym: 'S_soplo',
      snHint: "Soplo qancha tor bo'lsa, suv shuncha tez otilib chiqadi.",
      snHintOff: "4 sm² — C qism bilan bir xil: soplo yo'q.",
      info: { title: "Ma'lumotlar", h: 'Quvur balandligi h', dv: "Bir bo'lak hajmi ΔV", dt: "Bir bo'lak o'tish vaqti ΔV/Q" },
      table: {
        title: 'Har bir kesimda Q = S·v',
        sec: 'Kesim',
        names: { A: 'A (keng)', B: 'B (tor)', C: "C (o'rta)", N: 'Soplo' },
        note: "Oxirgi ustun hamma qatorda bir xil: suyuqlik siqilmaydi va quvurda to'planib qolmaydi — qancha kirsa, shuncha chiqadi.",
      },
      f: {
        cont: {
          tag: 'Uzluksizlik',
          general: 'Q = S₁v₁ = S₂v₂',
          filled: (SA, vA, SB, vB, Q) => `${SA} sm² · ${vA} m/s = ${SB} sm² · ${vB} m/s = ${Q} l/s`,
        },
        jet: { tag: 'Suv oqimining uzoqligi', general: 't = √(2h/g),  L = v·t', filled: (tf, v, L) => `t = ${tf} s,  L = ${v} · ${tf} = ${L} m` },
      },
    },
    apps: {
      modesLabel: 'Tajriba',
      modes: {
        wing: { name: 'Samolyot qanoti', sub: "ko'tarish kuchi" },
        paper: { name: "Ikki varaq qog'oz", sub: 'orasiga puflash' },
        boats: { name: 'Ikki qayiq', sub: 'daryoda yonma-yon' },
        roof: { name: "Bo'ronda tom", sub: "shamol tomni ko'taradi" },
      },
      wing: {
        explain: {
          still: "Havo oqmayapti: qanotning ustida ham, ostida ham bosim bir xil — p₀. Ko'tarish kuchi yo'q. Havo tezligini oshiring.",
          base: (vt, vb, dp) =>
            `Qanot ustida havo tezroq (o'rtacha ${vt} m/s), ostida sekinroq (${vb} m/s) — ustida bosim kamroq. Bosimlar farqi Δp ≈ ${dp} Pa qanotni pastdan yuqoriga itaradi.`,
          low: (F, mg) => `F ≈ ${F} kN — samolyot og'irligidan (${mg} kN) kam: u hali ko'tarila olmaydi. Tezlikni yoki hujum burchagini oshiring.`,
          level: (F, mg) => `F ≈ ${F} kN ≈ mg = ${mg} kN: ko'tarish kuchi og'irlikni muvozanatlaydi — samolyot bir xil balandlikda uchadi.`,
          lift: (F, mg) => `F ≈ ${F} kN > mg = ${mg} kN: samolyot yuqoriga ko'tariladi (havoga ko'tarilish paytidagidek).`,
        },
        readouts: { vTop: 'Qanot ustida', vBot: 'Qanot ostida', dp: 'Bosimlar farqi', F: "Ko'tarish kuchi" },
        sym: { vTop: 'v_ust', vBot: 'v_ost' },
        sub: {
          vTop: "o'rtacha tezlik — bosim past",
          vBot: "o'rtacha tezlik — bosim yuqoriroq",
          dp: 'Δp = ρ(v_ust² − v_ost²)/2',
          F: (mg) => `F ≈ Δp·S · og'irlik mg = ${mg} kN`,
        },
        v: 'Havo tezligi (samolyot tezligi)',
        vHint: (k) => `≈ ${k} km/soat`,
        alpha: 'Hujum burchagi',
        alphaHint: "Qanot va havo oqimi orasidagi burchak. Haqiqiy qanotda u ≈ 15° dan oshsa, oqim qanotdan uziladi va ko'tarish kuchi keskin kamayadi.",
        info: {
          title: 'Yengil samolyot',
          S: 'Qanotlar yuzi S',
          m: 'Massasi m',
          mg: "Og'irligi mg",
          rho: 'Havo zichligi ρ (20 °C)',
          q: 'Dinamik bosim ρv²/2',
        },
        graph: {
          title: 'Qanot ustida va ostida bosim',
          top: 'ustida',
          bot: 'ostida',
          diff: 'farq Δp',
          x: "x, m (vatar bo'ylab)",
          y: 'p − p₀, Pa',
          note: "Ko'k chiziq — qanot ustidagi bosim (p₀ dan past), qizil — ostidagi. Ular orasidagi sohaning o'rtacha balandligi Δp ga teng; Δp·S — ko'tarish kuchining oddiy bahosi. Old qirra yonida ustki bosim ayniqsa past.",
          aria: "Qanot ustidagi va ostidagi bosimning vatar bo'ylab grafigi",
        },
        f: {
          dp: { tag: 'Bosimlar farqi', general: 'Δp = ρ(v_ust² − v_ost²)/2', filled: (vt, vb, dp) => `= 1.2 · (${vt}² − ${vb}²)/2 ≈ ${dp} Pa` },
          F: { tag: "Ko'tarish kuchi (oddiy baho)", general: 'F ≈ Δp·S', filled: (dp, S, F, c, mg) => `= ${dp} · ${S} ≈ ${F} kN ${c} mg = ${mg} kN` },
        },
        legend: { p: 'bosim: p₀ dan past ↔ yuqori', lines: 'oqim chiziqlari', F: "ko'tarish kuchi F", mg: "samolyot og'irligi mg" },
        scene: {
          chord: (c) => `qanot vatari ${c} m`,
          alphaTag: (a) => `α = ${a}°`,
          vTag: (v) => `v = ${v} m/s`,
          top: (v) => `ustida: v ≈ ${v} m/s — bosim past`,
          bot: (v) => `ostida: v ≈ ${v} m/s — bosim yuqoriroq`,
          mgTag: (m) => `mg = ${m} kN`,
          FTag: (F) => `F ≈ ${F} kN`,
          scale: 'p − p₀, Pa',
          aria: (v, a, vt, vb, F) =>
            `Havo oqimidagi qanot: tezlik ${v} m/s, hujum burchagi ${a}°. Ustida o'rtacha tezlik ${vt} m/s, ostida ${vb} m/s. Ko'tarish kuchi taxminan ${F} kN.`,
        },
      },
      paper: {
        explain: {
          still: "Puflamayapsiz: varaqlarning ikki tomonida ham havo tinch, bosim bir xil — p₀. Varaqlar tik osilib turadi.",
          blow: (v, dp, pct) =>
            `Varaqlar orasida havo ${v} m/s tezlikda oqmoqda — u yerda bosim p₀ dan ρv²/2 = ${dp} Pa ga kam (atigi ${pct} %). Shu kichik farq yetarli: tashqaridagi tinch havo varaqlarni bir-biriga itaradi — ular ajralmaydi, aksincha yaqinlashadi!`,
        },
        legend: { air: 'puflangan havo', push: 'tashqi havoning itarishi (bosimlar farqi)' },
        scene: {
          slow: (n) => `Havo harakati ${n} marta sekinlashtirilgan`,
          aria: (v, dp) => `Ikki varaq qog'oz orasiga ${v} m/s tezlikda havo puflanmoqda; orada bosim ${dp} Pa ga kam.`,
          straw: 'naycha',
          p0: 'p₀',
          inside: (dp) => `orada: p = p₀ − ${dp} Pa`,
          insideStill: 'orada: p = p₀',
        },
        readouts: { v: 'Havo tezligi', dp: 'Bosim kamayishi', pct: 'p₀ ga nisbatan' },
        sub: { v: 'varaqlar orasida', dp: 'Δp = ρv²/2', pct: (p0) => `p₀ = ${p0} Pa` },
        v: 'Puflash tezligi',
        vHint: 'Odam taxminan 5–15 m/s tezlikda puflay oladi.',
        info: { title: "Ma'lumotlar", rho: 'Havo zichligi ρ', p0: 'Atmosfera bosimi p₀', gap: 'Varaqlar orasi (tepada)' },
        f: {
          dp: { tag: 'Bernulli qonuni', general: 'p₀ = p + ρv²/2  ⇒  Δp = ρv²/2', filled: (v, dp) => `= 1.2 · ${v}² / 2 = ${dp} Pa` },
          why: { tag: 'Nega yaqinlashadi?', general: 'tashqarida p₀  >  orada p', filled: 'Bosimlar farqi varaqlarni oqim tomonga — bir-biriga itaradi.' },
        },
        note: "Uyda sinab ko'ring: ikki varaq qog'ozni bir-biridan 4–5 sm uzoqlikda ushlab, orasiga puflang. Dush pardasi ham shu sababli ichkariga — suv oqimi tomonga tortiladi.",
      },
      boats: {
        explain: {
          still: 'Daryo oqmayapti: qayiqlar atrofida suv tinch, ikki tomondan bosim bir xil — qayiqlar joyida turadi.',
          moving: (vg, dp) =>
            `Qayiqlar orasidagi suv tor «kanal»dan o'tadi — u yerda tezroq oqadi (≈ ${vg} m/s), bosimi esa ≈ ${dp} Pa ga kam. Tashqaridagi suvning bosimi qayiqlarni bir-biriga itaradi. Shuning uchun kemalarning bir-biriga yaqin, yonma-yon suzishi xavfli.`,
          touched: "Qayiqlar bir-biriga tegib qoldi! Tashqi suvning bosimi ularni oqim tez bo'lgan oraliq tomonga itardi. «Qayta» tugmasi bilan yana boshlang.",
        },
        legend: { water: 'daryo suvi', push: 'tashqi suvning itarishi', v: 'oqim tezligi' },
        scene: {
          top: "Yuqoridan ko'rinish · vaqt real",
          aria: (v, b, vg) => `Daryoda yonma-yon turgan ikki qayiq. Oqim ${v} m/s, oraliq ${b} m, oraliqda suv tezligi taxminan ${vg} m/s.`,
          vTag: (v) => `v = ${v} m/s`,
          gapTag: (v) => `orada ≈ ${v} m/s`,
          p0: 'p₀ (tashqarida)',
          bTag: (b) => `b = ${b} m`,
        },
        readouts: { v: 'Daryo oqimi', vGap: 'Qayiqlar orasida', dp: 'Bosimlar farqi', b: 'Oraliq' },
        sym: { vGap: 'v_or' },
        sub: {
          v: 'qayiqlardan uzoqda',
          vGap: "taxminan, S·v = const bo'yicha",
          dp: 'taxminan: ρ(v_or² − v²)/2',
          b: (b0) => `boshida ${b0} m`,
        },
        v: 'Daryo oqimining tezligi',
        b: 'Qayiqlar orasidagi masofa',
        bHint: (B) => `Qayiqlarning eni B = ${B} m.`,
        f: {
          cont: { tag: 'Uzluksizlik (oddiy model)', general: 'v_or ≈ v·(b + B)/b', filled: (v, b, B, vg) => `= ${v} · (${b} + ${B}) / ${b} ≈ ${vg} m/s` },
          dp: { tag: 'Bernulli qonuni', general: 'Δp = ρ(v_or² − v²)/2', filled: (vg, v, dp) => `= 1000 · (${vg}² − ${v}²)/2 ≈ ${dp} Pa` },
        },
        note: "Model soddalashtirilgan: qayiq tumshuqlari orasidagi (b + B kenglikdagi) suv hammasi b kenglikdagi oraliqdan o'tadi deb olindi. Haqiqatda suv qayiqlar ostidan ham o'tadi, farq kichikroq bo'ladi — lekin yo'nalishi shu: qayiqlar bir-biriga tortiladi.",
      },
      roof: {
        explain: {
          calm: "Shamol yo'q: tomning ustida ham, uy ichida ham havo tinch — bosim bir xil. Shamol tezligini oshiring.",
          hold: (dp, F, mg) =>
            `Shamol tom ustidan tez o'tadi — u yerda bosim kamayadi, uy ichida esa havo tinch (p₀). Bosimlar farqi Δp ≈ ${dp} Pa tomni yuqoriga itaradi: F ≈ ${F} kN. Bu tomning og'irligidan (${mg} kN) kam — tom o'z joyida turibdi.`,
          lift: (dp, F, mg) =>
            `Bo'ron! Δp ≈ ${dp} Pa, ko'taruvchi kuch F ≈ ${F} kN tomning og'irligidan (${mg} kN) katta — mahkamlanmagan tomni shamol ko'tarib ketadi. Shuning uchun tomlar devorga mahkam biriktiriladi.`,
        },
        legend: { wind: 'shamol (oqim chiziqlari)', push: 'bosimlar farqining itarishi', mg: "tomning og'irligi mg" },
        scene: {
          aria: (v, F, mg) => `Bo'ronda uy: shamol tezligi ${v} m/s, tomga ko'taruvchi kuch taxminan ${F} kN, tomning og'irligi ${mg} kN.`,
          inside: 'ichkarida p₀',
          FTag: (F) => `F ≈ ${F} kN`,
          mgTag: (m) => `mg = ${m} kN`,
          vTag: (v) => `v = ${v} m/s`,
          above: (dp) => `tom ustida: p ≈ p₀ − ${dp} Pa`,
          lifting: "tom ko'tarilmoqda!",
        },
        readouts: { v: 'Shamol tezligi', dp: 'Bosimlar farqi', F: "Tomga ko'taruvchi kuch" },
        sub: {
          v: (k) => `≈ ${k} km/soat`,
          dp: 'Δp ≈ ρv²/2 (taxminiy)',
          F: (mg) => `F ≈ Δp·S · tom og'irligi ${mg} kN`,
        },
        v: 'Shamol tezligi',
        vHint: (k) => `≈ ${k} km/soat · 20 m/s dan kuchlisi — shtorm, 33 m/s dan kuchlisi — bo'ron`,
        info: { title: 'Uy tomi', S: 'Tom yuzi S', m: 'Tom massasi m', mg: "Og'irligi mg", vc: "Tom ko'tariladigan tezlik" },
        f: {
          dp: { tag: 'Bernulli qonuni (taxminan)', general: 'Δp ≈ ρv²/2', filled: (v, dp) => `= 1.2 · ${v}² / 2 ≈ ${dp} Pa` },
          F: { tag: "Ko'taruvchi kuch", general: 'F ≈ Δp·S', filled: (dp, S, F, c, mg) => `= ${dp} · ${S} ≈ ${F} kN ${c} mg = ${mg} kN` },
        },
        note: "Oddiy baho: tom ustidagi havo shamol tezligida oqadi, uy ichida esa tinch deb olindi. Haqiqiy farq tomning shakli va qiyaligiga ham bog'liq.",
      },
    },
  },

  ru: {
    cm: 'см',
    cm2: 'см²',
    cm3: 'см³',
    m2: 'м²',
    Pa: 'Па',
    kN: 'кН',
    kg: 'кг',
    kgm3: 'кг/м³',
    Ls: 'л/с',
    card: {
      eyebrow: 'Виртуальная лаборатория · Механика жидкостей и газов',
      title: 'Течение жидкости по трубам. Закон Бернулли',
      tabsLabel: 'Выберите опыт',
      tabs: {
        ven: { label: 'Трубка Вентури', sub: 'p + ρv²/2 = const' },
        cont: { label: 'Неразрывность', sub: 'S₁v₁ = S₂v₂' },
        apps: { label: 'Применения', sub: 'крыло, лодки, крыша' },
      },
    },
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', reset: 'Сброс' },
    speedLabel: 'Скорость времени',
    speedOpt: { 1: '×1', 0.25: '×¼', 0.1: '×⅒' },
    slowChip: (k) => `Время замедлено в ${Math.round(1 / k)} раз${[2, 3, 4].includes(Math.round(1 / k) % 10) && ![12, 13, 14].includes(Math.round(1 / k) % 100) ? 'а' : ''}`,
    facts: {
      title: 'Запомните',
      items: [
        {
          term: 'Неразрывность струи',
          text: 'несжимаемая жидкость за 1 с проходит через любое сечение трубы в одинаковом объёме: Q = S·v = const, то есть S₁v₁ = S₂v₂. В сужении поток ускоряется.',
        },
        {
          term: 'Закон Бернулли',
          text: 'в горизонтальной трубе p + ρv²/2 = const: где скорость больше, там статическое давление p меньше. ρv²/2 — динамическое давление.',
        },
        {
          term: 'Манометрическая трубка',
          text: 'столб жидкости в открытой трубке на трубе показывает статическое давление: h = p/(ρg). Разность столбов Δh = Δp/(ρg).',
        },
        {
          term: 'Применения',
          text: 'подъёмная сила крыла самолёта, пульверизатор, притяжение близко идущих судов, срыв крыши ураганом, втягивание шторки душа внутрь.',
        },
      ],
    },
    ven: {
      presetsLabel: 'Готовые опыты',
      presets: {
        main: { name: 'Основной пример', sub: 'S₂ = 5 см² · v₁ = 1 м/с → Δh = 15,3 см' },
        equal: { name: 'Труба без сужения', sub: 'S₂ = S₁ = 10 см² · Δh = 0' },
        suck: { name: 'Подсос (пульверизатор)', sub: 'v₁ = 1,5 м/с · S₂ = 4 см²' },
      },
      tapOpen: 'Открыть кран',
      tapClose: 'Закрыть кран',
      legend: {
        water: 'вода',
        stat: 'статическое давление p (столб)',
        dyn: 'динамическое давление ρv²/2',
        v: 'скорость v',
        total: 'p + ρv²/2 = const',
      },
      scene: {
        thick: 'Толщина трубы не в масштабе',
        hAxis: 'h, см',
        tank: 'бак',
        hTank: (H) => `H = ${H} см`,
        tapOpen: 'кран открыт',
        tapClosed: 'кран закрыт',
        dynTag: 'ρv²/2',
        hTag: (s, h) => `h${s} = ${h} см`,
        dhTag: (d) => `Δh = ${d} см`,
        suckTag: 'p₂ < p₀ — засасывается воздух',
        vTag: (s, v) => `v${s} = ${v} м/с`,
        constTag: 'p + ρv²/2 = const',
        sTag: (a, b) => `S₁ = ${a} см² → S₂ = ${b} см²`,
        aria: (v1, v2, h1, h2) => `Трубка Вентури: скорость в широкой части ${v1} м/с, в узкой ${v2} м/с. Столбы воды в трубках ${h1} см и ${h2} см.`,
      },
      explain: {
        closed: (H) =>
          `Кран закрыт — вода не течёт (v = 0). Во всех трубках вода стоит на уровне бака, ${H} см: в покоящейся жидкости давление зависит только от глубины (как в сообщающихся сосудах). Нажмите «Открыть кран».`,
        closing: 'Кран закрывается: поток замедляется, динамическое давление уменьшается, и столбы в трубках снова поднимаются до уровня бака.',
        opening: 'Кран открыт: вода разгоняется. Столбы в трубках опускаются — чем больше скорость, тем меньше статическое давление. Сильнее всего опускается столб над сужением.',
        equal: (v, h, d) =>
          `Труба без сужения: скорость везде одинакова (${v} м/с), поэтому и столбы в трубках одинаковы — ${h} см. Они на ${d} см ниже уровня бака: эта разница соответствует динамическому давлению ρv²/2.`,
        flow: (r, v2, dp, dh) =>
          `Сечение сужения в ${r} раза меньше — вода там течёт в ${r} раза быстрее: v₂ = ${v2} м/с. Где скорость больше, статическое давление меньше: p₁ − p₂ = ${dp} Па, поэтому столб во 2-й трубке на ${dh} см ниже. Столб + оранжевая часть = уровень бака: p + ρv²/2 = const.`,
        suck: (v2, p2) =>
          `Скорость в сужении очень велика (v₂ = ${v2} м/с): статическое давление стало ниже атмосферного, p₂ − p₀ = ${p2} Па. Открытая трубка не удерживает воду — наоборот, засасывает воздух снаружи. Так работают пульверизатор и водоструйный насос.`,
      },
      readouts: { v1: 'Скорость в широкой части', v2: 'Скорость в сужении', dp: 'Разность давлений', dh: 'Разность столбов' },
      sub: {
        v1: (S, Q) => `S₁ = ${S} см² · Q = S₁v₁ = ${Q} л/с`,
        v2: (S, r) => `S₂ = ${S} см² · v₁·S₁/S₂ (в ${r} раза быстрее)`,
        dp: 'Δp = ρ(v₂² − v₁²)/2',
        dh: (h1, h2) => `Δh = Δp/(ρg) · h₁ = ${h1} см, h₂ = ${h2} см`,
        dhSuck: (h1) => `h₁ = ${h1} см · во 2-й трубке столба нет: p₂ < p₀`,
      },
      v1: 'Скорость в широкой части (краном)',
      v1Hint: (Q) => `Расход Q = S₁v₁ = ${Q} л/с`,
      s2: 'Сечение сужения',
      s2Hint: (d2, d1) => `Диаметр d₂ = ${d2} см (в широкой части d₁ = ${d1} см)`,
      info: {
        title: 'Давления (избыток над атмосферным)',
        tank: 'Уровень в баке H',
        total: 'Полное давление ρgH',
        p1: 'p₁ − p₀ = ρgh₁',
        p2: 'p₂ − p₀ = ρgh₂',
      },
      graph: {
        title: 'Давление вдоль трубы',
        stat: 'статическое p',
        dyn: 'динамическое ρv²/2',
        total: 'p + ρv²/2',
        x: 'x, м',
        y: 'p − p₀, Па',
        note: 'Синяя линия — статическое давление, оранжевая — динамическое. Их сумма (белый пунктир) одинакова по всей трубе: насколько в сужении растёт динамическое давление, настолько падает статическое.',
        aria: 'График статического и динамического давления вдоль трубы',
      },
      f: {
        cont: { tag: 'Неразрывность', general: 'S₁v₁ = S₂v₂  ⇒  v₂ = v₁·S₁/S₂', filled: (v1, S1, S2, v2) => `= ${v1} · ${S1} / ${S2} = ${v2} м/с` },
        bern: { tag: 'Закон Бернулли', general: 'p₁ + ρv₁²/2 = p₂ + ρv₂²/2', filled: (v2, v1, dp) => `p₁ − p₂ = 1000 · (${v2}² − ${v1}²)/2 = ${dp} Па` },
        dh: { tag: 'Разность столбов', general: 'Δh = Δp/(ρg)', filled: (dp, m, cm) => `= ${dp} / (1000 · 9,8) = ${m} м = ${cm} см` },
      },
    },
    cont: {
      presetsLabel: 'Готовые опыты',
      presets: {
        main: { name: 'Основной пример', sub: 'Q = 0,6 л/с · сопло 1 см² → L = 1,92 м' },
        open: { name: 'Без сопла', sub: 'конец 4 см² → L = 0,48 м' },
        low: { name: 'Малый расход', sub: 'Q = 0,3 л/с · сопло 1 см²' },
      },
      legend: {
        water: 'вода',
        band: (dv) => `порции равного объёма (${dv} см³)`,
        v: 'скорость v',
        jet: 'дальность струи L',
      },
      scene: {
        thick: 'Толщина трубы не в масштабе',
        xAxis: 'м',
        pump: 'насос',
        LTag: (L) => `L = ${L} м`,
        LTagFar: (L) => `L = ${L} м →`,
        hTag: (h) => `h = ${h} м`,
        STag: (S) => `S = ${S} см²`,
        vTag: (v) => `v = ${v} м/с`,
        QTag: (Q) => `S·v = ${Q} л/с`,
        noNozzle: 'сопла нет',
        nozzleTag: (S) => `сопло ${S} см²`,
        aria: (q, vA, vB, vN, L) =>
          `Течение воды по трубе: расход ${q} л/с. Скорость в широкой части ${vA} м/с, в узкой ${vB} м/с, из сопла ${vN} м/с; вода падает на расстоянии ${L} м.`,
      },
      explain: {
        paused: (dv, lA, lB) =>
          `Пауза. Сравните цветные порции: объём у всех одинаков — ΔV = ${dv} см³, а длина l = ΔV/S: в широкой части A ${lA} см, в узкой B ${lB} см. Через сужение вода проходит более длинным «столбиком» — быстрее.`,
        noNozzle: (v, L) =>
          `Сопла нет: вода выходит из трубы со скоростью ${v} м/с и падает всего в ${L} м. Уменьшите сечение сопла — как будто зажимаете конец шланга пальцем, — и струя ускорится.`,
        nozzle: (r, vB, dv, vN, L) =>
          `В части B труба в ${r} раза уже — вода там течёт в ${r} раза быстрее (${vB} м/с): через каждое сечение за 1 с проходит одинаковый объём. Порции равного объёма (${dv} см³) в узком месте длинные, в широком — короткие. Из сопла вода вылетает со скоростью ${vN} м/с и падает в ${L} м.`,
      },
      readouts: { q: 'Объёмный расход', vB: 'В самом узком месте', vN: 'Скорость из сопла', L: 'Дальность струи' },
      sub: {
        q: 'одинаков во всех сечениях: Q = S·v',
        vB: (S, vA) => `S_B = ${S} см² · в части A ${vA} м/с`,
        vN: (S) => `v = Q/S, сопло S = ${S} см²`,
        L: (tf) => `L = v·t, t = √(2h/g) = ${tf} с`,
      },
      q: 'Расход, который даёт насос',
      qHint: (lpm) => `≈ ${lpm} литров в минуту`,
      sn: 'Сечение сопла',
      snSym: 'S_сопла',
      snHint: 'Чем уже сопло, тем быстрее вылетает вода.',
      snHintOff: '4 см² — как часть C: сопла нет.',
      info: { title: 'Данные', h: 'Высота трубы h', dv: 'Объём одной порции ΔV', dt: 'Время прохода порции ΔV/Q' },
      table: {
        title: 'Q = S·v в каждом сечении',
        sec: 'Сечение',
        names: { A: 'A (широкое)', B: 'B (узкое)', C: 'C (среднее)', N: 'Сопло' },
        note: 'Последний столбец одинаков во всех строках: жидкость не сжимается и не скапливается в трубе — сколько втекает, столько и вытекает.',
      },
      f: {
        cont: {
          tag: 'Неразрывность',
          general: 'Q = S₁v₁ = S₂v₂',
          filled: (SA, vA, SB, vB, Q) => `${SA} см² · ${vA} м/с = ${SB} см² · ${vB} м/с = ${Q} л/с`,
        },
        jet: { tag: 'Дальность струи', general: 't = √(2h/g),  L = v·t', filled: (tf, v, L) => `t = ${tf} с,  L = ${v} · ${tf} = ${L} м` },
      },
    },
    apps: {
      modesLabel: 'Опыт',
      modes: {
        wing: { name: 'Крыло самолёта', sub: 'подъёмная сила' },
        paper: { name: 'Два листа бумаги', sub: 'дуем между ними' },
        boats: { name: 'Две лодки', sub: 'рядом на реке' },
        roof: { name: 'Крыша в ураган', sub: 'ветер срывает крышу' },
      },
      wing: {
        explain: {
          still: 'Воздух не движется: над крылом и под ним давление одинаково — p₀. Подъёмной силы нет. Увеличьте скорость воздуха.',
          base: (vt, vb, dp) =>
            `Над крылом воздух движется быстрее (в среднем ${vt} м/с), под крылом медленнее (${vb} м/с) — давление сверху меньше. Разность давлений Δp ≈ ${dp} Па толкает крыло снизу вверх.`,
          low: (F, mg) => `F ≈ ${F} кН — меньше веса самолёта (${mg} кН): он ещё не может взлететь. Увеличьте скорость или угол атаки.`,
          level: (F, mg) => `F ≈ ${F} кН ≈ mg = ${mg} кН: подъёмная сила уравновешивает вес — самолёт летит на одной высоте.`,
          lift: (F, mg) => `F ≈ ${F} кН > mg = ${mg} кН: самолёт поднимается вверх (как при взлёте).`,
        },
        readouts: { vTop: 'Над крылом', vBot: 'Под крылом', dp: 'Разность давлений', F: 'Подъёмная сила' },
        sym: { vTop: 'v_верх', vBot: 'v_низ' },
        sub: {
          vTop: 'средняя скорость — давление ниже',
          vBot: 'средняя скорость — давление выше',
          dp: 'Δp = ρ(v_верх² − v_низ²)/2',
          F: (mg) => `F ≈ Δp·S · вес mg = ${mg} кН`,
        },
        v: 'Скорость воздуха (скорость самолёта)',
        vHint: (k) => `≈ ${k} км/ч`,
        alpha: 'Угол атаки',
        alphaHint: 'Угол между крылом и потоком воздуха. У настоящего крыла при угле больше ≈ 15° поток срывается и подъёмная сила резко падает.',
        info: {
          title: 'Лёгкий самолёт',
          S: 'Площадь крыльев S',
          m: 'Масса m',
          mg: 'Вес mg',
          rho: 'Плотность воздуха ρ (20 °C)',
          q: 'Динамическое давление ρv²/2',
        },
        graph: {
          title: 'Давление над крылом и под ним',
          top: 'сверху',
          bot: 'снизу',
          diff: 'разность Δp',
          x: 'x, м (вдоль хорды)',
          y: 'p − p₀, Па',
          note: 'Синяя линия — давление над крылом (ниже p₀), красная — под крылом. Средняя высота области между ними равна Δp; Δp·S — простая оценка подъёмной силы. У передней кромки давление сверху особенно низкое.',
          aria: 'График давления над крылом и под ним вдоль хорды',
        },
        f: {
          dp: { tag: 'Разность давлений', general: 'Δp = ρ(v_верх² − v_низ²)/2', filled: (vt, vb, dp) => `= 1,2 · (${vt}² − ${vb}²)/2 ≈ ${dp} Па` },
          F: { tag: 'Подъёмная сила (простая оценка)', general: 'F ≈ Δp·S', filled: (dp, S, F, c, mg) => `= ${dp} · ${S} ≈ ${F} кН ${c} mg = ${mg} кН` },
        },
        legend: { p: 'давление: ниже p₀ ↔ выше', lines: 'линии тока', F: 'подъёмная сила F', mg: 'вес самолёта mg' },
        scene: {
          chord: (c) => `хорда крыла ${c} м`,
          alphaTag: (a) => `α = ${a}°`,
          vTag: (v) => `v = ${v} м/с`,
          top: (v) => `сверху: v ≈ ${v} м/с — давление ниже`,
          bot: (v) => `снизу: v ≈ ${v} м/с — давление выше`,
          mgTag: (m) => `mg = ${m} кН`,
          FTag: (F) => `F ≈ ${F} кН`,
          scale: 'p − p₀, Па',
          aria: (v, a, vt, vb, F) =>
            `Крыло в потоке воздуха: скорость ${v} м/с, угол атаки ${a}°. Средняя скорость сверху ${vt} м/с, снизу ${vb} м/с. Подъёмная сила около ${F} кН.`,
        },
      },
      paper: {
        explain: {
          still: 'Вы не дуете: с обеих сторон листов воздух неподвижен, давление одинаково — p₀. Листы висят вертикально.',
          blow: (v, dp, pct) =>
            `Между листами воздух течёт со скоростью ${v} м/с — там давление на ρv²/2 = ${dp} Па меньше p₀ (всего ${pct} %). Этой малой разницы достаточно: неподвижный воздух снаружи прижимает листы друг к другу — они не разлетаются, а сближаются!`,
        },
        legend: { air: 'выдуваемый воздух', push: 'давление наружного воздуха (разность давлений)' },
        scene: {
          slow: (n) => `Движение воздуха замедлено в ${n} раз`,
          aria: (v, dp) => `Между двумя листами бумаги дуют со скоростью ${v} м/с; давление между ними меньше на ${dp} Па.`,
          straw: 'трубочка',
          p0: 'p₀',
          inside: (dp) => `между: p = p₀ − ${dp} Па`,
          insideStill: 'между: p = p₀',
        },
        readouts: { v: 'Скорость воздуха', dp: 'Понижение давления', pct: 'Доля от p₀' },
        sub: { v: 'между листами', dp: 'Δp = ρv²/2', pct: (p0) => `p₀ = ${p0} Па` },
        v: 'Скорость выдуваемого воздуха',
        vHint: 'Человек может дуть со скоростью примерно 5–15 м/с.',
        info: { title: 'Данные', rho: 'Плотность воздуха ρ', p0: 'Атмосферное давление p₀', gap: 'Зазор между листами (вверху)' },
        f: {
          dp: { tag: 'Закон Бернулли', general: 'p₀ = p + ρv²/2  ⇒  Δp = ρv²/2', filled: (v, dp) => `= 1,2 · ${v}² / 2 = ${dp} Па` },
          why: { tag: 'Почему сближаются?', general: 'снаружи p₀  >  между p', filled: 'Разность давлений прижимает листы к потоку — друг к другу.' },
        },
        note: 'Попробуйте дома: держите два листа бумаги на расстоянии 4–5 см и подуйте между ними. По той же причине шторку душа втягивает внутрь — к струям воды.',
      },
      boats: {
        explain: {
          still: 'Река не течёт: вода вокруг лодок неподвижна, давление с обеих сторон одинаково — лодки стоят на месте.',
          moving: (vg, dp) =>
            `Вода между лодками проходит по узкому «каналу» — там она течёт быстрее (≈ ${vg} м/с), а давление на ≈ ${dp} Па меньше. Давление воды снаружи прижимает лодки друг к другу. Поэтому судам опасно идти близко борт о борт.`,
          touched: 'Лодки столкнулись! Давление воды снаружи прижало их к промежутку, где поток быстрее. Нажмите «Сброс», чтобы начать снова.',
        },
        legend: { water: 'речная вода', push: 'давление наружной воды', v: 'скорость течения' },
        scene: {
          top: 'Вид сверху · реальное время',
          aria: (v, b, vg) => `Две лодки рядом на реке. Течение ${v} м/с, промежуток ${b} м, скорость воды в промежутке около ${vg} м/с.`,
          vTag: (v) => `v = ${v} м/с`,
          gapTag: (v) => `между ≈ ${v} м/с`,
          p0: 'p₀ (снаружи)',
          bTag: (b) => `b = ${b} м`,
        },
        readouts: { v: 'Течение реки', vGap: 'Между лодками', dp: 'Разность давлений', b: 'Промежуток' },
        sym: { vGap: 'v_пр' },
        sub: {
          v: 'вдали от лодок',
          vGap: 'примерно, по S·v = const',
          dp: 'примерно: ρ(v_пр² − v²)/2',
          b: (b0) => `сначала ${b0} м`,
        },
        v: 'Скорость течения реки',
        b: 'Расстояние между лодками',
        bHint: (B) => `Ширина лодок B = ${B} м.`,
        f: {
          cont: { tag: 'Неразрывность (простая модель)', general: 'v_пр ≈ v·(b + B)/b', filled: (v, b, B, vg) => `= ${v} · (${b} + ${B}) / ${b} ≈ ${vg} м/с` },
          dp: { tag: 'Закон Бернулли', general: 'Δp = ρ(v_пр² − v²)/2', filled: (vg, v, dp) => `= 1000 · (${vg}² − ${v}²)/2 ≈ ${dp} Па` },
        },
        note: 'Модель упрощена: считается, что вся вода между носами лодок (полоса шириной b + B) проходит через промежуток шириной b. На самом деле часть воды уходит под лодки, и разница меньше — но направление то же: лодки притягиваются.',
      },
      roof: {
        explain: {
          calm: 'Ветра нет: и над крышей, и в доме воздух неподвижен — давление одинаково. Увеличьте скорость ветра.',
          hold: (dp, F, mg) =>
            `Ветер быстро обтекает крышу — над ней давление понижается, а в доме воздух неподвижен (p₀). Разность давлений Δp ≈ ${dp} Па толкает крышу вверх: F ≈ ${F} кН. Это меньше веса крыши (${mg} кН) — крыша держится.`,
          lift: (dp, F, mg) =>
            `Ураган! Δp ≈ ${dp} Па, сила F ≈ ${F} кН больше веса крыши (${mg} кН) — незакреплённую крышу ветер поднимает и срывает. Поэтому крыши прочно крепят к стенам.`,
        },
        legend: { wind: 'ветер (линии тока)', push: 'давление снизу (разность давлений)', mg: 'вес крыши mg' },
        scene: {
          aria: (v, F, mg) => `Дом в ураган: скорость ветра ${v} м/с, сила, поднимающая крышу, около ${F} кН, вес крыши ${mg} кН.`,
          inside: 'внутри p₀',
          FTag: (F) => `F ≈ ${F} кН`,
          mgTag: (m) => `mg = ${m} кН`,
          vTag: (v) => `v = ${v} м/с`,
          above: (dp) => `над крышей: p ≈ p₀ − ${dp} Па`,
          lifting: 'крышу поднимает!',
        },
        readouts: { v: 'Скорость ветра', dp: 'Разность давлений', F: 'Сила, поднимающая крышу' },
        sub: {
          v: (k) => `≈ ${k} км/ч`,
          dp: 'Δp ≈ ρv²/2 (оценка)',
          F: (mg) => `F ≈ Δp·S · вес крыши ${mg} кН`,
        },
        v: 'Скорость ветра',
        vHint: (k) => `≈ ${k} км/ч · больше 20 м/с — шторм, больше 33 м/с — ураган`,
        info: { title: 'Крыша дома', S: 'Площадь крыши S', m: 'Масса крыши m', mg: 'Вес mg', vc: 'Скорость, при которой крышу поднимает' },
        f: {
          dp: { tag: 'Закон Бернулли (оценка)', general: 'Δp ≈ ρv²/2', filled: (v, dp) => `= 1,2 · ${v}² / 2 ≈ ${dp} Па` },
          F: { tag: 'Подъёмная сила', general: 'F ≈ Δp·S', filled: (dp, S, F, c, mg) => `= ${dp} · ${S} ≈ ${F} кН ${c} mg = ${mg} кН` },
        },
        note: 'Простая оценка: воздух над крышей движется со скоростью ветра, а в доме неподвижен. На самом деле разность зависит ещё от формы и наклона крыши.',
      },
    },
  },

  en: {
    cm: 'cm',
    cm2: 'cm²',
    cm3: 'cm³',
    m2: 'm²',
    Pa: 'Pa',
    kN: 'kN',
    kg: 'kg',
    kgm3: 'kg/m³',
    Ls: 'L/s',
    card: {
      eyebrow: 'Virtual laboratory · Mechanics of fluids and gases',
      title: "Flow of liquids in a pipe. Bernoulli's law",
      tabsLabel: 'Choose an experiment',
      tabs: {
        ven: { label: 'Venturi tube', sub: 'p + ρv²/2 = const' },
        cont: { label: 'Continuity', sub: 'S₁v₁ = S₂v₂' },
        apps: { label: 'Applications', sub: 'wing, boats, roof' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', reset: 'Reset' },
    speedLabel: 'Time speed',
    speedOpt: { 1: '×1', 0.25: '×¼', 0.1: '×⅒' },
    slowChip: (k) => `Time slowed down ${Math.round(1 / k)}×`,
    facts: {
      title: 'Remember',
      items: [
        {
          term: 'Continuity',
          text: 'an incompressible liquid passes every cross-section of a pipe at the same volume per second: Q = S·v = const, i.e. S₁v₁ = S₂v₂. Where the pipe narrows, the flow speeds up.',
        },
        {
          term: "Bernoulli's law",
          text: 'in a horizontal pipe p + ρv²/2 = const: where the flow is faster, the static pressure p is lower. ρv²/2 is the dynamic pressure.',
        },
        {
          term: 'Manometer tube',
          text: 'the liquid column in an open tube on the pipe shows the static pressure: h = p/(ρg). The difference of the columns is Δh = Δp/(ρg).',
        },
        {
          term: 'Applications',
          text: 'lift of an aircraft wing, the spray bottle (atomizer), ships drawn together when passing close, roofs lifted in storms, the shower curtain pulled inwards.',
        },
      ],
    },
    ven: {
      presetsLabel: 'Ready-made experiments',
      presets: {
        main: { name: 'Main example', sub: 'S₂ = 5 cm² · v₁ = 1 m/s → Δh = 15.3 cm' },
        equal: { name: 'No narrowing', sub: 'S₂ = S₁ = 10 cm² · Δh = 0' },
        suck: { name: 'Suction (atomizer)', sub: 'v₁ = 1.5 m/s · S₂ = 4 cm²' },
      },
      tapOpen: 'Open the tap',
      tapClose: 'Close the tap',
      legend: {
        water: 'water',
        stat: 'static pressure p (column)',
        dyn: 'dynamic pressure ρv²/2',
        v: 'velocity v',
        total: 'p + ρv²/2 = const',
      },
      scene: {
        thick: 'Pipe thickness not to scale',
        hAxis: 'h, cm',
        tank: 'tank',
        hTank: (H) => `H = ${H} cm`,
        tapOpen: 'tap open',
        tapClosed: 'tap closed',
        dynTag: 'ρv²/2',
        hTag: (s, h) => `h${s} = ${h} cm`,
        dhTag: (d) => `Δh = ${d} cm`,
        suckTag: 'p₂ < p₀ — air is sucked in',
        vTag: (s, v) => `v${s} = ${v} m/s`,
        constTag: 'p + ρv²/2 = const',
        sTag: (a, b) => `S₁ = ${a} cm² → S₂ = ${b} cm²`,
        aria: (v1, v2, h1, h2) => `Venturi tube: speed ${v1} m/s in the wide part, ${v2} m/s in the narrow part. Water columns in the tubes ${h1} cm and ${h2} cm.`,
      },
      explain: {
        closed: (H) =>
          `The tap is closed — the water does not flow (v = 0). In every tube the water stands at the tank level, ${H} cm: in a liquid at rest the pressure depends only on depth (as in communicating vessels). Press "Open the tap".`,
        closing: 'The tap is closing: the flow slows down, the dynamic pressure falls and the columns rise back to the tank level.',
        opening: 'The tap is open: the water speeds up. The columns in the tubes go down — the faster the flow, the lower the static pressure. The column over the narrow part drops the most.',
        equal: (v, h, d) =>
          `No narrowing: the speed is the same everywhere (${v} m/s), so the columns are equal too — ${h} cm. They stand ${d} cm below the tank level: that difference matches the dynamic pressure ρv²/2.`,
        flow: (r, v2, dp, dh) =>
          `The narrow part has a ${r} times smaller cross-section, so the water flows ${r} times faster there: v₂ = ${v2} m/s. Where the speed is higher the static pressure is lower: p₁ − p₂ = ${dp} Pa, so the column in tube 2 is ${dh} cm lower. Column + orange part = tank level: p + ρv²/2 = const.`,
        suck: (v2, p2) =>
          `The speed in the narrow part is very high (v₂ = ${v2} m/s): the static pressure has fallen below atmospheric, p₂ − p₀ = ${p2} Pa. The open tube cannot hold water — instead it sucks air in from outside. This is how a spray bottle and a water-jet pump work.`,
      },
      readouts: { v1: 'Speed, wide part', v2: 'Speed, narrow part', dp: 'Pressure difference', dh: 'Column difference' },
      sub: {
        v1: (S, Q) => `S₁ = ${S} cm² · Q = S₁v₁ = ${Q} L/s`,
        v2: (S, r) => `S₂ = ${S} cm² · v₁·S₁/S₂ (${r}× faster)`,
        dp: 'Δp = ρ(v₂² − v₁²)/2',
        dh: (h1, h2) => `Δh = Δp/(ρg) · h₁ = ${h1} cm, h₂ = ${h2} cm`,
        dhSuck: (h1) => `h₁ = ${h1} cm · no column in tube 2: p₂ < p₀`,
      },
      v1: 'Speed in the wide part (set by the tap)',
      v1Hint: (Q) => `Volume flow rate Q = S₁v₁ = ${Q} L/s`,
      s2: 'Cross-section of the narrow part',
      s2Hint: (d2, d1) => `Diameter d₂ = ${d2} cm (wide part d₁ = ${d1} cm)`,
      info: {
        title: 'Pressures (above atmospheric)',
        tank: 'Tank level H',
        total: 'Total pressure ρgH',
        p1: 'p₁ − p₀ = ρgh₁',
        p2: 'p₂ − p₀ = ρgh₂',
      },
      graph: {
        title: 'Pressure along the pipe',
        stat: 'static p',
        dyn: 'dynamic ρv²/2',
        total: 'p + ρv²/2',
        x: 'x, m',
        y: 'p − p₀, Pa',
        note: 'Blue line — static pressure, orange — dynamic pressure. Their sum (white dashed line) is the same all along the pipe: as much as the dynamic pressure rises in the narrow part, the static pressure falls.',
        aria: 'Graph of static and dynamic pressure along the pipe',
      },
      f: {
        cont: { tag: 'Continuity', general: 'S₁v₁ = S₂v₂  ⇒  v₂ = v₁·S₁/S₂', filled: (v1, S1, S2, v2) => `= ${v1} · ${S1} / ${S2} = ${v2} m/s` },
        bern: { tag: "Bernoulli's law", general: 'p₁ + ρv₁²/2 = p₂ + ρv₂²/2', filled: (v2, v1, dp) => `p₁ − p₂ = 1000 · (${v2}² − ${v1}²)/2 = ${dp} Pa` },
        dh: { tag: 'Column difference', general: 'Δh = Δp/(ρg)', filled: (dp, m, cm) => `= ${dp} / (1000 · 9.8) = ${m} m = ${cm} cm` },
      },
    },
    cont: {
      presetsLabel: 'Ready-made experiments',
      presets: {
        main: { name: 'Main example', sub: 'Q = 0.6 L/s · nozzle 1 cm² → L = 1.92 m' },
        open: { name: 'No nozzle', sub: 'outlet 4 cm² → L = 0.48 m' },
        low: { name: 'Low flow', sub: 'Q = 0.3 L/s · nozzle 1 cm²' },
      },
      legend: {
        water: 'water',
        band: (dv) => `slices of equal volume (${dv} cm³)`,
        v: 'velocity v',
        jet: 'jet range L',
      },
      scene: {
        thick: 'Pipe thickness not to scale',
        xAxis: 'm',
        pump: 'pump',
        LTag: (L) => `L = ${L} m`,
        LTagFar: (L) => `L = ${L} m →`,
        hTag: (h) => `h = ${h} m`,
        STag: (S) => `S = ${S} cm²`,
        vTag: (v) => `v = ${v} m/s`,
        QTag: (Q) => `S·v = ${Q} L/s`,
        noNozzle: 'no nozzle',
        nozzleTag: (S) => `nozzle ${S} cm²`,
        aria: (q, vA, vB, vN, L) =>
          `Water flowing through a pipe: flow rate ${q} L/s. Speed ${vA} m/s in the wide part, ${vB} m/s in the narrow part, ${vN} m/s out of the nozzle; the water lands ${L} m away.`,
      },
      explain: {
        paused: (dv, lA, lB) =>
          `Paused. Compare the shaded slices: they all have the same volume, ΔV = ${dv} cm³, but the length l = ΔV/S: ${lA} cm in the wide part A, ${lB} cm in the narrow part B. Through the narrow part the water passes as a longer "column" — faster.`,
        noNozzle: (v, L) =>
          `No nozzle: the water leaves the pipe at ${v} m/s and lands only ${L} m away. Make the nozzle smaller — like squeezing the end of a hose with your finger — and the jet speeds up.`,
        nozzle: (r, vB, dv, vN, L) =>
          `In part B the pipe is ${r} times narrower, so the water flows ${r} times faster there (${vB} m/s): every cross-section passes the same volume per second. Slices of equal volume (${dv} cm³) are long in the narrow part and short in the wide part. The water shoots out of the nozzle at ${vN} m/s and lands ${L} m away.`,
      },
      readouts: { q: 'Volume flow rate', vB: 'In the narrowest part', vN: 'Out of the nozzle', L: 'Jet range' },
      sub: {
        q: 'the same in every section: Q = S·v',
        vB: (S, vA) => `S_B = ${S} cm² · part A ${vA} m/s`,
        vN: (S) => `v = Q/S, nozzle S = ${S} cm²`,
        L: (tf) => `L = v·t, t = √(2h/g) = ${tf} s`,
      },
      q: 'Flow rate of the pump',
      qHint: (lpm) => `≈ ${lpm} litres per minute`,
      sn: 'Nozzle cross-section',
      snSym: 'S_nozzle',
      snHint: 'The narrower the nozzle, the faster the water shoots out.',
      snHintOff: '4 cm² — the same as part C: no nozzle.',
      info: { title: 'Data', h: 'Height of the pipe h', dv: 'Volume of one slice ΔV', dt: 'Time for one slice ΔV/Q' },
      table: {
        title: 'Q = S·v in every section',
        sec: 'Section',
        names: { A: 'A (wide)', B: 'B (narrow)', C: 'C (medium)', N: 'Nozzle' },
        note: 'The last column is the same in every row: the liquid does not compress and does not pile up in the pipe — as much flows out as flows in.',
      },
      f: {
        cont: {
          tag: 'Continuity',
          general: 'Q = S₁v₁ = S₂v₂',
          filled: (SA, vA, SB, vB, Q) => `${SA} cm² · ${vA} m/s = ${SB} cm² · ${vB} m/s = ${Q} L/s`,
        },
        jet: { tag: 'Range of the jet', general: 't = √(2h/g),  L = v·t', filled: (tf, v, L) => `t = ${tf} s,  L = ${v} · ${tf} = ${L} m` },
      },
    },
    apps: {
      modesLabel: 'Experiment',
      modes: {
        wing: { name: 'Aircraft wing', sub: 'lift' },
        paper: { name: 'Two sheets of paper', sub: 'blow between them' },
        boats: { name: 'Two boats', sub: 'side by side on a river' },
        roof: { name: 'Roof in a storm', sub: 'the wind lifts the roof' },
      },
      wing: {
        explain: {
          still: 'The air is still: the pressure above and below the wing is the same — p₀. There is no lift. Increase the air speed.',
          base: (vt, vb, dp) =>
            `Above the wing the air moves faster (on average ${vt} m/s), below it slower (${vb} m/s) — the pressure on top is lower. The pressure difference Δp ≈ ${dp} Pa pushes the wing upwards.`,
          low: (F, mg) => `F ≈ ${F} kN — less than the weight of the plane (${mg} kN): it cannot take off yet. Increase the speed or the angle of attack.`,
          level: (F, mg) => `F ≈ ${F} kN ≈ mg = ${mg} kN: the lift balances the weight — the plane flies at a constant height.`,
          lift: (F, mg) => `F ≈ ${F} kN > mg = ${mg} kN: the plane climbs (as on take-off).`,
        },
        readouts: { vTop: 'Above the wing', vBot: 'Below the wing', dp: 'Pressure difference', F: 'Lift' },
        sym: { vTop: 'v_top', vBot: 'v_bottom' },
        sub: {
          vTop: 'mean speed — pressure lower',
          vBot: 'mean speed — pressure higher',
          dp: 'Δp = ρ(v_top² − v_bottom²)/2',
          F: (mg) => `F ≈ Δp·S · weight mg = ${mg} kN`,
        },
        v: 'Air speed (speed of the plane)',
        vHint: (k) => `≈ ${k} km/h`,
        alpha: 'Angle of attack',
        alphaHint: 'The angle between the wing and the air stream. On a real wing, above ≈ 15° the flow separates from the wing and the lift drops sharply.',
        info: {
          title: 'Light aircraft',
          S: 'Wing area S',
          m: 'Mass m',
          mg: 'Weight mg',
          rho: 'Air density ρ (20 °C)',
          q: 'Dynamic pressure ρv²/2',
        },
        graph: {
          title: 'Pressure above and below the wing',
          top: 'above',
          bot: 'below',
          diff: 'difference Δp',
          x: 'x, m (along the chord)',
          y: 'p − p₀, Pa',
          note: 'Blue line — pressure above the wing (below p₀), red — below the wing. The mean height of the area between them equals Δp; Δp·S is a simple estimate of the lift. Near the leading edge the pressure on top is especially low.',
          aria: 'Graph of the pressure above and below the wing along the chord',
        },
        f: {
          dp: { tag: 'Pressure difference', general: 'Δp = ρ(v_top² − v_bottom²)/2', filled: (vt, vb, dp) => `= 1.2 · (${vt}² − ${vb}²)/2 ≈ ${dp} Pa` },
          F: { tag: 'Lift (simple estimate)', general: 'F ≈ Δp·S', filled: (dp, S, F, c, mg) => `= ${dp} · ${S} ≈ ${F} kN ${c} mg = ${mg} kN` },
        },
        legend: { p: 'pressure: below p₀ ↔ above', lines: 'streamlines', F: 'lift F', mg: 'weight of the plane mg' },
        scene: {
          chord: (c) => `wing chord ${c} m`,
          alphaTag: (a) => `α = ${a}°`,
          vTag: (v) => `v = ${v} m/s`,
          top: (v) => `above: v ≈ ${v} m/s — lower pressure`,
          bot: (v) => `below: v ≈ ${v} m/s — higher pressure`,
          mgTag: (m) => `mg = ${m} kN`,
          FTag: (F) => `F ≈ ${F} kN`,
          scale: 'p − p₀, Pa',
          aria: (v, a, vt, vb, F) =>
            `A wing in an air stream: speed ${v} m/s, angle of attack ${a}°. Mean speed ${vt} m/s above, ${vb} m/s below. Lift about ${F} kN.`,
        },
      },
      paper: {
        explain: {
          still: 'You are not blowing: the air on both sides of the sheets is still and the pressure is the same — p₀. The sheets hang straight down.',
          blow: (v, dp, pct) =>
            `Between the sheets the air flows at ${v} m/s — there the pressure is lower than p₀ by ρv²/2 = ${dp} Pa (only ${pct} %). That small difference is enough: the still air outside pushes the sheets towards each other — they do not fly apart, they come together!`,
        },
        legend: { air: 'blown air', push: 'push of the outside air (pressure difference)' },
        scene: {
          slow: (n) => `Air motion slowed down ${n}×`,
          aria: (v, dp) => `Air is blown at ${v} m/s between two sheets of paper; between them the pressure is lower by ${dp} Pa.`,
          straw: 'straw',
          p0: 'p₀',
          inside: (dp) => `between: p = p₀ − ${dp} Pa`,
          insideStill: 'between: p = p₀',
        },
        readouts: { v: 'Air speed', dp: 'Pressure drop', pct: 'Share of p₀' },
        sub: { v: 'between the sheets', dp: 'Δp = ρv²/2', pct: (p0) => `p₀ = ${p0} Pa` },
        v: 'Speed of the blown air',
        vHint: 'A person can blow at roughly 5–15 m/s.',
        info: { title: 'Data', rho: 'Air density ρ', p0: 'Atmospheric pressure p₀', gap: 'Gap between the sheets (top)' },
        f: {
          dp: { tag: "Bernoulli's law", general: 'p₀ = p + ρv²/2  ⇒  Δp = ρv²/2', filled: (v, dp) => `= 1.2 · ${v}² / 2 = ${dp} Pa` },
          why: { tag: 'Why do they come together?', general: 'outside p₀  >  between p', filled: 'The pressure difference pushes the sheets into the stream — towards each other.' },
        },
        note: 'Try it at home: hold two sheets of paper 4–5 cm apart and blow between them. For the same reason a shower curtain is pulled inwards, towards the stream of water.',
      },
      boats: {
        explain: {
          still: 'The river is not flowing: the water around the boats is still, the pressure on both sides is the same — the boats stay where they are.',
          moving: (vg, dp) =>
            `The water between the boats passes through a narrow "channel" — there it flows faster (≈ ${vg} m/s) and its pressure is ≈ ${dp} Pa lower. The pressure of the water outside pushes the boats towards each other. That is why it is dangerous for ships to sail close side by side.`,
          touched: 'The boats have bumped into each other! The outside water pushed them towards the gap where the flow is faster. Press "Reset" to start again.',
        },
        legend: { water: 'river water', push: 'push of the outside water', v: 'flow velocity' },
        scene: {
          top: 'Top view · real time',
          aria: (v, b, vg) => `Two boats side by side on a river. Current ${v} m/s, gap ${b} m, water speed in the gap about ${vg} m/s.`,
          vTag: (v) => `v = ${v} m/s`,
          gapTag: (v) => `between ≈ ${v} m/s`,
          p0: 'p₀ (outside)',
          bTag: (b) => `b = ${b} m`,
        },
        readouts: { v: 'River current', vGap: 'Between the boats', dp: 'Pressure difference', b: 'Gap' },
        sym: { vGap: 'v_gap' },
        sub: {
          v: 'far from the boats',
          vGap: 'estimate from S·v = const',
          dp: 'estimate: ρ(v_gap² − v²)/2',
          b: (b0) => `at first ${b0} m`,
        },
        v: 'Speed of the river current',
        b: 'Distance between the boats',
        bHint: (B) => `Width of each boat B = ${B} m.`,
        f: {
          cont: { tag: 'Continuity (simple model)', general: 'v_gap ≈ v·(b + B)/b', filled: (v, b, B, vg) => `= ${v} · (${b} + ${B}) / ${b} ≈ ${vg} m/s` },
          dp: { tag: "Bernoulli's law", general: 'Δp = ρ(v_gap² − v²)/2', filled: (vg, v, dp) => `= 1000 · (${vg}² − ${v}²)/2 ≈ ${dp} Pa` },
        },
        note: 'A simplified model: all the water between the bows (a strip b + B wide) is taken to pass through the gap b wide. In reality some water also flows under the boats, so the difference is smaller — but the direction is the same: the boats are drawn together.',
      },
      roof: {
        explain: {
          calm: 'No wind: the air above the roof and inside the house is still — the pressure is the same. Increase the wind speed.',
          hold: (dp, F, mg) =>
            `The wind rushes over the roof — the pressure there drops, while the air inside the house is still (p₀). The pressure difference Δp ≈ ${dp} Pa pushes the roof up: F ≈ ${F} kN. That is less than the weight of the roof (${mg} kN) — the roof stays on.`,
          lift: (dp, F, mg) =>
            `A storm! Δp ≈ ${dp} Pa, the upward force F ≈ ${F} kN exceeds the weight of the roof (${mg} kN) — the wind lifts an unfastened roof and carries it off. That is why roofs are firmly fixed to the walls.`,
        },
        legend: { wind: 'wind (streamlines)', push: 'push of the pressure difference', mg: 'weight of the roof mg' },
        scene: {
          aria: (v, F, mg) => `A house in a storm: wind speed ${v} m/s, upward force on the roof about ${F} kN, weight of the roof ${mg} kN.`,
          inside: 'inside p₀',
          FTag: (F) => `F ≈ ${F} kN`,
          mgTag: (m) => `mg = ${m} kN`,
          vTag: (v) => `v = ${v} m/s`,
          above: (dp) => `above the roof: p ≈ p₀ − ${dp} Pa`,
          lifting: 'the roof is lifting!',
        },
        readouts: { v: 'Wind speed', dp: 'Pressure difference', F: 'Upward force on the roof' },
        sub: {
          v: (k) => `≈ ${k} km/h`,
          dp: 'Δp ≈ ρv²/2 (estimate)',
          F: (mg) => `F ≈ Δp·S · weight of the roof ${mg} kN`,
        },
        v: 'Wind speed',
        vHint: (k) => `≈ ${k} km/h · above 20 m/s — a gale, above 33 m/s — a hurricane`,
        info: { title: 'Roof of the house', S: 'Roof area S', m: 'Mass of the roof m', mg: 'Weight mg', vc: 'Speed that lifts the roof' },
        f: {
          dp: { tag: "Bernoulli's law (estimate)", general: 'Δp ≈ ρv²/2', filled: (v, dp) => `= 1.2 · ${v}² / 2 ≈ ${dp} Pa` },
          F: { tag: 'Upward force', general: 'F ≈ Δp·S', filled: (dp, S, F, c, mg) => `= ${dp} · ${S} ≈ ${F} kN ${c} mg = ${mg} kN` },
        },
        note: 'A simple estimate: the air above the roof moves at the wind speed and the air inside is still. The real difference also depends on the shape and slope of the roof.',
      },
    },
  },
};

export default function Bernoulli() {
  const T = useSimText(TEXT);
  const tabs = [
    { id: 'ven', ...T.card.tabs.ven, icon: Gauge, render: () => <VenturiSim T={T} /> },
    { id: 'cont', ...T.card.tabs.cont, icon: Waves, render: () => <ContinuitySim T={T} /> },
    { id: 'apps', ...T.card.tabs.apps, icon: Plane, render: () => <AppsSim T={T} /> },
  ];
  const facts = { title: T.facts.title, items: T.facts.items.map((f) => ({ term: f.term, text: <Rich>{f.text}</Rich> })) };
  return <SimCard eyebrow={T.card.eyebrow} title={T.card.title} tabsLabel={T.card.tabsLabel} tabs={tabs} facts={facts} icon={Droplets} idPrefix="bern" />;
}
