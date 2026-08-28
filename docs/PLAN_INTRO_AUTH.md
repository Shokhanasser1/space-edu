# План: интро-экран, регистрация и вход

Дата: 2026-08-28. Ветка: `feat/intro-auth`. Решения владельца: интро собираем из
собственной 3D-сцены (без видеофайла); тему осветляем/утепляем только на
auth-экранах; регистрация в два шага; логотипов пока нет — текстовые заглушки,
подменяемые одной строкой.

## Цель

1. Незалогиненный посетитель при первом заходе видит интро (космический
   пролёт + название + Start). Start → регистрация. Skip → сайт.
2. Регистрация: два шага с прогрессом, Google сверху, inline-валидация,
   индикатор надёжности пароля, логотипы UZ COSMOS и Oxford International
   School, анимированные переходы. Серверная проверка почты/пароля,
   троттлинг и подтверждение адреса уже есть — бэкенд не трогаем.
3. Вход: тот же тёплый графитовый грунт, логотипы, контраст подписей.

## Что НЕ входит

- Редизайн остального сайта (отложен 22.08). Новые токены живут в классе
  `.auth-theme` и не касаются `--color-space-*`.
- Смена шрифта на IBM Plex — только вместе с общим редизайном.
- Изменения моделей/миграций. Поле «школа/класс» — нет.
- Настоящее видео. Если появится файл — `IntroScene` заменяется на `<video>`
  в одном компоненте, гейт и кнопки остаются.

## Архитектура

```
App.jsx
 └─ "/"  → <IntroGate>            guest && !seen ? <Navigate to="/welcome"> : <HomeView>
 └─ "/welcome" (GuestRoute)       <IntroView>  — без Navigation/частиц (в isAuth-списке)
      ├─ <IntroScene>             React.lazy: R3F-канвас, StarField + Sun + Earth(2k) + Moon,
      │                           скриптовый пролёт камеры ~10 с, затем медленный дрейф
      ├─ постер-фолбэк            PNG в public/intro/poster.jpg: нет WebGL / reduced-motion / слабый GPU
      └─ <PartnerLogos> + заголовок + [Start] [Skip]
 └─ "/register" → <RegisterView>  визард 2 шага, <PartnerLogos>, <GoogleSignInButton text="signup_with">
 └─ "/login"    → <LoginView>     <PartnerLogos>, новые токены
```

Файлы:

| Путь | Назначение |
|---|---|
| `frontend/src/index.css` | блок `.auth-theme { --auth-bg-top … }` + утилиты; ничего глобального |
| `frontend/src/components/brand/PartnerLogos.jsx` | «UZ COSMOS · Oxford International School»; `img` при наличии `public/brand/*.svg`, иначе wordmark |
| `frontend/src/components/auth/AuthShell.jsx` | общий каркас auth-экранов: фон, блобы, логотипы, карточка, футер |
| `frontend/src/components/auth/PasswordStrength.jsx` | 4-сегментный индикатор: длина ≥8, не только цифры, буквы+цифры, ≥12 |
| `frontend/src/components/auth/StepIndicator.jsx` | «Шаг 1 из 2», анимированная полоса |
| `frontend/src/views/intro/IntroView.jsx` | экран, кнопки, флаг просмотра |
| `frontend/src/views/intro/IntroScene.jsx` | R3F-сцена (lazy) |
| `frontend/src/views/intro/introSeen.js` | `hasSeenIntro()/markIntroSeen()` поверх localStorage с try/catch |
| `frontend/src/components/IntroGate.jsx` | редирект на `/welcome` |
| `frontend/src/lib/authValidation.js` | чистые функции: email, dob (в прошлом, возраст 5–100), пароль — зеркало дешёвых Django-валидаторов |
| `frontend/src/locales/{en,ru,uz}.json` | секция `intro`, новые ключи `registerPage.*` — править JSON напрямую (генератор устарел) |
| `frontend/public/intro/poster.jpg` | кадр из сцены, ~150 КБ |

