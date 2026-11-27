import { domainLabels, getCatalog } from "../lib/catalog";

export const dynamic = "force-dynamic";

function consoleUrl(): string {
  const fallback = "http://localhost:5173";
  try {
    const url = new URL(process.env.VOLT_CONSOLE_URL ?? fallback);
    return ["https:", "http:"].includes(url.protocol) ? url.href : fallback;
  } catch {
    return fallback;
  }
}

export default async function Home() {
  const catalog = await getCatalog();
  return (
    <main id="main" className="frame pb-16">
      <section className="intro" aria-labelledby="page-title">
        <p className="label eyebrow">Finance operations</p>
        <h1 id="page-title">Foundation status</h1>
        <p className="subtle">Check registry coverage here. Use VOLT to find finance skills.</p>
        <a className="console-link" href={consoleUrl()}>Open VOLT console <span aria-hidden="true">↗</span></a>
      </section>
      {!catalog.ok ? (
        <section className="notice" aria-labelledby="error-title">
          <h2 id="error-title">Registry unavailable</h2>
          <p>Coverage is unknown. Check that the Gyan Agents API is running, then reload this page.</p>
          <form action="/" method="get"><button type="submit" className="retry">Reload status</button></form>
        </section>
      ) : (
        <section className="domain" aria-labelledby="coverage-title">
          <div className="domain-heading">
            <p className="label eyebrow">Registry connected</p>
            <h2 id="coverage-title">Domain coverage</h2>
            <p className="subtle">{catalog.agents.length === 0
              ? "No finance profiles registered."
              : "Finance profiles mapped to existing VOLT agents. Counts do not indicate execution readiness."}</p>
          </div>
          <dl className="entries">
            {Object.entries(domainLabels).map(([domain, label]) => {
              const count = catalog.agents.filter((agent) => agent.domain === domain).length;
              return (
                <div key={domain} className="entry flex items-baseline justify-between gap-4">
                  <dt>{label}</dt>
                  <dd className="count shrink-0">{count} {count === 1 ? "profile" : "profiles"}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}
    </main>
  );
}
