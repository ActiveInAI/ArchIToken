// Marketing lead requirement records shared by module workbenches.
// License: Apache-2.0

export const marketingRequirementMimeType =
  'application/vnd.architoken.marketing-requirement+json';
export const prepaymentIntentMimeType =
  'application/vnd.architoken.prepayment-intent+json';
export const designConfirmationMimeType =
  'application/vnd.architoken.design-confirmation+json';
export const contractDraftMimeType =
  'application/vnd.architoken.contract-draft+json';
export const editableOfficeDocumentMimeType =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type MarketingDocumentTemplateId =
  | 'standard_requirement'
  | 'overseas_bilingual'
  | 'scheme_confirmation'
  | 'contract_draft'
  | 'custom';

export const marketingDocumentTemplates: Array<{
  id: MarketingDocumentTemplateId;
  name: string;
  description: string;
}> = [
  {
    id: 'standard_requirement',
    name: '客户需求标准模板',
    description: '适用于国内客户需求录入、方案生成和客服跟进。',
  },
  {
    id: 'overseas_bilingual',
    name: '海外客户双语模板',
    description: '适用于海外客户、跨币种预算和英文附件补充。',
  },
  {
    id: 'scheme_confirmation',
    name: '方案确认模板',
    description: '适用于客户确认建筑方案和后续合同准备。',
  },
  {
    id: 'contract_draft',
    name: '电子合同草案模板',
    description: '适用于电子签章前的合同条款草拟。',
  },
  {
    id: 'custom',
    name: '自定义模板',
    description: '按用户上传或指定的 Office/PDF 模板结构生成。',
  },
];

const defaultMarketingDocumentTemplate = marketingDocumentTemplates[0]!;

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

export type CurrencyCode =
  | 'CNY'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'AUD'
  | 'CAD'
  | 'HKD'
  | 'SGD'
  | 'JPY'
  | 'AED';

export interface MarketingRequirementFormValues {
  customerName: string;
  phone: string;
  geoLocationPath: string[];
  documentTemplateId?: MarketingDocumentTemplateId;
  customTemplateName?: string;
  customTemplateNotes?: string;
  buildingFloors?: number | null;
  buildingScale?: string;
  buildingStructure?: string;
  buildingArea?: number | null;
  fireResistanceRating?: string;
  seismicIntensity?: string;
  architecturalStyle?: string;
  budget?: number | null;
  budgetCurrency?: CurrencyCode;
  remarks?: string;
}

export interface ConfirmedDesignOptionReference {
  id: string;
  title: string;
  summary?: string;
  generationJobId?: string;
  artifactFileId?: string;
  confirmationFileId?: string;
  contractDraftFileId?: string;
}

export interface MarketingRequirementRecord {
  schema: 'architoken.marketing_requirement.v1';
  id: string;
  sourceModuleId: 'marketing_service';
  targetModuleId: 'concept_design';
  createdAt: string;
  status: 'captured' | 'imported_to_concept_design';
  customerName: string;
  phone: string;
  geoLocation: string;
  geoLocationPath?: string[];
  documentTemplate: {
    id: MarketingDocumentTemplateId;
    name: string;
    customNotes?: string;
  };
  buildingFloors?: number | null;
  buildingScale?: string;
  buildingStructure?: string;
  buildingArea?: number | null;
  fireResistanceRating?: string;
  seismicIntensity?: string;
  architecturalStyle?: string;
  decorationStyle?: string;
  budget?: number | null;
  budgetCurrency?: CurrencyCode;
  remarks?: string;
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
  currency: CurrencyCode;
  method: PrepaymentMethod;
  status: 'pending_gateway' | 'pending_manual_review';
  gatewayAdapterRequired: boolean;
  confirmedDesignOption?: ConfirmedDesignOptionReference;
  eContract: {
    required: boolean;
    signature: 'electronic_seal';
    offlineStampAllowedAfterElectronicFlow: boolean;
  };
  createdAt: string;
  notes?: string;
}

