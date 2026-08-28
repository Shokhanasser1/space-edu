"""Create the satellites the Live page introduces by name.

Every row is written by hand and every factual claim in it has a source named
in `source_url`. Nothing here may be filled in from memory or inference — see
CONTRIBUTING.md rule AI-6, and the long note against Samarkand-2028 for the
case that made the rule matter.

Orbital elements are deliberately absent: `apps.space` fetches those from
CelesTrak and the page joins to them on `norad_id`. An element set written
into a seed file is stale the day after it is committed and has nothing to say
so — which is the bug this branch's first commit removed.

Idempotent. Run it as often as you like.

    python manage.py seed_satellites
"""
from django.core.management.base import BaseCommand

from apps.satellites.models import TrackedSatellite

# `launch_date` and `launch_site` on the catalogued rows are transcribed from
# CelesTrak's SATCAT bulk file (satcat.csv, fetched 28 August 2026), with the
# site codes expanded using CelesTrak's own launch-site table: TYMSC is
# Baikonur, AFETR Cape Canaveral, AFWTR Vandenberg, FRGUI Kourou, WSC
# Wenchang.
#
# `launch_vehicle` is empty on every row because SATCAT does not carry it and
# nothing here may be filled in from memory. On a catalogued satellite that
# blank means "nobody has sourced it for this page" — which is a different
# statement from Samarkand-2028's, where no source exists to find — so the card
# omits the row rather than printing "not announced yet" over the launch of a
# satellite that flew in 1990.
SATELLITES = [
    dict(
        slug='iss', catalog_name='ISS (ZARYA)', norad_id=25544,
        launch_date='1998-11-20',
        launch_site='Baikonur Cosmodrome, Kazakhstan',
        mission_type='station', operator='NASA / Roscosmos / ESA / JAXA / CSA',
        country='International', is_featured=True,
        name_en='International Space Station',
        name_uz='Xalqaro kosmik stansiya',
        name_ru='Международная космическая станция',
        description_en='A crewed laboratory in low Earth orbit, continuously '
                       'lived in since November 2000. It goes round the Earth '
                       'about once every 93 minutes.',
        description_uz='Past Yer orbitasidagi ekipajli laboratoriya, 2000-yil '
                       'noyabridan beri uzluksiz odam yashaydi. Yer atrofini '
                       'taxminan har 93 daqiqada bir marta aylanadi.',
        description_ru='Обитаемая лаборатория на низкой околоземной орбите, '
                       'непрерывно населённая с ноября 2000 года. Совершает '
                       'оборот вокруг Земли примерно за 93 минуты.',
        source_url='https://www.nasa.gov/international-space-station/',
        source_name='NASA',
    ),
    dict(
        slug='css-tianhe', catalog_name='CSS (TIANHE)', norad_id=48274,
        launch_date='2021-04-29',
        launch_site='Wenchang Satellite Launch Site, China',
        mission_type='station', operator='CMSA',
        country='China', is_featured=True,
        name_en='Tiangong space station (Tianhe core module)',
        name_uz='Tyangun kosmik stansiyasi (Tyanxe asosiy moduli)',
        name_ru='Космическая станция «Тяньгун» (базовый модуль «Тяньхэ»)',
        description_en="The core module of China's crewed space station. "
                       'Tianhe launched in 2021 and the station was later '
                       'completed with two laboratory modules.',
        description_uz='Xitoyning ekipajli kosmik stansiyasining asosiy moduli. '
                       'Tyanxe 2021-yilda uchirilgan, stansiya keyinchalik '
                       'ikkita laboratoriya moduli bilan yakunlangan.',
        description_ru='Базовый модуль китайской пилотируемой космической '
                       'станции. «Тяньхэ» запущен в 2021 году, станция позже '
                       'достроена двумя лабораторными модулями.',
        source_url='https://celestrak.org/satcat/search.php',
        source_name='CelesTrak SATCAT',
    ),
    dict(
        slug='hubble', catalog_name='HST', norad_id=20580,
        launch_date='1990-04-24',
        launch_site='Cape Canaveral, Florida, USA',
        mission_type='science', operator='NASA / ESA',
        country='United States', is_featured=True,
        name_en='Hubble Space Telescope',
        name_uz='Xabbl kosmik teleskopi',
        name_ru='Космический телескоп «Хаббл»',
        description_en='An optical and ultraviolet telescope above the '
                       'atmosphere, so its pictures are not blurred by the air '
                       'that telescopes on the ground have to look through.',
        description_uz='Atmosferadan yuqorida joylashgan optik va ultrabinafsha '
                       "teleskop — shu sababli uning tasvirlari yerdagi "
                       "teleskoplar qarashga majbur bo'lgan havo qatlamida "
                       'xiralashmaydi.',
        description_ru='Оптический и ультрафиолетовый телескоп за пределами '
                       'атмосферы: его снимки не размывает воздух, сквозь '
                       'который вынуждены смотреть наземные телескопы.',
        source_url='https://science.nasa.gov/mission/hubble/',
        source_name='NASA',
    ),
    dict(
        slug='landsat-9', catalog_name='LANDSAT 9', norad_id=49260,
        launch_date='2021-09-27',
        launch_site='Vandenberg, California, USA',
        mission_type='earth_obs', operator='NASA / USGS',
        country='United States',
        name_en='Landsat 9',
        name_uz='Landsat 9',
        name_ru='Landsat 9',
        description_en='Photographs the land surface in visible and infrared '
                       'light. The Landsat series is the longest unbroken '
                       "record of the Earth's surface taken from space.",
        description_uz="Yer yuzasini ko'rinuvchi va infraqizil nurda suratga "
                       "oladi. Landsat turkumi — kosmosdan olingan Yer "
                       "yuzasining eng uzoq uzluksiz kuzatuv yozuvi.",
        description_ru='Снимает поверхность суши в видимом и инфракрасном '
                       'диапазоне. Серия Landsat — самая длинная непрерывная '
                       'летопись поверхности Земли, снятая из космоса.',
        source_url='https://landsat.gsfc.nasa.gov/satellites/landsat-9/',
        source_name='NASA',
    ),
    dict(
        slug='sentinel-2a', catalog_name='SENTINEL-2A', norad_id=40697,
        launch_date='2015-06-23',
        launch_site='Kourou, French Guiana',
        mission_type='earth_obs', operator='ESA',
        country='European Union',
        name_en='Sentinel-2A',
        name_uz='Sentinel-2A',
        name_ru='Sentinel-2A',
        description_en='Part of the European Copernicus programme. Its '
                       'multispectral camera watches crops, forests and water '
                       '— the same kind of work Samarkand-2028 was built for.',
        description_uz='Yevropa Copernicus dasturining bir qismi. Uning '
                       'multispektral kamerasi ekinlar, o\'rmonlar va suvni '
                       "kuzatadi — Samarqand-2028 ham shunga o'xshash ish "
                       'uchun qurilgan.',
        description_ru='Часть европейской программы Copernicus. Его '
                       'мультиспектральная камера следит за посевами, лесами и '
                       'водой — та же работа, для которой построен '
                       '«Самарканд-2028».',
        source_url='https://sentinel.esa.int/copernicus/sentinel-2',
        source_name='ESA',
    ),
    dict(
        slug='sentinel-1a', catalog_name='SENTINEL-1A', norad_id=39634,
        launch_date='2014-04-03',
        launch_site='Kourou, French Guiana',
        mission_type='earth_obs', operator='ESA',
        country='European Union',
        name_en='Sentinel-1A',
        name_uz='Sentinel-1A',
        name_ru='Sentinel-1A',
        description_en='Carries radar instead of a camera, so it sees through '
                       'cloud and works at night. Used to watch floods, '
                       'ground movement and ice.',
        description_uz="Kamera o'rniga radar olib yuradi, shuning uchun bulut "
                       "ortidan ko'radi va kechasi ham ishlaydi. Suv toshqini, "
                       'yer siljishi va muzni kuzatishda ishlatiladi.',
        description_ru='Несёт радар вместо камеры, поэтому видит сквозь облака '
                       'и работает ночью. Используется для наблюдения за '
                       'наводнениями, смещением грунта и льдом.',
        source_url='https://sentinel.esa.int/copernicus/sentinel-1',
        source_name='ESA',
    ),
    dict(
        slug='terra', catalog_name='TERRA', norad_id=25994,
        launch_date='1999-12-18',
        launch_site='Vandenberg, California, USA',
        mission_type='earth_obs', operator='NASA',
        country='United States',
        name_en='Terra',
        name_uz='Terra',
        name_ru='Terra',
        description_en='Measures the land, the oceans and the atmosphere '
                       "together, to study how the Earth's climate system "
                       'fits together.',
        description_uz="Yer iqlim tizimining qanday bog'langanini o'rganish "
                       'uchun quruqlik, okean va atmosferani birgalikda '
                       "o'lchaydi.",
        description_ru='Измеряет сушу, океаны и атмосферу вместе, чтобы изучать, '
                       'как устроена климатическая система Земли.',
        source_url='https://terra.nasa.gov/',
        source_name='NASA',
    ),
    dict(
        slug='noaa-20', catalog_name='NOAA 20 (JPSS-1)', norad_id=43013,
        launch_date='2017-11-18',
        launch_site='Vandenberg, California, USA',
        mission_type='weather', operator='NOAA / NASA',
        country='United States',
        name_en='NOAA-20 (JPSS-1)',
        name_uz='NOAA-20 (JPSS-1)',
        name_ru='NOAA-20 (JPSS-1)',
        description_en='A weather satellite in a polar orbit, so the turning '
                       'Earth brings the whole planet underneath it twice a '
                       'day. Its measurements go into the forecasts.',
        description_uz="Qutb orbitasidagi ob-havo sun'iy yo'ldoshi: Yerning "
                       'aylanishi tufayli butun sayyora kuniga ikki marta '
                       "uning ostidan o'tadi. O'lchovlari bashoratlarga kiradi.",
        description_ru='Метеоспутник на полярной орбите: вращение Земли дважды '
                       'в сутки проводит под ним всю планету. Его измерения '
                       'ложатся в основу прогнозов погоды.',
        source_url='https://www.nesdis.noaa.gov/our-satellites/currently-flying/joint-polar-satellite-system/noaa-20',
        source_name='NOAA',
    ),
    dict(
        slug='goes-19', catalog_name='GOES 19', norad_id=60133,
        launch_date='2024-06-25',
        launch_site='Cape Canaveral, Florida, USA',
        mission_type='weather', operator='NOAA / NASA',
        country='United States',
        name_en='GOES-19',
        name_uz='GOES-19',
        name_ru='GOES-19',
        description_en='Sits over one point on the equator and photographs the '
                       'same face of the Earth every few minutes. That is '
                       'where animated storm maps come from.',
        description_uz='Ekvator ustidagi bir nuqtada turadi va Yerning ayni bir '
                       'yuzini bir necha daqiqada bir marta suratga oladi. '
                       "Harakatlanuvchi bo'ron xaritalari shundan olinadi.",
        description_ru='Висит над одной точкой экватора и снимает одну и ту же '
                       'сторону Земли каждые несколько минут. Отсюда берутся '
                       'анимированные карты штормов.',
        source_url='https://www.nesdis.noaa.gov/our-satellites/currently-flying/geostationary-satellites',
        source_name='NOAA',
    ),

    # ------------------------------------------------------------------
    # Samarkand-2028 — read this before editing the row below.
    #
    # CONFIRMED, from an Uzbek government release and four independent
    # outlets. It is **in orbit**, not planned: it launched on 5 August 2026,
    # so any copy calling it "upcoming" is wrong.
    #
    #   * launched 5 August 2026 from a sea-based platform off the coast of
    #     Shandong province, China, alongside the Indonesian Lampung-1;
    #   * a hyperspectral Earth-observation satellite, built as a joint
    #     STAR.VISION (China) and Uzbekcosmos (Uzbekistan) mission under a
    #     strategic memorandum signed in November 2025;
    #   * carries an artificial-intelligence module built by Uzbekcosmos
    #     specialists that processes hyperspectral data on board before it is
    #     sent down;
    #   * intended for agriculture, environmental protection, natural resource
    #     and water monitoring, emergency response and urban planning;
    #   * named for Samarkand hosting the 79th International Astronautical
    #     Congress in 2028, a decision taken at the IAC in Sydney;
    #   * returned its first image — of Athens — within hours of launch.
    #
    #   https://gov.uz/en/digital/news/view/201507   (Ministry of Digital
    #                                                 Technologies, 3 Aug 2026)
    #   https://digital.uz/en/news/view/202299       (same ministry, 5 Aug 2026)
    #   https://www.gazeta.uz/en/2026/08/04/samarkand-2028/
    #   https://www.uzdaily.uz/en/samarkand-2028-satellite-sends-first-image-from-orbit/
    #   https://www.euronews.com/next/2026/08/07/uzbekistan-developed-ai-module-launches-aboard-earth-observation-satellite
    #
    # NOT published by any Uzbek source, and therefore left empty. An empty
    # field renders as a translated "not announced yet", which is true; a
    # plausible-looking number would not be:
    #
    #   * the launch vehicle. Gunter's Space Page and NASASpaceflight both
    #     record a Jielong-3 (Smart Dragon-3) Y12 carrying two "Oriental Smart
    #     Eye" hyperspectral satellites that day, which is almost certainly
    #     this launch — but neither names Samarkand-2028, so the mapping is
    #     inference and it stays out. Confirm it and fill it in.
    #   * orbit type, altitude, inclination, period;
    #   * mass, ground resolution, design life, cost;
    #   * the number of spectral bands. Gazeta.uz's Uzbek text says "20 dan
    #     ortiq" — more than 20 — which is a floor, not a figure. Numbers
    #     circulating elsewhere (300 kg, 5 m, 22 bands, 400 TOPS) come from
    #     Chinese and Indonesian coverage of the shared satellite bus and of
    #     the twin Lampung-1, not from any Uzbek release. Do not attribute
    #     them to this satellite.
    #   * a catalogue number, and therefore any element set.
    #
    # On the missing catalogue number: CelesTrak's GP API returns "No GP data
    # found" for SAMARKAND, SAMARKAND-2028, STAR VISION and LAMPUNG, and its
    # SATCAT has no record under those names (checked 28 August 2026). The
    # three objects catalogued from launch 2026-178 are still unnamed and are
    # attributed to the PRC, so none of them can be claimed as this satellite.
    #
    # Do not solve this by inventing a TLE or by guessing which object it is.
    # A fabricated element set does not look like missing data — it looks like
    # a satellite, moving, in the wrong place, on a page children are told they
    # can trust. Leave `norad_id` empty; the page shows the mission and no dot,
    # which is exactly what we know. Fill the number in when one is published
    # and the globe picks it up on the next load.
    # ------------------------------------------------------------------
    dict(
        slug='samarkand-2028', catalog_name='SAMARKAND-2028', norad_id=None,
        mission_type='earth_obs',
        operator='Uzbekcosmos / STAR.VISION',
        country='Uzbekistan', is_featured=True,
        launch_date='2026-08-05',
        launch_site='Sea platform off Shandong, China',
        launch_vehicle='',   # not named by any Uzbek source — see above
        name_en='Samarkand-2028',
        name_uz='Samarqand-2028',
        name_ru='Самарканд-2028',
        description_en="Uzbekistan's hyperspectral Earth-observation "
                       'satellite, launched on 5 August 2026 in a joint '
                       "mission with China's STAR.VISION. It carries an "
                       'artificial-intelligence module built by Uzbekcosmos '
                       'specialists, which processes the hyperspectral data on '
                       'board before sending it down — for agriculture, '
                       'ecology, water monitoring and emergency response. It '
                       'is named for Samarkand hosting the International '
                       'Astronautical Congress in 2028, and it sent back its '
                       'first picture, of Athens, within hours of launch. Its '
                       'orbital elements have not been published, so this page '
                       'cannot yet show you where it is.',
        description_uz="O'zbekistonning giperspektral Yer kuzatuv sun'iy "
                       "yo'ldoshi, 2026-yil 5-avgustda Xitoyning STAR.VISION "
                       "kompaniyasi bilan qo'shma missiyada uchirilgan. Unda "
                       "O'zbekkosmos mutaxassislari yaratgan sun'iy intellekt "
                       "moduli bor: u giperspektral ma'lumotlarni Yerga "
                       'uzatishdan oldin bortda qayta ishlaydi — qishloq '
                       "xo'jaligi, ekologiya, suv resurslarini kuzatish va "
                       'favqulodda vaziyatlarga javob berish uchun. Nomi '
                       'Samarqand 2028-yilda Xalqaro astronavtika kongressini '
                       "o'tkazishi sharafiga berilgan. U uchirilgandan bir "
                       "necha soat o'tib Afina shahrining birinchi suratini "
                       "yubordi. Uning orbital elementlari e'lon qilinmagan, "
                       'shuning uchun bu sahifa hozircha uning qayerdaligini '
                       "ko'rsata olmaydi.",
        description_ru='Узбекский гиперспектральный спутник наблюдения Земли, '
                       'запущенный 5 августа 2026 года в совместной миссии с '
                       'китайской STAR.VISION. Он несёт модуль искусственного '
                       'интеллекта, созданный специалистами «Узбеккосмоса»: '
                       'модуль обрабатывает гиперспектральные данные прямо на '
                       'борту перед передачей на Землю — для сельского '
                       'хозяйства, экологии, мониторинга воды и реагирования '
                       'на чрезвычайные ситуации. Назван в честь проведения в '
                       'Самарканде Международного астронавтического конгресса '
                       'в 2028 году. Первый снимок — Афины — он прислал через '
                       'несколько часов после запуска. Его орбитальные '
                       'элементы не опубликованы, поэтому эта страница пока не '
                       'может показать, где он находится.',
        source_url='https://gov.uz/en/digital/news/view/201507',
        source_name='Ministry of Digital Technologies',
    ),
]


class Command(BaseCommand):
    help = 'Create or update the satellites shown on the Live page'

    def handle(self, *args, **options):
        created_count = 0

        for row in SATELLITES:
            fields = {k: v for k, v in row.items() if k != 'slug'}
            _, created = TrackedSatellite.objects.update_or_create(
                slug=row['slug'], defaults=fields,
            )
            created_count += bool(created)

        total = TrackedSatellite.objects.count()
        untracked = TrackedSatellite.objects.filter(norad_id__isnull=True).count()

        self.stdout.write(f'  {created_count} created, '
                          f'{len(SATELLITES) - created_count} updated.')
        self.stdout.write(f'  {total} satellites, {untracked} of them with no '
                          'published catalogue number.')
        self.stdout.write(self.style.SUCCESS('Seed complete.'))