Токены `.auth-theme` (стартовые значения, подбираются по скриншотам):

```
--auth-bg-top:     #1b1723   /* тёплый графит с фиолетовым подтоном */
--auth-bg-bottom:  #0d0b12
--auth-surface:    rgba(255,255,255,0.06)
--auth-border:     rgba(255,255,255,0.12)
--auth-text:       rgba(255,255,255,0.88)
--auth-text-muted: rgba(255,255,255,0.58)   /* было /30 */
--auth-accent:     #8b5cf6                  /* основной, без изменений */
--auth-warm:       #c08a2e                  /* латунь — второй акцент, лого-разделитель, прогресс */
--auth-glow:       rgba(139,92,246,0.14)    /* блобы: было 0.03–0.06 */
--auth-radius:     16px
--auth-ease:       cubic-bezier(0.16,1,0.3,1)
```

Правила: никакого чистого `#000`; свечение только за главной кнопкой и
блобами; `backdrop-blur` только на карточке; два радиуса (16 / 999).

## Этапы

### 0. Подготовка — 0.5 дня
- Ветка `feat/intro-auth` от `main` (хук pre-push стоит).
- `.auth-theme` в `index.css`, `AuthShell`, `PartnerLogos` (+тест: рендерит оба
  имени; при наличии `src` рендерит `img` с alt).
- Ключи локалей в трёх JSON, проверка парности ключей тестом `useTranslation`.

### 1. Вход — 0.5 дня
- `LoginView` переезжает на `AuthShell`; логика, ошибки и троттлинг-сообщения
  не меняются; существующие 2 теста зелёные.
- Подписи `white/30 → --auth-text-muted`, поля `--auth-surface`, кнопка с
  тёплым свечением, `label htmlFor`, `aria-invalid`, `aria-describedby`.
- Скриншоты 390 и 1440 px до/после.

### 2. Регистрация — 1.5 дня (TDD)
Тесты сначала (`RegisterView.test.jsx`, `authValidation.test.js`):
- шаг 1 не пропускает пустые поля и дату в будущем, фокус на первом невалидном;
- шаг 2 отправляет полный набор из шести полей — тело запроса без изменений;
- серверная ошибка по `email`/`password` открывает шаг 2 и показывает её у поля;
- серверная ошибка по `date_of_birth` возвращает на шаг 1;
- три существующих теста (несовпадение паролей, ошибка у поля, rate-limit)
  проходят без правок ожиданий;
- индикатор пароля: 4 уровня, «только цифры» = слабый.

Реализация:
- Шаг 1: имя, фамилия, дата рождения. Шаг 2: почта, пароль, повтор + индикатор.
- `AnimatePresence mode="wait"`, сдвиг ±24 px, 350 мс, `--auth-ease`;
  `prefers-reduced-motion` → без сдвига, только fade.
- Google `signup_with` над формой на шаге 1; после успеха — `navigate('/')`.
- Inline-валидация на `blur`, ошибка исчезает при вводе (текущее поведение).
- Кнопка «Назад» на шаге 2 сохраняет введённое.
- Успех: как сейчас — вход и переход на `/` (баннер подтверждения почты уже в чате).

### 3. Интро — 1.5–2 дня
- `introSeen.js` + `IntroGate` + тесты: гость без флага → `/welcome`; с флагом →
  `HomeView`; залогиненный → `HomeView` всегда; `/welcome` для залогиненного →
  `/` (через `GuestRoute`).
- `IntroView`: заголовок и Start/Skip рендерятся сразу, сцена подгружается
  `lazy` под ними — кнопки доступны до загрузки трёхмерки. Start →
  `markIntroSeen()` → `/register`; Skip → `markIntroSeen()` → `/`.
  Enter/Space = Start, Esc = Skip.
