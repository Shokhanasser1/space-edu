"""Which lesson each question belongs to.

`ChallengeQuestion.lesson` has existed since ADR 0001 step 5 and nothing had
ever filled it in, so every "Test" button on a lesson row fell through to the
subject pool. This is the file that fills it in.

**Read against the lesson, never assigned by position.** A neighbouring branch
had to be undone for handing lessons a video by
`(lessonIdx + partIdx + subIdx) % 10`, which looks like content and is noise.
Each line below is a question whose subject *is* the lesson it sits under: the
average-speed problem belongs to "Non-uniform motion" because average speed is
what that lesson is; the braking-distance question belongs to "Displacement in
uniformly accelerated motion" because `v² = 2as` is that lesson's formula.

A question keeps its category and stays in the subject pool as well — attaching
adds the lesson quiz, it does not move the question out of the daily challenge
or the category test.

Keyed on the Uzbek question text for the same reason `seed_challenges` matches
rows on it: it is the one identifier a question has that survives re-running
the seed. `seed_challenges.check` refuses to seed if a text here is not in the
pool, so a typo is a failed seed rather than a silently empty lesson.

Where a lesson is not listed, its test does not exist yet and the screen says
so — see `frontend/src/views/quiz/QuizSessionView.jsx`. That is most of the 474
lessons. It is meant to be extended by whoever writes the questions next.
"""

# ── PHYSICS · Kinematics ─────────────────────────────────────────────────────
KINEMATICS = {
    'physics-kinematics-basic-concepts-in-mechanics': (
        'Mexanik harakat nima?',
        'Moddiy nuqta deb nimaga aytiladi?',
        'Sanoq sistemasi nimalardan iborat?',
    ),
    'physics-kinematics-straight-line-uniform-motion': (
        "Jism to'g'ri chiziq bo'ylab 5 m/s tezlik bilan harakatlanmoqda. "
        '10 sekundda qanday masofa bosib o\'tadi?',
    ),
    'physics-kinematics-graphical-representation-of-straight-line-uniform-motion': (
        'Tekis harakatlanayotgan jismning tezlik-vaqt grafigi qanday?',
    ),
    # Average speed over two halves of a road is the whole point of the lesson:
    # it is not (60 + 40) / 2, and the question exists to catch exactly that.
    'physics-kinematics-non-uniform-motion': (
        "Avtomobil yo'lning birinchi yarmini 60 km/soat, ikkinchi yarmini "
        "40 km/soat tezlik bilan o'tdi. O'rtacha tezlikni toping.",
    ),
    'physics-kinematics-uniformly-accelerated-motion-acceleration-instantaneous-velocity': (
        "Tezligi har sekundda 2 m/s ga ortib boruvchi jismning tezlanishi qancha?",
        "Tezligi 4 m/s bo'lgan jism 2 m/s^2 tezlanish bilan harakatlansa, "
        '5 sekunddan keyingi tezligi qancha?',
    ),
    # v² = 2as, so the distance goes with the square of the speed. That formula
    # is this lesson and nowhere else in the tree.
    'physics-kinematics-displacement-in-uniformly-accelerated-motion': (
        "Avtomobil tezligi ikki barobar oshsa, tormozlash masofasi qanday o'zgaradi?",
    ),
    'physics-kinematics-acceleration-in-curvilinear-motion': (
        "R=2 m radiusli aylana bo'ylab 4 m/s tezlik bilan harakatlanayotgan "
        'jismning markazga intilma tezlanishi qancha?',
    ),
}

