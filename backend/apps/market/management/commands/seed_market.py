"""
Seed the marketplace with a demo catalogue: categories, 40 products and a
product photo for each one.

    python manage.py seed_market                  # categories + items + images
    python manage.py seed_market --no-images      # text only, no network
    python manage.py seed_market --refresh-images # re-download existing photos
    python manage.py seed_market --fresh          # wipe the catalogue first

The photos come from Wikimedia Commons (NASA / ESA / public-domain material)
and are written to MEDIA_ROOT/market/. They are demo assets: `backend/media/`
is gitignored, so every clone downloads its own copy, and a download that fails
just leaves that item without a picture — MarketView falls back to a per-type
emoji, so a seeded catalogue is never half-broken.

`item_type` values are the ones `market.types.*` in the front-end locales can
label. Adding a new type here means adding it there too, or the product modal
prints the raw translation key.
"""
import subprocess
from datetime import timedelta
from urllib.error import URLError
from urllib.request import Request, urlopen

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.market.models import MarketCategory, MarketItem
from apps.validators import MAX_UPLOAD_BYTES

USER_AGENT = 'space-edu-seed/1.0 (https://github.com/Shokhanasser1/space-edu)'


# ──────────────────────────────────────────────────────────────────────────────
#  CATEGORIES
# ──────────────────────────────────────────────────────────────────────────────
CATEGORIES = [
    # slug,          name_en,            name_uz,             name_ru,               icon,        color,     order
    ('spaceships',   'Spaceships',       'Kosmik kemalar',    'Космические корабли', 'Rocket',    '#00e5ff',  1),
    ('modules',      'Rocket Modules',   'Raketa modullari',  'Ракетные модули',     'Cog',       '#ef4444',  2),
    ('satellites',   'Satellites',       "Sun'iy yo'ldoshlar", 'Спутники',           'Satellite', '#10b981',  3),
    ('books',        'Books & Courses',  'Kitoblar va kurslar', 'Книги и курсы',     'BookOpen',  '#3b82f6',  4),
    ('badges',       'Badges & Medals',  'Nishon va medallar', 'Значки и медали',    'Award',     '#fbbf24',  5),
    ('boosts',       'XP Boosts',        'XP kuchaytirgichlar', 'Ускорители XP',     'Zap',       '#4ade80',  6),
    ('avatars',      'Avatars & Skins',  'Avatarlar',         'Аватары и скины',     'User',      '#a78bfa',  7),
    ('themes',       'Interface Themes', 'Interfeys mavzulari', 'Темы интерфейса',   'Palette',   '#f472b6',  8),
    ('tools',        'Space Tools',      'Kosmik asboblar',   'Космические приборы', 'Wrench',    '#fb923c',  9),
    ('gear',         'Crew Gear',        'Ekipaj jihozlari',  'Снаряжение экипажа',  'Package',   '#f59e0b', 10),
]


# ──────────────────────────────────────────────────────────────────────────────
#  PRODUCT PHOTOS  —  Wikimedia Commons, keyed by item slug
# ──────────────────────────────────────────────────────────────────────────────
_COMMONS = 'https://upload.wikimedia.org/wikipedia/commons'