- `IntroScene`: `StarField`, `Sun` (шейдер из `solar/scene`), Земля с одной
  2k-картой, Луна; камера по сплайну 10 с, затем дрейф. Бюджет: ≤ 3 МБ
  текстур, ≤ 300 КБ gz JS сверх уже общего three-чанка, 60 fps на
  интегрированном GPU; проверка через `?quality=high|low` как в
  `SolarSystemView`.
- Фолбэк на постер: нет WebGL, `prefers-reduced-motion`, слабый GPU
  (тот же детектор, что в `SolarSystemView`), ошибка загрузки сцены
  (`RouteErrorBoundary` + локальный `ErrorBoundary`).
- `/welcome` в `isAuth`-список `App.jsx` (без Navigation/частиц/футера);
  `robots.txt`/`sitemap.xml` — `/welcome` не индексируем.

### 4. QA и сдача — 0.5 дня
- `npm test`, `npm run lint`, `npm run build` (размер чанков в отчёте).
- Playwright (`webapp-testing`): три экрана × 390/1440 px, тёмный фон
  без `#000`, контраст подписей ≥ 4.5:1, reduced-motion, повторный заход не
  показывает интро, вход после Start уводит на `/register`.
- Ручной прогон: неверный пароль → «Неверная почта или пароль», 10 неверных →
  сообщение о лимите с минутами (бэкенд без изменений).
- Коммиты по этапам (`feat: …`), затем по договорённости push → ff в `main`.

Итого ≈ 4–5 рабочих дней.

## Риски

| Риск | Мера |
|---|---|
| three.js в интро тянет первый экран | сцена `lazy`, кнопки не ждут её; постер как первый кадр |
| Слабый GPU / телефон | тот же детектор пресета, что в Солнечной системе; постер |
| Очистка localStorage → интро снова | допустимо; Skip в один клик |
| Ошибка сервера по полю шага 1 при отправке на шаге 2 | маппинг поля → шаг с авто-возвратом (покрыто тестом) |
| Google-кнопка при отсутствии `VITE_GOOGLE_CLIENT_ID` | уже рендерит `null`, форма не страдает |
| Разъезд ключей в трёх локалях | тест парности ключей |

## Что нужно от владельца (не блокирует старт)

- Логотипы UZ COSMOS и Oxford International School (SVG/PNG на прозрачном) —
  положить в `frontend/public/brand/`, дальше одна строка в `PartnerLogos`.
- Слоган для интро. Рабочий вариант: uz «Koinotga birinchi qadam» /
  ru «Первый шаг в космос» / en «Your first step into space».

## Статус — 28.08.2026, закрыто

Всё влито в `main` (`b7d4d09` вход/регистрация, `2d05d1a` интро, `36fd320`
Земля в 8k с шейдером Солнечной системы). Этап 4 выполнен:

- Тесты: 610 в репозитории зелёные, lint без ошибок, паритет локалей.
- Lighthouse (desktop, production-сборка через `vite preview`), `/welcome`,
  `/login`, `/register`: **perf 94 / a11y 100 / best-practices 100**, FCP 0,9 с,
  LCP 1,5 с, TBT 0, CLS ≤ 0,05. Единственное замечание `valid-source-maps` —
  карты исходников отключены в сборке намеренно. (В dev-режиме те же страницы
  дают perf 55 и LCP 12 с — это несобранный Vite, не сайт.)
- `prefers-reduced-motion`, живой Playwright: интро отдаёт SVG-постер, канвас
  не создаётся, текстуры не запрашиваются, фокус на «Start»; визард
  регистрации проходит на шаг 2 fade-переходом.
- Tap-targets: кнопка «показать пароль» 44×44, ссылка «Забыли пароль?» 40 px
  высотой (Lighthouse `target-size` на `/login` был 96 → 100).
- Отклонения от плана: Google-кнопка на шаге 1 стоит под «Продолжить», не над
  формой (компонент рисует разделитель сверху); постер — inline SVG вместо
  `public/intro/poster.jpg`; поле школы/класса не добавлялось.

Осталось от владельца: файлы логотипов в `frontend/public/brand/` и `src` в
`PartnerLogos.jsx`.
