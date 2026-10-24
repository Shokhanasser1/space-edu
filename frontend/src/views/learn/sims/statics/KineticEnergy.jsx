import { Gauge, OctagonMinus, Rocket, Zap } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { useSimText } from '../kit/lang';
import { Rich } from './KineticEnergy.parts';
import ExploreSim from './KineticEnergy.explore';
import WorkSim from './KineticEnergy.work';
import BrakeSim from './KineticEnergy.brake';

/**
 * Lesson "Kinetik energiya" (Statics topic, lesson 6, index 5):
 *  1. E_k = mv²/2 — two carts side by side, cart 2 with 2v, 3v, 2m or v/2;
 *     energy bars cut into pieces show ×4, ×9, ×2, ×¼. Preset m = 2 kg,
 *     v = 3 m/s → 9 J and 36 J. A log bar chart compares everyday objects
 *     (ball 90 J, bullet 720 J, runner 750 J, car 60 km/h 138.9 kJ, truck
 *     1.39 MJ);
 *  2. the work–energy theorem A = E_k2 − E_k1 — a constant force over a
 *     marked stretch. Preset m = 2 kg, F = 10 N, s = 5 m from rest →
 *     A = 50 J, v = 7.07 m/s; braking preset v₀ = 6 m/s, F = 4 N, s = 5 m →
 *     A = −20 J, E_k 36 → 16 J, v = 4 m/s;
 *  3. stopping distance F·s = mv²/2 — cars at 30, 60, 90 km/h braked with the
 *     same force (m = 1000 kg, F = 5 kN): 6.94, 27.78, 62.5 m — 1 : 4 : 9.
 */

const ru2to4 = (k) => (k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 12 || k % 100 > 14) ? 'раза' : 'раз');