IMAGES = {
    'falcon-9-model':       f'{_COMMONS}/thumb/4/41/Falcon_9_first_stage_at_LZ-1%28two%29.jpg/960px-Falcon_9_first_stage_at_LZ-1%28two%29.jpg',
    'starship-model':       f'{_COMMONS}/thumb/f/f3/Starship_SN16.jpeg/960px-Starship_SN16.jpeg',
    'soyuz-rocket':         f'{_COMMONS}/thumb/f/f4/Soyuz_TMA-5_launch.jpg/960px-Soyuz_TMA-5_launch.jpg',
    'electron-rocket':      f'{_COMMONS}/thumb/9/94/Electron_Rocket_Diagram.png/960px-Electron_Rocket_Diagram.png',
    'saturn-v-model':       f'{_COMMONS}/thumb/7/7d/Apollo_11_Launch2.jpg/960px-Apollo_11_Launch2.jpg',
    'atlas-v-model':        f'{_COMMONS}/thumb/7/72/Atlas_V_rocket_launch_%282000881669%29.jpg/960px-Atlas_V_rocket_launch_%282000881669%29.jpg',

    'raptor-engine':        f'{_COMMONS}/thumb/2/27/SpaceX_sea-level_Raptor_at_Hawthorne_-_2.jpg/960px-SpaceX_sea-level_Raptor_at_Hawthorne_-_2.jpg',
    'merlin-engine':        f'{_COMMONS}/4/44/SpaceX_Testing_Merlin_1D_Engine_In_Texas.jpg',
    'rd-180-engine':        f'{_COMMONS}/thumb/4/48/RD-180_test_firing.jpg/960px-RD-180_test_firing.jpg',
    'ion-thruster':         f'{_COMMONS}/thumb/9/9e/Ion_Engine_Test_Firing_-_GPN-2000-000482.jpg/960px-Ion_Engine_Test_Firing_-_GPN-2000-000482.jpg',
    'heat-shield-tile':     f'{_COMMONS}/b/be/A_thermal_protection_system_tile_from_Space_Shuttle_Columbia.jpg',
    'solar-array-wing':     f'{_COMMONS}/thumb/1/16/ISS-52_Roll_Out_Solar_Array_%28ROSA%29_%284%29.jpg/960px-ISS-52_Roll_Out_Solar_Array_%28ROSA%29_%284%29.jpg',

    'hubble-telescope':     f'{_COMMONS}/thumb/2/25/Grand_star-forming_region_R136_in_NGC_2070_%28captured_by_the_Hubble_Space_Telescope%29.jpg/960px-Grand_star-forming_region_R136_in_NGC_2070_%28captured_by_the_Hubble_Space_Telescope%29.jpg',
    'james-webb-model':     f'{_COMMONS}/thumb/9/99/James_Webb_Space_Telescope_Mirror37.jpg/960px-James_Webb_Space_Telescope_Mirror37.jpg',
    'cubesat-kit':          f'{_COMMONS}/thumb/a/a0/NanoRacks_CubeSat_deployer_deploying_CXBN-2_and_IceCube.jpg/960px-NanoRacks_CubeSat_deployer_deploying_CXBN-2_and_IceCube.jpg',
    'gps-satellite':        f'{_COMMONS}/d/d3/GPS_satellite_constellation.jpg',
    'deep-space-antenna':   f'{_COMMONS}/thumb/5/55/Watching_Over_the_Deep_Space_Network_Before_Artemis_II_Signal_Acquisition.jpg/960px-Watching_Over_the_Deep_Space_Network_Before_Artemis_II_Signal_Acquisition.jpg',
    'multispectral-sensor': f'{_COMMONS}/thumb/f/fb/Lena_River_Delta_-_Landsat_2000.jpg/960px-Lena_River_Delta_-_Landsat_2000.jpg',

    'cosmos-by-sagan':      f'{_COMMONS}/b/be/Carl_Sagan_Planetary_Society.JPG',
    'astrophysics-book':    f'{_COMMONS}/thumb/1/10/Neil_deGrasse_Tyson_at_CSICon_2022.jpg/960px-Neil_deGrasse_Tyson_at_CSICon_2022.jpg',
    'uzbek-astronomy-book': f'{_COMMONS}/thumb/4/45/Ulugh_Beg_Observatory_Museum_02.jpg/960px-Ulugh_Beg_Observatory_Museum_02.jpg',
    'apollo-guidance-book': f'{_COMMONS}/thumb/d/db/Margaret_Hamilton_-_restoration.jpg/960px-Margaret_Hamilton_-_restoration.jpg',

    'pioneer-badge':        f'{_COMMONS}/thumb/3/3d/Apollo_11_Crew.jpg/960px-Apollo_11_Crew.jpg',
    'astronaut-wings':      f'{_COMMONS}/thumb/0/01/USN-Astronaut-Wings.png/960px-USN-Astronaut-Wings.png',
    'mission-complete':     f'{_COMMONS}/thumb/a/a3/STS-93_Mission_Patch_%28illustrations-misc-STS-93_Mission_Patch_-_sts93-patch%29.jpg/960px-STS-93_Mission_Patch_%28illustrations-misc-STS-93_Mission_Patch_-_sts93-patch%29.jpg',
    'gagarin-medal':        f'{_COMMONS}/thumb/e/e5/Yuri_Gagarin_%281961%29_-_Restoration.jpg/960px-Yuri_Gagarin_%281961%29_-_Restoration.jpg',

    'double-xp-7d':         f'{_COMMONS}/thumb/2/21/NASA_Wallops_Supports_First_Rocket_Lab_HASTE_Launch_of_2026_%28long-exposure-feb-2026-credit-nasa-danielle-johnson%29.jpg/960px-NASA_Wallops_Supports_First_Rocket_Lab_HASTE_Launch_of_2026_%28long-exposure-feb-2026-credit-nasa-danielle-johnson%29.jpg',
    'triple-xp-1d':         f'{_COMMONS}/thumb/e/e3/Magnificent_CME_Erupts_on_the_Sun_-_August_31.jpg/960px-Magnificent_CME_Erupts_on_the_Sun_-_August_31.jpg',
    'fuel-refill-500':      f'{_COMMONS}/thumb/3/3e/High-Energy_Propellant_Rocket_Firing_at_the_Rocket_Lab_%28GRC-1955-C-37428%29.jpg/960px-High-Energy_Propellant_Rocket_Firing_at_the_Rocket_Lab_%28GRC-1955-C-37428%29.jpg',

    'cosmonaut-avatar':     f'{_COMMONS}/thumb/a/ab/Berkut_spacesuit_1.JPG/960px-Berkut_spacesuit_1.JPG',
    'astronaut-avatar':     f'{_COMMONS}/thumb/8/89/STS-116_spacewalk_1.jpg/960px-STS-116_spacewalk_1.jpg',
    'alien-commander':      f'{_COMMONS}/thumb/f/f3/Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg/960px-Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg',

    'nebula-theme':         f'{_COMMONS}/thumb/e/ea/Carina_Nebula.jpg/960px-Carina_Nebula.jpg',
    'dark-matter-theme':    f'{_COMMONS}/thumb/9/98/Andromeda_Galaxy_%28with_h-alpha%29.jpg/960px-Andromeda_Galaxy_%28with_h-alpha%29.jpg',

    'telescope-pro':        f'{_COMMONS}/thumb/8/84/Amateur_astronomy_in_israel.jpg/960px-Amateur_astronomy_in_israel.jpg',
    'star-map-deluxe':      f'{_COMMONS}/thumb/5/54/Barnard%E2%80%99s_Star_in_the_constellation_Ophiuchus_%28eso1837c%29.jpg/960px-Barnard%E2%80%99s_Star_in_the_constellation_Ophiuchus_%28eso1837c%29.jpg',

    'mars-rover-kit':       f'{_COMMONS}/thumb/d/de/Curiosity_-_Robot_Geologist_and_Chemist_in_One%21.jpg/960px-Curiosity_-_Robot_Geologist_and_Chemist_in_One%21.jpg',
    'lunar-rover-wheel':    f'{_COMMONS}/thumb/4/4d/NASA_Apollo_17_Lunar_Roving_Vehicle.jpg/960px-NASA_Apollo_17_Lunar_Roving_Vehicle.jpg',
    'space-helmet':         f'{_COMMONS}/thumb/9/9c/Aldrin_Apollo_11.jpg/960px-Aldrin_Apollo_11.jpg',
    'mag-grip-boots':       f'{_COMMONS}/thumb/2/27/AS14-64-9048_-_Apollo_14_-_Apollo_14_Mission_image_-_Pan_of_the_Core_Tube_with_the_Lunar_Module_in_the_Background._-_NARA_-_16696852.jpg/960px-AS14-64-9048_-_Apollo_14_-_Apollo_14_Mission_image_-_Pan_of_the_Core_Tube_with_the_Lunar_Module_in_the_Background._-_NARA_-_16696852.jpg',
}


