import { useState } from 'react';
import { Building2, Crosshair, LampDesk, Lightbulb, Mountain, Spline, Target, Equal } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { Arrow, Explain, Pill, RangeField, Readout, Segmented, fmt, niceStep, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { useSimText } from '../kit/lang';
import {
  AxisX,
  AxisY,
  Ball,
  COL,
  Chip,
  DimLine,
  FormulaTile,
  G,
  GroupLabel,
  Label,
  LabScene,
  PlayControls,
  Rich,
  SceneGrid,
  Soil,
  StrobeRing,
  Sym,
  VelScale,
  VelocityArrows,
  fitView,
  flightTime,
  len,
  num,
  slowFactor,
  strobeStep,
  trim,
} from './HorizontalThrow.parts';
import DropSim from './HorizontalThrow.drop';
import TargetSim from './HorizontalThrow.target';

/**
 * Lesson "Gorizontal otilgan jismning harakati" (Dynamics, lesson 10).
 * No air resistance; g = 9.8 m/s².
 *  1. Two independent motions: uniform along x (x = v₀t) and free fall along
 *     y (y = h − gt²/2). Stroboscope marks every Δt, their projections on both
 *     axes (equal steps on x, 1 : 3 : 5 : 7 on y), the velocity and its
 *     components, t = √(2h/g), L = v₀·t, v = √(v₀² + (gt)²).
 *     Preset h = 20 m, v₀ = 10 m/s → t = 2.02 s, L = 20.2 m, v = 22.2 m/s.
 *  2. Drop vs throw: a dropped ball and balls thrown horizontally at the same
 *     moment stay level and land together, whatever v₀ is.
 *  3. Target game: choose the helicopter's speed so a package released over a
 *     mark lands on a target D metres away (L = v₀·√(2h/g)).
 */

const TEXT = {
  uz: {
    card: {
      eyebrow: 'Virtual laboratoriya · Dinamika',
      title: 'Gorizontal otilgan jismning harakati',
      tabsLabel: 'Tajribani tanlang',
      tabs: {
        throw: { label: 'Ikki harakat', sub: 'x = v₀t · y = h − gt²/2' },
        drop: { label: 'Tashlash va otish', sub: 'Bir vaqtda tushadi' },
        target: { label: 'Nishonga tashlash', sub: 'L = v₀·√(2h/g)' },
      },
    },
    common: {
      start: 'Boshlash',
      pause: "To'xtatish",
      resume: 'Davom etish',
      again: 'Yana boshlash',
      reset: 'Qayta',
      presets: 'Tayyor holatlar',
      chipReal: 'Real vaqt',
      chipSlow: (k) => `Vaqt ${k} marta sekinlashtirilgan`,
      kmh: (k) => `≈ ${k} km/soat`,
      vScale: (v) => `${v} m/s`,
    },
    facts: {
      title: 'Eslab qoling',
      items: [
        {
          term: 'Ikki mustaqil harakat',
          text: "gorizontal bo'ylab — tekis harakat (x = v₀t), vertikal bo'ylab — erkin tushish (y = h − gt²/2). Havo qarshiligi hisobga olinmaydi.",
        },
        { term: 'Uchish vaqti', text: 't = √(2h/g) — faqat balandlikka bog‘liq, boshlang‘ich tezlik v₀ ga bog‘liq emas.' },
        { term: 'Uchish uzoqligi', text: 'L = v₀·t = v₀·√(2h/g): bir xil balandlikda v₀ necha marta ortsa, L ham shuncha marta ortadi.' },
        { term: 'Tezlik', text: "gorizontal tashkil etuvchisi v₀ o'zgarmaydi, vertikali gt ga teng; v = √(v₀² + (gt)²). Trayektoriya — parabola." },
      ],
    },
    throw: {
      presets: {
        cliff: { name: 'Jarlikdan', sub: 'h = 20 m · v₀ = 10 m/s' },
        tower: { name: 'Minoradan', sub: 'h = 45 m · v₀ = 15 m/s' },
        table: { name: 'Stol ustidan', sub: 'h = 1 m · v₀ = 2 m/s' },
      },
      h: 'Balandlik',
      v0: "Boshlang'ich tezlik",
      scrub: 'Vaqt',
      hHint: (t) => `Uchish vaqti t = √(2h/g) = ${t} s`,
      v0Hint: (k) => `≈ ${k} km/soat, gorizontal yo'nalgan`,
      scrubHint: "Surgichni suring — istalgan paytdagi o'rin va tezlikni ko'ring",
      legend: {
        path: 'trayektoriya',
        strobe: (dt) => `har ${dt} s dagi o'rni`,
        v: 'tezlik v, v_x, v_y',
        g: 'tezlanish g',
        proj: "o'qlarga proyeksiyalar",
      },
      axisX: 'x, m',
      axisY: 'y, m',
      hTag: (h) => `h = ${h} m`,
      LTag: (L) => `L = ${L} m`,
      secTag: (t) => `${t} s`,
      sceneLabel: (t, x, y, v) => `Gorizontal otilgan shar. t = ${t} s, x = ${x} m, y = ${y} m, tezlik ${v} m/s.`,
      tri: { title: 'Tezlik uchburchagi', unit: 'm/s' },
      readouts: { t: 'Vaqt', x: 'Gorizontal', y: 'Vertikal', v: 'Tezlik' },
      tSub: (tf) => `Uchish vaqti ${tf} s`,
      xSub: (v) => `v_x = ${v} m/s — o'zgarmaydi`,
      ySub: (v) => `v_y = g·t = ${v} m/s`,
      vSub: (a) => `gorizontga ${a}° burchak ostida`,
      formulas: { tf: 'Uchish vaqti', L: 'Uchish uzoqligi', v: 'Yerga tushishdagi tezlik' },
      chart: {
        title: (dt) => `Har Δt = ${dt} s dagi ko'chishlar`,
        dx: 'Δx — gorizontal',
        dy: 'Δy — vertikal',
        interval: 'oraliq',
        xLine: 'teng — tekis harakat',
        yLine: "toq sonlar kabi o'sadi — erkin tushish",
        label: "Teng vaqt oraliqlaridagi gorizontal va vertikal ko'chishlar diagrammasi",
      },
      explain: {
        idle: "«Boshlash»ni bosing. Shar gorizontal v₀ tezlik bilan uchib chiqadi. Ko'k nuqtalar — uning x o'qidagi proyeksiyasi, pushti nuqtalar — y o'qidagi proyeksiyasi.",
        zero: "v₀ = 0: shar shunchaki tik pastga tushadi — bu erkin tushish. v₀ ni oshirib ko'ring: tushish vaqti o'zgarmaydi.",
        horiz: (v) =>
          `Gorizontal yo'nalishda jismga hech qanday kuch ta'sir qilmaydi, shuning uchun v_x = v₀ = ${v} m/s o'zgarmaydi: ko'k proyeksiyalar teng oraliqlarda.`,
        vert: "Vertikal yo'nalishda faqat og'irlik kuchi ta'sir qiladi: shar erkin tushadi, v_y = g·t ortib boradi. Pushti proyeksiyalar orasidagi masofalar 1 : 3 : 5 : … kabi o'sadi.",
        paused: (t, vx, vy, v) => `t = ${t} s paytda: v_x = ${vx} m/s, v_y = ${vy} m/s, v = √(v_x² + v_y²) = ${v} m/s.`,
        landed: (tf, L, v, a) =>
          `Shar t = ${tf} s da yerga tushdi, uchish uzoqligi L = v₀·t = ${L} m. Tushishdagi tezlik ${v} m/s, gorizontga ${a}° burchak ostida.`,
        lesson: 'Misol: h = 20 m, v₀ = 10 m/s. t = √(2·20/9.8) ≈ 2.02 s, L = 10·2.02 ≈ 20.2 m, v = √(10² + 19.8²) ≈ 22.2 m/s.',
      },
    },
    drop: {
      h: 'Balandlik',
      v0: 'Otilgan sharning tezligi',
      ballsLabel: 'Otilgan sharlar',
      balls: { one: { name: 'Bitta', sub: 'v₀' }, two: { name: 'Ikkita', sub: 'v₀ va 2v₀' } },
      legend: {
        drop: 'tashlangan shar (v₀ = 0)',
        throw1: 'otilgan shar (v₀)',
        throw2: 'otilgan shar (2v₀)',
        same: "bir paytdagi o'rinlar",
        v: 'tezlik v',
      },
      axisX: 'x, m',
      axisY: 'y, m',
      secTag: (t) => `${t} s`,
      sceneLabel: (t, y) => `Bir xil balandlikdan bir paytda tashlangan va gorizontal otilgan sharlar. t = ${t} s, balandligi ${y} m.`,
      readouts: { t: 'Vaqt', y: 'Balandlik', drop: 'Tashlangan shar', throw: 'Otilgan shar' },
      tSub: (tf) => `hammasi ${tf} s da tushadi`,
      ySub: 'har paytda hammasida bir xil',
      dropSub: (vy) => `x = 0 · v_y = ${vy} m/s`,
      throwSub: (x, vy) => `x = ${x} m · v_y = ${vy} m/s`,
      formula: { tag: 'Tushish vaqti', note: "Formulada v₀ yo'q: har qanday gorizontal tezlikda tushish vaqti bir xil." },
      graph: {
        title: 'Balandlik grafigi y(t)',
        t: 't, s',
        y: 'y, m',
        note: "Grafiklar ustma-ust tushadi: vertikal harakat v₀ ga bog'liq emas.",
        label: "Sharlar balandligining vaqtga bog'liqlik grafigi",
        drop: 'tashlangan',
        throw1: 'otilgan (v₀)',
        throw2: 'otilgan (2v₀)',
      },
      explain: {
        idle: "Sharlar bir xil balandlikdan bir paytda harakatlanadi: biri shunchaki qo'yib yuboriladi, boshqasi gorizontal otiladi. Qaysi biri yerga oldin tushadi? «Boshlash»ni bosing.",
        flying: "Kesik chiziqlar gorizontal: har bir paytda sharlar bir xil balandlikda. Vertikal bo'ylab hammasi bir xil erkin tushmoqda — gorizontal harakat bunga xalal bermaydi.",
        zero: "v₀ = 0 bo'lsa, otilgan shar ham tik tushadi va tashlangan shar bilan bir xil harakat qiladi. v₀ ni oshiring.",
        paused: "Pauza: sharlar bir xil balandlikda turibdi — istalgan paytda shunday bo'ladi.",
        landed: (t, L) => `Sharlar bir vaqtda — t = ${t} s da yerga tegdi. Otilgan shar ${L} m uzoqqa uchdi, lekin buning uchun ortiqcha vaqt sarflamadi.`,
        landed2: (t, L1, L2) =>
          `Uchala shar ham t = ${t} s da yerga tegdi. Otilgan sharlar ${L1} m va ${L2} m uchdi: v₀ ikki marta katta bo'lsa, uchish uzoqligi ham ikki marta katta.`,
      },
    },
    target: {
      missionsLabel: 'Topshiriq',
      missions: {
        m1: { name: '1-nishon', sub: 'h = 20 m · D = 40 m' },
        m2: { name: '2-nishon', sub: 'h = 45 m · D = 120 m' },
        m3: { name: '3-nishon', sub: 'h = 80 m · D = 240 m' },
        rnd: { name: 'Tasodifiy', sub: 'yangi shartlar' },
      },
      rndSub: (h, D) => `h = ${h} m · D = ${D} m`,
      drop: 'Yukni tashlash',
      v0: 'Vertolyot tezligi',
      legend: { path: 'yuk trayektoriyasi', target: 'nishon', under: 'yuk vertolyot ostida', v: 'yuk tezligi v' },
      release: 'tashlash nuqtasi',
      DTag: (D) => `D = ${D} m`,
      LTag: (L) => `L = ${L} m`,
      axisX: 'x, m',
      axisY: 'y, m',
      hitTag: 'Tegdi!',
      score: (h, n) => `Tegdi: ${h} / ${n}`,
      sceneLabel: (h, D, x, y) => `Vertolyot ${h} m balandlikda uchmoqda, nishon ${D} m narida. Yuk: x = ${x} m, y = ${y} m.`,
      readouts: { h: 'Balandlik', D: 'Nishongacha', t: 'Tushish vaqti', L: 'Uchish uzoqligi' },
      hSub: 'vertolyot shu balandlikda uchadi',
      DSub: (tol) => `tashlash nuqtasidan · ± ${tol} m`,
      tSub: (tf) => `t = √(2h/g) = ${tf} s`,
      LSub: { idle: "yuk tushgach o'lchanadi", hit: 'nishonga tegdi', short: (d) => `${d} m yetmadi`, long: (d) => `${d} m o'tib ketdi` },
      formula: { L: 'Uchish uzoqligi', need: 'Kerakli tezlik' },
      log: { title: 'Urinishlar', empty: "Hali urinish yo'q. Tezlikni tanlang va yukni tashlang.", hit: 'tegdi', short: 'yetmadi', long: "o'tib ketdi" },
      hint: 'Maslahat: L = v₀·t, bu yerda t = √(2h/g). Demak, v₀ = D / t.',
      explain: {
        idle: (h, D) =>
          `Vertolyot h = ${h} m balandlikda gorizontal uchmoqda. Yuk tashlash nuqtasidan D = ${D} m naridagi nishonga tushishi uchun tezlikni tanlang va «Yukni tashlash»ni bosing.`,
        approach: 'Vertolyot tashlash nuqtasiga yaqinlashmoqda…',
        falling: "Yuk vertolyot bilan bir xil gorizontal tezlikka ega, shuning uchun har doim uning ostida qoladi (havo qarshiligi yo'q).",
        hit: (L) => `Barakalla! Yuk L = ${L} m uchib, nishonga tushdi.`,
        short: (d) => `Yuk nishongacha ${d} m yetmadi — tezlikni oshiring: uchish uzoqligi v₀ ga to'g'ri proporsional.`,
        long: (d) => `Yuk nishondan ${d} m o'tib ketdi — tezlikni kamaytiring.`,
      },
    },
  },

  ru: {
    card: {
      eyebrow: 'Виртуальная лаборатория · Динамика',
      title: 'Движение тела, брошенного горизонтально',
      tabsLabel: 'Выберите опыт',
      tabs: {
        throw: { label: 'Два движения', sub: 'x = v₀t · y = h − gt²/2' },
        drop: { label: 'Уронить и бросить', sub: 'Падают одновременно' },
        target: { label: 'Сброс на цель', sub: 'L = v₀·√(2h/g)' },
      },
    },
    common: {
      start: 'Запустить',
      pause: 'Пауза',
      resume: 'Продолжить',
      again: 'Ещё раз',
      reset: 'Сброс',
      presets: 'Готовые примеры',
      chipReal: 'Реальное время',
      chipSlow: (k) => `Время замедлено в ${k} раз${k === '2' || k === '4' ? 'а' : ''}`,
      kmh: (k) => `≈ ${k} км/ч`,
      vScale: (v) => `${v} м/с`,
    },
    facts: {
      title: 'Запомните',
      items: [
        {
          term: 'Два независимых движения',
          text: 'по горизонтали — равномерное (x = v₀t), по вертикали — свободное падение (y = h − gt²/2). Сопротивление воздуха не учитываем.',
        },
        { term: 'Время полёта', text: 't = √(2h/g) — зависит только от высоты и не зависит от начальной скорости v₀.' },
        { term: 'Дальность полёта', text: 'L = v₀·t = v₀·√(2h/g): при той же высоте во сколько раз больше v₀, во столько раз больше L.' },
        { term: 'Скорость', text: 'горизонтальная составляющая v₀ не меняется, вертикальная равна gt; v = √(v₀² + (gt)²). Траектория — парабола.' },
      ],
    },
    throw: {
      presets: {
        cliff: { name: 'С обрыва', sub: 'h = 20 м · v₀ = 10 м/с' },
        tower: { name: 'С башни', sub: 'h = 45 м · v₀ = 15 м/с' },
        table: { name: 'Со стола', sub: 'h = 1 м · v₀ = 2 м/с' },
      },
      h: 'Высота',
      v0: 'Начальная скорость',
      scrub: 'Время',
      hHint: (t) => `Время полёта t = √(2h/g) = ${t} с`,
      v0Hint: (k) => `≈ ${k} км/ч, направлена горизонтально`,
      scrubHint: 'Двигайте ползунок — смотрите положение и скорость в любой момент',
      legend: {
        path: 'траектория',
        strobe: (dt) => `через каждые ${dt} с`,
        v: 'скорость v, v_x, v_y',
        g: 'ускорение g',
        proj: 'проекции на оси',
      },
      axisX: 'x, м',
      axisY: 'y, м',
      hTag: (h) => `h = ${h} м`,
      LTag: (L) => `L = ${L} м`,
      secTag: (t) => `${t} с`,
      sceneLabel: (t, x, y, v) => `Шар, брошенный горизонтально. t = ${t} с, x = ${x} м, y = ${y} м, скорость ${v} м/с.`,
      tri: { title: 'Треугольник скоростей', unit: 'м/с' },
      readouts: { t: 'Время', x: 'По горизонтали', y: 'По вертикали', v: 'Скорость' },
      tSub: (tf) => `Время полёта ${tf} с`,
      xSub: (v) => `v_x = ${v} м/с — не меняется`,
      ySub: (v) => `v_y = g·t = ${v} м/с`,
      vSub: (a) => `под углом ${a}° к горизонту`,
      formulas: { tf: 'Время полёта', L: 'Дальность полёта', v: 'Скорость при падении' },
      chart: {
        title: (dt) => `Перемещения за каждые Δt = ${dt} с`,
        dx: 'Δx — по горизонтали',
        dy: 'Δy — по вертикали',
        interval: 'промежуток',
        xLine: 'равны — равномерное движение',
        yLine: 'растут как нечётные числа — свободное падение',
        label: 'Диаграмма горизонтальных и вертикальных перемещений за равные промежутки времени',
      },
      explain: {
        idle: 'Нажмите «Запустить». Шар вылетает с горизонтальной скоростью v₀. Синие точки — его проекция на ось x, розовые — проекция на ось y.',
        zero: 'v₀ = 0: шар просто падает вертикально вниз — это свободное падение. Увеличьте v₀: время падения не изменится.',
        horiz: (v) => `По горизонтали на тело не действует никакая сила, поэтому v_x = v₀ = ${v} м/с не меняется: синие проекции идут через равные промежутки.`,
        vert: 'По вертикали действует только сила тяжести: шар свободно падает, v_y = g·t растёт. Расстояния между розовыми проекциями растут как 1 : 3 : 5 : …',
        paused: (t, vx, vy, v) => `В момент t = ${t} с: v_x = ${vx} м/с, v_y = ${vy} м/с, v = √(v_x² + v_y²) = ${v} м/с.`,
        landed: (tf, L, v, a) =>
          `Шар упал через t = ${tf} с, дальность полёта L = v₀·t = ${L} м. Скорость при падении ${v} м/с под углом ${a}° к горизонту.`,
        lesson: 'Пример: h = 20 м, v₀ = 10 м/с. t = √(2·20/9,8) ≈ 2,02 с, L = 10·2,02 ≈ 20,2 м, v = √(10² + 19,8²) ≈ 22,2 м/с.',
      },
    },
    drop: {
      h: 'Высота',
      v0: 'Скорость брошенного шара',
      ballsLabel: 'Брошенные шары',
      balls: { one: { name: 'Один', sub: 'v₀' }, two: { name: 'Два', sub: 'v₀ и 2v₀' } },
      legend: {
        drop: 'отпущенный шар (v₀ = 0)',
        throw1: 'брошенный шар (v₀)',
        throw2: 'брошенный шар (2v₀)',
        same: 'положения в один момент',
        v: 'скорость v',
      },
      axisX: 'x, м',
      axisY: 'y, м',
      secTag: (t) => `${t} с`,
      sceneLabel: (t, y) => `Шары, отпущенный и брошенный горизонтально с одной высоты в один момент. t = ${t} с, высота ${y} м.`,
      readouts: { t: 'Время', y: 'Высота', drop: 'Отпущенный шар', throw: 'Брошенный шар' },
      tSub: (tf) => `все падают через ${tf} с`,
      ySub: 'в каждый момент у всех одинакова',
      dropSub: (vy) => `x = 0 · v_y = ${vy} м/с`,
      throwSub: (x, vy) => `x = ${x} м · v_y = ${vy} м/с`,
      formula: { tag: 'Время падения', note: 'В формуле нет v₀: при любой горизонтальной скорости время падения одно и то же.' },
      graph: {
        title: 'График высоты y(t)',
        t: 't, с',
        y: 'y, м',
        note: 'Графики совпадают: вертикальное движение не зависит от v₀.',
        label: 'График зависимости высоты шаров от времени',
        drop: 'отпущенный',
        throw1: 'брошенный (v₀)',
        throw2: 'брошенный (2v₀)',
      },
      explain: {
        idle: 'Шары начинают движение с одной высоты в один момент: один просто отпускают, другой бросают горизонтально. Какой упадёт раньше? Нажмите «Запустить».',
        flying: 'Пунктирные линии горизонтальны: в каждый момент шары на одной высоте. По вертикали все падают одинаково — горизонтальное движение этому не мешает.',
        zero: 'При v₀ = 0 брошенный шар тоже падает вертикально и движется так же, как отпущенный. Увеличьте v₀.',
        paused: 'Пауза: шары находятся на одной высоте — так в любой момент.',
        landed: (t, L) => `Шары упали одновременно — через t = ${t} с. Брошенный шар улетел на ${L} м, но лишнего времени на это не потратил.`,
        landed2: (t, L1, L2) => `Все три шара упали через t = ${t} с. Брошенные шары пролетели ${L1} м и ${L2} м: при вдвое большей v₀ дальность тоже вдвое больше.`,
      },
    },
    target: {
      missionsLabel: 'Задание',
      missions: {
        m1: { name: 'Цель 1', sub: 'h = 20 м · D = 40 м' },
        m2: { name: 'Цель 2', sub: 'h = 45 м · D = 120 м' },
        m3: { name: 'Цель 3', sub: 'h = 80 м · D = 240 м' },
        rnd: { name: 'Случайная', sub: 'новые условия' },
      },
      rndSub: (h, D) => `h = ${h} м · D = ${D} м`,
      drop: 'Сбросить груз',
      v0: 'Скорость вертолёта',
      legend: { path: 'траектория груза', target: 'цель', under: 'груз под вертолётом', v: 'скорость груза v' },
      release: 'точка сброса',
      DTag: (D) => `D = ${D} м`,
      LTag: (L) => `L = ${L} м`,
      axisX: 'x, м',
      axisY: 'y, м',
      hitTag: 'Попал!',
      score: (h, n) => `Попаданий: ${h} / ${n}`,
      sceneLabel: (h, D, x, y) => `Вертолёт летит на высоте ${h} м, цель в ${D} м. Груз: x = ${x} м, y = ${y} м.`,
      readouts: { h: 'Высота', D: 'До цели', t: 'Время падения', L: 'Дальность полёта' },
      hSub: 'на этой высоте летит вертолёт',
      DSub: (tol) => `от точки сброса · ± ${tol} м`,
      tSub: (tf) => `t = √(2h/g) = ${tf} с`,
      LSub: { idle: 'измеряется после падения', hit: 'попадание в цель', short: (d) => `недолёт ${d} м`, long: (d) => `перелёт ${d} м` },
      formula: { L: 'Дальность полёта', need: 'Нужная скорость' },
      log: { title: 'Попытки', empty: 'Попыток пока нет. Выберите скорость и сбросьте груз.', hit: 'попал', short: 'недолёт', long: 'перелёт' },
      hint: 'Подсказка: L = v₀·t, где t = √(2h/g). Значит, v₀ = D / t.',
      explain: {
        idle: (h, D) =>
          `Вертолёт летит горизонтально на высоте h = ${h} м. Выберите скорость, чтобы груз упал на цель в D = ${D} м от точки сброса, и нажмите «Сбросить груз».`,
        approach: 'Вертолёт подлетает к точке сброса…',
        falling: 'У груза та же горизонтальная скорость, что у вертолёта, поэтому он всё время остаётся под ним (сопротивления воздуха нет).',
        hit: (L) => `Отлично! Груз пролетел L = ${L} м и попал в цель.`,
        short: (d) => `Недолёт ${d} м — увеличьте скорость: дальность полёта прямо пропорциональна v₀.`,
        long: (d) => `Перелёт ${d} м — уменьшите скорость.`,
      },
    },
  },

  en: {
    card: {
      eyebrow: 'Virtual laboratory · Dynamics',
      title: 'Motion of a body thrown horizontally',
      tabsLabel: 'Choose an experiment',
      tabs: {
        throw: { label: 'Two motions', sub: 'x = v₀t · y = h − gt²/2' },
        drop: { label: 'Drop vs throw', sub: 'They land together' },
        target: { label: 'Hit the target', sub: 'L = v₀·√(2h/g)' },
      },
    },
    common: {
      start: 'Start',
      pause: 'Pause',
      resume: 'Resume',
      again: 'Run again',
      reset: 'Reset',
      presets: 'Presets',
      chipReal: 'Real time',
      chipSlow: (k) => `Time slowed down ×${k}`,
      kmh: (k) => `≈ ${k} km/h`,
      vScale: (v) => `${v} m/s`,
    },
    facts: {
      title: 'Remember',
      items: [
        {
          term: 'Two independent motions',
          text: 'horizontally — uniform motion (x = v₀t), vertically — free fall (y = h − gt²/2). Air resistance is neglected.',
        },
        { term: 'Time of flight', text: 't = √(2h/g) — depends only on the height, not on the initial speed v₀.' },
        { term: 'Range', text: 'L = v₀·t = v₀·√(2h/g): from the same height, doubling v₀ doubles L.' },
        { term: 'Velocity', text: 'the horizontal component v₀ stays constant, the vertical one equals gt; v = √(v₀² + (gt)²). The path is a parabola.' },
      ],
    },
    throw: {
      presets: {
        cliff: { name: 'From a cliff', sub: 'h = 20 m · v₀ = 10 m/s' },
        tower: { name: 'From a tower', sub: 'h = 45 m · v₀ = 15 m/s' },
        table: { name: 'Off a table', sub: 'h = 1 m · v₀ = 2 m/s' },
      },
      h: 'Height',
      v0: 'Initial speed',
      scrub: 'Time',
      hHint: (t) => `Time of flight t = √(2h/g) = ${t} s`,
      v0Hint: (k) => `≈ ${k} km/h, horizontal`,
      scrubHint: 'Drag the slider to see the position and velocity at any moment',
      legend: {
        path: 'path',
        strobe: (dt) => `position every ${dt} s`,
        v: 'velocity v, v_x, v_y',
        g: 'acceleration g',
        proj: 'projections on the axes',
      },
      axisX: 'x, m',
      axisY: 'y, m',
      hTag: (h) => `h = ${h} m`,
      LTag: (L) => `L = ${L} m`,
      secTag: (t) => `${t} s`,
      sceneLabel: (t, x, y, v) => `A ball thrown horizontally. t = ${t} s, x = ${x} m, y = ${y} m, speed ${v} m/s.`,
      tri: { title: 'Velocity triangle', unit: 'm/s' },
      readouts: { t: 'Time', x: 'Horizontal', y: 'Vertical', v: 'Speed' },
      tSub: (tf) => `Time of flight ${tf} s`,
      xSub: (v) => `v_x = ${v} m/s — constant`,
      ySub: (v) => `v_y = g·t = ${v} m/s`,
      vSub: (a) => `${a}° below the horizontal`,
      formulas: { tf: 'Time of flight', L: 'Range', v: 'Speed at impact' },
      chart: {
        title: (dt) => `Displacement in each Δt = ${dt} s`,
        dx: 'Δx — horizontal',
        dy: 'Δy — vertical',
        interval: 'interval',
        xLine: 'all equal — uniform motion',
        yLine: 'grow like odd numbers — free fall',
        label: 'Chart of horizontal and vertical displacements in equal time intervals',
      },
      explain: {
        idle: 'Press «Start». The ball leaves with a horizontal speed v₀. Blue dots are its projection on the x axis, pink dots its projection on the y axis.',
        zero: 'v₀ = 0: the ball just falls straight down — free fall. Increase v₀: the fall time does not change.',
        horiz: (v) => `No force acts on the body horizontally, so v_x = v₀ = ${v} m/s stays the same: the blue projections are equally spaced.`,
        vert: 'Vertically only gravity acts: the ball is in free fall and v_y = g·t keeps growing. The gaps between the pink projections grow as 1 : 3 : 5 : …',
        paused: (t, vx, vy, v) => `At t = ${t} s: v_x = ${vx} m/s, v_y = ${vy} m/s, v = √(v_x² + v_y²) = ${v} m/s.`,
        landed: (tf, L, v, a) => `The ball landed after t = ${tf} s; range L = v₀·t = ${L} m. Speed at impact ${v} m/s, ${a}° below the horizontal.`,
        lesson: 'Example: h = 20 m, v₀ = 10 m/s. t = √(2·20/9.8) ≈ 2.02 s, L = 10·2.02 ≈ 20.2 m, v = √(10² + 19.8²) ≈ 22.2 m/s.',
      },
    },
    drop: {
      h: 'Height',
      v0: 'Speed of the thrown ball',
      ballsLabel: 'Thrown balls',
      balls: { one: { name: 'One', sub: 'v₀' }, two: { name: 'Two', sub: 'v₀ and 2v₀' } },
      legend: {
        drop: 'dropped ball (v₀ = 0)',
        throw1: 'thrown ball (v₀)',
        throw2: 'thrown ball (2v₀)',
        same: 'positions at the same moment',
        v: 'velocity v',
      },
      axisX: 'x, m',
      axisY: 'y, m',
      secTag: (t) => `${t} s`,
      sceneLabel: (t, y) => `Balls dropped and thrown horizontally from the same height at the same moment. t = ${t} s, height ${y} m.`,
      readouts: { t: 'Time', y: 'Height', drop: 'Dropped ball', throw: 'Thrown ball' },
      tSub: (tf) => `all land after ${tf} s`,
      ySub: 'the same for all at every moment',
      dropSub: (vy) => `x = 0 · v_y = ${vy} m/s`,
      throwSub: (x, vy) => `x = ${x} m · v_y = ${vy} m/s`,
      formula: { tag: 'Fall time', note: 'There is no v₀ in the formula: the fall time is the same for any horizontal speed.' },
      graph: {
        title: 'Height graph y(t)',
        t: 't, s',
        y: 'y, m',
        note: 'The graphs coincide: the vertical motion does not depend on v₀.',
        label: 'Graph of the balls’ height against time',
        drop: 'dropped',
        throw1: 'thrown (v₀)',
        throw2: 'thrown (2v₀)',
      },
      explain: {
        idle: 'The balls start from the same height at the same moment: one is simply released, the other thrown horizontally. Which lands first? Press «Start».',
        flying: 'The dashed lines are horizontal: at every moment the balls are at the same height. Vertically they all fall alike — the horizontal motion does not interfere.',
        zero: 'With v₀ = 0 the thrown ball also falls straight down, exactly like the dropped one. Increase v₀.',
        paused: 'Paused: the balls are at the same height — and so they are at any moment.',
        landed: (t, L) => `The balls hit the ground together — after t = ${t} s. The thrown ball flew ${L} m but needed no extra time for it.`,
        landed2: (t, L1, L2) => `All three balls landed after t = ${t} s. The thrown balls flew ${L1} m and ${L2} m: twice the v₀ gives twice the range.`,
      },
    },
    target: {
      missionsLabel: 'Mission',
      missions: {
        m1: { name: 'Target 1', sub: 'h = 20 m · D = 40 m' },
        m2: { name: 'Target 2', sub: 'h = 45 m · D = 120 m' },
        m3: { name: 'Target 3', sub: 'h = 80 m · D = 240 m' },
        rnd: { name: 'Random', sub: 'new conditions' },
      },
      rndSub: (h, D) => `h = ${h} m · D = ${D} m`,
      drop: 'Drop the package',
      v0: 'Helicopter speed',
      legend: { path: 'package path', target: 'target', under: 'package under the helicopter', v: 'package velocity v' },
      release: 'release point',
      DTag: (D) => `D = ${D} m`,
      LTag: (L) => `L = ${L} m`,
      axisX: 'x, m',
      axisY: 'y, m',
      hitTag: 'Hit!',
      score: (h, n) => `Hits: ${h} / ${n}`,
      sceneLabel: (h, D, x, y) => `A helicopter flies at ${h} m; the target is ${D} m away. Package: x = ${x} m, y = ${y} m.`,
      readouts: { h: 'Height', D: 'To the target', t: 'Fall time', L: 'Range' },
      hSub: 'the helicopter flies at this height',
      DSub: (tol) => `from the release point · ± ${tol} m`,
      tSub: (tf) => `t = √(2h/g) = ${tf} s`,
      LSub: { idle: 'measured after landing', hit: 'on target', short: (d) => `${d} m short`, long: (d) => `${d} m too far` },
      formula: { L: 'Range', need: 'Required speed' },
      log: { title: 'Attempts', empty: 'No attempts yet. Choose a speed and drop the package.', hit: 'hit', short: 'short', long: 'too far' },
      hint: 'Hint: L = v₀·t, where t = √(2h/g). So v₀ = D / t.',
      explain: {
        idle: (h, D) =>
          `A helicopter flies horizontally at h = ${h} m. Choose its speed so the package lands on the target D = ${D} m from the release point, then press «Drop the package».`,
        approach: 'The helicopter is approaching the release point…',
        falling: 'The package has the same horizontal speed as the helicopter, so it always stays right below it (no air resistance).',
        hit: (L) => `Well done! The package flew L = ${L} m and hit the target.`,
        short: (d) => `The package fell ${d} m short — increase the speed: the range is proportional to v₀.`,
        long: (d) => `The package flew ${d} m too far — reduce the speed.`,
      },
    },
  },
};

/* ================================================================= card */

export default function HorizontalThrow() {
  const T = useSimText(TEXT);
  const tabs = [
    { id: 'throw', ...T.card.tabs.throw, icon: Spline, render: () => <ThrowSim T={T} /> },
    { id: 'drop', ...T.card.tabs.drop, icon: Equal, render: () => <DropSim T={T} /> },
    { id: 'target', ...T.card.tabs.target, icon: Crosshair, render: () => <TargetSim T={T} /> },
  ];
  return <SimCard eyebrow={T.card.eyebrow} title={T.card.title} tabsLabel={T.card.tabsLabel} tabs={tabs} facts={T.facts} icon={Target} idPrefix="hthrow" />;
}

/* ============================================================ two motions */

const PRESETS = {
  cliff: { h: 20, v0: 10, icon: Mountain },
  tower: { h: 45, v0: 15, icon: Building2 },
  table: { h: 1, v0: 2, icon: LampDesk },
};
const IDLE = { t: 0, running: false, done: false };

function ThrowSim({ T }) {
  const L = T.throw;
  const dec = T.decimal;
  const [h, setH] = useState(20);
  const [v0, setV0] = useState(10);
  const [sim, setSim] = useState(IDLE);
  const tf = flightTime(h);
  const dt = strobeStep(tf);
  const slow = slowFactor(tf);
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].h === h && PRESETS[k].v0 === v0) ?? null;

  useRafLoop(sim.running, (step) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tf, p.t + step * slow);
      const done = t >= tf - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    setH(PRESETS[id].h);
    setV0(PRESETS[id].v0);
    setSim(IDLE);
  };
  const scrub = (n) => {
    const done = n >= tf - 0.006;
    setSim({ t: done ? tf : n, running: false, done });
  };

  const t = Math.min(sim.t, tf);
  const x = v0 * t;
  const y = Math.max(0, h - 0.5 * G * t * t);
  const vy = G * t;
  const v = Math.hypot(v0, vy);
  const ang = (Math.atan2(vy, v0) * 180) / Math.PI;
  const Lr = v0 * tf;
  const vyImp = G * tf;
  const vImp = Math.hypot(v0, vyImp);
  const angImp = (Math.atan2(vyImp, v0) * 180) / Math.PI;
  const F = (n, d = 1) => num(n, d, dec);
  const lenD = h < 3 ? 2 : 1;

  let key = 'idle';
  if (sim.done) key = preset === 'cliff' ? 'lesson' : 'landed';
  else if (t > 0 && v0 < 1e-9) key = 'zero';
  else if (t > 0 && !sim.running) key = 'paused';
  else if (t > 0) key = t < tf * 0.4 ? 'horiz' : 'vert';
  const settled = useSettled(key, key === 'horiz' || key === 'vert' ? 250 : 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    zero: ex.zero,
    horiz: ex.horiz(F(v0)),
    vert: ex.vert,
    paused: ex.paused(fmt(t, 2, dec), F(v0), F(vy), F(v)),
    landed: ex.landed(fmt(tf, 2, dec), num(Lr, lenD, dec), F(vImp), fmt(angImp, 0, dec)),
    lesson: ex.lesson,
  }[settled];
  const tone = { idle: '#22d3ee', zero: '#f472b6', horiz: '#60a5fa', vert: '#f472b6', paused: '#a78bfa', landed: '#34d399', lesson: '#34d399' }[settled];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{T.common.presets}</GroupLabel>
          <Segmented
            label={T.common.presets}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={preset}
            onChange={pick}
            options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <ThrowScene T={T} h={h} v0={v0} t={t} tf={tf} dt={dt} slow={slow} running={sim.running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 2, dec)} unit={T.s} accent={COL.time} textColor="#a5f3fc" sub={L.tSub(fmt(tf, 2, dec))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(t / tf) * 100}%` }} />
          </div>
        </Readout>
        <Readout
          label={L.readouts.x}
          symbol={
            <>
              <span className="hidden sm:inline whitespace-nowrap">
                <Rich>x = v₀t</Rich>
              </span>
              <span className="sm:hidden">x</span>
            </>
          }
          value={num(x, lenD, dec)}
          unit={T.m}
          accent={COL.x}
          textColor={COL.xText}
          sub={<Rich>{L.xSub(F(v0))}</Rich>}
        />
        <Readout
          label={L.readouts.y}
          symbol={
            <>
              <span className="hidden sm:inline whitespace-nowrap">y = h − gt²/2</span>
              <span className="sm:hidden">y</span>
            </>
          }
          value={num(y, lenD, dec)}
          unit={T.m}
          accent={COL.y}
          textColor={COL.yText}
          sub={<Rich>{L.ySub(F(vy))}</Rich>}
        />
        <Readout label={L.readouts.v} symbol="v" value={F(v)} unit={T.ms} accent={COL.vel} textColor={COL.velText} sub={L.vSub(fmt(ang, 0, dec))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="ht-h"
            label={L.h}
            symbol="h"
            min={1}
            max={80}
            step={1}
            value={h}
            onChange={(n) => {
              setH(n);
              setSim(IDLE);
            }}
            accent={COL.y}
            display={`${fmt(h, 0, dec)} ${T.m}`}
            hint={L.hHint(fmt(tf, 2, dec))}
          />
          <RangeField
            id="ht-v0"
            label={L.v0}
            symbol={<Rich>v₀</Rich>}
            min={0}
            max={25}
            step={1}
            value={v0}
            onChange={(n) => {
              setV0(n);
              setSim(IDLE);
            }}
            accent={COL.vel}
            display={`${fmt(v0, 0, dec)} ${T.ms}`}
            hint={L.v0Hint(fmt(v0 * 3.6, 0, dec))}
          />
          <RangeField
            id="ht-t"
            label={L.scrub}
            symbol="t"
            min={0}
            max={Math.round(tf * 100) / 100}
            step={0.01}
            value={Math.min(t, Math.round(tf * 100) / 100)}
            onChange={scrub}
            accent="#22d3ee"
            display={`${fmt(t, 2, dec)} ${T.s}`}
            hint={L.scrubHint}
          />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <StrobeChart T={T} v0={v0} t={t} tf={tf} dt={dt} />
        </div>
      </div>

      <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
        <FormulaTile
          tag={L.formulas.tf}
          color="#a5f3fc"
          general="t = √(2h/g)"
          filled={`= √(2·${fmt(h, 0, dec)} / ${F(G)}) = ${fmt(tf, 2, dec)} ${T.s}`}
          ok={sim.done}
        />
        <FormulaTile
          tag={L.formulas.L}
          color={COL.xText}
          general="L = v₀·t"
          filled={`= ${fmt(v0, 0, dec)} · ${fmt(tf, 2, dec)} = ${num(Lr, lenD, dec)} ${T.m}`}
          ok={sim.done}
        />
        <FormulaTile
          tag={L.formulas.v}
          color={COL.velText}
          general="v = √(v₀² + (g·t)²)"
          filled={`= √(${fmt(v0, 0, dec)}² + ${F(vyImp)}²) = ${F(vImp)} ${T.ms}`}
          ok={sim.done}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function ThrowScene({ T, h, v0, t, tf, dt, slow, running }) {
  const L = T.throw;
  const dec = T.decimal;
  const Lr = v0 * tf;
  const x = v0 * t;
  const y = Math.max(0, h - 0.5 * G * t * t);
  const vy = G * t;
  const vyImp = G * tf;
  const vImp = Math.hypot(v0, vyImp);
  const landed = t >= tf - 1e-9;
  const N = Math.floor(tf / dt + 1e-9);
  const marks = [];
  for (let k = 0; k <= N; k += 1) {
    const tk = k * dt;
    if (tk > t + 1e-9) break;
    marks.push({ k, tk, x: v0 * tk, y: h - 0.5 * G * tk * tk });
  }
  const table = h <= 3;
  const dtText = trim(dt, dec);
  const chip = `${slow === 1 ? T.common.chipReal : T.common.chipSlow(trim(1 / slow, dec))} · t = ${fmt(t, 2, dec)} ${T.s}`;

  return (
    <LabScene
      legend={[
        { color: COL.path, label: L.legend.path, kind: 'line' },
        { color: COL.ink, label: L.legend.strobe(dtText), kind: 'ring' },
        { color: COL.vel, label: L.legend.v, kind: 'arrow' },
        { color: COL.acc, label: L.legend.g, kind: 'arrow' },
        { color: COL.x, color2: COL.y, label: L.legend.proj, kind: 'dots' },
      ]}
      chips={<Chip>{chip}</Chip>}
      height={(W, narrow) => (narrow ? 420 : 530)}
      ariaLabel={L.sceneLabel(fmt(t, 2, dec), len(x, dec), len(y, dec), num(Math.hypot(v0, vy), 1, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const r = narrow ? 7 : 9;
        const padT = narrow ? 60 : 92;
        const padB = narrow ? 66 : 86;
        const groundY = H - padB;
        const plotH = groundY - padT;
        const rulerW = narrow ? 30 : 40;
        const platW = table ? (narrow ? 58 : 104) : (narrow ? 50 : 92);
        const X0 = rulerW + platW;
        const padR = narrow ? 14 : 26;
        const vk = Math.min((padB - 12) / Math.max(vyImp, 0.1), (0.26 * plotH) / Math.max(vImp, 0.1));
        const right = Math.max(X0 + 80, W - padR - v0 * vk - r - 10);
        const view = fitView({ xMin: 0, xMax: Math.max(Lr, h * 0.25, 0.2), yMax: h, left: X0, right, top: padT, groundY });
        const step = niceStep(view.k, narrow ? 30 : 36);
        const bx = (xx) => view.sx(xx);
        const by = (yy) => view.sy(yy) - r;
        const topY = view.sy(h);
        const px = bx(x);
        const py = by(y);
        const box = { w: W, h: H };

        // the trajectory up to now
        const pts = [];
        const n = 72;
        for (let i = 0; i <= n; i += 1) {
          const tt = (t * i) / n;
          pts.push(`${bx(v0 * tt).toFixed(1)},${by(h - 0.5 * G * tt * tt).toFixed(1)}`);
        }

        // the velocity triangle in the empty top-right corner, when it is empty
        const insW = 236;
        const insH = 150;
        const insX = W - padR - insW;
        const insY = padT - 4;
        let showTri = !narrow && insX > X0 + 60;
        if (showTri && v0 > 1e-9) {
          const xw = view.wx(insX - 18);
          if (xw < Lr) {
            const tt = xw / v0;
            showTri = by(h - 0.5 * G * tt * tt) - r - 34 > insY + insH;
          }
        }

        const gLen = narrow ? 26 : 34;
        const lblY = groundY + 17;

        return (
          <>
            <rect width={W} height={H} fill={COL.paper} />
            <SceneGrid view={view} W={W} top={0} step={step} fromPx={X0} />

            {/* the platform: a cliff, or a lab table for small heights */}
            {table ? (
              <g aria-hidden="true">
                <rect x={X0 - platW + 6} y={topY} width={platW - 6} height={7} rx={2} fill="#b45309" />
                <rect x={X0 - platW + 12} y={topY + 7} width={6} height={groundY - topY - 7} fill="#92400e" />
                <rect x={X0 - 16} y={topY + 7} width={6} height={groundY - topY - 7} fill="#92400e" />
                <line x1={X0} x2={X0} y1={topY} y2={groundY} stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="4 4" />
              </g>
            ) : (
              <Cliff x0={rulerW + 4} x1={X0} top={topY} bottom={groundY} />
            )}

            <Soil W={W} H={H} groundY={groundY} />
            <AxisY view={view} x={rulerW - 4} step={step} top={padT - 12} unit={L.axisY} decimal={dec} fs={fs - 1} />
            <AxisX view={view} W={W} y={H - 9} step={niceStep(view.k, narrow ? 46 : 60)} unit={L.axisX} decimal={dec} fs={fs - 1} />

            {/* projections of every stroboscope mark */}
            {marks.map((m) => {
              const mx = bx(m.x);
              const my = by(m.y);
              return (
                <g key={`p${m.k}`} aria-hidden="true">
                  {mx - X0 > 2 && <line x1={X0} x2={mx} y1={my} y2={my} stroke={COL.y} strokeOpacity={0.35} strokeDasharray="3 4" />}
                  <line x1={mx} x2={mx} y1={my} y2={groundY} stroke={COL.x} strokeOpacity={0.35} strokeDasharray="3 4" />
                </g>
              );
            })}
            {marks.map((m, i) => {
              if (i === 0) return null;
              const a = marks[i - 1];
              const gx = bx(m.x) - bx(a.x);
              const gy = by(m.y) - by(a.y);
              const xs = len(m.x - a.x, dec);
              const ys = len(a.y - m.y, dec);
              return (
                <g key={`gap${m.k}`}>
                  {v0 > 0 && gx > xs.length * fs * 0.6 + 8 && <Label x={(bx(m.x) + bx(a.x)) / 2} y={lblY} text={xs} color={COL.x} fs={fs - 1} />}
                  {gy > fs + 1 && <Label x={X0 - 6} y={(by(m.y) + by(a.y)) / 2 + 4} text={ys} color={COL.y} fs={fs - 1} anchor="end" />}
                </g>
              );
            })}
            {marks.map((m) => (
              <g key={`d${m.k}`} aria-hidden="true">
                <circle cx={bx(m.x)} cy={groundY} r={4} fill={COL.x} stroke="#fff" strokeWidth={1.5} />
                <circle cx={X0} cy={by(m.y)} r={4} fill={COL.y} stroke="#fff" strokeWidth={1.5} />
              </g>
            ))}

            {/* trajectory */}
            {t > 0 && (
              <>
                <polyline points={pts.join(' ')} fill="none" stroke={COL.path} strokeOpacity={0.16} strokeWidth={10} strokeLinejoin="round" strokeLinecap="round" />
                <polyline points={pts.join(' ')} fill="none" stroke={COL.path} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}

            {/* stroboscope marks with their times */}
            {marks.map((m) => (
              <g key={`s${m.k}`}>
                <StrobeRing cx={bx(m.x)} cy={by(m.y)} r={r} />
                {m.k > 0 && <Label x={bx(m.x) + r + 3} y={by(m.y) - r - 2} text={L.secTag(trim(m.tk, dec))} color={COL.muted} fs={fs - 2} anchor="start" />}
              </g>
            ))}

            {/* moving projections of the ball */}
            {t > 0 && !landed && (
              <g aria-hidden="true">
                <line x1={X0} x2={px} y1={py} y2={py} stroke={COL.y} strokeOpacity={0.7} strokeWidth={1.2} strokeDasharray="2 3" />
                <line x1={px} x2={px} y1={py} y2={groundY} stroke={COL.x} strokeOpacity={0.7} strokeWidth={1.2} strokeDasharray="2 3" />
                <circle cx={X0} cy={py} r={r * 0.62} fill={COL.y} stroke="#fff" strokeWidth={1.5} />
                <circle cx={px} cy={groundY} r={r * 0.62} fill={COL.x} stroke="#fff" strokeWidth={1.5} />
              </g>
            )}

            <Pill x={X0 - platW / 2 + 1} y={table ? topY - 14 : groundY - 16} text={L.hTag(fmt(h, 0, dec))} bg={COL.ink} size={fs - 1} box={box} />
            {landed && Lr > 0 && <DimLine x1={X0} x2={bx(Lr)} y={groundY + (narrow ? 36 : 42)} color={COL.x} label={L.LTag(len(Lr, dec))} fs={fs - 1} />}

            {/* the ball, g and v */}
            {running && <circle cx={px} cy={py} r={r + 6} fill="#e11d48" className="cl-pulse" opacity="0.3" />}
            <Ball cx={px} cy={py} r={r} color="#e11d48" stroke="#881337" />
            <Arrow x1={px - r - 12} y1={py - gLen / 2} x2={px - r - 12} y2={py + gLen / 2} color={COL.acc} width={3} head={9} />
            <Sym x={px - r - 18} y={py + gLen / 2} base="g" color={COL.acc} fs={fs + 1} anchor="end" />
            <VelocityArrows px={px} py={py} vx={v0} vy={vy} vk={vk} r={r} fs={fs} />

            <VelScale x={W - padR} y={narrow ? padT + 8 : padT - 24} vk={vk} label={(s) => T.common.vScale(fmt(s, 0, dec))} fs={fs - 1} />
            {showTri && <VelTriangle x={insX} y={insY} w={insW} h={insH} v0={v0} vy={vy} vyMax={vyImp} T={T} fs={fs} />}
          </>
        );
      }}
    </LabScene>
  );
}

/** A rock cliff whose right face (the y axis) is at x1. */
function Cliff({ x0, x1, top, bottom }) {
  const hgt = bottom - top;
  const strata = [];
  for (let yy = top + 16, i = 0; yy < bottom - 4; yy += 17, i += 1) {
    const inset = (i % 3) * 7 + 6;
    strata.push(<line key={yy} x1={x0 + inset} x2={x1 - 8 - ((i * 5) % 11)} y1={yy} y2={yy} stroke="#d6d3d1" strokeWidth={1.4} strokeLinecap="round" />);
  }
  return (
    <g aria-hidden="true">
      <rect x={x0} y={top} width={x1 - x0} height={hgt} fill="#e7e5e4" />
      {strata}
      <rect x={x0} y={top - 3} width={x1 - x0} height={6} rx={2} fill="#84cc16" />
      <line x1={x1} x2={x1} y1={top} y2={bottom} stroke="#78716c" strokeWidth={1.6} />
    </g>
  );
}

/** The velocity triangle at the current moment: vₓ, v_y and v = √(vₓ² + v_y²). */
function VelTriangle({ x, y, w, h, v0, vy, vyMax, T, fs }) {
  const L = T.throw;
  const dec = T.decimal;
  const s = Math.min((w - 110) / Math.max(v0, 0.5), (h - 66) / Math.max(vyMax, 0.5));
  const ox = x + 18;
  const oy = y + 44;
  const ax = v0 * s;
  const ay = vy * s;
  const v = Math.hypot(v0, vy);
  const a = Math.atan2(vy, v0);
  const R = 22;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill="#fff" fillOpacity={0.94} stroke="#e2e8f0" />
      <text x={x + 12} y={y + 20} fontSize={fs - 1} fontWeight="700" fill={COL.muted} letterSpacing="0.06em">
        {L.tri.title.toUpperCase()}
      </text>
      {ax > 4 && <Arrow x1={ox} y1={oy} x2={ox + ax} y2={oy} color={COL.velLight} width={2.25} head={9} dash="5 3" />}
      {ay > 4 && <Arrow x1={ox + ax} y1={oy} x2={ox + ax} y2={oy + ay} color={COL.velLight} width={2.25} head={9} dash="5 3" />}
      <Arrow x1={ox} y1={oy} x2={ox + ax} y2={oy + ay} color={COL.vel} width={3} head={11} />
      {ax > R + 4 && ay > 4 && (
        <>
          <path d={`M${ox + R},${oy} A${R},${R} 0 0 1 ${ox + R * Math.cos(a)},${oy + R * Math.sin(a)}`} fill="none" stroke={COL.acc} strokeWidth={1.5} />
          <text x={ox + (R + 9) * Math.cos(a / 2)} y={oy + (R + 9) * Math.sin(a / 2) + 4} fontSize={fs - 1} fontStyle="italic" fontWeight="700" fill={COL.acc}>
            α
          </text>
        </>
      )}
      <Sym x={ox + Math.max(ax, 30) / 2} y={oy - 8} base="v" sub="x" tail={` = ${num(v0, 1, dec)}`} color={COL.vel} fs={fs} anchor="middle" />
      {ay > 4 && <Sym x={ox + ax + 6} y={oy + ay / 2 + 4} base="v" sub="y" tail={` = ${num(vy, 1, dec)}`} color={COL.vel} fs={fs} />}
      <Sym
        x={x + 12}
        y={y + h - 12}
        base="v"
        tail={` = ${num(v, 1, dec)} ${L.tri.unit} · α = ${fmt((a * 180) / Math.PI, 0, dec)}°`}
        color={COL.ink}
        fs={fs}
      />
    </g>
  );
}

/* --------------------------------------------------------- strobe chart */

function StrobeChart({ T, v0, t, tf, dt }) {
  const L = T.throw.chart;
  const dec = T.decimal;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 240);
  const N = Math.floor(tf / dt + 1e-9);
  const showVals = (W - 16) / N > 64;
  const H = 206;
  const pad = { l: 8, r: 8, t: showVals ? 40 : 24, b: 26 };
  const dx = v0 * dt;
  const dy1 = 0.5 * G * dt * dt;
  const items = [];
  for (let k = 1; k <= N; k += 1) items.push({ k, dx, dy: dy1 * (2 * k - 1), shown: t >= k * dt - 1e-9 });
  const max = Math.max(dx, dy1 * (2 * N - 1), 1e-6);
  const gw = (W - pad.l - pad.r) / N;
  const bw = Math.min(30, gw * 0.3);
  const ph = H - pad.t - pad.b;
  const fs = gw > 70 ? 11 : 10;
  const shown = items.filter((i) => i.shown);
  const dxLine = shown.length ? shown.map((i) => len(i.dx, dec)).join(' = ') : '…';
  const dyLine = shown.length ? shown.map((i) => len(i.dy, dec)).join(' : ') : '…';
  const ratio = shown.length ? shown.map((i) => 2 * i.k - 1).join(' : ') : '';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{L.title(trim(dt, dec))}</p>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COL.x }} /> {L.dx}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COL.y }} /> {L.dy}
        </span>
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L.label} className="block">
          <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="rgba(255,255,255,0.25)" />
          {items.map((it) => {
            const cx = pad.l + gw * (it.k - 0.5);
            const hx = (it.dx / max) * ph;
            const hy = (it.dy / max) * ph;
            const base = H - pad.b;
            return (
              <g key={it.k}>
                {it.shown ? (
                  <>
                    <rect x={cx - bw - 2} y={base - hx} width={bw} height={Math.max(hx, 0)} rx={3} fill={COL.x} />
                    <rect x={cx + 2} y={base - hy} width={bw} height={hy} rx={3} fill={COL.y} />
                    {showVals && v0 > 0 && (
                      <text x={cx - bw / 2 - 2} y={base - hx - 5} textAnchor="middle" fontSize={fs} fill={COL.xText} className="tabular-nums">
                        {len(it.dx, dec)}
                      </text>
                    )}
                    <text x={cx + bw / 2 + 2} y={base - hy - (showVals ? 18 : 5)} textAnchor="middle" fontSize={fs + 1} fontWeight="700" fill={COL.yText}>
                      ×{2 * it.k - 1}
                    </text>
                    {showVals && (
                      <text x={cx + bw / 2 + 2} y={base - hy - 5} textAnchor="middle" fontSize={fs} fill={COL.yText} className="tabular-nums">
                        {len(it.dy, dec)}
                      </text>
                    )}
                  </>
                ) : (
                  <>
                    <rect x={cx - bw - 2} y={base - 26} width={bw} height={26} rx={3} fill="none" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                    <rect x={cx + 2} y={base - 26} width={bw} height={26} rx={3} fill="none" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                    <text x={cx} y={base - 32} textAnchor="middle" fontSize={fs} fill="#64748b">
                      ?
                    </text>
                  </>
                )}
                <text x={cx} y={H - 8} textAnchor="middle" fontSize={fs} fill="#94a3b8">
                  {it.k}
                </text>
              </g>
            );
          })}
          <text x={W - pad.r} y={H - 8} textAnchor="end" fontSize={10} fill="#64748b">
            {L.interval}
          </text>
        </svg>
      </div>
      <div className="mt-2 space-y-1 text-[13px] leading-snug tabular-nums">
        <p className="text-gray-300">
          <span className="font-semibold" style={{ color: COL.xText }}>
            Δx:
          </span>{' '}
          {dxLine} {shown.length > 0 && T.m}
          {shown.length > 1 && <span className="text-gray-500"> — {L.xLine}</span>}
        </p>
        <p className="text-gray-300">
          <span className="font-semibold" style={{ color: COL.yText }}>
            Δy:
          </span>{' '}
          {dyLine} {shown.length > 0 && T.m}
          {shown.length > 1 && (
            <>
              {' '}
              = <b className="text-white">{ratio}</b>
              <span className="text-gray-500"> — {L.yLine}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
