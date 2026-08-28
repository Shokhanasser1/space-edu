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
    title: 'Kosmonavtlar',
    titleEn: 'Cosmonauts', titleRu: 'Космонавты',
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
