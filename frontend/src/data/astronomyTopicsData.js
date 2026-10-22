/**
 * Khan Academy's Uzbek astronomy lessons, on the sub-lessons they are about.
 *
 * Keyed by sub-lesson name rather than written inline because the two lists
 * below are generated — a spectral class, or a body, times three fixed
 * sub-lesson titles — so there is no line to hang a `videoUrl` on.
 *
 * Only what the video actually teaches, which is why this map is short and
 * most slots below stay empty. Two of them rest on a fact worth stating out
 * loud, because if either is wrong the pairing is wrong: O-type stars are the
 * massive ones, and a G-type star is a star like the Sun. Everything else here
 * is a video about the body the lesson names. Where a body has more than one,
 * the general video goes on "Understanding", photographs go on "Observations",
 * and the deeper second part goes on "Physics of".
 *
 * `src/data/videoCredits.js` carries the channel each id belongs to, and the
 * lesson page prints it under the player.
 *
 * The keys are the English names. Since 22 Oct 2026 `name` is the Uzbek one,
 * as on every other row of the learn tree, and the English sits in `nameEn` —
 * which is also what the exporter derives the slug from, so translating a title
 * moved no slug.
 */
const KHAN_VIDEOS = {
  // "Massiv yulduzlarning hayot sikli" — the life cycle of a massive star.
  'Evolution of O Stars': 'https://www.youtube.com/watch?v=gS5E0WsbNSg',
  // "Qizil gigantga aylanish" — a Sun-like star leaving the main sequence.
  'Evolution of G Stars': 'https://www.youtube.com/watch?v=dezCVRZW4No',
  'Physics of Galaxies': 'https://www.youtube.com/watch?v=gHSLWrmBK-k',
  // The Hubble deep-field photograph of galaxies.
  'Observations of Galaxies': 'https://www.youtube.com/watch?v=RrpOxpTWmAM',
  'Understanding Black holes': 'https://www.youtube.com/watch?v=l6k62nsjfFo',
  'Physics of Black holes': 'https://www.youtube.com/watch?v=qT74-XVshxU',
  // "Yulduzli maydon va bulutliklar suratlari" — pictures of nebulae.
  'Observations of Nebulae': 'https://www.youtube.com/watch?v=CQvJKqzmEJI',
  'Understanding Quasars': 'https://www.youtube.com/watch?v=JyeV3_bi5_w',
  'Physics of Quasars': 'https://www.youtube.com/watch?v=rTRIWTzkjGE',
  'Understanding Supernovae': 'https://www.youtube.com/watch?v=ROQWN2h7dVM',
  'Physics of Supernovae': 'https://www.youtube.com/watch?v=_y-HcqZnxX8',
};

/** A sub-lesson, with its video if one of these lessons is genuinely about it. */
const subLesson = (names) => ({ ...names, videoUrl: KHAN_VIDEOS[names.nameEn] ?? '' });

/** A capitalised Russian name, for use mid-sentence. */
const lower = (text) => text[0].toLowerCase() + text.slice(1);

