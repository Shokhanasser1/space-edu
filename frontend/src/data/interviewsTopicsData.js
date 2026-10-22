/**
 * Names in three languages since 22 Oct 2026: `name` is the Uzbek one, as on
 * every other row of the learn tree, `nameEn` the English one the slug is
 * derived from. A person's name is transliterated the way each language's own
 * press writes it — Nil Armstrong, Нил Армстронг.
 *
 * The Russian titles put the name first and the subject after a colon,
 * «Кип Торн: главные открытия», because a generated title cannot decline the
 * name and «Главные открытия Кип Торн» is wrong.
 */
export const interviewsTopicsData = {
  1: {
    id: 1,
    title: 'Professorlar',
    titleEn: 'Professors', titleRu: 'Профессора',
    color: '#3b82f6',
    sections: [
      {
        name: "Astronomiya", nameEn: "Astronomy", nameRu: "Астрономия",
        lessons: [
          { en: "Neil deGrasse Tyson", uz: "Nil deGrass Tayson", ru: "Нил Деграсс Тайсон" },
          { en: "Kip Thorne", uz: "Kip Torn", ru: "Кип Торн" },
          { en: "Brian Cox", uz: "Brayan Koks", ru: "Брайан Кокс" },
          { en: "Andrea Ghez", uz: "Andrea Gez", ru: "Андреа Гез" },
          { en: "Adam Riess", uz: "Adam Riss", ru: "Адам Рисс" },
          { en: "Saul Perlmutter", uz: "Sol Perlmutter", ru: "Сол Перлмуттер" },
          { en: "Roger Penrose", uz: "Rojer Penrouz", ru: "Роджер Пенроуз" }
        ].map(({ en, uz, ru }) => ({
          name: uz,
          nameEn: en,
          nameRu: ru,
          subLessons: [
            { name: `${uz}: ilmiy yo'lning boshlanishi`, nameEn: `${en}'s Early Career`, nameRu: `${ru}: начало научного пути` },
            { name: `${uz}: eng muhim kashfiyotlar`, nameEn: `${en}'s Greatest Discoveries`, nameRu: `${ru}: главные открытия` },
            { name: `${uz} koinot kelajagi haqida`, nameEn: `${en} on Future of Space`, nameRu: `${ru} о будущем космоса` }
          ]
        }))
      },
      {
        name: "Fizika", nameEn: "Physics", nameRu: "Физика",
        lessons: [
          { en: "Edward Witten", uz: "Edvard Vitten", ru: "Эдвард Виттен" },
          { en: "Juan Maldacena", uz: "Xuan Maldasena", ru: "Хуан Малдасена" },
          { en: "Lisa Randall", uz: "Liza Rendall", ru: "Лиза Рэндалл" },
          { en: "David Gross", uz: "Devid Gross", ru: "Дэвид Гросс" },
          { en: "Frank Wilczek", uz: "Frenk Vilchek", ru: "Фрэнк Вильчек" },
          { en: "Ashoke Sen", uz: "Ashok Sen", ru: "Ашок Сен" },
          { en: "Cumrun Vafa", uz: "Kumrun Vafa", ru: "Кумрун Вафа" }
        ].map(({ en, uz, ru }) => ({
          name: uz,
          nameEn: en,
          nameRu: ru,
          subLessons: [
            { name: `${uz}: tadqiqot yo'nalishi`, nameEn: `${en}'s Research Focus`, nameRu: `${ru}: направление исследований` },
            { name: `${uz}: nazariyaga qo'shgan hissasi`, nameEn: `${en}'s Theoretical Impact`, nameRu: `${ru}: вклад в теорию` },
            { name: `${uz} bilan suhbat`, nameEn: `In Conversation with ${en}`, nameRu: `${ru}: беседа` }
          ]
        }))
      }
    ]
  },
  2: {
    id: 2,
    // Two of the four below are American. A cosmonaut is Russian or Soviet
    // crew; an astronaut is American crew and, now, the general international
    // term — IAU Office of Astronomy for Education glossary, "Astronaut",
    // https://astro4edu.org/resources/glossary/term/23/ . Gagarin and
    // Tereshkova flew for the Soviet programme; Armstrong and Aldrin flew for
    // NASA, so "Cosmonauts" was wrong for half the topic in English and Uzbek.
    //
    // The Russian «Космонавты» was already defensible — in Russian *космонавт*
    // is the general word and *астронавт* is given as "то же, что космонавт"
    // (Gramota.ru, Словарь-справочник трудностей русского языка). It is spelled
    // out here anyway so the three languages say the same thing.
    //
    // `slug` pins what the derived slug used to be: it prefixes all 25 lesson
    // slugs under this topic, and progress rows key on those.
    slug: 'interviews-cosmonauts',
    title: 'Astronavtlar va kosmonavtlar',
    titleEn: 'Astronauts and Cosmonauts', titleRu: 'Астронавты и космонавты',
    color: '#3b82f6',
    lessons: [
      { en: "Yuri Gagarin", uz: "Yuriy Gagarin", ru: "Юрий Гагарин" },
      { en: "Neil Armstrong", uz: "Nil Armstrong", ru: "Нил Армстронг" },
      { en: "Buzz Aldrin", uz: "Bazz Oldrin", ru: "Базз Олдрин" },
      { en: "Valentina Tereshkova", uz: "Valentina Tereshkova", ru: "Валентина Терешкова" }
    ].map(({ en, uz, ru }) => ({
      name: uz,
      nameEn: en,
      nameRu: ru,
      subLessons: [
        { name: `${uz}: parvozga tayyorgarlik`, nameEn: `${en}'s Training`, nameRu: `${ru}: подготовка к полёту` },
        { name: `${uz}: tarixiy parvoz`, nameEn: `${en}'s Historic Mission`, nameRu: `${ru}: исторический полёт` },
        { name: `${uz} merosi`, nameEn: `Legacy of ${en}`, nameRu: `${ru}: наследие` }
      ]
    }))
  },
  3: {
    id: 3,
    title: 'Boshqa xodimlar',
    titleRu: 'Другие сотрудники',
    titleEn: 'Other Workers',
    color: '#3b82f6',
    // Written out rather than generated: three professions, and each language
    // bends the words around them differently.
    lessons: [
      {
        name: "Parvozlarni boshqarish markazi", nameEn: "Mission Control", nameRu: "Центр управления полётами",
        subLessons: [
          { name: "Parvozlarni boshqarish markazining vazifasi", nameEn: "Role of Mission Control", nameRu: "Роль Центра управления полётами" },
          { name: "Bir ish kuni: parvozlarni boshqarish markazi", nameEn: "A Day in the Life: Mission Control", nameRu: "Один рабочий день: Центр управления полётами" },
          { name: "Parvozlarni boshqarish markazi oldidagi qiyinchiliklar", nameEn: "Challenges for Mission Control", nameRu: "Трудности Центра управления полётами" }
        ]
      },
      {
        name: "Raketa muhandislari", nameEn: "Rocket Engineers", nameRu: "Инженеры-ракетостроители",
        subLessons: [
          { name: "Raketa muhandislarining vazifasi", nameEn: "Role of Rocket Engineers", nameRu: "Роль инженеров-ракетостроителей" },
          { name: "Bir ish kuni: raketa muhandislari", nameEn: "A Day in the Life: Rocket Engineers", nameRu: "Один рабочий день: инженеры-ракетостроители" },
          { name: "Raketa muhandislari oldidagi qiyinchiliklar", nameEn: "Challenges for Rocket Engineers", nameRu: "Трудности инженеров-ракетостроителей" }
        ]
      },
      {
        name: "Skafandr konstruktorlari", nameEn: "Space Suits Designers", nameRu: "Конструкторы скафандров",
        subLessons: [
          { name: "Skafandr konstruktorlarining vazifasi", nameEn: "Role of Space Suits Designers", nameRu: "Роль конструкторов скафандров" },
          { name: "Bir ish kuni: skafandr konstruktorlari", nameEn: "A Day in the Life: Space Suits Designers", nameRu: "Один рабочий день: конструкторы скафандров" },
          { name: "Skafandr konstruktorlari oldidagi qiyinchiliklar", nameEn: "Challenges for Space Suits Designers", nameRu: "Трудности конструкторов скафандров" }
        ]
      }
    ]
  }
};