# ──────────────────────────────────────────────────────────────────────────────
#  PRODUCTS
#
#  `title` and `description` are (en, uz, ru) triples — the model stores one
#  column per language and MarketView picks by the active locale, so a missing
#  translation shows up as an English card in a Russian shop.
#  Any item with a `discount_percent` gets a live discount window in handle().
# ──────────────────────────────────────────────────────────────────────────────
ITEMS = [
    # ── Spaceships ────────────────────────────────────────────────────────────
    dict(
        slug='falcon-9-model', category='spaceships', item_type='spaceship',
        title=('Falcon 9 Model', 'Falcon 9 modeli', 'Модель Falcon 9'),
        description=(
            'A detailed model of the reusable Falcon 9 first stage, landing legs and grid fins included.',
            "Qayta ishlatiladigan Falcon 9 birinchi bosqichining batafsil modeli — qo'nish oyoqlari va panjara qanotlari bilan.",
            'Детальная модель многоразовой первой ступени Falcon 9 — с посадочными опорами и решётчатыми рулями.',
        ),
        price=45000, original_price=60000, discount_percent=25, cost_fuel=300,
        is_bestseller=True, tags='spacex,raketa,model',
    ),
    dict(
        slug='starship-model', category='spaceships', item_type='spaceship',
        title=('Starship Super Heavy', 'Starship Super Heavy', 'Starship Super Heavy'),
        description=(
            'The tallest rocket ever flown. Unlock the full stack — booster and ship — for your hangar.',
            "Hozirgacha uchgan eng baland raketa. Angaringiz uchun to'liq to'plamni oching: uchirgich va kema.",
            'Самая высокая ракета в истории. Откройте полную сборку — ускоритель и корабль — для своего ангара.',
        ),
        price=120000, cost_fuel=800,
        is_new=True, is_featured=True, tags='spacex,starship,premium',
    ),
    dict(
        slug='soyuz-rocket', category='spaceships', item_type='spaceship',
        title=('Soyuz Rocket', 'Soyuz raketasi', 'Ракета «Союз»'),
        description=(
            'The workhorse of crewed spaceflight — over 1900 launches since 1966.',
            "Ekipajli kosmik parvozlarning ishchi oti — 1966 yildan beri 1900 dan ortiq uchirish.",
            'Рабочая лошадка пилотируемой космонавтики — более 1900 пусков с 1966 года.',
        ),
        price=35000, cost_fuel=200, tags='roscosmos,soyuz,klassika',
    ),
    dict(
        slug='electron-rocket', category='spaceships', item_type='spaceship',
        title=('Electron Rocket', 'Electron raketasi', 'Ракета Electron'),
        description=(
            'Rocket Lab’s small-satellite launcher with 3D-printed electric-pump engines.',
            "Rocket Lab'ning kichik yo'ldoshlar uchirgichi — 3D bosilgan elektr nasosli dvigatellar bilan.",
            'Носитель малых спутников от Rocket Lab с напечатанными на 3D-принтере двигателями.',
        ),
        price=25000, cost_fuel=150, is_new=True, tags='rocketlab,electron,smallsat',
    ),
    dict(
        slug='saturn-v-model', category='spaceships', item_type='spaceship',
        title=('Saturn V Collector Model', 'Saturn V kolleksion modeli', 'Коллекционная модель «Сатурн-5»'),
        description=(
            'The rocket that took Apollo 11 to the Moon — 111 metres of collector-grade detail.',
            "Apollo 11 ni Oyga olib borgan raketa — 111 metrlik kolleksion darajadagi tafsilot.",
            'Ракета, доставившая «Аполлон-11» на Луну — 111 метров коллекционной детализации.',
        ),
        price=95000, original_price=130000, discount_percent=27, cost_fuel=650,
        is_bestseller=True, is_limited=True, stock=40, tags='nasa,apollo,saturn-v,limited',
    ),
    dict(
        slug='atlas-v-model', category='spaceships', item_type='spaceship',
        title=('Atlas V Launcher', 'Atlas V uchirgichi', 'Носитель Atlas V'),
        description=(
            'The launcher behind Curiosity, Juno and New Horizons. Configurable fairing and boosters.',
            "Curiosity, Juno va New Horizons ortidagi uchirgich. Sozlanuvchi obtekator va uchirgichlar.",
            'Носитель, запустивший Curiosity, Juno и New Horizons. Настраиваемый обтекатель и ускорители.',
        ),
        price=55000, cost_fuel=380, tags='ula,atlas,nasa',
    ),

    # ── Rocket modules ────────────────────────────────────────────────────────
    dict(
        slug='raptor-engine', category='modules', item_type='rocket_module',
        title=('Raptor Engine V2', 'Raptor dvigateli V2', 'Двигатель Raptor V2'),
        description=(
            'Full-flow staged-combustion methalox engine, 230 tf of thrust at sea level.',
            "To'liq oqimli bosqichli yonuvchi metaloks dvigateli, dengiz sathida 230 tf tortish kuchi.",
            'Метанокислородный двигатель полнопоточного цикла, тяга 230 тс на уровне моря.',
        ),
        price=180000, original_price=240000, discount_percent=25, cost_fuel=1200,
        is_bestseller=True, is_new=True, tags='spacex,raptor,dvigatel',
    ),
    dict(
        slug='merlin-engine', category='modules', item_type='rocket_module',
        title=('Merlin 1D Engine', 'Merlin 1D dvigateli', 'Двигатель Merlin 1D'),
        description=(
            'Nine of these lift every Falcon 9. Kerolox, gas-generator cycle, restartable in flight.',
            "Har bir Falcon 9 ni shunday to'qqiztasi ko'taradi. Kerolox, gaz generatorli tsikl, parvozda qayta ishga tushadi.",
            'Девять таких поднимают каждый Falcon 9. Керосин-кислород, повторный запуск в полёте.',
        ),
        price=140000, cost_fuel=900, tags='spacex,merlin,dvigatel',
    ),
    dict(
        slug='rd-180-engine', category='modules', item_type='rocket_module',
        title=('RD-180 Engine', 'RD-180 dvigateli', 'Двигатель РД-180'),
        description=(
            'Twin-chamber oxidiser-rich staged combustion — the engine everyone else said was impossible.',
            "Ikki kamerali, oksidlovchiga boy bosqichli yonish — boshqalar imkonsiz degan dvigatel.",
            'Двухкамерный двигатель закрытого цикла — тот самый, который все считали невозможным.',
        ),
        price=125000, cost_fuel=850, tags='energomash,rd-180,dvigatel',
    ),
    dict(
        slug='ion-thruster', category='modules', item_type='rocket_module',
        title=('Xenon Ion Thruster', 'Ksenon ion dvigateli', 'Ионный двигатель на ксеноне'),
        description=(
            'Almost no thrust, almost no fuel — and it will still get you to the asteroid belt.',
            "Deyarli tortish kuchi yo'q, deyarli yoqilg'i yo'q — ammo sizni asteroid kamariga olib boradi.",
            'Почти нет тяги, почти нет топлива — и всё же он довезёт вас до пояса астероидов.',
        ),
        price=210000, cost_fuel=1400, is_featured=True, tags='nasa,ion,dawn',
    ),
    dict(
        slug='heat-shield-tile', category='modules', item_type='rocket_module',
        title=('Thermal Shield Tile', 'Issiqlik qalqoni plitasi', 'Плитка теплозащиты'),
        description=(
            'Glowing at 1200 °C on one face and cool enough to hold on the other. Re-entry, solved.',
            "Bir tomoni 1200 °C da qizil, ikkinchi tomoni qo'lda ushlab turarli darajada sovuq. Atmosferaga kirish yechimi.",
            'Одна сторона раскалена до 1200 °C, другую можно держать в руке. Решение для входа в атмосферу.',
        ),
        price=30000, original_price=42000, discount_percent=28, cost_fuel=190,
        tags='nasa,shuttle,tps',
    ),
    dict(
        slug='solar-array-wing', category='modules', item_type='rocket_module',
        title=('Roll-Out Solar Array', 'Yoyiladigan quyosh paneli', 'Разворачиваемая солнечная батарея'),
        description=(
            'Rolls out like a carpet in orbit and delivers 20 kW without a single moving hinge.',
            "Orbitada gilamdek yoyiladi va bitta ham harakatlanuvchi ilgaksiz 20 kVt beradi.",
            'Разворачивается в орбите как ковёр и даёт 20 кВт без единого шарнира.',
        ),
        price=160000, cost_fuel=1000, is_new=True, tags='iss,rosa,energiya',
    ),

    # ── Satellites ────────────────────────────────────────────────────────────
    dict(
        slug='hubble-telescope', category='satellites', item_type='satellite',
        title=('Hubble Optics Package', 'Hubble optika to‘plami', 'Оптический комплект «Хаббл»'),
        description=(
            'The 2.4 m mirror that rewrote the age of the universe. Deep-field imaging included.',
            "Koinot yoshini qayta yozgan 2,4 m li oyna. Chuqur maydon suratga olish bilan.",
            'Зеркало 2,4 м, переписавшее возраст Вселенной. Съёмка глубокого поля в комплекте.',
        ),
        price=230000, original_price=290000, discount_percent=21, cost_fuel=1500,
        is_bestseller=True, is_featured=True, tags='nasa,hubble,teleskop',
    ),
    dict(
        slug='james-webb-model', category='satellites', item_type='satellite',
        title=('JWST Mirror Segment', 'JWST oyna segmenti', 'Сегмент зеркала JWST'),
        description=(
            'Beryllium, gold-coated, and cold enough to see the first galaxies ever formed.',
            "Berilliy, oltin qoplamali va birinchi galaktikalarni ko'radigan darajada sovuq.",
            'Бериллий с золотым покрытием, охлаждённый настолько, чтобы видеть первые галактики.',
        ),
        price=250000, cost_fuel=1600, is_new=True, is_limited=True, stock=25,
        tags='nasa,jwst,infraqizil,limited',
    ),
    dict(
        slug='cubesat-kit', category='satellites', item_type='satellite',
        title=('1U CubeSat Kit', '1U CubeSat to‘plami', 'Набор 1U CubeSat'),
        description=(
            'Ten centimetres on a side, and a real orbit. The satellite most students actually build.',
            "Har tomoni o'n santimetr va haqiqiy orbita. Ko'p o'quvchilar aynan shuni yasaydi.",
            'Десять сантиметров по грани и настоящая орбита. Спутник, который студенты правда строят.',
        ),
        price=65000, original_price=85000, discount_percent=24, cost_fuel=420,
        is_bestseller=True, tags='cubesat,talaba,konstruktor',
    ),
    dict(
        slug='gps-satellite', category='satellites', item_type='satellite',
        title=('Navigation Satellite', 'Navigatsiya yo‘ldoshi', 'Навигационный спутник'),
        description=(
            'An atomic clock in orbit, accurate to a nanosecond — which is why your map knows where you are.',
            "Orbitadagi atom soati, nanosekund aniqlikda — xaritangiz qayerdaligingizni shuning uchun biladi.",
            'Атомные часы на орбите с точностью до наносекунды — поэтому карта знает, где вы.',
        ),
        price=140000, cost_fuel=920, tags='gps,navigatsiya,orbita',
    ),
    dict(
        slug='deep-space-antenna', category='satellites', item_type='satellite',
        title=('Deep Space Antenna', 'Chuqur kosmos antennasi', 'Антенна дальней связи'),
        description=(
            'A 70 m dish that can hear a Voyager transmitter 24 billion kilometres away.',
            "24 milliard kilometr uzoqlikdagi Voyager uzatgichini eshitadigan 70 m li antenna.",
            'Тарелка 70 м, слышащая передатчик «Вояджера» за 24 миллиарда километров.',
        ),
        price=195000, cost_fuel=1250, is_featured=True, tags='dsn,nasa,antenna',
    ),
    dict(
        slug='multispectral-sensor', category='satellites', item_type='satellite',
        title=('Multi-Spectral Sensor', 'Multispektral datchik', 'Мультиспектральный сенсор'),
        description=(
            'Eleven bands of Earth observation — watch a river delta shift season by season.',
            "Yer kuzatuvining o'n bir diapazoni — daryo deltasining fasl bo'yicha o'zgarishini kuzating.",
            'Одиннадцать каналов наблюдения Земли — следите, как дельта реки меняется по сезонам.',
        ),
        price=115000, original_price=150000, discount_percent=23, cost_fuel=760,
        is_new=True, tags='landsat,yer,masofaviy-zondlash',
    ),

    # ── Books ─────────────────────────────────────────────────────────────────
    dict(
        slug='cosmos-by-sagan', category='books', item_type='book',
        title=('Cosmos — Carl Sagan', 'Cosmos — Karl Sagan', '«Космос» — Карл Саган'),
        description=(
            'Thirteen chapters on our place in the universe, and still the best place to start.',
            "Koinotdagi o'rnimiz haqida o'n uch bob — va hamon boshlash uchun eng yaxshi joy.",
            'Тринадцать глав о нашем месте во Вселенной — и до сих пор лучшее начало.',
        ),
        price=25000, cost_fuel=180, is_bestseller=True, is_featured=True,
        tags='kitob,sagan,kosmos',
    ),
    dict(
        slug='astrophysics-book', category='books', item_type='book',
        title=(
            'Astrophysics for Young People', 'Yoshlar uchun astrofizika',
            'Астрофизика для молодёжи',
        ),
        description=(
            'Neil deGrasse Tyson explains gravity, light and black holes without a single equation.',
            "Neil deGrasse Tyson tortishish, yorug'lik va qora tuynuklarni bitta ham tenglamasiz tushuntiradi.",
            'Нил Деграсс Тайсон объясняет гравитацию, свет и чёрные дыры без единого уравнения.',
        ),
        price=18000, original_price=25000, discount_percent=28, cost_fuel=120,
        is_new=True, tags='kitob,astrofizika,boshlangich',
    ),
    dict(
        slug='uzbek-astronomy-book', category='books', item_type='book',
        title=(
            'Ulugh Beg and the Zij', "Ulug'bek va Zij", 'Улугбек и «Зидж»',
        ),
        description=(
            'Samarkand, 1437: a star catalogue of 1018 stars, accurate to arcminutes, without a telescope.',
            "Samarqand, 1437: teleskopsiz, yoy daqiqasi aniqligida 1018 yulduzli katalog.",
            'Самарканд, 1437 год: каталог из 1018 звёзд с точностью до угловых минут — без телескопа.',
        ),
        price=32000, cost_fuel=210, is_featured=True,
        tags='ulugbek,samarqand,tarix,ozbekiston',
    ),
    dict(
        slug='apollo-guidance-book', category='books', item_type='book',
        title=(
            'The Apollo Guidance Computer', 'Apollo boshqaruv kompyuteri',
            'Бортовой компьютер «Аполлона»',
        ),
        description=(
            'How 72 kilobytes of rope memory and Margaret Hamilton’s code landed people on the Moon.',
            "72 kilobayt arqon xotira va Margaret Hamilton kodi odamlarni Oyga qanday qo'ndirgani haqida.",
            'Как 72 килобайта памяти и код Маргарет Гамильтон посадили людей на Луну.',
        ),
        price=28000, original_price=38000, discount_percent=26, cost_fuel=190,
        tags='apollo,dasturlash,tarix',
    ),

    # ── Badges ────────────────────────────────────────────────────────────────
    dict(
        slug='pioneer-badge', category='badges', item_type='badge',
        title=('Space Pioneer Badge', 'Kosmik kashshof nishoni', 'Значок «Космический первопроходец»'),
        description=(
            'For the ones who go first. Sits on your profile next to your callsign.',
            "Birinchi bo'lib boradiganlar uchun. Profilingizda chaqiruv belgingiz yonida turadi.",
            'Для тех, кто идёт первым. Отображается в профиле рядом с вашим позывным.',
        ),
        price=15000, cost_fuel=100, is_bestseller=True, tags='nishon,kashshof,yutuq',
    ),
    dict(
        slug='astronaut-wings', category='badges', item_type='badge',
        title=('Astronaut Wings', 'Astronavt qanotlari', 'Крылья астронавта'),
        description=(
            'Awarded above 80 km. There is no shortcut to this one.',
            "80 km dan yuqorida beriladi. Bunga qisqa yo'l yo'q.",
            'Вручаются выше 80 км. Коротких путей здесь нет.',
        ),
        price=20000, original_price=30000, discount_percent=33, cost_fuel=150,
        is_featured=True, tags='nishon,astronavt,premium',
    ),
    dict(
        slug='mission-complete', category='badges', item_type='badge',
        title=('Mission Patch — Complete', 'Missiya nishoni — bajarildi', 'Нашивка «Миссия выполнена»'),
        description=(
            'Every crew designs their own. Yours arrives when the fiftieth lesson is behind you.',
            "Har bir ekipaj o'zinikini chizadi. Sizniki ellikinchi dars ortda qolganda keladi.",
            'Каждый экипаж рисует свою. Ваша придёт, когда пятидесятый урок будет позади.',
        ),
        price=10000, cost_fuel=80, tags='nishon,missiya,yutuq',
    ),
    dict(
        slug='gagarin-medal', category='badges', item_type='badge',
        title=('Gagarin Medal', 'Gagarin medali', 'Медаль Гагарина'),
        description=(
            '108 minutes, one orbit, and nobody had ever done it before. April 12, 1961.',
            "108 daqiqa, bitta orbita va bundan avval hech kim buni qilmagan. 1961-yil 12-aprel.",
            '108 минут, один виток — и никто до него этого не делал. 12 апреля 1961 года.',
        ),
        price=45000, cost_fuel=320, is_limited=True, is_new=True, stock=60,
        tags='gagarin,medal,tarix,limited',
    ),

    # ── Boosts ────────────────────────────────────────────────────────────────
    dict(
        slug='double-xp-7d', category='boosts', item_type='boost',
        title=('Double XP — 7 Days', 'Ikki barobar XP — 7 kun', 'Двойной XP — 7 дней'),
        description=(
            'Every lesson, quiz and streak counts twice for a full week.',
            "Bir hafta davomida har bir dars, test va seriya ikki barobar hisoblanadi.",
            'Целую неделю каждый урок, тест и серия засчитываются вдвойне.',
        ),
        price=30000, original_price=50000, discount_percent=40, cost_fuel=200,
        is_bestseller=True, is_limited=True, stock=100, tags='boost,xp,limited',
    ),
    dict(
        slug='triple-xp-1d', category='boosts', item_type='boost',
        title=('Triple XP — 24 Hours', 'Uch barobar XP — 24 soat', 'Тройной XP — 24 часа'),
        description=(
            'One day, three times the progress. Best spent on a weekend marathon.',
            "Bir kun, uch barobar taraqqiyot. Dam olish kunidagi marafonga eng mos.",
            'Один день — тройной прогресс. Лучше всего для марафона на выходных.',
        ),
        price=20000, cost_fuel=120, is_new=True, tags='boost,xp,marafon',
    ),
    dict(
        slug='fuel-refill-500', category='boosts', item_type='boost',
        title=('Fuel Refill +500', "Yoqilg'i +500", 'Заправка +500'),
        description=(
            'Tops your tank up by 500 units the moment you buy it.',
            "Sotib olgan zahoti bakingizni 500 birlikka to'ldiradi.",
            'Пополняет бак на 500 единиц сразу после покупки.',
        ),
        price=15000, cost_fuel=0, tags='boost,yoqilgi,tolash',
    ),

    # ── Avatars ───────────────────────────────────────────────────────────────
    dict(
        slug='cosmonaut-avatar', category='avatars', item_type='avatar',
        title=('Berkut Cosmonaut', 'Berkut kosmonavti', 'Космонавт в «Беркуте»'),
        description=(
            'The suit Leonov wore for the first spacewalk — and could barely fit back through the airlock in.',
            "Leonov birinchi ochiq kosmosga chiqqanda kiygan skafandr — shlyuzdan zo'rg'a qaytib kirgan.",
            'Скафандр, в котором Леонов вышел в открытый космос и еле протиснулся обратно в шлюз.',
        ),
        price=8000, cost_fuel=50, tags='avatar,kosmonavt,tarix',
    ),
    dict(
        slug='astronaut-avatar', category='avatars', item_type='avatar',
        title=('EVA Astronaut', 'EVA astronavti', 'Астронавт в открытом космосе'),
        description=(
            'White suit, gold visor, nothing but a tether between you and the rest of the universe.',
            "Oq skafandr, oltin vizor va siz bilan koinot orasida faqat bitta arqon.",
            'Белый скафандр, золотой визор — и только фал между вами и остальной Вселенной.',
        ),
        price=12000, original_price=18000, discount_percent=33, cost_fuel=90,
        is_bestseller=True, tags='avatar,eva,nasa',
    ),
    dict(
        slug='alien-commander', category='avatars', item_type='avatar',
        title=('Nebula Commander', 'Tumanlik qo‘mondoni', 'Командир туманности'),
        description=(
            'Born in the Orion Nebula, apparently. Limited to fifty across all of Uzbekistan.',
            "Aytishlaricha, Orion tumanligida tug'ilgan. Butun O'zbekiston bo'ylab ellik dona.",
            'Родом, говорят, из туманности Ориона. Всего пятьдесят на весь Узбекистан.',
        ),
        price=50000, cost_fuel=350, is_limited=True, is_featured=True, is_new=True,
        stock=50, tags='avatar,tumanlik,limited,premium',
    ),

    # ── Themes ────────────────────────────────────────────────────────────────
    dict(
        slug='nebula-theme', category='themes', item_type='theme',
        title=('Carina Nebula Theme', 'Kil tumanligi mavzusi', 'Тема «Туманность Киля»'),
        description=(
            'Repaints the whole app in the oranges and teals of a star nursery seven thousand light years out.',
            "Butun ilovani yetti ming yorug'lik yili naridagi yulduz beshigining zangori va to'q sariq ranglariga bo'yaydi.",
            'Перекрашивает приложение в оранжево-бирюзовые цвета звёздных яслей за семь тысяч световых лет.',
        ),
        price=22000, original_price=30000, discount_percent=27, cost_fuel=150,
        is_new=True, tags='mavzu,tumanlik,interfeys',
    ),
    dict(
        slug='dark-matter-theme', category='themes', item_type='theme',
        title=('Dark Matter Theme', 'Qorong‘u materiya mavzusi', 'Тема «Тёмная материя»'),
        description=(
            'Near-black interface with Andromeda accents. Easier on the eyes after midnight.',
            "Andromeda urg'ulari bilan deyarli qora interfeys. Yarim tundan keyin ko'zga yengilroq.",
            'Почти чёрный интерфейс с акцентами Андромеды. Легче для глаз после полуночи.',
        ),
        price=22000, cost_fuel=150, is_bestseller=True, tags='mavzu,qorongu,interfeys',
    ),

    # ── Tools ─────────────────────────────────────────────────────────────────
    dict(
        slug='telescope-pro', category='tools', item_type='tool',
        title=('Telescope Pro Unlock', 'Teleskop Pro ochilishi', 'Разблокировка «Телескоп Pro»'),
        description=(
            'Swaps the observatory’s starter optics for a 200 mm reflector. Saturn gets rings.',
            "Observatoriyaning boshlang'ich optikasini 200 mm reflektorga almashtiradi. Saturn halqalarga ega bo'ladi.",
            'Меняет стартовую оптику обсерватории на 200-мм рефлектор. У Сатурна появляются кольца.',
        ),
        price=40000, cost_fuel=250, is_new=True, tags='asbob,teleskop,observatoriya',
    ),
    dict(
        slug='star-map-deluxe', category='tools', item_type='tool',
        title=('Star Map Deluxe', 'Yulduz xaritasi Deluxe', 'Звёздная карта Deluxe'),
        description=(
            'Ten thousand objects, every constellation, and the sky over Tashkent tonight.',
            "O'n ming obyekt, barcha yulduz turkumlari va bugun kechqurun Toshkent osmoni.",
            'Десять тысяч объектов, все созвездия и небо над Ташкентом на сегодняшнюю ночь.',
        ),
        price=35000, original_price=45000, discount_percent=22, cost_fuel=220,
        is_bestseller=True, tags='asbob,xarita,yulduzlar',
    ),

    # ── Crew gear ─────────────────────────────────────────────────────────────
    dict(
        slug='mars-rover-kit', category='gear', item_type='other',
        title=('Mars Rover Build Kit', 'Mars roveri to‘plami', 'Набор для сборки марсохода'),
        description=(
            'Six wheels, a rocker-bogie suspension that climbs kerbs, and a laser for rocks.',
            "Olti g'ildirak, qiyalikka chiqadigan rocker-bogie osmasi va toshlar uchun lazer.",
            'Шесть колёс, подвеска rocker-bogie для преодоления уступов и лазер для камней.',
        ),
        price=85000, original_price=110000, discount_percent=23, cost_fuel=560,
        is_bestseller=True, is_new=True, tags='mars,rover,konstruktor',
    ),
    dict(
        slug='lunar-rover-wheel', category='gear', item_type='other',
        title=('Lunar Rover Wheel', 'Oy roveri g‘ildiragi', 'Колесо лунохода'),
        description=(
            'Woven piano-wire mesh, because rubber freezes solid at −170 °C.',
            "To'qilgan pianino simi to'ri — chunki rezina −170 °C da muzlab qoladi.",
            'Плетёная сетка из рояльной струны: резина при −170 °C становится камнем.',
        ),
        price=48000, cost_fuel=320, tags='oy,rover,apollo',
    ),
    dict(
        slug='space-helmet', category='gear', item_type='other',
        title=('EVA Helmet', 'EVA dubulg‘asi', 'Шлем для выхода в космос'),
        description=(
            'Gold-coated visor, twelve hours of air, and a HUD that keeps count of both.',
            "Oltin qoplamali vizor, o'n ikki soatlik havo va ikkalasini sanab turuvchi HUD.",
            'Визор с золотым напылением, двенадцать часов воздуха и HUD, который считает и то, и другое.',
        ),
        price=68000, cost_fuel=450, is_featured=True, tags='dubulga,eva,jihoz',
    ),
    dict(
        slug='mag-grip-boots', category='gear', item_type='other',
        title=('Mag-Grip Boots', 'Mag-Grip etiklari', 'Магнитные ботинки Mag-Grip'),
        description=(
            'Magnetic soles for walking a metal hull in zero g. 500 N of hold, 48 hours of battery.',
            "Vaznsizlikda metall korpusda yurish uchun magnitli taglik. 500 N ushlash, 48 soat batareya.",
            'Магнитные подошвы для ходьбы по корпусу в невесомости. 500 Н удержания, 48 часов батареи.',
        ),
        price=32000, original_price=40000, discount_percent=20, cost_fuel=210,
        tags='etik,magnit,jihoz',
    ),
]


