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
  'home.readGuides': 'Читать гайды',
  'home.featuredReviews': 'Избранные обзоры',
  'home.allReviews': 'Все обзоры →',
  'home.latestGuides': 'Свежие гайды',
  'home.allGuides': 'Все гайды →',

  'reviews.title': 'Обзоры',
  'reviews.lead':
    'Каждая вещь здесь проехала с нами реальные километры — мы проверили материалы, безопасность и то, как она выдерживает дорожную жизнь с младенцем.',
  'reviews.filterAriaLabel': 'Фильтр по категории',
  'reviews.allCategory': 'Все',

  'guides.title': 'Гайды и чек-листы',
  'guides.lead':
    'Пока что здесь гайды от основателей — честный план, по которому мы строим этот сайт, в открытую. Со временем их сменят гайды для читателей, когда мы наберёмся опыта.',
  'guides.tag': 'Гайд',

  'reviewDetail.backLink': '← Все обзоры',
  'reviewDetail.checkPrice': 'Узнать текущую цену →',

  'guideDetail.backLink': '← Все гайды',

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
  'lang.toggleLabel': 'Язык',
  'lang.menuAriaLabel': 'Язык',

  'astro.prevMonth': 'Предыдущий месяц',
  'astro.nextMonth': 'Следующий месяц',
  'astro.noEvents': 'В этом месяце нет отмеченных событий.',
  'astro.note': 'Рассчитано по актуальной эфемериде · показано в вашем местном времени',
  'astro.cellAriaLabel': '{{day}}: {{events}}',

  'sidebar.title': 'Небесный альманах',
  'sidebar.intro': 'Как будто из уст самого Дарагана',
  'sidebar.missionLabel': 'Наша миссия',
  'sidebar.valuesLabel': 'Наши ценности',
}

export default ru
