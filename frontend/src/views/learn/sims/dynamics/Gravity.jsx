import { ArrowDownToLine, Feather, Orbit, Rocket } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { useSimText } from '../kit/lang';
import PlanetsSim from './Gravity.planets';
import HeightSim from './Gravity.height';
import FallSim from './Gravity.fall';

/**
 * Lesson "Og'irlik kuchi" (Gravity) — g as the strength of the gravitational
 * field a body sits in.
 *
 *   planets - the same 60 kg astronaut on the Earth, the Moon, Mars, Venus,
 *             Jupiter and Saturn: the mass stays, g = GM/R² changes, so the
 *             force of gravity F = m·g changes (Moon: 60 · 1.62 = 97.2 N,
 *             Earth 588 N); a 1 kg load on a spring scale reads g newtons
 *             (N/kg); the same push gives a jump h = v₀²/(2g) (0.40 m on
 *             Earth, 2.42 m on the Moon).
 *   height  - g falls with altitude, g(h) = g₀·(R/(R+h))²: Everest 9.77 m/s²
 *             (99.7 %), ISS 8.68 m/s² (88.5 %), h = R 2.45 m/s², the Moon's
 *             distance 0.0027 m/s² (1/3600); the Earth drawn to scale with
 *             the g(r) curve over the same distance axis.
 *   fall    - why every body falls with the same g: F ∝ m, so a = F/m = g.
 *             Apollo 15's hammer (1.32 kg) and feather (0.03 kg) from 1.6 m:
 *             1.41 s together on the Moon, 0.571 s together in a vacuum
 *             tube, 0.57 s vs 3.24 s in air.
 */
