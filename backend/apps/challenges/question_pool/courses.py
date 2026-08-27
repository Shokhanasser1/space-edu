"""Online courses — how to study, and where.

Two of the ten questions this category started with are retired rather than
kept, because neither has a checkable answer: "which platform has the most
programming courses" and "which university has the world's most prestigious
space engineering programme". Both were marked against one opinion, and a
question a child can be marked wrong on for giving a defensible answer teaches
them that the quiz is arbitrary. Their Uzbek texts are in `RETIRED` in
seed_challenges.py, so the rows switch off rather than vanish.
"""
from .builder import for_category

q = for_category('courses')

QUESTIONS = [
    q("easy", 25,
      "MOOC qisqartmasining ma'nosi nima?",
      "What does the abbreviation MOOC stand for?",
      "Что означает аббревиатура MOOC?",
      ["Massive Open Online Course",
       "Modern Online Object Creation",
       "Multiple Online Open Classes",
       "Main Open Online Community"],
      ["Massive Open Online Course",
       "Modern Online Object Creation",
       "Multiple Online Open Classes",
       "Main Open Online Community"],
      ["Массовый открытый онлайн-курс",
       "Современное онлайн-создание объектов",
       "Множество открытых онлайн-занятий",
       "Главное открытое онлайн-сообщество"], 0,
      "MOOC — Massive Open Online Course, ya'ni ommaviy ochiq onlayn kurs. \"Massive\" — "
      "bir kursda o'n minglab talaba bo'lishi mumkinligi, \"open\" esa ro'yxatdan o'tish "
      "uchun diplom yoki imtihon talab qilinmasligi.",
      'MOOC stands for Massive Open Online Course. "Massive" means tens of thousands '
      'of students can take one course at once, and "open" means no qualification or '
      "entrance exam is needed to enrol.",
      "MOOC — Massive Open Online Course, массовый открытый онлайн-курс. «Massive» "
      "означает, что один курс могут проходить десятки тысяч человек, а «open» — что "
      "для записи не нужны диплом или вступительный экзамен."),
    q("easy", 30,
      "Fizika bo'yicha onlayn kurslarda eng ko'p o'qitiladigan birinchi mavzu qaysi?",
      "Which topic usually comes first in online physics courses?",
      "Какая тема обычно идёт первой в онлайн-курсах по физике?",
      ["Kinematika", "Kvant mexanikasi", "Termodinamika", "Optika"],
      ["Kinematics", "Quantum mechanics", "Thermodynamics", "Optics"],
      ["Кинематика", "Квантовая механика", "Термодинамика", "Оптика"], 0,
      "Kinematika harakatni sabablarini so'ramasdan tasvirlaydi — tezlik, tezlanish, "
      "yo'l. Shuning uchun u boshlanadi: dinamikaga (kuchlar) o'tish uchun avval "
      "harakatni tasvirlashni bilish kerak. Kvant mexanikasi esa oliy matematikani "
      "talab qiladi.",
      "Kinematics describes motion without asking what causes it — speed, "
      "acceleration, distance. It comes first because you have to be able to describe "
      "motion before you can explain it with forces. Quantum mechanics needs "
      "university-level mathematics first.",
      "Кинематика описывает движение, не спрашивая о его причинах: скорость, "
      "ускорение, путь. Она идёт первой, потому что описывать движение нужно уметь "
      "раньше, чем объяснять его через силы. А квантовая механика требует высшей "
      "математики."),
    q("easy", 30,
      "Masofaviy ta'limning afzalligi nimada?",
      "What is the advantage of distance learning?",
      "В чём преимущество дистанционного обучения?",
      ["Vaqt va joyga bog'liq emasligi",
       "Faqat kompyuterda o'qish mumkinligi",
       "Bepulligi",
       "Diplom berilmasligi"],
      ["It does not depend on time and place",
       "You can only study on a computer",
       "It is free",
       "No diploma is issued"],
      ["Не зависит от времени и места",
       "Учиться можно только за компьютером",
       "Оно бесплатное",
       "Диплом не выдаётся"], 0,
      "Asosiy afzallik — vaqt va joyga bog'liq emasligi: dars yozib olinadi, uni "
      "istalgan payt ko'rish mumkin. Bepulligi esa afzallik emas, chunki masofaviy "
      "kurslarning ko'pi pullik; telefonda ham o'qish mumkin va diplom ham beriladi.",
      "The real advantage is not depending on a time or a place: a recorded lesson can "
      "be watched whenever suits. Being free is not the answer — plenty of distance "
      "courses are paid; phones work as well as computers, and certificates are "
      "issued.",
      "Главное преимущество — независимость от времени и места: записанный урок можно "
      "посмотреть когда угодно. Бесплатность здесь ни при чём: многие дистанционные "
      "курсы платные, учиться можно и с телефона, и дипломы выдаются."),
    q("medium", 30,
      "Khan Academy qaysi universitetning talabasi tomonidan yaratilgan?",
      "A graduate of which university founded Khan Academy?",
      "Выпускник какого университета основал Khan Academy?",
      ["MIT", "Harvard", "Stanford", "Yale"],
      ["MIT", "Harvard", "Stanford", "Yale"],
      ["MIT", "Гарвард", "Стэнфорд", "Йель"], 0,
      "Salmon Xon MIT da uchta daraja olgan — matematika, elektrotexnika va "
      "informatika bo'yicha (keyinroq Garvardda MBA ham). Khan Academy 2008-yilda u "
      "amakivachchasiga matematikadan yozib bergan video darslardan o'sib chiqqan.",
      "Salman Khan took three degrees at MIT — mathematics, electrical engineering and "
      "computer science — and later an MBA at Harvard. Khan Academy grew out of the "
      "maths videos he recorded for his cousin, and became a non-profit in 2008.",
      "Салман Хан получил в MIT три степени — по математике, электротехнике и "
      "информатике (позже — MBA в Гарварде). Khan Academy выросла из видеоуроков по "
      "математике, которые он записывал для двоюродной сестры, и в 2008 году стала "
      "некоммерческой организацией."),
    q("easy", 30,
      "Python dasturlash tili qaysi yilda yaratilgan?",
      "In what year was the Python programming language created?",
      "В каком году был создан язык программирования Python?",
      ["1991", "2000", "1985", "1995"],
      ["1991", "2000", "1985", "1995"],
      ["1991", "2000", "1985", "1995"], 0,
      "Gvido van Rossum Pythonni 1989-yilning oxirida yoza boshlagan va birinchi "
      "ommaviy versiyasini 1991-yilda chiqargan. Bu sayt ishlaydigan server ham "
      "Pythonda yozilgan.",
      "Guido van Rossum started writing Python at the end of 1989 and released the "
      "first public version in 1991. The server behind this very site is written in "
      "Python.",
      "Гвидо ван Россум начал писать Python в конце 1989 года и выпустил первую "
      "публичную версию в 1991-м. Сервер, на котором работает этот сайт, тоже написан "
      "на Python."),
    q("medium", 35,
      "NASA Space Apps Challenge nima?",
      "What is the NASA Space Apps Challenge?",
      "Что такое NASA Space Apps Challenge?",
      ["Xalqaro hackathon", "Kosmik missiya", "Kurs platformasi", "Laboratoriya dasturi"],
      ["An international hackathon",
       "A space mission",
       "A course platform",
       "A laboratory programme"],
      ["Международный хакатон",
       "Космическая миссия",
       "Платформа курсов",
       "Лабораторная программа"], 0,
      "Bu — yiliga bir marta o'tkaziladigan xalqaro hackathon: jamoalar bir dam olish "
      "kuni ichida NASA ning ochiq ma'lumotlaridan foydalanib real masalalarga yechim "
      "yasaydi. Ma'lumotlar hammaga ochiq, shuning uchun O'zbekistondan ham qatnashish "
      "mumkin.",
      "It is an international hackathon held once a year: teams spend a weekend "
      "building something that solves a real problem using NASA's open data. The data "
      "is public, so a team from Uzbekistan can enter on the same terms as anyone "
      "else.",
      "Это международный хакатон, который проводится раз в год: за выходные команды "
      "создают решение реальной задачи на открытых данных NASA. Данные общедоступны, "
      "поэтому участвовать может и команда из Узбекистана."),
    q("easy", 25,
      "Qaysi tashkilot kosmik ta'lim bo'yicha bepul kurslar taqdim etadi?",
      "Which organisation offers free courses on space education?",
      "Какая организация предлагает бесплатные курсы по космическому образованию?",
      ["NASA", "Apple", "Microsoft", "Samsung"],
      ["NASA", "Apple", "Microsoft", "Samsung"],
      ["NASA", "Apple", "Microsoft", "Samsung"], 0,
      "NASA o'zining barcha ta'lim materiallarini, suratlarini va ma'lumotlar "
      "bazalarini bepul tarqatadi. Sababi oddiy: agentlik soliq hisobidan "
      "moliyalashtiriladi, shuning uchun uning ishi jamoat mulki hisoblanadi.",
      "NASA publishes its educational material, images and datasets free of charge. "
      "The reason is simple: the agency is funded by taxpayers, so its work is in the "
      "public domain.",
      "NASA бесплатно публикует свои образовательные материалы, изображения и наборы "
      "данных. Причина проста: агентство финансируется налогоплательщиками, поэтому "
      "его работа находится в общественном достоянии."),
    q("medium", 30,
      "STEM qisqartmasi nimani anglatadi?",
      "What does STEM stand for?",
      "Что означает аббревиатура STEM?",
      ["Science, Technology, Engineering, Mathematics",
       "Space, Technology, Energy, Mathematics",
       "Science, Teaching, Education, Modules",
       "System, Technology, Engineering, Management"],
      ["Science, Technology, Engineering, Mathematics",
       "Space, Technology, Energy, Mathematics",
       "Science, Teaching, Education, Modules",
       "System, Technology, Engineering, Management"],
      ["Наука, технологии, инженерия, математика",
       "Космос, технологии, энергетика, математика",
       "Наука, преподавание, образование, модули",
       "Система, технологии, инженерия, менеджмент"], 0,
      "Science, Technology, Engineering, Mathematics — fan, texnologiya, muhandislik "
      "va matematika. Bu to'rt sohani bitta nom ostida birlashtirishning sababi — ular "
      "alohida o'qitilganda bir-biriga ulanmay qolishi; kosmik loyihada to'rttasi ham "
      "bir vaqtda kerak bo'ladi.",
      "Science, Technology, Engineering, Mathematics. The four are grouped under one "
      "name because teaching them separately leaves them disconnected — and any real "
      "space project needs all four at once.",
      "Science, Technology, Engineering, Mathematics — наука, технологии, инженерия и "
      "математика. Их объединяют одним названием потому, что порознь они остаются "
      "несвязанными, а в любом реальном космическом проекте нужны все четыре сразу."),    # ── Reading, checking, and knowing whether to believe it ──
    q("medium", 35,
      "Ochiq kodli (open source) dastur nima?",
      "What is open-source software?",
      "Что такое программное обеспечение с открытым исходным кодом?",
      ["Manba kodi ochiq e'lon qilingan va litsenziyasi doirasida uni o'qish, ishlatish va o'zgartirish mumkin bo'lgan dastur",
       "Har doim bepul bo'ladigan dastur",
       "Faqat brauzerda ishlaydigan dastur",
       "Interfeyssiz dastur"],
      ["Software whose source code is published, and which its licence lets you read, use and change",
       "Software that is always free of charge",
       "Software that runs only in a browser",
       "Software without a user interface"],
      ["Программа, исходный код которой опубликован и которую её лицензия "
       "разрешает читать, использовать и изменять",
       "Программа, которая всегда бесплатна",
       "Программа, работающая только в браузере",
       "Программа без интерфейса"], 0,
      "Gap narxda emas, litsenziyada va kodga kirish huquqida. Ochiq kodli "
      "dasturlarning ko'pi bepul, lekin \"bepul\" va \"ochiq kodli\" bir xil "
      "narsa emas: bepul dasturning kodi yopiq bo'lishi mumkin, ochiq kodli "
      "dastur esa pulli sotilishi mumkin.",
      "It is about the licence and access to the code, not about price. Most "
      "open-source software is free of charge, but \"free\" and \"open source\" "
      "are different claims: a free program can be closed, and open-source "
      "software can be sold.",
      "Дело в лицензии и доступе к коду, а не в цене. Большинство открытых "
      "программ бесплатны, но «бесплатно» и «открытый код» — разные утверждения: "
      "бесплатная программа может быть закрытой, а открытую можно продавать."),
    q("medium", 35,
      "Kosmik agentliklardan qaysi biri bir nechta Yevropa davlati tomonidan birgalikda tashkil etilgan?",
      "Which space agency is run jointly by a group of European states?",
      "Какое космическое агентство создано совместно группой европейских государств?",
      ["ESA", "NASA", "JAXA", "ISRO"],
      ["ESA", "NASA", "JAXA", "ISRO"],
      ["ESA", "NASA", "JAXA", "ISRO"], 0,
      "ESA — Yevropa kosmik agentligi, uni yigirmadan ortiq davlat birgalikda "
      "moliyalashtiradi va boshqaradi. NASA — AQShning, JAXA — Yaponiyaning, "
      "ISRO esa Hindistonning milliy agentligi.",
      "ESA is the European Space Agency, funded and run jointly by more than "
      "twenty member states. NASA is the United States' agency, JAXA is Japan's "
      "and ISRO is India's.",
      "ESA — Европейское космическое агентство, которое совместно финансируют и "
      "которым управляют более двадцати государств. NASA — агентство США, "
      "JAXA — Японии, ISRO — Индии."),
    q("hard", 45,
      "Ilmiy maqolalar nashr etilishidan oldin \"peer review\" dan o'tkaziladi. Bu nima degani?",
      "Scientific papers go through peer review before publication. What does that mean?",
      "Научные статьи перед публикацией проходят рецензирование. Что это значит?",
      ["Shu sohaning boshqa mutaxassislari metodni va xulosalarni tekshiradi",
       "Muharrir imlo va grammatikani to'g'rilaydi",
       "O'quvchilar ovoz berish orqali baholaydi",
       "Bu har bir davlatda qonun talabi"],
      ["Other specialists in the same field check the method and the conclusions",
       "An editor corrects the spelling and grammar",
       "Readers vote on whether it is any good",
       "It is a legal requirement in every country"],
      ["Другие специалисты в той же области проверяют метод и выводы",
       "Редактор исправляет орфографию и грамматику",
       "Читатели голосуют, хороша ли статья",
       "Это требование закона в каждой стране"], 0,
      "Taqrizchilar ma'lumot yetarlimi, usul to'g'rimi va xulosa haqiqatan shu "
      "ma'lumotdan kelib chiqadimi — shuni tekshiradi. Bu natija to'g'ri degan "
      "kafolat emas: taqrizdan o'tgan maqolalar ham keyinchalik rad etilgan. "
      "Bu — noto'g'risining katta qismini ushlab qoladigan filtr.",
      "Reviewers check whether the data supports the claim, whether the method is "
      "sound, and whether the conclusion actually follows. It is not a guarantee "
      "that a result is right — reviewed papers have later been retracted. It is a "
      "filter that catches a great deal of what is wrong.",
      "Рецензенты проверяют, достаточно ли данных, корректен ли метод и следует ли "
      "вывод из результатов. Это не гарантия правильности: и прошедшие "
      "рецензирование статьи потом отзывали. Это фильтр, отсекающий значительную "
      "часть ошибочного."),
    q("hard", 45,
      "Internetdagi ma'lumot ishonchli ekanini tekshirishning eng yaxshi usuli qaysi?",
      "What is the best way to check whether something you read online is reliable?",
      "Как лучше всего проверить, надёжна ли информация из интернета?",
      ["Da'vo mustaqil manbalarda takrorlanganini va dastlabki ma'lumot qayerdan olinganini tekshirish",
       "Uni necha kishi ulashganiga qarash",
       "Sayt chiroyli va professional ko'rinsa, ishonish",
       "Qidiruv natijalarida birinchi turgan bo'lsa, ishonish"],
      ["Check whether independent sources repeat the claim, and where the original data came from",
       "See how many people have shared it",
       "Trust it if the website looks professional",
       "Trust it if it is the top search result"],
      ["Проверить, повторяют ли утверждение независимые источники и откуда взяты "
       "исходные данные",
       "Посмотреть, сколько людей им поделились",
       "Верить, если сайт выглядит профессионально",
       "Верить, если это первый результат поиска"], 0,
      "Dizayn, ulashishlar soni va qidiruvdagi o'rin — uchalasi ham ma'lumotning "
      "to'g'riligi haqida hech narsa aytmaydi; ular faqat kimdir yaxshi sayt "
      "yasay olganini yoki ko'p odam ulashganini bildiradi. Yagona ishonchli "
      "yo'l — dastlabki manbaga qaytish va uni mustaqil tekshirish.",
      "Design, share counts and search ranking say nothing about whether a claim "
      "is true; they say someone built a good-looking site or that a lot of people "
      "passed it on. The one thing that works is tracing the claim back to its "
      "original source and seeing who else found the same thing independently.",
      "Дизайн, число репостов и место в выдаче ничего не говорят о правдивости — "
      "они говорят лишь о том, что кто-то сделал красивый сайт или что многие "
      "поделились. Работает только одно: дойти до первоисточника и проверить, "
      "кто ещё независимо получил тот же результат."),
]
