import { useState } from 'react';
import { Armchair, Building2, Coins, Lightbulb, MoveLeft, MoveRight, Pause, Play, RotateCcw, Sailboat, Timer, TrainFront } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { Btn, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useElementSize, useRafLoop, useSettled, useTween } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { useSimText } from '../kit/lang';
import { PANEL, PanelTitle, Person, SceneChip, ScenePanel, nf, nfa, paren } from './UniformMotion.parts';
import CoinSim from './RelativityOfMotion.coin';
import RiverSim from './RelativityOfMotion.river';

/* =========================================================================
 * Harakatning nisbiyligi — every word on screen lives here.
 * ========================================================================= */
const TEXT = {
  uz: {
    card: {
      eyebrow: 'Virtual laboratoriya · Kinematika',
      title: 'Harakatning nisbiyligi',
      tabsLabel: 'Simulyatorni tanlang',
      tabs: {
        add: { label: "Tezliklarni qo'shish", sub: "Poyezd va yo'lovchi" },
        coin: { label: 'Tushgan tanga', sub: 'Trayektoriya nisbiy' },
        river: { label: 'Daryodan suzish', sub: 'Vektorlar qo‘shiladi' },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    frames: {
      label: 'Kuzatuvchi',
      platform: { name: 'Perronda', sub: 'Yerga nisbatan', who: 'perrondagi kuzatuvchi' },
      train: { name: 'Vagonda', sub: 'Vagonga nisbatan', who: 'vagondagi kuzatuvchi' },
      chip: (name) => `Kuzatuvchi: ${name}`,
      slowChip: (t, k) => `t = ${t} s · vaqt ${k} marta sekin`,
    },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: 'Nisbiylik', text: '«jism harakatlanmoqda» degan gap qaysi sanoq sistemasiga nisbatan ekani aytilgandagina to‘liq bo‘ladi.' },
        { term: "Tezliklarni qo'shish", text: 'v(yer) = v(vagon) + v(vagonga nisbatan) — vektor sifatida: 20 + 1 = 21 m/s, 20 − 1 = 19 m/s.' },
        { term: 'Tinchlik ham nisbiy', text: "o'tirgan yo'lovchi vagonga nisbatan tinch, perronga nisbatan esa poyezd tezligida harakatlanadi." },
        { term: "Trayektoriya va yo'l", text: "ular ham nisbiy: tanga yo'lovchi uchun tik tushadi, perrondagi odam uchun egri chiziq chizadi." },
      ],
    },
    add: {
      modeLabel: "Yo'lovchi vagonda",
      modes: { fwd: 'Oldinga yuradi', sit: "O'tiradi", back: 'Orqaga yuradi' },
      trainSpeed: 'Poyezd tezligi (perronga nisbatan)',
      trainHint: (kmh) => `= ${kmh} km/soat`,
      walkSpeed: "Yo'lovchi tezligi (vagonga nisbatan)",
      walkHint: 'Odatdagi yurish ≈ 1–1.5 m/s, yugurish ≈ 3 m/s',
      legend: {
        ground: "yo'lovchi tezligi perronga nisbatan",
        rel: "yo'lovchi tezligi vagonga nisbatan",
        train: 'poyezd tezligi',
        platform: 'perronning tezligi (vagondan)',
        marks: "har 1 s dagi o'rni",
      },
      observer: 'kuzatuvchi',
      axisPlatform: 'x, m (perron)',
      axisTrain: "x′, m (vagon)",
      vTag: (v) => `v = ${v} m/s`,
      vpTag: (v) => `v′ = ${v} m/s`,
      VTag: (v) => `poyezd ${v} m/s`,
      platTag: (v) => `perron ${v} m/s`,
      sceneLabel: (who) => `Yon tomondan ko'rinish: poyezd perrondan o'tmoqda. Kuzatuvchi — ${who}.`,
      readouts: { ground: 'Perronga nisbatan', rel: 'Vagonga nisbatan', train: 'Poyezd', formula: "Tezliklarni qo'shish" },
      pathSub: (s) => `Bosilgan yo'l ${s} m`,
      trainSub: (kmh) => `perronga nisbatan · ${kmh} km/soat`,
      formula: 'v(yer) = v(vagon) + v(nisbiy)',
      formulaSub: 'Vektorlar: yo‘nalish ishora bilan',
      vectors: {
        title: "Vektorlarni qo'shish",
        train: (v) => `v(vagon) = ${v} m/s`,
        rel: (v) => `v(vagonga nisbatan) = ${v} m/s`,
        ground: (v) => `v(yer) = ${v} m/s`,
        seenPlatform: 'perrondagi kuzatuvchi ko‘radi',
        seenTrain: 'vagondagi kuzatuvchi ko‘radi',
        note: "Ikkinchi strelka birinchisining uchidan boshlanadi; natija — birinchisining boshidan ikkinchisining uchigacha.",
      },
      explain: {
        idle: (V, u) => `Kuzatuvchini tanlang va «Boshlash»ni bosing. Poyezd perronga nisbatan ${V} m/s tezlikda ketmoqda, yo'lovchi vagonda ${u} m/s tezlikda yuradi.`,
        idleSit: (V) => `Kuzatuvchini tanlang va «Boshlash»ni bosing. Poyezd perronga nisbatan ${V} m/s tezlikda ketmoqda, yo'lovchi esa vagonda o'tiribdi.`,
        fwd: (V, u, v) => `Perrondan qaraganda yo'lovchining tezligi ${V} + ${u} = ${v} m/s: poyezd uni olib ketyapti, u esa vagonda yana oldinga yuryapti.`,
        backFwd: (V, u, v) => `Yo'lovchi vagonda orqaga yursa ham, perronga nisbatan oldinga ketyapti: ${V} − ${u} = ${v} m/s.`,
        backBack: (V, u, v) => `Yo'lovchi poyezddan tezroq orqaga yuryapti: ${V} − ${u} = ${v} m/s — perronga nisbatan ham orqaga harakatlanmoqda.`,
        zero: (V, u) => `Qiziq holat: ${V} − ${u} = 0. Yo'lovchi vagonda orqaga yuryapti, perronga nisbatan esa joyida turibdi.`,
        sit: (V) => `Yo'lovchi vagonga nisbatan tinch (v′ = 0), lekin perronga nisbatan poyezd bilan birga ${V} m/s tezlikda harakatlanmoqda.`,
        still: (u) => `Poyezd turibdi: perronga ham, vagonga ham nisbatan yo'lovchining tezligi bir xil — ${u} m/s.`,
        stillSit: 'Poyezd ham, yo‘lovchi ham tinch: ikkala sanoq sistemasida ham tezlik nolga teng.',
        trainWalk: (u, V) => `Vagondagi kuzatuvchi uchun yo'lovchi atigi ${u} m/s tezlikda yuryapti, perron esa ${V} m/s tezlikda orqaga ketayotgandek ko'rinadi.`,
        trainSit: (V) => `Vagondagi kuzatuvchi uchun yo'lovchi tinch turibdi: v′ = 0. Perron esa ${V} m/s tezlikda orqaga ketmoqda. Harakat ham, tinchlik ham nisbiy!`,
        done: (t, sP, sT) => `${t} s davomida yo'lovchi perronga nisbatan ${sP} m, vagonga nisbatan esa ${sT} m yo'l bosdi. Bitta harakat — har xil tezlik va har xil yo'l.`,
      },
    },
    coin: {
      drop: 'Tangani tashlash',
      dropAgain: 'Yana tashlash',
      trainSpeed: 'Poyezd tezligi',
      trainHint: (kmh) => `= ${kmh} km/soat`,
      height: 'Tashlash balandligi',
      heightHint: (t) => `Tushish vaqti t = √(2h/g) ≈ ${t} s`,
      legend: {
        traj: 'trayektoriya (tanlangan kuzatuvchi)',
        other: "boshqa kuzatuvchi ko'rgan iz",
        strobe: "har 0.05 s dagi o'rni",
      },
      sceneLabel: (who) => `Vagon ichidan kesim: yo'lovchi tangani qo'yib yuboradi. Kuzatuvchi — ${who}.`,
      axisPlatform: 'x, m (perron)',
      axisTrain: "x′, m (vagon)",
      lineTag: "to'g'ri chiziq",
      parabolaTag: 'parabola',
      dxTag: (d) => `Δx = ${d} m`,
      hTag: (h) => `h = ${h} m`,
      readouts: { time: 'Tushish vaqti', train: "Yo'l vagonga nisbatan", platform: "Yo'l perronga nisbatan", formula: 'Perrondan qaraganda' },
      timeSub: (tf) => `t = √(2h/g) = ${tf} s`,
      trainSub: "Δx′ = 0 · tik to'g'ri chiziq",
      platformSub: (dx) => `Δx = V·t = ${dx} m · parabola`,
      formulaSub: 'Gorizontal: tekis, vertikal: erkin tushish',
      compare: { title: 'Ikki kuzatuvchi — ikki trayektoriya', train: 'Vagondan', platform: 'Perrondan' },
      explain: {
        idle: "«Tangani tashlash»ni bosing. Yo'lovchi tangani qo'lidan qo'yib yuboradi — tanga vagonga nisbatan tinch holatdan tusha boshlaydi.",
        fallPlatform: 'Perrondan qaraganda tanga pastga tushish bilan birga poyezd bilan oldinga ham ketyapti — u egri chiziq (parabola) chizadi.',
        fallTrain: "Yo'lovchi uchun tanga tik pastga tushyapti — xuddi poyezd turgandek. Vagon ichida hamma narsa poyezd bilan birga harakatlanadi.",
        still: "Poyezd turibdi: ikkala kuzatuvchi ham tanganing tik pastga tushganini ko'radi — trayektoriyalar bir xil.",
        donePlatform: (t, dx, s, h) => `Tanga ${t} s da polga tushdi. Perronga nisbatan u ${dx} m oldinga ko'chdi va ${s} m yo'l bosdi, vagonga nisbatan esa tik ${h} m tushdi.`,
        doneTrain: (h, s) => `Vagonda tanga yo'lovchining oyog'i oldiga tik tushdi: yo'l ${h} m. Perrondagi odam uchun esa yo'l ${s} m — trayektoriya ham, yo'l ham nisbiy.`,
        doneStill: (h) => `Poyezd turgan edi: tanga ikkala kuzatuvchi uchun ham tik ${h} m tushdi.`,
      },
    },
    river: {
      frames: {
        bank: { name: "Qirg'oqda", sub: 'Yerga nisbatan', who: "qirg'oqdagi kuzatuvchi" },
        water: { name: 'Solda', sub: 'Suv bilan oqadi', who: 'oqayotgan soldagi kuzatuvchi' },
      },
      boat: 'Qayiq tezligi (suvga nisbatan)',
      current: 'Oqim tezligi',
      angle: 'Qayiq yo‘nalishi',
      angleHint: "0° — qirg'oqqa tik, manfiy — oqimga qarshi burilgan",
      deg: (a) => `${a}°`,
      legend: { u: 'qayiq tezligi suvga nisbatan u', w: 'oqim tezligi w', v: "qayiq tezligi qirg'oqqa nisbatan v", traj: 'trayektoriya', other: "boshqa kuzatuvchi ko'rgan iz" },
      uTag: (v) => `u = ${v} m/s`,
      wTag: (v) => `w = ${v} m/s`,
      vTag: (v) => `v = ${v} m/s`,
      raft: 'sol',
      width: (d) => `kengligi ${d} m`,
      driftTag: (d) => `surilish ${d} m`,
      sceneLabel: (who) => `Daryo, yuqoridan ko'rinish. Kuzatuvchi — ${who}.`,
      fastChip: (t, k) => `t = ${t} s · vaqt ×${k} tezlashtirilgan`,
      readouts: { v: "Qirg'oqqa nisbatan tezlik", time: "O'tish vaqti", drift: "Oqim bo'yicha surilish", formula: 'Vektor yig‘indisi' },
      vSub: 'Suvga nisbatan u, oqim w — vektor yig‘indisi',
      timeSub: (d, uy) => `t = d / (u·cos α) = ${d} / ${uy}`,
      driftSub: (vx, t) => `s = vₓ·t = ${vx} · ${t}`,
      formula: 'v = u + w (vektorlar)',
      triTitle: 'Tezliklar uchburchagi',
      formulaPerp: (u, w, v) => `v = √(u² + w²) = √(${u}² + ${w}²) = ${v} m/s`,
      formulaGen: (vx, vy, v) => `vₓ = ${vx}, v_y = ${vy} → v = ${v} m/s`,
      explain: {
        idle: "Qayiq suvga nisbatan qarshi qirg'oq tomon suzadi, oqim esa uni pastga olib ketadi. Kuzatuvchini tanlang va «Boshlash»ni bosing.",
        bank: (v) => `Qirg'oqdan qaraganda qayiq qiya chiziq bo'ylab suzmoqda: uning tezligi u va oqim tezligi w vektor sifatida qo'shiladi — v = ${v} m/s.`,
        water: "Suv bilan birga oqayotgan soldagi kuzatuvchi uchun qayiq to'g'ri o'z burni yo'nalishida suzyapti — oqim unga sezilmaydi, qirg'oqlar esa orqaga ketayotgandek ko'rinadi.",
        straight: (a) => `Qayiq oqimga qarshi ${a}° burilgan: suvga nisbatan qiya suzadi, qirg'oqqa nisbatan esa to'g'ri qarshi tomonga o'tadi.`,
        noCurrent: "Oqim yo'q: ikkala sanoq sistemasida ham qayiq bir xil yo'l bilan suzadi.",
        done: (t, drift, sW, sB) => `Qayiq ${t} s da o'tdi va oqim bo'yicha ${drift} m ga surildi. Yo'l suvga nisbatan ${sW} m, qirg'oqqa nisbatan ${sB} m — yo'l ham nisbiy.`,
      },
    },
  },

  ru: {
    card: {
      eyebrow: 'Виртуальная лаборатория · Кинематика',
      title: 'Относительность движения',
      tabsLabel: 'Выберите симулятор',
      tabs: {
        add: { label: 'Сложение скоростей', sub: 'Поезд и пассажир' },
        coin: { label: 'Падающая монета', sub: 'Траектория относительна' },
        river: { label: 'Переправа', sub: 'Векторы складываются' },
      },
    },
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    frames: {
      label: 'Наблюдатель',
      platform: { name: 'На платформе', sub: 'Относительно земли', who: 'наблюдатель на платформе' },
      train: { name: 'В вагоне', sub: 'Относительно вагона', who: 'наблюдатель в вагоне' },
      chip: (name) => `Наблюдатель: ${name.toLowerCase()}`,
      slowChip: (t, k) => `t = ${t} с · время замедлено в ${k} ${k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 12 || k % 100 > 14) ? 'раза' : 'раз'}`,
    },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Относительность', text: 'фраза «тело движется» закончена, только когда сказано, относительно какой системы отсчёта.' },
        { term: 'Сложение скоростей', text: 'v(земля) = v(поезд) + v(относительно поезда) — как векторы: 20 + 1 = 21 м/с, 20 − 1 = 19 м/с.' },
        { term: 'Покой тоже относителен', text: 'сидящий пассажир покоится относительно вагона и движется со скоростью поезда относительно платформы.' },
        { term: 'Траектория и путь', text: 'тоже относительны: для пассажира монета падает отвесно, для человека на платформе — по кривой.' },
      ],
    },
    add: {
      modeLabel: 'Пассажир в вагоне',
      modes: { fwd: 'Идёт вперёд', sit: 'Сидит', back: 'Идёт назад' },
      trainSpeed: 'Скорость поезда (относительно платформы)',
      trainHint: (kmh) => `= ${kmh} км/ч`,
      walkSpeed: 'Скорость пассажира (относительно вагона)',
      walkHint: 'Обычный шаг ≈ 1–1,5 м/с, бег ≈ 3 м/с',
      legend: {
        ground: 'скорость пассажира относительно платформы',
        rel: 'скорость пассажира относительно вагона',
        train: 'скорость поезда',
        platform: 'скорость платформы (из вагона)',
        marks: 'положение через каждую 1 с',
      },
      observer: 'наблюдатель',
      axisPlatform: 'x, м (платформа)',
      axisTrain: 'x′, м (вагон)',
      vTag: (v) => `v = ${v} м/с`,
      vpTag: (v) => `v′ = ${v} м/с`,
      VTag: (v) => `поезд ${v} м/с`,
      platTag: (v) => `платформа ${v} м/с`,
      sceneLabel: (who) => `Вид сбоку: поезд проезжает мимо платформы. Наблюдатель — ${who}.`,
      readouts: { ground: 'Относительно платформы', rel: 'Относительно вагона', train: 'Поезд', formula: 'Сложение скоростей' },
      pathSub: (s) => `Пройденный путь ${s} м`,
      trainSub: (kmh) => `относительно платформы · ${kmh} км/ч`,
      formula: 'v(земля) = v(поезд) + v(отн.)',
      formulaSub: 'Векторы: направление — знаком',
      vectors: {
        title: 'Сложение векторов',
        train: (v) => `v(поезд) = ${v} м/с`,
        rel: (v) => `v(относительно вагона) = ${v} м/с`,
        ground: (v) => `v(земля) = ${v} м/с`,
        seenPlatform: 'видит наблюдатель на платформе',
        seenTrain: 'видит наблюдатель в вагоне',
        note: 'Вторая стрелка начинается от конца первой; сумма — от начала первой до конца второй.',
      },
      explain: {
        idle: (V, u) => `Выберите наблюдателя и нажмите «Старт». Поезд идёт относительно платформы со скоростью ${V} м/с, пассажир идёт по вагону со скоростью ${u} м/с.`,
        idleSit: (V) => `Выберите наблюдателя и нажмите «Старт». Поезд идёт относительно платформы со скоростью ${V} м/с, а пассажир сидит в вагоне.`,
        fwd: (V, u, v) => `С платформы скорость пассажира ${V} + ${u} = ${v} м/с: поезд везёт его, а он ещё и идёт вперёд по вагону.`,
        backFwd: (V, u, v) => `Пассажир идёт по вагону назад, но относительно платформы всё равно движется вперёд: ${V} − ${u} = ${v} м/с.`,
        backBack: (V, u, v) => `Пассажир идёт назад быстрее поезда: ${V} − ${u} = ${v} м/с — и относительно платформы он движется назад.`,
        zero: (V, u) => `Любопытный случай: ${V} − ${u} = 0. Пассажир идёт по вагону назад, а относительно платформы стоит на месте.`,
        sit: (V) => `Пассажир покоится относительно вагона (v′ = 0), но относительно платформы движется вместе с поездом со скоростью ${V} м/с.`,
        still: (u) => `Поезд стоит: относительно платформы и относительно вагона скорость пассажира одна и та же — ${u} м/с.`,
        stillSit: 'И поезд, и пассажир покоятся: в обеих системах отсчёта скорость равна нулю.',
        trainWalk: (u, V) => `Для наблюдателя в вагоне пассажир идёт всего со скоростью ${u} м/с, а платформа будто уезжает назад со скоростью ${V} м/с.`,
        trainSit: (V) => `Для наблюдателя в вагоне пассажир неподвижен: v′ = 0. А платформа уходит назад со скоростью ${V} м/с. И движение, и покой относительны!`,
        done: (t, sP, sT) => `За ${t} с пассажир прошёл ${sP} м относительно платформы и ${sT} м относительно вагона. Одно движение — разные скорости и разные пути.`,
      },
    },
    coin: {
      drop: 'Уронить монету',
      dropAgain: 'Уронить ещё раз',
      trainSpeed: 'Скорость поезда',
      trainHint: (kmh) => `= ${kmh} км/ч`,
      height: 'Высота падения',
      heightHint: (t) => `Время падения t = √(2h/g) ≈ ${t} с`,
      legend: {
        traj: 'траектория (выбранный наблюдатель)',
        other: 'след, который видит другой наблюдатель',
        strobe: 'положение через каждые 0,05 с',
      },
      sceneLabel: (who) => `Разрез вагона: пассажир отпускает монету. Наблюдатель — ${who}.`,
      axisPlatform: 'x, м (платформа)',
      axisTrain: 'x′, м (вагон)',
      lineTag: 'прямая',
      parabolaTag: 'парабола',
      dxTag: (d) => `Δx = ${d} м`,
      hTag: (h) => `h = ${h} м`,
      readouts: { time: 'Время падения', train: 'Путь относительно вагона', platform: 'Путь относительно платформы', formula: 'С платформы' },
      timeSub: (tf) => `t = √(2h/g) = ${tf} с`,
      trainSub: 'Δx′ = 0 · вертикальная прямая',
      platformSub: (dx) => `Δx = V·t = ${dx} м · парабола`,
      formulaSub: 'По горизонтали — равномерно, по вертикали — свободное падение',
      compare: { title: 'Два наблюдателя — две траектории', train: 'Из вагона', platform: 'С платформы' },
      explain: {
        idle: 'Нажмите «Уронить монету». Пассажир разжимает пальцы — монета начинает падать из состояния покоя относительно вагона.',
        fallPlatform: 'С платформы видно, что монета не только падает, но и едет вперёд вместе с поездом — она описывает кривую (параболу).',
        fallTrain: 'Для пассажира монета падает отвесно вниз — как будто поезд стоит. Внутри вагона всё движется вместе с поездом.',
        still: 'Поезд стоит: оба наблюдателя видят, что монета падает отвесно, — траектории одинаковы.',
        donePlatform: (t, dx, s, h) => `Монета упала на пол через ${t} с. Относительно платформы она сместилась вперёд на ${dx} м и прошла путь ${s} м, а относительно вагона упала отвесно на ${h} м.`,
        doneTrain: (h, s) => `В вагоне монета упала отвесно к ногам пассажира: путь ${h} м. А для человека на платформе путь ${s} м — и траектория, и путь относительны.`,
        doneStill: (h) => `Поезд стоял: для обоих наблюдателей монета упала отвесно на ${h} м.`,
      },
    },
    river: {
      frames: {
        bank: { name: 'На берегу', sub: 'Относительно земли', who: 'наблюдатель на берегу' },
        water: { name: 'На плоту', sub: 'Плывёт с водой', who: 'наблюдатель на плывущем плоту' },
      },
      boat: 'Скорость лодки (относительно воды)',
      current: 'Скорость течения',
      angle: 'Направление лодки',
      angleHint: '0° — поперёк реки, минус — повёрнута против течения',
      deg: (a) => `${a}°`,
      legend: { u: 'скорость лодки относительно воды u', w: 'скорость течения w', v: 'скорость лодки относительно берега v', traj: 'траектория', other: 'след, который видит другой наблюдатель' },
      uTag: (v) => `u = ${v} м/с`,
      wTag: (v) => `w = ${v} м/с`,
      vTag: (v) => `v = ${v} м/с`,
      raft: 'плот',
      width: (d) => `ширина ${d} м`,
      driftTag: (d) => `снос ${d} м`,
      sceneLabel: (who) => `Река, вид сверху. Наблюдатель — ${who}.`,
      fastChip: (t, k) => `t = ${t} с · время ускорено ×${k}`,
      readouts: { v: 'Скорость относительно берега', time: 'Время переправы', drift: 'Снос по течению', formula: 'Сумма векторов' },
      vSub: 'u относительно воды и течение w — сумма векторов',
      timeSub: (d, uy) => `t = d / (u·cos α) = ${d} / ${uy}`,
      driftSub: (vx, t) => `s = vₓ·t = ${vx} · ${t}`,
      formula: 'v = u + w (векторы)',
      triTitle: 'Треугольник скоростей',
      formulaPerp: (u, w, v) => `v = √(u² + w²) = √(${u}² + ${w}²) = ${v} м/с`,
      formulaGen: (vx, vy, v) => `vₓ = ${vx}, v_y = ${vy} → v = ${v} м/с`,
      explain: {
        idle: 'Лодка плывёт относительно воды к другому берегу, а течение сносит её вниз. Выберите наблюдателя и нажмите «Старт».',
        bank: (v) => `С берега видно, что лодка идёт наискосок: её скорость u и скорость течения w складываются как векторы — v = ${v} м/с.`,
        water: 'Для наблюдателя на плоту, который плывёт вместе с водой, лодка идёт прямо туда, куда смотрит её нос, — течения он не замечает, а берега уплывают назад.',
        straight: (a) => `Лодка повёрнута против течения на ${a}°: относительно воды она идёт наискосок, а относительно берега — прямо поперёк реки.`,
        noCurrent: 'Течения нет: в обеих системах отсчёта лодка плывёт одним и тем же путём.',
        done: (t, drift, sW, sB) => `Лодка переправилась за ${t} с, и её снесло по течению на ${drift} м. Путь относительно воды ${sW} м, относительно берега ${sB} м — путь тоже относителен.`,
      },
    },
  },

  en: {
    card: {
      eyebrow: 'Virtual laboratory · Kinematics',
      title: 'Relativity of motion',
      tabsLabel: 'Choose a simulator',
      tabs: {
        add: { label: 'Adding velocities', sub: 'Train and passenger' },
        coin: { label: 'The dropped coin', sub: 'Trajectory is relative' },
        river: { label: 'Crossing a river', sub: 'Vectors add' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Run again', reset: 'Reset' },
    frames: {
      label: 'Observer',
      platform: { name: 'On the platform', sub: 'Relative to the ground', who: 'an observer on the platform' },
      train: { name: 'In the carriage', sub: 'Relative to the carriage', who: 'an observer in the carriage' },
      chip: (name) => `Observer: ${name.toLowerCase()}`,
      slowChip: (t, k) => `t = ${t} s · time slowed ${k}×`,
    },
    facts: {
      title: 'Remember',
      items: [
        { term: 'Relativity', text: '"the body is moving" is unfinished until you say which frame of reference you mean.' },
        { term: 'Adding velocities', text: 'v(ground) = v(train) + v(relative to the train) — as vectors: 20 + 1 = 21 m/s, 20 − 1 = 19 m/s.' },
        { term: 'Rest is relative too', text: 'a seated passenger is at rest relative to the carriage and moves at the train’s speed relative to the platform.' },
        { term: 'Trajectory and distance', text: 'are relative as well: the coin falls straight down for the passenger and along a curve for someone on the platform.' },
      ],
    },
    add: {
      modeLabel: 'The passenger in the carriage',
      modes: { fwd: 'Walks forwards', sit: 'Sits', back: 'Walks back' },
      trainSpeed: 'Train speed (relative to the platform)',
      trainHint: (kmh) => `= ${kmh} km/h`,
      walkSpeed: 'Passenger speed (relative to the carriage)',
      walkHint: 'A normal walk ≈ 1–1.5 m/s, running ≈ 3 m/s',
      legend: {
        ground: 'passenger velocity relative to the platform',
        rel: 'passenger velocity relative to the carriage',
        train: 'train velocity',
        platform: 'platform velocity (seen from the carriage)',
        marks: 'position every 1 s',
      },
      observer: 'observer',
      axisPlatform: 'x, m (platform)',
      axisTrain: 'x′, m (carriage)',
      vTag: (v) => `v = ${v} m/s`,
      vpTag: (v) => `v′ = ${v} m/s`,
      VTag: (v) => `train ${v} m/s`,
      platTag: (v) => `platform ${v} m/s`,
      sceneLabel: (who) => `Side view: a train passes the platform. Observer — ${who}.`,
      readouts: { ground: 'Relative to the platform', rel: 'Relative to the carriage', train: 'Train', formula: 'Adding velocities' },
      pathSub: (s) => `Distance covered ${s} m`,
      trainSub: (kmh) => `relative to the platform · ${kmh} km/h`,
      formula: 'v(ground) = v(train) + v(rel.)',
      formulaSub: 'Vectors: direction shown by the sign',
      vectors: {
        title: 'Adding the vectors',
        train: (v) => `v(train) = ${v} m/s`,
        rel: (v) => `v(relative to the carriage) = ${v} m/s`,
        ground: (v) => `v(ground) = ${v} m/s`,
        seenPlatform: 'what the platform observer sees',
        seenTrain: 'what the carriage observer sees',
        note: 'The second arrow starts at the tip of the first; the sum runs from the tail of the first to the tip of the second.',
      },
      explain: {
        idle: (V, u) => `Choose an observer and press "Start". The train moves at ${V} m/s relative to the platform, and the passenger walks through the carriage at ${u} m/s.`,
        idleSit: (V) => `Choose an observer and press "Start". The train moves at ${V} m/s relative to the platform, and the passenger is sitting in the carriage.`,
        fwd: (V, u, v) => `From the platform the passenger’s velocity is ${V} + ${u} = ${v} m/s: the train carries them along, and they walk forwards inside it as well.`,
        backFwd: (V, u, v) => `The passenger walks back through the carriage, yet still moves forwards relative to the platform: ${V} − ${u} = ${v} m/s.`,
        backBack: (V, u, v) => `The passenger walks back faster than the train goes: ${V} − ${u} = ${v} m/s — they move backwards relative to the platform too.`,
        zero: (V, u) => `A curious case: ${V} − ${u} = 0. The passenger walks back through the carriage and stands still relative to the platform.`,
        sit: (V) => `The passenger is at rest relative to the carriage (v′ = 0), yet moves with the train at ${V} m/s relative to the platform.`,
        still: (u) => `The train is standing: relative to the platform and to the carriage the passenger’s velocity is the same — ${u} m/s.`,
        stillSit: 'The train and the passenger are both at rest: the velocity is zero in both frames.',
        trainWalk: (u, V) => `For the observer in the carriage the passenger walks at only ${u} m/s, while the platform seems to slide backwards at ${V} m/s.`,
        trainSit: (V) => `For the observer in the carriage the passenger is at rest: v′ = 0. The platform slides back at ${V} m/s. Motion and rest are both relative!`,
        done: (t, sP, sT) => `In ${t} s the passenger covered ${sP} m relative to the platform and ${sT} m relative to the carriage. One motion — different velocities and different distances.`,
      },
    },
    coin: {
      drop: 'Drop the coin',
      dropAgain: 'Drop again',
      trainSpeed: 'Train speed',
      trainHint: (kmh) => `= ${kmh} km/h`,
      height: 'Drop height',
      heightHint: (t) => `Fall time t = √(2h/g) ≈ ${t} s`,
      legend: {
        traj: 'trajectory (chosen observer)',
        other: 'the track the other observer sees',
        strobe: 'position every 0.05 s',
      },
      sceneLabel: (who) => `A cut-away carriage: the passenger lets go of a coin. Observer — ${who}.`,
      axisPlatform: 'x, m (platform)',
      axisTrain: 'x′, m (carriage)',
      lineTag: 'straight line',
      parabolaTag: 'parabola',
      dxTag: (d) => `Δx = ${d} m`,
      hTag: (h) => `h = ${h} m`,
      readouts: { time: 'Fall time', train: 'Distance relative to the carriage', platform: 'Distance relative to the platform', formula: 'Seen from the platform' },
      timeSub: (tf) => `t = √(2h/g) = ${tf} s`,
      trainSub: 'Δx′ = 0 · a vertical straight line',
      platformSub: (dx) => `Δx = V·t = ${dx} m · a parabola`,
      formulaSub: 'Uniform sideways, free fall downwards',
      compare: { title: 'Two observers — two trajectories', train: 'From the carriage', platform: 'From the platform' },
      explain: {
        idle: 'Press "Drop the coin". The passenger lets go — the coin starts falling from rest relative to the carriage.',
        fallPlatform: 'From the platform the coin is not only falling but also travelling forwards with the train — it traces a curve (a parabola).',
        fallTrain: 'For the passenger the coin falls straight down — just as if the train were standing still. Inside the carriage everything moves with the train.',
        still: 'The train is standing: both observers see the coin fall straight down — the trajectories are the same.',
        donePlatform: (t, dx, s, h) => `The coin hit the floor after ${t} s. Relative to the platform it moved ${dx} m forwards and covered ${s} m; relative to the carriage it simply fell ${h} m straight down.`,
        doneTrain: (h, s) => `In the carriage the coin fell straight down by the passenger’s feet: a distance of ${h} m. For someone on the platform it was ${s} m — trajectory and distance are both relative.`,
        doneStill: (h) => `The train was standing: for both observers the coin fell ${h} m straight down.`,
      },
    },
    river: {
      frames: {
        bank: { name: 'On the bank', sub: 'Relative to the ground', who: 'an observer on the bank' },
        water: { name: 'On a raft', sub: 'Drifts with the water', who: 'an observer on a drifting raft' },
      },
      boat: 'Boat speed (relative to the water)',
      current: 'Current speed',
      angle: 'Boat heading',
      angleHint: '0° — straight across, negative — turned against the current',
      deg: (a) => `${a}°`,
      legend: { u: 'boat velocity relative to the water u', w: 'current velocity w', v: 'boat velocity relative to the bank v', traj: 'trajectory', other: 'the track the other observer sees' },
      uTag: (v) => `u = ${v} m/s`,
      wTag: (v) => `w = ${v} m/s`,
      vTag: (v) => `v = ${v} m/s`,
      raft: 'raft',
      width: (d) => `width ${d} m`,
      driftTag: (d) => `drift ${d} m`,
      sceneLabel: (who) => `A river seen from above. Observer — ${who}.`,
      fastChip: (t, k) => `t = ${t} s · time sped up ×${k}`,
      readouts: { v: 'Velocity relative to the bank', time: 'Crossing time', drift: 'Drift downstream', formula: 'Vector sum' },
      vSub: 'u relative to the water plus the current w, as vectors',
      timeSub: (d, uy) => `t = d / (u·cos α) = ${d} / ${uy}`,
      driftSub: (vx, t) => `s = vₓ·t = ${vx} · ${t}`,
      formula: 'v = u + w (vectors)',
      triTitle: 'The velocity triangle',
      formulaPerp: (u, w, v) => `v = √(u² + w²) = √(${u}² + ${w}²) = ${v} m/s`,
      formulaGen: (vx, vy, v) => `vₓ = ${vx}, v_y = ${vy} → v = ${v} m/s`,
      explain: {
        idle: 'The boat heads for the far bank relative to the water, and the current carries it downstream. Choose an observer and press "Start".',
        bank: (v) => `From the bank the boat moves along a slanting line: its velocity u and the current w add as vectors — v = ${v} m/s.`,
        water: 'For an observer on a raft drifting with the water, the boat goes straight where its bow points — the current goes unnoticed, and the banks slide backwards.',
        straight: (a) => `The boat is turned ${a}° against the current: it moves at a slant relative to the water, but straight across relative to the bank.`,
        noCurrent: 'There is no current: the boat follows the same path in both frames.',
        done: (t, drift, sW, sB) => `The boat crossed in ${t} s and drifted ${drift} m downstream. Its distance was ${sW} m relative to the water and ${sB} m relative to the bank — distance is relative too.`,
      },
    },
  },
};

/* ================================================================== card */

export default function RelativityOfMotion() {
  const T = useSimText(TEXT);
  const c = T.card;
  return (
    <SimCard
      idPrefix="rel"
      eyebrow={c.eyebrow}
      title={c.title}
      tabsLabel={c.tabsLabel}
      tabs={[
        { id: 'add', label: c.tabs.add.label, sub: c.tabs.add.sub, icon: TrainFront, render: () => <AddSim T={T} /> },
        { id: 'coin', label: c.tabs.coin.label, sub: c.tabs.coin.sub, icon: Coins, render: () => <CoinSim T={T} /> },
        { id: 'river', label: c.tabs.river.label, sub: c.tabs.river.sub, icon: Sailboat, render: () => <RiverSim T={T} /> },
      ]}
      facts={T.facts}
    />
  );
}

/* ================================================== adding the velocities */

const COL = {
  platform: '#d97706',
  platformText: '#fcd34d',
  train: '#4f46e5',
  trainText: '#a5b4fc',
  person: '#e11d48',
  rel: PALETTE.second,
  relText: PALETTE.secondText,
  vel: PALETTE.vel,
  velText: PALETTE.velText,
  ink: PALETTE.ink,
};

const SLOW = 2; // time runs 2× slower on screen
const CAR = 24; // m, carriage length
const XR0 = 0; // m, rear of the passenger's carriage on the platform axis at t = 0
const CAM0 = -4; // m, left edge of the platform-frame view
const SEAT_X = 2.6; // m from the rear: the observer sitting in the carriage
const START = { fwd: 6, sit: 12, back: 18 };

/** How long a run lasts: up to 4 s, shorter when the passenger would leave the view; whole half-seconds. */
function runEnd(vGround, viewW) {
  let raw = 4;
  if (vGround > 0.05) raw = (CAM0 + viewW - 7 - (XR0 + 6)) / vGround;
  if (vGround < -0.05) raw = (XR0 + 18 - CAM0 - 4) / -vGround;
  return clamp(Math.floor(raw * 2) / 2, 1, 4);
}

function AddSim({ T }) {
  const t = T.add;
  const fr = T.frames;
  const dec = T.decimal;
  const [frame, setFrame] = useState('platform');
  const [mode, setMode] = useState('fwd');
  const [V, setV] = useState(20);
  const [u, setU] = useState(1);
  const [sim, setSim] = useState({ t: 0, running: false, done: false });
  const [blend, setBlend] = useTween(0);
  const [wrapRef, { width: wrapW }] = useElementSize();

  const dir = mode === 'fwd' ? 1 : mode === 'back' ? -1 : 0;
  const vp = dir * u; // relative to the carriage
  const v = V + vp; // relative to the platform
  const viewW = wrapW > 0 && wrapW < 600 ? 50 : 72;
  const tEnd = runEnd(v, viewW);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const tt = p.t + dt / SLOW;
      if (tt >= tEnd) return { t: tEnd, running: false, done: true };
      return { ...p, t: tt };
    });
  });

  const idle = { t: 0, running: false, done: false };
  const toggle = () => {
    if (sim.done) setSim({ ...idle, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const pickFrame = (f) => {
    setFrame(f);
    setBlend(f === 'train' ? 1 : 0, 650);
  };
  const change = (setter) => (val) => {
    setter(val);
    setSim(idle);
  };

  const time = Math.min(sim.t, tEnd);
  const sP = Math.abs(v) * time;
  const sT = Math.abs(vp) * time;
  const A = (n) => nfa(n, 1, dec);
  const F = (n) => fmt(n, 1, dec);

  let key = 'idle';
  if (sim.done) key = 'done';
  else if (time > 0 || sim.running) {
    if (V < 0.05) key = dir === 0 || u < 0.05 ? 'stillSit' : 'still';
    else if (frame === 'platform') {
      if (dir === 0 || u < 0.05) key = 'sit';
      else if (dir > 0) key = 'fwd';
      else key = Math.abs(v) < 0.05 ? 'zero' : v > 0 ? 'backFwd' : 'backBack';
    } else key = dir === 0 || u < 0.05 ? 'trainSit' : 'trainWalk';
  }
  const settled = useSettled(key, key === 'idle' || key === 'done' ? 0 : 300);
  const ex = t.explain;
  const text = {
    idle: dir === 0 ? ex.idleSit(A(V)) : ex.idle(A(V), A(u)),
    fwd: ex.fwd(A(V), A(u), A(v)),
    backFwd: ex.backFwd(A(V), A(u), A(v)),
    backBack: ex.backBack(A(V), A(u), A(v)),
    zero: ex.zero(A(V), A(u)),
    sit: ex.sit(A(V)),
    still: ex.still(A(u)),
    stillSit: ex.stillSit,
    trainWalk: ex.trainWalk(A(u), A(V)),
    trainSit: ex.trainSit(A(V)),
    done: ex.done(F(time), F(sP), F(sT)),
  }[settled];
  const tone = settled === 'done' ? '#34d399' : frame === 'platform' ? '#f59e0b' : '#818cf8';

  return (
    <div ref={wrapRef} className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{fr.label}</p>
          <Segmented
            label={fr.label}
            className="grid-cols-2"
            size="lg"
            value={frame}
            onChange={pickFrame}
            accent={frame === 'platform' ? '#f59e0b' : '#818cf8'}
            options={[
              { value: 'platform', label: fr.platform.name, sub: fr.platform.sub, icon: Building2 },
              { value: 'train', label: fr.train.name, sub: fr.train.sub, icon: TrainFront },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Btn variant="primary" icon={sim.running ? Pause : Play} onClick={toggle} className="md:min-w-[148px] min-h-[52px] text-[15px]">
            {sim.running ? T.common.pause : sim.done ? T.common.again : time > 0 ? T.common.resume : T.common.start}
          </Btn>
          <Btn icon={RotateCcw} onClick={() => setSim(idle)} disabled={time === 0 && !sim.running} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
      </div>

      <AddScene t={t} fr={fr} dec={dec} frame={frame} blend={blend} V={V} vp={vp} v={v} dir={dir} mode={mode} time={time} running={sim.running} viewW={viewW} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.ground} symbol="v" value={A(v)} unit={T.ms} accent={COL.vel} textColor={COL.velText} active={frame === 'platform'} sub={t.pathSub(F(sP))} />
        <Readout label={t.readouts.rel} symbol="v′" value={A(vp)} unit={T.ms} accent={COL.rel} textColor={COL.relText} active={frame === 'train'} sub={t.pathSub(F(sT))} />
        <Readout label={t.readouts.train} symbol="V" value={A(V)} unit={T.ms} accent={COL.train} textColor={COL.trainText} sub={t.trainSub(A(V * 3.6))} />
        <Readout label={t.readouts.formula} accent="#e2e8f0" sub={t.formulaSub}>
          <p className="mt-1.5 text-[13px] font-semibold tracking-wide text-gray-300">{t.formula}</p>
          <p className="mt-1 text-[17px] font-bold tabular-nums leading-snug text-white">
            <span style={{ color: COL.velText }}>{A(v)}</span> = <span style={{ color: COL.trainText }}>{A(V)}</span> +{' '}
            <span style={{ color: COL.relText }}>{paren(A(vp))}</span> <span className="text-sm font-normal text-gray-400">{T.ms}</span>
          </p>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className={`lg:col-span-2 space-y-3 ${PANEL}`}>
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{t.modeLabel}</p>
            <Segmented
              label={t.modeLabel}
              className="grid-cols-3"
              value={mode}
              onChange={change(setMode)}
              accent="#fb7185"
              options={[
                { value: 'fwd', label: t.modes.fwd, icon: MoveRight },
                { value: 'sit', label: t.modes.sit, icon: Armchair },
                { value: 'back', label: t.modes.back, icon: MoveLeft },
              ]}
            />
          </div>
          <RangeField id="rel-V" label={t.trainSpeed} symbol="V" min={0} max={30} step={1} value={V} onChange={change(setV)} accent="#818cf8" display={`${A(V)} ${T.ms}`} hint={t.trainHint(A(V * 3.6))} />
          <RangeField
            id="rel-u"
            label={t.walkSpeed}
            symbol="v′"
            min={0}
            max={3}
            step={0.1}
            value={u}
            onChange={change(setU)}
            accent="#fb7185"
            display={`${A(u)} ${T.ms}`}
            hint={t.walkHint}
            disabled={mode === 'sit'}
          />
        </div>
        <div className={`lg:col-span-3 ${PANEL}`}>
          <VectorSum t={t.vectors} dec={dec} V={V} vp={vp} v={v} frame={frame} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- vector diagram */

function VectorSum({ t, dec, V, vp, v, frame }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const H = 176;
  const A = (n) => nfa(n, 1, dec);
  const lo = Math.min(0, V, v);
  const hi = Math.max(0, V, v, 1);
  const pad = 22;
  const s = (W - 2 * pad) / (hi - lo);
  const X = (val) => pad + (val - lo) * s;
  const rows = { train: 42, rel: 88, ground: 146 };
  const arrow = (x1, x2, y, color, bold) => {
    const len = Math.abs(x2 - x1);
    if (len < 1) return <circle cx={x1} cy={y} r={4} fill={color} />;
    const d = Math.sign(x2 - x1);
    const h = Math.min(12, len * 0.7);
    return (
      <g>
        <line x1={x1} x2={x2 - d * (h - 1)} y1={y} y2={y} stroke={color} strokeWidth={bold ? 5 : 3.5} strokeLinecap="round" />
        <path d={`M${x2},${y} L${x2 - d * h},${y - h * 0.55} L${x2 - d * h},${y + h * 0.55} Z`} fill={color} />
      </g>
    );
  };
  const seenGround = frame === 'platform';
  return (
    <div>
      <PanelTitle>{t.title}</PanelTitle>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t.train(A(V))}, ${t.rel(A(vp))}, ${t.ground(A(v))}`} className="block overflow-visible">
          <line x1={X(0)} x2={X(0)} y1={20} y2={H - 12} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 4" />
          <line x1={X(V)} x2={X(V)} y1={rows.train} y2={rows.rel} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 4" />
          <line x1={X(v)} x2={X(v)} y1={rows.rel} y2={rows.ground} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 4" />
          <text x={X(0) + 4} y={rows.train - 12} fontSize="12" fill={COL.trainText} fontWeight="600">
            {t.train(A(V))}
          </text>
          {arrow(X(0), X(V), rows.train, '#818cf8')}
          <text
            x={vp >= 0 ? Math.min(X(V) + 4, W - 6) : Math.max(X(v) - 4, 6)}
            y={rows.rel - 12}
            textAnchor={vp >= 0 ? (X(V) > W * 0.55 ? 'end' : 'start') : X(v) < W * 0.45 ? 'start' : 'end'}
            fontSize="12"
            fill={COL.relText}
            fontWeight="600"
          >
            {t.rel(A(vp))}
          </text>
          {arrow(X(V), X(v), rows.rel, '#f472b6', !seenGround)}
          <text x={X(0) + 4} y={rows.ground - 12} fontSize="12" fill={COL.velText} fontWeight="700">
            {t.ground(A(v))}
          </text>
          {arrow(X(0), X(v), rows.ground, '#34d399', seenGround)}
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-md px-2 py-0.5 font-semibold ${seenGround ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/5 text-gray-500'}`}>v · {t.seenPlatform}</span>
        <span className={`rounded-md px-2 py-0.5 font-semibold ${!seenGround ? 'bg-pink-400/15 text-pink-300' : 'bg-white/5 text-gray-500'}`}>v′ · {t.seenTrain}</span>
      </div>
      <p className="mt-2 text-xs leading-snug text-gray-500">{t.note}</p>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function hash(i) {
  const s = Math.sin(i * 91.7 + 13.3) * 43758.5453;
  return s - Math.floor(s);
}

function AddScene({ t, fr, dec, frame, blend, V, vp, v, dir, mode, time, running, viewW }) {
  const rear = XR0 + V * time;
  const xp = START[mode] + vp * time; // passenger, from the rear of the carriage
  const isP = frame === 'platform';
  const legend = isP
    ? [
        { color: COL.vel, label: t.legend.ground, kind: 'arrow' },
        { color: COL.train, label: t.legend.train, kind: 'arrow' },
        { color: COL.person, label: t.legend.marks, kind: 'ring' },
      ]
    : [
        { color: COL.rel, label: t.legend.rel, kind: 'arrow' },
        { color: COL.platform, label: t.legend.platform, kind: 'arrow' },
        { color: COL.person, label: t.legend.marks, kind: 'ring' },
      ];
  const chips = (
    <>
      <SceneChip icon={isP ? Building2 : TrainFront} strong tone={isP ? '#d97706' : '#4f46e5'}>
        {fr.chip(fr[frame].name)}
      </SceneChip>
      <SceneChip icon={Timer}>{fr.slowChip(fmt(time, 1, dec), SLOW)}</SceneChip>
    </>
  );

  return (
    <ScenePanel height={(W, narrow) => (narrow ? 290 : 372)} ariaLabel={t.sceneLabel(fr[frame].who)} legend={legend} chips={chips}>
      {(W, H, narrow) => {
        const k = W / viewW;
        // heights are drawn exaggerated (only horizontal positions carry the physics)
        const hk = narrow ? Math.max(k * 2.2, 14) : k * 1.8;
        const OBS_X = viewW * 0.42; // m, the observer standing on the platform
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const camX0 = CAM0 + blend * (rear - XR0);
        const X = (m) => (m - camX0) * k;
        const xL = camX0 - 4;
        const xR = camX0 + viewW + 4;

        const railY = H - (narrow ? 74 : 84);
        const wheelR = 0.42 * hk;
        const bodyBottom = railY - 0.95 * hk;
        const bodyH = 3.4 * hk;
        const roofY = bodyBottom - bodyH;
        const floorY = bodyBottom - 0.3 * hk;
        const personH = 1.75 * hk;
        const chestY = floorY - personH * 0.62;
        const rulerY = roofY - 7;
        const platTop = railY + 5;
        const platBot = railY + 20;

        /* cars of the train, in carriage coordinates (passenger's carriage = [0, CAR]) */
        const cars = [
          { x0: -2 * (CAR + 1), x1: -CAR - 2, kind: 'car' },
          { x0: -(CAR + 1), x1: -1, kind: 'car' },
          { x0: 0, x1: CAR, kind: 'mine' },
          { x0: CAR + 1, x1: 2 * CAR + 1, kind: 'car' },
          { x0: 2 * CAR + 2, x1: 2 * CAR + 20, kind: 'loco' },
        ];

        /* ground-fixed scenery */
        const skyline = [];
        for (let i = Math.floor(xL / 7) - 1; i <= Math.ceil(xR / 7); i += 1) {
          const hgt = (2.5 + hash(i) * 4.5) * hk * 0.9;
          skyline.push(<rect key={`sk${i}`} x={X(i * 7)} y={roofY - 14 - hgt * 0.5} width={6.2 * k} height={hgt * 0.5 + (railY - roofY) + 14} fill={hash(i + 7) > 0.5 ? '#e2e8f0' : '#e9eef5'} />);
        }
        const lamps = [];
        for (let i = Math.ceil(xL / 10); i <= Math.floor(xR / 10); i += 1) {
          const lx = X(i * 10);
          lamps.push(
            <g key={`lp${i}`}>
              <line x1={lx} x2={lx} y1={platTop} y2={roofY - 1.1 * hk} stroke="#94a3b8" strokeWidth={2} />
              <rect x={lx - 0.35 * hk} y={roofY - 1.35 * hk} width={0.7 * hk} height={0.3 * hk} rx={2} fill="#94a3b8" />
            </g>,
          );
        }
        const pTicks = [];
        const pEvery = narrow ? 10 : 5;
        for (let i = Math.ceil(xL); i <= Math.floor(xR); i += 1) {
          const tx = X(i);
          const major = i % pEvery === 0;
          if (i % (narrow ? 2 : 1) !== 0 && !major) continue;
          pTicks.push(<line key={`pt${i}`} x1={tx} x2={tx} y1={platBot} y2={platBot + (major ? 8 : 4)} stroke="#92400e" strokeOpacity={major ? 0.9 : 0.45} strokeWidth={major ? 1.4 : 1} />);
          if (major && tx > 8 && tx < W - 10)
            pTicks.push(
              <text key={`pl${i}`} x={tx} y={platBot + 20} textAnchor="middle" fontSize={fs - 1} fill="#92400e" fontWeight={i === 0 ? 700 : 500}>
                {nf(i, 0, dec)}
              </text>,
            );
        }
        const tTicks = [];
        const tEvery = narrow ? 12 : 6;
        for (let i = 0; i <= CAR; i += narrow ? 2 : 1) {
          const tx = X(rear + i);
          const major = i % tEvery === 0;
          tTicks.push(<line key={`tt${i}`} x1={tx} x2={tx} y1={rulerY} y2={rulerY - (major ? 7 : 3.5)} stroke={COL.train} strokeOpacity={major ? 0.95 : 0.6} strokeWidth={major ? 1.4 : 1} />);
          if (major)
            tTicks.push(
              <text key={`tl${i}`} x={tx} y={rulerY - 11} textAnchor="middle" fontSize={fs - 1} fill={COL.train} fontWeight={i === 0 ? 700 : 500}>
                {i}
              </text>,
            );
        }

        /* the passenger's marks every 1 s, in the chosen frame */
        const marks = [];
        for (let s = 0; s <= time + 1e-9; s += 1) marks.push(s);
        const markX = (s) => (isP ? X(XR0 + V * s + START[mode] + vp * s) : X(rear + START[mode] + vp * s));
        const px = X(rear + xp);
        const aK = narrow ? 3.4 : 5.2; // px per m/s, the same for every arrow
        const vShown = isP ? v : vp;
        const vLen = Math.abs(vShown) * aK;
        const vDir = Math.sign(vShown) || 1;
        const pActive = isP;
        const moving = running && Math.abs(vp) > 0.01;

        return (
          <g>
            <defs>
              <linearGradient id="rel-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#eef2ff" />
              </linearGradient>
            </defs>
            <rect width={W} height={H} fill="url(#rel-sky)" />
            {skyline}
            {lamps}

            {/* rails */}
            <rect x={0} y={railY - 2} width={W} height={4} fill="#475569" />
            {Array.from({ length: Math.ceil(viewW / 1.2) + 8 }, (_, i) => {
              const sx = X(Math.floor(xL / 1.2) * 1.2 + i * 1.2);
              return <rect key={`sl${i}`} x={sx} y={railY + 2} width={Math.max(2, 0.35 * k)} height={3} fill="#94a3b8" />;
            })}

            {/* the train */}
            {cars.map((c) => {
              const x0 = X(rear + c.x0);
              const x1 = X(rear + c.x1);
              if (x1 < -20 || x0 > W + 20) return null;
              const mine = c.kind === 'mine';
              const loco = c.kind === 'loco';
              const wins = [];
              if (!loco) for (let wx = 1.3; wx + 2 <= CAR - 1.1; wx += 2.45) wins.push(wx);
              return (
                <g key={c.x0}>
                  {[2.6, 4.3, (c.x1 - c.x0) - 4.3, (c.x1 - c.x0) - 2.6].map((wx) => (
                    <circle key={wx} cx={X(rear + c.x0 + wx)} cy={railY - wheelR} r={wheelR} fill="#334155" stroke="#0f172a" strokeWidth={1} />
                  ))}
                  {loco ? (
                    <path
                      d={`M${x0},${bodyBottom} L${x0},${roofY + 0.2 * hk} Q${x0},${roofY} ${x0 + 0.4 * hk},${roofY} L${x1 - 3.5 * k},${roofY} Q${x1},${roofY} ${x1},${roofY + bodyH * 0.55} L${x1},${bodyBottom} Z`}
                      fill="#eef2ff"
                      stroke="#334155"
                      strokeWidth={1.6}
                    />
                  ) : (
                    <rect x={x0} y={roofY} width={x1 - x0} height={bodyH} rx={Math.min(10, 0.6 * hk)} fill={mine ? '#f8fafc' : '#f1f5f9'} stroke="#334155" strokeWidth={mine ? 1.8 : 1.3} />
                  )}
                  <rect x={x0 + 1} y={bodyBottom - 0.55 * hk} width={x1 - x0 - 2} height={0.26 * hk} fill={COL.train} opacity={mine ? 0.9 : 0.55} />
                  {wins.map((wx) => (
                    <rect key={wx} x={X(rear + c.x0 + wx)} y={roofY + 0.55 * hk} width={2.0 * k} height={1.25 * hk} rx={Math.min(4, 0.25 * hk)} fill="#e0f2fe" stroke="#7dd3fc" strokeWidth={1} />
                  ))}
                  {loco && <rect x={x1 - 3.2 * k} y={roofY + 0.55 * hk} width={2.2 * k} height={1.1 * hk} rx={3} fill="#e0f2fe" stroke="#7dd3fc" />}
                  {mine && <line x1={x0 + 4} x2={x1 - 4} y1={floorY} y2={floorY} stroke="#cbd5e1" strokeWidth={1.5} />}
                </g>
              );
            })}

            {/* the observer sitting in the carriage */}
            <rect x={X(rear + SEAT_X) - 0.45 * hk} y={floorY - 0.5 * hk} width={0.9 * hk} height={0.5 * hk} rx={2} fill="#c7d2fe" />
            <Person x={X(rear + SEAT_X)} floor={floorY} h={personH} facing={1} color={COL.train} pose="sit" />
            {!pActive && <circle cx={X(rear + SEAT_X) + 0.1 * hk} cy={floorY - personH * 0.62} r={personH * 0.62} fill="none" stroke={COL.train} strokeWidth={2} strokeDasharray="4 3" />}

            {/* platform and its ruler */}
            <rect x={0} y={platTop} width={W} height={platBot - platTop} fill="#e5e7eb" />
            <rect x={0} y={platTop} width={W} height={3} fill="#facc15" />
            <rect x={0} y={platBot} width={W} height={H - platBot} fill="#f8fafc" />
            <g opacity={pActive ? 1 : 0.5}>
              {pTicks}
              <line x1={0} x2={W} y1={platBot} y2={platBot} stroke="#92400e" strokeWidth={pActive ? 2 : 1} />
            </g>
            <text x={W - 6} y={platBot + (narrow ? 34 : 36)} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#92400e" opacity={pActive ? 1 : 0.6}>
              {t.axisPlatform}
            </text>

            {/* the observer standing on the platform */}
            <Person x={X(OBS_X)} floor={platTop + 6} h={personH * 0.95} facing={1} color={COL.platform} />
            {pActive && <circle cx={X(OBS_X)} cy={platTop + 6 - personH * 0.5} r={personH * 0.62} fill="none" stroke={COL.platform} strokeWidth={2} strokeDasharray="4 3" />}

            {/* the carriage axis on the roof */}
            <g opacity={pActive ? 0.5 : 1}>
              <line x1={X(rear)} x2={X(rear + CAR)} y1={rulerY} y2={rulerY} stroke={COL.train} strokeWidth={pActive ? 1 : 2} />
              {tTicks}
              <text x={X(rear) - 6} y={rulerY + 4} textAnchor="end" fontSize={fs} fontWeight="700" fill={COL.train}>
                O′
              </text>
            </g>

            {/* marks every second, in the chosen frame */}
            {time > 0 && <line x1={markX(0)} x2={px} y1={chestY} y2={chestY} stroke={COL.person} strokeOpacity="0.5" strokeWidth={2.4} strokeDasharray="1 5" strokeLinecap="round" />}
            {marks.map((s) => (
              <circle key={s} cx={markX(s)} cy={chestY} r={narrow ? 2.8 : 3.4} fill="#fff" stroke={COL.person} strokeWidth={1.8} />
            ))}

            {/* the passenger */}
            {mode === 'sit' ? (
              <g>
                <rect x={px - 0.45 * hk} y={floorY - 0.5 * hk} width={0.9 * hk} height={0.5 * hk} rx={2} fill="#fecdd3" />
                <Person x={px} floor={floorY} h={personH} facing={1} color={COL.person} pose="sit" />
              </g>
            ) : (
              <Person x={px} floor={floorY} h={personH} facing={dir || 1} phase={(Math.abs(vp) * time) / 0.7} moving={moving} color={COL.person} />
            )}
            <line x1={px} x2={px} y1={rulerY + 1} y2={floorY - personH} stroke={COL.train} strokeWidth={1.2} strokeDasharray="3 3" opacity={pActive ? 0.4 : 0.9} />
            <line x1={px} x2={px} y1={floorY + 1} y2={platBot} stroke={COL.platform} strokeWidth={1.2} strokeDasharray="3 3" opacity={pActive ? 0.9 : 0.4} />

            {/* velocities */}
            {vLen > 0.5 && (
              <Arrowish x={px + vDir * 0.45 * hk} y={chestY - personH * 0.3} len={Math.max(vLen, 7)} dir={vDir} color={isP ? COL.vel : COL.rel} />
            )}
            {isP && V > 0.05 && (
              <Arrowish x={X(rear + 2 * CAR + 20) + 6} y={roofY + bodyH * 0.5} len={V * aK} dir={1} color={COL.train} />
            )}
            {!isP && V > 0.05 && <Arrowish x={W * 0.6} y={(platTop + platBot) / 2 + 1} len={V * aK} dir={-1} color={COL.platform} />}

            {/* value tags */}
            <Pill
              x={px + vDir * (0.45 * hk + Math.max(vLen, 7) + (narrow ? 36 : 44))}
              y={chestY - personH * 0.3}
              text={isP ? t.vTag(nfa(v, 1, dec)) : t.vpTag(nfa(vp, 1, dec))}
              bg={isP ? COL.vel : COL.rel}
              size={fs - 1}
              box={box}
            />
            {isP && V > 0.05 && X(rear + 2 * CAR + 20) < W - 40 && (
              <Pill x={X(rear + 2 * CAR + 20) + 6 + V * aK + 46} y={roofY + bodyH * 0.5} text={t.VTag(nfa(V, 1, dec))} bg="#fff" color={COL.train} border="#c7d2fe" size={fs - 1} box={box} />
            )}
            {!isP && V > 0.05 && (
              <Pill x={W * 0.6 - V * aK - (narrow ? 44 : 54)} y={(platTop + platBot) / 2 + 1} text={t.platTag(nfa(-V, 1, dec))} bg="#fff" color="#b45309" border="#fcd34d" size={fs - 1} box={box} />
            )}
            <text x={X(OBS_X)} y={platTop + 6 - personH * 1.15} textAnchor="middle" fontSize={fs - 1} fontWeight="600" fill={COL.platform} stroke="#fff" strokeWidth="3" paintOrder="stroke" opacity={pActive ? 1 : 0.6}>
              {t.observer}
            </text>
          </g>
        );
      }}
    </ScenePanel>
  );
}

function Arrowish({ x, y, len, dir, color }) {
  const h = Math.min(10, len * 0.7);
  return (
    <g>
      <line x1={x} x2={x + dir * (len - h + 1)} y1={y} y2={y} stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d={`M${x + dir * len},${y} l${-dir * h},${-h * 0.55} l0,${h * 1.1} Z`} fill={color} />
    </g>
  );
}