const TEXT = {
  uz: {
    N: 'N',
    kg: 'kg',
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    card: {
      eyebrow: 'Virtual laboratoriya · Dinamika',
      title: "Og'irlik kuchi",
      tabsLabel: 'Tajribani tanlang',
      tabs: {
        planets: { label: 'Boshqa olamlarda', sub: 'F = m·g' },
        height: { label: 'Balandlikda', sub: 'g ~ 1/r²' },
        fall: { label: 'Bir xil tushish', sub: 'a = F/m = g' },
      },
    },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: "Og'irlik kuchi F = mg", text: "jismni Yer (yoki boshqa osmon jismi) o'z markaziga tortadigan kuch; doim markazga — «pastga» yo'nalgan, birligi nyuton (N)." },
        { term: 'Erkin tushish tezlanishi g', text: "g = GM/R² — gravitatsiya maydonining kuchlanganligi: 1 kg massaga ta'sir etuvchi kuch. Yer sirtida g ≈ 9.8 N/kg = 9.8 m/s² (masalalarda ≈ 10)." },
        { term: 'Balandlikda', text: "Yer markazidan uzoqlashgan sari g kamayadi: g(h) = g₀·(R/(R+h))². Masofa 2 marta ortsa, g 4 marta kamayadi." },
        { term: "Massa va og'irlik kuchi", text: "massa hamma joyda bir xil, og'irlik kuchi esa g ga bog'liq. Havo bo'lmasa, barcha jismlar bir xil g tezlanish bilan tushadi." },
      ],
    },
    planets: {
      bodiesLabel: 'Osmon jismi',
      bodies: {
        earth: { name: 'Yer', loc: 'Yerda', gen: 'Yerning' },
        moon: { name: 'Oy', loc: 'Oyda', gen: 'Oyning' },
        mars: { name: 'Mars', loc: 'Marsda', gen: 'Marsning' },
        venus: { name: 'Venera', loc: 'Venerada', gen: 'Veneraning' },
        jupiter: { name: 'Yupiter', loc: 'Yupiterda', gen: 'Yupiterning' },
        saturn: { name: 'Saturn', loc: 'Saturnda', gen: 'Saturnning' },
      },
      jump: 'Sakrash',
      jumpAgain: 'Yana sakrash',
      mass: 'Astronavt massasi (skafandr bilan)',
      massHint: "Massa — jismdagi modda miqdori: u qaysi sayyorada bo'lmasin o'zgarmaydi.",
      legend: { F: "og'irlik kuchi F = mg", v: 'tezlik v', h: 'sakrash balandligi h', ghost: 'Yerdagi mg' },
      ghostTag: (F) => `Yerda ${F} N`,
      chipReal: 'Real vaqt',
      heightAxis: 'h, m',
      compareTag: (name, h) => `${name} ${h} m`,
      noSurface: "qattiq sirt yo'q — bulutlar, tasavvuriy platforma",
      toCentre: (gen) => `${gen} markaziga`,
      jumpTag: (h) => `h = ${h} m`,
      massTag: (m) => `m = ${m} kg`,
      mgTag: (F) => `mg = ${F} N`,
      forceScale: (n) => `${n} N`,
      dyno: { title: 'Dinamometr va 1 kg yuk', load: '1 kg', reads: (g) => `${g} N`, gIs: (g) => `g = F/m = ${g} N/kg` },
      sceneLabel: (loc, m, F, g) => `${loc} ${m} kg astronavt. Og'irlik kuchi ${F} N, g = ${g} m/s².`,
      readouts: { m: 'Massa', g: 'Erkin tushish tezlanishi', F: "Og'irlik kuchi", h: 'Sakrash balandligi' },
      mSub: 'hamma joyda bir xil',
      gSub: {
        same: (g) => `= ${g} N/kg · Yer sirtidagi qiymat`,
        less: (g, k) => `= ${g} N/kg · Yerdagidan ${k} marta kam`,
        more: (g, k) => `= ${g} N/kg · Yerdagidan ${k} marta ko'p`,
      },
      FSub: (FE) => `Yerda xuddi shu astronavtga ${FE} N`,
      FSubEarth: 'Yer uni markaziga tortmoqda',
      hSub: (v0, t) => `v₀ = ${v0} m/s · havoda ${t} s`,
      formula: {
        F: "Og'irlik kuchi",
        g: 'g qayerdan keladi?',
        gNote: (gen, R) => `G — gravitatsiya doimiysi, M va R — ${gen} massasi va radiusi (R = ${R} km).`,
      },
      bars: {
        title: (m) => `Bir xil ${m} kg — har xil og'irlik kuchi`,
        label: "Turli osmon jismlarida og'irlik kuchi",
        note: "Massa bir xil, shuning uchun og'irlik kuchi g ga proporsional: F = m·g. Oq chiziq — Yerdagi qiymat.",
      },
      explain: {
        idleEarth: (m, g, F) =>
          `Yer ${m} kg astronavtni F = m·g = ${m} · ${g} = ${F} N kuch bilan o'z markaziga tortadi. g = ${g} N/kg: Yerning gravitatsiya maydoni har 1 kg massaga ${g} N kuch bilan ta'sir qiladi.`,
        idleLess: (loc, g, m, F, k) =>
          `${loc} g = ${g} m/s², ya'ni har 1 kg massaga ${g} N kuch to'g'ri keladi. ${m} kg astronavtga ${F} N og'irlik kuchi ta'sir qiladi — Yerdagidan ${k} marta kam. Massa esa o'sha-o'sha: ${m} kg.`,
        idleMore: (loc, g, m, F, k) =>
          `${loc} g = ${g} m/s², ya'ni har 1 kg massaga ${g} N kuch to'g'ri keladi. ${m} kg astronavtga ${F} N og'irlik kuchi ta'sir qiladi — Yerdagidan ${k} marta ko'p. Massa esa o'sha-o'sha: ${m} kg.`,
        gas: (name) => ` ${name} — gaz gigant, qattiq sirti yo'q: bu bulutlar ustidagi g.`,
        jump: (g) => `Havoda ham og'irlik kuchi ta'sir qiladi: u astronavt tezligini har sekundda ${g} m/s ga o'zgartiradi — avval sekinlashtiradi, keyin qaytarib tortadi.`,
        landedEarth: (v0, g, h, t) => `Yerda: h = v₀²/(2g) = ${v0}² / (2 · ${g}) = ${h} m, havoda ${t} s. Endi Oy yoki Yupiterni tanlab, xuddi shu sakrashni takrorlang.`,
        landed: (loc, h, hE, t, cmp) => `${loc} xuddi shu sakrash ${h} m balandlikka ko'tardi (Yerda — ${hE} m) va ${t} s davom etdi. h = v₀²/(2g): ${cmp}`,
        higher: "g kichikroq — sakrash balandroq.",
        lower: "g kattaroq — sakrash pastroq.",
      },
    },
    height: {
      presetsLabel: 'Qayerda?',
      presets: { surface: 'Yer sirti', everest: 'Everest', iss: 'XKS orbitasi', hR: 'h = R', geo: 'Geostatsionar', moon: 'Oy masofasi' },
      rise: "Ko'tarilish",
      slider: 'Balandlik (Yer sirtidan)',
      sliderHint: "Shkala logarifmik: chap chetda — kilometrlar, o'ng chetda — yuz minglab kilometrlar.",
      legend: { F: "og'irlik kuchi mg (60 kg)", curve: "g(r) — masofaga bog'liqligi", rings: 'r = 2R, 3R… sferalar' },
      chip: 'Yer va masofalar — haqiqiy masshtabda',
      gAxis: 'g, m/s²',
      earth: 'Yer',
      moon: 'Oy',
      levelTop: (g) => `g₀ = ${g}`,
      level: (n2, g) => `g₀/${n2} = ${g}`,
      gTag: (g) => `g = ${g} m/s²`,
      mgTag: (F) => `mg = ${F} N`,
      sceneLabel: (h, g) => `Yer va undan ${h} km balandlikdagi jism. Bu yerda g = ${g} m/s².`,
      readouts: { h: 'Balandlik', r: 'Markazgacha masofa', g: 'Erkin tushish tezlanishi', F: "Og'irlik kuchi" },
      hSubPct: (p) => `Yer radiusining ${p} %i`,
      hSubR: (k) => `≈ ${k} ta Yer radiusi`,
      rSub: (k) => `r = R + h = ${k} R`,
      gSub: (p) => `Yer sirtidagi g₀ ning ${p} %i`,
      FSub: (m, F0) => `${m} kg jism · Yer sirtida ${F0} N`,
      formula: {
        g: 'Balandlikda g',
        gNote: (R) => `g₀ — Yer sirtidagi qiymat, R = ${R} km — Yer radiusi, r = R + h — markazgacha masofa.`,
        F: "Og'irlik kuchi",
      },
      ladder: {
        title: 'Turli balandliklarda g, m/s²',
        note: "Masofa r necha marta ortsa, g shuning kvadrati marta kamayadi: g ~ 1/r². Shuning uchun tog' cho'qqisida g deyarli o'zgarmaydi, Oy masofasida esa ≈ 3600 marta kam.",
      },
      explain: {
        surface: (g, R) => `Yer sirtida g₀ = ${g} m/s², markazgacha masofa — Yer radiusi R = ${R} km. Yuqoriga ko'tarilsak, r = R + h ortadi va g kamayadi. «Ko'tarilish»ni bosing yoki joyni tanlang.`,
        low: (h, pR, g, pct) => `h = ${h} km — Yer radiusining atigi ${pR} %i. Shuning uchun g = ${g} m/s² (${pct} %) — deyarli o'zgarmadi: Everest cho'qqisida ham og'irlik kuchi Yer sirtidagi bilan deyarli bir xil.`,
        leo: (h, g, pct) => `${h} km balandlikda g = ${g} m/s² — Yer sirtidagining ${pct} %i. XKS dagi kosmonavtlarni Yer deyarli shunday kuch bilan tortadi: ular og'irlik kuchi yo'qligidan emas, Yer atrofida aylanib, doim «tushib» turganidan suzib yuradi.`,
        twoR: (g0, g) => `h = R: Yer markazigacha masofa 2 marta ortdi, g esa 2² = 4 marta kamaydi: ${g0} / 4 = ${g} m/s².`,
        geo: (h, rR, g, k2) => `Geostatsionar orbita: h = ${h} km, r ≈ ${rR} R. g = ${g} m/s² — Yer sirtidagidan ${k2} marta kam. Bu orbitadagi yo'ldoshlar Yer bilan birga aylanib, osmonda bir joyda turgandek ko'rinadi.`,
        moon: (rR, g, k2) => `Oy masofasida r ≈ ${rR} R, shuning uchun g ≈ ${g} m/s² — ${k2} marta kam (≈ 60² = 3600). Shu kichik tortish Oyni orbitada ushlab turadi: Nyuton aynan shu hisob bilan Butun olam tortishish qonunini tekshirgan.`,
        mid: (rR, g, k2) => `Markazgacha masofa r = ${rR} R, demak g = g₀ / ${rR}² = g₀ / ${k2} = ${g} m/s². Masofa necha marta ortsa, g uning kvadrati marta kamayadi.`,
      },
    },
    fall: {
      envLabel: 'Tajriba sharoiti',
      envs: {
        moon: { name: 'Oyda', sub: "«Apollon-15» · havo yo'q" },
        tube: { name: 'Yerda, vakuumda', sub: 'Nyuton trubkasi' },
        air: { name: 'Yerda, havoda', sub: 'havo qarshiligi bor' },
      },
      hammer: "bolg'a",
      feather: 'pat',
      slowLabel: "Ko'rsatish tezligi",
      slow: { real: 'Real vaqt', times: (k) => `${k} marta sekin` },
      chipReal: 'Real vaqt',
      chipSlow: (k) => `Vaqt ${k} marta sekinlashtirilgan`,
      legend: { F: "og'irlik kuchi mg", a: 'tezlanish a', strobe: (dt) => `har ${dt} s dagi o'rni` },
      heightAxis: 'h, m',
      vacuum: "havo so'rib olingan",
      ground: { moon: "Oy sirti · havo yo'q", tube: 'Yer · trubka ichida vakuum', air: 'Yer · havo' },
      secTag: (t) => `${t} s`,
      mgTag: (F) => `mg = ${F} N`,
      dragTag: 'havo qarshiligi ≈ mg',
      hammerTag: (m) => `bolg'a · ${m} kg`,
      featherTag: (m) => `lochin pati · ${m} kg`,
      landTag: (t) => `tushdi · ${t} s`,
      forceScale: (n) => `${n} N`,
      sceneLabel: (env, t) => `Bolg'a va pat tushmoqda: ${env}. t = ${t} s.`,
      readouts: { t: 'Vaqt', hammer: "Bolg'a: og'irlik kuchi", feather: "Pat: og'irlik kuchi", times: 'Yerga tushish vaqti' },
      objSub: (m, a) => `m = ${m} kg · a = ${a} m/s²`,
      objLanded: (m) => `m = ${m} kg · yerga tushdi`,
      formula: {
        tag: 'Nega tezlanish bir xil?',
        note: (k) => `Bolg'aning massasi ${k} marta katta — og'irlik kuchi ham ${k} marta katta. Nisbat F/m esa ikkalasida bir xil: g.`,
        airNote: "Havoda patga havo qarshiligi ham ta'sir qiladi: a = (mg − F_q)/m < g. Bolg'aga u deyarli ta'sir qilmaydi.",
      },
      bars: { F: "Og'irlik kuchi F = mg", a: 'Tushishdagi tezlanish a = F/m' },
      graph: {
        title: 'Grafik: tezlik v(t)',
        t: 't, s',
        v: 'v, m/s',
        label: "Bolg'a va pat tezligining vaqtga bog'liqlik grafigi",
        noteVac: "Havo yo'q: ikkala chiziq ustma-ust tushadi — v = g·t.",
        noteAir: (vt) => `Havoda patning tezligi ≈ ${vt} m/s dan oshmaydi, bolg'aniki esa deyarli v = g·t bo'yicha o'sadi.`,
      },
      explain: {
        moonIdle:
          "1971-yil, «Apollon-15»: astronavt Devid Skott Oyda 1.32 kg li geologik bolg'a va 0.03 kg li lochin patini ≈ 1.6 m balandlikdan bir vaqtda qo'yib yubordi. Qaysi biri oldin tushadi? «Boshlash»ni bosing.",
        tubeIdle: "Nyuton trubkasi — havosi nasos bilan so'rib olingan shisha naycha. Yerda ham havo bo'lmasa, pat va bolg'a qanday tushar ekan? «Boshlash»ni bosing.",
        airIdle: "Endi xuddi shu tajriba Yerda, havoda. Og'irlik kuchidan tashqari, jismlarga havo qarshiligi ham ta'sir qiladi. «Boshlash»ni bosing.",
        vacuumFall: (k, g) =>
          `Bolg'aga patdagidan ${k} marta katta og'irlik kuchi ta'sir qiladi, lekin uning massasi ham ${k} marta katta. a = F/m = mg/m = g — ikkalasi bir xil ${g} m/s² tezlanish bilan tushmoqda.`,
        airFall: (vt) =>
          `Patga havo qarshiligi kuchli ta'sir qiladi: u tez orada og'irlik kuchini muvozanatlaydi va pat deyarli tekis, ≈ ${vt} m/s tezlikda tushadi. Bolg'aga havo qarshiligi deyarli ta'sir qilmaydi.`,
        airHalf: (t) => `Bolg'a ${t} s da yerga tegdi, pat esa hali havoda sekin tushib kelmoqda.`,
        airDone: (th, tf) => `Bolg'a ${th} s da, pat esa ${tf} s da tushdi. Farqni og'irlik kuchi emas, havo qarshiligi yuzaga keltirdi — vakuumda ular birga tushadi.`,
        moonDone: (t, g) =>
          `Ikkalasi bir vaqtda — ${t} s da yerga tegdi! Oyda havo yo'q: faqat og'irlik kuchi ta'sir qiladi va tezlanish massaga bog'liq emas. g = ${g} m/s² kichik bo'lgani uchun ular Yerdagidan sekinroq tushdi.`,
        tubeDone: (t, g) => `Vakuumda Yerda ham pat va bolg'a birga tushdi: t = ${t} s. Oydagidan tezroq — chunki Yerda g = ${g} m/s², taxminan 6 marta katta.`,
      },
    },
  },

  ru: {
    N: 'Н',
    kg: 'кг',
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    card: {
      eyebrow: 'Виртуальная лаборатория · Динамика',
      title: 'Сила тяжести',
      tabsLabel: 'Выберите опыт',
      tabs: {
        planets: { label: 'Другие миры', sub: 'F = m·g' },
        height: { label: 'На высоте', sub: 'g ~ 1/r²' },
        fall: { label: 'Одинаковое падение', sub: 'a = F/m = g' },
      },
    },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Сила тяжести F = mg', text: 'сила, с которой Земля (или другое небесное тело) притягивает тело к своему центру; направлена к центру — «вниз», измеряется в ньютонах (Н).' },
        { term: 'Ускорение свободного падения g', text: 'g = GM/R² — напряжённость гравитационного поля: сила, действующая на 1 кг массы. У поверхности Земли g ≈ 9,8 Н/кг = 9,8 м/с² (в задачах ≈ 10).' },
        { term: 'На высоте', text: 'с удалением от центра Земли g уменьшается: g(h) = g₀·(R/(R+h))². Расстояние больше в 2 раза — g меньше в 4 раза.' },
        { term: 'Масса и сила тяжести', text: 'масса везде одна и та же, а сила тяжести зависит от g. Без воздуха все тела падают с одинаковым ускорением g.' },
      ],
    },
    planets: {
      bodiesLabel: 'Небесное тело',
      bodies: {
        earth: { name: 'Земля', loc: 'На Земле', gen: 'Земли' },
        moon: { name: 'Луна', loc: 'На Луне', gen: 'Луны' },
        mars: { name: 'Марс', loc: 'На Марсе', gen: 'Марса' },
        venus: { name: 'Венера', loc: 'На Венере', gen: 'Венеры' },
        jupiter: { name: 'Юпитер', loc: 'На Юпитере', gen: 'Юпитера' },
        saturn: { name: 'Сатурн', loc: 'На Сатурне', gen: 'Сатурна' },
      },
      jump: 'Прыжок',
      jumpAgain: 'Ещё прыжок',
      mass: 'Масса космонавта (со скафандром)',
      massHint: 'Масса — количество вещества в теле: она не меняется, на какой бы планете тело ни оказалось.',
      legend: { F: 'сила тяжести F = mg', v: 'скорость v', h: 'высота прыжка h', ghost: 'mg на Земле' },
      ghostTag: (F) => `на Земле ${F} Н`,
      chipReal: 'Реальное время',
      heightAxis: 'h, м',
      compareTag: (name, h) => `${name} ${h} м`,
      noSurface: 'твёрдой поверхности нет — облака, воображаемая платформа',
      toCentre: (gen) => `к центру ${gen}`,
      jumpTag: (h) => `h = ${h} м`,
      massTag: (m) => `m = ${m} кг`,
      mgTag: (F) => `mg = ${F} Н`,
      forceScale: (n) => `${n} Н`,
      dyno: { title: 'Динамометр и груз 1 кг', load: '1 кг', reads: (g) => `${g} Н`, gIs: (g) => `g = F/m = ${g} Н/кг` },
      sceneLabel: (loc, m, F, g) => `${loc} космонавт массой ${m} кг. Сила тяжести ${F} Н, g = ${g} м/с².`,
      readouts: { m: 'Масса', g: 'Ускорение свободного падения', F: 'Сила тяжести', h: 'Высота прыжка' },
      mSub: 'везде одна и та же',
      gSub: {
        same: (g) => `= ${g} Н/кг · у поверхности Земли`,
        less: (g, k) => `= ${g} Н/кг · в ${k} раза меньше, чем на Земле`,
        more: (g, k) => `= ${g} Н/кг · в ${k} раза больше, чем на Земле`,
      },
      FSub: (FE) => `на Земле на того же космонавта ${FE} Н`,
      FSubEarth: 'Земля тянет его к своему центру',
      hSub: (v0, t) => `v₀ = ${v0} м/с · в воздухе ${t} с`,
      formula: {
        F: 'Сила тяжести',
        g: 'Откуда берётся g?',
        gNote: (gen, R) => `G — гравитационная постоянная, M и R — масса и радиус ${gen} (R = ${R} км).`,
      },
      bars: {
        title: (m) => `Одни и те же ${m} кг — разная сила тяжести`,
        label: 'Сила тяжести на разных небесных телах',
        note: 'Масса одна и та же, поэтому сила тяжести пропорциональна g: F = m·g. Белая черта — значение на Земле.',
      },
      explain: {
        idleEarth: (m, g, F) =>
          `Земля притягивает космонавта массой ${m} кг к своему центру с силой F = m·g = ${m} · ${g} = ${F} Н. g = ${g} Н/кг: гравитационное поле Земли действует на каждый килограмм массы с силой ${g} Н.`,
        idleLess: (loc, g, m, F, k) =>
          `${loc} g = ${g} м/с², то есть на каждый килограмм приходится ${g} Н. На космонавта массой ${m} кг действует сила тяжести ${F} Н — в ${k} раза меньше, чем на Земле. А масса та же: ${m} кг.`,
        idleMore: (loc, g, m, F, k) =>
          `${loc} g = ${g} м/с², то есть на каждый килограмм приходится ${g} Н. На космонавта массой ${m} кг действует сила тяжести ${F} Н — в ${k} раза больше, чем на Земле. А масса та же: ${m} кг.`,
        gas: (name) => ` ${name} — газовый гигант без твёрдой поверхности: это g над облаками.`,
        jump: (g) => `Сила тяжести действует и в воздухе: каждую секунду она меняет скорость космонавта на ${g} м/с — сначала тормозит, потом тянет обратно.`,
        landedEarth: (v0, g, h, t) => `На Земле: h = v₀²/(2g) = ${v0}² / (2 · ${g}) = ${h} м, в воздухе ${t} с. Теперь выберите Луну или Юпитер и повторите тот же прыжок.`,
        landed: (loc, h, hE, t, cmp) => `${loc} тот же прыжок поднял космонавта на ${h} м (на Земле — ${hE} м) и длился ${t} с. h = v₀²/(2g): ${cmp}`,
        higher: 'g меньше — прыжок выше.',
        lower: 'g больше — прыжок ниже.',
      },
    },
    height: {
      presetsLabel: 'Где?',
      presets: { surface: 'Поверхность Земли', everest: 'Эверест', iss: 'Орбита МКС', hR: 'h = R', geo: 'Геостационарная', moon: 'Расстояние до Луны' },
      rise: 'Подъём',
      slider: 'Высота (над поверхностью Земли)',
      sliderHint: 'Шкала логарифмическая: слева — километры, справа — сотни тысяч километров.',
      legend: { F: 'сила тяжести mg (60 кг)', curve: 'g(r) — зависимость от расстояния', rings: 'сферы r = 2R, 3R…' },
      chip: 'Земля и расстояния — в настоящем масштабе',
      gAxis: 'g, м/с²',
      earth: 'Земля',
      moon: 'Луна',
      levelTop: (g) => `g₀ = ${g}`,
      level: (n2, g) => `g₀/${n2} = ${g}`,
      gTag: (g) => `g = ${g} м/с²`,
      mgTag: (F) => `mg = ${F} Н`,
      sceneLabel: (h, g) => `Земля и тело на высоте ${h} км над ней. Здесь g = ${g} м/с².`,
      readouts: { h: 'Высота', r: 'Расстояние до центра', g: 'Ускорение свободного падения', F: 'Сила тяжести' },
      hSubPct: (p) => `${p} % радиуса Земли`,
      hSubR: (k) => `≈ ${k} радиуса Земли`,
      rSub: (k) => `r = R + h = ${k} R`,
      gSub: (p) => `${p} % от g₀ у поверхности`,
      FSub: (m, F0) => `тело ${m} кг · у поверхности ${F0} Н`,
      formula: {
        g: 'g на высоте',
        gNote: (R) => `g₀ — значение у поверхности, R = ${R} км — радиус Земли, r = R + h — расстояние до центра.`,
        F: 'Сила тяжести',
      },
      ladder: {
        title: 'g на разной высоте, м/с²',
        note: 'Во сколько раз больше расстояние r, во столько раз в квадрате меньше g: g ~ 1/r². Поэтому на вершине горы g почти не меняется, а на расстоянии Луны оно меньше в ≈ 3600 раз.',
      },
      explain: {
        surface: (g, R) => `У поверхности Земли g₀ = ${g} м/с², расстояние до центра — радиус Земли R = ${R} км. Поднимаясь, мы увеличиваем r = R + h, и g уменьшается. Нажмите «Подъём» или выберите место.`,
        low: (h, pR, g, pct) => `h = ${h} км — всего ${pR} % радиуса Земли. Поэтому g = ${g} м/с² (${pct} %) — почти не изменилось: даже на вершине Эвереста сила тяжести почти такая же, как у поверхности.`,
        leo: (h, g, pct) => `На высоте ${h} км g = ${g} м/с² — ${pct} % от значения у поверхности. Космонавтов на МКС Земля притягивает почти так же сильно: они парят не потому, что силы тяжести нет, а потому что, летая вокруг Земли, всё время «падают».`,
        twoR: (g0, g) => `h = R: расстояние до центра Земли выросло в 2 раза, а g уменьшилось в 2² = 4 раза: ${g0} / 4 = ${g} м/с².`,
        geo: (h, rR, g, k2) => `Геостационарная орбита: h = ${h} км, r ≈ ${rR} R. g = ${g} м/с² — в ${k2} раз меньше, чем у поверхности. Спутники на этой орбите вращаются вместе с Землёй и как будто висят в небе на одном месте.`,
        moon: (rR, g, k2) => `На расстоянии Луны r ≈ ${rR} R, поэтому g ≈ ${g} м/с² — в ${k2} раз меньше (≈ 60² = 3600). Именно это слабое притяжение держит Луну на орбите: таким расчётом Ньютон проверил закон всемирного тяготения.`,
        mid: (rR, g, k2) => `Расстояние до центра r = ${rR} R, значит g = g₀ / ${rR}² = g₀ / ${k2} = ${g} м/с². Во сколько раз растёт расстояние, во столько раз в квадрате уменьшается g.`,
      },
    },
    fall: {
      envLabel: 'Условия опыта',
      envs: {
        moon: { name: 'На Луне', sub: '«Аполлон-15» · воздуха нет' },
        tube: { name: 'На Земле, в вакууме', sub: 'трубка Ньютона' },
        air: { name: 'На Земле, в воздухе', sub: 'есть сопротивление воздуха' },
      },
      hammer: 'молоток',
      feather: 'перо',
      slowLabel: 'Скорость показа',
      slow: { real: 'Реальное время', times: (k) => `в ${k} раза медленнее` },
      chipReal: 'Реальное время',
      chipSlow: (k) => `Время замедлено в ${k} раза`,
      legend: { F: 'сила тяжести mg', a: 'ускорение a', strobe: (dt) => `положение через каждые ${dt} с` },
      heightAxis: 'h, м',
      vacuum: 'воздух откачан',
      ground: { moon: 'Поверхность Луны · воздуха нет', tube: 'Земля · в трубке вакуум', air: 'Земля · воздух' },
      secTag: (t) => `${t} с`,
      mgTag: (F) => `mg = ${F} Н`,
      dragTag: 'сопротивление воздуха ≈ mg',
      hammerTag: (m) => `молоток · ${m} кг`,
      featherTag: (m) => `соколиное перо · ${m} кг`,
      landTag: (t) => `упал · ${t} с`,
      forceScale: (n) => `${n} Н`,
      sceneLabel: (env, t) => `Падают молоток и перо: ${env}. t = ${t} с.`,
      readouts: { t: 'Время', hammer: 'Молоток: сила тяжести', feather: 'Перо: сила тяжести', times: 'Время падения' },
      objSub: (m, a) => `m = ${m} кг · a = ${a} м/с²`,
      objLanded: (m) => `m = ${m} кг · упал`,
      formula: {
        tag: 'Почему ускорение одинаковое?',
        note: (k) => `Масса молотка в ${k} раза больше — и сила тяжести в ${k} раза больше. А отношение F/m у обоих одно и то же: g.`,
        airNote: 'В воздухе на перо действует ещё и сопротивление воздуха: a = (mg − F_с)/m < g. На молоток оно почти не влияет.',
      },
      bars: { F: 'Сила тяжести F = mg', a: 'Ускорение при падении a = F/m' },
      graph: {
        title: 'График: скорость v(t)',
        t: 't, с',
        v: 'v, м/с',
        label: 'График зависимости скорости молотка и пера от времени',
        noteVac: 'Воздуха нет: обе линии совпадают — v = g·t.',
        noteAir: (vt) => `В воздухе скорость пера не превышает ≈ ${vt} м/с, а скорость молотка растёт почти по закону v = g·t.`,
      },
      explain: {
        moonIdle:
          '1971 год, «Аполлон-15»: астронавт Дэвид Скотт на Луне одновременно отпустил геологический молоток массой 1,32 кг и соколиное перо массой 0,03 кг с высоты ≈ 1,6 м. Что упадёт первым? Нажмите «Старт».',
        tubeIdle: 'Трубка Ньютона — стеклянная трубка, из которой насосом откачан воздух. Как упадут перо и молоток на Земле, если воздуха нет? Нажмите «Старт».',
        airIdle: 'Теперь тот же опыт на Земле, в воздухе. Кроме силы тяжести, на тела действует сопротивление воздуха. Нажмите «Старт».',
        vacuumFall: (k, g) =>
          `На молоток действует в ${k} раза большая сила тяжести, чем на перо, но и масса его в ${k} раза больше. a = F/m = mg/m = g — оба падают с одним и тем же ускорением ${g} м/с².`,
        airFall: (vt) =>
          `На перо сильно действует сопротивление воздуха: оно быстро уравновешивает силу тяжести, и перо падает почти равномерно, со скоростью ≈ ${vt} м/с. Молотку сопротивление воздуха почти не мешает.`,
        airHalf: (t) => `Молоток упал через ${t} с, а перо всё ещё медленно опускается.`,
        airDone: (th, tf) => `Молоток упал через ${th} с, перо — через ${tf} с. Разницу создала не сила тяжести, а сопротивление воздуха: в вакууме они падают вместе.`,
        moonDone: (t, g) =>
          `Оба коснулись грунта одновременно — через ${t} с! На Луне нет воздуха: действует только сила тяжести, и ускорение не зависит от массы. Так как g = ${g} м/с² мало, они падали медленнее, чем на Земле.`,
        tubeDone: (t, g) => `В вакууме и на Земле перо и молоток упали вместе: t = ${t} с. Быстрее, чем на Луне, — ведь на Земле g = ${g} м/с², примерно в 6 раз больше.`,
      },
    },
  },

  en: {
    N: 'N',
    kg: 'kg',
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Run again', reset: 'Reset' },
    card: {
      eyebrow: 'Virtual lab · Dynamics',
      title: 'Gravity',
      tabsLabel: 'Choose an experiment',
      tabs: {
        planets: { label: 'Other worlds', sub: 'F = m·g' },
        height: { label: 'Going up', sub: 'g ~ 1/r²' },
        fall: { label: 'Equal fall', sub: 'a = F/m = g' },
      },
    },
    facts: {
      title: 'Remember',
      items: [
        { term: 'Force of gravity F = mg', text: 'the pull of the Earth (or another celestial body) towards its centre; it always points to the centre — "down" — and is measured in newtons (N).' },
        { term: 'Free-fall acceleration g', text: 'g = GM/R² — the strength of the gravitational field: the force on each kilogram of mass. At the Earth’s surface g ≈ 9.8 N/kg = 9.8 m/s² (≈ 10 in problems).' },
        { term: 'Going up', text: 'further from the Earth’s centre g gets smaller: g(h) = g₀·(R/(R+h))². Twice the distance — a quarter of g.' },
        { term: 'Mass and gravity', text: 'the mass is the same everywhere, the force of gravity depends on g. Without air every body falls with the same acceleration g.' },
      ],
    },
    planets: {
      bodiesLabel: 'Celestial body',
      bodies: {
        earth: { name: 'Earth', loc: 'On Earth', gen: 'Earth’s' },
        moon: { name: 'Moon', loc: 'On the Moon', gen: 'the Moon’s' },
        mars: { name: 'Mars', loc: 'On Mars', gen: 'Mars’' },
        venus: { name: 'Venus', loc: 'On Venus', gen: 'Venus’' },
        jupiter: { name: 'Jupiter', loc: 'On Jupiter', gen: 'Jupiter’s' },
        saturn: { name: 'Saturn', loc: 'On Saturn', gen: 'Saturn’s' },
      },
      jump: 'Jump',
      jumpAgain: 'Jump again',
      mass: 'Astronaut’s mass (with the suit)',
      massHint: 'Mass is the amount of matter in a body: it does not change, whatever planet the body is on.',
      legend: { F: 'force of gravity F = mg', v: 'velocity v', h: 'jump height h', ghost: 'mg on Earth' },
      ghostTag: (F) => `on Earth ${F} N`,
      chipReal: 'Real time',
      heightAxis: 'h, m',
      compareTag: (name, h) => `${name} ${h} m`,
      noSurface: 'no solid surface — clouds, an imaginary platform',
      toCentre: (gen) => `to ${gen} centre`,
      jumpTag: (h) => `h = ${h} m`,
      massTag: (m) => `m = ${m} kg`,
      mgTag: (F) => `mg = ${F} N`,
      forceScale: (n) => `${n} N`,
      dyno: { title: 'Spring scale and a 1 kg load', load: '1 kg', reads: (g) => `${g} N`, gIs: (g) => `g = F/m = ${g} N/kg` },
      sceneLabel: (loc, m, F, g) => `${loc}: a ${m} kg astronaut. Force of gravity ${F} N, g = ${g} m/s².`,
      readouts: { m: 'Mass', g: 'Free-fall acceleration', F: 'Force of gravity', h: 'Jump height' },
      mSub: 'the same everywhere',
      gSub: {
        same: (g) => `= ${g} N/kg · at the Earth’s surface`,
        less: (g, k) => `= ${g} N/kg · ${k} times less than on Earth`,
        more: (g, k) => `= ${g} N/kg · ${k} times more than on Earth`,
      },
      FSub: (FE) => `on Earth the same astronaut: ${FE} N`,
      FSubEarth: 'the Earth pulls him to its centre',
      hSub: (v0, t) => `v₀ = ${v0} m/s · ${t} s in the air`,
      formula: {
        F: 'Force of gravity',
        g: 'Where does g come from?',
        gNote: (gen, R) => `G is the gravitational constant, M and R are ${gen} mass and radius (R = ${R} km).`,
      },
      bars: {
        title: (m) => `The same ${m} kg — different force of gravity`,
        label: 'Force of gravity on different celestial bodies',
        note: 'The mass is the same, so the force of gravity is proportional to g: F = m·g. The white tick marks the value on Earth.',
      },
      explain: {
        idleEarth: (m, g, F) =>
          `The Earth pulls the ${m} kg astronaut towards its centre with F = m·g = ${m} · ${g} = ${F} N. g = ${g} N/kg: the Earth’s gravitational field acts on every kilogram of mass with a force of ${g} N.`,
        idleLess: (loc, g, m, F, k) =>
          `${loc} g = ${g} m/s², so each kilogram is pulled with ${g} N. The ${m} kg astronaut feels a force of gravity of ${F} N — ${k} times less than on Earth. The mass is still ${m} kg.`,
        idleMore: (loc, g, m, F, k) =>
          `${loc} g = ${g} m/s², so each kilogram is pulled with ${g} N. The ${m} kg astronaut feels a force of gravity of ${F} N — ${k} times more than on Earth. The mass is still ${m} kg.`,
        gas: (name) => ` ${name} is a gas giant with no solid surface: this is g at the cloud tops.`,
        jump: (g) => `Gravity acts in the air too: every second it changes the astronaut’s velocity by ${g} m/s — first slowing him down, then pulling him back.`,
        landedEarth: (v0, g, h, t) => `On Earth: h = v₀²/(2g) = ${v0}² / (2 · ${g}) = ${h} m, ${t} s in the air. Now pick the Moon or Jupiter and repeat the same jump.`,
        landed: (loc, h, hE, t, cmp) => `${loc} the same jump lifts the astronaut ${h} m (on Earth — ${hE} m) and lasts ${t} s. h = v₀²/(2g): ${cmp}`,
        higher: 'smaller g — higher jump.',
        lower: 'larger g — lower jump.',
      },
    },
    height: {
      presetsLabel: 'Where?',
      presets: { surface: 'Earth’s surface', everest: 'Everest', iss: 'ISS orbit', hR: 'h = R', geo: 'Geostationary', moon: 'Moon’s distance' },
      rise: 'Go up',
      slider: 'Altitude (above the surface)',
      sliderHint: 'The scale is logarithmic: kilometres on the left, hundreds of thousands of kilometres on the right.',
      legend: { F: 'force of gravity mg (60 kg)', curve: 'g(r) — dependence on distance', rings: 'spheres r = 2R, 3R…' },
      chip: 'Earth and distances to scale',
      gAxis: 'g, m/s²',
      earth: 'Earth',
      moon: 'Moon',
      levelTop: (g) => `g₀ = ${g}`,
      level: (n2, g) => `g₀/${n2} = ${g}`,
      gTag: (g) => `g = ${g} m/s²`,
      mgTag: (F) => `mg = ${F} N`,
      sceneLabel: (h, g) => `The Earth and a body ${h} km above it. Here g = ${g} m/s².`,
      readouts: { h: 'Altitude', r: 'Distance to the centre', g: 'Free-fall acceleration', F: 'Force of gravity' },
      hSubPct: (p) => `${p} % of the Earth’s radius`,
      hSubR: (k) => `≈ ${k} Earth radii`,
      rSub: (k) => `r = R + h = ${k} R`,
      gSub: (p) => `${p} % of g₀ at the surface`,
      FSub: (m, F0) => `a ${m} kg body · ${F0} N at the surface`,
      formula: {
        g: 'g at altitude',
        gNote: (R) => `g₀ is the value at the surface, R = ${R} km the Earth’s radius, r = R + h the distance to the centre.`,
        F: 'Force of gravity',
      },
      ladder: {
        title: 'g at different altitudes, m/s²',
        note: 'However many times r grows, g shrinks by that number squared: g ~ 1/r². That is why g hardly changes on a mountain top, but is ≈ 3600 times smaller at the Moon’s distance.',
      },
      explain: {
        surface: (g, R) => `At the surface g₀ = ${g} m/s², and the distance to the centre is the Earth’s radius R = ${R} km. Going up increases r = R + h, and g drops. Press "Go up" or pick a place.`,
        low: (h, pR, g, pct) => `h = ${h} km is only ${pR} % of the Earth’s radius. So g = ${g} m/s² (${pct} %) — almost unchanged: even on top of Everest gravity is nearly the same as at sea level.`,
        leo: (h, g, pct) => `At ${h} km g = ${g} m/s² — ${pct} % of its surface value. The Earth pulls the ISS crew almost as hard as us: they float not because gravity is gone, but because, circling the Earth, they are falling all the time.`,
        twoR: (g0, g) => `h = R: the distance to the Earth’s centre has doubled, and g has dropped 2² = 4 times: ${g0} / 4 = ${g} m/s².`,
        geo: (h, rR, g, k2) => `Geostationary orbit: h = ${h} km, r ≈ ${rR} R. g = ${g} m/s² — ${k2} times less than at the surface. Satellites here turn together with the Earth and seem to hang still in the sky.`,
        moon: (rR, g, k2) => `At the Moon’s distance r ≈ ${rR} R, so g ≈ ${g} m/s² — ${k2} times less (≈ 60² = 3600). This weak pull keeps the Moon in orbit: with exactly this calculation Newton tested his law of universal gravitation.`,
        mid: (rR, g, k2) => `The distance to the centre is r = ${rR} R, so g = g₀ / ${rR}² = g₀ / ${k2} = ${g} m/s². However many times the distance grows, g shrinks by that number squared.`,
      },
    },
    fall: {
      envLabel: 'Conditions',
      envs: {
        moon: { name: 'On the Moon', sub: 'Apollo 15 · no air' },
        tube: { name: 'On Earth, in a vacuum', sub: 'Newton’s tube' },
        air: { name: 'On Earth, in air', sub: 'with air resistance' },
      },
      hammer: 'hammer',
      feather: 'feather',
      slowLabel: 'Playback speed',
      slow: { real: 'Real time', times: (k) => `${k}× slower` },
      chipReal: 'Real time',
      chipSlow: (k) => `Time slowed ${k}×`,
      legend: { F: 'force of gravity mg', a: 'acceleration a', strobe: (dt) => `position every ${dt} s` },
      heightAxis: 'h, m',
      vacuum: 'air pumped out',
      ground: { moon: 'Lunar surface · no air', tube: 'Earth · vacuum in the tube', air: 'Earth · air' },
      secTag: (t) => `${t} s`,
      mgTag: (F) => `mg = ${F} N`,
      dragTag: 'air resistance ≈ mg',
      hammerTag: (m) => `hammer · ${m} kg`,
      featherTag: (m) => `falcon feather · ${m} kg`,
      landTag: (t) => `landed · ${t} s`,
      forceScale: (n) => `${n} N`,
      sceneLabel: (env, t) => `A hammer and a feather falling: ${env}. t = ${t} s.`,
      readouts: { t: 'Time', hammer: 'Hammer: force of gravity', feather: 'Feather: force of gravity', times: 'Time to land' },
      objSub: (m, a) => `m = ${m} kg · a = ${a} m/s²`,
      objLanded: (m) => `m = ${m} kg · landed`,
      formula: {
        tag: 'Why is the acceleration the same?',
        note: (k) => `The hammer’s mass is ${k} times larger — and so is its force of gravity. The ratio F/m is the same for both: g.`,
        airNote: 'In air the feather also feels air resistance: a = (mg − F_air)/m < g. The hammer hardly notices it.',
      },
      bars: { F: 'Force of gravity F = mg', a: 'Acceleration while falling a = F/m' },
      graph: {
        title: 'Graph: velocity v(t)',
        t: 't, s',
        v: 'v, m/s',
        label: 'Velocity of the hammer and the feather against time',
        noteVac: 'No air: the two lines lie on top of each other — v = g·t.',
        noteAir: (vt) => `In air the feather never goes faster than ≈ ${vt} m/s, while the hammer speeds up almost as v = g·t.`,
      },
      explain: {
        moonIdle:
          '1971, Apollo 15: on the Moon astronaut David Scott let go of a 1.32 kg geological hammer and a 0.03 kg falcon feather at the same moment, from about 1.6 m. Which lands first? Press Start.',
        tubeIdle: 'Newton’s tube is a glass tube with the air pumped out. How do a feather and a hammer fall on Earth when there is no air? Press Start.',
        airIdle: 'Now the same experiment on Earth, in air. Besides gravity, air resistance acts on the bodies. Press Start.',
        vacuumFall: (k, g) =>
          `The hammer feels a ${k} times larger force of gravity than the feather — but its mass is ${k} times larger too. a = F/m = mg/m = g: both fall with the same acceleration of ${g} m/s².`,
        airFall: (vt) =>
          `Air resistance matters a lot for the feather: it soon balances the feather’s weight, and the feather drifts down almost steadily at ≈ ${vt} m/s. The hammer barely notices the air.`,
        airHalf: (t) => `The hammer landed after ${t} s; the feather is still drifting down.`,
        airDone: (th, tf) => `The hammer landed after ${th} s, the feather after ${tf} s. The difference comes from air resistance, not from gravity — in a vacuum they fall together.`,
        moonDone: (t, g) =>
          `Both touched the ground together — after ${t} s! There is no air on the Moon: only gravity acts, and the acceleration does not depend on the mass. Since g = ${g} m/s² is small, they fell more slowly than on Earth.`,
        tubeDone: (t, g) => `In a vacuum on Earth the feather and the hammer fell together too: t = ${t} s. Faster than on the Moon, since on Earth g = ${g} m/s², about 6 times larger.`,
      },
    },
  },
};

export default function Gravity() {
  const T = useSimText(TEXT);
  const tabs = T.card.tabs;
  return (
    <SimCard
      idPrefix="gravity"
      icon={ArrowDownToLine}
      eyebrow={T.card.eyebrow}
      title={T.card.title}
      tabsLabel={T.card.tabsLabel}
      tabs={[
        { id: 'planets', label: tabs.planets.label, sub: tabs.planets.sub, icon: Orbit, render: () => <PlanetsSim T={T} /> },
        { id: 'height', label: tabs.height.label, sub: tabs.height.sub, icon: Rocket, render: () => <HeightSim T={T} /> },
        { id: 'fall', label: tabs.fall.label, sub: tabs.fall.sub, icon: Feather, render: () => <FallSim T={T} /> },
      ]}
      facts={T.facts}
    />
  );
}
