import type { ShowcaseScreen } from "@/lib/insome/types";

// TODO(phase-4): replace with /api/showcase?product=studio live data once CMS lands
export const studioShowcaseScreens: ReadonlyArray<ShowcaseScreen> = [
  {
    id: "projects",
    titleKey: "studio.projectsTitle",
    captionKey: "studio.projectsCaption",
    svgPath: "/assets/showcase/studio-01-projects.svg",
    aspect: "3/2",
  },
  {
    id: "create",
    titleKey: "studio.createTitle",
    captionKey: "studio.createCaption",
    svgPath: "/assets/showcase/studio-02-create.svg",
    aspect: "3/2",
  },
  {
    id: "params",
    titleKey: "studio.paramsTitle",
    captionKey: "studio.paramsCaption",
    svgPath: "/assets/showcase/studio-03-params.svg",
    aspect: "3/2",
  },
  {
    id: "proposals",
    titleKey: "studio.proposalsTitle",
    captionKey: "studio.proposalsCaption",
    svgPath: "/assets/showcase/studio-04-proposals.svg",
    aspect: "3/2",
  },
  {
    id: "editor2d",
    titleKey: "studio.editor2dTitle",
    captionKey: "studio.editor2dCaption",
    svgPath: "/assets/showcase/studio-05-editor2d.svg",
    aspect: "3/2",
  },
  {
    id: "objects",
    titleKey: "studio.objectsTitle",
    captionKey: "studio.objectsCaption",
    svgPath: "/assets/showcase/studio-06-objects.svg",
    aspect: "3/2",
  },
  {
    id: "appearance",
    titleKey: "studio.appearanceTitle",
    captionKey: "studio.appearanceCaption",
    svgPath: "/assets/showcase/studio-07-appearance.svg",
    aspect: "3/2",
  },
  {
    id: "camera3d",
    titleKey: "studio.camera3dTitle",
    captionKey: "studio.camera3dCaption",
    svgPath: "/assets/showcase/studio-08-camera3d.svg",
    aspect: "3/2",
  },
  {
    id: "walkthrough",
    titleKey: "studio.walkthroughTitle",
    captionKey: "studio.walkthroughCaption",
    svgPath: "/assets/showcase/studio-09-walkthrough.svg",
    aspect: "3/2",
  },
  {
    id: "export",
    titleKey: "studio.exportTitle",
    captionKey: "studio.exportCaption",
    svgPath: "/assets/showcase/studio-10-export.svg",
    aspect: "3/2",
  },
];
