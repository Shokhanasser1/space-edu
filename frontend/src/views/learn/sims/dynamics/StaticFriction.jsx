import { useState } from 'react';
import { Footprints, Hand, Lightbulb, MoveRight, Ruler, Timer, TriangleRight, Weight } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { Arrow, Explain, RangeField, Readout, Segmented, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { useSimText } from '../kit/lang';
import {
  Chip,
  Crate,
  FArrow,
  FC,
  G,
  GroupLabel,
  LabScene,
  PAIRS,
  PaperGrid,
  PlayControls,
  Rich,
  ScaleBar,
  Slab,
  SpringScale,
  TagPill,
  XYGraph,
  forceUnit,
  niceMax,
  num,
  springScaleSpan,
  tagWidth,
  trim,
} from './StaticFriction.parts';
import InclineSim from './StaticFriction.incline';
import GripSim from './StaticFriction.grip';

/**
 * Lesson "Ishqalanish kuchi. Tinchlikdagi ishqalanish" (Dynamics, lesson 13):
 *  1. a box pulled with a spring scale — static friction is exactly as large
 *     as the pull, up to F_max = μ₀N; past it the box breaks away and friction
 *     drops to μN (μ < μ₀); the classic F_ishq(F) graph is drawn live.
 *     Preset: 10 kg, wood on wood, μ₀ = 0.5 → F_max = 0.5·10·9.8 = 49 N,
 *     μ = 0.4 → μN = 39.2 N;
 *  2. the incline — the block stays put while tg α ≤ μ₀; at α₀ = arctg μ₀
 *     (26.6° for μ₀ = 0.5) it slides, so μ₀ = tg α₀;
 *  3. useful friction — the road pushes the wheel forward with static
 *     friction, a_max = μ₀g (7.84 m/s² on dry asphalt, 0.98 m/s² on ice).
 * Every word is in TEXT below (uz / ru / en); "_xxx" is drawn as a subscript.
 */

const TEXT = {
  uz: {
    N: 'N',
    kN: 'kN',
    kg: 'kg',
    tg: 'tg',
    card: {
      eyebrow: 'Virtual laboratoriya · Dinamika',
      title: 'Ishqalanish kuchi. Tinchlikdagi ishqalanish',
      tabsLabel: 'Tajribani tanlang',
      tabs: {
        pull: { label: 'Dinamometr', sub: 'F_ishq ≤ μ₀N' },
        incline: { label: 'Qiya tekislik', sub: 'tg α ≤ μ₀' },
        grip: { label: 'Foydali ishqalanish', sub: 'a_max = μ₀g' },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: 'Ishqalanish kuchi', text: "bir-biriga tegib turgan jismlar sirtlari orasida paydo bo'ladi va sirpanishga (yoki sirpanishga urinishga) qarshi yo'naladi." },
        { term: 'Tinchlikdagi ishqalanish', text: "jism qo'zg'almaguncha tashqi kuchga teng va unga qarama-qarshi; eng katta qiymati F_max = μ₀N." },
        { term: 'Sirpanish ishqalanishi', text: "F_ishq = μN; odatda μ < μ₀, shuning uchun jismni qo'zg'atish uni sirpantirib turishdan qiyinroq." },
        { term: 'Qiya tekislik va yurish', text: "jism tg α ≤ μ₀ bo'lsa tinch turadi: μ₀ = tg α₀. Yurish va avtomobilning tezlanishi ham tinchlikdagi ishqalanish tufayli: a_max = μ₀g." },
      ],
    },
    pull: {
      pairsLabel: 'Sirtlar juftligi',
      pairs: { wood: "Yog'och — yog'och", rubber: 'Rezina — asfalt', steel: "Po'lat — muz" },
      pairSub: (m0, m) => `μ₀ = ${m0} · μ = ${m}`,
      start: 'Sekin tortish',
      mass: 'Yashik massasi',
      massHint: (w) => `Og'irlik kuchi mg = ${w} N; tayanchning reaksiya kuchi N ham shuncha`,
      force: 'Tortish kuchi',
      forceHint: "Slayderni suring yoki «Sekin tortish»ni bosing — kuch sekundiga F_max/5 ga ortadi",
      info: { title: 'Bu juftlik uchun', mu0: 'tinchlikdagi μ₀', mu: 'sirpanish μ', n: 'reaksiya N' },
      legend: { pull: 'tortish kuchi F', fric: 'ishqalanish kuchi', weight: "og'irlik kuchi mg", normal: 'reaksiya kuchi N', vel: 'tezlik v', acc: 'tezlanish a' },
      chipTime: (t) => `Real vaqt · t = ${t} s`,
      chipScale: (n) => `= ${n} N`,
      stateRest: 'Yashik tinch',
      stateSlide: 'Yashik sirpanmoqda',
      stateEnd: "Yashik stol chetida",
      tagF: (v) => `F = ${v} N`,
      tagFric: (v) => `F_ishq = ${v} N`,
      tagW: (v) => `mg = ${v} N`,
      tagN: (v) => `N = ${v} N`,
      tagV: (v) => `v = ${v} m/s`,
      tagA: (v) => `a = ${v} m/s²`,
      fmaxMark: 'F_max',
      box: (m) => `${m} kg`,
      axisX: 'x, m',
      sceneLabel: (F, f, st) => `Yashik va dinamometr yon tomondan. Tortish kuchi ${F} N, ishqalanish kuchi ${f} N. ${st}.`,
      readouts: {
        pull: 'Tortish kuchi',
        pullSub: 'dinamometr ko‘rsatishi',
        fric: 'Ishqalanish kuchi',
        fricRest: 'tinchlikdagi: F_ishq = F',
        fricSlide: 'sirpanish: F_ishq = μN',
        max: 'Eng katta tinchlikdagi',
        maxSub: (p) => `hozir F_max ning ${p}% i ishlatilmoqda`,
        maxSlide: 'chegara oshdi — yashik siljidi',
        formula: 'Formulalar sonlar bilan',
        still: 'F ≤ F_max → yashik tinch, a = 0',
      },
      graph: {
        title: 'Grafik: F_ishq ning F ga bog‘liqligi',
        x: 'F, N',
        y: 'F_ishq, N',
        theory: 'nazariya',
        live: 'tajriba',
        static: 'tinchlikdagi: F_ishq = F',
        sliding: 'sirpanish: μN',
        fmax: (v) => `F_max = μ₀N = ${v} N`,
        fk: (v) => `μN = ${v} N`,
        label: "Ishqalanish kuchining tortish kuchiga bog'liqlik grafigi",
        note: "F_max gacha ishqalanish tortish kuchiga teng (og'ma chiziq). Chegaradan o'tilgach, yashik siljiydi va ishqalanish sakrab kichikroq μN qiymatga tushadi.",
      },
      explain: {
        idle: "Yashik dinamometr bilan tortiladi. «Sekin tortish»ni bosing — tortish kuchi asta-sekin ortadi. Qizil strelka — ishqalanish kuchi: u tortishga qanday javob berishini kuzating.",
        hold: (f) => `Yashik qo'zg'almayapti: tinchlikdagi ishqalanish kuchi tortish kuchiga teng va unga qarama-qarshi — F_ishq = F = ${f} N. Teng ta'sir etuvchi kuch nolga teng.`,
        near: (fm) => `Ishqalanish kuchi eng katta qiymatiga yaqinlashdi: F_max = μ₀N = ${fm} N. Yana ozgina tortilsa, yashik joyidan siljiydi.`,
        atMax: (fm) => `F = F_max = ${fm} N — tinchlikdagi ishqalanish chegarada. Bundan katta bo'la olmaydi: kuch ozgina oshsa, yashik siljiydi.`,
        broke: (fm, fk) => `Uzilish! Tortish kuchi F_max = ${fm} N dan oshdi — yashik siljidi. Ishqalanish kuchi birdan ${fk} N gacha kamaydi: sirpanish ishqalanishi tinchlikdagidan kichik (μ < μ₀).`,
        slide: (fk, net, a) => `Yashik sirpanmoqda: F_ishq = μN = ${fk} N va o'zgarmaydi. Ortiqcha kuch F − μN = ${net} N yashikka a = ${a} m/s² tezlanish beradi.`,
        slow: (fk) => `Tortish kuchi μN = ${fk} N dan kichik: sirpanish ishqalanishi yashikni sekinlashtiryapti.`,
        done: (fm, fk) => `Grafikka qarang: F_max = ${fm} N gacha F_ishq = F (og'ma chiziq), so'ng ishqalanish sakrab ${fk} N ga tushadi. Yashikni joyidan qo'zg'atish uni sirpantirib turishdan qiyinroq.`,
      },
    },
    incline: {
      pairsLabel: 'Sirtlar juftligi',
      start: "Taxtani ko'tarish",
      angle: 'Qiyalik burchagi',
      angleHint: "Burchakni sekin oshiring va brusok qachon siljishini kuzating",
      mass: 'Brusok massasi',
      massHint: "Massa o'zgarsa, hamma kuchlar bir xil marta o'zgaradi — chegaraviy burchak o'zgarmaydi",
      legend: { weight: "og'irlik kuchi mg", normal: 'reaksiya kuchi N', fric: 'ishqalanish kuchi', comp: 'mg ning tashkil etuvchilari', vel: 'tezlik v' },
      chipScale: (n) => `= ${n} N`,
      stateRest: 'Brusok tinch',
      stateSlide: 'Brusok sirpanmoqda',
      stateEnd: 'Brusok pastga tushdi',
      tagW: (v) => `mg = ${v} N`,
      tagN: (v) => `N = ${v} N`,
      tagFric: (v) => `F_ishq = ${v} N`,
      tagV: (v) => `v = ${v} m/s`,
      compPar: 'mg sinα',
      compPerp: 'mg cosα',
      critRay: (a) => `α₀ = ${a}°`,
      meterTitle: 'tg α',
      meterMu: (m) => `μ₀ = ${m}`,
      sceneLabel: (a, st) => `Qiya tekislikdagi brusok. Qiyalik burchagi ${a} gradus. ${st}.`,
      readouts: {
        angle: 'Qiyalik burchagi',
        tan: (t, m, cmp) => `tg α = ${t} ${cmp} μ₀ = ${m}`,
        down: 'Pastga tortuvchi',
        downSub: 'mg sinα — qiyalik bo‘ylab',
        fric: 'Ishqalanish kuchi',
        fricRest: (fm) => `tinchlikdagi; chegara μ₀mg cosα = ${fm} N`,
        fricSlide: 'sirpanish: μmg cosα',
        crit: 'Chegaraviy burchak',
        critUnknown: 'taxtani ko‘tarib aniqlang',
        critSub: (m) => `μ₀ = tg α₀ = ${m}`,
      },
      graph: {
        title: 'Grafik: kuchlarning burchakka bog‘liqligi',
        x: 'α',
        y: 'F, N',
        down: 'mg sinα',
        max: 'F_max = μ₀mg cosα',
        fric: 'F_ishq',
        label: "Ishqalanish kuchi va og'irlik kuchi tashkil etuvchisining burchakka bog'liqligi",
        note: "Ikki uzuq chiziq kesishgan joy — chegaraviy burchak α₀. Undan keyin pastga tortuvchi kuch eng katta tinchlikdagi ishqalanishdan oshadi va brusok sirpanadi.",
      },
      explain: {
        flat: "Taxta gorizontal: brusokni hech narsa siljitmoqchi emas, ishqalanish kuchi nolga teng. «Taxtani ko'tarish»ni bosing — burchak asta-sekin ortadi.",
        hold: (a, d, t, m) => `α = ${a}°: og'irlik kuchining qiyalik bo'ylab tashkil etuvchisi mg sinα = ${d} N brusokni pastga tortadi, tinchlikdagi ishqalanish unga teng va qarama-qarshi. tg α = ${t} < μ₀ = ${m} — brusok tinch.`,
        near: (t, m) => `tg α = ${t} — μ₀ = ${m} ga juda yaqin: tinchlikdagi ishqalanish deyarli eng katta qiymatida. Chegaraviy burchakka oz qoldi!`,
        slide: (fk, a) => `tg α > μ₀ — brusok sirpandi! Endi F_ishq = μmg cosα = ${fk} N, tezlanish a = g(sinα − μcosα) = ${a} m/s².`,
        done: (a0, m) => `Brusok tg α μ₀ dan oshganda siljidi. Chegaraviy burchak α₀ = ${a0}°, demak μ₀ = tg α₀ = ${m}. Tinchlikdagi ishqalanish koeffitsientini shunday o'lchash mumkin — natija massaga bog'liq emas.`,
      },
    },
    grip: {
      laneLabel: "Ikkinchi yo'l qoplamasi",
      surfaces: { dry: 'Quruq asfalt', wet: "Ho'l asfalt", snow: 'Zichlangan qor', ice: 'Muz' },
      loc: { dry: 'quruq asfaltda', wet: "ho'l asfaltda", snow: 'qorda', ice: 'muzda' },
      locCap: { dry: 'Quruq asfaltda', wet: "Ho'l asfaltda", snow: 'Qorda', ice: 'Muzda' },
      surfSub: (m0, a) => `μ₀ = ${m0} · a_max = ${a} m/s²`,
      force: "G'ildirakning yo'lni itarish kuchi",
      forceHint: (f1, f2, loc) => `Buksovkasiz eng katta kuch: quruq asfaltda ${f1} kN, ${loc} ${f2} kN`,
      car: (m) => `Ikkala avtomobil massasi m = ${m} kg`,
      legend: { fric: "tinchlikdagi ishqalanish (yo'l g'ildirakni oldinga itaradi)", push: "g'ildirak yo'lni orqaga itaradi", vel: 'tezlik v' },
      laneTag: (name, m0) => `${name} · μ₀ = ${m0}`,
      slip: 'BUKSOVKA',
      chipTime: (t) => `Real vaqt · t = ${t} s`,
      tagFric: (v) => `F_ishq = ${v} kN`,
      tagV: (v) => `${v} km/soat`,
      axisX: 'x, m',
      sceneLabel: (t, v1, v2) => `Ikki yo'lda ikki avtomobil. t = ${t} s, tezliklar ${v1} va ${v2} km/soat.`,
      readouts: {
        lane: (name) => name,
        grip: (v) => `v = ${v} km/soat · g'ildirak sirpanmaydi`,
        slip: (v) => `v = ${v} km/soat · buksovka!`,
        amax: 'Eng katta tezlanish',
        formula: 'Formulalar sonlar bilan',
        ok: 'ilashadi',
        spin: 'buksovka',
      },
      how: {
        title: 'Nega oldinga yuramiz?',
        foot: "Oyoq yerni orqaga itaradi — tinchlikdagi ishqalanish oyoqni oldinga itaradi.",
        wheel: "G'ildirak yo'lni orqaga itaradi — yo'l g'ildirakni oldinga itaradi.",
        push: 'orqaga',
        fric: 'oldinga',
        label: "Oyoq va g'ildirakka ta'sir etuvchi ishqalanish kuchi sxemasi",
      },
      graph: {
        title: 'Grafik: v(t)',
        x: 't, s',
        y: 'v, m/s',
        label: "Ikki avtomobil tezligining vaqtga bog'liqlik grafigi",
        note: "Grafik qiyaligi — tezlanish. U μ₀g dan katta bo'la olmaydi: mashinani oldinga itaradigan gorizontal tashqi kuch — faqat yo'lning ishqalanish kuchi.",
      },
      explain: {
        idle: "Ikkala mashinaga bir xil kuch beriladi: g'ildirak yo'lni orqaga itaradi, yo'l esa tinchlikdagi ishqalanish kuchi bilan mashinani oldinga itaradi. «Boshlash»ni bosing.",
        both: (a) => `Ikkala yo'lda ham F ≤ μ₀mg — g'ildiraklar sirpanmaydi, tezlanishlar bir xil: a = F/m = ${a} m/s². G'ildirakning yo'lga tekkan nuqtasi bir lahza tinch turadi — shuning uchun bu tinchlikdagi ishqalanish.`,
        slip2: (loc, fm, f, a) => `${loc} F_max = μ₀mg = ${fm} kN, g'ildirak esa ${f} kN bilan itaryapti — buksovka! Endi sirpanish ishqalanishi ishlaydi: a = μg = ${a} m/s². Sirpanchiq yo'lda gazni sekin bosing.`,
        slipBoth: (fm, a) => `Hatto quruq asfaltda ham F > μ₀mg = ${fm} kN — g'ildiraklar buksovka qiladi va tezlanish atigi μg = ${a} m/s². Keskin gaz berish foyda bermaydi: sirpanish ishqalanishi kichikroq.`,
        done: (v1, loc, v2) => `4 s da quruq asfaltda v = ${v1} km/soat, ${loc} — ${v2} km/soat. Ishqalanish bo'lmaganida mashina joyidan umuman qo'zg'almas edi.`,
      },
    },
  },

  ru: {
    N: 'Н',
    kN: 'кН',
    kg: 'кг',
    tg: 'tg',
    card: {
      eyebrow: 'Виртуальная лаборатория · Динамика',
      title: 'Сила трения. Трение покоя',
      tabsLabel: 'Выберите опыт',
      tabs: {
        pull: { label: 'Динамометр', sub: 'F_тр ≤ μ₀N' },
        incline: { label: 'Наклонная плоскость', sub: 'tg α ≤ μ₀' },
        grip: { label: 'Полезное трение', sub: 'a_max = μ₀g' },
      },
    },
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Сила трения', text: 'возникает там, где поверхности тел соприкасаются, и направлена против скольжения (или попытки скольжения).' },
        { term: 'Трение покоя', text: 'пока тело не сдвинулось, равно внешней силе и направлено против неё; наибольшее значение F_max = μ₀N.' },
        { term: 'Трение скольжения', text: 'F_тр = μN; обычно μ < μ₀, поэтому сдвинуть тело труднее, чем тянуть его скользящим.' },
        { term: 'Наклон и ходьба', text: 'тело покоится, пока tg α ≤ μ₀: μ₀ = tg α₀. Ходьба и разгон автомобиля — тоже благодаря трению покоя: a_max = μ₀g.' },
      ],
    },
    pull: {
      pairsLabel: 'Пара поверхностей',
      pairs: { wood: 'Дерево — дерево', rubber: 'Резина — асфальт', steel: 'Сталь — лёд' },
      pairSub: (m0, m) => `μ₀ = ${m0} · μ = ${m}`,
      start: 'Тянуть плавно',
      mass: 'Масса ящика',
      massHint: (w) => `Сила тяжести mg = ${w} Н; сила реакции опоры N такая же`,
      force: 'Сила тяги',
      forceHint: 'Двигайте ползунок или нажмите «Тянуть плавно» — сила растёт на F_max/5 в секунду',
      info: { title: 'Для этой пары', mu0: 'покоя μ₀', mu: 'скольжения μ', n: 'реакция N' },
      legend: { pull: 'сила тяги F', fric: 'сила трения', weight: 'сила тяжести mg', normal: 'сила реакции N', vel: 'скорость v', acc: 'ускорение a' },
      chipTime: (t) => `Реальное время · t = ${t} с`,
      chipScale: (n) => `= ${n} Н`,
      stateRest: 'Ящик покоится',
      stateSlide: 'Ящик скользит',
      stateEnd: 'Ящик у края стола',
      tagF: (v) => `F = ${v} Н`,
      tagFric: (v) => `F_тр = ${v} Н`,
      tagW: (v) => `mg = ${v} Н`,
      tagN: (v) => `N = ${v} Н`,
      tagV: (v) => `v = ${v} м/с`,
      tagA: (v) => `a = ${v} м/с²`,
      fmaxMark: 'F_max',
      box: (m) => `${m} кг`,
      axisX: 'x, м',
      sceneLabel: (F, f, st) => `Ящик и динамометр сбоку. Сила тяги ${F} Н, сила трения ${f} Н. ${st}.`,
      readouts: {
        pull: 'Сила тяги',
        pullSub: 'показание динамометра',
        fric: 'Сила трения',
        fricRest: 'покоя: F_тр = F',
        fricSlide: 'скольжения: F_тр = μN',
        max: 'Наибольшее трение покоя',
        maxSub: (p) => `сейчас использовано ${p}% от F_max`,
        maxSlide: 'предел превышен — ящик сдвинулся',
        formula: 'Формулы с числами',
        still: 'F ≤ F_max → ящик покоится, a = 0',
      },
      graph: {
        title: 'График: зависимость F_тр от F',
        x: 'F, Н',
        y: 'F_тр, Н',
        theory: 'теория',
        live: 'опыт',
        static: 'покоя: F_тр = F',
        sliding: 'скольжения: μN',
        fmax: (v) => `F_max = μ₀N = ${v} Н`,
        fk: (v) => `μN = ${v} Н`,
        label: 'График зависимости силы трения от силы тяги',
        note: 'До F_max сила трения равна силе тяги (наклонная прямая). После предела ящик сдвигается, и трение скачком падает до меньшего значения μN.',
      },
      explain: {
        idle: 'Ящик тянут динамометром. Нажмите «Тянуть плавно» — сила тяги будет медленно расти. Красная стрелка — сила трения: следите, как она отвечает на тягу.',
        hold: (f) => `Ящик не сдвигается: сила трения покоя равна силе тяги и направлена против неё — F_тр = F = ${f} Н. Равнодействующая равна нулю.`,
        near: (fm) => `Сила трения близка к наибольшему значению: F_max = μ₀N = ${fm} Н. Ещё чуть-чуть — и ящик сдвинется.`,
        atMax: (fm) => `F = F_max = ${fm} Н — трение покоя на пределе. Больше оно быть не может: чуть увеличьте силу — и ящик сдвинется.`,
        broke: (fm, fk) => `Срыв! Сила тяги превысила F_max = ${fm} Н — ящик сдвинулся. Сила трения сразу упала до ${fk} Н: трение скольжения меньше трения покоя (μ < μ₀).`,
        slide: (fk, net, a) => `Ящик скользит: F_тр = μN = ${fk} Н и не меняется. Избыток силы F − μN = ${net} Н сообщает ящику ускорение a = ${a} м/с².`,
        slow: (fk) => `Сила тяги меньше μN = ${fk} Н: трение скольжения тормозит ящик.`,
        done: (fm, fk) => `Посмотрите на график: до F_max = ${fm} Н F_тр = F (наклонная прямая), затем трение скачком падает до ${fk} Н. Сдвинуть ящик труднее, чем тянуть его скользящим.`,
      },
    },
    incline: {
      pairsLabel: 'Пара поверхностей',
      start: 'Поднимать доску',
      angle: 'Угол наклона',
      angleHint: 'Медленно увеличивайте угол и следите, когда брусок сдвинется',
      mass: 'Масса бруска',
      massHint: 'При изменении массы все силы меняются в одно и то же число раз — предельный угол не меняется',
      legend: { weight: 'сила тяжести mg', normal: 'сила реакции N', fric: 'сила трения', comp: 'составляющие mg', vel: 'скорость v' },
      chipScale: (n) => `= ${n} Н`,
      stateRest: 'Брусок покоится',
      stateSlide: 'Брусок скользит',
      stateEnd: 'Брусок внизу',
      tagW: (v) => `mg = ${v} Н`,
      tagN: (v) => `N = ${v} Н`,
      tagFric: (v) => `F_тр = ${v} Н`,
      tagV: (v) => `v = ${v} м/с`,
      compPar: 'mg sinα',
      compPerp: 'mg cosα',
      critRay: (a) => `α₀ = ${a}°`,
      meterTitle: 'tg α',
      meterMu: (m) => `μ₀ = ${m}`,
      sceneLabel: (a, st) => `Брусок на наклонной плоскости. Угол наклона ${a} градусов. ${st}.`,
      readouts: {
        angle: 'Угол наклона',
        tan: (t, m, cmp) => `tg α = ${t} ${cmp} μ₀ = ${m}`,
        down: 'Скатывающая сила',
        downSub: 'mg sinα — вдоль наклона',
        fric: 'Сила трения',
        fricRest: (fm) => `покоя; предел μ₀mg cosα = ${fm} Н`,
        fricSlide: 'скольжения: μmg cosα',
        crit: 'Предельный угол',
        critUnknown: 'поднимите доску и найдите',
        critSub: (m) => `μ₀ = tg α₀ = ${m}`,
      },
      graph: {
        title: 'График: зависимость сил от угла',
        x: 'α',
        y: 'F, Н',
        down: 'mg sinα',
        max: 'F_max = μ₀mg cosα',
        fric: 'F_тр',
        label: 'Зависимость силы трения и составляющей силы тяжести от угла',
        note: 'Пересечение пунктирных кривых — предельный угол α₀. Дальше скатывающая сила больше наибольшего трения покоя, и брусок скользит.',
      },
      explain: {
        flat: 'Доска горизонтальна: ничто не пытается сдвинуть брусок, сила трения равна нулю. Нажмите «Поднимать доску» — угол будет медленно расти.',
        hold: (a, d, t, m) => `α = ${a}°: составляющая силы тяжести вдоль наклона mg sinα = ${d} Н тянет брусок вниз, сила трения покоя равна ей и направлена против. tg α = ${t} < μ₀ = ${m} — брусок покоится.`,
        near: (t, m) => `tg α = ${t} — совсем близко к μ₀ = ${m}: трение покоя почти наибольшее. До предельного угла осталось чуть-чуть!`,
        slide: (fk, a) => `tg α > μ₀ — брусок поехал! Теперь F_тр = μmg cosα = ${fk} Н, ускорение a = g(sinα − μcosα) = ${a} м/с².`,
        done: (a0, m) => `Брусок поехал, как только tg α превысил μ₀. Предельный угол α₀ = ${a0}°, значит μ₀ = tg α₀ = ${m}. Так можно измерить коэффициент трения покоя — результат не зависит от массы.`,
      },
    },
    grip: {
      laneLabel: 'Покрытие второй дороги',
      surfaces: { dry: 'Сухой асфальт', wet: 'Мокрый асфальт', snow: 'Укатанный снег', ice: 'Лёд' },
      loc: { dry: 'на сухом асфальте', wet: 'на мокром асфальте', snow: 'на снегу', ice: 'на льду' },
      locCap: { dry: 'На сухом асфальте', wet: 'На мокром асфальте', snow: 'На снегу', ice: 'На льду' },
      surfSub: (m0, a) => `μ₀ = ${m0} · a_max = ${a} м/с²`,
      force: 'Сила, с которой колесо толкает дорогу',
      forceHint: (f1, f2, loc) => `Наибольшая сила без пробуксовки: на сухом асфальте ${f1} кН, ${loc} ${f2} кН`,
      car: (m) => `Масса каждого автомобиля m = ${m} кг`,
      legend: { fric: 'трение покоя (дорога толкает колесо вперёд)', push: 'колесо толкает дорогу назад', vel: 'скорость v' },
      laneTag: (name, m0) => `${name} · μ₀ = ${m0}`,
      slip: 'ПРОБУКСОВКА',
      chipTime: (t) => `Реальное время · t = ${t} с`,
      tagFric: (v) => `F_тр = ${v} кН`,
      tagV: (v) => `${v} км/ч`,
      axisX: 'x, м',
      sceneLabel: (t, v1, v2) => `Два автомобиля на двух дорогах. t = ${t} с, скорости ${v1} и ${v2} км/ч.`,
      readouts: {
        lane: (name) => name,
        grip: (v) => `v = ${v} км/ч · колесо не проскальзывает`,
        slip: (v) => `v = ${v} км/ч · пробуксовка!`,
        amax: 'Наибольшее ускорение',
        formula: 'Формулы с числами',
        ok: 'сцепление',
        spin: 'пробуксовка',
      },
      how: {
        title: 'Почему мы движемся вперёд?',
        foot: 'Нога толкает землю назад — трение покоя толкает ногу вперёд.',
        wheel: 'Колесо толкает дорогу назад — дорога толкает колесо вперёд.',
        push: 'назад',
        fric: 'вперёд',
        label: 'Схема силы трения, действующей на ногу и на колесо',
      },
      graph: {
        title: 'График: v(t)',
        x: 't, с',
        y: 'v, м/с',
        label: 'График зависимости скорости двух автомобилей от времени',
        note: 'Наклон графика — ускорение. Оно не может быть больше μ₀g: единственная внешняя горизонтальная сила, толкающая машину вперёд, — сила трения дороги.',
      },
      explain: {
        idle: 'Обе машины получают одинаковую силу: колесо толкает дорогу назад, а дорога силой трения покоя толкает машину вперёд. Нажмите «Старт».',
        both: (a) => `На обеих дорогах F ≤ μ₀mg — колёса не проскальзывают, ускорения одинаковы: a = F/m = ${a} м/с². Точка колеса, касающаяся дороги, в этот миг покоится — поэтому это трение покоя.`,
        slip2: (loc, fm, f, a) => `${loc} F_max = μ₀mg = ${fm} кН, а колесо толкает с силой ${f} кН — пробуксовка! Теперь действует трение скольжения: a = μg = ${a} м/с². На скользкой дороге газ нажимают плавно.`,
        slipBoth: (fm, a) => `Даже на сухом асфальте F > μ₀mg = ${fm} кН — колёса буксуют, и ускорение всего μg = ${a} м/с². Резкий газ не помогает: трение скольжения меньше.`,
        done: (v1, loc, v2) => `За 4 с на сухом асфальте v = ${v1} км/ч, ${loc} — ${v2} км/ч. Без трения машина вообще не сдвинулась бы с места.`,
      },
    },
  },

  en: {
    N: 'N',
    kN: 'kN',
    kg: 'kg',
    tg: 'tan',
    card: {
      eyebrow: 'Virtual laboratory · Dynamics',
      title: 'Friction force. Static friction',
      tabsLabel: 'Choose an experiment',
      tabs: {
        pull: { label: 'Spring scale', sub: 'F_fr ≤ μ₀N' },
        incline: { label: 'Incline', sub: 'tan α ≤ μ₀' },
        grip: { label: 'Useful friction', sub: 'a_max = μ₀g' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Run again', reset: 'Reset' },
    facts: {
      title: 'Remember',
      items: [
        { term: 'Friction force', text: 'arises where the surfaces of bodies touch and opposes sliding (or attempted sliding).' },
        { term: 'Static friction', text: 'until the body moves it equals the applied force and points the other way; its largest value is F_max = μ₀N.' },
        { term: 'Sliding friction', text: 'F_fr = μN; usually μ < μ₀, so getting a body moving is harder than keeping it sliding.' },
        { term: 'Incline and walking', text: 'a body stays put while tan α ≤ μ₀, so μ₀ = tan α₀. Walking and a car speeding up rely on static friction too: a_max = μ₀g.' },
      ],
    },
    pull: {
      pairsLabel: 'Pair of surfaces',
      pairs: { wood: 'Wood — wood', rubber: 'Rubber — asphalt', steel: 'Steel — ice' },
      pairSub: (m0, m) => `μ₀ = ${m0} · μ = ${m}`,
      start: 'Pull slowly',
      mass: 'Mass of the box',
      massHint: (w) => `Weight mg = ${w} N; the normal force N is the same`,
      force: 'Pulling force',
      forceHint: 'Drag the slider or press “Pull slowly” — the force grows by F_max/5 each second',
      info: { title: 'For this pair', mu0: 'static μ₀', mu: 'sliding μ', n: 'normal N' },
      legend: { pull: 'pulling force F', fric: 'friction force', weight: 'weight mg', normal: 'normal force N', vel: 'velocity v', acc: 'acceleration a' },
      chipTime: (t) => `Real time · t = ${t} s`,
      chipScale: (n) => `= ${n} N`,
      stateRest: 'Box at rest',
      stateSlide: 'Box sliding',
      stateEnd: 'Box at the table edge',
      tagF: (v) => `F = ${v} N`,
      tagFric: (v) => `F_fr = ${v} N`,
      tagW: (v) => `mg = ${v} N`,
      tagN: (v) => `N = ${v} N`,
      tagV: (v) => `v = ${v} m/s`,
      tagA: (v) => `a = ${v} m/s²`,
      fmaxMark: 'F_max',
      box: (m) => `${m} kg`,
      axisX: 'x, m',
      sceneLabel: (F, f, st) => `Side view of the box and the spring scale. Pull ${F} N, friction ${f} N. ${st}.`,
      readouts: {
        pull: 'Pulling force',
        pullSub: 'spring scale reading',
        fric: 'Friction force',
        fricRest: 'static: F_fr = F',
        fricSlide: 'sliding: F_fr = μN',
        max: 'Maximum static',
        maxSub: (p) => `${p}% of F_max is in use now`,
        maxSlide: 'limit exceeded — the box moved',
        formula: 'Formulas with numbers',
        still: 'F ≤ F_max → box at rest, a = 0',
      },
      graph: {
        title: 'Graph: friction F_fr against the pull F',
        x: 'F, N',
        y: 'F_fr, N',
        theory: 'theory',
        live: 'experiment',
        static: 'static: F_fr = F',
        sliding: 'sliding: μN',
        fmax: (v) => `F_max = μ₀N = ${v} N`,
        fk: (v) => `μN = ${v} N`,
        label: 'Graph of the friction force against the pulling force',
        note: 'Up to F_max the friction equals the pull (the sloping line). Past the limit the box moves and friction drops suddenly to the smaller value μN.',
      },
      explain: {
        idle: 'The box is pulled with a spring scale. Press “Pull slowly” — the pull grows little by little. The red arrow is the friction force: watch how it answers the pull.',
        hold: (f) => `The box does not move: static friction equals the pull and points the opposite way — F_fr = F = ${f} N. The net force is zero.`,
        near: (fm) => `Friction is close to its maximum: F_max = μ₀N = ${fm} N. A little more and the box will move.`,
        atMax: (fm) => `F = F_max = ${fm} N — static friction is at its limit. It cannot grow any larger: pull a bit harder and the box moves.`,
        broke: (fm, fk) => `Breakaway! The pull exceeded F_max = ${fm} N — the box moved. Friction dropped at once to ${fk} N: sliding friction is smaller than static friction (μ < μ₀).`,
        slide: (fk, net, a) => `The box is sliding: F_fr = μN = ${fk} N and stays constant. The extra force F − μN = ${net} N gives the box an acceleration a = ${a} m/s².`,
        slow: (fk) => `The pull is less than μN = ${fk} N: sliding friction is slowing the box down.`,
        done: (fm, fk) => `Look at the graph: up to F_max = ${fm} N, F_fr = F (the sloping line), then friction drops suddenly to ${fk} N. Getting the box moving is harder than keeping it sliding.`,
      },
    },
    incline: {
      pairsLabel: 'Pair of surfaces',
      start: 'Raise the board',
      angle: 'Angle of the incline',
      angleHint: 'Raise the angle slowly and watch when the block starts to slide',
      mass: 'Mass of the block',
      massHint: 'Changing the mass scales every force by the same factor — the critical angle stays the same',
      legend: { weight: 'weight mg', normal: 'normal force N', fric: 'friction force', comp: 'components of mg', vel: 'velocity v' },
      chipScale: (n) => `= ${n} N`,
      stateRest: 'Block at rest',
      stateSlide: 'Block sliding',
      stateEnd: 'Block at the bottom',
      tagW: (v) => `mg = ${v} N`,
      tagN: (v) => `N = ${v} N`,
      tagFric: (v) => `F_fr = ${v} N`,
      tagV: (v) => `v = ${v} m/s`,
      compPar: 'mg sinα',
      compPerp: 'mg cosα',
      critRay: (a) => `α₀ = ${a}°`,
      meterTitle: 'tan α',
      meterMu: (m) => `μ₀ = ${m}`,
      sceneLabel: (a, st) => `A block on an incline. Angle ${a} degrees. ${st}.`,
      readouts: {
        angle: 'Incline angle',
        tan: (t, m, cmp) => `tan α = ${t} ${cmp} μ₀ = ${m}`,
        down: 'Down-slope pull',
        downSub: 'mg sinα — along the slope',
        fric: 'Friction force',
        fricRest: (fm) => `static; limit μ₀mg cosα = ${fm} N`,
        fricSlide: 'sliding: μmg cosα',
        crit: 'Critical angle',
        critUnknown: 'raise the board to find it',
        critSub: (m) => `μ₀ = tan α₀ = ${m}`,
      },
      graph: {
        title: 'Graph: forces against the angle',
        x: 'α',
        y: 'F, N',
        down: 'mg sinα',
        max: 'F_max = μ₀mg cosα',
        fric: 'F_fr',
        label: 'Friction force and the weight component against the angle',
        note: 'Where the dashed curves cross is the critical angle α₀. Beyond it the down-slope pull is larger than the maximum static friction and the block slides.',
      },
      explain: {
        flat: 'The board is level: nothing tries to move the block, so friction is zero. Press “Raise the board” — the angle grows slowly.',
        hold: (a, d, t, m) => `α = ${a}°: the weight component along the slope, mg sinα = ${d} N, pulls the block down; static friction is equal and opposite. tan α = ${t} < μ₀ = ${m} — the block stays put.`,
        near: (t, m) => `tan α = ${t} — very close to μ₀ = ${m}: static friction is almost at its maximum. The critical angle is near!`,
        slide: (fk, a) => `tan α > μ₀ — the block slides! Now F_fr = μmg cosα = ${fk} N and a = g(sinα − μcosα) = ${a} m/s².`,
        done: (a0, m) => `The block slid as soon as tan α exceeded μ₀. The critical angle is α₀ = ${a0}°, so μ₀ = tan α₀ = ${m}. This is how the coefficient of static friction can be measured — the mass does not matter.`,
      },
    },
    grip: {
      laneLabel: 'Second road surface',
      surfaces: { dry: 'Dry asphalt', wet: 'Wet asphalt', snow: 'Packed snow', ice: 'Ice' },
      loc: { dry: 'on dry asphalt', wet: 'on wet asphalt', snow: 'on snow', ice: 'on ice' },
      locCap: { dry: 'On dry asphalt', wet: 'On wet asphalt', snow: 'On snow', ice: 'On ice' },
      surfSub: (m0, a) => `μ₀ = ${m0} · a_max = ${a} m/s²`,
      force: 'Force of the wheel pushing the road',
      forceHint: (f1, f2, loc) => `Largest force without wheelspin: ${f1} kN on dry asphalt, ${f2} kN ${loc}`,
      car: (m) => `Each car has mass m = ${m} kg`,
      legend: { fric: 'static friction (the road pushes the wheel forward)', push: 'the wheel pushes the road back', vel: 'velocity v' },
      laneTag: (name, m0) => `${name} · μ₀ = ${m0}`,
      slip: 'WHEELSPIN',
      chipTime: (t) => `Real time · t = ${t} s`,
      tagFric: (v) => `F_fr = ${v} kN`,
      tagV: (v) => `${v} km/h`,
      axisX: 'x, m',
      sceneLabel: (t, v1, v2) => `Two cars on two roads. t = ${t} s, speeds ${v1} and ${v2} km/h.`,
      readouts: {
        lane: (name) => name,
        grip: (v) => `v = ${v} km/h · the wheel does not slip`,
        slip: (v) => `v = ${v} km/h · wheelspin!`,
        amax: 'Maximum acceleration',
        formula: 'Formulas with numbers',
        ok: 'grip',
        spin: 'wheelspin',
      },
      how: {
        title: 'Why do we move forward?',
        foot: 'The foot pushes the ground back — static friction pushes the foot forward.',
        wheel: 'The wheel pushes the road back — the road pushes the wheel forward.',
        push: 'back',
        fric: 'forward',
        label: 'Diagram of the friction force on a foot and on a wheel',
      },
      graph: {
        title: 'Graph: v(t)',
        x: 't, s',
        y: 'v, m/s',
        label: 'Graph of the speed of the two cars against time',
        note: 'The slope of the graph is the acceleration. It cannot exceed μ₀g: the only external horizontal force pushing the car forward is the road’s friction.',
      },
      explain: {
        idle: 'Both cars get the same force: the wheel pushes the road back and the road pushes the car forward with static friction. Press Start.',
        both: (a) => `On both roads F ≤ μ₀mg — the wheels do not slip and the accelerations are equal: a = F/m = ${a} m/s². The point of the tyre touching the road is at rest for an instant — that is why this is static friction.`,
        slip2: (loc, fm, f, a) => `${loc} F_max = μ₀mg = ${fm} kN, but the wheel pushes with ${f} kN — wheelspin! Now sliding friction acts: a = μg = ${a} m/s². On a slippery road, press the pedal gently.`,
        slipBoth: (fm, a) => `Even on dry asphalt F > μ₀mg = ${fm} kN — the wheels spin and the acceleration is only μg = ${a} m/s². Flooring it does not help: sliding friction is smaller.`,
        done: (v1, loc, v2) => `After 4 s: v = ${v1} km/h on dry asphalt, ${v2} km/h ${loc}. Without friction the car would not move at all.`,
      },
    },
  },
};

/* ================================================================= card */

export default function StaticFriction() {
  const T = useSimText(TEXT);
  const tabs = [
    { id: 'pull', ...T.card.tabs.pull, sub: <Rich>{T.card.tabs.pull.sub}</Rich>, icon: Hand, render: () => <PullSim T={T} /> },
    { id: 'incline', ...T.card.tabs.incline, icon: TriangleRight, render: () => <InclineSim T={T} /> },
    { id: 'grip', ...T.card.tabs.grip, sub: <Rich>{T.card.tabs.grip.sub}</Rich>, icon: Footprints, render: () => <GripSim T={T} /> },
  ];
  const facts = { title: T.facts.title, items: T.facts.items.map((f) => ({ term: f.term, text: <Rich>{f.text}</Rich> })) };
  return <SimCard eyebrow={T.card.eyebrow} title={T.card.title} tabsLabel={T.card.tabsLabel} tabs={tabs} facts={facts} icon={Hand} idPrefix="sfric" />;
}

/* ============================================== pull with a spring scale */

const D_TRAVEL = 2; // m the box may slide before the table ends
const RAMP_TIME = 5; // s for the slow pull to reach F_max
const CAP = 1.5; // the pull never exceeds 1.5·F_max
const IDLE = { F: 0, x: 0, v: 0, t: 0, sliding: false, running: false, ramp: false, done: false, tBreak: -9, trace: [{ x: 0, y: 0 }] };

function pullConfig(pairId, m) {
  const p = PAIRS[pairId];
  const n = m * G;
  const fmax = p.mu0 * n;
  return { ...p, m, n, fmax, fk: p.mu * n, cap: CAP * fmax, rate: fmax / RAMP_TIME };
}

const frictionOf = (s, c) => (s.sliding ? c.fk : Math.min(s.F, c.fmax));

function addTrace(trace, F, f, c) {
  const last = trace[trace.length - 1];
  if (Math.abs(F - last.x) < c.cap / 400 && Math.abs(f - last.y) < c.cap / 400) return trace;
  return [...trace, { x: F, y: f }];
}

/** Starts sliding: friction drops from F_max to μN at the breakaway pull F_max. */
function breakAway(s, c) {
  return { ...s, sliding: true, tBreak: s.t, trace: [...addTrace(s.trace, c.fmax, c.fmax, c), { x: c.fmax, y: c.fk }] };
}

function stepPull(p, dt, c) {
  let s = { ...p, t: p.t + dt };
  if (s.ramp) s.F = Math.min(c.cap, s.F + c.rate * dt);
  if (!s.sliding && s.F > c.fmax + 1e-9) s = breakAway(s, c);
  if (s.sliding) {
    const a = (s.F - c.fk) / c.m;
    s.v += a * dt;
    if (s.v <= 0) {
      s.v = 0;
      s.sliding = false;
    }
    s.x += s.v * dt;
    if (s.x >= D_TRAVEL) {
      s = { ...s, x: D_TRAVEL, done: true, running: false, ramp: false };
    }
  }
  if (!s.ramp && !s.sliding) s.running = false;
  s.trace = addTrace(s.trace, s.F, frictionOf(s, c), c);
  return s;
}

function PullSim({ T }) {
  const L = T.pull;
  const dec = T.decimal;
  const [pair, setPair] = useState('wood');
  const [m, setM] = useState(10);
  const [sim, setSim] = useState(IDLE);
  const c = pullConfig(pair, m);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => (p.running ? stepPull(p, dt, c) : p));
  });

  const pick = (id) => {
    setPair(id);
    setSim(IDLE);
  };
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true, ramp: true });
    else if (sim.running) setSim((p) => ({ ...p, running: false }));
    else setSim((p) => ({ ...p, running: true, ramp: p.F < c.cap }));
  };
  const reset = () => setSim(IDLE);
  const setForce = (F) => {
    setSim((p0) => {
      const p = p0.done ? { ...IDLE, trace: [{ x: 0, y: 0 }] } : p0;
      let s = { ...p, F, ramp: false };
      if (!s.sliding && F > c.fmax + 1e-9) s = breakAway(s, c);
      if (s.sliding) s.running = true;
      else s.running = false;
      s.trace = addTrace(s.trace, F, frictionOf(s, c), c);
      return s;
    });
  };

  const F = sim.F;
  const f = frictionOf(sim, c);
  const aNow = sim.sliding ? (F - c.fk) / m : 0;
  const N1 = (n) => trim(Number(n.toFixed(2)), dec, 2);
  const F1 = (n) => num(n, 1, dec);

  let key = 'idle';
  if (sim.done) key = 'done';
  else if (sim.sliding) key = sim.t - sim.tBreak < 1.4 ? 'broke' : F < c.fk ? 'slow' : 'slide';
  else if (F < 1e-6) key = 'idle';
  else if (Math.abs(F - c.fmax) < 1e-6) key = 'atMax';
  else if (F >= 0.85 * c.fmax) key = 'near';
  else key = 'hold';
  const settled = useSettled(key, key === 'idle' || key === 'broke' || key === 'done' || key === 'atMax' ? 0 : 250);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    hold: ex.hold(F1(f)),
    near: ex.near(N1(c.fmax)),
    atMax: ex.atMax(N1(c.fmax)),
    broke: ex.broke(N1(c.fmax), N1(c.fk)),
    slide: ex.slide(N1(c.fk), F1(F - c.fk), num(aNow, 2, dec)),
    slow: ex.slow(N1(c.fk)),
    done: ex.done(N1(c.fmax), N1(c.fk)),
  }[settled];
  const tone = { idle: '#22d3ee', hold: '#2dd4bf', near: '#fbbf24', atMax: '#fbbf24', broke: '#f87171', slide: '#f87171', slow: '#60a5fa', done: '#34d399' }[settled];
  const usePct = Math.round((Math.min(F, c.fmax) / c.fmax) * 100);
  const started = sim.t > 0 || F > 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.pairsLabel}</GroupLabel>
          <Segmented
            label={L.pairsLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={pair}
            onChange={pick}
            options={Object.keys(PAIRS).map((id) => ({
              value: id,
              label: L.pairs[id],
              sub: L.pairSub(trim(PAIRS[id].mu0, dec), trim(PAIRS[id].mu, dec)),
              icon: PAIRS[id].icon,
            }))}
          />
        </div>
        <PlayControls labels={T.common} startLabel={L.start} running={sim.running} done={sim.done} started={started} onToggle={toggle} onReset={reset} />
      </div>

      <PullScene T={T} c={c} sim={sim} f={f} a={aNow} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.pull} symbol="F" value={F1(F)} unit={T.N} accent={FC.pull} textColor={FC.pullText} sub={L.readouts.pullSub} />
        <Readout
          label={L.readouts.fric}
          symbol={<Rich>{L.tagFric('').split(' =')[0]}</Rich>}
          value={F1(f)}
          unit={T.N}
          accent={FC.fric}
          textColor={FC.fricText}
          active={sim.sliding}
          sub={<Rich>{sim.sliding ? L.readouts.fricSlide : L.readouts.fricRest}</Rich>}
        />
        <Readout
          label={L.readouts.max}
          symbol={<Rich>F_max</Rich>}
          value={F1(c.fmax)}
          unit={T.N}
          accent="#fbbf24"
          textColor="#fde68a"
          sub={<Rich>{sim.sliding || sim.done ? L.readouts.maxSlide : L.readouts.maxSub(usePct)}</Rich>}
        >
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full transition-[width] duration-75" style={{ width: `${sim.sliding || sim.done ? 100 : usePct}%`, background: sim.sliding || sim.done ? '#f87171' : '#fbbf24' }} />
          </div>
        </Readout>
        <Readout label={L.readouts.formula} accent="#e2e8f0">
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug">
            <p>
              <span className="font-serif italic text-gray-200">
                <Rich>F_max = μ₀·m·g</Rich>
              </span>
              <br />
              <span className="tabular-nums text-gray-400">
                = {trim(c.mu0, dec)} · {m} · {trim(G, dec)} = <b className="text-[#fde68a]">{N1(c.fmax)}</b> {T.N}
              </span>
            </p>
            <p>
              <span className="font-serif italic text-gray-200">μ·m·g</span>{' '}
              <span className="tabular-nums text-gray-400">
                = {trim(c.mu, dec)} · {m} · {trim(G, dec)} = <b className="text-[#fca5a5]">{N1(c.fk)}</b> {T.N}
              </span>
            </p>
            <p className="tabular-nums text-gray-400">
              {sim.sliding ? (
                <>
                  <span className="font-serif italic text-gray-200">a = (F − μmg)/m</span> = ({F1(F)} − {N1(c.fk)}) / {m} ={' '}
                  <b className="text-[#fdba74]">{num(aNow, 2, dec)}</b> {T.ms2}
                </>
              ) : (
                <Rich>{L.readouts.still}</Rich>
              )}
            </p>
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="sf-mass"
            label={L.mass}
            symbol="m"
            min={1}
            max={20}
            step={1}
            value={m}
            onChange={(n) => {
              setM(n);
              setSim(IDLE);
            }}
            accent={FC.weightLine}
            display={`${m} ${T.kg}`}
            hint={L.massHint(N1(c.n))}
          />
          <RangeField
            id="sf-force"
            label={L.force}
            symbol="F"
            min={0}
            max={Number(c.cap.toFixed(2))}
            step={c.cap > 30 ? 0.5 : 0.05}
            value={Math.min(F, Number(c.cap.toFixed(2)))}
            onChange={setForce}
            accent={FC.pullLine}
            display={`${F1(F)} ${T.N}`}
            hint={<Rich>{L.forceHint}</Rich>}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.info.title}</p>
            <dl className="mt-1.5 grid grid-cols-3 gap-2 text-center">
              {[
                [L.info.mu0, trim(c.mu0, dec), '#fde68a'],
                [L.info.mu, trim(c.mu, dec), FC.fricText],
                [L.info.n, `${N1(c.n)} ${T.N}`, FC.normalText],
              ].map(([k, v, col]) => (
                <div key={k}>
                  <dt className="text-[11px] leading-tight text-gray-500">{k}</dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums" style={{ color: col }}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <PullGraph T={T} c={c} sim={sim} f={f} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- graph */

function PullGraph({ T, c, sim, f }) {
  const L = T.pull.graph;
  const dec = T.decimal;
  const xMax = niceMax(c.cap);
  const yMax = niceMax(c.fmax * 1.12);
  const N1 = (n) => trim(Number(n.toFixed(2)), dec, 2);
  const theory = [
    { x: 0, y: 0 },
    { x: c.fmax, y: c.fmax },
    { x: c.fmax, y: c.fk },
    { x: xMax, y: c.fk },
  ];
  return (
    <XYGraph
      title={L.title}
      legend={[
        { label: L.theory, color: 'rgba(248,113,113,0.55)', dash: '5 4' },
        { label: L.live, color: FC.fricLine },
      ]}
      series={[
        { id: 'theory', points: theory, color: FC.fricLine, dash: '5 5', width: 1.6, opacity: 0.5 },
        { id: 'live', points: sim.trace, color: FC.fricLine, width: 3 },
      ]}
      hLines={[
        { y: c.fmax, color: '#fbbf24', label: L.fmax(N1(c.fmax)) },
        { y: c.fk, color: '#fca5a5', label: L.fk(N1(c.fk)), below: true },
      ]}
      notes={[
        { x: c.fmax * 0.52, y: c.fmax * 0.52, text: L.static, color: '#94a3b8', anchor: 'start', dy: 18 },
        { x: (c.fmax + xMax) / 2, y: c.fk, text: L.sliding, color: '#94a3b8', dy: 16 },
      ]}
      dots={[{ x: sim.F, y: f, color: '#fca5a5' }]}
      marker={sim.F}
      xMax={xMax}
      yMax={yMax}
      xLabel={L.x}
      yLabel={L.y}
      decimal={dec}
      ariaLabel={L.label}
      note={<Rich>{L.note}</Rich>}
      height={230}
    />
  );
}

/* ---------------------------------------------------------------- scene */

/** Layout of the pull scene for a drawing W wide (shared by the drawing and the scale chip). */
const PULL_A = { wide: 150, narrow: 104 }; // px of the weight arrow mg (= N)
const pullHeight = (narrow) => {
  const A = narrow ? PULL_A.narrow : PULL_A.wide;
  return (narrow ? 26 : 64) + A - (narrow ? 27 : 41) + A + 10 + (narrow ? 32 : 34);
};

function pullGeom(W, narrow, c) {
  const A = narrow ? PULL_A.narrow : PULL_A.wide;
  const boxW = narrow ? 66 : 108;
  const boxH = narrow ? 54 : 82;
  // the reaction N reaches up from the floor to just under the legend, the weight mg down to the ruler
  const floorY = (narrow ? 26 : 64) + A;
  const cy = floorY - boxH / 2;
  const rulerY = cy + A + 10;
  const springLen = narrow ? 62 : 124;
  const span = springScaleSpan(springLen, 1);
  const free = W - (narrow ? 38 : 110) - (boxW + span);
  const travelPx = Math.max(60, narrow ? free : Math.min(free, W * 0.36));
  const x0 = narrow ? 30 : Math.max(84, (W - (boxW + span + travelPx)) / 2);
  const k = A / c.n;
  return { boxW, boxH, floorY, rulerY, x0, springLen, springH: narrow ? 15 : 22, slabH: narrow ? 14 : 18, travelPx, kx: travelPx / D_TRAVEL, cy, k, unit: forceUnit(k, narrow ? 26 : 36) };
}

function PullScene({ T, c, sim, f, a }) {
  const L = T.pull;
  const dec = T.decimal;
  const N1 = (n) => trim(Number(n.toFixed(2)), dec, 2);
  const F1 = (n) => num(n, 1, dec);
  const state = sim.done ? L.stateEnd : sim.sliding ? L.stateSlide : L.stateRest;

  return (
    <LabScene
      legend={[
        { color: FC.pull, label: L.legend.pull, kind: 'arrow' },
        { color: FC.fric, label: L.legend.fric, kind: 'arrow' },
        { color: FC.weight, label: L.legend.weight, kind: 'arrow' },
        { color: FC.normal, label: L.legend.normal, kind: 'arrow' },
      ]}
      chips={(W, H, narrow) => {
        const g = pullGeom(W, narrow, c);
        return (
          <>
            <Chip icon={sim.sliding ? MoveRight : Weight} strong color={sim.done ? '#059669' : sim.sliding ? '#dc2626' : '#0f766e'}>
              {state}
            </Chip>
            {!narrow && <Chip icon={Timer}>{L.chipTime(num(sim.t, 1, dec))}</Chip>}
            <Chip icon={Ruler} color="#475569">
              <ScaleBar px={g.unit * g.k} text={L.chipScale(trim(g.unit, dec))} />
            </Chip>
          </>
        );
      }}
      height={(W, narrow) => pullHeight(narrow)}
      ariaLabel={L.sceneLabel(F1(sim.F), F1(f), state)}
    >
      {(W, H, narrow) => {
        const { boxW, boxH, floorY, rulerY, x0, springLen, springH, slabH, travelPx, kx, cy, k } = pullGeom(W, narrow, c);
        const fs = narrow ? 11 : 12;
        const boxL = x0 + sim.x * kx;
        const boxR = boxL + boxW;
        const cx = boxL + boxW / 2;
        const top = floorY - boxH;
        const box = { w: W, h: H };
        const hookY = floorY - boxH * 0.34;
        const pullY = top + boxH * 0.2;
        const fricY = floorY - 4;
        const mgX = cx - (narrow ? 6 : 9);
        const nX = cx + (narrow ? 6 : 9);
        const fLen = f * k;
        const pLen = sim.F * k;
        const fmaxX = cx - c.fmax * k;
        const moving = sim.sliding && sim.v > 0.005;
        const vk = (narrow ? 34 : 60) / 2.5;
        const ak = narrow ? 14 : 24;
        const rulerStep = niceStep(kx, narrow ? 46 : 70);
        const ticks = [];
        for (let i = 0; i < 400; i += 1) {
          const xm = (i * rulerStep) / 2;
          if (xm > D_TRAVEL + 1e-9) break;
          ticks.push({ xm, px: x0 + xm * kx, major: i % 2 === 0 });
        }
        const endX = x0 + travelPx + boxW; // the table ends here
        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <PaperGrid W={W} top={0} bottom={H} step={narrow ? 22 : 28} />
            {/* table top made of the chosen material, and the ruler under it */}
            <Slab x0={0} x1={endX + 4} y={floorY} h={slabH} kind={c.floor} />
            <rect x={0} y={floorY + slabH} width={endX + 4} height={H - floorY - slabH} fill="#f1f5f9" />
            <line x1={endX + 4} x2={endX + 4} y1={floorY} y2={H} stroke="#94a3b8" strokeWidth="1.5" />
            <line x1={x0 - 12} x2={x0 + D_TRAVEL * kx + 12} y1={rulerY} y2={rulerY} stroke="#475569" strokeWidth="1.3" />
            {ticks.map((t) => (
              <g key={t.xm.toFixed(3)}>
                <line x1={t.px} x2={t.px} y1={rulerY} y2={rulerY + (t.major ? 8 : 4)} stroke="#475569" strokeWidth={t.major ? 1.3 : 1} />
                {t.major && t.px < W - 40 && (
                  <text x={t.px} y={rulerY + 20} textAnchor="middle" fontSize={fs - 1} fill="#475569" fontWeight={t.xm === 0 ? 700 : 500}>
                    {trim(t.xm, dec, 2)}
                  </text>
                )}
              </g>
            ))}
            <text x={x0 + D_TRAVEL * kx + 16} y={rulerY + 4} fontSize={fs - 1} fontWeight="700" fill="#475569">
              {L.axisX}
            </text>
            <line x1={x0} x2={x0} y1={floorY - 6} y2={rulerY} stroke={FC.ink} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" />

            {/* spring scale and hand */}
            <SpringScale x1={boxR} y={hookY} len={springLen} frac={Math.min(1, sim.F / c.cap)} h={springH} fs={fs - 1} />

            {/* the box */}
            <Crate x={boxL} yBottom={floorY} w={boxW} h={boxH} foot={c.foot} label={narrow ? null : L.box(c.m)} fs={12} />

            {/* F_max mark on the friction line */}
            {!sim.sliding && !sim.done && (
              <g>
                <line x1={fmaxX} x2={fmaxX} y1={fricY - 9} y2={fricY + 9} stroke="#d97706" strokeWidth="2" strokeDasharray="3 2" />
                <line x1={fmaxX} x2={fmaxX} y1={fricY + 9} y2={floorY + slabH + 4} stroke="#d97706" strokeWidth="1.2" />
                <TagPill
                  x={Math.min(fmaxX + tagWidth(L.fmaxMark, fs - 1) / 2, mgX - 10)}
                  y={floorY + slabH + (narrow ? 13 : 15)}
                  text={L.fmaxMark}
                  bg="#fffbeb"
                  color="#b45309"
                  border="#f59e0b"
                  size={fs - 1}
                  anchor="end"
                  box={box}
                />
              </g>
            )}

            {/* forces, one scale for all */}
            <FArrow x1={mgX} y1={cy} x2={mgX} y2={cy + c.n * k} color={FC.weight} width={narrow ? 3 : 3.5} head={narrow ? 10 : 13} />
            <FArrow x1={nX} y1={floorY} x2={nX} y2={floorY - c.n * k} color={FC.normal} width={narrow ? 3 : 3.5} head={narrow ? 10 : 13} />
            <FArrow x1={cx} y1={fricY} x2={cx - fLen} y2={fricY} color={FC.fric} width={narrow ? 3.5 : 4} head={narrow ? 11 : 14} />
            <FArrow x1={boxR} y1={pullY} x2={boxR + pLen} y2={pullY} color={FC.pull} width={narrow ? 3.5 : 4} head={narrow ? 11 : 14} />
            {moving && (
              <>
                <Arrow x1={boxR} y1={top - 12} x2={boxR + Math.max(10, sim.v * vk)} y2={top - 12} color={PALETTE.vel} width={3} head={10} />
                {a > 0.01 && <Arrow x1={boxR} y1={top - 30} x2={boxR + a * ak} y2={top - 30} color={PALETTE.acc} width={3} head={10} />}
              </>
            )}

            {/* labels */}
            <TagPill x={mgX + 8} y={cy + c.n * k - 12} text={L.tagW(N1(c.n))} bg={FC.weight} size={fs} anchor="start" box={box} />
            <TagPill x={nX + 8} y={floorY - c.n * k + 10} text={L.tagN(N1(c.n))} bg={FC.normal} size={fs} anchor="start" box={box} />
            {sim.F > 0 && <TagPill x={boxR + Math.max(pLen, 8) + 6} y={pullY} text={L.tagF(F1(sim.F))} bg={FC.pull} size={fs} anchor="start" box={box} />}
            {f > 0 &&
              (narrow ? (
                <TagPill x={cx - 4} y={top - 14} text={L.tagFric(F1(f))} bg={FC.fric} size={fs} anchor="end" box={box} />
              ) : (
                <TagPill x={Math.min(cx - fLen - 6, boxL - 4)} y={fricY - 24} text={L.tagFric(F1(f))} bg={FC.fric} size={fs} anchor="end" box={box} />
              ))}
            {moving && (
              <>
                <TagPill x={boxR + Math.max(10, sim.v * vk) + 6} y={top - 12} text={L.tagV(num(sim.v, 2, dec))} bg={PALETTE.vel} size={fs - 1} anchor="start" box={box} />
                {a > 0.01 && <TagPill x={boxR + a * ak + 6} y={top - 30} text={L.tagA(num(a, 2, dec))} bg={PALETTE.acc} size={fs - 1} anchor="start" box={box} />}
              </>
            )}
          </>
        );
      }}
    </LabScene>
  );
}
