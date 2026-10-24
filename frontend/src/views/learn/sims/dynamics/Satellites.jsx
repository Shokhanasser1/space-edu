import { Orbit, Rocket, Satellite, Sigma } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { useSimText } from '../kit/lang';
import CannonSim from './Satellites.cannon';
import OrbitSim from './Satellites.orbit';
import DeriveSim from './Satellites.derive';

/**
 * Lesson "Artificial satellites of the Earth" (Yerning sun'iy yo'ldoshlari):
 * a satellite is a body falling round the Earth, its centripetal
 * acceleration supplied by gravity.
 *
 *   cannon - Newton's cannon: a horizontal shot from an imagined mountain
 *            falls back below 7.9 km/s, circles at 7.9 km/s (v₁), traces an
 *            ellipse above it and leaves at 11.2 km/s (v₂) — integrated
 *            numerically from a = −GM·r/r³.
 *   orbit  - the orbit calculator: v = √(GM/r), T = 2πr/v and g(h) for the
 *            ISS (400 km → 7.67 km/s, 92.4 min), GPS, geostationary
 *            (r ≈ 42 200 km, T ≈ 24 h) and the Moon, Earth drawn to scale.
 *   derive - the first cosmic speed step by step: mv²/R = mg ⇒
 *            v₁ = √(gR) = √(9.8 · 6.4·10⁶) ≈ 7.9 km/s, with the vectors.
 *
 * Constants: GM = 3.986·10¹⁴ m³/s², R = 6371 km (the derivation tab uses the
 * school values g = 9.8 m/s², R = 6400 km and says so).
 */
