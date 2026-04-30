import { PageHero } from "../components/PageHero";
import { runtimeStack } from "../lib/runtimeIntegrations";

export function AdminPage() {
  return (
    <>
      <PageHero
        eyebrow="Tenant Guard"
        title="Admin"
        summary="Runtime context, RBAC role policy, integration posture, and security boundary visibility for dev operators."
        tags={["production strict", "no proprietary core", "license CI"]}
      />
      <div className="grid">
        {Object.entries(runtimeStack).map(([group, items]) => (
          <section className="panel" key={group}>
            <h2>{group}</h2>
            <div className="badge-row">
              {items.map((item) => (
                <span className="badge" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
