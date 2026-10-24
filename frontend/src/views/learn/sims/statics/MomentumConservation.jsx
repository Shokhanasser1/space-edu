import { ArrowLeftRight, CircleDot, Orbit, Rocket } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { useSimText } from '../kit/lang';
import CollideSim from './MomentumConservation.collide';
import CradleSim from './MomentumConservation.cradle';
import RecoilSim from './MomentumConservation.recoil';
import PucksSim from './MomentumConservation.pucks';

/**
 * Lesson "Law of conservation of momentum" (Impulsning saqlanish qonuni).
 *
 *   collide - two carts on a smooth track with springy (elastic) or sticky
 *             (perfectly inelastic) bumpers: p₁ + p₂ is the same before and
 *             after; kinetic energy is kept only in the elastic case.
 *   cradle  - Newton's cradle: k balls in, k balls out (the only outcome that
 *             keeps both momentum and energy); with plasticine all five go.
 *   recoil  - from rest: spring carts, rifle and bullet, astronaut and wrench,
 *             spaceship engine - m₁v₁ = −m₂v₂, the centre of mass stays put.
 *   pucks   - a 2D collision of two pucks with the momentum vectors added
 *             tip to tail before and after (equal masses part at 90°).
 *
 * Every word on screen comes from TEXT; "_x" in a scene label is a subscript.
 */

const SUB = ['₀', '₁', '₂'];
const ruTimes = (k) => (k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 12 || k % 100 > 14) ? 'раза' : 'раз');
/** «раз» / «раза» after a formatted number: 2 раза, 50 раз, 1,5 раза. */
const ruTimesS = (s) => {
  const n = Number(String(s).replace(',', '.').replace(/\s/g, ''));
  return Number.isInteger(n) ? ruTimes(n) : 'раза';
};

