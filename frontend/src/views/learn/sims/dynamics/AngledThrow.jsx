import { Crosshair, Goal, Layers, Rocket } from 'lucide-react';
import SimCard from '../kit/SimCard';
import { useSimText } from '../kit/lang';
import LaunchSim from './AngledThrow.launch';
import AnglesSim from './AngledThrow.angles';
import TargetSim from './AngledThrow.target';

/**
 * Lesson "Motion of a body thrown at an angle to the horizontal"
 * (physics-dynamics, lesson 11). Launched from the ground, no air resistance:
 * v₀ₓ = v₀cosα, v₀ᵧ = v₀sinα; x = v₀cosα·t, y = v₀sinα·t − gt²/2;
 * T = 2v₀sinα/g, H = v₀²sin²α/(2g), L = v₀²sin2α/g (largest at 45°, the same
 * for α and 90° − α); at the top v = v₀cosα, not zero.
 *
 *  1. One launch in detail: vectors, strobe dots, T, H, L with the numbers.
 *     Preset: v₀ = 20 m/s, α = 45° → T = 2.89 s, H = 10.2 m, L = 40.8 m.
 *  2. Angle explorer: 15°…75° at the same v₀, L(α) graph.
 *  3. A game: throw into a basket, also behind a wall and under a ceiling.
 */

