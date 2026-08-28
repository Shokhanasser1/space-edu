export const creativityTopicsData = {
  1: {
    id: 1,
    title: 'Sayyora modullari',
    titleRu: 'Планетарные модули',
    titleEn: 'Planet Modules',
    color: '#f472b6',
    lessons: [
      "Sun", "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"
    ].map(name => ({
      name,
      subLessons: [
        { name: `${name} Module Design` },
        { name: `${name} Landing Systems` },
        { name: `${name} Habitat Construction` }
      ]
    }))
  },
  2: {
    id: 2,
    title: 'Raketalar va sun\'iy yo\'ldoshlar',
    titleEn: 'Rockets and Satellites', titleRu: 'Ракеты и искусственные спутники',
    color: '#f472b6',
    lessons: [
      "Falcon 9", "Falcon Heavy", "Electron", "New Shepard", "Starship", "International Space Station", "Terra", "Aqua", "Envisat", "Gaia"
    ].map(name => ({
      name,
      subLessons: [
        { name: `${name} Engineering` },
        { name: `${name} Operational Orbit` },
        { name: `${name} Future Upgrades` }
      ]
    }))
  }
};
