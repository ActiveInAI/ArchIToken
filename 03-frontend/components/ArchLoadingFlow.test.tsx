// components/ArchLoadingFlow.test.tsx - loading rainbow bridge contract tests
// License: Apache-2.0
// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ArchLoadingFlow } from "./ArchLoadingFlow";

afterEach(() => {
  cleanup();
});

describe("ArchLoadingFlow rainbow bridge", () => {
  it("renders a continuous five-arch rainbow bridge without percentage text by default", () => {
    const { container } = render(
      <ArchLoadingFlow label="正在请求 PanAEC Engine RVT 真实解析" size="panel" />,
    );

    const status = screen.getByRole("status", {
      name: "正在请求 PanAEC Engine RVT 真实解析",
    });
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(container.textContent).not.toContain("%");

    const svg = container.querySelector(".arch-loading-flow__bridge");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 240 34");

    const stripes = container.querySelectorAll(".arch-loading-flow__stripe");
    expect(stripes).toHaveLength(7);

    const firstPath = stripes[0]?.getAttribute("d") ?? "";
    expect(firstPath.match(/\bA\b/g)).toHaveLength(5);
    expect(firstPath.match(/\bL\b/g)).toHaveLength(4);
    expect(firstPath.match(/\bC\b/g)).toBeNull();
    expect(firstPath).toContain("M 10 30");
    expect(firstPath).toContain("A 22 22 0 0 1");

    expect(container.querySelector(".arch-loading-flow__flow")).toBeNull();
  });

  it("moves the rainbow body itself with a 0.8 second repeated gradient cycle", () => {
    const { container } = render(<ArchLoadingFlow label="加载中" />);

    const gradients = container.querySelectorAll("linearGradient");
    expect(gradients).toHaveLength(7);

    const firstGradient = gradients[0];
    expect(firstGradient?.getAttribute("spreadMethod")).toBe("repeat");
    expect(firstGradient?.getAttribute("color-interpolation")).toBe("sRGB");
    expect(firstGradient?.querySelectorAll("stop")).toHaveLength(5);

    const motion = firstGradient?.querySelector(
      ".arch-loading-flow__gradient-motion",
    );
    expect(motion?.getAttribute("type")).toBe("translate");
    expect(motion?.getAttribute("from")).toBe("0 0");
    expect(motion?.getAttribute("to")).toBe("96 0");
    expect(motion?.getAttribute("dur")).toBe("0.8s");
    expect(motion?.getAttribute("repeatCount")).toBe("indefinite");
    expect(motion?.hasAttribute("values")).toBe(false);
  });

  it("only shows progress when explicitly requested", () => {
    render(
      <ArchLoadingFlow
        label="加载中"
        progress={42}
        showProgress
        size="compact"
      />,
    );

    expect(screen.getByRole("status", { name: "加载中 42%" })).toBeTruthy();
    expect(screen.getByText("42%")).toBeTruthy();
  });

  it("keeps CSS free of overlay-flow effects and honors reduced motion", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), {
      encoding: "utf8",
    });

    expect(css).toContain(".arch-loading-flow__stripe");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(".arch-loading-flow__gradient-motion");
    expect(css).not.toContain(".arch-loading-flow__flow");
    expect(css).not.toContain("stroke: rgba(255, 255, 255, 0.78)");
  });
});
