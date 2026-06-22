const plannedBrains = [
  { name: 'Haley', role: 'Master coordinator', access: 'Owner' },
  { name: 'Scarlett X', role: 'Subscriber experience', access: 'Private' },
  { name: 'Hope S', role: 'Security monitoring', access: 'Service' },
  { name: 'Hope Tech', role: 'Technical support', access: 'Service' },
  { name: 'Trading', role: 'Market analysis', access: 'Service' },
  { name: 'Development', role: 'Code generation', access: 'Service' },
]

const plannedServices = [
  'AI brain orchestration',
  'Video generation and media production',
  'Domains, hosting, and e-commerce',
  'Real estate and vehicle marketplaces',
  'Wallet and blockchain tools',
  'Trading and market analytics',
  'Identity and verification',
  'Security, incident response, and kill switches',
]

export default function Home() {
  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <img
            className="brand-logo"
            src="/xaicore-logo.jpg"
            alt="XAICore"
          />
          <p className="eyebrow">Gate 0 Platform Foundation</p>
          <h1>Hope AI Powered Ecosystem</h1>
          <p className="hero-copy">
            XAICore is building a human-first AI ecosystem on a secure,
            owner-controlled foundation. The broader AI, creative, marketplace,
            financial, and business capabilities remain on the product roadmap and
            are not active in this Gate 0 build.
          </p>
          <div className="actions">
            <a href="/api/health">API health</a>
            <a href="https://xaicore.dev" rel="noreferrer" target="_blank">
              xaicore.dev
            </a>
          </div>
        </div>

        <div className="status-panel" aria-label="Platform status">
          <div>
            <span>Frontend</span>
            <strong>React + Vite</strong>
          </div>
          <div>
            <span>Backend</span>
            <strong>Express API</strong>
          </div>
          <div>
            <span>Database</span>
            <strong>Prisma draft</strong>
          </div>
          <div>
            <span>Roadmap</span>
            <strong>Contract foundation</strong>
          </div>
          <div>
            <span>Feature Scope</span>
            <strong>Business features disabled</strong>
          </div>
        </div>
      </section>

      <section className="content-grid" aria-label="Platform overview">
        <div className="panel wide">
          <div className="section-heading">
            <p className="eyebrow">Brain Control</p>
            <h2>Planned AI roster</h2>
          </div>
          <div className="brain-grid">
            {plannedBrains.map((brain) => (
              <article className="brain-card" key={brain.name}>
                <div>
                  <h3>{brain.name}</h3>
                  <p>{brain.role}</p>
                </div>
                <span>{brain.access}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="section-heading">
            <p className="eyebrow">Services</p>
            <h2>Roadmap modules</h2>
          </div>
          <ul className="service-list">
            {plannedServices.map((service) => (
              <li key={service}>{service}</li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <div className="section-heading">
            <p className="eyebrow">Current Scope</p>
            <h2>Gate 0 stabilization</h2>
          </div>
          <p>
            Active work is limited to platform contracts, secure engineering
            defaults, documentation, and quality gates. Identity, Owner authority,
            persistence, and audit enforcement require Gate 1 approval.
          </p>
        </div>
      </section>
    </main>
  )
}
