"use client";

import { DesignerLevelCard } from "./designer-level-card";
import { WorkspaceActions } from "./workspace-actions";
import { PeerFeed } from "./peer-feed";
import { LandingFooter } from "@/components/landing/landing-footer";

export function StudioWorkspaceHome() {
  return (
    <>
      <div className="mx-auto w-full max-w-section px-6 py-10">
        <div className="flex flex-col gap-8">
          <DesignerLevelCard />
          <WorkspaceActions />
          <PeerFeed />
        </div>
      </div>
      <LandingFooter theme="dark" />
    </>
  );
}
