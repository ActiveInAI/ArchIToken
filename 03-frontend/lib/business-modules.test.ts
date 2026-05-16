// lib/business-modules.test.ts - Business module workbench contract tests
// License: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  businessModules,
  getBusinessModule,
  getModuleDependencyIssues,
  getModuleReadinessScore,
} from './business-modules';
import type { ModuleId } from './api';

const expectedModuleIds: ModuleId[] = [
  'marketing_service',
  'planning_management',
  'concept_design',
  'standard_library',
  'detailed_design',
  'quantity_costing',
  'material_logistics',
  'production_manufacturing',
  'construction_management',
  'digital_twin',
  'digital_archive',
  'finance_hr',
  'ai_center',
  'settings_center',
];

describe('business module workbench contract', () => {
  it('covers the 14 module registry in MODULES.md order', () => {
    expect(businessModules.map((spec) => spec.id)).toEqual(expectedModuleIds);
    expect(businessModules.map((spec) => spec.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it('keeps every module development-ready with artifacts, AI capabilities, standards, gates, and data objects', () => {
    for (const spec of businessModules) {
      expect(spec.zhName.length).toBeGreaterThan(1);
      expect(spec.enName.length).toBeGreaterThan(3);
      expect(spec.summary.length).toBeGreaterThan(20);
      expect(spec.primaryArtifacts.length).toBeGreaterThan(0);
      expect(spec.aiCapabilities.length).toBeGreaterThan(0);
      expect(spec.standards.length).toBeGreaterThan(0);
      expect(spec.qualityGates.length).toBeGreaterThan(0);
      expect(spec.dataObjects.length).toBeGreaterThan(0);
      expect(spec.routeHref).toBe(`/app/modules/${spec.id}`);
    }
  });

  it('keeps module dependencies internally valid', () => {
    expect(getModuleDependencyIssues()).toEqual([]);
  });

  it('links the digital twin module to its approved cockpit and Markdown contract', () => {
    const digitalTwin = getBusinessModule('digital_twin');
    expect(digitalTwin.routeHref).toBe('/app/modules/digital_twin');
    expect(digitalTwin.contractHref).toBe('/02-architecture/DIGITAL_TWIN.md');
    expect(digitalTwin.standards).toContain('IFC4.3');
    expect(digitalTwin.qualityGates.join(' ')).toContain('Schema');
  });

  it('reports a readiness score for the active module workbench prototype', () => {
    expect(getModuleReadinessScore()).toBeGreaterThan(50);
    expect(getModuleReadinessScore()).toBeLessThanOrEqual(100);
  });
});
