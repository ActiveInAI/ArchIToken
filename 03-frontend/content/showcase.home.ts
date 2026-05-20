import type { ShowcaseScreen } from "@/lib/insome/types";

// TODO(phase-4): replace with /api/showcase?product=home live data once CMS lands
export const homeShowcaseScreens: ReadonlyArray<ShowcaseScreen> = [
  {
    id: "dashboard",
    titleKey: "home.dashboardTitle",
    captionKey: "home.dashboardCaption",
    svgPath: "/assets/showcase/home-01-dashboard.svg",
    aspect: "3/2",
  },
  {
    id: "chat",
    titleKey: "home.chatTitle",
    captionKey: "home.chatCaption",
    svgPath: "/assets/showcase/home-02-chat.svg",
    aspect: "3/2",
  },
  {
    id: "canvas",
    titleKey: "home.canvasTitle",
    captionKey: "home.canvasCaption",
    svgPath: "/assets/showcase/home-03-canvas.svg",
    aspect: "3/2",
  },
  {
    id: "inspector",
    titleKey: "home.inspectorTitle",
    captionKey: "home.inspectorCaption",
    svgPath: "/assets/showcase/home-04-inspector.svg",
    aspect: "3/2",
  },
  {
    id: "render",
    titleKey: "home.renderTitle",
    captionKey: "home.renderCaption",
    svgPath: "/assets/showcase/home-05-render.svg",
    aspect: "3/2",
  },
  {
    id: "share",
    titleKey: "home.shareTitle",
    captionKey: "home.shareCaption",
    svgPath: "/assets/showcase/home-06-share.svg",
    aspect: "3/2",
  },
];
