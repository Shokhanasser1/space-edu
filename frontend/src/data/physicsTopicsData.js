/**
 * A lesson stays a bare title until it has a video that is about it.
 *
 * `videoUrl` reaches `TopicLesson.video_url` through
 * `scripts/export-learn-content.mjs`, and the lesson page plays it. The ones
 * added on 28 Aug 2026 are Khan Academy's Uzbek physics lessons — somebody
 * else's work, credited on screen from `src/data/videoCredits.js`.
 *
 * The rule PR #14 spent a branch restoring, and the one that matters here: a
 * video goes on a lesson only when it teaches that lesson. Not a neighbouring
 * topic, not one whose title merely sounds close. Most lessons below are still
 * bare, and their empty slot says a video is being made for them — which is
 * true, and is better than borrowing one.
 *
 * Every title is in three languages since 22 Oct 2026. `name` is the Uzbek
 * one, as on every other row of the learn tree; until then it held the English
 * title, so a pupil reading in Uzbek or Russian got a list in English. The
 * English moved to `nameEn` unchanged, and the exporter derives the slug from
 * it, so not one slug — and not one progress row — moved with the name.
 */
import { kinematicsLessonText } from './lessonText/physicsKinematics.js';

/**
 * A lesson whose text has been written, in all three languages.
 *
 * Keyed on the slug the lesson already has, and handed back to the exporter as
 * an explicit `slug` — because the name is changing here. Every one of these
 * was an English title standing in for the Uzbek original, so `name` moves to
 * Uzbek and the English goes to `nameEn`; a derived slug would follow the name
 * and strand every progress row already recorded against the old one.
 */
const written = (slug, videoUrl = '') => ({ slug, ...kinematicsLessonText[slug], videoUrl });