const TEXT = {
  uz: {
    card: {
      eyebrow: 'Virtual laboratoriya · Dinamika',
      title: 'Gorizontga burchak ostida otilgan jismning harakati',
      tabsLabel: 'Simulyatorni tanlang',
      tabs: {
        launch: { label: 'Otish tajribasi', sub: 'vₓ, vᵧ · T, H, L' },
        angles: { label: 'Burchaklar', sub: '45° va juft burchaklar' },
        target: { label: 'Nishonga ur', sub: "O'yin: savatga tushir" },
      },
    },
    common: {
      fire: 'Otish',
      pause: "To'xtatish",
      resume: 'Davom etish',
      again: 'Yana otish',
      reset: 'Qayta',
      presets: 'Tayyor holatlar',
      v0: "Boshlang'ich tezlik",
      alpha: 'Otish burchagi',
      realTime: (t) => `Real vaqt · t = ${t} s`,
      slow: (n, t) => `Vaqt ${n} marta sekinlashtirilgan · t = ${t} s`,
      axisX: 'x, m',
      axisY: 'y, m',
      velScale: (v) => `${v} m/s`,
    },
    facts: {
      title: 'Eslab qoling',
      items: [
        {
          term: 'Ikki harakat',
          text: "gorizontal yo'nalishda — tekis harakat (vₓ = v₀cosα o'zgarmaydi), vertikal yo'nalishda — g tezlanishli harakat (vᵧ = v₀sinα − gt). Trayektoriya — parabola.",
        },
        {
          term: 'T va H',
          text: "uchish vaqti T = 2v₀sinα/g, ko'tarilish balandligi H = v₀²sin²α/(2g); eng yuqori nuqtaga t = T/2 da yetadi, u yerda v = v₀cosα (nol emas).",
        },
        { term: 'Uchish uzoqligi', text: "L = v₀²sin2α/g — α = 45° da eng katta (L = v₀²/g); α va 90° − α burchaklarda L bir xil." },
        {
          term: 'Havo qarshiligi',
          text: "formulalar havosiz holat uchun; haqiqiy to'p pastroq va yaqinroqqa uchadi, eng uzoq otish burchagi esa 45° dan kichik. g = 9.8 m/s² (masalalarda ≈ 10 m/s²).",
        },
      ],
    },
    launch: {
      presets: {
        example: { name: 'Darslik misoli', sub: '20 m/s · 45°' },
        slow: { name: 'Sekinroq', sub: '10 m/s · 45°' },
        a30: { name: '30° ostida', sub: '20 m/s · 30°' },
        a60: { name: '60° ostida', sub: '20 m/s · 60°' },
      },
      top: "Cho'qqi",
      topAria: "Eng yuqori nuqtaga o'tish",
      topTag: 'vᵧ = 0, v = vₓ',
      legend: {
        path: 'trayektoriya',
        preview: 'hisoblangan parabola',
        dots: (dt) => `har ${dt} s dagi o'rni`,
        v: 'tezlik v',
        vx: 'vₓ (gorizontal)',
        vy: 'vᵧ (vertikal)',
        g: 'tezlanish g',
        air: "havoda (futbol to'pi)",
      },
      hTag: (h) => `H = ${h} m`,
      lTag: (l) => `L = ${l} m`,
      airTag: (l) => `havoda ≈ ${l} m`,
      sceneLabel: (v0, a, x, y) => `Yon tomondan ko'rinish. Jism ${v0} m/s tezlik bilan gorizontga ${a}° burchak ostida otildi. Hozir x = ${x} m, y = ${y} m.`,
      readouts: {
        T: 'Uchish vaqti',
        H: "Ko'tarilish balandligi",
        L: 'Uchish uzoqligi',
        v: 'Tezlik',
        tNow: (t) => `hozir t = ${t} s`,
        yNow: (y) => `hozir y = ${y} m`,
        xNow: (x) => `hozir x = ${x} m`,
        comps: (vx, vy) => `vₓ = ${vx} · vᵧ = ${vy} m/s`,
      },
      sliders: {
        v0Hint: (kmh) => `≈ ${kmh} km/soat · qo'lda otish ≈ 10–20 m/s, to'pni tepish ≈ 20–30 m/s`,
        alphaHint: 'Tezlik vektori bilan gorizont orasidagi burchak',
      },
      rateLabel: 'Vaqt',
      rates: { 1: 'Real', 0.5: '2× sekin', 0.25: '4× sekin' },
      dotsLabel: "Nuqtalarda ko'rsatish",
      dotsOpts: { plain: 'Faqat nuqtalar', vec: '+ vₓ va vᵧ' },
      airLabel: 'Havo qarshiligi',
      airOpts: { off: "Yo'q", on: 'Taqqoslash' },
      formulas: {
        title: 'Formulalar — sizning sonlaringiz bilan',
        note: (g) => `g = ${g} m/s² (masalalarda ko'pincha ≈ 10 m/s² olinadi). Pastki ikki qator — hozirgi t uchun.`,
      },
      graph: {
        title: 'Tezlik tashkil etuvchilari',
        vx: "vₓ(t) — o'zgarmaydi",
        vy: 'vᵧ(t) — tekis kamayadi',
        axisT: 't, s',
        axisV: 'v, m/s',
        top: 'vᵧ = 0',
        note: "Grafikni bosing yoki suring — jism shu onga o'tadi.",
        aria: (vx, vy) => `Tezlik tashkil etuvchilarining grafigi: vₓ = ${vx} m/s o'zgarmaydi, hozir vᵧ = ${vy} m/s.`,
      },
      explain: {
        idle: "«Otish»ni bosing. Kulrang shtrix — formulalar bo'yicha hisoblangan parabola. Yashil strelka — tezlik v, ingichka strelkalar — uning tashkil etuvchilari vₓ (gorizontal) va vᵧ (vertikal), to'q sariq — erkin tushish tezlanishi g (doim pastga).",
        rising: (vx) =>
          `Ko'tarilmoqda: vᵧ har sekundda 9.8 m/s ga kamayadi, vₓ = ${vx} m/s esa o'zgarmaydi. Yerdagi belgilar oralig'i bir xil — gorizontal yo'nalishda harakat tekis.`,
        top: (vx, H, t) => `Eng yuqori nuqta: vᵧ = 0, lekin tezlik nolga teng emas — v = v₀cosα = ${vx} m/s. Jism H = ${H} m balandlikka t = T/2 = ${t} s da ko'tarildi.`,
        falling: (vx) => `Tushmoqda: vᵧ endi pastga yo'nalgan va ortib bormoqda, vₓ esa yana ${vx} m/s. Parabola simmetrik: tushish ko'tarilish bilan bir xil vaqt oladi.`,
        landed: (T, L, H, v0, a) =>
          `Yerga tushdi: T = ${T} s, L = ${L} m, H = ${H} m. Tushish paytida tezlik yana ${v0} m/s, lekin gorizontga ${a}° burchak ostida pastga yo'nalgan.`,
        example:
          "Darslik misoli: v₀ = 20 m/s, α = 45° → T = 2.89 s, H = 10.2 m, L = 40.8 m. Tushish paytida tezlik yana 20 m/s, gorizontga 45° burchak ostida pastga yo'nalgan.",
        slow: "Tezlik 2 marta kichik (10 m/s): uchish vaqti 2 marta qisqa (1.44 s), uchish uzoqligi va balandlik esa 4 marta kichik — L = 10.2 m, H ≈ 2.6 m, chunki ular v₀² ga proporsional.",
        pair: (a, b, L) => `α = ${a}° da L = ${L} m. Juft burchak ${b}° bilan ham jism xuddi shu nuqtaga tushadi (sin ${2 * a}° = sin ${2 * b}°) — «Burchaklar» bo'limida tekshiring.`,
        air: (L, pct) => ` Havoda xuddi shunday tepilgan futbol to'pi atigi ≈ ${L} m ga uchardi — ${pct}% ga qisqa: uni havo qarshiligi tormozlaydi.`,
      },
    },
    angles: {
      anglesLabel: 'Otish burchagi',
      chipSub: (L) => `${L} m`,
      fire: (a) => `Otish ${a}°`,
      fireAll: 'Hammasini otish',
      clear: 'Tozalash',
      legend: { low: 'α < 45° (yaxlit)', high: 'α > 45° (shtrix)', preview: 'tanlangan burchak', landing: 'tushish nuqtasi' },
      sceneLabel: (v0, list) => `Yon tomondan ko'rinish. v₀ = ${v0} m/s. Otilgan burchaklar va uzoqliklar: ${list} m.`,
      landTag: (angles, L) => `${angles} → ${L} m`,
      readouts: {
        L: (a) => `Uchish uzoqligi (${a}°)`,
        H: (a) => `Balandlik (${a}°)`,
        T: (a) => `Uchish vaqti (${a}°)`,
        Hsub: (b, H) => `${b}° da: H = ${H} m`,
        Tsub: (b, T) => `${b}° da: T = ${T} s`,
        pair: 'Juft burchak',
        pairSub: (L) => `uzoqlik xuddi shunday: ${L} m`,
      },
      v0Hint: (Lmax) => `Barcha otishlar shu tezlik bilan · eng katta uzoqlik v₀²/g = ${Lmax} m`,
      alphaHint: 'Yoki istalgan burchakni tanlang (5°–85°)',
      whyPair: "sin2α = sin(180° − 2α), shuning uchun α va 90° − α burchaklarda sin2α bir xil — uzoqlik ham bir xil. Eng katta qiymat sin90° = 1, ya'ni α = 45°.",
      table: {
        title: 'Natijalar jadvali',
        empty: '«Hammasini otish»ni bosing yoki burchakni tanlab, oting.',
        flying: 'uchmoqda',
        note: 'Bir xil rang — juft burchaklar (α va 90° − α).',
      },
      graph: {
        title: "Uzoqlik va balandlikning burchakka bog'liqligi",
        L: 'L(α)',
        H: 'H(α)',
        axisA: 'α, °',
        axisY: 'L, H, m',
        max: '45° — eng uzoq',
        note: "Grafikni bosing — burchak tanlanadi. L(α) 45° ga nisbatan simmetrik, H(α) esa 90° gacha o'sib boradi.",
        aria: (Lmax) => `Uchish uzoqligi va balandligining otish burchagiga bog'liqlik grafigi; eng katta uzoqlik ${Lmax} m, 45° da.`,
      },
      explain: {
        idle: (v0) =>
          `Bir xil tezlik (v₀ = ${v0} m/s) bilan turli burchak ostida oting. «Hammasini otish» — 15°, 30°, 45°, 60° va 75° bir vaqtda otiladi. Qaysi biri eng uzoqqa tushadi?`,
        race: (t1, t2) => `Hammasi bir vaqtda otildi. Kichik burchakda jism tez qaytib tushadi (${t1} s), katta burchakda uzoq uchadi (${t2} s): T = 2v₀sinα/g.`,
        one: (a) => `α = ${a}° bilan otildi — qayerga tushishini kuzating.`,
        all: (Lmax, L15, L30) =>
          `45° da eng uzoq — ${Lmax} m. Juft burchaklar bir nuqtaga tushdi: 15° va 75° → ${L15} m, 30° va 60° → ${L30} m. Tikroq otilgan jism balandroq ko'tariladi va uzoqroq uchadi, lekin xuddi shu joyga tushadi.`,
        max: (Lmax, v0) => `45° — eng uzoq: sin2α = sin90° = 1, L = v₀²/g = ${v0}²/9.8 = ${Lmax} m. Boshqa har qanday burchakda uzoqlik kichikroq.`,
        pair: (lo, hi, L, d1, d2, Hlo, Hhi, Tlo, Thi) =>
          `${lo}° va ${hi}°: ikkalasi ham ${L} m ga tushdi, chunki sin ${d1}° = sin ${d2}°. Lekin ${hi}° da jism balandroq ko'tariladi (H = ${Hhi} m va ${Hlo} m) va uzoqroq uchadi (T = ${Thi} s va ${Tlo} s).`,
        single: (a, L, H, T, b) => `α = ${a}°: L = ${L} m, H = ${H} m, T = ${T} s. Endi juft burchakni — ${b}° ni sinab ko'ring: jism qayerga tushadi?`,
      },
    },
    target: {
      levelsLabel: 'Bosqich',
      levels: {
        open: { name: 'Ochiq maydon', sub: "To'siqsiz" },
        wall: { name: 'Devor ortida', sub: 'Baland devor' },
        roof: { name: 'Sport zalida', sub: 'Past shift' },
      },
      fire: 'Otish',
      next: 'Yangi nishon',
      legend: {
        path: 'oxirgi otish',
        old: 'oldingi otishlar',
        basket: (w) => `savat (eni ${w} m)`,
        wall: 'devor',
        roof: 'shift',
      },
      sceneLabel: (D, v0, a) => `Yon tomondan ko'rinish. Savat ${D} m uzoqlikda. Tanlangan: v₀ = ${v0} m/s, α = ${a}°.`,
      roofTag: (h) => `shift: ${h} m`,
      wallTag: (h) => `devor ${h} m`,
      dTag: (D) => `D = ${D} m`,
      result: { hit: 'Tegdi!', short: 'yetmadi', long: 'oshib ketdi', wall: 'Devorga urildi', roof: 'Shiftga tegdi' },
      readouts: {
        D: 'Savatgacha',
        Dsub: (w) => `savat eni ${w} m`,
        last: 'Oxirgi otish',
        lastSub: (v0, a) => `v₀ = ${v0} m/s · α = ${a}°`,
        none: 'hali otilmadi',
        diff: 'Farq',
        diffSub: '±1 m — savatga tushadi',
        score: 'Hisob',
        scoreSub: (level) => `tegishlar / urinishlar · ${level}`,
      },
      v0Hint: "Qo'lda otish ≈ 10–20 m/s · to'pni tepish ≈ 20–30 m/s",
      alphaHint: "Bitta v₀ uchun ikki burchak to'g'ri keladi: α va 90° − α",
      hint: {
        title: 'Hisoblab otish',
        show: 'Maslahat',
        hide: 'Yashirish',
        ok: 'savatga tushadi',
        badWall: 'devorga uriladi',
        badRoof: 'shiftga tegadi',
        note: {
          open: 'Ikkala burchak ham savatga tushiradi — juft burchaklar!',
          wall: "Devordan oshib o'tish uchun katta burchak kerak.",
          roof: "Shiftga tegmaslik uchun kichik burchak kerak: H = v₀²sin²α/(2g) shiftdan past bo'lsin.",
        },
        tooSlow: 'Bu tezlik bilan savatgacha yetib bo‘lmaydi: L ≤ v₀²/g. Tezlikni oshiring.',
        teaser: "L = v₀²·sin2α/g formulasidan sin2α = g·D/v₀² ni toping va hisoblab oting. Yoki avval chamalab ko'ring!",
      },
      explain: {
        idle: {
          open: (D) => `Savat ${D} m uzoqlikda turibdi. v₀ va α ni tanlab, «Otish»ni bosing. Bitta v₀ uchun ikkita mos burchak bor — ikkalasini toping!`,
          wall: (D, h) => `Savat ${D} m uzoqlikda, uning oldida ${h} m balandlikdagi devor bor. Yotiq trayektoriya devorga uriladi — tikroq oting.`,
          roof: (D, h) => `Sport zali: savat ${D} m uzoqlikda, shift esa ${h} m balandlikda. Tik otilgan to'p shiftga tegadi — yotiqroq oting.`,
        },
        flying: (T) => `To'p havoda: gorizontal yo'nalishda tekis, vertikal yo'nalishda g tezlanish bilan harakatlanadi. Uchish vaqti T = ${T} s.`,
        hit: {
          open: (v0, a, a2, L, D, b) => `Tegdi! L = v₀²·sin2α/g = ${v0}²·sin ${a2}°/9.8 = ${L} m ≈ ${D} m. Endi xuddi shu v₀ bilan ${b}° ni sinab ko'ring — u ham savatga tushadi.`,
          wall: (v0, a, a2, L, D, b) => `Tegdi! L = ${v0}²·sin ${a2}°/9.8 = ${L} m. ${a}° da tik trayektoriya devor ustidan oshib o'tdi; juft burchak ${b}° da to'p devorga urilgan bo'lardi.`,
          roof: (v0, a, a2, L, D, b) => `Tegdi! L = ${v0}²·sin ${a2}°/9.8 = ${L} m. Yotiq trayektoriya shiftga tegmadi; juft burchak ${b}° da to'p shiftga urilgan bo'lardi.`,
        },
        short: (d, L) => `${d} m yetmadi (L = ${L} m). v₀ ni oshiring yoki α ni 45° ga yaqinlashtiring.`,
        long: (d, L) => `${d} m oshib ketdi (L = ${L} m). v₀ ni kamaytiring yoki α ni 45° dan uzoqlashtiring.`,
        wall: (h) => `Devorga urildi! ${h} m li devordan oshib o'tish uchun trayektoriya balandroq bo'lishi kerak — α ni kattalashtiring.`,
        roof: (H, h) => `Shiftga tegdi: to'p H = ${H} m gacha ko'tarilardi, shift esa ${h} m da. Kichikroq burchak bilan oting.`,
      },
    },
  },

  ru: {
    card: {
      eyebrow: 'Виртуальная лаборатория · Динамика',
      title: 'Движение тела, брошенного под углом к горизонту',
      tabsLabel: 'Выберите симулятор',
      tabs: {
        launch: { label: 'Бросок', sub: 'vₓ, vᵧ · T, H, L' },
        angles: { label: 'Углы', sub: '45° и дополнительные углы' },
        target: { label: 'Попади в цель', sub: 'Игра: в корзину' },
      },
    },
    common: {
      fire: 'Бросить',
      pause: 'Пауза',
      resume: 'Продолжить',
      again: 'Ещё раз',
      reset: 'Сброс',
      presets: 'Готовые случаи',
      v0: 'Начальная скорость',
      alpha: 'Угол броска',
      realTime: (t) => `Реальное время · t = ${t} с`,
      slow: (n, t) => `Время замедлено в ${n} раза · t = ${t} с`,
      axisX: 'x, м',
      axisY: 'y, м',
      velScale: (v) => `${v} м/с`,
    },
    facts: {
      title: 'Запомните',
      items: [
        {
          term: 'Два движения',
          text: 'по горизонтали — равномерное (vₓ = v₀cosα не меняется), по вертикали — с ускорением g (vᵧ = v₀sinα − gt). Траектория — парабола.',
        },
        {
          term: 'T и H',
          text: 'время полёта T = 2v₀sinα/g, высота подъёма H = v₀²sin²α/(2g); верхняя точка достигается при t = T/2, там v = v₀cosα (не ноль).',
        },
        { term: 'Дальность полёта', text: 'L = v₀²sin2α/g — наибольшая при α = 45° (L = v₀²/g); углы α и 90° − α дают одинаковую дальность.' },
        {
          term: 'Сопротивление воздуха',
          text: 'формулы — для полёта без воздуха; настоящий мяч летит ниже и ближе, а наилучший угол меньше 45°. g = 9,8 м/с² (в задачах ≈ 10 м/с²).',
        },
      ],
    },
    launch: {
      presets: {
        example: { name: 'Пример из урока', sub: '20 м/с · 45°' },
        slow: { name: 'Медленнее', sub: '10 м/с · 45°' },
        a30: { name: 'Под 30°', sub: '20 м/с · 30°' },
        a60: { name: 'Под 60°', sub: '20 м/с · 60°' },
      },
      top: 'Вершина',
      topAria: 'Перейти к верхней точке',
      topTag: 'vᵧ = 0, v = vₓ',
      legend: {
        path: 'траектория',
        preview: 'расчётная парабола',
        dots: (dt) => `положение через каждые ${dt} с`,
        v: 'скорость v',
        vx: 'vₓ (горизонтальная)',
        vy: 'vᵧ (вертикальная)',
        g: 'ускорение g',
        air: 'в воздухе (футбольный мяч)',
      },
      hTag: (h) => `H = ${h} м`,
      lTag: (l) => `L = ${l} м`,
      airTag: (l) => `в воздухе ≈ ${l} м`,
      sceneLabel: (v0, a, x, y) => `Вид сбоку. Тело брошено со скоростью ${v0} м/с под углом ${a}° к горизонту. Сейчас x = ${x} м, y = ${y} м.`,
      readouts: {
        T: 'Время полёта',
        H: 'Высота подъёма',
        L: 'Дальность полёта',
        v: 'Скорость',
        tNow: (t) => `сейчас t = ${t} с`,
        yNow: (y) => `сейчас y = ${y} м`,
        xNow: (x) => `сейчас x = ${x} м`,
        comps: (vx, vy) => `vₓ = ${vx} · vᵧ = ${vy} м/с`,
      },
      sliders: {
        v0Hint: (kmh) => `≈ ${kmh} км/ч · бросок рукой ≈ 10–20 м/с, удар по мячу ≈ 20–30 м/с`,
        alphaHint: 'Угол между вектором скорости и горизонтом',
      },
      rateLabel: 'Время',
      rates: { 1: 'Реальное', 0.5: '2× медл.', 0.25: '4× медл.' },
      dotsLabel: 'Показать в точках',
      dotsOpts: { plain: 'Только точки', vec: '+ vₓ и vᵧ' },
      airLabel: 'Сопротивление воздуха',
      airOpts: { off: 'Нет', on: 'Сравнить' },
      formulas: {
        title: 'Формулы — с вашими числами',
        note: (g) => `g = ${g} м/с² (в задачах часто берут ≈ 10 м/с²). Две нижние строки — для текущего t.`,
      },
      graph: {
        title: 'Составляющие скорости',
        vx: 'vₓ(t) — не меняется',
        vy: 'vᵧ(t) — равномерно убывает',
        axisT: 't, с',
        axisV: 'v, м/с',
        top: 'vᵧ = 0',
        note: 'Нажмите на график или проведите по нему — тело перейдёт в этот момент.',
        aria: (vx, vy) => `График составляющих скорости: vₓ = ${vx} м/с постоянна, сейчас vᵧ = ${vy} м/с.`,
      },
      explain: {
        idle: 'Нажмите «Бросить». Серый пунктир — парабола, рассчитанная по формулам. Зелёная стрелка — скорость v, тонкие стрелки — её составляющие vₓ (горизонтальная) и vᵧ (вертикальная), оранжевая — ускорение свободного падения g (всегда вниз).',
        rising: (vx) =>
          `Подъём: vᵧ каждую секунду уменьшается на 9,8 м/с, а vₓ = ${vx} м/с не меняется. Отметки на земле идут через равные промежутки — по горизонтали движение равномерное.`,
        top: (vx, H, t) => `Верхняя точка: vᵧ = 0, но скорость не равна нулю — v = v₀cosα = ${vx} м/с. Высоты H = ${H} м тело достигло при t = T/2 = ${t} с.`,
        falling: (vx) => `Спуск: vᵧ теперь направлена вниз и растёт, а vₓ всё та же — ${vx} м/с. Парабола симметрична: спуск длится столько же, сколько подъём.`,
        landed: (T, L, H, v0, a) =>
          `Тело упало: T = ${T} с, L = ${L} м, H = ${H} м. В момент падения скорость снова ${v0} м/с, но направлена вниз под углом ${a}° к горизонту.`,
        example: 'Пример из урока: v₀ = 20 м/с, α = 45° → T = 2,89 с, H = 10,2 м, L = 40,8 м. При падении скорость снова 20 м/с и направлена вниз под углом 45° к горизонту.',
        slow: 'Скорость в 2 раза меньше (10 м/с): время полёта в 2 раза меньше (1,44 с), а дальность и высота — в 4 раза меньше: L = 10,2 м, H ≈ 2,6 м, потому что они пропорциональны v₀².',
        pair: (a, b, L) => `При α = ${a}° дальность L = ${L} м. Под дополнительным углом ${b}° тело упадёт в ту же точку (sin ${2 * a}° = sin ${2 * b}°) — проверьте во вкладке «Углы».`,
        air: (L, pct) => ` Футбольный мяч, пущенный так же в воздухе, пролетел бы лишь ≈ ${L} м — на ${pct}% меньше: его тормозит сопротивление воздуха.`,
      },
    },
    angles: {
      anglesLabel: 'Угол броска',
      chipSub: (L) => `${L} м`,
      fire: (a) => `Бросить ${a}°`,
      fireAll: 'Бросить все',
      clear: 'Очистить',
      legend: { low: 'α < 45° (сплошная)', high: 'α > 45° (пунктир)', preview: 'выбранный угол', landing: 'точка падения' },
      sceneLabel: (v0, list) => `Вид сбоку. v₀ = ${v0} м/с. Брошенные углы и дальности: ${list} м.`,
      landTag: (angles, L) => `${angles} → ${L} м`,
      readouts: {
        L: (a) => `Дальность (${a}°)`,
        H: (a) => `Высота (${a}°)`,
        T: (a) => `Время полёта (${a}°)`,
        Hsub: (b, H) => `при ${b}°: H = ${H} м`,
        Tsub: (b, T) => `при ${b}°: T = ${T} с`,
        pair: 'Дополнительный угол',
        pairSub: (L) => `дальность та же: ${L} м`,
      },
      v0Hint: (Lmax) => `Все броски с этой скоростью · наибольшая дальность v₀²/g = ${Lmax} м`,
      alphaHint: 'Или выберите любой угол (5°–85°)',
      whyPair: 'sin2α = sin(180° − 2α), поэтому у углов α и 90° − α одинаковый sin2α — и одинаковая дальность. Наибольшее значение sin90° = 1, то есть α = 45°.',
      table: {
        title: 'Таблица результатов',
        empty: 'Нажмите «Бросить все» или выберите угол и бросьте.',
        flying: 'в полёте',
        note: 'Одинаковый цвет — дополнительные углы (α и 90° − α).',
      },
      graph: {
        title: 'Дальность и высота в зависимости от угла',
        L: 'L(α)',
        H: 'H(α)',
        axisA: 'α, °',
        axisY: 'L, H, м',
        max: '45° — дальше всего',
        note: 'Нажмите на график — выберется угол. L(α) симметрична относительно 45°, а H(α) растёт до 90°.',
        aria: (Lmax) => `График дальности и высоты полёта в зависимости от угла броска; наибольшая дальность ${Lmax} м при 45°.`,
      },
      explain: {
        idle: (v0) =>
          `Бросайте с одной и той же скоростью (v₀ = ${v0} м/с) под разными углами. «Бросить все» — 15°, 30°, 45°, 60° и 75° одновременно. Какое тело упадёт дальше всех?`,
        race: (t1, t2) => `Все брошены одновременно. При малом угле тело быстро падает (${t1} с), при большом летит дольше (${t2} с): T = 2v₀sinα/g.`,
        one: (a) => `Брошено под углом ${a}° — посмотрите, куда упадёт.`,
        all: (Lmax, L15, L30) =>
          `Дальше всех — 45°: ${Lmax} м. Дополнительные углы попали в одну точку: 15° и 75° → ${L15} м, 30° и 60° → ${L30} м. Брошенное круче поднимается выше и летит дольше, но падает туда же.`,
        max: (Lmax, v0) => `45° — дальше всего: sin2α = sin90° = 1, L = v₀²/g = ${v0}²/9,8 = ${Lmax} м. При любом другом угле дальность меньше.`,
        pair: (lo, hi, L, d1, d2, Hlo, Hhi, Tlo, Thi) =>
          `${lo}° и ${hi}°: оба упали на ${L} м, потому что sin ${d1}° = sin ${d2}°. Но при ${hi}° тело поднимается выше (H = ${Hhi} м против ${Hlo} м) и летит дольше (T = ${Thi} с против ${Tlo} с).`,
        single: (a, L, H, T, b) => `α = ${a}°: L = ${L} м, H = ${H} м, T = ${T} с. Теперь бросьте под дополнительным углом ${b}° — куда упадёт тело?`,
      },
    },
    target: {
      levelsLabel: 'Уровень',
      levels: {
        open: { name: 'Открытое поле', sub: 'Без препятствий' },
        wall: { name: 'За стеной', sub: 'Высокая стена' },
        roof: { name: 'В спортзале', sub: 'Низкий потолок' },
      },
      fire: 'Бросить',
      next: 'Новая цель',
      legend: {
        path: 'последний бросок',
        old: 'прежние броски',
        basket: (w) => `корзина (ширина ${w} м)`,
        wall: 'стена',
        roof: 'потолок',
      },
      sceneLabel: (D, v0, a) => `Вид сбоку. Корзина на расстоянии ${D} м. Выбрано: v₀ = ${v0} м/с, α = ${a}°.`,
      roofTag: (h) => `потолок: ${h} м`,
      wallTag: (h) => `стена ${h} м`,
      dTag: (D) => `D = ${D} м`,
      result: { hit: 'Попал!', short: 'недолёт', long: 'перелёт', wall: 'В стену', roof: 'В потолок' },
      readouts: {
        D: 'До корзины',
        Dsub: (w) => `ширина корзины ${w} м`,
        last: 'Последний бросок',
        lastSub: (v0, a) => `v₀ = ${v0} м/с · α = ${a}°`,
        none: 'бросков ещё нет',
        diff: 'Разница',
        diffSub: '±1 м — попадание в корзину',
        score: 'Счёт',
        scoreSub: (level) => `попадания / броски · ${level}`,
      },
      v0Hint: 'Бросок рукой ≈ 10–20 м/с · удар по мячу ≈ 20–30 м/с',
      alphaHint: 'Для одной v₀ подходят два угла: α и 90° − α',
      hint: {
        title: 'Бросок по расчёту',
        show: 'Подсказка',
        hide: 'Скрыть',
        ok: 'попадёт в корзину',
        badWall: 'ударится о стену',
        badRoof: 'заденет потолок',
        note: {
          open: 'Оба угла попадают в корзину — дополнительные углы!',
          wall: 'Чтобы перелететь стену, нужен большой угол.',
          roof: 'Чтобы не задеть потолок, нужен малый угол: H = v₀²sin²α/(2g) должна быть ниже потолка.',
        },
        tooSlow: 'С этой скоростью до корзины не долететь: L ≤ v₀²/g. Увеличьте скорость.',
        teaser: 'Из формулы L = v₀²·sin2α/g найдите sin2α = g·D/v₀² и бросьте по расчёту. Или сначала попробуйте на глаз!',
      },
      explain: {
        idle: {
          open: (D) => `Корзина стоит в ${D} м. Выберите v₀ и α и нажмите «Бросить». Для одной v₀ подходят два угла — найдите оба!`,
          wall: (D, h) => `Корзина в ${D} м, перед ней стена высотой ${h} м. Пологая траектория упрётся в стену — бросайте круче.`,
          roof: (D, h) => `Спортзал: корзина в ${D} м, потолок на высоте ${h} м. Мяч, брошенный круто, заденет потолок — бросайте положе.`,
        },
        flying: (T) => `Мяч в полёте: по горизонтали движется равномерно, по вертикали — с ускорением g. Время полёта T = ${T} с.`,
        hit: {
          open: (v0, a, a2, L, D, b) => `Попал! L = v₀²·sin2α/g = ${v0}²·sin ${a2}°/9,8 = ${L} м ≈ ${D} м. Теперь с той же v₀ попробуйте ${b}° — он тоже попадёт в корзину.`,
          wall: (v0, a, a2, L, D, b) => `Попал! L = ${v0}²·sin ${a2}°/9,8 = ${L} м. При ${a}° крутая траектория прошла над стеной; под дополнительным углом ${b}° мяч ударился бы о стену.`,
          roof: (v0, a, a2, L, D, b) => `Попал! L = ${v0}²·sin ${a2}°/9,8 = ${L} м. Пологая траектория не задела потолок; под дополнительным углом ${b}° мяч ударился бы о потолок.`,
        },
        short: (d, L) => `Недолёт ${d} м (L = ${L} м). Увеличьте v₀ или приблизьте α к 45°.`,
        long: (d, L) => `Перелёт ${d} м (L = ${L} м). Уменьшите v₀ или отведите α дальше от 45°.`,
        wall: (h) => `Удар о стену! Чтобы перелететь стену высотой ${h} м, траектория должна быть выше — увеличьте α.`,
        roof: (H, h) => `Удар о потолок: мяч поднялся бы до H = ${H} м, а потолок на ${h} м. Бросайте под меньшим углом.`,
      },
    },
  },

  en: {
    card: {
      eyebrow: 'Virtual lab · Dynamics',
      title: 'Motion of a body thrown at an angle to the horizontal',
      tabsLabel: 'Choose a simulator',
      tabs: {
        launch: { label: 'Launch', sub: 'vₓ, vᵧ · T, H, L' },
        angles: { label: 'Angles', sub: '45° and complementary angles' },
        target: { label: 'Hit the target', sub: 'Game: into the basket' },
      },
    },
    common: {
      fire: 'Launch',
      pause: 'Pause',
      resume: 'Resume',
      again: 'Again',
      reset: 'Reset',
      presets: 'Presets',
      v0: 'Initial speed',
      alpha: 'Launch angle',
      realTime: (t) => `Real time · t = ${t} s`,
      slow: (n, t) => `Time slowed down ${n}× · t = ${t} s`,
      axisX: 'x, m',
      axisY: 'y, m',
      velScale: (v) => `${v} m/s`,
    },
    facts: {
      title: 'Remember',
      items: [
        {
          term: 'Two motions',
          text: 'horizontally the motion is uniform (vₓ = v₀cosα never changes), vertically it has acceleration g (vᵧ = v₀sinα − gt). The path is a parabola.',
        },
        {
          term: 'T and H',
          text: 'time of flight T = 2v₀sinα/g, maximum height H = v₀²sin²α/(2g); the top is reached at t = T/2, where v = v₀cosα (not zero).',
        },
        { term: 'Range', text: 'L = v₀²sin2α/g — greatest at α = 45° (L = v₀²/g); the angles α and 90° − α give the same range.' },
        {
          term: 'Air resistance',
          text: 'the formulas ignore air; a real ball flies lower and shorter, and its best angle is below 45°. g = 9.8 m/s² (≈ 10 m/s² in many problems).',
        },
      ],
    },
    launch: {
      presets: {
        example: { name: 'Lesson example', sub: '20 m/s · 45°' },
        slow: { name: 'Slower', sub: '10 m/s · 45°' },
        a30: { name: 'At 30°', sub: '20 m/s · 30°' },
        a60: { name: 'At 60°', sub: '20 m/s · 60°' },
      },
      top: 'Top',
      topAria: 'Jump to the highest point',
      topTag: 'vᵧ = 0, v = vₓ',
      legend: {
        path: 'trajectory',
        preview: 'calculated parabola',
        dots: (dt) => `position every ${dt} s`,
        v: 'velocity v',
        vx: 'vₓ (horizontal)',
        vy: 'vᵧ (vertical)',
        g: 'acceleration g',
        air: 'in air (football)',
      },
      hTag: (h) => `H = ${h} m`,
      lTag: (l) => `L = ${l} m`,
      airTag: (l) => `in air ≈ ${l} m`,
      sceneLabel: (v0, a, x, y) => `Side view. A body is launched at ${v0} m/s at ${a}° to the horizontal. Now x = ${x} m, y = ${y} m.`,
      readouts: {
        T: 'Time of flight',
        H: 'Maximum height',
        L: 'Range',
        v: 'Speed',
        tNow: (t) => `now t = ${t} s`,
        yNow: (y) => `now y = ${y} m`,
        xNow: (x) => `now x = ${x} m`,
        comps: (vx, vy) => `vₓ = ${vx} · vᵧ = ${vy} m/s`,
      },
      sliders: {
        v0Hint: (kmh) => `≈ ${kmh} km/h · a throw by hand ≈ 10–20 m/s, a kick ≈ 20–30 m/s`,
        alphaHint: 'The angle between the velocity and the horizontal',
      },
      rateLabel: 'Time',
      rates: { 1: 'Real', 0.5: '2× slower', 0.25: '4× slower' },
      dotsLabel: 'At the dots',
      dotsOpts: { plain: 'Dots only', vec: '+ vₓ and vᵧ' },
      airLabel: 'Air resistance',
      airOpts: { off: 'Off', on: 'Compare' },
      formulas: {
        title: 'Formulas — with your numbers',
        note: (g) => `g = ${g} m/s² (problems often use ≈ 10 m/s²). The last two rows are for the current t.`,
      },
      graph: {
        title: 'Velocity components',
        vx: 'vₓ(t) — constant',
        vy: 'vᵧ(t) — falls steadily',
        axisT: 't, s',
        axisV: 'v, m/s',
        top: 'vᵧ = 0',
        note: 'Click or drag along the graph — the body jumps to that moment.',
        aria: (vx, vy) => `Graph of the velocity components: vₓ = ${vx} m/s stays constant, vᵧ is now ${vy} m/s.`,
      },
      explain: {
        idle: 'Press “Launch”. The grey dashed line is the parabola calculated from the formulas. The green arrow is the velocity v, the thin arrows are its components vₓ (horizontal) and vᵧ (vertical), the orange one is the free-fall acceleration g (always down).',
        rising: (vx) =>
          `Going up: vᵧ drops by 9.8 m/s every second, while vₓ = ${vx} m/s stays the same. The marks on the ground are equally spaced — horizontally the motion is uniform.`,
        top: (vx, H, t) => `The highest point: vᵧ = 0, but the speed is not zero — v = v₀cosα = ${vx} m/s. The body reached H = ${H} m at t = T/2 = ${t} s.`,
        falling: (vx) => `Coming down: vᵧ now points down and grows, while vₓ is still ${vx} m/s. The parabola is symmetric: the way down takes as long as the way up.`,
        landed: (T, L, H, v0, a) => `Landed: T = ${T} s, L = ${L} m, H = ${H} m. At landing the speed is again ${v0} m/s, but it points down at ${a}° to the horizontal.`,
        example: 'The lesson’s example: v₀ = 20 m/s, α = 45° → T = 2.89 s, H = 10.2 m, L = 40.8 m. At landing the speed is again 20 m/s, pointing down at 45° to the horizontal.',
        slow: 'Half the speed (10 m/s): the flight is half as long (1.44 s), but the range and the height are 4 times smaller — L = 10.2 m, H ≈ 2.6 m — because they are proportional to v₀².',
        pair: (a, b, L) => `At α = ${a}° the range is L = ${L} m. The complementary angle ${b}° lands at the same point (sin ${2 * a}° = sin ${2 * b}°) — check it in the “Angles” tab.`,
        air: (L, pct) => ` A football kicked the same way in air would fly only ≈ ${L} m — ${pct}% shorter: air resistance slows it down.`,
      },
    },
    angles: {
      anglesLabel: 'Launch angle',
      chipSub: (L) => `${L} m`,
      fire: (a) => `Launch ${a}°`,
      fireAll: 'Launch all',
      clear: 'Clear',
      legend: { low: 'α < 45° (solid)', high: 'α > 45° (dashed)', preview: 'selected angle', landing: 'landing point' },
      sceneLabel: (v0, list) => `Side view. v₀ = ${v0} m/s. Angles launched and their ranges: ${list} m.`,
      landTag: (angles, L) => `${angles} → ${L} m`,
      readouts: {
        L: (a) => `Range (${a}°)`,
        H: (a) => `Height (${a}°)`,
        T: (a) => `Time of flight (${a}°)`,
        Hsub: (b, H) => `at ${b}°: H = ${H} m`,
        Tsub: (b, T) => `at ${b}°: T = ${T} s`,
        pair: 'Complementary angle',
        pairSub: (L) => `same range: ${L} m`,
      },
      v0Hint: (Lmax) => `All launches at this speed · greatest range v₀²/g = ${Lmax} m`,
      alphaHint: 'Or pick any angle (5°–85°)',
      whyPair: 'sin2α = sin(180° − 2α), so the angles α and 90° − α have the same sin2α — and the same range. The largest value is sin90° = 1, i.e. α = 45°.',
      table: {
        title: 'Results',
        empty: 'Press “Launch all”, or pick an angle and launch.',
        flying: 'in flight',
        note: 'Same colour — complementary angles (α and 90° − α).',
      },
      graph: {
        title: 'Range and height against the angle',
        L: 'L(α)',
        H: 'H(α)',
        axisA: 'α, °',
        axisY: 'L, H, m',
        max: '45° — farthest',
        note: 'Click the graph to pick an angle. L(α) is symmetric about 45°, while H(α) keeps growing up to 90°.',
        aria: (Lmax) => `Graph of range and maximum height against the launch angle; the greatest range is ${Lmax} m, at 45°.`,
      },
      explain: {
        idle: (v0) =>
          `Launch at the same speed (v₀ = ${v0} m/s) at different angles. “Launch all” fires 15°, 30°, 45°, 60° and 75° together. Which one lands farthest?`,
        race: (t1, t2) => `All launched together. At a small angle the body comes down quickly (${t1} s), at a large one it stays up longer (${t2} s): T = 2v₀sinα/g.`,
        one: (a) => `Launched at ${a}° — watch where it lands.`,
        all: (Lmax, L15, L30) =>
          `45° flies farthest — ${Lmax} m. Complementary angles landed at the same point: 15° and 75° → ${L15} m, 30° and 60° → ${L30} m. The steeper throw rises higher and stays up longer, yet lands in the same place.`,
        max: (Lmax, v0) => `45° goes farthest: sin2α = sin90° = 1, L = v₀²/g = ${v0}²/9.8 = ${Lmax} m. Any other angle gives a shorter range.`,
        pair: (lo, hi, L, d1, d2, Hlo, Hhi, Tlo, Thi) =>
          `${lo}° and ${hi}°: both landed at ${L} m, because sin ${d1}° = sin ${d2}°. But at ${hi}° the body rises higher (H = ${Hhi} m vs ${Hlo} m) and flies longer (T = ${Thi} s vs ${Tlo} s).`,
        single: (a, L, H, T, b) => `α = ${a}°: L = ${L} m, H = ${H} m, T = ${T} s. Now try the complementary angle ${b}° — where will it land?`,
      },
    },
    target: {
      levelsLabel: 'Level',
      levels: {
        open: { name: 'Open field', sub: 'No obstacles' },
        wall: { name: 'Behind a wall', sub: 'A high wall' },
        roof: { name: 'Sports hall', sub: 'A low ceiling' },
      },
      fire: 'Throw',
      next: 'New target',
      legend: {
        path: 'last throw',
        old: 'earlier throws',
        basket: (w) => `basket (${w} m wide)`,
        wall: 'wall',
        roof: 'ceiling',
      },
      sceneLabel: (D, v0, a) => `Side view. The basket is ${D} m away. Selected: v₀ = ${v0} m/s, α = ${a}°.`,
      roofTag: (h) => `ceiling: ${h} m`,
      wallTag: (h) => `wall ${h} m`,
      dTag: (D) => `D = ${D} m`,
      result: { hit: 'In!', short: 'short', long: 'too far', wall: 'Hit the wall', roof: 'Hit the ceiling' },
      readouts: {
        D: 'To the basket',
        Dsub: (w) => `basket ${w} m wide`,
        last: 'Last throw',
        lastSub: (v0, a) => `v₀ = ${v0} m/s · α = ${a}°`,
        none: 'no throws yet',
        diff: 'Difference',
        diffSub: '±1 m — lands in the basket',
        score: 'Score',
        scoreSub: (level) => `hits / throws · ${level}`,
      },
      v0Hint: 'A throw by hand ≈ 10–20 m/s · a kick ≈ 20–30 m/s',
      alphaHint: 'For one v₀ two angles work: α and 90° − α',
      hint: {
        title: 'Throw by calculation',
        show: 'Hint',
        hide: 'Hide',
        ok: 'goes in',
        badWall: 'hits the wall',
        badRoof: 'hits the ceiling',
        note: {
          open: 'Both angles land in the basket — complementary angles!',
          wall: 'To clear the wall you need the large angle.',
          roof: 'To stay under the ceiling you need the small angle: H = v₀²sin²α/(2g) must be below the ceiling.',
        },
        tooSlow: 'At this speed the basket is out of reach: L ≤ v₀²/g. Throw faster.',
        teaser: 'From L = v₀²·sin2α/g find sin2α = g·D/v₀² and throw by calculation. Or try by eye first!',
      },
      explain: {
        idle: {
          open: (D) => `The basket is ${D} m away. Choose v₀ and α and press “Throw”. For one v₀ two angles work — find both!`,
          wall: (D, h) => `The basket is ${D} m away with a ${h} m wall in front of it. A flat path runs into the wall — throw steeper.`,
          roof: (D, h) => `Sports hall: the basket is ${D} m away and the ceiling is ${h} m high. A steep throw hits the ceiling — throw flatter.`,
        },
        flying: (T) => `The ball is in the air: uniform motion horizontally, acceleration g vertically. Time of flight T = ${T} s.`,
        hit: {
          open: (v0, a, a2, L, D, b) => `In! L = v₀²·sin2α/g = ${v0}²·sin ${a2}°/9.8 = ${L} m ≈ ${D} m. Now try ${b}° at the same v₀ — it goes in too.`,
          wall: (v0, a, a2, L, D, b) => `In! L = ${v0}²·sin ${a2}°/9.8 = ${L} m. At ${a}° the steep path cleared the wall; at the complementary ${b}° the ball would have hit it.`,
          roof: (v0, a, a2, L, D, b) => `In! L = ${v0}²·sin ${a2}°/9.8 = ${L} m. The flat path stayed under the ceiling; at the complementary ${b}° the ball would have hit it.`,
        },
        short: (d, L) => `${d} m short (L = ${L} m). Increase v₀ or bring α closer to 45°.`,
        long: (d, L) => `${d} m too far (L = ${L} m). Decrease v₀ or move α away from 45°.`,
        wall: (h) => `It hit the wall! To clear a ${h} m wall the path must be higher — increase α.`,
        roof: (H, h) => `It hit the ceiling: the ball would rise to H = ${H} m, but the ceiling is at ${h} m. Throw at a smaller angle.`,
      },
    },
  },
};

export default function AngledThrow() {
  const T = useSimText(TEXT);
  const tabs = T.card.tabs;
  return (
    <SimCard
      eyebrow={T.card.eyebrow}
      title={T.card.title}
      tabsLabel={T.card.tabsLabel}
      idPrefix="at"
      icon={Rocket}
      tabs={[
        { id: 'launch', label: tabs.launch.label, sub: tabs.launch.sub, icon: Crosshair, render: () => <LaunchSim t={T.launch} c={T} /> },
        { id: 'angles', label: tabs.angles.label, sub: tabs.angles.sub, icon: Layers, render: () => <AnglesSim t={T.angles} c={T} /> },
        { id: 'target', label: tabs.target.label, sub: tabs.target.sub, icon: Goal, render: () => <TargetSim t={T.target} c={T} /> },
      ]}
      facts={T.facts}
    />
  );
}
