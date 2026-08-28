/**
 * The written lessons of `physics-kinematics`, in the three languages the site
 * is read in.
 *
 * Until this file existed, all 474 lessons in /learn were a title and, for 35
 * of them, a video: `TopicLesson.content` was empty for every row in the
 * database, so a pupil opened a lesson and found one generic sentence saying
 * that a lesson was coming.
 *
 * Keyed by the slug the lesson already has. The slug is what progress and
 * awards are recorded against, so it is also the key here — correcting a title
 * must never move it, which is why each entry is looked up by slug and passed
 * back to the exporter as an explicit `slug` override.
 *
 * `name` and `content` are the Uzbek originals. English and Russian are written
 * from them, not machine-translated, and every reader falls back to the Uzbek
 * when a translation is missing.
 *
 * Written by hand, for 10-to-18-year-olds. Every number in here is checked:
 * unit conversions are exact (72 km/h = 20 m/s), and each worked example is
 * arithmetically consistent with the formula above it — lessons 7 and 9
 * deliberately use the same motion so a pupil can see the algebra and the area
 * under the graph give the same 36 m.
 */
export const kinematicsLessonText = {
  'physics-kinematics-basic-concepts-in-mechanics': {
    name: 'Mexanikaning asosiy tushunchalari',
    nameEn: 'Basic concepts in mechanics',
    nameRu: 'Основные понятия механики',
    content: `Mexanika jismlar qanday harakatlanishini va nima uchun aynan shunday harakatlanishini o'rganadi.

**Moddiy nuqta** — masalaning shartida o'lchamini hisobga olmasa ham bo'ladigan jism. Toshkentdan Samarqandga ketayotgan avtobus xaritada nuqta; garajga kirayotgan o'sha avtobus esa nuqta emas.

**Sanoq sistemasi** — sanoq jismi, unga bog'langan koordinata o'qi va soat. Ularsiz "jism qayerda?" degan savolning javobi yo'q.

**Trayektoriya** — jism chizib o'tgan chiziq. **Yo'l** — shu chiziqning uzunligi, u hech qachon kamaymaydi. **Ko'chish** — boshlang'ich nuqtadan oxirgi nuqtaga yo'nalgan vektor.

### Misol

Stadionning 400 metrli doirasi bo'ylab bir marta yugurdingiz. Yo'l 400 m ga teng, ko'chish esa nolga teng — chunki siz turgan joyingizga qaytdingiz.

Xalqaro birliklar sistemasida (SI) uzunlik metrda (m), vaqt sekundda (s) o'lchanadi.`,
    contentEn: `Mechanics studies how bodies move, and why they move the way they do.

**A point mass** is a body whose size does not matter for the question you are asking. A bus driving from Tashkent to Samarkand is a point on the map; the same bus reversing into a garage is not.

**A frame of reference** is a reference body, coordinate axes attached to it, and a clock. Without one, "where is the body?" has no answer.

**The trajectory** is the line a body traces out. **Distance travelled** is the length of that line, and it never decreases. **Displacement** is the vector drawn from the starting point to the finishing point.

### Example

Run one lap of a 400 m stadium track. The distance travelled is 400 m; the displacement is zero, because you came back to where you started.

In SI, length is measured in metres (m) and time in seconds (s).`,
    contentRu: `Механика изучает, как движутся тела и почему они движутся именно так.

**Материальная точка** — тело, размерами которого в данной задаче можно пренебречь. Автобус, едущий из Ташкента в Самарканд, — точка на карте; тот же автобус, заезжающий в гараж, — уже нет.

**Система отсчёта** — это тело отсчёта, связанные с ним координатные оси и часы. Без неё у вопроса «где находится тело?» нет ответа.

**Траектория** — линия, которую описывает тело. **Путь** — длина этой линии, и он никогда не уменьшается. **Перемещение** — вектор, проведённый из начальной точки в конечную.

### Пример

Пробегите один круг по 400-метровой дорожке стадиона. Путь равен 400 м, а перемещение равно нулю — вы вернулись туда, откуда стартовали.

В СИ длина измеряется в метрах (м), время — в секундах (с).`,
  },

  'physics-kinematics-straight-line-uniform-motion': {
    name: "To'g'ri chiziqli tekis harakat",
    nameEn: 'Straight-line uniform motion',
    nameRu: 'Прямолинейное равномерное движение',
    content: `Jism to'g'ri chiziq bo'ylab harakatlanib, ixtiyoriy teng vaqt oraliqlarida teng yo'llarni bosib o'tsa, bu **to'g'ri chiziqli tekis harakat** deyiladi. Bunda tezlik o'zgarmaydi.

Tezlik — bir sekundda bosib o'tilgan yo'l:

**v = s / t**, demak **s = v · t**

Koordinata vaqtga chiziqli bog'lanadi:

**x = x₀ + v · t**, bu yerda x₀ — boshlang'ich koordinata.

### Misol

Poyezd 72 km/soat tezlik bilan ketmoqda. 72 km/soat = 72 000 m / 3600 s = **20 m/s**. 30 sekundda u 20 · 30 = **600 m** yo'l bosadi.

km/soat ni m/s ga aylantirish uchun 3,6 ga bo'ling; teskarisiga o'tish uchun 3,6 ga ko'paytiring.`,
    contentEn: `A body moves in **straight-line uniform motion** when it travels along a straight line and covers equal distances in any equal intervals of time. Its velocity does not change.

Velocity is the distance covered in one second:

**v = s / t**, and therefore **s = v · t**

The coordinate depends on time linearly:

**x = x₀ + v · t**, where x₀ is the starting coordinate.

### Example

A train travels at 72 km/h. That is 72 000 m / 3600 s = **20 m/s**. In 30 seconds it covers 20 · 30 = **600 m**.

To convert km/h into m/s, divide by 3.6; to go back the other way, multiply by 3.6.`,
    contentRu: `Тело движется **прямолинейно и равномерно**, если оно движется по прямой и за любые равные промежутки времени проходит равные пути. Скорость при этом не меняется.

Скорость — это путь, пройденный за одну секунду:

**v = s / t**, а значит **s = v · t**

Координата зависит от времени линейно:

**x = x₀ + v · t**, где x₀ — начальная координата.

### Пример

Поезд идёт со скоростью 72 км/ч. Это 72 000 м / 3600 с = **20 м/с**. За 30 секунд он пройдёт 20 · 30 = **600 м**.

Чтобы перевести км/ч в м/с, разделите на 3,6; обратно — умножьте на 3,6.`,
  },

  'physics-kinematics-graphical-representation-of-straight-line-uniform-motion': {
    name: "To'g'ri chiziqli tekis harakatning grafik tasviri",
    nameEn: 'Graphical representation of straight-line uniform motion',
    nameRu: 'Графическое представление прямолинейного равномерного движения',
    content: `Tekis harakatni ikki xil grafik bilan tasvirlash mumkin.

**Koordinata grafigi (x–t).** Bu to'g'ri chiziq. Chiziq qanchalik tik bo'lsa, tezlik shunchalik katta. Pastga qarab tushayotgan chiziq jism o'qning teskari tomoniga ketayotganini, gorizontal chiziq esa jism tinch turganini bildiradi.

**Tezlik grafigi (v–t).** Bu gorizontal chiziq, chunki tezlik o'zgarmaydi. Grafik ostidagi to'rtburchakning yuzi — ko'chishga teng.

### Misol

x–t grafigida chiziq t = 0 da x = 10 m nuqtadan boshlanib, t = 8 s da x = 50 m ga yetadi.

Tezlik: v = (50 − 10) / 8 = **5 m/s**.

O'sha harakatning v–t grafigi 5 m/s balandlikdagi gorizontal chiziq. Uning ostidagi yuza: 5 · 8 = **40 m** — bu x ning 10 dan 50 gacha o'zgarishi bilan bir xil.`,
    contentEn: `Uniform motion can be drawn in two ways.

**The position graph (x–t)** is a straight line. The steeper the line, the greater the speed. A line sloping downwards means the body is moving in the negative direction of the axis; a horizontal line means it is at rest.

**The velocity graph (v–t)** is a horizontal line, because the velocity does not change. The area of the rectangle under it equals the displacement.

### Example

On an x–t graph a line starts at x = 10 m when t = 0 and reaches x = 50 m at t = 8 s.

The velocity is v = (50 − 10) / 8 = **5 m/s**.

The v–t graph of the same motion is a horizontal line at 5 m/s. The area under it is 5 · 8 = **40 m** — the same as the change in x from 10 m to 50 m.`,
    contentRu: `Равномерное движение можно изобразить двумя графиками.

**График координаты (x–t)** — прямая линия. Чем круче линия, тем больше скорость. Линия, идущая вниз, означает движение против направления оси, а горизонтальная линия — что тело покоится.

**График скорости (v–t)** — горизонтальная линия, ведь скорость не меняется. Площадь прямоугольника под ней равна перемещению.

### Пример

На графике x–t линия начинается в точке x = 10 м при t = 0 и приходит в x = 50 м при t = 8 с.

Скорость: v = (50 − 10) / 8 = **5 м/с**.

График v–t того же движения — горизонтальная линия на уровне 5 м/с. Площадь под ней: 5 · 8 = **40 м** — столько же, на сколько изменилась координата.`,
  },

  'physics-kinematics-relativity-of-motion': {
    name: 'Harakatning nisbiyligi',
    nameEn: 'Relativity of motion',
    nameRu: 'Относительность движения',
    content: `"Jism harakatlanmoqda" degan gap qaysi sanoq sistemasiga nisbatan aytilgani ko'rsatilmasa, tugallanmagan bo'ladi.

Vagonda o'tirgan yo'lovchi vagonga nisbatan tinch turadi, perronga nisbatan esa poyezd tezligi bilan harakatlanadi. Ikkala javob ham to'g'ri, chunki ular boshqa-boshqa sanoq sistemalarida berilgan.

Tezliklar qo'shiladi:

**v(yer) = v(vagon) + v(vagonga nisbatan)** — vektor sifatida.

### Misol

Poyezd perronga nisbatan 20 m/s tezlik bilan ketmoqda. Yo'lovchi vagon ichida 1 m/s tezlik bilan yuradi.

Poyezd yo'nalishi bo'yicha yursa, perronga nisbatan tezligi 20 + 1 = **21 m/s**. Orqaga qarab yursa, 20 − 1 = **19 m/s**.

Yo'l va trayektoriya ham nisbiy: yo'lovchi uchun tushgan tanga to'g'ri chiziq bo'ylab tushadi, perronda turgan odam esa uning egri chiziq chizganini ko'radi.`,
    contentEn: `Saying "the body is moving" is unfinished until you say which frame of reference you mean.

A passenger sitting in a carriage is at rest relative to the carriage, and moving at the train's speed relative to the platform. Both answers are correct, because they are answers in different frames.

Velocities add:

**v(ground) = v(train) + v(relative to the train)** — as vectors.

### Example

A train moves at 20 m/s relative to the platform. A passenger walks inside it at 1 m/s.

Walking towards the front, their speed relative to the platform is 20 + 1 = **21 m/s**. Walking towards the back, it is 20 − 1 = **19 m/s**.

Distance and trajectory are relative too: a dropped coin falls in a straight line for the passenger, while somebody on the platform sees it trace a curve.`,
    contentRu: `Фраза «тело движется» не закончена, пока не сказано, относительно какой системы отсчёта.

Пассажир, сидящий в вагоне, покоится относительно вагона и движется со скоростью поезда относительно платформы. Оба ответа верны — просто они даны в разных системах отсчёта.

Скорости складываются:

**v(земля) = v(поезд) + v(относительно поезда)** — как векторы.

### Пример

Поезд движется относительно платформы со скоростью 20 м/с. Пассажир идёт внутри вагона со скоростью 1 м/с.

Если он идёт по ходу поезда, его скорость относительно платформы 20 + 1 = **21 м/с**. Если против хода — 20 − 1 = **19 м/с**.

Путь и траектория тоже относительны: для пассажира выпавшая монета падает по прямой, а стоящий на платформе увидит, что она описала кривую.`,
  },

  'physics-kinematics-non-uniform-motion': {
    name: 'Notekis harakat',
    nameEn: 'Non-uniform motion',
    nameRu: 'Неравномерное движение',
    content: `Haqiqiy harakatda tezlik doim o'zgarib turadi: avtobus bekatdan qo'zg'aladi, tezlashadi, svetoforda to'xtaydi. Bunday harakat **notekis harakat** deyiladi.

**O'rtacha tezlik** — butun yo'lni butun vaqtga bo'lgan nisbat:

**v(o'rtacha) = s(umumiy) / t(umumiy)**

Bu tezliklarning o'rta arifmetigi **emas** — vaqtlar har xil bo'lsa, javob ham boshqacha chiqadi.

**Oniy tezlik** — ma'lum bir paytdagi tezlik. Avtomobil spidometri aynan shuni ko'rsatadi.

### Misol

Avtomobil dastlabki 100 km ni 50 km/soat bilan (2 soat), keyingi 100 km ni 100 km/soat bilan (1 soat) bosib o'tdi.

O'rtacha tezlik = 200 km / 3 soat ≈ **66,7 km/soat**, 75 km/soat emas.`,
    contentEn: `In real motion the speed keeps changing: a bus pulls away from a stop, speeds up, and halts at a traffic light. Motion like this is called **non-uniform motion**.

**Average speed** is the whole distance divided by the whole time:

**v(average) = s(total) / t(total)**

It is **not** the arithmetic mean of the speeds — when the times spent at each speed differ, the two give different answers.

**Instantaneous speed** is the speed at one particular moment. That is what a car's speedometer shows.

### Example

A car covers the first 100 km at 50 km/h (2 hours) and the next 100 km at 100 km/h (1 hour).

Average speed = 200 km / 3 h ≈ **66.7 km/h**, not 75 km/h.`,
    contentRu: `В реальном движении скорость всё время меняется: автобус трогается с остановки, разгоняется, тормозит на светофоре. Такое движение называют **неравномерным**.

**Средняя скорость** — это весь путь, делённый на всё время:

**v(средняя) = s(общий) / t(общее)**

Это **не** среднее арифметическое скоростей: если время движения с каждой скоростью разное, ответы получаются разными.

**Мгновенная скорость** — скорость в конкретный момент. Именно её показывает спидометр автомобиля.

### Пример

Автомобиль проехал первые 100 км со скоростью 50 км/ч (2 часа), а следующие 100 км — со скоростью 100 км/ч (1 час).

Средняя скорость = 200 км / 3 ч ≈ **66,7 км/ч**, а вовсе не 75 км/ч.`,
  },

  'physics-kinematics-uniformly-accelerated-motion-acceleration-instantaneous-velocity': {
    name: 'Tekis tezlanuvchan harakat. Tezlanish. Oniy tezlik',
    nameEn: 'Uniformly accelerated motion. Acceleration. Instantaneous velocity',
    nameRu: 'Равноускоренное движение. Ускорение. Мгновенная скорость',
    content: `**Tezlanish** — tezlikning bir sekundda qanchaga o'zgarishini ko'rsatadi:

**a = (v − v₀) / t**

O'lchov birligi — m/s². Tezlanish o'zgarmas bo'lsa, harakat **tekis tezlanuvchan** deyiladi va istalgan paytdagi tezlik quyidagicha topiladi:

**v = v₀ + a · t**

Tezlanish tezlikka qarama-qarshi yo'nalgan bo'lsa, jism sekinlashadi; tanlangan o'qda a manfiy chiqadi.

### Misol

Avtomobil joyidan qo'zg'alib, 8 sekundda 20 m/s tezlikka erishdi.

a = (20 − 0) / 8 = **2,5 m/s²**

3-sekundda uning oniy tezligi: v = 0 + 2,5 · 3 = **7,5 m/s**.

Erga yaqin joyda erkin tushayotgan jismning tezlanishi taxminan **9,8 m/s²** ga teng.`,
    contentEn: `**Acceleration** says how much the velocity changes in one second:

**a = (v − v₀) / t**

Its unit is m/s². When the acceleration stays constant the motion is called **uniformly accelerated**, and the velocity at any moment is

**v = v₀ + a · t**

If the acceleration points against the velocity, the body slows down, and a comes out negative along the chosen axis.

### Example

A car starts from rest and reaches 20 m/s in 8 seconds.

a = (20 − 0) / 8 = **2.5 m/s²**

Its instantaneous velocity at the 3rd second is v = 0 + 2.5 · 3 = **7.5 m/s**.

A body falling freely near the Earth's surface has an acceleration of about **9.8 m/s²**.`,
    contentRu: `**Ускорение** показывает, на сколько меняется скорость за одну секунду:

**a = (v − v₀) / t**

Единица измерения — м/с². Если ускорение постоянно, движение называют **равноускоренным**, и скорость в любой момент равна

**v = v₀ + a · t**

Если ускорение направлено против скорости, тело замедляется, и вдоль выбранной оси a получается отрицательным.

### Пример

Автомобиль трогается с места и за 8 секунд разгоняется до 20 м/с.

a = (20 − 0) / 8 = **2,5 м/с²**

Его мгновенная скорость на 3-й секунде: v = 0 + 2,5 · 3 = **7,5 м/с**.

У тела, свободно падающего вблизи поверхности Земли, ускорение примерно **9,8 м/с²**.`,
  },

  'physics-kinematics-displacement-in-uniformly-accelerated-motion': {
    name: "Tekis tezlanuvchan harakatda ko'chish",
    nameEn: 'Displacement in uniformly accelerated motion',
    nameRu: 'Перемещение при равноускоренном движении',
    content: `Tezlik o'zgarib turgani uchun ko'chishni **s = v · t** bilan hisoblab bo'lmaydi. Buning o'rniga:

**s = v₀ · t + a · t² / 2**

Vaqt noma'lum bo'lsa, ikkinchi formula qulay:

**s = (v² − v₀²) / (2a)**

Uchinchi yo'l — o'rtacha tezlik orqali, chunki tezlik bir tekis o'zgaradi:

**s = ((v₀ + v) / 2) · t**

### Misol

Avtomobil joyidan qo'zg'alib, a = 2 m/s² tezlanish bilan 6 sekund harakatlandi.

s = 0 + 2 · 6² / 2 = **36 m**

6-sekunddagi tezligi v = 0 + 2 · 6 = 12 m/s. Uchinchi formula bilan tekshiramiz: ((0 + 12) / 2) · 6 = 36 m — javob bir xil.`,
    contentEn: `Because the velocity keeps changing, **s = v · t** cannot be used here. Instead:

**s = v₀ · t + a · t² / 2**

When the time is unknown, the second formula is the convenient one:

**s = (v² − v₀²) / (2a)**

A third route is the average velocity, which works because the velocity changes at a steady rate:

**s = ((v₀ + v) / 2) · t**

### Example

A car starts from rest and travels for 6 seconds at an acceleration of a = 2 m/s².

s = 0 + 2 · 6² / 2 = **36 m**

Its velocity at 6 s is v = 0 + 2 · 6 = 12 m/s. Checking with the third formula: ((0 + 12) / 2) · 6 = 36 m — the same answer.`,
    contentRu: `Скорость всё время меняется, поэтому формула **s = v · t** здесь не годится. Вместо неё:

**s = v₀ · t + a · t² / 2**

Если время неизвестно, удобнее вторая формула:

**s = (v² − v₀²) / (2a)**

Третий путь — через среднюю скорость, ведь скорость меняется равномерно:

**s = ((v₀ + v) / 2) · t**

### Пример

Автомобиль трогается с места и движется 6 секунд с ускорением a = 2 м/с².

s = 0 + 2 · 6² / 2 = **36 м**

Скорость на 6-й секунде: v = 0 + 2 · 6 = 12 м/с. Проверим третьей формулой: ((0 + 12) / 2) · 6 = 36 м — ответ тот же.`,
  },

  'physics-kinematics-motion-of-two-bodies': {
    name: 'Ikki jismning harakati',
    nameEn: 'Motion of two bodies',
    nameRu: 'Движение двух тел',
    content: `Ikki jism haqidagi masalani ikki xil yo'l bilan yechish mumkin.

**Birinchi yo'l — bitta sanoq sistemasi.** Har biri uchun koordinata tenglamasini yozing va ularni tenglashtiring:

**x₁ = x₀₁ + v₁ · t** va **x₂ = x₀₂ + v₂ · t**, uchrashuvda **x₁ = x₂**.

**Ikkinchi yo'l — nisbiy tezlik.** Jismlar bir-biriga qarab kelsa, yaqinlashish tezligi v₁ + v₂; bir tomonga ketsa, orani yopish tezligi v₁ − v₂ ga teng.

### Misol

Ikki velosipedchi orasidagi masofa 300 m. Ular bir-biriga qarab 5 m/s va 7 m/s tezlik bilan yo'lga chiqdi.

Yaqinlashish tezligi 5 + 7 = 12 m/s, demak ular 300 / 12 = **25 sekunddan keyin** uchrashadi.

Agar avtomobil 25 m/s bilan yurayotgan yuk mashinasini (15 m/s) quvsa, unga nisbatan tezligi atigi 10 m/s bo'ladi — shuning uchun quvib o'tish uzoq davom etadi.`,
    contentEn: `A problem about two bodies can be solved in two ways.

**The first way — one frame of reference.** Write a coordinate equation for each body and set them equal:

**x₁ = x₀₁ + v₁ · t** and **x₂ = x₀₂ + v₂ · t**; at the meeting point **x₁ = x₂**.

**The second way — relative velocity.** If the bodies move towards each other, the gap closes at v₁ + v₂; if they move the same way, it closes at v₁ − v₂.

### Example

Two cyclists are 300 m apart and ride towards each other at 5 m/s and 7 m/s.

The gap closes at 5 + 7 = 12 m/s, so they meet after 300 / 12 = **25 seconds**.

If a car at 25 m/s is overtaking a lorry at 15 m/s, its speed relative to the lorry is only 10 m/s — which is why overtaking takes so long.`,
    contentRu: `Задачу о двух телах можно решить двумя способами.

**Первый способ — одна система отсчёта.** Запишите уравнение координаты для каждого тела и приравняйте их:

**x₁ = x₀₁ + v₁ · t** и **x₂ = x₀₂ + v₂ · t**; в момент встречи **x₁ = x₂**.

**Второй способ — относительная скорость.** Если тела движутся навстречу, расстояние сокращается со скоростью v₁ + v₂; если в одну сторону — со скоростью v₁ − v₂.

### Пример

Два велосипедиста находятся на расстоянии 300 м и едут навстречу друг другу со скоростями 5 м/с и 7 м/с.

Расстояние сокращается со скоростью 5 + 7 = 12 м/с, значит они встретятся через 300 / 12 = **25 секунд**.

А если автомобиль со скоростью 25 м/с обгоняет грузовик, идущий со скоростью 15 м/с, то относительно грузовика он движется всего со скоростью 10 м/с — поэтому обгон и длится так долго.`,
  },

  'physics-kinematics-graphical-representation-of-uniformly-accelerated-motion': {
    name: "Tekis tezlanuvchan harakatning grafik tasviri",
    nameEn: 'Graphical representation of uniformly accelerated motion',
    nameRu: 'Графическое представление равноускоренного движения',
    content: `**Tezlik grafigi (v–t)** — qiya to'g'ri chiziq. Chiziqning qiyaligi tezlanishga teng: ko'tarilsa jism tezlashadi, tushsa sekinlashadi.

**Grafik ostidagi yuza — ko'chish.** Bu qoida har qanday v–t grafigi uchun o'rinli.

**Koordinata grafigi (x–t)** endi to'g'ri chiziq emas, parabola bo'ladi, chunki x tenglamasida t² bor.

### Misol

v–t grafigidagi chiziq nol nuqtadan boshlanib, 6 sekundda 12 m/s ga yetadi.

Tezlanish — chiziqning qiyaligi: 12 / 6 = **2 m/s²**.

Ko'chish — chiziq ostidagi uchburchakning yuzi: (6 · 12) / 2 = **36 m**.

Bu oldingi darsdagi formula bergan javobning aynan o'zi: s = v₀t + at²/2 = 0 + 2 · 36 / 2 = 36 m.`,
    contentEn: `**The velocity graph (v–t)** is a sloping straight line. Its slope is the acceleration: rising means the body is speeding up, falling means it is slowing down.

**The area under the graph is the displacement.** That rule holds for any v–t graph.

**The position graph (x–t)** is no longer a straight line but a parabola, because the equation for x contains t².

### Example

A line on a v–t graph starts at zero and reaches 12 m/s after 6 seconds.

The acceleration is the slope of the line: 12 / 6 = **2 m/s²**.

The displacement is the area of the triangle under it: (6 · 12) / 2 = **36 m**.

That is exactly what the formula in the previous lesson gave: s = v₀t + at²/2 = 0 + 2 · 36 / 2 = 36 m.`,
    contentRu: `**График скорости (v–t)** — наклонная прямая. Её наклон равен ускорению: линия идёт вверх — тело разгоняется, вниз — тормозит.

**Площадь под графиком равна перемещению.** Это правило верно для любого графика v–t.

**График координаты (x–t)** здесь уже не прямая, а парабола, потому что в уравнении для x есть t².

### Пример

Линия на графике v–t начинается от нуля и через 6 секунд доходит до 12 м/с.

Ускорение — это наклон линии: 12 / 6 = **2 м/с²**.

Перемещение — площадь треугольника под ней: (6 · 12) / 2 = **36 м**.

Ровно столько же дала формула из прошлого урока: s = v₀t + at²/2 = 0 + 2 · 36 / 2 = 36 м.`,
  },

  'physics-kinematics-curvilinear-motion': {
    name: 'Egri chiziqli harakat',
    nameEn: 'Curvilinear motion',
    nameRu: 'Криволинейное движение',
    content: `Trayektoriyasi to'g'ri chiziq bo'lmasa, harakat **egri chiziqli** deyiladi: burilishdagi avtomobil, orbitadagi sun'iy yo'ldosh, otilgan tosh.

Eng muhim qoida: **tezlik har doim trayektoriyaga urinma bo'ylab yo'nalgan.** Shuning uchun jilvir toshdan uchgan uchqunlar aylana bo'ylab emas, to'g'ri chiziq bo'ylab uchadi.

Tezlikning qiymati o'zgarmasa ham, uning **yo'nalishi** o'zgaradi — demak tezlanish bor. Aylana bo'ylab tekis harakatda bu tezlanish aylana markaziga qarab yo'naladi va **markazga intilma tezlanish** deyiladi:

**a = v² / R**

### Misol

Avtomobil 10 m/s tezlik bilan radiusi 50 m bo'lgan burilishdan o'tmoqda.

a = 10² / 50 = **2 m/s²**

Spidometr o'zgarmagani bilan avtomobil tezlanish bilan harakatlanmoqda — buni burilishda sizni chetga tortayotgan kuch sifatida sezasiz.`,
    contentEn: `Motion is **curvilinear** when the trajectory is not a straight line: a car going round a bend, a satellite in orbit, a thrown stone.

The rule that matters most: **velocity always points along the tangent to the trajectory.** That is why sparks leaving a grinding wheel fly off in straight lines rather than curving with the wheel.

Even when the size of the velocity does not change, its **direction** does — so there is an acceleration. In uniform motion round a circle that acceleration points at the centre of the circle and is called **centripetal acceleration**:

**a = v² / R**

### Example

A car goes round a bend of radius 50 m at 10 m/s.

a = 10² / 50 = **2 m/s²**

The speedometer reading never changes, yet the car is accelerating — and you feel it as the push towards the side of your seat.`,
    contentRu: `Движение называют **криволинейным**, когда траектория не является прямой: автомобиль на повороте, спутник на орбите, брошенный камень.

Самое важное правило: **скорость всегда направлена по касательной к траектории.** Именно поэтому искры, слетающие с точильного круга, летят по прямой, а не по окружности.

Даже если величина скорости не меняется, меняется её **направление** — значит, есть ускорение. При равномерном движении по окружности это ускорение направлено к центру окружности и называется **центростремительным**:

**a = v² / R**

### Пример

Автомобиль проходит поворот радиусом 50 м со скоростью 10 м/с.

a = 10² / 50 = **2 м/с²**

Спидометр показывает одно и то же, но автомобиль движется с ускорением — вы чувствуете это как силу, прижимающую вас к боку сиденья.`,
  },
};
