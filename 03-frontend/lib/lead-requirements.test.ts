// lib/lead-requirements.test.ts - Marketing service requirement workflow contracts
// License: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  buildMarketingRequirementDocument,
  buildMarketingRequirementPrompt,
  contractDraftFileName,
  createContractDraftRecord,
  createDesignConfirmationRecord,
  createMarketingRequirementRecord,
  createPrepaymentIntentRecord,
  designConfirmationFileName,
  prepaymentIntentFileName,
  parseMarketingRequirementContent,
  requirementFileName,
  type ConfirmedDesignOptionReference,
} from './lead-requirements';

describe('marketing service lead requirement contract', () => {
  it('captures structured location, building floors, architectural style and budget currency', () => {
    const requirement = createMarketingRequirementRecord({
      customerName: '张三',
      phone: '13800000000',
      geoLocationPath: ['中国', '广东省', '广州市', '天河区', '猎德街道'],
      buildingFloors: 3,
      buildingStructure: '钢结构',
      fireResistanceRating: '二级',
      seismicIntensity: '7度',
      architecturalStyle: '新中式',
      budget: 800000,
      budgetCurrency: 'USD',
      documentTemplateId: 'custom',
      customTemplateName: '海外酒店客户模板.docx',
      customTemplateNotes: '保留英文签署区和美元预算字段',
    }, new Date('2026-05-20T01:02:03.000Z'));

    expect(requirement.geoLocation).toBe('中国 / 广东省 / 广州市 / 天河区 / 猎德街道');
    expect(requirement.buildingFloors).toBe(3);
    expect(requirement.budgetCurrency).toBe('USD');
    expect(requirement.documentTemplate.name).toBe('海外酒店客户模板.docx');
    expect(requirement.architecturalStyle).toBe('新中式');
    expect(requirementFileName(requirement)).toBe('客户需求包-2026-05-20-张三.docx');
    const prompt = buildMarketingRequirementPrompt(requirement);
    expect(prompt).toContain('建筑层数: 3 层');
    expect(prompt).toContain('建筑风格: 新中式');
    expect(prompt).toContain('资金预算: 800000 USD');
    const document = buildMarketingRequirementDocument(requirement);
    expect(document).toContain('data-architoken-payload="architoken.marketing_requirement.v1"');
    expect(parseMarketingRequirementContent(document)?.customerName).toBe('张三');
  });

  it('requires design confirmation and contract draft before deposit intent', () => {
    const requirement = createMarketingRequirementRecord({
      customerName: '李四',
      phone: '13900000000',
      geoLocationPath: ['中国', '浙江省', '杭州市', '西湖区', '转塘街道'],
    }, new Date('2026-05-20T02:00:00.000Z'));
    const selectedOption: ConfirmedDesignOptionReference = {
      id: 'scheme-a',
      title: '方案 A: 新中式 · 成本均衡方案',
      artifactFileId: 'concept-option-file-1',
    };

    const confirmation = createDesignConfirmationRecord({
      requirement,
      requirementFileId: 'requirement-file-1',
      selectedOption,
      now: new Date('2026-05-20T03:00:00.000Z'),
    });
    const contract = createContractDraftRecord({
      requirement,
      requirementFileId: 'requirement-file-1',
      confirmation,
      confirmationFileId: 'confirmation-file-1',
      now: new Date('2026-05-20T04:00:00.000Z'),
    });
    const deposit = createPrepaymentIntentRecord({
      requirement,
      requirementFileId: 'requirement-file-1',
      amount: 5000,
      method: 'wechat_pay',
      confirmedDesignOption: {
        ...selectedOption,
        confirmationFileId: 'confirmation-file-1',
        contractDraftFileId: 'contract-file-1',
      },
      now: new Date('2026-05-20T05:00:00.000Z'),
    });

    expect(confirmation.status).toBe('customer_confirmed_draft_assist');
    expect(confirmation.professionalReviewRequired).toBe(true);
    expect(designConfirmationFileName(confirmation)).toBe('客户确认方案-2026-05-20-李四.docx');
    expect(contract.status).toBe('draft_assist');
    expect(contract.eSignature.providerAdapterRequired).toBe(true);
    expect(contractDraftFileName(contract)).toBe('电子合同草案-2026-05-20-李四.docx');
    expect(deposit.confirmedDesignOption?.confirmationFileId).toBe('confirmation-file-1');
    expect(deposit.confirmedDesignOption?.contractDraftFileId).toBe('contract-file-1');
    expect(prepaymentIntentFileName(deposit)).toBe('意向定金支付意向-2026-05-20-李四.docx');
  });
});