export const astronomyTopicsData = {
  1: {
    id: 1,
    title: 'Quyosh tizimi',
    titleEn: 'Solar System', titleRu: 'Солнечная система',
    color: '#fbbf24',
    lessons: [
      {
        name: "Quyosh", nameEn: "Sun", nameRu: "Солнце",
        subLessons: [
          { name: "Quyoshning tuzilishi", nameEn: "Structure of the Sun", nameRu: "Строение Солнца" },
          { name: "Quyosh energiyasi va termoyadro sintezi", nameEn: "Solar Energy & Fusion", nameRu: "Энергия Солнца и термоядерный синтез" },
          { name: "Quyoshning hayot sikli", nameEn: "The Sun's Life Cycle", nameRu: "Жизненный цикл Солнца" }
        ]
      },
      {
        name: "Merkuriy", nameEn: "Mercury", nameRu: "Меркурий",
        subLessons: [
          { name: "Merkuriydagi keskin sharoitlar", nameEn: "Mercury's Extreme Environment", nameRu: "Экстремальные условия на Меркурии" },
          { name: "Eng kichik sayyora geologiyasi", nameEn: "Geology of the Smallest Planet", nameRu: "Геология самой маленькой планеты" },
          { name: "Merkuriyga yuborilgan missiyalar", nameEn: "Missions to Mercury", nameRu: "Миссии к Меркурию" }
        ]
      },
      {
        name: "Venera", nameEn: "Venus", nameRu: "Венера",
        subLessons: [
          { name: "Nazoratsiz issiqxona effekti", nameEn: "The Runaway Greenhouse Effect", nameRu: "Неуправляемый парниковый эффект" },
          { name: "Venera yuzasi va vulkanizmi", nameEn: "Venusian Surface & Volcanism", nameRu: "Поверхность и вулканизм Венеры" },
          // Venus is the evening star as often as it is the morning star —
          // NASA, Venus Facts: the ancients thought it "was two objects: a
          // morning star and an evening star".
          // https://science.nasa.gov/venus/venus-facts/
          {
            name: "Tong va shom yulduzi tadqiqoti",
            nameEn: "Exploration of the Morning and Evening Star",
            nameRu: "Исследование утренней и вечерней звезды",
            slug: "astronomy-solar-system-exploration-of-the-morning-star",
          }
        ]
      },
      {
        name: "Yer", nameEn: "Earth", nameRu: "Земля",
        subLessons: [
          { name: "Hayot uchun qulay zona", nameEn: "The Goldilocks Zone", nameRu: "Зона обитаемости" },
          { name: "Atmosfera va biosfera", nameEn: "Atmosphere & Biosphere", nameRu: "Атмосфера и биосфера" },
          { name: "Yerning magnit qalqoni", nameEn: "Earth's Magnetic Shield", nameRu: "Магнитный щит Земли" }
        ]
      },
      {
        name: "Mars", nameEn: "Mars", nameRu: "Марс",
        subLessons: [
          { name: "Qizil sayyora tarixi", nameEn: "The Red Planet's History", nameRu: "История Красной планеты" },
          { name: "Marsdagi suv", nameEn: "Water on Mars", nameRu: "Вода на Марсе" },
          { name: "Marsni kelajakda o'zlashtirish", nameEn: "Future Human Colonization", nameRu: "Будущая колонизация Марса" }
        ]
      },
      {
        name: "Yupiter", nameEn: "Jupiter", nameRu: "Юпитер",
        subLessons: [
          { name: "Sayyoralar qiroli", nameEn: "The King of Planets", nameRu: "Король планет" },
          { name: "Katta Qizil dog'", nameEn: "The Great Red Spot", nameRu: "Большое красное пятно" },
          { name: "Yupiterning Galiley yo'ldoshlari", nameEn: "Jupiter's Galilean Moons", nameRu: "Галилеевы спутники Юпитера" }
        ]
      },
      {
        name: "Saturn", nameEn: "Saturn", nameRu: "Сатурн",
        subLessons: [
          { name: "Halqalar hukmdori", nameEn: "Lord of the Rings", nameRu: "Властелин колец" },
          { name: "Saturndagi olti burchakli bo'ron", nameEn: "Saturn's Hexagon Storm", nameRu: "Гексагон Сатурна" },
          // The liquid is methane and ethane at about -180 C, not water —
          // NASA, Titan: "rivers, lakes and seas of liquid hydrocarbons like
          // methane and ethane".
          // https://science.nasa.gov/saturn/moons/titan/
          {
            name: "Titan: suyuq metan va etan ko'llari",
            nameEn: "Titan: Lakes of Liquid Methane and Ethane",
            nameRu: "Титан: озёра из жидкого метана и этана",
            slug: "astronomy-solar-system-titan-a-world-with-liquid-lakes",
          }
        ]
      },
      {
        name: "Uran", nameEn: "Uranus", nameRu: "Уран",
        subLessons: [
          { name: "Yonboshlab aylanuvchi muz giganti", nameEn: "The Sideways Ice Giant", nameRu: "Ледяной гигант, лежащий на боку" },
          { name: "Uran atmosferasi va tarkibi", nameEn: "Atmosphere & Composition", nameRu: "Атмосфера и состав Урана" },
          { name: "Uranning halqalar tizimi", nameEn: "Uranus's Ring System", nameRu: "Система колец Урана" }
        ]
      },
      {
        name: "Neptun", nameEn: "Neptune", nameRu: "Нептун",
        subLessons: [
          { name: "Shamolli moviy sayyora", nameEn: "The Windy Blue Planet", nameRu: "Ветреная голубая планета" },
          { name: "Triton: tutib olingan yo'ldosh", nameEn: "Triton: A Captured Moon", nameRu: "Тритон: захваченный спутник" },
          { name: "Neptunning qora dog'lari", nameEn: "Neptune's Dark Spots", nameRu: "Тёмные пятна Нептуна" }
        ]
      }
    ]
  },
  2: {
    id: 2,
    title: 'Yulduzlar',
    titleEn: 'Stars', titleRu: 'Звезды',
    color: '#fbbf24',
    lessons: [
      "O", "B", "A", "F", "G", "K", "M"
    ].map(type => ({
      name: `${type} sinf yulduzlari`,
      nameEn: type,
      nameRu: `Звёзды класса ${type}`,
      subLessons: [
        subLesson({ name: `${type} sinf yulduzlarining xususiyatlari`, nameEn: `${type}-Type Characteristics`, nameRu: `Характеристики звёзд класса ${type}` }),
        subLesson({ name: `${type} sinf yulduzlarining evolyutsiyasi`, nameEn: `Evolution of ${type} Stars`, nameRu: `Эволюция звёзд класса ${type}` }),
        subLesson({ name: `Mashhur ${type} sinf yulduzlari`, nameEn: `Famous ${type}-Type Stars`, nameRu: `Известные звёзды класса ${type}` })
      ]
    }))
  },
  3: {
    id: 3,
    title: 'Sun\'iy yo\'ldoshlar va raketalar',
    titleEn: 'Satellites and Rockets', titleRu: 'Искусственные спутники и ракеты',
    color: '#fbbf24',
    lessons: [
      // A spacecraft's name is a proper name and is written the same in all
      // three languages; only the station has one that translates.
      { en: "Falcon 9", type: "rocket" },
      { en: "Falcon Heavy", type: "rocket" },
      { en: "Electron", type: "rocket" },
      { en: "New Shepard", type: "rocket" },
      { en: "Starship", type: "rocket" },
      { en: "International Space Station", uz: "Xalqaro kosmik stansiya", ru: "Международная космическая станция", type: "satellite" },
      { en: "Terra", type: "satellite" },
      { en: "Aqua", type: "satellite" },
      { en: "Envisat", type: "satellite" },
      { en: "Gaia", type: "satellite" }
    ].map(({ en, uz = en, ru = en, type }) => ({
      name: uz,
      nameEn: en,
      nameRu: ru,
      type,
      subLessons: [
        { name: `${uz}: konstruksiyasi`, nameEn: `${en} Design`, nameRu: `${ru}: конструкция` },
        { name: `${uz}: uchirilishlar tarixi`, nameEn: `${en} Launch History`, nameRu: `${ru}: история запусков` },
        { name: `${uz}: missiyaning ahamiyati`, nameEn: `${en} Mission Impact`, nameRu: `${ru}: значение миссии` }
      ]
    }))
  },
  4: {
    id: 4,
    title: 'Osmon jismlari',
    titleRu: 'Небесные тела',
    titleEn: 'Celestial Bodies',
    color: '#fbbf24',
    lessons: [
      // `ruOf` is the Russian genitive plural: «Физика планет», «Наблюдения комет».
      { en: "Planets", uz: "Sayyoralar", ru: "Планеты", ruOf: "планет" },
      { en: "Natural satellites", uz: "Tabiiy yo'ldoshlar", ru: "Естественные спутники", ruOf: "естественных спутников" },
      { en: "Asteroids", uz: "Asteroidlar", ru: "Астероиды", ruOf: "астероидов" },
      { en: "Comets", uz: "Kometalar", ru: "Кометы", ruOf: "комет" },
      { en: "Meteoroids", uz: "Meteoroidlar", ru: "Метеороиды", ruOf: "метеороидов" },
      { en: "Meteors", uz: "Meteorlar", ru: "Метеоры", ruOf: "метеоров" },
      { en: "Meteorites", uz: "Meteoritlar", ru: "Метеориты", ruOf: "метеоритов" },
      { en: "Galaxies", uz: "Galaktikalar", ru: "Галактики", ruOf: "галактик" },
      { en: "Black holes", uz: "Qora tuynuklar", ru: "Чёрные дыры", ruOf: "чёрных дыр" },
      { en: "Nebulae", uz: "Tumanliklar", ru: "Туманности", ruOf: "туманностей" },
      { en: "Quasars", uz: "Kvazarlar", ru: "Квазары", ruOf: "квазаров" },
      { en: "Pulsars", uz: "Pulsarlar", ru: "Пульсары", ruOf: "пульсаров" },
      { en: "Supernovae", uz: "O'ta yangi yulduzlar", ru: "Сверхновые", ruOf: "сверхновых" },
      { en: "Exoplanets", uz: "Ekzosayyoralar", ru: "Экзопланеты", ruOf: "экзопланет" },
      { en: "Galaxy clusters", uz: "Galaktikalar to'dalari", ru: "Скопления галактик", ruOf: "скоплений галактик" },
      { en: "Cosmic dust and gas clouds", uz: "Kosmik chang va gaz bulutlari", ru: "Облака космической пыли и газа", ruOf: "облаков космической пыли и газа" }
    ].map(({ en, uz, ru, ruOf }) => ({
      name: uz,
      nameEn: en,
      nameRu: ru,
      subLessons: [
        subLesson({ name: `${uz} haqida tushuncha`, nameEn: `Understanding ${en}`, nameRu: `Что такое ${lower(ru)}?` }),
        subLesson({ name: `${uz} fizikasi`, nameEn: `Physics of ${en}`, nameRu: `Физика ${ruOf}` }),
        // Every Uzbek name above ends in -lar or -lari, so the accusative is a bare -ni.
        subLesson({ name: `${uz}ni kuzatish`, nameEn: `Observations of ${en}`, nameRu: `Наблюдения ${ruOf}` })
      ]
    }))
  }
};
