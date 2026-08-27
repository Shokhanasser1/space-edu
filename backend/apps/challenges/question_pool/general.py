"""General space — the questions a child meets before any of the subjects.

Every explanation has to give the child something they did not walk in with.
"Mars is the Red Planet" is not an explanation of why Mars is the Red Planet.
"""
from .builder import for_category

q = for_category('general')

QUESTIONS = [
    # ── Beginner ──
    q('easy', 20,
      "Qaysi sayyora Qizil sayyora deb ataladi?",
      "Which planet is known as the Red Planet?",
      "Какую планету называют Красной планетой?",
      ["Venera", "Mars", "Yupiter", "Saturn"],
      ["Venus", "Mars", "Jupiter", "Saturn"],
      ["Венера", "Марс", "Юпитер", "Сатурн"], 1,
      "Mars yuzasi temir oksidiga — zanglagan temirga — boy chang bilan "
      "qoplangan. Zang qizil bo'lgani uchun butun sayyora qizg'ish ko'rinadi.",
      "Mars is covered in dust rich in iron oxide — rust. Rust is red, so the "
      "whole surface takes on that colour.",
      "Марс покрыт пылью, богатой оксидом железа — ржавчиной. Ржавчина "
      "красная, поэтому и вся поверхность выглядит красноватой."),
    q('easy', 20,
      "Yerga eng yaqin yulduz qaysi?",
      "What is the closest star to Earth?",
      "Какая звезда ближе всего к Земле?",
      ["Sirius", "Alfa Sentavr", "Quyosh", "Betelgeyze"],
      ["Sirius", "Alpha Centauri", "The Sun", "Betelgeuse"],
      ["Сириус", "Альфа Центавра", "Солнце", "Бетельгейзе"], 2,
      "Quyosh ham yulduz — shunchaki juda yaqin. U bizdan 150 million km, "
      "keyingi yaqin yulduzgacha esa 40 trillion km dan ortiq.",
      "The Sun is a star too — just a very close one. It is 150 million km "
      "away; the next nearest star is over 40 trillion km.",
      "Солнце — тоже звезда, просто очень близкая. До него 150 млн км, а до "
      "следующей ближайшей звезды — более 40 трлн км."),
    q('easy', 20,
      "Quyosh tizimidagi eng katta sayyora qaysi?",
      "Which planet is the largest in our solar system?",
      "Какая планета Солнечной системы самая большая?",
      ["Yer", "Saturn", "Yupiter", "Neptun"],
      ["Earth", "Saturn", "Jupiter", "Neptune"],
      ["Земля", "Сатурн", "Юпитер", "Нептун"], 2,
      "Yupiter shu qadar kattaki, qolgan barcha sayyoralarni birga qo'shsangiz "
      "ham u og'irroq chiqadi. Diametri Yernikidan taxminan 11 barobar katta.",
      "Jupiter outweighs every other planet in the solar system put together. "
      "Its diameter is about 11 times Earth's.",
      "Юпитер тяжелее всех остальных планет Солнечной системы вместе взятых. "
      "Его диаметр примерно в 11 раз больше земного."),
    q('easy', 20,
      "Yerning nechta tabiiy yo'ldoshi bor?",
      "How many moons does Earth have?",
      "Сколько естественных спутников у Земли?",
      # Words rather than 0/1/2/3: `spread_answers` rotates the options, and a
      # rotated list of digits reads like a mistake.
      ["Bitta ham yo'q", "Bitta", "Ikkita", "To'rtta"],
      ["None", "One", "Two", "Four"],
      ["Ни одного", "Один", "Два", "Четыре"], 1,
      "Yerning bitta tabiiy yo'ldoshi — Oy bor. U sayyorasiga nisbatan "
      "Quyosh tizimidagi eng yirik yo'ldoshlardan biri.",
      "Earth has one natural satellite, the Moon. Relative to its planet it is "
      "one of the largest moons in the solar system.",
      "У Земли один естественный спутник — Луна. По отношению к своей планете "
      "это один из крупнейших спутников Солнечной системы."),
    q('easy', 20,
      "Kosmosdan kelib Yerga tushgan toshni nima deyiladi?",
      "What do we call a rock from space that hits Earth?",
      "Как называется камень из космоса, упавший на Землю?",
      ["Meteor", "Meteorit", "Asteroid", "Kometa"],
      ["Meteor", "Meteorite", "Asteroid", "Comet"],
      ["Метеор", "Метеорит", "Астероид", "Комета"], 1,
      "Uchta nom bitta jismning uchta holati: kosmosdagi tosh — meteoroid, "
      "atmosferada yonayotgan yorug' iz — meteor, yerga yetib kelgani — meteorit.",
      "Three names for three stages of one object: a rock in space is a "
      "meteoroid, the streak of light as it burns up is a meteor, and what "
      "reaches the ground is a meteorite.",
      "Три названия для трёх стадий одного объекта: камень в космосе — "
      "метеороид, светящийся след при сгорании в атмосфере — метеор, а то, что "
      "долетело до земли, — метеорит."),
    q('easy', 25,
      "Nima uchun kunduzi osmonda yulduzlar ko'rinmaydi?",
      "Why can we not see the stars during the day?",
      "Почему днём на небе не видно звёзд?",
      ["Ular kunduzi so'nadi",
       "Quyosh nuri atmosferada sochilib, osmonni yulduzlardan yorqinroq qiladi",
       "Ular Yerning boshqa tomonida bo'ladi",
       "Atmosfera ularning nurini to'sib qo'yadi"],
      ["They switch off during the day",
       "Sunlight scattering in the atmosphere makes the sky brighter than they are",
       "They are on the other side of the Earth",
       "The atmosphere blocks their light"],
      ["Они гаснут днём",
       "Солнечный свет рассеивается в атмосфере, и небо становится ярче звёзд",
       "Они находятся с другой стороны Земли",
       "Атмосфера задерживает их свет"], 1,
      "Yulduzlar kunduzi ham o'sha yerda turadi. Faqat atmosferada sochilgan "
      "Quyosh nuri osmonni ulardan yorqinroq qiladi, shuning uchun ular "
      "ko'rinmay qoladi. Havosiz Oyda kunduzi ham yulduzlar ko'rinadi.",
      "The stars are still there. Sunlight scattering off the air makes the sky "
      "brighter than they are, so they are lost in it. On the airless Moon you "
      "can see stars in the daytime.",
      "Звёзды никуда не деваются. Солнечный свет, рассеиваясь в воздухе, делает "
      "небо ярче звёзд, и они теряются на его фоне. На безвоздушной Луне звёзды "
      "видны и днём."),

    # ── Intermediate ──
    q('medium', 30,
      "Biz yashaydigan galaktikaning nomi nima?",
      "What is the name of the galaxy we live in?",
      "Как называется галактика, в которой мы живём?",
      ["Andromeda", "Uchburchak", "Somon yo'li", "Sombrero"],
      ["Andromeda", "Triangulum", "Milky Way", "Sombrero"],
      ["Андромеда", "Треугольник", "Млечный Путь", "Сомбреро"], 2,
      "Somon yo'li — spiral galaktika, unda yuz milliardlarcha yulduz bor. "
      "Tunda ko'radigan oqish yo'l — bu galaktikaning diskiga ichkaridan qarash.",
      "The Milky Way is a spiral galaxy of a few hundred billion stars. The "
      "pale band across a dark sky is our own galaxy's disc, seen from inside it.",
      "Млечный Путь — спиральная галактика из нескольких сотен миллиардов "
      "звёзд. Светлая полоса на ночном небе — это диск нашей галактики, вид "
      "изнутри."),
    q('medium', 30,
      "Qaysi sayyora yonboshlab aylanadi?",
      "Which planet rotates on its side?",
      "Какая планета вращается «лёжа на боку»?",
      ["Uran", "Neptun", "Saturn", "Venera"],
      ["Uranus", "Neptune", "Saturn", "Venus"],
      ["Уран", "Нептун", "Сатурн", "Венера"], 0,
      "Uranning aylanish o'qi orbita tekisligiga deyarli 98° ga og'gan — ya'ni "
      "u yumalab boradi. Shu sababli uning qutblarida 21 yil davom etadigan "
      "kun va shuncha davom etadigan tun bo'ladi.",
      "Uranus's axis is tilted about 98° to its orbit, so it rolls rather than "
      "spins upright. Each pole gets around 21 years of daylight followed by "
      "21 years of night.",
      "Ось Урана наклонена к плоскости орбиты примерно на 98°, поэтому он как "
      "бы катится. У каждого полюса около 21 года длится день и столько же — "
      "ночь."),
    q('medium', 30,
      "Quyosh tizimidagi eng issiq sayyora qaysi?",
      "What is the hottest planet in our solar system?",
      "Какая планета Солнечной системы самая горячая?",
      ["Merkuriy", "Venera", "Mars", "Yupiter"],
      ["Mercury", "Venus", "Mars", "Jupiter"],
      ["Меркурий", "Венера", "Марс", "Юпитер"], 1,
      "Merkuriy Quyoshga yaqinroq, lekin Veneraning zich karbonat angidrid "
      "atmosferasi issiqlikni ushlab qoladi. Bu parnik effekti uning yuzasini "
      "460 °C atrofida tutib turadi — Merkuriynikidan ham issiq.",
      "Mercury is closer to the Sun, but Venus has a thick carbon dioxide "
      "atmosphere that traps heat. That greenhouse effect holds its surface at "
      "about 460 °C — hotter than Mercury ever gets.",
      "Меркурий ближе к Солнцу, но у Венеры плотная углекислотная атмосфера, "
      "удерживающая тепло. Парниковый эффект держит её поверхность около "
      "460 °C — жарче, чем на Меркурии."),
    q('medium', 30,
      "Kosmosga uchgan birinchi inson kim?",
      "Who was the first human to travel into space?",
      "Кто первым из людей полетел в космос?",
      ["Nil Armstrong", "Bazz Oldrin", "Yuriy Gagarin", "Jon Glenn"],
      ["Neil Armstrong", "Buzz Aldrin", "Yuri Gagarin", "John Glenn"],
      ["Нил Армстронг", "Базз Олдрин", "Юрий Гагарин", "Джон Гленн"], 2,
      "Yuriy Gagarin 1961-yil 12-aprelda \"Vostok-1\" kemasida Yer atrofida bir "
      "marta aylanib chiqdi. Nil Armstrong esa boshqa birinchilikka ega — "
      "1969-yilda Oyga qadam qo'ygan birinchi inson.",
      "Yuri Gagarin made one orbit of the Earth aboard Vostok 1 on 12 April "
      "1961. Neil Armstrong holds a different first: the first person to walk "
      "on the Moon, in 1969.",
      "Юрий Гагарин совершил один виток вокруг Земли на «Востоке-1» 12 апреля "
      "1961 года. У Нила Армстронга другое первенство — первый человек на Луне, "
      "1969 год."),
    q('medium', 30,
      "Nima uchun Oy Yerga doim bir tomoni bilan qaraydi?",
      "Why does the Moon always show us the same face?",
      "Почему Луна всегда повёрнута к Земле одной стороной?",
      ["Oy umuman aylanmaydi",
       "Yerning soyasi ikkinchi tomonini to'sib turadi",
       "Uning o'z o'qi atrofida aylanish davri Yer atrofida aylanish davriga teng",
       "Ikkinchi tomoni juda qorong'i"],
      ["The Moon does not rotate at all",
       "Earth's shadow hides the far side",
       "It turns on its axis in exactly the time it takes to orbit the Earth",
       "The far side is too dark to see"],
      ["Луна вообще не вращается",
       "Тень Земли закрывает обратную сторону",
       "Период её вращения вокруг оси равен периоду обращения вокруг Земли",
       "Обратная сторона слишком тёмная"], 2,
      "Bu — sinxron aylanish. Oy o'z o'qi atrofida ham aylanadi, lekin bir "
      "aylanishi Yer atrofidagi bir aylanishga teng — 27,3 kun. Yer tortishishi "
      "milliardlab yillar davomida uni shu holatga keltirgan.",
      "This is tidal locking. The Moon does spin, but one turn on its axis takes "
      "exactly as long as one orbit — 27.3 days. Earth's gravity slowed it into "
      "step over billions of years.",
      "Это приливной захват. Луна вращается, но один оборот вокруг оси занимает "
      "ровно столько же, сколько один оборот вокруг Земли, — 27,3 суток. "
      "Гравитация Земли за миллиарды лет синхронизировала их."),
    q('medium', 30,
      "Nima uchun kosmonavtlar Xalqaro kosmik stansiyada suzib yuradi?",
      "Why do astronauts float aboard the International Space Station?",
      "Почему космонавты на МКС находятся в невесомости?",
      ["U yerda tortishish kuchi yo'q",
       "Stansiya Yer atmosferasidan tashqarida",
       "Stansiya va undagilar birgalikda Yerga tinimsiz erkin tushib boradi",
       "Ular maxsus kostyum tufayli yengil bo'lib qoladi"],
      ["There is no gravity up there",
       "The station is outside Earth's atmosphere",
       "The station and everyone in it are in continuous free fall around the Earth",
       "Their suits make them lighter"],
      ["Там нет силы тяжести",
       "Станция находится вне атмосферы Земли",
       "Станция и всё внутри неё непрерывно падают вокруг Земли",
       "Их делают лёгкими специальные скафандры"], 2,
      "XKS balandligida Yer tortishishi hali ham yer yuzidagining taxminan 90% "
      "ini tashkil qiladi. Kosmonavtlar suzadi, chunki stansiya bilan birga "
      "tinimsiz erkin tushmoqda — shunchaki yon tomonga shu qadar tez "
      "harakatlanadiki, Yerga urilib qolmaydi.",
      "At the station's altitude Earth's gravity is still about 90% of what it "
      "is on the ground. They float because they are falling — the station is in "
      "permanent free fall, moving sideways fast enough to keep missing the Earth.",
      "На высоте МКС притяжение Земли всё ещё около 90% от того, что на "
      "поверхности. Невесомость возникает потому, что станция непрерывно падает, "
      "двигаясь вбок так быстро, что всё время «промахивается» мимо Земли."),

    # ── Advanced ──
    q('hard', 45,
      "Koinotning taxminiy yoshi qancha?",
      "What is the approximate age of the Universe?",
      "Каков примерный возраст Вселенной?",
      ["4.5 mlrd yil", "13.8 mlrd yil", "93 mlrd yil", "1 trln yil"],
      ["4.5 billion years", "13.8 billion years", "93 billion years", "1 trillion years"],
      ["4,5 млрд лет", "13,8 млрд лет", "93 млрд лет", "1 трлн лет"], 1,
      "13,8 milliard yil — bu qoldiq mikroto'lqinli fon nurlanishini o'lchash "
      "orqali topilgan. 4,5 milliard — Quyosh tizimining yoshi, 93 milliard "
      "yorug'lik yili esa kuzatiladigan koinotning kengligi.",
      "13.8 billion years comes from measuring the cosmic microwave background. "
      "4.5 billion is the age of the solar system, and 93 billion light-years is "
      "the width of the observable Universe — a distance, not an age.",
      "13,8 млрд лет получено из измерений реликтового излучения. 4,5 млрд — "
      "возраст Солнечной системы, а 93 млрд световых лет — это поперечник "
      "наблюдаемой Вселенной, то есть расстояние, а не возраст."),
    q('hard', 45,
      "Qora tuynuk atrofidagi yorug'lik qochib qutula olmaydigan chegara nima deyiladi?",
      "What is the boundary around a black hole beyond which no light can escape?",
      "Как называется граница вокруг чёрной дыры, из-за которой не может вырваться даже свет?",
      ["Hodisalar gorizonti", "Singulyarlik", "Akkretsion disk", "Foton sferasi"],
      ["Event horizon", "Singularity", "Accretion disk", "Photon sphere"],
      ["Горизонт событий", "Сингулярность", "Аккреционный диск", "Фотонная сфера"], 0,
      "Hodisalar gorizonti — qochish tezligi yorug'lik tezligiga teng bo'lgan "
      "sirt. Singulyarlik — markazdagi nuqta, akkretsion disk — atrofida "
      "aylanayotgan modda, foton sferasi esa yorug'lik orbitaga tusha oladigan "
      "balandlik: uchalasi ham boshqa narsa.",
      "The event horizon is the surface where the escape velocity reaches the "
      "speed of light. The singularity is the point at the centre, the accretion "
      "disk is the matter spiralling in, and the photon sphere is where light can "
      "orbit — three different things.",
      "Горизонт событий — поверхность, на которой вторая космическая скорость "
      "равна скорости света. Сингулярность — точка в центре, аккреционный диск — "
      "падающее вещество, фотонная сфера — высота, где свет может выйти на "
      "орбиту: это три разные вещи."),
    q('hard', 45,
      "Qaysi yo'ldoshda zich atmosfera bor?",
      "Which moon has a dense atmosphere?",
      "У какого спутника есть плотная атмосфера?",
      ["Yevropa", "Ganimed", "Titan", "Triton"],
      ["Europa", "Ganymede", "Titan", "Triton"],
      ["Европа", "Ганимед", "Титан", "Тритон"], 2,
      "Saturnning yo'ldoshi Titan — Quyosh tizimidagi zich atmosferaga ega "
      "yagona yo'ldosh. Atmosferasi asosan azotdan iborat va bosimi yer "
      "yuzasidagidan ham yuqori; u yerda metan ko'llari bor.",
      "Titan, a moon of Saturn, is the only moon with a thick atmosphere. It is "
      "mostly nitrogen at a surface pressure higher than Earth's, and it has "
      "lakes of liquid methane.",
      "Титан, спутник Сатурна, — единственный спутник с плотной атмосферой. Она "
      "состоит в основном из азота, давление у поверхности выше земного, и там "
      "есть озёра из жидкого метана."),
    q('hard', 45,
      "Nima uchun uzoq galaktikalarning nuri qizil tomonga siljigan?",
      "Why is the light from distant galaxies shifted towards the red?",
      "Почему свет далёких галактик смещён в красную сторону?",
      ["Galaktikalar qizil yulduzlardan tashkil topgan",
       "Yo'ldagi chang nurni qizartiradi",
       "Koinotning kengayishi nur to'lqin uzunligini cho'zadi",
       "Ular Yerga qarab yaqinlashmoqda"],
      ["Distant galaxies are made of red stars",
       "Dust along the way reddens the light",
       "The expansion of the Universe stretches the light's wavelength",
       "They are moving towards us"],
      ["Далёкие галактики состоят из красных звёзд",
       "Пыль по пути краснит свет",
       "Расширение Вселенной растягивает длину волны света",
       "Они приближаются к нам"], 2,
      "Nur yo'lda ketayotganda fazoning o'zi kengayadi va to'lqin uzunligi "
      "cho'ziladi — bu kosmologik qizil siljish. Galaktika qanchalik uzoq "
      "bo'lsa, siljish shunchalik katta; aynan shu Xabblni koinot kengayayotgan "
      "degan xulosaga olib kelgan.",
      "Space itself expands while the light is travelling, stretching its "
      "wavelength — cosmological redshift. The further the galaxy, the larger the "
      "shift, and that relationship is what told Hubble the Universe is expanding.",
      "Пока свет летит, само пространство расширяется и растягивает длину "
      "волны — это космологическое красное смещение. Чем дальше галактика, тем "
      "больше смещение; именно эта связь и показала Хабблу, что Вселенная "
      "расширяется."),
    q('hard', 45,
      "Quyosh tizimidagi jismlarni qaysi ro'yxat Quyoshdan uzoqlashish tartibida beradi?",
      "Which list is in order of increasing distance from the Sun?",
      "В каком списке объекты идут в порядке удаления от Солнца?",
      ["Venera, Merkuriy, Yer, Mars",
       "Merkuriy, Venera, Yer, Mars",
       "Merkuriy, Yer, Venera, Mars",
       "Yer, Venera, Mars, Merkuriy"],
      ["Venus, Mercury, Earth, Mars",
       "Mercury, Venus, Earth, Mars",
       "Mercury, Earth, Venus, Mars",
       "Earth, Venus, Mars, Mercury"],
      ["Венера, Меркурий, Земля, Марс",
       "Меркурий, Венера, Земля, Марс",
       "Меркурий, Земля, Венера, Марс",
       "Земля, Венера, Марс, Меркурий"], 1,
      "Ichki sayyoralar tartibi: Merkuriy, Venera, Yer, Mars. Venera Yerga eng "
      "yaqin sayyora bo'lsa-da, Quyoshdan Merkuriydan uzoqroqda joylashgan — "
      "yaqinlik va tartib bir xil narsa emas.",
      "The inner planets run Mercury, Venus, Earth, Mars. Venus is the planet "
      "that comes closest to Earth, but it still orbits further out than Mercury "
      "— nearest to us and nearest to the Sun are different questions.",
      "Порядок внутренних планет: Меркурий, Венера, Земля, Марс. Венера ближе "
      "всех подходит к Земле, но от Солнца она дальше Меркурия — «ближе к нам» и "
      "«ближе к Солнцу» это разные вещи."),
    q('hard', 45,
      "Nima uchun Quyoshda vodorod yonib tugab qolmaydi, deb ayta olmaymiz?",
      "What actually powers the Sun?",
      "За счёт чего светит Солнце?",
      ["Vodorodning kislorodda yonishi",
       "Yadro sintezi: vodorod yadrolari qo'shilib geliyga aylanadi",
       "Radioaktiv parchalanish",
       "Siqilishdan hosil bo'ladigan ishqalanish"],
      ["Hydrogen burning in oxygen",
       "Nuclear fusion: hydrogen nuclei joining to make helium",
       "Radioactive decay",
       "Friction from its own compression"],
      ["Горение водорода в кислороде",
       "Термоядерный синтез: ядра водорода сливаются в гелий",
       "Радиоактивный распад",
       "Трение при сжатии"], 1,
      "Quyosh yonmaydi — uning markazida vodorod yadrolari qo'shilib geliy hosil "
      "qiladi, va yo'qolgan massa E=mc² bo'yicha energiyaga aylanadi. Kimyoviy "
      "yonish bunday quvvatni bir necha ming yilgina bera olardi, sintez esa "
      "milliardlab yil beradi.",
      "The Sun does not burn. Hydrogen nuclei fuse into helium in its core, and "
      "the missing mass becomes energy by E=mc². Chemical burning could sustain "
      "that output for a few thousand years; fusion sustains it for billions.",
      "Солнце не горит: в его ядре ядра водорода сливаются в гелий, а исчезнувшая "
      "масса превращается в энергию по E=mc². Химического горения хватило бы на "
      "несколько тысяч лет, синтеза хватает на миллиарды."),
]