const TEXT = {
  uz: {
    common: {
      pause: "To'xtatish",
      resume: 'Davom etish',
      reset: 'Qayta',
      fire: 'Otish',
      clear: 'Tozalash',
      faster: (k) => `Vaqt ×${k} tezlashtirilgan`,
      cell: (c) => `1 katak = ${c}`,
      min: 'min',
      day: 'sutka',
      kms: 'km/s',
      prev: 'Oldingi',
      next: 'Keyingi',
    },
    card: {
      eyebrow: 'Virtual laboratoriya · Dinamika',
      title: "Yerning sun'iy yo'ldoshlari",
      tabsLabel: 'Simulyatorni tanlang',
      tabs: {
        cannon: { label: "Nyuton to'pi", sub: 'Tushadimi yoki aylanadimi?' },
        orbit: { label: 'Orbita kalkulyatori', sub: 'v = √(GM/r) · T = 2πr/v' },
        derive: { label: 'Birinchi kosmik tezlik', sub: 'mv²/R = mg' },
      },
    },
    facts: {
      title: 'Eslab qoling',
      items: [
        {
          term: "Sun'iy yo'ldosh",
          text: "Yer atrofida orbita bo'ylab aylanuvchi jism. U to'xtovsiz Yerga «tushadi», ammo sirt ham xuddi shunday egiladi — shuning uchun yerga yetib bormaydi.",
        },
        { term: 'Birinchi kosmik tezlik v₁', text: 'Yer sirti yaqinidagi aylana orbita tezligi: mv²/R = mg ⇒ v₁ = √(gR) ≈ 7.9 km/s.' },
        { term: 'Orbital tezlik va davr', text: 'h balandlikda v = √(GM/(R+h)), T = 2π(R+h)/v. Orbita qancha baland bo‘lsa, tezlik shuncha kichik, davr shuncha katta.' },
        { term: 'Ikkinchi kosmik tezlik v₂', text: "v₂ = √2·v₁ ≈ 11.2 km/s — bunday tezlikdagi jism Yerning tortishishini yengib, uni butunlay tark etadi." },
      ],
    },
    cannon: {
      presetsLabel: 'Otish tezligi',
      presets: {
        near: 'yaqinga tushadi',
        far: 'uzoqqa tushadi',
        circle: 'aylana orbita · v₁',
        ellipse: 'ellips orbita',
        escape: 'Yerni tark etadi · v₂',
      },
      noAir: "Havo qarshiligi yo'q",
      legend: { path: 'trayektoriya', old: 'oldingi otishlar', v: 'tezlik v', a: 'tezlanish a (markazga)' },
      sceneLabel: (v, h, out) => `Nyuton to'pi: otish tezligi ${v} km/s, hozirgi balandlik ${h} km. ${out}`,
      earth: 'Yer',
      cannon: "to'p",
      leaves: 'Yerni tark etmoqda →',
      offView: 'ekrandan chiqdi',
      mountain: (h) => `Tog' (h ≈ ${h} km) va to'p kattalashtirib chizilgan`,
      mountainShort: "Tog' kattalashtirib chizilgan",
      v0: 'Otish tezligi',
      v0Hint: "Tezlikni o'zgartiring va «Otish»ni bosing",
      readouts: {
        v0: 'Otish tezligi',
        v0Sub: (r) => `v₀ / v₁ = ${r}`,
        h: 'Balandlik',
        hSub: (r) => `Yer markazidan r = ${r} km`,
        v: 'Hozirgi tezlik',
        vSub: (g) => `shu yerda g = GM/r² = ${g} m/s²`,
        out: 'Natija',
      },
      outcome: {
        none: '—',
        idleSub: 'hali otilmadi',
        wait: 'Uchmoqda…',
        waitSub: 'natijani kuzating',
        land: 'Yerga tushdi',
        circle: 'Aylana orbita',
        ellipse: 'Ellips orbita',
        away: 'Uzoq ellips',
        escape: 'Yerni tark etdi',
      },
      outSub: {
        land: (d) => `${d} km uzoqlikda (sirt bo'ylab)`,
        circle: (T) => `aylanish davri T = ${T}`,
        ellipse: (h, T) => `apogey ${h} km · T = ${T}`,
        away: (h, T) => `apogey ${h} km · T = ${T}`,
        escape: 'qaytib kelmaydi',
      },
      scale: { title: 'Tezliklar shkalasi, km/s', fall: 'Yerga qaytadi', ellipse: 'ellips (v₁ < v < v₂)', escape: 'Yerni tark etadi', shots: 'otilganlar' },
      calcNote: (R, h) => `r₀ = R + h — cho'qqidan Yer markazigacha masofa: R = ${R} km, h ≈ ${h} km. GM = 3.986·10¹⁴ m³/s².`,
      graph: {
        title: 'Balandlik grafigi h(t)',
        series: 'h',
        x: { s: 't, s', min: 't, min', h: 't, soat' },
        y: 'h, km',
        idle: '«Otish»ni bosing — balandlik grafigi chiziladi.',
        note: {
          land: 'Balandlik nolga tushdi — jism Yerga qaytdi.',
          circle: "Aylana orbitada balandlik o'zgarmaydi.",
          ellipse: "Ellipsda jism goh uzoqlashadi, goh yaqinlashadi — grafik to'lqinsimon.",
          away: "Jism uzoqlashmoqda — grafik ko'rinish chegarasigacha ko'tariladi.",
          escape: "Balandlik to'xtovsiz ortadi — jism qaytmaydi.",
        },
        aria: "Jism balandligining vaqtga bog'liqlik grafigi",
      },
      explain: {
        idle: "Juda baland tog' cho'qqisidagi to'p jismni gorizontal otadi. Havo yo'q: jismga faqat Yerning tortishish kuchi ta'sir qiladi. Tezlikni tanlang va «Otish»ni bosing.",
        fall: 'Jism Yerga tushib bormoqda. Ammo u qancha tez otilsa, shuncha uzoqqa uchadi: Yer sirti uning ostida egilib boradi.',
        land: (d, v) => `Jism ${d} km uzoqlikka borib tushdi. ${v} km/s birinchi kosmik tezlikdan (7.9 km/s) kichik — tortishish uni Yerga qaytardi.`,
        circle: (T) =>
          `7.9 km/s — birinchi kosmik tezlik! Jism to'xtovsiz Yerga «tushadi», ammo Yer sirti ham xuddi shunday egiladi: u Yerni ${T} da aylanib chiqadi. Bu — sun'iy yo'ldosh.`,
        ellipseFly: "Jism Yerdan uzoqlashgan sari sekinlashadi (tortishish uni tormozlaydi), so'ng yana tezlashib qaytib keladi.",
        ellipse: (h, T) => `Tezlik v₁ dan katta, ammo v₂ dan kichik — orbita ellips bo'ldi. Eng uzoq nuqtasi (apogey) Yer sirtidan ${h} km balandda, aylanish davri ${T}.`,
        away: (h, T) => `Ellips shunchalik cho'zildiki, ekranga sig'madi: jism ${h} km gacha uzoqlashadi va ${T} dan keyin qaytib keladi.`,
        escapeFly: "Jism Yerdan uzoqlashmoqda va sekinlashmoqda, lekin to'xtamayapti…",
        escape: (v) => `v₀ = ${v} km/s ≥ v₂ ≈ 11.2 km/s — ikkinchi kosmik tezlik. Tortishish jismni qaytara olmaydi: u Yerni butunlay tark etadi.`,
      },
    },
    orbit: {
      presetsLabel: 'Orbitalar',
      presets: {
        surface: { name: 'Yer sirtida', sub: 'h = 0 · v₁', short: 'v₁' },
        iss: { name: 'XKS', sub: 'h ≈ 400 km', short: 'XKS' },
        gps: { name: 'GPS', sub: 'h ≈ 20 200 km', short: 'GPS' },
        geo: { name: 'Geostatsionar', sub: 'h ≈ 35 800 km', short: 'GEO' },
        moon: { name: 'Oy', sub: 'r ≈ 384 400 km', short: 'Oy' },
      },
      legend: { orbit: 'orbita', v: 'orbital tezlik v', a: 'tezlanish a = g', r: 'r = R + h' },
      sceneLabel: (h, v, T) => `Yer shimoliy qutb tomondan: balandlik ${h} km, tezlik ${v} km/s, davr ${T}.`,
      earth: 'Yer',
      moonName: 'Oy',
      iss: 'XKS',
      gps: "GPS yo'ldoshi",
      geoSat: "aloqa yo'ldoshi",
      sat: "yo'ldosh",
      together: 'Yer bilan birga aylanadi',
      hTag: (h) => `h = ${h} km`,
      rTag: (r) => `r = ${r} km`,
      dirOnly: "Yer va orbita masshtabda, yo'ldosh kattalashtirilgan · v uzunligi tezlikka mos",
      dirOnlyShort: 'Yer va orbita masshtabda',
      h: 'Balandlik (Yer sirtidan)',
      hHint: "Shkala logarifmik: o'ngga surgan sari masofa tez ortadi",
      readouts: {
        v: 'Orbital tezlik',
        vSub: (kmh) => `≈ ${kmh} km/soat`,
        T: 'Aylanish davri',
        perDay: (n) => `sutkasiga ${n} marta aylanadi`,
        g: 'Shu balandlikda g',
        gSub: (p) => `Yer sirtidagi g ning ${p} %`,
        r: 'Markazgacha masofa',
        rSub: (h, k) => `h = ${h} km · r = ${k}·R`,
      },
      calc: {
        title: 'Hisoblash (SI)',
        note: "GM = 3.986·10¹⁴ m³/s², R = 6371 km. GM = g₀R² bo'lgani uchun v = √(g₀R²/(R+h)) deb ham yozish mumkin (g₀ = 9.8 m/s²).",
      },
      graph: {
        title: 'Balandlik ortsa — tezlik kamayadi',
        x: 'r, ming km',
        y: 'v, km/s',
        note: "Grafikni bosing yoki suring — orbita radiusi o'zgaradi. Gorizontal shkala logarifmik.",
        aria: "Orbital tezlikning orbita radiusiga bog'liqlik grafigi",
      },
      explain: {
        surface: (v, T) =>
          `h = 0 — bu birinchi kosmik tezlik: v₁ = ${v} km/s, bir aylanish ${T}. Amalda bunday past orbita bo'lmaydi — havo qarshiligi yo'ldoshni tezda to'xtatadi.`,
        iss: (v, T, n, g) =>
          `Xalqaro kosmik stansiya ${v} km/s tezlikda uchadi va Yerni ${T} da aylanib chiqadi — sutkasiga ${n} marta. U yerda ham g ≈ ${g} m/s²: kosmonavtlar tortishish yo'qligidan emas, stansiya bilan birga to'xtovsiz erkin tushayotgani uchun vaznsiz.`,
        gps: (v, T) => `GPS yo'ldoshlari ${v} km/s tezlikda uchadi, aylanish davri ${T} — sutkada 2 marta aylanadi. Orbita qancha baland bo'lsa, tezlik shuncha kichik.`,
        geo: (T) =>
          `Geostatsionar orbita: r ≈ 42 200 km, T = ${T} ≈ 24 soat — Yerning o'z o'qi atrofida aylanish davriga teng. Yo'ldosh ekvatordagi bir nuqta ustida «qotib» turadi: televideniye va aloqa antennalari unga qimirlamay qaraydi.`,
        moon: (v, T) => `Oy — Yerning tabiiy yo'ldoshi, unga ham shu formula to'g'ri keladi: v = ${v} km/s, T = ${T} (kuzatilgani 27.3 sutka).`,
        custom: (h, v, T) => `h = ${h} km: v = √(GM/r) = ${v} km/s, T = ${T}. Balandlik ortgan sari tortishish zaiflashadi: tezlik kamayadi, davr esa tez ortadi.`,
      },
    },
    derive: {
      presetsLabel: 'Osmon jismi',
      planets: { earth: { name: 'Yer' }, moon: { name: 'Oy' }, mars: { name: 'Mars' }, jupiter: { name: 'Yupiter' } },
      legend: { v: 'tezlik v (urinma)', a: 'markazga intilma tezlanish a', F: "og'irlik kuchi mg", orbit: 'orbita (r ≈ R)' },
      sceneLabel: (name, v, n) => `${name} atrofidagi sun'iy yo'ldosh, ${n}-qadam. Birinchi kosmik tezlik ${v} km/s.`,
      stepsTitle: 'Keltirib chiqaramiz',
      stepOf: (i, n) => `${i} / ${n}`,
      steps: [
        {
          title: "Aylana bo'ylab harakat",
          text: "Yo'ldosh sirt yaqinida, radiusi R bo'lgan aylana bo'ylab tekis harakatlanadi. Tezlik v aylanaga urinma, tezlanish esa markazga yo'nalgan.",
        },
        { title: "Qaysi kuch ta'sir qiladi?", text: "Faqat og'irlik kuchi F = mg (havo qarshiligi yo'q). U ham markazga yo'nalgan — tezlanishni aynan u beradi." },
        {
          title: 'Nyutonning ikkinchi qonuni',
          text: "ma = F ga a = v²/R va F = mg ni qo'yamiz. m ikkala tomonda bor — qisqaradi: tezlik yo'ldosh massasiga bog'liq emas.",
        },
        { title: 'Hisoblaymiz', text: "g va R ni SI birliklarida qo'yamiz (maktab masalalarida Yer uchun R ≈ 6400 km olinadi)." },
        {
          title: 'Tekshiruv: 1 sekundda',
          text: "1 s da yo'ldosh urinma bo'ylab vt yo'l bosadi va gt²/2 ga «tushadi». Sirt ham shu masofada aynan shuncha pastga egiladi — balandlik o'zgarmaydi.",
        },
      ],
      explain: [
        "Yo'ldosh tezligining kattaligi o'zgarmaydi, ammo yo'nalishi doim buriladi. Demak, unda tezlanish bor va u markazga yo'nalgan: a = v²/R.",
        "Bu tezlanishni og'irlik kuchi beradi: F = mg ham markazga yo'nalgan — tezlanish bilan bir xil yo'nalishda. Boshqa kuch yo'q.",
        "Nyutonning II qonuni: m·v²/R = mg, ya'ni v² = gR. Massa qisqardi — kichik yo'ldosh ham, ulkan stansiya ham bir xil tezlikda aylanadi.",
        (name, v, T) => `${name}: v₁ = √(gR) ≈ ${v} km/s. Shunday tezlikda yo'ldosh sirt yonida ${T} minutda bir marta aylanib chiqadi.`,
        (v, d) =>
          `1 s da yo'ldosh ${v} km uchadi va ${d} m «tushadi». Sirt ham shu ${v} km da ${d} m pastga egiladi — yo'ldosh yerga yaqinlashmaydi. U to'xtovsiz tushadi, lekin hech qachon yetib bormaydi!`,
      ],
      readouts: {
        R: 'Radius',
        g: 'Erkin tushish tezlanishi',
        gSub: 'sirtda',
        v1: 'Birinchi kosmik tezlik',
        v1Sub: (v2) => `v₂ = √2·v₁ ≈ ${v2} km/s`,
        T: 'Aylanish davri',
        TSub: (s) => `T = 2πR/v₁ = ${s} s`,
      },
      tangentTag: (v, km) => `vt = ${v} ${km}`,
      dropTag: (d, m) => `gt²/2 = ${d} ${m}`,
      noScale: (v, d) => `Masshtabsiz: aslida ${v} km yo'lda atigi ${d} m`,
      orbitLow: "Orbita sirtga juda yaqin (r ≈ R), havo qarshiligi yo'q",
    },
  },

  ru: {
    common: {
      pause: 'Пауза',
      resume: 'Продолжить',
      reset: 'Сброс',
      fire: 'Выстрел',
      clear: 'Очистить',
      faster: (k) => `Время ускорено ×${k}`,
      cell: (c) => `1 клетка = ${c}`,
      min: 'мин',
      day: 'сут',
      kms: 'км/с',
      prev: 'Назад',
      next: 'Далее',
    },
    card: {
      eyebrow: 'Виртуальная лаборатория · Динамика',
      title: 'Искусственные спутники Земли',
      tabsLabel: 'Выберите симулятор',
      tabs: {
        cannon: { label: 'Пушка Ньютона', sub: 'Упадёт или облетит?' },
        orbit: { label: 'Калькулятор орбит', sub: 'v = √(GM/r) · T = 2πr/v' },
        derive: { label: 'Первая космическая', sub: 'mv²/R = mg' },
      },
    },
    facts: {
      title: 'Запомните',
      items: [
        {
          term: 'Искусственный спутник',
          text: 'тело, обращающееся вокруг Земли по орбите. Оно всё время «падает» на Землю, но поверхность уходит вниз так же быстро — поэтому оно не долетает до неё.',
        },
        { term: 'Первая космическая скорость v₁', text: 'скорость круговой орбиты у поверхности Земли: mv²/R = mg ⇒ v₁ = √(gR) ≈ 7,9 км/с.' },
        { term: 'Орбитальная скорость и период', text: 'на высоте h: v = √(GM/(R+h)), T = 2π(R+h)/v. Чем выше орбита, тем меньше скорость и больше период.' },
        { term: 'Вторая космическая скорость v₂', text: 'v₂ = √2·v₁ ≈ 11,2 км/с — с такой скоростью тело преодолевает притяжение Земли и навсегда её покидает.' },
      ],
    },
    cannon: {
      presetsLabel: 'Скорость выстрела',
      presets: {
        near: 'падает близко',
        far: 'падает далеко',
        circle: 'круговая орбита · v₁',
        ellipse: 'эллиптическая орбита',
        escape: 'покидает Землю · v₂',
      },
      noAir: 'Сопротивления воздуха нет',
      legend: { path: 'траектория', old: 'прежние выстрелы', v: 'скорость v', a: 'ускорение a (к центру)' },
      sceneLabel: (v, h, out) => `Пушка Ньютона: скорость выстрела ${v} км/с, высота ${h} км. ${out}`,
      earth: 'Земля',
      cannon: 'пушка',
      leaves: 'покидает Землю →',
      offView: 'ушло за край',
      mountain: (h) => `Гора (h ≈ ${h} км) и пушка нарисованы увеличенными`,
      mountainShort: 'Гора нарисована увеличенной',
      v0: 'Скорость выстрела',
      v0Hint: 'Меняйте скорость и нажимайте «Выстрел»',
      readouts: {
        v0: 'Скорость выстрела',
        v0Sub: (r) => `v₀ / v₁ = ${r}`,
        h: 'Высота',
        hSub: (r) => `от центра Земли r = ${r} км`,
        v: 'Скорость сейчас',
        vSub: (g) => `здесь g = GM/r² = ${g} м/с²`,
        out: 'Итог',
      },
      outcome: {
        none: '—',
        idleSub: 'выстрела ещё не было',
        wait: 'Летит…',
        waitSub: 'следите за итогом',
        land: 'Упало на Землю',
        circle: 'Круговая орбита',
        ellipse: 'Эллипс',
        away: 'Дальний эллипс',
        escape: 'Покинуло Землю',
      },
      outSub: {
        land: (d) => `в ${d} км (по поверхности)`,
        circle: (T) => `период T = ${T}`,
        ellipse: (h, T) => `апогей ${h} км · T = ${T}`,
        away: (h, T) => `апогей ${h} км · T = ${T}`,
        escape: 'не вернётся',
      },
      scale: { title: 'Шкала скоростей, км/с', fall: 'возвращается на Землю', ellipse: 'эллипс (v₁ < v < v₂)', escape: 'покидает Землю', shots: 'выстрелы' },
      calcNote: (R, h) => `r₀ = R + h — расстояние от вершины до центра Земли: R = ${R} км, h ≈ ${h} км. GM = 3,986·10¹⁴ м³/с².`,
      graph: {
        title: 'График высоты h(t)',
        series: 'h',
        x: { s: 't, с', min: 't, мин', h: 't, ч' },
        y: 'h, км',
        idle: 'Нажмите «Выстрел» — появится график высоты.',
        note: {
          land: 'Высота упала до нуля — тело вернулось на Землю.',
          circle: 'На круговой орбите высота не меняется.',
          ellipse: 'На эллипсе тело то удаляется, то приближается — график волнообразный.',
          away: 'Тело удаляется — график растёт до края области.',
          escape: 'Высота растёт без конца — тело не вернётся.',
        },
        aria: 'График зависимости высоты тела от времени',
      },
      explain: {
        idle: 'Пушка на вершине очень высокой горы стреляет горизонтально. Воздуха нет: на тело действует только сила притяжения Земли. Выберите скорость и нажмите «Выстрел».',
        fall: 'Тело падает на Землю. Но чем больше скорость выстрела, тем дальше оно улетает: поверхность Земли изгибается под ним.',
        land: (d, v) => `Тело упало в ${d} км от горы. ${v} км/с меньше первой космической скорости (7,9 км/с) — притяжение вернуло его на Землю.`,
        circle: (T) =>
          `7,9 км/с — первая космическая скорость! Тело всё время «падает» на Землю, но поверхность изгибается так же: оно облетает Землю за ${T}. Это искусственный спутник.`,
        ellipseFly: 'Удаляясь от Земли, тело замедляется (притяжение тормозит его), а затем снова разгоняется и возвращается.',
        ellipse: (h, T) => `Скорость больше v₁, но меньше v₂ — орбита стала эллипсом. Самая далёкая точка (апогей) — на высоте ${h} км, период обращения ${T}.`,
        away: (h, T) => `Эллипс так вытянулся, что не помещается на экране: тело удалится на ${h} км и вернётся через ${T}.`,
        escapeFly: 'Тело удаляется от Земли и замедляется, но не останавливается…',
        escape: (v) => `v₀ = ${v} км/с ≥ v₂ ≈ 11,2 км/с — вторая космическая скорость. Притяжение не может вернуть тело: оно навсегда покидает Землю.`,
      },
    },
    orbit: {
      presetsLabel: 'Орбиты',
      presets: {
        surface: { name: 'У поверхности', sub: 'h = 0 · v₁', short: 'v₁' },
        iss: { name: 'МКС', sub: 'h ≈ 400 км', short: 'МКС' },
        gps: { name: 'GPS', sub: 'h ≈ 20 200 км', short: 'GPS' },
        geo: { name: 'Геостационарная', sub: 'h ≈ 35 800 км', short: 'ГСО' },
        moon: { name: 'Луна', sub: 'r ≈ 384 400 км', short: 'Луна' },
      },
      legend: { orbit: 'орбита', v: 'орбитальная скорость v', a: 'ускорение a = g', r: 'r = R + h' },
      sceneLabel: (h, v, T) => `Земля со стороны Северного полюса: высота ${h} км, скорость ${v} км/с, период ${T}.`,
      earth: 'Земля',
      moonName: 'Луна',
      iss: 'МКС',
      gps: 'спутник GPS',
      geoSat: 'спутник связи',
      sat: 'спутник',
      together: 'вращается вместе с Землёй',
      hTag: (h) => `h = ${h} км`,
      rTag: (r) => `r = ${r} км`,
      dirOnly: 'Земля и орбита в масштабе, спутник увеличен · длина v — по скорости',
      dirOnlyShort: 'Земля и орбита в масштабе',
      h: 'Высота над поверхностью',
      hHint: 'Шкала логарифмическая: чем правее, тем быстрее растёт расстояние',
      readouts: {
        v: 'Орбитальная скорость',
        vSub: (kmh) => `≈ ${kmh} км/ч`,
        T: 'Период обращения',
        perDay: (n) => `${n} об. в сутки`,
        g: 'g на этой высоте',
        gSub: (p) => `${p} % от g у поверхности`,
        r: 'Расстояние до центра',
        rSub: (h, k) => `h = ${h} км · r = ${k}·R`,
      },
      calc: {
        title: 'Расчёт (СИ)',
        note: 'GM = 3,986·10¹⁴ м³/с², R = 6371 км. Так как GM = g₀R², можно писать и v = √(g₀R²/(R+h)), g₀ = 9,8 м/с².',
      },
      graph: {
        title: 'Чем выше — тем медленнее',
        x: 'r, тыс. км',
        y: 'v, км/с',
        note: 'Нажмите или проведите по графику — радиус орбиты изменится. Горизонтальная шкала логарифмическая.',
        aria: 'График зависимости орбитальной скорости от радиуса орбиты',
      },
      explain: {
        surface: (v, T) =>
          `h = 0 — это первая космическая скорость: v₁ = ${v} км/с, один оборот за ${T}. На деле такой низкой орбиты нет — сопротивление воздуха быстро остановило бы спутник.`,
        iss: (v, T, n, g) =>
          `МКС летит со скоростью ${v} км/с и облетает Землю за ${T} — ${n} раза в сутки. Там тоже g ≈ ${g} м/с²: космонавты невесомы не потому, что нет притяжения, а потому, что вместе со станцией непрерывно свободно падают.`,
        gps: (v, T) => `Спутники GPS летят со скоростью ${v} км/с, период ${T} — два оборота в сутки. Чем выше орбита, тем меньше скорость.`,
        geo: (T) =>
          `Геостационарная орбита: r ≈ 42 200 км, T = ${T} ≈ 24 ч — как период вращения Земли вокруг оси. Спутник «висит» над одной точкой экватора: антенны ТВ и связи смотрят на него неподвижно.`,
        moon: (v, T) => `Луна — естественный спутник Земли, и для неё верна та же формула: v = ${v} км/с, T = ${T} (наблюдаемый период 27,3 сут).`,
        custom: (h, v, T) => `h = ${h} км: v = √(GM/r) = ${v} км/с, T = ${T}. С высотой притяжение слабеет: скорость уменьшается, а период быстро растёт.`,
      },
    },
    derive: {
      presetsLabel: 'Небесное тело',
      planets: { earth: { name: 'Земля' }, moon: { name: 'Луна' }, mars: { name: 'Марс' }, jupiter: { name: 'Юпитер' } },
      legend: { v: 'скорость v (по касательной)', a: 'центростремительное ускорение a', F: 'сила тяжести mg', orbit: 'орбита (r ≈ R)' },
      sceneLabel: (name, v, n) => `${name}: искусственный спутник, шаг ${n}. Первая космическая скорость ${v} км/с.`,
      stepsTitle: 'Выводим формулу',
      stepOf: (i, n) => `${i} / ${n}`,
      steps: [
        {
          title: 'Движение по окружности',
          text: 'Спутник равномерно движется у самой поверхности по окружности радиуса R. Скорость v направлена по касательной, ускорение — к центру.',
        },
        { title: 'Какая сила действует?', text: 'Только сила тяжести F = mg (воздуха нет). Она тоже направлена к центру — именно она и сообщает ускорение.' },
        {
          title: 'Второй закон Ньютона',
          text: 'Подставим в ma = F ускорение a = v²/R и силу F = mg. Масса m есть с обеих сторон и сокращается: скорость не зависит от массы спутника.',
        },
        { title: 'Считаем', text: 'Подставляем g и R в единицах СИ (в школьных задачах для Земли берут R ≈ 6400 км).' },
        {
          title: 'Проверка: за 1 секунду',
          text: 'За 1 с спутник проходит по касательной путь vt и «падает» на gt²/2. Поверхность на таком расстоянии опускается ровно на столько же — высота не меняется.',
        },
      ],
      explain: [
        'Модуль скорости спутника не меняется, но её направление всё время поворачивается. Значит, есть ускорение, и оно направлено к центру: a = v²/R.',
        'Это ускорение создаёт сила тяжести: F = mg тоже направлена к центру — туда же, куда ускорение. Других сил нет.',
        'Второй закон Ньютона: m·v²/R = mg, то есть v² = gR. Масса сократилась — и маленький спутник, и огромная станция летят с одной скоростью.',
        (name, v, T) => `${name}: v₁ = √(gR) ≈ ${v} км/с. С такой скоростью спутник у поверхности делает один оборот за ${T} мин.`,
        (v, d) =>
          `За 1 с спутник пролетает ${v} км и «падает» на ${d} м. Поверхность на этих ${v} км тоже опускается на ${d} м — спутник не приближается к земле. Он всё время падает, но никогда не долетает!`,
      ],
      readouts: {
        R: 'Радиус',
        g: 'Ускорение свободного падения',
        gSub: 'у поверхности',
        v1: 'Первая космическая',
        v1Sub: (v2) => `v₂ = √2·v₁ ≈ ${v2} км/с`,
        T: 'Период обращения',
        TSub: (s) => `T = 2πR/v₁ = ${s} с`,
      },
      tangentTag: (v, km) => `vt = ${v} ${km}`,
      dropTag: (d, m) => `gt²/2 = ${d} ${m}`,
      noScale: (v, d) => `Не в масштабе: на деле на ${v} км пути лишь ${d} м`,
      orbitLow: 'Орбита у самой поверхности (r ≈ R), сопротивления воздуха нет',
    },
  },

  en: {
    common: {
      pause: 'Pause',
      resume: 'Resume',
      reset: 'Reset',
      fire: 'Fire',
      clear: 'Clear',
      faster: (k) => `Time sped up ×${k}`,
      cell: (c) => `1 square = ${c}`,
      min: 'min',
      day: 'days',
      kms: 'km/s',
      prev: 'Back',
      next: 'Next',
    },
    card: {
      eyebrow: 'Virtual laboratory · Dynamics',
      title: 'Artificial satellites of the Earth',
      tabsLabel: 'Choose a simulator',
      tabs: {
        cannon: { label: "Newton's cannon", sub: 'Falls back or goes round?' },
        orbit: { label: 'Orbit calculator', sub: 'v = √(GM/r) · T = 2πr/v' },
        derive: { label: 'First cosmic speed', sub: 'mv²/R = mg' },
      },
    },
    facts: {
      title: 'Remember',
      items: [
        {
          term: 'Artificial satellite',
          text: 'a body going round the Earth in orbit. It keeps “falling” towards the Earth, but the ground curves away just as fast, so it never lands.',
        },
        { term: 'First cosmic speed v₁', text: 'the speed of a circular orbit just above the ground: mv²/R = mg ⇒ v₁ = √(gR) ≈ 7.9 km/s.' },
        { term: 'Orbital speed and period', text: 'at height h: v = √(GM/(R+h)), T = 2π(R+h)/v. The higher the orbit, the lower the speed and the longer the period.' },
        { term: 'Second cosmic speed v₂', text: "v₂ = √2·v₁ ≈ 11.2 km/s — fast enough to overcome the Earth's gravity and leave it for good." },
      ],
    },
    cannon: {
      presetsLabel: 'Launch speed',
      presets: {
        near: 'lands nearby',
        far: 'lands far away',
        circle: 'circular orbit · v₁',
        ellipse: 'elliptical orbit',
        escape: 'leaves the Earth · v₂',
      },
      noAir: 'No air resistance',
      legend: { path: 'trajectory', old: 'earlier shots', v: 'velocity v', a: 'acceleration a (to the centre)' },
      sceneLabel: (v, h, out) => `Newton's cannon: launch speed ${v} km/s, height ${h} km. ${out}`,
      earth: 'Earth',
      cannon: 'cannon',
      leaves: 'leaving the Earth →',
      offView: 'off the view',
      mountain: (h) => `Mountain (h ≈ ${h} km) and cannon drawn enlarged`,
      mountainShort: 'Mountain drawn enlarged',
      v0: 'Launch speed',
      v0Hint: 'Change the speed and press Fire',
      readouts: {
        v0: 'Launch speed',
        v0Sub: (r) => `v₀ / v₁ = ${r}`,
        h: 'Height',
        hSub: (r) => `from the Earth's centre r = ${r} km`,
        v: 'Speed now',
        vSub: (g) => `here g = GM/r² = ${g} m/s²`,
        out: 'Result',
      },
      outcome: {
        none: '—',
        idleSub: 'not fired yet',
        wait: 'Flying…',
        waitSub: 'watch what happens',
        land: 'Fell back to Earth',
        circle: 'Circular orbit',
        ellipse: 'Elliptical orbit',
        away: 'Long ellipse',
        escape: 'Left the Earth',
      },
      outSub: {
        land: (d) => `${d} km away (along the ground)`,
        circle: (T) => `period T = ${T}`,
        ellipse: (h, T) => `apogee ${h} km · T = ${T}`,
        away: (h, T) => `apogee ${h} km · T = ${T}`,
        escape: 'never comes back',
      },
      scale: { title: 'Speed scale, km/s', fall: 'falls back', ellipse: 'ellipse (v₁ < v < v₂)', escape: 'leaves the Earth', shots: 'shots fired' },
      calcNote: (R, h) => `r₀ = R + h is the summit's distance from the Earth's centre: R = ${R} km, h ≈ ${h} km. GM = 3.986·10¹⁴ m³/s².`,
      graph: {
        title: 'Height graph h(t)',
        series: 'h',
        x: { s: 't, s', min: 't, min', h: 't, h' },
        y: 'h, km',
        idle: 'Press Fire to draw the height graph.',
        note: {
          land: 'The height dropped to zero — the body came back down.',
          circle: 'On a circular orbit the height stays the same.',
          ellipse: 'On an ellipse the body moves away and comes back — the graph is a wave.',
          away: 'The body is moving away — the graph climbs to the edge of the view.',
          escape: 'The height grows and grows — the body will not return.',
        },
        aria: "Graph of the body's height against time",
      },
      explain: {
        idle: "A cannon on top of a very high mountain fires horizontally. There is no air: only the Earth's gravity acts on the body. Pick a speed and press Fire.",
        fall: "The body is falling back. But the faster it is fired, the farther it flies: the Earth's surface curves away beneath it.",
        land: (d, v) => `The body landed ${d} km away. ${v} km/s is less than the first cosmic speed (7.9 km/s) — gravity brought it back down.`,
        circle: (T) => `7.9 km/s — the first cosmic speed! The body keeps “falling”, but the ground curves away just as fast: it goes round the Earth in ${T}. That is a satellite.`,
        ellipseFly: 'Moving away from the Earth the body slows down (gravity holds it back), then speeds up again on the way back.',
        ellipse: (h, T) => `Faster than v₁ but slower than v₂ — the orbit has become an ellipse. Its farthest point (apogee) is ${h} km up; the period is ${T}.`,
        away: (h, T) => `The ellipse is so stretched that it does not fit on the screen: the body will get ${h} km away and come back after ${T}.`,
        escapeFly: 'The body is moving away and slowing down, but it does not stop…',
        escape: (v) => `v₀ = ${v} km/s ≥ v₂ ≈ 11.2 km/s — the second cosmic speed. Gravity cannot bring the body back: it leaves the Earth for good.`,
      },
    },
    orbit: {
      presetsLabel: 'Orbits',
      presets: {
        surface: { name: 'At the surface', sub: 'h = 0 · v₁', short: 'v₁' },
        iss: { name: 'ISS', sub: 'h ≈ 400 km', short: 'ISS' },
        gps: { name: 'GPS', sub: 'h ≈ 20 200 km', short: 'GPS' },
        geo: { name: 'Geostationary', sub: 'h ≈ 35 800 km', short: 'GEO' },
        moon: { name: 'Moon', sub: 'r ≈ 384 400 km', short: 'Moon' },
      },
      legend: { orbit: 'orbit', v: 'orbital velocity v', a: 'acceleration a = g', r: 'r = R + h' },
      sceneLabel: (h, v, T) => `The Earth seen from above the North Pole: height ${h} km, speed ${v} km/s, period ${T}.`,
      earth: 'Earth',
      moonName: 'Moon',
      iss: 'ISS',
      gps: 'GPS satellite',
      geoSat: 'comms satellite',
      sat: 'satellite',
      together: 'turns with the Earth',
      hTag: (h) => `h = ${h} km`,
      rTag: (r) => `r = ${r} km`,
      dirOnly: 'Earth and orbit to scale, satellite enlarged · length of v follows the speed',
      dirOnlyShort: 'Earth and orbit to scale',
      h: 'Height above the surface',
      hHint: 'Log scale: further right, the distance grows quickly',
      readouts: {
        v: 'Orbital speed',
        vSub: (kmh) => `≈ ${kmh} km/h`,
        T: 'Period',
        perDay: (n) => `${n} orbits a day`,
        g: 'g at this height',
        gSub: (p) => `${p} % of g at the surface`,
        r: 'Distance to centre',
        rSub: (h, k) => `h = ${h} km · r = ${k}·R`,
      },
      calc: {
        title: 'Working (SI)',
        note: 'GM = 3.986·10¹⁴ m³/s², R = 6371 km. Since GM = g₀R², you can also write v = √(g₀R²/(R+h)), g₀ = 9.8 m/s².',
      },
      graph: {
        title: 'Higher means slower',
        x: 'r, thousand km',
        y: 'v, km/s',
        note: 'Click or drag along the graph to change the orbit radius. The horizontal scale is logarithmic.',
        aria: 'Graph of orbital speed against orbit radius',
      },
      explain: {
        surface: (v, T) => `h = 0 gives the first cosmic speed: v₁ = ${v} km/s, one orbit in ${T}. No real orbit is this low — air resistance would quickly stop the satellite.`,
        iss: (v, T, n, g) =>
          `The ISS flies at ${v} km/s and goes round the Earth in ${T} — ${n} times a day. Up there g ≈ ${g} m/s² still: the astronauts are weightless not because gravity is gone, but because they and the station are falling freely all the time.`,
        gps: (v, T) => `GPS satellites fly at ${v} km/s with a period of ${T} — two orbits a day. The higher the orbit, the lower the speed.`,
        geo: (T) =>
          `Geostationary orbit: r ≈ 42 200 km, T = ${T} ≈ 24 h — the same as the Earth's turn on its axis. The satellite “hangs” over one point on the equator, so TV and comms dishes can point at it without moving.`,
        moon: (v, T) => `The Moon is the Earth's natural satellite and the same formula works for it: v = ${v} km/s, T = ${T} (the observed period is 27.3 days).`,
        custom: (h, v, T) => `h = ${h} km: v = √(GM/r) = ${v} km/s, T = ${T}. Gravity weakens with height: the speed drops and the period grows quickly.`,
      },
    },
    derive: {
      presetsLabel: 'Body',
      planets: { earth: { name: 'Earth' }, moon: { name: 'Moon' }, mars: { name: 'Mars' }, jupiter: { name: 'Jupiter' } },
      legend: { v: 'velocity v (tangent)', a: 'centripetal acceleration a', F: 'gravity mg', orbit: 'orbit (r ≈ R)' },
      sceneLabel: (name, v, n) => `${name}: a satellite, step ${n}. First cosmic speed ${v} km/s.`,
      stepsTitle: 'Derivation',
      stepOf: (i, n) => `${i} / ${n}`,
      steps: [
        {
          title: 'Moving on a circle',
          text: 'The satellite moves steadily on a circle of radius R just above the surface. Its velocity v is along the tangent, its acceleration points to the centre.',
        },
        { title: 'Which force acts?', text: 'Only gravity, F = mg (no air). It also points to the centre — it is what gives the acceleration.' },
        {
          title: "Newton's second law",
          text: "Put a = v²/R and F = mg into ma = F. The mass m is on both sides and cancels: the speed does not depend on the satellite's mass.",
        },
        { title: 'Work it out', text: 'Put in g and R in SI units (school problems take R ≈ 6400 km for the Earth).' },
        {
          title: 'Check: in 1 second',
          text: 'In 1 s the satellite travels vt along the tangent and “falls” gt²/2. Over that distance the surface drops by exactly as much — the height stays the same.',
        },
      ],
      explain: [
        "The size of the satellite's velocity stays the same, but its direction keeps turning. So it is accelerating, and the acceleration points to the centre: a = v²/R.",
        'Gravity supplies this acceleration: F = mg also points to the centre — the same way as the acceleration. There is no other force.',
        "Newton's second law: m·v²/R = mg, so v² = gR. The mass cancelled — a tiny satellite and a huge station orbit at the same speed.",
        (name, v, T) => `${name}: v₁ = √(gR) ≈ ${v} km/s. At this speed a satellite skimming the surface goes round once in ${T} min.`,
        (v, d) => `In 1 s the satellite flies ${v} km and “falls” ${d} m. Over those ${v} km the surface also drops ${d} m — the satellite gets no closer to the ground. It falls all the time, yet never lands!`,
      ],
      readouts: {
        R: 'Radius',
        g: 'Free-fall acceleration',
        gSub: 'at the surface',
        v1: 'First cosmic speed',
        v1Sub: (v2) => `v₂ = √2·v₁ ≈ ${v2} km/s`,
        T: 'Period',
        TSub: (s) => `T = 2πR/v₁ = ${s} s`,
      },
      tangentTag: (v, km) => `vt = ${v} ${km}`,
      dropTag: (d, m) => `gt²/2 = ${d} ${m}`,
      noScale: (v, d) => `Not to scale: really just ${d} m over ${v} km`,
      orbitLow: 'Orbit just above the surface (r ≈ R), no air resistance',
    },
  },
};

export default function Satellites() {
  const T = useSimText(TEXT);
  const tabs = T.card.tabs;
  return (
    <SimCard
      idPrefix="satellites"
      icon={Satellite}
      eyebrow={T.card.eyebrow}
      title={T.card.title}
      tabsLabel={T.card.tabsLabel}
      tabs={[
        { id: 'cannon', label: tabs.cannon.label, sub: tabs.cannon.sub, icon: Rocket, render: () => <CannonSim T={T} /> },
        { id: 'orbit', label: tabs.orbit.label, sub: tabs.orbit.sub, icon: Orbit, render: () => <OrbitSim T={T} /> },
        { id: 'derive', label: tabs.derive.label, sub: tabs.derive.sub, icon: Sigma, render: () => <DeriveSim T={T} /> },
      ]}
      facts={T.facts}
    />
  );
}
