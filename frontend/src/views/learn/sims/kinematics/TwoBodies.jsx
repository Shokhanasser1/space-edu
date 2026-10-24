import { useState } from 'react';
import { ArrowLeftRight, Ban, Bike, Footprints, Lightbulb, MoveRight, Truck, Users } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { Arrow, Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { useSimText } from '../kit/lang';
import { Chip, GroupLabel, LabScene, PlayControls, Rich, SideCyclist, SideRoad, lineView, niceMax, num, rulerStep, tickDigits, trim } from './Acceleration.parts';
import XTGraph from './TwoBodies.graph';
import OvertakeSim from './TwoBodies.overtake';

/**
 * Lesson "Ikki jismning harakati":
 *  1. meeting — two bodies on one line, towards each other or the same way;
 *     method 1: x₁ = x₀₁ + v₁t, x₂ = x₀₂ + v₂t, x₁ = x₂ (the crossing of the
 *     x–t lines); method 2: closing speed v₁ + v₂ or v₁ − v₂;
 *  2. overtaking — a car passing a lorry seen from the road and from the
 *     lorry: relative velocity v₁ − v₂.
 * The lesson's examples (cyclists 300 m apart at 5 and 7 m/s meet after 25 s;
 * a car at 25 m/s passing a lorry at 15 m/s moves at 10 m/s relative to it)
 * are the presets.
 */

const TEXT = {
  uz: {
    card: {
      eyebrow: 'Virtual laboratoriya · Kinematika',
      title: 'Ikki jismning harakati',
      tabsLabel: 'Tajribani tanlang',
      tabs: {
        meet: { label: 'Uchrashuv', sub: 'x₁ = x₂' },
        overtake: { label: "Quvib o'tish", sub: 'v₁ − v₂' },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: "1-yo'l: bitta sanoq sistemasi", text: 'har bir jism uchun x = x₀ + v·t yoziladi; uchrashuvda x₁ = x₂.' },
        { term: "2-yo'l: nisbiy tezlik", text: 'bir-biriga qarab: v₁ + v₂; bir tomonga: v₁ − v₂.' },
        { term: 'Grafikda', text: "x(t) chiziqlarining kesishish nuqtasi — uchrashuv vaqti va joyi." },
        { term: "Quvib o'tish", text: "quvayotgan jism quvilayotganga nisbatan v₁ − v₂ tezlikda yuradi — shuning uchun quvib o'tish uzoq davom etadi." },
      ],
    },
    meet: {
      presetsLabel: 'Tayyor holatlar',
      presets: {
        cyclists: { name: 'Ikki velosipedchi', sub: '300 m · 5 va 7 m/s · bir-biriga qarab' },
        chase: { name: 'Velosipedchi piyodani quvadi', sub: '100 m · 5.5 va 1.5 m/s' },
        never: { name: 'Quvib yeta olmaydi', sub: '100 m · 4 va 5 m/s' },
      },
      modeLabel: "Harakat yo'nalishi",
      modes: {
        towards: { name: 'Bir-biriga qarab', sub: 'yaqinlashish: v₁ + v₂' },
        same: { name: 'Bir tomonga', sub: 'orani yopish: v₁ − v₂' },
      },
      d: "Boshlang'ich masofa",
      v1: '1-jism tezligi',
      v2: '2-jism tezligi',
      legend: { b1: '1-jism', b2: '2-jism', v: 'tezlik', gap: 'oraliq' },
      chip: (k) => `Vaqt ×${k} tezlashtirilgan`,
      axisX: 'x, m',
      sceneLabel: (t, x1, x2) => `Bitta to'g'ri yo'l. t = ${t} s, 1-jism x₁ = ${x1} m da, 2-jism x₂ = ${x2} m da.`,
      x1Tag: (x) => `x₁ = ${x} m`,
      x2Tag: (x) => `x₂ = ${x} m`,
      v1Tag: (v) => `v₁ = ${v} m/s`,
      v2Tag: (v) => `v₂ = ${v} m/s`,
      gapTag: (d) => `oraliq ${d} m`,
      meetTag: (t, x) => `uchrashuv: t = ${t} s, x = ${x} m`,
      readouts: { t: 'Vaqt', x1: '1-jism koordinatasi', x2: '2-jism koordinatasi', gap: 'Oraliq' },
      gapSub: { shrink: (v) => `har sekundda ${v} m ga qisqaradi`, grow: (v) => `har sekundda ${v} m ga ortadi`, same: "o'zgarmaydi" },
      m1: { title: "1-yo'l: bitta sanoq sistemasi", eq: 'x₁ = x₂' },
      m2: { title: "2-yo'l: nisbiy tezlik", towards: 'v = v₁ + v₂', same: 'v = v₁ − v₂' },
      never: "Uchrashmaydi: oraliq qisqarmaydi.",
      graph: {
        title: 'Grafik: x(t) — ikki jism',
        b1: 'x₁(t)',
        b2: 'x₂(t)',
        t: 't, s',
        x: 'x, m',
        meet: (t, x) => `t = ${t} s, x = ${x} m`,
        note: "Chiziqlar kesishgan nuqta — uchrashuv: undan t va x ni o'qing.",
        noteNever: 'Chiziqlar kesishmaydi — jismlar uchrashmaydi.',
      },
      explain: {
        idle: "«Boshlash»ni bosing. Ikkala jism bir paytda yo'lga chiqadi. Qachon va qayerda uchrashadi?",
        towards: (v) => `Jismlar bir-biriga qarab kelyapti: oraliq har sekundda ${v} m ga qisqarmoqda (v₁ + v₂).`,
        same: (v) => `Ikkalasi bir tomonga ketyapti: oraliq har sekundda atigi ${v} m ga qisqarmoqda (v₁ − v₂).`,
        never: (v) => `1-jism oldindagidan tez emas — oraliq qisqarmaydi (v₁ − v₂ = ${v} m/s). Ular hech qachon uchrashmaydi.`,
        met: (t, x) => `Uchrashuv! t = ${t} s, x = ${x} m. Ikkala yo'l ham bir xil javob beradi.`,
        lessonMet: 'Uchrashuv! Yaqinlashish tezligi 5 + 7 = 12 m/s, demak 300 / 12 = 25 s dan keyin — darslikdagi javob. Joyi: x = 5 · 25 = 125 m.',
        neverDone: "Vaqt tugadi, oraliq esa qisqarmadi: x(t) chiziqlari kesishmaydi.",
      },
    },
    overtake: {
      frameLabel: 'Sanoq jismi',
      frames: {
        road: { name: "Yo'l (Yer)", sub: "kamera yo'l chetida turadi" },
        lorry: { name: 'Yuk mashinasi', sub: 'kamera yuk mashinasida' },
      },
      presetsLabel: 'Tezliklar',
      presets: {
        lesson: { name: 'Darslikdagi misol', sub: '25 va 15 m/s' },
        slow: { name: 'Sekin quvish', sub: '20 va 18 m/s' },
      },
      vCar: 'Avtomobil tezligi',
      vLorry: 'Yuk mashinasi tezligi',
      kmh: (k) => `yo'lga nisbatan · ≈ ${k} km/soat`,
      legend: { car: 'avtomobil', lorry: 'yuk mashinasi', v: 'tezlik (tanlangan sistemada)', marks: "avtomobilning har 1 s dagi o'rni" },
      chip: (name) => `Sanoq jismi: ${name}`,
      chipSub: "Kamera va o'q shu jismga bog'langan",
      vTag: (v) => `${v} m/s`,
      roadTag: (v) => `yo'l ${v} m/s`,
      axisX: 'x, m',
      axisXp: 'x′, m',
      sceneLabel: (frame, t) => `Ikki yo'lakli yo'l yuqoridan, sanoq jismi: ${frame}. t = ${t} s.`,
      readouts: { t: 'Vaqt', car: 'Avtomobil tezligi', lorry: 'Yuk mashinasi tezligi', tOv: "Quvib o'tish vaqti" },
      inFrame: (name) => `${name} sistemasida`,
      tOvSub: (L, v) => `t = ${L} / ${v}`,
      formula: {
        tag: 'Nisbiy tezlik',
        general: 'v = v₁ − v₂',
        filled: (v1, v2, v) => `= ${v1} − ${v2} = ${v} m/s`,
        time: (L, v, t) => `t = ${L} / ${v} = ${t} s`,
      },
      lenNote: (L) => `Yuk mashinasiga nisbatan avtomobil ${L} m siljishi kerak: 15 m orqadan + 16 m yuk mashinasi + 4 m o'zi + 15 m oldinda.`,
      roadDist: (s1, s2) => `Shu vaqtda yo'l bo'yicha avtomobil ${s1} m, yuk mashinasi ${s2} m yuradi.`,
      graph: {
        title: 'Grafik: x(t) tanlangan sistemada',
        car: 'avtomobil',
        lorry: 'yuk mashinasi',
        t: 't, s',
        x: 'x, m',
        note: "Chiziq qiyaligi — tanlangan sistemadagi tezlik. Yuk mashinasi sistemasida u joyida turadi: chizig'i gorizontal.",
      },
      explain: {
        idle: "Avtomobil yuk mashinasini quvib o'tmoqchi. Sanoq jismini tanlang va «Boshlash»ni bosing.",
        road: (v1, v2) => `Yo'ldan qaraganda avtomobil ${v1} m/s, yuk mashinasi ${v2} m/s tezlikda ketyapti — ikkalasi ham tez.`,
        lorry: (v, u) => `Yuk mashinasidan qaraganda u turibdi, avtomobil esa atigi ${v} m/s tezlikda o'tib bormoqda. Yo'l esa ${u} m/s tezlikda orqaga «oqmoqda».`,
        done: (t, L, s1) => `Quvib o'tish ${t} s davom etdi. Yuk mashinasiga nisbatan avtomobil ${L} m siljidi, yo'l bo'yicha esa ${s1} m yurdi — qarama-qarshi yo'lakda shuncha joy bo'sh bo'lishi kerak!`,
        impossible: "Avtomobil yuk mashinasidan tez emas — quvib o'tib bo'lmaydi (v₁ − v₂ ≤ 0).",
      },
    },
  },
  ru: {
    card: {
      eyebrow: 'Виртуальная лаборатория · Кинематика',
      title: 'Движение двух тел',
      tabsLabel: 'Выберите опыт',
      tabs: {
        meet: { label: 'Встреча', sub: 'x₁ = x₂' },
        overtake: { label: 'Обгон', sub: 'v₁ − v₂' },
      },
    },
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Способ 1: одна система отсчёта', text: 'для каждого тела пишем x = x₀ + v·t; в момент встречи x₁ = x₂.' },
        { term: 'Способ 2: относительная скорость', text: 'навстречу: v₁ + v₂; в одну сторону: v₁ − v₂.' },
        { term: 'На графике', text: 'точка пересечения линий x(t) — время и место встречи.' },
        { term: 'Обгон', text: 'догоняющее тело движется относительно догоняемого со скоростью v₁ − v₂ — поэтому обгон длится долго.' },
      ],
    },
    meet: {
      presetsLabel: 'Готовые случаи',
      presets: {
        cyclists: { name: 'Два велосипедиста', sub: '300 м · 5 и 7 м/с · навстречу' },
        chase: { name: 'Велосипедист догоняет пешехода', sub: '100 м · 5,5 и 1,5 м/с' },
        never: { name: 'Не догонит', sub: '100 м · 4 и 5 м/с' },
      },
      modeLabel: 'Направление движения',
      modes: {
        towards: { name: 'Навстречу друг другу', sub: 'сближение: v₁ + v₂' },
        same: { name: 'В одну сторону', sub: 'сокращение: v₁ − v₂' },
      },
      d: 'Начальное расстояние',
      v1: 'Скорость 1-го тела',
      v2: 'Скорость 2-го тела',
      legend: { b1: '1-е тело', b2: '2-е тело', v: 'скорость', gap: 'расстояние между ними' },
      chip: (k) => `Время ускорено ×${k}`,
      axisX: 'x, м',
      sceneLabel: (t, x1, x2) => `Одна прямая дорога. t = ${t} с, 1-е тело в точке x₁ = ${x1} м, 2-е — в точке x₂ = ${x2} м.`,
      x1Tag: (x) => `x₁ = ${x} м`,
      x2Tag: (x) => `x₂ = ${x} м`,
      v1Tag: (v) => `v₁ = ${v} м/с`,
      v2Tag: (v) => `v₂ = ${v} м/с`,
      gapTag: (d) => `расстояние ${d} м`,
      meetTag: (t, x) => `встреча: t = ${t} с, x = ${x} м`,
      readouts: { t: 'Время', x1: 'Координата 1-го тела', x2: 'Координата 2-го тела', gap: 'Расстояние' },
      gapSub: { shrink: (v) => `сокращается на ${v} м каждую секунду`, grow: (v) => `растёт на ${v} м каждую секунду`, same: 'не меняется' },
      m1: { title: 'Способ 1: одна система отсчёта', eq: 'x₁ = x₂' },
      m2: { title: 'Способ 2: относительная скорость', towards: 'v = v₁ + v₂', same: 'v = v₁ − v₂' },
      never: 'Не встретятся: расстояние не сокращается.',
      graph: {
        title: 'График: x(t) — два тела',
        b1: 'x₁(t)',
        b2: 'x₂(t)',
        t: 't, с',
        x: 'x, м',
        meet: (t, x) => `t = ${t} с, x = ${x} м`,
        note: 'Точка пересечения линий — встреча: по ней читаем t и x.',
        noteNever: 'Линии не пересекаются — тела не встретятся.',
      },
      explain: {
        idle: 'Нажмите «Старт». Оба тела отправляются одновременно. Когда и где они встретятся?',
        towards: (v) => `Тела движутся навстречу: расстояние сокращается на ${v} м каждую секунду (v₁ + v₂).`,
        same: (v) => `Оба движутся в одну сторону: расстояние сокращается всего на ${v} м в секунду (v₁ − v₂).`,
        never: (v) => `1-е тело не быстрее переднего — расстояние не сокращается (v₁ − v₂ = ${v} м/с). Они никогда не встретятся.`,
        met: (t, x) => `Встреча! t = ${t} с, x = ${x} м. Оба способа дают один и тот же ответ.`,
        lessonMet: 'Встреча! Скорость сближения 5 + 7 = 12 м/с, значит через 300 / 12 = 25 с — как в уроке. Место: x = 5 · 25 = 125 м.',
        neverDone: 'Время вышло, а расстояние не сократилось: линии x(t) не пересекаются.',
      },
    },
    overtake: {
      frameLabel: 'Тело отсчёта',
      frames: {
        road: { name: 'Дорога (Земля)', sub: 'камера стоит у дороги' },
        lorry: { name: 'Грузовик', sub: 'камера на грузовике' },
      },
      presetsLabel: 'Скорости',
      presets: {
        lesson: { name: 'Пример из урока', sub: '25 и 15 м/с' },
        slow: { name: 'Медленный обгон', sub: '20 и 18 м/с' },
      },
      vCar: 'Скорость автомобиля',
      vLorry: 'Скорость грузовика',
      kmh: (k) => `относительно дороги · ≈ ${k} км/ч`,
      legend: { car: 'автомобиль', lorry: 'грузовик', v: 'скорость (в выбранной системе)', marks: 'положение автомобиля через каждую 1 с' },
      chip: (name) => `Тело отсчёта: ${name}`,
      chipSub: 'Камера и ось привязаны к этому телу',
      vTag: (v) => `${v} м/с`,
      roadTag: (v) => `дорога ${v} м/с`,
      axisX: 'x, м',
      axisXp: 'x′, м',
      sceneLabel: (frame, t) => `Двухполосная дорога сверху, тело отсчёта: ${frame}. t = ${t} с.`,
      readouts: { t: 'Время', car: 'Скорость автомобиля', lorry: 'Скорость грузовика', tOv: 'Время обгона' },
      inFrame: (name) => `в системе «${name}»`,
      tOvSub: (L, v) => `t = ${L} / ${v}`,
      formula: {
        tag: 'Относительная скорость',
        general: 'v = v₁ − v₂',
        filled: (v1, v2, v) => `= ${v1} − ${v2} = ${v} м/с`,
        time: (L, v, t) => `t = ${L} / ${v} = ${t} с`,
      },
      lenNote: (L) => `Относительно грузовика автомобиль должен сместиться на ${L} м: 15 м сзади + 16 м грузовик + 4 м сам + 15 м впереди.`,
      roadDist: (s1, s2) => `За это время по дороге автомобиль проезжает ${s1} м, грузовик — ${s2} м.`,
      graph: {
        title: 'График: x(t) в выбранной системе',
        car: 'автомобиль',
        lorry: 'грузовик',
        t: 't, с',
        x: 'x, м',
        note: 'Наклон линии — скорость в выбранной системе. В системе грузовика он стоит на месте: его линия горизонтальна.',
      },
      explain: {
        idle: 'Автомобиль хочет обогнать грузовик. Выберите тело отсчёта и нажмите «Старт».',
        road: (v1, v2) => `С дороги видно: автомобиль едет со скоростью ${v1} м/с, грузовик — ${v2} м/с; оба быстрые.`,
        lorry: (v, u) => `С грузовика кажется, что он стоит, а автомобиль проползает мимо всего на ${v} м/с. Дорога же «течёт» назад со скоростью ${u} м/с.`,
        done: (t, L, s1) => `Обгон длился ${t} с. Относительно грузовика автомобиль сместился на ${L} м, а по дороге проехал ${s1} м — столько места должно быть свободно на встречной полосе!`,
        impossible: 'Автомобиль не быстрее грузовика — обогнать невозможно (v₁ − v₂ ≤ 0).',
      },
    },
  },
  en: {
    card: {
      eyebrow: 'Virtual lab · Kinematics',
      title: 'Motion of two bodies',
      tabsLabel: 'Choose an experiment',
      tabs: {
        meet: { label: 'Meeting', sub: 'x₁ = x₂' },
        overtake: { label: 'Overtaking', sub: 'v₁ − v₂' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Run again', reset: 'Reset' },
    facts: {
      title: 'Remember',
      items: [
        { term: 'Way 1: one frame of reference', text: 'write x = x₀ + v·t for each body; at the meeting x₁ = x₂.' },
        { term: 'Way 2: relative velocity', text: 'towards each other: v₁ + v₂; the same way: v₁ − v₂.' },
        { term: 'On the graph', text: 'where the x(t) lines cross is the time and place of the meeting.' },
        { term: 'Overtaking', text: 'the chasing body moves at v₁ − v₂ relative to the one in front — which is why overtaking takes so long.' },
      ],
    },
    meet: {
      presetsLabel: 'Ready-made cases',
      presets: {
        cyclists: { name: 'Two cyclists', sub: '300 m · 5 and 7 m/s · towards each other' },
        chase: { name: 'A cyclist catches a walker', sub: '100 m · 5.5 and 1.5 m/s' },
        never: { name: 'Never catches up', sub: '100 m · 4 and 5 m/s' },
      },
      modeLabel: 'Direction of motion',
      modes: {
        towards: { name: 'Towards each other', sub: 'closing at v₁ + v₂' },
        same: { name: 'The same way', sub: 'closing at v₁ − v₂' },
      },
      d: 'Starting distance',
      v1: 'Speed of body 1',
      v2: 'Speed of body 2',
      legend: { b1: 'body 1', b2: 'body 2', v: 'velocity', gap: 'gap' },
      chip: (k) => `Time sped up ×${k}`,
      axisX: 'x, m',
      sceneLabel: (t, x1, x2) => `One straight road. t = ${t} s, body 1 at x₁ = ${x1} m, body 2 at x₂ = ${x2} m.`,
      x1Tag: (x) => `x₁ = ${x} m`,
      x2Tag: (x) => `x₂ = ${x} m`,
      v1Tag: (v) => `v₁ = ${v} m/s`,
      v2Tag: (v) => `v₂ = ${v} m/s`,
      gapTag: (d) => `gap ${d} m`,
      meetTag: (t, x) => `meeting: t = ${t} s, x = ${x} m`,
      readouts: { t: 'Time', x1: 'Coordinate of body 1', x2: 'Coordinate of body 2', gap: 'Gap' },
      gapSub: { shrink: (v) => `shrinks by ${v} m every second`, grow: (v) => `grows by ${v} m every second`, same: 'does not change' },
      m1: { title: 'Way 1: one frame of reference', eq: 'x₁ = x₂' },
      m2: { title: 'Way 2: relative velocity', towards: 'v = v₁ + v₂', same: 'v = v₁ − v₂' },
      never: 'They never meet: the gap does not shrink.',
      graph: {
        title: 'Graph: x(t) — two bodies',
        b1: 'x₁(t)',
        b2: 'x₂(t)',
        t: 't, s',
        x: 'x, m',
        meet: (t, x) => `t = ${t} s, x = ${x} m`,
        note: 'Where the lines cross is the meeting: read t and x off that point.',
        noteNever: 'The lines never cross — the bodies never meet.',
      },
      explain: {
        idle: 'Press Start. Both bodies set off at the same moment. When and where will they meet?',
        towards: (v) => `The bodies move towards each other: the gap shrinks by ${v} m every second (v₁ + v₂).`,
        same: (v) => `Both move the same way: the gap shrinks by only ${v} m every second (v₁ − v₂).`,
        never: (v) => `Body 1 is not faster than the one in front — the gap does not shrink (v₁ − v₂ = ${v} m/s). They never meet.`,
        met: (t, x) => `They meet! t = ${t} s, x = ${x} m. Both ways give the same answer.`,
        lessonMet: 'They meet! The closing speed is 5 + 7 = 12 m/s, so after 300 / 12 = 25 s — the lesson’s answer. Place: x = 5 · 25 = 125 m.',
        neverDone: 'Time is up and the gap has not shrunk: the x(t) lines do not cross.',
      },
    },
    overtake: {
      frameLabel: 'Reference body',
      frames: {
        road: { name: 'Road (Earth)', sub: 'camera stands by the road' },
        lorry: { name: 'Lorry', sub: 'camera rides on the lorry' },
      },
      presetsLabel: 'Speeds',
      presets: {
        lesson: { name: 'Lesson example', sub: '25 and 15 m/s' },
        slow: { name: 'Slow overtaking', sub: '20 and 18 m/s' },
      },
      vCar: 'Car speed',
      vLorry: 'Lorry speed',
      kmh: (k) => `relative to the road · ≈ ${k} km/h`,
      legend: { car: 'car', lorry: 'lorry', v: 'velocity (in the chosen frame)', marks: 'car position every 1 s' },
      chip: (name) => `Reference body: ${name}`,
      chipSub: 'The camera and the axis are attached to it',
      vTag: (v) => `${v} m/s`,
      roadTag: (v) => `road ${v} m/s`,
      axisX: 'x, m',
      axisXp: 'x′, m',
      sceneLabel: (frame, t) => `A two-lane road from above, reference body: ${frame}. t = ${t} s.`,
      readouts: { t: 'Time', car: 'Car velocity', lorry: 'Lorry velocity', tOv: 'Overtaking time' },
      inFrame: (name) => `in the "${name}" frame`,
      tOvSub: (L, v) => `t = ${L} / ${v}`,
      formula: {
        tag: 'Relative velocity',
        general: 'v = v₁ − v₂',
        filled: (v1, v2, v) => `= ${v1} − ${v2} = ${v} m/s`,
        time: (L, v, t) => `t = ${L} / ${v} = ${t} s`,
      },
      lenNote: (L) => `Relative to the lorry the car has to move ${L} m: 15 m behind + 16 m of lorry + its own 4 m + 15 m in front.`,
      roadDist: (s1, s2) => `Meanwhile, along the road the car covers ${s1} m and the lorry ${s2} m.`,
      graph: {
        title: 'Graph: x(t) in the chosen frame',
        car: 'car',
        lorry: 'lorry',
        t: 't, s',
        x: 'x, m',
        note: 'The slope of a line is the velocity in the chosen frame. In the lorry’s frame it stands still: its line is horizontal.',
      },
      explain: {
        idle: 'The car wants to overtake the lorry. Choose the reference body and press Start.',
        road: (v1, v2) => `Seen from the road the car moves at ${v1} m/s and the lorry at ${v2} m/s — both are fast.`,
        lorry: (v, u) => `Seen from the lorry, it stands still and the car creeps past at only ${v} m/s. The road “flows” backwards at ${u} m/s.`,
        done: (t, L, s1) => `Overtaking took ${t} s. Relative to the lorry the car moved ${L} m, but along the road it covered ${s1} m — that much of the oncoming lane has to be clear!`,
        impossible: 'The car is not faster than the lorry — it cannot overtake (v₁ − v₂ ≤ 0).',
      },
    },
  },
};

/* ================================================================= card */

export default function TwoBodies() {
  const T = useSimText(TEXT);
  const tabs = [
    { id: 'meet', ...T.card.tabs.meet, icon: Users, render: () => <MeetSim T={T} /> },
    { id: 'overtake', ...T.card.tabs.overtake, icon: Truck, render: () => <OvertakeSim T={T} /> },
  ];
  return <SimCard eyebrow={T.card.eyebrow} title={T.card.title} tabsLabel={T.card.tabsLabel} tabs={tabs} facts={T.facts} icon={ArrowLeftRight} idPrefix="twob" />;
}

/* ============================================================== meeting */

const PRESETS = {
  cyclists: { mode: 'towards', d: 300, v1: 5, v2: 7, kind2: 'bike', icon: Bike },
  chase: { mode: 'same', d: 100, v1: 5.5, v2: 1.5, kind2: 'walker', icon: Footprints },
  never: { mode: 'same', d: 100, v1: 4, v2: 5, kind2: 'bike', icon: Ban },
};
const T_NEVER = 40; // s, how long a run lasts when the bodies never meet
const IDLE = { t: 0, running: false, done: false };

function MeetSim({ T }) {
  const L = T.meet;
  const dec = T.decimal;
  const [mode, setMode] = useState('towards');
  const [d, setD] = useState(300);
  const [v1, setV1] = useState(5);
  const [v2, setV2] = useState(7);
  const [kind2, setKind2] = useState('bike');
  const [sim, setSim] = useState(IDLE);
  const v2x = mode === 'towards' ? -v2 : v2;
  const vrel = v1 - v2x;
  const meets = vrel > 1e-9;
  const tMeet = meets ? d / vrel : Infinity;
  const xMeet = meets ? v1 * tMeet : NaN;
  const tEnd = meets ? tMeet : T_NEVER;
  const speedUp = Math.max(1, Math.round(tEnd / 8));
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].mode === mode && PRESETS[k].d === d && PRESETS[k].v1 === v1 && PRESETS[k].v2 === v2) ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tEnd, p.t + dt * speedUp);
      const done = t >= tEnd - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    const p = PRESETS[id];
    setMode(p.mode);
    setD(p.d);
    setV1(p.v1);
    setV2(p.v2);
    setKind2(p.kind2);
    setSim(IDLE);
  };
  const change = (setter) => (n) => {
    setter(n);
    setSim(IDLE);
  };

  const t = sim.t;
  const x1 = v1 * t;
  const x2 = d + v2x * t;
  const gap = Math.abs(x2 - x1);
  const D = (n) => trim(n, dec);
  const sign = v2x < 0 ? '−' : '+';

  let key = 'idle';
  if (sim.done) key = meets ? (preset === 'cyclists' ? 'lessonMet' : 'met') : 'neverDone';
  else if (t > 0) key = !meets ? 'never' : mode;
  const settled = useSettled(key, key === 'towards' || key === 'same' ? 250 : 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    towards: ex.towards(D(vrel)),
    same: ex.same(D(vrel)),
    never: ex.never(D(vrel)),
    met: ex.met(D(tMeet), D(xMeet)),
    lessonMet: ex.lessonMet,
    neverDone: ex.neverDone,
  }[settled];
  const tone = { idle: '#22d3ee', towards: '#60a5fa', same: '#60a5fa', never: '#f87171', met: '#fbbf24', lessonMet: '#fbbf24', neverDone: '#f87171' }[settled];

  /* graph */
  const xs = [0, d, v1 * tEnd, d + v2x * tEnd];
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const yMax = niceMax(hi);
  const yMin = lo < 0 ? -niceMax(-lo) : 0;
  const xMax = niceMax(tEnd);
  const graphSeries = [
    { id: 'b1', label: L.graph.b1, color: '#60a5fa', plan: [{ x: 0, y: 0 }, { x: tEnd, y: v1 * tEnd }], live: [{ x: 0, y: 0 }, { x: t, y: x1 }] },
    { id: 'b2', label: L.graph.b2, color: '#f472b6', plan: [{ x: 0, y: d }, { x: tEnd, y: d + v2x * tEnd }], live: [{ x: 0, y: d }, { x: t, y: x2 }] },
  ];

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

      <MeetScene T={T} d={d} v1={v1} v2={v2} v2x={v2x} t={t} tEnd={tEnd} meets={meets} tMeet={tMeet} xMeet={xMeet} done={sim.done} running={sim.running} speedUp={speedUp} kind2={kind2} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 1, dec)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={L.chip(speedUp)} />
        <Readout label={L.readouts.x1} symbol={<Rich>x₁</Rich>} value={num(x1, 1, dec)} unit={T.m} accent="#2563eb" textColor={PALETTE.dispText} sub={<Rich>{`x₁ = 0 + ${D(v1)} · t`}</Rich>} />
        <Readout label={L.readouts.x2} symbol={<Rich>x₂</Rich>} value={num(x2, 1, dec)} unit={T.m} accent={PALETTE.second} textColor={PALETTE.secondText} sub={<Rich>{`x₂ = ${D(d)} ${sign} ${D(v2)} · t`}</Rich>} />
        <Readout
          label={L.readouts.gap}
          symbol="Δx"
          value={num(gap, 1, dec)}
          unit={T.m}
          accent="#fbbf24"
          textColor="#fde68a"
          sub={vrel > 1e-9 ? L.gapSub.shrink(D(vrel)) : vrel < -1e-9 ? L.gapSub.grow(D(-vrel)) : L.gapSub.same}
          active={sim.done && meets}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <MethodCard title={L.m1.title} color="#93c5fd" ok={sim.done && meets}>
          <Line>{`x₁ = 0 + ${D(v1)}·t`}</Line>
          <Line>{`x₂ = ${D(d)} ${sign} ${D(v2)}·t`}</Line>
          <Line muted>{`${L.m1.eq}:  ${D(v1)}·t = ${D(d)} ${sign} ${D(v2)}·t`}</Line>
          {meets ? (
            <>
              <Line strong>{`t = ${D(d)} / ${D(vrel)} = ${D(tMeet)} ${T.s}`}</Line>
              <Line strong>{`x = ${D(v1)} · ${D(tMeet)} = ${D(xMeet)} ${T.m}`}</Line>
            </>
          ) : (
            <p className="text-sm font-semibold text-red-300">{L.never}</p>
          )}
        </MethodCard>
        <MethodCard title={L.m2.title} color="#fde68a" ok={sim.done && meets}>
          <Line>{mode === 'towards' ? L.m2.towards : L.m2.same}</Line>
          <Line muted>{`= ${D(v1)} ${mode === 'towards' ? '+' : '−'} ${D(v2)} = ${D(vrel)} ${T.ms}`}</Line>
          {meets ? (
            <Line strong>{`t = d / v = ${D(d)} / ${D(vrel)} = ${D(tMeet)} ${T.s}`}</Line>
          ) : (
            <p className="text-sm font-semibold text-red-300">{L.never}</p>
          )}
        </MethodCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{L.modeLabel}</p>
            <Segmented
              label={L.modeLabel}
              className="grid-cols-1 sm:grid-cols-2"
              value={mode}
              onChange={change(setMode)}
              accent="#fbbf24"
              options={[
                { value: 'towards', label: L.modes.towards.name, sub: L.modes.towards.sub, icon: ArrowLeftRight },
                { value: 'same', label: L.modes.same.name, sub: L.modes.same.sub, icon: MoveRight },
              ]}
            />
          </div>
          <RangeField id="tb-d" label={L.d} symbol="d" min={50} max={400} step={10} value={d} onChange={change(setD)} accent="#fbbf24" display={`${D(d)} ${T.m}`} />
          <RangeField id="tb-v1" label={L.v1} symbol={<Rich>v₁</Rich>} min={0} max={10} step={0.5} value={v1} onChange={change(setV1)} accent="#3b82f6" display={`${num(v1, 1, dec)} ${T.ms}`} />
          <RangeField id="tb-v2" label={L.v2} symbol={<Rich>v₂</Rich>} min={0} max={10} step={0.5} value={v2} onChange={change(setV2)} accent="#ec4899" display={`${num(v2, 1, dec)} ${T.ms}`} />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <XTGraph
            title={L.graph.title}
            series={graphSeries}
            xMax={xMax}
            yMin={yMin}
            yMax={yMax}
            t={t}
            meet={meets ? { t: tMeet, x: xMeet } : null}
            reached={sim.done}
            meetLabel={meets ? L.graph.meet(D(tMeet), D(xMeet)) : null}
            xLabel={L.graph.t}
            yLabel={L.graph.x}
            note={meets ? L.graph.note : L.graph.noteNever}
            decimal={dec}
            xDigits={tickDigits(xMax)}
            yDigits={Math.max(tickDigits(yMax), tickDigits(-yMin))}
            height={240}
          />
        </div>
      </div>
    </div>
  );
}

