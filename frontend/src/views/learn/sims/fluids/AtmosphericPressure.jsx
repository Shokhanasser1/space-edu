import { CircleDot, Cloud, FlaskConical, Mountain } from 'lucide-react';

import SimCard from '../kit/SimCard';
import { useSimText } from '../kit/lang';
import TorricelliSim from './AtmosphericPressure.torricelli';
import AltitudeSim from './AtmosphericPressure.altitude';
import MagdeburgSim from './AtmosphericPressure.magdeburg';

/**
 * Lesson "Atmosfera bosimi" (fluids and gases, lesson 4):
 *  1. Torricelli's tube — fill, close, turn over into a dish, open: the
 *     column stops where ρgh = p₀ (mercury 760 mm, water 10.34 m, oil
 *     11.48 m at p₀ = 101 300 Pa), whatever the tilt or width of the tube;
 *     a p₀ slider plays the barometer;
 *  2. climbing — sea level, Tashkent 450 m, Big Chimgan 3309 m, Everest
 *     8849 m, an airliner at 10 km, with an aneroid, a mercury barometer and
 *     a sample of thinning air; model p = p₀·e^(−h/8 km) (101.3, 95.8,
 *     67.0, 33.5, 29.0 kPa) beside the "1 mm Hg per 12 m" rule;
 *  3. Magdeburg hemispheres — pump the air out, F = (p₀ − p)·πR²
 *     (R = 25 cm: S = 0.196 m², F ≈ 19.9 kN), teams of horses at ≈ 1 kN
 *     each (a stated assumption) need more than F to split them.
 */

