// components/LeadRequirementWorkflowPanel.tsx - Marketing to concept-design data/AI bridge.
// License: Apache-2.0
'use client';

import { Alert, Button, Form, Input, InputNumber, List, Select, Space, Tag, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createModuleAuditEvent } from '@/lib/module-actions';
import { generationClient, type GenerationJob } from '@/lib/generation-client';
import {
  buildMarketingRequirementPrompt,
  createPrepaymentIntentRecord,
  createMarketingRequirementRecord,
  isMarketingRequirementFile,
  marketingRequirementMimeType,
  parseMarketingRequirementContent,
  prepaymentIntentFileName,
  prepaymentIntentMimeType,
  requirementFileName,
  type MarketingRequirementFormValues,
  type MarketingRequirementRecord,
  type PrepaymentMethod,
} from '@/lib/lead-requirements';
import { moduleFileApiClient } from '@/lib/module-file-api-client';
import type { ModuleAuditEvent, ModuleFileNode } from '@/lib/module-file-system';
import type { ModuleId } from '@/lib/module-registry';

interface RequirementSummary {
  file: ModuleFileNode;
  record?: MarketingRequirementRecord;
}

const structureOptions = ['钢结构', '钢筋混凝土', '装配式', '木结构', '砌体结构', '混合结构'].map((value) => ({
  label: value,
  value,
}));

const fireOptions = ['一级', '二级', '三级', '四级'].map((value) => ({ label: value, value }));
const seismicOptions = ['6度', '7度', '8度', '9度'].map((value) => ({ label: value, value }));
const paymentMethodOptions: Array<{ label: string; value: PrepaymentMethod }> = [
  { label: '京东支付', value: 'jd_pay' },
  { label: '微信支付', value: 'wechat_pay' },
  { label: '抖音支付', value: 'douyin_pay' },
  { label: '支付宝', value: 'alipay' },
  { label: '银联', value: 'unionpay' },
  { label: '信用卡', value: 'credit_card' },
  { label: 'PayPal', value: 'paypal' },
  { label: '银行转账', value: 'bank_transfer' },
  { label: '电子合同 / 电子签章', value: 'e_contract' },
];

function UnitInputNumber({
  value,
  onChange,
  min = 0,
  unit,
}: {
  value?: number | null;
  onChange?: (value: number | null) => void;
  min?: number;
  unit: string;
}) {
  return (
    <Space.Compact className="w-full">
      <InputNumber
        className="min-w-0 flex-1"
        min={min}
        value={value ?? null}
        onChange={(next) => {
          if (typeof next === 'number' || next === null) {
            onChange?.(next);
            return;
          }
          onChange?.(Number.isFinite(Number(next)) ? Number(next) : null);
        }}
      />
      <span className="inline-flex h-8 shrink-0 items-center rounded-e-md border border-l-0 border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-2 text-xs font-bold text-[var(--arch-text-muted)]">
        {unit}
      </span>
    </Space.Compact>
  );
}

