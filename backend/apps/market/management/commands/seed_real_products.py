"""
Seed the real half of the marketplace: things a child can actually buy, from
shops we do not run — model rockets, books and clothes.

    python manage.py seed_real_products
    python manage.py seed_real_products --dry-run   # list what it would write

The products below are the ones named in item 7 of the requirements document.
This is a skeleton, not a catalogue: it carries the merchant, the product page
and the three titles, and deliberately carries **no price, no stock and no
rating**. Those move at the shop, and a number invented here is a number a child
reads as ours. Where a price is missing the shop card says so and sends them to
the merchant for it; the real prices are being checked by hand and typed into
`external_price` / `currency` afterwards.

Nothing here is downloaded, so the command runs without a network. Re-running it
restores the skeleton — titles, descriptions, URL, merchant, type — and leaves
every field it does not name alone, so a checked price, an uploaded photo or a
flag set in the admin panel survives a re-seed.

Every row has `external_url` set, which is what makes it a real product:
PurchaseView refuses to take fuel for it and MarketView links out to the shop
instead of showing a buy button. `seed_market` is the other half — the virtual
catalogue that fuel does buy.
"""
from django.core.management.base import BaseCommand

from apps.market.models import MarketCategory, MarketItem


# ──────────────────────────────────────────────────────────────────────────────
#  CATEGORIES
#
#  get_or_create rather than update_or_create: `books` already exists from
#  seed_market, and re-labelling somebody else's category is not this command's
#  business.
# ──────────────────────────────────────────────────────────────────────────────
CATEGORIES = [
    # slug,         name_en,          name_uz,                  name_ru,                     icon,      color,      order
    ('model-kits',  'Model Kits',     "Model to'plamlari",      'Модели и наборы',           'Rocket',  '#f97316',  11),
    ('books',       'Books & Courses', 'Kitoblar va kurslar',   'Книги и курсы',             'BookOpen', '#3b82f6',  4),
    ('apparel',     'Clothing',       'Kiyim',                  'Одежда',                    'Shirt',   '#22d3ee',  12),
]