# ── PHYSICS · Dynamics ───────────────────────────────────────────────────────
DYNAMICS = {
    'physics-dynamics-force-newtons-first-law': (
        'Nyutonning birinchi qonuni nimani ifodalaydi?',
    ),
    'physics-dynamics-newtons-second-law': (
        "Massasi 2 kg bo'lgan jismga 10 N kuch ta'sir qilsa, u qanday tezlanish oladi?",
        'Massasi 1000 kg avtomobil 20 m/s tezlikdan 50 m masofada '
        "to'liq to'xtadi. Tormozlash kuchi qancha?",
    ),
    # A rocket in vacuum is the third law's best case: nothing to push against
    # but the exhaust it throws backwards.
    'physics-dynamics-newtons-third-law': (
        "Nyutonning uchinchi qonuni qanday ta'riflanadi?",
        "Kosmosda itariladigan havo yo'q. Unda raketa qanday qilib tezlanadi?",
    ),
    'physics-dynamics-law-of-universal-gravitation': (
        'Ikki jism orasidagi masofa ikki barobar ortsa, ular orasidagi '
        "tortishish kuchi qanday o'zgaradi?",
        "Yer sirtidan 6400 km balandlikka ko'tarilgan jismga ta'sir etuvchi "
        'tortishish kuchi yer yuzasidagidan necha marta kichik? (Yer radiusi 6400 km)',
    ),
    'physics-dynamics-gravity': (
        'Yer sirtiga yaqin joyda erkin tushish tezlanishi qanchaga teng?',
        "Havo qarshiligini hisobga olmasak, bir xil balandlikdan tashlangan "
        '1 kg va 10 kg jismlardan qaysi biri avval yerga tushadi?',
        'Nima uchun Oyda tashlangan tosh Yerdagidan sekinroq tushadi?',
    ),
    'physics-dynamics-elastic-force': (
        "Bikrligi 100 N/m bo'lgan prujinani 2 sm ga cho'zish uchun "
        'qancha ish bajarish kerak?',
    ),
    'physics-dynamics-weight': (
        "Massasi 60 kg bo'lgan kosmonavt Oyda qancha og'irlik kuchiga ega "
        '(g_oy=1.6 m/s^2)?',
    ),
    'physics-dynamics-weightlessness': (
        "Kosmik kemada astronavt vaznsizlik holatida bo'lsa, uning massasi "
        "va og'irligi qanday bo'ladi?",
    ),
    'physics-dynamics-vertical-motion-of-a-body-under-gravity': (
        'Jism vertikal yuqoriga 20 m/s tezlik bilan otildi. U eng baland '
        'nuqtaga necha sekundda yetib boradi (g=10)?',
        'Jism 20 m balandlikdan erkin tushdi. U yerga qanday tezlik bilan '
        'uriladi (g=10)?',
    ),
    'physics-dynamics-artificial-satellites-of-the-earth': (
        "Nima uchun sun'iy yo'ldosh orbitada qolish uchun dvigatelini yoqib turmaydi?",
        "Yer atrofida uchayotgan sun'iy yo'ldoshning orbital tezligi taxminan qancha?",
        'Ikkinchi kosmik tezlik (Yerdan qochish tezligi) qanchaga teng?',
    ),
}

# ── ASTRONOMY ────────────────────────────────────────────────────────────────
# The astronomy screens put the Test button on the top-level node (Jupiter,
# Saturn, Black holes), which is the row a child sees; its sub-lessons are
# reached from inside. So the slugs here are those nodes, not their children.
ASTRONOMY = {
    'astronomy-solar-system-mercury': (
        "Nima uchun Merkuriyda atmosfera deyarli yo'q?",
    ),
    'astronomy-solar-system-mars': (
        'Mars sayyorasining rangi qanday?',
    ),
    'astronomy-solar-system-jupiter': (
        'Quyosh sistemasidagi eng katta sayyora qaysi?',
        "Yupiterning eng katta yo'ldoshi qaysi?",
    ),
    # Titan is Saturn's moon, and the lesson under this node is literally
    # "Titan: Lakes of Liquid Methane and Ethane".
    'astronomy-solar-system-saturn': (
        'Saturnning halqalari asosan nimadan iborat?',
        "Quyosh tizimidagi qaysi jismda suyuq metan ko'llari mavjud?",
    ),
    # Proxima Centauri is an M-type red dwarf, which is what this node is.
    'astronomy-stars-m': (
        'Quyoshdan tashqari Yerga eng yaqin yulduz qaysi?',
    ),
    'astronomy-celestial-bodies-planets': (
        "Sayyoraning Quyoshdan uzoqligi va aylanish davri qanday bog'langan?",
        'Nima uchun sayyoralar yulduzlardan farqli o\'laroq "miltillamaydi"?',
        'Astronomlar sayyoraning atmosferasi nimadan iboratligini qanday aniqlaydi?',
    ),
    'astronomy-celestial-bodies-natural-satellites': (
        'Oyning Yer atrofida aylanish davri qancha?',
        "Nima uchun Yerdan Oyning orqa tomonini hech qachon ko'ra olmaymiz?",
    ),
    'astronomy-celestial-bodies-galaxies': (
        'Galaktikamizning nomi nima?',
        'Koinotning kengayishini kim kashf qilgan?',
    ),
    'astronomy-celestial-bodies-black-holes': (
        'Qora tuynuk nima?',
    ),
    # A pulsar is a rotating neutron star; this is the only node in the tree
    # where that object is the subject.
    'astronomy-celestial-bodies-pulsars': (
        'Neytron yulduzi nima?',
    ),
    'astronomy-celestial-bodies-exoplanets': (
        "Astronomlar boshqa yulduz atrofidagi sayyorani ko'pincha qanday topadi?",
    ),
}

#: `{lesson slug: (Uzbek question text, ...)}` for the whole tree.
LESSON_LINKS = {
    slug: texts
    for group in (KINEMATICS, DYNAMICS, ASTRONOMY)
    for slug, texts in group.items()
    if texts
}

#: The same thing the way the seed needs it: `{question text: lesson slug}`.
LESSON_OF_QUESTION = {
    text: slug for slug, texts in LESSON_LINKS.items() for text in texts
}