export interface MarketingDesignConfirmationRecord {
  schema: 'architoken.marketing_design_confirmation.v1';
  id: string;
  requirementId: string;
  requirementFileId: string;
  customerName: string;
  phone: string;
  selectedOption: ConfirmedDesignOptionReference;
  status: 'customer_confirmed_draft_assist';
  professionalReviewRequired: true;
  createdAt: string;
  evidence: {
    sourceRequirement: string;
    conceptOptionArtifact?: string;
    customerConfirmation: string;
  };
}

export interface MarketingContractDraftRecord {
  schema: 'architoken.marketing_contract_draft.v1';
  id: string;
  requirementId: string;
  requirementFileId: string;
  designConfirmationId: string;
  designConfirmationFileId: string;
  customerName: string;
  phone: string;
  selectedOption: ConfirmedDesignOptionReference;
  status: 'draft_assist';
  eSignature: {
    required: true;
    providerAdapterRequired: true;
    offlineStampAllowedAfterElectronicFlow: true;
  };
  professionalReviewRequired: true;
  clauses: Array<{
    title: string;
    summary: string;
  }>;
  createdAt: string;
}

export function createMarketingRequirementRecord(
  values: MarketingRequirementFormValues,
  now = new Date(),
): MarketingRequirementRecord {
  const createdAt = now.toISOString();
  const stableName = sanitizeRequirementName(values.customerName || '未命名客户');
  const geoLocationPath = (values.geoLocationPath ?? []).filter(Boolean).map((item) => item.trim());
  const record: MarketingRequirementRecord = {
    schema: 'architoken.marketing_requirement.v1',
    id: `lead-${createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)}-${stableName}`,
    sourceModuleId: 'marketing_service',
    targetModuleId: 'concept_design',
    createdAt,
    status: 'captured',
    customerName: values.customerName.trim(),
    phone: values.phone.trim(),
    geoLocation: geoLocationPath.join(' / '),
    geoLocationPath,
    documentTemplate: normalizeDocumentTemplate(values),
    aiReadiness: {
      databaseBacked: true,
      generationMode: 'text_to_bim',
      preferredOutputs: ['IFC4.3', 'GLB', 'fragments', 'properties-index'],
    },
  };
  const buildingScale = values.buildingScale?.trim();
  const buildingFloors = normalizeOptionalNumber(values.buildingFloors);
  const buildingStructure = values.buildingStructure?.trim();
  const buildingArea = normalizeOptionalNumber(values.buildingArea);
  const fireResistanceRating = values.fireResistanceRating?.trim();
  const seismicIntensity = values.seismicIntensity?.trim();
  const architecturalStyle = values.architecturalStyle?.trim();
  const budget = normalizeOptionalNumber(values.budget);
  const budgetCurrency = values.budgetCurrency ?? 'CNY';
  const remarks = values.remarks?.trim();

  if (buildingFloors !== undefined) record.buildingFloors = buildingFloors;
  if (buildingScale) record.buildingScale = buildingScale;
  if (buildingStructure) record.buildingStructure = buildingStructure;
  if (buildingArea !== undefined) record.buildingArea = buildingArea;
  if (fireResistanceRating) record.fireResistanceRating = fireResistanceRating;
  if (seismicIntensity) record.seismicIntensity = seismicIntensity;
  if (architecturalStyle) record.architecturalStyle = architecturalStyle;
  if (budget !== undefined) record.budget = budget;
  record.budgetCurrency = budgetCurrency;
  if (remarks) record.remarks = remarks;

  return record;
}

export function requirementFileName(record: MarketingRequirementRecord): string {
  const date = record.createdAt.slice(0, 10);
  const customer = sanitizeRequirementName(record.customerName || '未命名客户');
  return `客户需求包-${date}-${customer}.docx`;
}

