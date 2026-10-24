import { CarFront, Triangle } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { useSimText } from '../kit/lang';
import { rich } from './NonUniformCircular.parts';
import TrackSim from './NonUniformCircular.track';
import ComponentsSim from './NonUniformCircular.components';

/**
 * Lesson "Non-uniform circular motion" (Aylana bo'ylab notekis harakat).
 *
 *   track      - a car speeds up or brakes on a circular track: the tangential
 *                acceleration a_τ = Δv/Δt changes the size of the velocity,
 *                the normal one a_n = v²/R its direction; a = √(a_τ² + a_n²)
 *                leans forward when speeding up and backward when braking.
 *   components - pick a moment (v, a_τ, R) and read the right triangle of
 *                accelerations, with the special cases a_τ = 0 (uniform
 *                circular motion) and R → ∞ (straight-line motion).
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
    },
    card: {
      eyebrow: 'Virtual laboratoriya · Kinematika',
      title: "Aylana bo'ylab notekis harakat",
      tabsLabel: 'Simulyatorni tanlang',
      tabs: {
        track: { label: 'Aylana trek', sub: 'tezlashish va tormozlash' },
        components: { label: 'Tezlanish uchburchagi', sub: 'a_τ, a_n va a' },
      },
    },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: 'Urinma tezlanish', text: "a_τ = Δv/Δt — tezlik qiymatini o'zgartiradi, tezlik bo'ylab (tezlashganda) yoki unga qarshi (sekinlashganda) yo'nalgan." },
        { term: 'Normal tezlanish', text: "a_n = v²/R — tezlik yo'nalishini o'zgartiradi, markazga yo'nalgan." },
        { term: "To'liq tezlanish", text: 'a = √(a_τ² + a_n²), chunki a_τ va a_n o‘zaro perpendikulyar.' },
        { term: 'Xususiy hollar', text: "a_τ = 0 — aylana bo'ylab tekis harakat; R → ∞ — to'g'ri chiziqli harakat (a_n = 0)." },
      ],
    },
    track: {
      presetsLabel: 'Tajriba',
      presets: {
        speed: { name: 'Tezlashish', sub: 'v₀ = 5 m/s · a_τ = +1.5 m/s²' },
        brake: { name: 'Tormozlash', sub: 'v₀ = 20 m/s · a_τ = −2 m/s²' },
        uniform: { name: 'Tekis harakat', sub: 'v = 12 m/s · a_τ = 0' },
      },
      R: 'Trek radiusi',
      v0: "Boshlang'ich tezlik",
      at: 'Urinma tezlanish',
      atHint: "Musbat — tezlik ortadi, manfiy — tormozlash. Tezlik chegarasi 20 m/s (72 km/soat).",
      legend: { v: 'tezlik v', at: 'urinma tezlanish', an: 'normal tezlanish', a: "to'liq tezlanish a", path: 'bosib o‘tilgan yo‘l' },
      betaTag: (b) => `β = ${b}°`,
      zoom: 'Avtomobil yaqindan',
      zoomNote: 'Tezlanish strelkalari kattalashtirilgan; β — v va a orasidagi burchak.',
      sceneLabel: (v, a, b) => `Aylana trekdagi avtomobil: tezlik ${v} m/s, to'liq tezlanish ${a} m/s², tezlik bilan burchagi ${b}°.`,
      readouts: {
        v: 'Tezlik',
        vSub: (kmh) => `${kmh} km/soat`,
        at: 'Urinma tezlanish',
        atAlong: 'a_τ = Δv/Δt · tezlik bo‘ylab',
        atAgainst: 'a_τ = Δv/Δt · tezlikka qarshi',
        atZero: 'a_τ = 0 · tezlik o‘zgarmaydi',
        an: 'Normal tezlanish',
        anSub: 'a_n = v²/R · markazga',
        a: "To'liq tezlanish",
        aSub: (b) => `a = √(a_τ² + a_n²) · β = ${b}°`,
      },
      graph: {
        title: 'Tezlik grafigi v(t)',
        series: 'v(t)',
        x: 't, s',
        y: 'v, m/s',
        note: 'Grafik qiyaligi — urinma tezlanish: a_τ = Δv/Δt. Gorizontal chiziq — tezlik o‘zgarmayapti (a_τ = 0).',
      },
      explain: {
        idle: "«Boshlash»ni bosing. Avtomobil aylana bo'ylab harakatlanadi va tezligi o'zgaradi. Tezlanish ikki tashkil etuvchiga ajraladi: urinma a_τ (ko'k) va normal a_n (pushti).",
        speed: (b) => `Tezlik ortmoqda: a_τ tezlik bo'ylab yo'nalgan, a_n = v²/R esa v bilan birga tez o'smoqda. To'liq tezlanish oldinga og'gan: β = ${b}° < 90°.`,
        brake: (b) => `Tormozlanish: a_τ tezlikka qarshi yo'nalgan, tezlik kamaygani sari a_n = v²/R ham kamaymoqda. To'liq tezlanish orqaga og'gan: β = ${b}° > 90°.`,
        uniform: (an) => `Tezlik o'zgarmayapti: a_τ = 0, to'liq tezlanish a = a_n = v²/R = ${an} m/s² aniq markazga yo'nalgan — bu aylana bo'ylab tekis harakat.`,
        limit: (an) => `Tezlik 20 m/s ga yetdi va endi o'zgarmaydi: a_τ = 0. Tezlanish faqat markazga yo'nalgan, a = a_n = ${an} m/s².`,
        stopped: "Avtomobil to'xtadi: v = 0 bo'lganda a_n = v²/R = 0, tezlanish ham yo'qoldi.",
        start: (at) => `Joyidan qo'zg'alish lahzasi: v = 0, shuning uchun a_n = 0 va to'liq tezlanish urinma bo'ylab: a = a_τ = ${at} m/s².`,
        still: "Avtomobil turibdi: v = 0 va a_τ = 0. Boshlang'ich tezlik yoki urinma tezlanish bering.",
      },
    },
    components: {
      casesLabel: 'Holatlar',
      cases: {
        general: { name: 'Umumiy holat', sub: 'a_τ ≠ 0, a_n ≠ 0' },
        uniform: { name: 'a_τ = 0', sub: 'tekis aylanma' },
        line: { name: 'R → ∞', sub: "to'g'ri chiziq" },
        start: { name: 'v = 0', sub: "joyidan qo'zg'alish" },
        brake: { name: 'Tormozlash', sub: 'a_τ < 0' },
      },
      play: 'Harakat',
      v: 'Shu lahzadagi tezlik',
      at: 'Urinma tezlanish',
      R: 'Egrilik radiusi',
      infinity: '∞',
      legend: { v: 'tezlik v', at: 'urinma tezlanish', an: 'normal tezlanish', a: "to'liq tezlanish a", path: 'trayektoriya' },
      triangle: 'Tezlanishlar uchburchagi',
      toCentre: (r) => `markazga, R = ${r} m`,
      noCentre: "markaz yo'q (R → ∞)",
      formula: (at, an, a) => `a = √(${at}² + ${an}²) = ${a} m/s²`,
      zero: 'a = 0',
      sceneLabel: (at, an, a) => `Tezlanish tashkil etuvchilari: a_τ = ${at}, a_n = ${an}, a = ${a} m/s².`,
      readouts: {
        at: 'Urinma',
        atSub: 'tezlik qiymatini o‘zgartiradi',
        an: 'Normal',
        anSub: 'tezlik yo‘nalishini o‘zgartiradi',
        a: "To'liq",
        aSub: 'a = √(a_τ² + a_n²)',
        beta: 'a va v orasidagi burchak',
        betaSub: { fwd: 'oldinga og‘gan', back: 'orqaga og‘gan', right: 'aniq markazga', along: 'tezlik bo‘ylab', none: 'tezlanish yo‘q' },
      },
      graph: {
        title: (r, at) => `Tezlanish tezlikka qanday bog'liq (R = ${r}, a_τ = ${at} m/s²)`,
        x: 'v, m/s',
        y: 'a, m/s²',
        note: "Grafikni bosing — tezlik o'zgaradi. a_n tezlik kvadratiga proporsional o'sadi.",
      },
      calc: { title: 'Hisoblash', tg: 'tg' },
      explain: {
        general: (b) => `a_τ tezlik qiymatini, a_n — yo'nalishini o'zgartiradi. Ular o'zaro perpendikulyar, shuning uchun to'liq tezlanish Pifagor teoremasi bilan topiladi: a = √(a_τ² + a_n²). β = ${b}° — tezlanish oldinga og'gan.`,
        brake: (b) => `Tormozlanish: a_τ tezlikka qarshi, to'liq tezlanish orqaga og'gan — β = ${b}° > 90°. a_n esa baribir markazga yo'nalgan.`,
        uniform: (an) => `a_τ = 0: tezlik qiymati o'zgarmaydi — bu aylana bo'ylab tekis harakat. To'liq tezlanish a = a_n = v²/R = ${an} m/s² aniq markazga yo'nalgan (β = 90°).`,
        line: (at) => `R → ∞: trayektoriya to'g'ri chiziqqa aylandi, a_n = v²/R → 0. Faqat a = a_τ = ${at} m/s² qoldi — to'g'ri chiziqli tekis o'zgaruvchan harakat.`,
        start: (at) => `v = 0 bo'lgan lahzada a_n = 0: to'liq tezlanish urinma bo'ylab yo'nalgan, a = a_τ = ${at} m/s².`,
        zero: "a_τ = 0 va a_n = 0: tezlanish yo'q — jism to'g'ri chiziq bo'ylab tekis harakatlanadi yoki tinch turadi.",
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
    },
    card: {
      eyebrow: 'Виртуальная лаборатория · Кинематика',
      title: 'Неравномерное движение по окружности',
      tabsLabel: 'Выберите симулятор',
      tabs: {
        track: { label: 'Круговой трек', sub: 'разгон и торможение' },
        components: { label: 'Треугольник ускорений', sub: 'a_τ, a_n и a' },
      },
    },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Тангенциальное ускорение', text: 'a_τ = Δv/Δt — меняет модуль скорости, направлено по скорости (разгон) или против неё (торможение).' },
        { term: 'Нормальное ускорение', text: 'a_n = v²/R — меняет направление скорости, направлено к центру.' },
        { term: 'Полное ускорение', text: 'a = √(a_τ² + a_n²), потому что a_τ и a_n перпендикулярны.' },
        { term: 'Частные случаи', text: 'a_τ = 0 — равномерное движение по окружности; R → ∞ — прямолинейное движение (a_n = 0).' },
      ],
    },
    track: {
      presetsLabel: 'Опыт',
      presets: {
        speed: { name: 'Разгон', sub: 'v₀ = 5 м/с · a_τ = +1,5 м/с²' },
        brake: { name: 'Торможение', sub: 'v₀ = 20 м/с · a_τ = −2 м/с²' },
        uniform: { name: 'Равномерно', sub: 'v = 12 м/с · a_τ = 0' },
      },
      R: 'Радиус трека',
      v0: 'Начальная скорость',
      at: 'Тангенциальное ускорение',
      atHint: 'Плюс — скорость растёт, минус — торможение. Предел скорости 20 м/с (72 км/ч).',
      legend: { v: 'скорость v', at: 'тангенциальное ускорение', an: 'нормальное ускорение', a: 'полное ускорение a', path: 'пройденный путь' },
      betaTag: (b) => `β = ${b}°`,
      zoom: 'Автомобиль крупно',
      zoomNote: 'Стрелки ускорения увеличены; β — угол между v и a.',
      sceneLabel: (v, a, b) => `Автомобиль на круговом треке: скорость ${v} м/с, полное ускорение ${a} м/с², угол со скоростью ${b}°.`,
      readouts: {
        v: 'Скорость',
        vSub: (kmh) => `${kmh} км/ч`,
        at: 'Тангенциальное',
        atAlong: 'a_τ = Δv/Δt · по скорости',
        atAgainst: 'a_τ = Δv/Δt · против скорости',
        atZero: 'a_τ = 0 · скорость не меняется',
        an: 'Нормальное',
        anSub: 'a_n = v²/R · к центру',
        a: 'Полное ускорение',
        aSub: (b) => `a = √(a_τ² + a_n²) · β = ${b}°`,
      },
      graph: {
        title: 'График скорости v(t)',
        series: 'v(t)',
        x: 't, с',
        y: 'v, м/с',
        note: 'Наклон графика — тангенциальное ускорение: a_τ = Δv/Δt. Горизонтальный участок — скорость не меняется (a_τ = 0).',
      },
      explain: {
        idle: 'Нажмите «Старт». Автомобиль едет по окружности, и его скорость меняется. Ускорение раскладывается на две составляющие: тангенциальную a_τ (синяя) и нормальную a_n (розовая).',
        speed: (b) => `Скорость растёт: a_τ направлено по скорости, а a_n = v²/R быстро растёт вместе с v. Полное ускорение наклонено вперёд: β = ${b}° < 90°.`,
        brake: (b) => `Торможение: a_τ направлено против скорости, и по мере уменьшения скорости уменьшается a_n = v²/R. Полное ускорение наклонено назад: β = ${b}° > 90°.`,
        uniform: (an) => `Скорость не меняется: a_τ = 0, полное ускорение a = a_n = v²/R = ${an} м/с² направлено точно к центру — это равномерное движение по окружности.`,
        limit: (an) => `Скорость достигла 20 м/с и больше не меняется: a_τ = 0. Ускорение направлено только к центру, a = a_n = ${an} м/с².`,
        stopped: 'Автомобиль остановился: при v = 0 и a_n = v²/R = 0, ускорения больше нет.',
        start: (at) => `Момент трогания: v = 0, поэтому a_n = 0 и полное ускорение направлено по касательной: a = a_τ = ${at} м/с².`,
        still: 'Автомобиль стоит: v = 0 и a_τ = 0. Задайте начальную скорость или тангенциальное ускорение.',
      },
    },
    components: {
      casesLabel: 'Случаи',
      cases: {
        general: { name: 'Общий случай', sub: 'a_τ ≠ 0, a_n ≠ 0' },
        uniform: { name: 'a_τ = 0', sub: 'равномерно по кругу' },
        line: { name: 'R → ∞', sub: 'прямая' },
        start: { name: 'v = 0', sub: 'трогание с места' },
        brake: { name: 'Торможение', sub: 'a_τ < 0' },
      },
      play: 'Движение',
      v: 'Скорость в этот момент',
      at: 'Тангенциальное ускорение',
      R: 'Радиус кривизны',
      infinity: '∞',
      legend: { v: 'скорость v', at: 'тангенциальное', an: 'нормальное', a: 'полное ускорение a', path: 'траектория' },
      triangle: 'Треугольник ускорений',
      toCentre: (r) => `к центру, R = ${r} м`,
      noCentre: 'центра нет (R → ∞)',
      formula: (at, an, a) => `a = √(${at}² + ${an}²) = ${a} м/с²`,
      zero: 'a = 0',
      sceneLabel: (at, an, a) => `Составляющие ускорения: a_τ = ${at}, a_n = ${an}, a = ${a} м/с².`,
      readouts: {
        at: 'Тангенциальное',
        atSub: 'меняет модуль скорости',
        an: 'Нормальное',
        anSub: 'меняет направление скорости',
        a: 'Полное',
        aSub: 'a = √(a_τ² + a_n²)',
        beta: 'Угол между a и v',
        betaSub: { fwd: 'наклонено вперёд', back: 'наклонено назад', right: 'точно к центру', along: 'вдоль скорости', none: 'ускорения нет' },
      },
      graph: {
        title: (r, at) => `Как ускорение зависит от скорости (R = ${r}, a_τ = ${at} м/с²)`,
        x: 'v, м/с',
        y: 'a, м/с²',
        note: 'Нажмите на график — скорость изменится. a_n растёт пропорционально квадрату скорости.',
      },
      calc: { title: 'Расчёт', tg: 'tg' },
      explain: {
        general: (b) => `a_τ меняет модуль скорости, a_n — её направление. Они перпендикулярны, поэтому полное ускорение находят по теореме Пифагора: a = √(a_τ² + a_n²). β = ${b}° — ускорение наклонено вперёд.`,
        brake: (b) => `Торможение: a_τ против скорости, полное ускорение наклонено назад — β = ${b}° > 90°. А a_n по-прежнему направлено к центру.`,
        uniform: (an) => `a_τ = 0: модуль скорости не меняется — это равномерное движение по окружности. Полное ускорение a = a_n = v²/R = ${an} м/с² направлено точно к центру (β = 90°).`,
        line: (at) => `R → ∞: траектория стала прямой, a_n = v²/R → 0. Осталось только a = a_τ = ${at} м/с² — прямолинейное равнопеременное движение.`,
        start: (at) => `В момент, когда v = 0, a_n = 0: полное ускорение направлено по касательной, a = a_τ = ${at} м/с².`,
        zero: 'a_τ = 0 и a_n = 0: ускорения нет — тело движется равномерно по прямой или покоится.',
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
    },
    card: {
      eyebrow: 'Virtual laboratory · Kinematics',
      title: 'Non-uniform circular motion',
      tabsLabel: 'Choose a simulator',
      tabs: {
        track: { label: 'Circular track', sub: 'speeding up and braking' },
        components: { label: 'Acceleration triangle', sub: 'a_τ, a_n and a' },
      },
    },
    facts: {
      title: 'Remember',
      items: [
        { term: 'Tangential acceleration', text: 'a_τ = Δv/Δt — changes the size of the velocity; points along it (speeding up) or against it (slowing down).' },
        { term: 'Normal acceleration', text: 'a_n = v²/R — changes the direction of the velocity; points to the centre.' },
        { term: 'Total acceleration', text: 'a = √(a_τ² + a_n²), because a_τ and a_n are perpendicular.' },
        { term: 'Special cases', text: 'a_τ = 0 — uniform circular motion; R → ∞ — straight-line motion (a_n = 0).' },
      ],
    },
    track: {
      presetsLabel: 'Experiment',
      presets: {
        speed: { name: 'Speeding up', sub: 'v₀ = 5 m/s · a_τ = +1.5 m/s²' },
        brake: { name: 'Braking', sub: 'v₀ = 20 m/s · a_τ = −2 m/s²' },
        uniform: { name: 'Steady speed', sub: 'v = 12 m/s · a_τ = 0' },
      },
      R: 'Track radius',
      v0: 'Initial speed',
      at: 'Tangential acceleration',
      atHint: 'Positive — speeding up, negative — braking. Speed limit 20 m/s (72 km/h).',
      legend: { v: 'velocity v', at: 'tangential acceleration', an: 'normal acceleration', a: 'total acceleration a', path: 'path covered' },
      betaTag: (b) => `β = ${b}°`,
      zoom: 'The car up close',
      zoomNote: 'Acceleration arrows enlarged; β is the angle between v and a.',
      sceneLabel: (v, a, b) => `Car on a circular track: speed ${v} m/s, total acceleration ${a} m/s², ${b}° from the velocity.`,
      readouts: {
        v: 'Speed',
        vSub: (kmh) => `${kmh} km/h`,
        at: 'Tangential',
        atAlong: 'a_τ = Δv/Δt · along the velocity',
        atAgainst: 'a_τ = Δv/Δt · against the velocity',
        atZero: 'a_τ = 0 · speed not changing',
        an: 'Normal',
        anSub: 'a_n = v²/R · to the centre',
        a: 'Total acceleration',
        aSub: (b) => `a = √(a_τ² + a_n²) · β = ${b}°`,
      },
      graph: {
        title: 'Speed graph v(t)',
        series: 'v(t)',
        x: 't, s',
        y: 'v, m/s',
        note: 'The slope of the graph is the tangential acceleration: a_τ = Δv/Δt. A flat stretch means the speed is not changing (a_τ = 0).',
      },
      explain: {
        idle: 'Press Start. The car goes round the circle while its speed changes. The acceleration splits into two parts: tangential a_τ (blue) and normal a_n (pink).',
        speed: (b) => `Speeding up: a_τ points along the velocity, and a_n = v²/R grows fast as v grows. The total acceleration leans forward: β = ${b}° < 90°.`,
        brake: (b) => `Braking: a_τ points against the velocity, and as the speed drops so does a_n = v²/R. The total acceleration leans backward: β = ${b}° > 90°.`,
        uniform: (an) => `The speed is not changing: a_τ = 0, and the total acceleration a = a_n = v²/R = ${an} m/s² points straight at the centre — uniform circular motion.`,
        limit: (an) => `The speed has reached 20 m/s and stays there: a_τ = 0. The acceleration now points only at the centre, a = a_n = ${an} m/s².`,
        stopped: 'The car has stopped: with v = 0, a_n = v²/R = 0 and the acceleration is gone.',
        start: (at) => `The moment of moving off: v = 0, so a_n = 0 and the total acceleration is along the tangent: a = a_τ = ${at} m/s².`,
        still: 'The car is standing still: v = 0 and a_τ = 0. Give it an initial speed or a tangential acceleration.',
      },
    },
    components: {
      casesLabel: 'Cases',
      cases: {
        general: { name: 'General case', sub: 'a_τ ≠ 0, a_n ≠ 0' },
        uniform: { name: 'a_τ = 0', sub: 'uniform circular' },
        line: { name: 'R → ∞', sub: 'straight line' },
        start: { name: 'v = 0', sub: 'moving off' },
        brake: { name: 'Braking', sub: 'a_τ < 0' },
      },
      play: 'Motion',
      v: 'Speed at this moment',
      at: 'Tangential acceleration',
      R: 'Radius of curvature',
      infinity: '∞',
      legend: { v: 'velocity v', at: 'tangential', an: 'normal', a: 'total acceleration a', path: 'trajectory' },
      triangle: 'Acceleration triangle',
      toCentre: (r) => `to the centre, R = ${r} m`,
      noCentre: 'no centre (R → ∞)',
      formula: (at, an, a) => `a = √(${at}² + ${an}²) = ${a} m/s²`,
      zero: 'a = 0',
      sceneLabel: (at, an, a) => `Acceleration components: a_τ = ${at}, a_n = ${an}, a = ${a} m/s².`,
      readouts: {
        at: 'Tangential',
        atSub: 'changes the size of v',
        an: 'Normal',
        anSub: 'changes the direction of v',
        a: 'Total',
        aSub: 'a = √(a_τ² + a_n²)',
        beta: 'Angle between a and v',
        betaSub: { fwd: 'leans forward', back: 'leans backward', right: 'straight at the centre', along: 'along the velocity', none: 'no acceleration' },
      },
      graph: {
        title: (r, at) => `How the acceleration depends on speed (R = ${r}, a_τ = ${at} m/s²)`,
        x: 'v, m/s',
        y: 'a, m/s²',
        note: 'Click the graph to change the speed. a_n grows with the square of the speed.',
      },
      calc: { title: 'Working', tg: 'tan' },
      explain: {
        general: (b) => `a_τ changes the size of the velocity, a_n its direction. They are perpendicular, so the total comes from Pythagoras: a = √(a_τ² + a_n²). β = ${b}° — the acceleration leans forward.`,
        brake: (b) => `Braking: a_τ points against the velocity, so the total acceleration leans backward — β = ${b}° > 90°. a_n still points at the centre.`,
        uniform: (an) => `a_τ = 0: the speed does not change — uniform circular motion. The total acceleration a = a_n = v²/R = ${an} m/s² points straight at the centre (β = 90°).`,
        line: (at) => `R → ∞: the path has become a straight line and a_n = v²/R → 0. Only a = a_τ = ${at} m/s² is left — uniformly accelerated straight-line motion.`,
        start: (at) => `At the moment v = 0, a_n = 0: the total acceleration points along the tangent, a = a_τ = ${at} m/s².`,
        zero: 'a_τ = 0 and a_n = 0: no acceleration — the body moves uniformly in a straight line or is at rest.',
      },
    },
  },
};

export default function NonUniformCircular() {
  const T = useSimText(TEXT);
  const tabs = T.card.tabs;
  return (
    <SimCard
      idPrefix="nonuniform"
      eyebrow={T.card.eyebrow}
      title={T.card.title}
      tabsLabel={T.card.tabsLabel}
      tabs={[
        { id: 'track', label: tabs.track.label, sub: rich(tabs.track.sub), icon: CarFront, render: () => <TrackSim T={T} /> },
        { id: 'components', label: tabs.components.label, sub: rich(tabs.components.sub), icon: Triangle, render: () => <ComponentsSim T={T} /> },
      ]}
      facts={{ title: T.facts.title, items: T.facts.items.map((f) => ({ term: f.term, text: rich(f.text) })) }}
    />
  );
}
