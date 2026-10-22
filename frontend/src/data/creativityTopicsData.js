/**
 * Names in three languages since 22 Oct 2026: `name` is the Uzbek one, as on
 * every other row of the learn tree, `nameEn` the English one the slug is
 * derived from. The subject comes first and what is done with it after a
 * colon, so a generated title never has to decline the name.
 */
export const creativityTopicsData = {
  1: {
    id: 1,
    title: 'Sayyora modullari',
    titleRu: 'Планетарные модули',
    titleEn: 'Planet Modules',
    color: '#f472b6',
    lessons: [
      { en: "Sun", uz: "Quyosh", ru: "Солнце" },
      { en: "Mercury", uz: "Merkuriy", ru: "Меркурий" },
      { en: "Venus", uz: "Venera", ru: "Венера" },
      { en: "Earth", uz: "Yer", ru: "Земля" },
      { en: "Mars", uz: "Mars", ru: "Марс" },
      { en: "Jupiter", uz: "Yupiter", ru: "Юпитер" },
      { en: "Saturn", uz: "Saturn", ru: "Сатурн" },
      { en: "Uranus", uz: "Uran", ru: "Уран" },
      { en: "Neptune", uz: "Neptun", ru: "Нептун" }
    ].map(({ en, uz, ru }) => ({
      name: uz,
      nameEn: en,
      nameRu: ru,
      subLessons: [
        { name: `${uz}: modul loyihasi`, nameEn: `${en} Module Design`, nameRu: `${ru}: проект модуля` },
        { name: `${uz}: qo'nish tizimlari`, nameEn: `${en} Landing Systems`, nameRu: `${ru}: системы посадки` },
        { name: `${uz}: yashash bazasini qurish`, nameEn: `${en} Habitat Construction`, nameRu: `${ru}: строительство обитаемой базы` }
      ]
    }))
  },
  2: {
    id: 2,
    title: 'Raketalar va sun\'iy yo\'ldoshlar',
    titleEn: 'Rockets and Satellites', titleRu: 'Ракеты и искусственные спутники',
    color: '#f472b6',
    lessons: [
      // A spacecraft's name is a proper name and is written the same in all
      // three languages; only the station has one that translates.
      { en: "Falcon 9" },
      { en: "Falcon Heavy" },
      { en: "Electron" },
      { en: "New Shepard" },
      { en: "Starship" },
      { en: "International Space Station", uz: "Xalqaro kosmik stansiya", ru: "Международная космическая станция" },
      { en: "Terra" },
      { en: "Aqua" },
      { en: "Envisat" },
      { en: "Gaia" }
    ].map(({ en, uz = en, ru = en }) => ({
      name: uz,
      nameEn: en,
      nameRu: ru,
      subLessons: [
        { name: `${uz}: muhandislik yechimlari`, nameEn: `${en} Engineering`, nameRu: `${ru}: инженерные решения` },
        { name: `${uz}: ish orbitasi`, nameEn: `${en} Operational Orbit`, nameRu: `${ru}: рабочая орбита` },
        { name: `${uz}: kelgusi takomillashtirishlar`, nameEn: `${en} Future Upgrades`, nameRu: `${ru}: будущие улучшения` }
      ]
    }))
  }
};
