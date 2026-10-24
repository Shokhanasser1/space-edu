import { useState } from 'react';
import { Dumbbell, FlaskConical, Lightbulb, MoveRight, Rocket, Scale, Sigma, Table2, Weight } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { Arrow, Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph } from '../kit/scene';
import { useSimText } from '../kit/lang';
import { COL, Cart, Chip, GroupLabel, LabScene, PlayControls, Rich, ScaleChip, Track, cartGeom, lineView, niceMax, tickDigits, trim } from './NewtonSecondLaw.parts';
import ExperimentSim from './NewtonSecondLaw.experiment';
import ResultantSim from './NewtonSecondLaw.resultant';

/**
 * Lesson "Nyutonning ikkinchi qonuni" (Dynamics, lesson 3):
 *  1. F = ma — a cart on a frictionless track pulled by a force F; the
 *     acceleration a = F/m points along F; doubling F doubles a, doubling m
 *     halves it; the v–t line keeps the previous run for comparison.
 *     Preset: F = 10 N, m = 2 kg → a = 5 m/s²; on the 10 m track the cart
 *     reaches the end at t = 2 s with v = 10 m/s.
 *  2. experiment — light gates 2 m apart time the cart from rest,
 *     a = 2s/t², and the table fills the a(F) and a(m) / a(1/m) graphs.
 *  3. resultant — two or three forces on a crate on ice; the acceleration
 *     follows the vector sum (40 N ⊥ 30 N on 10 kg → 50 N, a = 5 m/s²);
 *     balanced forces give a = 0.
 */