# ──────────────────────────────────────────────────────────────────────────────
#  PRODUCTS
#
#  `title` and `description` are (en, uz, ru) triples, one per model column.
#  Titles follow the shop's own name for the product — read off the merchant's
#  page, not invented here — and the description says plainly what the thing is
#  and where it is bought.
# ──────────────────────────────────────────────────────────────────────────────
PRODUCTS = [
    # ── Prototypes: model rockets and build kits ──────────────────────────────
    #
    # The requirements document gives shop pages for these, not single product
    # pages, so each row is the shop's space section rather than one kit.
    dict(
        slug='estes-model-rockets', category='model-kits', item_type='model_kit',
        merchant='Estes Rockets', external_url='https://estesrockets.com/',
        title=(
            'Estes model rocket kits',
            "Estes raketa modellari to'plamlari",
            'Наборы моделей ракет Estes',
        ),
        description=(
            'Flying model rocket kits, engines and launch sets. Choose one on the Estes shop — '
            'it is bought there, with money, and shipped by them.',
            "Uchadigan raketa modellari to'plamlari, dvigatellar va uchirish komplektlari. "
            "Kerakligini Estes do'konidan tanlaysiz — xarid o'sha yerda, pul bilan bo'ladi.",
            'Наборы летающих моделей ракет, двигатели и стартовые комплекты. Набор выбирается '
            'в магазине Estes — покупка там, за деньги.',
        ),
    ),
    dict(
        slug='apogee-model-rockets', category='model-kits', item_type='model_kit',
        merchant='Apogee Components', external_url='https://apogeerockets.com/',
        title=(
            'Apogee model rockets',
            'Apogee raketa modellari',
            'Модели ракет Apogee',
        ),
        description=(
            'Model rockets together with the how-to material that goes with them: build guides, '
            'engines and parts. Bought at the Apogee shop.',
            "Raketa modellari va ular bilan birga keladigan qo'llanmalar: yig'ish bo'yicha "
            "ko'rsatmalar, dvigatellar va ehtiyot qismlar. Apogee do'konidan xarid qilinadi.",
            'Модели ракет и материалы к ним: инструкции по сборке, двигатели и детали. '
            'Покупается в магазине Apogee.',
        ),
    ),
    dict(
        slug='lego-space-sets', category='model-kits', item_type='model_kit',
        merchant='LEGO', external_url='https://www.lego.com/en-us/space',
        title=(
            'LEGO Space sets',
            "LEGO Space to'plamlari",
            'Наборы LEGO Space',
        ),
        description=(
            'The Space section of the official LEGO shop: rockets, rovers and space stations to '
            'build. Prices, sizes and delivery are LEGO\'s own.',
            "Rasmiy LEGO do'konining Space bo'limi: yig'iladigan raketalar, rover va kosmik "
            "stansiyalar. Narx, o'lcham va yetkazib berish LEGOning o'zida.",
            'Раздел Space официального магазина LEGO: ракеты, роверы и космические станции для '
            'сборки. Цены, размеры и доставка — у самого LEGO.',
        ),
    ),
    dict(
        slug='kiwico-science-crates', category='model-kits', item_type='model_kit',
        merchant='KiwiCo', external_url='https://www.kiwico.com',
        title=(
            'KiwiCo hands-on science crates',
            "KiwiCo amaliy fan to'plamlari",
            'Наборы для опытов KiwiCo',
        ),
        description=(
            'Project crates for building and experimenting at home, sorted by age. Ordered on the '
            'KiwiCo site.',
            "Uyda yig'ish va tajriba o'tkazish uchun loyiha to'plamlari, yosh bo'yicha ajratilgan. "
            'KiwiCo saytidan buyurtma qilinadi.',
            'Наборы для сборки и опытов дома, подобранные по возрасту. Заказываются на сайте KiwiCo.',
        ),
    ),
    dict(
        slug='raketashop-uz', category='model-kits', item_type='model_kit',
        merchant='Raketa Shop', external_url='https://www.instagram.com/raketashop.uz/',
        title=(
            'Raketa Shop, Tashkent',
            'Raketa Shop, Toshkent',
            'Raketa Shop, Ташкент',
        ),
        description=(
            'A Tashkent shop selling model rockets through its Instagram page. What is in stock, '
            'the price and delivery are agreed with the shop in a message.',
            "Toshkentdagi do'kon: raketa modellarini Instagram sahifasi orqali sotadi. Nima "
            "borligi, narxi va yetkazib berish do'kon bilan yozishmada kelishiladi.",
            'Ташкентский магазин, продающий модели ракет через свою страницу в Instagram. '
            'Наличие, цену и доставку согласуют с магазином в сообщении.',
        ),
    ),
    dict(
        slug='bway-uz-learning-toys', category='model-kits', item_type='model_kit',
        merchant='BWAY', external_url='https://bway.uz/',
        title=(
            'BWAY learning toys, Tashkent',
            'BWAY rivojlantiruvchi oʻyinchoqlari, Toshkent',
            'Развивающие игрушки BWAY, Ташкент',
        ),
        description=(
            "A Tashkent shop for children's learning toys. Look for the space and construction "
            'sets on bway.uz.',
            "Toshkentdagi bolalar rivojlantiruvchi o'yinchoqlari do'koni. Koinot va konstruktor "
            "to'plamlarini bway.uz saytidan qidiring.",
            'Ташкентский магазин развивающих игрушек для детей. Космические наборы и конструкторы '
            'ищите на bway.uz.',
        ),
    ),
    dict(
        # The requirements document lists this under books; it is a search on a
        # classifieds site for STEM toys, so it is filed as what it is.
        slug='olx-stem-toys-tashkent', category='model-kits', item_type='model_kit',
        merchant='OLX Uzbekistan',
        external_url='https://www.olx.uz/detskiy-mir/igrushki/tashkent/q-stem/',
        title=(
            'STEM toys on OLX, Tashkent',
            'OLXda STEM oʻyinchoqlar, Toshkent',
            'STEM-игрушки на OLX, Ташкент',
        ),
        description=(
            'A search on the OLX classifieds site: STEM toys offered in Tashkent, new and second '
            'hand. Every listing belongs to a different private seller, so look at it with an '
            'adult before buying anything.',
            "OLX e'lonlar saytidagi qidiruv: Toshkentda taklif etilayotgan STEM o'yinchoqlar, "
            "yangisi ham, ishlatilgani ham. Har bir e'lon boshqa-boshqa xususiy sotuvchiniki, "
            'shuning uchun xarid qilishdan oldin kattalar bilan birga koʻring.',
            'Поиск на сайте объявлений OLX: STEM-игрушки в Ташкенте, новые и бывшие в '
            'употреблении. Каждое объявление — от своего частного продавца, поэтому смотрите его '
            'вместе со взрослыми перед покупкой.',
        ),
    ),

    # ── Books ─────────────────────────────────────────────────────────────────
    dict(
        slug='asaxiy-kosmos-encyclopedia-tasks', category='books', item_type='book',
        merchant='Asaxiy',
        external_url='https://asaxiy.uz/product/detskaya-enciklopediya-s-razvivayushchimi-zadaniyami-kosmos',
        title=(
            "Children's encyclopedia with activities: Space",
            'Bolalar ensiklopediyasi, topshiriqlar bilan: Koinot',
            'Детская энциклопедия с развивающими заданиями: Космос',
        ),
        description=(
            'A space encyclopedia for children with exercises to do as you read. Sold by Asaxiy.',
            "Bolalar uchun koinot ensiklopediyasi, o'qib borar ekan bajariladigan topshiriqlar "
            'bilan. Asaxiy sotadi.',
            'Детская энциклопедия о космосе с заданиями по ходу чтения. Продаётся в Asaxiy.',
        ),
    ),
    dict(
        slug='asaxiy-astronomiya-va-koinot', category='books', item_type='book',
        merchant='Asaxiy',
        external_url='https://asaxiy.uz/ru/product/astronomiya-va-koinot-bolalar-uchun-enciklopediya',
        title=(
            'Astronomy and space — an encyclopedia for children',
            'Astronomiya va koinot — bolalar uchun ensiklopediya',
            'Астрономия и космос — энциклопедия для детей',
        ),
        description=(
            'An astronomy encyclopedia for children, in Uzbek. Sold by Asaxiy.',
            "Bolalar uchun o'zbek tilidagi astronomiya ensiklopediyasi. Asaxiy sotadi.",
            'Детская энциклопедия по астрономии на узбекском языке. Продаётся в Asaxiy.',
        ),
    ),
    dict(
        slug='asaxiy-carl-sagan-cosmos', category='books', item_type='book',
        merchant='Asaxiy', external_url='https://asaxiy.uz/product/carl-sagan-cosmos',
        title=(
            'Cosmos — Carl Sagan',
            'Kosmos — Karl Sagan',
            'Космос — Карл Саган',
        ),
        description=(
            "Carl Sagan's Cosmos, the book behind the television series. Sold by Asaxiy.",
            "Karl Saganning «Kosmos» kitobi — o'sha nomdagi teleseriyaning asosi. Asaxiy sotadi.",
            '«Космос» Карла Сагана — книга, легшая в основу телесериала. Продаётся в Asaxiy.',
        ),
    ),
    dict(
        slug='asaxiy-kosmos-first-encyclopedia', category='books', item_type='book',
        merchant='Asaxiy', external_url='https://asaxiy.uz/product/kosmos-samaya-pervaya-enciklopediya',
        title=(
            'Space — a very first encyclopedia',
            'Koinot — eng birinchi ensiklopediya',
            'Космос — самая первая энциклопедия',
        ),
        description=(
            'A first encyclopedia of space, for the youngest readers. Sold by Asaxiy.',
            "Eng kichik o'quvchilar uchun koinot haqidagi birinchi ensiklopediya. Asaxiy sotadi.",
            'Первая энциклопедия о космосе для самых маленьких читателей. Продаётся в Asaxiy.',
        ),
    ),
    dict(
        slug='asaxiy-big-book-about-space', category='books', item_type='book',
        merchant='Asaxiy', external_url='https://asaxiy.uz/product/bolshaya-kniga-o-kosmose',
        title=(
            'The big book about space',
            'Koinot haqida katta kitob',
            'Большая книга о космосе',
        ),
        description=(
            'A large illustrated book about space for children. Sold by Asaxiy.',
            'Bolalar uchun koinot haqidagi katta, rasmli kitob. Asaxiy sotadi.',
            'Большая иллюстрированная книга о космосе для детей. Продаётся в Asaxiy.',
        ),
    ),
    dict(
        slug='yandex-astronomy-guide', category='books', item_type='book',
        merchant='Yandex Market',
        external_url='https://market.yandex.uz/uz/card/gayd-po-astronomii-puteshestviye-k-granitsam-bezgranichnogo-kosmosa/5043924599',
        title=(
            'A guide to astronomy: a journey to the edge of the cosmos',
            'Astronomiya qoʻllanmasi: koinot chegaralariga sayohat',
            'Гид по астрономии: путешествие к границам безграничного космоса',
        ),
        description=(
            'An astronomy guide book. Sold on Yandex Market Uzbekistan.',
            "Astronomiya bo'yicha qo'llanma kitob. Yandex Market O'zbekistonda sotiladi.",
            'Книга-путеводитель по астрономии. Продаётся на Яндекс Маркете Узбекистан.',
        ),
    ),
    dict(
        slug='yandex-galaxies-surdin', category='books', item_type='book',
        merchant='Yandex Market',
        external_url='https://market.yandex.uz/uz/card/galaktiki-surdin-vladimir-georgiyevich/5643848952',
        title=(
            'Galaxies — Vladimir Surdin',
            'Galaktikalar — Vladimir Surdin',
            'Галактики — Владимир Сурдин',
        ),
        description=(
            'A book about galaxies by the astronomer Vladimir Surdin. Sold on Yandex Market '
            'Uzbekistan.',
            "Astronom Vladimir Surdinning galaktikalar haqidagi kitobi. Yandex Market "
            "O'zbekistonda sotiladi.",
            'Книга о галактиках астронома Владимира Сурдина. Продаётся на Яндекс Маркете '
            'Узбекистан.',
        ),
    ),
    dict(
        slug='birbir-illustrated-atlas-universe', category='books', item_type='book',
        merchant='Birbir.uz',
        external_url='https://birbir.uz/uz/toshkent/cat/xobbi-va-sport/kitoblar-jurnallar/o/illyustrirovannyy-atlas-vselennaya-283569150',
        title=(
            'Illustrated atlas: The Universe',
            'Illyustratsiyalangan atlas: Koinot',
            'Иллюстрированный атлас: Вселенная',
        ),
        description=(
            'An illustrated atlas of the universe, put up by a seller in Tashkent on the Birbir '
            'listings site. One person is selling one copy, so read the listing with an adult.',
            "Koinotning rasmli atlasi, Birbir e'lonlar saytida Toshkentdagi sotuvchi tomonidan "
            "qo'yilgan. Bitta odam bitta nusxani sotadi, shuning uchun e'lonni kattalar bilan "
            "birga o'qing.",
            'Иллюстрированный атлас Вселенной, размещённый продавцом из Ташкента на сайте '
            'объявлений Birbir. Один человек продаёт один экземпляр — читайте объявление вместе '
            'со взрослыми.',
        ),
    ),

    # ── Clothing ──────────────────────────────────────────────────────────────
    dict(
        slug='yandex-printech-astronaut-tshirt', category='apparel', item_type='apparel',
        merchant='Yandex Market',
        external_url='https://market.yandex.uz/uz/card/futbolka-detskaya-printech-kids-astronavt-kosmos-kosmonavt-astronaut-belaya-140-fd-gb68p10wh-140/103124355033',
        title=(
            "Printech Kids astronaut T-shirt, white",
            "Printech Kids «Astronavt» bolalar futbolkasi, oq",
            'Детская футболка Printech Kids «Астронавт», белая',
        ),
        description=(
            "A white children's T-shirt with an astronaut print. Sizes are on the shop page. Sold "
            'on Yandex Market Uzbekistan.',
            "Astronavt rasmi tushirilgan oq bolalar futbolkasi. O'lchamlar do'kon sahifasida. "
            "Yandex Market O'zbekistonda sotiladi.",
            'Белая детская футболка с принтом астронавта. Размеры — на странице магазина. '
            'Продаётся на Яндекс Маркете Узбекистан.',
        ),
    ),
    dict(
        slug='nasa-exchange-moon-joy-tshirt', category='apparel', item_type='apparel',
        merchant='NASA Exchange', external_url='https://nasaexchange.com/products/rise-moon-joy-youth-t-shirt',
        title=(
            'Rise / Moon Joy youth T-shirt',
            'Rise / Moon Joy oʻsmirlar futbolkasi',
            'Подростковая футболка Rise / Moon Joy',
        ),
        description=(
            'A youth T-shirt from the NASA Exchange shop. Shipped from the United States.',
            "NASA Exchange do'konidagi o'smirlar futbolkasi. AQShdan yetkaziladi.",
            'Подростковая футболка из магазина NASA Exchange. Доставка из США.',
        ),
    ),
    dict(
        slug='spreadshirt-aerospace-engineer', category='apparel', item_type='apparel',
        merchant='Spreadshirt',
        external_url='https://www.spreadshirt.com/shop/design/aerospace%2Bengineer%2Bkids%2Bt-shirt-D6688fd05db32e840ebb7f0cd',
        title=(
            "'Aerospace Engineer' kids' T-shirt",
            "«Aerospace Engineer» bolalar futbolkasi",
            'Детская футболка «Aerospace Engineer»',
        ),
        description=(
            'An "Aerospace Engineer" print. Spreadshirt puts the same design on several garments, '
            "so pick the kids' T-shirt on their page.",
            "«Aerospace Engineer» yozuvli rasm. Spreadshirt bitta rasmni turli kiyimlarga bosadi, "
            "shuning uchun ularning sahifasida bolalar futbolkasini tanlang.",
            'Принт «Aerospace Engineer». Spreadshirt наносит один и тот же рисунок на разную '
            'одежду — выберите на их странице детскую футболку.',
        ),
    ),
    dict(
        slug='boeing-store-nasa-astronaut-tshirt', category='apparel', item_type='apparel',
        merchant='The Boeing Store',
        external_url='https://www.boeingstore.com/products/red-canoe-boeing-kids-nasa-astronaut-t-shirt',
        title=(
            "Red Canoe Boeing kids' NASA astronaut T-shirt",
            'Red Canoe Boeing bolalar NASA astronavt futbolkasi',
            'Детская футболка Red Canoe Boeing с астронавтом NASA',
        ),
        description=(
            "A children's NASA astronaut T-shirt from the Boeing Store. Shipped from the United "
            'States.',
            "Boeing Store do'konidagi bolalar uchun NASA astronavt futbolkasi. AQShdan yetkaziladi.",
            'Детская футболка с астронавтом NASA из магазина Boeing Store. Доставка из США.',
        ),
    ),
    dict(
        slug='amnh-youth-nasa-astronaut-tshirt', category='apparel', item_type='apparel',
        merchant='AMNH Shop', external_url='https://shop.amnh.org/products/youth-nasa-astronaut-t-shirt',
        title=(
            'Youth NASA astronaut T-shirt',
            'NASA astronavt oʻsmirlar futbolkasi',
            'Подростковая футболка NASA «Астронавт»',
        ),
        description=(
            'A NASA astronaut T-shirt from the shop of the American Museum of Natural History in '
            'New York.',
            "Nyu-Yorkdagi Amerika tabiat tarixi muzeyi do'konidan NASA astronavt futbolkasi.",
            'Футболка с астронавтом NASA из магазина Американского музея естественной истории в '
            'Нью-Йорке.',
        ),
    ),
    dict(
        slug='etsy-artemis-2-youth-shirt', category='apparel', item_type='apparel',
        merchant='Etsy', external_url='https://www.etsy.com/listing/4482429562/artemis-2-mission-youth-shirt-kids-space',
        title=(
            'Artemis II mission youth shirt',
            'Artemis II missiyasi oʻsmirlar futbolkasi',
            'Подростковая футболка миссии «Артемида-2»',
        ),
        description=(
            'An Artemis II shirt made to order by an independent seller on Etsy.',
            "Etsydagi mustaqil sotuvchi buyurtma asosida tayyorlaydigan Artemis II futbolkasi.",
            'Футболка Artemis II, которую независимый продавец на Etsy шьёт под заказ.',
        ),
    ),
]


