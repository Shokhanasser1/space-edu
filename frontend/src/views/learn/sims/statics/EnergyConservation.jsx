import { ArrowUpFromLine, BatteryCharging, Clock, Spline } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { useSimText } from '../kit/lang';
import { Rich } from './EnergyConservation.parts';
import TrackSim from './EnergyConservation.track';
import PendulumSim from './EnergyConservation.pendulum';
import ThrowSim from './EnergyConservation.throw';

/**
 * Lesson "To'liq mexanik energiyaning saqlanish qonuni" (Statics, 8):
 *  1. track ("skate park"): a cart released from h₀ on a U-ramp, hill, loop
 *     or step; E = E_k + E_p = mgh₀ stays constant, v_bottom = √(2gh₀)
 *     (h₀ = 5 m → 9.9 m/s, m = 50 kg → E₀ = 2450 J), it never rises above
 *     h₀; a friction switch shows E falling and heat Q growing;
 *  2. pendulum: h₀ = L(1 − cos α₀), E_p at the ends ↔ E_k at the bottom;
 *     L = 2 m, α₀ = 60° → h₀ = 1.00 m, v = 4.43 m/s, m = 0.5 kg → 4.90 J;
 *  3. ball thrown up: mv₀²/2 = mgH ⇒ H = v₀²/(2g); v₀ = 14 m/s → H = 10.0 m,
 *     m = 0.5 kg → 49.0 J.
 * g = 9.8 m/s², zero level at the lowest point. Every word lives in TEXT.
 */

