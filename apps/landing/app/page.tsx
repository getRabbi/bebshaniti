const features = [
  {
    index: "01",
    title: "Fast counter sales",
    copy: "Retail and wholesale checkout, flexible payments, due sales and clear cash memos from one workflow."
  },
  {
    index: "02",
    title: "Stock you can trust",
    copy: "Track every receive, sale, transfer and adjustment across shops and warehouses with an audit trail."
  },
  {
    index: "03",
    title: "Due / baki control",
    copy: "Know who owes what, record collections and keep customer statements understandable for everyone."
  },
  {
    index: "04",
    title: "Purchasing and suppliers",
    copy: "Follow purchasing, receiving, supplier balances and payments without scattered notebooks."
  },
  {
    index: "05",
    title: "Owner oversight",
    copy: "See branch activity, staff access, cash movement and operational reports wherever you are."
  },
  {
    index: "06",
    title: "Ready for weak internet",
    copy: "The platform is designed around Bangladesh's real connectivity and multi-device operating conditions."
  }
] as const;

const fit = [
  "Retail shops and showrooms",
  "Wholesale and distribution",
  "Multi-branch businesses",
  "Warehouses and stock points"
] as const;

export default function HomePage() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="status-pill"><span />Built for businesses in Bangladesh</div>
            <h1>Run every part of your business with clarity.</h1>
            <p className="lead hero-lead">
              Sales, inventory, due/baki, purchasing and owner reporting—connected in one secure
              operating system for retail and wholesale teams.
            </p>
            <div className="hero-actions">
              <a className="button button-large" href="#contact">Plan your rollout</a>
              <a className="text-link" href="#platform">Explore the platform <span>→</span></a>
            </div>
            <div className="trust-row" aria-label="Platform qualities">
              <span>Tenant isolated</span><span>Audit ready</span><span>Bangladesh focused</span>
            </div>
          </div>

          <div className="product-preview" aria-label="Business dashboard preview">
            <div className="preview-topbar">
              <div className="preview-brand"><span className="brand-mark">B</span> Business OS</div>
              <span className="preview-chip">Live operations</span>
            </div>
            <div className="preview-body">
              <aside className="preview-nav" aria-hidden="true">
                <span className="active" /><span /><span /><span /><span />
              </aside>
              <div className="preview-content">
                <div className="preview-heading"><div><small>OWNER OVERVIEW</small><strong>Good morning</strong></div><i /></div>
                <div className="preview-metrics">
                  <div><small>Sales today</small><strong>Synced securely</strong><em className="bar bar-wide" /></div>
                  <div><small>Stock alerts</small><strong>Action focused</strong><em className="bar" /></div>
                  <div><small>Due control</small><strong>Ledger backed</strong><em className="bar bar-mid" /></div>
                </div>
                <div className="preview-chart">
                  <div className="chart-head"><span>Business activity</span><small>All branches</small></div>
                  <div className="chart-lines" aria-hidden="true">
                    <i style={{ height: "32%" }} /><i style={{ height: "51%" }} /><i style={{ height: "44%" }} />
                    <i style={{ height: "69%" }} /><i style={{ height: "58%" }} /><i style={{ height: "81%" }} />
                    <i style={{ height: "72%" }} /><i style={{ height: "91%" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="fit-strip">
        <div className="container fit-row">
          <p>Designed for</p>
          {fit.map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      <section className="section" id="platform">
        <div className="container">
          <div className="section-heading split-heading">
            <div><p className="eyebrow">One connected platform</p><h2>Control the work that moves your business.</h2></div>
            <p className="lead">Replace disconnected apps and manual records with workflows built around how shops, distributors and warehouses actually operate.</p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <span className="feature-index">{feature.index}</span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section dark-section" id="operations">
        <div className="container operations-grid">
          <div>
            <p className="eyebrow eyebrow-light">Built around real operations</p>
            <h2>From the counter to the owner&apos;s screen.</h2>
            <p className="lead light-copy">Each role sees the tools it needs. Every important action stays tied to the right organization, branch and person.</p>
          </div>
          <div className="workflow-list">
            <article><span>01</span><div><h3>Set up the business</h3><p>Map branches, devices, staff access, products and opening stock before go-live.</p></div></article>
            <article><span>02</span><div><h3>Operate with confidence</h3><p>Sell, receive stock, collect due and manage daily work through permission-aware workflows.</p></div></article>
            <article><span>03</span><div><h3>Review and improve</h3><p>Use ledgers, reports and audit history to understand performance and act early.</p></div></article>
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="container">
          <div className="section-heading centered">
            <p className="eyebrow">A practical service model</p>
            <h2>Start with what your business needs.</h2>
            <p className="lead">Licensing and rollout are scoped around locations, devices, data migration and the modules your team will use.</p>
          </div>
          <div className="plan-grid">
            <article className="plan-card">
              <p className="plan-label">STARTER</p><h3>Single shop</h3>
              <p>Core sales, stock and due/baki workflows for one operating location.</p>
              <ul><li>One shop setup</li><li>Core business modules</li><li>Team onboarding</li></ul>
            </article>
            <article className="plan-card featured-plan">
              <p className="plan-label">BUSINESS</p><h3>Growing operation</h3>
              <p>More devices, deeper operations and owner visibility for an expanding team.</p>
              <ul><li>Multi-device access</li><li>Purchasing and expenses</li><li>Owner reporting</li></ul>
            </article>
            <article className="plan-card">
              <p className="plan-label">CUSTOM</p><h3>Multi-branch</h3>
              <p>Configured workflows for branches, warehouses, wholesale and complex rollout needs.</p>
              <ul><li>Branch controls</li><li>Data migration support</li><li>Custom rollout plan</li></ul>
            </article>
          </div>
        </div>
      </section>

      <section className="section contact-section" id="contact">
        <div className="container contact-card">
          <div>
            <p className="eyebrow eyebrow-light">Start with a clear plan</p>
            <h2>Tell us how your business operates.</h2>
            <p>We&apos;ll map the right setup for your branches, devices, team and current data before activation.</p>
          </div>
          <div className="contact-actions">
            {contactEmail ? (
              <a className="button button-light button-large" href={`mailto:${contactEmail}?subject=Business%20OS%20rollout%20consultation`}>Request a consultation</a>
            ) : (
              <span className="button button-light button-large button-unavailable">Contact channel is being configured</span>
            )}
            <p>{contactEmail ? `Email ${contactEmail}` : "Set NEXT_PUBLIC_CONTACT_EMAIL before launch."}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
