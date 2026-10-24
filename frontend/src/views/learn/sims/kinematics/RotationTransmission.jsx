import { Bike, Cog, Disc3 } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { useSimText } from '../kit/lang';
import { rich } from './RotationTransmission.parts';
import BeltSim from './RotationTransmission.belt';
import GearSim from './RotationTransmission.gears';
import BikeSim from './RotationTransmission.bike';

/**
 * Lesson "Transmission of rotational motion" (Aylanma harakatning
 * uzatilishi).
 *
 *   belt  - two pulleys and a belt that does not slip: the rim speeds are
 *           equal, v = ω₁R₁ = ω₂R₂, so n₂/n₁ = R₁/R₂; a crossed belt turns
 *           the driven pulley the other way.
 *   gears - meshing gears: as many teeth of each pass the contact point per
 *           second, z₁n₁ = z₂n₂; neighbours turn opposite ways, an idler
 *           gear reverses the direction but not the ratio.
 *   bike  - chainring → chain → sprocket, and the rear wheel on the
 *           sprocket's axle (same ω, much larger rim speed): bike speed from
 *           the pedalling cadence.
 *
 * Every word on screen comes from TEXT; "_x" in a string is a subscript.
 */
const TEXT = {
  uz: {
    common: {
      start: 'Boshlash',
      pause: "To'xtatish",
      resume: 'Davom etish',
      again: 'Yana boshlash',
      reset: 'Qayta',
      realTime: 'Real vaqt',
      faster: (k) => `Vaqt ×${k} tezlashtirilgan`,
      slower: (k) => `Vaqt ${k} marta sekinlashtirilgan`,
      cell: (c) => `1 katak = ${c}`,
      cm: 'sm',
      mm: 'mm',
      rpm: 'ayl/min',
      cw: 'soat mili bo‘yicha',
      ccw: 'soat miliga qarshi',
      turns: 'Aylanishlar soni',
    },
    card: {
      eyebrow: 'Virtual laboratoriya · Kinematika',
      title: 'Aylanma harakatning uzatilishi',
      tabsLabel: 'Simulyatorni tanlang',
      tabs: {
        belt: { label: 'Tasmali uzatma', sub: 'ω₁R₁ = ω₂R₂' },
        gears: { label: 'Tishli uzatma', sub: 'z₁n₁ = z₂n₂' },
        bike: { label: 'Velosiped', sub: 'pedaldan g‘ildirakkacha' },
      },
    },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: 'Tasmali uzatma', text: 'tasma sirpanmasa, shkivlar chetining tezligi teng: v₁ = v₂, ω₁R₁ = ω₂R₂, n₂/n₁ = R₁/R₂.' },
        { term: 'Tishli uzatma', text: 'z₁n₁ = z₂n₂; ilashgan g‘ildiraklar qarama-qarshi tomonga aylanadi.' },
        { term: 'Uzatish soni', text: 'i = n₁/n₂ = R₂/R₁ = z₂/z₁. i > 1 — aylanish sekinlashadi, i < 1 — tezlashadi.' },
        { term: 'Bitta o‘qdagi g‘ildiraklar', text: 'burchak tezligi ω bir xil, chetidagi tezlik v = ωR esa radiusga proporsional.' },
      ],
    },
    belt: {
      typeLabel: 'Tasma',
      types: {
        open: { name: 'Ochiq tasma', sub: 'shkivlar bir tomonga aylanadi' },
        crossed: { name: 'Ayqash tasma', sub: 'shkivlar qarama-qarshi aylanadi' },
      },
      r1: '1-shkiv radiusi (yetaklovchi)',
      r2: '2-shkiv radiusi (yetaklanuvchi)',
      nu1: '1-shkivning aylanish chastotasi',
      nuHint: (rpm) => `${rpm} ayl/min — dvigatel shu chastota bilan aylantiradi`,
      legend: { belt: 'tasma', v: 'chetidagi nuqta tezligi v', mark: 'belgi — aylanishlarni sanash uchun' },
      p1: '1 · yetaklovchi',
      p2: '2 · yetaklanuvchi',
      pTag: (i, nu) => `n_${i} = ${nu} Hz`,
      vTag: (v) => `v = ${v} m/s`,
      sceneLabel: (r1, r2, n1, n2) => `Tasmali uzatma: R₁ = ${r1} sm, R₂ = ${r2} sm, n₁ = ${n1} Hz, n₂ = ${n2} Hz.`,
      readouts: {
        p1: '1-shkiv',
        p2: '2-shkiv',
        omega: (w, rpm) => `ω = ${w} rad/s · ${rpm} ayl/min`,
        v: 'Tasma tezligi',
        vSub: 'v = ω₁R₁ = ω₂R₂',
        i: 'Uzatish soni',
        iDown: 'aylanish sekinlashadi',
        iUp: 'aylanish tezlashadi',
        iSame: 'chastotalar teng',
      },
      counter: { title: 'Aylanishlar soni', ratio: (r) => `N₁ : N₂ = ${r}` },
      calc: { title: 'Hisoblash' },
      explain: {
        idle: '«Boshlash»ni bosing. Tasma sirpanmasa, ikkala shkiv chetidagi nuqtalar tasma bilan birga bir xil v tezlikda harakatlanadi: v₁ = v₂.',
        down: (k, n2) => `Katta shkiv sekinroq aylanadi: R₂ = ${k}·R₁, shuning uchun n₂ = n₁/${k} = ${n2} Hz. Shkivlar chetining tezligi esa bir xil.`,
        up: (k, n2) => `Kichik shkiv tezroq aylanadi: R₁ = ${k}·R₂, shuning uchun n₂ = ${k}·n₁ = ${n2} Hz. Bunday uzatma aylanishni tezlashtiradi.`,
        same: 'Shkivlar bir xil: ular bir xil chastota bilan aylanadi, uzatish soni i = 1.',
        count: (n1, n2, r) => `1-shkiv ${n1} marta, 2-shkiv ${n2} marta aylandi: N₁/N₂ = R₂/R₁ = ${r}.`,
        crossed: 'Ayqash tasmada 2-shkiv teskari tomonga aylanadi, chastotalar nisbati esa o‘zgarmaydi.',
      },
    },
    gears: {
      countLabel: "G'ildiraklar",
      counts: {
        two: { name: 'Ikki g‘ildirak', sub: 'yetaklovchi va yetaklanuvchi' },
        three: { name: 'Uch g‘ildirak', sub: 'o‘rtada oraliq g‘ildirak' },
      },
      z: (i) => `${i}-g‘ildirak tishlari soni`,
      nu1: '1-g‘ildirakning aylanish chastotasi',
      nuHint: (rpm) => `${rpm} ayl/min`,
      module: 'Hamma g‘ildiraklarning tishlari bir xil: radius tishlar soniga proporsional, r = m·z/2 (m = 3 mm).',
      legend: { pitch: 'boshlang‘ich aylana (r = m·z/2)', v: 'ilashish nuqtasidagi tezlik v', mark: 'belgilangan tish' },
      gTag: (i, z) => `z_${i} = ${z}`,
      nuTag: (i, nu) => `n_${i} = ${nu} Hz`,
      sceneLabel: (z1, z2, n1, n2) => `Tishli uzatma: z₁ = ${z1}, z₂ = ${z2}, n₁ = ${n1} Hz, n₂ = ${n2} Hz.`,
      readouts: {
        g: (i) => `${i}-g‘ildirak`,
        sub: (z, dir) => `z = ${z} · ${dir}`,
        i: 'Uzatish soni',
        iSub2: 'i = n₁/n₂ = z₂/z₁',
        iSub3: 'i = n₁/n₃ = z₃/z₁',
        v: 'Ilashish nuqtasi tezligi',
      },
      calc: { title: 'Hisoblash' },
      explain: {
        idle: '«Boshlash»ni bosing. Ilashish nuqtasidan har sekundda ikkala g‘ildirakning bir xil sondagi tishlari o‘tadi: z₁n₁ = z₂n₂. Shuning uchun tishi ko‘p g‘ildirak sekinroq aylanadi.',
        down: (k, n2) => `Ilashgan g‘ildiraklar qarama-qarshi tomonga aylanadi. 2-g‘ildirakning tishlari ${k} marta ko‘p — u ${k} marta sekin aylanadi: n₂ = ${n2} Hz.`,
        up: (k, n2) => `Ilashgan g‘ildiraklar qarama-qarshi tomonga aylanadi. 2-g‘ildirakning tishlari ${k} marta kam — u ${k} marta tez aylanadi: n₂ = ${n2} Hz.`,
        same: 'Tishlar soni teng: g‘ildiraklar bir xil chastota bilan, lekin qarama-qarshi tomonga aylanadi.',
        three: (i) => `Oraliq g‘ildirak yo‘nalishni yana teskari qiladi: 3-g‘ildirak 1-g‘ildirak bilan bir tomonga aylanadi. Uzatish soni faqat z₃/z₁ = ${i} ga bog‘liq — oraliq g‘ildirakning tishlari soni ta’sir qilmaydi.`,
        count: (n1, n2, r) => `1-g‘ildirak ${n1} marta, 2-g‘ildirak ${n2} marta aylandi: N₁/N₂ = z₂/z₁ = ${r}.`,
      },
    },
    bike: {
      gearsLabel: 'Uzatma',
      presets: {
        hill: { name: 'Tepalikka', sub: '32 / 28 tish' },
        city: { name: 'Shahar', sub: '44 / 16 tish' },
        fast: { name: 'Tezkor', sub: '52 / 11 tish' },
      },
      z1: 'Oldingi yulduzcha tishlari (pedal)',
      z2: 'Orqa yulduzcha tishlari (g‘ildirak)',
      cadence: 'Pedalni aylantirish chastotasi',
      cadenceHint: 'Odatda 60–90 ayl/min',
      radius: 'Orqa g‘ildirak radiusi',
      radiusHint: '26 dyuymli g‘ildirak ≈ 0.33 m, 28 dyuymli ≈ 0.34 m',
      pitchNote: 'Yulduzcha radiusi tishlar soniga proporsional: r = z·p/2π, bu yerda p = 12.7 mm — zanjir bo‘g‘inining qadami.',
      legend: { chain: 'zanjir', v: 'tezlik', mark: 'pedal' },
      zoomTitle: 'Uzatma yaqindan',
      sameAxle: 'g‘ildirak bilan bitta o‘qda',
      chainTag: (v) => `v_zanjir = ${v} m/s`,
      speedTag: (kmh) => `v = ${kmh} km/soat`,
      sceneLabel: (kmh) => `Velosiped yon tomondan, tezligi ${kmh} km/soat.`,
      zoomLabel: (z1, z2) => `Oldingi yulduzcha ${z1} tishli, orqa yulduzcha ${z2} tishli, ular zanjir bilan bog'langan.`,
      readouts: {
        cadence: 'Pedallash',
        cadenceSub: (nu) => `n₁ = ${nu} ayl/s`,
        wheel: "G'ildirak",
        wheelSub: (rpm) => `n₂ = n₁·z₁/z₂ · ${rpm} ayl/min`,
        ratio: 'Uzatish',
        ratioSub: (s) => `1 pedal aylanishida ${s} m yo‘l`,
        speed: 'Velosiped tezligi',
        speedSub: (v) => `v = 2πR·n₂ = ${v} m/s`,
      },
      axle: {
        title: 'Bitta o‘qda: ω bir xil, v har xil',
        omega: (w) => `ω₂ = ${w} rad/s (yulduzcha ham, g‘ildirak ham)`,
        chain: 'yulduzcha chekkasi (zanjir)',
        rim: 'g‘ildirak chekkasi',
      },
      calc: { title: 'Hisoblash' },
      explain: {
        idle: '«Boshlash»ni bosing. Zanjir ikkala yulduzchaning chetini bir xil tezlikda tortadi: z₁n₁ = z₂n₂. Orqa yulduzcha va g‘ildirak bitta o‘qda — ularning burchak tezligi bir xil.',
        low: (k, s) => `Yengil uzatma: pedalni 1 marta aylantirsangiz, g‘ildirak atigi ${k} marta aylanadi va velosiped ${s} m yuradi. Tezlik kichik, tepalikka chiqish uchun qulay.`,
        mid: (k, s, kmh) => `Pedalni 1 marta aylantirsangiz, orqa g‘ildirak z₁/z₂ = ${k} marta aylanadi va velosiped 2πR·${k} = ${s} m yuradi. Hozirgi tezlik — ${kmh} km/soat.`,
        high: (k, s, kmh) => `Tezkor uzatma: har bir pedal aylanishida g‘ildirak ${k} marta aylanadi, velosiped ${s} m yuradi — ${kmh} km/soat. Pedalni aylantirish og‘irroq bo‘ladi.`,
      },
    },
  },

  ru: {
    common: {
      start: 'Старт',
      pause: 'Пауза',
      resume: 'Продолжить',
      again: 'Ещё раз',
      reset: 'Сброс',
      realTime: 'Реальное время',
      faster: (k) => `Время ускорено ×${k}`,
      slower: (k) => `Время замедлено в ${k} раз`,
      cell: (c) => `1 клетка = ${c}`,
      cm: 'см',
      mm: 'мм',
      rpm: 'об/мин',
      cw: 'по часовой стрелке',
      ccw: 'против часовой стрелки',
      turns: 'Число оборотов',
    },
    card: {
      eyebrow: 'Виртуальная лаборатория · Кинематика',
      title: 'Передача вращательного движения',
      tabsLabel: 'Выберите симулятор',
      tabs: {
        belt: { label: 'Ременная передача', sub: 'ω₁R₁ = ω₂R₂' },
        gears: { label: 'Зубчатая передача', sub: 'z₁n₁ = z₂n₂' },
        bike: { label: 'Велосипед', sub: 'от педалей до колеса' },
      },
    },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Ременная передача', text: 'если ремень не проскальзывает, скорости ободов равны: v₁ = v₂, ω₁R₁ = ω₂R₂, n₂/n₁ = R₁/R₂.' },
        { term: 'Зубчатая передача', text: 'z₁n₁ = z₂n₂; сцепленные колёса вращаются в противоположные стороны.' },
        { term: 'Передаточное число', text: 'i = n₁/n₂ = R₂/R₁ = z₂/z₁. При i > 1 вращение замедляется, при i < 1 — ускоряется.' },
        { term: 'Колёса на одной оси', text: 'угловая скорость ω одинакова, а скорость обода v = ωR пропорциональна радиусу.' },
      ],
    },
    belt: {
      typeLabel: 'Ремень',
      types: {
        open: { name: 'Открытый ремень', sub: 'шкивы вращаются в одну сторону' },
        crossed: { name: 'Перекрёстный ремень', sub: 'шкивы вращаются навстречу' },
      },
      r1: 'Радиус шкива 1 (ведущего)',
      r2: 'Радиус шкива 2 (ведомого)',
      nu1: 'Частота вращения шкива 1',
      nuHint: (rpm) => `${rpm} об/мин — с такой частотой его крутит двигатель`,
      legend: { belt: 'ремень', v: 'скорость точки обода v', mark: 'метка — для счёта оборотов' },
      p1: '1 · ведущий',
      p2: '2 · ведомый',
      pTag: (i, nu) => `n_${i} = ${nu} Гц`,
      vTag: (v) => `v = ${v} м/с`,
      sceneLabel: (r1, r2, n1, n2) => `Ременная передача: R₁ = ${r1} см, R₂ = ${r2} см, n₁ = ${n1} Гц, n₂ = ${n2} Гц.`,
      readouts: {
        p1: 'Шкив 1',
        p2: 'Шкив 2',
        omega: (w, rpm) => `ω = ${w} рад/с · ${rpm} об/мин`,
        v: 'Скорость ремня',
        vSub: 'v = ω₁R₁ = ω₂R₂',
        i: 'Передаточное число',
        iDown: 'вращение замедляется',
        iUp: 'вращение ускоряется',
        iSame: 'частоты равны',
      },
      counter: { title: 'Число оборотов', ratio: (r) => `N₁ : N₂ = ${r}` },
      calc: { title: 'Расчёт' },
      explain: {
        idle: 'Нажмите «Старт». Если ремень не проскальзывает, точки на ободах обоих шкивов движутся вместе с ремнём с одной и той же скоростью: v₁ = v₂.',
        down: (k, n2) => `Большой шкив вращается медленнее: R₂ = ${k}·R₁, поэтому n₂ = n₁/${k} = ${n2} Гц. А скорость ободов одинакова.`,
        up: (k, n2) => `Маленький шкив вращается быстрее: R₁ = ${k}·R₂, поэтому n₂ = ${k}·n₁ = ${n2} Гц. Такая передача ускоряет вращение.`,
        same: 'Шкивы одинаковы: они вращаются с одной частотой, передаточное число i = 1.',
        count: (n1, n2, r) => `Шкив 1 сделал ${n1} об., шкив 2 — ${n2} об.: N₁/N₂ = R₂/R₁ = ${r}.`,
        crossed: 'С перекрёстным ремнём шкив 2 вращается в обратную сторону, а отношение частот не меняется.',
      },
    },
    gears: {
      countLabel: 'Колёса',
      counts: {
        two: { name: 'Два колеса', sub: 'ведущее и ведомое' },
        three: { name: 'Три колеса', sub: 'посередине паразитное' },
      },
      z: (i) => `Число зубьев колеса ${i}`,
      nu1: 'Частота вращения колеса 1',
      nuHint: (rpm) => `${rpm} об/мин`,
      module: 'Зубья у всех колёс одинаковы: радиус пропорционален числу зубьев, r = m·z/2 (m = 3 мм).',
      legend: { pitch: 'делительная окружность (r = m·z/2)', v: 'скорость в точке зацепления v', mark: 'отмеченный зуб' },
      gTag: (i, z) => `z_${i} = ${z}`,
      nuTag: (i, nu) => `n_${i} = ${nu} Гц`,
      sceneLabel: (z1, z2, n1, n2) => `Зубчатая передача: z₁ = ${z1}, z₂ = ${z2}, n₁ = ${n1} Гц, n₂ = ${n2} Гц.`,
      readouts: {
        g: (i) => `Колесо ${i}`,
        sub: (z, dir) => `z = ${z} · ${dir}`,
        i: 'Передаточное число',
        iSub2: 'i = n₁/n₂ = z₂/z₁',
        iSub3: 'i = n₁/n₃ = z₃/z₁',
        v: 'Скорость в точке зацепления',
      },
      calc: { title: 'Расчёт' },
      explain: {
        idle: 'Нажмите «Старт». Через точку зацепления за секунду проходит одинаковое число зубьев обоих колёс: z₁n₁ = z₂n₂. Поэтому колесо с большим числом зубьев вращается медленнее.',
        down: (k, n2) => `Сцепленные колёса вращаются в противоположные стороны. У колеса 2 в ${k} раза больше зубьев — оно вращается в ${k} раза медленнее: n₂ = ${n2} Гц.`,
        up: (k, n2) => `Сцепленные колёса вращаются в противоположные стороны. У колеса 2 в ${k} раза меньше зубьев — оно вращается в ${k} раза быстрее: n₂ = ${n2} Гц.`,
        same: 'Число зубьев одинаково: колёса вращаются с одной частотой, но в противоположные стороны.',
        three: (i) => `Паразитное колесо снова меняет направление: колесо 3 вращается в ту же сторону, что и колесо 1. Передаточное число зависит только от z₃/z₁ = ${i} — зубья промежуточного колеса на него не влияют.`,
        count: (n1, n2, r) => `Колесо 1 сделало ${n1} об., колесо 2 — ${n2} об.: N₁/N₂ = z₂/z₁ = ${r}.`,
      },
    },
    bike: {
      gearsLabel: 'Передача',
      presets: {
        hill: { name: 'В гору', sub: '32 / 28 зубьев' },
        city: { name: 'Город', sub: '44 / 16 зубьев' },
        fast: { name: 'Скоростная', sub: '52 / 11 зубьев' },
      },
      z1: 'Зубья передней звёздочки (педали)',
      z2: 'Зубья задней звёздочки (колесо)',
      cadence: 'Частота вращения педалей',
      cadenceHint: 'Обычно 60–90 об/мин',
      radius: 'Радиус заднего колеса',
      radiusHint: 'Колесо 26″ ≈ 0,33 м, 28″ ≈ 0,34 м',
      pitchNote: 'Радиус звёздочки пропорционален числу зубьев: r = z·p/2π, где p = 12,7 мм — шаг цепи.',
      legend: { chain: 'цепь', v: 'скорость', mark: 'педаль' },
      zoomTitle: 'Передача крупным планом',
      sameAxle: 'на одной оси с колесом',
      chainTag: (v) => `v_цепи = ${v} м/с`,
      speedTag: (kmh) => `v = ${kmh} км/ч`,
      sceneLabel: (kmh) => `Велосипед сбоку, скорость ${kmh} км/ч.`,
      zoomLabel: (z1, z2) => `Передняя звёздочка с ${z1} зубьями и задняя с ${z2} зубьями, соединённые цепью.`,
      readouts: {
        cadence: 'Педали',
        cadenceSub: (nu) => `n₁ = ${nu} об/с`,
        wheel: 'Колесо',
        wheelSub: (rpm) => `n₂ = n₁·z₁/z₂ · ${rpm} об/мин`,
        ratio: 'Передача',
        ratioSub: (s) => `за оборот педалей ${s} м пути`,
        speed: 'Скорость велосипеда',
        speedSub: (v) => `v = 2πR·n₂ = ${v} м/с`,
      },
      axle: {
        title: 'На одной оси: ω одна, v разные',
        omega: (w) => `ω₂ = ${w} рад/с (и у звёздочки, и у колеса)`,
        chain: 'край звёздочки (цепь)',
        rim: 'обод колеса',
      },
      calc: { title: 'Расчёт' },
      explain: {
        idle: 'Нажмите «Старт». Цепь тянет края обеих звёздочек с одной скоростью: z₁n₁ = z₂n₂. Задняя звёздочка и колесо сидят на одной оси — их угловая скорость одинакова.',
        low: (k, s) => `Лёгкая передача: за один оборот педалей колесо делает всего ${k} оборота, и велосипед проезжает ${s} м. Скорость невелика — удобно ехать в гору.`,
        mid: (k, s, kmh) => `За один оборот педалей заднее колесо делает z₁/z₂ = ${k} оборота, и велосипед проезжает 2πR·${k} = ${s} м. Сейчас скорость ${kmh} км/ч.`,
        high: (k, s, kmh) => `Скоростная передача: за оборот педалей колесо делает ${k} оборота, велосипед проезжает ${s} м — ${kmh} км/ч. Крутить педали тяжелее.`,
      },
    },
  },

  en: {
    common: {
      start: 'Start',
      pause: 'Pause',
      resume: 'Resume',
      again: 'Run again',
      reset: 'Reset',
      realTime: 'Real time',
      faster: (k) => `Time sped up ×${k}`,
      slower: (k) => `Time slowed ${k} times`,
      cell: (c) => `1 square = ${c}`,
      cm: 'cm',
      mm: 'mm',
      rpm: 'rpm',
      cw: 'clockwise',
      ccw: 'anticlockwise',
      turns: 'Turns',
    },
    card: {
      eyebrow: 'Virtual laboratory · Kinematics',
      title: 'Transmission of rotational motion',
      tabsLabel: 'Choose a simulator',
      tabs: {
        belt: { label: 'Belt drive', sub: 'ω₁R₁ = ω₂R₂' },
        gears: { label: 'Gears', sub: 'z₁n₁ = z₂n₂' },
        bike: { label: 'Bicycle', sub: 'from pedals to wheel' },
      },
    },
    facts: {
      title: 'Remember',
      items: [
        { term: 'Belt drive', text: 'if the belt does not slip, the rim speeds are equal: v₁ = v₂, ω₁R₁ = ω₂R₂, n₂/n₁ = R₁/R₂.' },
        { term: 'Gears', text: 'z₁n₁ = z₂n₂; meshing gears turn in opposite directions.' },
        { term: 'Gear ratio', text: 'i = n₁/n₂ = R₂/R₁ = z₂/z₁. With i > 1 the rotation slows down, with i < 1 it speeds up.' },
        { term: 'Wheels on one axle', text: 'share the angular velocity ω; the rim speed v = ωR grows with the radius.' },
      ],
    },
    belt: {
      typeLabel: 'Belt',
      types: {
        open: { name: 'Open belt', sub: 'pulleys turn the same way' },
        crossed: { name: 'Crossed belt', sub: 'pulleys turn opposite ways' },
      },
      r1: 'Radius of pulley 1 (driving)',
      r2: 'Radius of pulley 2 (driven)',
      nu1: 'Frequency of pulley 1',
      nuHint: (rpm) => `${rpm} rpm — the motor turns it this fast`,
      legend: { belt: 'belt', v: 'speed of a rim point v', mark: 'mark — for counting turns' },
      p1: '1 · driving',
      p2: '2 · driven',
      pTag: (i, nu) => `n_${i} = ${nu} Hz`,
      vTag: (v) => `v = ${v} m/s`,
      sceneLabel: (r1, r2, n1, n2) => `Belt drive: R₁ = ${r1} cm, R₂ = ${r2} cm, n₁ = ${n1} Hz, n₂ = ${n2} Hz.`,
      readouts: {
        p1: 'Pulley 1',
        p2: 'Pulley 2',
        omega: (w, rpm) => `ω = ${w} rad/s · ${rpm} rpm`,
        v: 'Belt speed',
        vSub: 'v = ω₁R₁ = ω₂R₂',
        i: 'Gear ratio',
        iDown: 'rotation slows down',
        iUp: 'rotation speeds up',
        iSame: 'equal frequencies',
      },
      counter: { title: 'Turns', ratio: (r) => `N₁ : N₂ = ${r}` },
      calc: { title: 'Working' },
      explain: {
        idle: 'Press Start. If the belt does not slip, points on the rims of both pulleys move with the belt at the same speed: v₁ = v₂.',
        down: (k, n2) => `The big pulley turns more slowly: R₂ = ${k}·R₁, so n₂ = n₁/${k} = ${n2} Hz. The rim speeds are the same.`,
        up: (k, n2) => `The small pulley turns faster: R₁ = ${k}·R₂, so n₂ = ${k}·n₁ = ${n2} Hz. This drive speeds the rotation up.`,
        same: 'The pulleys are the same size: they turn at the same frequency, gear ratio i = 1.',
        count: (n1, n2, r) => `Pulley 1 made ${n1} turns, pulley 2 made ${n2}: N₁/N₂ = R₂/R₁ = ${r}.`,
        crossed: 'With a crossed belt pulley 2 turns the other way, and the ratio of frequencies stays the same.',
      },
    },
    gears: {
      countLabel: 'Gears',
      counts: {
        two: { name: 'Two gears', sub: 'driving and driven' },
        three: { name: 'Three gears', sub: 'an idler in the middle' },
      },
      z: (i) => `Teeth on gear ${i}`,
      nu1: 'Frequency of gear 1',
      nuHint: (rpm) => `${rpm} rpm`,
      module: 'All the gears have the same teeth, so the radius is proportional to the number of teeth: r = m·z/2 (m = 3 mm).',
      legend: { pitch: 'pitch circle (r = m·z/2)', v: 'speed at the contact point v', mark: 'marked tooth' },
      gTag: (i, z) => `z_${i} = ${z}`,
      nuTag: (i, nu) => `n_${i} = ${nu} Hz`,
      sceneLabel: (z1, z2, n1, n2) => `Gears: z₁ = ${z1}, z₂ = ${z2}, n₁ = ${n1} Hz, n₂ = ${n2} Hz.`,
      readouts: {
        g: (i) => `Gear ${i}`,
        sub: (z, dir) => `z = ${z} · ${dir}`,
        i: 'Gear ratio',
        iSub2: 'i = n₁/n₂ = z₂/z₁',
        iSub3: 'i = n₁/n₃ = z₃/z₁',
        v: 'Speed at the contact point',
      },
      calc: { title: 'Working' },
      explain: {
        idle: 'Press Start. Every second the same number of teeth of each gear passes the contact point: z₁n₁ = z₂n₂. So the gear with more teeth turns more slowly.',
        down: (k, n2) => `Meshing gears turn in opposite directions. Gear 2 has ${k} times as many teeth, so it turns ${k} times more slowly: n₂ = ${n2} Hz.`,
        up: (k, n2) => `Meshing gears turn in opposite directions. Gear 2 has ${k} times fewer teeth, so it turns ${k} times faster: n₂ = ${n2} Hz.`,
        same: 'Equal numbers of teeth: the gears turn at the same frequency but in opposite directions.',
        three: (i) => `The idler reverses the direction again: gear 3 turns the same way as gear 1. The ratio depends only on z₃/z₁ = ${i} — the idler's teeth do not change it.`,
        count: (n1, n2, r) => `Gear 1 made ${n1} turns, gear 2 made ${n2}: N₁/N₂ = z₂/z₁ = ${r}.`,
      },
    },
    bike: {
      gearsLabel: 'Gear',
      presets: {
        hill: { name: 'Uphill', sub: '32 / 28 teeth' },
        city: { name: 'City', sub: '44 / 16 teeth' },
        fast: { name: 'Fast', sub: '52 / 11 teeth' },
      },
      z1: 'Chainring teeth (pedals)',
      z2: 'Sprocket teeth (wheel)',
      cadence: 'Pedalling cadence',
      cadenceHint: 'Usually 60–90 rpm',
      radius: 'Rear wheel radius',
      radiusHint: 'A 26″ wheel ≈ 0.33 m, a 28″ wheel ≈ 0.34 m',
      pitchNote: 'A sprocket’s radius is proportional to its teeth: r = z·p/2π, where p = 12.7 mm is the chain pitch.',
      legend: { chain: 'chain', v: 'velocity', mark: 'pedal' },
      zoomTitle: 'The drive up close',
      sameAxle: 'on one axle with the wheel',
      chainTag: (v) => `v_chain = ${v} m/s`,
      speedTag: (kmh) => `v = ${kmh} km/h`,
      sceneLabel: (kmh) => `Bicycle from the side, going ${kmh} km/h.`,
      zoomLabel: (z1, z2) => `A ${z1}-tooth chainring and a ${z2}-tooth sprocket joined by the chain.`,
      readouts: {
        cadence: 'Pedalling',
        cadenceSub: (nu) => `n₁ = ${nu} turns/s`,
        wheel: 'Wheel',
        wheelSub: (rpm) => `n₂ = n₁·z₁/z₂ · ${rpm} rpm`,
        ratio: 'Gear',
        ratioSub: (s) => `${s} m per pedal turn`,
        speed: 'Bike speed',
        speedSub: (v) => `v = 2πR·n₂ = ${v} m/s`,
      },
      axle: {
        title: 'One axle: same ω, different v',
        omega: (w) => `ω₂ = ${w} rad/s (sprocket and wheel alike)`,
        chain: 'edge of the sprocket (chain)',
        rim: 'rim of the wheel',
      },
      calc: { title: 'Working' },
      explain: {
        idle: 'Press Start. The chain pulls the edges of both sprockets at the same speed: z₁n₁ = z₂n₂. The rear sprocket and the wheel share one axle, so they have the same angular velocity.',
        low: (k, s) => `Low gear: one turn of the pedals turns the wheel only ${k} times and the bike covers ${s} m. Slow, but easy for climbing.`,
        mid: (k, s, kmh) => `One turn of the pedals turns the rear wheel z₁/z₂ = ${k} times, and the bike covers 2πR·${k} = ${s} m. Speed now: ${kmh} km/h.`,
        high: (k, s, kmh) => `High gear: each pedal turn spins the wheel ${k} times and the bike covers ${s} m — ${kmh} km/h. Pedalling gets harder.`,
      },
    },
  },
};

export default function RotationTransmission() {
  const T = useSimText(TEXT);
  const tabs = T.card.tabs;
  return (
    <SimCard
      idPrefix="transmission"
      eyebrow={T.card.eyebrow}
      title={T.card.title}
      tabsLabel={T.card.tabsLabel}
      tabs={[
        { id: 'belt', label: tabs.belt.label, sub: tabs.belt.sub, icon: Disc3, render: () => <BeltSim T={T} /> },
        { id: 'gears', label: tabs.gears.label, sub: tabs.gears.sub, icon: Cog, render: () => <GearSim T={T} /> },
        { id: 'bike', label: tabs.bike.label, sub: tabs.bike.sub, icon: Bike, render: () => <BikeSim T={T} /> },
      ]}
      facts={{ title: T.facts.title, items: T.facts.items.map((f) => ({ term: f.term, text: rich(f.text) })) }}
    />
  );
}
