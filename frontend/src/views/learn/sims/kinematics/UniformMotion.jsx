import { useState } from 'react';
import { Bike, Car, Gauge, Lightbulb, MoveLeft, Pause, Play, RotateCcw, Timer, TrainFront } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { Btn, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { useSimText } from '../kit/lang';
import { PANEL, PanelTitle, SceneChip, ScenePanel, Vehicle, nf, nfa, paren, tickStep } from './UniformMotion.parts';
import SpeedsSim from './UniformMotion.speeds';

/* =========================================================================
 * To'g'ri chiziqli tekis harakat — every word on screen lives here.
 * ========================================================================= */
const TEXT = {
  uz: {
    card: {
      eyebrow: 'Virtual laboratoriya · Kinematika',
      title: "To'g'ri chiziqli tekis harakat",
      tabsLabel: 'Simulyatorni tanlang',
      tabs: {
        move: { label: 'Tekis harakat', sub: 'x = x₀ + v·t' },
        speeds: { label: 'Tezlik birliklari', sub: 'km/soat ⇄ m/s' },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: 'Tekis harakat', text: "ixtiyoriy teng vaqt oraliqlarida teng yo'llar bosiladi, tezlik o'zgarmaydi." },
        { term: 'Tezlik', text: "v = s / t — bir sekundda bosilgan yo'l; demak s = v · t." },
        { term: 'Koordinata', text: "x = x₀ + v · t; v < 0 bo'lsa, jism o'qqa qarshi harakatlanadi." },
        { term: 'Birliklar', text: 'km/soat ÷ 3.6 = m/s, m/s × 3.6 = km/soat: 72 km/soat = 20 m/s.' },
      ],
    },
    move: {
      presetsLabel: 'Tayyor tajribalar',
      presets: {
        train: { name: 'Poyezd', sub: '72 km/soat · 30 s' },
        car: { name: 'Avtomobil', sub: '54 km/soat · 20 s' },
        back: { name: 'Orqaga yurish', sub: 'v = −15 m/s' },
        bike: { name: 'Velosipedchi', sub: '18 km/soat · 30 s' },
      },
      legend: { disp: "ko'chish x − x₀", vel: 'tezlik v', marks: "har 1 s dagi o'rni", tape: 'teng oraliqlar' },
      timeChip: (k) => `Vaqt ×${k} tezlashtirilgan`,
      realTime: 'Real vaqt',
      tChip: (t) => `t = ${t} s`,
      sceneLabel: (t, x) => `Yon tomondan ko'rinish: to'g'ri yo'l va o'lchov chizg'ichi. t = ${t} s, x = ${x} m.`,
      axis: 'x, m',
      x0Text: (x) => `x₀ = ${x} m`,
      xTag: (x) => `x = ${x} m`,
      dispTag: (d) => `x − x₀ = ${d} m`,
      vTag: (v) => `v = ${v} m/s`,
      gapTag: (d) => `1 s → ${d} m`,
      secTag: (n) => `${n} s`,
      readouts: { time: 'Vaqt', path: "Yo'l", coord: 'Koordinata', formula: 'Formula' },
      timeSub: (T) => `Kuzatish vaqti ${T} s`,
      pathSubFwd: (v, t) => `s = v·t = ${v} · ${t}`,
      pathSubBack: (v, t) => `s = |v|·t = ${v} · ${t}`,
      coordSub: (x0) => `x₀ = ${x0} m dan boshlandi`,
      formulaSub: 'Koordinata vaqtga chiziqli bog‘langan',
      x0: "Boshlang'ich koordinata",
      x0Hint: 'Jism t = 0 paytda turgan nuqta',
      v: 'Tezlik',
      vHint: (kmh) => `= ${kmh} km/soat · minus ishora — o'qqa qarshi`,
      dur: 'Kuzatish vaqti',
      durHint: (k) => (k > 1 ? `Ekranda ≈ 10 s: vaqt ×${k} tezlashtirilgan` : 'Real vaqtda'),
      bars: {
        title: "Har bir sekundda bosilgan yo'l",
        chip: (d) => `Δs = |v| · 1 s = ${d} m`,
        y: 'Δs, m',
        x: 't, s',
        label: "Har sekundda bosilgan yo'l ustunli diagrammasi",
        note: "Hamma ustunlar bir xil balandlikda: teng vaqt oraliqlarida teng yo'llar — tekis harakatning belgisi.",
      },
      explain: {
        idle: "«Boshlash»ni bosing. Har 1 s da jism turgan joy lentaga belgilanadi. Tekis harakatda belgilar orasidagi masofalar teng bo'ladi.",
        fwd: (d) => `Har 1 s da jism ${d} m yo'l bosadi — lentadagi oraliqlar teng. Tezlik o'zgarmaydi: bu to'g'ri chiziqli tekis harakat.`,
        back: (d) => `Tezlik manfiy: jism x o'qiga qarshi ketmoqda, koordinata har sekundda ${d} m ga kamayadi. Yo'l esa baribir ortadi: s = |v|·t.`,
        rest: (x0) => `v = 0: jism joyida turibdi, x = x₀ = ${x0} m o'zgarmaydi. Hamma belgilar bitta nuqtaga tushadi.`,
        doneFwd: (kmh, v, T, s, x0, x) =>
          `${kmh} km/soat = ${v} m/s. ${T} s da yo'l s = v·t = ${v} · ${T} = ${s} m, koordinata x = x₀ + v·t = ${x0} + ${s} = ${x} m.`,
        doneBack: (v, T, s, x0, x) =>
          `${T} s da jism orqaga ${s} m yurdi: x = x₀ + v·t = ${x0} + ${v} · ${T} = ${x} m. Yo'l esa musbat: s = |v|·t = ${s} m.`,
        doneRest: (T, x0) => `${T} s o'tdi, lekin x = ${x0} m o'zgarmadi: tezlik nolga teng, bosilgan yo'l ham nol.`,
      },
    },
    speeds: {
      racersLabel: 'Ishtirokchilar',
      racers: {
        walker: { name: 'Piyoda', low: 'piyoda', abl: 'piyodadan' },
        bike: { name: 'Velosipedchi', low: 'velosipedchi', abl: 'velosipedchidan' },
        car: { name: 'Avtomobil', low: 'avtomobil', abl: 'avtomobildan' },
        train: { name: 'Poyezd', low: 'poyezd', abl: 'poyezddan' },
        plane: { name: 'Samolyot', low: 'samolyot', abl: 'samolyotdan' },
      },
      legend: { trail: "har 1 s dagi o'rni", start: 'start chizig‘i' },
      timeChip: (k) => `Vaqt ×${k} tezlashtirilgan`,
      realTime: 'Real vaqt',
      tChip: (t) => `t = ${t} s`,
      sceneLabel: (t) => `Poyga yo'laklari, yon tomondan ko'rinish. t = ${t} s.`,
      axis: 's, m',
      start: 'Start',
      laneTag: (name, v, kmh) => `${name} · ${v} m/s = ${kmh} km/soat`,
      distTag: (s) => `${s} m`,
      readouts: { time: 'Vaqt', most: "Eng ko'p yo'l", least: "Eng kam yo'l", ratio: 'Tezliklar nisbati' },
      timeSub: (T) => `Hammasi ${T} s harakatlanadi`,
      ratioSub: 'Yo‘llar nisbati ham xuddi shunday',
      race: 'Harakat vaqti',
      raceHint: (k) => (k > 1 ? `Ekranda ≈ 10 s: vaqt ×${k} tezlashtirilgan` : 'Real vaqtda'),
      conv: {
        title: 'Birliklarni aylantirish',
        pick: 'Kimning tezligi?',
        custom: 'Boshqa',
        slider: 'Tezlik',
        divide: (d) => `÷ ${d}`,
        multiply: (d) => `× ${d}`,
        toMs: 'km/soat → m/s',
        toKmh: 'm/s → km/soat',
        line1: (kmh, metres, v) => `${kmh} km/soat = ${metres} m / 3600 s = ${v} m/s`,
        line2: (d, v, kmh) => `1 m/s = 3600 m / 1 soat = ${d} km/soat, demak ${v} m/s · ${d} = ${kmh} km/soat`,
        meaning: (v, kmh) => `Ma'nosi: har sekundda ${v} m, har soatda ${kmh} km yo'l.`,
      },
      explain: {
        none: 'Kamida bitta ishtirokchini tanlang.',
        idle: (T) => `Hamma bir paytda yo'lga chiqadi va bir xil vaqt — ${T} s harakatlanadi. Kim qancha yo'l bosishini kuzating.`,
        running:
          "Har bir ishtirokchi har sekundda o'z tezligiga teng yo'l bosadi: nuqtalar orasidagi masofa — bir sekunddagi yo'l, u o'zgarmaydi.",
        plane: "Samolyot 250 m/s = 900 km/soat tezlikda uchadi — shu masshtabda qolganlar deyarli joyida turgandek ko'rinadi.",
        done: (T, fast, fastS, slow, slowS, ratio) =>
          `${T} s da ${fast.low} ${fastS} m, ${slow.low} esa ${slowS} m yo'l bosdi: s = v·t. ${fast.name} ${slow.abl} ${ratio} marta tez.`,
        single: (r, v, T, s) => `${r.name}: s = v·t = ${v} · ${T} = ${s} m.`,
      },
    },
  },

  ru: {
    card: {
      eyebrow: 'Виртуальная лаборатория · Кинематика',
      title: 'Прямолинейное равномерное движение',
      tabsLabel: 'Выберите симулятор',
      tabs: {
        move: { label: 'Равномерное движение', sub: 'x = x₀ + v·t' },
        speeds: { label: 'Единицы скорости', sub: 'км/ч ⇄ м/с' },
      },
    },
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Равномерное движение', text: 'за любые равные промежутки времени тело проходит равные пути, скорость не меняется.' },
        { term: 'Скорость', text: 'v = s / t — путь за одну секунду; значит, s = v · t.' },
        { term: 'Координата', text: 'x = x₀ + v · t; при v < 0 тело движется против оси.' },
        { term: 'Единицы', text: 'км/ч ÷ 3,6 = м/с, м/с × 3,6 = км/ч: 72 км/ч = 20 м/с.' },
      ],
    },
    move: {
      presetsLabel: 'Готовые опыты',
      presets: {
        train: { name: 'Поезд', sub: '72 км/ч · 30 с' },
        car: { name: 'Автомобиль', sub: '54 км/ч · 20 с' },
        back: { name: 'Движение назад', sub: 'v = −15 м/с' },
        bike: { name: 'Велосипедист', sub: '18 км/ч · 30 с' },
      },
      legend: { disp: 'перемещение x − x₀', vel: 'скорость v', marks: 'положение через каждую 1 с', tape: 'равные отрезки' },
      timeChip: (k) => `Время ускорено ×${k}`,
      realTime: 'Реальное время',
      tChip: (t) => `t = ${t} с`,
      sceneLabel: (t, x) => `Вид сбоку: прямая дорога и измерительная линейка. t = ${t} с, x = ${x} м.`,
      axis: 'x, м',
      x0Text: (x) => `x₀ = ${x} м`,
      xTag: (x) => `x = ${x} м`,
      dispTag: (d) => `x − x₀ = ${d} м`,
      vTag: (v) => `v = ${v} м/с`,
      gapTag: (d) => `1 с → ${d} м`,
      secTag: (n) => `${n} с`,
      readouts: { time: 'Время', path: 'Путь', coord: 'Координата', formula: 'Формула' },
      timeSub: (T) => `Время наблюдения ${T} с`,
      pathSubFwd: (v, t) => `s = v·t = ${v} · ${t}`,
      pathSubBack: (v, t) => `s = |v|·t = ${v} · ${t}`,
      coordSub: (x0) => `начало в x₀ = ${x0} м`,
      formulaSub: 'Координата линейно зависит от времени',
      x0: 'Начальная координата',
      x0Hint: 'Где тело находится в момент t = 0',
      v: 'Скорость',
      vHint: (kmh) => `= ${kmh} км/ч · знак минус — против оси`,
      dur: 'Время наблюдения',
      durHint: (k) => (k > 1 ? `На экране ≈ 10 с: время ускорено ×${k}` : 'В реальном времени'),
      bars: {
        title: 'Путь, пройденный за каждую секунду',
        chip: (d) => `Δs = |v| · 1 с = ${d} м`,
        y: 'Δs, м',
        x: 't, с',
        label: 'Столбчатая диаграмма пути за каждую секунду',
        note: 'Все столбцы одной высоты: за равные промежутки времени — равные пути. Это и есть признак равномерного движения.',
      },
      explain: {
        idle: 'Нажмите «Старт». Каждую секунду положение тела отмечается на ленте. При равномерном движении расстояния между отметками одинаковы.',
        fwd: (d) => `Каждую секунду тело проходит ${d} м — отрезки на ленте равны. Скорость не меняется: это прямолинейное равномерное движение.`,
        back: (d) => `Скорость отрицательна: тело движется против оси x, координата каждую секунду уменьшается на ${d} м. А путь всё равно растёт: s = |v|·t.`,
        rest: (x0) => `v = 0: тело стоит на месте, x = x₀ = ${x0} м не меняется. Все отметки попадают в одну точку.`,
        doneFwd: (kmh, v, T, s, x0, x) =>
          `${kmh} км/ч = ${v} м/с. За ${T} с путь s = v·t = ${v} · ${T} = ${s} м, координата x = x₀ + v·t = ${x0} + ${s} = ${x} м.`,
        doneBack: (v, T, s, x0, x) =>
          `За ${T} с тело прошло ${s} м назад: x = x₀ + v·t = ${x0} + ${v} · ${T} = ${x} м. Путь же положителен: s = |v|·t = ${s} м.`,
        doneRest: (T, x0) => `Прошло ${T} с, но x = ${x0} м не изменилась: скорость равна нулю, путь тоже ноль.`,
      },
    },
    speeds: {
      racersLabel: 'Участники',
      racers: {
        walker: { name: 'Пешеход', low: 'пешеход', abl: 'пешехода' },
        bike: { name: 'Велосипедист', low: 'велосипедист', abl: 'велосипедиста' },
        car: { name: 'Автомобиль', low: 'автомобиль', abl: 'автомобиля' },
        train: { name: 'Поезд', low: 'поезд', abl: 'поезда' },
        plane: { name: 'Самолёт', low: 'самолёт', abl: 'самолёта' },
      },
      legend: { trail: 'положение через каждую 1 с', start: 'линия старта' },
      timeChip: (k) => `Время ускорено ×${k}`,
      realTime: 'Реальное время',
      tChip: (t) => `t = ${t} с`,
      sceneLabel: (t) => `Дорожки забега, вид сбоку. t = ${t} с.`,
      axis: 's, м',
      start: 'Старт',
      laneTag: (name, v, kmh) => `${name} · ${v} м/с = ${kmh} км/ч`,
      distTag: (s) => `${s} м`,
      readouts: { time: 'Время', most: 'Наибольший путь', least: 'Наименьший путь', ratio: 'Отношение скоростей' },
      timeSub: (T) => `Все движутся ${T} с`,
      ratioSub: 'Пути относятся так же',
      race: 'Время движения',
      raceHint: (k) => (k > 1 ? `На экране ≈ 10 с: время ускорено ×${k}` : 'В реальном времени'),
      conv: {
        title: 'Перевод единиц',
        pick: 'Чья скорость?',
        custom: 'Другая',
        slider: 'Скорость',
        divide: (d) => `÷ ${d}`,
        multiply: (d) => `× ${d}`,
        toMs: 'км/ч → м/с',
        toKmh: 'м/с → км/ч',
        line1: (kmh, metres, v) => `${kmh} км/ч = ${metres} м / 3600 с = ${v} м/с`,
        line2: (d, v, kmh) => `1 м/с = 3600 м / 1 ч = ${d} км/ч, поэтому ${v} м/с · ${d} = ${kmh} км/ч`,
        meaning: (v, kmh) => `Смысл: ${v} м за каждую секунду, ${kmh} км за каждый час.`,
      },
      explain: {
        none: 'Выберите хотя бы одного участника.',
        idle: (T) => `Все стартуют одновременно и движутся одно и то же время — ${T} с. Посмотрите, кто сколько пройдёт.`,
        running: 'Каждый участник за секунду проходит путь, равный своей скорости: расстояние между точками — путь за одну секунду, и оно не меняется.',
        plane: 'Самолёт летит со скоростью 250 м/с = 900 км/ч — в таком масштабе остальные почти стоят на месте.',
        done: (T, fast, fastS, slow, slowS, ratio) =>
          `За ${T} с ${fast.low} прошёл ${fastS} м, а ${slow.low} — ${slowS} м: s = v·t. ${fast.name} быстрее ${slow.abl} в ${ratio} раза.`,
        single: (r, v, T, s) => `${r.name}: s = v·t = ${v} · ${T} = ${s} м.`,
      },
    },
  },

  en: {
    card: {
      eyebrow: 'Virtual laboratory · Kinematics',
      title: 'Straight-line uniform motion',
      tabsLabel: 'Choose a simulator',
      tabs: {
        move: { label: 'Uniform motion', sub: 'x = x₀ + v·t' },
        speeds: { label: 'Speed units', sub: 'km/h ⇄ m/s' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Run again', reset: 'Reset' },
    facts: {
      title: 'Remember',
      items: [
        { term: 'Uniform motion', text: 'equal distances in any equal intervals of time; the velocity does not change.' },
        { term: 'Velocity', text: 'v = s / t — the distance covered in one second; so s = v · t.' },
        { term: 'Coordinate', text: 'x = x₀ + v · t; with v < 0 the body moves against the axis.' },
        { term: 'Units', text: 'km/h ÷ 3.6 = m/s, m/s × 3.6 = km/h: 72 km/h = 20 m/s.' },
      ],
    },
    move: {
      presetsLabel: 'Ready-made experiments',
      presets: {
        train: { name: 'Train', sub: '72 km/h · 30 s' },
        car: { name: 'Car', sub: '54 km/h · 20 s' },
        back: { name: 'Moving back', sub: 'v = −15 m/s' },
        bike: { name: 'Cyclist', sub: '18 km/h · 30 s' },
      },
      legend: { disp: 'displacement x − x₀', vel: 'velocity v', marks: 'position every 1 s', tape: 'equal gaps' },
      timeChip: (k) => `Time sped up ×${k}`,
      realTime: 'Real time',
      tChip: (t) => `t = ${t} s`,
      sceneLabel: (t, x) => `Side view: a straight road and a measuring ruler. t = ${t} s, x = ${x} m.`,
      axis: 'x, m',
      x0Text: (x) => `x₀ = ${x} m`,
      xTag: (x) => `x = ${x} m`,
      dispTag: (d) => `x − x₀ = ${d} m`,
      vTag: (v) => `v = ${v} m/s`,
      gapTag: (d) => `1 s → ${d} m`,
      secTag: (n) => `${n} s`,
      readouts: { time: 'Time', path: 'Distance', coord: 'Coordinate', formula: 'Formula' },
      timeSub: (T) => `Watched for ${T} s`,
      pathSubFwd: (v, t) => `s = v·t = ${v} · ${t}`,
      pathSubBack: (v, t) => `s = |v|·t = ${v} · ${t}`,
      coordSub: (x0) => `started at x₀ = ${x0} m`,
      formulaSub: 'The coordinate depends on time linearly',
      x0: 'Starting coordinate',
      x0Hint: 'Where the body is at t = 0',
      v: 'Velocity',
      vHint: (kmh) => `= ${kmh} km/h · a minus sign means against the axis`,
      dur: 'Watching time',
      durHint: (k) => (k > 1 ? `About 10 s on screen: time sped up ×${k}` : 'In real time'),
      bars: {
        title: 'Distance covered in each second',
        chip: (d) => `Δs = |v| · 1 s = ${d} m`,
        y: 'Δs, m',
        x: 't, s',
        label: 'Bar chart of the distance covered in each second',
        note: 'Every bar has the same height: equal distances in equal times — the mark of uniform motion.',
      },
      explain: {
        idle: 'Press "Start". Every second the body’s position is marked on the tape. In uniform motion the gaps between the marks are equal.',
        fwd: (d) => `Every second the body covers ${d} m — the gaps on the tape are equal. The velocity does not change: this is straight-line uniform motion.`,
        back: (d) => `The velocity is negative: the body moves against the x axis, and its coordinate drops by ${d} m every second. The distance still grows: s = |v|·t.`,
        rest: (x0) => `v = 0: the body stands still, x = x₀ = ${x0} m does not change. Every mark lands on the same point.`,
        doneFwd: (kmh, v, T, s, x0, x) =>
          `${kmh} km/h = ${v} m/s. In ${T} s the distance is s = v·t = ${v} · ${T} = ${s} m, and the coordinate x = x₀ + v·t = ${x0} + ${s} = ${x} m.`,
        doneBack: (v, T, s, x0, x) =>
          `In ${T} s the body went ${s} m backwards: x = x₀ + v·t = ${x0} + ${v} · ${T} = ${x} m. The distance is still positive: s = |v|·t = ${s} m.`,
        doneRest: (T, x0) => `${T} s passed, but x = ${x0} m did not change: the velocity is zero, and so is the distance.`,
      },
    },
    speeds: {
      racersLabel: 'Racers',
      racers: {
        walker: { name: 'Walker', low: 'the walker', abl: 'the walker' },
        bike: { name: 'Cyclist', low: 'the cyclist', abl: 'the cyclist' },
        car: { name: 'Car', low: 'the car', abl: 'the car' },
        train: { name: 'Train', low: 'the train', abl: 'the train' },
        plane: { name: 'Plane', low: 'the plane', abl: 'the plane' },
      },
      legend: { trail: 'position every 1 s', start: 'start line' },
      timeChip: (k) => `Time sped up ×${k}`,
      realTime: 'Real time',
      tChip: (t) => `t = ${t} s`,
      sceneLabel: (t) => `Race lanes, side view. t = ${t} s.`,
      axis: 's, m',
      start: 'Start',
      laneTag: (name, v, kmh) => `${name} · ${v} m/s = ${kmh} km/h`,
      distTag: (s) => `${s} m`,
      readouts: { time: 'Time', most: 'Longest distance', least: 'Shortest distance', ratio: 'Speed ratio' },
      timeSub: (T) => `Everyone moves for ${T} s`,
      ratioSub: 'The distances have the same ratio',
      race: 'Moving time',
      raceHint: (k) => (k > 1 ? `About 10 s on screen: time sped up ×${k}` : 'In real time'),
      conv: {
        title: 'Converting units',
        pick: 'Whose speed?',
        custom: 'Other',
        slider: 'Speed',
        divide: (d) => `÷ ${d}`,
        multiply: (d) => `× ${d}`,
        toMs: 'km/h → m/s',
        toKmh: 'm/s → km/h',
        line1: (kmh, metres, v) => `${kmh} km/h = ${metres} m / 3600 s = ${v} m/s`,
        line2: (d, v, kmh) => `1 m/s = 3600 m / 1 h = ${d} km/h, so ${v} m/s · ${d} = ${kmh} km/h`,
        meaning: (v, kmh) => `What it means: ${v} m every second, ${kmh} km every hour.`,
      },
      explain: {
        none: 'Choose at least one racer.',
        idle: (T) => `Everyone sets off at the same moment and moves for the same time — ${T} s. Watch how far each one gets.`,
        running: 'Each racer covers a distance equal to its speed every second: the gap between dots is the distance in one second, and it never changes.',
        plane: 'The plane flies at 250 m/s = 900 km/h — at this scale everyone else seems to stand still.',
        done: (T, fast, fastS, slow, slowS, ratio) =>
          `In ${T} s ${fast.low} covered ${fastS} m and ${slow.low} ${slowS} m: s = v·t. ${fast.low.charAt(0).toUpperCase()}${fast.low.slice(1)} is ${ratio} times as fast as ${slow.abl}.`,
        single: (r, v, T, s) => `${r.name}: s = v·t = ${v} · ${T} = ${s} m.`,
      },
    },
  },
};

/* ================================================================== card */

export default function UniformMotion() {
  const T = useSimText(TEXT);
  const c = T.card;
  return (
    <SimCard
      idPrefix="um"
      eyebrow={c.eyebrow}
      title={c.title}
      tabsLabel={c.tabsLabel}
      tabs={[
        { id: 'move', label: c.tabs.move.label, sub: c.tabs.move.sub, icon: Car, render: () => <MotionSim T={T} /> },
        { id: 'speeds', label: c.tabs.speeds.label, sub: c.tabs.speeds.sub, icon: Gauge, render: () => <SpeedsSim T={T} /> },
      ]}
      facts={T.facts}
    />
  );
}

/* ======================================================== uniform motion */

const PRESETS = [
  { id: 'train', kind: 'train', x0: 0, v: 20, dur: 30, icon: TrainFront },
  { id: 'car', kind: 'car', x0: 50, v: 15, dur: 20, icon: Car },
  { id: 'back', kind: 'car', x0: 300, v: -15, dur: 20, icon: MoveLeft },
  { id: 'bike', kind: 'bike', x0: 0, v: 5, dur: 30, icon: Bike },
];
const VEHICLE = {
  train: { len: [74, 104], color: '#4f46e5', h: 0.48 },
  car: { len: [60, 80], color: '#f59e0b', h: 0.46 },
  bike: { len: [42, 54], color: '#0d9488', h: 0.92 },
};
const IDLE = { t: 0, running: false, done: false };
const C = PALETTE;

function MotionSim({ T }) {
  const t = T.move;
  const dec = T.decimal;
  const [kind, setKind] = useState('train');
  const [x0, setX0] = useState(0);
  const [v, setV] = useState(20);
  const [dur, setDur] = useState(30);
  const [sim, setSim] = useState(IDLE);
  const speedUp = dur / 10;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const tt = p.t + dt * speedUp;
      if (tt >= dur) return { t: dur, running: false, done: true };
      return { ...p, t: tt };
    });
  });

  const pick = (id) => {
    const p = PRESETS.find((q) => q.id === id);
    setKind(p.kind);
    setX0(p.x0);
    setV(p.v);
    setDur(p.dur);
    setSim(IDLE);
  };
  const change = (setter) => (val) => {
    setter(val);
    setSim(IDLE);
  };
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const active = PRESETS.find((p) => p.x0 === x0 && p.v === v && p.dur === dur && p.kind === kind)?.id ?? null;

  /* physics: x = x₀ + v·t, s = |v|·t */
  const time = sim.t;
  // printed numbers use the time as printed (0.1 s), so the arithmetic on screen adds up
  const tR = Math.round(time * 10) / 10;
  const x = x0 + v * tR;
  const s = Math.abs(v) * tR;

  /* numbers as they are printed */
  const A = (n) => nfa(n, 1, dec);
  const F1 = (n) => nf(n, 1, dec);

  let key = 'idle';
  if (sim.done) key = v > 0 ? 'doneFwd' : v < 0 ? 'doneBack' : 'doneRest';
  else if (time > 0 || sim.running) key = v > 0 ? 'fwd' : v < 0 ? 'back' : 'rest';
  const settled = useSettled(key, key === 'idle' || key.startsWith('done') ? 0 : 300);
  const ex = t.explain;
  const xEnd = x0 + v * dur;
  const text = {
    idle: ex.idle,
    fwd: ex.fwd(A(Math.abs(v))),
    back: ex.back(A(Math.abs(v))),
    rest: ex.rest(A(x0)),
    doneFwd: ex.doneFwd(A(v * 3.6), A(v), A(dur), A(Math.abs(v) * dur), A(x0), A(xEnd)),
    doneBack: ex.doneBack(paren(A(v)), A(dur), A(Math.abs(v) * dur), A(x0), A(xEnd)),
    doneRest: ex.doneRest(A(dur), A(x0)),
  }[settled];
  const tone = settled.startsWith('done') ? '#34d399' : settled === 'back' ? '#60a5fa' : settled === 'rest' ? '#fbbf24' : '#22d3ee';

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{t.presetsLabel}</p>
          <Segmented
            label={t.presetsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={active}
            onChange={pick}
            options={PRESETS.map((p) => ({ value: p.id, label: t.presets[p.id].name, sub: t.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={sim.running ? Pause : Play} onClick={toggle} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
            {sim.running ? T.common.pause : sim.done ? T.common.again : time > 0 ? T.common.resume : T.common.start}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={time === 0 && !sim.running} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
      </div>

      <MotionScene t={t} dec={dec} kind={kind} x0={x0} v={v} dur={dur} time={time} done={sim.done} speedUp={speedUp} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.time} symbol="t" value={fmt(time, 1, dec)} unit={T.s} accent={C.time} textColor="#a5f3fc" sub={t.timeSub(A(dur))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(time / dur) * 100}%` }} />
          </div>
        </Readout>
        <Readout
          label={t.readouts.path}
          symbol="s"
          value={fmt(s, 1, dec)}
          unit={T.m}
          accent={C.path}
          textColor={C.pathText}
          sub={v < 0 ? t.pathSubBack(A(Math.abs(v)), fmt(time, 1, dec)) : t.pathSubFwd(A(v), fmt(time, 1, dec))}
        />
        <Readout label={t.readouts.coord} symbol="x" value={F1(x)} unit={T.m} accent={C.disp} textColor={C.dispText} sub={t.coordSub(A(x0))} />
        <Readout label={t.readouts.formula} accent={C.vel} sub={t.formulaSub}>
          <p className="mt-1.5 text-lg font-semibold italic tracking-wide text-gray-300">x = x₀ + v·t</p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums leading-snug text-white">
            x = {A(x0)} + {paren(A(v))} · {fmt(time, 1, dec)} = <span style={{ color: C.dispText }}>{F1(x)}</span> {T.m}
          </p>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className={`lg:col-span-2 space-y-3 ${PANEL}`}>
          <RangeField
            id="um-x0"
            label={t.x0}
            symbol="x₀"
            min={-200}
            max={400}
            step={10}
            value={x0}
            onChange={change(setX0)}
            accent={C.disp}
            display={`${A(x0)} ${T.m}`}
            hint={t.x0Hint}
          />
          <RangeField
            id="um-v"
            label={t.v}
            symbol="v"
            min={-30}
            max={30}
            step={0.5}
            value={v}
            onChange={change(setV)}
            accent={C.vel}
            display={`${A(v)} ${T.ms}`}
            hint={t.vHint(A(v * 3.6))}
          />
          <RangeField
            id="um-dur"
            label={t.dur}
            symbol="t"
            min={10}
            max={60}
            step={10}
            value={dur}
            onChange={change(setDur)}
            accent={C.time}
            display={`${A(dur)} ${T.s}`}
            hint={t.durHint(A(speedUp))}
          />
        </div>
        <div className={`lg:col-span-3 ${PANEL}`}>
          <SecondBars t={t.bars} v={v} dur={dur} time={time} dec={dec} />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function MotionScene({ t, dec, kind, x0, v, dur, time, done, speedUp }) {
  const xEnd = x0 + v * dur;
  let lo = Math.min(0, x0, xEnd);
  let hi = Math.max(0, x0, xEnd);
  if (hi - lo < 40) {
    const mid = (hi + lo) / 2;
    lo = mid - 20;
    hi = mid + 20;
  }
  const x = x0 + v * time;
  const xR = x0 + v * (Math.round(time * 10) / 10);
  const A = (n) => nfa(n, 1, dec);
  const veh = VEHICLE[kind];

  const legend = [
    { color: C.disp, label: t.legend.disp, kind: 'arrow' },
    { color: C.vel, label: t.legend.vel, kind: 'arrow' },
    { color: C.path, label: t.legend.marks, kind: 'dot' },
    { color: C.path, label: t.legend.tape, kind: 'area' },
  ];
  const chips = (
    <>
      <SceneChip icon={Timer} strong tone="#0891b2">
        {t.tChip(fmt(time, 1, dec))}
      </SceneChip>
      <SceneChip icon={Timer}>{speedUp > 1 ? t.timeChip(A(speedUp)) : t.realTime}</SceneChip>
    </>
  );

  return (
    <ScenePanel height={(W, narrow) => (narrow ? 328 : 352)} ariaLabel={t.sceneLabel(fmt(time, 1, dec), A(xR))} legend={legend} chips={chips}>
      {(W, H, narrow) => {
        const len = veh.len[narrow ? 0 : 1];
        const vehH = len * veh.h;
        const padX = len / 2 + (narrow ? 16 : 28);
        const X = (m) => padX + ((m - lo) / (hi - lo)) * (W - 2 * padX);
        const pxPerM = (W - 2 * padX) / (hi - lo);
        const Y = narrow
          ? { disp: 102, gnd: 188, tape: 220, tapeH: 13, lbl: 248, rule: 272, num: 290, xTag: 312 }
          : { disp: 104, gnd: 206, tape: 240, tapeH: 15, lbl: 270, rule: 294, num: 314, xTag: 336 };
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        const facing = v < 0 ? -1 : 1;

        /* ruler ticks */
        const step = tickStep(hi - lo, W - 2 * padX, narrow ? 46 : 70);
        const ticks = [];
        for (let m = Math.ceil(lo / step) * step; m <= hi + 1e-9; m += step) ticks.push(m);
        const minor = step / 5;
        const minorTicks = [];
        if (minor * pxPerM >= 7) for (let m = Math.ceil(lo / minor) * minor; m <= hi + 1e-9; m += minor) minorTicks.push(m);

        /* one mark per whole second */
        const nMarks = Math.floor(time + 1e-9);
        const marks = Array.from({ length: nMarks + 1 }, (_, n) => ({ n, x: x0 + v * n }));
        const gapPx = Math.abs(v) * pxPerM;
        const every = [1, 2, 5, 10, 15, 30, 60].find((e) => e * gapPx >= (narrow ? 26 : 32)) ?? 60;

        const ruleL = padX - (narrow ? 10 : 16);
        const ruleR = W - padX + (narrow ? 10 : 16);
        const X0 = X(x0);
        const Xx = X(x);
        const velLen = clamp(2.2 * Math.abs(v), 16, 70);
        const velY = Y.gnd - vehH - (narrow ? 12 : 16);
        const showVel = !done && Math.abs(v) > 1e-9;
        const dispLen = Math.abs(Xx - X0);

        return (
          <g>
            <defs>
              <linearGradient id="um-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#eef4ff" />
              </linearGradient>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            <rect width={W} height={Y.gnd} fill="url(#um-sky)" />
            {ticks.map((m) => (
              <line key={`g${m}`} x1={X(m)} x2={X(m)} y1={0} y2={Y.rule} stroke={Math.abs(m) < 1e-9 ? '#cbd5e1' : '#e2e8f0'} strokeWidth="1" />
            ))}

            {/* the track */}
            {kind === 'train' ? (
              <g>
                <rect x={0} y={Y.gnd + 2} width={W} height={10} fill="#d6d3d1" />
                {Array.from({ length: Math.ceil(W / 9) + 1 }, (_, i) => (
                  <rect key={i} x={i * 9} y={Y.gnd + 1} width={4} height={4} fill="#78716c" />
                ))}
                <rect x={0} y={Y.gnd - 2} width={W} height={3} fill="#475569" />
              </g>
            ) : (
              <g>
                <rect x={0} y={Y.gnd} width={W} height={9} fill="#475569" />
                <line x1={0} x2={W} y1={Y.gnd + 4.5} y2={Y.gnd + 4.5} stroke="#f8fafc" strokeWidth="1.3" strokeDasharray="10 9" />
                <rect x={0} y={Y.gnd + 9} width={W} height={7} fill="#e7e5e4" />
              </g>
            )}

            {/* the tape: a mark every second, equal gaps shaded alternately */}
            <rect x={ruleL} y={Y.tape} width={ruleR - ruleL} height={Y.tapeH} rx={3} fill="#fefce8" stroke="#e5e0a8" />
            {marks.slice(1).map((m, i) => {
              const a = X(marks[i].x);
              const b = X(m.x);
              return (
                <rect
                  key={`seg${m.n}`}
                  x={Math.min(a, b)}
                  y={Y.tape + 1}
                  width={Math.abs(b - a)}
                  height={Y.tapeH - 2}
                  fill={C.path}
                  fillOpacity={i % 2 === 0 ? 0.26 : 0.1}
                />
              );
            })}
            {time > 0 && nMarks < dur && (
              <rect
                x={Math.min(X(marks[nMarks].x), Xx)}
                y={Y.tape + 1}
                width={Math.abs(Xx - X(marks[nMarks].x))}
                height={Y.tapeH - 2}
                fill={C.path}
                fillOpacity={nMarks % 2 === 0 ? 0.26 : 0.1}
                strokeDasharray="2 2"
              />
            )}
            {marks.map((m) => (
              <circle key={`d${m.n}`} cx={X(m.x)} cy={Y.tape + Y.tapeH / 2} r={narrow ? 2.6 : 3.2} fill={C.path} stroke="#fff" strokeWidth="1" />
            ))}
            {marks
              .filter((m) => m.n % every === 0 && (gapPx > 0 || m.n === 0))
              .map((m) => (
                <text key={`l${m.n}`} x={X(m.x)} y={Y.lbl} textAnchor="middle" fontSize={fs - 1} fill="#6d28d9" fontWeight={m.n === 0 ? 700 : 500}>
                  {t.secTag(m.n)}
                </text>
              ))}
            {nMarks >= 1 && gapPx >= 12 && (
              <g>
                {(() => {
                  // the last whole second but one, so the label stays clear of the body's own mark
                  const j = nMarks >= 2 ? nMarks - 1 : 1;
                  const a = X(marks[j - 1].x);
                  const b = X(marks[j].x);
                  const yB = Y.tape - 5;
                  return (
                    <>
                      <path d={`M${a},${yB + 3} L${a},${yB} L${b},${yB} L${b},${yB + 3}`} fill="none" stroke={C.path} strokeWidth="1.5" />
                      <Pill x={(a + b) / 2} y={yB - 11} text={t.gapTag(A(Math.abs(v)))} bg="#fff" color="#6d28d9" border="#ddd6fe" size={fs - 1} box={box} />
                    </>
                  );
                })()}
              </g>
            )}

            {/* ruler = x axis */}
            <line x1={ruleL} x2={ruleR} y1={Y.rule} y2={Y.rule} stroke="#334155" strokeWidth="1.6" />
            <path d={`M${ruleR + 9},${Y.rule} L${ruleR},${Y.rule - 4.5} L${ruleR},${Y.rule + 4.5} Z`} fill="#334155" />
            {minorTicks.map((m) => (
              <line key={`mt${m}`} x1={X(m)} x2={X(m)} y1={Y.rule} y2={Y.rule + 4} stroke="#94a3b8" />
            ))}
            {ticks.map((m) => (
              <g key={`t${m}`}>
                <line x1={X(m)} x2={X(m)} y1={Y.rule} y2={Y.rule + 8} stroke="#334155" strokeWidth="1.3" />
                <text x={X(m)} y={Y.num} textAnchor="middle" fontSize={fs - 1} fill={Math.abs(m) < 1e-9 ? '#0f172a' : '#64748b'} fontWeight={Math.abs(m) < 1e-9 ? 700 : 400}>
                  {nf(m, 0, dec)}
                </text>
              </g>
            ))}
            <text x={W - 6} y={Y.rule - 8} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
              {t.axis}
            </text>

            {/* starting point x₀ */}
            <line x1={X0} x2={X0} y1={Y.disp - 9} y2={Y.rule} stroke={C.ink} strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="3 4" />
            <path d={`M${X0},${Y.rule - 1} L${X0 - 5},${Y.rule - 9} L${X0 + 5},${Y.rule - 9} Z`} fill={C.ink} />
            <text x={X0} y={Y.disp + 22} textAnchor={X0 < 50 ? 'start' : X0 > W - 50 ? 'end' : 'middle'} fontSize={fs} fontWeight="700" fill={C.ink} stroke="#fff" strokeWidth="3" paintOrder="stroke">
              {t.x0Text(A(x0))}
            </text>

            {/* displacement */}
            {dispLen > 4 && <Arrow2 x1={X0} x2={Xx} y={Y.disp} color={C.disp} width={narrow ? 3 : 3.5} />}
            {dispLen > 4 && <Pill x={(X0 + Xx) / 2} y={Y.disp - 18} text={t.dispTag(nf(xR - x0, 1, dec))} bg={C.disp} size={fs} box={box} />}

            {/* the vehicle, its point and its projection on the ruler */}
            <line x1={Xx} x2={Xx} y1={Y.gnd + 2} y2={Y.rule} stroke={C.disp} strokeWidth="1.3" strokeDasharray="3 3" />
            <Vehicle kind={kind} x={Xx} y={Y.gnd - (kind === 'train' ? 2 : 0)} len={len} facing={facing} color={veh.color} phase={(x / 2) * facing} moving />
            <circle cx={Xx} cy={Y.gnd + (kind === 'train' ? -1 : 4)} r={narrow ? 3 : 3.6} fill={C.ink} stroke="#fff" strokeWidth="1.6" />
            <circle cx={Xx} cy={Y.rule} r={4.5} fill={C.disp} stroke="#fff" strokeWidth="1.6" />
            <Pill x={Xx} y={Y.xTag} text={t.xTag(nf(xR, 1, dec))} bg={C.disp} size={fs} box={box} />

            {/* velocity */}
            {showVel && <Arrow2 x1={Xx} x2={Xx + facing * velLen} y={velY} color={C.vel} width={3} head={10} />}
            {showVel && <Pill x={Xx + facing * (velLen / 2)} y={velY - 16} text={t.vTag(A(v))} bg={C.vel} size={fs - 1} box={box} />}
          </g>
        );
      }}
    </ScenePanel>
  );
}

/** Horizontal arrow (kit Arrow with fixed y). */
function Arrow2({ x1, x2, y, color, width = 3, head = 12 }) {
  const len = Math.abs(x2 - x1);
  if (len < 2) return null;
  const d = Math.sign(x2 - x1);
  const h = Math.min(head, len * 0.7);
  return (
    <g>
      <line x1={x1} y1={y} x2={x2 - d * (h - 0.5)} y2={y} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={`M${x2},${y} L${x2 - d * h},${y - h * 0.5} L${x2 - d * h},${y + h * 0.5} Z`} fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" />
    </g>
  );
}

/* ------------------------------------------------- distance in each second */

function SecondBars({ t, v, dur, time, dec }) {
  const [ref, { width }] = useElementSize();
  const H = 196;
  const pad = { l: 40, r: 12, t: 20, b: 26 };
  const W = Math.max(width, 220);
  const sv = Math.abs(v);
  const raw = Math.max(sv, 1) * 1.3;
  const p10 = 10 ** Math.floor(Math.log10(raw));
  const yMax = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p10).find((m) => m >= raw);
  const bw = (W - pad.l - pad.r) / dur;
  const gx = (s) => pad.l + s * bw;
  const gy = (d) => H - pad.b - (d / yMax) * (H - pad.t - pad.b);
  const whole = Math.floor(time + 1e-9);
  const part = time - whole;
  const barW = Math.max(2, bw * 0.68);
  const A = (n) => nfa(n, 1, dec);
  const xEvery = dur <= 10 ? 1 : dur <= 30 ? 5 : 10;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{t.title}</p>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#a78bfa' }} /> {t.chip(A(sv))}
        </span>
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.label} className="block overflow-visible">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(f * yMax)} y2={gy(f * yMax)} stroke={f === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(f * yMax) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {A(f * yMax)}
              </text>
            </g>
          ))}
          {Array.from({ length: Math.floor(dur / xEvery) + 1 }, (_, i) => i * xEvery).map((s) => (
            <text key={s} x={gx(s)} y={H - 7} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {s}
            </text>
          ))}
          <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
            {t.x}
          </text>
          <text x={pad.l + 6} y={pad.t - 8} fontSize="11" fill="#64748b">
            {t.y}
          </text>
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {sv > 0 && (
            <line x1={pad.l} x2={W - pad.r} y1={gy(sv)} y2={gy(sv)} stroke="#a78bfa" strokeOpacity="0.35" strokeDasharray="4 4" />
          )}
          {Array.from({ length: whole }, (_, i) => (
            <g key={i}>
              <rect x={gx(i) + (bw - barW) / 2} y={gy(sv)} width={barW} height={gy(0) - gy(sv)} rx={Math.min(3, barW / 3)} fill="#a78bfa" />
              {bw >= 26 && sv > 0 && (
                <text x={gx(i) + bw / 2} y={gy(sv) - 5} textAnchor="middle" fontSize="10" fill="#c4b5fd">
                  {A(sv)}
                </text>
              )}
            </g>
          ))}
          {whole < dur && part > 0 && sv > 0 && (
            <rect x={gx(whole) + (bw - barW) / 2} y={gy(sv * part)} width={barW} height={gy(0) - gy(sv * part)} rx={Math.min(3, barW / 3)} fill="#a78bfa" fillOpacity="0.45" />
          )}
        </svg>
      </div>
      <p className="mt-1 text-xs text-gray-500">{t.note}</p>
    </div>
  );
}