class Command(BaseCommand):
    help = 'Seed the real, purchasable products (item 7 of the requirements document)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Print what would be written and change nothing.',
        )

    def handle(self, *args, **options):
        if options['dry_run']:
            for entry in PRODUCTS:
                self.stdout.write(f'  {entry["slug"]:<40} {entry["merchant"]:<20} {entry["external_url"]}')
            self.stdout.write(f'{len(PRODUCTS)} products would be written. Nothing changed.')
            return

        categories = {}
        for slug, name_en, name_uz, name_ru, icon, color, order in CATEGORIES:
            categories[slug], _ = MarketCategory.objects.get_or_create(
                slug=slug,
                defaults=dict(
                    name_en=name_en, name_uz=name_uz, name_ru=name_ru,
                    icon=icon, color=color, order=order,
                ),
            )

        created = 0
        for entry in PRODUCTS:
            fields = dict(entry)
            title_en, title_uz, title_ru = fields.pop('title')
            description_en, description_uz, description_ru = fields.pop('description')
            fields.update(
                category=categories[fields['category']],
                title_en=title_en, title_uz=title_uz, title_ru=title_ru,
                description_en=description_en,
                description_uz=description_uz,
                description_ru=description_ru,
                # Not a price, a statement: fuel does not buy this, and
                # PurchaseView refuses it whatever this number says.
                cost_fuel=0,
            )
            _, was_created = MarketItem.objects.update_or_create(
                slug=fields['slug'], defaults=fields,
            )
            created += int(was_created)

        priced = MarketItem.objects.exclude(external_url='').exclude(external_price=None).count()
        total = MarketItem.objects.exclude(external_url='').count()

        self.stdout.write(self.style.SUCCESS(
            f'{len(PRODUCTS)} real products written ({created} new, {len(PRODUCTS) - created} updated).'
        ))
        self.stdout.write(
            f'  {priced} of {total} have a checked shop price; the other {total - priced} send the '
            'child to the shop for it.'
        )
