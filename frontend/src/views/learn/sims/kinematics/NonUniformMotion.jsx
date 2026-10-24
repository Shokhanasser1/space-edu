import { useState } from 'react';
import { BookOpen, Equal, Gauge, Lightbulb, Route, Shuffle, Bus } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { useSimText } from '../kit/lang';
import { Chip, GroupLabel, LabScene, PlayControls, SideCar, SideRoad, lineView, niceMax, num, rulerStep, tickDigits } from './Acceleration.parts';
import CitySim from './NonUniformMotion.city';

/**
 * Lesson "Notekis harakat":
 *  1. average speed — a trip of two or three legs, each at its own speed;
 *     v(o'rtacha) = s(umumiy) / t(umumiy), which is NOT the arithmetic mean of
 *     the speeds unless the times are equal (shown with a distance ribbon and
 *     a time ribbon and with the s–t graph);
 *  2. instantaneous speed — a city bus with a speedometer, a red light and
 *     a v–t graph, next to the running average speed.
 * The lesson's example (100 km at 50 km/h + 100 km at 100 km/h → 200 km / 3 h
 * ≈ 66.7 km/h, not 75) is the first preset.
 */

const TEXT = {
  uz: {
    card: {
      eyebrow: 'Virtual laboratoriya · Kinematika',
      title: 'Notekis harakat',
      tabsLabel: 'Tajribani tanlang',
      tabs: {
        trip: { label: "O'rtacha tezlik", sub: 's(umumiy) / t(umumiy)' },
        city: { label: 'Oniy tezlik', sub: 'Spidometr' },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: 'Notekis harakat', text: "tezlik o'zgarib turadigan harakat: tezlashish, sekinlashish, to'xtash." },
        { term: "O'rtacha tezlik", text: "butun yo'lni butun vaqtga bo'lish: v(o'rtacha) = s(umumiy) / t(umumiy)." },
        { term: "O'rta arifmetik emas", text: "vaqtlar har xil bo'lsa, (v₁ + v₂) / 2 noto'g'ri javob beradi." },
        { term: 'Oniy tezlik', text: "ma'lum bir paytdagi tezlik — spidometr aynan shuni ko'rsatadi." },
      ],
    },
    trip: {
      presetsLabel: 'Sayohat',
      presets: {
        lesson: { name: 'Darslikdagi misol', sub: '100 km · 50 + 100 km · 100' },
        equal: { name: 'Teng vaqtlar', sub: '1 soat · 50 + 1 soat · 100' },
        three: { name: 'Uch bo‘lakli yo‘l', sub: 'shahar · trassa · qishloq' },
      },
      legsLabel: "Yo'l bo'laklari",
      countLabel: "Bo'laklar soni",
      leg: (i) => `${i}-bo'lak`,
      legTime: (h) => `vaqt ${h} soat`,
      dist: 'Uzunligi',
      speed: 'Tezligi',
      legend: { leg: "bo'lak chegarasi", car: 'avtomobil', sign: "bo'lakdagi tezlik" },
      chip: (k) => `Vaqt ×${k} tezlashtirilgan`,
      axisX: 's, km',
      start: 'A',
      finish: 'B',
      ribbonS: "Yo'l",
      ribbonT: 'Vaqt',
      kmTag: (d) => `${d} km`,
      hTag: (h) => `${h} soat`,
      speedTag: (v) => `${v} km/soat`,
      sceneLabel: (s, t) => `Yo'l yon tomondan. Bosib o'tilgan yo'l ${s} km, vaqt ${t} soat.`,
      readouts: { s: "Bosib o'tilgan yo'l", t: 'Vaqt', avg: "O'rtacha tezlik", mean: "Tezliklarning o'rta arifmetigi" },
      sSub: (s) => `jami ${s} km`,
      hm: (h, m) => `${h} soat ${m} min`,
      avgSub: (s, t) => `= ${s} km / ${t} soat`,
      meanSub: { wrong: "≠ o'rtacha tezlik — bu tuzoq!", right: "= o'rtacha tezlik (vaqtlar teng)", wait: 'oxirida solishtiramiz' },
      graph: {
        title: "Grafik: s(t) — yo'l va vaqt",
        trip: 's(t)',
        avg: "o'rtacha tezlik",
        mean: "o'rta arifmetik",
        t: 't, soat',
        s: 's, km',
        note: "Yashil chiziq B nuqtaga aniq boradi, uning qiyaligi — o'rtacha tezlik. Qizil chiziq (o'rta arifmetik) B ga tushmaydi.",
      },
      explain: {
        idle: "Har bo'lakning uzunligi va tezligini tanlang, so'ng «Boshlash»ni bosing. Diqqat qiling: har bo'lakka qancha VAQT ketadi?",
        leg: (i, d, v, h) => `${i}-bo'lak: ${d} km ni ${v} km/soat bilan — bunga ${h} soat ketadi.`,
        lower: (s, t, avg, mean) => `O'rtacha tezlik = ${s} km / ${t} soat ≈ ${avg} km/soat, ${mean} km/soat emas: sekin bo'lakda ko'proq vaqt o'tdi, shuning uchun u ko'proq «og'irlik» qiladi.`,
        equal: (avg) => `Bo'laklarga bir xil vaqt ketdi, shuning uchun bu safar o'rtacha tezlik o'rta arifmetikka teng: ${avg} km/soat. Faqat vaqtlar teng bo'lgandagina shunday bo'ladi.`,
        higher: (avg, mean) => `O'rtacha tezlik ${avg} km/soat — o'rta arifmetikdan (${mean} km/soat) katta: vaqtning ko'p qismi tez bo'lakda o'tdi.`,
      },
    },
    city: {
      scenariosLabel: 'Svetofor',
      scenarios: {
        green: { name: 'Yashil chiroq', sub: "to'xtamasdan o'tadi" },
        red10: { name: 'Qizil chiroq', sub: '10 s kutadi' },
        red25: { name: 'Uzoq qizil chiroq', sub: '25 s kutadi' },
      },
      legend: { v: 'oniy tezlik', marks: "har 4 s dagi o'rni", light: 'svetofor' },
      chip: 'Vaqt ×3 tezlashtirilgan',
      axisX: 'x, m',
      stopA: 'A',
      stopB: 'B',
      secTag: (s) => `${s} s`,
      speedTag: (v) => `${v} km/soat`,
      sceneLabel: (t, v, x) => `Shahar ko'chasi. t = ${t} s, avtobus tezligi ${v} km/soat, bekatdan ${x} m.`,
      readouts: { speedo: 'Spidometr — oniy tezlik', s: "Yo'l", t: 'Vaqt', avg: "O'rtacha tezlik" },
      speedoLabel: (v) => `Spidometr ${v} km/soat ko'rsatmoqda`,
      speedoSub: "binafsha belgi — o'rtacha tezlik",
      msSub: (ms) => `= ${ms} m/s`,
      sSub: "bekatlar orasi 432 m",
      tSub: 'real vaqtda ×3 tezroq',
      avgSub: (s, t) => `= ${s} m / ${t} s`,
      graph: {
        title: 'Grafik: v(t) — oniy va o‘rtacha tezlik',
        plan: 'butun yo‘l',
        live: 'oniy tezlik',
        avg: "o'rtacha tezlik",
        t: 't, s',
        v: 'v, km/soat',
        note: "Grafikni bosing yoki suring — istalgan paytdagi oniy tezlikni ko'rasiz.",
      },
      explain: {
        idle: "Avtobus A bekatda turibdi. «Boshlash»ni bosing: spidometr oniy tezlikni — aynan shu paytdagi tezlikni ko'rsatadi.",
        acc: "Avtobus tezlanmoqda: spidometr ko'rsatkichi har lahzada o'zgaryapti — bu oniy tezlik.",
        cruise: "Tezlik o'zgarmas — 43 km/soat. O'rtacha tezlik esa kichikroq: sekin boshlangan qism uni pastga tortyapti.",
        greenPass: "Yashil chiroq — avtobus to'xtamasdan o'tib ketmoqda.",
        brakeLight: "Qizil chiroq! Avtobus tormozlanmoqda — oniy tezlik nolgacha tushadi.",
        wait: "Avtobus turibdi: spidometr 0 ni ko'rsatadi, lekin vaqt o'tyapti — shuning uchun o'rtacha tezlik kamaymoqda.",
        brakeStop: 'B bekatga yaqinlashdi — tormozlanmoqda.',
        scrub: (t, v) => `t = ${t} s paytdagi oniy tezlik: ${v} km/soat.`,
        done: (s, t, ms, avg, max) => `Butun yo'l ${s} m, butun vaqt ${t} s: o'rtacha tezlik ${s} / ${t} = ${ms} m/s ≈ ${avg} km/soat. Eng katta oniy tezlik ${max} km/soat edi — o'rtacha undan ancha kichik.`,
      },
    },
  },
  ru: {
    card: {
      eyebrow: 'Виртуальная лаборатория · Кинематика',
      title: 'Неравномерное движение',
      tabsLabel: 'Выберите опыт',
      tabs: {
        trip: { label: 'Средняя скорость', sub: 's(общий) / t(общее)' },
        city: { label: 'Мгновенная скорость', sub: 'Спидометр' },
      },
    },
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Неравномерное движение', text: 'движение, при котором скорость меняется: разгон, торможение, остановки.' },
        { term: 'Средняя скорость', text: 'весь путь, делённый на всё время: v(средняя) = s(общий) / t(общее).' },
        { term: 'Не среднее арифметическое', text: 'если времена разные, (v₁ + v₂) / 2 даёт неверный ответ.' },
        { term: 'Мгновенная скорость', text: 'скорость в конкретный момент — именно её показывает спидометр.' },
      ],
    },
    trip: {
      presetsLabel: 'Поездка',
      presets: {
        lesson: { name: 'Пример из урока', sub: '100 км · 50 + 100 км · 100' },
        equal: { name: 'Равные времена', sub: '1 ч · 50 + 1 ч · 100' },
        three: { name: 'Дорога из трёх участков', sub: 'город · трасса · село' },
      },
      legsLabel: 'Участки пути',
      countLabel: 'Число участков',
      leg: (i) => `${i}-й участок`,
      legTime: (h) => `время ${h} ч`,
      dist: 'Длина',
      speed: 'Скорость',
      legend: { leg: 'граница участка', car: 'автомобиль', sign: 'скорость на участке' },
      chip: (k) => `Время ускорено ×${k}`,
      axisX: 's, км',
      start: 'A',
      finish: 'B',
      ribbonS: 'Путь',
      ribbonT: 'Время',
      kmTag: (d) => `${d} км`,
      hTag: (h) => `${h} ч`,
      speedTag: (v) => `${v} км/ч`,
      sceneLabel: (s, t) => `Дорога сбоку. Пройдено ${s} км, время ${t} ч.`,
      readouts: { s: 'Пройденный путь', t: 'Время', avg: 'Средняя скорость', mean: 'Среднее арифметическое скоростей' },
      sSub: (s) => `всего ${s} км`,
      hm: (h, m) => `${h} ч ${m} мин`,
      avgSub: (s, t) => `= ${s} км / ${t} ч`,
      meanSub: { wrong: '≠ средней скорости — это ловушка!', right: '= средней скорости (времена равны)', wait: 'сравним в конце' },
      graph: {
        title: 'График: s(t) — путь и время',
        trip: 's(t)',
        avg: 'средняя скорость',
        mean: 'среднее арифметическое',
        t: 't, ч',
        s: 's, км',
        note: 'Зелёная линия приходит точно в точку B, её наклон — средняя скорость. Красная (среднее арифметическое) в B не попадает.',
      },
      explain: {
        idle: 'Выберите длину и скорость каждого участка и нажмите «Старт». Обратите внимание: сколько ВРЕМЕНИ уходит на каждый участок?',
        leg: (i, d, v, h) => `${i}-й участок: ${d} км со скоростью ${v} км/ч — на него уходит ${h} ч.`,
        lower: (s, t, avg, mean) => `Средняя скорость = ${s} км / ${t} ч ≈ ${avg} км/ч, а не ${mean} км/ч: на медленном участке прошло больше времени, поэтому он «весит» больше.`,
        equal: (avg) => `На участки ушло одинаковое время, поэтому здесь средняя скорость равна среднему арифметическому: ${avg} км/ч. Так бывает только при равных временах.`,
        higher: (avg, mean) => `Средняя скорость ${avg} км/ч — больше среднего арифметического (${mean} км/ч): бо́льшая часть времени прошла на быстром участке.`,
      },
    },
    city: {
      scenariosLabel: 'Светофор',
      scenarios: {
        green: { name: 'Зелёный свет', sub: 'проезжает без остановки' },
        red10: { name: 'Красный свет', sub: 'ждёт 10 с' },
        red25: { name: 'Долгий красный', sub: 'ждёт 25 с' },
      },
      legend: { v: 'мгновенная скорость', marks: 'положение через каждые 4 с', light: 'светофор' },
      chip: 'Время ускорено ×3',
      axisX: 'x, м',
      stopA: 'A',
      stopB: 'B',
      secTag: (s) => `${s} с`,
      speedTag: (v) => `${v} км/ч`,
      sceneLabel: (t, v, x) => `Городская улица. t = ${t} с, скорость автобуса ${v} км/ч, от остановки ${x} м.`,
      readouts: { speedo: 'Спидометр — мгновенная скорость', s: 'Путь', t: 'Время', avg: 'Средняя скорость' },
      speedoLabel: (v) => `Спидометр показывает ${v} км/ч`,
      speedoSub: 'фиолетовая метка — средняя скорость',
      msSub: (ms) => `= ${ms} м/с`,
      sSub: 'между остановками 432 м',
      tSub: 'в 3 раза быстрее реального',
      avgSub: (s, t) => `= ${s} м / ${t} с`,
      graph: {
        title: 'График: v(t) — мгновенная и средняя скорость',
        plan: 'вся поездка',
        live: 'мгновенная скорость',
        avg: 'средняя скорость',
        t: 't, с',
        v: 'v, км/ч',
        note: 'Нажмите на график или проведите по нему — увидите мгновенную скорость в любой момент.',
      },
      explain: {
        idle: 'Автобус стоит на остановке A. Нажмите «Старт»: спидометр показывает мгновенную скорость — скорость именно в этот момент.',
        acc: 'Автобус разгоняется: стрелка спидометра меняется каждое мгновение — это мгновенная скорость.',
        cruise: 'Скорость постоянна — 43 км/ч. А средняя скорость меньше: медленный разгон тянет её вниз.',
        greenPass: 'Зелёный свет — автобус проезжает без остановки.',
        brakeLight: 'Красный свет! Автобус тормозит — мгновенная скорость падает до нуля.',
        wait: 'Автобус стоит: спидометр показывает 0, но время идёт — поэтому средняя скорость уменьшается.',
        brakeStop: 'Подъезжает к остановке B — тормозит.',
        scrub: (t, v) => `Мгновенная скорость в момент t = ${t} с: ${v} км/ч.`,
        done: (s, t, ms, avg, max) => `Весь путь ${s} м, всё время ${t} с: средняя скорость ${s} / ${t} = ${ms} м/с ≈ ${avg} км/ч. Наибольшая мгновенная скорость была ${max} км/ч — средняя гораздо меньше.`,
      },
    },
  },
  en: {
    card: {
      eyebrow: 'Virtual lab · Kinematics',
      title: 'Non-uniform motion',
      tabsLabel: 'Choose an experiment',
      tabs: {
        trip: { label: 'Average speed', sub: 's(total) / t(total)' },
        city: { label: 'Instantaneous speed', sub: 'Speedometer' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Run again', reset: 'Reset' },
    facts: {
      title: 'Remember',
      items: [
        { term: 'Non-uniform motion', text: 'motion in which the speed changes: speeding up, slowing down, stopping.' },
        { term: 'Average speed', text: 'the whole distance divided by the whole time: v(average) = s(total) / t(total).' },
        { term: 'Not the arithmetic mean', text: 'when the times differ, (v₁ + v₂) / 2 gives the wrong answer.' },
        { term: 'Instantaneous speed', text: 'the speed at one particular moment — exactly what a speedometer shows.' },
      ],
    },
    trip: {
      presetsLabel: 'Trip',
      presets: {
        lesson: { name: 'Lesson example', sub: '100 km · 50 + 100 km · 100' },
        equal: { name: 'Equal times', sub: '1 h · 50 + 1 h · 100' },
        three: { name: 'Three-leg road', sub: 'town · highway · village' },
      },
      legsLabel: 'Legs of the trip',
      countLabel: 'Number of legs',
      leg: (i) => `Leg ${i}`,
      legTime: (h) => `time ${h} h`,
      dist: 'Length',
      speed: 'Speed',
      legend: { leg: 'leg boundary', car: 'car', sign: 'speed on the leg' },
      chip: (k) => `Time sped up ×${k}`,
      axisX: 's, km',
      start: 'A',
      finish: 'B',
      ribbonS: 'Distance',
      ribbonT: 'Time',
      kmTag: (d) => `${d} km`,
      hTag: (h) => `${h} h`,
      speedTag: (v) => `${v} km/h`,
      sceneLabel: (s, t) => `The road from the side. Distance covered ${s} km, time ${t} h.`,
      readouts: { s: 'Distance covered', t: 'Time', avg: 'Average speed', mean: 'Arithmetic mean of the speeds' },
      sSub: (s) => `${s} km in total`,
      hm: (h, m) => `${h} h ${m} min`,
      avgSub: (s, t) => `= ${s} km / ${t} h`,
      meanSub: { wrong: '≠ average speed — that is the trap!', right: '= average speed (equal times)', wait: 'we compare at the end' },
      graph: {
        title: 'Graph: s(t) — distance and time',
        trip: 's(t)',
        avg: 'average speed',
        mean: 'arithmetic mean',
        t: 't, h',
        s: 's, km',
        note: 'The green line ends exactly at B; its slope is the average speed. The red one (arithmetic mean) misses B.',
      },
      explain: {
        idle: 'Choose the length and speed of each leg, then press Start. Watch closely: how much TIME does each leg take?',
        leg: (i, d, v, h) => `Leg ${i}: ${d} km at ${v} km/h — that takes ${h} h.`,
        lower: (s, t, avg, mean) => `Average speed = ${s} km / ${t} h ≈ ${avg} km/h, not ${mean} km/h: more time was spent on the slow leg, so it counts for more.`,
        equal: (avg) => `Both legs took the same time, so this time the average speed equals the arithmetic mean: ${avg} km/h. That only happens when the times are equal.`,
        higher: (avg, mean) => `The average speed, ${avg} km/h, is above the arithmetic mean (${mean} km/h): most of the time was spent on the fast leg.`,
      },
    },
    city: {
      scenariosLabel: 'Traffic light',
      scenarios: {
        green: { name: 'Green light', sub: 'drives straight through' },
        red10: { name: 'Red light', sub: 'waits 10 s' },
        red25: { name: 'Long red light', sub: 'waits 25 s' },
      },
      legend: { v: 'instantaneous speed', marks: 'position every 4 s', light: 'traffic light' },
      chip: 'Time sped up ×3',
      axisX: 'x, m',
      stopA: 'A',
      stopB: 'B',
      secTag: (s) => `${s} s`,
      speedTag: (v) => `${v} km/h`,
      sceneLabel: (t, v, x) => `A city street. t = ${t} s, bus speed ${v} km/h, ${x} m from the stop.`,
      readouts: { speedo: 'Speedometer — instantaneous speed', s: 'Distance', t: 'Time', avg: 'Average speed' },
      speedoLabel: (v) => `The speedometer reads ${v} km/h`,
      speedoSub: 'violet mark — average speed',
      msSub: (ms) => `= ${ms} m/s`,
      sSub: 'the stops are 432 m apart',
      tSub: 'shown 3 times faster',
      avgSub: (s, t) => `= ${s} m / ${t} s`,
      graph: {
        title: 'Graph: v(t) — instantaneous and average speed',
        plan: 'whole trip',
        live: 'instantaneous speed',
        avg: 'average speed',
        t: 't, s',
        v: 'v, km/h',
        note: 'Click or drag along the graph to see the instantaneous speed at any moment.',
      },
      explain: {
        idle: 'The bus waits at stop A. Press Start: the speedometer shows the instantaneous speed — the speed at this very moment.',
        acc: 'The bus is speeding up: the speedometer needle changes every instant — that is the instantaneous speed.',
        cruise: 'Steady speed — 43 km/h. The average speed is lower: the slow start pulls it down.',
        greenPass: 'Green light — the bus drives straight through.',
        brakeLight: 'Red light! The bus brakes — the instantaneous speed drops to zero.',
        wait: 'The bus is standing: the speedometer reads 0, but the clock keeps running — so the average speed keeps falling.',
        brakeStop: 'Approaching stop B — braking.',
        scrub: (t, v) => `Instantaneous speed at t = ${t} s: ${v} km/h.`,
        done: (s, t, ms, avg, max) => `Whole distance ${s} m, whole time ${t} s: average speed ${s} / ${t} = ${ms} m/s ≈ ${avg} km/h. The top instantaneous speed was ${max} km/h — the average is much lower.`,
      },
    },
  },
};

/* ================================================================= card */

export default function NonUniformMotion() {
  const T = useSimText(TEXT);
  const tabs = [
    { id: 'trip', ...T.card.tabs.trip, icon: Route, render: () => <TripSim T={T} /> },
    { id: 'city', ...T.card.tabs.city, icon: Gauge, render: () => <CitySim T={T} /> },
  ];
  return <SimCard eyebrow={T.card.eyebrow} title={T.card.title} tabsLabel={T.card.tabsLabel} tabs={tabs} facts={T.facts} icon={Bus} idPrefix="nonu" />;
}

/* ========================================================= average speed */

const LEG_COLORS = ['#7c3aed', '#0891b2', '#d97706'];
const LEG_TEXT = ['#c4b5fd', '#67e8f9', '#fcd34d'];
const TRIPS = {
  lesson: { legs: [{ d: 100, v: 50 }, { d: 100, v: 100 }], icon: BookOpen },
  equal: { legs: [{ d: 50, v: 50 }, { d: 100, v: 100 }], icon: Equal },
  three: { legs: [{ d: 30, v: 60 }, { d: 90, v: 90 }, { d: 20, v: 40 }], icon: Shuffle },
};
const EXTRA_LEG = { d: 50, v: 60 };
const IDLE = { t: 0, running: false, done: false };

/** Trims a number to at most `max` decimals: 2 → "2", 1.5 → "1.5", 4/3 → "1.33". */
function trim(n, dec, max = 2) {
  for (let k = 0; k <= max; k += 1) {
    if (Math.abs(n * 10 ** k - Math.round(n * 10 ** k)) < 1e-9) return fmt(n, k, dec);
  }
  return fmt(n, max, dec);
}

function tripState(legs, t) {
  let t0 = 0;
  let s0 = 0;
  for (let i = 0; i < legs.length; i += 1) {
    const dt = legs[i].d / legs[i].v;
    if (t <= t0 + dt + 1e-12 || i === legs.length - 1) {
      const tau = clamp(t - t0, 0, dt);
      return { leg: i, s: s0 + legs[i].v * tau, v: legs[i].v };
    }
    t0 += dt;
    s0 += legs[i].d;
  }
  return { leg: 0, s: 0, v: legs[0].v };
}

function TripSim({ T }) {
  const L = T.trip;
  const dec = T.decimal;
  const [legs, setLegs] = useState(TRIPS.lesson.legs);
  const [sim, setSim] = useState(IDLE);
  const times = legs.map((l) => l.d / l.v);
  const tTot = times.reduce((a, b) => a + b, 0);
  const sTot = legs.reduce((a, l) => a + l.d, 0);
  const avg = sTot / tTot;
  const mean = legs.reduce((a, l) => a + l.v, 0) / legs.length;
  const realDur = clamp(tTot * 3, 6, 14);
  const rate = tTot / realDur; // hours of trip per second on screen
  const speedUp = Math.round(rate * 3600);
  const preset = Object.keys(TRIPS).find((k) => JSON.stringify(TRIPS[k].legs) === JSON.stringify(legs)) ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tTot, p.t + dt * rate);
      const done = t >= tTot - 1e-12;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    setLegs(TRIPS[id].legs);
    setSim(IDLE);
  };
  const setLeg = (i, field, value) => {
    setLegs((ls) => ls.map((l, j) => (j === i ? { ...l, [field]: value } : l)));
    setSim(IDLE);
  };
  const setCount = (n) => {
    setLegs((ls) => (n > ls.length ? [...ls, EXTRA_LEG] : ls.slice(0, n)));
    setSim(IDLE);
  };

  const t = sim.t;
  const st = tripState(legs, t);
  const s = st.s;
  const F = (n, k = 1) => num(n, k, dec);
  const equalTimes = Math.abs(avg - mean) < 0.05;

  let key = 'idle';
  if (sim.done) key = equalTimes ? 'equal' : avg < mean ? 'lower' : 'higher';
  else if (t > 0) key = `leg${st.leg}`;
  const settled = useSettled(key, 0);
  const ex = L.explain;
  let text = ex.idle;
  if (settled === 'lower') text = ex.lower(fmt(sTot, 0, dec), trim(tTot, dec), F(avg), trim(mean, dec, 1));
  else if (settled === 'equal') text = ex.equal(trim(avg, dec, 1));
  else if (settled === 'higher') text = ex.higher(F(avg), F(mean));
  else if (settled.startsWith('leg')) {
    const i = Number(settled.slice(3));
    if (legs[i]) text = ex.leg(i + 1, fmt(legs[i].d, 0, dec), fmt(legs[i].v, 0, dec), trim(times[i], dec));
  }
  const tone = settled === 'idle' ? '#22d3ee' : settled === 'equal' ? '#34d399' : settled === 'lower' || settled === 'higher' ? '#34d399' : LEG_TEXT[st.leg];

  /* s–t graph */
  const tripPts = [{ x: 0, y: 0 }];
  {
    let tc = 0;
    let sc = 0;
    for (let i = 0; i < legs.length; i += 1) {
      const tn = tc + times[i];
      if (t >= tn) {
        sc += legs[i].d;
        tripPts.push({ x: tn, y: sc });
      } else {
        if (t > tc) tripPts.push({ x: t, y: s });
        break;
      }
      tc = tn;
    }
  }
  const xMax = niceMax(tTot);
  const yMax = niceMax(Math.max(sTot, mean * tTot));
  const hours = Math.floor(t + 1e-9);
  const minutes = Math.round((t - hours) * 60);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={preset}
            onChange={pick}
            options={Object.keys(TRIPS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: TRIPS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <TripScene T={T} legs={legs} times={times} tTot={tTot} sTot={sTot} t={t} s={s} st={st} speedUp={speedUp} running={sim.running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.s} symbol="s" value={F(s)} unit={T.km} accent={PALETTE.path} textColor={PALETTE.pathText} sub={L.sSub(fmt(sTot, 0, dec))} />
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 2, dec)} unit={T.h} accent={PALETTE.time} textColor="#a5f3fc" sub={L.hm(hours, minutes === 60 ? 59 : minutes)} />
        <Readout
          label={L.readouts.avg}
          symbol="s/t"
          value={t > 0 ? F(s / t) : '—'}
          unit={T.kmh}
          accent="#34d399"
          textColor="#6ee7b7"
          sub={t > 0 ? L.avgSub(F(s), fmt(t, 2, dec)) : ' '}
          active={sim.done}
        />
        <Readout
          label={L.readouts.mean}
          value={trim(mean, dec, 1)}
          unit={T.kmh}
          accent={equalTimes ? '#34d399' : '#f87171'}
          textColor={sim.done ? (equalTimes ? '#6ee7b7' : '#fca5a5') : '#e5e7eb'}
          sub={sim.done ? (equalTimes ? L.meanSub.right : L.meanSub.wrong) : L.meanSub.wait}
          active={sim.done}
        >
          <p className="mt-1 text-xs tabular-nums text-gray-500">
            ({legs.map((l) => fmt(l.v, 0, dec)).join(' + ')}) / {legs.length}
          </p>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-200">{L.legsLabel}</p>
            <Segmented
              label={L.countLabel}
              className="grid-cols-2 w-[112px]"
              value={legs.length}
              onChange={setCount}
              options={[
                { value: 2, label: '2' },
                { value: 3, label: '3' },
              ]}
            />
          </div>
          {legs.map((l, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3" style={{ borderLeft: `4px solid ${LEG_COLORS[i]}` }}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold" style={{ color: LEG_TEXT[i] }}>
                  {L.leg(i + 1)}
                </span>
                <span className="tabular-nums text-gray-300">{L.legTime(trim(times[i], dec))}</span>
              </div>
              <RangeField
                id={`nu-d${i}`}
                label={L.dist}
                min={10}
                max={200}
                step={10}
                value={l.d}
                onChange={(n) => setLeg(i, 'd', n)}
                accent={LEG_COLORS[i]}
                display={`${fmt(l.d, 0, dec)} ${T.km}`}
              />
              <RangeField
                id={`nu-v${i}`}
                label={L.speed}
                min={10}
                max={120}
                step={5}
                value={l.v}
                onChange={(n) => setLeg(i, 'v', n)}
                accent={LEG_COLORS[i]}
                display={`${fmt(l.v, 0, dec)} ${T.kmh}`}
              />
            </div>
          ))}
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={[
              { id: 'mean', label: L.graph.mean, color: '#f87171', points: [{ x: 0, y: 0 }, { x: tTot, y: mean * tTot }], dash: '5 5' },
              { id: 'avg', label: L.graph.avg, color: '#34d399', points: [{ x: 0, y: 0 }, { x: tTot, y: sTot }], dash: '5 5' },
              { id: 'trip', label: L.graph.trip, color: '#a78bfa', points: tripPts },
            ]}
            xMax={xMax}
            yMax={yMax}
            xLabel={L.graph.t}
            yLabel={L.graph.s}
            marker={t}
            note={L.graph.note}
            decimal={dec}
            xDigits={tickDigits(xMax)}
            yDigits={tickDigits(yMax)}
            height={250}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function SpeedSign({ x, y, r, value }) {
  return (
    <g aria-hidden="true">
      <rect x={x - 1.5} y={y} width={3} height={r * 2.4} fill="#64748b" />
      <circle cx={x} cy={y} r={r} fill="#fff" stroke="#dc2626" strokeWidth={Math.max(2.5, r * 0.22)} />
      <text x={x} y={y + r * 0.36} textAnchor="middle" fontSize={r * (value >= 100 ? 0.82 : 0.95)} fontWeight="800" fill="#0f172a">
        {value}
      </text>
    </g>
  );
}

function TripScene({ T, legs, times, tTot, sTot, t, s, st, speedUp, running }) {
  const L = T.trip;
  const dec = T.decimal;
  return (
    <LabScene
      legend={[
        { color: LEG_COLORS[0], label: L.legend.leg, kind: 'line' },
        { color: '#dc2626', label: L.legend.sign, kind: 'ring' },
      ]}
      chips={<Chip>{L.chip(speedUp)}</Chip>}
      height={(W, narrow) => (narrow ? 270 : 292)}
      ariaLabel={L.sceneLabel(num(s, 1, dec), fmt(t, 2, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const carLen = narrow ? 52 : 74;
        const padL = Math.max(carLen + 14, narrow ? 64 : 84);
        const padR = narrow ? 18 : 30;
        const view = lineView(0, sTot, W, padL, padR);
        const step = rulerStep(view, narrow ? 44 : 64);
        const roadY = H - (narrow ? 108 : 116);
        const carY = roadY + 4;
        const front = view.sx(s);
        const box = { w: W, h: H };
        const ribS = H - (narrow ? 58 : 64);
        const ribT = ribS + (narrow ? 26 : 30);
        const ribH = narrow ? 18 : 22;
        const x0 = view.sx(0);
        const span = view.sx(sTot) - x0;
        const bounds = [];
        let acc = 0;
        let tacc = 0;
        legs.forEach((l, i) => {
          bounds.push({ i, s0: acc, s1: acc + l.d, t0: tacc, t1: tacc + times[i] });
          acc += l.d;
          tacc += times[i];
        });
        const tPx = (tt) => x0 + (tt / tTot) * span;
        const signR = narrow ? 11 : 14;
        const pillText = L.speedTag(fmt(st.v, 0, dec));
        const ribbon = (y, which) =>
          bounds.map((b) => {
            const xa = which === 's' ? view.sx(b.s0) : tPx(b.t0);
            const xb = which === 's' ? view.sx(b.s1) : tPx(b.t1);
            const done = which === 's' ? Math.min(Math.max(s - b.s0, 0), b.s1 - b.s0) / (b.s1 - b.s0) : Math.min(Math.max(t - b.t0, 0), b.t1 - b.t0) / (b.t1 - b.t0);
            const label = which === 's' ? L.kmTag(fmt(legs[b.i].d, 0, dec)) : L.hTag(trim(times[b.i], dec));
            const fits = xb - xa > textWidth(label, fs - 1, 700) + 10;
            return (
              <g key={`${which}${b.i}`}>
                <rect x={xa + 1} y={y} width={Math.max(0, xb - xa - 2)} height={ribH} rx={5} fill={LEG_COLORS[b.i]} opacity={0.22} />
                <rect x={xa + 1} y={y} width={Math.max(0, (xb - xa - 2) * done)} height={ribH} rx={5} fill={LEG_COLORS[b.i]} opacity={0.9} />
                {fits && (
                  <text x={(xa + xb) / 2} y={y + ribH / 2 + 4} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill={done > 0.5 ? '#fff' : '#334155'} className="tabular-nums">
                    {label}
                  </text>
                )}
              </g>
            );
          });
        return (
          <>
            <SideRoad view={view} W={W} H={H} roadY={roadY} step={step} unit={L.axisX} decimal={dec} fs={fs - 1} trees={!narrow} />
            {/* legs along the near edge of the road */}
            {bounds.map((b) => (
              <g key={`leg${b.i}`}>
                <line x1={view.sx(b.s0) + 1} x2={view.sx(b.s1) - 1} y1={roadY + 10} y2={roadY + 10} stroke={LEG_COLORS[b.i]} strokeWidth={5} strokeLinecap="round" />
                <SpeedSign x={view.sx(b.s0) + signR + 4} y={roadY - 12 - signR * 2.4} r={signR} value={legs[b.i].v} />
                {b.i > 0 && <line x1={view.sx(b.s0)} x2={view.sx(b.s0)} y1={roadY - 12} y2={roadY + 14} stroke="#334155" strokeWidth={1.5} strokeDasharray="3 3" />}
              </g>
            ))}
            {/* start and finish */}
            {[
              [0, L.start],
              [sTot, L.finish],
            ].map(([xx, lbl]) => (
              <g key={lbl}>
                <line x1={view.sx(xx)} x2={view.sx(xx)} y1={roadY - 44} y2={roadY + 10} stroke={PALETTE.ink} strokeWidth={2} />
                <path d={`M${view.sx(xx)},${roadY - 44} l${xx === 0 ? -18 : 18},6 l${xx === 0 ? 18 : -18},6 Z`} fill={PALETTE.ink} />
                <text x={view.sx(xx) + (xx === 0 ? -10 : 10)} y={roadY - 48} textAnchor="middle" fontSize={fs + 1} fontWeight="800" fill={PALETTE.ink}>
                  {lbl}
                </text>
              </g>
            ))}
            <SideCar front={front} y={carY} len={carLen} color="#2563eb" dist={s * 40} />
            {t > 0 && <Pill x={front - carLen / 2} y={carY - carLen * 0.48 - 16} text={pillText} bg={LEG_COLORS[st.leg]} size={fs} box={box} />}
            {running && <circle cx={front - carLen / 2} cy={carY - carLen * 0.25} r={carLen * 0.36} fill="#2563eb" className="cl-pulse" opacity="0.25" />}
            {/* distance ribbon and time ribbon */}
            <rect x={0} y={ribS - 8} width={W} height={H - ribS + 8} fill="#f8fafc" />
            <text x={x0 - 8} y={ribS + ribH / 2 + 4} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
              {L.ribbonS}
            </text>
            <text x={x0 - 8} y={ribT + ribH / 2 + 4} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
              {L.ribbonT}
            </text>
            {ribbon(ribS, 's')}
            {ribbon(ribT, 't')}
            {t > 0 && (
              <>
                <line x1={front} x2={front} y1={ribS - 3} y2={ribS + ribH + 3} stroke={PALETTE.ink} strokeWidth={2} />
                <line x1={tPx(t)} x2={tPx(t)} y1={ribT - 3} y2={ribT + ribH + 3} stroke={PALETTE.ink} strokeWidth={2} />
              </>
            )}
          </>
        );
      }}
    </LabScene>
  );
}