export const physicsTopicsData = {
  1: {
    id: 1,
    title: 'Kinematika',
    titleEn: 'Kinematics', titleRu: 'Кинематика',
    color: '#00e5ff',
    lessons: [
      // The ten written lessons of this topic. The rest of the subject is still
      // a title without a lesson; see the branch notes in `lessonText/physicsKinematics.js`.
      written('physics-kinematics-basic-concepts-in-mechanics', 'https://www.youtube.com/watch?v=LF98SpIWZac'),
      written('physics-kinematics-straight-line-uniform-motion'),
      written('physics-kinematics-graphical-representation-of-straight-line-uniform-motion', 'https://www.youtube.com/watch?v=BTJmrnzT_eQ'),
      written('physics-kinematics-relativity-of-motion', 'https://www.youtube.com/watch?v=gqphgVyTzqs'),
      written('physics-kinematics-non-uniform-motion', 'https://www.youtube.com/watch?v=Sn0EEL5E2cI'),
      written('physics-kinematics-uniformly-accelerated-motion-acceleration-instantaneous-velocity', 'https://www.youtube.com/watch?v=HK1qm34dy9E'),
      written('physics-kinematics-displacement-in-uniformly-accelerated-motion', 'https://www.youtube.com/watch?v=RYKrRm8dPPw'),
      written('physics-kinematics-motion-of-two-bodies'),
      written('physics-kinematics-graphical-representation-of-uniformly-accelerated-motion', 'https://www.youtube.com/watch?v=8HC7N9D29TE'),
      written('physics-kinematics-curvilinear-motion'),
      // Centripetal acceleration is what a body accelerating along a curve has.
      { name: "Egri chiziqli harakatda tezlanish", nameEn: "Acceleration in curvilinear motion", nameRu: "Ускорение при криволинейном движении", videoUrl: "https://www.youtube.com/watch?v=Njc5QCRU4ZQ" },
      { name: "Aylanma harakatning uzatilishi", nameEn: "Transmission of rotational motion", nameRu: "Передача вращательного движения" },
      { name: "Aylana bo'ylab notekis harakat", nameEn: "Non-uniform circular motion", nameRu: "Неравномерное движение по окружности" }
    ]
  },
  2: {
    id: 2,
    title: 'Dinamika',
    titleEn: 'Dynamics', titleRu: 'Динамика',
    color: '#00e5ff',
    lessons: [
      { name: "Kuch. Nyutonning birinchi qonuni", nameEn: "Force. Newton's first law", nameRu: "Сила. Первый закон Ньютона", videoUrl: "https://www.youtube.com/watch?v=K9wubX_VPAA" },
      { name: "Massa. Zichlik", nameEn: "Mass. Density", nameRu: "Масса. Плотность" },
      { name: "Nyutonning ikkinchi qonuni", nameEn: "Newton's second law", nameRu: "Второй закон Ньютона", videoUrl: "https://www.youtube.com/watch?v=BkUyufANeo4" },
      { name: "Nyutonning uchinchi qonuni", nameEn: "Newton's third law", nameRu: "Третий закон Ньютона", videoUrl: "https://www.youtube.com/watch?v=_sSdSI3PqWo" },
      { name: "Butun olam tortishish qonuni", nameEn: "Law of universal gravitation", nameRu: "Закон всемирного тяготения", videoUrl: "https://www.youtube.com/watch?v=9qKK4LI0OYg" },
      // "g as the strength of the gravitational field a body sits in".
      { name: "Og'irlik kuchi", nameEn: "Gravity", nameRu: "Сила тяжести", videoUrl: "https://www.youtube.com/watch?v=ila7kbiQucs" },
      { name: "Elastiklik kuchi", nameEn: "Elastic force", nameRu: "Сила упругости" },
      { name: "Jismning og'irligi", nameEn: "Weight", nameRu: "Вес тела", videoUrl: "https://www.youtube.com/watch?v=tP2tQtnR9bg" },
      // "Are astronauts in orbit free of gravity?" — the lesson, exactly.
      { name: "Vaznsizlik", nameEn: "Weightlessness", nameRu: "Невесомость", videoUrl: "https://www.youtube.com/watch?v=wD8HqX6gGZc" },
      { name: "Og'irlik kuchi ta'sirida jismning vertikal harakati", nameEn: "Vertical motion of a body under gravity", nameRu: "Движение тела по вертикали под действием силы тяжести", videoUrl: "https://www.youtube.com/watch?v=KicO4MoOMS4" },
      { name: "Gorizontal otilgan jismning harakati", nameEn: "Motion of a body thrown horizontally", nameRu: "Движение тела, брошенного горизонтально", videoUrl: "https://www.youtube.com/watch?v=W9l1urFgiu4" },
      { name: "Gorizontga burchak ostida otilgan jismning harakati", nameEn: "Motion of a body thrown at an angle to the horizon", nameRu: "Движение тела, брошенного под углом к горизонту", videoUrl: "https://www.youtube.com/watch?v=5nOnhTq20vk" },
      // Working out the orbital speed of the ISS, which is what a satellite is.
      { name: "Yerning sun'iy yo'ldoshlari", nameEn: "Artificial satellites of the Earth", nameRu: "Искусственные спутники Земли", videoUrl: "https://www.youtube.com/watch?v=yM-KakIQRGA" },
      { name: "Ishqalanish kuchi. Tinchlikdagi ishqalanish", nameEn: "Friction force. Static friction", nameRu: "Сила трения. Трение покоя", videoUrl: "https://www.youtube.com/watch?v=YP_hnGED0mQ" },
      { name: "Sirpanish ishqalanish kuchi", nameEn: "Sliding friction force", nameRu: "Сила трения скольжения", videoUrl: "https://www.youtube.com/watch?v=h6I7Lp_M--Q" },
      { name: "Bir necha kuch ta'siridagi harakat", nameEn: "Motion under the action of multiple forces", nameRu: "Движение под действием нескольких сил", videoUrl: "https://www.youtube.com/watch?v=JRfEbz32HLU" }
    ]
  },
  3: {
    id: 3,
    title: 'Statika',
    titleEn: 'Statics', titleRu: 'Статика',
    color: '#00e5ff',
    lessons: [
      { name: "Jismning og'irlik markazi", nameEn: "Center of gravity of a body", nameRu: "Центр тяжести тела" },
      { name: "Muvozanat shartlari", nameEn: "Conditions of equilibrium", nameRu: "Условия равновесия" },
      // The English is a garbled "body momentum and impulse of a force", which
      // is what the lesson is; the other two say that.
      { name: "Jism impulsi va kuch impulsi", nameEn: "Body, force, and momentum", nameRu: "Импульс тела и импульс силы" },
      { name: "Impulsning saqlanish qonuni", nameEn: "Law of conservation of momentum", nameRu: "Закон сохранения импульса" },
      { name: "Mexanik ish", nameEn: "Mechanical work", nameRu: "Механическая работа", videoUrl: "https://www.youtube.com/watch?v=RmMvfob6SHk" },
      { name: "Kinetik energiya", nameEn: "Kinetic energy", nameRu: "Кинетическая энергия" },
      { name: "Potensial energiya", nameEn: "Potential energy", nameRu: "Потенциальная энергия" },
      { name: "Deformatsiyalangan prujinaning potensial energiyasi", nameEn: "Potential energy of a deformed spring", nameRu: "Потенциальная энергия деформированной пружины" },
      { name: "To'liq mexanik energiyaning saqlanish qonuni", nameEn: "Law of conservation of total mechanical energy", nameRu: "Закон сохранения полной механической энергии", videoUrl: "https://www.youtube.com/watch?v=R97ptRkXgD8" },
      { name: "Jismga qo'yilgan kuchlarning ishi. Mexanik energiyaning issiqlikka aylanishi", nameEn: "Work of forces applied to a body. Conversion of mechanical energy into heat", nameRu: "Работа сил, приложенных к телу. Превращение механической энергии в теплоту" },
      { name: "Quvvat", nameEn: "Power", nameRu: "Мощность" },
      { name: "Foydali ish koeffitsiyenti", nameEn: "Efficiency", nameRu: "Коэффициент полезного действия" }
    ]
  },
  4: {
    id: 4,
    title: 'Suyuqlik va gazlar mexanikasi',
    titleEn: 'Mechanics of Fluids and Gases', titleRu: 'Механика жидкостей и газов',
    color: '#00e5ff',
    lessons: [
      { name: "Bosim. Paskal qonuni", nameEn: "Pressure. Pascal's law", nameRu: "Давление. Закон Паскаля" },
      { name: "Gidrostatik bosim", nameEn: "Hydrostatic pressure", nameRu: "Гидростатическое давление" },
      { name: "Tutash idishlar", nameEn: "Communicating vessels", nameRu: "Сообщающиеся сосуды" },
      { name: "Atmosfera bosimi", nameEn: "Atmospheric pressure", nameRu: "Атмосферное давление" },
      { name: "Gidravlik press", nameEn: "Hydraulic press", nameRu: "Гидравлический пресс" },
      { name: "Arximed kuchi", nameEn: "Archimedes' force", nameRu: "Сила Архимеда" },
      { name: "Suyuqlikning quvurda oqishi. Bernulli qonuni", nameEn: "Flow of liquids in a pipe. Bernoulli's law", nameRu: "Течение жидкости по трубе. Закон Бернулли" }
    ]
  },
  5: {
    id: 5,
    title: 'Tebranishlar va to\'lqinlar',
    titleEn: 'Oscillations and Waves', titleRu: 'Колебания и волны',
    color: '#00e5ff',
    lessons: [
      { name: "Tebranma harakatni tavsiflovchi asosiy tushunchalar", nameEn: "Basic concepts characterizing oscillatory motion", nameRu: "Основные понятия, характеризующие колебательное движение" },
      { name: "Prujinali mayatnik", nameEn: "Spring pendulum", nameRu: "Пружинный маятник" },
      { name: "Matematik mayatnik", nameEn: "Mathematical pendulum", nameRu: "Математический маятник" },
      { name: "Garmonik tebranishlar tenglamasi", nameEn: "Equation of harmonic oscillations", nameRu: "Уравнение гармонических колебаний" },
      { name: "Tebranayotgan jismning energiyasi", nameEn: "Energy of an oscillating body", nameRu: "Энергия колеблющегося тела" },
      { name: "Rezonans", nameEn: "Resonance", nameRu: "Резонанс" },
      { name: "Mexanik to'lqinlar", nameEn: "Mechanical waves", nameRu: "Механические волны" },
      { name: "Tovush to'lqinlari", nameEn: "Sound waves", nameRu: "Звуковые волны" }
    ]
  },
  6: {
    id: 6,
    title: 'Molekulyar fizika',
    titleEn: 'Molecular Physics', titleRu: 'Молекулярная физика',
    color: '#00e5ff',
    lessons: [
      { name: "Moddaning tuzilishi va asosiy xossalari", nameEn: "Structure of matter and its basic properties", nameRu: "Строение вещества и его основные свойства" },
      // MKT — molecular-kinetic theory; MKN in Uzbek, МКТ in Russian.
      { name: "Ideal gaz. MKN asosiy tenglamasi", nameEn: "Ideal gas. Basic equation of MKT", nameRu: "Идеальный газ. Основное уравнение МКТ" },
      { name: "Absolyut temperatura. Molekulalarning o'rtacha kinetik energiyasi", nameEn: "Absolute temperature. Average kinetic energy of molecules", nameRu: "Абсолютная температура. Средняя кинетическая энергия молекул" },
      { name: "Gaz molekulalarining o'rtacha kvadratik tezligi", nameEn: "Root mean square speed of gas molecules", nameRu: "Средняя квадратичная скорость молекул газа" },
      { name: "Ideal gaz holatining tenglamasi", nameEn: "Equation of state of an ideal gas", nameRu: "Уравнение состояния идеального газа" },
      { name: "Klapeyron tenglamasi", nameEn: "Clapeyron equation", nameRu: "Уравнение Клапейрона" },
      { name: "Gaz massasining o'zgarishi", nameEn: "Change in gas mass", nameRu: "Изменение массы газа" },
      { name: "Izobarik, izoxorik va izotermik jarayonlar", nameEn: "Isobaric, isochoric, isothermal processes", nameRu: "Изобарный, изохорный и изотермический процессы" },
      { name: "Grafikli masalalar", nameEn: "Problems with graphs", nameRu: "Задачи с графиками" },
      { name: "To'yingan bug'. Kritik temperatura", nameEn: "Saturated vapor. Critical temperature", nameRu: "Насыщенный пар. Критическая температура" },
      { name: "Havoning namligi", nameEn: "Air humidity", nameRu: "Влажность воздуха" },
      { name: "Kapillyarlik hodisalari. Sirt taranglik", nameEn: "Capillarity phenomena. Surface tension", nameRu: "Капиллярные явления. Поверхностное натяжение" },
      { name: "Qattiq jismlarning mexanik xossalari", nameEn: "Mechanical properties of solids", nameRu: "Механические свойства твёрдых тел" },
      { name: "Issiqlikdan kengayish", nameEn: "Thermal expansion", nameRu: "Тепловое расширение" }
    ]
  },
  7: {
    id: 7,
    title: 'Termodinamika',
    titleEn: 'Thermodynamics', titleRu: 'Термодинамика',
    color: '#00e5ff',
    lessons: [
      { name: "Ichki energiya", nameEn: "Internal energy", nameRu: "Внутренняя энергия" },
      { name: "Termodinamikada ish", nameEn: "Work in thermodynamics", nameRu: "Работа в термодинамике" },
      { name: "Issiqlik miqdori", nameEn: "Amount of heat", nameRu: "Количество теплоты" },
      { name: "Termodinamikaning birinchi qonuni", nameEn: "First law of thermodynamics", nameRu: "Первый закон термодинамики" },
      { name: "Adiabatik jarayon. Termodinamikaning ikkinchi qonuni", nameEn: "Adiabatic process. Second law of thermodynamics", nameRu: "Адиабатный процесс. Второй закон термодинамики" },
      { name: "Issiqlik dvigatellari", nameEn: "Heat engines", nameRu: "Тепловые двигатели" }
    ]
  },
  8: {
    id: 8,
    title: 'Elektrostatika',
    titleEn: 'Electrostatics', titleRu: 'Электростатика',
    color: '#00e5ff',
    lessons: [
      { name: "Elektr zaryadi. Zaryadning saqlanish qonuni", nameEn: "Electric charge. Law of conservation of charge", nameRu: "Электрический заряд. Закон сохранения заряда" },
      { name: "Kulon qonuni", nameEn: "Coulomb's law", nameRu: "Закон Кулона" },
      { name: "Elektr maydon. Elektr maydon kuchlanganligi", nameEn: "Electric field. Electric field strength", nameRu: "Электрическое поле. Напряжённость электрического поля" },
      { name: "Elektr maydondagi o'tkazgichlar", nameEn: "Conductors in an electric field", nameRu: "Проводники в электрическом поле" },
      { name: "Zaryadlangan sfera va tekislikning maydoni", nameEn: "Fields of a charged sphere and plane", nameRu: "Поля заряженной сферы и плоскости" },
      { name: "Elektr maydondagi dielektriklar", nameEn: "Dielectrics in an electric field", nameRu: "Диэлектрики в электрическом поле" },
      { name: "Bir jinsli elektr maydonning ishi. Potensial", nameEn: "Work of a uniform electric field. Potential", nameRu: "Работа однородного электрического поля. Потенциал" },
      { name: "Nuqtaviy zaryad va zaryadlangan sferaning potensiali", nameEn: "Potential of a point charge and a charged sphere", nameRu: "Потенциал точечного заряда и заряженной сферы" },
      { name: "Ekvipotensial sirtlar", nameEn: "Equipotential surfaces", nameRu: "Эквипотенциальные поверхности" },
      { name: "E va φ orasidagi bog'lanish", nameEn: "Relationship between E and φ", nameRu: "Связь между E и φ" },
      { name: "Elektr sig'imi. Kondensatorlar", nameEn: "Electric capacitance. Capacitors", nameRu: "Электроёмкость. Конденсаторы" },
      { name: "Kondensatorlarni parallel va ketma-ket ulash", nameEn: "Parallel and series connection of capacitors", nameRu: "Параллельное и последовательное соединение конденсаторов" },
      { name: "Zaryadlangan kondensatorning energiyasi", nameEn: "Energy of a charged capacitor", nameRu: "Энергия заряженного конденсатора" }
    ]
  },
  9: {
    id: 9,
    title: 'O\'zgarmas tok qonunlari',
    titleEn: 'Direct Current Laws', titleRu: 'Законы постоянного тока',
    color: '#00e5ff',
    lessons: [
      { name: "Elektr toki. Tok kuchi", nameEn: "Electric current. Current strength", nameRu: "Электрический ток. Сила тока" },
      { name: "Zanjirning bir qismi uchun Om qonuni. Qarshilik", nameEn: "Ohm's law for a section of a circuit. Resistance", nameRu: "Закон Ома для участка цепи. Сопротивление" },
      { name: "Elektr zanjirlari. O'tkazgichlarni ketma-ket va parallel ulash", nameEn: "Electric circuits. Series and parallel connection of conductors", nameRu: "Электрические цепи. Последовательное и параллельное соединение проводников" },
      { name: "Ampermetr va voltmetrga qo'shimcha qarshilik ulash", nameEn: "Connecting additional resistance to an ammeter and voltmeter", nameRu: "Подключение дополнительного сопротивления к амперметру и вольтметру" },
      { name: "O'zgarmas tokning ishi va quvvati", nameEn: "Work and power of direct current", nameRu: "Работа и мощность постоянного тока" },
      { name: "Joul–Lens qonuni", nameEn: "Joule-Lenz law", nameRu: "Закон Джоуля — Ленца" },
      { name: "Lampalarni ketma-ket va parallel ulash", nameEn: "Series and parallel connection of lamps", nameRu: "Последовательное и параллельное соединение ламп" },
      { name: "To'liq zanjir uchun Om qonuni", nameEn: "Ohm's law for a complete circuit", nameRu: "Закон Ома для полной цепи" },
      { name: "Tok manbalarini ketma-ket va parallel ulash", nameEn: "Series and parallel connection of current sources", nameRu: "Последовательное и параллельное соединение источников тока" }
    ]
  },
  10: {
    id: 10,
    title: 'Turli muhitlarda elektr qonunlari',
    titleEn: 'Electric Current in Different Media', titleRu: 'Законы электрического тока в различных средах',
    color: '#00e5ff',
    lessons: [
      { name: "Metallarda elektr toki", nameEn: "Electric current in metals", nameRu: "Электрический ток в металлах" },
      { name: "Yarimo'tkazgichlarda elektr toki", nameEn: "Electric current in semiconductors", nameRu: "Электрический ток в полупроводниках" },
      { name: "Vakuumda elektr toki", nameEn: "Electric current in vacuum", nameRu: "Электрический ток в вакууме" },
      { name: "Suyuqliklarda elektr toki", nameEn: "Electric current in liquids", nameRu: "Электрический ток в жидкостях" },
      { name: "Gazlarda elektr toki", nameEn: "Electric current in gases", nameRu: "Электрический ток в газах" },
      { name: "Aralash masalalar", nameEn: "Mixed problems", nameRu: "Комбинированные задачи" }
    ]
  },
  11: {
    id: 11,
    title: 'Elektromagnit hodisalar',
    titleEn: 'Electromagnetic Phenomena', titleRu: 'Электромагнитные явления',
    color: '#00e5ff',
    lessons: [
      { name: "Doimiy magnitlar. Magnit maydon. Toklarning magnit maydoni", nameEn: "Permanent magnets. Magnetic field. Magnetic field of currents", nameRu: "Постоянные магниты. Магнитное поле. Магнитное поле токов" },
      { name: "Amper kuchi", nameEn: "Ampere force", nameRu: "Сила Ампера" },
      { name: "Lorens kuchi", nameEn: "Lorentz force", nameRu: "Сила Лоренца" },
      { name: "Moddaning magnit xossalari", nameEn: "Magnetic properties of matter", nameRu: "Магнитные свойства вещества" },
      { name: "Magnit oqimi", nameEn: "Magnetic flux", nameRu: "Магнитный поток" },
      { name: "Elektromagnit induksiya qonuni. Lens qoidasi", nameEn: "Law of electromagnetic induction. Lenz's rule", nameRu: "Закон электромагнитной индукции. Правило Ленца" },
      { name: "O'zinduksiya. Induktivlik", nameEn: "Self-induction. Inductance", nameRu: "Самоиндукция. Индуктивность" },
      { name: "Tok magnit maydonining energiyasi", nameEn: "Energy of the magnetic field of a current", nameRu: "Энергия магнитного поля тока" }
    ]
  },
  12: {
    id: 12,
    title: 'Elektromagnit tebranishlar va to\'lqinlar',
    titleEn: 'Electromagnetic Oscillations and Waves', titleRu: 'Электромагнитные колебания и волны',
    color: '#00e5ff',
    lessons: [
      { name: "Tebranish konturida zaryad, kuchlanish va tok kuchi", nameEn: "Charge, voltage, and current in an oscillatory circuit", nameRu: "Заряд, напряжение и сила тока в колебательном контуре" },
      { name: "Ideal tebranish konturi uchun Tomson formulasi", nameEn: "Thomson's formula for an ideal oscillatory circuit", nameRu: "Формула Томсона для идеального колебательного контура" },
      { name: "Tebranish konturidagi energiya", nameEn: "Energy in an oscillatory circuit", nameRu: "Энергия в колебательном контуре" },
      { name: "O'zgaruvchan tok generatori", nameEn: "Alternating current generator", nameRu: "Генератор переменного тока" },
      { name: "O'zgaruvchan tok zanjiridagi aktiv qarshilik", nameEn: "Active resistance in an AC circuit", nameRu: "Активное сопротивление в цепи переменного тока" },
      { name: "O'zgaruvchan tok zanjiridagi kondensator", nameEn: "Capacitor in an AC circuit", nameRu: "Конденсатор в цепи переменного тока" },
      { name: "O'zgaruvchan tok zanjiridagi induktiv g'altak", nameEn: "Inductor in an AC circuit", nameRu: "Катушка индуктивности в цепи переменного тока" },
      { name: "O'zgaruvchan tok zanjirida aktiv qarshilik, kondensator va g'altak", nameEn: "Active resistance, capacitor, and inductor in an AC circuit", nameRu: "Активное сопротивление, конденсатор и катушка в цепи переменного тока" },
      { name: "Transformator", nameEn: "Transformer", nameRu: "Трансформатор" },
      { name: "Elektromagnit to'lqinlar", nameEn: "Electromagnetic waves", nameRu: "Электромагнитные волны" },
      { name: "Radioaloqa. Radiolokatsiya", nameEn: "Radio communication. Radiolocation", nameRu: "Радиосвязь. Радиолокация" }
    ]
  },
  13: {
    id: 13,
    title: 'Optika',
    titleEn: 'Optics', titleRu: 'Оптика',
    color: '#00e5ff',
    lessons: [
      { name: "Yorug'likning qaytishi", nameEn: "Reflection of light", nameRu: "Отражение света" },
      { name: "Yorug'likning sinishi", nameEn: "Refraction of light", nameRu: "Преломление света" },
      { name: "Yorug'likning to'lqin tabiati", nameEn: "Wave nature of light", nameRu: "Волновая природа света" },
      { name: "To'la ichki qaytish", nameEn: "Total internal reflection", nameRu: "Полное внутреннее отражение" },
      { name: "Linzalar", nameEn: "Lenses", nameRu: "Линзы" },
      { name: "Linza formulasi", nameEn: "Lens formula", nameRu: "Формула линзы" },
      { name: "Optik asboblar", nameEn: "Optical instruments", nameRu: "Оптические приборы" },
      { name: "Interferensiya", nameEn: "Interference", nameRu: "Интерференция" },
      { name: "Difraksiya", nameEn: "Diffraction", nameRu: "Дифракция" },
      { name: "Qutblanish", nameEn: "Polarization", nameRu: "Поляризация" },
      { name: "Nisbiylik nazariyasi elementlari", nameEn: "Elements of the theory of relativity", nameRu: "Элементы теории относительности" },
      { name: "Massa va energiya orasidagi bog'lanish", nameEn: "Relationship between mass and energy", nameRu: "Связь массы и энергии" },
      { name: "Nurlanish va yutilish spektrlari", nameEn: "Emission and absorption spectra", nameRu: "Спектры излучения и поглощения" },
      { name: "Yorug'lik kvantlari. Fotonlar", nameEn: "Light quanta. Photons", nameRu: "Кванты света. Фотоны" },
      { name: "Rentgen nurlari", nameEn: "X-rays", nameRu: "Рентгеновские лучи" },
      { name: "Fotoeffekt", nameEn: "Photoelectric effect", nameRu: "Фотоэффект" }
    ]
  },
  14: {
    id: 14,
    title: 'Atom va yadro fizikasi',
    titleEn: 'Atomic and Nuclear Physics', titleRu: 'Атомная и ядерная физика',
    color: '#00e5ff',
    lessons: [
      { name: "Rezerford tajribasi. Bor postulatlari", nameEn: "Rutherford's experiment. Bohr's postulates", nameRu: "Опыт Резерфорда. Постулаты Бора" },
      { name: "Atom yadrosining tuzilishi. Radioaktivlik", nameEn: "Structure of the atomic nucleus. Radioactivity", nameRu: "Строение атомного ядра. Радиоактивность" },
      { name: "Radioaktiv yemirilish qonuni", nameEn: "Law of radioactive decay", nameRu: "Закон радиоактивного распада" },
      { name: "Yadroning bog'lanish energiyasi", nameEn: "Nuclear binding energy", nameRu: "Энергия связи ядра" },
      { name: "Yadro reaksiyalari", nameEn: "Nuclear reactions", nameRu: "Ядерные реакции" }
    ]
  }
};
