export const lessonsData = [
  {
    id: "solar-system",
    level: "beginner",
    title: "The Solar System",
    duration: "15 min",
    explanation:
      "Our solar system consists of our star, the Sun, and everything bound to it by gravity — the planets Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune; dwarf planets such as Pluto; dozens of moons; and millions of asteroids, comets, and meteoroids.",
    visual: "https://picsum.photos/seed/solarsystem/800/400",
    quiz: {
      question: "Which planet is known as the Red Planet?",
      options: ["Venus", "Mars", "Jupiter", "Saturn"],
      correctAnswer: 1,
    },
  },
  {
    id: "stars-galaxies",
    level: "beginner",
    title: "Stars & Galaxies",
    duration: "20 min",
    explanation:
      "A galaxy is a huge collection of gas, dust, and billions of stars and their solar systems, all held together by gravity. We live in a galaxy called the Milky Way.",
    visual: "https://picsum.photos/seed/galaxy/800/400",
    quiz: {
      question: "What is the name of our galaxy?",
      options: ["Andromeda", "Triangulum", "Milky Way", "Sombrero"],
      correctAnswer: 2,
    },
  },
  {
    id: "black-holes",
    level: "intermediate",
    title: "Black Holes",
    duration: "25 min",
    explanation:
      "A black hole is a place in space where gravity pulls so much that even light can not get out. The gravity is so strong because matter has been squeezed into a tiny space. This can happen when a star is dying.",
    visual: "https://picsum.photos/seed/blackhole/800/400",
    quiz: {
      question: "What can escape the gravitational pull of a black hole?",
      options: ["Light", "Radio waves", "Nothing", "X-rays"],
      correctAnswer: 2,
    },
  },
  {
    id: "space-travel",
    level: "intermediate",
    title: "Space Travel",
    duration: "30 min",
    explanation:
      "Spaceflight is the use of astronomy and space technology to explore outer space. Physical exploration of space is conducted both by human spaceflights and by robotic spacecraft.",
    visual: "https://picsum.photos/seed/spacetravel/800/400",
    quiz: {
      question: "Who was the first human to journey into outer space?",
      options: ["Neil Armstrong", "Yuri Gagarin", "Buzz Aldrin", "John Glenn"],
      correctAnswer: 1,
    },
  },
  {
    id: "physics-basics",
    level: "advanced",
    title: "Physics Basics",
    duration: "40 min",
    explanation:
      "Physics is the natural science that studies matter, its fundamental constituents, its motion and behavior through space and time, and the related entities of energy and force.",
    visual: "https://picsum.photos/seed/physics/800/400",
    quiz: {
      question:
        "Which law states that for every action, there is an equal and opposite reaction?",
      options: [
        "Newton's First Law",
        "Newton's Second Law",
        "Newton's Third Law",
        "Law of Universal Gravitation",
      ],
      correctAnswer: 2,
    },
  },
];

export const videoData = [
  {
    id: "v1",
    title: "Journey to the Edge of the Universe",
    duration: "10:24",
    thumbnail: "https://picsum.photos/seed/universe/600/400",
    url: "https://www.youtube.com/embed/uD4izuDMUQA",
    category: "Documentary",
  },
  {
    id: "v2",
    title: "How Rockets Work",
    duration: "05:15",
    thumbnail: "https://picsum.photos/seed/rocketvid/600/400",
    url: "https://www.youtube.com/embed/OnoNITE-CLc",
    category: "Engineering",
  },
  {
    id: "v3",
    title: "The Search for Exoplanets",
    duration: "08:45",
    thumbnail: "https://picsum.photos/seed/exoplanet/600/400",
    url: "https://www.youtube.com/embed/711bZ_pLuZA",
    category: "Astronomy",
  },
  {
    id: "v4",
    title: "Living on the ISS",
    duration: "12:30",
    thumbnail: "https://picsum.photos/seed/iss/600/400",
    url: "https://www.youtube.com/embed/SGP6Y0Pnhe4",
    category: "Space Exploration",
  },
];

/*
 * `newsData` lived here: seven invented articles with stock photographs from
 * `picsum.photos`, which NewsView rendered whenever `/news/` failed or was
 * empty — in exactly the same cards as real reporting, and fetching a
 * third-party host from every reader's browser to do it. Removed on
 * 28 August 2026 with the News rebuild; the page now says it has nothing
 * rather than making something up. `newsHonesty.test.jsx` fails if it or
 * anything like it comes back.
 */

export const factsData = [
  "A day on Venus is longer than a year on Venus. It takes 243 Earth days to rotate once!",
  "One million Earths could fit inside the Sun.",
  "There are more trees on Earth than stars in the Milky Way.",
  "The sunset on Mars appears blue.",
  "Space is completely silent because there is no atmosphere to carry sound waves.",
  "A full NASA space suit costs $12,000,000.",
  "Neutron stars can spin 600 times per second.",
  "There is a planet made of diamonds twice the size of Earth.",
  "The footprints on the Moon will be there for 100 million years.",
  "Jupiter has 79 known moons.",
];
