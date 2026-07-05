import en from "./en";

/**
 * UI chrome strings, translated. `Record<keyof typeof en, string>` makes
 * TypeScript fail the build if a key here ever drifts out of sync with en.ts.
 */
const ru: Record<keyof typeof en, string> = {
  "nav.primaryAriaLabel": "Главное меню",
  "nav.menuAriaLabel": "Меню",

  "footer.email": "Эл. почта",
  "footer.disclosure":
    "Некоторые ссылки — партнёрские. Если вы покупаете по ним, мы можем получить небольшую комиссию без каких-либо доплат с вашей стороны. Мы рекомендуем только те вещи, которые действительно использовали сами.",
  "footer.disclosureLinkText": "Полное раскрытие информации",
  "footer.copyright": "© {{year}} {{name}}.",

  "home.eyebrow": "Натурально · Без пластика · Без отдушек",
  "home.browseReviews": "Смотреть обзоры",
  "home.readGuides": "В путь!",
  "home.readJournal": "Читать заметки",
  "home.featuredReviews": "Избранные обзоры",
  "home.allReviews": "Все обзоры →",
  "home.latestGuides": "Новое на пути",
  "home.allGuides": "Весь путь →",
  "home.latestJournal": "Свежие заметки",
  "home.allJournal": "Все заметки →",

  "reviews.title": "Обзоры",
  "reviews.lead": "Каждая вещь здесь проехала с нами реальные километры — мы проверили материалы, безопасность и то, как она выдерживает дорожную жизнь с младенцем.",
  "reviews.filterAriaLabel": "Фильтр по категории",
  "reviews.allCategory": "Все",
  "reviews.templateBtn": "Сделай вклад!",
  "reviews.upcomingTitle": "В работе",
  "reviews.upcomingNote": "Вещи, которые тестируем следующими, — в очереди, обзора пока нет.",

  "compass.title": "Путь",
  "compass.lead": "Бесплатные, выстроенные мини-курсы — без воды и допродаж. Каждый ведёт от начала до конца, по порядку.",
  "compass.provenance":
    "Честно: этот раздел сделан с помощью машины. Курсы «Пути» мы набрасываем с ИИ — из нашего же контекста, влияний и голоса — а потом правим руками. Потому что понятно и терпеливо объяснять — единственное, в чём машина и правда помогает. Так сделан только этот раздел: «Заметки» и все обзоры мы пишем сами.",
  "compass.tag": "Гайд",
  "compass.epicsAriaLabel": "Курсы",
  "compass.chapter": "Глава {{n}}",

  "journal.title": "Заметки",
  "journal.lead": "Записки из дороги, написанные от руки, — что вышло на самом деле, что бы сделали иначе, какие мелочи оказались важными. Без курса, без глянца. Сверху — свежее.",
  "journal.tag": "Заметка",
  "journal.allYears": "Все годы",
  "journal.yearsAriaLabel": "Фильтр по годам",
  "journal.templateBtn": "Сделай вклад!",
  "journal.empty": "Пока пусто — первые записи уже в пути.",
  "journal.upcomingTitle": "В работе",
  "journal.upcomingNote": "Заметки, которые мы сейчас проживаем, — в очереди, текста пока нет.",

  "toc.ariaLabel": "На этой странице",
  "toc.toggle": "На этой странице",

  "reviewDetail.backLink": "← Все обзоры",
  "reviewDetail.checkPrice": "Узнать текущую цену →",

  "compassDetail.backLink": "← К пути",
  "journalDetail.backLink": "← К заметкам",

  "notFound.title": "Страница не найдена",
  "notFound.body": "Эта тропа пока никуда не ведёт.",
  "notFound.backHome": "На главную",

  "rating.ariaLabel": "{{value}} из 5",
  "rating.title": "{{value}} / 5",

  "theme.changeTitle": "Сменить цветовую палитру",
  "theme.toggleLabel": "Палитра",
  "theme.menuAriaLabel": "Цветовая палитра",
  "theme.default": "по умолчанию",

  "lang.changeTitle": "Сменить язык",

  "astro.prevMonth": "Предыдущий месяц",
  "astro.nextMonth": "Следующий месяц",
  "astro.noEvents": "В этом месяце нет отмеченных событий.",
  "astro.note": "Рассчитано по актуальной эфемериде · показано в вашем местном времени",
  "astro.cellAriaLabel": "{{day}}: {{events}}",

  "sidebar.title": "🌌 Небесный альманах",
  "sidebar.intro": "Как будто из уст самого Дарагана",
  "sidebar.missionLabel": "Наша миссия",
  "sidebar.valuesLabel": "Наши ценности",
  "sidebar.missionValuesLabel": "⚖️ Миссия и ценности",
  "sidebar.respectedLabel": "✊ Кого мы уважаем",
  "sidebar.respectedVisit": "В их мир ↗",
  "sidebar.aboutLabel": "🌞 О нас",
  "sidebar.aboutMore": "Наша история →",

  "copy.copy": "Копировать",
  "copy.copied": "Скопировано",

  "support.cardTitle": "Карта · Apple Pay · Google Pay",
  "support.cardText": "Оплата в одно касание через Apple Pay и Google Pay на базе Stripe уже в пути. Загляните чуть позже.",
  "support.cardCta": "Поддержать картой",
  "support.comingSoon": "Скоро",
  "support.paypalTitle": "PayPal",
  "support.paypalText": "Самый простой способ на сегодня — оплата в пару кликов, в вашей валюте.",
  "support.paypalCta": "Поддержать через PayPal",
  "support.cryptoTitle": "Криптовалюта",
  "support.cryptoIntro": "Удобнее криптой? Отправьте на один из кошельков ниже.",
  "support.cryptoWarn": "Проверьте сеть перед отправкой — монеты, отправленные в неверной сети, вернуть нельзя.",
  "support.thanks": "Спасибо — правда. Даже просто поделиться обзором с другом, которому он нужен, помогает больше, чем кажется.",
};

export default ru;
