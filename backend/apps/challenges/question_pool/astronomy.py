"""Astronomy — what is out there, and how we know.

Facts here are the ones a textbook and a NASA fact sheet agree on. Anything
that would need a source we do not have is not in the pool; a question nobody
can mark honestly is worse than no question.
"""
from .builder import for_category

q = for_category('astronomy')

QUESTIONS = [
    # ── Beginner ──
    q('easy', 20,
      "Quyosh sistemasidagi eng katta sayyora qaysi?",
      "Which is the largest planet in the Solar System?",
      "Какая планета Солнечной системы самая большая?",
      ["Yupiter", "Saturn", "Yer", "Uran"],
      ["Jupiter", "Saturn", "Earth", "Uranus"],
      ["Юпитер", "Сатурн", "Земля", "Уран"], 0,
      "Yupiterning massasi qolgan sayyoralarning yig'indisidan ikki barobardan "
      "ortiq. U gaz gigantidir: qattiq yuzasi yo'q, asosan vodorod va geliydan "
      "iborat.",
      "Jupiter's mass is more than twice that of all the other planets combined. "
      "It is a gas giant — mostly hydrogen and helium, with no solid surface to "
      "stand on.",
      "Масса Юпитера более чем вдвое превышает массу всех остальных планет "
      "вместе. Это газовый гигант: он состоит в основном из водорода и гелия и "
      "не имеет твёрдой поверхности."),
    q('easy', 25,
      "Yorug'lik yili nima?",
      "What is a light-year?",
      "Что такое световой год?",
      ["Yorug'lik bir yilda bosib o'tadigan masofa",
       "Vaqt birligi",
       "Yulduz yoshini o'lchash birligi",
       "Quyosh faolligi sikli"],
      ["The distance light travels in one year",
       "A unit of time",
       "A unit for measuring a star's age",
       "The Sun's activity cycle"],
      ["Расстояние, которое свет проходит за год",
       "Единица времени",
       "Единица измерения возраста звезды",
       "Цикл солнечной активности"], 0,
      "Nomida \"yil\" bo'lsa ham, bu masofa birligi — taxminan 9,5 trillion "
      "kilometr. Kosmik masofalar shu qadar kattaki, ularni kilometrda yozish "
      "noqulay.",
      "The word \"year\" is in the name, but it measures distance: about 9.5 "
      "trillion kilometres. Space is big enough that writing those distances in "
      "kilometres stops being useful.",
      "Хотя в названии есть слово «год», это единица расстояния — около "
      "9,5 триллиона километров. Космические расстояния так велики, что "
      "записывать их в километрах неудобно."),
    q('easy', 20,
      "Galaktikamizning nomi nima?",
      "What is our galaxy called?",
      "Как называется наша галактика?",
      ["Somon yo'li", "Andromeda", "Katta Magellan buluti", "Uchburchak"],
      ["Milky Way", "Andromeda", "Large Magellanic Cloud", "Triangulum"],
      ["Млечный Путь", "Андромеда", "Большое Магелланово Облако", "Треугольник"], 0,
      "Andromeda — bizga eng yaqin yirik galaktika, Katta Magellan buluti esa "
      "Somon yo'lining yo'ldosh galaktikasi. Uchalasi ham Mahalliy guruhga kiradi.",
      "Andromeda is the nearest large galaxy to us and the Large Magellanic "
      "Cloud is a satellite galaxy of the Milky Way. All three belong to the "
      "same Local Group.",
      "Андромеда — ближайшая к нам крупная галактика, а Большое Магелланово "
      "Облако — галактика-спутник Млечного Пути. Все три входят в Местную группу."),
    q('easy', 20,
      "Quyoshdan tashqari Yerga eng yaqin yulduz qaysi?",
      "Which star is closest to Earth after the Sun?",
      "Какая звезда ближе всего к Земле после Солнца?",
      ["Proksima Sentavra", "Sirius", "Betelgeyze", "Vega"],
      ["Proxima Centauri", "Sirius", "Betelgeuse", "Vega"],
      ["Проксима Центавра", "Сириус", "Бетельгейзе", "Вега"], 0,
      "Proksima Sentavra taxminan 4,2 yorug'lik yili uzoqlikda. U qizil "
      "mitti — juda xira yulduz, shuning uchun eng yaqin bo'lsa ham oddiy "
      "ko'z bilan ko'rinmaydi.",
      "Proxima Centauri is about 4.2 light-years away. It is a red dwarf and so "
      "faint that, despite being the nearest star of all, you cannot see it "
      "without a telescope.",
      "Проксима Центавра находится примерно в 4,2 светового года. Это красный "
      "карлик — настолько тусклый, что, будучи ближайшей звездой, он не виден "
      "невооружённым глазом."),
    q('easy', 20,
      "Mars sayyorasining rangi qanday?",
      "What colour is the planet Mars?",
      "Какого цвета планета Марс?",
      ["Qizil", "Ko'k", "Sariq", "Yashil"],
      ["Red", "Blue", "Yellow", "Green"],
      ["Красный", "Синий", "Жёлтый", "Зелёный"], 0,
      "Marsning tuprog'idagi temir kislorod bilan birikkan — ya'ni zanglagan. "
      "Xuddi shu jarayon Yerdagi temir buyumlarni ham qizg'ish qiladi.",
      "The iron in the Martian soil has combined with oxygen — it has rusted. "
      "The same process turns iron reddish here on Earth.",
      "Железо в марсианском грунте соединилось с кислородом, то есть "
      "проржавело. Тот же процесс делает рыжими железные предметы на Земле."),

    # ── Intermediate ──
    q('medium', 30,
      "Koinotning kengayishini kim kashf qilgan?",
      "Who discovered the expansion of the Universe?",
      "Кто открыл расширение Вселенной?",
      ["Edvin Xabbl", "Albert Eynshteyn", "Isaak Nyuton", "Galileo Galiley"],
      ["Edwin Hubble", "Albert Einstein", "Isaac Newton", "Galileo Galilei"],
      ["Эдвин Хаббл", "Альберт Эйнштейн", "Исаак Ньютон", "Галилео Галилей"], 0,
      "Xabbl 1929-yilda galaktikalar qanchalik uzoq bo'lsa, shunchalik tez "
      "uzoqlashayotganini o'lchab ko'rsatdi. Eynshteynning tenglamalari buni "
      "oldindan aytib bergan edi, lekin uni o'lchagan Xabbl.",
      "Hubble showed in 1929 that the further away a galaxy is, the faster it "
      "is receding. Einstein's equations had allowed for it, but Hubble is the "
      "one who measured it.",
      "В 1929 году Хаббл измерил, что чем дальше галактика, тем быстрее она "
      "удаляется. Уравнения Эйнштейна это допускали, но измерил именно Хаббл."),
    q('medium', 30,
      "Oyning Yer atrofida aylanish davri qancha?",
      "How long does the Moon take to orbit the Earth?",
      "Каков период обращения Луны вокруг Земли?",
      ["27.3 kun", "30 kun", "24 soat", "365 kun"],
      ["27.3 days", "30 days", "24 hours", "365 days"],
      ["27,3 суток", "30 суток", "24 часа", "365 суток"], 0,
      "27,3 kun — Oyning yulduzlarga nisbatan bir aylanishi. Oy fazalarining "
      "to'liq sikli esa 29,5 kun: Yer ham shu vaqt ichida Quyosh atrofida "
      "siljib qolgani uchun Oyga biroz ko'proq quvish kerak bo'ladi.",
      "27.3 days is one orbit measured against the stars. The cycle of phases "
      "takes 29.5 days, because Earth has moved along its own orbit in the "
      "meantime and the Moon has to catch up a little.",
      "27,3 суток — один оборот относительно звёзд. Цикл фаз занимает "
      "29,5 суток: за это время Земля сама сместилась по орбите, и Луне "
      "приходится немного «догонять»."),
    q('medium', 30,
      "Saturnning halqalari asosan nimadan iborat?",
      "What are Saturn's rings mostly made of?",
      "Из чего в основном состоят кольца Сатурна?",
      ["Muz va tosh bo'laklaridan", "Gazlardan", "Suyuq metalldan", "Tuproqdan"],
      ["Pieces of ice and rock", "Gases", "Liquid metal", "Soil"],
      ["Кусков льда и камня", "Газов", "Жидкого металла", "Грунта"], 0,
      "Halqalar — changdan uy kattaligigacha bo'lgan milliardlab muz "
      "bo'laklari. Ular yaxlit emas: har bir bo'lak Saturn atrofida o'z "
      "orbitasida alohida aylanadi.",
      "The rings are billions of separate lumps of ice, from dust grains to "
      "house-sized blocks. They are not solid sheets — every piece is on its own "
      "orbit around Saturn.",
      "Кольца — это миллиарды отдельных ледяных обломков, от пылинок до глыб "
      "размером с дом. Это не сплошные диски: каждый кусок движется по "
      "собственной орбите вокруг Сатурна."),
    q('medium', 30,
      "Yupiterning eng katta yo'ldoshi qaysi?",
      "Which is Jupiter's largest moon?",
      "Какой спутник Юпитера самый большой?",
      ["Ganimed", "Kalisto", "Io", "Yevropa"],
      ["Ganymede", "Callisto", "Io", "Europa"],
      ["Ганимед", "Каллисто", "Ио", "Европа"], 0,
      "Ganimed — butun Quyosh tizimidagi eng katta yo'ldosh, hatto Merkuriy "
      "sayyorasidan ham yirik. To'rttasi — Io, Yevropa, Ganimed va Kalisto — "
      "1610-yilda Galiley tomonidan kashf etilgan.",
      "Ganymede is the largest moon in the whole solar system — bigger than the "
      "planet Mercury. All four listed here are the Galilean moons, spotted by "
      "Galileo in 1610.",
      "Ганимед — крупнейший спутник во всей Солнечной системе, больше планеты "
      "Меркурий. Все четыре перечисленных — галилеевы спутники, открытые "
      "Галилеем в 1610 году."),
    q('medium', 30,
      "Nima uchun Merkuriyda atmosfera deyarli yo'q?",
      "Why does Mercury have almost no atmosphere?",
      "Почему у Меркурия почти нет атмосферы?",
      ["U juda kichkina va issiq: tortishishi gaz molekulalarini ushlab tura olmaydi",
       "U hech qachon atmosferaga ega bo'lmagan",
       "Quyosh shamoli uni butunlay yaratmagan",
       "Uning atmosferasi muzlab, yuzasiga cho'kkan"],
      ["It is small and hot: its gravity cannot hold on to gas molecules",
       "It never had one to begin with",
       "The solar wind never let one form",
       "Its atmosphere froze and settled on the surface"],
      ["Он мал и горяч: его гравитации не хватает, чтобы удержать молекулы газа",
       "У него никогда её и не было",
       "Солнечный ветер не дал ей образоваться",
       "Его атмосфера замёрзла и осела на поверхность"], 0,
      "Ikki sabab birga ishlaydi: Merkuriyning tortishishi zaif, Quyoshga "
      "yaqinligi esa gaz molekulalarini juda tez harakatlantiradi. Tezligi "
      "qochish tezligidan oshgan molekula fazoga uchib ketadi.",
      "Two things work together: Mercury's gravity is weak, and being close to "
      "the Sun keeps gas molecules moving fast. Any molecule moving faster than "
      "the escape velocity simply leaves.",
      "Работают две причины сразу: гравитация Меркурия слаба, а близость к "
      "Солнцу разгоняет молекулы газа. Молекула, скорость которой превысила "
      "вторую космическую, просто улетает."),
    q('medium', 35,
      "Astronomlar sayyoraning atmosferasi nimadan iboratligini qanday aniqlaydi?",
      "How do astronomers work out what a planet's atmosphere is made of?",
      "Как астрономы определяют состав атмосферы планеты?",
      ["Nurni spektrga ajratib, gazlar yutgan to'lqin uzunliklarini o'qib",
       "Sayyoraning rangiga qarab",
       "Har safar u yerga zond yuborib",
       "Sayyoraning massasini o'lchab"],
      ["By splitting its light into a spectrum and reading which wavelengths the gases absorb",
       "From the planet's colour",
       "By sending a probe every time",
       "By measuring the planet's mass"],
      ["Разлагая свет в спектр и считывая, какие длины волн поглощают газы",
       "По цвету планеты",
       "Отправляя каждый раз зонд",
       "Измеряя массу планеты"], 0,
      "Har bir gaz o'ziga xos to'lqin uzunliklarini yutadi va spektrda qora "
      "chiziq qoldiradi — bu uning barmoq izi. Shu usul bilan yulduzlarning "
      "ham, boshqa yulduz sayyoralarining ham tarkibi aniqlanadi, u yerga "
      "bormasdan.",
      "Every gas absorbs its own set of wavelengths and leaves dark lines in the "
      "spectrum — a fingerprint. The same method reads the composition of stars "
      "and of planets around other stars, without going anywhere near them.",
      "Каждый газ поглощает свой набор длин волн и оставляет в спектре тёмные "
      "линии — свой «отпечаток». Тем же способом определяют состав звёзд и "
      "планет у других звёзд, никуда не летая."),
    q('medium', 30,
      "Quyosh tutilishi qanday hollarda sodir bo'ladi?",
      "When does a solar eclipse happen?",
      "Когда происходит солнечное затмение?",
      ["Oy Yer bilan Quyosh orasiga tushganda",
       "Yer Oy bilan Quyosh orasiga tushganda",
       "Oy Yer soyasiga kirganda",
       "Quyosh faolligi cho'qqisiga chiqqanda"],
      ["When the Moon passes between the Earth and the Sun",
       "When the Earth passes between the Moon and the Sun",
       "When the Moon enters Earth's shadow",
       "When solar activity peaks"],
      ["Когда Луна проходит между Землёй и Солнцем",
       "Когда Земля проходит между Луной и Солнцем",
       "Когда Луна входит в тень Земли",
       "Когда солнечная активность достигает пика"], 0,
      "Quyosh tutilishida Oy Quyoshni to'sadi; Oy tutilishida esa Yer o'z "
      "soyasini Oyga tushiradi — ikkinchi va uchinchi javob aynan shuni "
      "ta'riflaydi. Har oyda sodir bo'lmasligining sababi: Oy orbitasi Yer "
      "orbitasiga nisbatan ~5° og'gan.",
      "In a solar eclipse the Moon covers the Sun; in a lunar eclipse the Earth "
      "casts its shadow on the Moon, which is what the second and third options "
      "describe. It does not happen monthly because the Moon's orbit is tilted "
      "about 5° to Earth's.",
      "При солнечном затмении Луна закрывает Солнце; при лунном Земля отбрасывает "
      "тень на Луну — это как раз второй и третий варианты. Почему не каждый "
      "месяц: орбита Луны наклонена к земной примерно на 5°."),
    q('medium', 30,
      "Nima uchun sayyoralar yulduzlardan farqli o'laroq \"miltillamaydi\"?",
      "Why do planets not twinkle the way stars do?",
      "Почему планеты, в отличие от звёзд, не мерцают?",
      ["Ular disk sifatida ko'rinadi, nuqta emas, shuning uchun havo tebranishi o'rtachalanadi",
       "Ular yorqinroq",
       "Ular o'z nurini chiqaradi",
       "Ular atmosferadan yuqorida joylashgan"],
      ["They show as a small disc rather than a point, so the air's wobble averages out",
       "They are brighter",
       "They make their own light",
       "They are above the atmosphere"],
      ["Они видны как маленький диск, а не точка, и дрожание воздуха усредняется",
       "Они ярче",
       "Они светят собственным светом",
       "Они находятся выше атмосферы"], 0,
      "Miltillash — havo qatlamlari nurni og'dirishi natijasi. Yulduz shu qadar "
      "uzoqki, u nuqta bo'lib ko'rinadi va butun nuri birdan tebranadi; sayyora "
      "esa kichik disk, uning turli nuqtalari tebranishi bir-birini "
      "o'rtachalab, tinch ko'rinadi.",
      "Twinkling is the air bending light. A star is so far away it arrives as a "
      "single point, so all of its light wobbles together. A planet arrives as a "
      "small disc, and the wobbles across it average out into a steady glow.",
      "Мерцание — это преломление света в слоях воздуха. Звезда так далека, что "
      "видна точкой, и весь её свет дрожит разом. Планета видна маленьким "
      "диском, и дрожания в разных его точках усредняются."),

    # ── Advanced ──
    q('hard', 45,
      "Qora tuynuk nima?",
      "What is a black hole?",
      "Что такое чёрная дыра?",
      ["Tortishishi shu qadar kuchliki, hatto yorug'lik ham qochib chiqa olmaydigan jism",
       "Yulduzlar tug'iladigan joy",
       "Koinotning bo'sh sohasi",
       "Juda kichik sayyora"],
      ["An object whose gravity is so strong that not even light can escape it",
       "A place where stars are born",
       "An empty region of the Universe",
       "A very small planet"],
      ["Объект, гравитация которого так сильна, что даже свет не может вырваться",
       "Место, где рождаются звёзды",
       "Пустая область Вселенной",
       "Очень маленькая планета"], 0,
      "\"Bo'shliq\" emas, aksincha — juda kichik hajmga siqilgan juda katta "
      "massa. Yirik yulduzlar hayotining oxirida o'z og'irligi ostida "
      "siqilishidan hosil bo'ladi.",
      "Not an emptiness — the opposite: a very large mass squeezed into a very "
      "small volume. They form when a massive star collapses under its own "
      "weight at the end of its life.",
      "Это не пустота, а наоборот — очень большая масса, сжатая в очень малый "
      "объём. Они образуются, когда массивная звезда в конце жизни сжимается "
      "под собственным весом."),
    q('hard', 45,
      "Hubble teleskopi qachon kosmosga uchirilib yuborilgan?",
      "When was the Hubble telescope launched into space?",
      "Когда телескоп «Хаббл» был выведен в космос?",
      ["1990", "2000", "1985", "1995"],
      ["1990", "2000", "1985", "1995"],
      ["1990", "2000", "1985", "1995"], 0,
      "Hubble 1990-yilda \"Discovery\" shattli bilan orbitaga chiqarilgan. "
      "Uni atmosferadan tashqariga chiqarishning sababi — havo tebranishi "
      "tasvirni buzadi; orbitada bu muammo umuman yo'q.",
      "Hubble went up on the shuttle Discovery in 1990. The reason for putting a "
      "telescope above the atmosphere is that moving air blurs the image — in "
      "orbit that problem disappears entirely.",
      "«Хаббл» вывели на орбиту шаттлом «Дискавери» в 1990 году. Телескоп "
      "поднимают над атмосферой потому, что движущийся воздух размывает "
      "изображение; на орбите этой проблемы нет вовсе."),
    q('hard', 45,
      "Neytron yulduzi nima?",
      "What is a neutron star?",
      "Что такое нейтронная звезда?",
      ["Katta yulduzning nihoyatda zich qoldig'i",
       "Endi tug'ilgan yulduz",
       "Eng kichik yulduz turi",
       "Quyosh tizimidagi asteroid"],
      ["The extremely dense remnant of a massive star",
       "A newborn star",
       "The smallest type of star",
       "An asteroid in the Solar System"],
      ["Крайне плотный остаток массивной звезды",
       "Только что родившаяся звезда",
       "Самый маленький тип звёзд",
       "Астероид в Солнечной системе"], 0,
      "Supernova portlashidan keyin qolgan yadro shu qadar siqiladiki, "
      "Quyoshdan ortiq massa 20 km chamasi diametrga joylashadi. Bir choy "
      "qoshiq moddasi Yerda milliardlab tonna keladi.",
      "After a supernova the leftover core is squeezed until more than a Sun's "
      "worth of mass fits inside about 20 km. A teaspoon of it would weigh "
      "billions of tonnes on Earth.",
      "После вспышки сверхновой оставшееся ядро сжимается так, что масса больше "
      "солнечной умещается в шаре диаметром около 20 км. Чайная ложка такого "
      "вещества весила бы на Земле миллиарды тонн."),
    q('hard', 45,
      "Yulduzning rangi nima haqida ma'lumot beradi?",
      "What does a star's colour tell you?",
      "О чём говорит цвет звезды?",
      ["Uning yuza harorati haqida: ko'k issiqroq, qizil sovuqroq",
       "Uning yoshi haqida: ko'k yosh, qizil qari",
       "Uning bizdan uzoqligi haqida",
       "Uning massasi haqida, boshqa hech narsa haqida emas"],
      ["Its surface temperature: blue is hotter, red is cooler",
       "Its age: blue is young, red is old",
       "How far away from us it is",
       "Its mass, and nothing else"],
      ["О температуре поверхности: голубые горячее, красные холоднее",
       "О возрасте: голубые молодые, красные старые",
       "О расстоянии до нас",
       "О массе, и больше ни о чём"], 0,
      "Rang bevosita haroratni bildiradi: ko'k yulduzlar 20 000 K dan issiq, "
      "qizillari 3000 K atrofida. Yosh bilan bog'liqlik bilvosita — issiq ko'k "
      "yulduzlar tez yonib tugaydi, shuning uchun ular odatda yosh bo'ladi.",
      "Colour reads temperature directly: blue stars are above 20,000 K, red "
      "ones around 3,000 K. The link to age is indirect — hot blue stars burn "
      "through their fuel quickly, so they tend to be young.",
      "Цвет напрямую показывает температуру: голубые звёзды горячее 20 000 K, "
      "красные — около 3000 K. Связь с возрастом косвенная: горячие голубые "
      "звёзды быстро выгорают, поэтому они обычно молодые."),
    q('hard', 45,
      "Astronomlar boshqa yulduz atrofidagi sayyorani ko'pincha qanday topadi?",
      "How are most planets around other stars found?",
      "Как чаще всего находят планеты у других звёзд?",
      ["Sayyora yulduz oldidan o'tganda uning yorqinligi ozgina pasayishini o'lchab",
       "Sayyorani teleskopda to'g'ridan-to'g'ri suratga olib",
       "Sayyoradan kelgan radiosignalni tutib",
       "Yulduzning rangi o'zgarishini kuzatib"],
      ["By measuring the tiny dip in the star's brightness as the planet crosses it",
       "By photographing the planet directly through a telescope",
       "By picking up a radio signal from the planet",
       "By watching the star change colour"],
      ["По крошечному падению яркости звезды, когда планета проходит по её диску",
       "Прямым фотографированием планеты в телескоп",
       "Приёмом радиосигнала от планеты",
       "По изменению цвета звезды"], 0,
      "Bu — tranzit usuli: sayyora yulduz diski oldidan o'tganda yorqinlik bir "
      "necha promillega pasayadi, va bu pasayish davriy takrorlanadi. Kepler "
      "va TESS teleskoplari aynan shu bilan minglab sayyora topgan.",
      "This is the transit method: as a planet crosses the star's disc the "
      "brightness drops by a fraction of a percent, and the dip repeats on a "
      "regular period. Kepler and TESS found thousands of planets this way.",
      "Это транзитный метод: когда планета проходит по диску звезды, яркость "
      "падает на доли процента, и это падение повторяется с постоянным периодом. "
      "Так «Кеплер» и TESS нашли тысячи планет."),
    q('hard', 45,
      "Nima uchun Yerdan Oyning orqa tomonini hech qachon ko'ra olmaymiz?",
      "Why can we never see the far side of the Moon from Earth?",
      "Почему с Земли нельзя увидеть обратную сторону Луны?",
      ["Oyning aylanish davri orbital davriga teng — sinxron aylanish",
       "Orqa tomon doim qorong'i",
       "Yer atmosferasi u tomonni to'sadi",
       "Oy orqa tomonini Quyoshga qaratib turadi"],
      ["The Moon turns once on its axis in exactly one orbit — it is tidally locked",
       "The far side is always dark",
       "Earth's atmosphere blocks the view",
       "The Moon keeps its far side pointed at the Sun"],
      ["Луна делает один оборот вокруг оси ровно за один оборот по орбите — приливной захват",
       "Обратная сторона всегда тёмная",
       "Атмосфера Земли закрывает обзор",
       "Луна держит обратную сторону обращённой к Солнцу"], 0,
      "\"Qorong'i tomon\" — keng tarqalgan xato: orqa tomon ham Quyoshdan xuddi "
      "shuncha nur oladi, faqat biz uni ko'rmaymiz. Uni birinchi bo'lib 1959-"
      "yilda \"Luna-3\" surat qilib olgan.",
      "\"Dark side\" is a common mistake: the far side gets just as much sunlight "
      "as the near side, we simply never see it. Luna 3 photographed it for the "
      "first time in 1959.",
      "«Тёмная сторона» — распространённая ошибка: обратная сторона получает "
      "столько же солнечного света, просто мы её не видим. Впервые её "
      "сфотографировала «Луна-3» в 1959 году."),
    q('hard', 45,
      "Quyosh tizimidagi qaysi jismda suyuq metan ko'llari mavjud?",
      "Which body in the solar system has lakes of liquid methane?",
      "На каком теле Солнечной системы есть озёра из жидкого метана?",
      ["Titan", "Yevropa", "Mars", "Enselad"],
      ["Titan", "Europa", "Mars", "Enceladus"],
      ["Титан", "Европа", "Марс", "Энцелад"], 0,
      "Titanda −180 °C da metan suvning Yerdagi rolini o'ynaydi: yomg'ir bo'lib "
      "yog'adi, daryo va ko'llar hosil qiladi. Yevropa va Enseladda esa muz "
      "qobig'i ostida suyuq suv okeani borligi taxmin qilinadi.",
      "At −180 °C on Titan, methane does what water does here: it rains, it "
      "carves rivers and it pools into lakes. Europa and Enceladus are thought "
      "to hold liquid water instead, under a shell of ice.",
      "При −180 °C на Титане метан играет роль земной воды: выпадает дождём, "
      "образует реки и озёра. А на Европе и Энцеладе предполагают океан жидкой "
      "воды под ледяной корой."),
    q('hard', 50,
      "Sayyoraning Quyoshdan uzoqligi va aylanish davri qanday bog'langan?",
      "How is a planet's distance from the Sun related to the time it takes to orbit?",
      "Как связаны расстояние планеты от Солнца и период её обращения?",
      ["Uzoqroq sayyora sekinroq harakatlanadi va davri uzunroq bo'ladi",
       "Barcha sayyoralar bir xil vaqtda aylanadi",
       "Uzoqroq sayyora tezroq harakatlanadi",
       "Davr faqat sayyoraning massasiga bog'liq"],
      ["The further out a planet is, the slower it moves and the longer its year",
       "Every planet takes the same time",
       "The further out a planet is, the faster it moves",
       "The period depends only on the planet's mass"],
      ["Чем дальше планета, тем медленнее она движется и тем длиннее её год",
       "Все планеты обращаются за одно и то же время",
       "Чем дальше планета, тем быстрее она движется",
       "Период зависит только от массы планеты"], 0,
      "Keplerning uchinchi qonuni: davr kvadrati orbita radiusining kubiga "
      "proporsional. Merkuriyning yili 88 kun, Neptunniki 165 yil — ikkalasi "
      "ham shu bitta qonundan kelib chiqadi, sayyoraning massasi esa bunga "
      "kirmaydi.",
      "Kepler's third law: the square of the period is proportional to the cube "
      "of the orbital radius. Mercury's year is 88 days and Neptune's is 165 "
      "years, both from that one relationship — and the planet's own mass does "
      "not appear in it.",
      "Третий закон Кеплера: квадрат периода пропорционален кубу радиуса орбиты. "
      "Год Меркурия — 88 суток, год Нептуна — 165 лет, и то и другое следует из "
      "этого одного соотношения; масса самой планеты в него не входит."),
]
