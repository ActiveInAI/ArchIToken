// lib/project-digital-archive.test.ts - Project/archive alignment tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  createInitialModuleFileNodes,
  getModuleRootId,
} from "./module-file-system";
import {
  getDigitalArchiveProjectFolderId,
  getVisibleProjectManagementProjects,
} from "./project-management-data";

describe("project management digital archive alignment", () => {
  it("uses project folders as the digital archive root directories", () => {
    const rootId = getModuleRootId("digital_archive");
    const archiveRootChildren = createInitialModuleFileNodes().filter(
      (node) => node.moduleId === "digital_archive" && node.parentId === rootId,
    );
    const visibleProjects = getVisibleProjectManagementProjects();

    expect(archiveRootChildren.map((node) => node.id)).toEqual(
      visibleProjects.map((project) =>
        getDigitalArchiveProjectFolderId(project.id),
      ),
    );
    expect(archiveRootChildren.map((node) => node.name)).toEqual(
      visibleProjects.map((project) => project.name),
    );
    expect(
      archiveRootChildren.every((node) =>
        node.tags.includes("project-archive"),
      ),
    ).toBe(true);
    expect(archiveRootChildren.map((node) => node.name)).not.toEqual(
      expect.arrayContaining([
        "版本链",
        "竣工资料",
        "质量安全",
        "图纸档案",
        "模型档案",
      ]),
    );
  });
});
