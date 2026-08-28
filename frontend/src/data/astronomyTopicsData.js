export const astronomyTopicsData = {
  1: {
    id: 1,
    title: 'Quyosh tizimi',
    titleEn: 'Solar System', titleRu: 'Солнечная система',
    color: '#fbbf24',
    lessons: [
      { 
        name: "Sun", 
        subLessons: [
          { name: "Structure of the Sun" },
          { name: "Solar Energy & Fusion" },
          { name: "The Sun's Life Cycle" }
        ]
      },
      { 
        name: "Mercury", 
        subLessons: [
          { name: "Mercury's Extreme Environment" },
          { name: "Geology of the Smallest Planet" },
          { name: "Missions to Mercury" }
        ]
      },
      { 
        name: "Venus", 
        subLessons: [
          { name: "The Runaway Greenhouse Effect" },
          { name: "Venusian Surface & Volcanism" },
          // Venus is the evening star as often as it is the morning star —
          // NASA, Venus Facts: the ancients thought it "was two objects: a
          // morning star and an evening star".
          // https://science.nasa.gov/venus/venus-facts/
          {
            name: "Exploration of the Morning and Evening Star",
            slug: "astronomy-solar-system-exploration-of-the-morning-star",
          }
        ]
      },
      { 
        name: "Earth", 
        subLessons: [
          { name: "The Goldilocks Zone" },
          { name: "Atmosphere & Biosphere" },
          { name: "Earth's Magnetic Shield" }
        ]
      },
      { 
        name: "Mars", 
        subLessons: [
          { name: "The Red Planet's History" },
          { name: "Water on Mars" },
          { name: "Future Human Colonization" }
        ]
      },
      { 
        name: "Jupiter", 
        subLessons: [
          { name: "The King of Planets" },
          { name: "The Great Red Spot" },
          { name: "Jupiter's Galilean Moons" }
        ]
      },
      { 
        name: "Saturn", 
        subLessons: [
          { name: "Lord of the Rings" },
          { name: "Saturn's Hexagon Storm" },
          // The liquid is methane and ethane at about -180 C, not water —
          // NASA, Titan: "rivers, lakes and seas of liquid hydrocarbons like
          // methane and ethane".
          // https://science.nasa.gov/saturn/moons/titan/
          {
            name: "Titan: Lakes of Liquid Methane and Ethane",
            slug: "astronomy-solar-system-titan-a-world-with-liquid-lakes",
          }
        ]
      },
      { 
        name: "Uranus", 
        subLessons: [
          { name: "The Sideways Ice Giant" },
          { name: "Atmosphere & Composition" },
          { name: "Uranus's Ring System" }
        ]
      },
      { 
        name: "Neptune", 
        subLessons: [
          { name: "The Windy Blue Planet" },
          { name: "Triton: A Captured Moon" },
          { name: "Neptune's Dark Spots" }
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
      name: type,
      subLessons: [
        { name: `${type}-Type Characteristics` },
        { name: `Evolution of ${type} Stars` },
        { name: `Famous ${type}-Type Stars` }
      ]
    }))
  },
  3: {
    id: 3,
    title: 'Sun\'iy yo\'ldoshlar va raketalar',
    titleEn: 'Satellites and Rockets', titleRu: 'Искусственные спутники и ракеты',
    color: '#fbbf24',
    lessons: [
      { name: "Falcon 9", type: "rocket" },
      { name: "Falcon Heavy", type: "rocket" },
      { name: "Electron", type: "rocket" },
      { name: "New Shepard", type: "rocket" },
      { name: "Starship", type: "rocket" },
      { name: "International Space Station", type: "satellite" },
      { name: "Terra", type: "satellite" },
      { name: "Aqua", type: "satellite" },
      { name: "Envisat", type: "satellite" },
      { name: "Gaia", type: "satellite" }
    ].map(item => ({
      ...item,
      subLessons: [
        { name: `${item.name} Design` },
        { name: `${item.name} Launch History` },
        { name: `${item.name} Mission Impact` }
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
      "Planets", "Natural satellites", "Asteroids", "Comets", "Meteoroids", "Meteors", "Meteorites", "Galaxies", "Black holes", "Nebulae", "Quasars", "Pulsars", "Supernovae", "Exoplanets", "Galaxy clusters", "Cosmic dust and gas clouds"
    ].map(body => ({
      name: body,
      subLessons: [
        { name: `Understanding ${body}` },
        { name: `Physics of ${body}` },
        { name: `Observations of ${body}` }
      ]
    }))
  }
};
