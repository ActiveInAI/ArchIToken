// Marketing lead requirement records shared by module workbenches.
// License: Apache-2.0

export const marketingRequirementMimeType =
  'application/vnd.architoken.marketing-requirement+json';
export const prepaymentIntentMimeType =
  'application/vnd.architoken.prepayment-intent+json';

export type PrepaymentMethod =
  | 'jd_pay'
  | 'wechat_pay'
  | 'douyin_pay'
  | 'alipay'
  | 'unionpay'
  | 'credit_card'
  | 'paypal'
  | 'bank_transfer'
  | 'e_contract';

export interface MarketingRequirementFormValues {
  customerName: string;
  phone: string;
  geoLocation: string;
  buildingScale?: string;
  buildingStructure?: string;
  buildingArea?: number | null;
  fireResistanceRating?: string;
  seismicIntensity?: string;
  decorationStyle?: string;
  budget?: number | null;
  remarks?: string;
}

export interface MarketingRequirementRecord extends MarketingRequirementFormValues {
  schema: 'architoken.marketing_requirement.v1';
  id: string;
  sourceModuleId: 'marketing_service';
  targetModuleId: 'concept_design';
  createdAt: string;
  status: 'captured' | 'imported_to_concept_design';
  aiReadiness: {
    databaseBacked: boolean;
    generationMode: 'text_to_bim';
    preferredOutputs: string[];
  };
}

export interface PrepaymentIntentRecord {
  schema: 'architoken.prepayment_intent.v1';
  id: string;
  requirementId: string;
  requirementFileId: string;
  customerName: string;
  phone: string;
  amount: number;
  currency: string;
  method: PrepaymentMethod;
  status: 'pending_gateway' | 'pending_manual_review';
  gatewayAdapterRequired: boolean;
  eContract: {
    required: boolean;
    signature: 'electronic_seal';
    offlineStampAllowedAfterElectronicFlow: boolean;
  };
  createdAt: string;
  notes?: string;
}

export function createMarketingRequirementRecord(
  values: MarketingRequirementFormValues,
  now = new Date(),
): MarketingRequirementRecord {
  const createdAt = now.toISOString();
  const stableName = sanitizeRequirementName(values.customerName || '未命名客户');
  const record: MarketingRequirementRecord = {
    schema: 'architoken.marketing_requirement.v1',
    id: `lead-${createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)}-${stableName}`,
    sourceModuleId: 'marketing_service',
    targetModuleId: 'concept_design',
    createdAt,
    status: 'captured',
    customerName: values.customerName.trim(),
    phone: values.phone.trim(),
    geoLocation: values.geoLocation.trim(),
    aiReadiness: {
      databaseBacked: true,
      generationMode: 'text_to_bim',
      preferredOutputs: ['IFC4.3', 'GLB', 'fragments', 'properties-index'],
    },
  };
  const buildingScale = values.buildingScale?.trim();
  const buildingStructure = values.buildingStructure?.trim();
  const buildingArea = normalizeOptionalNumber(values.buildingArea);
  const fireResistanceRating = values.fireResistanceRating?.trim();
  const seismicIntensity = values.seismicIntensity?.trim();
  const decorationStyle = values.decorationStyle?.trim();
  const budget = normalizeOptionalNumber(values.budget);
  const remarks = values.remarks?.trim();

  if (buildingScale) record.buildingScale = buildingScale;
  if (buildingStructure) record.buildingStructure = buildingStructure;
  if (buildingArea !== undefined) record.buildingArea = buildingArea;
  if (fireResistanceRating) record.fireResistanceRating = fireResistanceRating;
  if (seismicIntensity) record.seismicIntensity = seismicIntensity;
  if (decorationStyle) record.decorationStyle = decorationStyle;
  if (budget !== undefined) record.budget = budget;
  if (remarks) record.remarks = remarks;

  return record;
}

export function requirementFileName(record: MarketingRequirementRecord): string {
  const date = record.createdAt.slice(0, 10);
  const customer = sanitizeRequirementName(record.customerName || '未命名客户');
  return `客户需求包-${date}-${customer}.json`;
}