const TEXT = {
  uz: {
    N: 'N',
    kg: 'kg',
    invKg: '1/kg',
    card: {
      eyebrow: 'Virtual laboratoriya · Dinamika',
      title: 'Nyutonning ikkinchi qonuni',
      tabsLabel: 'Tajribani tanlang',
      tabs: {
        cart: { label: 'F = ma', sub: 'Kuch va tezlanish' },
        lab: { label: 'Tajriba', sub: 'a(F) va a(m) grafiklari' },
        res: { label: "Teng ta'sir etuvchi", sub: 'Bir nechta kuch' },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: 'Nyutonning ikkinchi qonuni', text: "jismning tezlanishi unga ta'sir etuvchi kuchga to'g'ri, massasiga teskari proporsional: a = F / m, ya'ni F = m·a." },
        { term: 'Tezlanish yo‘nalishi', text: "a har doim teng ta'sir etuvchi kuch F yo'nalishida bo'ladi (tezlik yo'nalishida bo'lishi shart emas)." },
        { term: '1 nyuton (1 N)', text: '1 kg massali jismga 1 m/s² tezlanish beradigan kuch: 1 N = 1 kg·m/s².' },
        { term: "Teng ta'sir etuvchi kuch", text: "jismga ta'sir etuvchi barcha kuchlarning vektor yig'indisi. Kuchlar muvozanatlashsa, F = 0 va a = 0." },
      ],
    },
    cart: {
      presetsLabel: 'Tayyor holatlar',
      presets: {
        lesson: { name: 'Asosiy misol', sub: 'F = 10 N · m = 2 kg' },
        twoF: { name: 'Kuch 2 marta katta', sub: 'F = 20 N · m = 2 kg' },
        twoM: { name: 'Massa 2 marta katta', sub: 'F = 10 N · m = 4 kg' },
        newton: { name: '1 nyuton', sub: 'F = 1 N · m = 1 kg' },
      },
      F: 'Tortish kuchi',
      m: 'Aravaning massasi',
      FHint: "Yo'l silliq — ishqalanish yo'q, F aravaga ta'sir etuvchi yagona gorizontal kuch",
      mHint: (n) => `Arava 1 kg + ustidagi yuklar ${n} kg`,
      mHintBare: 'Yuksiz arava — 1 kg',
      legend: { F: 'tortish kuchi F', a: 'tezlanish a', v: 'tezlik v', marks: "har 0.5 s dagi o'rni" },
      chipSlow: 'Vaqt 2 marta sekinlashtirilgan',
      scale: (n) => `= ${n} N`,
      axisX: 'x, m',
      sceneLabel: (F, m, a, t, v, x) => `Silliq yo'ldagi arava. F = ${F} N, m = ${m} kg, a = ${a} m/s². t = ${t} s, v = ${v} m/s, x = ${x} m.`,
      FTag: (F) => `F = ${F} N`,
      aTag: (a) => `a = ${a} m/s²`,
      vTag: (v) => `v = ${v} m/s`,
      massTag: (m) => `${m} kg`,
      secTag: (n) => `${n} s`,
      readouts: { t: 'Vaqt', v: 'Tezlik', a: 'Tezlanish', formula: 'Formula sonlar bilan' },
      tSub: (x) => `bosib o'tilgan yo'l x = ${x} m`,
      vSub: (a, t) => `v = a·t = ${a} · ${t}`,
      aSub: "kuch yo'nalishida",
      aSubZero: "kuch yo'q — tezlanish yo'q",
      unitLine: '1 N = 1 kg · 1 m/s²',
      graph: {
        title: 'Grafik: v(t)',
        now: (a) => `hozir: a = ${a} m/s²`,
        prev: (a) => `oldingi: a = ${a} m/s²`,
        t: 't, s',
        v: 'v, m/s',
        label: "Aravaning tezligi va vaqt grafigi",
        note: "To'g'ri chiziqning qiyaligi — tezlanish (a = Δv / Δt). Kuch katta yoki massa kichik bo'lsa, chiziq tikroq.",
      },
      explain: {
        idle: "Silliq yo'ldagi aravani F kuch tortyapti (ishqalanish yo'q). «Boshlash»ni bosing: arava a = F / m tezlanish bilan, kuch yo'nalishida tezlanadi.",
        zero: "F = 0 — aravaga kuch ta'sir etmayapti, demak a = 0. Tinch turgan arava tinch turaveradi (Nyutonning birinchi qonuni).",
        run: (F, m, a) => `a = F / m = ${F} / ${m} = ${a} m/s²: har sekundda tezlik ${a} m/s ga oshadi. Tezlanish (to'q sariq) kuch (qizil) tomonga yo'nalgan.`,
        Fup: (k, a) => `Massa o'zgarmadi, kuch ${k} marta oshdi — tezlanish ham ${k} marta oshdi: a = ${a} m/s².`,
        Fdown: (k, a) => `Massa o'zgarmadi, kuch ${k} marta kamaydi — tezlanish ham ${k} marta kamaydi: a = ${a} m/s².`,
        mUp: (k, a) => `Kuch o'zgarmadi, massa ${k} marta oshdi — tezlanish ${k} marta kamaydi: a = ${a} m/s². Massasi katta jismning tezligini o'zgartirish qiyinroq.`,
        mDown: (k, a) => `Kuch o'zgarmadi, massa ${k} marta kamaydi — tezlanish ${k} marta oshdi: a = ${a} m/s².`,
        newton: '1 N — 1 kg massali jismga 1 m/s² tezlanish beradigan kuch: har sekundda tezlik 1 m/s ga oshyapti. Shuning uchun 1 N = 1 kg·m/s².',
        end: (t, a, v, x) => `Arava yo'l oxiriga yetdi: t = ${t} s, v = a·t = ${a} · ${t} = ${v} m/s, x = a·t² / 2 = ${x} m.`,
        timeUp: (t, v, x) => `${t} s o'tdi: tezlanish kichik, arava atigi ${x} m yurdi (v = ${v} m/s). Kuchni oshiring yoki massani kamaytiring.`,
      },
    },
    lab: {
      modeLabel: "Qaysi bog'liqlikni tekshiramiz",
      modes: {
        force: { name: 'a ning F ga bog‘liqligi', sub: "m o'zgarmas" },
        mass: { name: 'a ning m ga bog‘liqligi', sub: "F o'zgarmas" },
      },
      measure: "O'lchash",
      measuring: "O'lchanmoqda…",
      series: 'Seriya (5 ta)',
      count: (n) => `${n} ta o'lchash`,
      clear: 'Jadvalni tozalash',
      fixedM: "Aravaning massasi (o'zgarmas)",
      fixedF: "Tortish kuchi (o'zgarmas)",
      F: 'Tortish kuchi',
      m: 'Aravaning massasi',
      FHint: 'Kuchni tanlab, «O‘lchash»ni bosing',
      mHint: 'Massani tanlab, «O‘lchash»ni bosing',
      gate: (n) => `${n}-fotodatchik`,
      dist: (s) => `s = ${s} m`,
      legend: { F: 'tortish kuchi F', beam: 'fotodatchik nuri', s: "o'lchanadigan masofa s" },
      chipReal: 'Real vaqt',
      scale: (n) => `= ${n} N`,
      axisX: 'x, m',
      stopwatch: 'sekundomer',
      sceneLabel: (F, m, t) => `Fotodatchikli silliq yo'l. F = ${F} N, m = ${m} kg, sekundomer ${t} s.`,
      FTag: (F) => `F = ${F} N`,
      massTag: (m) => `${m} kg`,
      readouts: { t: 'Vaqt A → B', a: "O'lchangan tezlanish", calc: 'Hisob: F / m', law: 'Qonuniyat' },
      tSub: (s) => `masofa s = ${s} m, boshida v₀ = 0`,
      aSub: (s, t) => `a = 2s / t² = 2·${s} / ${t}²`,
      calcSub: (F, m) => `${F} N / ${m} kg`,
      lawForce: (k) => `a / F ≈ ${k} 1/kg`,
      lawForceSub: (m) => `= 1 / m = 1 / ${m} kg — o'zgarmas`,
      lawMass: (k) => `a · m ≈ ${k} N`,
      lawMassSub: (F) => `= F = ${F} N — o'zgarmas`,
      lawWait: "Kamida 2 ta o'lchash kerak",
      table: {
        title: "O'lchashlar jadvali",
        n: '№',
        F: 'F, N',
        m: 'm, kg',
        t: 't, s',
        a: 'a, m/s²',
        ratio: 'a / F',
        prod: 'a · m, N',
        empty: "Hali o'lchash yo'q. Qiymatni tanlab, «O'lchash»ni bosing yoki «Seriya» bilan 5 ta o'lchashni ketma-ket bajaring.",
        caption: "O'lchash natijalari",
      },
      graph: {
        titleF: 'Grafik: a(F)',
        titleM: 'Grafik: a(m)',
        titleInv: 'Grafik: a(1/m)',
        xF: 'F, N',
        xM: 'm, kg',
        xInv: '1/m, 1/kg',
        y: 'a, m/s²',
        seriesM: (v) => `m = ${v} kg`,
        seriesF: (v) => `F = ${v} N`,
        noteF: "Nuqtalar koordinata boshidan o'tuvchi to'g'ri chiziqda yotadi: a ~ F. Massa kichik bo'lsa, chiziq tikroq (qiyaligi 1 / m).",
        noteM: "a(m) — giperbola: massa 2 marta oshsa, a 2 marta kamayadi. a(1/m) esa koordinata boshidan o'tuvchi to'g'ri chiziq (qiyaligi F).",
        axisLabel: "Gorizontal o'q",
        axes: { m: 'm', inv: '1 / m' },
        label: "O'lchangan tezlanish grafigi",
      },
      explain: {
        idleForce: (m) =>
          `Massa o'zgarmas (m = ${m} kg), kuchni o'zgartiramiz. Arava A datchikdan tinch holatda jo'naydi; B gacha s = 2 m yo'lning vaqtini o'lchab, a = 2s / t² ni topamiz.`,
        idleMass: (F) =>
          `Kuch o'zgarmas (F = ${F} N), massani o'zgartiramiz. Arava A datchikdan tinch holatda jo'naydi; B gacha s = 2 m yo'lning vaqtini o'lchab, a = 2s / t² ni topamiz.`,
        measuring: "Sekundomer ishlayapti: arava A datchikdan B datchikkacha 2 m yo'l bosmoqda…",
        result: (t, a, calc) => `t = ${t} s ⇒ a = 2s / t² = ${a} m/s². Hisob bo'yicha F / m = ${calc} m/s² — tajriba qonunni tasdiqladi.`,
        lawForce: (k, m) => `a / F har doim ≈ ${k} 1/kg = 1 / ${m} kg. Demak a ~ F: kuch necha marta oshsa, tezlanish ham shuncha marta oshadi.`,
        lawMass: (k) => `a · m har doim ≈ ${k} N, ya'ni kuchga teng. Demak a ~ 1 / m: massa necha marta oshsa, tezlanish shuncha marta kamayadi.`,
      },
    },
    res: {
      presetsLabel: 'Tayyor holatlar',
      presets: {
        same: { name: 'Bir tomonga', sub: '30 N + 20 N' },
        opposite: { name: 'Qarama-qarshi', sub: '30 N va 20 N' },
        right: { name: "To'g'ri burchak", sub: '40 N ⊥ 30 N' },
        tug: { name: 'Arqon tortish', sub: '30 N va 30 N' },
        three: { name: 'Uchta kuch', sub: '3 × 30 N, 120° dan' },
      },
      force: (i) => `${i}-kuch`,
      mag: 'Kattaligi',
      dir: "Yo'nalishi",
      dirHint: "0° — o'ngga, 90° — yuqoriga, 180° — chapga",
      thirdAdd: "3-kuchni qo'shish",
      thirdRemove: 'Olib tashlash',
      m: 'Yashikning massasi',
      mHint: "Yashik silliq muz ustida — ishqalanish yo'q",
      legend: { f1: 'F₁', f2: 'F₂', f3: 'F₃', res: "teng ta'sir etuvchi F", a: 'tezlanish a', v: 'tezlik v', trail: "har 0.5 s dagi o'rni" },
      chipCam: 'Kamera yashik bilan birga harakatlanadi',
      chipReal: 'Real vaqt',
      dragHint: "Strelka uchini sudrab ham o'zgartirish mumkin",
      scale: (n) => `= ${n} N`,
      start: 'start',
      sceneLabel: (F, a, list) => `Muz ustidagi yashik, yuqoridan ko'rinish. Kuchlar: ${list}. Teng ta'sir etuvchi kuch ${F} N, tezlanish ${a} m/s².`,
      fTag: (i, F) => `F${i} = ${F} N`,
      resTag: (F) => `F = ${F} N`,
      aTag: (a) => `a = ${a} m/s²`,
      vTag: (v) => `v = ${v} m/s`,
      zeroTag: 'F = 0',
      readouts: { F: "Teng ta'sir etuvchi kuch", a: 'Tezlanish', v: 'Tezlik', formula: 'Qanday topildi' },
      FSub: (deg) => `yo'nalishi ${deg}°`,
      FSubZero: 'kuchlar muvozanatda',
      aSub: (F, m) => `a = F / m = ${F} / ${m}`,
      vSub: (x) => `bosib o'tilgan yo'l ${x} m`,
      formulas: {
        none: "Kuch yo'q: F = 0",
        one: (A) => `Bitta kuch: F = ${A}`,
        same: (A, B) => `Bir tomonga: F = ${A} + ${B}`,
        opposite: (A, B) => `Qarama-qarshi: F = |${A} − ${B}|`,
        right: (A, B) => `To'g'ri burchak: F = √(${A}² + ${B}²)`,
        general: (A, B) => `Parallelogramm: F = √(${A}² + ${B}² + 2${A}${B}·cos α)`,
        comps: 'Proyeksiyalar: F = √(Fx² + Fy²)',
      },
      comps: (fx, fy) => `Fx = ${fx} N, Fy = ${fy} N`,
      poly: {
        title: "Kuchlarni qo'shish: ko'pburchak qoidasi",
        closed: "Ko'pburchak yopildi: F = 0",
        note: "Har bir kuch oldingisining uchidan boshlab chiziladi. Boshidan oxiriga tortilgan qora strelka — teng ta'sir etuvchi kuch F.",
        label: "Kuchlarni ketma-ket qo'shish chizmasi",
      },
      explain: {
        idle: "Yashikka bir nechta kuch ta'sir qilyapti. Ularning vektor yig'indisi — teng ta'sir etuvchi kuch F (qora). Tezlanish aynan F yo'nalishida: a = F / m. «Boshlash»ni bosing.",
        balanced: "Kuchlar bir-birini muvozanatlaydi: F = 0, demak a = 0. Yashik tinch turaveradi — «Boshlash»ni bosib tekshiring.",
        balancedRun: "Yashikka kuchlar ta'sir qilyapti, lekin u joyidan qo'zg'almayapti: teng ta'sir etuvchi kuch F = 0, shuning uchun a = 0.",
        runAlong: (F, m, a) => `a = F / m = ${F} / ${m} = ${a} m/s². Kuchlar bir chiziqda, yashik teng ta'sir etuvchi kuch F tomonga tezlanmoqda.`,
        runMixed: (F, m, a) => `a = F / m = ${F} / ${m} = ${a} m/s². Yashik F yo'nalishida tezlanmoqda — alohida kuchlarning birortasi yo'nalishida emas!`,
        done: (t, v, x) => `${t} s ichida yashik ${x} m yurdi va v = ${v} m/s tezlikka erishdi. Uning yo'li — F yo'nalishidagi to'g'ri chiziq.`,
      },
    },
  },
  ru: {
    N: 'Н',
    kg: 'кг',
    invKg: '1/кг',
    card: {
      eyebrow: 'Виртуальная лаборатория · Динамика',
      title: 'Второй закон Ньютона',
      tabsLabel: 'Выберите опыт',
      tabs: {
        cart: { label: 'F = ma', sub: 'Сила и ускорение' },
        lab: { label: 'Опыт', sub: 'Графики a(F) и a(m)' },
        res: { label: 'Равнодействующая', sub: 'Несколько сил' },
      },
    },
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Второй закон Ньютона', text: 'ускорение тела прямо пропорционально действующей на него силе и обратно пропорционально его массе: a = F / m, то есть F = m·a.' },
        { term: 'Направление ускорения', text: 'a всегда направлено так же, как равнодействующая сила F (не обязательно вдоль скорости).' },
        { term: '1 ньютон (1 Н)', text: 'сила, сообщающая телу массой 1 кг ускорение 1 м/с²: 1 Н = 1 кг·м/с².' },
        { term: 'Равнодействующая сила', text: 'векторная сумма всех сил, действующих на тело. Если силы уравновешены, F = 0 и a = 0.' },
      ],
    },
    cart: {
      presetsLabel: 'Готовые случаи',
      presets: {
        lesson: { name: 'Основной пример', sub: 'F = 10 Н · m = 2 кг' },
        twoF: { name: 'Сила вдвое больше', sub: 'F = 20 Н · m = 2 кг' },
        twoM: { name: 'Масса вдвое больше', sub: 'F = 10 Н · m = 4 кг' },
        newton: { name: '1 ньютон', sub: 'F = 1 Н · m = 1 кг' },
      },
      F: 'Сила тяги',
      m: 'Масса тележки',
      FHint: 'Дорожка гладкая — трения нет, F — единственная горизонтальная сила на тележку',
      mHint: (n) => `Тележка 1 кг + грузы на ней ${n} кг`,
      mHintBare: 'Тележка без грузов — 1 кг',
      legend: { F: 'сила тяги F', a: 'ускорение a', v: 'скорость v', marks: 'положение через каждые 0,5 с' },
      chipSlow: 'Время замедлено в 2 раза',
      scale: (n) => `= ${n} Н`,
      axisX: 'x, м',
      sceneLabel: (F, m, a, t, v, x) => `Тележка на гладкой дорожке. F = ${F} Н, m = ${m} кг, a = ${a} м/с². t = ${t} с, v = ${v} м/с, x = ${x} м.`,
      FTag: (F) => `F = ${F} Н`,
      aTag: (a) => `a = ${a} м/с²`,
      vTag: (v) => `v = ${v} м/с`,
      massTag: (m) => `${m} кг`,
      secTag: (n) => `${n} с`,
      readouts: { t: 'Время', v: 'Скорость', a: 'Ускорение', formula: 'Формула в числах' },
      tSub: (x) => `пройденный путь x = ${x} м`,
      vSub: (a, t) => `v = a·t = ${a} · ${t}`,
      aSub: 'по направлению силы',
      aSubZero: 'нет силы — нет ускорения',
      unitLine: '1 Н = 1 кг · 1 м/с²',
      graph: {
        title: 'График v(t)',
        now: (a) => `сейчас: a = ${a} м/с²`,
        prev: (a) => `прошлый опыт: a = ${a} м/с²`,
        t: 't, с',
        v: 'v, м/с',
        label: 'График скорости тележки от времени',
        note: 'Наклон прямой — это ускорение (a = Δv / Δt). Чем больше сила или меньше масса, тем круче прямая.',
      },
      explain: {
        idle: 'Тележку на гладкой дорожке тянет сила F (трения нет). Нажмите «Старт»: тележка разгоняется с ускорением a = F / m в направлении силы.',
        zero: 'F = 0 — на тележку не действует сила, значит a = 0. Покоящаяся тележка остаётся в покое (первый закон Ньютона).',
        run: (F, m, a) => `a = F / m = ${F} / ${m} = ${a} м/с²: каждую секунду скорость растёт на ${a} м/с. Ускорение (оранжевое) направлено туда же, куда сила (красная).`,
        Fup: (k, a) => `Масса та же, сила больше в ${k} раза — и ускорение больше в ${k} раза: a = ${a} м/с².`,
        Fdown: (k, a) => `Масса та же, сила меньше в ${k} раза — и ускорение меньше в ${k} раза: a = ${a} м/с².`,
        mUp: (k, a) => `Сила та же, масса больше в ${k} раза — ускорение меньше в ${k} раза: a = ${a} м/с². Скорость массивного тела изменить труднее.`,
        mDown: (k, a) => `Сила та же, масса меньше в ${k} раза — ускорение больше в ${k} раза: a = ${a} м/с².`,
        newton: '1 Н — сила, сообщающая телу массой 1 кг ускорение 1 м/с²: каждую секунду скорость растёт на 1 м/с. Поэтому 1 Н = 1 кг·м/с².',
        end: (t, a, v, x) => `Тележка доехала до конца дорожки: t = ${t} с, v = a·t = ${a} · ${t} = ${v} м/с, x = a·t² / 2 = ${x} м.`,
        timeUp: (t, v, x) => `Прошло ${t} с: ускорение маленькое, тележка проехала всего ${x} м (v = ${v} м/с). Увеличьте силу или уменьшите массу.`,
      },
    },
    lab: {
      modeLabel: 'Какую зависимость проверяем',
      modes: {
        force: { name: 'Зависимость a от F', sub: 'm постоянна' },
        mass: { name: 'Зависимость a от m', sub: 'F постоянна' },
      },
      measure: 'Измерить',
      measuring: 'Измеряем…',
      series: 'Серия (5 опытов)',
      count: (n) => `измерений: ${n}`,
      clear: 'Очистить таблицу',
      fixedM: 'Масса тележки (постоянна)',
      fixedF: 'Сила тяги (постоянна)',
      F: 'Сила тяги',
      m: 'Масса тележки',
      FHint: 'Выберите силу и нажмите «Измерить»',
      mHint: 'Выберите массу и нажмите «Измерить»',
      gate: (n) => `фотодатчик ${n}`,
      dist: (s) => `s = ${s} м`,
      legend: { F: 'сила тяги F', beam: 'луч фотодатчика', s: 'измеряемое расстояние s' },
      chipReal: 'Реальное время',
      scale: (n) => `= ${n} Н`,
      axisX: 'x, м',
      stopwatch: 'секундомер',
      sceneLabel: (F, m, t) => `Гладкая дорожка с фотодатчиками. F = ${F} Н, m = ${m} кг, секундомер ${t} с.`,
      FTag: (F) => `F = ${F} Н`,
      massTag: (m) => `${m} кг`,
      readouts: { t: 'Время A → B', a: 'Измеренное ускорение', calc: 'Расчёт: F / m', law: 'Закономерность' },
      tSub: (s) => `расстояние s = ${s} м, вначале v₀ = 0`,
      aSub: (s, t) => `a = 2s / t² = 2·${s} / ${t}²`,
      calcSub: (F, m) => `${F} Н / ${m} кг`,
      lawForce: (k) => `a / F ≈ ${k} 1/кг`,
      lawForceSub: (m) => `= 1 / m = 1 / ${m} кг — постоянно`,
      lawMass: (k) => `a · m ≈ ${k} Н`,
      lawMassSub: (F) => `= F = ${F} Н — постоянно`,
      lawWait: 'Нужно хотя бы 2 измерения',
      table: {
        title: 'Таблица измерений',
        n: '№',
        F: 'F, Н',
        m: 'm, кг',
        t: 't, с',
        a: 'a, м/с²',
        ratio: 'a / F',
        prod: 'a · m, Н',
        empty: 'Измерений пока нет. Выберите значение и нажмите «Измерить» или запустите «Серию» из 5 измерений подряд.',
        caption: 'Результаты измерений',
      },
      graph: {
        titleF: 'График a(F)',
        titleM: 'График a(m)',
        titleInv: 'График a(1/m)',
        xF: 'F, Н',
        xM: 'm, кг',
        xInv: '1/m, 1/кг',
        y: 'a, м/с²',
        seriesM: (v) => `m = ${v} кг`,
        seriesF: (v) => `F = ${v} Н`,
        noteF: 'Точки ложатся на прямую через начало координат: a ~ F. Чем меньше масса, тем круче прямая (наклон 1 / m).',
        noteM: 'a(m) — гипербола: масса больше в 2 раза — ускорение меньше в 2 раза. А a(1/m) — прямая через начало координат (наклон F).',
        axisLabel: 'Горизонтальная ось',
        axes: { m: 'm', inv: '1 / m' },
        label: 'График измеренного ускорения',
      },
      explain: {
        idleForce: (m) =>
          `Масса постоянна (m = ${m} кг), меняем силу. Тележка стартует из покоя у датчика A; измерив время прохождения s = 2 м до датчика B, найдём a = 2s / t².`,
        idleMass: (F) =>
          `Сила постоянна (F = ${F} Н), меняем массу. Тележка стартует из покоя у датчика A; измерив время прохождения s = 2 м до датчика B, найдём a = 2s / t².`,
        measuring: 'Секундомер идёт: тележка проходит 2 м от датчика A до датчика B…',
        result: (t, a, calc) => `t = ${t} с ⇒ a = 2s / t² = ${a} м/с². По расчёту F / m = ${calc} м/с² — опыт подтвердил закон.`,
        lawForce: (k, m) => `a / F всё время ≈ ${k} 1/кг = 1 / ${m} кг. Значит a ~ F: во сколько раз больше сила, во столько раз больше ускорение.`,
        lawMass: (k) => `a · m всё время ≈ ${k} Н, то есть равно силе. Значит a ~ 1 / m: во сколько раз больше масса, во столько раз меньше ускорение.`,
      },
    },
    res: {
      presetsLabel: 'Готовые случаи',
      presets: {
        same: { name: 'В одну сторону', sub: '30 Н + 20 Н' },
        opposite: { name: 'Навстречу', sub: '30 Н и 20 Н' },
        right: { name: 'Под прямым углом', sub: '40 Н ⊥ 30 Н' },
        tug: { name: 'Перетягивание', sub: '30 Н и 30 Н' },
        three: { name: 'Три силы', sub: '3 × 30 Н через 120°' },
      },
      force: (i) => `Сила ${i}`,
      mag: 'Модуль',
      dir: 'Направление',
      dirHint: '0° — вправо, 90° — вверх, 180° — влево',
      thirdAdd: 'Добавить 3-ю силу',
      thirdRemove: 'Убрать',
      m: 'Масса ящика',
      mHint: 'Ящик на гладком льду — трения нет',
      legend: { f1: 'F₁', f2: 'F₂', f3: 'F₃', res: 'равнодействующая F', a: 'ускорение a', v: 'скорость v', trail: 'положение через 0,5 с' },
      chipCam: 'Камера движется вместе с ящиком',
      chipReal: 'Реальное время',
      dragHint: 'Конец стрелки можно перетаскивать',
      scale: (n) => `= ${n} Н`,
      start: 'старт',
      sceneLabel: (F, a, list) => `Ящик на льду, вид сверху. Силы: ${list}. Равнодействующая ${F} Н, ускорение ${a} м/с².`,
      fTag: (i, F) => `F${i} = ${F} Н`,
      resTag: (F) => `F = ${F} Н`,
      aTag: (a) => `a = ${a} м/с²`,
      vTag: (v) => `v = ${v} м/с`,
      zeroTag: 'F = 0',
      readouts: { F: 'Равнодействующая сила', a: 'Ускорение', v: 'Скорость', formula: 'Как найдено' },
      FSub: (deg) => `направление ${deg}°`,
      FSubZero: 'силы уравновешены',
      aSub: (F, m) => `a = F / m = ${F} / ${m}`,
      vSub: (x) => `пройдено ${x} м`,
      formulas: {
        none: 'Сил нет: F = 0',
        one: (A) => `Одна сила: F = ${A}`,
        same: (A, B) => `В одну сторону: F = ${A} + ${B}`,
        opposite: (A, B) => `Навстречу: F = |${A} − ${B}|`,
        right: (A, B) => `Под прямым углом: F = √(${A}² + ${B}²)`,
        general: (A, B) => `Параллелограмм: F = √(${A}² + ${B}² + 2${A}${B}·cos α)`,
        comps: 'Проекции: F = √(Fx² + Fy²)',
      },
      comps: (fx, fy) => `Fx = ${fx} Н, Fy = ${fy} Н`,
      poly: {
        title: 'Сложение сил: правило многоугольника',
        closed: 'Многоугольник замкнулся: F = 0',
        note: 'Каждая сила откладывается от конца предыдущей. Чёрная стрелка от начала к концу — равнодействующая F.',
        label: 'Чертёж последовательного сложения сил',
      },
      explain: {
        idle: 'На ящик действуют несколько сил. Их векторная сумма — равнодействующая F (чёрная). Ускорение направлено именно по F: a = F / m. Нажмите «Старт».',
        balanced: 'Силы уравновешивают друг друга: F = 0, значит a = 0. Ящик останется в покое — нажмите «Старт» и проверьте.',
        balancedRun: 'На ящик действуют силы, но он не трогается с места: равнодействующая F = 0, поэтому a = 0.',
        runAlong: (F, m, a) => `a = F / m = ${F} / ${m} = ${a} м/с². Силы на одной прямой, ящик разгоняется в сторону равнодействующей F.`,
        runMixed: (F, m, a) => `a = F / m = ${F} / ${m} = ${a} м/с². Ящик разгоняется по направлению F — ни по одной из отдельных сил!`,
        done: (t, v, x) => `За ${t} с ящик прошёл ${x} м и набрал скорость v = ${v} м/с. Его путь — прямая по направлению F.`,
      },
    },
  },
  en: {
    N: 'N',
    kg: 'kg',
    invKg: '1/kg',
    card: {
      eyebrow: 'Virtual lab · Dynamics',
      title: "Newton's second law",
      tabsLabel: 'Choose an experiment',
      tabs: {
        cart: { label: 'F = ma', sub: 'Force and acceleration' },
        lab: { label: 'Experiment', sub: 'a(F) and a(m) graphs' },
        res: { label: 'Resultant', sub: 'Several forces' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Run again', reset: 'Reset' },
    facts: {
      title: 'Remember',
      items: [
        { term: "Newton's second law", text: "a body's acceleration is proportional to the force on it and inversely proportional to its mass: a = F / m, i.e. F = m·a." },
        { term: 'Direction of a', text: 'a always points along the resultant force F (not necessarily along the velocity).' },
        { term: '1 newton (1 N)', text: 'the force that gives a 1 kg body an acceleration of 1 m/s²: 1 N = 1 kg·m/s².' },
        { term: 'Resultant force', text: 'the vector sum of all forces on a body. If the forces balance, F = 0 and a = 0.' },
      ],
    },
    cart: {
      presetsLabel: 'Presets',
      presets: {
        lesson: { name: 'Main example', sub: 'F = 10 N · m = 2 kg' },
        twoF: { name: 'Twice the force', sub: 'F = 20 N · m = 2 kg' },
        twoM: { name: 'Twice the mass', sub: 'F = 10 N · m = 4 kg' },
        newton: { name: '1 newton', sub: 'F = 1 N · m = 1 kg' },
      },
      F: 'Pulling force',
      m: 'Mass of the cart',
      FHint: 'The track is smooth — no friction, so F is the only horizontal force on the cart',
      mHint: (n) => `Cart 1 kg + ${n} kg of weights on it`,
      mHintBare: 'Empty cart — 1 kg',
      legend: { F: 'pulling force F', a: 'acceleration a', v: 'velocity v', marks: 'position every 0.5 s' },
      chipSlow: 'Time slowed down ×2',
      scale: (n) => `= ${n} N`,
      axisX: 'x, m',
      sceneLabel: (F, m, a, t, v, x) => `A cart on a smooth track. F = ${F} N, m = ${m} kg, a = ${a} m/s². t = ${t} s, v = ${v} m/s, x = ${x} m.`,
      FTag: (F) => `F = ${F} N`,
      aTag: (a) => `a = ${a} m/s²`,
      vTag: (v) => `v = ${v} m/s`,
      massTag: (m) => `${m} kg`,
      secTag: (n) => `${n} s`,
      readouts: { t: 'Time', v: 'Velocity', a: 'Acceleration', formula: 'Formula with numbers' },
      tSub: (x) => `distance travelled x = ${x} m`,
      vSub: (a, t) => `v = a·t = ${a} · ${t}`,
      aSub: 'along the force',
      aSubZero: 'no force — no acceleration',
      unitLine: '1 N = 1 kg · 1 m/s²',
      graph: {
        title: 'Graph v(t)',
        now: (a) => `now: a = ${a} m/s²`,
        prev: (a) => `previous: a = ${a} m/s²`,
        t: 't, s',
        v: 'v, m/s',
        label: "Graph of the cart's velocity against time",
        note: 'The slope of the line is the acceleration (a = Δv / Δt). A bigger force or a smaller mass gives a steeper line.',
      },
      explain: {
        idle: 'A force F pulls the cart along a smooth track (no friction). Press Start: the cart speeds up with a = F / m, in the direction of the force.',
        zero: "F = 0 — no force acts on the cart, so a = 0. A cart at rest stays at rest (Newton's first law).",
        run: (F, m, a) => `a = F / m = ${F} / ${m} = ${a} m/s²: the speed grows by ${a} m/s every second. The acceleration (orange) points the same way as the force (red).`,
        Fup: (k, a) => `Same mass, ${k} times the force — and ${k} times the acceleration: a = ${a} m/s².`,
        Fdown: (k, a) => `Same mass, the force is ${k} times smaller — so is the acceleration: a = ${a} m/s².`,
        mUp: (k, a) => `Same force, ${k} times the mass — the acceleration is ${k} times smaller: a = ${a} m/s². A heavier body is harder to speed up.`,
        mDown: (k, a) => `Same force, the mass is ${k} times smaller — the acceleration is ${k} times bigger: a = ${a} m/s².`,
        newton: '1 N is the force that gives a 1 kg body an acceleration of 1 m/s²: the speed grows by 1 m/s every second. So 1 N = 1 kg·m/s².',
        end: (t, a, v, x) => `The cart reached the end of the track: t = ${t} s, v = a·t = ${a} · ${t} = ${v} m/s, x = a·t² / 2 = ${x} m.`,
        timeUp: (t, v, x) => `${t} s have passed: the acceleration is small, the cart moved only ${x} m (v = ${v} m/s). Increase the force or reduce the mass.`,
      },
    },
    lab: {
      modeLabel: 'Which dependence to test',
      modes: {
        force: { name: 'a against F', sub: 'm kept constant' },
        mass: { name: 'a against m', sub: 'F kept constant' },
      },
      measure: 'Measure',
      measuring: 'Measuring…',
      series: 'Series (5 runs)',
      count: (n) => (n === 1 ? '1 run' : `${n} runs`),
      clear: 'Clear table',
      fixedM: 'Mass of the cart (constant)',
      fixedF: 'Pulling force (constant)',
      F: 'Pulling force',
      m: 'Mass of the cart',
      FHint: 'Pick a force and press Measure',
      mHint: 'Pick a mass and press Measure',
      gate: (n) => `light gate ${n}`,
      dist: (s) => `s = ${s} m`,
      legend: { F: 'pulling force F', beam: 'light-gate beam', s: 'measured distance s' },
      chipReal: 'Real time',
      scale: (n) => `= ${n} N`,
      axisX: 'x, m',
      stopwatch: 'stopwatch',
      sceneLabel: (F, m, t) => `A smooth track with light gates. F = ${F} N, m = ${m} kg, stopwatch ${t} s.`,
      FTag: (F) => `F = ${F} N`,
      massTag: (m) => `${m} kg`,
      readouts: { t: 'Time A → B', a: 'Measured acceleration', calc: 'Calculated: F / m', law: 'Pattern' },
      tSub: (s) => `distance s = ${s} m, starting from v₀ = 0`,
      aSub: (s, t) => `a = 2s / t² = 2·${s} / ${t}²`,
      calcSub: (F, m) => `${F} N / ${m} kg`,
      lawForce: (k) => `a / F ≈ ${k} 1/kg`,
      lawForceSub: (m) => `= 1 / m = 1 / ${m} kg — constant`,
      lawMass: (k) => `a · m ≈ ${k} N`,
      lawMassSub: (F) => `= F = ${F} N — constant`,
      lawWait: 'At least 2 measurements needed',
      table: {
        title: 'Table of measurements',
        n: '#',
        F: 'F, N',
        m: 'm, kg',
        t: 't, s',
        a: 'a, m/s²',
        ratio: 'a / F',
        prod: 'a · m, N',
        empty: 'No measurements yet. Pick a value and press Measure, or run a Series of 5 measurements in a row.',
        caption: 'Measurement results',
      },
      graph: {
        titleF: 'Graph a(F)',
        titleM: 'Graph a(m)',
        titleInv: 'Graph a(1/m)',
        xF: 'F, N',
        xM: 'm, kg',
        xInv: '1/m, 1/kg',
        y: 'a, m/s²',
        seriesM: (v) => `m = ${v} kg`,
        seriesF: (v) => `F = ${v} N`,
        noteF: 'The points lie on a straight line through the origin: a ~ F. A smaller mass gives a steeper line (slope 1 / m).',
        noteM: 'a(m) is a hyperbola: twice the mass, half the acceleration. a(1/m) is a straight line through the origin (slope F).',
        axisLabel: 'Horizontal axis',
        axes: { m: 'm', inv: '1 / m' },
        label: 'Graph of the measured acceleration',
      },
      explain: {
        idleForce: (m) =>
          `The mass stays the same (m = ${m} kg) and we change the force. The cart starts from rest at gate A; timing the s = 2 m to gate B gives a = 2s / t².`,
        idleMass: (F) =>
          `The force stays the same (F = ${F} N) and we change the mass. The cart starts from rest at gate A; timing the s = 2 m to gate B gives a = 2s / t².`,
        measuring: 'The stopwatch is running: the cart covers the 2 m from gate A to gate B…',
        result: (t, a, calc) => `t = ${t} s ⇒ a = 2s / t² = ${a} m/s². The formula gives F / m = ${calc} m/s² — the experiment confirms the law.`,
        lawForce: (k, m) => `a / F is always ≈ ${k} 1/kg = 1 / ${m} kg. So a ~ F: however many times the force grows, the acceleration grows the same number of times.`,
        lawMass: (k) => `a · m is always ≈ ${k} N — equal to the force. So a ~ 1 / m: however many times the mass grows, the acceleration shrinks the same number of times.`,
      },
    },
    res: {
      presetsLabel: 'Presets',
      presets: {
        same: { name: 'Same direction', sub: '30 N + 20 N' },
        opposite: { name: 'Opposite', sub: '30 N and 20 N' },
        right: { name: 'Right angle', sub: '40 N ⊥ 30 N' },
        tug: { name: 'Tug of war', sub: '30 N and 30 N' },
        three: { name: 'Three forces', sub: '3 × 30 N, 120° apart' },
      },
      force: (i) => `Force ${i}`,
      mag: 'Size',
      dir: 'Direction',
      dirHint: '0° — right, 90° — up, 180° — left',
      thirdAdd: 'Add a 3rd force',
      thirdRemove: 'Remove',
      m: 'Mass of the crate',
      mHint: 'The crate is on smooth ice — no friction',
      legend: { f1: 'F₁', f2: 'F₂', f3: 'F₃', res: 'resultant F', a: 'acceleration a', v: 'velocity v', trail: 'position every 0.5 s' },
      chipCam: 'The camera moves with the crate',
      chipReal: 'Real time',
      dragHint: 'You can also drag the arrow tips',
      scale: (n) => `= ${n} N`,
      start: 'start',
      sceneLabel: (F, a, list) => `A crate on ice seen from above. Forces: ${list}. Resultant ${F} N, acceleration ${a} m/s².`,
      fTag: (i, F) => `F${i} = ${F} N`,
      resTag: (F) => `F = ${F} N`,
      aTag: (a) => `a = ${a} m/s²`,
      vTag: (v) => `v = ${v} m/s`,
      zeroTag: 'F = 0',
      readouts: { F: 'Resultant force', a: 'Acceleration', v: 'Velocity', formula: 'How it is found' },
      FSub: (deg) => `direction ${deg}°`,
      FSubZero: 'the forces balance',
      aSub: (F, m) => `a = F / m = ${F} / ${m}`,
      vSub: (x) => `distance travelled ${x} m`,
      formulas: {
        none: 'No forces: F = 0',
        one: (A) => `One force: F = ${A}`,
        same: (A, B) => `Same direction: F = ${A} + ${B}`,
        opposite: (A, B) => `Opposite: F = |${A} − ${B}|`,
        right: (A, B) => `Right angle: F = √(${A}² + ${B}²)`,
        general: (A, B) => `Parallelogram: F = √(${A}² + ${B}² + 2${A}${B}·cos α)`,
        comps: 'Components: F = √(Fx² + Fy²)',
      },
      comps: (fx, fy) => `Fx = ${fx} N, Fy = ${fy} N`,
      poly: {
        title: 'Adding forces: the polygon rule',
        closed: 'The polygon closes: F = 0',
        note: 'Each force is drawn from the tip of the previous one. The black arrow from start to end is the resultant F.',
        label: 'Drawing of the forces added tip to tail',
      },
      explain: {
        idle: 'Several forces act on the crate. Their vector sum is the resultant force F (black). The acceleration points exactly along F: a = F / m. Press Start.',
        balanced: 'The forces balance each other: F = 0, so a = 0. The crate stays at rest — press Start and check.',
        balancedRun: 'Forces act on the crate, yet it does not move: the resultant F = 0, so a = 0.',
        runAlong: (F, m, a) => `a = F / m = ${F} / ${m} = ${a} m/s². The forces lie on one line and the crate speeds up towards the resultant F.`,
        runMixed: (F, m, a) => `a = F / m = ${F} / ${m} = ${a} m/s². The crate speeds up along F — not along any of the separate forces!`,
        done: (t, v, x) => `In ${t} s the crate moved ${x} m and reached v = ${v} m/s. Its path is a straight line along F.`,
      },
    },
  },
};

/* ================================================================= card */

export default function NewtonSecondLaw() {
  const T = useSimText(TEXT);
  const tabs = [
    { id: 'cart', ...T.card.tabs.cart, icon: Rocket, render: () => <CartSim T={T} /> },
    { id: 'lab', ...T.card.tabs.lab, icon: Table2, render: () => <ExperimentSim T={T} /> },
    { id: 'res', ...T.card.tabs.res, icon: Sigma, render: () => <ResultantSim T={T} /> },
  ];
  return <SimCard eyebrow={T.card.eyebrow} title={T.card.title} tabsLabel={T.card.tabsLabel} tabs={tabs} facts={T.facts} icon={FlaskConical} idPrefix="nsl" />;
}

/* ============================================================ F = ma cart */

const L_TRACK = 10; // m, length of the track
const T_SLOW = 0.5; // the clock runs at half speed
const T_MAX = 6; // s, a run never lasts longer
const T_ZERO = 2; // s, a run with F = 0
const PRESETS = {
  lesson: { F: 10, m: 2, icon: MoveRight },
  twoF: { F: 20, m: 2, icon: Rocket },
  twoM: { F: 10, m: 4, icon: Dumbbell },
  newton: { F: 1, m: 1, icon: Scale },
};
const IDLE = { t: 0, running: false, done: false };

/** How long a run lasts: until the cart reaches the end of the track (x = aT²/2 = L), at most T_MAX. */
function runTime(a) {
  return a > 1e-9 ? Math.min(T_MAX, Math.sqrt((2 * L_TRACK) / a)) : T_ZERO;
}

function CartSim({ T }) {
  const L = T.cart;
  const dec = T.decimal;
  const [F, setF] = useState(10);
  const [m, setM] = useState(2);
  const [sim, setSim] = useState(IDLE);
  const [history, setHistory] = useState([]); // recent finished runs { F, m }
  const a = F / m;
  const tEnd = runTime(a);
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].F === F && PRESETS[k].m === m) ?? null;
  const prev = [...history].reverse().find((r) => r.F !== F || r.m !== m) ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tEnd, p.t + dt * T_SLOW);
      const done = t >= tEnd - 1e-9;
      return { t, running: !done, done };
    });
    if (sim.t + dt * T_SLOW >= tEnd - 1e-9 && F > 0) {
      setHistory((h) => [...h.filter((r) => r.F !== F || r.m !== m), { F, m }].slice(-3));
    }
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    setF(PRESETS[id].F);
    setM(PRESETS[id].m);
    setSim(IDLE);
  };

  const t = sim.t;
  const v = a * t;
  const x = 0.5 * a * t * t;
  const reachedEnd = sim.done && a > 1e-9 && tEnd < T_MAX - 1e-9;
  const D = (n) => trim(n, dec, 2);

  /* ---- explanation */
  let key = 'idle';
  if (F === 0) key = 'zero';
  else if (sim.done) key = reachedEnd ? 'end' : 'timeUp';
  else if (t > 0) {
    if (preset === 'newton') key = 'newton';
    else if (prev && prev.m === m && prev.F !== F) key = F > prev.F ? 'Fup' : 'Fdown';
    else if (prev && prev.F === F && prev.m !== m) key = m > prev.m ? 'mUp' : 'mDown';
    else key = 'run';
  }
  const settled = useSettled(key, key === 'idle' || key === 'end' || key === 'timeUp' ? 0 : 250);
  const ex = L.explain;
  const ratio = (p, q) => D(Math.max(p, q) / Math.min(p, q));
  const text = {
    idle: ex.idle,
    zero: ex.zero,
    run: ex.run(D(F), D(m), D(a)),
    newton: ex.newton,
    Fup: prev ? ex.Fup(ratio(F, prev.F), D(a)) : '',
    Fdown: prev ? ex.Fdown(ratio(F, prev.F), D(a)) : '',
    mUp: prev ? ex.mUp(ratio(m, prev.m), D(a)) : '',
    mDown: prev ? ex.mDown(ratio(m, prev.m), D(a)) : '',
    end: ex.end(fmt(tEnd, 2, dec), D(a), fmt(a * tEnd, 1, dec), fmt(0.5 * a * tEnd * tEnd, 1, dec)),
    timeUp: ex.timeUp(fmt(tEnd, 0, dec), fmt(a * tEnd, 2, dec), fmt(0.5 * a * tEnd * tEnd, 2, dec)),
  }[settled];
  const tone = { idle: '#22d3ee', zero: '#f87171', run: '#fb923c', newton: '#a78bfa', Fup: '#f87171', Fdown: '#f87171', mUp: '#94a3b8', mDown: '#94a3b8', end: '#34d399', timeUp: '#fbbf24' }[settled];

  /* ---- graph */
  const tPrev = prev ? runTime(prev.F / prev.m) : 0;
  const xMax = niceMax(Math.max(tEnd, tPrev, 1));
  const yMax = niceMax(Math.max(a * tEnd, prev ? (prev.F / prev.m) * tPrev : 0, 1));
  const series = [];
  if (prev) {
    const ap = prev.F / prev.m;
    series.push({ id: 'prev', label: L.graph.prev(D(ap)), color: '#64748b', dash: '6 5', dot: false, points: [{ x: 0, y: 0 }, { x: tPrev, y: ap * tPrev }] });
  }
  series.push({ id: 'now', label: L.graph.now(D(a)), color: '#34d399', points: [{ x: 0, y: 0 }, { x: t, y: v }] });

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={preset}
            onChange={pick}
            options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <CartScene T={T} F={F} m={m} a={a} t={t} running={sim.running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 2, dec)} unit={T.s} accent={COL.time} textColor="#a5f3fc" sub={L.tSub(fmt(x, 2, dec))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(t / tEnd) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={L.readouts.v} symbol="v" value={fmt(v, 2, dec)} unit={T.ms} accent={COL.vel} textColor={COL.velText} sub={L.vSub(D(a), fmt(t, 2, dec))} />
        <Readout label={L.readouts.a} symbol="a" value={D(a)} unit={T.ms2} accent={COL.acc} textColor={COL.accText} sub={F > 0 ? L.aSub : L.aSubZero} />
        <Readout label={L.readouts.formula} accent="#e2e8f0">
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug">
            <p>
              <span className="font-serif italic text-gray-200">a = F / m</span>
              <span className="tabular-nums text-gray-400">
                {' '}
                = {D(F)} {T.N} / {D(m)} {T.kg} = <b className="text-[#fdba74]">{D(a)}</b> {T.ms2}
              </span>
            </p>
            <p>
              <span className="font-serif italic text-gray-200">F = m·a</span>
              <span className="tabular-nums text-gray-400">
                {' '}
                = {D(m)} · {D(a)} = <b className="text-[#fca5a5]">{D(F)}</b> {T.N}
              </span>
            </p>
            <p className="text-[12px] text-gray-500">{L.unitLine}</p>
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="nsl-F"
            label={L.F}
            symbol="F"
            min={0}
            max={20}
            step={1}
            value={F}
            onChange={(n) => {
              setF(n);
              setSim(IDLE);
            }}
            accent={COL.force}
            display={`${D(F)} ${T.N}`}
            hint={L.FHint}
          />
          <RangeField
            id="nsl-m"
            label={L.m}
            symbol="m"
            min={1}
            max={8}
            step={0.5}
            value={m}
            onChange={(n) => {
              setM(n);
              setSim(IDLE);
            }}
            accent={COL.mass}
            display={`${D(m)} ${T.kg}`}
            hint={m > 1 ? L.mHint(D(m - 1)) : L.mHintBare}
          />
          <div className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2.5 text-sm text-gray-300">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-400/15 text-orange-300">
              <Weight size={17} aria-hidden="true" />
            </span>
            <span className="tabular-nums leading-snug">
              <Rich>{`a = F / m = ${D(F)} / ${D(m)} = ${D(a)} ${T.ms2}`}</Rich>
            </span>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={series}
            xMax={xMax}
            yMax={yMax}
            xLabel={L.graph.t}
            yLabel={L.graph.v}
            marker={t > 0 ? t : undefined}
            decimal={dec}
            xDigits={tickDigits(xMax)}
            yDigits={tickDigits(yMax)}
            ariaLabel={L.graph.label}
            note={L.graph.note}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function CartScene({ T, F, m, a, t, running }) {
  const L = T.cart;
  const dec = T.decimal;
  const x = Math.min(L_TRACK, 0.5 * a * t * t);
  const v = a * t;
  const D = (n) => trim(n, dec, 2);
  const kFwide = 5; // px per newton, desktop
  const kFnarrow = 2.6;
  const marks = [];
  for (let n = 1; n * 0.5 <= t + 1e-9; n += 1) {
    const xn = 0.5 * a * (n * 0.5) ** 2;
    if (xn > L_TRACK + 1e-9) break;
    marks.push({ n, x: xn });
  }

  return (
    <LabScene
      legend={[
        { color: COL.force, label: L.legend.F, kind: 'arrow' },
        { color: COL.acc, label: L.legend.a, kind: 'arrow' },
        { color: COL.vel, label: L.legend.v, kind: 'arrow' },
        { color: COL.vel, label: L.legend.marks, kind: 'ring' },
      ]}
      chips={(W, narrow) => (
        <>
          <Chip>
            {L.chipSlow} · t = {fmt(t, 2, dec)} {T.s}
          </Chip>
          <ScaleChip px={10 * (narrow ? kFnarrow : kFwide)} text={L.scale(10)} />
        </>
      )}
      height={(W, narrow) => (narrow ? 232 : 272)}
      ariaLabel={L.sceneLabel(D(F), D(m), D(a), fmt(t, 2, dec), fmt(v, 2, dec), fmt(x, 2, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const len = narrow ? 64 : 116;
        const kF = narrow ? kFnarrow : kFwide;
        const ak = narrow ? 4 : 8; // px per m/s²
        const vk = narrow ? 3.2 : 7; // px per m/s
        const padL = len / 2 + (narrow ? 14 : 34);
        const padR = len / 2 + 12 + 20 * kF + (narrow ? 8 : 26);
        const view = lineView(0, L_TRACK, W, padL, padR);
        const railY = H - (narrow ? 50 : 56);
        const g = cartGeom(len, m);
        const cx = view.sx(x);
        const hookX = cx + len / 2 + 7;
        const fy = railY + g.midY;
        const yA = railY + g.top - (narrow ? 16 : 22);
        const yV = yA - (narrow ? 22 : 28);
        const box = { w: W, h: H };
        const aText = L.aTag(D(a));
        const vText = L.vTag(fmt(v, 1, dec));
        const aW = textWidth(aText, fs, 600) + 16;
        const vW = textWidth(vText, fs, 600) + 16;
        const fText = L.FTag(D(F));
        const fW = textWidth(fText, fs, 600) + 16;
        const fLen = F * kF;
        return (
          <>
            {/* lab paper */}
            <g aria-hidden="true">
              {Array.from({ length: Math.ceil(W / 28) + 1 }, (_, i) => (
                <line key={`gv${i}`} x1={i * 28} x2={i * 28} y1={0} y2={railY - 1} stroke={COL.grid} strokeWidth={1} />
              ))}
              {Array.from({ length: Math.ceil(railY / 28) }, (_, i) => (
                <line key={`gh${i}`} x1={0} x2={W} y1={railY - 1 - i * 28} y2={railY - 1 - i * 28} stroke={COL.grid} strokeWidth={1} />
              ))}
            </g>
            <Track view={view} W={W} y={railY} x0={0} x1={L_TRACK} step={narrow ? 2 : 1} minor={narrow ? 2 : 2} unit={L.axisX} decimal={dec} fs={fs - 1} stopAt={L_TRACK + (len / 2 + 2) / view.k} />
            <line x1={view.sx(0)} x2={view.sx(0)} y1={railY - 18} y2={railY + 14} stroke={COL.ink} strokeWidth={1.5} strokeDasharray="3 3" />

            {/* strobe marks every 0.5 s */}
            {marks.map((mk) => (
              <g key={mk.n}>
                <circle cx={view.sx(mk.x)} cy={railY + 4.5} r={3.2} fill="#fff" stroke={COL.vel} strokeWidth={1.8} />
                {mk.n % 2 === 0 && (
                  <text x={view.sx(mk.x)} y={railY - 6} textAnchor="middle" fontSize={fs - 2} fill="#047857" fontWeight="600">
                    {L.secTag(mk.n / 2)}
                  </text>
                )}
              </g>
            ))}

            {running && fLen > 2 && <circle cx={hookX} cy={fy} r={8} fill={COL.force} className="cl-pulse" />}
            <Cart cx={cx} y={railY} len={len} mass={m} label={L.massTag(D(m))} rot={view.sx(x) / (len * 0.1)} fs={narrow ? 10 : 12} />

            {/* force */}
            {fLen > 2 && (
              <>
                <Arrow x1={hookX} y1={fy} x2={hookX + fLen} y2={fy} color={COL.force} width={narrow ? 3 : 4} head={narrow ? 10 : 13} />
                <Pill x={hookX + Math.max(fLen, fW) / 2} y={fy - (narrow ? 16 : 21)} text={fText} bg={COL.force} size={fs} box={box} />
              </>
            )}

            {/* acceleration and velocity from the centre of the cart */}
            {a > 1e-9 && (
              <>
                <Arrow x1={cx} y1={yA} x2={cx + a * ak} y2={yA} color={COL.acc} width={narrow ? 3 : 3.5} head={narrow ? 9 : 12} />
                <circle cx={cx} cy={yA} r={3} fill={COL.acc} />
                <Pill x={cx - aW / 2 - 8} y={yA} text={aText} bg={COL.acc} size={fs} box={box} />
              </>
            )}
            {v > 0.05 && (
              <>
                <Arrow x1={cx} y1={yV} x2={cx + v * vk} y2={yV} color={COL.vel} width={narrow ? 3 : 3.5} head={narrow ? 9 : 12} />
                <circle cx={cx} cy={yV} r={3} fill={COL.vel} />
                <Pill x={cx - vW / 2 - 8} y={yV} text={vText} bg={COL.vel} size={fs} box={box} />
              </>
            )}
          </>
        );
      }}
    </LabScene>
  );
}
