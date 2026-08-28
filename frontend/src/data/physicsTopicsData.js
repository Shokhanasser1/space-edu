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
 */
export const physicsTopicsData = {
  1: {
    id: 1,
    title: 'Kinematika',
    titleEn: 'Kinematics', titleRu: 'Кинематика',
    color: '#00e5ff',
    lessons: [
      { name: "Basic concepts in mechanics", videoUrl: "https://www.youtube.com/watch?v=LF98SpIWZac" },
      "Straight-line uniform motion",
      { name: "Graphical representation of straight-line uniform motion", videoUrl: "https://www.youtube.com/watch?v=BTJmrnzT_eQ" },
      { name: "Relativity of motion", videoUrl: "https://www.youtube.com/watch?v=gqphgVyTzqs" },
      { name: "Non-uniform motion", videoUrl: "https://www.youtube.com/watch?v=Sn0EEL5E2cI" },
      { name: "Uniformly accelerated motion. Acceleration. Instantaneous velocity", videoUrl: "https://www.youtube.com/watch?v=HK1qm34dy9E" },
      { name: "Displacement in uniformly accelerated motion", videoUrl: "https://www.youtube.com/watch?v=RYKrRm8dPPw" },
      "Motion of two bodies",
      { name: "Graphical representation of uniformly accelerated motion", videoUrl: "https://www.youtube.com/watch?v=8HC7N9D29TE" },
      "Curvilinear motion",
      // Centripetal acceleration is what a body accelerating along a curve has.
      { name: "Acceleration in curvilinear motion", videoUrl: "https://www.youtube.com/watch?v=Njc5QCRU4ZQ" },
      "Transmission of rotational motion",
      "Non-uniform circular motion"
    ]
  },
  2: {
    id: 2,
    title: 'Dinamika',
    titleEn: 'Dynamics', titleRu: 'Динамика',
    color: '#00e5ff',
    lessons: [
      { name: "Force. Newton's first law", videoUrl: "https://www.youtube.com/watch?v=K9wubX_VPAA" },
      "Mass. Density",
      { name: "Newton's second law", videoUrl: "https://www.youtube.com/watch?v=BkUyufANeo4" },
      { name: "Newton's third law", videoUrl: "https://www.youtube.com/watch?v=_sSdSI3PqWo" },
      { name: "Law of universal gravitation", videoUrl: "https://www.youtube.com/watch?v=9qKK4LI0OYg" },
      // "g as the strength of the gravitational field a body sits in".
      { name: "Gravity", videoUrl: "https://www.youtube.com/watch?v=ila7kbiQucs" },
      "Elastic force",
      { name: "Weight", videoUrl: "https://www.youtube.com/watch?v=tP2tQtnR9bg" },
      // "Are astronauts in orbit free of gravity?" — the lesson, exactly.
      { name: "Weightlessness", videoUrl: "https://www.youtube.com/watch?v=wD8HqX6gGZc" },
      { name: "Vertical motion of a body under gravity", videoUrl: "https://www.youtube.com/watch?v=KicO4MoOMS4" },
      { name: "Motion of a body thrown horizontally", videoUrl: "https://www.youtube.com/watch?v=W9l1urFgiu4" },
      { name: "Motion of a body thrown at an angle to the horizon", videoUrl: "https://www.youtube.com/watch?v=5nOnhTq20vk" },
      // Working out the orbital speed of the ISS, which is what a satellite is.
      { name: "Artificial satellites of the Earth", videoUrl: "https://www.youtube.com/watch?v=yM-KakIQRGA" },
      { name: "Friction force. Static friction", videoUrl: "https://www.youtube.com/watch?v=YP_hnGED0mQ" },
      { name: "Sliding friction force", videoUrl: "https://www.youtube.com/watch?v=h6I7Lp_M--Q" },
      { name: "Motion under the action of multiple forces", videoUrl: "https://www.youtube.com/watch?v=JRfEbz32HLU" }
    ]
  },
  3: {
    id: 3,
    title: 'Statika',
    titleEn: 'Statics', titleRu: 'Статика',
    color: '#00e5ff',
    lessons: [
      "Center of gravity of a body",
      "Conditions of equilibrium",
      "Body, force, and momentum",
      "Law of conservation of momentum",
      { name: "Mechanical work", videoUrl: "https://www.youtube.com/watch?v=RmMvfob6SHk" },
      "Kinetic energy",
      "Potential energy",
      "Potential energy of a deformed spring",
      { name: "Law of conservation of total mechanical energy", videoUrl: "https://www.youtube.com/watch?v=R97ptRkXgD8" },
      "Work of forces applied to a body. Conversion of mechanical energy into heat",
      "Power",
      "Efficiency"
    ]
  },
  4: {
    id: 4,
    title: 'Suyuqlik va gazlar mexanikasi',
    titleEn: 'Mechanics of Fluids and Gases', titleRu: 'Механика жидкостей и газов',
    color: '#00e5ff',
    lessons: [
      "Pressure. Pascal's law",
      "Hydrostatic pressure",
      "Communicating vessels",
      "Atmospheric pressure",
      "Hydraulic press",
      "Archimedes' force",
      "Flow of liquids in a pipe. Bernoulli's law"
    ]
  },
  5: {
    id: 5,
    title: 'Tebranishlar va to\'lqinlar',
    titleEn: 'Oscillations and Waves', titleRu: 'Колебания и волны',
    color: '#00e5ff',
    lessons: [
      "Basic concepts characterizing oscillatory motion",
      "Spring pendulum",
      "Mathematical pendulum",
      "Equation of harmonic oscillations",
      "Energy of an oscillating body",
      "Resonance",
      "Mechanical waves",
      "Sound waves"
    ]
  },
  6: {
    id: 6,
    title: 'Molekulyar fizika',
    titleEn: 'Molecular Physics', titleRu: 'Молекулярная физика',
    color: '#00e5ff',
    lessons: [
      "Structure of matter and its basic properties",
      "Ideal gas. Basic equation of MKT",
      "Absolute temperature. Average kinetic energy of molecules",
      "Root mean square speed of gas molecules",
      "Equation of state of an ideal gas",
      "Clapeyron equation",
      "Change in gas mass",
      "Isobaric, isochoric, isothermal processes",
      "Problems with graphs",
      "Saturated vapor. Critical temperature",
      "Air humidity",
      "Capillarity phenomena. Surface tension",
      "Mechanical properties of solids",
      "Thermal expansion"
    ]
  },
  7: {
    id: 7,
    title: 'Termodinamika',
    titleEn: 'Thermodynamics', titleRu: 'Термодинамика',
    color: '#00e5ff',
    lessons: [
      "Internal energy",
      "Work in thermodynamics",
      "Amount of heat",
      "First law of thermodynamics",
      "Adiabatic process. Second law of thermodynamics",
      "Heat engines"
    ]
  },
  8: {
    id: 8,
    title: 'Elektrostatika',
    titleEn: 'Electrostatics', titleRu: 'Электростатика',
    color: '#00e5ff',
    lessons: [
      "Electric charge. Law of conservation of charge",
      "Coulomb's law",
      "Electric field. Electric field strength",
      "Conductors in an electric field",
      "Fields of a charged sphere and plane",
      "Dielectrics in an electric field",
      "Work of a uniform electric field. Potential",
      "Potential of a point charge and a charged sphere",
      "Equipotential surfaces",
      "Relationship between E and φ",
      "Electric capacitance. Capacitors",
      "Parallel and series connection of capacitors",
      "Energy of a charged capacitor"
    ]
  },
  9: {
    id: 9,
    title: 'O\'zgarmas tok qonunlari',
    titleEn: 'Direct Current Laws', titleRu: 'Законы постоянного тока',
    color: '#00e5ff',
    lessons: [
      "Electric current. Current strength",
      "Ohm's law for a section of a circuit. Resistance",
      "Electric circuits. Series and parallel connection of conductors",
      "Connecting additional resistance to an ammeter and voltmeter",
      "Work and power of direct current",
      "Joule-Lenz law",
      "Series and parallel connection of lamps",
      "Ohm's law for a complete circuit",
      "Series and parallel connection of current sources"
    ]
  },
  10: {
    id: 10,
    title: 'Turli muhitlarda elektr qonunlari',
    titleEn: 'Electric Current in Different Media', titleRu: 'Законы электрического тока в различных средах',
    color: '#00e5ff',
    lessons: [
      "Electric current in metals",
      "Electric current in semiconductors",
      "Electric current in vacuum",
      "Electric current in liquids",
      "Electric current in gases",
      "Mixed problems"
    ]
  },
  11: {
    id: 11,
    title: 'Elektromagnit hodisalar',
    titleEn: 'Electromagnetic Phenomena', titleRu: 'Электромагнитные явления',
    color: '#00e5ff',
    lessons: [
      "Permanent magnets. Magnetic field. Magnetic field of currents",
      "Ampere force",
      "Lorentz force",
      "Magnetic properties of matter",
      "Magnetic flux",
      "Law of electromagnetic induction. Lenz's rule",
      "Self-induction. Inductance",
      "Energy of the magnetic field of a current"
    ]
  },
  12: {
    id: 12,
    title: 'Elektromagnit tebranishlar va to\'lqinlar',
    titleEn: 'Electromagnetic Oscillations and Waves', titleRu: 'Электромагнитные колебания и волны',
    color: '#00e5ff',
    lessons: [
      "Charge, voltage, and current in an oscillatory circuit",
      "Thomson's formula for an ideal oscillatory circuit",
      "Energy in an oscillatory circuit",
      "Alternating current generator",
      "Active resistance in an AC circuit",
      "Capacitor in an AC circuit",
      "Inductor in an AC circuit",
      "Active resistance, capacitor, and inductor in an AC circuit",
      "Transformer",
      "Electromagnetic waves",
      "Radio communication. Radiolocation"
    ]
  },
  13: {
    id: 13,
    title: 'Optika',
    titleEn: 'Optics', titleRu: 'Оптика',
    color: '#00e5ff',
    lessons: [
      "Reflection of light",
      "Refraction of light",
      "Wave nature of light",
      "Total internal reflection",
      "Lenses",
      "Lens formula",
      "Optical instruments",
      "Interference",
      "Diffraction",
      "Polarization",
      "Elements of the theory of relativity",
      "Relationship between mass and energy",
      "Emission and absorption spectra",
      "Light quanta. Photons",
      "X-rays",
      "Photoelectric effect"
    ]
  },
  14: {
    id: 14,
    title: 'Atom va yadro fizikasi',
    titleEn: 'Atomic and Nuclear Physics', titleRu: 'Атомная и ядерная физика',
    color: '#00e5ff',
    lessons: [
      "Rutherford's experiment. Bohr's postulates",
      "Structure of the atomic nucleus. Radioactivity",
      "Law of radioactive decay",
      "Nuclear binding energy",
      "Nuclear reactions"
    ]
  }
};