const TEXT = {
  uz: {
    mm: 'mm',
    cm: 'cm',
    Pa: 'Pa',
    kPa: 'kPa',
    N: 'N',
    kN: 'kN',
    kg: 'kg',
    kgm3: 'kg/m³',
    m2: 'm²',
    mmHg: 'mm sim. ust.',
    card: {
      eyebrow: 'Virtual laboratoriya · Suyuqlik va gazlar',
      title: 'Atmosfera bosimi',
      tabsLabel: 'Tajribani tanlang',
      tabs: {
        torr: { label: 'Torrichelli tajribasi', sub: 'p₀ = ρ·g·h' },
        alt: { label: 'Balandlik va bosim', sub: 'p = p₀·e^(−h/H)' },
        mag: { label: 'Magdeburg yarim sharlari', sub: 'F = Δp·πR²' },
      },
    },
    common: { start: 'Boshlash', pause: "To'xtatish", resume: 'Davom etish', again: 'Yana boshlash', reset: 'Qayta' },
    facts: {
      title: 'Eslab qoling',
      items: [
        {
          term: 'Atmosfera bosimi',
          text: "Yerni o'rab turgan havo qatlamining og'irligi tufayli hosil bo'ladi va hamma jismlarga hamma tomondan bir xil bosadi. Normal atmosfera bosimi p₀ = 760 mm sim. ust. ≈ 101 300 Pa; 1 mm sim. ust. ≈ 133.3 Pa.",
        },
        {
          term: 'Torrichelli tajribasi (1643)',
          text: "simob ustuni ≈ 760 mm da to'xtaydi, tepada vakuum qoladi: p₀ = ρ_sim·g·h. Suv bilan ustun ≈ 10.3 m bo'lardi. Ustun balandligi naychaning qiyaligi va kengligiga bog'liq emas.",
        },
        {
          term: 'Barometr',
          text: "atmosfera bosimini o'lchaydi: simobli barometr va aneroid (havosi so'rilgan gofrirlangan metall quticha). Balandlikka chiqqan sari bosim kamayadi: Yer yaqinida har 12 m da ≈ 1 mm sim. ust.",
        },
        {
          term: 'Kundalik hayotda',
          text: "Magdeburg yarim sharlari (Otto fon Gerike, 1654), rezina so'rg'ich; ichimlik naychasi va shpritsda biz bosimni kamaytiramiz — suyuqlikni atmosfera bosimi itaradi; samolyot ko'tarilganda yoki qo'nganda quloq «bitadi».",
        },
      ],
    },
    torr: {
      liquidLabel: "Suyuqlik (har biri uchun o'z naychasi)",
      liquids: {
        hg: { Nom: 'Simob', nom: 'simob', short: 'simob', ins: 'simob', dat: 'simobga' },
        water: { Nom: 'Suv', nom: 'suv', short: 'suv', ins: 'suv', dat: 'suvga' },
        oil: { Nom: "O'simlik yog'i", nom: "o'simlik yog'i", short: "yog'", ins: "o'simlik yog'i", dat: "o'simlik yog'iga" },
      },
      liquidSub: (rho, h) => `ρ = ${rho} kg/m³ · h ≈ ${h}`,
      explain: {
        idle: (o) =>
          `Bir uchi berk, uzunligi ${o.L} bo'lgan shisha naycha va ${o.liq} solingan idish. «Boshlash»ni bosing: Torrichelli kabi naychani ${o.ins} bilan to'ldiramiz, ag'darib, idishga botiramiz.`,
        fill: (o) => `Naychani to'la ${o.ins} bilan to'ldiryapmiz — ichida birorta ham havo pufakchasi qolmasligi kerak.`,
        close: () => "Naychaning ochiq uchini barmoq bilan mahkam berkitamiz — endi suyuqlik to'kilmaydi.",
        invert: (o) => `Naychani ag'darib, berkitilgan uchini idishdagi ${o.dat} botiramiz.`,
        release: () => 'Naychaning uchi suyuqlik ichida — endi barmoqni olamiz...',
        drop: (o) => `${o.Liq} pastga tusha boshladi — lekin hammasi idishga to'kilib ketmaydi! Ustun tebranib, bir balandlikda to'xtaydi.`,
        doneHg: (o) =>
          `Simob ustuni h = ${o.h} da to'xtadi, tepasida esa havosiz bo'shliq — vakuum qoldi. Idishdagi simob sirtiga havo p₀ bosim bilan bosadi, naychadagi ustun esa shu sathda ρgh bosim beradi. Ular teng: p₀ = ρgh = ${o.rho}·${o.g}·${o.hm} ≈ ${o.p} Pa.`,
        doneLight: (o) =>
          `${o.Liq} ustuni h ≈ ${o.h} da to'xtadi! ${o.Liq} simobdan ${o.ratio} marta yengil, shuning uchun ustun shuncha marta baland: h = p₀/(ρg) = ${o.p}/(${o.rho}·${o.g}) ≈ ${o.h}. Bunday barometr 3–4 qavatli uydek baland bo'lardi.`,
        tilt: (o) =>
          `Naycha α = ${o.a}° ga qiyalatildi. Ustun naycha bo'ylab uzaydi: l = h/cosα = ${o.l}, ammo uning vertikal balandligi o'sha-o'sha — ${o.h}. Bosim faqat vertikal balandlikka bog'liq.`,
        full: (o) =>
          `Naycha juda qiya: uning berk uchi atigi ${o.y} balandlikda, ya'ni ${o.h} dan past. ${o.Liq} naychani butunlay to'ldirdi, vakuum yo'qoldi; endi u naycha tubiga p₀ − ρgy ≈ ${o.pt} kPa bosim bilan bosib turibdi.`,
        width: (o) =>
          `Naycha diametri d = ${o.d} mm. Ustundagi ${o.liq} massasi o'zgardi (m = ${o.m}), lekin balandligi yana ${o.h}. Ustun og'irligi ham, havoning bosim kuchi p₀·S ham S ga proporsional (ikkalasi ${o.W} N), shuning uchun h naycha kengligiga bog'liq emas.`,
        p0: (o) =>
          `Atmosfera bosimi p₀ = ${o.mm} mm sim. ust. (${o.kpa} kPa) — ustun balandligi endi ${o.h}. Simobli barometr shunday ishlaydi: ustun balandligi atmosfera bosimini ko'rsatadi.`,
      },
      readouts: {
        h: 'Ustun balandligi',
        hWait: (L) => `Naycha uzunligi L = ${L} m. Tajribani boshlang.`,
        hAlong: (l) => `Vertikal bo'yicha; naycha bo'ylab l = ${l}`,
        hFull: "Naycha to'liq to'ldi — vakuum yo'q",
        p0: 'Atmosfera bosimi',
        p0Sub: (mm, pa) => `= ${mm} mm sim. ust. ≈ ${pa} Pa`,
        formula: 'Formula',
        mmNote: (v) => `1 mm sim. ust. = ρ_sim·g·1 mm ≈ ${v} Pa`,
        weight: "Ustun og'irligi",
        weightSub: (S, m) => `S = ${S} cm² · m = ρSh = ${m} kg`,
        p0S: (F) => `Havo bosim kuchi p₀·S = ${F} N — teng`,
        p0SFull: (F) => `p₀·S = ${F} N — qolganini naycha tubi ko'taradi`,
      },
      tilt: 'Naychaning qiyaligi',
      tiltHint: (l) => `Naycha bo'ylab l = h/cosα = ${l}; vertikal balandlik o'zgarmaydi`,
      width: 'Naychaning ichki diametri',
      widthHint: (S) => `Kesim yuzasi S = πd²/4 = ${S} cm² (rasmda kattalashtirilgan)`,
      p0: 'Atmosfera bosimi',
      p0Hint: {
        high: "Dengiz sathida yuqori bosim (antisiklon) — odatda ochiq, quruq havo",
        normal: 'Normal atmosfera bosimiga yaqin',
        alt: (h) => `Bunday bosim o'rtacha ≈ ${h} m balandlikda bo'ladi (yoki kuchli siklonda)`,
      },
      steps: {
        title: 'Tajriba bosqichlari',
        fill: (o) => `Bir uchi berk naychani to'la ${o.ins} bilan to'ldiramiz.`,
        close: () => 'Ochiq uchini barmoq bilan berkitamiz.',
        invert: (o) => `Naychani ag'darib, uchini idishdagi ${o.dat} botiramiz.`,
        release: (o) => `Barmoqni olamiz: ustun ${o.h} gacha tushadi, tepada vakuum qoladi.`,
        note: "Torrichelli (1643) simobni tanlagan: u suvdan 13.6 marta og'ir, shuning uchun 1 m li naycha yetarli. Suv bilan 10 m dan uzun naycha kerak bo'lardi.",
      },
      legend: { atm: 'atmosfera bosimi p₀', col: 'ustun bosimi ρgh', vac: "vakuum (havosiz bo'shliq)", h: 'ustun balandligi h' },
      chipSlow: "Sekinlashtirib ko'rsatilmoqda",
      chipP0: (mm) => `p₀ = ${mm} mm sim. ust.`,
      chipKpa: (kpa) => ` = ${kpa} kPa`,
      sceneLabel: (liq, h, mm) => `Torrichelli tajribasi (${liq}): ustun balandligi ${h}, atmosfera bosimi ${mm} mm sim. ust.`,
      hTag: (h) => `h = ${h}`,
      tag: { p0: 'p₀', col: 'ρgh = p₀', vac: 'vakuum · p = 0', full: (p) => `p = ${p} kPa` },
      panel: {
        title: 'Bir xil p₀ ni tutib turadigan ustunlar',
        house: '3 qavatli uy',
        person: 'odam',
        note: "Suyuqlik qancha yengil bo'lsa, ustun shuncha baland: h = p₀/(ρg)",
      },
    },
    alt: {
      placesLabel: 'Joyni tanlang',
      places: { sea: 'Dengiz sathi', tashkent: 'Toshkent', chimgan: 'Katta Chimyon', everest: 'Everest', plane: 'Samolyot' },
      placesShort: { sea: '0 m', tashkent: 'Toshkent', chimgan: 'Chimyon', everest: 'Everest', plane: '10 km' },
      placeSub: (h, mm) => `${h} m · ${mm} mm sim. ust.`,
      placeTag: (name, h) => `${name} · ${h} m`,
      explain: {
        sea: (o) =>
          `Dengiz sathida ustimizdagi havo qatlami eng qalin — bosim normal: p₀ ≈ ${o.kpa} kPa = ${o.mm} mm sim. ust. Aneroid strelkasi ham, simob ustuni ham ${o.mm} mm ni ko'rsatadi.`,
        tashkent: (o) =>
          `Toshkent dengiz sathidan ≈ 450 m balandda. Bosim ≈ ${o.mm} mm sim. ust. «Har 12 m da ≈ 1 mm» qoidasi ham yaqin natija beradi: 760 − 450/12 ≈ ${o.rule} mm. Shuning uchun Toshkentda barometr odatda 760 emas, ≈ 720 mm atrofini ko'rsatadi.`,
        chimgan: (o) =>
          `Katta Chimyon cho'qqisi 3309 m balandlikda. Bosim ≈ ${o.mm} mm sim. ust. — dengiz sathidagining ${o.pct} %. Havo siyrak: har nafasda kislorod kamroq, suv esa ≈ ${o.tb} °C da qaynaydi.`,
        everest: (o) =>
          `Everest — 8849 m, Yerning eng baland cho'qqisi. Bosim ≈ ${o.mm} mm sim. ust., dengiz sathidagidan qariyb 3 marta kam. Alpinistlar kislorod ballon bilan chiqishadi, suv esa ≈ ${o.tb} °C da qaynaydi.`,
        plane: (o) =>
          `Samolyot ≈ 10 km balandlikda uchadi: tashqarida bosim ≈ ${o.kpa} kPa (${o.mm} mm sim. ust.). Salonda bosim ≈ 75–80 kPa da ushlab turiladi. Ko'tarilish va qo'nishda bosim o'zgaradi, quloq pardasining ikki tomonidagi bosim farqi tufayli quloq «bitadi» — yutinish yoki esnash bosimni tenglashtiradi.`,
        custom: (o) => `h = ${o.h} m balandlikda bosim p = p₀·e^(−h/H) ≈ ${o.kpa} kPa = ${o.mm} mm sim. ust., ya'ni dengiz sathidagining ${o.pct} %.`,
        up: () => "Ko'tarilyapmiz: ustimizdagi havo qatlami yupqalashmoqda, bosim kamaymoqda. Aneroid qutichasi kengayib, strelkani chapga buradi; simob ustuni pasaymoqda.",
        down: () => "Pastga tushyapmiz: bosim ortmoqda — aneroid qutichasi siqilib, strelka o'ngga buriladi; simob ustuni ko'tarilmoqda.",
      },
      readouts: {
        h: 'Balandlik',
        hSub: 'dengiz sathidan',
        p: 'Atmosfera bosimi',
        pSub: (mm, pct) => `${mm} mm sim. ust. · p₀ ning ${pct} %`,
        boil: (t) => `Suv ≈ ${t} °C da qaynaydi`,
        rho: 'Havo zichligi',
        rhoSub: (r0, r) => `Dengiz sathida ${r0} kg/m³; bu yerda 1 m³ havo ${r} kg`,
        formula: 'Model',
        rule: (h, v) => `Yer yaqinida har 12 m da ≈ 1 mm: 760 − ${h}/12 ≈ ${v} mm`,
        model: "Harorat 0 °C da o'zgarmas deb olingan; H = 8 km",
      },
      slider: 'Balandlik',
      sliderHint: "Joyni tanlang yoki balandlikni o'zingiz o'rnating",
      table: {
        title: 'Turli balandlikdagi bosim',
        row: (name, h) => `${name} (${h} m)`,
        note: "Modelda har 8 km da bosim e ≈ 2.7 marta kamayadi; ≈ 5.5 km dan pastda butun havoning yarmi joylashgan.",
      },
      graph: {
        title: 'Grafik: p(h)',
        model: 'p = p₀·e^(−h/8 km)',
        rule: '«har 12 m da 1 mm» qoidasi',
        x: 'h, km',
        y: 'p, mm sim. ust.',
        label: "Atmosfera bosimining balandlikka bog'liqlik grafigi",
        note: "Qoida (uzuq chiziq) faqat Yer yaqinida to'g'ri: balandda bosim tobora sekin kamayadi, chunki havo siyraklashadi.",
      },
      legend: { air: 'havo molekulalari', marker: "havo shari — o'lchov joyi", h: 'balandlik h' },
      chipModel: 'Model: p = p₀·e^(−h/8 km)',
      chipNow: (h, mm) => `${h} m · ${mm} mm sim. ust.`,
      sceneLabel: (h, kpa, mm) => `Balandlik ${h} m, atmosfera bosimi ${kpa} kPa (${mm} mm sim. ust.).`,
      axisKm: 'km',
      inst: { aneroid: 'Barometr-aneroid', box: 'aneroid qutichasi', mercury: 'Simobli barometr', sample: '1 litr havo', sampleSub: (r) => `ρ = ${r} kg/m³` },
    },
    mag: {
      btn: { pump: "Havoni so'rib olish", pumpStop: "Nasosni to'xtatish", letIn: 'Havo kiritish', pull: (n) => `Tortish (${n} + ${n} ot)` },
      explain: {
        idle: () =>
          "Ikki yarim shar bir-biriga zich taqab qo'yilgan. Ichida ham, tashqarida ham havo bosimi bir xil — p₀, shuning uchun ularni qo'lda osongina ajratish mumkin. «Havoni so'rib olish»ni bosing.",
        pumping: (o) =>
          `Nasos ichkaridagi havoni so'rmoqda: p = ${o.p} kPa. Ichkaridan bosim kamaymoqda, tashqaridan esa havo hamon p₀ bilan bosadi — yarim sharlarni siquvchi kuch F = (p₀ − p)·πR² o'smoqda: ${o.F} kN.`,
        partial: (o) => `Ichkarida hali havo bor: p = ${o.p} kPa. Siquvchi kuch F = (p₀ − p)·S ≈ ${o.F} kN. Ajratish uchun har tomonga kamida ${o.nMin} ta ot kerak.`,
        vacuum: (o) =>
          `Ichkarida havo qolmadi. Endi yarim sharlarni faqat tashqi havo siqib turibdi: F = p₀·πR² = ${o.p0} Pa · ${o.S} m² ≈ ${o.F} kN — bu ${o.kg} kg yukning og'irligiga teng! Ajratish uchun har tomonga kamida ${o.nMin} ta ot kerak.`,
        pull: (o) => `Otlar tortmoqda: har tomondan T = ${o.n} × 1 kN = ${o.T} kN.`,
        held: (o) =>
          `Ajrata olishmadi: T = ${o.T} kN, bu F = ${o.F} kN dan kichik. Kamida ${o.nMin} ta ot kerak. Qiziq: bir tomondagi otlar o'rniga yarim sharni daraxtga bog'lasa ham bo'lardi — daraxt ham xuddi shunday kuch bilan tortadi.`,
        apart: (o) => `Gup! T = ${o.T} kN > F = ${o.F} kN — yarim sharlar ajraldi va ichkariga havo otilib kirdi.`,
        apartEasy: (o) => `Ichkarida havo bor edi, siquvchi kuch atigi ${o.F} kN — yarim sharlar osongina ajraldi. Avval havoni so'rib oling!`,
        letIn: () => "Jo'mrak ochildi: havo ichkariga kirmoqda, bosimlar tenglashib, siquvchi kuch yo'qolmoqda.",
      },
      readouts: {
        S: 'Kesim yuzasi',
        Ssub: (cm, m) => `R = ${cm} cm · S = π·${m}²`,
        p: 'Ichidagi bosim',
        pSub: (p0, dp) => `Tashqarida p₀ = ${p0} kPa · Δp = ${dp} kPa`,
        F: 'Siquvchi kuch',
        Fkg: (kg) => `≈ ${kg} kg yukning og'irligi`,
        horses: 'Kerakli otlar, har tomonga',
        horsesSub: (n, T) => `Hozir ${n} ta · T = ${T} kN`,
        enough: 'Yetadi: T > F',
        notEnough: 'Yetmaydi: T ≤ F',
      },
      horseUnit: () => 'ta ot',
      radius: 'Yarim shar radiusi',
      radiusHint: (S) => `S = πR² = ${S} m²`,
      horses: 'Har tomondagi otlar',
      horsesHint: (n) => `Taxmin: 1 ot ≈ 1 kN kuch bilan tortadi, demak T = ${n} kN`,
      daily: {
        title: 'Kundalik hayotda',
        cup: (S, F, kg) => `Rezina so'rg'ich (R = 4 cm, S = ${S} cm²): F = p₀·S ≈ ${F} N — u ${kg} kg yukni tutib tura oladi.`,
        hand: (F) => `Kaftimizga (≈ 100 cm²) havo ≈ ${F} N kuch bilan bosadi, lekin biz buni sezmaymiz: tanamiz ichidagi bosim ham shuncha.`,
        straw: (dp, h) => `Ichimlik naychasi: og'izdagi bosimni atigi ${dp} kPa ga kamaytirsak, suvni atmosfera bosimi h = Δp/(ρg) ≈ ${h} cm ga ko'taradi.`,
        syringe: (h) => `Shprits va so'rib oluvchi nasos ham shunday ishlaydi: porshen ostida bosim kamayadi, suyuqlikni havo itaradi. Shuning uchun nasos suvni ≈ ${h} m dan baland so'rib chiqara olmaydi.`,
      },
      graph: {
        title: 'Grafik: F(R)',
        vac: 'havosiz (p = 0)',
        now: 'hozirgi p',
        T: (n) => `otlar: T = ${n} kN`,
        x: 'R, cm',
        y: 'F, kN',
        label: "Siquvchi kuchning radiusga bog'liqlik grafigi",
        note: "F ∝ R²: radius 2 marta ortsa, kuch 4 marta ortadi. Qizil chiziq sariqdan yuqorida bo'lsa, otlar yarim sharlarni ajrata olmaydi.",
      },
      legend: { atm: 'tashqi havo bosimi', F: 'siquvchi kuch F', T: 'otlarning kuchi T', inside: 'ichidagi havo' },
      chipP: (p) => `Ichkarida p = ${p} kPa`,
      chipHorse: '1 ot ≈ 1 kN (taxmin)',
      sceneLabel: (R, p, F, n) => `Magdeburg yarim sharlari: radius ${R} cm, ichidagi bosim ${p} kPa, siquvchi kuch ${F} kN, har tomonda ${n} ta ot.`,
      tag: { F: (F) => `F = ${F} kN`, T: (n) => `T = ${n} kN`, team: (n) => `${n} ta ot`, pump: 'nasos' },
    },
  },

  ru: {
    mm: 'мм',
    cm: 'см',
    Pa: 'Па',
    kPa: 'кПа',
    N: 'Н',
    kN: 'кН',
    kg: 'кг',
    kgm3: 'кг/м³',
    m2: 'м²',
    mmHg: 'мм рт. ст.',
    card: {
      eyebrow: 'Виртуальная лаборатория · Жидкости и газы',
      title: 'Атмосферное давление',
      tabsLabel: 'Выберите опыт',
      tabs: {
        torr: { label: 'Опыт Торричелли', sub: 'p₀ = ρ·g·h' },
        alt: { label: 'Высота и давление', sub: 'p = p₀·e^(−h/H)' },
        mag: { label: 'Магдебургские полушария', sub: 'F = Δp·πR²' },
      },
    },
    common: { start: 'Старт', pause: 'Пауза', resume: 'Продолжить', again: 'Ещё раз', reset: 'Сброс' },
    facts: {
      title: 'Запомните',
      items: [
        {
          term: 'Атмосферное давление',
          text: 'создаётся весом воздушной оболочки Земли и действует на все тела одинаково во всех направлениях. Нормальное атмосферное давление p₀ = 760 мм рт. ст. ≈ 101 300 Па; 1 мм рт. ст. ≈ 133,3 Па.',
        },
        {
          term: 'Опыт Торричелли (1643)',
          text: 'столб ртути останавливается на высоте ≈ 760 мм, над ним остаётся вакуум: p₀ = ρ_рт·g·h. Столб воды был бы ≈ 10,3 м. Высота столба не зависит от наклона и ширины трубки.',
        },
        {
          term: 'Барометр',
          text: 'измеряет атмосферное давление: ртутный барометр и анероид (гофрированная металлическая коробочка, из которой откачан воздух). С высотой давление падает: у земли примерно на 1 мм рт. ст. на каждые 12 м.',
        },
        {
          term: 'В жизни',
          text: 'магдебургские полушария (Отто фон Герике, 1654), резиновая присоска; в соломинке и шприце мы уменьшаем давление — жидкость вталкивает атмосферное давление; при взлёте и посадке самолёта «закладывает» уши.',
        },
      ],
    },
    torr: {
      liquidLabel: 'Жидкость (для каждой своя трубка)',
      liquids: {
        hg: { Nom: 'Ртуть', nom: 'ртуть', short: 'ртуть', ins: 'ртутью', dat: 'ртуть' },
        water: { Nom: 'Вода', nom: 'вода', short: 'вода', ins: 'водой', dat: 'воду' },
        oil: { Nom: 'Растительное масло', nom: 'масло', short: 'масло', ins: 'маслом', dat: 'масло' },
      },
      liquidSub: (rho, h) => `ρ = ${rho} кг/м³ · h ≈ ${h}`,
      explain: {
        idle: (o) =>
          `Стеклянная трубка длиной ${o.L}, запаянная с одного конца, и чаша (${o.liq}). Нажмите «Старт»: как Торричелли, заполним трубку ${o.ins}, перевернём и опустим в чашу.`,
        fill: (o) => `Заполняем трубку ${o.ins} доверху — внутри не должно остаться ни одного пузырька воздуха.`,
        close: () => 'Плотно закрываем открытый конец пальцем — теперь жидкость не выльется.',
        invert: (o) => `Переворачиваем трубку и опускаем закрытый пальцем конец в ${o.dat} в чаше.`,
        release: () => 'Конец трубки под поверхностью жидкости — убираем палец...',
        drop: (o) => `${o.Liq} опускается — но выливается не вся! Столб колеблется и останавливается на некоторой высоте.`,
        doneHg: (o) =>
          `Столб ртути остановился на высоте h = ${o.h}, а над ним осталась пустота — вакуум. На ртуть в чаше давит воздух с давлением p₀, а столб в трубке на этом уровне создаёт давление ρgh. Они равны: p₀ = ρgh = ${o.rho}·${o.g}·${o.hm} ≈ ${o.p} Па.`,
        doneLight: (o) =>
          `Столб остановился на высоте h ≈ ${o.h}! Эта жидкость в ${o.ratio} раза легче ртути, поэтому столб во столько же раз выше: h = p₀/(ρg) = ${o.p}/(${o.rho}·${o.g}) ≈ ${o.h}. Такой барометр был бы высотой с 3–4-этажный дом.`,
        tilt: (o) =>
          `Трубку наклонили на α = ${o.a}°. Столб вдоль трубки стал длиннее: l = h/cosα = ${o.l}, но его высота по вертикали та же — ${o.h}. Давление зависит только от высоты по вертикали.`,
        full: (o) =>
          `Трубка наклонена так сильно, что её запаянный конец оказался на высоте всего ${o.y} — ниже ${o.h}. Жидкость заполнила трубку целиком, вакуум исчез; теперь она давит на дно трубки с давлением p₀ − ρgy ≈ ${o.pt} кПа.`,
        width: (o) =>
          `Диаметр трубки d = ${o.d} мм. Масса жидкости в столбе изменилась (m = ${o.m}), а высота осталась ${o.h}. И вес столба, и сила давления воздуха p₀·S пропорциональны площади S (обе по ${o.W} Н), поэтому h не зависит от ширины трубки.`,
        p0: (o) =>
          `Атмосферное давление p₀ = ${o.mm} мм рт. ст. (${o.kpa} кПа) — высота столба теперь ${o.h}. Так работает ртутный барометр: высота столба показывает атмосферное давление.`,
      },
      readouts: {
        h: 'Высота столба',
        hWait: (L) => `Длина трубки L = ${L} м. Начните опыт.`,
        hAlong: (l) => `По вертикали; вдоль трубки l = ${l}`,
        hFull: 'Трубка заполнена целиком — вакуума нет',
        p0: 'Атмосферное давление',
        p0Sub: (mm, pa) => `= ${mm} мм рт. ст. ≈ ${pa} Па`,
        formula: 'Формула',
        mmNote: (v) => `1 мм рт. ст. = ρ_рт·g·1 мм ≈ ${v} Па`,
        weight: 'Вес столба',
        weightSub: (S, m) => `S = ${S} см² · m = ρSh = ${m} кг`,
        p0S: (F) => `Сила давления воздуха p₀·S = ${F} Н — равны`,
        p0SFull: (F) => `p₀·S = ${F} Н — остальное держит дно трубки`,
      },
      tilt: 'Наклон трубки',
      tiltHint: (l) => `Вдоль трубки l = h/cosα = ${l}; высота по вертикали не меняется`,
      width: 'Внутренний диаметр трубки',
      widthHint: (S) => `Площадь сечения S = πd²/4 = ${S} см² (на рисунке увеличено)`,
      p0: 'Атмосферное давление',
      p0Hint: {
        high: 'Повышенное давление у моря (антициклон) — обычно ясная, сухая погода',
        normal: 'Близко к нормальному атмосферному давлению',
        alt: (h) => `Такое давление в среднем бывает на высоте ≈ ${h} м (или в глубоком циклоне)`,
      },
      steps: {
        title: 'Этапы опыта',
        fill: (o) => `Заполняем запаянную с одного конца трубку ${o.ins} доверху.`,
        close: () => 'Закрываем открытый конец пальцем.',
        invert: (o) => `Переворачиваем трубку и опускаем её конец в ${o.dat} в чаше.`,
        release: (o) => `Убираем палец: столб опускается до ${o.h}, сверху остаётся вакуум.`,
        note: 'Торричелли (1643) взял ртуть: она в 13,6 раза тяжелее воды, поэтому хватает трубки длиной 1 м. С водой понадобилась бы трубка длиннее 10 м.',
      },
      legend: { atm: 'атмосферное давление p₀', col: 'давление столба ρgh', vac: 'вакуум (пустота)', h: 'высота столба h' },
      chipSlow: 'Показано замедленно',
      chipP0: (mm) => `p₀ = ${mm} мм рт. ст.`,
      chipKpa: (kpa) => ` = ${kpa} кПа`,
      sceneLabel: (liq, h, mm) => `Опыт Торричелли (${liq}): высота столба ${h}, атмосферное давление ${mm} мм рт. ст.`,
      hTag: (h) => `h = ${h}`,
      tag: { p0: 'p₀', col: 'ρgh = p₀', vac: 'вакуум · p = 0', full: (p) => `p = ${p} кПа` },
      panel: {
        title: 'Столбы, уравновешивающие одно и то же p₀',
        house: '3-этажный дом',
        person: 'человек',
        note: 'Чем легче жидкость, тем выше столб: h = p₀/(ρg)',
      },
    },
    alt: {
      placesLabel: 'Выберите место',
      places: { sea: 'Уровень моря', tashkent: 'Ташкент', chimgan: 'Большой Чимган', everest: 'Эверест', plane: 'Самолёт' },
      placesShort: { sea: '0 м', tashkent: 'Ташкент', chimgan: 'Чимган', everest: 'Эверест', plane: '10 км' },
      placeSub: (h, mm) => `${h} м · ${mm} мм рт. ст.`,
      placeTag: (name, h) => `${name} · ${h} м`,
      explain: {
        sea: (o) =>
          `На уровне моря слой воздуха над нами самый толстый — давление нормальное: p₀ ≈ ${o.kpa} кПа = ${o.mm} мм рт. ст. И стрелка анероида, и столб ртути показывают ${o.mm} мм.`,
        tashkent: (o) =>
          `Ташкент лежит на высоте ≈ 450 м над уровнем моря. Давление ≈ ${o.mm} мм рт. ст. Правило «≈ 1 мм на каждые 12 м» даёт близкий ответ: 760 − 450/12 ≈ ${o.rule} мм. Поэтому барометр в Ташкенте обычно показывает не 760, а около 720 мм.`,
        chimgan: (o) =>
          `Вершина Большого Чимгана — 3309 м. Давление ≈ ${o.mm} мм рт. ст. — ${o.pct} % от давления у моря. Воздух разрежен: в каждом вдохе меньше кислорода, а вода кипит при ≈ ${o.tb} °C.`,
        everest: (o) =>
          `Эверест — 8849 м, высочайшая вершина Земли. Давление ≈ ${o.mm} мм рт. ст., почти в 3 раза меньше, чем у моря. Альпинисты поднимаются с кислородными баллонами, а вода кипит при ≈ ${o.tb} °C.`,
        plane: (o) =>
          `Самолёт летит на высоте ≈ 10 км: снаружи давление ≈ ${o.kpa} кПа (${o.mm} мм рт. ст.). В салоне поддерживается ≈ 75–80 кПа. При наборе высоты и посадке давление меняется, и из-за разницы давлений по обе стороны барабанной перепонки «закладывает» уши — глотание или зевок выравнивают давление.`,
        custom: (o) => `На высоте h = ${o.h} м давление p = p₀·e^(−h/H) ≈ ${o.kpa} кПа = ${o.mm} мм рт. ст., то есть ${o.pct} % от давления у моря.`,
        up: () => 'Поднимаемся: слой воздуха над нами становится тоньше, давление падает. Коробочка анероида расширяется и поворачивает стрелку влево; столб ртути опускается.',
        down: () => 'Спускаемся: давление растёт — коробочка анероида сжимается, стрелка поворачивается вправо; столб ртути поднимается.',
      },
      readouts: {
        h: 'Высота',
        hSub: 'над уровнем моря',
        p: 'Атмосферное давление',
        pSub: (mm, pct) => `${mm} мм рт. ст. · ${pct} % от p₀`,
        boil: (t) => `Вода кипит при ≈ ${t} °C`,
        rho: 'Плотность воздуха',
        rhoSub: (r0, r) => `У моря ${r0} кг/м³; здесь 1 м³ воздуха весит ${r} кг`,
        formula: 'Модель',
        rule: (h, v) => `У земли ≈ 1 мм на 12 м: 760 − ${h}/12 ≈ ${v} мм`,
        model: 'Температура считается постоянной, 0 °C; H = 8 км',
      },
      slider: 'Высота',
      sliderHint: 'Выберите место или задайте высоту сами',
      table: {
        title: 'Давление на разных высотах',
        row: (name, h) => `${name} (${h} м)`,
        note: 'В модели давление уменьшается в e ≈ 2,7 раза на каждые 8 км; ниже ≈ 5,5 км находится половина всего воздуха.',
      },
      graph: {
        title: 'График: p(h)',
        model: 'p = p₀·e^(−h/8 км)',
        rule: 'правило «1 мм на 12 м»',
        x: 'h, км',
        y: 'p, мм рт. ст.',
        label: 'График зависимости атмосферного давления от высоты',
        note: 'Правило (пунктир) верно только у земли: на высоте давление падает всё медленнее, потому что воздух разрежается.',
      },
      legend: { air: 'молекулы воздуха', marker: 'воздушный шар — место измерения', h: 'высота h' },
      chipModel: 'Модель: p = p₀·e^(−h/8 км)',
      chipNow: (h, mm) => `${h} м · ${mm} мм рт. ст.`,
      sceneLabel: (h, kpa, mm) => `Высота ${h} м, атмосферное давление ${kpa} кПа (${mm} мм рт. ст.).`,
      axisKm: 'км',
      inst: { aneroid: 'Барометр-анероид', box: 'коробочка анероида', mercury: 'Ртутный барометр', sample: '1 литр воздуха', sampleSub: (r) => `ρ = ${r} кг/м³` },
    },
    mag: {
      btn: { pump: 'Откачать воздух', pumpStop: 'Остановить насос', letIn: 'Впустить воздух', pull: (n) => `Тянуть (${n} + ${n} лош.)` },
      explain: {
        idle: () =>
          'Два полушария плотно приложены друг к другу. Внутри и снаружи давление воздуха одинаковое — p₀, поэтому их легко разнять руками. Нажмите «Откачать воздух».',
        pumping: (o) =>
          `Насос откачивает воздух: p = ${o.p} кПа. Изнутри давление падает, а снаружи воздух по-прежнему давит с p₀ — сила, прижимающая полушария, F = (p₀ − p)·πR² растёт: ${o.F} кН.`,
        partial: (o) => `Внутри ещё есть воздух: p = ${o.p} кПа. Прижимающая сила F = (p₀ − p)·S ≈ ${o.F} кН. Чтобы разнять полушария, нужно не меньше ${o.nMin} лошадей с каждой стороны.`,
        vacuum: (o) =>
          `Воздуха внутри не осталось. Теперь полушария прижимает только наружный воздух: F = p₀·πR² = ${o.p0} Па · ${o.S} м² ≈ ${o.F} кН — это вес груза ${o.kg} кг! Нужно не меньше ${o.nMin} лошадей с каждой стороны.`,
        pull: (o) => `Лошади тянут: с каждой стороны T = ${o.n} × 1 кН = ${o.T} кН.`,
        held: (o) =>
          `Не получилось: T = ${o.T} кН меньше F = ${o.F} кН. Нужно не меньше ${o.nMin} лошадей. Интересно: лошадей с одной стороны можно заменить, привязав полушарие к дереву, — дерево тянет с такой же силой.`,
        apart: (o) => `Бах! T = ${o.T} кН > F = ${o.F} кН — полушария разлетелись, и внутрь со свистом ворвался воздух.`,
        apartEasy: (o) => `Внутри был воздух, прижимающая сила всего ${o.F} кН — полушария разошлись легко. Сначала откачайте воздух!`,
        letIn: () => 'Кран открыт: воздух входит внутрь, давления выравниваются, прижимающая сила исчезает.',
      },
      readouts: {
        S: 'Площадь сечения',
        Ssub: (cm, m) => `R = ${cm} см · S = π·${m}²`,
        p: 'Давление внутри',
        pSub: (p0, dp) => `Снаружи p₀ = ${p0} кПа · Δp = ${dp} кПа`,
        F: 'Прижимающая сила',
        Fkg: (kg) => `≈ вес груза ${kg} кг`,
        horses: 'Нужно лошадей с каждой стороны',
        horsesSub: (n, T) => `Сейчас ${n} · T = ${T} кН`,
        enough: 'Хватает: T > F',
        notEnough: 'Не хватает: T ≤ F',
      },
      horseUnit: (n) => {
        const k = Math.abs(Math.round(n)) % 100;
        const d = k % 10;
        if (k >= 11 && k <= 14) return 'лошадей';
        if (d === 1) return 'лошадь';
        if (d >= 2 && d <= 4) return 'лошади';
        return 'лошадей';
      },
      radius: 'Радиус полушария',
      radiusHint: (S) => `S = πR² = ${S} м²`,
      horses: 'Лошадей с каждой стороны',
      horsesHint: (n) => `Допущение: одна лошадь тянет с силой ≈ 1 кН, значит T = ${n} кН`,
      daily: {
        title: 'В жизни',
        cup: (S, F, kg) => `Резиновая присоска (R = 4 см, S = ${S} см²): F = p₀·S ≈ ${F} Н — она удержит груз ${kg} кг.`,
        hand: (F) => `На ладонь (≈ 100 см²) воздух давит с силой ≈ ${F} Н, но мы этого не чувствуем: давление внутри тела такое же.`,
        straw: (dp, h) => `Соломинка: стоит уменьшить давление во рту всего на ${dp} кПа, и атмосферное давление поднимет воду на h = Δp/(ρg) ≈ ${h} см.`,
        syringe: (h) => `Так же работают шприц и всасывающий насос: под поршнем давление падает, жидкость вталкивает воздух. Поэтому насос не может поднять воду выше ≈ ${h} м.`,
      },
      graph: {
        title: 'График: F(R)',
        vac: 'без воздуха (p = 0)',
        now: 'текущее p',
        T: (n) => `лошади: T = ${n} кН`,
        x: 'R, см',
        y: 'F, кН',
        label: 'График зависимости прижимающей силы от радиуса',
        note: 'F ∝ R²: при увеличении радиуса в 2 раза сила растёт в 4 раза. Если красная линия выше жёлтой, лошади полушария не разнимут.',
      },
      legend: { atm: 'давление наружного воздуха', F: 'прижимающая сила F', T: 'сила лошадей T', inside: 'воздух внутри' },
      chipP: (p) => `Внутри p = ${p} кПа`,
      chipHorse: '1 лошадь ≈ 1 кН (допущение)',
      sceneLabel: (R, p, F, n) => `Магдебургские полушария: радиус ${R} см, давление внутри ${p} кПа, прижимающая сила ${F} кН, по ${n} лошадей с каждой стороны.`,
      tag: { F: (F) => `F = ${F} кН`, T: (n) => `T = ${n} кН`, team: (n) => `${n} лош.`, pump: 'насос' },
    },
  },

  en: {
    mm: 'mm',
    cm: 'cm',
    Pa: 'Pa',
    kPa: 'kPa',
    N: 'N',
    kN: 'kN',
    kg: 'kg',
    kgm3: 'kg/m³',
    m2: 'm²',
    mmHg: 'mmHg',
    card: {
      eyebrow: 'Virtual lab · Fluids and gases',
      title: 'Atmospheric pressure',
      tabsLabel: 'Choose an experiment',
      tabs: {
        torr: { label: "Torricelli's experiment", sub: 'p₀ = ρ·g·h' },
        alt: { label: 'Height and pressure', sub: 'p = p₀·e^(−h/H)' },
        mag: { label: 'Magdeburg hemispheres', sub: 'F = Δp·πR²' },
      },
    },
    common: { start: 'Start', pause: 'Pause', resume: 'Resume', again: 'Run again', reset: 'Reset' },
    facts: {
      title: 'Remember',
      items: [
        {
          term: 'Atmospheric pressure',
          text: "comes from the weight of the Earth's blanket of air and presses on every body equally from all sides. Normal atmospheric pressure p₀ = 760 mmHg ≈ 101 300 Pa; 1 mmHg ≈ 133.3 Pa.",
        },
        {
          term: "Torricelli's experiment (1643)",
          text: 'a mercury column stops at ≈ 760 mm with a vacuum above it: p₀ = ρ_Hg·g·h. A water column would be ≈ 10.3 m. The height does not depend on the tilt or the width of the tube.',
        },
        {
          term: 'Barometer',
          text: 'measures atmospheric pressure: the mercury barometer and the aneroid (a corrugated metal box with the air pumped out). Pressure falls with height: near the ground by about 1 mmHg every 12 m.',
        },
        {
          term: 'In everyday life',
          text: 'the Magdeburg hemispheres (Otto von Guericke, 1654), a rubber suction cup; with a straw or a syringe we lower the pressure and the atmosphere pushes the liquid in; ears "pop" as a plane climbs or lands.',
        },
      ],
    },
    torr: {
      liquidLabel: 'Liquid (each with its own tube)',
      liquids: {
        hg: { Nom: 'Mercury', nom: 'mercury', short: 'mercury', ins: 'mercury', dat: 'mercury' },
        water: { Nom: 'Water', nom: 'water', short: 'water', ins: 'water', dat: 'water' },
        oil: { Nom: 'Vegetable oil', nom: 'oil', short: 'oil', ins: 'oil', dat: 'oil' },
      },
      liquidSub: (rho, h) => `ρ = ${rho} kg/m³ · h ≈ ${h}`,
      explain: {
        idle: (o) => `A glass tube ${o.L} long, closed at one end, and a dish of ${o.liq}. Press Start: like Torricelli, we fill the tube with ${o.ins}, turn it over and dip it into the dish.`,
        fill: (o) => `Filling the tube to the top with ${o.ins} — not a single air bubble may stay inside.`,
        close: () => 'Close the open end firmly with a finger, so nothing can pour out.',
        invert: (o) => `Turn the tube over and dip the closed-off end into the ${o.dat} in the dish.`,
        release: () => 'The end is under the surface — now take the finger away...',
        drop: (o) => `The ${o.liq} runs down — but not all of it pours out! The column swings and stops at a certain height.`,
        doneHg: (o) =>
          `The mercury column stopped at h = ${o.h}, leaving empty space above it — a vacuum. The air presses on the mercury in the dish with the pressure p₀, and the column in the tube presses at that level with ρgh. They are equal: p₀ = ρgh = ${o.rho}·${o.g}·${o.hm} ≈ ${o.p} Pa.`,
        doneLight: (o) =>
          `The column stopped at h ≈ ${o.h}! This liquid is ${o.ratio} times lighter than mercury, so the column is that many times taller: h = p₀/(ρg) = ${o.p}/(${o.rho}·${o.g}) ≈ ${o.h}. Such a barometer would be as tall as a 3–4 storey house.`,
        tilt: (o) =>
          `The tube is tilted by α = ${o.a}°. The column gets longer along the tube, l = h/cosα = ${o.l}, but its vertical height is the same ${o.h}. Pressure depends only on the vertical height.`,
        full: (o) =>
          `The tube is tilted so far that its closed end is only ${o.y} high — below ${o.h}. The liquid fills the whole tube and the vacuum is gone; it now presses on the closed end with p₀ − ρgy ≈ ${o.pt} kPa.`,
        width: (o) =>
          `Tube diameter d = ${o.d} mm. The mass of ${o.liq} in the column has changed (m = ${o.m}), but the height is still ${o.h}. Both the column's weight and the air's force p₀·S grow in proportion to the area S (both ${o.W} N), so h does not depend on the width of the tube.`,
        p0: (o) =>
          `Atmospheric pressure p₀ = ${o.mm} mmHg (${o.kpa} kPa) — the column is now ${o.h} high. That is how a mercury barometer works: the height of the column shows the atmospheric pressure.`,
      },
      readouts: {
        h: 'Column height',
        hWait: (L) => `Tube length L = ${L} m. Start the experiment.`,
        hAlong: (l) => `Vertical; along the tube l = ${l}`,
        hFull: 'The tube is full — no vacuum',
        p0: 'Atmospheric pressure',
        p0Sub: (mm, pa) => `= ${mm} mmHg ≈ ${pa} Pa`,
        formula: 'Formula',
        mmNote: (v) => `1 mmHg = ρ_Hg·g·1 mm ≈ ${v} Pa`,
        weight: 'Weight of the column',
        weightSub: (S, m) => `S = ${S} cm² · m = ρSh = ${m} kg`,
        p0S: (F) => `Force of the air p₀·S = ${F} N — equal`,
        p0SFull: (F) => `p₀·S = ${F} N — the closed end takes the rest`,
      },
      tilt: 'Tilt of the tube',
      tiltHint: (l) => `Along the tube l = h/cosα = ${l}; the vertical height stays`,
      width: 'Inner diameter of the tube',
      widthHint: (S) => `Cross-section S = πd²/4 = ${S} cm² (drawn enlarged)`,
      p0: 'Atmospheric pressure',
      p0Hint: {
        high: 'High pressure at sea level (anticyclone) — usually clear, dry weather',
        normal: 'Close to normal atmospheric pressure',
        alt: (h) => `This is the average pressure at ≈ ${h} m (or in a deep cyclone)`,
      },
      steps: {
        title: 'Steps of the experiment',
        fill: (o) => `Fill the tube, closed at one end, to the top with ${o.ins}.`,
        close: () => 'Close the open end with a finger.',
        invert: (o) => `Turn the tube over and dip its end into the ${o.dat} in the dish.`,
        release: (o) => `Remove the finger: the column drops to ${o.h}, leaving a vacuum on top.`,
        note: 'Torricelli (1643) chose mercury: it is 13.6 times heavier than water, so a 1 m tube is enough. With water the tube would have to be over 10 m long.',
      },
      legend: { atm: 'atmospheric pressure p₀', col: 'pressure of the column ρgh', vac: 'vacuum (empty space)', h: 'column height h' },
      chipSlow: 'Shown in slow motion',
      chipP0: (mm) => `p₀ = ${mm} mmHg`,
      chipKpa: (kpa) => ` = ${kpa} kPa`,
      sceneLabel: (liq, h, mm) => `Torricelli's experiment (${liq}): column height ${h}, atmospheric pressure ${mm} mmHg.`,
      hTag: (h) => `h = ${h}`,
      tag: { p0: 'p₀', col: 'ρgh = p₀', vac: 'vacuum · p = 0', full: (p) => `p = ${p} kPa` },
      panel: {
        title: 'Columns that balance the same p₀',
        house: '3-storey house',
        person: 'person',
        note: 'The lighter the liquid, the taller the column: h = p₀/(ρg)',
      },
    },
    alt: {
      placesLabel: 'Choose a place',
      places: { sea: 'Sea level', tashkent: 'Tashkent', chimgan: 'Big Chimgan', everest: 'Everest', plane: 'Airliner' },
      placesShort: { sea: '0 m', tashkent: 'Tashkent', chimgan: 'Chimgan', everest: 'Everest', plane: '10 km' },
      placeSub: (h, mm) => `${h} m · ${mm} mmHg`,
      placeTag: (name, h) => `${name} · ${h} m`,
      explain: {
        sea: (o) => `At sea level the layer of air above us is thickest — the pressure is normal: p₀ ≈ ${o.kpa} kPa = ${o.mm} mmHg. The aneroid's needle and the mercury column both show ${o.mm} mm.`,
        tashkent: (o) =>
          `Tashkent lies ≈ 450 m above sea level. The pressure is ≈ ${o.mm} mmHg. The rule "≈ 1 mm every 12 m" gives a close answer: 760 − 450/12 ≈ ${o.rule} mm. That is why a barometer in Tashkent usually shows about 720 mm, not 760.`,
        chimgan: (o) =>
          `The top of Big Chimgan is 3309 m high. The pressure is ≈ ${o.mm} mmHg — ${o.pct} % of that at sea level. The air is thin: every breath brings less oxygen, and water boils at ≈ ${o.tb} °C.`,
        everest: (o) =>
          `Everest — 8849 m, the highest peak on Earth. The pressure is ≈ ${o.mm} mmHg, almost 3 times less than at sea level. Climbers carry oxygen bottles, and water boils at ≈ ${o.tb} °C.`,
        plane: (o) =>
          `An airliner cruises at ≈ 10 km: outside the pressure is ≈ ${o.kpa} kPa (${o.mm} mmHg). The cabin is kept at ≈ 75–80 kPa. While climbing and landing the pressure changes, and the difference across the eardrum makes the ears "pop" — swallowing or yawning evens it out.`,
        custom: (o) => `At h = ${o.h} m the pressure is p = p₀·e^(−h/H) ≈ ${o.kpa} kPa = ${o.mm} mmHg, i.e. ${o.pct} % of that at sea level.`,
        up: () => 'Going up: the layer of air above us gets thinner and the pressure falls. The aneroid box swells and turns the needle to the left; the mercury column drops.',
        down: () => 'Going down: the pressure rises — the aneroid box is squeezed and the needle turns to the right; the mercury column rises.',
      },
      readouts: {
        h: 'Height',
        hSub: 'above sea level',
        p: 'Atmospheric pressure',
        pSub: (mm, pct) => `${mm} mmHg · ${pct} % of p₀`,
        boil: (t) => `Water boils at ≈ ${t} °C`,
        rho: 'Air density',
        rhoSub: (r0, r) => `At sea level ${r0} kg/m³; here 1 m³ of air has ${r} kg`,
        formula: 'Model',
        rule: (h, v) => `Near the ground ≈ 1 mm per 12 m: 760 − ${h}/12 ≈ ${v} mm`,
        model: 'The temperature is taken as constant, 0 °C; H = 8 km',
      },
      slider: 'Height',
      sliderHint: 'Pick a place or set the height yourself',
      table: {
        title: 'Pressure at different heights',
        row: (name, h) => `${name} (${h} m)`,
        note: 'In the model the pressure falls e ≈ 2.7 times every 8 km; half of all the air lies below ≈ 5.5 km.',
      },
      graph: {
        title: 'Graph: p(h)',
        model: 'p = p₀·e^(−h/8 km)',
        rule: 'the "1 mm per 12 m" rule',
        x: 'h, km',
        y: 'p, mmHg',
        label: 'Atmospheric pressure against height',
        note: 'The rule (dashed) holds only near the ground: higher up the pressure falls more and more slowly, because the air gets thinner.',
      },
      legend: { air: 'air molecules', marker: 'balloon — where we measure', h: 'height h' },
      chipModel: 'Model: p = p₀·e^(−h/8 km)',
      chipNow: (h, mm) => `${h} m · ${mm} mmHg`,
      sceneLabel: (h, kpa, mm) => `Height ${h} m, atmospheric pressure ${kpa} kPa (${mm} mmHg).`,
      axisKm: 'km',
      inst: { aneroid: 'Aneroid barometer', box: 'aneroid box', mercury: 'Mercury barometer', sample: '1 litre of air', sampleSub: (r) => `ρ = ${r} kg/m³` },
    },
    mag: {
      btn: { pump: 'Pump the air out', pumpStop: 'Stop the pump', letIn: 'Let air in', pull: (n) => `Pull (${n} + ${n} horses)` },
      explain: {
        idle: () =>
          'Two hemispheres fit tightly together. The air pressure is the same inside and outside — p₀ — so they come apart easily by hand. Press "Pump the air out".',
        pumping: (o) =>
          `The pump draws the air out: p = ${o.p} kPa. The pressure inside falls while the air outside still presses with p₀ — the force holding the halves together, F = (p₀ − p)·πR², grows: ${o.F} kN.`,
        partial: (o) => `There is still air inside: p = ${o.p} kPa. The holding force F = (p₀ − p)·S ≈ ${o.F} kN. Separating them takes at least ${o.nMin} horses on each side.`,
        vacuum: (o) =>
          `No air is left inside. Now only the air outside presses the halves together: F = p₀·πR² = ${o.p0} Pa · ${o.S} m² ≈ ${o.F} kN — the weight of ${o.kg} kg! It takes at least ${o.nMin} horses on each side.`,
        pull: (o) => `The horses pull: T = ${o.n} × 1 kN = ${o.T} kN on each side.`,
        held: (o) =>
          `They could not do it: T = ${o.T} kN is less than F = ${o.F} kN. At least ${o.nMin} horses are needed. Fun fact: the team on one side could be replaced by tying that hemisphere to a tree — the tree pulls back just as hard.`,
        apart: (o) => `Bang! T = ${o.T} kN > F = ${o.F} kN — the hemispheres fly apart and air rushes in.`,
        apartEasy: (o) => `There was air inside, the holding force was only ${o.F} kN — the halves came apart easily. Pump the air out first!`,
        letIn: () => 'The tap is open: air flows in, the pressures even out and the holding force disappears.',
      },
      readouts: {
        S: 'Cross-section',
        Ssub: (cm, m) => `R = ${cm} cm · S = π·${m}²`,
        p: 'Pressure inside',
        pSub: (p0, dp) => `Outside p₀ = ${p0} kPa · Δp = ${dp} kPa`,
        F: 'Holding force',
        Fkg: (kg) => `≈ the weight of ${kg} kg`,
        horses: 'Horses needed per side',
        horsesSub: (n, T) => `Now ${n} · T = ${T} kN`,
        enough: 'Enough: T > F',
        notEnough: 'Not enough: T ≤ F',
      },
      horseUnit: (n) => (Math.round(n) === 1 ? 'horse' : 'horses'),
      radius: 'Radius of the hemispheres',
      radiusHint: (S) => `S = πR² = ${S} m²`,
      horses: 'Horses on each side',
      horsesHint: (n) => `Assumption: one horse pulls with ≈ 1 kN, so T = ${n} kN`,
      daily: {
        title: 'In everyday life',
        cup: (S, F, kg) => `A rubber suction cup (R = 4 cm, S = ${S} cm²): F = p₀·S ≈ ${F} N — it can hold ${kg} kg.`,
        hand: (F) => `The air presses on your palm (≈ 100 cm²) with ≈ ${F} N, yet you do not feel it: the pressure inside your body is the same.`,
        straw: (dp, h) => `A drinking straw: lower the pressure in your mouth by just ${dp} kPa and the atmosphere pushes water up h = Δp/(ρg) ≈ ${h} cm.`,
        syringe: (h) => `A syringe and a suction pump work the same way: the pressure under the piston drops and the air pushes the liquid in. That is why such a pump cannot lift water higher than ≈ ${h} m.`,
      },
      graph: {
        title: 'Graph: F(R)',
        vac: 'no air (p = 0)',
        now: 'current p',
        T: (n) => `horses: T = ${n} kN`,
        x: 'R, cm',
        y: 'F, kN',
        label: 'Holding force against the radius',
        note: 'F ∝ R²: double the radius and the force grows 4 times. Where the red line is above the yellow one, the horses cannot split the hemispheres.',
      },
      legend: { atm: 'pressure of the air outside', F: 'holding force F', T: 'pull of the horses T', inside: 'air inside' },
      chipP: (p) => `Inside p = ${p} kPa`,
      chipHorse: '1 horse ≈ 1 kN (assumption)',
      sceneLabel: (R, p, F, n) => `Magdeburg hemispheres: radius ${R} cm, pressure inside ${p} kPa, holding force ${F} kN, ${n} horses on each side.`,
      tag: { F: (F) => `F = ${F} kN`, T: (n) => `T = ${n} kN`, team: (n) => `${n} horses`, pump: 'pump' },
    },
  },
};

export default function AtmosphericPressure() {
  const T = useSimText(TEXT);
  const tabs = [
    { id: 'torr', ...T.card.tabs.torr, icon: FlaskConical, render: () => <TorricelliSim T={T} /> },
    { id: 'alt', ...T.card.tabs.alt, icon: Mountain, render: () => <AltitudeSim T={T} /> },
    { id: 'mag', ...T.card.tabs.mag, icon: CircleDot, render: () => <MagdeburgSim T={T} /> },
  ];
  return <SimCard eyebrow={T.card.eyebrow} title={T.card.title} tabsLabel={T.card.tabsLabel} tabs={tabs} facts={T.facts} icon={Cloud} idPrefix="atm" />;
}
