"""Physics — the mechanics a 10-to-18-year-old meets at school, put in space.

Where an option is a common mistake rather than a random distractor, the
explanation names the mistake. Being told "the answer is 14 m/s" teaches
nothing to a child who answered 10 because they forgot the starting velocity.
"""
from .builder import for_category

q = for_category('physics')

QUESTIONS = [
    # ── Motion and forces ──
    q("easy", 25,
      "Moddiy nuqta deb nimaga aytiladi?",
      "What is a material point (point mass)?",
      "Что называют материальной точкой?",
      ["O'lchamlari berilgan sharoitda e'tiborga olinmaydigan jismga",
       "O'ta kichik massali jismga",
       "Faqat bitta atomdan iborat jismga",
       "Harakatlanmaydigan jismga"],
      ["A body whose size can be neglected in the given conditions",
       "A body of very small mass",
       "A body made of a single atom",
       "A body that does not move"],
      ["Тело, размерами которого в данных условиях можно пренебречь",
       "Тело очень малой массы",
       "Тело, состоящее из одного атома",
       "Неподвижное тело"], 0,
      "Bu jismning kattaligi haqida emas, masalaning shartlari haqida: Yer Quyosh "
      "atrofidagi harakatini hisoblashda moddiy nuqta, lekin qit'alarining "
      "joylashuvini o'rganishda emas.",
      "It is not about how big the body is, but about the question being asked. The "
      "Earth is a point mass when you work out its orbit round the Sun, and not one "
      "when you study where its continents are.",
      "Дело не в размере тела, а в поставленной задаче. Земля — материальная точка при "
      "расчёте её орбиты вокруг Солнца, но не при изучении расположения материков."),
    q("easy", 30,
      "Jism to'g'ri chiziq bo'ylab 5 m/s tezlik bilan harakatlanmoqda. 10 sekundda qanday masofa bosib o'tadi?",
      "A body moves in a straight line at 5 m/s. What distance does it cover in 10 seconds?",
      "Тело движется по прямой со скоростью 5 м/с. Какой путь оно пройдёт за 10 секунд?",
      ["50 m", "2 m", "15 m", "500 m"],
      ["50 m", "2 m", "15 m", "500 m"],
      ["50 м", "2 м", "15 м", "500 м"], 0,
      "Tekis harakatda s = v·t, ya'ni 5 · 10 = 50 m. 2 m javobi bo'lishdan chiqadi, "
      "500 m esa bitta ortiqcha nol.",
      "For uniform motion s = v·t, so 5 × 10 = 50 m. Answering 2 m divides instead of "
      "multiplying; 500 m is the right product with one zero too many.",
      "При равномерном движении s = v·t, то есть 5 · 10 = 50 м. Ответ 2 м получается "
      "делением вместо умножения, а 500 м — это верное произведение с лишним нулём."),
    q("easy", 25,
      "Tezligi har sekundda 2 m/s ga ortib boruvchi jismning tezlanishi qancha?",
      "A body's velocity grows by 2 m/s every second. What is its acceleration?",
      "Скорость тела каждую секунду растёт на 2 м/с. Каково его ускорение?",
      ["2 m/s^2", "0 m/s^2", "4 m/s^2", "0.5 m/s^2"],
      ["2 m/s²", "0 m/s²", "4 m/s²", "0.5 m/s²"],
      ["2 м/с²", "0 м/с²", "4 м/с²", "0,5 м/с²"], 0,
      "Tezlanish — tezlikning bir sekunddagi o'zgarishi. Tezlik har sekundda 2 m/s ga "
      "ortsa, tezlanish aynan 2 m/s²: ta'rifning o'zi javob.",
      "Acceleration is how much the velocity changes each second. If the velocity "
      "gains 2 m/s every second, the acceleration is 2 m/s² — the definition is the "
      "answer.",
      "Ускорение — это изменение скорости за секунду. Если скорость растёт на 2 м/с "
      "каждую секунду, ускорение равно 2 м/с²: определение и есть ответ."),
    q("medium", 60,
      "Tezligi 4 m/s bo'lgan jism 2 m/s^2 tezlanish bilan harakatlansa, 5 sekunddan keyingi tezligi qancha?",
      "A body moving at 4 m/s accelerates at 2 m/s². What is its velocity after 5 seconds?",
      "Тело со скоростью 4 м/с движется с ускорением 2 м/с². Какова его скорость через 5 секунд?",
      ["14 m/s", "10 m/s", "6 m/s", "20 m/s"],
      ["14 m/s", "10 m/s", "6 m/s", "20 m/s"],
      ["14 м/с", "10 м/с", "6 м/с", "20 м/с"], 0,
      "v = v₀ + a·t = 4 + 2·5 = 14 m/s. 10 m/s — boshlang'ich tezlikni unutgan javob, "
      "6 m/s — tezlanishni besh sekund o'rniga bir sekundga qo'llagan javob.",
      "v = v₀ + a·t = 4 + 2×5 = 14 m/s. The answer 10 m/s forgets the starting "
      "velocity; 6 m/s applies the acceleration for one second instead of five.",
      "v = v₀ + a·t = 4 + 2·5 = 14 м/с. Ответ 10 м/с забывает начальную скорость, а 6 "
      "м/с применяет ускорение за одну секунду вместо пяти."),
    q("easy", 25,
      "Nyutonning birinchi qonuni nimani ifodalaydi?",
      "What does Newton's first law express?",
      "Что выражает первый закон Ньютона?",
      ["Inersiya qonunini",
       "Kuch va tezlanish bog'liqligini",
       "Ta'sir va aks ta'sir qonunini",
       "Butun olam tortishish qonunini"],
      ["The law of inertia",
       "The relation between force and acceleration",
       "The law of action and reaction",
       "The law of universal gravitation"],
      ["Закон инерции",
       "Связь силы и ускорения",
       "Закон действия и противодействия",
       "Закон всемирного тяготения"], 0,
      "Birinchi qonun — inersiya qonuni: tashqi kuch ta'sir qilmasa, jism tinch turadi "
      "yoki tekis to'g'ri chiziqli harakatini davom ettiradi. F = ma — bu ikkinchi "
      "qonun, ta'sir va aks ta'sir esa uchinchisi.",
      "The first law is the law of inertia: with no net force, a body stays still or "
      "keeps moving in a straight line at a steady speed. F = ma is the second law, "
      "and action–reaction is the third.",
      "Первый закон — закон инерции: без внешней силы тело покоится или движется "
      "прямолинейно и равномерно. F = ma — это второй закон, а действие и "
      "противодействие — третий."),
    q("easy", 40,
      "Massasi 2 kg bo'lgan jismga 10 N kuch ta'sir qilsa, u qanday tezlanish oladi?",
      "A force of 10 N acts on a 2 kg body. What acceleration does it get?",
      "На тело массой 2 кг действует сила 10 Н. Какое ускорение оно получит?",
      ["5 m/s^2", "20 m/s^2", "0.2 m/s^2", "12 m/s^2"],
      ["5 m/s²", "20 m/s²", "0.2 m/s²", "12 m/s²"],
      ["5 м/с²", "20 м/с²", "0,2 м/с²", "12 м/с²"], 0,
      "Nyutonning ikkinchi qonuni: a = F/m = 10/2 = 5 m/s². 20 m/s² javobi kuchni "
      "massaga ko'paytirgan, 0,2 esa teskari bo'lgan.",
      "Newton's second law: a = F/m = 10/2 = 5 m/s². Answering 20 multiplies force by "
      "mass instead of dividing, and 0.2 divides the wrong way round.",
      "Второй закон Ньютона: a = F/m = 10/2 = 5 м/с². Ответ 20 получается умножением "
      "силы на массу, а 0,2 — делением наоборот."),
    q("medium", 40,
      "Kosmik kemada astronavt vaznsizlik holatida bo'lsa, uning massasi va og'irligi qanday bo'ladi?",
      "An astronaut is weightless aboard a spacecraft. What happens to their mass and weight?",
      "Космонавт на корабле находится в невесомости. Что происходит с его массой и весом?",
      ["Massasi o'zgarmaydi, og'irligi nolga teng",
       "Ikkalasi ham nolga teng",
       "Massasi nolga teng",
       "Ikkalasi ham ortadi"],
      ["Mass is unchanged, weight is zero",
       "Both are zero",
       "Mass is zero",
       "Both increase"],
      ["Масса не меняется, вес равен нулю",
       "И масса, и вес равны нулю",
       "Масса равна нулю",
       "И масса, и вес увеличиваются"], 0,
      "Massa — moddaning miqdori, u hech qayerda o'zgarmaydi. Og'irlik esa tayanchga "
      "bosim kuchi, erkin tushishda tayanch ham birga tushadi va bosim yo'qoladi. "
      "Tortishish kuchining o'zi joyida qoladi.",
      "Mass is how much matter there is, and it does not change anywhere. Weight is "
      "the force pressing on a support — and in free fall the support is falling too, "
      "so the pressing stops. Gravity itself is still there.",
      "Масса — количество вещества, она нигде не меняется. Вес — сила давления на "
      "опору, а в свободном падении опора падает вместе с телом, и давление исчезает. "
      "Само притяжение при этом никуда не девается."),
    q("medium", 60,
      "Jism vertikal yuqoriga 20 m/s tezlik bilan otildi. U eng baland nuqtaga necha sekundda yetib boradi (g=10)?",
      "A body is thrown straight up at 20 m/s. How long does it take to reach the highest point (g = 10)?",
      "Тело брошено вертикально вверх со скоростью 20 м/с. Через сколько секунд оно достигнет высшей точки (g = 10)?",
      ["2 s", "1 s", "4 s", "0.5 s"],
      ["2 s", "1 s", "4 s", "0.5 s"],
      ["2 с", "1 с", "4 с", "0,5 с"], 0,
      "Eng baland nuqtada tezlik nolga aylanadi, shuning uchun t = v₀/g = 20/10 = 2 s. "
      "4 s — bu ko'tarilish va tushishning yig'indisi, ya'ni butun uchish vaqti.",
      "At the top the velocity is zero, so t = v₀/g = 20/10 = 2 s. The answer 4 s is "
      "the whole flight — up and back down again.",
      "В верхней точке скорость равна нулю, поэтому t = v₀/g = 20/10 = 2 с. Ответ 4 с "
      "— это всё время полёта, вверх и обратно."),
    q("easy", 25,
      "Potensial energiya qaysi formuladan topiladi?",
      "Which formula gives potential energy?",
      "По какой формуле находится потенциальная энергия?",
      ["mgh", "mv^2/2", "kx^2/2", "F*s"],
      ["mgh", "mv²/2", "kx²/2", "F·s"],
      ["mgh", "mv²/2", "kx²/2", "F·s"], 0,
      "mgh — Yer sirtiga yaqin joyda balandlik bilan bog'liq potensial energiya. mv²/2 "
      "— kinetik energiya, kx²/2 — prujinada to'plangan energiya, F·s esa ish.",
      "mgh is the potential energy of height near Earth's surface. mv²/2 is kinetic "
      "energy, kx²/2 is the energy stored in a spring, and F·s is work.",
      "mgh — потенциальная энергия, связанная с высотой у поверхности Земли. mv²/2 — "
      "кинетическая энергия, kx²/2 — энергия пружины, F·s — работа."),
    q("easy", 25,
      "Yer sirtiga yaqin joyda erkin tushish tezlanishi qanchaga teng?",
      "What is the acceleration of free fall near Earth's surface?",
      "Чему равно ускорение свободного падения у поверхности Земли?",
      ["~9.8 m/s^2", "10.5 m/s^2", "1.6 m/s^2", "11.2 km/s"],
      ["~9.8 m/s²", "10.5 m/s²", "1.6 m/s²", "11.2 km/s"],
      ["~9,8 м/с²", "10,5 м/с²", "1,6 м/с²", "11,2 км/с"], 0,
      "9,8 m/s² — Yerdagi qiymat, masalalarda ko'pincha 10 deb olinadi. 1,6 m/s² — "
      "Oydagi tezlanish, 11,2 km/s esa umuman tezlanish emas: bu Yerdan qochish "
      "tezligi.",
      "9.8 m/s² is Earth's value, usually rounded to 10 in problems. 1.6 m/s² is the "
      "Moon's, and 11.2 km/s is not an acceleration at all — it is Earth's escape "
      "velocity.",
      "9,8 м/с² — значение для Земли, в задачах его обычно округляют до 10. 1,6 м/с² — "
      "для Луны, а 11,2 км/с вообще не ускорение: это вторая космическая скорость."),
    q("easy", 20,
      "Ishning o'lchov birligi nima?",
      "What is the unit of work?",
      "В каких единицах измеряется работа?",
      ["Joul (J)", "Vatt (W)", "Nyuton (N)", "Paskal (Pa)"],
      ["Joule (J)", "Watt (W)", "Newton (N)", "Pascal (Pa)"],
      ["Джоуль (Дж)", "Ватт (Вт)", "Ньютон (Н)", "Паскаль (Па)"], 0,
      "Ish — energiyaning o'zgarishi, shuning uchun uning birligi ham joul. Vatt — "
      "quvvat (joul/sekund), nyuton — kuch, paskal — bosim.",
      "Work is a change in energy, so it is measured in the same unit: the joule. The "
      "watt is power (joules per second), the newton is force and the pascal is "
      "pressure.",
      "Работа — это изменение энергии, поэтому измеряется в тех же единицах: в "
      "джоулях. Ватт — мощность (джоуль в секунду), ньютон — сила, паскаль — давление."),
    q("easy", 30,
      "Sanoq sistemasi nimalardan iborat?",
      "What does a frame of reference consist of?",
      "Из чего состоит система отсчёта?",
      ["Sanoq jismi, koordinatalar sistemasi va soatdan",
       "Faqat koordinatalar sistemasidan",
       "Jism va uning tezligidan",
       "Faqat soat va asboblardan"],
      ["A reference body, a coordinate system and a clock",
       "Only a coordinate system",
       "A body and its velocity",
       "Only a clock and instruments"],
      ["Из тела отсчёта, системы координат и часов",
       "Только из системы координат",
       "Из тела и его скорости",
       "Только из часов и приборов"], 0,
      "Uchalasi ham kerak: nimaga nisbatan (sanoq jismi), holatni qanday o'lchash "
      "(koordinatalar) va qachon (soat). Soatsiz tezlik haqida umuman gapirib "
      "bo'lmaydi.",
      "All three parts are needed: what the motion is measured against (the reference "
      "body), how position is measured (the coordinates), and when (the clock). "
      "Without a clock you cannot speak of speed at all.",
      "Нужны все три части: относительно чего (тело отсчёта), чем измерять положение "
      "(координаты) и когда (часы). Без часов о скорости вообще нельзя говорить."),
    q("easy", 25,
      "Kuch momentining o'lchov birligi qanday?",
      "What is the unit of the moment of force (torque)?",
      "В каких единицах измеряется момент силы?",
      ["N*m", "N/m", "J/s", "W"],
      ["N·m", "N/m", "J/s", "W"],
      ["Н·м", "Н/м", "Дж/с", "Вт"], 0,
      "Kuch momenti — kuchning yelkaga ko'paytmasi, ya'ni nyuton karra metr. J/s va W "
      "— quvvat birliklari, N/m esa prujinaning bikrligi.",
      "Torque is force times the length of the lever arm, so newton-metres. J/s and W "
      "are both units of power, and N/m is the stiffness of a spring.",
      "Момент силы — произведение силы на плечо, то есть ньютон-метр. Дж/с и Вт — "
      "единицы мощности, а Н/м — жёсткость пружины."),
    q("easy", 30,
      "Quvvat qanday hisoblanadi?",
      "How is power calculated?",
      "Как вычисляется мощность?",
      ["Bajarilgan ishning vaqtga nisbati",
       "Kuchning masofaga ko'paytmasi",
       "Massaning tezlanishga ko'paytmasi",
       "Energiyaning vaqtga ko'paytmasi"],
      ["Work done divided by time",
       "Force multiplied by distance",
       "Mass multiplied by acceleration",
       "Energy multiplied by time"],
      ["Совершённая работа, делённая на время",
       "Сила, умноженная на расстояние",
       "Масса, умноженная на ускорение",
       "Энергия, умноженная на время"], 0,
      "Quvvat ish qanchalik tez bajarilishini ko'rsatadi: P = A/t. Bir xil ishni ikki "
      "barobar tez bajarish quvvatni ikki barobar oshiradi, ishning o'zini emas.",
      "Power says how fast work is done: P = W/t. Doing the same job in half the time "
      "doubles the power, not the work.",
      "Мощность показывает, насколько быстро совершается работа: P = A/t. Сделать ту "
      "же работу вдвое быстрее — значит удвоить мощность, а не работу."),
    q("medium", 35,
      "Impulsning saqlanish qonuni qachon bajariladi?",
      "When does the law of conservation of momentum hold?",
      "Когда выполняется закон сохранения импульса?",
      ["Yopiq sistemada",
       "Ochiq sistemada",
       "Faqat elastik to'qnashuvlarda",
       "Faqat inersial bo'lmagan sanoq sistemalarida"],
      ["In a closed system",
       "In an open system",
       "Only in elastic collisions",
       "Only in non-inertial frames of reference"],
      ["В замкнутой системе",
       "В открытой системе",
       "Только при упругих столкновениях",
       "Только в неинерциальных системах отсчёта"], 0,
      "Yopiq sistemada tashqi kuchlar yo'q, shuning uchun umumiy impuls o'zgarmaydi. "
      "Bu elastik va noelastik to'qnashuvlarda birdek ishlaydi — faqat elastikda "
      "saqlanadigan narsa bu kinetik energiya.",
      "In a closed system there are no external forces, so the total momentum cannot "
      "change. It holds for elastic and inelastic collisions alike; the thing that is "
      "only conserved in elastic ones is kinetic energy.",
      "В замкнутой системе нет внешних сил, поэтому суммарный импульс не меняется. Это "
      "верно и для упругих, и для неупругих столкновений — а вот кинетическая энергия "
      "сохраняется только при упругих."),
    q("easy", 30,
      "Bosim nima va uning birligi qanday?",
      "What is pressure, and what is its unit?",
      "Что такое давление и в чём оно измеряется?",
      ["Yuzaga perpendikulyar kuch; Paskal (Pa)",
       "Jismning massasi; Kilogramm (kg)",
       "Ishning vaqtga nisbati; Vatt (W)",
       "Energiyaning o'zgarishi; Joul (J)"],
      ["Force per unit area, perpendicular to the surface; pascal (Pa)",
       "The mass of a body; kilogram (kg)",
       "Work divided by time; watt (W)",
       "A change in energy; joule (J)"],
      ["Сила, перпендикулярная поверхности, на единицу площади; паскаль (Па)",
       "Масса тела; килограмм (кг)",
       "Работа, делённая на время; ватт (Вт)",
       "Изменение энергии; джоуль (Дж)"], 0,
      "Bosim p = F/S: bir xil kuch kichikroq yuzaga tushsa, bosim ortadi. Shuning "
      "uchun o'tkir pichoq kesadi, keng chang'i esa yumshoq qorga botmaydi.",
      "Pressure is p = F/S: the same force spread over a smaller area gives more "
      "pressure. That is why a sharp knife cuts, and why wide skis keep you on top of "
      "soft snow.",
      "Давление p = F/S: та же сила на меньшей площади даёт большее давление. Поэтому "
      "острый нож режет, а широкие лыжи не проваливаются в рыхлый снег."),
    q("medium", 30,
      "Kinetik energiya nimaga bog'liq?",
      "What does kinetic energy depend on?",
      "От чего зависит кинетическая энергия?",
      ["Jismning massasi va tezligiga",
       "Jismning massasi va balandligiga",
       "Faqat jismning tezligiga",
       "Jismning shakliga"],
      ["The body's mass and velocity",
       "The body's mass and height",
       "Only the body's velocity",
       "The body's shape"],
      ["От массы и скорости тела",
       "От массы и высоты тела",
       "Только от скорости тела",
       "От формы тела"], 0,
      "Ek = mv²/2. Tezlik kvadratda turgani uchun tezlikni ikki barobar oshirish "
      "energiyani to'rt barobar oshiradi — avtohalokatda tezlik nega bunchalik "
      "muhimligining sababi shu.",
      "Ek = mv²/2. The velocity is squared, so doubling the speed multiplies the "
      "energy by four — which is why speed matters so much in a crash.",
      "Ek = mv²/2. Скорость входит в квадрате, поэтому вдвое большая скорость даёт "
      "вчетверо большую энергию — вот почему скорость так важна при аварии."),
    q("easy", 30,
      "Tekis harakatlanayotgan jismning tezlik-vaqt grafigi qanday?",
      "What does the velocity–time graph of uniform motion look like?",
      "Как выглядит график скорости от времени при равномерном движении?",
      ["Vaqt o'qiga parallel to'g'ri chiziq",
       "Parabola",
       "Koordinata boshidan chiquvchi to'g'ri chiziq",
       "Giperbola"],
      ["A straight line parallel to the time axis",
       "A parabola",
       "A straight line through the origin",
       "A hyperbola"],
      ["Прямая, параллельная оси времени",
       "Парабола",
       "Прямая, проходящая через начало координат",
       "Гипербола"], 0,
      "Tekis harakatda tezlik o'zgarmaydi, shuning uchun grafik gorizontal chiziq. "
      "Koordinata boshidan chiquvchi to'g'ri chiziq — bu tekis tezlanuvchan "
      "harakatning grafigi.",
      "In uniform motion the velocity never changes, so the graph is a horizontal "
      "line. A straight line rising from the origin is the graph of uniformly "
      "accelerated motion.",
      "При равномерном движении скорость не меняется, поэтому график — горизонтальная "
      "прямая. Прямая из начала координат — это график равноускоренного движения."),
    q("easy", 25,
      "Mexanik harakat nima?",
      "What is mechanical motion?",
      "Что такое механическое движение?",
      ["Jismning boshqa jismga nisbatan holat o'zgarishi",
       "Issiqlik harakati",
       "Elektromagnit hodisa",
       "Optik hodisa"],
      ["A change in the position of a body relative to other bodies",
       "Thermal motion",
       "An electromagnetic phenomenon",
       "An optical phenomenon"],
      ["Изменение положения тела относительно других тел",
       "Тепловое движение",
       "Электромагнитное явление",
       "Оптическое явление"], 0,
      "Harakat har doim biror narsaga nisbatan bo'ladi: poyezdda o'tirgan yo'lovchi "
      "vagonga nisbatan tinch, yer yuzasiga nisbatan esa tez harakatlanmoqda.",
      "Motion is always relative to something. A passenger sitting in a train is at "
      "rest relative to the carriage and moving fast relative to the ground.",
      "Движение всегда относительно чего-то. Пассажир, сидящий в поезде, покоится "
      "относительно вагона и быстро движется относительно земли."),
    q("medium", 35,
      "Nyutonning uchinchi qonuni qanday ta'riflanadi?",
      "How is Newton's third law stated?",
      "Как формулируется третий закон Ньютона?",
      ["Ta'sir kuchi aks ta'sir kuchiga teng va qarama-qarshi",
       "Jismga ta'sir etuvchi kuchlar yig'indisi nolga teng",
       "Kuch massa va tezlanish ko'paytmasiga teng",
       "Jismning tezligi faqat tashqi kuchlar ta'sirida o'zgaradi"],
      ["The action force is equal and opposite to the reaction force",
       "The sum of forces on a body is zero",
       "Force equals mass times acceleration",
       "A body's velocity changes only under external forces"],
      ["Сила действия равна силе противодействия и противоположна ей",
       "Сумма сил, действующих на тело, равна нулю",
       "Сила равна произведению массы на ускорение",
       "Скорость тела меняется только под действием внешних сил"], 0,
      "Kuchlar juft bo'lib tug'iladi va har doim ikki xil jismga qo'yiladi — shuning "
      "uchun ular bir-birini yo'qotmaydi. Raketa aynan shu bilan uchadi: u gazni "
      "orqaga itaradi, gaz esa raketani oldinga.",
      "Forces come in pairs and always act on two different bodies, which is why they "
      "do not cancel each other out. That is how a rocket flies: it pushes gas "
      "backwards and the gas pushes it forwards.",
      "Силы возникают парами и всегда приложены к разным телам — поэтому они не "
      "уничтожают друг друга. Именно так летит ракета: она толкает газ назад, а газ "
      "толкает её вперёд."),
    # ── Gravity, orbits and the questions a rocket raises ──
    q("medium", 40,
      "Havo qarshiligini hisobga olmasak, bir xil balandlikdan tashlangan 1 kg va 10 kg jismlardan qaysi biri avval yerga tushadi?",
      "Ignoring air resistance, which reaches the ground first when dropped from the same height: a 1 kg body or a 10 kg one?",
      "Без учёта сопротивления воздуха, что упадёт раньше с одной и той же высоты: тело 1 кг или 10 кг?",
      ["10 kg li jism",
       "1 kg li jism",
       "Ikkalasi bir vaqtda tushadi",
       "Jismning shakliga bog'liq"],
      ["The 10 kg one",
       "The 1 kg one",
       "They land at the same moment",
       "It depends on their shape"],
      ["Тело 10 кг",
       "Тело 1 кг",
       "Они упадут одновременно",
       "Зависит от их формы"], 2,
      "Og'irroq jismga tortishish kuchi kattaroq ta'sir qiladi, lekin uning "
      "inersiyasi ham xuddi shuncha marta katta: a = F/m = mg/m = g, ya'ni massa "
      "qisqaradi. Yerdagi tajribada pat sekinroq tushishining sababi — havo, "
      "og'irlik emas; Apollon-15 ekipaji buni Oyda bolg'a va pat bilan "
      "ko'rsatgan.",
      "The heavier body is pulled harder, but it also has proportionally more "
      "inertia to overcome: a = F/m = mg/m = g, and the mass cancels. A feather "
      "falls slowly here because of the air, not because it is light — the "
      "Apollo 15 crew dropped a hammer and a feather on the Moon to show it.",
      "На тяжёлое тело действует бо́льшая сила, но у него во столько же раз "
      "больше инерция: a = F/m = mg/m = g, масса сокращается. Перо падает "
      "медленно из-за воздуха, а не из-за малого веса — экипаж «Аполлона-15» "
      "показал это на Луне, уронив молоток и перо."),
    q("medium", 40,
      "Nima uchun Oyda tashlangan tosh Yerdagidan sekinroq tushadi?",
      "Why does a stone dropped on the Moon fall more slowly than on Earth?",
      "Почему камень на Луне падает медленнее, чем на Земле?",
      ["Oyda erkin tushish tezlanishi olti barobar kichik",
       "Oyda atmosfera yo'q",
       "Tosh Oyda yengilroq bo'lib qoladi",
       "Oyda tortishish kuchi umuman yo'q"],
      ["Free-fall acceleration on the Moon is about six times smaller",
       "The Moon has no atmosphere",
       "The stone becomes lighter on the Moon",
       "There is no gravity on the Moon at all"],
      ["Ускорение свободного падения на Луне примерно в шесть раз меньше",
       "На Луне нет атмосферы",
       "Камень на Луне становится легче",
       "На Луне вообще нет притяжения"], 0,
      "Oyda g = 1,6 m/s², Yerda esa 9,8 m/s² — taxminan olti barobar farq, "
      "chunki Oyning massasi kichik. Atmosferaning yo'qligi pat uchun ahamiyatli, "
      "tosh uchun deyarli hech narsani o'zgartirmaydi.",
      "On the Moon g = 1.6 m/s² against Earth's 9.8 — about six times less, "
      "because the Moon is far less massive. The missing atmosphere matters for a "
      "feather; for a stone it changes almost nothing.",
      "На Луне g = 1,6 м/с² против земных 9,8 — примерно в шесть раз меньше, "
      "потому что масса Луны мала. Отсутствие атмосферы важно для пера, а для "
      "камня почти ничего не меняет."),
    q("hard", 45,
      "Nima uchun sun'iy yo'ldosh orbitada qolish uchun dvigatelini yoqib turmaydi?",
      "Why does a satellite not need to run its engine to stay in orbit?",
      "Почему спутнику не нужно включать двигатель, чтобы оставаться на орбите?",
      ["U erkin tushmoqda, faqat yon tomonga shu qadar tez ketyaptiki, Yer sirti undan qochib ulguradi",
       "U balandlikda tortishish kuchi yo'q joyda turadi",
       "Uni atmosfera ushlab turadi",
       "Markazdan qochma kuch uni tashqariga itaradi"],
      ["It is in free fall, moving sideways fast enough that the Earth curves away beneath it",
       "It sits at an altitude where there is no gravity",
       "The atmosphere holds it up",
       "Centrifugal force pushes it outwards"],
      ["Он находится в свободном падении, двигаясь вбок так быстро, что Земля успевает уйти из-под него",
       "Он висит на высоте, где нет притяжения",
       "Его удерживает атмосфера",
       "Центробежная сила выталкивает его наружу"], 0,
      "Orbita — bu tinimsiz tushish. Yo'ldosh Yerga tortiladi, lekin yon tomonga "
      "8 km/s ga yaqin tezlik bilan uchgani uchun har safar Yerdan \"o'tib "
      "ketadi\". Dvigatel faqat orbitani o'zgartirish yoki atmosferaning "
      "qoldiq ishqalanishini qoplash uchun kerak.",
      "An orbit is a permanent fall. The satellite is pulled towards the Earth "
      "the whole time, but it is travelling sideways at nearly 8 km/s, so it keeps "
      "missing. The engine is only needed to change the orbit or to make up for "
      "the thin air still up there.",
      "Орбита — это непрерывное падение. Спутник всё время притягивается к Земле, "
      "но летит вбок со скоростью около 8 км/с и потому всё время «промахивается». "
      "Двигатель нужен лишь для смены орбиты или чтобы компенсировать "
      "сопротивление остатков атмосферы."),
    q("hard", 50,
      "Avtomobil tezligi ikki barobar oshsa, tormozlash masofasi qanday o'zgaradi?",
      "If a car doubles its speed, what happens to its braking distance?",
      "Если скорость автомобиля удвоится, как изменится тормозной путь?",
      ["To'rt barobar ortadi",
       "Ikki barobar ortadi",
       "O'zgarmaydi",
       "Sakkiz barobar ortadi"],
      ["It becomes four times longer",
       "It becomes twice as long",
       "It does not change",
       "It becomes eight times longer"],
      ["Увеличится в четыре раза",
       "Увеличится вдвое",
       "Не изменится",
       "Увеличится в восемь раз"], 0,
      "Tormoz kinetik energiyani ish orqali yo'qotadi: F·s = mv²/2, ya'ni "
      "s = mv²/(2F). Tezlik kvadratda turgani uchun uni ikki barobar oshirish "
      "masofani to'rt barobar uzaytiradi — 60 dan 120 km/soatga o'tish "
      "tormozlash masofasini ikki emas, to'rt barobar oshiradi.",
      "The brakes remove kinetic energy by doing work: F·s = mv²/2, so "
      "s = mv²/(2F). The speed is squared, so doubling it makes the distance four "
      "times longer — going from 60 to 120 km/h costs four times the stopping "
      "distance, not twice.",
      "Тормоза убирают кинетическую энергию, совершая работу: F·s = mv²/2, откуда "
      "s = mv²/(2F). Скорость входит в квадрате, поэтому её удвоение удлиняет путь "
      "вчетверо: с 60 до 120 км/ч тормозной путь растёт в четыре раза, а не вдвое."),
    q("hard", 45,
      "Ikki jism orasidagi masofa ikki barobar ortsa, ular orasidagi tortishish kuchi qanday o'zgaradi?",
      "If the distance between two bodies doubles, what happens to the gravitational force between them?",
      "Если расстояние между двумя телами удвоится, как изменится сила притяжения между ними?",
      ["To'rt barobar kamayadi",
       "Ikki barobar kamayadi",
       "Ikki barobar ortadi",
       "O'zgarmaydi"],
      ["It becomes four times smaller",
       "It becomes twice as small",
       "It becomes twice as large",
       "It does not change"],
      ["Уменьшится в четыре раза",
       "Уменьшится вдвое",
       "Увеличится вдвое",
       "Не изменится"], 0,
      "Butun olam tortishish qonuni: F = G·m₁m₂/r². Masofa maxrajda kvadratda "
      "turadi, shuning uchun uni ikki barobar oshirish kuchni 2² = 4 barobar "
      "kamaytiradi. Xuddi shu \"teskari kvadrat\" qoidasi yorug'lik va "
      "tovushning uzoqlashgan sari susayishini ham tushuntiradi.",
      "Newton's law of gravitation is F = G·m₁m₂/r². The distance is squared in "
      "the denominator, so doubling it divides the force by 2² = 4. The same "
      "inverse-square rule explains why light and sound fade with distance.",
      "Закон всемирного тяготения: F = G·m₁m₂/r². Расстояние стоит в знаменателе "
      "в квадрате, поэтому его удвоение уменьшает силу в 2² = 4 раза. То же "
      "правило обратных квадратов объясняет ослабление света и звука с "
      "расстоянием."),
    q("hard", 45,
      "Kosmosda itariladigan havo yo'q. Unda raketa qanday qilib tezlanadi?",
      "There is no air to push against in space. So how does a rocket accelerate?",
      "В космосе не от чего отталкиваться. Как же ракета разгоняется?",
      ["U o'zining chiqindi gazini orqaga itaradi, gaz esa raketani oldinga — impuls saqlanadi",
       "U havoga tayanadi",
       "U Yerning magnit maydoniga tayanadi",
       "Kosmosda raketa tezlana olmaydi"],
      ["It throws its own exhaust gas backwards, and the gas pushes it forwards — momentum is conserved",
       "It pushes against the air",
       "It pushes against Earth's magnetic field",
       "A rocket cannot accelerate in space"],
      ["Она отбрасывает назад собственные выхлопные газы, а они толкают её вперёд — импульс сохраняется",
       "Она отталкивается от воздуха",
       "Она отталкивается от магнитного поля Земли",
       "В космосе ракета разгоняться не может"], 0,
      "Raketaga hech narsadan tayanish kerak emas: u o'z yoqilg'isining massasini "
      "orqaga uloqtiradi. Yopiq sistemaning umumiy impulsi o'zgarmagani uchun "
      "gaz orqaga ketsa, raketa oldinga ketishi shart. Havoning yo'qligi hatto "
      "yordam beradi — qarshilik yo'q.",
      "A rocket does not need anything to lean on: it throws the mass of its own "
      "propellant backwards. Because the total momentum of the system cannot "
      "change, gas going one way means the rocket goes the other. Having no air "
      "actually helps — there is nothing to slow it down.",
      "Ракете не нужна опора: она отбрасывает назад массу собственного топлива. "
      "Суммарный импульс системы не меняется, поэтому если газ уходит назад, "
      "ракета идёт вперёд. Отсутствие воздуха даже помогает — нечему тормозить."),
    q("hard", 50,
      "Nima uchun Yerga qaytayotgan kosmik kemaga issiqlik qalqoni kerak?",
      "Why does a spacecraft returning to Earth need a heat shield?",
      "Зачем возвращающемуся на Землю кораблю нужен теплозащитный экран?",
      ["Uning ulkan kinetik energiyasi oldidagi havoni siqib, minglab gradusgacha qizdiradi",
       "Quyosh nuri uni qizdiradi",
       "Dvigatellari qizib ketadi",
       "Vakuumdagi ishqalanishdan"],
      ["Its huge kinetic energy compresses the air in front of it and heats it to thousands of degrees",
       "Sunlight heats it up",
       "Its engines overheat",
       "Friction with the vacuum"],
      ["Его огромная кинетическая энергия сжимает воздух перед ним и нагревает до тысяч градусов",
       "Его нагревает солнечный свет",
       "Перегреваются двигатели",
       "От трения о вакуум"], 0,
      "Kema atmosferaga 7-8 km/s tezlik bilan kiradi. Bu tezlikdagi kinetik "
      "energiya biror joyga ketishi kerak, va u oldidagi havoni keskin siqadi — "
      "siqilgan gaz minglab gradusgacha qiziydi. Ya'ni kemani qizdirayotgan "
      "narsa asosan ishqalanish emas, siqilish.",
      "The craft enters the atmosphere at 7–8 km/s. That kinetic energy has to go "
      "somewhere, and it goes into violently compressing the air ahead of it; "
      "compressed gas gets hot, thousands of degrees hot. What heats the craft is "
      "mostly compression rather than rubbing.",
      "Корабль входит в атмосферу со скоростью 7–8 км/с. Эта кинетическая энергия "
      "должна куда-то деться — она резко сжимает воздух перед кораблём, а сжатый "
      "газ разогревается до тысяч градусов. То есть греет корабль в основном "
      "сжатие, а не трение."),
    q("hard", 45,
      "Elastik to'qnashuvni noelastikdan nima ajratib turadi?",
      "What distinguishes an elastic collision from an inelastic one?",
      "Чем упругое столкновение отличается от неупругого?",
      ["Elastikda kinetik energiya ham saqlanadi, noelastikda esa faqat impuls",
       "Elastikda faqat impuls saqlanadi",
       "Noelastikda impuls saqlanmaydi",
       "Ikkalasida ham hech narsa saqlanmaydi"],
      ["In an elastic collision kinetic energy is conserved as well; in an inelastic one only momentum is",
       "In an elastic collision only momentum is conserved",
       "In an inelastic collision momentum is not conserved",
       "Nothing is conserved in either"],
      ["При упругом сохраняется и кинетическая энергия, при неупругом — только импульс",
       "При упругом сохраняется только импульс",
       "При неупругом импульс не сохраняется",
       "Ни при одном ничего не сохраняется"], 0,
      "Yopiq sistemada impuls har qanday to'qnashuvda saqlanadi — bu farqlovchi "
      "belgi emas. Farq kinetik energiyada: noelastik to'qnashuvda uning bir "
      "qismi deformatsiya va issiqlikka ketadi, elastikda esa ketmaydi. Aynan "
      "shu ta'rifning o'zi.",
      "Momentum is conserved in every collision in a closed system, so it is not "
      "what tells them apart. The difference is the kinetic energy: in an "
      "inelastic collision some of it goes into deformation and heat, and in an "
      "elastic one none of it does. That is the definition.",
      "Импульс сохраняется при любом столкновении в замкнутой системе, так что "
      "различает их не он. Разница в кинетической энергии: при неупругом часть её "
      "уходит на деформацию и нагрев, при упругом — нет. Это и есть определение."),
]
