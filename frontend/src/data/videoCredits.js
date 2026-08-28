/**
 * Who made the video a lesson plays.
 *
 * The lesson slots were filled on 28 Aug 2026 with Khan Academy's physics and
 * astronomy lessons in Uzbek. They are somebody else's work: the page has to
 * say so, or this platform is passing them off as its own — which is half of
 * what PR #14 was undoing.
 *
 * `TopicLesson` has no field for a channel and a migration is the lead's to
 * run, so the credit lives here rather than in the database. A lesson whose
 * video is not in this map prints no credit at all, never a guessed one, and
 * `videoCredits.test.js` fails if the fixture ever ships a `video_url` that
 * is missing from it.
 *
 * `title` is the video's own title. Nothing renders it; it is here so that an
 * id can be checked by hand against the video it claims to be.
 *
 * Generated from YouTube's oEmbed endpoint, which answers 200 only for a video
 * that exists and allows embedding. To re-check an entry, or to add one:
 *
 *   curl -s "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D<ID>&format=json"
 *
 * `author_name` is the channel, `title` the title. Verified 28 Aug 2026.
 */
export const VIDEO_CREDITS = {
  'LF98SpIWZac': { channel: 'Khan Academy Uzbek', title: 'Fizikaga kirish | Toʻgʻri chiziqli harakat | Fizika | Khan Academy Oʻzbek' },
  'BTJmrnzT_eQ': { channel: 'Khan Academy Uzbek', title: 'Koordinataning vaqtga bogʻliqlik grafigi | Toʻgʻri chiziqli harakat | Fizika | Khan Academy Oʻzbek' },
  'gqphgVyTzqs': { channel: 'Khan Academy Uzbek', title: 'Sanoq sistemalari haqida tushuncha | Toʻgʻri chiziqli harakat | Fizika | Khan Academy Oʻzbek' },
  'Sn0EEL5E2cI': { channel: 'Khan Academy Uzbek', title: 'Oniy tezlikning skalyar va vektor koʻrinishi | Toʻgʻri chiziqli harakat | Fizika' },
  'HK1qm34dy9E': { channel: 'Khan Academy Uzbek', title: 'Tezlanish | Toʻgʻri chiziqli harakat | Fizika | Khan Academy Oʻzbek' },
  'RYKrRm8dPPw': { channel: 'Khan Academy Uzbek', title: 'Nega tezlik-vaqt grafigi ostida chegaralangan shaklning yuzasi masofani bildiradi?' },
  '8HC7N9D29TE': { channel: 'Khan Academy Uzbek', title: 'Tezlanishning vaqtga bogʻliqlik grafigi | Toʻgʻri chiziqli harakat | Fizika | Khan Academy Oʻzbek' },
  'Njc5QCRU4ZQ': { channel: 'Khan Academy Uzbek', title: 'Markazga intilma kuch va markazga intilma tezlanish | Fizika' },
  'K9wubX_VPAA': { channel: 'Khan Academy Uzbek', title: 'Kirish: Nyutonning birinchi qonuni | Kuchlar va Nyuton qonunlari | Fizika | Khan Academy Oʻzbek' },
  'BkUyufANeo4': { channel: 'Khan Academy Uzbek', title: 'Nyutonning ikkinchi qonuni | Kuchlar va Nyuton qonunlari | Fizika | Khan Academy Oʻzbek' },
  '_sSdSI3PqWo': { channel: 'Khan Academy Uzbek', title: 'Nyutonning uchinchi qonuni | Kuchlar va Nyuton qonunlari | Fizika | Khan Academy Oʻzbek' },
  '9qKK4LI0OYg': { channel: 'Khan Academy Uzbek', title: 'Gravitatsiya – butun olam tortishish qonuni | Markazga intilma kuch va gravitatsiya | Fizika' },
  'ila7kbiQucs': { channel: 'Khan Academy Uzbek', title: 'g ni gravitatsion maydonning jismlarga taʼsir qiymati sifatida tushunish | Fizika' },
  'tP2tQtnR9bg': { channel: 'Khan Academy Uzbek', title: 'Yer sirtidagi jismning ogʻirligi | Markazga intilma kuch va gravitatsiya | Fizika' },
  'wD8HqX6gGZc': { channel: 'Khan Academy Uzbek', title: 'Orbitadagi fazogirlar gravitatsiyadan xolimi? | Markazga intilma kuch va gravitatsiya | Fizika' },
  'KicO4MoOMS4': { channel: 'Khan Academy Uzbek', title: 'Vertikal yuqoriga otilgan jism harakati (1-qism) | Toʻgʻri chiziqli harakat | Fizika' },
  'W9l1urFgiu4': { channel: 'Khan Academy Uzbek', title: 'Gorizontal otilgan jism harakati | Toʻgʻri chiziqli harakat | Fizika' },
  '5nOnhTq20vk': { channel: 'Khan Academy Uzbek', title: 'Gorizontga burchak ostida otilgan jism | Egri chiziqli harakat | Fizika' },
  'yM-KakIQRGA': { channel: 'Khan Academy Uzbek', title: 'XKSʼning tezligini topish | Markazga intilma kuch va gravitatsiya | Fizika' },
  'YP_hnGED0mQ': { channel: 'Khan Academy Uzbek', title: 'Tinchlikdagi ishqalanish va sirpanish ishqalanish kuchiga misol |Kuchlar va Nyuton qonunlari |Fizika' },
  'h6I7Lp_M--Q': { channel: 'Khan Academy Uzbek', title: 'Tezlikni oʻzgarmas holatda saqlab turgan ishqalanish kuchi | Kuchlar va Nyuton qonunlari | Fizika' },
  'JRfEbz32HLU': { channel: 'Khan Academy Uzbek', title: 'Muvozanatlashgan va muvozanatlashmagan kuchlar | Kuchlar va Nyuton qonunlari | Fizika' },
  'RmMvfob6SHk': { channel: 'Khan Academy Uzbek', title: 'Fizikada ish va energiya tushunchasi | Ish va energiya | Fizika | Khan Academy Oʻzbek' },
  'R97ptRkXgD8': { channel: 'Khan Academy Uzbek', title: 'Energiyaning saqlanish qonuni | Ish va energiya | Fizika | Khan Academy Oʻzbek' },
  'gS5E0WsbNSg': { channel: 'Khan Academy Uzbek', title: 'Massiv yulduzlarning hayot sikli | Yulduzlar, qora tuynuklar va galaktikalar | Astronomiya' },
  'dezCVRZW4No': { channel: 'Khan Academy Uzbek', title: 'Qizil gigantga aylanish | Yulduzlar, qora tuynuklar va galaktikalar | Astronomiya' },
  'gHSLWrmBK-k': { channel: 'Khan Academy Uzbek', title: 'Galaktik toʻqnashuvlar | Yulduzlar, qora tuynuklar va galaktikalar | Astronomiya' },
  'RrpOxpTWmAM': { channel: 'Khan Academy Uzbek', title: 'Galaktikalarning Xabbl orqali olingan surati | Koinot oʻlchami | Astronomiya' },
  'l6k62nsjfFo': { channel: 'Khan Academy Uzbek', title: 'Qora tuynuklar | Yulduzlar, qora tuynuklar va galaktikalar | Astronomiya' },
  'qT74-XVshxU': { channel: 'Khan Academy Uzbek', title: 'Super massiv qora tuynuklar | Yulduzlar, qora tuynuklar va galaktikalar | Astronomiya' },
  'CQvJKqzmEJI': { channel: 'Khan Academy Uzbek', title: 'Yulduzli maydon va bulutliklar suratlari | Yulduzlar, qora tuynuklar va galaktikalar | Astronomiya' },
  'JyeV3_bi5_w': { channel: 'Khan Academy Uzbek', title: 'Kvazarlar | Yulduzlar, qora tuynuklar va galaktikalar | Astronomiya' },
  'rTRIWTzkjGE': { channel: 'Khan Academy Uzbek', title: 'Kvazarlar (qoʻshimcha) | Yulduzlar, qora tuynuklar va galaktikalar | Astronomiya' },
  'ROQWN2h7dVM': { channel: 'Khan Academy Uzbek', title: 'Supernova (1-qism) | Yulduzlar, qora tuynuklar va galaktikalar | Astronomiya' },
  '_y-HcqZnxX8': { channel: 'Khan Academy Uzbek', title: 'Supernova (2-qism) | Yulduzlar, qora tuynuklar va galaktikalar | Astronomiya' },
};

/**
 * The YouTube id inside a lesson's video url.
 *
 * The fixture holds watch links and the player rewrites them to embed links
 * with `?rel=0` on the end, so both shapes reach this.
 */
export function videoIdFrom(url) {
  const match = /(?:\/embed\/|[?&]v=|youtu\.be\/)([\w-]+)/.exec(String(url ?? ''));
  return match ? match[1] : null;
}

/** The credit for a lesson's video, or null when there is nothing certain to say. */
export function videoCredit(url) {
  const id = videoIdFrom(url);
  return (id && VIDEO_CREDITS[id]) || null;
}
