import { useState } from 'react';
import { ArrowDownToLine, Gauge, Lightbulb, OctagonMinus, TrendingDown, TrendingUp, Equal } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { Arrow, Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { useSimText } from '../kit/lang';
import { Chip, GroupLabel, LabScene, PlayControls, Rich, SideCar, SideRoad, StrobeMarks, lineView, niceMax, num, rulerStep, signed, tickDigits } from './Acceleration.parts';
import BrakeSim from './Acceleration.brake';
import FallSim from './Acceleration.fall';

/**
 * Lesson "Tekis tezlanuvchan harakat. Tezlanish. Oniy tezlik":
 *  1. acceleration — a car with velocity and acceleration arrows; every second
 *     the velocity changes by a (v = v₀ + a·t, a = (v − v₀)/t);
 *  2. braking — a against v, the car stops at t = v₀/|a|; the signs depend on
 *     the chosen axis;
 *  3. free fall — a ball's speed grows by 9.8 m/s every second.
 * The lesson's example (0 → 20 m/s in 8 s, a = 2.5 m/s², v(3 s) = 7.5 m/s)
 * is the first preset.
 */

const TEXT = {
  uz: {
    card: {
      eyebrow: 'Virtual laboratoriya · Kinematika',
      title: 'Tekis tezlanuvchan harakat. Tezlanish',
      tabsLabel: 'Tajribani tanlang',
      tabs: {
        accel: { label: 'Tezlanish', sub: 'v = v₀ + a·t' },
        brake: { label: 'Tormozlanish', sub: 'a tezlikka qarshi' },
        fall: { label: 'Erkin tushish', sub: 'g ≈ 9.8 m/s²' },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: 'Tezlanish a', text: "tezlik bir sekundda qanchaga o'zgarishini ko'rsatadi: a = (v − v₀) / t, birligi m/s²." },
        { term: 'Tekis tezlanuvchan harakat', text: "a o'zgarmaydi, istalgan paytdagi tezlik v = v₀ + a·t." },
        { term: 'Oniy tezlik', text: "ma'lum bir paytdagi tezlik; v = v₀ + a·t aynan shu paytdagi tezlikni beradi." },
        { term: 'Sekinlashish', text: "a tezlikka qarama-qarshi yo'nalgan, tanlangan o'qda a manfiy chiqadi. Erkin tushishda a ≈ 9.8 m/s²." },
      ],
    },
    accel: {
      presetsLabel: 'Tayyor holatlar',
      presets: {
        lesson: { name: 'Darslikdagi misol', sub: '0 → 20 m/s · 8 s' },
        faster: { name: 'Tezlashish', sub: 'v₀ = 10 m/s · a = 1 m/s²' },
        slower: { name: 'Sekinlashish', sub: 'v₀ = 15 m/s · a = −1.5 m/s²' },
      },
      v0: "Boshlang'ich tezlik",
      a: 'Tezlanish',
      kmh: (k) => `≈ ${k} km/soat`,
      aHint: {
        pos: "Musbat: harakat yo'nalishida — avtomobil tezlashadi",
        zero: "Nol: tezlik o'zgarmaydi",
        neg: 'Manfiy: harakatga qarshi — avtomobil sekinlashadi',
      },
      legend: { v: 'tezlik v', a: 'tezlanish a', marks: 'har butun sekunddagi tezlik' },
      chipReal: 'Real vaqt',
      axisX: 'x, m',
      sceneLabel: (t, v, a) => `Avtomobil yon tomondan. t = ${t} s, tezlik ${v} m/s, tezlanish ${a} m/s².`,
      vTag: (v) => `v = ${v} m/s`,
      aTag: (a) => `a = ${a} m/s²`,
      secTag: (n) => `${n} s`,
      stopTag: "to'xtadi",
      readouts: { t: 'Vaqt', v: 'Oniy tezlik', a: 'Tezlanish', formula: 'Formulalar sonlar bilan' },
      tSub: (end) => `Tajriba ${end} s davom etadi`,
      aSub: (d) => `har sekundda tezlik ${d} m/s ga o'zgaradi`,
      aStopped: 'to‘xtagach a = 0',
      ladder: {
        title: 'Tezlik zinapoyasi: har sekunddagi v',
        t: 't, s',
        v: 'v, m/s',
        label: 'Har butun sekunddagi tezlik diagrammasi',
        note: (d) => `Har sekundda tezlik bir xil — ${d} m/s ga o'zgaradi. Tezlanish o'zgarmasligining ma'nosi shu.`,
      },
      explain: {
        idle: "v₀ va a ni tanlang, so'ng «Boshlash»ni bosing. Yashil strelka — tezlik v, to'q sariq — tezlanish a. Har sekundda tezlik a ga o'zgaradi.",
        speeding: (d) => `a va v bir tomonga yo'nalgan — avtomobil tezlashmoqda: har sekundda v ${d} m/s ga oshadi.`,
        uniform: (v) => `a = 0: tezlik o'zgarmaydi, doim v = ${v} m/s. Bu — tekis harakat.`,
        slowing: (d) => `a tezlikka qarshi yo'nalgan — avtomobil sekinlashmoqda: har sekundda v ${d} m/s ga kamayadi. O'qimizda a manfiy.`,
        lesson3: 't = 3 s: v = 0 + 2.5 · 3 = 7.5 m/s — darslikdagi misoldagi oniy tezlik.',
        done: (v0, v, t, a) => `${t} s ichida tezlik ${v0} dan ${v} m/s gacha o'zgardi: a = (v − v₀) / t = (${v} − ${v0}) / ${t} = ${a} m/s².`,
        stopped: (t) => `v = 0: avtomobil ${t} s da to'xtadi. Endi tormoz uni joyida ushlab turadi — «Tormozlanish» tajribasini ko'ring.`,
        atRest: "Avtomobil joyida turibdi, a esa manfiy: turgan avtomobilni tormozlab bo'lmaydi. v₀ ni oshiring yoki a ni musbat qiling.",
      },
    },
    brake: {
      presetsLabel: 'Tormozlash',
      presets: {
        soft: { name: 'Silliq tormozlash', sub: '20 m/s → 0 · |a| = 2.5 m/s²' },
        hard: { name: 'Keskin tormozlash', sub: '20 m/s → 0 · |a| = 5 m/s²' },
      },
      v0: 'Tormozlashdan oldingi tezlik',
      dec: 'Sekinlanish |a|',
      kmh: (k) => `≈ ${k} km/soat`,
      decHint: "Silliq to'xtash ≈ 2–3 m/s² · quruq asfaltda favqulodda tormoz ≈ 7 m/s²",
      axisLabel: "x o'qining yo'nalishi",
      axes: {
        right: { name: "O'q → (harakat bo'ylab)", sub: 'v > 0, a < 0' },
        left: { name: "O'q ← (harakatga qarshi)", sub: 'v < 0, a > 0' },
      },
      legend: { v: 'tezlik v', a: 'tezlanish a', axis: "tanlangan x o'qi", marks: "har 1 s dagi o'rni" },
      chipReal: 'Real vaqt',
      chipFast: (k) => `Vaqt ×${k} tezlashtirilgan`,
      axisX: 'x, m',
      sceneLabel: (t, v, a) => `Tormozlanayotgan avtomobil. t = ${t} s, o'qdagi tezlik ${v} m/s, tezlanish ${a} m/s².`,
      vTag: (v) => `v = ${v} m/s`,
      aTag: (a) => `a = ${a} m/s²`,
      secTag: (n) => `${n} s`,
      stopTag: (t) => `to'xtadi · t = ${t} s`,
      readouts: { t: 'Vaqt', v: "O'qdagi tezlik", a: "O'qdagi tezlanish", stop: "To'xtash vaqti" },
      vSub: (k) => `tezlik ≈ ${k} km/soat`,
      aSub: 'tezlikka qarama-qarshi',
      aStopped: 'to‘xtagach a = 0',
      stopSub: (v0, a) => `t = v₀ / |a| = ${v0} / ${a}`,
      formula: {
        tag: "Qachon to'xtaydi?",
        general: '0 = v₀ + a·t  ⇒  t = −v₀ / a',
        filled: (v0, a, t) => `t = −(${v0}) / (${a}) = ${t} s`,
      },
      graph: {
        title: "Grafik: tanlangan o'qda v(t)",
        plan: 'v = v₀ + a·t',
        live: 'harakat',
        stop: "to'xtash",
        t: 't, s',
        v: 'v, m/s',
        note: "Chiziq nolga yetgan payt — to'xtash payti. O'q chapga qaratilsa, xuddi shu harakat noldan pastda chiziladi.",
      },
      explain: {
        idle: "Haydovchi tormozni bosdi. Tezlanish (to'q sariq) orqaga — tezlikka (yashil) qarshi yo'nalgan. «Boshlash»ni bosing.",
        right: (d) => `Tezlik har sekundda ${d} m/s ga kamaymoqda. O'q harakat bo'ylab yo'nalgan: v musbat, a esa manfiy (a = −${d} m/s²).`,
        left: (d) => `O'q chapga qaratilgan, shuning uchun ishoralar almashdi: v manfiy, a = +${d} m/s². Avtomobil baribir sekinlashmoqda — muhimi, a tezlikka qarama-qarshi.`,
        stopped: (t, v0, a) => `v = 0, t = v₀ / |a| = ${v0} / ${a} = ${t} s. Endi tormoz avtomobilni joyida ushlab turadi.`,
      },
    },
    fall: {
      heightLabel: 'Tashlash balandligi',
      heights: {
        h20: { name: '20 m', sub: '≈ 6 qavatli uy' },
        h45: { name: '45 m', sub: '≈ 15 qavat' },
        h80: { name: '80 m', sub: 'minora' },
      },
      legend: { v: 'tezlik v', g: 'tezlanish g', strobe: "har 1 s dagi o'rni" },
      chipSlow: 'Vaqt 2 marta sekinlashtirilgan',
      sceneLabel: (t, v, y) => `Minoradan tushayotgan shar. t = ${t} s, tezlik ${v} m/s, balandlik ${y} m.`,
      vTag: (v) => `v = ${v} m/s`,
      gTag: 'g = 9.8 m/s²',
      ground: 'Yer',
      heightAxis: 'h, m',
      secTag: (n) => `${n} s`,
      readouts: { t: 'Vaqt', v: 'Tezlik', h: 'Yerdan balandlik', g: 'Tezlanish' },
      vSub: (k) => `≈ ${k} km/soat`,
      hSub: (d) => `${d} m tushdi`,
      gSub: 'har paytda bir xil',
      ladder: {
        title: 'Har sekunddagi tezlik',
        row: (n) => `t = ${n} s`,
        land: (t) => `yerga tegdi · ${t} s`,
        note: 'Har sekundda tezlik bir xil — 9.8 m/s ga oshadi. Bu — erkin tushish tezlanishi.',
      },
      explain: {
        idle: "Shar tinch holatdan qo'yib yuboriladi (v₀ = 0). Havo qarshiligini hisobga olmaymiz. «Boshlash»ni bosing va har sekunddagi tezlikni kuzating.",
        first: 'Shar tinch holatdan boshlaydi — Yerning tortishi uni darhol tezlashtiradi.',
        falling: (n, v) => `${n} s dan keyin: v = 9.8 · ${n} = ${v} m/s. Har sekundda tezlik 9.8 m/s ga oshadi.`,
        landed: (t, v) => `Shar ${t} s dan keyin yerga tegdi, tezligi v = 9.8 · ${t} ≈ ${v} m/s.`,
      },
    },
  },
  ru: {
    card: {
      eyebrow: 'Виртуальная лаборатория · Кинематика',
      title: 'Равноускоренное движение. Ускорение',
      tabsLabel: 'Выберите опыт',
      tabs: {
        accel: { label: 'Ускорение', sub: 'v = v₀ + a·t' },
        brake: { label: 'Торможение', sub: 'a против v' },
        fall: { label: 'Свободное падение', sub: 'g ≈ 9,8 м/с²' },
      },
    },
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Ускорение a', text: 'показывает, на сколько меняется скорость за одну секунду: a = (v − v₀) / t, в м/с².' },
        { term: 'Равноускоренное движение', text: 'a не меняется, и скорость в любой момент v = v₀ + a·t.' },
        { term: 'Мгновенная скорость', text: 'скорость в конкретный момент — именно её даёт v = v₀ + a·t.' },
        { term: 'Замедление', text: 'a направлено против скорости, вдоль выбранной оси a отрицательно. При свободном падении a ≈ 9,8 м/с².' },
      ],
    },
    accel: {
      presetsLabel: 'Готовые случаи',
      presets: {
        lesson: { name: 'Пример из урока', sub: '0 → 20 м/с · 8 с' },
        faster: { name: 'Разгон', sub: 'v₀ = 10 м/с · a = 1 м/с²' },
        slower: { name: 'Замедление', sub: 'v₀ = 15 м/с · a = −1,5 м/с²' },
      },
      v0: 'Начальная скорость',
      a: 'Ускорение',
      kmh: (k) => `≈ ${k} км/ч`,
      aHint: {
        pos: 'Положительное: по движению — машина разгоняется',
        zero: 'Ноль: скорость не меняется',
        neg: 'Отрицательное: против движения — машина замедляется',
      },
      legend: { v: 'скорость v', a: 'ускорение a', marks: 'скорость в каждую целую секунду' },
      chipReal: 'Реальное время',
      axisX: 'x, м',
      sceneLabel: (t, v, a) => `Автомобиль сбоку. t = ${t} с, скорость ${v} м/с, ускорение ${a} м/с².`,
      vTag: (v) => `v = ${v} м/с`,
      aTag: (a) => `a = ${a} м/с²`,
      secTag: (n) => `${n} с`,
      stopTag: 'остановился',
      readouts: { t: 'Время', v: 'Мгновенная скорость', a: 'Ускорение', formula: 'Формулы с числами' },
      tSub: (end) => `Опыт длится ${end} с`,
      aSub: (d) => `за каждую секунду скорость меняется на ${d} м/с`,
      aStopped: 'после остановки a = 0',
      ladder: {
        title: 'Лестница скоростей: v в каждую секунду',
        t: 't, с',
        v: 'v, м/с',
        label: 'Диаграмма скорости в каждую целую секунду',
        note: (d) => `Каждую секунду скорость меняется на одни и те же ${d} м/с — это и значит, что ускорение постоянно.`,
      },
      explain: {
        idle: 'Выберите v₀ и a и нажмите «Старт». Зелёная стрелка — скорость v, оранжевая — ускорение a. Каждую секунду скорость меняется на a.',
        speeding: (d) => `a направлено так же, как v, — машина разгоняется: каждую секунду v растёт на ${d} м/с.`,
        uniform: (v) => `a = 0: скорость не меняется, всё время v = ${v} м/с. Это равномерное движение.`,
        slowing: (d) => `a направлено против v — машина замедляется: каждую секунду v уменьшается на ${d} м/с. На нашей оси a отрицательно.`,
        lesson3: 't = 3 с: v = 0 + 2,5 · 3 = 7,5 м/с — мгновенная скорость из примера урока.',
        done: (v0, v, t, a) => `За ${t} с скорость изменилась с ${v0} до ${v} м/с: a = (v − v₀) / t = (${v} − ${v0}) / ${t} = ${a} м/с².`,
        stopped: (t) => `v = 0: машина остановилась через ${t} с. Дальше тормоза просто удерживают её — см. опыт «Торможение».`,
        atRest: 'Машина стоит, а a отрицательно: стоящую машину нечем тормозить. Увеличьте v₀ или сделайте a положительным.',
      },
    },
    brake: {
      presetsLabel: 'Торможение',
      presets: {
        soft: { name: 'Плавное торможение', sub: '20 м/с → 0 · |a| = 2,5 м/с²' },
        hard: { name: 'Резкое торможение', sub: '20 м/с → 0 · |a| = 5 м/с²' },
      },
      v0: 'Скорость до торможения',
      dec: 'Замедление |a|',
      kmh: (k) => `≈ ${k} км/ч`,
      decHint: 'Плавная остановка ≈ 2–3 м/с² · экстренное торможение на сухом асфальте ≈ 7 м/с²',
      axisLabel: 'Направление оси x',
      axes: {
        right: { name: 'Ось → (по движению)', sub: 'v > 0, a < 0' },
        left: { name: 'Ось ← (против движения)', sub: 'v < 0, a > 0' },
      },
      legend: { v: 'скорость v', a: 'ускорение a', axis: 'выбранная ось x', marks: 'положение через каждую 1 с' },
      chipReal: 'Реальное время',
      chipFast: (k) => `Время ускорено ×${k}`,
      axisX: 'x, м',
      sceneLabel: (t, v, a) => `Тормозящий автомобиль. t = ${t} с, скорость на оси ${v} м/с, ускорение ${a} м/с².`,
      vTag: (v) => `v = ${v} м/с`,
      aTag: (a) => `a = ${a} м/с²`,
      secTag: (n) => `${n} с`,
      stopTag: (t) => `остановился · t = ${t} с`,
      readouts: { t: 'Время', v: 'Скорость на оси', a: 'Ускорение на оси', stop: 'Время остановки' },
      vSub: (k) => `модуль ≈ ${k} км/ч`,
      aSub: 'против скорости',
      aStopped: 'после остановки a = 0',
      stopSub: (v0, a) => `t = v₀ / |a| = ${v0} / ${a}`,
      formula: {
        tag: 'Когда остановится?',
        general: '0 = v₀ + a·t  ⇒  t = −v₀ / a',
        filled: (v0, a, t) => `t = −(${v0}) / (${a}) = ${t} с`,
      },
      graph: {
        title: 'График: v(t) на выбранной оси',
        plan: 'v = v₀ + a·t',
        live: 'движение',
        stop: 'остановка',
        t: 't, с',
        v: 'v, м/с',
        note: 'Линия доходит до нуля в момент остановки. Если ось направить влево, то же движение рисуется ниже нуля.',
      },
      explain: {
        idle: 'Водитель нажал на тормоз. Ускорение (оранжевое) направлено назад — против скорости (зелёной). Нажмите «Старт».',
        right: (d) => `Скорость каждую секунду уменьшается на ${d} м/с. Ось направлена по движению: v положительна, а a отрицательно (a = −${d} м/с²).`,
        left: (d) => `Ось направлена влево, поэтому знаки поменялись: v отрицательна, a = +${d} м/с². Машина всё равно замедляется — важно, что a противоположно v.`,
        stopped: (t, v0, a) => `v = 0 через t = v₀ / |a| = ${v0} / ${a} = ${t} с. Теперь тормоза просто держат машину на месте.`,
      },
    },
    fall: {
      heightLabel: 'Высота падения',
      heights: {
        h20: { name: '20 м', sub: '≈ 6-этажный дом' },
        h45: { name: '45 м', sub: '≈ 15 этажей' },
        h80: { name: '80 м', sub: 'башня' },
      },
      legend: { v: 'скорость v', g: 'ускорение g', strobe: 'положение через каждую 1 с' },
      chipSlow: 'Время замедлено в 2 раза',
      sceneLabel: (t, v, y) => `Шар падает с башни. t = ${t} с, скорость ${v} м/с, высота ${y} м.`,
      vTag: (v) => `v = ${v} м/с`,
      gTag: 'g = 9,8 м/с²',
      ground: 'Земля',
      heightAxis: 'h, м',
      secTag: (n) => `${n} с`,
      readouts: { t: 'Время', v: 'Скорость', h: 'Высота над землёй', g: 'Ускорение' },
      vSub: (k) => `≈ ${k} км/ч`,
      hSub: (d) => `пролетел ${d} м`,
      gSub: 'одинаково в любой момент',
      ladder: {
        title: 'Скорость в каждую секунду',
        row: (n) => `t = ${n} с`,
        land: (t) => `земля · ${t} с`,
        note: 'Каждую секунду скорость растёт на одни и те же 9,8 м/с — это ускорение свободного падения.',
      },
      explain: {
        idle: 'Шар отпускают из состояния покоя (v₀ = 0). Сопротивление воздуха не учитываем. Нажмите «Старт» и следите за скоростью каждую секунду.',
        first: 'Шар начинает с покоя — притяжение Земли сразу начинает его разгонять.',
        falling: (n, v) => `Через ${n} с: v = 9,8 · ${n} = ${v} м/с. Каждую секунду скорость растёт на 9,8 м/с.`,
        landed: (t, v) => `Шар ударился о землю через ${t} с со скоростью v = 9,8 · ${t} ≈ ${v} м/с.`,
      },
    },
  },
  en: {
    card: {
      eyebrow: 'Virtual lab · Kinematics',
      title: 'Uniformly accelerated motion. Acceleration',
      tabsLabel: 'Choose an experiment',
      tabs: {
        accel: { label: 'Acceleration', sub: 'v = v₀ + a·t' },
        brake: { label: 'Braking', sub: 'a against v' },
        fall: { label: 'Free fall', sub: 'g ≈ 9.8 m/s²' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Run again', reset: 'Reset' },
    facts: {
      title: 'Remember',
      items: [
        { term: 'Acceleration a', text: 'how much the velocity changes in one second: a = (v − v₀) / t, measured in m/s².' },
        { term: 'Uniformly accelerated motion', text: 'a stays constant, so the velocity at any moment is v = v₀ + a·t.' },
        { term: 'Instantaneous velocity', text: 'the velocity at one particular moment — exactly what v = v₀ + a·t gives.' },
        { term: 'Slowing down', text: 'a points against v, so on the chosen axis a comes out negative. In free fall a ≈ 9.8 m/s².' },
      ],
    },
    accel: {
      presetsLabel: 'Ready-made cases',
      presets: {
        lesson: { name: 'Lesson example', sub: '0 → 20 m/s · 8 s' },
        faster: { name: 'Speeding up', sub: 'v₀ = 10 m/s · a = 1 m/s²' },
        slower: { name: 'Slowing down', sub: 'v₀ = 15 m/s · a = −1.5 m/s²' },
      },
      v0: 'Initial velocity',
      a: 'Acceleration',
      kmh: (k) => `≈ ${k} km/h`,
      aHint: {
        pos: 'Positive: along the motion — the car speeds up',
        zero: 'Zero: the velocity stays the same',
        neg: 'Negative: against the motion — the car slows down',
      },
      legend: { v: 'velocity v', a: 'acceleration a', marks: 'velocity at each whole second' },
      chipReal: 'Real time',
      axisX: 'x, m',
      sceneLabel: (t, v, a) => `Side view of the car. t = ${t} s, velocity ${v} m/s, acceleration ${a} m/s².`,
      vTag: (v) => `v = ${v} m/s`,
      aTag: (a) => `a = ${a} m/s²`,
      secTag: (n) => `${n} s`,
      stopTag: 'stopped',
      readouts: { t: 'Time', v: 'Instantaneous velocity', a: 'Acceleration', formula: 'Formulas with numbers' },
      tSub: (end) => `The run lasts ${end} s`,
      aSub: (d) => `the velocity changes by ${d} m/s every second`,
      aStopped: 'after stopping a = 0',
      ladder: {
        title: 'Velocity ladder: v at every second',
        t: 't, s',
        v: 'v, m/s',
        label: 'Bar chart of the velocity at each whole second',
        note: (d) => `Every second the velocity changes by the same ${d} m/s — that is what a constant acceleration means.`,
      },
      explain: {
        idle: 'Pick v₀ and a, then press Start. Green arrow — velocity v, orange — acceleration a. Every second the velocity changes by a.',
        speeding: (d) => `a points the same way as v — the car speeds up: every second v grows by ${d} m/s.`,
        uniform: (v) => `a = 0: the velocity does not change, v = ${v} m/s all the time. That is uniform motion.`,
        slowing: (d) => `a points against v — the car slows down: every second v drops by ${d} m/s. Along our axis a is negative.`,
        lesson3: 't = 3 s: v = 0 + 2.5 · 3 = 7.5 m/s — the instantaneous velocity from the lesson example.',
        done: (v0, v, t, a) => `In ${t} s the velocity went from ${v0} to ${v} m/s: a = (v − v₀) / t = (${v} − ${v0}) / ${t} = ${a} m/s².`,
        stopped: (t) => `v = 0: the car stopped after ${t} s. From now on the brakes just hold it — see the "Braking" experiment.`,
        atRest: 'The car is standing still and a is negative: a car at rest has nothing to brake. Increase v₀ or make a positive.',
      },
    },
    brake: {
      presetsLabel: 'Braking',
      presets: {
        soft: { name: 'Gentle braking', sub: '20 m/s → 0 · |a| = 2.5 m/s²' },
        hard: { name: 'Hard braking', sub: '20 m/s → 0 · |a| = 5 m/s²' },
      },
      v0: 'Speed before braking',
      dec: 'Deceleration |a|',
      kmh: (k) => `≈ ${k} km/h`,
      decHint: 'Smooth stop ≈ 2–3 m/s² · emergency stop on dry asphalt ≈ 7 m/s²',
      axisLabel: 'Direction of the x axis',
      axes: {
        right: { name: 'Axis → (along the motion)', sub: 'v > 0, a < 0' },
        left: { name: 'Axis ← (against the motion)', sub: 'v < 0, a > 0' },
      },
      legend: { v: 'velocity v', a: 'acceleration a', axis: 'chosen x axis', marks: 'position every 1 s' },
      chipReal: 'Real time',
      chipFast: (k) => `Time sped up ×${k}`,
      axisX: 'x, m',
      sceneLabel: (t, v, a) => `A braking car. t = ${t} s, velocity on the axis ${v} m/s, acceleration ${a} m/s².`,
      vTag: (v) => `v = ${v} m/s`,
      aTag: (a) => `a = ${a} m/s²`,
      secTag: (n) => `${n} s`,
      stopTag: (t) => `stopped · t = ${t} s`,
      readouts: { t: 'Time', v: 'Velocity on the axis', a: 'Acceleration on the axis', stop: 'Stopping time' },
      vSub: (k) => `speed ≈ ${k} km/h`,
      aSub: 'opposite to the velocity',
      aStopped: 'after stopping a = 0',
      stopSub: (v0, a) => `t = v₀ / |a| = ${v0} / ${a}`,
      formula: {
        tag: 'When does it stop?',
        general: '0 = v₀ + a·t  ⇒  t = −v₀ / a',
        filled: (v0, a, t) => `t = −(${v0}) / (${a}) = ${t} s`,
      },
      graph: {
        title: 'Graph: v(t) on the chosen axis',
        plan: 'v = v₀ + a·t',
        live: 'motion',
        stop: 'stop',
        t: 't, s',
        v: 'v, m/s',
        note: 'The line reaches zero at the moment the car stops. With the axis pointing left, the same motion is drawn below zero.',
      },
      explain: {
        idle: 'The driver presses the brake. The acceleration (orange) points backwards — against the velocity (green). Press Start.',
        right: (d) => `The velocity drops by ${d} m/s every second. The axis points along the motion: v is positive and a is negative (a = −${d} m/s²).`,
        left: (d) => `The axis points left, so the signs swap: v is negative and a = +${d} m/s². The car still slows down — what matters is that a is opposite to v.`,
        stopped: (t, v0, a) => `v = 0 after t = v₀ / |a| = ${v0} / ${a} = ${t} s. The brakes now just hold the car in place.`,
      },
    },
    fall: {
      heightLabel: 'Drop height',
      heights: {
        h20: { name: '20 m', sub: '≈ 6-storey building' },
        h45: { name: '45 m', sub: '≈ 15 storeys' },
        h80: { name: '80 m', sub: 'tower' },
      },
      legend: { v: 'velocity v', g: 'acceleration g', strobe: 'position every 1 s' },
      chipSlow: 'Time slowed down ×2',
      sceneLabel: (t, v, y) => `A ball falling from a tower. t = ${t} s, velocity ${v} m/s, height ${y} m.`,
      vTag: (v) => `v = ${v} m/s`,
      gTag: 'g = 9.8 m/s²',
      ground: 'Ground',
      heightAxis: 'h, m',
      secTag: (n) => `${n} s`,
      readouts: { t: 'Time', v: 'Velocity', h: 'Height above ground', g: 'Acceleration' },
      vSub: (k) => `≈ ${k} km/h`,
      hSub: (d) => `fallen ${d} m`,
      gSub: 'the same at every moment',
      ladder: {
        title: 'Speed at every second',
        row: (n) => `t = ${n} s`,
        land: (t) => `ground · ${t} s`,
        note: 'Every second the speed grows by the same 9.8 m/s — the free-fall acceleration.',
      },
      explain: {
        idle: 'The ball is let go from rest (v₀ = 0). Air resistance is ignored. Press Start and watch the speed every second.',
        first: 'The ball starts from rest — the Earth’s pull speeds it up straight away.',
        falling: (n, v) => `After ${n} s: v = 9.8 · ${n} = ${v} m/s. Every second the speed grows by 9.8 m/s.`,
        landed: (t, v) => `The ball hits the ground after ${t} s at v = 9.8 · ${t} ≈ ${v} m/s.`,
      },
    },
  },
};

/* ================================================================= card */

export default function Acceleration() {
  const T = useSimText(TEXT);
  const tabs = [
    { id: 'accel', ...T.card.tabs.accel, icon: TrendingUp, render: () => <AccelSim T={T} /> },
    { id: 'brake', ...T.card.tabs.brake, icon: OctagonMinus, render: () => <BrakeSim T={T} /> },
    { id: 'fall', ...T.card.tabs.fall, icon: ArrowDownToLine, render: () => <FallSim T={T} /> },
  ];
  return <SimCard eyebrow={T.card.eyebrow} title={T.card.title} tabsLabel={T.card.tabsLabel} tabs={tabs} facts={T.facts} icon={Gauge} idPrefix="accel" />;
}

/* ========================================================= acceleration */

const T_RUN = 8; // s, as in the lesson's example
const PRESETS = {
  lesson: { v0: 0, a: 2.5, icon: TrendingUp },
  faster: { v0: 10, a: 1, icon: TrendingUp },
  slower: { v0: 15, a: -1.5, icon: TrendingDown },
};
const IDLE = { t: 0, running: false, done: false };

function AccelSim({ T }) {
  const L = T.accel;
  const dec = T.decimal;
  const [v0, setV0] = useState(0);
  const [a, setA] = useState(2.5);
  const [sim, setSim] = useState(IDLE);
  const tEnd = a < 0 ? Math.min(T_RUN, v0 / -a) : T_RUN;
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].v0 === v0 && PRESETS[k].a === a) ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tEnd, p.t + dt);
      const done = t >= tEnd - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (tEnd < 0.05) return;
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    setV0(PRESETS[id].v0);
    setA(PRESETS[id].a);
    setSim(IDLE);
  };

  const t = sim.t;
  const v = v0 + a * t;
  const stoppedEarly = tEnd < T_RUN - 1e-9;
  const F = (n, d = 1) => num(n, d, dec);

  let key = 'idle';
  if (tEnd < 0.05) key = 'atRest';
  else if (sim.done) key = stoppedEarly ? 'stopped' : 'done';
  else if (t > 0) {
    if (preset === 'lesson' && t >= 3 && t < 6) key = 'lesson3';
    else if (Math.abs(a) < 1e-9) key = 'uniform';
    else key = a > 0 ? 'speeding' : 'slowing';
  }
  const settled = useSettled(key, key === 'idle' || key === 'lesson3' || key === 'done' || key === 'stopped' ? 0 : 300);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    atRest: ex.atRest,
    speeding: ex.speeding(F(Math.abs(a))),
    slowing: ex.slowing(F(Math.abs(a))),
    uniform: ex.uniform(F(v0)),
    lesson3: ex.lesson3,
    done: ex.done(F(v0), F(v0 + a * tEnd), fmt(tEnd, 0, dec), F(a)),
    stopped: ex.stopped(F(tEnd)),
  }[settled];
  const tone = { idle: '#22d3ee', atRest: '#f87171', speeding: '#fb923c', slowing: '#fb923c', uniform: '#34d399', lesson3: '#a78bfa', done: '#34d399', stopped: '#34d399' }[settled];

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
            options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <AccelScene T={T} v0={v0} a={a} t={t} tEnd={tEnd} running={sim.running} done={sim.done} preset={preset} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 1, dec)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={L.tSub(fmt(tEnd, 1, dec))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(t / T_RUN) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={L.readouts.v} symbol="v" value={F(v)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={L.kmh(fmt(v * 3.6, 0, dec))} />
        <Readout
          label={L.readouts.a}
          symbol="a"
          value={sim.done && stoppedEarly ? F(0) : F(a)}
          unit={T.ms2}
          accent={PALETTE.acc}
          textColor={PALETTE.accText}
          sub={sim.done && stoppedEarly ? L.aStopped : L.aSub(signed(a, 1, dec))}
        />
        <Readout label={L.readouts.formula} accent="#e2e8f0">
          <div className="mt-1.5 space-y-1.5 text-[13px] leading-snug">
            <p>
              <span className="font-serif italic text-gray-200">
                <Rich>v = v₀ + a·t</Rich>
              </span>
              <br />
              <span className="tabular-nums text-gray-400">
                = {F(v0)} + ({F(a)}) · {fmt(t, 1, dec)} = <b className="text-[#6ee7b7]">{F(v)}</b> {T.ms}
              </span>
            </p>
            <p>
              <span className="font-serif italic text-gray-200">
                <Rich>a = (v − v₀) / t</Rich>
              </span>
              <br />
              <span className="tabular-nums text-gray-400">
                {t > 0.05 ? (
                  <>
                    = ({F(v)} − {F(v0)}) / {fmt(t, 1, dec)} = <b className="text-[#fdba74]">{F(a)}</b> {T.ms2}
                  </>
                ) : (
                  '= —'
                )}
              </span>
            </p>
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="acc-v0"
            label={L.v0}
            symbol={<Rich>v₀</Rich>}
            min={0}
            max={15}
            step={0.5}
            value={v0}
            onChange={(n) => {
              setV0(n);
              setSim(IDLE);
            }}
            accent={PALETTE.vel}
            display={`${F(v0)} ${T.ms}`}
            hint={L.kmh(fmt(v0 * 3.6, 0, dec))}
          />
          <RangeField
            id="acc-a"
            label={L.a}
            symbol="a"
            min={-3}
            max={4}
            step={0.5}
            value={a}
            onChange={(n) => {
              setA(n);
              setSim(IDLE);
            }}
            accent={PALETTE.acc}
            display={`${F(a)} ${T.ms2}`}
            hint={a > 0 ? L.aHint.pos : a < 0 ? L.aHint.neg : L.aHint.zero}
          />
          <div className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2.5 text-sm text-gray-300">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-400/15 text-orange-300">
              {a > 0 ? <TrendingUp size={17} aria-hidden="true" /> : a < 0 ? <TrendingDown size={17} aria-hidden="true" /> : <Equal size={17} aria-hidden="true" />}
            </span>
            <span className="tabular-nums leading-snug">{L.aSub(signed(a, 1, dec))}</span>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <Ladder T={T} v0={v0} a={a} t={t} tEnd={tEnd} highlight={preset === 'lesson' ? 3 : null} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function AccelScene({ T, v0, a, t, tEnd, running, done, preset }) {
  const L = T.accel;
  const dec = T.decimal;
  const xEnd = Math.max(0, v0 * tEnd + 0.5 * a * tEnd * tEnd);
  const vTop = Math.max(v0, v0 + a * tEnd, 4);
  const x = v0 * t + 0.5 * a * t * t;
  const v = v0 + a * t;
  const marks = [];
  for (let n = 0; n <= Math.floor(t + 1e-9); n += 1) marks.push({ n, x: v0 * n + 0.5 * a * n * n, v: v0 + a * n });
  const stoppedEarly = done && tEnd < T_RUN - 1e-9;

  return (
    <LabScene
      legend={[
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: PALETTE.acc, label: L.legend.a, kind: 'arrow' },
        { color: PALETTE.vel, label: L.legend.marks, kind: 'ring' },
      ]}
      chips={
        <Chip>
          {L.chipReal} · t = {fmt(t, 1, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? 236 : 262)}
      ariaLabel={L.sceneLabel(fmt(t, 1, dec), num(v, 1, dec), num(a, 1, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const carLen = narrow ? 58 : 88;
        const vMaxPx = narrow ? 70 : 140;
        const padL = carLen + (narrow ? 12 : 26);
        const padR = Math.max(vMaxPx - carLen / 2 + (narrow ? 14 : 30), 28);
        const view = lineView(0, Math.max(xEnd, 6), W, padL, padR);
        const step = rulerStep(view, narrow ? 44 : 62);
        const roadY = H - (narrow ? 60 : 66);
        const carY = roadY + 4;
        const vk = vMaxPx / vTop;
        const ak = narrow ? 14 : 22;
        const front = view.sx(x);
        const cx = front - carLen / 2;
        const carTop = carY - carLen * 0.48;
        const yv = carTop - 16;
        const ya = yv - 27;
        const box = { w: W, h: H };
        const vText = L.vTag(num(v, 1, dec));
        const aText = L.aTag(num(a, 1, dec));
        const vW = textWidth(vText, fs, 600) + 16;
        const aW = textWidth(aText, fs, 600) + 16;
        const aLen = a * ak;
        return (
          <>
            <SideRoad view={view} W={W} H={H} roadY={roadY} step={step} unit={L.axisX} decimal={dec} fs={fs - 1} />
            <line x1={view.sx(0)} x2={view.sx(0)} y1={roadY - 10} y2={roadY + 10} stroke={PALETTE.ink} strokeWidth={2} strokeDasharray="3 3" />
            <StrobeMarks
              marks={marks.map((m) => ({ n: m.n, px: view.sx(m.x), v: m.v }))}
              roadY={roadY}
              rowY={roadY - 24}
              vk={vk}
              label={L.secTag}
              highlight={preset === 'lesson' ? 3 : null}
              fs={fs - 2}
            />
            <SideCar front={front} y={carY} len={carLen} color="#2563eb" dist={x} braking={a < 0 && t > 0 && !done} />
            {v > 0.05 && <Arrow x1={cx} y1={yv} x2={cx + v * vk} y2={yv} color={PALETTE.vel} width={narrow ? 3 : 3.5} head={narrow ? 10 : 12} />}
            {Math.abs(aLen) > 2 && <Arrow x1={cx} y1={ya} x2={cx + aLen} y2={ya} color={PALETTE.acc} width={narrow ? 3 : 3.5} head={narrow ? 10 : 12} />}
            <circle cx={cx} cy={yv} r={3} fill={PALETTE.vel} />
            {Math.abs(aLen) > 2 && <circle cx={cx} cy={ya} r={3} fill={PALETTE.acc} />}
            <Pill x={cx - vW / 2 - 8} y={yv} text={vText} bg={PALETTE.vel} size={fs} box={box} />
            {Math.abs(a) > 1e-9 && <Pill x={a > 0 ? cx - aW / 2 - 8 : cx + aW / 2 + 8} y={ya} text={aText} bg={PALETTE.acc} size={fs} box={box} />}
            {stoppedEarly && <Pill x={front + 34} y={carY - carLen * 0.25} text={L.stopTag} bg="#dc2626" size={fs - 1} box={box} />}
            {running && <circle cx={cx} cy={carY - carLen * 0.25} r={carLen * 0.36} fill="#2563eb" className="cl-pulse" opacity="0.25" />}
          </>
        );
      }}
    </LabScene>
  );
}

/* --------------------------------------------------------------- ladder */

function Ladder({ T, v0, a, t, tEnd, highlight }) {
  const L = T.accel;
  const dec = T.decimal;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 240);
  const H = 220;
  const pad = { l: 40, r: 26, t: 30, b: 26 };
  const vTop = niceMax(Math.max(v0, v0 + a * tEnd, 4));
  const slot = (W - pad.l - pad.r) / (T_RUN + 1);
  const gx = (n) => pad.l + (n + 0.5) * slot;
  const gy = (v) => H - pad.b - (v / vTop) * (H - pad.t - pad.b);
  const nLast = Math.floor(tEnd + 1e-9);
  const cols = [];
  for (let n = 0; n <= T_RUN; n += 1) cols.push(n);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * vTop);
  const tNow = Math.min(t, tEnd);
  const linePts = [];
  for (let i = 0; i <= 40; i += 1) {
    const tt = (tNow * i) / 40;
    linePts.push(`${(pad.l + (tt + 0.5) * slot).toFixed(1)},${gy(v0 + a * tt).toFixed(1)}`);
  }
  const yDigits = tickDigits(vTop);
  const fs = slot < 34 ? 9.5 : 11;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{L.ladder.title}</p>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#34d399' }} /> v
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="text-[11px] font-semibold text-orange-300">Δv</span> = a · 1 {T.s}
        </span>
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L.ladder.label} className="block overflow-visible">
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(v, yDigits, dec)}
              </text>
            </g>
          ))}
          <text x={pad.l + 4} y={12} fontSize="11" fill="#64748b">
            {L.ladder.v}
          </text>
          <text x={W} y={H - 8} textAnchor="end" fontSize="11" fill="#64748b">
            {L.ladder.t}
          </text>
          {cols.map((n) => {
            const shown = n <= nLast && n <= t + 1e-9;
            const vn = v0 + a * n;
            const x = gx(n);
            const w = slot * 0.56;
            const hl = highlight === n && shown;
            return (
              <g key={n}>
                <text x={x} y={H - 8} textAnchor="middle" fontSize="11" fill={n <= nLast ? '#94a3b8' : '#475569'}>
                  {n}
                </text>
                {shown ? (
                  <>
                    <rect x={x - w / 2} y={gy(vn)} width={w} height={Math.max(0, gy(0) - gy(vn))} rx={3} fill={hl ? '#a78bfa' : '#34d399'} opacity={hl ? 0.9 : 0.55} />
                    <text x={x} y={gy(vn) - 5} textAnchor="middle" fontSize={fs} fontWeight={hl ? 800 : 600} fill={hl ? '#ddd6fe' : '#d1fae5'} className="tabular-nums">
                      {num(vn, 1, dec)}
                    </text>
                  </>
                ) : (
                  <rect x={x - w / 2} y={gy(0) - 2} width={w} height={2} rx={1} fill="rgba(255,255,255,0.12)" />
                )}
                {n > 0 && shown && slot >= 26 && (
                  <text x={x - slot / 2} y={pad.t - 14} textAnchor="middle" fontSize={fs - 0.5} fontWeight="700" fill="#fdba74" className="tabular-nums">
                    {signed(a, 1, dec)}
                  </text>
                )}
              </g>
            );
          })}
          {tNow > 0 && <polyline points={linePts.join(' ')} fill="none" stroke="#6ee7b7" strokeWidth="2" strokeDasharray="4 4" />}
          {tNow > 0 && <circle cx={pad.l + (tNow + 0.5) * slot} cy={gy(v0 + a * tNow)} r="4.5" fill="#6ee7b7" stroke="#0b0b16" strokeWidth="1.5" />}
        </svg>
      </div>
      <p className="mt-1 text-xs text-gray-500">{L.ladder.note(signed(a, 1, dec))}</p>
    </div>
  );
}