export function LeadRequirementWorkflowPanel({
  moduleId,
  onAudit,
}: {
  moduleId: ModuleId;
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  if (moduleId === 'marketing_service') {
    return <MarketingRequirementCapture {...(onAudit ? { onAudit } : {})} />;
  }
  if (moduleId === 'concept_design') {
    return <ConceptDesignRequirementImport {...(onAudit ? { onAudit } : {})} />;
  }
  return null;
}

function MarketingRequirementCapture({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [form] = Form.useForm<MarketingRequirementFormValues>();
  const [status, setStatus] = useState<string>('填写客户需求后写入后端 CDE / 数据库,供方案设计模块导入。');
  const [submitting, setSubmitting] = useState(false);
  const [savedRequirement, setSavedRequirement] = useState<{
    record: MarketingRequirementRecord;
    file: ModuleFileNode;
  } | null>(null);

  async function submit(values: MarketingRequirementFormValues) {
    setSubmitting(true);
    setStatus('正在写入后端数据库...');
    try {
      const record = createMarketingRequirementRecord(values);
      const content = JSON.stringify(record, null, 2);
      const node = await moduleFileApiClient.createModuleFile({
        moduleId: 'marketing_service',
        parentId: null,
        name: requirementFileName(record),
        kind: 'file',
        mimeType: marketingRequirementMimeType,
        sizeBytes: new TextEncoder().encode(content).byteLength,
        owner: '市场客服',
        tags: [
          'marketing-requirement',
          'concept-design-input',
          'database-backed',
          'ai-ready',
        ],
        content,
      });
      onAudit?.(
        createModuleAuditEvent(
          'marketing-requirement-captured',
          'LeadRequirementWorkflowPanel',
          `市场客服需求已写入数据库: ${node.name}`,
        ),
      );
      form.resetFields();
      setSavedRequirement({ record, file: node });
      setStatus(`已提交设计需求 ${node.name}; 请完成预付定金登记。`);
    } catch (error) {
      setStatus(`保存失败: ${describeError(error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-3 p-3">
      <HeaderBlock
        title="客户需求录入"
        description="市场客服数据通过后端 CDE 文件接口落库,作为方案设计 AI 生成任务的结构化输入。"
      />
      <Alert type="info" showIcon message={status} />
      <Form form={form} layout="vertical" size="small" onFinish={submit}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Form.Item
            name="customerName"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="客户姓名" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="手机"
            rules={[{ required: true, message: '请输入手机' }]}
          >
            <Input placeholder="手机号 / 微信" />
          </Form.Item>
          <Form.Item
            name="geoLocation"
            label="地理位置"
            rules={[{ required: true, message: '请输入项目位置' }]}
          >
            <Input placeholder="省市区 / 坐标 / 地块" />
          </Form.Item>
          <Form.Item name="buildingScale" label="建筑规模">
            <Input placeholder="层数、户型、功能、人数等" />
          </Form.Item>
          <Form.Item name="buildingStructure" label="建筑结构">
            <Select allowClear options={structureOptions} placeholder="选择结构体系" />
          </Form.Item>
          <Form.Item name="buildingArea" label="建筑面积">
            <UnitInputNumber unit="m2" min={0} />
          </Form.Item>
          <Form.Item name="fireResistanceRating" label="耐火等级">
            <Select allowClear options={fireOptions} placeholder="选择耐火等级" />
          </Form.Item>
          <Form.Item name="seismicIntensity" label="设防烈度">
            <Select allowClear options={seismicOptions} placeholder="选择设防烈度" />
          </Form.Item>
          <Form.Item name="decorationStyle" label="装修风格">
            <Input placeholder="现代、轻奢、工业、酒店等" />
          </Form.Item>
          <Form.Item name="budget" label="资金预算">
            <UnitInputNumber unit="元" min={0} />
          </Form.Item>
        </div>
        <Form.Item name="remarks" label="其它备注">
          <Input.TextArea rows={3} placeholder="偏好、约束、图纸状态、交付时间、审批要求等" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting} block>
          提交设计需求并进入预付定金
        </Button>
      </Form>
      {savedRequirement ? (
        <PrepaymentPanel
          requirement={savedRequirement.record}
          requirementFile={savedRequirement.file}
          onStatus={setStatus}
          {...(onAudit ? { onAudit } : {})}
        />
      ) : null}
    </section>
  );
}

function PrepaymentPanel({
  requirement,
  requirementFile,
  onAudit,
  onStatus,
}: {
  requirement: MarketingRequirementRecord;
  requirementFile: ModuleFileNode;
  onAudit?: (event: ModuleAuditEvent) => void;
  onStatus: (message: string) => void;
}) {
  const [form] = Form.useForm<{
    amount: number;
    method: PrepaymentMethod;
    currency: string;
    notes?: string;
  }>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(values: {
    amount: number;
    method: PrepaymentMethod;
    currency: string;
    notes?: string;
  }) {
    setSubmitting(true);
    onStatus('正在创建预付定金支付意向...');
    try {
      const intent = createPrepaymentIntentRecord({
        requirement,
        requirementFileId: requirementFile.id,
        amount: values.amount,
        currency: values.currency,
        method: values.method,
        ...(values.notes ? { notes: values.notes } : {}),
      });
      const content = JSON.stringify(intent, null, 2);
      const node = await moduleFileApiClient.createModuleFile({
        moduleId: 'marketing_service',
        parentId: null,
        name: prepaymentIntentFileName(intent),
        kind: 'file',
        mimeType: prepaymentIntentMimeType,
        sizeBytes: new TextEncoder().encode(content).byteLength,
        owner: '市场客服',
        tags: ['prepayment-intent', intent.method, 'database-backed', 'payment-gateway-required'],
        content,
      });
      onAudit?.(
        createModuleAuditEvent(
          'prepayment-intent-created',
          'LeadRequirementWorkflowPanel',
          `预付定金意向已写入数据库: ${node.name}`,
        ),
      );
      onStatus(
        `已创建预付定金意向 ${node.name}; 支付网关适配器接入后可跳转真实收银台。`,
      );
    } catch (error) {
      onStatus(`预付定金登记失败: ${describeError(error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-md border border-[var(--arch-border)] p-3">
      <HeaderBlock
        title="预付定金"
        description="支持主流支付方式、电子合同和电子签章。未配置网关密钥时只生成数据库记录,不伪造支付成功;电子流程完成后可登记线下合同盖章。"
      />
      <Form
        form={form}
        layout="vertical"
        size="small"
        className="mt-3"
        initialValues={{
          amount: requirement.budget ? Math.max(Math.round(requirement.budget * 0.1), 1) : 5000,
          currency: 'CNY',
          method: 'wechat_pay',
        }}
        onFinish={submit}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Form.Item
            name="amount"
            label="定金金额"
            rules={[{ required: true, message: '请输入定金金额' }]}
          >
            <UnitInputNumber unit="元" min={1} />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '人民币 CNY', value: 'CNY' },
                { label: '美元 USD', value: 'USD' },
                { label: '港币 HKD', value: 'HKD' },
                { label: '欧元 EUR', value: 'EUR' },
              ]}
            />
          </Form.Item>
        </div>
        <Form.Item name="method" label="支付方式" rules={[{ required: true }]}>
          <Select options={paymentMethodOptions} />
        </Form.Item>
        <Form.Item name="notes" label="付款备注">
          <Input.TextArea rows={2} placeholder="电子合同编号、电子签章主体、发票抬头、境内/境外支付说明;电子流程完成后可备注线下盖章安排" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting} block>
          生成预付定金支付意向
        </Button>
      </Form>
    </div>
  );
}

function ConceptDesignRequirementImport({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('从市场客服数据库导入客户需求,并创建方案设计 text_to_bim 生成任务。');
  const selected = useMemo(
    () => requirements.find((item) => item.file.id === selectedFileId) ?? null,
    [requirements, selectedFileId],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage('正在读取市场客服数据库需求包...');
    try {
      const payload = await moduleFileApiClient.listModuleFiles('marketing_service', {
        limit: 500,
      });
      const files = payload.files.filter(isMarketingRequirementFile);
      const summaries = await Promise.all(
        files.slice(0, 24).map(async (file) => {
          try {
            const content = await moduleFileApiClient.getModuleFileContent(file.id);
            const record = parseMarketingRequirementContent(content.content);
            return record ? { file, record } : { file };
          } catch {
            return { file };
          }
        }),
      );
      setRequirements(summaries);
      setSelectedFileId((current) => current ?? summaries[0]?.file.id ?? null);
      setMessage(
        summaries.length > 0
          ? `已读取 ${summaries.length} 个市场客服需求包。`
          : '市场客服数据库暂无可导入需求包。',
      );
    } catch (error) {
      setMessage(`读取失败: ${describeError(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function importAndGenerate() {
    if (!selected) {
      setMessage('请先选择一个市场客服需求包。');
      return;
    }
    setRunning(true);
    setMessage('正在导入需求并创建方案设计生成任务...');
    try {
      const content = await moduleFileApiClient.getModuleFileContent(selected.file.id);
      const record = parseMarketingRequirementContent(content.content);
      if (!record) {
        throw new Error('需求包内容不是 architoken.marketing_requirement.v1');
      }
      const prompt = buildMarketingRequirementPrompt(record);
      const created = await generationClient.create({
        moduleId: 'concept_design',
        mode: 'text_to_bim',
        prompt,
        actor: 'concept-design-importer',
        constraints: {
          sourceRequirementFileId: selected.file.id,
          requirement: record,
          outputFormats: record.aiReadiness.preferredOutputs,
          openBimStandard: 'IFC4.3',
          route: 'Planner->Generator->Evaluator->RuleChecker->SchemaValidator->Approver',
        },
      });
      const planned = await generationClient.plan(created.id, {
        actor: 'concept-design-importer',
        comment: 'imported marketing requirement and prepared text_to_bim plan',
      });
      const run = await runGeneration(planned);
      const artifact = await persistConceptImportArtifact(record, selected.file, run ?? planned, prompt);
      onAudit?.(
        createModuleAuditEvent(
          'concept-design-requirement-imported',
          'LeadRequirementWorkflowPanel',
          `方案设计已导入市场需求并创建生成任务: ${artifact.name}`,
        ),
      );
      setMessage(
        run
          ? `已导入并运行生成任务 ${run.id}; 任务状态 ${run.status}。`
          : `已导入并完成规划任务 ${planned.id}; 生成引擎未返回运行结果。`,
      );
    } catch (error) {
      setMessage(`导入 / 生成失败: ${describeError(error)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-3 p-3">
      <HeaderBlock
        title="市场数据导入"
        description="方案设计从市场客服数据库读取需求包,通过内部 GenerationRouter 创建三维模型任务。"
      />
      <Alert type="info" showIcon message={message} />
      <Space className="w-full" direction="vertical" size={8}>
        <Button onClick={refresh} loading={loading} block>
          刷新市场客服需求包
        </Button>
        <List
          size="small"
          loading={loading}
          dataSource={requirements}
          locale={{ emptyText: '暂无市场客服需求包' }}
          renderItem={(item) => (
            <List.Item
              className={`cursor-pointer rounded-md px-2 ${
                item.file.id === selectedFileId ? 'bg-[var(--arch-primary-soft)]' : ''
              }`}
              onClick={() => setSelectedFileId(item.file.id)}
            >
              <List.Item.Meta
                title={
                  <span className="flex items-center gap-2">
                    <Typography.Text className="max-w-[180px]" ellipsis strong>
                      {item.record?.customerName ?? item.file.name}
                    </Typography.Text>
                    <Tag color="green">DB</Tag>
                  </span>
                }
                description={
                  item.record
                    ? `${item.record.geoLocation} · ${item.record.buildingStructure ?? '结构待定'} · ${item.record.buildingArea ?? '-'} m2`
                    : item.file.updatedAt
                }
              />
            </List.Item>
          )}
        />
        <Button type="primary" onClick={importAndGenerate} loading={running} block>
          导入并生成三维方案任务
        </Button>
      </Space>
    </section>
  );
}

async function runGeneration(job: GenerationJob): Promise<GenerationJob | null> {
  try {
    return await generationClient.run(job.id, {
      actor: 'concept-design-importer',
      comment: 'run text_to_bim from imported marketing requirement',
    });
  } catch {
    return null;
  }
}

async function persistConceptImportArtifact(
  record: MarketingRequirementRecord,
  sourceFile: ModuleFileNode,
  job: GenerationJob,
  prompt: string,
): Promise<ModuleFileNode> {
  const content = JSON.stringify(
    {
      schema: 'architoken.concept_design.requirement_import.v1',
      sourceRequirementFileId: sourceFile.id,
      sourceRequirementFileName: sourceFile.name,
      requirement: record,
      generationJobId: job.id,
      generationStatus: job.status,
      prompt,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  );
  return moduleFileApiClient.createModuleFile({
    moduleId: 'concept_design',
    parentId: null,
    name: `方案生成任务-${record.customerName}-${new Date().toISOString().slice(0, 10)}.json`,
    kind: 'file',
    mimeType: 'application/vnd.architoken.concept-design-generation+json',
    sizeBytes: new TextEncoder().encode(content).byteLength,
    owner: '方案设计',
    tags: ['concept-design-import', 'marketing-requirement', 'text-to-bim', 'database-backed'],
    content,
  });
}

function HeaderBlock({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="arch-primary-text text-xs font-black">AI 数据闭环</p>
      <h3 className="arch-text mt-1 text-sm font-black">{title}</h3>
      <p className="arch-muted mt-1 text-xs leading-5">{description}</p>
    </div>
  );
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const value = (error as { error?: unknown }).error;
    return typeof value === 'string' ? value : JSON.stringify(error);
  }
  return String(error);
}