export function createPrepaymentIntentRecord(input: {
  requirement: MarketingRequirementRecord;
  requirementFileId: string;
  amount: number;
  currency?: CurrencyCode;
  method: PrepaymentMethod;
  confirmedDesignOption?: ConfirmedDesignOptionReference;
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
  if (input.confirmedDesignOption) {
    record.confirmedDesignOption = input.confirmedDesignOption;
  }
  const notes = input.notes?.trim();
  if (notes) record.notes = notes;
  return record;
}

export function prepaymentIntentFileName(record: PrepaymentIntentRecord): string {
  const date = record.createdAt.slice(0, 10);
  const customer = sanitizeRequirementName(record.customerName || '未命名客户');
  return `意向定金支付意向-${date}-${customer}.docx`;
}

export function createDesignConfirmationRecord(input: {
  requirement: MarketingRequirementRecord;
  requirementFileId: string;
  selectedOption: ConfirmedDesignOptionReference;
  now?: Date;
}): MarketingDesignConfirmationRecord {
  const createdAt = (input.now ?? new Date()).toISOString();
  const record: MarketingDesignConfirmationRecord = {
    schema: 'architoken.marketing_design_confirmation.v1',
    id: `design-confirm-${createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)}-${input.requirement.id}`,
    requirementId: input.requirement.id,
    requirementFileId: input.requirementFileId,
    customerName: input.requirement.customerName,
    phone: input.requirement.phone,
    selectedOption: input.selectedOption,
    status: 'customer_confirmed_draft_assist',
    professionalReviewRequired: true,
    createdAt,
    evidence: {
      sourceRequirement: input.requirementFileId,
      customerConfirmation: input.selectedOption.id,
    },
  };
  if (input.selectedOption.artifactFileId) {
    record.evidence.conceptOptionArtifact = input.selectedOption.artifactFileId;
  }
  return record;
}

export function designConfirmationFileName(record: MarketingDesignConfirmationRecord): string {
  const date = record.createdAt.slice(0, 10);
  const customer = sanitizeRequirementName(record.customerName || '未命名客户');
  return `客户确认方案-${date}-${customer}.docx`;
}

export function createContractDraftRecord(input: {
  requirement: MarketingRequirementRecord;
  requirementFileId: string;
  confirmation: MarketingDesignConfirmationRecord;
  confirmationFileId: string;
  now?: Date;
}): MarketingContractDraftRecord {
  const createdAt = (input.now ?? new Date()).toISOString();
  return {
    schema: 'architoken.marketing_contract_draft.v1',
    id: `contract-draft-${createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)}-${input.requirement.id}`,
    requirementId: input.requirement.id,
    requirementFileId: input.requirementFileId,
    designConfirmationId: input.confirmation.id,
    designConfirmationFileId: input.confirmationFileId,
    customerName: input.requirement.customerName,
    phone: input.requirement.phone,
    selectedOption: input.confirmation.selectedOption,
    status: 'draft_assist',
    eSignature: {
      required: true,
      providerAdapterRequired: true,
      offlineStampAllowedAfterElectronicFlow: true,
    },
    professionalReviewRequired: true,
    clauses: [
      {
        title: '方案服务范围',
        summary: '基于客户确认的建筑方案草案开展后续方案深化、预算沟通和资料归档。',
      },
      {
        title: '意向定金边界',
        summary: '意向定金仅作为服务启动和资源预留凭据,正式合同、税务、结构和施工责任需后续专业审核确认。',
      },
      {
        title: '电子签章流程',
        summary: '合同草案进入电子合同和电子签章适配器;线下盖章只能作为电子流程完成后的补充归档。',
      },
    ],
    createdAt,
  };
}

export function contractDraftFileName(record: MarketingContractDraftRecord): string {
  const date = record.createdAt.slice(0, 10);
  const customer = sanitizeRequirementName(record.customerName || '未命名客户');
  return `电子合同草案-${date}-${customer}.docx`;
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
  const payload = extractEmbeddedArchitokenPayload(content, 'architoken.marketing_requirement.v1');
  try {
    const parsed = JSON.parse(payload ?? content) as Partial<MarketingRequirementRecord>;
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

export function buildMarketingRequirementDocument(record: MarketingRequirementRecord): string {
  const template = record.documentTemplate ?? defaultMarketingDocumentTemplate;
  return buildEditableOfficeHtml({
    title: `客户需求包 - ${record.customerName}`,
    subtitle: `${record.geoLocation || '项目位置未填写'} · ${template.name}`,
    schema: record.schema,
    payload: record,
    sections: [
      {
        title: '客户与项目基本信息',
        rows: [
          ['客户姓名', record.customerName],
          ['手机 / 微信', record.phone],
          ['地理位置', record.geoLocation],
          ['建筑层数', formatOptionalFloors(record.buildingFloors, record.buildingScale)],
          ['建筑结构', record.buildingStructure ?? '未填写'],
          ['建筑面积', formatOptionalNumber(record.buildingArea, 'm2')],
          ['耐火等级', record.fireResistanceRating ?? '未填写'],
          ['设防烈度', record.seismicIntensity ?? '未填写'],
          ['建筑风格', record.architecturalStyle ?? record.decorationStyle ?? '未填写'],
          ['资金预算', formatOptionalMoney(record.budget, record.budgetCurrency)],
        ],
      },
      {
        title: '需求备注与模板要求',
        paragraphs: [
          record.remarks ?? '无',
          template.customNotes
            ? `自定义模板要求: ${template.customNotes}`
            : `当前模板: ${template.name}`,
        ],
      },
      {
        title: 'AI 与专业复核边界',
        paragraphs: [
          '本文件用于方案设计模块生成建筑方案草案。当前输出不能作为报审、施工、消防、结构或造价结论。',
          '后续必须经过 Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver 链路和专业人员复核。',
        ],
      },
    ],
  });
}

export function buildDesignConfirmationDocument(record: MarketingDesignConfirmationRecord): string {
  return buildEditableOfficeHtml({
    title: `客户确认方案 - ${record.customerName}`,
    subtitle: record.selectedOption.title,
    schema: record.schema,
    payload: record,
    sections: [
      {
        title: '客户确认信息',
        rows: [
          ['客户姓名', record.customerName],
          ['手机 / 微信', record.phone],
          ['所选方案', record.selectedOption.title],
          ['状态', record.status],
          ['专业复核要求', record.professionalReviewRequired ? '必须复核' : '未要求'],
          ['确认时间', record.createdAt],
        ],
      },
      {
        title: '确认声明',
        paragraphs: [
          '客户仅确认当前方案草案作为后续深化和合同沟通的意向版本。',
          '正式报审、结构、消防、造价、施工、安全和税务责任必须以后续专业成果和正式合同为准。',
        ],
      },
    ],
  });
}

export function buildContractDraftDocument(record: MarketingContractDraftRecord): string {
  return buildEditableOfficeHtml({
    title: `电子合同草案 - ${record.customerName}`,
    subtitle: record.selectedOption.title,
    schema: record.schema,
    payload: record,
    sections: [
      {
        title: '合同草案摘要',
        rows: [
          ['客户姓名', record.customerName],
          ['手机 / 微信', record.phone],
          ['所选方案', record.selectedOption.title],
          ['状态', record.status],
          ['电子签章适配器', record.eSignature.providerAdapterRequired ? '待接入' : '已接入'],
          ['线下盖章', record.eSignature.offlineStampAllowedAfterElectronicFlow ? '仅作为电子流程后补充归档' : '不允许'],
        ],
      },
      {
        title: '草案条款',
        paragraphs: record.clauses.map((clause) => `${clause.title}: ${clause.summary}`),
      },
      {
        title: '专业复核边界',
        paragraphs: ['本合同草案为可编辑模板文件,正式签署前必须完成法务、财务、税务、技术和授权审批。'],
      },
    ],
  });
}

export function buildPrepaymentIntentDocument(record: PrepaymentIntentRecord): string {
  return buildEditableOfficeHtml({
    title: `意向定金支付意向 - ${record.customerName}`,
    subtitle: `${record.amount} ${record.currency} · ${record.method}`,
    schema: record.schema,
    payload: record,
    sections: [
      {
        title: '支付意向',
        rows: [
          ['客户姓名', record.customerName],
          ['手机 / 微信', record.phone],
          ['金额', `${record.amount} ${record.currency}`],
          ['支付方式', record.method],
          ['状态', record.status],
          ['支付网关适配器', record.gatewayAdapterRequired ? '待接入真实支付网关' : '已接入'],
          ['已确认方案', record.confirmedDesignOption?.title ?? '未绑定'],
        ],
      },
      {
        title: '备注',
        paragraphs: [record.notes ?? '无', '本文件仅记录支付意向,不得作为支付成功凭证。'],
      },
    ],
  });
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
    `建筑层数: ${formatOptionalFloors(record.buildingFloors, record.buildingScale)}`,
    `建筑结构: ${record.buildingStructure ?? '未填写'}`,
    `建筑面积: ${formatOptionalNumber(record.buildingArea, 'm2')}`,
    `耐火等级: ${record.fireResistanceRating ?? '未填写'}`,
    `设防烈度: ${record.seismicIntensity ?? '未填写'}`,
    `建筑风格: ${record.architecturalStyle ?? record.decorationStyle ?? '未填写'}`,
    `资金预算: ${formatOptionalMoney(record.budget, record.budgetCurrency)}`,
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

function normalizeDocumentTemplate(
  values: MarketingRequirementFormValues,
): MarketingRequirementRecord['documentTemplate'] {
  const id = values.documentTemplateId ?? 'standard_requirement';
  const base = marketingDocumentTemplates.find((item) => item.id === id) ?? defaultMarketingDocumentTemplate;
  const customName = values.customTemplateName?.trim();
  const customNotes = values.customTemplateNotes?.trim();
  const result: MarketingRequirementRecord['documentTemplate'] = {
    id,
    name: id === 'custom' && customName ? customName : base.name,
  };
  if (customNotes) result.customNotes = customNotes;
  return result;
}

function buildEditableOfficeHtml(input: {
  title: string;
  subtitle: string;
  schema: string;
  payload: unknown;
  sections: Array<{
    title: string;
    rows?: Array<[string, string]>;
    paragraphs?: string[];
  }>;
}): string {
  const body = input.sections.map((section) => [
    `<section class="doc-section">`,
    `<h2>${escapeHtml(section.title)}</h2>`,
    section.rows?.length
      ? `<table><tbody>${section.rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody></table>`
      : '',
    section.paragraphs?.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('') ?? '',
    `</section>`,
  ].join('')).join('');

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(input.title)}</title>`,
    '<style>',
    'body{font-family:"Noto Sans SC","Microsoft YaHei",Arial,sans-serif;color:#111827;line-height:1.55;margin:0;padding:32px;background:#fff;}',
    'h1{font-size:22px;margin:0 0 6px;}',
    '.subtitle{color:#64748b;font-size:12px;margin:0 0 24px;}',
    '.doc-section{margin-top:20px;}',
    'h2{font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin:0 0 10px;}',
    'table{width:100%;border-collapse:collapse;font-size:13px;}',
    'th,td{border:1px solid #e5e7eb;padding:8px 10px;text-align:left;vertical-align:top;}',
    'th{width:180px;background:#f8fafc;color:#475569;font-weight:600;}',
    'p{font-size:13px;margin:8px 0;}',
    '</style>',
    '</head>',
    '<body>',
    `<h1>${escapeHtml(input.title)}</h1>`,
    `<p class="subtitle">${escapeHtml(input.subtitle)}</p>`,
    body,
    embedArchitokenPayload(input.schema, input.payload),
    '</body>',
    '</html>',
  ].join('');
}

function embedArchitokenPayload(schema: string, payload: unknown): string {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c').replace(/<\/script/gi, '<\\/script');
  return `<script type="application/json" data-architoken-payload="${escapeHtml(schema)}">${json}</script>`;
}

function extractEmbeddedArchitokenPayload(
  content: string,
  schema: string,
): string | null {
  const pattern = new RegExp(
    `<script[^>]+data-architoken-payload=["']${escapeRegExp(schema)}["'][^>]*>([\\s\\S]*?)<\\/script>`,
    'i',
  );
  return pattern.exec(content)?.[1]?.trim() ?? null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatOptionalNumber(value: number | null | undefined, unit: string): string {
  return typeof value === 'number' ? `${value} ${unit}` : '未填写';
}

function formatOptionalFloors(
  value: number | null | undefined,
  legacyScale: string | undefined,
): string {
  if (typeof value === 'number') return `${value} 层`;
  return legacyScale ?? '未填写';
}

function formatOptionalMoney(
  value: number | null | undefined,
  currency: CurrencyCode | undefined,
): string {
  return typeof value === 'number' ? `${value} ${currency ?? 'CNY'}` : '未填写';
}

function sanitizeRequirementName(value: string): string {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'lead';
}
