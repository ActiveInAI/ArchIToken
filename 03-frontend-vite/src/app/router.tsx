import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { Layout } from "../components/Layout";
import { AdminPage } from "../pages/AdminPage";
import { AiPage } from "../pages/AiPage";
import { AssetsPage } from "../pages/AssetsPage";
import { CadPage } from "../pages/CadPage";
import { DocumentsPage } from "../pages/DocumentsPage";
import { FlowPage } from "../pages/FlowPage";
import { GanttPage } from "../pages/GanttPage";
import { GisPage } from "../pages/GisPage";
import { OpenBimPage } from "../pages/OpenBimPage";
import { RuntimePage } from "../pages/RuntimePage";

const rootRoute = createRootRoute({
  component: Layout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/assets" });
  },
});

const assetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/assets",
  component: AssetsPage,
});

const aiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ai",
  component: AiPage,
});

const openBimRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/openbim",
  component: OpenBimPage,
});

const cadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cad",
  component: CadPage,
});

const gisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gis",
  component: GisPage,
});

const documentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/documents",
  component: DocumentsPage,
});

const ganttRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gantt",
  component: GanttPage,
});

const flowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/flow",
  component: FlowPage,
});

const runtimeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/runtime",
  component: RuntimePage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  assetsRoute,
  aiRoute,
  openBimRoute,
  cadRoute,
  gisRoute,
  documentsRoute,
  ganttRoute,
  flowRoute,
  runtimeRoute,
  adminRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