def fetch(url, timeout=30):
    """Download `url` and return the bytes.

    urllib first, curl as the fallback: a python.org interpreter on macOS ships
    without a root-certificate bundle, so `urlopen` on upload.wikimedia.org
    raises CERTIFICATE_VERIFY_FAILED on a perfectly healthy machine. curl reads
    the system trust store and is present everywhere this project runs.
    """
    request = Request(url, headers={'User-Agent': USER_AGENT})
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.read()
    except URLError as exc:
        if 'CERTIFICATE_VERIFY_FAILED' not in str(exc):
            raise
    completed = subprocess.run(
        ['curl', '-sSLf', '--max-time', str(timeout), '-A', USER_AGENT, url],
        capture_output=True,
        check=True,
    )
    return completed.stdout


class Command(BaseCommand):
    help = 'Populate the marketplace with a demo catalogue (categories, items, photos)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--no-images', action='store_true',
            help='Seed text only — skip every download, so the command needs no network.',
        )
        parser.add_argument(
            '--refresh-images', action='store_true',
            help='Re-download photos for items that already have one.',
        )
        parser.add_argument(
            '--fresh', action='store_true',
            help='Delete existing categories and items first (also drops inventory and reviews).',
        )

    def handle(self, *args, **options):
        now = timezone.now()

        if options['fresh']:
            deleted_items = MarketItem.objects.all().delete()[0]
            deleted_cats = MarketCategory.objects.all().delete()[0]
            self.stdout.write(f'  Cleared {deleted_items} item rows and {deleted_cats} category rows')

        # ── Categories ──
        categories = {}
        for slug, name_en, name_uz, name_ru, icon, color, order in CATEGORIES:
            categories[slug], _ = MarketCategory.objects.update_or_create(
                slug=slug,
                defaults=dict(
                    name_en=name_en, name_uz=name_uz, name_ru=name_ru,
                    icon=icon, color=color, order=order,
                ),
            )
        self.stdout.write(f'  {len(categories)} categories')

        # ── Items ──
        created_count = 0
        for entry in ITEMS:
            fields = dict(entry)
            title_en, title_uz, title_ru = fields.pop('title')
            description_en, description_uz, description_ru = fields.pop('description')
            fields.update(
                category=categories[fields['category']],
                title_en=title_en, title_uz=title_uz, title_ru=title_ru,
                description_en=description_en,
                description_uz=description_uz,
                description_ru=description_ru,
            )

            # A discount_percent with no window never shows as active, so the
            # sale price silently never applies. Give every discounted demo item
            # a window that is open right now.
            if fields.get('discount_percent') and 'discount_start' not in fields:
                fields['discount_start'] = now - timedelta(days=1)
                fields['discount_end'] = now + timedelta(days=14)

            item, created = MarketItem.objects.update_or_create(
                slug=fields['slug'], defaults=fields,
            )
            created_count += int(created)

        self.stdout.write(f'  {len(ITEMS)} items ({created_count} new)')

        # ── Photos ──
        if options['no_images']:
            self.stdout.write('  Images skipped (--no-images)')
        else:
            self._seed_images(refresh=options['refresh_images'])

        self.stdout.write(self.style.SUCCESS(
            f'Market seeded: {MarketCategory.objects.count()} categories, '
            f'{MarketItem.objects.count()} items.'
        ))

    # ──────────────────────────────────────────────────────────────────────────
    def _seed_images(self, refresh):
        downloaded = skipped = failed = 0

        for item in MarketItem.objects.filter(slug__in=IMAGES):
            if item.image and not refresh:
                skipped += 1
                continue

            try:
                payload = fetch(IMAGES[item.slug])
            except Exception as exc:                      # noqa: BLE001 — demo data
                # One unreachable file must not abort the seed; the card just
                # falls back to its type emoji.
                self.stderr.write(f'  ! {item.slug}: download failed ({exc})')
                failed += 1
                continue

            if len(payload) > MAX_UPLOAD_BYTES:
                self.stderr.write(
                    f'  ! {item.slug}: {len(payload) / 1024 / 1024:.1f} MB exceeds the '
                    f'{MAX_UPLOAD_BYTES // 1024 // 1024} MB upload limit — skipped'
                )
                failed += 1
                continue

            # Assign, then save — not `item.image.save(...)`. image_upload_to
            # picks the extension by probing the field's own file, and
            # FieldFile.save() generates the name *before* attaching the
            # content, so that route stored every JPEG under a .png name. On R2
            # the name is where Content-Type comes from, so those files would
            # have been served as image/png.
            item.image = ContentFile(payload, name=f'{item.slug}.img')
            item.save(update_fields=['image'])
            downloaded += 1

        summary = f'  Images: {downloaded} downloaded'
        if skipped:
            summary += f', {skipped} already present'
        if failed:
            summary += f', {failed} failed'
        self.stdout.write(summary)
