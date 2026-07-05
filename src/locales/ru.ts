import en from './en'

/**
 * UI chrome strings, translated. `Record<keyof typeof en, string>` makes
 * TypeScript fail the build if a key here ever drifts out of sync with en.ts.
 */
const ru: Record<keyof typeof en, string> = {
  'nav.primaryAriaLabel': 'Главное меню',
  'nav.menuAriaLabel': 'Меню',

  'footer.email': 'Эл. почта',
  'footer.disclosure':
    'Некоторые ссылки — партнёрские. Если вы покупаете по ним, мы можем получить небольшую комиссию без каких-либо доплат с вашей стороны. Мы рекомендуем только то снаряжение, которое действительно использовали сами.',
  'footer.disclosureLinkText': 'Полное раскрытие информации',
  'footer.copyright': '© {{year}} {{name}}.',

  'home.eyebrow': 'Натурально · Без пластика · Без отдушек',
  'home.browseReviews': 'Смотреть обзоры',
  'home.readGuides': 'Начать обучение',
  'home.featuredReviews': 'Избранные обзоры',
  'home.allReviews': 'Все обзоры →',
  'home.latestGuides': 'Новое в обучении',
  'home.allGuides': 'К обучению →',

  'reviews.title': 'Обзоры',
  'reviews.lead':
    'Каждая вещь здесь проехала с нами реальные километры — мы проверили материалы, безопасность и то, как она выдерживает дорожную жизнь с младенцем.',
  'reviews.filterAriaLabel': 'Фильтр по категории',
  'reviews.allCategory': 'Все',

  'guides.title': 'Обучение',
  'guides.lead':
    'Бесплатные, выстроенные по шагам курсы — без воды и допродаж. Каждый ведёт от начала до конца, по порядку. Пока что это наш план основателей: честный, пошаговый путь, которым мы строим этот сайт в открытую. Курсы для читателей появятся, когда мы наберёмся опыта.',
  'guides.tag': 'Гайд',
  'guides.epicsAriaLabel': 'Курсы',
  'guides.chapter': 'Глава {{n}}',

  'toc.ariaLabel': 'На этой странице',
  'toc.toggle': 'На этой странице',

  'reviewDetail.backLink': '← Все обзоры',
  'reviewDetail.checkPrice': 'Узнать текущую цену →',

  'guideDetail.backLink': '← К обучению',

  'notFound.title': 'Страница не найдена',
  'notFound.body': 'Эта тропа пока никуда не ведёт.',
  'notFound.backHome': 'На главную',

  'rating.ariaLabel': '{{value}} из 5',
  'rating.title': '{{value}} / 5',

  'theme.changeTitle': 'Сменить цветовую палитру',
  'theme.toggleLabel': 'Палитра',
  'theme.menuAriaLabel': 'Цветовая палитра',
  'theme.default': 'по умолчанию',

  'lang.changeTitle': 'Сменить язык',

  'astro.prevMonth': 'Предыдущий месяц',
  'astro.nextMonth': 'Следующий месяц',
  'astro.noEvents': 'В этом месяце нет отмеченных событий.',
  'astro.note': 'Рассчитано по актуальной эфемериде · показано в вашем местном времени',
  'astro.cellAriaLabel': '{{day}}: {{events}}',

  'sidebar.title': 'Небесный альманах',
  'sidebar.intro': 'Как будто из уст самого Дарагана',
  'sidebar.missionLabel': 'Наша миссия',
  'sidebar.valuesLabel': 'Наши ценности',
  'sidebar.missionValuesLabel': 'Миссия и ценности',
  'sidebar.aboutLabel': 'О нас',
  'sidebar.aboutMore': 'Наша история →',
}

export default ru