export function createPrepaymentIntentRecord(input: {
  requirement: MarketingRequirementRecord;
  requirementFileId: string;
  amount: number;
  currency?: string;
  method: PrepaymentMethod;
  notes?: string;
  now?: Date;
}): PrepaymentIntentRecord {
  const createdAt = (input.now ?? new Date()).toISOString();
  const record: PrepaymentIntentRecord = {
    schema: 'architoken.prepayment_intent.v1',
    id: `deposit-${createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)}-${input.requirement.id}`,
    requirementId: input.requirement.id,
    requirementFileId: input.requirementFileId,
    customerName: input.requirement.customerName,
    phone: input.requirement.phone,
    amount: input.amount,
    currency: input.currency ?? 'CNY',
    method: input.method,
    status: 'pending_gateway',
    gatewayAdapterRequired: true,
    eContract: {
      required: true,
      signature: 'electronic_seal',
      offlineStampAllowedAfterElectronicFlow: true,
    },
    createdAt,
  };
  const notes = input.notes?.trim();
  if (notes) record.notes = notes;
  return record;
}

export function prepaymentIntentFileName(record: PrepaymentIntentRecord): string {
  const date = record.createdAt.slice(0, 10);
  const customer = sanitizeRequirementName(record.customerName || '未命名客户');
  return `预付定金意向-${date}-${customer}.json`;
}

export function isMarketingRequirementFile(input: {
  name: string;
  mimeType?: string | null;
  tags?: string[];
}): boolean {
  const tags = input.tags ?? [];
  return (
    input.mimeType === marketingRequirementMimeType ||
    tags.includes('marketing-requirement') ||
    tags.includes('concept-design-input') ||
    input.name.startsWith('客户需求包-')
  );
}

export function parseMarketingRequirementContent(
  content: string,
): MarketingRequirementRecord | null {
  try {
    const parsed = JSON.parse(content) as Partial<MarketingRequirementRecord>;
    if (
      parsed.schema !== 'architoken.marketing_requirement.v1' ||
      typeof parsed.customerName !== 'string' ||
      typeof parsed.phone !== 'string'
    ) {
      return null;
    }
    return parsed as MarketingRequirementRecord;
  } catch {
    return null;
  }
}

export function buildMarketingRequirementPrompt(
  record: MarketingRequirementRecord,
): string {
  const lines = [
    '你是 ArchIToken 方案设计模块的 Planner/Generator。',
    '请基于市场客服数据库需求包生成可进入 OpenBIM 工作流的三维方案模型初稿。',
    '输出优先级: IFC4.3 语义模型、轻量 GLB/fragments、构件属性索引、方案说明。',
    '',
    `客户姓名: ${record.customerName}`,
    `手机: ${record.phone}`,
    `地理位置: ${record.geoLocation}`,
    `建筑规模: ${record.buildingScale ?? '未填写'}`,
    `建筑结构: ${record.buildingStructure ?? '未填写'}`,
    `建筑面积: ${formatOptionalNumber(record.buildingArea, 'm2')}`,
    `耐火等级: ${record.fireResistanceRating ?? '未填写'}`,
    `设防烈度: ${record.seismicIntensity ?? '未填写'}`,
    `装修风格: ${record.decorationStyle ?? '未填写'}`,
    `资金预算: ${formatOptionalNumber(record.budget, '元')}`,
    `其它备注: ${record.remarks ?? '无'}`,
    '',
    '合规要求: 当前输出只能作为方案建议; 正式报审、结构、消防、造价和施工结论必须进入专业审核链。',
    '构件要求: 生成空间、楼层、墙、板、梁、柱、门窗、楼梯、机电预留等基础对象,并保留可追溯属性。',
  ];
  return lines.join('\n');
}

function normalizeOptionalNumber(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function formatOptionalNumber(value: number | null | undefined, unit: string): string {
  return typeof value === 'number' ? `${value} ${unit}` : '未填写';
}

function sanitizeRequirementName(value: string): string {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'lead';
}