const TEXT = {
  uz: {
    u: { kg: 'kg', g: 'g', cm: 'sm', kgms: 'kg·m/s', J: 'J', N: 'N' },
    common: {
      start: 'Boshlash',
      pause: "To'xtatish",
      resume: 'Davom etish',
      again: 'Yana boshlash',
      reset: 'Qayta',
      realTime: 'Real vaqt',
      slow: (k) => `Vaqt ${k} marta sekinlashtirilgan`,
      slowShort: (k) => `Vaqt ${k}× sekin`,
      fast: (k) => `Vaqt ${k} marta tezlashtirilgan`,
      fastShort: (k) => `Vaqt ${k}× tez`,
    },
    card: {
      eyebrow: 'Virtual laboratoriya · Statika',
      title: 'Impulsning saqlanish qonuni',
      tabsLabel: 'Simulyatorni tanlang',
      tabs: {
        collide: { label: "To'qnashuv", sub: 'elastik va noelastik' },
        cradle: { label: 'Nyuton beshigi', sub: 'n kiradi — n chiqadi' },
        recoil: { label: 'Reaktiv harakat', sub: 'tinchlikdan: Σp = 0' },
        pucks: { label: 'Tekislikda', sub: 'impuls — vektor' },
      },
    },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: 'Jism impulsi', text: "p = m·v — vektor kattalik, yo'nalishi tezlik bilan bir xil; birligi kg·m/s." },
        {
          term: 'Saqlanish qonuni',
          text: "berk sistemada jismlar impulslarining vektor yig'indisi o'zgarmaydi: m₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′.",
        },
        {
          term: "To'qnashuvlar",
          text: "elastik to'qnashuvda impuls ham, kinetik energiya ham saqlanadi; noelastikda jismlar birga harakatlanadi va Eₖ ning bir qismi issiqlikka aylanadi.",
        },
        { term: 'Reaktiv harakat', text: "jismdan bir qismi otilib chiqsa, qolgan qismi teskari tomonga harakatlanadi: m₁v₁ = −m₂v₂." },
      ],
    },
    collide: {
      presetsLabel: 'Tajriba',
      presets: {
        swap: { name: 'Teng massalar · elastik', sub: '1 kg + 1 kg · 2 m/s' },
        stick: { name: 'Teng massalar · yopishadi', sub: '1 kg + 1 kg · 2 m/s' },
        heavy: { name: "Og'ir yengilga uriladi", sub: '3 kg → 1 kg · 2 m/s' },
        light: { name: "Yengil og'irga uriladi", sub: '1 kg → 4 kg · 2.5 m/s' },
      },
      bumperLabel: 'Bamperlar',
      bumpers: {
        elastic: { name: 'Prujinali', sub: "elastik to'qnashuv" },
        sticky: { name: 'Yopishqoq', sub: "noelastik to'qnashuv" },
      },
      m1: '1-aravacha massasi',
      m2: '2-aravacha massasi',
      v1: '1-aravacha tezligi',
      v2: '2-aravacha tezligi',
      massHint: "Bo'sh aravacha 0.5 kg, har bir yuk 0.5 kg",
      vHint: "Musbat — o'ngga, manfiy — chapga. Yo'l silliq, ishqalanish yo'q.",
      closed: {
        title: 'Nega sistema berk?',
        text: "Har bir aravachaga og'irlik kuchi mg (pastga) va tayanch reaksiya kuchi N (yuqoriga) ta'sir qiladi — ular muvozanatlashgan, ishqalanish yo'q. Gorizontal yo'nalishda faqat aravachalarning bir-biriga ta'siri qoladi; bu ichki kuchlar umumiy impulsni o'zgartira olmaydi.",
      },
      axis: 'x, m',
      legend: { cart1: '1-aravacha', cart2: '2-aravacha', vel: 'tezlik v', force: "o'zaro ta'sir kuchlari", cm: 'massa markazi' },
      chipHit: "To'qnashuv: vaqt 20 marta sekinlashtirilgan",
      phase: { before: "to'qnashuvgacha", hit: "to'qnashuv", after: "to'qnashuvdan keyin" },
      mTag: (i, m, kg) => `m_${i} = ${m} ${kg}`,
      vTag: (sym, v, ms) => `${sym} = ${v} ${ms}`,
      cmTag: (v) => `massa markazi · ${v} m/s`,
      sceneLabel: (m1, v1, m2, v2, p) =>
        `Silliq yo'ldagi ikki aravacha: m₁ = ${m1}, v₁ = ${v1} m/s; m₂ = ${m2}, v₂ = ${v2} m/s. Umumiy impuls ${p} kg·m/s.`,
      readouts: {
        p1: '1-aravacha impulsi',
        p2: '2-aravacha impulsi',
        sum: 'Umumiy impuls',
        ek: 'Kinetik energiya',
        pSub: (i, m, v, ms) => `p${SUB[i]} = m${SUB[i]}v${SUB[i]} = ${m} · ${v} ${ms}`,
        sumSub: (p) => `boshida ${p} — o'zgarmaydi`,
        ekBefore: (e) => `boshida ${e} J`,
        ekSpring: (e) => `prujinada vaqtincha ${e} J`,
        ekHeat: (q) => `issiqlikka aylandi: ${q} J`,
        ekKept: (e) => `saqlandi: boshida ham ${e} J`,
        ekLost: (q, pct) => `yo'qoldi: ${q} J (${pct} %)`,
      },
      chart: {
        title: 'Impuls vektorlari',
        before: "to'qnashuvgacha",
        now: 'hozir',
        after: "to'qnashuvdan keyin",
        note: "O'ngga yo'nalgan impuls musbat, chapga — manfiy. Σp ning ikkala strelkasi doim bir xil: umumiy impuls saqlanadi.",
        label: (p1, p2, q1, q2, p) =>
          `Impulslar: to'qnashuvgacha p₁ = ${p1}, p₂ = ${p2}; hozir p₁ = ${q1}, p₂ = ${q2} kg·m/s. Umumiy impuls ${p} kg·m/s.`,
      },
      calc: {
        title: 'Hisoblash',
        note: "v₁, v₂ — to'qnashuvgacha, v₁′, v₂′ — to'qnashuvdan keyingi tezliklar; o'ngga yo'nalish musbat.",
        noteApart: "Aravachalar to'qnashmaydi — har birining impulsi o'zgarmaydi.",
      },
      energy: {
        title: 'Energiya',
        ek: 'kinetik',
        ep: 'prujina',
        q: 'issiqlik',
        e: "to'liq",
        level: (e) => `E = ${e} J`,
        noteElastic: "To'qnashuv paytida Eₖ ning bir qismi siqilgan prujinalarda to'planadi, keyin to'liq qaytadi.",
        noteSticky: "Yopishqoq bamperlar ezilib qiziydi: yo'qolgan Eₖ issiqlik miqdori Q ga aylanadi. To'liq energiya E baribir saqlanadi.",
        label: (ek, ep, q) => `Energiya: kinetik ${ek} J, prujinada ${ep} J, issiqlik ${q} J.`,
      },
      graph: {
        title: 'Impulslar p(t)',
        x: 't, s',
        y: 'p, kg·m/s',
        note: "To'qnashuv paytida p₁ qancha kamaysa, p₂ shuncha ortadi; p₁ + p₂ chizig'i gorizontal — umumiy impuls o'zgarmaydi.",
        label: "Aravachalar impulsining vaqtga bog'liqlik grafigi",
      },
      explain: {
        idle: (p) =>
          `«Boshlash»ni bosing. Yo'l silliq: og'irlik kuchi tayanch reaksiyasi bilan muvozanatlashgan, ishqalanish yo'q — ikki aravacha berk sistema. Umumiy impuls p = m₁v₁ + m₂v₂ = ${p} kg·m/s. To'qnashuvdan keyin u qancha bo'larkin?`,
        apart: (p) =>
          `v₁ ≤ v₂ — aravachalar bir-biriga yaqinlashmaydi, to'qnashuv bo'lmaydi. Har bir aravacha o'z impulsini saqlaydi, umumiy impuls ${p} kg·m/s. To'qnashishi uchun v₁ > v₂ bo'lsin.`,
        before: (p, v) =>
          `To'qnashuvgacha aravachalarga gorizontal kuch ta'sir qilmaydi — tezliklar o'zgarmaydi. Umumiy impuls p = ${p} kg·m/s. Massa markazi (◆) v = p/(m₁ + m₂) = ${v} m/s tezlik bilan tekis harakatlanadi.`,
        hitElastic:
          "To'qnashuv! Prujinalar siqilmoqda: aravachalar bir-biriga teng va qarama-qarshi kuchlar bilan ta'sir qiladi (F₁₂ = −F₂₁). Bir aravacha qancha impuls yo'qotsa, ikkinchisi shuncha oladi — p₁ + p₂ o'zgarmaydi.",
        hitSticky:
          "To'qnashuv! Yopishqoq bamperlar ezilib, bir-biriga yopishmoqda. Kuchlar teng va qarama-qarshi — impuls bir aravachadan ikkinchisiga o'tadi, yig'indisi o'zgarmaydi. Kinetik energiya esa issiqlikka aylanmoqda.",
        doneSwap: (v1, v2) =>
          `Teng massali aravachalar tezliklarini almashdi: v₁′ = ${v1} m/s, v₂′ = ${v2} m/s. Elastik to'qnashuvda impuls ham, kinetik energiya ham saqlanadi.`,
        doneRebound: (v1, v2, p) =>
          `Yengil aravacha og'irroq aravachaga urilib orqaga qaytdi: v₁′ = ${v1} m/s, v₂′ = ${v2} m/s. 1-aravacha impulsining ishorasi o'zgardi, umumiy impuls esa baribir ${p} kg·m/s.`,
        doneHeavy: (v1, v2, p, e) =>
          `Og'ir aravacha to'xtamay, sekinroq davom etdi (v₁′ = ${v1} m/s), yengili esa undan tezroq uchib ketdi (v₂′ = ${v2} m/s). Umumiy impuls ${p} kg·m/s, kinetik energiya ${e} J — ikkalasi ham saqlandi.`,
        doneElastic: (p, e) =>
          `Elastik to'qnashuv: umumiy impuls oldin ham, keyin ham ${p} kg·m/s; kinetik energiya ham ${e} J ligicha qoldi — prujinalar energiyani to'liq qaytardi.`,
        doneSticky: (v, e0, e1, q, pct) =>
          `Noelastik to'qnashuv: aravachalar yopishib, birga v′ = ${v} m/s tezlik bilan ketdi. Impuls saqlandi, kinetik energiya esa ${e0} J dan ${e1} J gacha kamaydi: ${q} J (${pct} %) issiqlikka aylandi.`,
        doneStop: (e0) =>
          `Impulslar teng va qarama-qarshi edi — umumiy impuls 0. Yopishgandan keyin ikkala aravacha to'xtadi: impuls 0 bo'lib qoldi, butun kinetik energiya (${e0} J) esa issiqlikka aylandi.`,
      },
    },
    cradle: {
      countLabel: "Ko'tarilgan sharchalar",
      count: (n) => `${n} ta sharcha`,
      countSub: (n) => (n === 1 ? 'chetdagi bittasi' : `chetdagi ${n} tasi birga`),
      release: "Qo'yib yuborish",
      hitsChip: (n) => `zarbalar: ${n}`,
      sceneLabel: (k, h, v, hits) =>
        `Nyuton beshigi: 5 ta po'lat sharcha, ${k} tasi ${h} sm ko'tarilgan, zarbadagi tezlik ${v} m/s. Zarbalar soni: ${hits}.`,
      legend: { vel: 'tezlik v', h: "ko'tarish balandligi h", path: "sharchaning yo'li" },
      readouts: {
        v: 'Zarbadagi tezlik',
        vSub: (h, now) => `v = √(2gh) = √(2·9.8·${h}) · hozir ${now} m/s`,
        pIn: 'Zarbagacha impuls',
        pInSub: (k, m, v) => `p = k·m·v = ${k}·${m}·${v}`,
        pOut: 'Zarbadan keyingi impuls',
        pOutWait: 'zarbani kuting',
        pOutSteel: (k, v) => `${k} ta sharcha · v′ = ${v} m/s`,
        pOutClay: (n, v) => `${n} ta sharcha birga · v′ = ${v} m/s`,
        ek: 'Kinetik energiya',
        ekKept: (e) => `saqlandi: zarbagacha ham ${e} J`,
        ekLost: (e0, pct) => `${e0} J edi — ${pct} % i issiqlikka`,
        ekSub: (n) => `zarba paytida, ${n} ta sharchada`,
      },
      h: "Ko'tarish balandligi",
      hHint: (deg, v) => `ip ${deg}° ga og'adi · pastda v = ${v} m/s`,
      matLabel: 'Sharchalar orasida',
      mats: {
        steel: { name: "Hech narsa (po'lat)", sub: 'elastik zarba' },
        clay: { name: 'Plastilin', sub: 'noelastik zarba' },
      },
      info: {
        title: 'Asbob',
        text: (r, m, l) =>
          `Bir xil po'lat sharchalar: radiusi ${r} sm, massasi ${m} kg; ip uzunligi ${l} sm. Havo qarshiligi hisobga olinmaydi.`,
      },
      why: {
        title: (k) => `Nega aynan ${k} ta sharcha uchib chiqadi?`,
        lead: (k, p, e) =>
          `Zarbagacha p = ${p} kg·m/s, Eₖ = ${e} J. Narigi tomondan n ta sharcha v′ = ${k}v/n tezlik bilan chiqsa, impuls har doim saqlanadi — kinetik energiya esa faqat bitta holatda.`,
        cols: { n: 'Uchib chiqadi', verdict: 'Xulosa' },
        balls: (n) => `${n} ta`,
        yes: 'saqlanadi',
        no: 'saqlanmaydi',
        real: "Shunday bo'ladi: p ham, Eₖ ham saqlanadi",
        realClay: "Plastilin bilan shunday bo'ladi",
        tooMuch: (x) => `Bo'lmaydi: energiya ${x} marta ortib ketardi`,
        tooLittle: "Po'latda bo'lmaydi: energiya yo'qolardi",
        tooLittleClay: "Bo'lmaydi: plastilin sharchalarni yopishtiradi",
        note: "Impulsning saqlanishi o'zi yetmaydi: impuls ham, energiya ham saqlanishi uchun aynan shuncha sharcha, aynan shu tezlik bilan chiqishi kerak.",
        noteClay:
          "Plastilin zarbani noelastik qiladi: sharchalar yopishib, beshtasi birga ketadi. Impuls saqlanadi, kinetik energiyaning bir qismi esa issiqlikka aylanadi.",
      },
      hTag: (h, cm) => `h = ${h} ${cm}`,
      vTag: (v, ms) => `v = ${v} ${ms}`,
      click: 'tak!',
      together: (v, ms) => `birga: v′ = ${v} ${ms}`,
      explain: {
        idle: (k, h, v) =>
          `${k} ta sharcha ${h} sm balandlikka ko'tarilgan. «Qo'yib yuborish»ni bosing: pastda ular v = √(2gh) = ${v} m/s tezlikka erishadi. Narigi tomondan nechta sharcha uchib chiqarkin?`,
        fall: (k, p) =>
          `Sharchalar pastga tushmoqda — potensial energiya kinetik energiyaga aylanmoqda. Zarba oldidan ${k} ta sharchaning impulsi p = ${p} kg·m/s bo'ladi.`,
        out1: (v, p) =>
          `Tak! Bitta sharcha urildi — narigi chetdan ham bitta sharcha xuddi shu ${v} m/s tezlik bilan uchib chiqdi. O'rtadagi uchtasi joyida qoldi: impuls (${p} kg·m/s) ular orqali «yugurib» o'tdi.`,
        out2: (v, p) =>
          `Ikkita sharcha urildi — narigi tomondan ham aynan ikkitasi ${v} m/s tezlik bilan chiqdi, 2v tezlikli bitta sharcha emas. Impuls (${p} kg·m/s) ham, kinetik energiya ham saqlandi.`,
        out3: (v, p) =>
          `Uchta sharcha urildi — uchtasi chiqdi: o'rtadagi sharcha to'xtamay, endi narigi guruh bilan birga uchmoqda. Impuls ${p} kg·m/s, tezlik ${v} m/s — o'zgarmadi.`,
        again: (k) =>
          `Sharchalar qaytib kelib, yana urilmoqda: har gal ${k} ta kiradi — ${k} ta chiqadi. Haqiqiy beshik havo qarshiligi va zarbadagi qizish tufayli asta-sekin to'xtaydi; bu yerda ular hisobga olinmagan.`,
        inelastic: (k, v, p, pct, h2) =>
          `Plastilin bilan zarba noelastik: sharchalar yopishib, beshtasi birga v′ = ${k}·v/5 = ${v} m/s tezlik bilan ketdi. Impuls saqlandi (${p} kg·m/s), lekin kinetik energiyaning ${pct} % i issiqlikka aylandi — endi ular atigi ${h2} sm ko'tariladi.`,
      },
    },
    recoil: {
      presetsLabel: 'Holat',
      axis: 'x, m',
      ice: 'silliq muz',
      push: "Itarish! Ikkala jismga teng va qarama-qarshi kuchlar bir xil vaqt ta'sir qilmoqda — ular teng va qarama-qarshi impuls oladi: m₁v₁ = −m₂v₂.",
      legend: { vel: 'tezlik v', cm: 'massa markazi' },
      cmTag: 'massa markazi',
      vTag: (i, v, ms) => `v_${i} = ${v} ${ms}`,
      mTag: (i, m, unit) => `m_${i} = ${m} ${unit}`,
      sceneLabel: (b1, v1, b2, v2) => `${b1}: v₁ = ${v1} m/s; ${b2}: v₂ = ${v2} m/s. Umumiy impuls nolga teng.`,
      readouts: {
        pSub: (i, p, u) => `p${SUB[i]} = ${p} ${u}`,
        sum: 'Umumiy impuls',
        sumSub: 'boshida 0 edi — 0 ligicha qoladi',
        ek: 'Kinetik energiya',
      },
      chart: {
        title: 'Impuls vektorlari',
        before: 'boshida (tinch)',
        now: 'hozir',
        note: "Ikki jism teng va qarama-qarshi impuls oladi: strelkalar uzunligi bir xil, yo'nalishi teskari. Σp doim 0.",
        label: (p1, p2) => `Impulslar: p₁ = ${p1}, p₂ = ${p2} kg·m/s; yig'indisi 0.`,
      },
      calc: {
        title: 'Hisoblash',
        note: 'Boshida hammasi tinch edi: m₁v₁ + m₂v₂ = 0. Impulslar teng, kinetik energiyalar esa massalarga teskari proporsional — yengil jism energiyaning katta qismini oladi.',
      },
      cases: {
        carts: {
          name: 'Prujinali aravachalar',
          sub: '1 kg + 2 kg · ip kuydiriladi',
          b1: '1-aravacha',
          b2: '2-aravacha',
          action: 'Ipni kuydirish',
          scene: "silliq yo'l",
          m1: '1-aravacha massasi',
          m2: '2-aravacha massasi',
          v2: '2-aravacha oladigan tezlik',
          v1Label: '1-aravacha tezligi',
          v2Label: '2-aravacha tezligi',
          hint: 'Siqilgan prujinani ip ushlab turibdi',
          source: 'manba: siqilgan prujina',
          share: (pct) => `${pct} % i 2-aravachada`,
          idle: "Ikki aravacha orasida siqilgan prujina bor, ularni ip ushlab turibdi. Hammasi tinch: umumiy impuls 0. «Ipni kuydirish»ni bosing — aravachalar qanday tezlik bilan ketadi?",
          done: (v1, v2, p, e1, e2, r) =>
            `Prujina aravachalarni ikki tomonga itardi: 1-si chapga ${v1} m/s, 2-si o'ngga ${v2} m/s tezlik bilan ketdi. Impulslar teng va qarama-qarshi (${p} kg·m/s), yig'indisi 0 ligicha qoldi. Yengil aravacha ${r} marta tezroq.`,
        },
        gun: {
          name: "Miltiq va o'q",
          sub: '4 kg · 9 g · 800 m/s',
          b1: 'miltiq',
          b2: "o'q",
          action: "O'q uzish",
          scene: 'miltiq erkin yotibdi',
          m1: 'Miltiq massasi',
          m2: "O'q massasi",
          v2: "O'qning tezligi",
          v1Label: 'Miltiq tezligi (tepki)',
          v2Label: "O'q tezligi",
          hint: "Porox gazlari o'qni stvoldan itarib chiqaradi",
          source: 'manba: porox yonishi',
          share: (pct) => `${pct} % i o'qda`,
          idle: "Miltiq va o'q tinch turibdi, miltiqni hech kim ushlamagan. O'q uzilganda porox gazlari o'qni oldinga, miltiqni esa orqaga itaradi. «O'q uzish»ni bosing.",
          done: (v1, v2, p, e1, e2) =>
            `O'q ${v2} m/s tezlik bilan oldinga, miltiq esa ${v1} m/s tezlik bilan orqaga ketdi — bu tepki. Impulslari teng: ${p} kg·m/s. Energiyalari esa teng emas: o'qda ${e2} J, miltiqda atigi ${e1} J. Miltiqni yelkaga mahkam tirab otishadi — shunda tepkini odam ham qabul qiladi.`,
        },
        astro: {
          name: 'Kosmonavt va kalit',
          sub: '100 kg · 2 kg · 5 m/s',
          b1: 'kosmonavt',
          b2: 'kalit',
          action: 'Kalitni otish',
          scene: 'ochiq kosmos',
          m1: 'Kosmonavt massasi (skafandr bilan)',
          m2: 'Kalit massasi',
          v2: 'Kalitning tezligi',
          v1Label: 'Kosmonavt tezligi',
          v2Label: 'Kalit tezligi',
          hint: "Kosmosda tiralish uchun hech narsa yo'q",
          source: 'manba: kosmonavtning muskullari',
          share: (pct) => `${pct} % i kalitda`,
          idle: "Kosmonavt ochiq kosmosda kemadan uzilib qolgan — hech narsaga tirala olmaydi. Qo'lida gayka kaliti bor. Kalitni oldinga otsa nima bo'ladi? «Kalitni otish»ni bosing.",
          done: (v1, v2, p, e1, e2, r) =>
            `Kalit ${v2} m/s tezlik bilan oldinga uchdi, kosmonavt esa ${v1} m/s tezlik bilan orqaga suzib ketdi: u ${r} marta og'ir, shuning uchun shuncha marta sekin. Impulslar teng (${p} kg·m/s). Kosmonavt kemaga xuddi shu yo'l bilan qaytishi mumkin!`,
        },
        ship: {
          name: 'Kosmik kema',
          sub: '1000 kg · 10 kg gaz',
          b1: 'kema',
          b2: 'gaz',
          action: 'Dvigatelni yoqish',
          scene: 'reaktiv harakat',
          m1: 'Kema massasi',
          m2: 'Gaz porsiyasi massasi',
          v2: 'Gazning chiqish tezligi',
          v1Label: 'Kema tezligi',
          v2Label: 'Gaz tezligi',
          hint: 'Dvigatel bir zumda bitta porsiya gazni orqaga chiqaradi',
          source: "manba: yoqilg'ining yonishi",
          share: (pct) => `${pct} % i gazda`,
          idle: "Kosmik kema tinch turibdi. Dvigatel yoqilsa, yonish mahsulotlari — gaz — katta tezlik bilan orqaga otiladi. Kema nimaga tiralib oldinga ketadi? «Dvigatelni yoqish»ni bosing.",
          done: (v1, v2, p) =>
            `Gaz ${v2} m/s tezlik bilan orqaga otildi, kema esa ${v1} m/s tezlik bilan oldinga ketdi. Bu — reaktiv harakat: kema hech narsaga tiralmaydi, o'zidan otilgan gazning impulsi (${p} kg·m/s) hisobiga harakatlanadi.`,
        },
      },
    },
    pucks: {
      presetsLabel: 'Tajriba',
      presets: {
        billiard: { name: 'Bilyard zarbasi', sub: '0.2 kg + 0.2 kg · b = 8 sm' },
        central: { name: 'Markaziy zarba', sub: '0.2 kg + 0.2 kg · b = 0' },
        sticky: { name: 'Yopishib qolish', sub: 'yopishqoq chet · b = 8 sm' },
        heavy: { name: "Yengil og'irga", sub: '0.1 kg → 0.4 kg · b = 6 sm' },
      },
      bumperLabel: 'Shaybalar cheti',
      bumpers: {
        elastic: { name: 'Elastik', sub: "elastik to'qnashuv" },
        sticky: { name: 'Yopishqoq', sub: "noelastik to'qnashuv" },
      },
      m1: '1-shayba massasi',
      m2: '2-shayba massasi',
      v: '1-shayba tezligi',
      b: 'Zarbaning markazdan chetlanishi',
      bHint: (d) => `b — 1-shayba yo'li bilan 2-shayba markazi orasidagi masofa; |b| ≥ ${d} sm bo'lsa, shaybalar tegmaydi`,
      chip: "yuqoridan ko'rinish",
      legend: { puck1: '1-shayba', puck2: '2-shayba', vel: 'tezlik v', trail: 'iz' },
      sceneLabel: (v1, v2, px, py) =>
        `Havo xokkeyi stoli, yuqoridan ko'rinish: 1-shayba tezligi ${v1} m/s, 2-shayba tezligi ${v2} m/s. Umumiy impuls: x bo'yicha ${px}, y bo'yicha ${py} kg·m/s.`,
      mTag: (i, m, kg) => `m_${i} = ${m} ${kg}`,
      vTag: (i, v, ms) => `v_${i} = ${v} ${ms}`,
      bTag: (b, cm) => `b = ${b} ${cm}`,
      readouts: {
        p1: '1-shayba impulsi',
        p2: '2-shayba impulsi',
        sum: 'Umumiy impuls',
        ek: 'Kinetik energiya',
        comp: (x, y) => `p_x = ${x} · p_y = ${y}`,
        ekBefore: (e) => `boshida ${e} J`,
        ekKept: 'saqlandi',
        ekLost: (q, pct) => `yo'qoldi: ${q} J (${pct} %)`,
      },
      diagram: {
        title: "Impuls vektorlarini qo'shish",
        before: "To'qnashuvgacha",
        now: 'Hozir',
        angle: (a) => `p₁′ va p₂′ orasida ${a}°`,
        sum: (p0, px, py, u) => `Σp: boshida (${p0}; 0), hozir (${px}; ${py}) ${u}`,
        note: "Vektorlar ketma-ket qo'shiladi: p₂ ning boshi p₁ ning uchiga qo'yiladi. Uzuq chiziq — yig'indi Σp; u ikkala rasmda bir xil.",
        label: (px, py) => `Impuls vektorlari diagrammasi. Hozirgi yig'indi: x bo'yicha ${px}, y bo'yicha ${py} kg·m/s.`,
      },
      explain: {
        idle: (b, p) =>
          `Havo xokkeyi stolida shaybalar deyarli ishqalanishsiz sirpanadi. 1-shayba 2-sining markazidan b = ${b} sm chetroqqa uriladi. Umumiy impuls p = ${p} kg·m/s, o'ngga yo'nalgan. «Boshlash»ni bosing.`,
        miss: (d) => `|b| ≥ ${d} sm — shaybalar bir-biriga tegmaydi. Ular o'zaro ta'sirlashmaydi, shuning uchun har birining impulsi o'zgarmaydi.`,
        before: (p) => `To'qnashuvgacha faqat 1-shayba harakatlanmoqda: umumiy impuls p = ${p} kg·m/s, butunlay x o'qi bo'ylab yo'nalgan (p_y = 0).`,
        doneRight: (v1, v2, a, py1, py2) =>
          `Teng massali shaybalar ${a}° burchak ostida tarqaldi — bilyardda ham shunday! v₁′ = ${v1} m/s, v₂′ = ${v2} m/s. y bo'yicha impulslar teng va qarama-qarshi (${py1} va ${py2}), shuning uchun yig'indi yana x o'qi bo'ylab — boshidagidek.`,
        doneElastic: (py1, py2, px1, px2, p) =>
          `Shaybalar turli tomonga ketdi. y-tashkil etuvchilar: ${py1} + ${py2} = 0; x-tashkil etuvchilar: ${px1} + ${px2} = ${p} kg·m/s — boshidagi impulsning o'zi. Impuls vektor sifatida saqlandi.`,
        doneCentral: (v) => `Markaziy zarba: 1-shayba to'xtadi, 2-si uning tezligi bilan (${v} m/s) ketdi — xuddi teng aravachalardagidek.`,
        doneLine: (v1, v2, p) => `Markaziy zarba — hammasi bir chiziqda: v₁′ = ${v1} m/s, v₂′ = ${v2} m/s; m₁v₁′ + m₂v₂′ = ${p} kg·m/s, boshidagidek.`,
        doneSticky: (p, V, pct) =>
          `Shaybalar yopishib, aylanib ketdi: har birining impulsi yo'nalishini o'zgartirib turadi, ammo yig'indisi doim bir xil — o'ngga ${p} kg·m/s. Massa markazi (●) V = ${V} m/s tezlik bilan to'g'ri chiziq bo'ylab ketmoqda. Kinetik energiyaning ${pct} % i issiqlikka aylandi.`,
      },
    },
  },

  ru: {
    u: { kg: 'кг', g: 'г', cm: 'см', kgms: 'кг·м/с', J: 'Дж', N: 'Н' },
    common: {
      start: 'Старт',
      pause: 'Пауза',
      resume: 'Продолжить',
      again: 'Ещё раз',
      reset: 'Сброс',
      realTime: 'Реальное время',
      slow: (k) => `Время замедлено в ${k} ${ruTimes(k)}`,
      slowShort: (k) => `Время ×${k} медленнее`,
      fast: (k) => `Время ускорено в ${k} ${ruTimes(k)}`,
      fastShort: (k) => `Время ×${k} быстрее`,
    },
    card: {
      eyebrow: 'Виртуальная лаборатория · Статика',
      title: 'Закон сохранения импульса',
      tabsLabel: 'Выберите симулятор',
      tabs: {
        collide: { label: 'Столкновение', sub: 'упругое и неупругое' },
        cradle: { label: 'Колыбель Ньютона', sub: 'n влетает — n вылетает' },
        recoil: { label: 'Реактивное движение', sub: 'из покоя: Σp = 0' },
        pucks: { label: 'На плоскости', sub: 'импульс — вектор' },
      },
    },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Импульс тела', text: 'p = m·v — векторная величина, направлена как скорость; единица — кг·м/с.' },
        {
          term: 'Закон сохранения',
          text: 'в замкнутой системе векторная сумма импульсов тел не меняется: m₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′.',
        },
        {
          term: 'Столкновения',
          text: 'при упругом ударе сохраняются и импульс, и кинетическая энергия; при неупругом тела движутся вместе, и часть Eₖ переходит в тепло.',
        },
        { term: 'Реактивное движение', text: 'если от тела отделяется часть, остальное движется в обратную сторону: m₁v₁ = −m₂v₂.' },
      ],
    },
    collide: {
      presetsLabel: 'Опыт',
      presets: {
        swap: { name: 'Равные массы · упругий', sub: '1 кг + 1 кг · 2 м/с' },
        stick: { name: 'Равные массы · слипаются', sub: '1 кг + 1 кг · 2 м/с' },
        heavy: { name: 'Тяжёлая бьёт лёгкую', sub: '3 кг → 1 кг · 2 м/с' },
        light: { name: 'Лёгкая бьёт тяжёлую', sub: '1 кг → 4 кг · 2,5 м/с' },
      },
      bumperLabel: 'Бамперы',
      bumpers: {
        elastic: { name: 'Пружинные', sub: 'упругий удар' },
        sticky: { name: 'Липкие', sub: 'неупругий удар' },
      },
      m1: 'Масса 1-й тележки',
      m2: 'Масса 2-й тележки',
      v1: 'Скорость 1-й тележки',
      v2: 'Скорость 2-й тележки',
      massHint: 'Пустая тележка 0,5 кг, каждый груз 0,5 кг',
      vHint: 'Плюс — вправо, минус — влево. Путь гладкий, трения нет.',
      closed: {
        title: 'Почему система замкнута?',
        text: 'На каждую тележку действуют сила тяжести mg (вниз) и сила реакции опоры N (вверх) — они уравновешены, трения нет. По горизонтали остаётся только действие тележек друг на друга; эти внутренние силы не могут изменить суммарный импульс.',
      },
      axis: 'x, м',
      legend: { cart1: '1-я тележка', cart2: '2-я тележка', vel: 'скорость v', force: 'силы взаимодействия', cm: 'центр масс' },
      chipHit: 'Удар: время замедлено в 20 раз',
      phase: { before: 'до удара', hit: 'удар', after: 'после удара' },
      mTag: (i, m, kg) => `m_${i} = ${m} ${kg}`,
      vTag: (sym, v, ms) => `${sym} = ${v} ${ms}`,
      cmTag: (v) => `центр масс · ${v} м/с`,
      sceneLabel: (m1, v1, m2, v2, p) =>
        `Две тележки на гладком пути: m₁ = ${m1}, v₁ = ${v1} м/с; m₂ = ${m2}, v₂ = ${v2} м/с. Суммарный импульс ${p} кг·м/с.`,
      readouts: {
        p1: 'Импульс 1-й тележки',
        p2: 'Импульс 2-й тележки',
        sum: 'Суммарный импульс',
        ek: 'Кинетическая энергия',
        pSub: (i, m, v, ms) => `p${SUB[i]} = m${SUB[i]}v${SUB[i]} = ${m} · ${v} ${ms}`,
        sumSub: (p) => `в начале ${p} — не меняется`,
        ekBefore: (e) => `в начале ${e} Дж`,
        ekSpring: (e) => `в пружинах временно ${e} Дж`,
        ekHeat: (q) => `перешло в тепло: ${q} Дж`,
        ekKept: (e) => `сохранилась: как и в начале, ${e} Дж`,
        ekLost: (q, pct) => `потеряно: ${q} Дж (${pct} %)`,
      },
      chart: {
        title: 'Векторы импульса',
        before: 'до удара',
        now: 'сейчас',
        after: 'после удара',
        note: 'Импульс вправо — положительный, влево — отрицательный. Обе стрелки Σp всегда одинаковы: суммарный импульс сохраняется.',
        label: (p1, p2, q1, q2, p) =>
          `Импульсы: до удара p₁ = ${p1}, p₂ = ${p2}; сейчас p₁ = ${q1}, p₂ = ${q2} кг·м/с. Суммарный импульс ${p} кг·м/с.`,
      },
      calc: {
        title: 'Расчёт',
        note: 'v₁, v₂ — скорости до удара, v₁′, v₂′ — после; направление вправо положительное.',
        noteApart: 'Тележки не сталкиваются — импульс каждой не меняется.',
      },
      energy: {
        title: 'Энергия',
        ek: 'кинетич.',
        ep: 'пружина',
        q: 'тепло',
        e: 'полная',
        level: (e) => `E = ${e} Дж`,
        noteElastic: 'Во время удара часть Eₖ запасается в сжатых пружинах, затем полностью возвращается.',
        noteSticky: 'Липкие бамперы сминаются и нагреваются: потерянная Eₖ переходит в количество теплоты Q. Полная энергия E всё равно сохраняется.',
        label: (ek, ep, q) => `Энергия: кинетическая ${ek} Дж, в пружинах ${ep} Дж, тепло ${q} Дж.`,
      },
      graph: {
        title: 'Импульсы p(t)',
        x: 't, с',
        y: 'p, кг·м/с',
        note: 'Во время удара p₁ уменьшается ровно настолько, насколько растёт p₂; линия p₁ + p₂ горизонтальна — суммарный импульс не меняется.',
        label: 'График зависимости импульсов тележек от времени',
      },
      explain: {
        idle: (p) =>
          `Нажмите «Старт». Путь гладкий: сила тяжести уравновешена силой реакции опоры, трения нет — две тележки образуют замкнутую систему. Суммарный импульс p = m₁v₁ + m₂v₂ = ${p} кг·м/с. Каким он будет после удара?`,
        apart: (p) =>
          `v₁ ≤ v₂ — тележки не сближаются, удара не будет. Каждая сохраняет свой импульс, суммарный импульс ${p} кг·м/с. Чтобы они столкнулись, нужно v₁ > v₂.`,
        before: (p, v) =>
          `До удара на тележки не действуют горизонтальные силы — скорости не меняются. Суммарный импульс p = ${p} кг·м/с. Центр масс (◆) движется равномерно со скоростью v = p/(m₁ + m₂) = ${v} м/с.`,
        hitElastic:
          'Удар! Пружины сжимаются: тележки действуют друг на друга равными и противоположными силами (F₁₂ = −F₂₁). Сколько импульса теряет одна тележка, столько получает другая — p₁ + p₂ не меняется.',
        hitSticky:
          'Удар! Липкие бамперы сминаются и слипаются. Силы равны и противоположны — импульс переходит от одной тележки к другой, сумма не меняется. А кинетическая энергия переходит в тепло.',
        doneSwap: (v1, v2) =>
          `Тележки равной массы обменялись скоростями: v₁′ = ${v1} м/с, v₂′ = ${v2} м/с. При упругом ударе сохраняются и импульс, и кинетическая энергия.`,
        doneRebound: (v1, v2, p) =>
          `Лёгкая тележка ударилась о более тяжёлую и отскочила назад: v₁′ = ${v1} м/с, v₂′ = ${v2} м/с. Импульс 1-й тележки сменил знак, а суммарный импульс по-прежнему ${p} кг·м/с.`,
        doneHeavy: (v1, v2, p, e) =>
          `Тяжёлая тележка не остановилась, а поехала медленнее (v₁′ = ${v1} м/с), лёгкая же умчалась быстрее неё (v₂′ = ${v2} м/с). Суммарный импульс ${p} кг·м/с, кинетическая энергия ${e} Дж — сохранились оба.`,
        doneElastic: (p, e) =>
          `Упругий удар: суммарный импульс и до, и после равен ${p} кг·м/с; кинетическая энергия тоже осталась ${e} Дж — пружины полностью вернули энергию.`,
        doneSticky: (v, e0, e1, q, pct) =>
          `Неупругий удар: тележки слиплись и поехали вместе со скоростью v′ = ${v} м/с. Импульс сохранился, а кинетическая энергия уменьшилась с ${e0} Дж до ${e1} Дж: ${q} Дж (${pct} %) перешло в тепло.`,
        doneStop: (e0) =>
          `Импульсы были равны и противоположны — суммарный импульс 0. Слипшись, обе тележки остановились: импульс остался 0, а вся кинетическая энергия (${e0} Дж) перешла в тепло.`,
      },
    },
    cradle: {
      countLabel: 'Поднятые шары',
      count: (n) => `${n} ${n === 1 ? 'шар' : 'шара'}`,
      countSub: (n) => (n === 1 ? 'крайний' : `крайние ${n} вместе`),
      release: 'Отпустить',
      hitsChip: (n) => `ударов: ${n}`,
      sceneLabel: (k, h, v, hits) =>
        `Колыбель Ньютона: 5 стальных шаров, поднято ${k} на ${h} см, скорость при ударе ${v} м/с. Ударов: ${hits}.`,
      legend: { vel: 'скорость v', h: 'высота подъёма h', path: 'путь шара' },
      readouts: {
        v: 'Скорость при ударе',
        vSub: (h, now) => `v = √(2gh) = √(2·9,8·${h}) · сейчас ${now} м/с`,
        pIn: 'Импульс до удара',
        pInSub: (k, m, v) => `p = k·m·v = ${k}·${m}·${v}`,
        pOut: 'Импульс после удара',
        pOutWait: 'дождитесь удара',
        pOutSteel: (k, v) => `${k} ${k === 1 ? 'шар' : 'шара'} · v′ = ${v} м/с`,
        pOutClay: (n, v) => `${n} шаров вместе · v′ = ${v} м/с`,
        ek: 'Кинетическая энергия',
        ekKept: (e) => `сохранилась: и до удара ${e} Дж`,
        ekLost: (e0, pct) => `было ${e0} Дж — ${pct} % ушло в тепло`,
        ekSub: (n) => `в момент удара, у ${n} ${n === 1 ? 'шара' : 'шаров'}`,
      },
      h: 'Высота подъёма',
      hHint: (deg, v) => `нить отклонена на ${deg}° · внизу v = ${v} м/с`,
      matLabel: 'Между шарами',
      mats: {
        steel: { name: 'Ничего (сталь)', sub: 'упругий удар' },
        clay: { name: 'Пластилин', sub: 'неупругий удар' },
      },
      info: {
        title: 'Прибор',
        text: (r, m, l) =>
          `Одинаковые стальные шары: радиус ${r} см, масса ${m} кг; длина нити ${l} см. Сопротивление воздуха не учитывается.`,
      },
      why: {
        title: (k) => `Почему вылетает именно ${k} ${k === 1 ? 'шар' : 'шара'}?`,
        lead: (k, p, e) =>
          `До удара p = ${p} кг·м/с, Eₖ = ${e} Дж. Если с другой стороны вылетят n шаров со скоростью v′ = ${k}v/n, импульс сохранится всегда — а кинетическая энергия только в одном случае.`,
        cols: { n: 'Вылетает', verdict: 'Вывод' },
        balls: (n) => `${n} шт.`,
        yes: 'сохраняется',
        no: 'не сохраняется',
        real: 'Так и происходит: сохраняются и p, и Eₖ',
        realClay: 'Так происходит с пластилином',
        tooMuch: (x) => `Невозможно: энергия выросла бы в ${x} раза`,
        tooLittle: 'Не для стали: энергия бы терялась',
        tooLittleClay: 'Невозможно: пластилин склеивает шары',
        note: 'Одного сохранения импульса мало: чтобы сохранялись и импульс, и энергия, вылететь должно именно столько шаров и именно с этой скоростью.',
        noteClay: 'Пластилин делает удар неупругим: шары слипаются и все пять движутся вместе. Импульс сохраняется, а часть кинетической энергии переходит в тепло.',
      },
      hTag: (h, cm) => `h = ${h} ${cm}`,
      vTag: (v, ms) => `v = ${v} ${ms}`,
      click: 'щёлк!',
      together: (v, ms) => `вместе: v′ = ${v} ${ms}`,
      explain: {
        idle: (k, h, v) =>
          `Поднято шаров: ${k}, на высоту ${h} см. Нажмите «Отпустить»: внизу они разгонятся до v = √(2gh) = ${v} м/с. Сколько шаров вылетит с другой стороны?`,
        fall: (k, p) =>
          `Шары падают — потенциальная энергия переходит в кинетическую. Перед ударом импульс шаров (${k}) будет p = ${p} кг·м/с.`,
        out1: (v, p) =>
          `Щёлк! Ударил один шар — и с другого края вылетел тоже один, с той же скоростью ${v} м/с. Три средних остались на месте: импульс (${p} кг·м/с) «пробежал» сквозь них.`,
        out2: (v, p) =>
          `Ударили два шара — и с другой стороны вылетели ровно два со скоростью ${v} м/с, а не один со скоростью 2v. Сохранились и импульс (${p} кг·м/с), и кинетическая энергия.`,
        out3: (v, p) =>
          `Ударили три шара — вылетели три: средний шар не остановился и летит теперь вместе с другой группой. Импульс ${p} кг·м/с и скорость ${v} м/с не изменились.`,
        again: (k) =>
          `Шары возвращаются и снова бьют: каждый раз ${k} влетает — ${k} вылетает. Настоящая колыбель постепенно останавливается из-за сопротивления воздуха и нагрева при ударах; здесь они не учитываются.`,
        inelastic: (k, v, p, pct, h2) =>
          `С пластилином удар неупругий: шары слиплись, и все пять поехали вместе со скоростью v′ = ${k}·v/5 = ${v} м/с. Импульс сохранился (${p} кг·м/с), но ${pct} % кинетической энергии перешло в тепло — теперь шары поднимаются всего на ${h2} см.`,
      },
    },
    recoil: {
      presetsLabel: 'Ситуация',
      axis: 'x, м',
      ice: 'гладкий лёд',
      push: 'Толчок! На оба тела одно и то же время действуют равные и противоположные силы — они получают равные и противоположные импульсы: m₁v₁ = −m₂v₂.',
      legend: { vel: 'скорость v', cm: 'центр масс' },
      cmTag: 'центр масс',
      vTag: (i, v, ms) => `v_${i} = ${v} ${ms}`,
      mTag: (i, m, unit) => `m_${i} = ${m} ${unit}`,
      sceneLabel: (b1, v1, b2, v2) => `${b1}: v₁ = ${v1} м/с; ${b2}: v₂ = ${v2} м/с. Суммарный импульс равен нулю.`,
      readouts: {
        pSub: (i, p, u) => `p${SUB[i]} = ${p} ${u}`,
        sum: 'Суммарный импульс',
        sumSub: 'в начале был 0 — так и остаётся 0',
        ek: 'Кинетическая энергия',
      },
      chart: {
        title: 'Векторы импульса',
        before: 'в начале (покой)',
        now: 'сейчас',
        note: 'Два тела получают равные и противоположные импульсы: стрелки одной длины, направлены в разные стороны. Σp всегда 0.',
        label: (p1, p2) => `Импульсы: p₁ = ${p1}, p₂ = ${p2} кг·м/с; сумма 0.`,
      },
      calc: {
        title: 'Расчёт',
        note: 'В начале всё покоилось: m₁v₁ + m₂v₂ = 0. Импульсы равны, а кинетические энергии обратно пропорциональны массам — лёгкое тело получает бо́льшую часть энергии.',
      },
      cases: {
        carts: {
          name: 'Тележки с пружиной',
          sub: '1 кг + 2 кг · нить пережигают',
          b1: '1-я тележка',
          b2: '2-я тележка',
          action: 'Пережечь нить',
          scene: 'гладкий путь',
          m1: 'Масса 1-й тележки',
          m2: 'Масса 2-й тележки',
          v2: 'Скорость, которую получит 2-я тележка',
          v1Label: 'Скорость 1-й тележки',
          v2Label: 'Скорость 2-й тележки',
          hint: 'Сжатую пружину удерживает нить',
          source: 'источник: сжатая пружина',
          share: (pct) => `${pct} % — у 2-й тележки`,
          idle: 'Между двумя тележками сжатая пружина, их удерживает нить. Всё покоится: суммарный импульс 0. Нажмите «Пережечь нить» — с какими скоростями разъедутся тележки?',
          done: (v1, v2, p, e1, e2, r) =>
            `Пружина растолкнула тележки: 1-я поехала влево со скоростью ${v1} м/с, 2-я вправо — ${v2} м/с. Импульсы равны и противоположны (${p} кг·м/с), их сумма осталась 0. Лёгкая тележка в ${r} ${ruTimesS(r)} быстрее.`,
        },
        gun: {
          name: 'Ружьё и пуля',
          sub: '4 кг · 9 г · 800 м/с',
          b1: 'ружьё',
          b2: 'пуля',
          action: 'Выстрелить',
          scene: 'ружьё лежит свободно',
          m1: 'Масса ружья',
          m2: 'Масса пули',
          v2: 'Скорость пули',
          v1Label: 'Скорость ружья (отдача)',
          v2Label: 'Скорость пули',
          hint: 'Пороховые газы выталкивают пулю из ствола',
          source: 'источник: сгорание пороха',
          share: (pct) => `${pct} % — у пули`,
          idle: 'Ружьё и пуля покоятся, ружьё никто не держит. При выстреле пороховые газы толкают пулю вперёд, а ружьё — назад. Нажмите «Выстрелить».',
          done: (v1, v2, p, e1, e2) =>
            `Пуля полетела вперёд со скоростью ${v2} м/с, а ружьё — назад со скоростью ${v1} м/с: это отдача. Импульсы равны: ${p} кг·м/с. А энергии — нет: у пули ${e2} Дж, у ружья всего ${e1} Дж. Ружьё плотно прижимают к плечу — тогда отдачу принимает и стрелок.`,
        },
        astro: {
          name: 'Космонавт и ключ',
          sub: '100 кг · 2 кг · 5 м/с',
          b1: 'космонавт',
          b2: 'ключ',
          action: 'Бросить ключ',
          scene: 'открытый космос',
          m1: 'Масса космонавта (со скафандром)',
          m2: 'Масса ключа',
          v2: 'Скорость ключа',
          v1Label: 'Скорость космонавта',
          v2Label: 'Скорость ключа',
          hint: 'В космосе не от чего оттолкнуться',
          source: 'источник: мышцы космонавта',
          share: (pct) => `${pct} % — у ключа`,
          idle: 'Космонавт в открытом космосе оторвался от корабля — ему не от чего оттолкнуться. В руке у него гаечный ключ. Что будет, если бросить ключ вперёд? Нажмите «Бросить ключ».',
          done: (v1, v2, p, e1, e2, r) =>
            `Ключ полетел вперёд со скоростью ${v2} м/с, а космонавт поплыл назад со скоростью ${v1} м/с: он в ${r} ${ruTimesS(r)} тяжелее, поэтому во столько же раз медленнее. Импульсы равны (${p} кг·м/с). Так космонавт может вернуться к кораблю!`,
        },
        ship: {
          name: 'Космический корабль',
          sub: '1000 кг · 10 кг газа',
          b1: 'корабль',
          b2: 'газ',
          action: 'Включить двигатель',
          scene: 'реактивное движение',
          m1: 'Масса корабля',
          m2: 'Масса порции газа',
          v2: 'Скорость истечения газа',
          v1Label: 'Скорость корабля',
          v2Label: 'Скорость газа',
          hint: 'Двигатель мгновенно выбрасывает назад одну порцию газа',
          source: 'источник: сгорание топлива',
          share: (pct) => `${pct} % — у газа`,
          idle: 'Космический корабль покоится. Если включить двигатель, продукты сгорания — газ — с огромной скоростью вылетят назад. От чего же оттолкнётся корабль? Нажмите «Включить двигатель».',
          done: (v1, v2, p) =>
            `Газ вылетел назад со скоростью ${v2} м/с, а корабль поехал вперёд со скоростью ${v1} м/с. Это реактивное движение: корабль ни от чего не отталкивается, он движется за счёт импульса выброшенного газа (${p} кг·м/с).`,
        },
      },
    },
    pucks: {
      presetsLabel: 'Опыт',
      presets: {
        billiard: { name: 'Бильярдный удар', sub: '0,2 кг + 0,2 кг · b = 8 см' },
        central: { name: 'Центральный удар', sub: '0,2 кг + 0,2 кг · b = 0' },
        sticky: { name: 'Слипание', sub: 'липкий край · b = 8 см' },
        heavy: { name: 'Лёгкая в тяжёлую', sub: '0,1 кг → 0,4 кг · b = 6 см' },
      },
      bumperLabel: 'Край шайб',
      bumpers: {
        elastic: { name: 'Упругий', sub: 'упругий удар' },
        sticky: { name: 'Липкий', sub: 'неупругий удар' },
      },
      m1: 'Масса 1-й шайбы',
      m2: 'Масса 2-й шайбы',
      v: 'Скорость 1-й шайбы',
      b: 'Смещение удара от центра',
      bHint: (d) => `b — расстояние между линией движения 1-й шайбы и центром 2-й; при |b| ≥ ${d} см шайбы не касаются`,
      chip: 'вид сверху',
      legend: { puck1: '1-я шайба', puck2: '2-я шайба', vel: 'скорость v', trail: 'след' },
      sceneLabel: (v1, v2, px, py) =>
        `Стол аэрохоккея, вид сверху: скорость 1-й шайбы ${v1} м/с, 2-й — ${v2} м/с. Суммарный импульс: по x ${px}, по y ${py} кг·м/с.`,
      mTag: (i, m, kg) => `m_${i} = ${m} ${kg}`,
      vTag: (i, v, ms) => `v_${i} = ${v} ${ms}`,
      bTag: (b, cm) => `b = ${b} ${cm}`,
      readouts: {
        p1: 'Импульс 1-й шайбы',
        p2: 'Импульс 2-й шайбы',
        sum: 'Суммарный импульс',
        ek: 'Кинетическая энергия',
        comp: (x, y) => `p_x = ${x} · p_y = ${y}`,
        ekBefore: (e) => `в начале ${e} Дж`,
        ekKept: 'сохранилась',
        ekLost: (q, pct) => `потеряно: ${q} Дж (${pct} %)`,
      },
      diagram: {
        title: 'Сложение векторов импульса',
        before: 'До удара',
        now: 'Сейчас',
        angle: (a) => `между p₁′ и p₂′ ${a}°`,
        sum: (p0, px, py, u) => `Σp: в начале (${p0}; 0), сейчас (${px}; ${py}) ${u}`,
        note: 'Векторы складываются по цепочке: начало p₂ ставится в конец p₁. Пунктир — сумма Σp; на обоих рисунках она одинакова.',
        label: (px, py) => `Диаграмма векторов импульса. Текущая сумма: по x ${px}, по y ${py} кг·м/с.`,
      },
      explain: {
        idle: (b, p) =>
          `На столе аэрохоккея шайбы скользят почти без трения. 1-я шайба бьёт 2-ю со смещением b = ${b} см от центра. Суммарный импульс p = ${p} кг·м/с, направлен вправо. Нажмите «Старт».`,
        miss: (d) => `|b| ≥ ${d} см — шайбы не касаются друг друга. Они не взаимодействуют, поэтому импульс каждой не меняется.`,
        before: (p) => `До удара движется только 1-я шайба: суммарный импульс p = ${p} кг·м/с, целиком вдоль оси x (p_y = 0).`,
        doneRight: (v1, v2, a, py1, py2) =>
          `Шайбы равной массы разлетелись под углом ${a}° — как в бильярде! v₁′ = ${v1} м/с, v₂′ = ${v2} м/с. Импульсы по оси y равны и противоположны (${py1} и ${py2}), поэтому сумма снова направлена вдоль x — как в начале.`,
        doneElastic: (py1, py2, px1, px2, p) =>
          `Шайбы разлетелись в разные стороны. Проекции на y: ${py1} + ${py2} = 0; проекции на x: ${px1} + ${px2} = ${p} кг·м/с — тот же импульс, что в начале. Импульс сохранился как вектор.`,
        doneCentral: (v) => `Центральный удар: 1-я шайба остановилась, 2-я поехала с её скоростью (${v} м/с) — как с одинаковыми тележками.`,
        doneLine: (v1, v2, p) => `Центральный удар — всё на одной прямой: v₁′ = ${v1} м/с, v₂′ = ${v2} м/с; m₁v₁′ + m₂v₂′ = ${p} кг·м/с, как в начале.`,
        doneSticky: (p, V, pct) =>
          `Шайбы слиплись и закрутились: импульс каждой всё время меняет направление, но их сумма неизменна — ${p} кг·м/с вправо. Центр масс (●) движется по прямой со скоростью V = ${V} м/с. ${pct} % кинетической энергии перешло в тепло.`,
      },
    },
  },

  en: {
    u: { kg: 'kg', g: 'g', cm: 'cm', kgms: 'kg·m/s', J: 'J', N: 'N' },
    common: {
      start: 'Start',
      pause: 'Pause',
      resume: 'Resume',
      again: 'Run again',
      reset: 'Reset',
      realTime: 'Real time',
      slow: (k) => `Time slowed down ${k}×`,
      slowShort: (k) => `Time ${k}× slower`,
      fast: (k) => `Time sped up ${k}×`,
      fastShort: (k) => `Time ${k}× faster`,
    },
    card: {
      eyebrow: 'Virtual laboratory · Statics',
      title: 'Law of conservation of momentum',
      tabsLabel: 'Choose a simulator',
      tabs: {
        collide: { label: 'Collision', sub: 'elastic and inelastic' },
        cradle: { label: 'Newton’s cradle', sub: 'n in — n out' },
        recoil: { label: 'Jet propulsion', sub: 'from rest: Σp = 0' },
        pucks: { label: 'In a plane', sub: 'momentum is a vector' },
      },
    },
    facts: {
      title: 'Remember',
      items: [
        { term: 'Momentum', text: 'p = m·v — a vector quantity pointing the same way as the velocity; unit kg·m/s.' },
        {
          term: 'Conservation law',
          text: 'in a closed system the vector sum of the bodies’ momenta stays the same: m₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′.',
        },
        {
          term: 'Collisions',
          text: 'in an elastic collision both momentum and kinetic energy are conserved; in an inelastic one the bodies move together and part of Eₖ turns into heat.',
        },
        { term: 'Jet propulsion', text: 'when part of a body is thrown off, the rest moves the opposite way: m₁v₁ = −m₂v₂.' },
      ],
    },
    collide: {
      presetsLabel: 'Experiment',
      presets: {
        swap: { name: 'Equal masses · elastic', sub: '1 kg + 1 kg · 2 m/s' },
        stick: { name: 'Equal masses · stick', sub: '1 kg + 1 kg · 2 m/s' },
        heavy: { name: 'Heavy hits light', sub: '3 kg → 1 kg · 2 m/s' },
        light: { name: 'Light hits heavy', sub: '1 kg → 4 kg · 2.5 m/s' },
      },
      bumperLabel: 'Bumpers',
      bumpers: {
        elastic: { name: 'Springy', sub: 'elastic collision' },
        sticky: { name: 'Sticky', sub: 'inelastic collision' },
      },
      m1: 'Mass of cart 1',
      m2: 'Mass of cart 2',
      v1: 'Velocity of cart 1',
      v2: 'Velocity of cart 2',
      massHint: 'Empty cart 0.5 kg, each weight 0.5 kg',
      vHint: 'Positive — to the right, negative — to the left. Smooth track, no friction.',
      closed: {
        title: 'Why is the system closed?',
        text: 'Each cart feels gravity mg (down) and the support force N (up) — they balance, and there is no friction. Horizontally only the carts’ forces on each other remain; these internal forces cannot change the total momentum.',
      },
      axis: 'x, m',
      legend: { cart1: 'cart 1', cart2: 'cart 2', vel: 'velocity v', force: 'interaction forces', cm: 'centre of mass' },
      chipHit: 'Collision: time slowed down 20×',
      phase: { before: 'before the collision', hit: 'collision', after: 'after the collision' },
      mTag: (i, m, kg) => `m_${i} = ${m} ${kg}`,
      vTag: (sym, v, ms) => `${sym} = ${v} ${ms}`,
      cmTag: (v) => `centre of mass · ${v} m/s`,
      sceneLabel: (m1, v1, m2, v2, p) =>
        `Two carts on a smooth track: m₁ = ${m1}, v₁ = ${v1} m/s; m₂ = ${m2}, v₂ = ${v2} m/s. Total momentum ${p} kg·m/s.`,
      readouts: {
        p1: 'Momentum of cart 1',
        p2: 'Momentum of cart 2',
        sum: 'Total momentum',
        ek: 'Kinetic energy',
        pSub: (i, m, v, ms) => `p${SUB[i]} = m${SUB[i]}v${SUB[i]} = ${m} · ${v} ${ms}`,
        sumSub: (p) => `at the start ${p} — never changes`,
        ekBefore: (e) => `at the start ${e} J`,
        ekSpring: (e) => `stored in the springs: ${e} J`,
        ekHeat: (q) => `turned into heat: ${q} J`,
        ekKept: (e) => `conserved: ${e} J, as at the start`,
        ekLost: (q, pct) => `lost: ${q} J (${pct} %)`,
      },
      chart: {
        title: 'Momentum vectors',
        before: 'before',
        now: 'now',
        after: 'after',
        note: 'Momentum to the right is positive, to the left negative. The two Σp arrows are always equal: the total momentum is conserved.',
        label: (p1, p2, q1, q2, p) =>
          `Momenta: before p₁ = ${p1}, p₂ = ${p2}; now p₁ = ${q1}, p₂ = ${q2} kg·m/s. Total momentum ${p} kg·m/s.`,
      },
      calc: {
        title: 'Calculation',
        note: 'v₁, v₂ are the velocities before the collision, v₁′, v₂′ after it; to the right is positive.',
        noteApart: 'The carts do not collide — each keeps its momentum.',
      },
      energy: {
        title: 'Energy',
        ek: 'kinetic',
        ep: 'spring',
        q: 'heat',
        e: 'total',
        level: (e) => `E = ${e} J`,
        noteElastic: 'During the collision part of Eₖ is stored in the squeezed springs, then fully given back.',
        noteSticky: 'The sticky bumpers are crushed and warm up: the lost Eₖ becomes heat Q. The total energy E is still conserved.',
        label: (ek, ep, q) => `Energy: kinetic ${ek} J, in the springs ${ep} J, heat ${q} J.`,
      },
      graph: {
        title: 'Momenta p(t)',
        x: 't, s',
        y: 'p, kg·m/s',
        note: 'During the collision p₁ falls exactly as much as p₂ rises; the p₁ + p₂ line stays flat — the total momentum does not change.',
        label: 'Graph of the carts’ momenta against time',
      },
      explain: {
        idle: (p) =>
          `Press “Start”. The track is smooth: gravity is balanced by the support force and there is no friction, so the two carts form a closed system. Total momentum p = m₁v₁ + m₂v₂ = ${p} kg·m/s. What will it be after the collision?`,
        apart: (p) =>
          `v₁ ≤ v₂ — the carts do not approach each other, so there is no collision. Each keeps its own momentum; the total is ${p} kg·m/s. For a collision make v₁ > v₂.`,
        before: (p, v) =>
          `Before the collision no horizontal force acts on the carts — their velocities do not change. Total momentum p = ${p} kg·m/s. The centre of mass (◆) moves steadily at v = p/(m₁ + m₂) = ${v} m/s.`,
        hitElastic:
          'Collision! The springs are squeezed: the carts push each other with equal and opposite forces (F₁₂ = −F₂₁). Whatever momentum one cart loses, the other gains — p₁ + p₂ does not change.',
        hitSticky:
          'Collision! The sticky bumpers are crushed and stick together. The forces are equal and opposite — momentum passes from one cart to the other and the sum stays the same. Kinetic energy, though, is turning into heat.',
        doneSwap: (v1, v2) =>
          `The equal carts swapped velocities: v₁′ = ${v1} m/s, v₂′ = ${v2} m/s. In an elastic collision both momentum and kinetic energy are conserved.`,
        doneRebound: (v1, v2, p) =>
          `The light cart hit the heavier one and bounced back: v₁′ = ${v1} m/s, v₂′ = ${v2} m/s. Cart 1’s momentum changed sign, yet the total is still ${p} kg·m/s.`,
        doneHeavy: (v1, v2, p, e) =>
          `The heavy cart did not stop but went on more slowly (v₁′ = ${v1} m/s), while the light one shot off faster (v₂′ = ${v2} m/s). Total momentum ${p} kg·m/s and kinetic energy ${e} J — both conserved.`,
        doneElastic: (p, e) =>
          `Elastic collision: the total momentum is ${p} kg·m/s before and after; the kinetic energy also stayed ${e} J — the springs gave all the energy back.`,
        doneSticky: (v, e0, e1, q, pct) =>
          `Inelastic collision: the carts stuck together and moved on at v′ = ${v} m/s. Momentum was conserved, but the kinetic energy fell from ${e0} J to ${e1} J: ${q} J (${pct} %) became heat.`,
        doneStop: (e0) =>
          `The momenta were equal and opposite — the total was 0. Once stuck, both carts stopped: momentum is still 0, and all the kinetic energy (${e0} J) became heat.`,
      },
    },
    cradle: {
      countLabel: 'Balls lifted',
      count: (n) => `${n} ${n === 1 ? 'ball' : 'balls'}`,
      countSub: (n) => (n === 1 ? 'the end one' : `the end ${n} together`),
      release: 'Let go',
      hitsChip: (n) => `impacts: ${n}`,
      sceneLabel: (k, h, v, hits) =>
        `Newton’s cradle: 5 steel balls, ${k} lifted by ${h} cm, speed at impact ${v} m/s. Impacts: ${hits}.`,
      legend: { vel: 'velocity v', h: 'lift height h', path: 'path of the ball' },
      readouts: {
        v: 'Speed at impact',
        vSub: (h, now) => `v = √(2gh) = √(2·9.8·${h}) · now ${now} m/s`,
        pIn: 'Momentum before impact',
        pInSub: (k, m, v) => `p = k·m·v = ${k}·${m}·${v}`,
        pOut: 'Momentum after impact',
        pOutWait: 'wait for the impact',
        pOutSteel: (k, v) => `${k} ${k === 1 ? 'ball' : 'balls'} · v′ = ${v} m/s`,
        pOutClay: (n, v) => `${n} balls together · v′ = ${v} m/s`,
        ek: 'Kinetic energy',
        ekKept: (e) => `conserved: ${e} J before as well`,
        ekLost: (e0, pct) => `was ${e0} J — ${pct} % became heat`,
        ekSub: (n) => `at the impact, in ${n} ${n === 1 ? 'ball' : 'balls'}`,
      },
      h: 'Lift height',
      hHint: (deg, v) => `string at ${deg}° · at the bottom v = ${v} m/s`,
      matLabel: 'Between the balls',
      mats: {
        steel: { name: 'Nothing (steel)', sub: 'elastic impact' },
        clay: { name: 'Plasticine', sub: 'inelastic impact' },
      },
      info: {
        title: 'Apparatus',
        text: (r, m, l) => `Identical steel balls: radius ${r} cm, mass ${m} kg; string length ${l} cm. Air resistance is neglected.`,
      },
      why: {
        title: (k) => `Why exactly ${k} ${k === 1 ? 'ball flies' : 'balls fly'} out?`,
        lead: (k, p, e) =>
          `Before the impact p = ${p} kg·m/s, Eₖ = ${e} J. If n balls flew out on the far side at v′ = ${k}v/n, momentum would always be conserved — but kinetic energy only in one case.`,
        cols: { n: 'Flying out', verdict: 'Verdict' },
        balls: (n) => `${n}`,
        yes: 'conserved',
        no: 'not conserved',
        real: 'This happens: both p and Eₖ are conserved',
        realClay: 'This happens with plasticine',
        tooMuch: (x) => `Impossible: energy would grow ${x} times`,
        tooLittle: 'Not with steel: energy would be lost',
        tooLittleClay: 'Impossible: plasticine sticks the balls together',
        note: 'Conservation of momentum alone is not enough: for both momentum and energy to be conserved, exactly this many balls must fly out, at exactly this speed.',
        noteClay: 'Plasticine makes the impact inelastic: the balls stick and all five move together. Momentum is conserved, while part of the kinetic energy turns into heat.',
      },
      hTag: (h, cm) => `h = ${h} ${cm}`,
      vTag: (v, ms) => `v = ${v} ${ms}`,
      click: 'click!',
      together: (v, ms) => `together: v′ = ${v} ${ms}`,
      explain: {
        idle: (k, h, v) =>
          `${k} ${k === 1 ? 'ball is' : 'balls are'} lifted by ${h} cm. Press “Let go”: at the bottom they reach v = √(2gh) = ${v} m/s. How many balls will fly out on the other side?`,
        fall: (k, p) => `The balls are falling — potential energy is turning into kinetic energy. Just before the impact the momentum of the ${k} ${k === 1 ? 'ball' : 'balls'} will be p = ${p} kg·m/s.`,
        out1: (v, p) =>
          `Click! One ball hit — and one ball flew out from the far end at the same ${v} m/s. The three in the middle stayed put: the momentum (${p} kg·m/s) “ran” through them.`,
        out2: (v, p) =>
          `Two balls hit — and exactly two flew out on the other side at ${v} m/s, not one ball at 2v. Both the momentum (${p} kg·m/s) and the kinetic energy were conserved.`,
        out3: (v, p) =>
          `Three balls hit — three flew out: the middle ball never stopped and now flies with the other group. Momentum ${p} kg·m/s and speed ${v} m/s — unchanged.`,
        again: (k) =>
          `The balls swing back and hit again: each time ${k} in — ${k} out. A real cradle slowly stops because of air resistance and the heating at each impact; they are neglected here.`,
        inelastic: (k, v, p, pct, h2) =>
          `With plasticine the impact is inelastic: the balls stuck and all five moved off together at v′ = ${k}·v/5 = ${v} m/s. Momentum was conserved (${p} kg·m/s), but ${pct} % of the kinetic energy became heat — now they rise only ${h2} cm.`,
      },
    },
    recoil: {
      presetsLabel: 'Situation',
      axis: 'x, m',
      ice: 'smooth ice',
      push: 'The push! Equal and opposite forces act on both bodies for the same time — they get equal and opposite momenta: m₁v₁ = −m₂v₂.',
      legend: { vel: 'velocity v', cm: 'centre of mass' },
      cmTag: 'centre of mass',
      vTag: (i, v, ms) => `v_${i} = ${v} ${ms}`,
      mTag: (i, m, unit) => `m_${i} = ${m} ${unit}`,
      sceneLabel: (b1, v1, b2, v2) => `${b1}: v₁ = ${v1} m/s; ${b2}: v₂ = ${v2} m/s. The total momentum is zero.`,
      readouts: {
        pSub: (i, p, u) => `p${SUB[i]} = ${p} ${u}`,
        sum: 'Total momentum',
        sumSub: 'it was 0 at the start — it stays 0',
        ek: 'Kinetic energy',
      },
      chart: {
        title: 'Momentum vectors',
        before: 'at the start (at rest)',
        now: 'now',
        note: 'The two bodies get equal and opposite momenta: arrows of the same length pointing opposite ways. Σp is always 0.',
        label: (p1, p2) => `Momenta: p₁ = ${p1}, p₂ = ${p2} kg·m/s; sum 0.`,
      },
      calc: {
        title: 'Calculation',
        note: 'At the start everything was at rest: m₁v₁ + m₂v₂ = 0. The momenta are equal, but the kinetic energies are inversely proportional to the masses — the light body takes most of the energy.',
      },
      cases: {
        carts: {
          name: 'Carts with a spring',
          sub: '1 kg + 2 kg · the thread is burnt',
          b1: 'cart 1',
          b2: 'cart 2',
          action: 'Burn the thread',
          scene: 'smooth track',
          m1: 'Mass of cart 1',
          m2: 'Mass of cart 2',
          v2: 'Speed cart 2 gets',
          v1Label: 'Velocity of cart 1',
          v2Label: 'Velocity of cart 2',
          hint: 'A thread holds the squeezed spring',
          source: 'source: the squeezed spring',
          share: (pct) => `${pct} % in cart 2`,
          idle: 'A squeezed spring sits between two carts, held by a thread. Everything is at rest: total momentum 0. Press “Burn the thread” — how fast will the carts move off?',
          done: (v1, v2, p, e1, e2, r) =>
            `The spring pushed the carts apart: cart 1 went left at ${v1} m/s, cart 2 right at ${v2} m/s. The momenta are equal and opposite (${p} kg·m/s); their sum is still 0. The lighter cart is ${r} times faster.`,
        },
        gun: {
          name: 'Rifle and bullet',
          sub: '4 kg · 9 g · 800 m/s',
          b1: 'rifle',
          b2: 'bullet',
          action: 'Fire',
          scene: 'the rifle lies free',
          m1: 'Mass of the rifle',
          m2: 'Mass of the bullet',
          v2: 'Speed of the bullet',
          v1Label: 'Rifle velocity (recoil)',
          v2Label: 'Bullet velocity',
          hint: 'The powder gases push the bullet out of the barrel',
          source: 'source: burning powder',
          share: (pct) => `${pct} % in the bullet`,
          idle: 'The rifle and the bullet are at rest; nobody holds the rifle. When it fires, the powder gases push the bullet forward and the rifle backward. Press “Fire”.',
          done: (v1, v2, p, e1, e2) =>
            `The bullet flew forward at ${v2} m/s and the rifle moved back at ${v1} m/s — that is recoil. Their momenta are equal: ${p} kg·m/s. Their energies are not: the bullet has ${e2} J, the rifle only ${e1} J. A rifle is pressed firmly to the shoulder so that the shooter takes the recoil too.`,
        },
        astro: {
          name: 'Astronaut and wrench',
          sub: '100 kg · 2 kg · 5 m/s',
          b1: 'astronaut',
          b2: 'wrench',
          action: 'Throw the wrench',
          scene: 'open space',
          m1: 'Mass of the astronaut (with suit)',
          m2: 'Mass of the wrench',
          v2: 'Speed of the wrench',
          v1Label: 'Astronaut velocity',
          v2Label: 'Wrench velocity',
          hint: 'In space there is nothing to push against',
          source: 'source: the astronaut’s muscles',
          share: (pct) => `${pct} % in the wrench`,
          idle: 'An astronaut has drifted away from the spaceship — there is nothing to push against. In one hand is a wrench. What happens if it is thrown forward? Press “Throw the wrench”.',
          done: (v1, v2, p, e1, e2, r) =>
            `The wrench flew forward at ${v2} m/s and the astronaut drifted back at ${v1} m/s: ${r} times heavier, so ${r} times slower. The momenta are equal (${p} kg·m/s). This is how an astronaut can get back to the ship!`,
        },
        ship: {
          name: 'Spaceship',
          sub: '1000 kg · 10 kg of gas',
          b1: 'ship',
          b2: 'gas',
          action: 'Fire the engine',
          scene: 'jet propulsion',
          m1: 'Mass of the ship',
          m2: 'Mass of the gas portion',
          v2: 'Exhaust speed of the gas',
          v1Label: 'Ship velocity',
          v2Label: 'Gas velocity',
          hint: 'The engine throws one portion of gas backward at once',
          source: 'source: burning fuel',
          share: (pct) => `${pct} % in the gas`,
          idle: 'The spaceship is at rest. When the engine fires, the burnt fuel — gas — shoots backward at high speed. But what does the ship push against? Press “Fire the engine”.',
          done: (v1, v2, p) =>
            `The gas shot backward at ${v2} m/s and the ship moved forward at ${v1} m/s. This is jet propulsion: the ship pushes against nothing — it moves thanks to the momentum of the gas it throws out (${p} kg·m/s).`,
        },
      },
    },
    pucks: {
      presetsLabel: 'Experiment',
      presets: {
        billiard: { name: 'Billiard shot', sub: '0.2 kg + 0.2 kg · b = 8 cm' },
        central: { name: 'Head-on hit', sub: '0.2 kg + 0.2 kg · b = 0' },
        sticky: { name: 'Sticking', sub: 'sticky rim · b = 8 cm' },
        heavy: { name: 'Light into heavy', sub: '0.1 kg → 0.4 kg · b = 6 cm' },
      },
      bumperLabel: 'Puck rims',
      bumpers: {
        elastic: { name: 'Elastic', sub: 'elastic collision' },
        sticky: { name: 'Sticky', sub: 'inelastic collision' },
      },
      m1: 'Mass of puck 1',
      m2: 'Mass of puck 2',
      v: 'Velocity of puck 1',
      b: 'Off-centre distance',
      bHint: (d) => `b — distance between puck 1’s path and puck 2’s centre; for |b| ≥ ${d} cm the pucks miss`,
      chip: 'view from above',
      legend: { puck1: 'puck 1', puck2: 'puck 2', vel: 'velocity v', trail: 'trail' },
      sceneLabel: (v1, v2, px, py) =>
        `Air-hockey table seen from above: puck 1 at ${v1} m/s, puck 2 at ${v2} m/s. Total momentum: x component ${px}, y component ${py} kg·m/s.`,
      mTag: (i, m, kg) => `m_${i} = ${m} ${kg}`,
      vTag: (i, v, ms) => `v_${i} = ${v} ${ms}`,
      bTag: (b, cm) => `b = ${b} ${cm}`,
      readouts: {
        p1: 'Momentum of puck 1',
        p2: 'Momentum of puck 2',
        sum: 'Total momentum',
        ek: 'Kinetic energy',
        comp: (x, y) => `p_x = ${x} · p_y = ${y}`,
        ekBefore: (e) => `at the start ${e} J`,
        ekKept: 'conserved',
        ekLost: (q, pct) => `lost: ${q} J (${pct} %)`,
      },
      diagram: {
        title: 'Adding momentum vectors',
        before: 'Before',
        now: 'Now',
        angle: (a) => `${a}° between p₁′ and p₂′`,
        sum: (p0, px, py, u) => `Σp: at the start (${p0}; 0), now (${px}; ${py}) ${u}`,
        note: 'Vectors add tip to tail: p₂ starts where p₁ ends. The dashed arrow is the sum Σp — the same in both pictures.',
        label: (px, py) => `Momentum vector diagram. Current sum: x ${px}, y ${py} kg·m/s.`,
      },
      explain: {
        idle: (b, p) =>
          `On an air-hockey table the pucks glide almost without friction. Puck 1 hits puck 2 at b = ${b} cm off its centre. Total momentum p = ${p} kg·m/s, pointing right. Press “Start”.`,
        miss: (d) => `|b| ≥ ${d} cm — the pucks do not touch. They do not interact, so each keeps its own momentum.`,
        before: (p) => `Before the collision only puck 1 moves: total momentum p = ${p} kg·m/s, entirely along the x axis (p_y = 0).`,
        doneRight: (v1, v2, a, py1, py2) =>
          `The equal pucks flew apart at ${a}° — just like in billiards! v₁′ = ${v1} m/s, v₂′ = ${v2} m/s. Their y momenta are equal and opposite (${py1} and ${py2}), so the sum again points along x — as at the start.`,
        doneElastic: (py1, py2, px1, px2, p) =>
          `The pucks went different ways. y components: ${py1} + ${py2} = 0; x components: ${px1} + ${px2} = ${p} kg·m/s — the very momentum of the start. Momentum is conserved as a vector.`,
        doneCentral: (v) => `Head-on hit: puck 1 stopped and puck 2 moved off with its speed (${v} m/s) — just like the equal carts.`,
        doneLine: (v1, v2, p) => `Head-on hit — all along one line: v₁′ = ${v1} m/s, v₂′ = ${v2} m/s; m₁v₁′ + m₂v₂′ = ${p} kg·m/s, as at the start.`,
        doneSticky: (p, V, pct) =>
          `The pucks stuck and spun away: each one’s momentum keeps changing direction, yet their sum stays the same — ${p} kg·m/s to the right. The centre of mass (●) moves in a straight line at V = ${V} m/s. ${pct} % of the kinetic energy became heat.`,
      },
    },
  },
};

export default function MomentumConservation() {
  const T = useSimText(TEXT);
  const tb = T.card.tabs;
  return (
    <SimCard
      idPrefix="momentum"
      eyebrow={T.card.eyebrow}
      title={T.card.title}
      tabsLabel={T.card.tabsLabel}
      tabs={[
        { id: 'collide', label: tb.collide.label, sub: tb.collide.sub, icon: ArrowLeftRight, render: () => <CollideSim T={T} /> },
        { id: 'cradle', label: tb.cradle.label, sub: tb.cradle.sub, icon: CircleDot, render: () => <CradleSim T={T} /> },
        { id: 'recoil', label: tb.recoil.label, sub: tb.recoil.sub, icon: Rocket, render: () => <RecoilSim T={T} /> },
        { id: 'pucks', label: tb.pucks.label, sub: tb.pucks.sub, icon: Orbit, render: () => <PucksSim T={T} /> },
      ]}
      facts={T.facts}
    />
  );
}
