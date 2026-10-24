import { useEffect, useState } from 'react';
import { BookOpen, ChartArea, ChartLine, Eraser, Hand, Lightbulb, Minus, Pause, Play, RotateCcw, Timer, TrendingDown, TrendingUp } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { Btn, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, textWidth, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { useSimText } from '../kit/lang';
import { PANEL, PanelTitle, SceneChip, ScenePanel, nf, nfa, paren } from './UniformMotion.parts';
import { T_END, Track, X_MAX, X_MIN, playLabel, trackScale, useRun } from './UniformMotionGraphs.track';
import AreaSim from './UniformMotionGraphs.area';

/* =========================================================================
 * To'g'ri chiziqli tekis harakatning grafik tasviri — every word on screen.
 * ========================================================================= */
const TEXT = {
  uz: {
    card: {
      eyebrow: 'Virtual laboratoriya · Kinematika',
      title: "To'g'ri chiziqli tekis harakatning grafik tasviri",
      tabsLabel: 'Simulyatorni tanlang',
      tabs: {
        xt: { label: 'x–t grafigi', sub: 'Qiyalik = tezlik' },
        vt: { label: 'v–t grafigi', sub: "Yuza = ko'chish" },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: 'x–t grafigi', text: "tekis harakatda to'g'ri chiziq; qanchalik tik bo'lsa, tezlik shunchalik katta." },
        { term: 'Qiyalik', text: "v = Δx / Δt; chiziq pastga tushsa v < 0, gorizontal bo'lsa v = 0 (jism tinch)." },
        { term: 'v–t grafigi', text: "tekis harakatda gorizontal chiziq, chunki tezlik o'zgarmaydi." },
        { term: 'Yuza', text: "v–t grafigi ostidagi to'rtburchak yuzi ko'chishga teng: S = v · t = 5 · 8 = 40 m." },
      ],
    },
    xt: {
      presetsLabel: 'Tayyor tajribalar',
      presets: {
        book: { name: 'Darslikdagi misol', sub: 'x₀ = 10 m · v = 5 m/s' },
        fast: { name: 'Tezroq', sub: 'x₀ = 10 m · v = 10 m/s' },
        back: { name: 'Orqaga', sub: 'x₀ = 50 m · v = −5 m/s' },
        rest: { name: 'Tinch turish', sub: 'x₀ = 30 m · v = 0' },
      },
      legend: { line: 'x(t) — hozirgi tajriba', ghost: 'oldingi tajribalar', tri: 'qiyalik uchburchagi' },
      chip: (t) => `t = ${t} s · real vaqt`,
      sceneLabel: (t, x) => `Yuqorida yo'l va aravacha, pastda uning x–t grafigi. t = ${t} s, x = ${x} m.`,
      axis: 'x, m',
      gX: 'x, m',
      gT: 't, s',
      xTag: (x) => `x = ${x} m`,
      dtTag: (d) => `Δt = ${d} s`,
      dxTag: (d) => `Δx = ${d} m`,
      slopeTag: (dx, dt, v) => `v = Δx/Δt = ${dx} / ${dt} = ${v} m/s`,
      flatTag: 'Δx = 0 → v = 0',
      ghostTag: (v) => `v = ${v} m/s`,
      readouts: { time: 'Vaqt', coord: 'Koordinata', vel: 'Tezlik = qiyalik', formula: 'Grafikdan' },
      timeSub: 'Tajriba 8 s davom etadi',
      timeSubEdge: (t) => `Yo'l chetiga ${t} s da yetadi`,
      coordSub: (x0) => `x₀ = ${x0} m dan boshlandi`,
      velSub: (dx, dt) => `Δx / Δt = ${dx} / ${dt}`,
      formulaSub: 'Uchburchakdan o‘qiladi',
      x0: "Boshlang'ich koordinata",
      x0Hint: 'Grafik t = 0 da shu balandlikdan boshlanadi',
      v: 'Tezlik',
      vHint: "Musbat — chiziq ko'tariladi, manfiy — tushadi, nol — gorizontal",
      clear: 'Eski grafiklarni tozalash',
      scrubHint: "Grafik ustida bosib suring: vaqtni o'zingiz boshqarasiz, aravacha ham o'sha paytga o'tadi.",
      rules: {
        title: "Grafikni o'qish",
        up: { head: "Chiziq ko'tariladi", text: "jism o'q yo'nalishida harakatlanadi, v > 0. Qanchalik tik — shunchalik tez." },
        down: { head: 'Chiziq pastga tushadi', text: "jism o'qning teskari tomoniga harakatlanadi, v < 0." },
        flat: { head: 'Chiziq gorizontal', text: "x o'zgarmaydi — jism tinch turibdi, v = 0." },
      },
      lines: { title: 'Grafikdagi chiziqlar', now: 'hozirgi', steepest: 'eng tik = eng tez', empty: 'Tajribani oxirigacha o‘tkazing — chizig‘i shu yerda qoladi va keyingisi bilan solishtirasiz.' },
      explain: {
        idle: "«Boshlash»ni bosing: aravacha yo'l bo'ylab yuradi, pastda esa uning x–t grafigi chiziladi. Grafikning har bir nuqtasi — «qaysi paytda qayerda edi».",
        up: (d) => `Chiziq ko'tarilyapti: jism o'q yo'nalishida harakatlanmoqda. Har sekundda x ${d} m ga ortadi — shuning uchun grafik to'g'ri chiziq.`,
        down: (d) => `Chiziq pastga tushyapti: jism o'qning teskari tomoniga ketmoqda, x har sekundda ${d} m ga kamayadi.`,
        flat: (x0) => `Chiziq gorizontal: x = ${x0} m o'zgarmayapti — jism tinch turibdi, v = 0.`,
        steeper: (v, g) => `Yangi chiziq oldingisidan tikroq — demak, tezlik kattaroq: ${v} m/s > ${g} m/s.`,
        gentler: (v, g) => `Yangi chiziq oldingisidan yotiqroq — tezlik kichikroq: ${v} m/s < ${g} m/s.`,
        done: (x, x0, t, v) => `Uchburchakdan: v = Δx / Δt = (${x} − ${x0}) / ${t} = ${v} m/s. Grafik qanchalik tik bo'lsa, tezlik shunchalik katta.`,
        doneFlat: (x0, t) => `${t} s davomida x = ${x0} m o'zgarmadi: Δx = 0, demak v = 0. Tinch turgan jismning grafigi — gorizontal chiziq.`,
        edge: (x, t, x0, v) => `Aravacha yo'l chetiga yetdi (x = ${x} m) va ${t} s da to'xtadi. Uchburchakdan: v = (${x} − ${x0}) / ${t} = ${v} m/s.`,
        scrub: (v) => `Grafik bo'ylab suring: Δt qanday bo'lmasin, Δx / Δt nisbati bir xil — ${v} m/s. To'g'ri chiziqning qiyaligi hamma joyda bir xil.`,
      },
    },
    vt: {
      presetsLabel: 'Tayyor tajribalar',
      presets: {
        book: { name: 'Darslikdagi misol', sub: 'v = 5 m/s · 8 s' },
        back: { name: 'Orqaga', sub: 'x₀ = 80 m · v = −6 m/s' },
        slow: { name: 'Sekin', sub: 'x₀ = 0 · v = 2 m/s' },
      },
      legend: { v: 'v(t) grafigi', area: "yuza = ko'chish", disp: "ko'chish Δx" },
      chip: (t) => `t = ${t} s · real vaqt`,
      sceneLabel: (t, S) => `Yuqorida yo'l va aravacha, pastda v–t grafigi. t = ${t} s, grafik ostidagi yuza ${S} m.`,
      axis: 'x, m',
      gV: 'v, m/s',
      gT: 't, s',
      xTag: (x) => `x = ${x} m`,
      areaTag: (v, t, S) => `S = v·t = ${v} · ${t} = ${S} m`,
      dispTag: (d) => `Δx = ${d} m`,
      vTag: (v) => `v = ${v} m/s`,
      cell: '1 katak = 1 s × 1 m/s = 1 m',
      readouts: { time: 'Vaqt', vel: 'Tezlik', area: 'Grafik ostidagi yuza', disp: "Ko'chish" },
      timeSub: 'Tajriba 8 s davom etadi',
      timeSubEdge: (t) => `Yo'l chetiga ${t} s da yetadi`,
      velSub: "O'zgarmaydi — chiziq gorizontal",
      areaSub: (v, t) => `S = v·t = ${v} · ${t}`,
      dispSub: (x, x0) => `Δx = x − x₀ = ${x} − ${x0}`,
      equal: 'S = Δx',
      x0: "Boshlang'ich koordinata",
      x0Hint: "Ko'chish x₀ ga bog'liq emas",
      v: 'Tezlik',
      vHint: 'Manfiy tezlikda to‘rtburchak t o‘qidan pastda bo‘ladi',
      scrubHint: "v–t grafigi ustida bosib suring — to'rtburchak va aravacha birga o'zgaradi.",
      xt: {
        title: 'Shu harakatning x–t grafigi',
        series: 'x(t)',
        x: 't, s',
        y: 'x, m',
        note: "x ning o'zgarishi Δx — v–t grafigi ostidagi yuzaga teng.",
      },
      explain: {
        idle: "«Boshlash»ni bosing. Tezlik o'zgarmaydi, shuning uchun v–t grafigi gorizontal chiziq bo'ladi. Uning ostidagi to'rtburchak — ko'chish.",
        pos: "Chiziq gorizontal — tezlik o'zgarmaydi. To'rtburchak kengayib boryapti: uning yuzi S = v·t aravachaning ko'chishiga teng.",
        neg: "Tezlik manfiy — chiziq t o'qidan pastda. To'rtburchak ham pastda: ko'chish manfiy, aravacha orqaga ketmoqda.",
        rest: "v = 0: to'rtburchakning balandligi nol, yuzasi ham nol — aravacha joyidan siljimaydi.",
        done: (v, t, S, x, x0, dx) => `Yuza S = v·t = ${v} · ${t} = ${S} m. Ko'chish Δx = ${x} − ${x0} = ${dx} m — xuddi shuncha!`,
        doneNeg: (v, t, S, x, x0, dx) => `To'rtburchak t o'qidan pastda: S = ${v} · ${t} = ${S} m. Ko'chish ham manfiy: Δx = ${x} − ${x0} = ${dx} m.`,
        doneRest: (t) => `${t} s o'tdi, yuza 0 m — aravacha joyida qoldi: Δx = 0.`,
        scrub: "Grafik bo'ylab suring: har qanday paytda to'rtburchak yuzi aravachaning shu paytgacha ko'chishiga teng.",
        edge: (x, t, v, S) => `Aravacha yo'l chetiga yetdi (x = ${x} m) va ${t} s da to'xtadi. Shu paytgacha yuza S = ${v} · ${t} = ${S} m — ko'chishga teng.`,
      },
    },
  },

  ru: {
    card: {
      eyebrow: 'Виртуальная лаборатория · Кинематика',
      title: 'Графическое представление прямолинейного равномерного движения',
      tabsLabel: 'Выберите симулятор',
      tabs: {
        xt: { label: 'График x–t', sub: 'Наклон = скорость' },
        vt: { label: 'График v–t', sub: 'Площадь = перемещение' },
      },
    },
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'График x–t', text: 'при равномерном движении — прямая; чем круче, тем больше скорость.' },
        { term: 'Наклон', text: 'v = Δx / Δt; линия идёт вниз — v < 0, горизонтальна — v = 0 (тело покоится).' },
        { term: 'График v–t', text: 'при равномерном движении — горизонтальная линия: скорость не меняется.' },
        { term: 'Площадь', text: 'площадь прямоугольника под графиком v–t равна перемещению: S = v · t = 5 · 8 = 40 м.' },
      ],
    },
    xt: {
      presetsLabel: 'Готовые опыты',
      presets: {
        book: { name: 'Пример из урока', sub: 'x₀ = 10 м · v = 5 м/с' },
        fast: { name: 'Быстрее', sub: 'x₀ = 10 м · v = 10 м/с' },
        back: { name: 'Назад', sub: 'x₀ = 50 м · v = −5 м/с' },
        rest: { name: 'Покой', sub: 'x₀ = 30 м · v = 0' },
      },
      legend: { line: 'x(t) — текущий опыт', ghost: 'прошлые опыты', tri: 'треугольник наклона' },
      chip: (t) => `t = ${t} с · реальное время`,
      sceneLabel: (t, x) => `Вверху дорожка с тележкой, внизу её график x–t. t = ${t} с, x = ${x} м.`,
      axis: 'x, м',
      gX: 'x, м',
      gT: 't, с',
      xTag: (x) => `x = ${x} м`,
      dtTag: (d) => `Δt = ${d} с`,
      dxTag: (d) => `Δx = ${d} м`,
      slopeTag: (dx, dt, v) => `v = Δx/Δt = ${dx} / ${dt} = ${v} м/с`,
      flatTag: 'Δx = 0 → v = 0',
      ghostTag: (v) => `v = ${v} м/с`,
      readouts: { time: 'Время', coord: 'Координата', vel: 'Скорость = наклон', formula: 'По графику' },
      timeSub: 'Опыт длится 8 с',
      timeSubEdge: (t) => `До края дорожки — ${t} с`,
      coordSub: (x0) => `начало в x₀ = ${x0} м`,
      velSub: (dx, dt) => `Δx / Δt = ${dx} / ${dt}`,
      formulaSub: 'Считывается по треугольнику',
      x0: 'Начальная координата',
      x0Hint: 'С этой высоты график начинается при t = 0',
      v: 'Скорость',
      vHint: 'Плюс — линия поднимается, минус — опускается, ноль — горизонтальна',
      clear: 'Стереть прошлые графики',
      scrubHint: 'Нажмите на график и ведите: вы сами управляете временем, и тележка переходит в этот момент.',
      rules: {
        title: 'Как читать график',
        up: { head: 'Линия поднимается', text: 'тело движется по направлению оси, v > 0. Чем круче — тем быстрее.' },
        down: { head: 'Линия опускается', text: 'тело движется против оси, v < 0.' },
        flat: { head: 'Линия горизонтальна', text: 'x не меняется — тело покоится, v = 0.' },
      },
      lines: { title: 'Линии на графике', now: 'текущая', steepest: 'круче всех = быстрее всех', empty: 'Доведите опыт до конца — его линия останется здесь для сравнения со следующим.' },
      explain: {
        idle: 'Нажмите «Старт»: тележка поедет по дорожке, а внизу будет строиться её график x–t. Каждая точка графика — «где тело было в какой момент».',
        up: (d) => `Линия поднимается: тело движется по направлению оси. Каждую секунду x растёт на ${d} м — поэтому график прямой.`,
        down: (d) => `Линия опускается: тело движется против оси, x каждую секунду уменьшается на ${d} м.`,
        flat: (x0) => `Линия горизонтальна: x = ${x0} м не меняется — тело покоится, v = 0.`,
        steeper: (v, g) => `Новая линия круче прошлой — значит, скорость больше: ${v} м/с > ${g} м/с.`,
        gentler: (v, g) => `Новая линия положе прошлой — скорость меньше: ${v} м/с < ${g} м/с.`,
        done: (x, x0, t, v) => `По треугольнику: v = Δx / Δt = (${x} − ${x0}) / ${t} = ${v} м/с. Чем круче график, тем больше скорость.`,
        doneFlat: (x0, t) => `За ${t} с координата x = ${x0} м не изменилась: Δx = 0, значит v = 0. График покоящегося тела — горизонтальная линия.`,
        edge: (x, t, x0, v) => `Тележка доехала до края дорожки (x = ${x} м) и остановилась через ${t} с. По треугольнику: v = (${x} − ${x0}) / ${t} = ${v} м/с.`,
        scrub: (v) => `Ведите по графику: каким бы ни было Δt, отношение Δx / Δt одно и то же — ${v} м/с. Наклон прямой везде одинаков.`,
      },
    },
    vt: {
      presetsLabel: 'Готовые опыты',
      presets: {
        book: { name: 'Пример из урока', sub: 'v = 5 м/с · 8 с' },
        back: { name: 'Назад', sub: 'x₀ = 80 м · v = −6 м/с' },
        slow: { name: 'Медленно', sub: 'x₀ = 0 · v = 2 м/с' },
      },
      legend: { v: 'график v(t)', area: 'площадь = перемещение', disp: 'перемещение Δx' },
      chip: (t) => `t = ${t} с · реальное время`,
      sceneLabel: (t, S) => `Вверху дорожка с тележкой, внизу график v–t. t = ${t} с, площадь под графиком ${S} м.`,
      axis: 'x, м',
      gV: 'v, м/с',
      gT: 't, с',
      xTag: (x) => `x = ${x} м`,
      areaTag: (v, t, S) => `S = v·t = ${v} · ${t} = ${S} м`,
      dispTag: (d) => `Δx = ${d} м`,
      vTag: (v) => `v = ${v} м/с`,
      cell: '1 клетка = 1 с × 1 м/с = 1 м',
      readouts: { time: 'Время', vel: 'Скорость', area: 'Площадь под графиком', disp: 'Перемещение' },
      timeSub: 'Опыт длится 8 с',
      timeSubEdge: (t) => `До края дорожки — ${t} с`,
      velSub: 'Не меняется — линия горизонтальна',
      areaSub: (v, t) => `S = v·t = ${v} · ${t}`,
      dispSub: (x, x0) => `Δx = x − x₀ = ${x} − ${x0}`,
      equal: 'S = Δx',
      x0: 'Начальная координата',
      x0Hint: 'Перемещение от x₀ не зависит',
      v: 'Скорость',
      vHint: 'При отрицательной скорости прямоугольник лежит под осью t',
      scrubHint: 'Нажмите на график v–t и ведите — прямоугольник и тележка меняются вместе.',
      xt: {
        title: 'График x–t того же движения',
        series: 'x(t)',
        x: 't, с',
        y: 'x, м',
        note: 'Изменение координаты Δx равно площади под графиком v–t.',
      },
      explain: {
        idle: 'Нажмите «Старт». Скорость не меняется, поэтому график v–t — горизонтальная линия. Прямоугольник под ней — это перемещение.',
        pos: 'Линия горизонтальна — скорость постоянна. Прямоугольник растёт: его площадь S = v·t равна перемещению тележки.',
        neg: 'Скорость отрицательна — линия ниже оси t. Прямоугольник тоже внизу: перемещение отрицательно, тележка едет назад.',
        rest: 'v = 0: высота прямоугольника ноль, площадь тоже ноль — тележка не сдвигается.',
        done: (v, t, S, x, x0, dx) => `Площадь S = v·t = ${v} · ${t} = ${S} м. Перемещение Δx = ${x} − ${x0} = ${dx} м — ровно столько же!`,
        doneNeg: (v, t, S, x, x0, dx) => `Прямоугольник под осью t: S = ${v} · ${t} = ${S} м. Перемещение тоже отрицательно: Δx = ${x} − ${x0} = ${dx} м.`,
        doneRest: (t) => `Прошло ${t} с, площадь 0 м — тележка осталась на месте: Δx = 0.`,
        scrub: 'Ведите по графику: в любой момент площадь прямоугольника равна перемещению тележки к этому моменту.',
        edge: (x, t, v, S) => `Тележка доехала до края дорожки (x = ${x} м) и остановилась через ${t} с. Площадь к этому моменту S = ${v} · ${t} = ${S} м — равна перемещению.`,
      },
    },
  },

  en: {
    card: {
      eyebrow: 'Virtual laboratory · Kinematics',
      title: 'Graphical representation of straight-line uniform motion',
      tabsLabel: 'Choose a simulator',
      tabs: {
        xt: { label: 'x–t graph', sub: 'Slope = velocity' },
        vt: { label: 'v–t graph', sub: 'Area = displacement' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Run again', reset: 'Reset' },
    facts: {
      title: 'Remember',
      items: [
        { term: 'x–t graph', text: 'a straight line in uniform motion; the steeper it is, the greater the speed.' },
        { term: 'Slope', text: 'v = Δx / Δt; a falling line means v < 0, a horizontal one v = 0 (at rest).' },
        { term: 'v–t graph', text: 'a horizontal line in uniform motion, because the velocity does not change.' },
        { term: 'Area', text: 'the area of the rectangle under the v–t graph is the displacement: S = v · t = 5 · 8 = 40 m.' },
      ],
    },
    xt: {
      presetsLabel: 'Ready-made experiments',
      presets: {
        book: { name: 'Lesson example', sub: 'x₀ = 10 m · v = 5 m/s' },
        fast: { name: 'Faster', sub: 'x₀ = 10 m · v = 10 m/s' },
        back: { name: 'Backwards', sub: 'x₀ = 50 m · v = −5 m/s' },
        rest: { name: 'At rest', sub: 'x₀ = 30 m · v = 0' },
      },
      legend: { line: 'x(t) — this run', ghost: 'earlier runs', tri: 'slope triangle' },
      chip: (t) => `t = ${t} s · real time`,
      sceneLabel: (t, x) => `A track with a cart above, its x–t graph below. t = ${t} s, x = ${x} m.`,
      axis: 'x, m',
      gX: 'x, m',
      gT: 't, s',
      xTag: (x) => `x = ${x} m`,
      dtTag: (d) => `Δt = ${d} s`,
      dxTag: (d) => `Δx = ${d} m`,
      slopeTag: (dx, dt, v) => `v = Δx/Δt = ${dx} / ${dt} = ${v} m/s`,
      flatTag: 'Δx = 0 → v = 0',
      ghostTag: (v) => `v = ${v} m/s`,
      readouts: { time: 'Time', coord: 'Coordinate', vel: 'Velocity = slope', formula: 'From the graph' },
      timeSub: 'The run lasts 8 s',
      timeSubEdge: (t) => `Reaches the end of the track at ${t} s`,
      coordSub: (x0) => `started at x₀ = ${x0} m`,
      velSub: (dx, dt) => `Δx / Δt = ${dx} / ${dt}`,
      formulaSub: 'Read off the triangle',
      x0: 'Starting coordinate',
      x0Hint: 'The graph starts at this height at t = 0',
      v: 'Velocity',
      vHint: 'Positive — the line rises, negative — it falls, zero — horizontal',
      clear: 'Clear earlier graphs',
      scrubHint: 'Press on the graph and drag: you control time yourself, and the cart jumps to that moment.',
      rules: {
        title: 'Reading the graph',
        up: { head: 'The line rises', text: 'the body moves along the axis, v > 0. The steeper, the faster.' },
        down: { head: 'The line falls', text: 'the body moves against the axis, v < 0.' },
        flat: { head: 'The line is horizontal', text: 'x does not change — the body is at rest, v = 0.' },
      },
      lines: { title: 'Lines on the graph', now: 'this run', steepest: 'steepest = fastest', empty: 'Finish a run — its line stays here so you can compare it with the next one.' },
      explain: {
        idle: 'Press "Start": the cart rolls along the track and its x–t graph is drawn below. Each point of the graph says "where the body was, and when".',
        up: (d) => `The line is rising: the body moves along the axis. Every second x grows by ${d} m — which is why the graph is a straight line.`,
        down: (d) => `The line is falling: the body moves against the axis, and x drops by ${d} m every second.`,
        flat: (x0) => `The line is horizontal: x = ${x0} m does not change — the body is at rest, v = 0.`,
        steeper: (v, g) => `The new line is steeper than the last one — so the speed is greater: ${v} m/s > ${g} m/s.`,
        gentler: (v, g) => `The new line is flatter than the last one — the speed is smaller: ${v} m/s < ${g} m/s.`,
        done: (x, x0, t, v) => `From the triangle: v = Δx / Δt = (${x} − ${x0}) / ${t} = ${v} m/s. The steeper the graph, the greater the speed.`,
        doneFlat: (x0, t) => `For ${t} s x = ${x0} m did not change: Δx = 0, so v = 0. The graph of a body at rest is a horizontal line.`,
        edge: (x, t, x0, v) => `The cart reached the end of the track (x = ${x} m) and stopped at ${t} s. From the triangle: v = (${x} − ${x0}) / ${t} = ${v} m/s.`,
        scrub: (v) => `Drag along the graph: whatever Δt you take, Δx / Δt stays the same — ${v} m/s. A straight line has the same slope everywhere.`,
      },
    },
    vt: {
      presetsLabel: 'Ready-made experiments',
      presets: {
        book: { name: 'Lesson example', sub: 'v = 5 m/s · 8 s' },
        back: { name: 'Backwards', sub: 'x₀ = 80 m · v = −6 m/s' },
        slow: { name: 'Slow', sub: 'x₀ = 0 · v = 2 m/s' },
      },
      legend: { v: 'v(t) graph', area: 'area = displacement', disp: 'displacement Δx' },
      chip: (t) => `t = ${t} s · real time`,
      sceneLabel: (t, S) => `A track with a cart above, the v–t graph below. t = ${t} s, area under the graph ${S} m.`,
      axis: 'x, m',
      gV: 'v, m/s',
      gT: 't, s',
      xTag: (x) => `x = ${x} m`,
      areaTag: (v, t, S) => `S = v·t = ${v} · ${t} = ${S} m`,
      dispTag: (d) => `Δx = ${d} m`,
      vTag: (v) => `v = ${v} m/s`,
      cell: '1 cell = 1 s × 1 m/s = 1 m',
      readouts: { time: 'Time', vel: 'Velocity', area: 'Area under the graph', disp: 'Displacement' },
      timeSub: 'The run lasts 8 s',
      timeSubEdge: (t) => `Reaches the end of the track at ${t} s`,
      velSub: 'Constant — the line is horizontal',
      areaSub: (v, t) => `S = v·t = ${v} · ${t}`,
      dispSub: (x, x0) => `Δx = x − x₀ = ${x} − ${x0}`,
      equal: 'S = Δx',
      x0: 'Starting coordinate',
      x0Hint: 'The displacement does not depend on x₀',
      v: 'Velocity',
      vHint: 'With a negative velocity the rectangle lies below the t axis',
      scrubHint: 'Press on the v–t graph and drag — the rectangle and the cart change together.',
      xt: {
        title: 'The x–t graph of the same motion',
        series: 'x(t)',
        x: 't, s',
        y: 'x, m',
        note: 'The change in x, Δx, equals the area under the v–t graph.',
      },
      explain: {
        idle: 'Press "Start". The velocity does not change, so the v–t graph is a horizontal line. The rectangle under it is the displacement.',
        pos: 'The line is horizontal — the velocity is constant. The rectangle grows: its area S = v·t equals the cart’s displacement.',
        neg: 'The velocity is negative — the line lies below the t axis. So does the rectangle: the displacement is negative, the cart goes backwards.',
        rest: 'v = 0: the rectangle has zero height and zero area — the cart does not move.',
        done: (v, t, S, x, x0, dx) => `Area S = v·t = ${v} · ${t} = ${S} m. Displacement Δx = ${x} − ${x0} = ${dx} m — exactly the same!`,
        doneNeg: (v, t, S, x, x0, dx) => `The rectangle is below the t axis: S = ${v} · ${t} = ${S} m. The displacement is negative too: Δx = ${x} − ${x0} = ${dx} m.`,
        doneRest: (t) => `${t} s passed and the area is 0 m — the cart stayed put: Δx = 0.`,
        scrub: 'Drag along the graph: at any moment the area of the rectangle equals the cart’s displacement up to that moment.',
        edge: (x, t, v, S) => `The cart reached the end of the track (x = ${x} m) and stopped at ${t} s. The area up to then, S = ${v} · ${t} = ${S} m, equals the displacement.`,
      },
    },
  },
};

/* ================================================================== card */

export default function UniformMotionGraphs() {
  const T = useSimText(TEXT);
  const c = T.card;
  return (
    <SimCard
      idPrefix="umg"
      eyebrow={c.eyebrow}
      title={c.title}
      tabsLabel={c.tabsLabel}
      tabs={[
        { id: 'xt', label: c.tabs.xt.label, sub: c.tabs.xt.sub, icon: ChartLine, render: () => <SlopeSim T={T} /> },
        { id: 'vt', label: c.tabs.vt.label, sub: c.tabs.vt.sub, icon: ChartArea, render: () => <AreaSim T={T} /> },
      ]}
      facts={T.facts}
    />
  );
}

/* ============================================================ x–t graph */

const PRESETS = [
  { id: 'book', x0: 10, v: 5, icon: BookOpen },
  { id: 'fast', x0: 10, v: 10, icon: TrendingUp },
  { id: 'back', x0: 50, v: -5, icon: TrendingDown },
  { id: 'rest', x0: 30, v: 0, icon: Minus },
];
const GHOST_COLORS = ['#db2777', '#0d9488', '#d97706'];
const C = PALETTE;
const TIME_INK = '#0e7490';

function geomXt(W, H, narrow) {
  const railY = narrow ? 112 : 132;
  return {
    railY,
    padL: narrow ? 24 : 44,
    padR: narrow ? 30 : 52,
    gL: narrow ? 40 : 60,
    gR: W - (narrow ? 16 : 28),
    gT: railY + (narrow ? 58 : 66),
    gB: H - (narrow ? 32 : 36),
  };
}

function SlopeSim({ T }) {
  const t = T.xt;
  const dec = T.decimal;
  const [x0, setX0] = useState(10);
  const [v, setV] = useState(5);
  const run = useRun(x0, v);
  const [ghosts, setGhosts] = useState([]);
  const { done, tEnd } = run;

  // a finished run leaves its line on the graph for comparison
  useEffect(() => {
    if (!done) return;
    setGhosts((g) => (g.some((q) => q.x0 === x0 && q.v === v) ? g : [...g, { x0, v, tEnd }].slice(-3)));
  }, [done, x0, v, tEnd]);

  const pick = (id) => {
    const p = PRESETS.find((q) => q.id === id);
    setX0(p.x0);
    setV(p.v);
    run.reset();
  };
  const change = (setter) => (val) => {
    setter(val);
    run.reset();
  };
  const active = PRESETS.find((p) => p.x0 === x0 && p.v === v)?.id ?? null;

  const time = run.t;
  // printed numbers use the time as printed (0.1 s), so the arithmetic on screen adds up
  const tR = Math.round(time * 10) / 10;
  const x = x0 + v * tR;
  const A = (n) => nfa(n, 1, dec);
  const F = (n) => fmt(n, 1, dec);
  const others = ghosts.filter((g) => g.x0 !== x0 || g.v !== v);
  const lastG = others[others.length - 1];

  let key = 'idle';
  if (run.atEnd && !run.running) key = tEnd < T_END - 1e-9 ? 'edge' : v === 0 ? 'doneFlat' : 'done';
  else if (!run.running && done && time > 0) key = 'scrub';
  else if (run.running || time > 0) {
    if (lastG && v * lastG.v > 0 && Math.abs(v) !== Math.abs(lastG.v)) key = Math.abs(v) > Math.abs(lastG.v) ? 'steeper' : 'gentler';
    else key = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
  }
  const settled = useSettled(key, key === 'idle' || key === 'done' || key === 'doneFlat' || key === 'edge' ? 0 : 300);
  const ex = t.explain;
  const xE = x0 + v * tEnd;
  const text = {
    idle: ex.idle,
    up: ex.up(A(Math.abs(v))),
    down: ex.down(A(Math.abs(v))),
    flat: ex.flat(A(x0)),
    steeper: ex.steeper(A(Math.abs(v)), A(Math.abs(lastG?.v ?? 0))),
    gentler: ex.gentler(A(Math.abs(v)), A(Math.abs(lastG?.v ?? 0))),
    done: ex.done(A(xE), A(x0), A(tEnd), A(v)),
    doneFlat: ex.doneFlat(A(x0), A(tEnd)),
    edge: ex.edge(A(xE), A(tEnd), A(x0), A(v)),
    scrub: ex.scrub(A(v)),
  }[settled];
  const tone = settled.startsWith('done') || settled === 'edge' ? '#34d399' : settled === 'down' ? '#60a5fa' : settled === 'flat' ? '#fbbf24' : '#22d3ee';

  const dxNow = x - x0;
  const signKey = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';

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
          <Btn variant="primary" icon={run.running ? Pause : Play} onClick={run.toggle} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
            {playLabel(run, T.common)}
          </Btn>
          <Btn icon={RotateCcw} onClick={run.reset} disabled={time === 0 && !run.running} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
      </div>

      <SlopeScene t={t} dec={dec} x0={x0} v={v} run={run} ghosts={others} allGhosts={ghosts} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={t.readouts.time}
          symbol="t"
          value={F(time)}
          unit={T.s}
          accent={C.time}
          textColor="#a5f3fc"
          sub={tEnd < T_END - 1e-9 ? t.timeSubEdge(F(tEnd)) : t.timeSub}
        >
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(time / T_END) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={t.readouts.coord} symbol="x" value={nf(x, 1, dec)} unit={T.m} accent={C.disp} textColor={C.dispText} sub={t.coordSub(A(x0))} />
        <Readout
          label={t.readouts.vel}
          symbol="v"
          value={tR > 0 ? nf(dxNow / tR, 1, dec) : '—'}
          unit={T.ms}
          accent={C.vel}
          textColor={C.velText}
          sub={tR > 0 ? t.velSub(nf(dxNow, 1, dec), F(tR)) : t.velSub('Δx', 'Δt')}
        />
        <Readout label={t.readouts.formula} accent="#e2e8f0" sub={t.formulaSub}>
          <p className="mt-1.5 text-lg font-semibold italic tracking-wide text-gray-300">v = (x − x₀) / t</p>
          <p className="mt-1 text-[15px] font-semibold tabular-nums leading-snug text-white">
            {tR > 0 ? (
              <>
                v = ({nf(x, 1, dec)} − {paren(A(x0))}) / {F(tR)} = <span style={{ color: C.velText }}>{nf(dxNow / tR, 1, dec)}</span> {T.ms}
              </>
            ) : (
              '—'
            )}
          </p>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className={`lg:col-span-2 space-y-3 ${PANEL}`}>
          <RangeField id="umg-x0" label={t.x0} symbol="x₀" min={-20} max={100} step={5} value={x0} onChange={change(setX0)} accent={C.disp} display={`${A(x0)} ${T.m}`} hint={t.x0Hint} />
          <RangeField id="umg-v" label={t.v} symbol="v" min={-10} max={10} step={0.5} value={v} onChange={change(setV)} accent={C.vel} display={`${A(v)} ${T.ms}`} hint={t.vHint} />
          <p className="flex items-start gap-2 rounded-xl bg-black/25 px-3 py-2.5 text-xs leading-snug text-gray-400">
            <Hand size={15} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden="true" /> {t.scrubHint}
          </p>
          <Btn icon={Eraser} onClick={() => setGhosts([])} disabled={ghosts.length === 0} className="w-full">
            {t.clear}
          </Btn>
        </div>
        <div className={`lg:col-span-3 ${PANEL}`}>
          <RulesPanel t={t} T={T} signKey={signKey} v={v} ghosts={ghosts} x0={x0} />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- reading rules */

function Glyph({ kind, color }) {
  const d = { up: 'M3,25 L33,5', down: 'M3,5 L33,25', flat: 'M3,15 L33,15' }[kind];
  return (
    <svg width="36" height="30" viewBox="0 0 36 30" aria-hidden="true" className="shrink-0">
      <path d="M2,2 L2,28 L35,28" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.3" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function RulesPanel({ t, T, signKey, v, ghosts, x0 }) {
  const dec = T.decimal;
  const A = (n) => nfa(n, 1, dec);
  const rows = ['up', 'down', 'flat'];
  const lines = [...ghosts.filter((g) => g.x0 !== x0 || g.v !== v).map((g) => ({ ...g, color: GHOST_COLORS[ghosts.indexOf(g) % 3] })), { x0, v, color: C.disp, now: true }];
  const maxAbs = Math.max(...lines.map((l) => Math.abs(l.v)));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <PanelTitle>{t.rules.title}</PanelTitle>
        <ul className="mt-2 space-y-1.5">
          {rows.map((k) => {
            const on = k === signKey;
            return (
              <li
                key={k}
                className={`flex items-center gap-3 rounded-xl border px-2.5 py-2 transition-colors ${on ? 'bg-white/[0.07]' : 'border-white/5 bg-black/15'}`}
                style={on ? { borderColor: '#22d3ee88' } : undefined}
              >
                <Glyph kind={k} color={on ? '#60a5fa' : '#64748b'} />
                <p className="text-[13px] leading-snug">
                  <span className={`font-semibold ${on ? 'text-white' : 'text-gray-300'}`}>{t.rules[k].head}</span>{' '}
                  <span className="text-gray-400">— {t.rules[k].text}</span>
                </p>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <PanelTitle>{t.lines.title}</PanelTitle>
        {lines.length < 2 && <p className="mt-2 text-[13px] leading-snug text-gray-500">{t.lines.empty}</p>}
        <ul className="mt-2 space-y-1.5">
          {lines.map((l) => (
            <li key={`${l.x0}|${l.v}|${l.now ? 'n' : 'g'}`} className="flex items-center gap-2.5 rounded-xl bg-black/20 px-2.5 py-2 text-sm tabular-nums">
              <span className="h-1 w-6 shrink-0 rounded" style={{ background: l.color, opacity: l.now ? 1 : 0.85 }} aria-hidden="true" />
              <span className="font-semibold text-white">{t.ghostTag(A(l.v))}</span>
              {l.now && <span className="text-xs text-cyan-300">· {t.lines.now}</span>}
              {lines.length > 1 && Math.abs(l.v) === maxAbs && maxAbs > 0 && (
                <span className="ml-auto rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">{t.lines.steepest}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function SlopeScene({ t, dec, x0, v, run, ghosts, allGhosts }) {
  const time = run.t;
  const x = x0 + v * time;
  const tR = Math.round(time * 10) / 10;
  const xR = x0 + v * tR;
  const A = (n) => nfa(n, 1, dec);
  const F = (n) => fmt(n, 1, dec);
  const legend = [
    { color: C.disp, label: t.legend.line, kind: 'line' },
    { color: GHOST_COLORS[0], label: t.legend.ghost, kind: 'dash' },
    { color: C.vel, label: t.legend.tri, kind: 'area' },
  ];
  const chips = (
    <SceneChip icon={Timer} strong>
      {t.chip(F(time))}
    </SceneChip>
  );

  const onScrub = (px, py, W, H, first) => {
    const g = geomXt(W, H, W < 560);
    if (first && (py < g.gT - 14 || px < g.gL - 16 || px > g.gR + 16)) return false;
    run.scrub(((px - g.gL) / (g.gR - g.gL)) * T_END);
    return true;
  };

  return (
    <ScenePanel height={(W, narrow) => (narrow ? 470 : 540)} ariaLabel={t.sceneLabel(F(time), nf(xR, 1, dec))} legend={legend} chips={chips} onScrub={onScrub}>
      {(W, H, narrow) => {
        const g = geomXt(W, H, narrow);
        const X = trackScale(W, g.padL, g.padR);
        const gx = (s) => g.gL + (s / T_END) * (g.gR - g.gL);
        const gy = (m) => g.gB - ((m - X_MIN) / (X_MAX - X_MIN)) * (g.gB - g.gT);
        const fs = narrow ? 11 : 12;
        const gBox = { w: g.gR + 6, h: g.gB + 2 };
        const xTicks = [];
        for (let m = X_MIN; m <= X_MAX; m += 10) xTicks.push(m);
        const tMax = run.tMax;
        const xMaxT = x0 + v * tMax;
        const showTri = time >= 0.3;
        const Ax = gx(0);
        const Ay = gy(x0);
        const Bx = gx(time);
        const Cy = gy(x);
        const dx = x - x0;
        const dxR = xR - x0;
        const slope = t.slopeTag(nf(dxR, 1, dec), F(tR), tR > 0 ? nf(dxR / tR, 1, dec) : '—');
        const slopeW = textWidth(slope, fs, 600) + 16;
        const midX = gx(time / 2);
        const midY = gy(x0 + (v * time) / 2);
        const dxText = t.dxTag(nf(dxR, 1, dec));
        const dxW = textWidth(dxText, fs - 1, 600) + 16;
        const dxRight = Bx + 8 + dxW < g.gR;

        return (
          <g>
            <rect width={W} height={H} fill="#fbfcfe" />
            <Track X={X} y={g.railY} narrow={narrow} x0={x0} x={x} xLabel={xR} v={v} moving={run.running || (time > 0 && !run.atEnd)} labels={t} dec={dec} W={W} H={H} />

            {/* graph frame */}
            <rect x={g.gL} y={g.gT} width={g.gR - g.gL} height={g.gB - g.gT} fill="#fff" stroke="#e2e8f0" />
            {Array.from({ length: T_END + 1 }, (_, s) => (
              <line key={`vt${s}`} x1={gx(s)} x2={gx(s)} y1={g.gT} y2={g.gB} stroke="#e2e8f0" />
            ))}
            {xTicks.map((m) => (
              <g key={`hx${m}`}>
                <line x1={g.gL} x2={g.gR} y1={gy(m)} y2={gy(m)} stroke={m === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={m === 0 ? 1.3 : 1} />
                {(!narrow || m % 20 === 0) && (
                  <text x={g.gL - 6} y={gy(m) + 4} textAnchor="end" fontSize={fs - 1} fill={m === 0 ? C.ink : '#64748b'} fontWeight={m === 0 ? 700 : 400}>
                    {nf(m, 0, dec)}
                  </text>
                )}
              </g>
            ))}
            {Array.from({ length: T_END + 1 }, (_, s) => (
              <text key={`tl${s}`} x={gx(s)} y={g.gB + 16} textAnchor="middle" fontSize={fs - 1} fill="#64748b">
                {s}
              </text>
            ))}
            <line x1={g.gL} x2={g.gL} y1={g.gB} y2={g.gT - 8} stroke="#334155" strokeWidth="1.5" />
            <path d={`M${g.gL},${g.gT - 14} L${g.gL - 4},${g.gT - 6} L${g.gL + 4},${g.gT - 6} Z`} fill="#334155" />
            <text x={g.gL + 8} y={g.gT - 6} fontSize={fs - 1} fontWeight="700" fill="#475569">
              {t.gX}
            </text>
            <text x={g.gR} y={g.gB + 30} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
              {t.gT}
            </text>

            {/* earlier runs */}
            {ghosts.map((q) => {
              const col = GHOST_COLORS[allGhosts.indexOf(q) % 3];
              const ex = gx(q.tEnd);
              const ey = gy(q.x0 + q.v * q.tEnd);
              const label = t.ghostTag(A(q.v));
              const w = textWidth(label, fs - 1, 600) + 16;
              return (
                <g key={`${q.x0}|${q.v}`}>
                  <line x1={gx(0)} y1={gy(q.x0)} x2={ex} y2={ey} stroke={col} strokeWidth="2.4" strokeDasharray="7 5" strokeLinecap="round" />
                  <Pill x={ex - w / 2 - 4} y={ey + (q.v >= 0 ? -13 : 13)} text={label} bg="#fff" color={col} border={col} size={fs - 1} box={gBox} />
                </g>
              );
            })}

            {/* slope triangle */}
            {showTri && (
              <g>
                <path d={`M${Ax},${Ay} L${Bx},${Ay} L${Bx},${Cy} Z`} fill={C.vel} fillOpacity="0.1" />
                <line x1={Ax} x2={Bx} y1={Ay} y2={Ay} stroke={TIME_INK} strokeWidth="2.6" />
                {Math.abs(Cy - Ay) > 1 && <line x1={Bx} x2={Bx} y1={Ay} y2={Cy} stroke={C.disp} strokeWidth="2.6" />}
                <Pill x={(Ax + Bx) / 2} y={Ay + (v >= 0 ? 15 : -15)} text={t.dtTag(F(tR))} bg="#fff" color={TIME_INK} border="#a5f3fc" size={fs - 1} box={gBox} />
                {Math.abs(dx) > 0.05 && (
                  <Pill x={dxRight ? Bx + 6 + dxW / 2 : Bx - 6 - dxW / 2} y={(Ay + Cy) / 2} text={dxText} bg="#fff" color={C.disp} border="#bfdbfe" size={fs - 1} box={gBox} />
                )}
              </g>
            )}

            {/* this run */}
            {tMax > 0 && <line x1={gx(0)} y1={gy(x0)} x2={gx(tMax)} y2={gy(xMaxT)} stroke={C.disp} strokeWidth="3.2" strokeLinecap="round" />}
            <line x1={g.gL} x2={gx(time)} y1={Cy} y2={Cy} stroke={C.disp} strokeOpacity="0.45" strokeDasharray="3 4" />
            <line x1={gx(time)} x2={gx(time)} y1={g.gB} y2={Cy} stroke={TIME_INK} strokeOpacity="0.4" strokeDasharray="3 4" />
            <circle cx={gx(time)} cy={Cy} r={5.5} fill={C.disp} stroke="#fff" strokeWidth="2" />
            {showTri && Math.abs(v) > 1e-9 && (
              <Pill
                x={clamp(midX - slopeW / 2 - 4, g.gL + slopeW / 2 + 4, g.gR - slopeW / 2 - 4)}
                y={midY + (v > 0 ? -18 : 18)}
                text={slope}
                bg={C.vel}
                size={fs}
                box={gBox}
              />
            )}
            {showTri && Math.abs(v) <= 1e-9 && <Pill x={gx(time)} y={Cy - 20} text={t.flatTag} bg={C.vel} size={fs} box={gBox} />}
          </g>
        );
      }}
    </ScenePanel>
  );
}

