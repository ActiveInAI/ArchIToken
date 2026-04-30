import { Link, Outlet } from "@tanstack/react-router";
import { workbenchRoutes } from "../data/navigation";
import { backendBaseUrl } from "../lib/backendClient";
import { useWorkbenchStore, type WorkbenchContext } from "../state/workbenchStore";

const contextFields: Array<{ field: keyof WorkbenchContext; label: string }> = [
  { field: "tenantId", label: "Tenant" },
  { field: "projectId", label: "Project" },
  { field: "actor", label: "Actor" },
  { field: "roles", label: "Roles" },
];

export function Layout() {
  const context = useWorkbenchStore((state) => state.context);
  const setContextField = useWorkbenchStore((state) => state.setContextField);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>ArchIToken</strong>
          <span>Phase 7 Open AEC Universal Runtime</span>
        </div>
        <nav className="nav" aria-label="Workbench sections">
          {workbenchRoutes.map((route) => (
            <Link
              key={route.path}
              to={route.path}
              activeProps={{ className: "active" }}
              activeOptions={{ exact: route.path === "/assets" }}
            >
              {route.label}
            </Link>
          ))}
        </nav>
        <section className="context-card" aria-label="Runtime context">
          <div>
            <strong>Runtime Context</strong>
            <div className="runtime-note">API: {backendBaseUrl}</div>
          </div>
          {contextFields.map(({ field, label }) => (
            <label className="field" key={field}>
              <span className="label">{label}</span>
              <input
                value={context[field]}
                onChange={(event) => setContextField(field, event.target.value)}
              />
            </label>
          ))}
        </section>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
