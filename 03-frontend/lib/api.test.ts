import { describe, expect, it } from 'vitest';

import { camelizeKeys, toProjectCreatePayload } from './api';

describe('camelizeKeys', () => {
  it('converts nested snake_case payloads into camelCase', () => {
    const normalized = camelizeKeys<{
      currentModuleId: string;
      trace: { createdAt: string }[];
    }>({
      current_module_id: 'concept_design',
      trace: [{ created_at: '2026-04-24T00:00:00Z' }],
    });

    expect(normalized).toEqual({
      currentModuleId: 'concept_design',
      trace: [{ createdAt: '2026-04-24T00:00:00Z' }],
    });
  });
});

describe('toProjectCreatePayload', () => {
  it('maps frontend project fields to API snake_case fields', () => {
    expect(
      toProjectCreatePayload({
        name: '锦屏示范项目',
        currentModuleId: 'concept_design',
        areaSqm: 520,
        budgetCny: 680000,
      }),
    ).toEqual({
      name: '锦屏示范项目',
      description: undefined,
      current_module_id: 'concept_design',
      area_sqm: 520,
      location: undefined,
      budget_cny: 680000,
    });
  });
});