const TEXT = {
  uz: {
    J: 'J',
    kJ: 'kJ',
    MJ: 'MJ',
    N: 'N',
    kN: 'kN',
    kg: 'kg',
    kSub: 'k',
    Asym: 'A',
    card: {
      eyebrow: 'Virtual laboratoriya · Statika',
      title: 'Kinetik energiya',
      tabsLabel: 'Tajribani tanlang',
      tabs: {
        explore: { label: 'Kinetik energiya', sub: 'E_{k} = mv²/2' },
        work: { label: 'Ish va energiya', sub: 'A = E_{k2} − E_{k1}' },
        brake: { label: "To'xtash yo'li", sub: 'F·s = mv²/2' },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    facts: {
      title: 'Eslab qoling',
      items: [
        { term: 'Kinetik energiya', text: 'harakatlanayotgan jismning energiyasi: E_{k} = mv²/2. Tinch turgan jismning kinetik energiyasi nolga teng.' },
        { term: 'Joul', text: "1 J = 1 kg · m²/s² = 1 N · m. Energiya ham, ish ham joullarda o'lchanadi." },
        { term: 'Tezlik kvadrati', text: 'tezlik 2 marta oshsa, E_{k} 4 marta, 3 marta oshsa — 9 marta ortadi. Massa 2 marta oshsa, E_{k} ham 2 marta ortadi.' },
        {
          term: 'Kinetik energiya haqidagi teorema',
          text: "A = E_{k2} − E_{k1}: teng ta'sir etuvchi kuchning ishi kinetik energiyaning o'zgarishiga teng. Tormozlovchi kuchning ishi manfiy, to'xtash yo'li s = mv²/(2F) ~ v².",
        },
      ],
    },
    explore: {
      compareLabel: '2-arava 1-aravadan nimasi bilan farq qiladi',
      modes: {
        v2: { name: 'Tezligi 2 marta katta', sub: 'm,  2v' },
        v3: { name: 'Tezligi 3 marta katta', sub: 'm,  3v' },
        m2: { name: 'Massasi 2 marta katta', sub: '2m,  v' },
        vh: { name: 'Tezligi 2 marta kichik', sub: 'm,  v/2' },
      },
      cart1: '1-arava',
      cart2: '2-arava',
      cartSub: (m, v) => `${m} kg · ${v} m/s`,
      m: '1-arava massasi',
      mHint: "aravaning o'zi 1 kg, har bir po'lat yuk — yana 1 kg",
      v: '1-arava tezligi',
      vHint: (k) => `= ${k} km/soat · 2-arava tanlangan farq bo'yicha o'zgaradi`,
      legend: { v: 'tezlik v', ek: 'kinetik energiya E_{k}' },
      chipReal: 'Real vaqt',
      chipSlow: (k) => `Vaqt ${k} marta sekinlashtirilgan`,
      axisX: 'x, m',
      sceneLabel: (m1, v1, e1, m2, v2, e2) =>
        `Silliq yo'ldagi ikki arava yon tomondan. 1-arava: ${m1} kg, ${v1} m/s, kinetik energiyasi ${e1}. 2-arava: ${m2} kg, ${v2} m/s, kinetik energiyasi ${e2}.`,
      readouts: { ratio: 'Nisbat', law: 'Qonuniyat' },
      eSub: (m, v) => `m·v²/2 = ${m} · ${v}² / 2`,
      ratioSub: { v2: 'tezlik ×2 → energiya ×4', v3: 'tezlik ×3 → energiya ×9', m2: 'massa ×2 → energiya ×2', vh: 'tezlik ×½ → energiya ×¼' },
      law: { v2: ['v × 2', 'E_{k} × 4'], v3: ['v × 3', 'E_{k} × 9'], m2: ['m × 2', 'E_{k} × 2'], vh: ['v × ½', 'E_{k} × ¼'] },
      formula: {
        tag: 'Kinetik energiya',
        general: 'E_{k} = m·v² / 2',
        filled: (m, v, e) => `1-arava: ${m} · ${v}² / 2 = ${e}`,
        result: (e) => `E_{k1} = ${e}`,
        unit: '1 J = 1 kg · m²/s²: 2 kg massali jism 1 m/s tezlikda 1 J kinetik energiyaga ega.',
      },
      ladder: {
        title: 'Kundalik hayotdagi kinetik energiyalar',
        scale: "logarifmik shkala: har bir bo'lim — 10 marta ko'p",
        label: 'Aravalar va kundalik jismlarning kinetik energiyalari, logarifmik shkala',
        objects: {
          ball: { name: "Tepilgan futbol to'pi", sub: '0.45 kg · 20 m/s' },
          bullet: { name: "To'pponcha o'qi", sub: '9 g · 400 m/s' },
          runner: { name: 'Yugurayotgan odam', sub: '60 kg · 5 m/s' },
          car: { name: 'Avtomobil', sub: '1000 kg · 60 km/soat' },
          truck: { name: 'Yuk mashinasi', sub: '10 t · 60 km/soat' },
        },
        note: "O'q odamdan taxminan 6 700 marta yengil, lekin 80 marta tez — ularning energiyasi deyarli teng (720 J va 750 J). Yuk mashinasi avtomobildan 10 marta og'ir, energiyasi ham 10 marta katta.",
      },
      explain: {
        idle: 'Kinetik energiya — harakat energiyasi: E_{k} = mv²/2. Ikki arava yonma-yon yuradi, 2-arava faqat bitta jihati bilan farq qiladi. «Boshlash»ni bosing: 2-aravaning energiyasi necha marta katta?',
        v2: (e1, e2) => `2-arava 2 marta tez yuryapti, kinetik energiyasi esa 4 marta katta: ${e1} va ${e2}. Tezlik formulada kvadratda turadi: (2v)² = 4v².`,
        v3: (e1, e2) => `Tezlik 3 marta katta — energiya 9 marta katta: ${e1} va ${e2}, chunki (3v)² = 9v². Yashil ustundagi bo'laklarni sanang!`,
        m2: (e1, e2) => `Massasi 2 marta katta arava xuddi shu tezlikda 2 marta ko'p energiyaga ega: ${e1} va ${e2}. Kinetik energiya massaga to'g'ri proporsional.`,
        vh: (e1, e2) => `Tezlik 2 marta kamaysa, energiya 4 marta kamayadi: ${e1} va ${e2}. Sekinlashganda energiya tez kamayadi.`,
      },
    },
    work: {
      modeLabel: "Kuch qanday yo'nalgan",
      modes: {
        push: { name: 'Tezlatuvchi kuch', sub: "F harakat yo'nalishida · A > 0" },
        brake: { name: 'Tormozlovchi kuch', sub: 'F harakatga qarshi · A < 0' },
      },
      m: 'Arava massasi',
      F: 'Kuch',
      s: "Kuch ta'sir qiladigan yo'l",
      v0: "Boshlang'ich tezlik",
      hint: "Yo'l silliq, ishqalanish yo'q — F aravaga ta'sir etuvchi kuchlarning teng ta'sir etuvchisi. Kuch yo'nalishini tanlasangiz, tayyor misol yuklanadi.",
      legend: { F: 'kuch F', v: 'tezlik v', zone: "kuch ta'sir qiladigan yo'l s" },
      chipReal: 'Real vaqt',
      chipSlow: (k) => `Vaqt ${k} marta sekinlashtirilgan`,
      chipFast: (k) => `Vaqt ×${k} tezlashtirilgan`,
      scaleLabel: (n) => `= ${n} N`,
      axisX: 'x, m',
      sceneLabel: (x, v, A, e) => `Silliq yo'ldagi arava yon tomondan. x = ${x} m, tezlik ${v} m/s, kuchning ishi ${A} J, kinetik energiya ${e} J.`,
      bars: { title: 'Energiya, J' },
      readouts: { A: 'Kuchning ishi', ek1: "Boshlang'ich energiya", ek: 'Kinetik energiya', v: 'Tezlik' },
      ASubPush: (F, x) => `A = F · x = ${F} · ${x}`,
      ASubBrake: (F, x) => `A = −F · x = −${F} · ${x}`,
      ek1Sub: (m, v) => `m·v₀²/2 = ${m} · ${v}² / 2`,
      ekSub: (e1, A) => `E_{k1} + A = ${e1} + ${A}`,
      vSub: (e, m) => `v = √(2E_{k}/m) = √(2 · ${e} / ${m})`,
      formula: {
        tag: 'Kinetik energiya haqidagi teorema',
        general: 'A = E_{k2} − E_{k1}',
        filled: (A, e2, e1) => `${A} J = ${e2} J − ${e1} J`,
        result: (e2, m, v) => `v = √(2 · ${e2} / ${m}) = ${v} m/s`,
      },
      graph: {
        title: 'Grafik: E_{k}(x)',
        label: "Kinetik energiyaning koordinataga bog'liqlik grafigi",
        plan: 'reja',
        live: 'E_{k}(x)',
        x: 'x, m',
        y: 'Eₖ, J',
        note: (F) => `Kuch ta'sir qiladigan qismda har metrda kinetik energiya ${F} J ga o'zgaradi — grafik qiyaligi kuchga teng. Kuch yo'qolgach, kinetik energiya o'zgarmaydi.`,
      },
      explain: {
        idlePush: (m, F, s, v0) =>
          `${m} kg massali aravaga ${s} m yo'l davomida harakat yo'nalishida F = ${F} N kuch ta'sir qiladi (boshlang'ich tezlik ${v0} m/s). Kuch qancha ish bajaradi va arava qanday tezlik oladi? «Boshlash»ni bosing.`,
        idleBrake: (m, F, s, v0) =>
          `${m} kg massali arava ${v0} m/s tezlik bilan kelyapti. ${s} m yo'lda unga harakatga qarshi F = ${F} N kuch ta'sir qiladi. Kuchning ishi qanday ishorali bo'ladi va tezlik qanchaga kamayadi?`,
        push: (A, e) => `Kuch harakat yo'nalishida — u musbat ish bajaradi: A = F·x = ${A} J. Kinetik energiya aynan shuncha ortdi: E_{k} = ${e} J.`,
        brake: (A, e) => `Kuch harakatga qarshi — uning ishi manfiy: A = −F·x = ${A} J. Kinetik energiya aynan shuncha kamaydi: E_{k} = ${e} J.`,
        coast: (v, e) => `Kuch ta'sir qilmay qo'ydi — ish bajarilmaydi, shuning uchun kinetik energiya (${e} J) ham, tezlik (${v} m/s) ham endi o'zgarmaydi.`,
        donePush: (A, e2, e1, v) => `A = E_{k2} − E_{k1}: ${A} J = ${e2} J − ${e1} J. Kuchning ishi kinetik energiyaning o'zgarishiga teng — arava ${v} m/s tezlik oldi.`,
        doneBrake: (A, e2, e1, v) =>
          `A = E_{k2} − E_{k1}: ${A} J = ${e2} J − ${e1} J. Tormozlovchi kuchning manfiy ishi kinetik energiyani kamaytirdi — tezlik ${v} m/s gacha tushdi.`,
        stopped: (s, e1) => `Arava ${s} m da to'xtadi: tormozlovchi kuch butun kinetik energiyani sarfladi, A = −E_{k1} = −${e1} J. To'xtagan aravaga tormoz endi ish bajarmaydi.`,
      },
    },
    brake: {
      F: 'Tormozlovchi kuch',
      FHint: (a) => `a = F/m = ${a} m/s² — uchala avtomobil uchun bir xil`,
      m: 'Avtomobil massasi',
      mHint: 'uchala avtomobil bir xil',
      carName: (k) => `${k} km/soat`,
      carSub: (E, s) => `E_{k} = ${E} · to'xtash yo'li ${s} m`,
      laneAria: (k, s) => `${k} km/soat — ${s} m`,
      readouts: { ratio: "To'xtash yo'llari" },
      ratioSub: 'tezliklar 1 : 2 : 3 — energiyalar 1 : 4 : 9',
      formula: {
        tag: "To'xtash yo'li",
        general: 'F · s = m·v² / 2   ⇒   s = m·v² / (2F)',
        filled: (m, F, s) => `90 km/soat = 25 m/s:  ${m} · 25² / (2 · ${F}) = ${s} m`,
        result: 's₁ : s₂ : s₃ = 1 : 4 : 9',
      },
      energy: { title: 'Energiya → issiqlik', ek: 'E_{k}', q: 'issiqlik Q' },
      graph: {
        title: 'Grafik: E_{k}(x)',
        label: "Avtomobillar kinetik energiyasining bosib o'tilgan yo'lga bog'liqlik grafigi",
        x: 'x, m',
        y: 'Eₖ, kJ',
        note: (F) => `Uchala chiziq parallel: har metrda har bir avtomobil F · 1 m = ${F} kJ energiya yo'qotadi. 4 marta ko'p energiyani yo'qotish uchun 4 marta uzun yo'l kerak.`,
      },
      legend: { skid: 'tormoz izi', line: 'tormoz bosilgan joy', F: 'tormozlovchi kuch F' },
      chipReal: 'Real vaqt',
      chipFast: (k) => `Vaqt ×${k} tezlashtirilgan`,
      brakeLine: 'tormoz',
      axisX: 'x, m',
      distTag: (s) => `${s} m`,
      sceneLabel: (list) => `Uch yo'lakli yo'l yuqoridan. Bir xil kuch bilan tormozlangan avtomobillarning to'xtash yo'llari: ${list}.`,
      explain: {
        idle: (m, F) =>
          `Uchta bir xil avtomobil (${m} kg) tormoz chizig'idan boshlab bir xil F = ${F} kN kuch bilan tormozlanadi. Tezliklari 30, 60 va 90 km/soat. 90 km/soatdagi avtomobil 30 km/soatdagidan necha marta uzoq yo'l bosib to'xtaydi?`,
        braking: (F) =>
          `Tormozlovchi kuch harakatga qarshi va manfiy ish bajaradi: har metrda har bir avtomobil ${F} kJ kinetik energiya yo'qotadi. Bu energiya issiqlikka aylanadi — tormozlar qiziydi.`,
        first: (s, E) => `30 km/soatdagi avtomobil ${s} m da to'xtadi: uning ${E} kinetik energiyasi to'liq issiqlikka aylandi. Qolganlarining energiyasi ko'p — ular hali to'xtamadi.`,
        second: (s) => `60 km/soatdagi avtomobil ${s} m da to'xtadi — 4 marta uzoqroq: tezligi 2 marta, kinetik energiyasi esa 4 marta katta edi.`,
        done: (s1, s2, s3) =>
          `To'xtash yo'llari ${s1} m, ${s2} m va ${s3} m — nisbati 1 : 4 : 9. F·s = mv²/2 bo'lgani uchun s ~ v²: tezlik 3 marta oshsa, to'xtash yo'li 9 marta uzayadi. Tezlikni oshirmang!`,
      },
    },
  },
  ru: {
    J: 'Дж',
    kJ: 'кДж',
    MJ: 'МДж',
    N: 'Н',
    kN: 'кН',
    kg: 'кг',
    kSub: 'к',
    Asym: 'A',
    card: {
      eyebrow: 'Виртуальная лаборатория · Статика',
      title: 'Кинетическая энергия',
      tabsLabel: 'Выберите опыт',
      tabs: {
        explore: { label: 'Кинетическая энергия', sub: 'E_{к} = mv²/2' },
        work: { label: 'Работа и энергия', sub: 'A = E_{к2} − E_{к1}' },
        brake: { label: 'Тормозной путь', sub: 'F·s = mv²/2' },
      },
    },
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    facts: {
      title: 'Запомните',
      items: [
        { term: 'Кинетическая энергия', text: 'энергия движущегося тела: E_{к} = mv²/2. У покоящегося тела кинетическая энергия равна нулю.' },
        { term: 'Джоуль', text: '1 Дж = 1 кг · м²/с² = 1 Н · м. И энергию, и работу измеряют в джоулях.' },
        { term: 'Квадрат скорости', text: 'если скорость увеличить в 2 раза, E_{к} вырастет в 4 раза, в 3 раза — в 9 раз. Если вдвое увеличить массу, E_{к} вырастет вдвое.' },
        {
          term: 'Теорема о кинетической энергии',
          text: 'A = E_{к2} − E_{к1}: работа равнодействующей силы равна изменению кинетической энергии. Работа тормозящей силы отрицательна, тормозной путь s = mv²/(2F) ~ v².',
        },
      ],
    },
    explore: {
      compareLabel: 'Чем 2-я тележка отличается от 1-й',
      modes: {
        v2: { name: 'Скорость в 2 раза больше', sub: 'm,  2v' },
        v3: { name: 'Скорость в 3 раза больше', sub: 'm,  3v' },
        m2: { name: 'Масса в 2 раза больше', sub: '2m,  v' },
        vh: { name: 'Скорость в 2 раза меньше', sub: 'm,  v/2' },
      },
      cart1: '1-я тележка',
      cart2: '2-я тележка',
      cartSub: (m, v) => `${m} кг · ${v} м/с`,
      m: 'Масса 1-й тележки',
      mHint: 'сама тележка — 1 кг, каждый стальной груз — ещё 1 кг',
      v: 'Скорость 1-й тележки',
      vHint: (k) => `= ${k} км/ч · 2-я тележка меняется по выбранному отличию`,
      legend: { v: 'скорость v', ek: 'кинетическая энергия E_{к}' },
      chipReal: 'Реальное время',
      chipSlow: (k) => `Время замедлено в ${k} ${ru2to4(k)}`,
      axisX: 'x, м',
      sceneLabel: (m1, v1, e1, m2, v2, e2) =>
        `Две тележки на гладком пути, вид сбоку. 1-я: ${m1} кг, ${v1} м/с, кинетическая энергия ${e1}. 2-я: ${m2} кг, ${v2} м/с, кинетическая энергия ${e2}.`,
      readouts: { ratio: 'Отношение', law: 'Закономерность' },
      eSub: (m, v) => `m·v²/2 = ${m} · ${v}² / 2`,
      ratioSub: { v2: 'скорость ×2 → энергия ×4', v3: 'скорость ×3 → энергия ×9', m2: 'масса ×2 → энергия ×2', vh: 'скорость ×½ → энергия ×¼' },
      law: { v2: ['v × 2', 'E_{к} × 4'], v3: ['v × 3', 'E_{к} × 9'], m2: ['m × 2', 'E_{к} × 2'], vh: ['v × ½', 'E_{к} × ¼'] },
      formula: {
        tag: 'Кинетическая энергия',
        general: 'E_{к} = m·v² / 2',
        filled: (m, v, e) => `1-я тележка: ${m} · ${v}² / 2 = ${e}`,
        result: (e) => `E_{к1} = ${e}`,
        unit: '1 Дж = 1 кг · м²/с²: тело массой 2 кг при скорости 1 м/с имеет кинетическую энергию 1 Дж.',
      },
      ladder: {
        title: 'Кинетические энергии вокруг нас',
        scale: 'логарифмическая шкала: каждое деление — в 10 раз больше',
        label: 'Кинетические энергии тележек и привычных тел, логарифмическая шкала',
        objects: {
          ball: { name: 'Футбольный мяч после удара', sub: '0,45 кг · 20 м/с' },
          bullet: { name: 'Пистолетная пуля', sub: '9 г · 400 м/с' },
          runner: { name: 'Бегущий человек', sub: '60 кг · 5 м/с' },
          car: { name: 'Легковой автомобиль', sub: '1000 кг · 60 км/ч' },
          truck: { name: 'Грузовик', sub: '10 т · 60 км/ч' },
        },
        note: 'Пуля легче человека примерно в 6 700 раз, но быстрее в 80 раз — их энергии почти равны (720 Дж и 750 Дж). Грузовик в 10 раз тяжелее автомобиля — и энергия у него в 10 раз больше.',
      },
      explain: {
        idle: 'Кинетическая энергия — энергия движения: E_{к} = mv²/2. Две тележки едут рядом, 2-я отличается только одним. Нажмите «Старт»: во сколько раз энергия 2-й тележки больше?',
        v2: (e1, e2) => `2-я тележка едет в 2 раза быстрее, а её кинетическая энергия в 4 раза больше: ${e1} и ${e2}. Скорость входит в формулу в квадрате: (2v)² = 4v².`,
        v3: (e1, e2) => `Скорость в 3 раза больше — энергия в 9 раз больше: ${e1} и ${e2}, ведь (3v)² = 9v². Посчитайте кусочки в зелёном столбике!`,
        m2: (e1, e2) => `Тележка вдвое большей массы при той же скорости имеет вдвое большую энергию: ${e1} и ${e2}. Кинетическая энергия прямо пропорциональна массе.`,
        vh: (e1, e2) => `Скорость уменьшилась в 2 раза — энергия уменьшилась в 4 раза: ${e1} и ${e2}. При замедлении энергия быстро убывает.`,
      },
    },
    work: {
      modeLabel: 'Как направлена сила',
      modes: {
        push: { name: 'Разгоняющая сила', sub: 'F по направлению движения · A > 0' },
        brake: { name: 'Тормозящая сила', sub: 'F против движения · A < 0' },
      },
      m: 'Масса тележки',
      F: 'Сила',
      s: 'Путь, на котором действует сила',
      v0: 'Начальная скорость',
      hint: 'Путь гладкий, трения нет — F и есть равнодействующая сил, действующих на тележку. При выборе направления силы загружается готовый пример.',
      legend: { F: 'сила F', v: 'скорость v', zone: 'участок действия силы s' },
      chipReal: 'Реальное время',
      chipSlow: (k) => `Время замедлено в ${k} ${ru2to4(k)}`,
      chipFast: (k) => `Время ускорено ×${k}`,
      scaleLabel: (n) => `= ${n} Н`,
      axisX: 'x, м',
      sceneLabel: (x, v, A, e) => `Тележка на гладком пути, вид сбоку. x = ${x} м, скорость ${v} м/с, работа силы ${A} Дж, кинетическая энергия ${e} Дж.`,
      bars: { title: 'Энергия, Дж' },
      readouts: { A: 'Работа силы', ek1: 'Начальная энергия', ek: 'Кинетическая энергия', v: 'Скорость' },
      ASubPush: (F, x) => `A = F · x = ${F} · ${x}`,
      ASubBrake: (F, x) => `A = −F · x = −${F} · ${x}`,
      ek1Sub: (m, v) => `m·v₀²/2 = ${m} · ${v}² / 2`,
      ekSub: (e1, A) => `E_{к1} + A = ${e1} + ${A}`,
      vSub: (e, m) => `v = √(2E_{к}/m) = √(2 · ${e} / ${m})`,
      formula: {
        tag: 'Теорема о кинетической энергии',
        general: 'A = E_{к2} − E_{к1}',
        filled: (A, e2, e1) => `${A} Дж = ${e2} Дж − ${e1} Дж`,
        result: (e2, m, v) => `v = √(2 · ${e2} / ${m}) = ${v} м/с`,
      },
      graph: {
        title: 'График: E_{к}(x)',
        label: 'График зависимости кинетической энергии от координаты',
        plan: 'план',
        live: 'E_{к}(x)',
        x: 'x, м',
        y: 'Eк, Дж',
        note: (F) => `На участке действия силы кинетическая энергия меняется на ${F} Дж за каждый метр — наклон графика равен силе. Когда сила перестаёт действовать, кинетическая энергия не меняется.`,
      },
      explain: {
        idlePush: (m, F, s, v0) =>
          `На тележку массой ${m} кг на пути ${s} м действует сила F = ${F} Н по направлению движения (начальная скорость ${v0} м/с). Какую работу совершит сила и какую скорость получит тележка? Нажмите «Старт».`,
        idleBrake: (m, F, s, v0) =>
          `Тележка массой ${m} кг едет со скоростью ${v0} м/с. На пути ${s} м на неё действует сила F = ${F} Н против движения. Какого знака будет работа силы и насколько уменьшится скорость?`,
        push: (A, e) => `Сила направлена по движению — она совершает положительную работу: A = F·x = ${A} Дж. Кинетическая энергия выросла ровно на столько же: E_{к} = ${e} Дж.`,
        brake: (A, e) => `Сила направлена против движения — её работа отрицательна: A = −F·x = ${A} Дж. Кинетическая энергия уменьшилась на столько же: E_{к} = ${e} Дж.`,
        coast: (v, e) => `Сила перестала действовать — работа не совершается, поэтому кинетическая энергия (${e} Дж) и скорость (${v} м/с) больше не меняются.`,
        donePush: (A, e2, e1, v) =>
          `A = E_{к2} − E_{к1}: ${A} Дж = ${e2} Дж − ${e1} Дж. Работа силы равна изменению кинетической энергии — тележка разогналась до ${v} м/с.`,
        doneBrake: (A, e2, e1, v) =>
          `A = E_{к2} − E_{к1}: ${A} Дж = ${e2} Дж − ${e1} Дж. Отрицательная работа тормозящей силы уменьшила кинетическую энергию — скорость упала до ${v} м/с.`,
        stopped: (s, e1) =>
          `Тележка остановилась через ${s} м: тормозящая сила израсходовала всю кинетическую энергию, A = −E_{к1} = −${e1} Дж. На стоящую тележку тормоз больше не совершает работы.`,
      },
    },
    brake: {
      F: 'Тормозящая сила',
      FHint: (a) => `a = F/m = ${a} м/с² — одинаково для всех трёх машин`,
      m: 'Масса автомобиля',
      mHint: 'все три машины одинаковые',
      carName: (k) => `${k} км/ч`,
      carSub: (E, s) => `E_{к} = ${E} · тормозной путь ${s} м`,
      laneAria: (k, s) => `${k} км/ч — ${s} м`,
      readouts: { ratio: 'Тормозные пути' },
      ratioSub: 'скорости 1 : 2 : 3 — энергии 1 : 4 : 9',
      formula: {
        tag: 'Тормозной путь',
        general: 'F · s = m·v² / 2   ⇒   s = m·v² / (2F)',
        filled: (m, F, s) => `90 км/ч = 25 м/с:  ${m} · 25² / (2 · ${F}) = ${s} м`,
        result: 's₁ : s₂ : s₃ = 1 : 4 : 9',
      },
      energy: { title: 'Энергия → тепло', ek: 'E_{к}', q: 'теплота Q' },
      graph: {
        title: 'График: E_{к}(x)',
        label: 'График зависимости кинетической энергии машин от пройденного пути',
        x: 'x, м',
        y: 'Eк, кДж',
        note: (F) => `Все три прямые параллельны: на каждом метре каждая машина теряет F · 1 м = ${F} кДж энергии. Чтобы потерять в 4 раза больше энергии, нужен в 4 раза более длинный путь.`,
      },
      legend: { skid: 'тормозной след', line: 'место торможения', F: 'тормозящая сила F' },
      chipReal: 'Реальное время',
      chipFast: (k) => `Время ускорено ×${k}`,
      brakeLine: 'тормоз',
      axisX: 'x, м',
      distTag: (s) => `${s} м`,
      sceneLabel: (list) => `Трёхполосная дорога сверху. Тормозные пути машин при одинаковой тормозящей силе: ${list}.`,
      explain: {
        idle: (m, F) =>
          `Три одинаковые машины (${m} кг) тормозят от одной линии с одинаковой силой F = ${F} кН. Их скорости 30, 60 и 90 км/ч. Во сколько раз тормозной путь машины на 90 км/ч длиннее, чем у машины на 30 км/ч?`,
        braking: (F) =>
          `Тормозящая сила направлена против движения и совершает отрицательную работу: на каждом метре каждая машина теряет ${F} кДж кинетической энергии. Эта энергия переходит в тепло — тормоза нагреваются.`,
        first: (s, E) => `Машина на 30 км/ч остановилась через ${s} м: вся её кинетическая энергия (${E}) перешла в тепло. У остальных энергии больше — они ещё едут.`,
        second: (s) => `Машина на 60 км/ч остановилась через ${s} м — в 4 раза дальше: скорость была в 2 раза больше, а кинетическая энергия — в 4 раза.`,
        done: (s1, s2, s3) =>
          `Тормозные пути ${s1} м, ${s2} м и ${s3} м — отношение 1 : 4 : 9. Так как F·s = mv²/2, путь s ~ v²: при втрое большей скорости тормозной путь в 9 раз длиннее. Не превышайте скорость!`,
      },
    },
  },
  en: {
    J: 'J',
    kJ: 'kJ',
    MJ: 'MJ',
    N: 'N',
    kN: 'kN',
    kg: 'kg',
    kSub: 'k',
    Asym: 'W',
    card: {
      eyebrow: 'Virtual lab · Statics',
      title: 'Kinetic energy',
      tabsLabel: 'Choose an experiment',
      tabs: {
        explore: { label: 'Kinetic energy', sub: 'E_{k} = mv²/2' },
        work: { label: 'Work and energy', sub: 'W = E_{k2} − E_{k1}' },
        brake: { label: 'Stopping distance', sub: 'F·s = mv²/2' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Run again', reset: 'Reset' },
    facts: {
      title: 'Remember',
      items: [
        { term: 'Kinetic energy', text: 'the energy of a moving body: E_{k} = mv²/2. A body at rest has zero kinetic energy.' },
        { term: 'Joule', text: '1 J = 1 kg · m²/s² = 1 N · m. Energy and work are both measured in joules.' },
        { term: 'Speed squared', text: 'double the speed and E_{k} grows 4 times; triple it and E_{k} grows 9 times. Double the mass and E_{k} doubles.' },
        {
          term: 'Work–energy theorem',
          text: 'W = E_{k2} − E_{k1}: the work done by the net force equals the change in kinetic energy. A braking force does negative work; the stopping distance is s = mv²/(2F) ~ v².',
        },
      ],
    },
    explore: {
      compareLabel: 'How cart 2 differs from cart 1',
      modes: {
        v2: { name: 'Twice the speed', sub: 'm,  2v' },
        v3: { name: 'Three times the speed', sub: 'm,  3v' },
        m2: { name: 'Twice the mass', sub: '2m,  v' },
        vh: { name: 'Half the speed', sub: 'm,  v/2' },
      },
      cart1: 'Cart 1',
      cart2: 'Cart 2',
      cartSub: (m, v) => `${m} kg · ${v} m/s`,
      m: 'Mass of cart 1',
      mHint: 'the cart itself is 1 kg, each steel weight adds 1 kg',
      v: 'Speed of cart 1',
      vHint: (k) => `= ${k} km/h · cart 2 follows the chosen difference`,
      legend: { v: 'velocity v', ek: 'kinetic energy E_{k}' },
      chipReal: 'Real time',
      chipSlow: (k) => `Time slowed down ×${k}`,
      axisX: 'x, m',
      sceneLabel: (m1, v1, e1, m2, v2, e2) =>
        `Two carts on a smooth track seen from the side. Cart 1: ${m1} kg, ${v1} m/s, kinetic energy ${e1}. Cart 2: ${m2} kg, ${v2} m/s, kinetic energy ${e2}.`,
      readouts: { ratio: 'Ratio', law: 'Pattern' },
      eSub: (m, v) => `m·v²/2 = ${m} · ${v}² / 2`,
      ratioSub: { v2: 'speed ×2 → energy ×4', v3: 'speed ×3 → energy ×9', m2: 'mass ×2 → energy ×2', vh: 'speed ×½ → energy ×¼' },
      law: { v2: ['v × 2', 'E_{k} × 4'], v3: ['v × 3', 'E_{k} × 9'], m2: ['m × 2', 'E_{k} × 2'], vh: ['v × ½', 'E_{k} × ¼'] },
      formula: {
        tag: 'Kinetic energy',
        general: 'E_{k} = m·v² / 2',
        filled: (m, v, e) => `Cart 1: ${m} · ${v}² / 2 = ${e}`,
        result: (e) => `E_{k1} = ${e}`,
        unit: '1 J = 1 kg · m²/s²: a 2 kg body moving at 1 m/s has 1 J of kinetic energy.',
      },
      ladder: {
        title: 'Kinetic energies in everyday life',
        scale: 'logarithmic scale: each division is 10 times more',
        label: 'Kinetic energies of the carts and everyday objects, logarithmic scale',
        objects: {
          ball: { name: 'Kicked football', sub: '0.45 kg · 20 m/s' },
          bullet: { name: 'Pistol bullet', sub: '9 g · 400 m/s' },
          runner: { name: 'Running person', sub: '60 kg · 5 m/s' },
          car: { name: 'Car', sub: '1000 kg · 60 km/h' },
          truck: { name: 'Truck', sub: '10 t · 60 km/h' },
        },
        note: 'A bullet is about 6 700 times lighter than a person but 80 times faster — their energies are almost equal (720 J and 750 J). The truck is 10 times heavier than the car, so its energy is 10 times greater too.',
      },
      explain: {
        idle: 'Kinetic energy is the energy of motion: E_{k} = mv²/2. Two carts roll side by side, and cart 2 differs in just one thing. Press Start: how many times more energy does cart 2 have?',
        v2: (e1, e2) => `Cart 2 moves twice as fast, but its kinetic energy is 4 times greater: ${e1} and ${e2}. The speed is squared in the formula: (2v)² = 4v².`,
        v3: (e1, e2) => `Three times the speed — nine times the energy: ${e1} and ${e2}, because (3v)² = 9v². Count the pieces in the green bar!`,
        m2: (e1, e2) => `A cart with twice the mass at the same speed has twice the energy: ${e1} and ${e2}. Kinetic energy is directly proportional to mass.`,
        vh: (e1, e2) => `Halve the speed and the energy drops 4 times: ${e1} and ${e2}. Slowing down removes energy fast.`,
      },
    },
    work: {
      modeLabel: 'Direction of the force',
      modes: {
        push: { name: 'Speeding-up force', sub: 'F along the motion · W > 0' },
        brake: { name: 'Braking force', sub: 'F against the motion · W < 0' },
      },
      m: 'Mass of the cart',
      F: 'Force',
      s: 'Distance the force acts over',
      v0: 'Initial speed',
      hint: 'The track is smooth (no friction), so F is the net force on the cart. Choosing a direction loads a worked example.',
      legend: { F: 'force F', v: 'velocity v', zone: 'stretch where the force acts, s' },
      chipReal: 'Real time',
      chipSlow: (k) => `Time slowed down ×${k}`,
      chipFast: (k) => `Time sped up ×${k}`,
      scaleLabel: (n) => `= ${n} N`,
      axisX: 'x, m',
      sceneLabel: (x, v, A, e) => `A cart on a smooth track seen from the side. x = ${x} m, speed ${v} m/s, work done by the force ${A} J, kinetic energy ${e} J.`,
      bars: { title: 'Energy, J' },
      readouts: { A: 'Work done by F', ek1: 'Initial energy', ek: 'Kinetic energy', v: 'Speed' },
      ASubPush: (F, x) => `W = F · x = ${F} · ${x}`,
      ASubBrake: (F, x) => `W = −F · x = −${F} · ${x}`,
      ek1Sub: (m, v) => `m·v₀²/2 = ${m} · ${v}² / 2`,
      ekSub: (e1, A) => `E_{k1} + W = ${e1} + ${A}`,
      vSub: (e, m) => `v = √(2E_{k}/m) = √(2 · ${e} / ${m})`,
      formula: {
        tag: 'Work–energy theorem',
        general: 'W = E_{k2} − E_{k1}',
        filled: (A, e2, e1) => `${A} J = ${e2} J − ${e1} J`,
        result: (e2, m, v) => `v = √(2 · ${e2} / ${m}) = ${v} m/s`,
      },
      graph: {
        title: 'Graph: E_{k}(x)',
        label: 'Graph of kinetic energy against position',
        plan: 'plan',
        live: 'E_{k}(x)',
        x: 'x, m',
        y: 'Eₖ, J',
        note: (F) => `Where the force acts, the kinetic energy changes by ${F} J every metre — the slope of the graph equals the force. Once the force stops acting, the kinetic energy stays the same.`,
      },
      explain: {
        idlePush: (m, F, s, v0) =>
          `A force F = ${F} N acts on a ${m} kg cart along its motion over ${s} m (initial speed ${v0} m/s). How much work will the force do, and what speed will the cart reach? Press Start.`,
        idleBrake: (m, F, s, v0) =>
          `A ${m} kg cart is moving at ${v0} m/s. Over ${s} m a force F = ${F} N acts against its motion. What sign will the work have, and how much will the speed drop?`,
        push: (A, e) => `The force points along the motion, so it does positive work: W = F·x = ${A} J. The kinetic energy has grown by exactly that much: E_{k} = ${e} J.`,
        brake: (A, e) => `The force points against the motion, so its work is negative: W = −F·x = ${A} J. The kinetic energy has dropped by exactly that much: E_{k} = ${e} J.`,
        coast: (v, e) => `The force no longer acts — no work is done, so the kinetic energy (${e} J) and the speed (${v} m/s) stay the same.`,
        donePush: (A, e2, e1, v) =>
          `W = E_{k2} − E_{k1}: ${A} J = ${e2} J − ${e1} J. The work done by the force equals the change in kinetic energy — the cart has reached ${v} m/s.`,
        doneBrake: (A, e2, e1, v) =>
          `W = E_{k2} − E_{k1}: ${A} J = ${e2} J − ${e1} J. The negative work of the braking force reduced the kinetic energy — the speed fell to ${v} m/s.`,
        stopped: (s, e1) =>
          `The cart stopped after ${s} m: the braking force used up all the kinetic energy, W = −E_{k1} = −${e1} J. Once the cart is at rest, the brake does no more work.`,
      },
    },
    brake: {
      F: 'Braking force',
      FHint: (a) => `a = F/m = ${a} m/s² — the same for all three cars`,
      m: 'Mass of a car',
      mHint: 'all three cars are identical',
      carName: (k) => `${k} km/h`,
      carSub: (E, s) => `E_{k} = ${E} · stopping distance ${s} m`,
      laneAria: (k, s) => `${k} km/h — ${s} m`,
      readouts: { ratio: 'Stopping distances' },
      ratioSub: 'speeds 1 : 2 : 3 — energies 1 : 4 : 9',
      formula: {
        tag: 'Stopping distance',
        general: 'F · s = m·v² / 2   ⇒   s = m·v² / (2F)',
        filled: (m, F, s) => `90 km/h = 25 m/s:  ${m} · 25² / (2 · ${F}) = ${s} m`,
        result: 's₁ : s₂ : s₃ = 1 : 4 : 9',
      },
      energy: { title: 'Energy → heat', ek: 'E_{k}', q: 'heat Q' },
      graph: {
        title: 'Graph: E_{k}(x)',
        label: 'Graph of the cars’ kinetic energy against distance travelled',
        x: 'x, m',
        y: 'Eₖ, kJ',
        note: (F) => `All three lines are parallel: every metre each car loses F · 1 m = ${F} kJ of energy. To lose 4 times more energy a car needs a 4 times longer distance.`,
      },
      legend: { skid: 'skid marks', line: 'brakes applied', F: 'braking force F' },
      chipReal: 'Real time',
      chipFast: (k) => `Time sped up ×${k}`,
      brakeLine: 'brakes',
      axisX: 'x, m',
      distTag: (s) => `${s} m`,
      sceneLabel: (list) => `A three-lane road from above. Stopping distances of cars braked with the same force: ${list}.`,
      explain: {
        idle: (m, F) =>
          `Three identical cars (${m} kg) brake from the same line with the same force F = ${F} kN. Their speeds are 30, 60 and 90 km/h. How many times farther does the 90 km/h car travel before it stops than the 30 km/h car?`,
        braking: (F) =>
          `The braking force points against the motion and does negative work: every metre each car loses ${F} kJ of kinetic energy. That energy turns into heat — the brakes get hot.`,
        first: (s, E) => `The 30 km/h car stopped after ${s} m: all of its kinetic energy (${E}) has turned into heat. The others have more energy — they are still moving.`,
        second: (s) => `The 60 km/h car stopped after ${s} m — 4 times farther: its speed was 2 times greater, so its kinetic energy was 4 times greater.`,
        done: (s1, s2, s3) =>
          `Stopping distances ${s1} m, ${s2} m and ${s3} m — a ratio of 1 : 4 : 9. Since F·s = mv²/2, s ~ v²: three times the speed means nine times the stopping distance. Keep to the speed limit!`,
      },
    },
  },
};

export default function KineticEnergy() {
  const T = useSimText(TEXT);
  const tab = (id) => ({ label: T.card.tabs[id].label, sub: <Rich>{T.card.tabs[id].sub}</Rich> });
  const tabs = [
    { id: 'explore', ...tab('explore'), icon: Zap, render: () => <ExploreSim T={T} /> },
    { id: 'work', ...tab('work'), icon: Rocket, render: () => <WorkSim T={T} /> },
    { id: 'brake', ...tab('brake'), icon: OctagonMinus, render: () => <BrakeSim T={T} /> },
  ];
  const facts = { title: T.facts.title, items: T.facts.items.map((f) => ({ term: f.term, text: <Rich>{f.text}</Rich> })) };
  return <SimCard eyebrow={T.card.eyebrow} title={T.card.title} tabsLabel={T.card.tabsLabel} tabs={tabs} facts={facts} icon={Gauge} idPrefix="kinen" />;
}
