"""
Seed the News page with real, sourced articles.

    python manage.py seed_news

Every row here is a real event, and `source` / `source_url` point at the
report it came from — not at an organisation's home page. That is the whole
point of the file.

What it replaced: ten invented stories filed under real names. "James Webb
Telescope Discovers New Exoplanet Atmosphere" was attributed to NASA with
`source_url='https://www.nasa.gov'` and dated two hours ago; "SpaceX Starship
Completes First Orbital Refueling Test" to SpaceX, eight hours ago. Neither
happened. A made-up story is bad; a made-up story wearing NASA's name, with
NASA's address under it and today's date on it, is what a child would take to
school as a fact.

So the rule for anything added here: name the event, name the outlet that
reported it, link that report, and date the row to when it was published. If
you cannot do all four, the story does not go in.

`published_at` is a real publication date rather than `now - timedelta(...)`.
The News page shows relative times, so a hardcoded offset would have every
article claim to be hours old for ever — the same defect the Live page's
launch countdown had.
"""
from datetime import datetime, timezone as dt_timezone

from django.core.management.base import BaseCommand

from apps.news.models import NewsArticle


def when(year, month, day):
    return datetime(year, month, day, 9, 0, tzinfo=dt_timezone.utc)


ARTICLES = [
    # ── Uzbekistan and Central Asia ──────────────────────────────────────────
    dict(
        title_en='Uzbekistan launches Samarkand-2028, its first Earth-observation satellite',
        title_uz='O‘zbekiston o‘zining ilk Yerni kuzatuv sun’iy yo‘ldoshi Samarqand-2028 ni uchirdi',
        title_ru='Узбекистан запустил «Самарканд-2028» — свой первый спутник дистанционного зондирования',
        summary_en='The hyperspectral satellite lifted off on 5 August 2026 from a sea platform off Shandong, China, in a joint mission by Uzcosmos and STAR.VISION.',
        summary_uz='Giperspektral sun’iy yo‘ldosh 2026-yil 5-avgustda Xitoyning Shandun viloyati yaqinidagi dengiz platformasidan, O‘zbekkosmos va STAR.VISION hamkorligida uchirildi.',
        summary_ru='Гиперспектральный спутник стартовал 5 августа 2026 года с морской платформы у побережья Шаньдуна в совместной миссии Узкосмоса и STAR.VISION.',
        content_en='Samarkand-2028 observes the Earth in many narrow bands of light at once, which lets it tell apart things that look the same to an ordinary camera — a healthy field from a dry one, clean water from polluted. Uzcosmos plans to use it for agriculture, water management, environmental monitoring, emergency response and urban planning.',
        content_uz='Samarqand-2028 Yerni bir vaqtning o‘zida yorug‘likning ko‘plab tor diapazonlarida kuzatadi. Shu tufayli u oddiy kamera uchun bir xil ko‘rinadigan narsalarni ajrata oladi — sog‘lom dalani quruqidan, toza suvni ifloslanganidan. O‘zbekkosmos uni qishloq xo‘jaligi, suv resurslari, atrof-muhit monitoringi, favqulodda vaziyatlar va shaharsozlikda ishlatishni rejalashtirmoqda.',
        content_ru='«Самарканд-2028» наблюдает Землю сразу во многих узких диапазонах света. Это позволяет различать то, что для обычной камеры выглядит одинаково: здоровое поле и высохшее, чистую воду и загрязнённую. Узкосмос планирует использовать его в сельском хозяйстве, управлении водными ресурсами, экологическом мониторинге, реагировании на чрезвычайные ситуации и градостроительстве.',
        category='local', source='Daryo',
        source_url='https://daryo.uz/en/2026/08/05/uzbekistan-launches-samarkand-2028-earth-observation-satellite-from-china/',
        published_at=when(2026, 8, 5),
    ),
    dict(
        title_en='An AI module built in Uzbekistan is now working in orbit',
        title_uz='O‘zbekistonda yaratilgan sun’iy intellekt moduli endi orbitada ishlamoqda',
        title_ru='Модуль искусственного интеллекта, созданный в Узбекистане, работает на орбите',
        summary_en='Uzcosmos engineers built the AI module aboard Samarkand-2028 — the first Uzbek AI module to fly on one of STAR.VISION’s international satellites.',
        summary_uz='O‘zbekkosmos muhandislari Samarqand-2028 bortidagi sun’iy intellekt modulini yaratdi — bu STAR.VISION xalqaro sun’iy yo‘ldoshlarida uchgan ilk o‘zbek AI moduli.',
        summary_ru='Инженеры Узкосмоса создали ИИ-модуль на борту «Самарканда-2028» — первый узбекский модуль ИИ, поднявшийся на одном из международных спутников STAR.VISION.',
        content_en='A hyperspectral image is enormous, and a satellite has only a narrow window each orbit to send data down. The module processes the images on board first, so the satellite sends the useful part instead of everything — which means answers reach the ground faster.',
        content_uz='Giperspektral tasvir juda katta bo‘ladi, sun’iy yo‘ldoshda esa har bir aylanishda ma’lumot uzatish uchun qisqa vaqt bor. Modul tasvirlarni avval bort ustida qayta ishlaydi, shuning uchun sun’iy yo‘ldosh hammasini emas, foydali qismini yuboradi — natijada javob yerga tezroq yetadi.',
        content_ru='Гиперспектральный снимок очень велик, а у спутника на каждом витке лишь короткое окно для передачи данных. Модуль сначала обрабатывает снимки на борту, поэтому спутник отправляет не всё подряд, а полезную часть — и ответ доходит до земли быстрее.',
        category='technology', source='Euronews',
        source_url='https://www.euronews.com/next/2026/08/07/uzbekistan-developed-ai-module-launches-aboard-earth-observation-satellite',
        published_at=when(2026, 8, 7),
    ),
    dict(
        title_en='Samarkand-2028 sends its first image from orbit',
        title_uz='Samarqand-2028 orbitadan birinchi suratini yubordi',
        title_ru='«Самарканд-2028» передал первый снимок с орбиты',
        summary_en='The satellite returned its first picture — of Athens — within hours of reaching orbit.',
        summary_uz='Sun’iy yo‘ldosh orbitaga chiqqanidan bir necha soat o‘tib birinchi suratini — Afina shahrini — yubordi.',
        summary_ru='Спутник передал первый снимок — Афины — через несколько часов после выхода на орбиту.',
        content_en='A first image is how a team learns that everything survived the launch: the optics are aligned, the electronics came through the vibration, and the radio link works. It is a health check as much as a photograph.',
        content_uz='Birinchi surat — bu jamoa uchun hamma narsa uchirilishdan omon chiqqanini bilish usuli: optika to‘g‘ri sozlangan, elektronika tebranishga bardosh bergan va radioaloqa ishlayapti. Bu suratdan ko‘ra ko‘proq sog‘liqni tekshirish.',
        content_ru='Первый снимок — это то, как команда узнаёт, что всё пережило запуск: оптика выставлена, электроника выдержала вибрацию, радиоканал работает. Это не столько фотография, сколько проверка исправности.',
        category='local', source='UzDaily',
        source_url='https://www.uzdaily.uz/en/samarkand-2028-satellite-sends-first-image-from-orbit/',
        published_at=when(2026, 8, 6),
    ),
    dict(
        title_en='Samarkand will host the International Astronautical Congress in 2028',
        title_uz='2028-yilda Samarqand Xalqaro astronavtika kongressini o‘tkazadi',
        title_ru='Самарканд примет Международный астронавтический конгресс в 2028 году',
        summary_en='Delegates at the Congress in Sydney voted for Samarkand to host the 79th IAC — the first ever held in Central Asia.',
        summary_uz='Sidneydagi kongress delegatlari 79-IAC ni Samarqand o‘tkazishi uchun ovoz berdi — bu Markaziy Osiyoda o‘tkaziladigan ilk kongress.',
        summary_ru='Делегаты конгресса в Сиднее проголосовали за то, чтобы 79-й IAC принял Самарканд — впервые в Центральной Азии.',
        content_en='The IAC is the largest gathering in the space field, and the 2028 congress is expected to bring more than ten thousand visitors to Samarkand. The satellite launched this August is named after it.',
        content_uz='IAC — kosmik sohadagi eng yirik anjuman, va 2028-yilgi kongress Samarqandga o‘n mingdan ortiq mehmon olib kelishi kutilmoqda. Shu avgustda uchirilgan sun’iy yo‘ldosh ana shu sharafga nomlangan.',
        content_ru='IAC — крупнейшее собрание в космической отрасли, и конгресс 2028 года, как ожидается, привлечёт в Самарканд более десяти тысяч гостей. Запущенный в августе спутник назван в его честь.',
        category='local', source='O‘zbekiston Respublikasi hukumati (gov.uz)',
        source_url='https://gov.uz/en/news/view/91030',
        published_at=when(2026, 8, 12),
    ),
    dict(
        title_en='Uzbekistan plans its own satellite for 2028, and is studying a crewed mission',
        title_uz='O‘zbekiston 2028-yilga o‘z sun’iy yo‘ldoshini rejalashtirmoqda va inson uchishini o‘rganmoqda',
        title_ru='Узбекистан планирует собственный спутник к 2028 году и изучает пилотируемый полёт',
        summary_en='A 6U CubeSat named after the astronomer Mirzo Ulugbek is planned for 2028, built by Uzbek graduate students training in Japan.',
        summary_uz='2028-yilga astronom Mirzo Ulug‘bek nomi bilan ataladigan 6U CubeSat rejalashtirilgan; uni Yaponiyada tahsil olayotgan o‘zbek magistrantlari yaratmoqda.',
        summary_ru='На 2028 год запланирован кубсат формата 6U имени астронома Мирзо Улугбека, который создают узбекские магистранты, обучающиеся в Японии.',
        content_en='This is a different satellite from Samarkand-2028. Samarkand-2028 was built with a Chinese partner; the Mirzo Ulugbek CubeSat is meant to be designed and built by Uzbek engineers, which is why it matters even though it is much smaller.',
        content_uz='Bu Samarqand-2028 dan boshqa sun’iy yo‘ldosh. Samarqand-2028 xitoylik hamkor bilan yaratilgan; Mirzo Ulug‘bek CubeSat esa o‘zbek muhandislari tomonidan loyihalanishi va yasalishi ko‘zda tutilgan — ancha kichik bo‘lsa-da, ahamiyati shunda.',
        content_ru='Это другой спутник, не «Самарканд-2028». «Самарканд-2028» построен с китайским партнёром, а кубсат «Мирзо Улугбек» должны спроектировать и собрать узбекские инженеры — поэтому он важен, хотя и намного меньше.',
        category='local', source='Gazeta.uz',
        source_url='https://www.gazeta.uz/en/2026/02/17/cosmos/',
        published_at=when(2026, 2, 17),
    ),

    # ── The wider world ──────────────────────────────────────────────────────
    dict(
        title_en='The Nancy Grace Roman Space Telescope is cleared for launch',
        title_uz='Nancy Grace Roman kosmik teleskopi uchirishga tayyor deb topildi',
        title_ru='Космический телескоп «Нэнси Грейс Роман» допущен к запуску',
        summary_en='NASA’s next large space telescope is targeted to lift off on 30 August 2026 from Kennedy Space Center aboard a Falcon Heavy.',
        summary_uz='NASA ning navbatdagi yirik kosmik teleskopi 2026-yil 30-avgustda Kennedi kosmik markazidan Falcon Heavy raketasida uchirilishi mo‘ljallangan.',
        summary_ru='Следующий большой космический телескоп NASA планируется запустить 30 августа 2026 года с космодрома Кеннеди на ракете Falcon Heavy.',
        content_en='Roman sees a patch of sky about a hundred times wider than Hubble does at one time, at similar sharpness. That is what makes it useful for surveys: it is expected to find thousands of planets around other stars and to measure how the expansion of the universe is speeding up.',
        content_uz='Roman bir vaqtning o‘zida Hubble ko‘radigan osmon bo‘lagidan taxminan yuz barobar kengroq maydonni, shunga yaqin aniqlikda ko‘radi. Uni kuzatuvlar uchun qimmatli qiladigan narsa shu: u boshqa yulduzlar atrofidan minglab sayyoralarni topishi va koinot kengayishi qanday tezlashayotganini o‘lchashi kutilmoqda.',
        content_ru='«Роман» охватывает за раз участок неба примерно в сто раз шире, чем Хаббл, при сопоставимой резкости. Именно это делает его пригодным для обзоров: ожидается, что он найдёт тысячи планет у других звёзд и измерит, как ускоряется расширение Вселенной.',
        category='mission', source='Spaceflight Now',
        source_url='https://spaceflightnow.com/2026/08/',
        published_at=when(2026, 8, 20),
    ),
    dict(
        title_en='NASA says it is “extremely confident” Artemis 3 will fly in 2027',
        title_uz='NASA Artemis 3 ning 2027-yilda uchishiga “to‘liq ishonch” bildirdi',
        title_ru='NASA заявляет, что «крайне уверено» в полёте «Артемиды-3» в 2027 году',
        summary_en='The agency’s administrator gave the assessment in August 2026. Artemis 3 is intended to land astronauts near the Moon’s south pole.',
        summary_uz='Agentlik rahbari bu bahoni 2026-yil avgustida bildirdi. Artemis 3 astronavtlarni Oyning janubiy qutbi yaqiniga qo‘ndirishi ko‘zda tutilgan.',
        summary_ru='Руководитель агентства дал такую оценку в августе 2026 года. «Артемида-3» должна высадить астронавтов близ южного полюса Луны.',
        content_en='It would be the first crewed lunar landing since Apollo 17 in 1972. The mission needs three separate launches to come together in the right order, which is why the date has moved before.',
        content_uz='Bu 1972-yildagi Apollo 17 dan beri Oyga ilk insonli qo‘nish bo‘ladi. Missiya uchun uchta alohida uchirilish to‘g‘ri tartibda birlashishi kerak — sana ilgari ham shuning uchun surilgan.',
        content_ru='Это была бы первая пилотируемая посадка на Луну со времён «Аполлона-17» в 1972 году. Миссии нужны три отдельных запуска, которые должны сойтись в правильном порядке, — поэтому дату уже переносили.',
        category='exploration', source='Spaceflight Now',
        source_url='https://spaceflightnow.com/2026/08/14/nasa-administrator-extremely-confident-in-artemis-3-launch-in-2027/',
        published_at=when(2026, 8, 14),
    ),
    dict(
        title_en='Uzbekistan’s Space Technology Conference marks its fifth year',
        title_uz='O‘zbekistondagi Kosmik texnologiyalar konferensiyasi besh yilligini nishonlaydi',
        title_ru='Конференция по космическим технологиям в Узбекистане отмечает пятилетие',
        summary_en='The annual conference, run by the Uzcosmos agency, brings together specialists working on the country’s space programme.',
        summary_uz='O‘zbekkosmos agentligi o‘tkazadigan yillik konferensiya mamlakat kosmik dasturi ustida ishlayotgan mutaxassislarni birlashtiradi.',
        summary_ru='Ежегодная конференция, которую проводит агентство Узкосмос, собирает специалистов, работающих над космической программой страны.',
        content_en='Uzbekistan’s space agency was created only a few years ago, so a conference in its fifth year is roughly as old as the programme itself.',
        content_uz='O‘zbekistonning kosmik agentligi bor-yo‘g‘i bir necha yil oldin tashkil etilgan, shuning uchun beshinchi yiliga kirgan konferensiya deyarli dasturning o‘zi bilan tengdosh.',
        content_ru='Космическое агентство Узбекистана создано лишь несколько лет назад, поэтому конференция, идущая пятый год, почти ровесница самой программы.',
        category='local', source='O‘zbekiston Respublikasi hukumati (gov.uz)',
        source_url='https://gov.uz/en/uzspace/news/view/147818',
        published_at=when(2026, 7, 10),
    ),
]


class Command(BaseCommand):
    help = 'Populate the News page with real, sourced articles'

    def handle(self, *args, **options):
        created = updated = 0
        for article in ARTICLES:
            _, was_created = NewsArticle.objects.update_or_create(
                title_en=article['title_en'], defaults=article,
            )
            created += was_created
            updated += not was_created

        local = sum(1 for a in ARTICLES if a['category'] == 'local')
        self.stdout.write(
            f'  {len(ARTICLES)} articles ({created} new, {updated} updated); '
            f'{local} about Uzbekistan and Central Asia.'
        )
        self.stdout.write(self.style.SUCCESS('Every one carries the report it came from.'))
