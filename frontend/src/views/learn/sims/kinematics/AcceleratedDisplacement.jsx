import { useState } from 'react';
import { CarFront, Lightbulb, OctagonMinus, Rabbit, Ruler as RulerIcon, Sigma, Turtle } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { Arrow, Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { useSimText } from '../kit/lang';
import { Chip, FormulaTile, GroupLabel, LabScene, PlayControls, Rich, SideCar, SideRoad, StrobeMarks, lineView, niceMax, num, rulerStep, tickDigits } from './Acceleration.parts';
import BrakingDistanceSim from './AcceleratedDisplacement.brake';

/**
 * Lesson "Tekis tezlanuvchan harakatda ko'chish":
 *  1. the three displacement formulas — s = v₀t + at²/2, s = (v² − v₀²)/(2a),
 *     s = ((v₀ + v)/2)·t — evaluated side by side on a live run, with the
 *     distance covered in each second (1 : 3 : 5 : 7 from rest);
 *  2. braking distance s = v₀²/(2|a|): double the speed, four times the road.
 * The lesson's example (from rest, a = 2 m/s², 6 s → s = 36 m, v = 12 m/s)
 * is the first preset.
 */

const TEXT = {
  uz: {
    card: {
      eyebrow: 'Virtual laboratoriya · Kinematika',
      title: "Tekis tezlanuvchan harakatda ko'chish",
      tabsLabel: 'Tajribani tanlang',
      tabs: {
        formulas: { label: "Ko'chish formulalari", sub: 's = v₀t + at²/2' },
        brake: { label: "Tormozlanish yo'li", sub: 's = v₀² / (2|a|)' },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: 's = v₀t + at²/2', text: "vaqt ma'lum bo'lsa, ko'chishni shu formula beradi; s = v·t bu yerda yaramaydi." },
        { term: 's = (v² − v₀²) / (2a)', text: "vaqt noma'lum bo'lganda qulay; tormozlanish yo'li ham shu formuladan topiladi." },
        { term: 's = ((v₀ + v) / 2) · t', text: "o'rtacha tezlik orqali — tezlik bir tekis o'zgargani uchun to'g'ri." },
        { term: '1 : 3 : 5 : 7', text: "tinch holatdan boshlansa, ketma-ket sekundlarda bosilgan yo'llar toq sonlar kabi o'sadi." },
      ],
    },
    formulas: {
      presetsLabel: 'Tayyor holatlar',
      presets: {
        lesson: { name: 'Darslikdagi misol', sub: 'v₀ = 0 · a = 2 m/s² · 6 s' },
        moving: { name: 'Harakatdan tezlanish', sub: 'v₀ = 5 m/s · a = 1 m/s² · 8 s' },
        gentle: { name: 'Sekin tezlanish', sub: 'v₀ = 10 m/s · a = 0.5 m/s² · 10 s' },
      },
      v0: "Boshlang'ich tezlik",
      a: 'Tezlanish',
      T: 'Harakat vaqti',
      kmh: (k) => `≈ ${k} km/soat`,
      aHint: "a > 0: avtomobil tezlashadi (tormozlanish — keyingi tajribada)",
      THint: (s, v) => `Oxirida: s = ${s} m, v = ${v} m/s`,
      legend: { s: "ko'chish s", v: 'tezlik v', marks: "har 1 s dagi o'rni", seg: "shu sekundda bosilgan yo'l" },
      chipReal: 'Real vaqt',
      axisX: 'x, m',
      sceneLabel: (t, s, v) => `Tezlanayotgan avtomobil. t = ${t} s, ko'chish ${s} m, tezlik ${v} m/s.`,
      sTag: (s) => `s = ${s} m`,
      vTag: (v) => `v = ${v} m/s`,
      segTag: (d) => `${d} m`,
      secTag: (n) => `${n} s`,
      readouts: { t: 'Vaqt', v: 'Tezlik', s: "Ko'chish", per: "Har sekunddagi yo'l" },
      tSub: (T) => `Harakat ${T} s davom etadi`,
      vSub: (v0, a, t) => `v = ${v0} + ${a} · ${t}`,
      sSub: "start chizig'idan hisoblanadi",
      perOdd: (r) => `Tinch holatdan — ${r}`,
      perDiff: (d) => `har sekundda ${d} m ga ko'proq`,
      perEmpty: '1-sekund tugashini kuting',
      formulasTitle: 'Uchta formula — bitta javob',
      f1: 'Vaqt orqali',
      f2: 'Vaqtsiz',
      f3: "O'rtacha tezlik orqali",
      agree: 'Uchala formula bir xil natija beradi',
      graph: {
        title: 'Grafik: v(t), yuza = s',
        live: 'v(t)',
        plan: 'reja',
        t: 't, s',
        v: 'v, m/s',
        note: "Grafik ostidagi trapetsiya yuzasi ((v₀ + v) / 2) · t — bu aynan ko'chish s.",
      },
      explain: {
        idle: "«Boshlash»ni bosing. Har sekundda avtomobilning o'rni belgilanadi — oraliqlar tobora uzayadi, chunki tezlik oshib boryapti.",
        odd: "Tinch holatdan: 1-sekundda 1 ulush, 2-sida 3 ulush, 3-sida 5 ulush yo'l… Ketma-ket yo'llar 1 : 3 : 5 : 7 kabi o'sadi.",
        running: (d) => `Har keyingi sekundda avtomobil oldingisidan ${d} m ko'proq yo'l bosmoqda — tezlik oshgani sari oraliqlar uzaymoqda.`,
        why: "Nega s = v·t emas? Tezlik o'zgarib turadi — qaysi v ni olamiz? O'rtacha tezlik (v₀ + v) / 2 ni olsak, javob to'g'ri chiqadi.",
        lessonDone: "s = 0 + 2 · 6² / 2 = 36 m, v = 0 + 2 · 6 = 12 m/s. Tekshiramiz: ((0 + 12) / 2) · 6 = 36 m — javob bir xil.",
        done: (t, s, v) => `${t} s da avtomobil ${s} m yo'l bosdi va ${v} m/s tezlikka erishdi. Uchala formula ham ${s} m beradi.`,
      },
    },
    brake: {
      speed: '1-avtomobil tezligi',
      speedHint: (ms, v2) => `= ${ms} m/s · 2-avtomobil 2 marta tezroq: ${v2} km/soat`,
      surfaceLabel: "Yo'l qoplamasi",
      surfaces: {
        dry: { name: 'Quruq asfalt', sub: '|a| ≈ 7 m/s²' },
        wet: { name: "Ho'l asfalt", sub: '|a| ≈ 4.5 m/s²' },
        snow: { name: 'Qor', sub: '|a| ≈ 2.5 m/s²' },
        ice: { name: 'Muz', sub: '|a| ≈ 1 m/s²' },
      },
      legend: { car1: '1-avtomobil (v)', car2: '2-avtomobil (2v)', skid: 'tormoz izi', zebra: "piyodalar o'tish joyi" },
      brakeLine: 'tormoz bosildi',
      chipReal: 'Real vaqt',
      chipFast: (k) => `Vaqt ×${k} tezlashtirilgan`,
      axisX: 'x, m',
      sceneLabel: (v1, s1, v2, s2) => `Ikki yo'lakli yo'l yuqoridan. ${v1} km/soat tezlikdagi avtomobil ${s1} m da, ${v2} km/soat tezlikdagisi ${s2} m da to'xtaydi.`,
      distTag: (s) => `${s} m`,
      times4: '× 4',
      speedTag: (k) => `${k} km/soat`,
      readouts: { s1: '1-avtomobil yo‘li', s2: '2-avtomobil yo‘li', ratio: 'Nisbat s₂ : s₁', t: 'Vaqt' },
      sSub: (v, t) => `${v} km/soat · ${t} s da to'xtaydi`,
      ratioSub: '(2v)² : v² = 4 : 1',
      tSub: (t1, t2) => `to'xtash: ${t1} s va ${t2} s`,
      formula: {
        tag: "Tormozlanish yo'li",
        general: 'v = 0  ⇒  s = v₀² / (2|a|)',
        filled: (v0, a, s) => `s = ${v0}² / (2 · ${a}) = ${s} m`,
      },
      graph: {
        title: "Grafik: tormozlanish yo'li s(v₀)",
        x: 'v₀, km/soat',
        y: 's, m',
        p1: '1-avtomobil',
        p2: '2-avtomobil',
        note: "Egri chiziq — parabola: tezlik 2 marta oshsa, yo'l 4 marta oshadi. Haydovchining reaksiya vaqtidagi yo'l bunga qo'shilmagan.",
      },
      explain: {
        idle: "Ikkala haydovchi bir paytda, bir chiziqda tormozni bosadi. 2-avtomobil 2 marta tez ketyapti. Qaysi biri qayerda to'xtaydi?",
        braking: "Ikkalasi bir xil tezlanish bilan sekinlashmoqda, lekin tezrog'iga to'xtash uchun 2 marta ko'p vaqt kerak.",
        oneStopped: (s) => `1-avtomobil ${s} m da to'xtadi. 2-si hali ham harakatda!`,
        done: (s1, s2) => `Tezlik 2 marta katta — tormozlanish yo'li 4 marta uzun: ${s1} m va ${s2} m. s = v₀² / (2|a|) da tezlik kvadratda turadi.`,
        zebra: {
          none: "Ikkalasi ham piyodalar o'tish joyigacha to'xtadi.",
          second: "2-avtomobil piyodalar o'tish joyigacha to'xtay olmadi — xavfli!",
          both: "Ikkala avtomobil ham piyodalar o'tish joyigacha to'xtay olmadi — sirpanchiq yo'lda sekin yuring!",
        },
      },
    },
  },
  ru: {
    card: {
      eyebrow: 'Виртуальная лаборатория · Кинематика',
      title: 'Перемещение при равноускоренном движении',
      tabsLabel: 'Выберите опыт',
      tabs: {
        formulas: { label: 'Формулы перемещения', sub: 's = v₀t + at²/2' },
        brake: { label: 'Тормозной путь', sub: 's = v₀² / (2|a|)' },
      },
    },
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    facts: {
      title: 'Запомните',
      items: [
        { term: 's = v₀t + at²/2', text: 'перемещение, когда известно время; формула s = v·t здесь не годится.' },
        { term: 's = (v² − v₀²) / (2a)', text: 'удобна, когда время неизвестно; по ней же находят тормозной путь.' },
        { term: 's = ((v₀ + v) / 2) · t', text: 'через среднюю скорость — верно, потому что скорость меняется равномерно.' },
        { term: '1 : 3 : 5 : 7', text: 'при старте с места пути за последовательные секунды растут как нечётные числа.' },
      ],
    },
    formulas: {
      presetsLabel: 'Готовые случаи',
      presets: {
        lesson: { name: 'Пример из урока', sub: 'v₀ = 0 · a = 2 м/с² · 6 с' },
        moving: { name: 'Разгон на ходу', sub: 'v₀ = 5 м/с · a = 1 м/с² · 8 с' },
        gentle: { name: 'Плавный разгон', sub: 'v₀ = 10 м/с · a = 0,5 м/с² · 10 с' },
      },
      v0: 'Начальная скорость',
      a: 'Ускорение',
      T: 'Время движения',
      kmh: (k) => `≈ ${k} км/ч`,
      aHint: 'a > 0: машина разгоняется (торможение — в следующем опыте)',
      THint: (s, v) => `В конце: s = ${s} м, v = ${v} м/с`,
      legend: { s: 'перемещение s', v: 'скорость v', marks: 'положение через каждую 1 с', seg: 'путь за эту секунду' },
      chipReal: 'Реальное время',
      axisX: 'x, м',
      sceneLabel: (t, s, v) => `Разгоняющийся автомобиль. t = ${t} с, перемещение ${s} м, скорость ${v} м/с.`,
      sTag: (s) => `s = ${s} м`,
      vTag: (v) => `v = ${v} м/с`,
      segTag: (d) => `${d} м`,
      secTag: (n) => `${n} с`,
      readouts: { t: 'Время', v: 'Скорость', s: 'Перемещение', per: 'Путь за каждую секунду' },
      tSub: (T) => `Движение длится ${T} с`,
      vSub: (v0, a, t) => `v = ${v0} + ${a} · ${t}`,
      sSub: 'отсчитывается от линии старта',
      perOdd: (r) => `С места — ${r}`,
      perDiff: (d) => `каждую секунду на ${d} м больше`,
      perEmpty: 'дождитесь конца 1-й секунды',
      formulasTitle: 'Три формулы — один ответ',
      f1: 'Через время',
      f2: 'Без времени',
      f3: 'Через среднюю скорость',
      agree: 'Все три формулы дают одинаковый результат',
      graph: {
        title: 'График: v(t), площадь = s',
        live: 'v(t)',
        plan: 'план',
        t: 't, с',
        v: 'v, м/с',
        note: 'Площадь трапеции под графиком ((v₀ + v) / 2) · t — это и есть перемещение s.',
      },
      explain: {
        idle: 'Нажмите «Старт». Каждую секунду положение машины отмечается — промежутки всё длиннее, потому что скорость растёт.',
        odd: 'С места: за 1-ю секунду 1 доля пути, за 2-ю — 3 доли, за 3-ю — 5 долей… Пути за последовательные секунды растут как 1 : 3 : 5 : 7.',
        running: (d) => `За каждую следующую секунду машина проезжает на ${d} м больше, чем за предыдущую: скорость растёт — промежутки удлиняются.`,
        why: 'Почему не s = v·t? Скорость всё время меняется — какую v брать? Если взять среднюю скорость (v₀ + v) / 2, ответ получается верным.',
        lessonDone: 's = 0 + 2 · 6² / 2 = 36 м, v = 0 + 2 · 6 = 12 м/с. Проверим: ((0 + 12) / 2) · 6 = 36 м — ответ тот же.',
        done: (t, s, v) => `За ${t} с машина проехала ${s} м и разогналась до ${v} м/с. Все три формулы дают ${s} м.`,
      },
    },
    brake: {
      speed: 'Скорость 1-й машины',
      speedHint: (ms, v2) => `= ${ms} м/с · 2-я машина вдвое быстрее: ${v2} км/ч`,
      surfaceLabel: 'Покрытие дороги',
      surfaces: {
        dry: { name: 'Сухой асфальт', sub: '|a| ≈ 7 м/с²' },
        wet: { name: 'Мокрый асфальт', sub: '|a| ≈ 4,5 м/с²' },
        snow: { name: 'Снег', sub: '|a| ≈ 2,5 м/с²' },
        ice: { name: 'Лёд', sub: '|a| ≈ 1 м/с²' },
      },
      legend: { car1: '1-я машина (v)', car2: '2-я машина (2v)', skid: 'тормозной след', zebra: 'пешеходный переход' },
      brakeLine: 'нажат тормоз',
      chipReal: 'Реальное время',
      chipFast: (k) => `Время ускорено ×${k}`,
      axisX: 'x, м',
      sceneLabel: (v1, s1, v2, s2) => `Двухполосная дорога сверху. Машина на ${v1} км/ч останавливается через ${s1} м, на ${v2} км/ч — через ${s2} м.`,
      distTag: (s) => `${s} м`,
      times4: '× 4',
      speedTag: (k) => `${k} км/ч`,
      readouts: { s1: 'Путь 1-й машины', s2: 'Путь 2-й машины', ratio: 'Отношение s₂ : s₁', t: 'Время' },
      sSub: (v, t) => `${v} км/ч · остановка через ${t} с`,
      ratioSub: '(2v)² : v² = 4 : 1',
      tSub: (t1, t2) => `остановки: ${t1} с и ${t2} с`,
      formula: {
        tag: 'Тормозной путь',
        general: 'v = 0  ⇒  s = v₀² / (2|a|)',
        filled: (v0, a, s) => `s = ${v0}² / (2 · ${a}) = ${s} м`,
      },
      graph: {
        title: 'График: тормозной путь s(v₀)',
        x: 'v₀, км/ч',
        y: 's, м',
        p1: '1-я машина',
        p2: '2-я машина',
        note: 'Кривая — парабола: скорость больше в 2 раза — путь больше в 4 раза. Путь за время реакции водителя сюда не входит.',
      },
      explain: {
        idle: 'Оба водителя нажимают на тормоз в один момент на одной линии. 2-я машина едет вдвое быстрее. Где остановится каждая?',
        braking: 'Обе машины замедляются с одинаковым ускорением, но более быстрой нужно вдвое больше времени, чтобы остановиться.',
        oneStopped: (s) => `1-я машина остановилась через ${s} м. А 2-я всё ещё едет!`,
        done: (s1, s2) => `Скорость в 2 раза больше — тормозной путь в 4 раза длиннее: ${s1} м и ${s2} м. В s = v₀² / (2|a|) скорость стоит в квадрате.`,
        zebra: {
          none: 'Обе машины остановились до пешеходного перехода.',
          second: '2-я машина не успела остановиться до перехода — опасно!',
          both: 'Ни одна машина не успела остановиться до перехода — на скользкой дороге езжайте медленнее!',
        },
      },
    },
  },
  en: {
    card: {
      eyebrow: 'Virtual lab · Kinematics',
      title: 'Displacement in uniformly accelerated motion',
      tabsLabel: 'Choose an experiment',
      tabs: {
        formulas: { label: 'Displacement formulas', sub: 's = v₀t + at²/2' },
        brake: { label: 'Braking distance', sub: 's = v₀² / (2|a|)' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Run again', reset: 'Reset' },
    facts: {
      title: 'Remember',
      items: [
        { term: 's = v₀t + at²/2', text: 'the displacement when the time is known; s = v·t does not work here.' },
        { term: 's = (v² − v₀²) / (2a)', text: 'handy when the time is unknown; it also gives the braking distance.' },
        { term: 's = ((v₀ + v) / 2) · t', text: 'through the average velocity — valid because the velocity changes at a steady rate.' },
        { term: '1 : 3 : 5 : 7', text: 'starting from rest, the distances covered in successive seconds grow like the odd numbers.' },
      ],
    },
    formulas: {
      presetsLabel: 'Ready-made cases',
      presets: {
        lesson: { name: 'Lesson example', sub: 'v₀ = 0 · a = 2 m/s² · 6 s' },
        moving: { name: 'Speeding up on the move', sub: 'v₀ = 5 m/s · a = 1 m/s² · 8 s' },
        gentle: { name: 'Gentle acceleration', sub: 'v₀ = 10 m/s · a = 0.5 m/s² · 10 s' },
      },
      v0: 'Initial velocity',
      a: 'Acceleration',
      T: 'Time of motion',
      kmh: (k) => `≈ ${k} km/h`,
      aHint: 'a > 0: the car speeds up (braking is the next experiment)',
      THint: (s, v) => `At the end: s = ${s} m, v = ${v} m/s`,
      legend: { s: 'displacement s', v: 'velocity v', marks: 'position every 1 s', seg: 'distance in that second' },
      chipReal: 'Real time',
      axisX: 'x, m',
      sceneLabel: (t, s, v) => `An accelerating car. t = ${t} s, displacement ${s} m, velocity ${v} m/s.`,
      sTag: (s) => `s = ${s} m`,
      vTag: (v) => `v = ${v} m/s`,
      segTag: (d) => `${d} m`,
      secTag: (n) => `${n} s`,
      readouts: { t: 'Time', v: 'Velocity', s: 'Displacement', per: 'Distance in each second' },
      tSub: (T) => `The motion lasts ${T} s`,
      vSub: (v0, a, t) => `v = ${v0} + ${a} · ${t}`,
      sSub: 'measured from the start line',
      perOdd: (r) => `From rest — ${r}`,
      perDiff: (d) => `${d} m more every second`,
      perEmpty: 'wait for the 1st second to end',
      formulasTitle: 'Three formulas — one answer',
      f1: 'Using the time',
      f2: 'Without the time',
      f3: 'Using the average velocity',
      agree: 'All three formulas give the same result',
      graph: {
        title: 'Graph: v(t), area = s',
        live: 'v(t)',
        plan: 'plan',
        t: 't, s',
        v: 'v, m/s',
        note: 'The area of the trapezoid under the graph, ((v₀ + v) / 2) · t, is exactly the displacement s.',
      },
      explain: {
        idle: 'Press Start. The car’s position is marked every second — the gaps get longer and longer because the velocity keeps growing.',
        odd: 'From rest: 1 share of the distance in the 1st second, 3 in the 2nd, 5 in the 3rd… Successive distances grow as 1 : 3 : 5 : 7.',
        running: (d) => `Each second the car covers ${d} m more than in the second before: as the velocity grows, the gaps grow.`,
        why: 'Why not s = v·t? The velocity keeps changing — which v would we use? Take the average velocity (v₀ + v) / 2 and the answer comes out right.',
        lessonDone: 's = 0 + 2 · 6² / 2 = 36 m, v = 0 + 2 · 6 = 12 m/s. Check: ((0 + 12) / 2) · 6 = 36 m — the same answer.',
        done: (t, s, v) => `In ${t} s the car covered ${s} m and reached ${v} m/s. All three formulas give ${s} m.`,
      },
    },
    brake: {
      speed: 'Speed of car 1',
      speedHint: (ms, v2) => `= ${ms} m/s · car 2 is twice as fast: ${v2} km/h`,
      surfaceLabel: 'Road surface',
      surfaces: {
        dry: { name: 'Dry asphalt', sub: '|a| ≈ 7 m/s²' },
        wet: { name: 'Wet asphalt', sub: '|a| ≈ 4.5 m/s²' },
        snow: { name: 'Snow', sub: '|a| ≈ 2.5 m/s²' },
        ice: { name: 'Ice', sub: '|a| ≈ 1 m/s²' },
      },
      legend: { car1: 'car 1 (v)', car2: 'car 2 (2v)', skid: 'skid marks', zebra: 'pedestrian crossing' },
      brakeLine: 'brakes on',
      chipReal: 'Real time',
      chipFast: (k) => `Time sped up ×${k}`,
      axisX: 'x, m',
      sceneLabel: (v1, s1, v2, s2) => `A two-lane road from above. The car at ${v1} km/h stops after ${s1} m, the one at ${v2} km/h after ${s2} m.`,
      distTag: (s) => `${s} m`,
      times4: '× 4',
      speedTag: (k) => `${k} km/h`,
      readouts: { s1: 'Distance of car 1', s2: 'Distance of car 2', ratio: 'Ratio s₂ : s₁', t: 'Time' },
      sSub: (v, t) => `${v} km/h · stops after ${t} s`,
      ratioSub: '(2v)² : v² = 4 : 1',
      tSub: (t1, t2) => `stops at ${t1} s and ${t2} s`,
      formula: {
        tag: 'Braking distance',
        general: 'v = 0  ⇒  s = v₀² / (2|a|)',
        filled: (v0, a, s) => `s = ${v0}² / (2 · ${a}) = ${s} m`,
      },
      graph: {
        title: 'Graph: braking distance s(v₀)',
        x: 'v₀, km/h',
        y: 's, m',
        p1: 'car 1',
        p2: 'car 2',
        note: 'The curve is a parabola: twice the speed, four times the distance. The distance covered during the driver’s reaction time is not included.',
      },
      explain: {
        idle: 'Both drivers brake at the same moment on the same line. Car 2 is going twice as fast. Where does each one stop?',
        braking: 'Both slow down with the same acceleration, but the faster car needs twice as long to stop.',
        oneStopped: (s) => `Car 1 has stopped after ${s} m. Car 2 is still moving!`,
        done: (s1, s2) => `Twice the speed — four times the braking distance: ${s1} m and ${s2} m. In s = v₀² / (2|a|) the speed is squared.`,
        zebra: {
          none: 'Both cars stopped before the pedestrian crossing.',
          second: 'Car 2 could not stop before the crossing — dangerous!',
          both: 'Neither car could stop before the crossing — slow down on slippery roads!',
        },
      },
    },
  },
};

/* ================================================================= card */

export default function AcceleratedDisplacement() {
  const T = useSimText(TEXT);
  const tabs = [
    { id: 'formulas', ...T.card.tabs.formulas, icon: Sigma, render: () => <FormulasSim T={T} /> },
    { id: 'brake', ...T.card.tabs.brake, icon: OctagonMinus, render: () => <BrakingDistanceSim T={T} /> },
  ];
  return <SimCard eyebrow={T.card.eyebrow} title={T.card.title} tabsLabel={T.card.tabsLabel} tabs={tabs} facts={T.facts} icon={RulerIcon} idPrefix="adisp" />;
}

/* ============================================================ formulas */

const PRESETS = {
  lesson: { v0: 0, a: 2, T: 6, icon: CarFront },
  moving: { v0: 5, a: 1, T: 8, icon: Rabbit },
  gentle: { v0: 10, a: 0.5, T: 10, icon: Turtle },
};
const IDLE = { t: 0, running: false, done: false };

function FormulasSim({ T: TT }) {
  const L = TT.formulas;
  const dec = TT.decimal;
  const [v0, setV0] = useState(0);
  const [a, setA] = useState(2);
  const [dur, setDur] = useState(6);
  const [sim, setSim] = useState(IDLE);
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].v0 === v0 && PRESETS[k].a === a && PRESETS[k].T === dur) ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(dur, p.t + dt);
      const done = t >= dur - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    setV0(PRESETS[id].v0);
    setA(PRESETS[id].a);
    setDur(PRESETS[id].T);
    setSim(IDLE);
  };
  const change = (setter) => (n) => {
    setter(n);
    setSim(IDLE);
  };

  const t = sim.t;
  const v = v0 + a * t;
  const s = v0 * t + 0.5 * a * t * t;
  const s2 = (v * v - v0 * v0) / (2 * a);
  const s3 = ((v0 + v) / 2) * t;
  const sEnd = v0 * dur + 0.5 * a * dur * dur;
  const vEnd = v0 + a * dur;
  const F = (n, k = 1) => num(n, k, dec);
  const D = (n) => (Math.abs(n - Math.round(n)) < 1e-9 ? fmt(n, 0, dec) : F(n, Math.abs(n * 10 - Math.round(n * 10)) < 1e-9 ? 1 : 2));

  const segs = [];
  for (let n = 1; n <= Math.floor(t + 1e-9); n += 1) segs.push(v0 + a * (n - 0.5));

  let key = 'idle';
  if (sim.done) key = preset === 'lesson' ? 'lessonDone' : 'done';
  else if (t > 0) {
    if (t < 2.2) key = v0 === 0 ? 'odd' : 'running';
    else if (t < 4.4) key = 'why';
    else key = v0 === 0 ? 'odd' : 'running';
  }
  const settled = useSettled(key, key === 'odd' || key === 'running' || key === 'why' ? 250 : 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    odd: ex.odd,
    running: ex.running(D(a)),
    why: ex.why,
    lessonDone: ex.lessonDone,
    done: ex.done(D(dur), F(sEnd), F(vEnd)),
  }[settled];
  const tone = { idle: '#22d3ee', odd: '#a78bfa', running: '#a78bfa', why: '#60a5fa', lessonDone: '#34d399', done: '#34d399' }[settled];

  const vTop = niceMax(vEnd);
  const xMax = niceMax(dur);

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
        <PlayControls labels={TT.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <FormulasScene T={TT} v0={v0} a={a} dur={dur} t={t} running={sim.running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 1, dec)} unit={TT.s} accent={PALETTE.time} textColor="#a5f3fc" sub={L.tSub(D(dur))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(t / dur) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={L.readouts.v} symbol="v" value={F(v)} unit={TT.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={L.vSub(F(v0), F(a), fmt(t, 1, dec))} />
        <Readout label={L.readouts.s} symbol="s" value={F(s)} unit={TT.m} accent={PALETTE.disp} textColor={PALETTE.dispText} sub={L.sSub} />
        <Readout label={L.readouts.per} accent={PALETTE.path}>
          <PerSecond L={L} segs={segs} v0={v0} a={a} D={D} />
        </Readout>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-200">{L.formulasTitle}</p>
          {t > 0 && <p className="text-xs font-semibold text-emerald-300">✓ {L.agree}</p>}
        </div>
        <div className="mt-2.5 grid gap-2 md:grid-cols-3">
          <FormulaTile
            tag={L.f1}
            color={PALETTE.dispText}
            general="s = v₀·t + a·t² / 2"
            filled={`= ${F(v0)} · ${fmt(t, 1, dec)} + ${F(a)} · ${fmt(t, 1, dec)}² / 2`}
            result={`s = ${F(s)} ${TT.m}`}
            ok={t > 0}
          />
          <FormulaTile
            tag={L.f2}
            color="#fdba74"
            general="s = (v² − v₀²) / (2a)"
            filled={`= (${F(v)}² − ${F(v0)}²) / (2 · ${F(a)})`}
            result={`s = ${F(s2)} ${TT.m}`}
            ok={t > 0}
          />
          <FormulaTile
            tag={L.f3}
            color={PALETTE.velText}
            general="s = ((v₀ + v) / 2) · t"
            filled={`= ((${F(v0)} + ${F(v)}) / 2) · ${fmt(t, 1, dec)}`}
            result={`s = ${F(s3)} ${TT.m}`}
            ok={t > 0}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField id="ad-v0" label={L.v0} symbol={<Rich>v₀</Rich>} min={0} max={10} step={1} value={v0} onChange={change(setV0)} accent={PALETTE.vel} display={`${F(v0)} ${TT.ms}`} hint={L.kmh(fmt(v0 * 3.6, 0, dec))} />
          <RangeField id="ad-a" label={L.a} symbol="a" min={0.5} max={4} step={0.5} value={a} onChange={change(setA)} accent={PALETTE.acc} display={`${F(a)} ${TT.ms2}`} hint={L.aHint} />
          <RangeField id="ad-t" label={L.T} symbol="t" min={2} max={10} step={1} value={dur} onChange={change(setDur)} accent={PALETTE.time} display={`${D(dur)} ${TT.s}`} hint={L.THint(F(sEnd), F(vEnd))} />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={[
              { id: 'plan', label: L.graph.plan, color: '#475569', points: [{ x: 0, y: v0 }, { x: dur, y: vEnd }], dash: '4 5', dot: false },
              { id: 'live', label: L.graph.live, color: '#6ee7b7', points: [{ x: 0, y: v0 }, { x: t, y: v }] },
            ]}
            fill={{ id: 'live', color: '#60a5fa', opacity: 0.28 }}
            xMax={xMax}
            yMax={vTop}
            xLabel={L.graph.t}
            yLabel={L.graph.v}
            marker={t}
            note={L.graph.note}
            decimal={dec}
            xDigits={tickDigits(xMax)}
            yDigits={tickDigits(vTop)}
            height={220}
          />
        </div>
      </div>
    </div>
  );
}

/** The distance covered in each whole second so far, and the pattern it follows. */
function PerSecond({ L, segs, v0, a, D }) {
  if (!segs.length) return <p className="mt-2 text-xs text-gray-500">{L.perEmpty}</p>;
  const first = segs[0];
  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap gap-1">
        {segs.map((d, i) => (
          <span key={i} className="rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[13px] font-semibold tabular-nums text-violet-200">
            {D(d)}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-xs leading-snug tabular-nums text-gray-400">
        {v0 === 0 ? L.perOdd(segs.map((d) => D(d / first)).join(' : ')) : L.perDiff(D(a))}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function FormulasScene({ T, v0, a, dur, t, running }) {
  const L = T.formulas;
  const dec = T.decimal;
  const sEnd = v0 * dur + 0.5 * a * dur * dur;
  const vEnd = v0 + a * dur;
  const x = v0 * t + 0.5 * a * t * t;
  const v = v0 + a * t;
  const marks = [];
  for (let n = 0; n <= Math.floor(t + 1e-9); n += 1) marks.push({ n, x: v0 * n + 0.5 * a * n * n, v: v0 + a * n });

  return (
    <LabScene
      legend={[
        { color: PALETTE.disp, label: L.legend.s, kind: 'arrow' },
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: PALETTE.vel, label: L.legend.marks, kind: 'ring' },
        { color: PALETTE.path, label: L.legend.seg, kind: 'line' },
      ]}
      chips={
        <Chip>
          {L.chipReal} · t = {fmt(t, 1, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? 262 : 300)}
      ariaLabel={L.sceneLabel(fmt(t, 1, dec), num(x, 1, dec), num(v, 1, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const carLen = narrow ? 58 : 88;
        const vMaxPx = narrow ? 60 : 120;
        const padL = carLen + (narrow ? 12 : 26);
        const padR = Math.max(vMaxPx - carLen / 2 + (narrow ? 14 : 30), 28);
        const view = lineView(0, Math.max(sEnd, 6), W, padL, padR);
        const step = rulerStep(view, narrow ? 44 : 62);
        const roadY = H - (narrow ? 90 : 96);
        const carY = roadY + 4;
        const vk = vMaxPx / Math.max(vEnd, 1);
        const front = view.sx(x);
        const cx = front - carLen / 2;
        const carTop = carY - carLen * 0.48;
        const ys = carTop - 14;
        const yv = ys - 26;
        const box = { w: W, h: H };
        const ox = view.sx(0);
        const bracketY = roadY + 52;
        const vText = L.vTag(num(v, 1, dec));
        const vW = textWidth(vText, fs, 600) + 16;
        return (
          <>
            <SideRoad view={view} W={W} H={H} roadY={roadY} step={step} unit={L.axisX} decimal={dec} fs={fs - 1} />
            <line x1={ox} x2={ox} y1={roadY - 10} y2={roadY + 10} stroke={PALETTE.ink} strokeWidth={2} strokeDasharray="3 3" />
            {/* distance covered in each whole second, under the ruler */}
            {marks.slice(1).map((m, i) => {
              const xa = view.sx(marks[i].x);
              const xb = view.sx(m.x);
              const d = m.x - marks[i].x;
              const lbl = L.segTag(fmt(d, Number.isInteger(Math.round(d * 100) / 100) ? 0 : 1, dec));
              const fits = xb - xa >= textWidth(lbl, fs - 1, 700) + 6;
              return (
                <g key={`seg${m.n}`}>
                  <line x1={xa + 1} x2={xb - 1} y1={bracketY} y2={bracketY} stroke={PALETTE.path} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
                  <line x1={xa} x2={xa} y1={bracketY - 5} y2={bracketY + 5} stroke={PALETTE.path} strokeWidth={1.4} />
                  <line x1={xb} x2={xb} y1={bracketY - 5} y2={bracketY + 5} stroke={PALETTE.path} strokeWidth={1.4} />
                  {fits && (
                    <text x={(xa + xb) / 2} y={bracketY + 17} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#6d28d9" className="tabular-nums">
                      {lbl}
                    </text>
                  )}
                </g>
              );
            })}
            <StrobeMarks marks={marks.map((m) => ({ n: m.n, px: view.sx(m.x), v: m.v }))} roadY={roadY} rowY={roadY - 20} vk={vk} label={L.secTag} fs={fs - 2} arrows={false} />
            <SideCar front={front} y={carY} len={carLen} color="#2563eb" dist={x} />
            {x > 0.05 && <Arrow x1={ox} y1={ys} x2={front} y2={ys} color={PALETTE.disp} width={narrow ? 3 : 3.5} head={narrow ? 10 : 12} />}
            <circle cx={ox} cy={ys} r={3} fill={PALETTE.disp} />
            {x > 0.05 && <Pill x={(ox + front) / 2} y={ys} text={L.sTag(num(x, 1, dec))} bg={PALETTE.disp} size={fs} box={box} />}
            {v > 0.05 && <Arrow x1={cx} y1={yv} x2={cx + v * vk} y2={yv} color={PALETTE.vel} width={narrow ? 2.5 : 3} head={narrow ? 9 : 11} />}
            {v > 0.05 && <Pill x={cx - vW / 2 - 8} y={yv} text={vText} bg={PALETTE.vel} size={fs - 1} box={box} />}
            {running && <circle cx={cx} cy={carY - carLen * 0.25} r={carLen * 0.36} fill="#2563eb" className="cl-pulse" opacity="0.25" />}
          </>
        );
      }}
    </LabScene>
  );
}
