import { getPage, getSite } from '../lib/content'
import { PageHead } from '../lib/head'
import { useI18n } from '../lib/i18n'
import Markdown from '../components/Markdown'
import CopyButton from '../components/CopyButton'
import NotFound from './NotFound'

// The Support / donations page. Payment methods are driven by the `support:`
// block in site.yaml (non-localized config, authored once in en/) so the wallet
// addresses live in exactly one place; the intro prose stays in the markdown
// page (content-as-data) and the labels come from UI strings.
export default function Support() {
  const { t, locale } = useI18n()
  const page = getPage(locale, 'support')
  if (!page) return <NotFound />

  const { support } = getSite(locale)

  return (
    <article className="detail">
      <PageHead title={page.title} />
      <h1>{page.title}</h1>
      <Markdown html={page.html} />

      {support && (
        <div className="support-grid">
          <section className="support-card">
            <h2 className="support-card-title">{t('support.cardTitle')}</h2>
            <p>{t('support.cardText')}</p>
            {support.stripe ? (
              <a
                className="support-btn support-btn-paypal"
                href={support.stripe}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('support.cardCta')}
              </a>
            ) : (
              <span className="support-btn support-btn-soon" aria-disabled="true">
                {t('support.comingSoon')}
              </span>
            )}
          </section>

          {support.paypal && (
            <section className="support-card">
              <h2 className="support-card-title">{t('support.paypalTitle')}</h2>
              <p>{t('support.paypalText')}</p>
              <a
                className="support-btn support-btn-paypal"
                href={`https://www.paypal.com/paypalme/${support.paypal}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('support.paypalCta')}
              </a>
            </section>
          )}

          {support.crypto && support.crypto.length > 0 && (
            <section className="support-card">
              <h2 className="support-card-title">{t('support.cryptoTitle')}</h2>
              <p>
                {t('support.cryptoIntro')} <strong>{t('support.cryptoWarn')}</strong>
              </p>
              {support.crypto.map((wallet) => (
                <div className="crypto-row" key={`${wallet.coin}-${wallet.network}`}>
                  <div className="crypto-head">
                    <span className="crypto-coin">{wallet.coin}</span>
                    <span className="crypto-net">{wallet.network}</span>
                  </div>
                  <div className="crypto-addr-wrap">
                    <code className="crypto-addr">{wallet.address}</code>
                    <CopyButton
                      className="crypto-copy"
                      value={wallet.address}
                      ariaLabel={`${t('copy.copy')} ${wallet.coin}`}
                    />
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      <p className="support-thanks">{t('support.thanks')}</p>
    </article>
  )
}