const TEXT = {
  uz: {
    J: 'J',
    kg: 'kg',
    card: {
      eyebrow: 'Virtual laboratoriya · Statika',
      title: "To'liq mexanik energiyaning saqlanish qonuni",
      tabsLabel: 'Tajribani tanlang',
      tabs: {
        track: { label: 'Trassa', sub: 'E = const' },
        pend: { label: 'Mayatnik', sub: 'v = √(2gh)' },
        thr: { label: 'Yuqoriga otish', sub: 'H = v₀²/(2g)' },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    slowChip: (k) => (k === 0.5 ? 'Vaqt 2 marta sekinlashtirilgan' : 'Vaqt 4 marta sekinlashtirilgan'),
    speedLabel: 'Vaqt tezligi',
    energy: {
      title: 'Energiya ustunlari',
      ep: 'E_p — potensial',
      ek: 'E_k — kinetik',
      e: "E — to'liq",
      q: 'Q — issiqlik',
      e0: (v) => `E₀ = ${v} J`,
      unit: 'E, J',
      note: "Oq hoshiyali ustun — to'liq energiya E = E_p + E_k. Uzuq chiziq — boshlang'ich energiya E₀: ustun undan pastga ham tushmaydi, yuqoriga ham chiqmaydi.",
      noteFr: 'Ishqalanishda E kamayadi, Q esa ortadi: E + Q = E₀.',
      aria: (ep, ek, e) => `Energiyalar: potensial ${ep} J, kinetik ${ek} J, to'liq ${e} J.`,
    },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: "To'liq mexanik energiya", text: "E = E_k + E_p — jismning kinetik va potensial energiyalari yig'indisi; birligi joul (J)." },
        {
          term: 'Saqlanish qonuni',
          text: "berk sistemada faqat og'irlik va elastiklik kuchlari ish bajarsa, E = E_k + E_p = const: energiya bir turdan boshqasiga o'tadi, yig'indisi esa o'zgarmaydi.",
        },
        {
          term: 'v = √(2gh)',
          text: "h balandlikdan tushgan jismning pastdagi tezligi — massaga ham, yo'lning shakliga ham bog'liq emas. Tik otilgan jism H = v₀²/(2g) balandlikkacha ko'tariladi.",
        },
        { term: 'Ishqalanish', text: "ishqalanish kuchi ish bajarsa, mexanik energiya kamayadi — bir qismi issiqlikka (Q) aylanadi: E + Q = E₀ (keyingi dars)." },
      ],
    },
    track: {
      presetsLabel: 'Trassa shakli',
      presets: {
        u: { name: 'U-rampa', sub: 'oddiy chuqurlik' },
        hill: { name: 'Tepalik', sub: "o'rtada do'nglik" },
        loop: { name: 'Halqa', sub: "«o'lik sirtmoq»" },
        step: { name: "Pog'ona", sub: 'baland maydoncha' },
      },
      shape: {
        u: { label: 'Tubining eni', sym: 'b', hint: "Shakl o'zgaradi, pastdagi tezlik esa yo'q — √(2gh₀) bo'lib qoladi." },
        hill: { label: 'Tepalik balandligi', sym: 'H', hint: "H > h₀ bo'lsa, vagoncha tepalikdan o'ta olmaydi." },
        loop: { label: 'Halqa radiusi', sym: 'R', hint: 'Halqaning eng yuqori nuqtasi 2R balandlikda. Vagoncha relsga mahkamlangan.' },
        step: { label: "Pog'ona balandligi", sym: 'h₁', hint: "Pog'onadagi tezlik: v = √(2g(h₀ − h₁))." },
      },
      h0: "Boshlang'ich balandlik",
      h0Hint: 'Vagonchani sahnada yuqoriga-pastga sudrab ham qo‘yish mumkin.',
      mass: 'Vagoncha massasi',
      massHint: "Massa energiyani o'zgartiradi (E₀ = mgh₀), tezlikni esa yo'q.",
      friction: {
        label: 'Ishqalanish',
        sub: 'Mexanik energiyaning bir qismi issiqlikka aylanadi (keyingi dars)',
        mu: 'Ishqalanish koeffitsienti',
      },
      legend: { v: 'tezlik v', h: 'balandlik h', h0: "boshlang'ich sath h₀", zero: 'nol sath' },
      scene: {
        zero: 'nol sath · E_p = 0',
        h0Tag: (h) => `h₀ = ${h} m`,
        hTag: (h) => `h = ${h} m`,
        vTag: (v) => `v = ${v} m/s`,
        drag: '↕ sudrang',
        hillTag: (H) => `H = ${H} m`,
        loopTag: (d) => `2R = ${d} m`,
        stepTag: (h) => `h₁ = ${h} m`,
        xAxis: 'x, m',
        yAxis: 'h, m',
        aria: (name, h, v, ek, ep) =>
          `${name} trassasi. Vagoncha balandligi ${h} m, tezligi ${v} m/s, kinetik energiyasi ${ek} J, potensial energiyasi ${ep} J.`,
      },
      chipFr: (mu) => `Ishqalanish bor · μ = ${mu}`,
      readouts: { v: 'Tezlik', h: 'Balandlik', e: "To'liq energiya", vmax: 'Eng katta tezlik', q: 'Issiqlik' },
      sub: {
        v: (k) => `≈ ${k} km/soat`,
        h: (h0) => `start: h₀ = ${h0} m`,
        e: (ek, ep) => `E_k + E_p = ${ek} + ${ep}`,
        vmax: '√(2gh₀) — eng pastki nuqtada',
        q: (p) => `E₀ ning ${p} % i issiqlikka aylandi`,
      },
      f: {
        e0: { tag: "Boshlang'ich energiya", general: 'E₀ = E_p = mgh₀', filled: (m, h, e) => `= ${m} · 9.8 · ${h} = ${e} J` },
        vmax: { tag: 'Pastki nuqtadagi tezlik', general: 'mgh₀ = mv²/2  ⇒  v = √(2gh₀)', filled: (h, v) => `= √(2 · 9.8 · ${h}) = ${v} m/s` },
      },
      graph: {
        title: 'Energiya — vaziyat grafigi E(x)',
        theory: 'nazariy E_p(x) va E_k(x)',
        x: 'x, m',
        y: 'E, J',
        note: "Uzuq chiziqlar: E_p(x) = mgh(x) trassa shaklini takrorlaydi, E_k(x) = E₀ − E_p(x) — uning ko'zgudagi aksi. Oq chiziq — to'liq energiya: ishqalanishsiz u gorizontal.",
        aria: "Kinetik, potensial va to'liq energiyaning vagoncha vaziyatiga bog'liqlik grafigi",
      },
      explain: {
        idle: "Trassani tanlang, boshlang'ich balandlik h₀ ni belgilang (vagonchani sudrash ham mumkin) va «Boshlash»ni bosing. Vagoncha tinch holatdan qo'yib yuboriladi: hozir butun energiya potensial, E = E_p = mgh₀.",
        down: (E) => `Pastga tushyapti: balandlik kamayadi, tezlik ortadi — E_p kinetik energiyaga aylanyapti (E_p → E_k). Yig'indi o'zgarmaydi: E = E_k + E_p = ${E} J.`,
        up: (E) => `Yuqoriga chiqyapti: tezlik kamayadi, balandlik ortadi — E_k yana potensial energiyaga aylanyapti (E_k → E_p). E = ${E} J o'zgarmaydi.`,
        downFr: (E) => `Pastga tushyapti: E_p → E_k, lekin ishqalanish kuchi manfiy ish bajaradi — energiyaning bir qismi issiqlikka aylanadi: E + Q = E₀ = ${E} J.`,
        upFr: (E) => `Yuqoriga chiqyapti: E_k → E_p, ishqalanish esa energiyani issiqlikka aylantirishda davom etadi. To'liq energiya E kamayib boradi, E + Q = E₀ = ${E} J.`,
        bottom: (h0, v) =>
          `Eng pastki nuqta (nol sath): E_p = 0, butun energiya kinetik. mgh₀ = mv²/2 dan v = √(2gh₀) = √(2 · 9.8 · ${h0}) = ${v} m/s — massaga ham, trassa shakliga ham bog'liq emas.`,
        bottomFr: (v, vmax, q) => `Pastki nuqtada tezlik ${v} m/s — ishqalanishsiz bo'ladigan ${vmax} m/s dan kam: Q = ${q} J energiya issiqlikka aylandi.`,
        turn: (h) => `To'xtash nuqtasi: v = 0, E_k = 0 — butun energiya yana potensial. Balandlik h = ${h} m = h₀: vagoncha boshlang'ich balandligidan yuqori ko'tarila olmaydi.`,
        turnFr: (h, h0, q) =>
          `To'xtash nuqtasi h = ${h} m — boshlang'ich h₀ = ${h0} m dan past: ishqalanish tufayli Q = ${q} J issiqlikka aylandi, shuning uchun vagoncha avvalgi balandlikka chiqa olmadi.`,
        blocked: (H, h0) =>
          `Tepalik (H = ${H} m) boshlang'ich balandlikdan (h₀ = ${h0} m) baland: energiya yetmaydi. Vagoncha h₀ balandlikda to'xtab, orqaga qaytdi — u hech qachon h₀ dan yuqori chiqmaydi.`,
        hillTop: (H, v) => `Tepalik cho'qqisi (H = ${H} m): energiyaning bir qismi yana potensialga aylandi, qolgani kinetik: v = √(2g(h₀ − H)) = ${v} m/s.`,
        loopTop: (top, v) => `Halqa cho'qqisi (2R = ${top} m): vagoncha teskari holatda, lekin E o'zgarmagan. Tezlik v = √(2g(h₀ − 2R)) = ${v} m/s.`,
        loopFail: (top, h0) =>
          `Halqa cho'qqisi (2R = ${top} m) boshlang'ich balandlikdan (h₀ = ${h0} m) yuqori: vagoncha h₀ gacha ko'tarilib, orqaga qaytdi. Halqadan o'tish uchun h₀ > 2R kerak.`,
        plateau: (h1, v) =>
          `Pog'onada (h₁ = ${h1} m) tezlik o'zgarmas: v = √(2g(h₀ − h₁)) = ${v} m/s. Bir xil balandlikda tezlik har doim bir xil — qaysi yo'ldan kelganiga bog'liq emas.`,
        stopped: (q, E0) =>
          `Vagoncha to'xtadi. Boshlang'ich E₀ = ${E0} J dan Q = ${q} J ishqalanish tufayli issiqlikka aylandi — mexanik energiya saqlanmadi (bu keyingi dars mavzusi).`,
      },
    },
    pend: {
      presetsLabel: 'Tayyor tajribalar',
      presets: {
        main: { name: 'L = 2 m, α₀ = 60°', sub: 'h₀ = 1.00 m · v = 4.43 m/s' },
        short: { name: 'L = 1 m, α₀ = 60°', sub: 'h₀ = 0.50 m · v = 3.13 m/s' },
        long: { name: 'L = 3 m, α₀ = 33.6°', sub: 'h₀ = 0.50 m · v = 3.13 m/s' },
      },
      L: 'Ip uzunligi',
      alpha: "Og'ish burchagi",
      alphaHint: "Sharchani sahnada sudrab ham og'dirish mumkin.",
      mass: 'Sharcha massasi',
      massHint: "Energiya massaga proporsional, tezlik esa massaga bog'liq emas.",
      legend: { v: 'tezlik v', h: 'balandlik h', arc: 'harakat yoyi', zero: 'nol sath' },
      scene: {
        zero: 'nol sath · E_p = 0',
        h0Tag: (h) => `h₀ = ${h} m`,
        hTag: (h) => `h = ${h} m`,
        vTag: (v) => `v = ${v} m/s`,
        drag: '↔ sudrang',
        cell: (c) => `1 katak = ${c} m`,
        aria: (th, h, v) => `Mayatnik: og'ish burchagi ${th}°, balandlik ${h} m, tezlik ${v} m/s.`,
      },
      readouts: { theta: 'Burchak', h: 'Balandlik', v: 'Tezlik', e: "To'liq energiya" },
      sub: {
        theta: (a) => `amplituda α₀ = ${a}°`,
        h: (h0) => `chetki nuqtada h₀ = ${h0} m`,
        v: (v) => `pastda √(2gh₀) = ${v} m/s`,
        e: (ek, ep) => `E_k + E_p = ${ek} + ${ep}`,
      },
      f: {
        h0: { tag: "Ko'tarilish balandligi", general: 'h₀ = L(1 − cos α₀)', filled: (L, a, h) => `= ${L} · (1 − cos ${a}°) = ${h} m` },
        vmax: { tag: 'Pastki nuqtadagi tezlik', general: 'v = √(2gh₀)', filled: (h, v) => `= √(2 · 9.8 · ${h}) = ${v} m/s` },
        e: { tag: "To'liq energiya", general: 'E = mgh₀ = mv²/2', filled: (m, h, e) => `= ${m} · 9.8 · ${h} = ${e} J` },
      },
      graph: {
        title: 'Energiya — vaziyat grafigi',
        x: 'x, m',
        y: 'E, J',
        note: "x — sharchaning gorizontal siljishi. E_p(x) «chuqurcha» shaklida: chetlarda eng katta, o'rtada nol. E_k(x) — aksincha. Ikkalasining yig'indisi har bir nuqtada E₀ ga teng (oq chiziq).",
        aria: "Mayatnik energiyalarining gorizontal siljishga bog'liqlik grafigi",
      },
      explain: {
        idle: "Sharchani sudrab og'diring yoki L va α₀ ni tanlang, so'ng «Boshlash»ni bosing. Chetki nuqtada sharcha tinch turibdi (v = 0) — butun energiya potensial: E = mgh₀.",
        down: (E) => `Pastga tushyapti: balandlik kamayadi, tezlik ortadi — E_p → E_k. Yig'indi o'zgarmaydi: E = ${E} J.`,
        up: (h0) => `Yuqoriga chiqyapti: E_k → E_p. Sharcha sekinlashadi va narigi tomonda ham aynan h₀ = ${h0} m balandlikkacha ko'tariladi — undan yuqori emas.`,
        bottom: (E, h0, v) => `Eng pastki nuqta: E_p = 0, butun energiya kinetik — E_k = E = ${E} J. Tezlik eng katta: v = √(2gh₀) = √(2 · 9.8 · ${h0}) = ${v} m/s.`,
        end: (E, h) => `Chetki nuqta: bir lahzaga v = 0, E_k = 0 — butun energiya potensial: E_p = mgh = ${E} J, h = ${h} m. Sharcha boshlang'ich balandlikka qaytdi.`,
      },
    },
    thr: {
      presetsLabel: "Boshlang'ich tezlik",
      presets: {
        v98: { name: 'v₀ = 9.8 m/s', sub: "H = 4.9 m · ko'tarilish 1 s" },
        v14: { name: 'v₀ = 14 m/s', sub: 'H = 10 m · asosiy misol' },
        v196: { name: 'v₀ = 19.6 m/s', sub: "H = 19.6 m · ko'tarilish 2 s" },
      },
      v0: "Boshlang'ich tezlik",
      v0Hint: (k) => `≈ ${k} km/soat, tik yuqoriga`,
      mass: 'Koptok massasi',
      massHint: "Energiya massaga proporsional, H esa massaga bog'liq emas — m formuladan qisqarib ketadi.",
      legend: { v: 'tezlik v', mg: "og'irlik kuchi mg", ep: 'E_p(h) = mgh', ek: 'E_k(h) = E − mgh', e: 'E = const' },
      scene: {
        hAxis: 'h, m',
        eAxis: 'E, J',
        graph: 'E(h) grafigi',
        ground: 'Yer · nol sath (E_p = 0)',
        HTag: (H) => `H = v₀²/(2g) = ${H} m`,
        vTag: (v) => `v = ${v} m/s`,
        v0Tag: (v) => `v₀ = ${v} m/s`,
        mgTag: 'mg',
        aria: (v0, h, v) => `Koptok ${v0} m/s tezlik bilan tik yuqoriga otildi. Balandlik ${h} m, tezlik ${v} m/s.`,
      },
      readouts: { t: 'Vaqt', h: 'Balandlik', v: 'Tezlik', e: "To'liq energiya" },
      sub: {
        t: (T) => `uchish vaqti 2v₀/g = ${T} s`,
        h: (H) => `eng katta H = ${H} m`,
        vUp: 'yuqoriga',
        vDown: 'pastga',
        vZero: 'v = 0 — eng yuqori nuqta',
        e: (ek, ep) => `E_k + E_p = ${ek} + ${ep}`,
      },
      derive: {
        title: "Ko'tarilish balandligini energiyadan topamiz",
        note: 'Kinematikadagi H = v₀²/(2g) formulasi energiyaning saqlanish qonunidan bir qatorda chiqadi.',
        s1: { tag: '1. Pastda (h = 0)', general: 'E = E_k = mv₀²/2', filled: (m, v0, e) => `= ${m} · ${v0}² / 2 = ${e} J` },
        s2: { tag: '2. Tepada (v = 0)', general: 'E = E_p = mgH', filled: (m, H, e) => `= ${m} · 9.8 · ${H} = ${e} J` },
        s3: { tag: '3. Saqlanish qonuni', general: 'mv₀²/2 = mgH  ⇒  H = v₀²/(2g)', filled: (v0, H) => `= ${v0}² / (2 · 9.8) = ${H} m — m qisqardi` },
        s4: { tag: '4. Ixtiyoriy balandlikda', general: 'mv₀²/2 = mv²/2 + mgh  ⇒  v = √(v₀² − 2gh)', filled: (v0, h, v) => `= √(${v0}² − 2 · 9.8 · ${h}) = ${v} m/s` },
      },
      explain: {
        idle: (E) => `v₀ ni tanlang va «Boshlash»ni bosing. Otilish paytida koptok yerda (h = 0): butun energiya kinetik, E = mv₀²/2 = ${E} J.`,
        rise: (E) =>
          `Ko'tarilish: og'irlik kuchi harakatga qarshi — koptok sekinlashadi, E_k → E_p. O'ngdagi grafikda ko'k chiziq o'sadi, yashil chiziq kamayadi, yig'indi esa E = ${E} J bo'lib qoladi.`,
        top: (H, E) => `Eng yuqori nuqta: v = 0, E_k = 0, butun energiya potensial: mgH = mv₀²/2 = ${E} J. Bundan H = v₀²/(2g) = ${H} m — massa qisqarib ketdi.`,
        fall: "Tushish: E_p → E_k. Har bir balandlikdan koptok ko'tarilishdagi tezlik bilan o'tadi (v = √(v₀² − 2gh)), faqat pastga.",
        landed: (v0, E) => `Koptok yerga v = v₀ = ${v0} m/s tezlik bilan qaytdi: E_k yana ${E} J ga teng — energiya yo'qolmadi, faqat shaklini o'zgartirdi.`,
      },
    },
  },

  ru: {
    J: 'Дж',
    kg: 'кг',
    card: {
      eyebrow: 'Виртуальная лаборатория · Статика',
      title: 'Закон сохранения полной механической энергии',
      tabsLabel: 'Выберите опыт',
      tabs: {
        track: { label: 'Трасса', sub: 'E = const' },
        pend: { label: 'Маятник', sub: 'v = √(2gh)' },
        thr: { label: 'Бросок вверх', sub: 'H = v₀²/(2g)' },
      },
    },
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    slowChip: (k) => (k === 0.5 ? 'Время замедлено в 2 раза' : 'Время замедлено в 4 раза'),
    speedLabel: 'Скорость времени',
    energy: {
      title: 'Столбики энергии',
      ep: 'E_p — потенциальная',
      ek: 'E_k — кинетическая',
      e: 'E — полная',
      q: 'Q — теплота',
      e0: (v) => `E₀ = ${v} Дж`,
      unit: 'E, Дж',
      note: 'Столбик в белой рамке — полная энергия E = E_p + E_k. Пунктир — начальная энергия E₀: столбик не опускается ниже и не поднимается выше.',
      noteFr: 'При трении E уменьшается, а Q растёт: E + Q = E₀.',
      aria: (ep, ek, e) => `Энергии: потенциальная ${ep} Дж, кинетическая ${ek} Дж, полная ${e} Дж.`,
    },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Полная механическая энергия', text: 'E = E_k + E_p — сумма кинетической и потенциальной энергий тела; единица — джоуль (Дж).' },
        {
          term: 'Закон сохранения',
          text: 'если в замкнутой системе работу совершают только силы тяжести и упругости, E = E_k + E_p = const: энергия переходит из одного вида в другой, а сумма не меняется.',
        },
        {
          term: 'v = √(2gh)',
          text: 'скорость тела внизу после спуска с высоты h — не зависит ни от массы, ни от формы пути. Тело, брошенное вертикально вверх, поднимается на H = v₀²/(2g).',
        },
        { term: 'Трение', text: 'если работу совершает сила трения, механическая энергия уменьшается — часть её переходит в теплоту Q: E + Q = E₀ (следующий урок).' },
      ],
    },
    track: {
      presetsLabel: 'Форма трассы',
      presets: {
        u: { name: 'U-рампа', sub: 'простая яма' },
        hill: { name: 'Горка', sub: 'бугор посередине' },
        loop: { name: 'Петля', sub: '«мёртвая петля»' },
        step: { name: 'Ступенька', sub: 'высокая площадка' },
      },
      shape: {
        u: { label: 'Ширина дна', sym: 'b', hint: 'Форма меняется, а скорость внизу — нет: остаётся √(2gh₀).' },
        hill: { label: 'Высота горки', sym: 'H', hint: 'Если H > h₀, тележка не перевалит через горку.' },
        loop: { label: 'Радиус петли', sym: 'R', hint: 'Верх петли — на высоте 2R. Тележка закреплена на рельсе.' },
        step: { label: 'Высота ступеньки', sym: 'h₁', hint: 'Скорость на ступеньке: v = √(2g(h₀ − h₁)).' },
      },
      h0: 'Начальная высота',
      h0Hint: 'Тележку можно перетаскивать на сцене вверх-вниз.',
      mass: 'Масса тележки',
      massHint: 'Масса меняет энергию (E₀ = mgh₀), но не скорость.',
      friction: { label: 'Трение', sub: 'Часть механической энергии переходит в теплоту (следующий урок)', mu: 'Коэффициент трения' },
      legend: { v: 'скорость v', h: 'высота h', h0: 'начальный уровень h₀', zero: 'нулевой уровень' },
      scene: {
        zero: 'нулевой уровень · E_p = 0',
        h0Tag: (h) => `h₀ = ${h} м`,
        hTag: (h) => `h = ${h} м`,
        vTag: (v) => `v = ${v} м/с`,
        drag: '↕ тяните',
        hillTag: (H) => `H = ${H} м`,
        loopTag: (d) => `2R = ${d} м`,
        stepTag: (h) => `h₁ = ${h} м`,
        xAxis: 'x, м',
        yAxis: 'h, м',
        aria: (name, h, v, ek, ep) => `Трасса «${name}». Высота тележки ${h} м, скорость ${v} м/с, кинетическая энергия ${ek} Дж, потенциальная ${ep} Дж.`,
      },
      chipFr: (mu) => `Есть трение · μ = ${mu}`,
      readouts: { v: 'Скорость', h: 'Высота', e: 'Полная энергия', vmax: 'Наибольшая скорость', q: 'Теплота' },
      sub: {
        v: (k) => `≈ ${k} км/ч`,
        h: (h0) => `старт: h₀ = ${h0} м`,
        e: (ek, ep) => `E_k + E_p = ${ek} + ${ep}`,
        vmax: '√(2gh₀) — в нижней точке',
        q: (p) => `${p} % от E₀ перешло в теплоту`,
      },
      f: {
        e0: { tag: 'Начальная энергия', general: 'E₀ = E_p = mgh₀', filled: (m, h, e) => `= ${m} · 9,8 · ${h} = ${e} Дж` },
        vmax: { tag: 'Скорость в нижней точке', general: 'mgh₀ = mv²/2  ⇒  v = √(2gh₀)', filled: (h, v) => `= √(2 · 9,8 · ${h}) = ${v} м/с` },
      },
      graph: {
        title: 'График энергия — положение E(x)',
        theory: 'теоретические E_p(x) и E_k(x)',
        x: 'x, м',
        y: 'E, Дж',
        note: 'Пунктир: E_p(x) = mgh(x) повторяет форму трассы, E_k(x) = E₀ − E_p(x) — её зеркальное отражение. Белая линия — полная энергия: без трения она горизонтальна.',
        aria: 'График зависимости кинетической, потенциальной и полной энергии от положения тележки',
      },
      explain: {
        idle: 'Выберите трассу, задайте начальную высоту h₀ (тележку можно перетащить) и нажмите «Старт». Тележку отпускают без начальной скорости: сейчас вся энергия потенциальная, E = E_p = mgh₀.',
        down: (E) => `Спуск: высота уменьшается, скорость растёт — E_p переходит в кинетическую энергию (E_p → E_k). Сумма не меняется: E = E_k + E_p = ${E} Дж.`,
        up: (E) => `Подъём: скорость уменьшается, высота растёт — E_k снова переходит в потенциальную (E_k → E_p). E = ${E} Дж не меняется.`,
        downFr: (E) => `Спуск: E_p → E_k, но сила трения совершает отрицательную работу — часть энергии переходит в теплоту: E + Q = E₀ = ${E} Дж.`,
        upFr: (E) => `Подъём: E_k → E_p, а трение продолжает превращать энергию в теплоту. Полная энергия E убывает, E + Q = E₀ = ${E} Дж.`,
        bottom: (h0, v) =>
          `Нижняя точка (нулевой уровень): E_p = 0, вся энергия кинетическая. Из mgh₀ = mv²/2: v = √(2gh₀) = √(2 · 9,8 · ${h0}) = ${v} м/с — не зависит ни от массы, ни от формы трассы.`,
        bottomFr: (v, vmax, q) => `Скорость в нижней точке ${v} м/с — меньше, чем ${vmax} м/с без трения: Q = ${q} Дж энергии перешло в теплоту.`,
        turn: (h) => `Точка поворота: v = 0, E_k = 0 — вся энергия снова потенциальная. Высота h = ${h} м = h₀: тележка не может подняться выше начальной высоты.`,
        turnFr: (h, h0, q) =>
          `Точка поворота h = ${h} м — ниже начальной h₀ = ${h0} м: из-за трения Q = ${q} Дж перешло в теплоту, поэтому тележка не поднялась на прежнюю высоту.`,
        blocked: (H, h0) =>
          `Горка (H = ${H} м) выше начальной высоты (h₀ = ${h0} м): энергии не хватает. Тележка остановилась на высоте h₀ и покатилась обратно — выше h₀ она не поднимется никогда.`,
        hillTop: (H, v) => `Вершина горки (H = ${H} м): часть энергии снова стала потенциальной, остальное — кинетическая: v = √(2g(h₀ − H)) = ${v} м/с.`,
        loopTop: (top, v) => `Верх петли (2R = ${top} м): тележка вверх колёсами, но E не изменилась. Скорость v = √(2g(h₀ − 2R)) = ${v} м/с.`,
        loopFail: (top, h0) =>
          `Верх петли (2R = ${top} м) выше начальной высоты (h₀ = ${h0} м): тележка поднялась до h₀ и вернулась. Чтобы пройти петлю, нужно h₀ > 2R.`,
        plateau: (h1, v) =>
          `На ступеньке (h₁ = ${h1} м) скорость постоянна: v = √(2g(h₀ − h₁)) = ${v} м/с. На одинаковой высоте скорость всегда одинакова — неважно, каким путём пришло тело.`,
        stopped: (q, E0) =>
          `Тележка остановилась. Из начальной энергии E₀ = ${E0} Дж Q = ${q} Дж из-за трения перешло в теплоту — механическая энергия не сохранилась (это тема следующего урока).`,
      },
    },
    pend: {
      presetsLabel: 'Готовые опыты',
      presets: {
        main: { name: 'L = 2 м, α₀ = 60°', sub: 'h₀ = 1,00 м · v = 4,43 м/с' },
        short: { name: 'L = 1 м, α₀ = 60°', sub: 'h₀ = 0,50 м · v = 3,13 м/с' },
        long: { name: 'L = 3 м, α₀ = 33,6°', sub: 'h₀ = 0,50 м · v = 3,13 м/с' },
      },
      L: 'Длина нити',
      alpha: 'Угол отклонения',
      alphaHint: 'Шарик можно отклонить, перетащив его на сцене.',
      mass: 'Масса шарика',
      massHint: 'Энергия пропорциональна массе, а скорость от массы не зависит.',
      legend: { v: 'скорость v', h: 'высота h', arc: 'дуга движения', zero: 'нулевой уровень' },
      scene: {
        zero: 'нулевой уровень · E_p = 0',
        h0Tag: (h) => `h₀ = ${h} м`,
        hTag: (h) => `h = ${h} м`,
        vTag: (v) => `v = ${v} м/с`,
        drag: '↔ тяните',
        cell: (c) => `1 клетка = ${c} м`,
        aria: (th, h, v) => `Маятник: угол отклонения ${th}°, высота ${h} м, скорость ${v} м/с.`,
      },
      readouts: { theta: 'Угол', h: 'Высота', v: 'Скорость', e: 'Полная энергия' },
      sub: {
        theta: (a) => `амплитуда α₀ = ${a}°`,
        h: (h0) => `в крайней точке h₀ = ${h0} м`,
        v: (v) => `внизу √(2gh₀) = ${v} м/с`,
        e: (ek, ep) => `E_k + E_p = ${ek} + ${ep}`,
      },
      f: {
        h0: { tag: 'Высота подъёма', general: 'h₀ = L(1 − cos α₀)', filled: (L, a, h) => `= ${L} · (1 − cos ${a}°) = ${h} м` },
        vmax: { tag: 'Скорость в нижней точке', general: 'v = √(2gh₀)', filled: (h, v) => `= √(2 · 9,8 · ${h}) = ${v} м/с` },
        e: { tag: 'Полная энергия', general: 'E = mgh₀ = mv²/2', filled: (m, h, e) => `= ${m} · 9,8 · ${h} = ${e} Дж` },
      },
      graph: {
        title: 'График энергия — положение',
        x: 'x, м',
        y: 'E, Дж',
        note: 'x — смещение шарика по горизонтали. E_p(x) имеет форму «ямы»: наибольшая по краям, ноль посередине. E_k(x) — наоборот. Их сумма в каждой точке равна E₀ (белая линия).',
        aria: 'График зависимости энергий маятника от смещения по горизонтали',
      },
      explain: {
        idle: 'Отклоните шарик (перетащите его) или выберите L и α₀, затем нажмите «Старт». В крайней точке шарик покоится (v = 0) — вся энергия потенциальная: E = mgh₀.',
        down: (E) => `Движение вниз: высота уменьшается, скорость растёт — E_p → E_k. Сумма не меняется: E = ${E} Дж.`,
        up: (h0) => `Движение вверх: E_k → E_p. Шарик замедляется и с другой стороны поднимается ровно до h₀ = ${h0} м — не выше.`,
        bottom: (E, h0, v) => `Нижняя точка: E_p = 0, вся энергия кинетическая — E_k = E = ${E} Дж. Скорость наибольшая: v = √(2gh₀) = √(2 · 9,8 · ${h0}) = ${v} м/с.`,
        end: (E, h) => `Крайняя точка: на мгновение v = 0, E_k = 0 — вся энергия потенциальная: E_p = mgh = ${E} Дж, h = ${h} м. Шарик вернулся на начальную высоту.`,
      },
    },
    thr: {
      presetsLabel: 'Начальная скорость',
      presets: {
        v98: { name: 'v₀ = 9,8 м/с', sub: 'H = 4,9 м · подъём 1 с' },
        v14: { name: 'v₀ = 14 м/с', sub: 'H = 10 м · основной пример' },
        v196: { name: 'v₀ = 19,6 м/с', sub: 'H = 19,6 м · подъём 2 с' },
      },
      v0: 'Начальная скорость',
      v0Hint: (k) => `≈ ${k} км/ч, вертикально вверх`,
      mass: 'Масса мяча',
      massHint: 'Энергия пропорциональна массе, а H от массы не зависит — m сокращается.',
      legend: { v: 'скорость v', mg: 'сила тяжести mg', ep: 'E_p(h) = mgh', ek: 'E_k(h) = E − mgh', e: 'E = const' },
      scene: {
        hAxis: 'h, м',
        eAxis: 'E, Дж',
        graph: 'график E(h)',
        ground: 'Земля · нулевой уровень (E_p = 0)',
        HTag: (H) => `H = v₀²/(2g) = ${H} м`,
        vTag: (v) => `v = ${v} м/с`,
        v0Tag: (v) => `v₀ = ${v} м/с`,
        mgTag: 'mg',
        aria: (v0, h, v) => `Мяч брошен вертикально вверх со скоростью ${v0} м/с. Высота ${h} м, скорость ${v} м/с.`,
      },
      readouts: { t: 'Время', h: 'Высота', v: 'Скорость', e: 'Полная энергия' },
      sub: {
        t: (T) => `время полёта 2v₀/g = ${T} с`,
        h: (H) => `наибольшая H = ${H} м`,
        vUp: 'вверх',
        vDown: 'вниз',
        vZero: 'v = 0 — верхняя точка',
        e: (ek, ep) => `E_k + E_p = ${ek} + ${ep}`,
      },
      derive: {
        title: 'Находим высоту подъёма из энергии',
        note: 'Формула кинематики H = v₀²/(2g) получается из закона сохранения энергии в одну строку.',
        s1: { tag: '1. Внизу (h = 0)', general: 'E = E_k = mv₀²/2', filled: (m, v0, e) => `= ${m} · ${v0}² / 2 = ${e} Дж` },
        s2: { tag: '2. Вверху (v = 0)', general: 'E = E_p = mgH', filled: (m, H, e) => `= ${m} · 9,8 · ${H} = ${e} Дж` },
        s3: { tag: '3. Закон сохранения', general: 'mv₀²/2 = mgH  ⇒  H = v₀²/(2g)', filled: (v0, H) => `= ${v0}² / (2 · 9,8) = ${H} м — m сократилась` },
        s4: { tag: '4. На любой высоте', general: 'mv₀²/2 = mv²/2 + mgh  ⇒  v = √(v₀² − 2gh)', filled: (v0, h, v) => `= √(${v0}² − 2 · 9,8 · ${h}) = ${v} м/с` },
      },
      explain: {
        idle: (E) => `Выберите v₀ и нажмите «Старт». В момент броска мяч у земли (h = 0): вся энергия кинетическая, E = mv₀²/2 = ${E} Дж.`,
        rise: (E) =>
          `Подъём: сила тяжести направлена против движения — мяч замедляется, E_k → E_p. На графике справа синяя линия растёт, зелёная убывает, а их сумма E = ${E} Дж не меняется.`,
        top: (H, E) => `Верхняя точка: v = 0, E_k = 0, вся энергия потенциальная: mgH = mv₀²/2 = ${E} Дж. Отсюда H = v₀²/(2g) = ${H} м — масса сократилась.`,
        fall: 'Падение: E_p → E_k. Каждую высоту мяч проходит с той же скоростью, что и при подъёме (v = √(v₀² − 2gh)), только вниз.',
        landed: (v0, E) => `Мяч вернулся на землю со скоростью v = v₀ = ${v0} м/с: E_k снова равна ${E} Дж — энергия не исчезла, а лишь сменила форму.`,
      },
    },
  },

  en: {
    J: 'J',
    kg: 'kg',
    card: {
      eyebrow: 'Virtual lab · Statics',
      title: 'Law of conservation of total mechanical energy',
      tabsLabel: 'Choose an experiment',
      tabs: {
        track: { label: 'Track', sub: 'E = const' },
        pend: { label: 'Pendulum', sub: 'v = √(2gh)' },
        thr: { label: 'Throw up', sub: 'H = v₀²/(2g)' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Run again', reset: 'Reset' },
    slowChip: (k) => (k === 0.5 ? 'Time slowed down 2×' : 'Time slowed down 4×'),
    speedLabel: 'Time speed',
    energy: {
      title: 'Energy bars',
      ep: 'E_p — potential',
      ek: 'E_k — kinetic',
      e: 'E — total',
      q: 'Q — heat',
      e0: (v) => `E₀ = ${v} J`,
      unit: 'E, J',
      note: 'The white-framed bar is the total energy E = E_p + E_k. The dashed line is the starting energy E₀: the bar neither drops below it nor rises above it.',
      noteFr: 'With friction E decreases while Q grows: E + Q = E₀.',
      aria: (ep, ek, e) => `Energies: potential ${ep} J, kinetic ${ek} J, total ${e} J.`,
    },
    facts: {
      title: 'Remember',
      items: [
        { term: 'Total mechanical energy', text: "E = E_k + E_p, the sum of a body's kinetic and potential energy; unit — joule (J)." },
        {
          term: 'Conservation law',
          text: 'in a closed system where only gravity and elastic forces do work, E = E_k + E_p = const: energy changes form, the total stays the same.',
        },
        {
          term: 'v = √(2gh)',
          text: 'the speed at the bottom after descending a height h — it depends neither on the mass nor on the shape of the path. A body thrown straight up rises to H = v₀²/(2g).',
        },
        { term: 'Friction', text: 'when friction does work, mechanical energy decreases — part of it becomes heat Q: E + Q = E₀ (next lesson).' },
      ],
    },
    track: {
      presetsLabel: 'Track shape',
      presets: {
        u: { name: 'U-ramp', sub: 'a simple dip' },
        hill: { name: 'Hill', sub: 'a bump in the middle' },
        loop: { name: 'Loop', sub: 'loop-the-loop' },
        step: { name: 'Step', sub: 'a raised platform' },
      },
      shape: {
        u: { label: 'Bottom width', sym: 'b', hint: 'The shape changes, the speed at the bottom does not: it stays √(2gh₀).' },
        hill: { label: 'Hill height', sym: 'H', hint: 'If H > h₀ the cart cannot get over the hill.' },
        loop: { label: 'Loop radius', sym: 'R', hint: 'The top of the loop is at height 2R. The cart is locked to the rail.' },
        step: { label: 'Step height', sym: 'h₁', hint: 'Speed on the step: v = √(2g(h₀ − h₁)).' },
      },
      h0: 'Starting height',
      h0Hint: 'You can also drag the cart up and down in the scene.',
      mass: 'Cart mass',
      massHint: 'Mass changes the energy (E₀ = mgh₀), not the speed.',
      friction: { label: 'Friction', sub: 'Part of the mechanical energy turns into heat (next lesson)', mu: 'Friction coefficient' },
      legend: { v: 'velocity v', h: 'height h', h0: 'starting level h₀', zero: 'zero level' },
      scene: {
        zero: 'zero level · E_p = 0',
        h0Tag: (h) => `h₀ = ${h} m`,
        hTag: (h) => `h = ${h} m`,
        vTag: (v) => `v = ${v} m/s`,
        drag: '↕ drag',
        hillTag: (H) => `H = ${H} m`,
        loopTag: (d) => `2R = ${d} m`,
        stepTag: (h) => `h₁ = ${h} m`,
        xAxis: 'x, m',
        yAxis: 'h, m',
        aria: (name, h, v, ek, ep) => `${name} track. Cart height ${h} m, speed ${v} m/s, kinetic energy ${ek} J, potential energy ${ep} J.`,
      },
      chipFr: (mu) => `Friction on · μ = ${mu}`,
      readouts: { v: 'Speed', h: 'Height', e: 'Total energy', vmax: 'Top speed', q: 'Heat' },
      sub: {
        v: (k) => `≈ ${k} km/h`,
        h: (h0) => `start: h₀ = ${h0} m`,
        e: (ek, ep) => `E_k + E_p = ${ek} + ${ep}`,
        vmax: '√(2gh₀) — at the lowest point',
        q: (p) => `${p} % of E₀ turned into heat`,
      },
      f: {
        e0: { tag: 'Starting energy', general: 'E₀ = E_p = mgh₀', filled: (m, h, e) => `= ${m} · 9.8 · ${h} = ${e} J` },
        vmax: { tag: 'Speed at the lowest point', general: 'mgh₀ = mv²/2  ⇒  v = √(2gh₀)', filled: (h, v) => `= √(2 · 9.8 · ${h}) = ${v} m/s` },
      },
      graph: {
        title: 'Energy–position graph E(x)',
        theory: 'theoretical E_p(x) and E_k(x)',
        x: 'x, m',
        y: 'E, J',
        note: 'Dashed: E_p(x) = mgh(x) copies the track shape, E_k(x) = E₀ − E_p(x) is its mirror image. The white line is the total energy: without friction it is flat.',
        aria: 'Graph of kinetic, potential and total energy against the position of the cart',
      },
      explain: {
        idle: 'Choose a track, set the starting height h₀ (you can drag the cart) and press Start. The cart is released from rest: right now all its energy is potential, E = E_p = mgh₀.',
        down: (E) => `Going down: height falls, speed grows — E_p turns into kinetic energy (E_p → E_k). The total does not change: E = E_k + E_p = ${E} J.`,
        up: (E) => `Going up: speed falls, height grows — E_k turns back into potential energy (E_k → E_p). E = ${E} J stays the same.`,
        downFr: (E) => `Going down: E_p → E_k, but friction does negative work — part of the energy becomes heat: E + Q = E₀ = ${E} J.`,
        upFr: (E) => `Going up: E_k → E_p, while friction keeps turning energy into heat. The total E keeps falling, E + Q = E₀ = ${E} J.`,
        bottom: (h0, v) =>
          `Lowest point (zero level): E_p = 0, all the energy is kinetic. From mgh₀ = mv²/2: v = √(2gh₀) = √(2 · 9.8 · ${h0}) = ${v} m/s — independent of the mass and of the track shape.`,
        bottomFr: (v, vmax, q) => `Speed at the bottom is ${v} m/s — less than the ${vmax} m/s without friction: Q = ${q} J of energy has become heat.`,
        turn: (h) => `Turning point: v = 0, E_k = 0 — all the energy is potential again. Height h = ${h} m = h₀: the cart cannot rise above its starting height.`,
        turnFr: (h, h0, q) =>
          `Turning point at h = ${h} m — below the starting h₀ = ${h0} m: friction turned Q = ${q} J into heat, so the cart could not climb back to its old height.`,
        blocked: (H, h0) =>
          `The hill (H = ${H} m) is higher than the starting height (h₀ = ${h0} m): not enough energy. The cart stopped at height h₀ and rolled back — it never rises above h₀.`,
        hillTop: (H, v) => `Top of the hill (H = ${H} m): part of the energy is potential again, the rest is kinetic: v = √(2g(h₀ − H)) = ${v} m/s.`,
        loopTop: (top, v) => `Top of the loop (2R = ${top} m): the cart is upside down, but E has not changed. Speed v = √(2g(h₀ − 2R)) = ${v} m/s.`,
        loopFail: (top, h0) =>
          `The top of the loop (2R = ${top} m) is above the starting height (h₀ = ${h0} m): the cart climbed to h₀ and came back. To pass the loop you need h₀ > 2R.`,
        plateau: (h1, v) =>
          `On the step (h₁ = ${h1} m) the speed is constant: v = √(2g(h₀ − h₁)) = ${v} m/s. At the same height the speed is always the same, whatever the path.`,
        stopped: (q, E0) =>
          `The cart has stopped. Of the starting E₀ = ${E0} J, Q = ${q} J has turned into heat because of friction — mechanical energy was not conserved (the topic of the next lesson).`,
      },
    },
    pend: {
      presetsLabel: 'Ready-made experiments',
      presets: {
        main: { name: 'L = 2 m, α₀ = 60°', sub: 'h₀ = 1.00 m · v = 4.43 m/s' },
        short: { name: 'L = 1 m, α₀ = 60°', sub: 'h₀ = 0.50 m · v = 3.13 m/s' },
        long: { name: 'L = 3 m, α₀ = 33.6°', sub: 'h₀ = 0.50 m · v = 3.13 m/s' },
      },
      L: 'String length',
      alpha: 'Release angle',
      alphaHint: 'You can also drag the bob aside in the scene.',
      mass: 'Bob mass',
      massHint: 'Energy is proportional to mass; the speed does not depend on it.',
      legend: { v: 'velocity v', h: 'height h', arc: 'path of the swing', zero: 'zero level' },
      scene: {
        zero: 'zero level · E_p = 0',
        h0Tag: (h) => `h₀ = ${h} m`,
        hTag: (h) => `h = ${h} m`,
        vTag: (v) => `v = ${v} m/s`,
        drag: '↔ drag',
        cell: (c) => `1 square = ${c} m`,
        aria: (th, h, v) => `Pendulum: angle ${th}°, height ${h} m, speed ${v} m/s.`,
      },
      readouts: { theta: 'Angle', h: 'Height', v: 'Speed', e: 'Total energy' },
      sub: {
        theta: (a) => `amplitude α₀ = ${a}°`,
        h: (h0) => `at the ends h₀ = ${h0} m`,
        v: (v) => `at the bottom √(2gh₀) = ${v} m/s`,
        e: (ek, ep) => `E_k + E_p = ${ek} + ${ep}`,
      },
      f: {
        h0: { tag: 'Rise height', general: 'h₀ = L(1 − cos α₀)', filled: (L, a, h) => `= ${L} · (1 − cos ${a}°) = ${h} m` },
        vmax: { tag: 'Speed at the lowest point', general: 'v = √(2gh₀)', filled: (h, v) => `= √(2 · 9.8 · ${h}) = ${v} m/s` },
        e: { tag: 'Total energy', general: 'E = mgh₀ = mv²/2', filled: (m, h, e) => `= ${m} · 9.8 · ${h} = ${e} J` },
      },
      graph: {
        title: 'Energy–position graph',
        x: 'x, m',
        y: 'E, J',
        note: 'x is the sideways displacement of the bob. E_p(x) forms a "well": largest at the ends, zero in the middle. E_k(x) is the other way round. Their sum equals E₀ at every point (white line).',
        aria: 'Graph of the pendulum energies against the sideways displacement',
      },
      explain: {
        idle: 'Drag the bob aside or choose L and α₀, then press Start. At the end point the bob is at rest (v = 0) — all its energy is potential: E = mgh₀.',
        down: (E) => `Swinging down: height falls, speed grows — E_p → E_k. The total does not change: E = ${E} J.`,
        up: (h0) => `Swinging up: E_k → E_p. The bob slows down and on the other side rises exactly to h₀ = ${h0} m — no higher.`,
        bottom: (E, h0, v) => `Lowest point: E_p = 0, all the energy is kinetic — E_k = E = ${E} J. The speed is greatest: v = √(2gh₀) = √(2 · 9.8 · ${h0}) = ${v} m/s.`,
        end: (E, h) => `End point: for an instant v = 0, E_k = 0 — all the energy is potential: E_p = mgh = ${E} J, h = ${h} m. The bob is back at its starting height.`,
      },
    },
    thr: {
      presetsLabel: 'Launch speed',
      presets: {
        v98: { name: 'v₀ = 9.8 m/s', sub: 'H = 4.9 m · rise 1 s' },
        v14: { name: 'v₀ = 14 m/s', sub: 'H = 10 m · main example' },
        v196: { name: 'v₀ = 19.6 m/s', sub: 'H = 19.6 m · rise 2 s' },
      },
      v0: 'Launch speed',
      v0Hint: (k) => `≈ ${k} km/h, straight up`,
      mass: 'Ball mass',
      massHint: 'Energy is proportional to mass, but H does not depend on it — m cancels out.',
      legend: { v: 'velocity v', mg: 'gravity mg', ep: 'E_p(h) = mgh', ek: 'E_k(h) = E − mgh', e: 'E = const' },
      scene: {
        hAxis: 'h, m',
        eAxis: 'E, J',
        graph: 'E(h) graph',
        ground: 'Ground · zero level (E_p = 0)',
        HTag: (H) => `H = v₀²/(2g) = ${H} m`,
        vTag: (v) => `v = ${v} m/s`,
        v0Tag: (v) => `v₀ = ${v} m/s`,
        mgTag: 'mg',
        aria: (v0, h, v) => `A ball thrown straight up at ${v0} m/s. Height ${h} m, speed ${v} m/s.`,
      },
      readouts: { t: 'Time', h: 'Height', v: 'Speed', e: 'Total energy' },
      sub: {
        t: (T) => `flight time 2v₀/g = ${T} s`,
        h: (H) => `highest H = ${H} m`,
        vUp: 'upwards',
        vDown: 'downwards',
        vZero: 'v = 0 — the top',
        e: (ek, ep) => `E_k + E_p = ${ek} + ${ep}`,
      },
      derive: {
        title: 'Finding the height from energy',
        note: 'The kinematics formula H = v₀²/(2g) follows from energy conservation in one line.',
        s1: { tag: '1. At the bottom (h = 0)', general: 'E = E_k = mv₀²/2', filled: (m, v0, e) => `= ${m} · ${v0}² / 2 = ${e} J` },
        s2: { tag: '2. At the top (v = 0)', general: 'E = E_p = mgH', filled: (m, H, e) => `= ${m} · 9.8 · ${H} = ${e} J` },
        s3: { tag: '3. Conservation law', general: 'mv₀²/2 = mgH  ⇒  H = v₀²/(2g)', filled: (v0, H) => `= ${v0}² / (2 · 9.8) = ${H} m — m cancelled` },
        s4: { tag: '4. At any height', general: 'mv₀²/2 = mv²/2 + mgh  ⇒  v = √(v₀² − 2gh)', filled: (v0, h, v) => `= √(${v0}² − 2 · 9.8 · ${h}) = ${v} m/s` },
      },
      explain: {
        idle: (E) => `Choose v₀ and press Start. At the moment of the throw the ball is at the ground (h = 0): all its energy is kinetic, E = mv₀²/2 = ${E} J.`,
        rise: (E) =>
          `Rising: gravity acts against the motion — the ball slows down, E_k → E_p. In the graph on the right the blue line grows, the green one shrinks, and their sum E = ${E} J stays the same.`,
        top: (H, E) => `Highest point: v = 0, E_k = 0, all the energy is potential: mgH = mv₀²/2 = ${E} J. Hence H = v₀²/(2g) = ${H} m — the mass cancelled out.`,
        fall: 'Falling: E_p → E_k. The ball passes every height with the same speed as on the way up (v = √(v₀² − 2gh)), only downwards.',
        landed: (v0, E) => `The ball is back on the ground with v = v₀ = ${v0} m/s: E_k is again ${E} J — no energy was lost, it only changed form.`,
      },
    },
  },
};

export default function EnergyConservation() {
  const T = useSimText(TEXT);
  const tabs = [
    { id: 'track', ...T.card.tabs.track, icon: Spline, render: () => <TrackSim T={T} /> },
    { id: 'pend', ...T.card.tabs.pend, icon: Clock, render: () => <PendulumSim T={T} /> },
    { id: 'thr', ...T.card.tabs.thr, icon: ArrowUpFromLine, render: () => <ThrowSim T={T} /> },
  ];
  const facts = { title: T.facts.title, items: T.facts.items.map((f) => ({ term: f.term, text: <Rich>{f.text}</Rich> })) };
  return <SimCard eyebrow={T.card.eyebrow} title={T.card.title} tabsLabel={T.card.tabsLabel} tabs={tabs} facts={facts} icon={BatteryCharging} idPrefix="encons" />;
}