function MethodCard({ title, color, ok, children }) {
  return (
    <div
      className={`rounded-2xl border p-3 sm:p-4 transition-colors ${ok ? 'bg-emerald-400/[0.06]' : 'bg-white/[0.035]'}`}
      style={{ borderColor: ok ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.1)' }}
    >
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
        {title}
      </p>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function Line({ children, muted, strong }) {
  return (
    <p className={`tabular-nums ${strong ? 'text-base font-bold text-white' : muted ? 'text-sm text-gray-400' : 'font-serif text-[15px] italic text-gray-200'}`}>
      <Rich>{children}</Rich>
    </p>
  );
}

/* ---------------------------------------------------------------- scene */

function Walker({ x, y, h = 40, color, dir = 1, dist = 0 }) {
  const swing = Math.sin((dist / 0.8) * Math.PI) * 0.5;
  const hipY = y - h * 0.47;
  const shoulderY = y - h * 0.78;
  const leg = h * 0.47;
  const arm = h * 0.34;
  const foot = (a) => [x + Math.sin(a) * leg * dir, hipY + Math.cos(a) * leg];
  const hand = (a) => [x + Math.sin(a) * arm * dir, shoulderY + Math.cos(a) * arm];
  const [f1x, f1y] = foot(swing);
  const [f2x, f2y] = foot(-swing);
  const [h1x, h1y] = hand(-swing * 0.9);
  const [h2x, h2y] = hand(swing * 0.9);
  return (
    <g stroke={color} strokeWidth={Math.max(2.2, h * 0.08)} strokeLinecap="round" fill="none">
      <ellipse cx={x} cy={y + 0.5} rx={h * 0.25} ry={2} fill="#0f172a" stroke="none" opacity="0.15" />
      <line x1={x} y1={hipY} x2={f2x} y2={f2y} strokeOpacity="0.55" />
      <line x1={x} y1={shoulderY} x2={h2x} y2={h2y} strokeOpacity="0.55" />
      <line x1={x} y1={hipY} x2={x} y2={shoulderY - h * 0.04} />
      <line x1={x} y1={hipY} x2={f1x} y2={f1y} />
      <line x1={x} y1={shoulderY} x2={h1x} y2={h1y} />
      <circle cx={x} cy={y - h * 0.9} r={h * 0.1} fill={color} stroke="none" />
    </g>
  );
}

function MeetScene({ T, d, v1, v2, v2x, t, tEnd, meets, tMeet, xMeet, done, running, speedUp, kind2 }) {
  const L = T.meet;
  const dec = T.decimal;
  const x1 = v1 * t;
  const x2 = d + v2x * t;
  const xs = [0, d, v1 * tEnd, d + v2x * tEnd];
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const D = (n) => trim(n, dec);

  return (
    <LabScene
      legend={[
        { color: '#2563eb', label: L.legend.b1, kind: 'dot' },
        { color: PALETTE.second, label: L.legend.b2, kind: 'dot' },
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: '#d97706', label: L.legend.gap, kind: 'line' },
      ]}
      chips={
        <Chip>
          {L.chip(speedUp)} · t = {fmt(t, 1, dec)} {T.s}
        </Chip>
      }
      height={(W, narrow) => (narrow ? 280 : 300)}
      ariaLabel={L.sceneLabel(fmt(t, 1, dec), num(x1, 1, dec), num(x2, 1, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const size = narrow ? 34 : 46;
        const pad = narrow ? 26 : 50;
        const view = lineView(lo, Math.max(hi, lo + 10), W, pad, pad);
        const step = rulerStep(view, narrow ? 44 : 64);
        const roadY = H - (narrow ? 96 : 100);
        const y1 = roadY - 1;
        const y2 = roadY + 8;
        const p1 = view.sx(x1);
        const p2 = view.sx(x2);
        const box = { w: W, h: H };
        const vk = narrow ? 6 : 10;
        const arrowY1 = y1 - size - 14;
        const arrowY2 = arrowY1 - 24;
        const gapY = arrowY2 - 26;
        const dir2 = v2x < 0 ? -1 : 1;
        const v1Text = L.v1Tag(num(v1, 1, dec));
        const v2Text = L.v2Tag(num(v2, 1, dec));
        const v1W = textWidth(v1Text, fs - 1, 600) + 16;
        const v2W = textWidth(v2Text, fs - 1, 600) + 16;
        const met = done && meets;
        const mx = met ? view.sx(xMeet) : 0;
        const coordY1 = roadY + 53;
        const coordY2 = coordY1 + 24;
        return (
          <>
            <SideRoad view={view} W={W} H={H} roadY={roadY} step={step} unit={L.axisX} decimal={dec} fs={fs - 1} trees={!narrow} />
            {/* gap between the bodies */}
            {Math.abs(p2 - p1) > 8 && !met && (
              <g>
                <line x1={p1} x2={p2} y1={gapY} y2={gapY} stroke="#d97706" strokeWidth={2} />
                <line x1={p1} x2={p1} y1={gapY - 6} y2={gapY + 6} stroke="#d97706" strokeWidth={2} />
                <line x1={p2} x2={p2} y1={gapY - 6} y2={gapY + 6} stroke="#d97706" strokeWidth={2} />
                <line x1={p1} x2={p1} y1={gapY + 6} y2={y1 - size} stroke="#d97706" strokeWidth={1} strokeDasharray="2 3" opacity="0.6" />
                <line x1={p2} x2={p2} y1={gapY + 6} y2={y2 - size} stroke="#d97706" strokeWidth={1} strokeDasharray="2 3" opacity="0.6" />
                <Pill x={(p1 + p2) / 2} y={gapY} text={L.gapTag(num(Math.abs(x2 - x1), 1, dec))} bg="#d97706" size={fs} box={box} />
              </g>
            )}
            {/* meeting point */}
            {met && (
              <g>
                <line x1={mx} x2={mx} y1={gapY} y2={roadY + 10} stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" />
                <circle cx={mx} cy={roadY + 3} r={narrow ? 16 : 22} fill="#fbbf24" opacity="0.25" className="cl-pulse" />
                <Pill x={mx} y={gapY} text={L.meetTag(D(tMeet), D(xMeet))} bg="#f59e0b" color="#0f172a" size={fs} box={box} />
              </g>
            )}
            {/* bodies */}
            <SideCyclist x={p1} y={y1} size={size} color="#2563eb" dir={1} dist={x1} />
            {kind2 === 'walker' ? (
              <Walker x={p2} y={y2} h={size * 0.95} color={PALETTE.second} dir={dir2} dist={Math.abs(x2 - d)} />
            ) : (
              <SideCyclist x={p2} y={y2} size={size} color={PALETTE.second} dir={dir2} dist={Math.abs(x2 - d)} />
            )}
            {running && (
              <>
                <circle cx={p1} cy={y1 - size * 0.45} r={size * 0.5} fill="#2563eb" className="cl-pulse" opacity="0.2" />
                <circle cx={p2} cy={y2 - size * 0.45} r={size * 0.5} fill={PALETTE.second} className="cl-pulse" opacity="0.2" />
              </>
            )}
            {/* velocity arrows */}
            {v1 > 0 && <Arrow x1={p1} y1={arrowY1} x2={p1 + v1 * vk} y2={arrowY1} color={PALETTE.vel} width={3} head={10} />}
            {v2 > 0 && <Arrow x1={p2} y1={arrowY2} x2={p2 + v2x * vk} y2={arrowY2} color={PALETTE.vel} width={3} head={10} />}
            <Pill x={p1 - v1W / 2 - 6} y={arrowY1} text={v1Text} bg="#2563eb" size={fs - 1} box={box} />
            <Pill x={dir2 < 0 ? p2 + v2W / 2 + 6 : p2 - v2W / 2 - 6} y={arrowY2} text={v2Text} bg={PALETTE.second} size={fs - 1} box={box} />
            {/* coordinates */}
            <line x1={p1} x2={p1} y1={roadY + 16} y2={coordY1 - 10} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="2 3" />
            <line x1={p2} x2={p2} y1={roadY + 16} y2={coordY2 - 10} stroke={PALETTE.second} strokeWidth={1.5} strokeDasharray="2 3" />
            <Pill x={p1} y={coordY1} text={L.x1Tag(num(x1, 1, dec))} bg="#2563eb" size={fs - 1} box={box} />
            <Pill x={p2} y={coordY2} text={L.x2Tag(num(x2, 1, dec))} bg={PALETTE.second} size={fs - 1} box={box} />
          </>
        );
      }}
    </LabScene>
  );
}
