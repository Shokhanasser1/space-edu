"""Problems — the ones with a number at the end.

Nothing here is a recall question, so `time_seconds` is 90 or 120 rather than
the 20 or 30 a name gets. The daily challenge used to give every question a
flat 15 seconds, and one of these was "the first half at 60 km/h, the second
at 40 — find the average speed".

The explanation shows the working, then names the mistake behind whichever
wrong option is the tempting one. A child who answered 50 to that question did
not fail to know a fact; they averaged two speeds, and that is the thing worth
telling them.
"""
from .builder import for_category

q = for_category('problems')

QUESTIONS = [
    q("hard", 120,
      "Avtomobil yo'lning birinchi yarmini 60 km/soat, ikkinchi yarmini 40 km/soat tezlik bilan o'tdi. O'rtacha tezlikni toping.",
      "A car covers the first half of a road at 60 km/h and the second half at 40 km/h. Find the average speed.",
      "Автомобиль проехал первую половину пути со скоростью 60 км/ч, вторую — 40 км/ч. Найдите среднюю скорость.",
      ["48 km/soat", "50 km/soat", "52 km/soat", "45 km/soat"],
      ["48 km/h", "50 km/h", "52 km/h", "45 km/h"],
      ["48 км/ч", "50 км/ч", "52 км/ч", "45 км/ч"], 0,
      "O'rtacha tezlik — tezliklarning o'rtachasi emas, butun yo'lning butun vaqtga "
      "nisbati. Yo'lning yarmi s bo'lsa, vaqt s/60 + s/40 = s/24, ya'ni 2s : (s/24) = "
      "48 km/soat. 50 javobi — aynan tuzoq: shunchaki (60+40)/2 hisoblangan. Sekinroq "
      "tezlikda ko'proq vaqt o'tgani uchun o'rtacha har doim 50 dan kichik.",
      "Average speed is total distance over total time, not the average of the two "
      "speeds. If each half is s, the time is s/60 + s/40 = s/24, so 2s ÷ (s/24) = 48 "
      "km/h. The 50 option is the trap: it is just (60+40)/2. More time is spent at "
      "the slower speed, so the true average is always below the midpoint.",
      "Средняя скорость — это весь путь, делённый на всё время, а не среднее двух "
      "скоростей. Если каждая половина равна s, время равно s/60 + s/40 = s/24, значит "
      "2s ÷ (s/24) = 48 км/ч. Вариант 50 — это и есть ловушка: просто (60+40)/2. На "
      "медленном участке проведено больше времени, поэтому средняя всегда меньше "
      "середины."),
    q("medium", 90,
      "Bikrligi 100 N/m bo'lgan prujinani 2 sm ga cho'zish uchun qancha ish bajarish kerak?",
      "How much work is needed to stretch a spring of stiffness 100 N/m by 2 cm?",
      "Какую работу нужно совершить, чтобы растянуть пружину жёсткостью 100 Н/м на 2 см?",
      ["0.02 J", "0.04 J", "2 J", "4 J"],
      ["0.02 J", "0.04 J", "2 J", "4 J"],
      ["0,02 Дж", "0,04 Дж", "2 Дж", "4 Дж"], 0,
      "Prujinaning energiyasi A = kx²/2. Muhimi — santimetrni metrga o'tkazish: x = "
      "0,02 m, demak A = 100 · 0,0004 / 2 = 0,02 J. 2 sm ni to'g'ridan-to'g'ri "
      "qo'ysangiz 2 J chiqadi, ya'ni yuz barobar katta.",
      "The energy stored in a spring is W = kx²/2. The step that matters is turning "
      "centimetres into metres: x = 0.02 m, so W = 100 × 0.0004 / 2 = 0.02 J. Putting "
      "2 cm straight into the formula gives 2 J — a hundred times too big.",
      "Энергия пружины: A = kx²/2. Главное — перевести сантиметры в метры: x = 0,02 м, "
      "поэтому A = 100 · 0,0004 / 2 = 0,02 Дж. Если подставить 2 см как есть, "
      "получится 2 Дж — в сто раз больше."),
    q("medium", 90,
      "Massasi 2 kg jism 10 m balandlikdan erkin tushmoqda. Kinetik energiyasi qancha (g=10)?",
      "A 2 kg body falls freely from a height of 10 m. What is its kinetic energy at the bottom (g = 10)?",
      "Тело массой 2 кг свободно падает с высоты 10 м. Какова его кинетическая энергия у земли (g = 10)?",
      ["200 J", "100 J", "50 J", "400 J"],
      ["200 J", "100 J", "50 J", "400 J"],
      ["200 Дж", "100 Дж", "50 Дж", "400 Дж"], 0,
      "Energiyaning saqlanishi: yuqoridagi potensial energiya pastda to'liq kinetik "
      "energiyaga aylanadi. Ek = mgh = 2 · 10 · 10 = 200 J. Tezlikni alohida hisoblash "
      "shart emas — mgh formulasi buni bir qadamda beradi.",
      "Conservation of energy: the potential energy at the top becomes kinetic energy "
      "at the bottom. Ek = mgh = 2 × 10 × 10 = 200 J. There is no need to find the "
      "speed first — mgh gets there in one step.",
      "Сохранение энергии: потенциальная энергия наверху полностью переходит в "
      "кинетическую внизу. Ek = mgh = 2 · 10 · 10 = 200 Дж. Скорость отдельно считать "
      "не нужно — формула mgh даёт ответ сразу."),
    q("hard", 120,
      "20 C dagi 5 kg suvni qaynash darajasigacha isitish uchun qancha issiqlik kerak (c=4200)?",
      "How much heat is needed to bring 5 kg of water from 20 °C to the boiling point (c = 4200)?",
      "Сколько теплоты нужно, чтобы нагреть 5 кг воды от 20 °C до кипения (c = 4200)?",
      ["1.68 MJ", "2.1 MJ", "16.8 MJ", "0.84 MJ"],
      ["1.68 MJ", "2.1 MJ", "16.8 MJ", "0.84 MJ"],
      ["1,68 МДж", "2,1 МДж", "16,8 МДж", "0,84 МДж"], 0,
      "Q = c·m·ΔT. Bu yerdagi asosiy qadam — ΔT ni to'g'ri olish: 100 − 20 = 80 °C, "
      "100 emas. Q = 4200 · 5 · 80 = 1 680 000 J = 1,68 MJ. 2,1 MJ javobi ΔT o'rniga "
      "100 ni qo'ygan.",
      "Q = c·m·ΔT. The step that catches people is ΔT: it is 100 − 20 = 80 °C, not "
      "100. Q = 4200 × 5 × 80 = 1,680,000 J = 1.68 MJ. The 2.1 MJ option is what you "
      "get by using 100 instead of the difference.",
      "Q = c·m·ΔT. Главное здесь — правильно взять ΔT: 100 − 20 = 80 °C, а не 100. Q = "
      "4200 · 5 · 80 = 1 680 000 Дж = 1,68 МДж. Вариант 2,1 МДж получается, если "
      "подставить 100 вместо разности."),
    q("medium", 90,
      "Massasi 500 g bo'lgan jism 4 m/s tezlik bilan harakatlansa, uning impulsi qancha?",
      "A 500 g body moves at 4 m/s. What is its momentum?",
      "Тело массой 500 г движется со скоростью 4 м/с. Каков его импульс?",
      ["2 kg*m/s", "2000 kg*m/s", "0.125 kg*m/s", "8 kg*m/s"],
      ["2 kg·m/s", "2000 kg·m/s", "0.125 kg·m/s", "8 kg·m/s"],
      ["2 кг·м/с", "2000 кг·м/с", "0,125 кг·м/с", "8 кг·м/с"], 0,
      "Impuls p = m·v, lekin massa kilogrammda bo'lishi kerak: 500 g = 0,5 kg, demak p "
      "= 0,5 · 4 = 2 kg·m/s. 2000 javobi grammni o'tkazmasdan qo'ygan.",
      "Momentum is p = m·v, with the mass in kilograms: 500 g = 0.5 kg, so p = 0.5 × 4 "
      "= 2 kg·m/s. The 2000 option comes from leaving the mass in grams.",
      "Импульс p = m·v, но массу нужно взять в килограммах: 500 г = 0,5 кг, поэтому p "
      "= 0,5 · 4 = 2 кг·м/с. Вариант 2000 получается, если оставить граммы."),
    q("hard", 60,
      "Yer atrofida uchayotgan sun'iy yo'ldoshning orbital tezligi taxminan qancha?",
      "What is the approximate orbital speed of a satellite in low Earth orbit?",
      "Какова примерная орбитальная скорость спутника на низкой околоземной орбите?",
      ["7.9 km/s", "11.2 km/s", "3.4 km/s", "29.8 km/s"],
      ["7.9 km/s", "11.2 km/s", "3.4 km/s", "29.8 km/s"],
      ["7,9 км/с", "11,2 км/с", "3,4 км/с", "29,8 км/с"], 0,
      "Birinchi kosmik tezlik — taxminan 7,9 km/s. Bu Yer atrofida doiraviy orbitada "
      "qolish uchun kerak bo'lgan tezlik; 11,2 km/s esa Yerni butunlay tark etish "
      "uchun kerak bo'lgan ikkinchi kosmik tezlik, 29,8 km/s esa Yerning Quyosh "
      "atrofidagi tezligi.",
      "The first cosmic velocity is about 7.9 km/s — what it takes to stay on a "
      "circular orbit around the Earth. 11.2 km/s is the second cosmic velocity, for "
      "leaving Earth altogether, and 29.8 km/s is Earth's own speed around the Sun.",
      "Первая космическая скорость — около 7,9 км/с: столько нужно, чтобы держаться на "
      "круговой орбите вокруг Земли. 11,2 км/с — вторая космическая, для полного ухода "
      "от Земли, а 29,8 км/с — скорость самой Земли вокруг Солнца."),
    q("medium", 90,
      "10 kg massali jism 5 m balandlikdan tushganda qancha kinetik energiya oladi (g=10)?",
      "How much kinetic energy does a 10 kg body gain falling from 5 m (g = 10)?",
      "Какую кинетическую энергию приобретёт тело массой 10 кг, упав с высоты 5 м (g = 10)?",
      ["500 J", "50 J", "100 J", "250 J"],
      ["500 J", "50 J", "100 J", "250 J"],
      ["500 Дж", "50 Дж", "100 Дж", "250 Дж"], 0,
      "Yana mgh: 10 · 10 · 5 = 500 J. E'tibor bering — oldingi masalada 2 kg jism 10 m "
      "dan tushib 200 J oldi, bu yerda 10 kg 5 m dan tushib 500 J oladi. Massa ham, "
      "balandlik ham teng huquqda ishtirok etadi.",
      "mgh again: 10 × 10 × 5 = 500 J. Notice that a 2 kg body falling 10 m gains 200 "
      "J while a 10 kg body falling 5 m gains 500 J — mass and height enter the "
      "formula on exactly equal terms.",
      "Снова mgh: 10 · 10 · 5 = 500 Дж. Обратите внимание: тело 2 кг с высоты 10 м "
      "получает 200 Дж, а тело 10 кг с высоты 5 м — 500 Дж. Масса и высота входят в "
      "формулу совершенно одинаково."),
    q("hard", 60,
      "Ikkinchi kosmik tezlik (Yerdan qochish tezligi) qanchaga teng?",
      "What is the second cosmic velocity (Earth's escape velocity)?",
      "Чему равна вторая космическая скорость (скорость убегания с Земли)?",
      ["11.2 km/s", "7.9 km/s", "16.7 km/s", "29.8 km/s"],
      ["11.2 km/s", "7.9 km/s", "16.7 km/s", "29.8 km/s"],
      ["11,2 км/с", "7,9 км/с", "16,7 км/с", "29,8 км/с"], 0,
      "11,2 km/s — Yer tortishishidan butunlay qutulish uchun kerak bo'lgan tezlik. U "
      "birinchi kosmik tezlikdan aynan √2 marta katta: 7,9 · 1,41 ≈ 11,2. Bu tasodif "
      "emas, ikkalasi ham bir xil formuladan kelib chiqadi.",
      "11.2 km/s is what it takes to escape Earth's gravity for good. It is exactly √2 "
      "times the first cosmic velocity: 7.9 × 1.41 ≈ 11.2. That is not a coincidence — "
      "both come out of the same formula.",
      "11,2 км/с — скорость, необходимая, чтобы окончательно вырваться из притяжения "
      "Земли. Она ровно в √2 раза больше первой космической: 7,9 · 1,41 ≈ 11,2. Это не "
      "совпадение: обе следуют из одной формулы."),
    q("medium", 90,
      "R=2 m radiusli aylana bo'ylab 4 m/s tezlik bilan harakatlanayotgan jismning markazga intilma tezlanishi qancha?",
      "A body moves at 4 m/s along a circle of radius R = 2 m. What is its centripetal acceleration?",
      "Тело движется со скоростью 4 м/с по окружности радиусом R = 2 м. Каково его центростремительное ускорение?",
      ["8 m/s^2", "2 m/s^2", "16 m/s^2", "4 m/s^2"],
      ["8 m/s²", "2 m/s²", "16 m/s²", "4 m/s²"],
      ["8 м/с²", "2 м/с²", "16 м/с²", "4 м/с²"], 0,
      "a = v²/R = 16/2 = 8 m/s². Tezlik kvadratda: aylana bo'ylab ikki barobar tez "
      "yursangiz, tezlanish to'rt barobar ortadi. 2 m/s² javobi v ni kvadratga "
      "ko'tarishni unutgan.",
      "a = v²/R = 16/2 = 8 m/s². The speed is squared, so going twice as fast round "
      "the same circle needs four times the acceleration. The 2 m/s² option forgets to "
      "square v.",
      "a = v²/R = 16/2 = 8 м/с². Скорость входит в квадрате: вдвое быстрее по той же "
      "окружности — вчетверо большее ускорение. Вариант 2 м/с² получается, если забыть "
      "возвести v в квадрат."),
    q("hard", 90,
      "Massasi 60 kg bo'lgan kosmonavt Oyda qancha og'irlik kuchiga ega (g_oy=1.6 m/s^2)?",
      "What is the weight of a 60 kg cosmonaut on the Moon (g_moon = 1.6 m/s²)?",
      "Каков вес космонавта массой 60 кг на Луне (g_Луны = 1,6 м/с²)?",
      ["96 N", "600 N", "9.6 N", "588 N"],
      ["96 N", "600 N", "9.6 N", "588 N"],
      ["96 Н", "600 Н", "9,6 Н", "588 Н"], 0,
      "Og'irlik P = m·g = 60 · 1,6 = 96 N. Massa Oyda ham 60 kg bo'lib qoladi — "
      "o'zgaradigan narsa og'irlik. 600 N va 588 N javoblari Yerdagi g ni ishlatgan.",
      "Weight is P = m·g = 60 × 1.6 = 96 N. The mass is still 60 kg on the Moon; it is "
      "the weight that changes. The 600 N and 588 N options use Earth's g instead.",
      "Вес P = m·g = 60 · 1,6 = 96 Н. Масса на Луне остаётся 60 кг — меняется именно "
      "вес. Варианты 600 Н и 588 Н получаются при использовании земного g."),
    # ── Collisions, energy and the inverse square, with numbers on them ──
    q("medium", 90,
      "Massasi 3 kg jism 4 m/s tezlik bilan tinch turgan 1 kg jismga urilib, ular birga harakatlandi. Umumiy tezlik qancha?",
      "A 3 kg body moving at 4 m/s hits a stationary 1 kg body and they move off together. What is their common speed?",
      "Тело массой 3 кг со скоростью 4 м/с сталкивается с покоящимся телом 1 кг, и дальше они движутся вместе. Какова их общая скорость?",
      ["3 m/s", "4 m/s", "1 m/s", "12 m/s"],
      ["3 m/s", "4 m/s", "1 m/s", "12 m/s"],
      ["3 м/с", "4 м/с", "1 м/с", "12 м/с"], 0,
      "Impulsning saqlanishi: to'qnashuvgacha p = 3 · 4 = 12 kg·m/s, keyin esa "
      "shu impuls 3 + 1 = 4 kg massaga tegishli, demak v = 12/4 = 3 m/s. Bu "
      "noelastik to'qnashuv — impuls saqlanadi, kinetik energiyaning bir qismi "
      "esa deformatsiyaga ketadi.",
      "Conservation of momentum: before the collision p = 3 × 4 = 12 kg·m/s, and "
      "afterwards that same momentum belongs to 3 + 1 = 4 kg, so v = 12/4 = "
      "3 m/s. This is an inelastic collision — momentum is conserved and some of "
      "the kinetic energy goes into deforming the bodies.",
      "Сохранение импульса: до столкновения p = 3 · 4 = 12 кг·м/с, после тот же "
      "импульс принадлежит массе 3 + 1 = 4 кг, значит v = 12/4 = 3 м/с. Это "
      "неупругое столкновение: импульс сохраняется, а часть кинетической энергии "
      "уходит на деформацию."),
    q("medium", 90,
      "Quvvati 60 W bo'lgan lampa 2 soat ishlasa, qancha energiya sarflaydi?",
      "A 60 W lamp runs for 2 hours. How much energy does it use?",
      "Лампа мощностью 60 Вт работает 2 часа. Сколько энергии она израсходует?",
      ["432 kJ", "120 kJ", "30 kJ", "7.2 kJ"],
      ["432 kJ", "120 kJ", "30 kJ", "7.2 kJ"],
      ["432 кДж", "120 кДж", "30 кДж", "7,2 кДж"], 0,
      "A = P·t, lekin vaqt sekundda bo'lishi kerak: 2 soat = 7200 s, demak "
      "A = 60 · 7200 = 432 000 J = 432 kJ. 120 kJ javobi soatni shundayligicha "
      "qo'ygan (60 · 2), ya'ni 3600 barobar kichik.",
      "W = P·t, with the time in seconds: 2 hours = 7200 s, so W = 60 × 7200 = "
      "432,000 J = 432 kJ. The 120 kJ option uses the hours as they stand "
      "(60 × 2) and lands 3600 times short.",
      "A = P·t, но время нужно в секундах: 2 часа = 7200 с, поэтому A = 60 · 7200 "
      "= 432 000 Дж = 432 кДж. Вариант 120 кДж получается, если подставить часы "
      "как есть (60 · 2) — в 3600 раз меньше."),
    q("medium", 90,
      "Jism 20 m balandlikdan erkin tushdi. U yerga qanday tezlik bilan uriladi (g=10)?",
      "A body falls freely from 20 m. How fast is it moving when it hits the ground (g = 10)?",
      "Тело свободно падает с высоты 20 м. С какой скоростью оно ударится о землю (g = 10)?",
      ["20 m/s", "200 m/s", "10 m/s", "40 m/s"],
      ["20 m/s", "200 m/s", "10 m/s", "40 m/s"],
      ["20 м/с", "200 м/с", "10 м/с", "40 м/с"], 0,
      "mgh = mv²/2 dan massa qisqaradi va v = √(2gh) = √(2 · 10 · 20) = √400 = "
      "20 m/s. 200 m/s javobi ildizni olishni unutgan. Balandlikni to'rt barobar "
      "oshirsangiz tezlik faqat ikki barobar ortadi.",
      "From mgh = mv²/2 the mass cancels and v = √(2gh) = √(2 × 10 × 20) = √400 = "
      "20 m/s. The 200 m/s option forgets the square root. Quadrupling the height "
      "only doubles the landing speed.",
      "Из mgh = mv²/2 масса сокращается, и v = √(2gh) = √(2 · 10 · 20) = √400 = "
      "20 м/с. Вариант 200 м/с получается, если забыть извлечь корень. "
      "Увеличение высоты вчетверо повышает скорость лишь вдвое."),
    q("hard", 120,
      "Massasi 1000 kg avtomobil 20 m/s tezlikdan 50 m masofada to'liq to'xtadi. Tormozlash kuchi qancha?",
      "A 1000 kg car brakes from 20 m/s to a stop in 50 m. What is the braking force?",
      "Автомобиль массой 1000 кг тормозит с 20 м/с до полной остановки за 50 м. Какова сила торможения?",
      ["4000 N", "400 N", "8000 N", "2000 N"],
      ["4000 N", "400 N", "8000 N", "2000 N"],
      ["4000 Н", "400 Н", "8000 Н", "2000 Н"], 0,
      "Tormoz butun kinetik energiyani ish orqali yo'qotadi: Ek = mv²/2 = "
      "1000 · 400 / 2 = 200 000 J, va F = A/s = 200 000 / 50 = 4000 N. 8000 N "
      "javobi mv²/2 dagi ikkiga bo'lishni unutgan.",
      "The brakes remove the whole kinetic energy by doing work: Ek = mv²/2 = "
      "1000 × 400 / 2 = 200,000 J, and F = W/s = 200,000 / 50 = 4000 N. The "
      "8000 N option forgets the ½ in mv²/2.",
      "Тормоза убирают всю кинетическую энергию, совершая работу: Ek = mv²/2 = "
      "1000 · 400 / 2 = 200 000 Дж, и F = A/s = 200 000 / 50 = 4000 Н. Вариант "
      "8000 Н получается, если забыть про ½ в mv²/2."),
    q("hard", 120,
      "Yer sirtidan 6400 km balandlikka ko'tarilgan jismga ta'sir etuvchi tortishish kuchi yer yuzasidagidan necha marta kichik? (Yer radiusi 6400 km)",
      "How many times smaller is the gravitational force on a body raised 6400 km above the surface? (Earth's radius is 6400 km)",
      "Во сколько раз меньше сила притяжения, действующая на тело, поднятое на 6400 км над поверхностью? (Радиус Земли 6400 км)",
      ["4 marta", "2 marta", "8 marta", "O'zgarmaydi"],
      ["4 times", "2 times", "8 times", "It does not change"],
      ["В 4 раза", "В 2 раза", "В 8 раз", "Не изменится"], 0,
      "Masofa Yer markazidan o'lchanadi, balandlikdan emas: 6400 + 6400 = "
      "12 800 km, ya'ni r ikki barobar ortdi. F ~ 1/r² bo'lgani uchun kuch 2² = 4 "
      "marta kamayadi. Eng ko'p uchraydigan xato — balandlikni radiusga "
      "qo'shishni unutish.",
      "The distance is measured from the centre of the Earth, not from the "
      "surface: 6400 + 6400 = 12,800 km, so r has doubled. Since F ∝ 1/r², the "
      "force drops by 2² = 4. The usual mistake is forgetting to add the radius "
      "to the altitude.",
      "Расстояние отсчитывается от центра Земли, а не от поверхности: "
      "6400 + 6400 = 12 800 км, то есть r удвоилось. Так как F ~ 1/r², сила "
      "уменьшается в 2² = 4 раза. Обычная ошибка — забыть прибавить радиус к "
      "высоте."),
    q("hard", 120,
      "Massasi 0,5 kg to'p 10 m/s tezlik bilan devorga urilib, xuddi shu tezlik bilan orqaga qaytdi. Impulsning o'zgarishi qancha?",
      "A 0.5 kg ball hits a wall at 10 m/s and bounces straight back at the same speed. What is the change in its momentum?",
      "Мяч массой 0,5 кг ударяется о стену со скоростью 10 м/с и отскакивает назад с той же скоростью. Каково изменение его импульса?",
      ["10 kg·m/s", "5 kg·m/s", "0", "20 kg·m/s"],
      ["10 kg·m/s", "5 kg·m/s", "0", "20 kg·m/s"],
      ["10 кг·м/с", "5 кг·м/с", "0", "20 кг·м/с"], 0,
      "Impuls — vektor. Tezlik yo'nalishi teskariga o'zgargani uchun "
      "Δp = m·v − (−m·v) = 2mv = 2 · 0,5 · 10 = 10 kg·m/s. 5 javobi — eng keng "
      "tarqalgan xato: yo'nalish o'zgarishini hisobga olmay, faqat mv olingan.",
      "Momentum is a vector. The velocity reverses, so Δp = m·v − (−m·v) = 2mv = "
      "2 × 0.5 × 10 = 10 kg·m/s. The 5 option is the classic mistake: taking mv "
      "alone and ignoring that the direction flipped.",
      "Импульс — вектор. Скорость меняет направление, поэтому Δp = m·v − (−m·v) = "
      "2mv = 2 · 0,5 · 10 = 10 кг·м/с. Вариант 5 — классическая ошибка: взяли "
      "просто mv, не учтя смену направления."),
]
