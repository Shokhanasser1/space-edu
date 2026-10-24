import { MoveHorizontal, Scale, Waves } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { useSimText } from '../kit/lang';
import { rich } from './MassDensity.parts';
import CartsSim from './MassDensity.carts';
import BalanceSim from './MassDensity.balance';
import FloatSim from './MassDensity.float';

/**
 * Lesson "Mass. Density" (Massa. Zichlik).
 *
 *   carts   - mass as the measure of inertia: a compressed spring pushes two
 *             carts apart with equal forces; the lighter one gets the larger
 *             speed, v₁/v₂ = m₂/m₁ (m₁v₁ = m₂v₂); an "unknown mass" preset
 *             finds m₂ from the speeds. Preset 1 kg + 2 kg, k = 600 N/m,
 *             x = 3 cm: F = 18 N, v₁ = 0.60 m/s, v₂ = 0.30 m/s.
 *   density - ρ = m/V on a pan balance: equal volumes (1 dm³ of aluminium
 *             2.70 kg vs iron 7.80 kg) or equal masses (V = m/ρ), with the
 *             m–V graph.
 *   float   - float or sink: ρ < ρ_liquid floats with ρ/ρ_liquid of the
 *             volume submerged (ice in water 0.90), otherwise sinks.
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
      slower: (k) => `Vaqt ${k} marta sekinlashtirilgan`,
      cell: (c) => `1 katak = ${c}`,
    },
    u: { kg: 'kg', g: 'g', kgms: 'kg·m/s', cm: 'sm', cm3: 'sm³', m3: 'm³', n: 'N', nm: 'N/m', kgm3: 'kg/m³', gcm3: 'g/sm³' },
    card: {
      eyebrow: 'Virtual laboratoriya · Dinamika',
      title: 'Massa. Zichlik',
      tabsLabel: 'Simulyatorni tanlang',
      tabs: {
        carts: { label: 'Massa va inertlik', sub: 'm₁v₁ = m₂v₂' },
        density: { label: 'Zichlik', sub: 'ρ = m/V' },
        float: { label: "Suzish va cho'kish", sub: 'Muz nega suzadi?' },
      },
    },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: 'Massa m', text: "jismning inertlik o'lchovi. SI birligi — kilogramm (kg); 1 t = 1000 kg, 1 g = 0.001 kg." },
        {
          term: "O'zaro ta'sir",
          text: "ikki jism o'zaro ta'sirlashganda tezliklari massalariga teskari proporsional o'zgaradi: m₁/m₂ = Δv₂/Δv₁. Yengil jism ko'proq tezlik oladi.",
        },
        { term: 'Zichlik ρ', text: 'birlik hajmdagi modda massasi: ρ = m/V. Birligi kg/m³; 1 g/sm³ = 1000 kg/m³ (suvniki — 1000 kg/m³).' },
        {
          term: 'Suzish sharti',
          text: "ρ_jism < ρ_suyuqlik bo'lsa jism suzadi va hajmining ρ_jism/ρ_suyuqlik qismi botadi; ρ_jism > ρ_suyuqlik bo'lsa cho'kadi.",
        },
      ],
    },
    carts: {
      presetsLabel: 'Aravachalar massasi',
      presets: {
        equal: { name: 'Teng massalar', sub: '1 kg + 1 kg' },
        double: { name: "Ikki marta og'ir", sub: '1 kg + 2 kg' },
        four: { name: "To'rt marta og'ir", sub: '1 kg + 4 kg' },
        unknown: { name: "Noma'lum massa", sub: '1 kg + ? kg' },
      },
      cut: 'Ipni kesish',
      legend: { cart1: '1-aravacha', cart2: '2-aravacha', force: 'prujina kuchi F', vel: 'tezlik v', marks: (dt) => `har ${dt} s dagi o'rni` },
      sceneLabel: (m1, m2, v1, v2) => `Yon tomondan ko'rinish: ikki aravacha va siqilgan prujina. m₁ = ${m1}, m₂ = ${m2}, v₁ = ${v1} m/s, v₂ = ${v2} m/s.`,
      readouts: { v1: '1-aravacha tezligi', v2: '2-aravacha tezligi', ratio: 'Tezliklar nisbati', mv: 'Massa × tezlik' },
      m1: '1-aravacha massasi',
      m2: '2-aravacha massasi',
      massHint: "Bo'sh aravacha 0.5 kg, har bir yuk 0.5 kg",
      unknownNote: "yuk yopib qo'yilgan. Tezliklarni o'lchang va massani hisoblang.",
      x: 'Prujinaning siqilishi',
      xHint: (F) => `k = 600 N/m, boshlang'ich kuch F = kx = ${F} N`,
      calc: {
        title: 'Hisoblash',
        note: "Ishqalanish hisobga olinmaydi. Prujina ikkala aravachaga bir xil kuch bilan, bir xil vaqt davomida ta'sir qiladi — shuning uchun m₁v₁ = m₂v₂.",
      },
      runs: { title: 'Tajriba natijalari', empty: 'Ipni kesing — har bir tajriba natijasi shu jadvalga yoziladi.' },
      axis: 'x, m',
      vTag: (i, v) => `v_${i} = ${v} m/s`,
      mTag: (i, m) => `m_${i} = ${m}`,
      fTag: (F) => `F = kx = ${F} N`,
      sTag: (i, s) => `s_${i} = ${s} m`,
      explain: {
        idle: (x, F) =>
          `Ip aravachalarni bog'lab turibdi, orasidagi prujina ${x} sm ga siqilgan va ikkala aravachani bir xil kuch bilan itaradi: F = kx = ${F} N. «Ipni kesish»ni bosing — qaysi aravacha tezroq ketadi?`,
        runEqual: (v) => `Massalar teng — bir xil kuch ikkala aravachaga bir xil tezlik berdi: v₁ = v₂ = ${v} m/s.`,
        run2: (k, v1, v2) =>
          `2-aravacha ${k} marta og'ir — u ${k} marta kichik tezlik oldi: v₁ = ${v1} m/s, v₂ = ${v2} m/s. Massasi katta jismning tezligini o'zgartirish qiyinroq — u inertroq.`,
        run1: (k, v1, v2) =>
          `1-aravacha ${k} marta og'ir — u ${k} marta kichik tezlik oldi: v₁ = ${v1} m/s, v₂ = ${v2} m/s. Massasi katta jismning tezligini o'zgartirish qiyinroq — u inertroq.`,
        runUnknown: (v1, v2) => `2-aravachaning massasi noma'lum. Tezliklarni solishtiring: v₁ = ${v1} m/s, v₂ = ${v2} m/s. Qaysi aravacha og'irroq va necha marta?`,
        done: (t, s1, s2, r) =>
          `Bir xil t = ${t} s vaqtda 1-aravacha s₁ = ${s1} m, 2-aravacha s₂ = ${s2} m yo'l bosdi: s₁/s₂ = v₁/v₂ = m₂/m₁ = ${r}. Prujinani ko'proq siqsangiz, tezliklar ortadi, ammo ularning nisbati o'zgarmaydi.`,
        doneUnknown: (r, m1, m2) =>
          `v₁/v₂ = ${r}, demak m₂ = m₁·v₁/v₂ = ${m1} kg · ${r} = ${m2} kg. Massalar shunday taqqoslanadi: noma'lum massa ma'lum (etalon) massa bilan o'zaro ta'sir orqali topiladi.`,
      },
    },
    density: {
      modeLabel: 'Tajriba',
      modes: {
        vol: { name: 'Teng hajmlar', sub: "V₁ = V₂ → massa zichlikka bog'liq" },
        mass: { name: 'Teng massalar', sub: "m₁ = m₂ → hajm zichlikka bog'liq" },
      },
      edge: 'Kub qirrasi',
      edgeHint: (V, m3) => `V = a³ = ${V} = ${m3} m³`,
      mass: 'Har bir kubning massasi',
      massHint: "Ikkala kosaga massasi bir xil kublar qo'yiladi",
      mats: {
        cork: "Po'kak",
        oak: "Eman yog'ochi",
        ice: 'Muz',
        water: 'Suv',
        glass: 'Shisha',
        al: 'Alyuminiy',
        iron: 'Temir',
        copper: 'Mis',
        lead: "Qo'rg'oshin",
        gold: 'Oltin',
      },
      sides: { left: 'Chap kosadagi kub', right: "O'ng kosadagi kub", leftShort: 'Chap kub', rightShort: "O'ng kub" },
      legend: { mass: 'massa m', vol: 'hajm V', pointer: "ko'rsatkich og'ir tomonga og'adi" },
      verdict: { level: 'Muvozanat', right: "O'ng kosa og'irroq", left: "Chap kosa og'irroq" },
      sceneLabel: (n1, m1, V1, n2, m2, V2, v) => `Ikki kosali tarozi. Chap kosada ${n1}: m = ${m1}, V = ${V1}. O'ng kosada ${n2}: m = ${m2}, V = ${V2}. ${v}.`,
      readouts: {
        massRatio: 'Massalar nisbati',
        massRatioSub: 'm₂/m₁ = ρ₂/ρ₁, chunki V₁ = V₂',
        volRatio: 'Hajmlar nisbati',
        volRatioSub: 'V₁/V₂ = ρ₂/ρ₁, chunki m₁ = m₂',
        balance: 'Tarozi',
      },
      pickLeft: 'Chap kosadagi kub moddasi',
      pickRight: "O'ng kosadagi kub moddasi",
      calc: { title: 'Hisoblash', note: '1 g/sm³ = 1000 kg/m³, chunki 1 g = 0.001 kg va 1 sm³ = 0.000001 m³.' },
      graph: {
        title: 'm–V grafigi',
        label: "Massaning hajmga bog'liqlik grafigi",
        noteVol: "Har bir modda — koordinata boshidan chiqqan to'g'ri chiziq: m = ρV. Chiziq qanchalik tik bo'lsa, zichlik shuncha katta.",
        noteMass: 'Massalar teng — nuqtalar bitta gorizontal chiziqda. Zichligi kichik moddaning hajmi katta: V = m/ρ.',
      },
      mTag: (i, m) => `m_${i} = ${m}`,
      vTag: (i, v) => `V_${i} = ${v}`,
      explain: {
        volDiff: (V, cube, name, rho, k) =>
          `Hajmlar teng: V = ${V}. ${cube} (${name}, ρ = ${rho} kg/m³) ${k} marta og'ir: m = ρV, demak teng hajmda zichligi katta moddaning massasi katta.`,
        volSame: 'Ikkala kub bir xil moddadan va hajmlari teng — massalari ham teng, tarozi muvozanatda.',
        massDiff: (m, cube, name, k) =>
          `Massalar teng (${m}), tarozi muvozanatda. ${cube} (${name}) esa ${k} marta katta hajmni egallaydi: V = m/ρ — zichligi kichik modda ko'proq joy oladi.`,
        massSame: 'Modda ham, massa ham bir xil — hajmlar ham teng.',
        litre: '1 litr (1 dm³) suvning massasi 1 kg — shuning uchun suvning zichligi 1000 kg/m³ = 1 g/sm³.',
        iceWater: 'Muz suvdan yengil — shuning uchun u suvda suzadi.',
      },
    },
    float: {
      liquidLabel: 'Suyuqlik',
      drop: 'Tashlash',
      again: 'Yana tashlash',
      liquids: {
        water: { name: 'Toza suv', loc: 'toza suvda' },
        sea: { name: 'Dengiz suvi', loc: 'dengiz suvida' },
        oil: { name: "Kungaboqar yog'i", loc: "kungaboqar yog'ida" },
        kerosene: { name: 'Kerosin', loc: 'kerosinda' },
        mercury: { name: 'Simob', loc: 'simobda' },
      },
      bodies: {
        cork: "Po'kak",
        oak: "Eman yog'ochi",
        ice: 'Muz',
        plexi: 'Organik shisha',
        glass: 'Shisha',
        al: 'Alyuminiy',
        iron: 'Temir',
        copper: 'Mis',
        lead: "Qo'rg'oshin",
        gold: 'Oltin',
      },
      legend: { liquid: (n) => `suyuqlik: ${n}`, under: 'botgan qism', above: 'suyuqlik ustidagi qism' },
      sceneLabel: (b, rb, l, rl, p) =>
        `Yon tomondan ko'rinish: suyuqlikli idish. Jism — ${b} (${rb} kg/m³), suyuqlik — ${l} (${rl} kg/m³). Jism hajmining ${p} foizi suyuqlik ichida.`,
      sym: { body: 'ρ_j', liquid: 'ρ_s' },
      readouts: {
        body: 'Jism zichligi',
        liquid: 'Suyuqlik zichligi',
        result: 'Natija',
        share: 'Botgan qism',
        lessSub: 'ρ_j < ρ_s',
        moreSub: 'ρ_j > ρ_s',
        guess: 'Taxmin qiling!',
        shareSub: (f) => `V_botgan/V = ρ_j/ρ_s = ${f}`,
        shareHint: 'hajmning suyuqlik ichidagi qismi',
      },
      floats: 'Suzadi',
      sinks: "Cho'kadi",
      floatsShort: 'suzadi',
      sinksShort: "cho'kadi",
      bodyLabel: 'Jism moddasi',
      size: 'Kub qirrasi',
      sizeHint: "Kubning o'lchami natijaga ta'sir qilmaydi — suzish faqat zichliklarga bog'liq.",
      underTag: (p) => `botgan: ${p}`,
      aboveTag: (p) => `ustida: ${p}`,
      sunkTag: "cho'kdi: ρ_j > ρ_s",
      bodyTag: (n, r) => `${n} · ρ = ${r} kg/m³`,
      liqTag: (n, r) => `${n} · ρ = ${r} kg/m³`,
      ruler: {
        title: 'Zichliklarni solishtiring',
        label: (rb, rl) => `Zichlik shkalasi: jism ${rb}, suyuqlik ${rl} kg/m³`,
        floats: '← suzadi',
        sinks: "cho'kadi →",
        body: (r) => `jism ${r}`,
        liquid: (r) => `suyuqlik ${r} kg/m³`,
        note: "Shkala logarifmik: 100–1000 va 1000–10 000 kg/m³ oraliqlari teng ko'rinadi. Oq chiziqchalar — ro'yxatdagi boshqa moddalar.",
      },
      explain: {
        idle: (b, rb, l, rl) => `Jism — ${b} (ρ = ${rb} kg/m³), suyuqlik — ${l} (ρ = ${rl} kg/m³). Jism suzadimi yoki cho'kadimi? Taxmin qiling va «Tashlash»ni bosing.`,
        moving: (rb, rl) => `Jism suyuqlikka tushdi. Zichliklarni solishtiring: ρ_jism = ${rb} kg/m³, ρ_suyuqlik = ${rl} kg/m³.`,
        float: (b, loc, rb, rl, f, p) =>
          `${b} ${loc} suzadi: ρ_jism = ${rb} < ρ_suyuqlik = ${rl} kg/m³. Hajmining ρ_jism/ρ_suyuqlik = ${f} qismi, ya'ni ${p} foizi suyuqlik ichida.`,
        sink: (b, loc, rb, rl) => `${b} ${loc} cho'kadi: ρ_jism = ${rb} > ρ_suyuqlik = ${rl} kg/m³ — jism suyuqlikdan zichroq.`,
        iceberg: "Aysberglar ham shunday suzadi: ularning taxminan 1/10 qismigina suv ustida ko'rinadi.",
        metal: "Og'ir metall ham o'zidan zichroq suyuqlikda suzadi!",
        wouldFloat: "Suvda esa u suzar edi: natija suyuqlikka bog'liq.",
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
      slower: (k) => `Время замедлено в ${k} раза`,
      cell: (c) => `1 клетка = ${c}`,
    },
    u: { kg: 'кг', g: 'г', kgms: 'кг·м/с', cm: 'см', cm3: 'см³', m3: 'м³', n: 'Н', nm: 'Н/м', kgm3: 'кг/м³', gcm3: 'г/см³' },
    card: {
      eyebrow: 'Виртуальная лаборатория · Динамика',
      title: 'Масса. Плотность',
      tabsLabel: 'Выберите симулятор',
      tabs: {
        carts: { label: 'Масса и инертность', sub: 'm₁v₁ = m₂v₂' },
        density: { label: 'Плотность', sub: 'ρ = m/V' },
        float: { label: 'Плавание тел', sub: 'Почему лёд плавает?' },
      },
    },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Масса m', text: 'мера инертности тела. Единица СИ — килограмм (кг); 1 т = 1000 кг, 1 г = 0,001 кг.' },
        { term: 'Взаимодействие', text: 'при взаимодействии двух тел их скорости меняются обратно пропорционально массам: m₁/m₂ = Δv₂/Δv₁. Лёгкое тело получает большую скорость.' },
        { term: 'Плотность ρ', text: 'масса вещества в единице объёма: ρ = m/V. Единица — кг/м³; 1 г/см³ = 1000 кг/м³ (у воды — 1000 кг/м³).' },
        { term: 'Условие плавания', text: 'если ρ_тела < ρ_жидкости, тело плавает, погрузившись на долю ρ_тела/ρ_жидкости объёма; если ρ_тела > ρ_жидкости — тонет.' },
      ],
    },
    carts: {
      presetsLabel: 'Массы тележек',
      presets: {
        equal: { name: 'Равные массы', sub: '1 кг + 1 кг' },
        double: { name: 'Вдвое тяжелее', sub: '1 кг + 2 кг' },
        four: { name: 'Вчетверо тяжелее', sub: '1 кг + 4 кг' },
        unknown: { name: 'Неизвестная масса', sub: '1 кг + ? кг' },
      },
      cut: 'Перерезать нить',
      legend: { cart1: '1-я тележка', cart2: '2-я тележка', force: 'сила пружины F', vel: 'скорость v', marks: (dt) => `положение через каждые ${dt} с` },
      sceneLabel: (m1, m2, v1, v2) => `Вид сбоку: две тележки и сжатая пружина. m₁ = ${m1}, m₂ = ${m2}, v₁ = ${v1} м/с, v₂ = ${v2} м/с.`,
      readouts: { v1: 'Скорость 1-й тележки', v2: 'Скорость 2-й тележки', ratio: 'Отношение скоростей', mv: 'Масса × скорость' },
      m1: 'Масса 1-й тележки',
      m2: 'Масса 2-й тележки',
      massHint: 'Пустая тележка — 0,5 кг, каждый груз — 0,5 кг',
      unknownNote: 'груз закрыт. Измерьте скорости и вычислите массу.',
      x: 'Сжатие пружины',
      xHint: (F) => `k = 600 Н/м, начальная сила F = kx = ${F} Н`,
      calc: {
        title: 'Расчёт',
        note: 'Трение не учитываем. Пружина действует на обе тележки с одинаковой силой в течение одного и того же времени — поэтому m₁v₁ = m₂v₂.',
      },
      runs: { title: 'Результаты опытов', empty: 'Перережьте нить — результат каждого опыта появится в этой таблице.' },
      axis: 'x, м',
      vTag: (i, v) => `v_${i} = ${v} м/с`,
      mTag: (i, m) => `m_${i} = ${m}`,
      fTag: (F) => `F = kx = ${F} Н`,
      sTag: (i, s) => `s_${i} = ${s} м`,
      explain: {
        idle: (x, F) =>
          `Нить удерживает тележки, пружина между ними сжата на ${x} см и давит на обе тележки с одинаковой силой: F = kx = ${F} Н. Нажмите «Перерезать нить» — какая тележка поедет быстрее?`,
        runEqual: (v) => `Массы равны — одинаковая сила сообщила обеим тележкам одинаковую скорость: v₁ = v₂ = ${v} м/с.`,
        run2: (k, v1, v2) =>
          `2-я тележка в ${k} раза тяжелее — она получила в ${k} раза меньшую скорость: v₁ = ${v1} м/с, v₂ = ${v2} м/с. Скорость более массивного тела изменить труднее — оно инертнее.`,
        run1: (k, v1, v2) =>
          `1-я тележка в ${k} раза тяжелее — она получила в ${k} раза меньшую скорость: v₁ = ${v1} м/с, v₂ = ${v2} м/с. Скорость более массивного тела изменить труднее — оно инертнее.`,
        runUnknown: (v1, v2) => `Масса 2-й тележки неизвестна. Сравните скорости: v₁ = ${v1} м/с, v₂ = ${v2} м/с. Какая тележка тяжелее и во сколько раз?`,
        done: (t, s1, s2, r) =>
          `За одно и то же время t = ${t} с 1-я тележка прошла s₁ = ${s1} м, 2-я — s₂ = ${s2} м: s₁/s₂ = v₁/v₂ = m₂/m₁ = ${r}. Если сжать пружину сильнее, скорости вырастут, но их отношение не изменится.`,
        doneUnknown: (r, m1, m2) =>
          `v₁/v₂ = ${r}, значит m₂ = m₁·v₁/v₂ = ${m1} кг · ${r} = ${m2} кг. Так и сравнивают массы: неизвестную массу находят по взаимодействию с известной (эталоном).`,
      },
    },
    density: {
      modeLabel: 'Опыт',
      modes: {
        vol: { name: 'Равные объёмы', sub: 'V₁ = V₂ → масса зависит от плотности' },
        mass: { name: 'Равные массы', sub: 'm₁ = m₂ → объём зависит от плотности' },
      },
      edge: 'Ребро кубика',
      edgeHint: (V, m3) => `V = a³ = ${V} = ${m3} м³`,
      mass: 'Масса каждого кубика',
      massHint: 'На обе чаши кладут кубики одинаковой массы',
      mats: {
        cork: 'Пробка',
        oak: 'Дуб',
        ice: 'Лёд',
        water: 'Вода',
        glass: 'Стекло',
        al: 'Алюминий',
        iron: 'Железо',
        copper: 'Медь',
        lead: 'Свинец',
        gold: 'Золото',
      },
      sides: { left: 'Кубик на левой чаше', right: 'Кубик на правой чаше', leftShort: 'Левый кубик', rightShort: 'Правый кубик' },
      legend: { mass: 'масса m', vol: 'объём V', pointer: 'стрелка отклоняется к тяжёлой чаше' },
      verdict: { level: 'Равновесие', right: 'Правая чаша тяжелее', left: 'Левая чаша тяжелее' },
      sceneLabel: (n1, m1, V1, n2, m2, V2, v) => `Рычажные весы. На левой чаше ${n1}: m = ${m1}, V = ${V1}. На правой чаше ${n2}: m = ${m2}, V = ${V2}. ${v}.`,
      readouts: {
        massRatio: 'Отношение масс',
        massRatioSub: 'm₂/m₁ = ρ₂/ρ₁, так как V₁ = V₂',
        volRatio: 'Отношение объёмов',
        volRatioSub: 'V₁/V₂ = ρ₂/ρ₁, так как m₁ = m₂',
        balance: 'Весы',
      },
      pickLeft: 'Вещество кубика на левой чаше',
      pickRight: 'Вещество кубика на правой чаше',
      calc: { title: 'Расчёт', note: '1 г/см³ = 1000 кг/м³, так как 1 г = 0,001 кг и 1 см³ = 0,000001 м³.' },
      graph: {
        title: 'График m–V',
        label: 'График зависимости массы от объёма',
        noteVol: 'Каждое вещество — прямая из начала координат: m = ρV. Чем круче прямая, тем больше плотность.',
        noteMass: 'Массы равны — точки на одной горизонтали. У вещества с меньшей плотностью объём больше: V = m/ρ.',
      },
      mTag: (i, m) => `m_${i} = ${m}`,
      vTag: (i, v) => `V_${i} = ${v}`,
      explain: {
        volDiff: (V, cube, name, rho, k) =>
          `Объёмы равны: V = ${V}. ${cube} (${name}, ρ = ${rho} кг/м³) тяжелее в ${k} раза: m = ρV, значит, при равных объёмах масса больше у вещества с большей плотностью.`,
        volSame: 'Оба кубика из одного вещества и одного объёма — массы равны, весы в равновесии.',
        massDiff: (m, cube, name, k) =>
          `Массы равны (${m}), весы в равновесии. ${cube} (${name}) при этом занимает в ${k} раза больший объём: V = m/ρ — вещество с меньшей плотностью занимает больше места.`,
        massSame: 'Вещество и масса одинаковы — объёмы тоже равны.',
        litre: '1 литр (1 дм³) воды имеет массу 1 кг — поэтому плотность воды 1000 кг/м³ = 1 г/см³.',
        iceWater: 'Лёд легче воды того же объёма — поэтому он плавает.',
      },
    },
    float: {
      liquidLabel: 'Жидкость',
      drop: 'Отпустить',
      again: 'Ещё раз',
      liquids: {
        water: { name: 'Пресная вода', loc: 'в пресной воде' },
        sea: { name: 'Морская вода', loc: 'в морской воде' },
        oil: { name: 'Подсолнечное масло', loc: 'в подсолнечном масле' },
        kerosene: { name: 'Керосин', loc: 'в керосине' },
        mercury: { name: 'Ртуть', loc: 'в ртути' },
      },
      bodies: {
        cork: 'Пробка',
        oak: 'Дуб',
        ice: 'Лёд',
        plexi: 'Оргстекло',
        glass: 'Стекло',
        al: 'Алюминий',
        iron: 'Железо',
        copper: 'Медь',
        lead: 'Свинец',
        gold: 'Золото',
      },
      legend: { liquid: (n) => `жидкость: ${n}`, under: 'погружённая часть', above: 'часть над жидкостью' },
      sceneLabel: (b, rb, l, rl, p) => `Вид сбоку: сосуд с жидкостью. Тело — ${b} (${rb} кг/м³), жидкость — ${l} (${rl} кг/м³). В жидкость погружено ${p}% объёма тела.`,
      sym: { body: 'ρ_т', liquid: 'ρ_ж' },
      readouts: {
        body: 'Плотность тела',
        liquid: 'Плотность жидкости',
        result: 'Результат',
        share: 'Погружённая часть',
        lessSub: 'ρ_т < ρ_ж',
        moreSub: 'ρ_т > ρ_ж',
        guess: 'Сделайте предположение!',
        shareSub: (f) => `V_погр/V = ρ_т/ρ_ж = ${f}`,
        shareHint: 'доля объёма в жидкости',
      },
      floats: 'Плавает',
      sinks: 'Тонет',
      floatsShort: 'плавает',
      sinksShort: 'тонет',
      bodyLabel: 'Вещество тела',
      size: 'Ребро кубика',
      sizeHint: 'Размер кубика на результат не влияет — плавание зависит только от плотностей.',
      underTag: (p) => `в жидкости: ${p}`,
      aboveTag: (p) => `над ней: ${p}`,
      sunkTag: 'утонул: ρ_т > ρ_ж',
      bodyTag: (n, r) => `${n} · ρ = ${r} кг/м³`,
      liqTag: (n, r) => `${n} · ρ = ${r} кг/м³`,
      ruler: {
        title: 'Сравните плотности',
        label: (rb, rl) => `Шкала плотностей: тело ${rb}, жидкость ${rl} кг/м³`,
        floats: '← плавает',
        sinks: 'тонет →',
        body: (r) => `тело ${r}`,
        liquid: (r) => `жидкость ${r} кг/м³`,
        note: 'Шкала логарифмическая: промежутки 100–1000 и 1000–10 000 кг/м³ одинаковы. Белые штрихи — другие вещества из списка.',
      },
      explain: {
        idle: (b, rb, l, rl) => `Тело — ${b} (ρ = ${rb} кг/м³), жидкость — ${l} (ρ = ${rl} кг/м³). Утонет тело или будет плавать? Сделайте предположение и нажмите «Отпустить».`,
        moving: (rb, rl) => `Тело попало в жидкость. Сравните плотности: ρ_тела = ${rb} кг/м³, ρ_жидкости = ${rl} кг/м³.`,
        float: (b, loc, rb, rl, f, p) =>
          `${b} плавает ${loc}: ρ_тела = ${rb} < ρ_жидкости = ${rl} кг/м³. Погружена доля ρ_тела/ρ_жидкости = ${f} объёма, то есть ${p}%.`,
        sink: (b, loc, rb, rl) => `${b} тонет ${loc}: ρ_тела = ${rb} > ρ_жидкости = ${rl} кг/м³ — тело плотнее жидкости.`,
        iceberg: 'Так же плавают айсберги: над водой видна лишь примерно 1/10 их объёма.',
        metal: 'Даже тяжёлый металл плавает в жидкости, которая плотнее его!',
        wouldFloat: 'А в воде оно бы плавало: результат зависит от жидкости.',
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
      slower: (k) => `Time slowed ${k}×`,
      cell: (c) => `1 square = ${c}`,
    },
    u: { kg: 'kg', g: 'g', kgms: 'kg·m/s', cm: 'cm', cm3: 'cm³', m3: 'm³', n: 'N', nm: 'N/m', kgm3: 'kg/m³', gcm3: 'g/cm³' },
    card: {
      eyebrow: 'Virtual laboratory · Dynamics',
      title: 'Mass. Density',
      tabsLabel: 'Choose a simulator',
      tabs: {
        carts: { label: 'Mass and inertia', sub: 'm₁v₁ = m₂v₂' },
        density: { label: 'Density', sub: 'ρ = m/V' },
        float: { label: 'Float or sink', sub: 'Why does ice float?' },
      },
    },
    facts: {
      title: 'Remember',
      items: [
        { term: 'Mass m', text: "a measure of a body's inertia. SI unit — the kilogram (kg); 1 t = 1000 kg, 1 g = 0.001 kg." },
        { term: 'Interaction', text: 'when two bodies interact, their speeds change in inverse proportion to their masses: m₁/m₂ = Δv₂/Δv₁. The lighter body gets the larger speed.' },
        { term: 'Density ρ', text: 'mass per unit volume: ρ = m/V. Unit — kg/m³; 1 g/cm³ = 1000 kg/m³ (water: 1000 kg/m³).' },
        { term: 'Floating', text: 'if ρ_body < ρ_liquid the body floats with the share ρ_body/ρ_liquid of its volume submerged; if ρ_body > ρ_liquid it sinks.' },
      ],
    },
    carts: {
      presetsLabel: 'Cart masses',
      presets: {
        equal: { name: 'Equal masses', sub: '1 kg + 1 kg' },
        double: { name: 'Twice as heavy', sub: '1 kg + 2 kg' },
        four: { name: 'Four times as heavy', sub: '1 kg + 4 kg' },
        unknown: { name: 'Unknown mass', sub: '1 kg + ? kg' },
      },
      cut: 'Cut the thread',
      legend: { cart1: 'cart 1', cart2: 'cart 2', force: 'spring force F', vel: 'velocity v', marks: (dt) => `position every ${dt} s` },
      sceneLabel: (m1, m2, v1, v2) => `Side view: two carts and a compressed spring. m₁ = ${m1}, m₂ = ${m2}, v₁ = ${v1} m/s, v₂ = ${v2} m/s.`,
      readouts: { v1: 'Speed of cart 1', v2: 'Speed of cart 2', ratio: 'Speed ratio', mv: 'Mass × speed' },
      m1: 'Mass of cart 1',
      m2: 'Mass of cart 2',
      massHint: 'Empty cart 0.5 kg, each weight 0.5 kg',
      unknownNote: 'the load is covered. Measure the speeds and work out the mass.',
      x: 'Spring compression',
      xHint: (F) => `k = 600 N/m, starting force F = kx = ${F} N`,
      calc: { title: 'Working', note: 'Friction is neglected. The spring pushes both carts with the same force for the same time — so m₁v₁ = m₂v₂.' },
      runs: { title: 'Results', empty: 'Cut the thread — every run is written into this table.' },
      axis: 'x, m',
      vTag: (i, v) => `v_${i} = ${v} m/s`,
      mTag: (i, m) => `m_${i} = ${m}`,
      fTag: (F) => `F = kx = ${F} N`,
      sTag: (i, s) => `s_${i} = ${s} m`,
      explain: {
        idle: (x, F) =>
          `A thread holds the carts together; the spring between them is compressed by ${x} cm and pushes both carts with the same force: F = kx = ${F} N. Press “Cut the thread” — which cart will go faster?`,
        runEqual: (v) => `Equal masses — the same force gave both carts the same speed: v₁ = v₂ = ${v} m/s.`,
        run2: (k, v1, v2) =>
          `Cart 2 is ${k} times heavier — it got a ${k} times smaller speed: v₁ = ${v1} m/s, v₂ = ${v2} m/s. The speed of a more massive body is harder to change — it has more inertia.`,
        run1: (k, v1, v2) =>
          `Cart 1 is ${k} times heavier — it got a ${k} times smaller speed: v₁ = ${v1} m/s, v₂ = ${v2} m/s. The speed of a more massive body is harder to change — it has more inertia.`,
        runUnknown: (v1, v2) => `The mass of cart 2 is unknown. Compare the speeds: v₁ = ${v1} m/s, v₂ = ${v2} m/s. Which cart is heavier, and how many times?`,
        done: (t, s1, s2, r) =>
          `In the same time t = ${t} s cart 1 travelled s₁ = ${s1} m and cart 2 s₂ = ${s2} m: s₁/s₂ = v₁/v₂ = m₂/m₁ = ${r}. Compress the spring more and both speeds grow, but their ratio stays the same.`,
        doneUnknown: (r, m1, m2) =>
          `v₁/v₂ = ${r}, so m₂ = m₁·v₁/v₂ = ${m1} kg · ${r} = ${m2} kg. This is how masses are compared: an unknown mass is found from its interaction with a known one (a standard).`,
      },
    },
    density: {
      modeLabel: 'Experiment',
      modes: {
        vol: { name: 'Equal volumes', sub: 'V₁ = V₂ → the mass depends on density' },
        mass: { name: 'Equal masses', sub: 'm₁ = m₂ → the volume depends on density' },
      },
      edge: 'Cube edge',
      edgeHint: (V, m3) => `V = a³ = ${V} = ${m3} m³`,
      mass: 'Mass of each cube',
      massHint: 'Both pans get cubes of the same mass',
      mats: {
        cork: 'Cork',
        oak: 'Oak',
        ice: 'Ice',
        water: 'Water',
        glass: 'Glass',
        al: 'Aluminium',
        iron: 'Iron',
        copper: 'Copper',
        lead: 'Lead',
        gold: 'Gold',
      },
      sides: { left: 'The cube on the left pan', right: 'The cube on the right pan', leftShort: 'Left cube', rightShort: 'Right cube' },
      legend: { mass: 'mass m', vol: 'volume V', pointer: 'the pointer leans to the heavier pan' },
      verdict: { level: 'Balanced', right: 'Right pan heavier', left: 'Left pan heavier' },
      sceneLabel: (n1, m1, V1, n2, m2, V2, v) => `A pan balance. Left pan: ${n1}, m = ${m1}, V = ${V1}. Right pan: ${n2}, m = ${m2}, V = ${V2}. ${v}.`,
      readouts: {
        massRatio: 'Mass ratio',
        massRatioSub: 'm₂/m₁ = ρ₂/ρ₁, since V₁ = V₂',
        volRatio: 'Volume ratio',
        volRatioSub: 'V₁/V₂ = ρ₂/ρ₁, since m₁ = m₂',
        balance: 'Balance',
      },
      pickLeft: 'Material of the left cube',
      pickRight: 'Material of the right cube',
      calc: { title: 'Working', note: '1 g/cm³ = 1000 kg/m³, because 1 g = 0.001 kg and 1 cm³ = 0.000001 m³.' },
      graph: {
        title: 'm–V graph',
        label: 'Graph of mass against volume',
        noteVol: 'Each material is a straight line through the origin: m = ρV. The steeper the line, the greater the density.',
        noteMass: 'Equal masses — the points lie on one horizontal line. The less dense material takes more volume: V = m/ρ.',
      },
      mTag: (i, m) => `m_${i} = ${m}`,
      vTag: (i, v) => `V_${i} = ${v}`,
      explain: {
        volDiff: (V, cube, name, rho, k) =>
          `Equal volumes: V = ${V}. ${cube} (${name}, ρ = ${rho} kg/m³) is ${k} times heavier: m = ρV, so for equal volumes the denser material has the greater mass.`,
        volSame: 'Both cubes are the same material and the same volume — equal masses, the balance is level.',
        massDiff: (m, cube, name, k) =>
          `Equal masses (${m}), so the balance is level. ${cube} (${name}), though, takes up ${k} times more volume: V = m/ρ — a less dense material takes more room.`,
        massSame: 'Same material and same mass — the volumes are equal too.',
        litre: '1 litre (1 dm³) of water has a mass of 1 kg — so the density of water is 1000 kg/m³ = 1 g/cm³.',
        iceWater: 'Ice is lighter than the same volume of water — that is why it floats.',
      },
    },
    float: {
      liquidLabel: 'Liquid',
      drop: 'Let go',
      again: 'Drop again',
      liquids: {
        water: { name: 'Fresh water', loc: 'in fresh water' },
        sea: { name: 'Sea water', loc: 'in sea water' },
        oil: { name: 'Sunflower oil', loc: 'in sunflower oil' },
        kerosene: { name: 'Kerosene', loc: 'in kerosene' },
        mercury: { name: 'Mercury', loc: 'in mercury' },
      },
      bodies: {
        cork: 'Cork',
        oak: 'Oak',
        ice: 'Ice',
        plexi: 'Plexiglass',
        glass: 'Glass',
        al: 'Aluminium',
        iron: 'Iron',
        copper: 'Copper',
        lead: 'Lead',
        gold: 'Gold',
      },
      legend: { liquid: (n) => `liquid: ${n}`, under: 'submerged part', above: 'part above the liquid' },
      sceneLabel: (b, rb, l, rl, p) => `Side view of a tank. Body: ${b} (${rb} kg/m³), liquid: ${l} (${rl} kg/m³). ${p}% of the body's volume is under the surface.`,
      sym: { body: 'ρ_b', liquid: 'ρ_l' },
      readouts: {
        body: 'Body density',
        liquid: 'Liquid density',
        result: 'Result',
        share: 'Submerged part',
        lessSub: 'ρ_b < ρ_l',
        moreSub: 'ρ_b > ρ_l',
        guess: 'Make a guess!',
        shareSub: (f) => `V_sub/V = ρ_b/ρ_l = ${f}`,
        shareHint: 'share of the volume under the surface',
      },
      floats: 'Floats',
      sinks: 'Sinks',
      floatsShort: 'floats',
      sinksShort: 'sinks',
      bodyLabel: 'Body material',
      size: 'Cube edge',
      sizeHint: "The cube's size does not change the result — floating depends only on the densities.",
      underTag: (p) => `under: ${p}`,
      aboveTag: (p) => `above: ${p}`,
      sunkTag: 'sank: ρ_b > ρ_l',
      bodyTag: (n, r) => `${n} · ρ = ${r} kg/m³`,
      liqTag: (n, r) => `${n} · ρ = ${r} kg/m³`,
      ruler: {
        title: 'Compare the densities',
        label: (rb, rl) => `Density scale: body ${rb}, liquid ${rl} kg/m³`,
        floats: '← floats',
        sinks: 'sinks →',
        body: (r) => `body ${r}`,
        liquid: (r) => `liquid ${r} kg/m³`,
        note: 'The scale is logarithmic: 100–1000 and 1000–10 000 kg/m³ look equally long. White ticks are the other materials in the list.',
      },
      explain: {
        idle: (b, rb, l, rl) => `Body: ${b} (ρ = ${rb} kg/m³), liquid: ${l} (ρ = ${rl} kg/m³). Will it float or sink? Make a guess and press “Let go”.`,
        moving: (rb, rl) => `The body is in the liquid. Compare the densities: ρ_body = ${rb} kg/m³, ρ_liquid = ${rl} kg/m³.`,
        float: (b, loc, rb, rl, f, p) =>
          `${b} floats ${loc}: ρ_body = ${rb} < ρ_liquid = ${rl} kg/m³. The share ρ_body/ρ_liquid = ${f} of its volume, i.e. ${p}%, is under the surface.`,
        sink: (b, loc, rb, rl) => `${b} sinks ${loc}: ρ_body = ${rb} > ρ_liquid = ${rl} kg/m³ — the body is denser than the liquid.`,
        iceberg: 'Icebergs float the same way: only about 1/10 of an iceberg shows above the water.',
        metal: 'Even a heavy metal floats in a liquid denser than itself!',
        wouldFloat: 'In water it would float: the result depends on the liquid.',
      },
    },
  },
};

export default function MassDensity() {
  const T = useSimText(TEXT);
  const tabs = T.card.tabs;
  return (
    <SimCard
      idPrefix="massdensity"
      eyebrow={T.card.eyebrow}
      title={T.card.title}
      tabsLabel={T.card.tabsLabel}
      icon={Scale}
      tabs={[
        { id: 'carts', label: tabs.carts.label, sub: tabs.carts.sub, icon: MoveHorizontal, render: () => <CartsSim T={T} /> },
        { id: 'density', label: tabs.density.label, sub: tabs.density.sub, icon: Scale, render: () => <BalanceSim T={T} /> },
        { id: 'float', label: tabs.float.label, sub: tabs.float.sub, icon: Waves, render: () => <FloatSim T={T} /> },
      ]}
      facts={{ title: T.facts.title, items: T.facts.items.map((f) => ({ term: f.term, text: rich(f.text) })) }}
    />
  );
}
