export const interviewsTopicsData = {
  1: {
    id: 1,
    title: 'Professorlar',
    titleEn: 'Professors', titleRu: 'Профессора',
    color: '#3b82f6',
    sections: [
      {
        name: "Astronomy",
        lessons: [
          "Neil deGrasse Tyson", "Kip Thorne", "Brian Cox", "Andrea Ghez", "Adam Riess", "Saul Perlmutter", "Roger Penrose"
        ].map(name => ({
          name,
          subLessons: [
            { name: `${name}'s Early Career` },
            { name: `${name}'s Greatest Discoveries` },
            { name: `${name} on Future of Space` }
          ]
        }))
      },
      {
        name: "Physics",
        lessons: [
          "Edward Witten", "Juan Maldacena", "Lisa Randall", "David Gross", "Frank Wilczek", "Ashoke Sen", "Cumrun Vafa"
        ].map(name => ({
          name,
          subLessons: [
            { name: `${name}'s Research Focus` },
            { name: `${name}'s Theoretical Impact` },
            { name: `In Conversation with ${name}` }
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
      "Yuri Gagarin", "Neil Armstrong", "Buzz Aldrin", "Valentina Tereshkova"
    ].map(name => ({
      name,
      subLessons: [
        { name: `${name}'s Training` },
        { name: `${name}'s Historic Mission` },
        { name: `Legacy of ${name}` }
      ]
    }))
  },
  3: {
    id: 3,
    title: 'Boshqa xodimlar',
    titleRu: 'Другие сотрудники',
    titleEn: 'Other Workers',
    color: '#3b82f6',
    lessons: [
      "Mission Control", "Rocket Engineers", "Space Suits Designers"
    ].map(name => ({
      name,
      subLessons: [
        { name: `Role of ${name}` },
        { name: `A Day in the Life: ${name}` },
        { name: `Challenges for ${name}` }
      ]
    }))
  }
};
