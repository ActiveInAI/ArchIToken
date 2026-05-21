// components/LeadRequirementWorkflowPanel.tsx - Marketing to concept-design data/AI bridge.
// License: Apache-2.0
'use client';

import { Alert, Button, Cascader, Form, Input, InputNumber, Radio, Select, Space, Tag, Typography } from 'antd';
import { ImagePlus, Pencil, Sparkles, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LocalFileUploader } from '@/components/LocalFileUploader';
import { WorksExplorer } from '@/components/shared/works-explorer';
import { createModuleAuditEvent } from '@/lib/module-actions';
import { generationClient, type GenerationJob } from '@/lib/generation-client';
import { getModuleRootId, type ModuleAuditEvent, type ModuleFileNode } from '@/lib/module-file-system';
import {
  buildContractDraftDocument,
  buildDesignConfirmationDocument,
  buildMarketingRequirementPrompt,
  buildMarketingRequirementDocument,
  buildPrepaymentIntentDocument,
  contractDraftFileName,
  type ConfirmedDesignOptionReference,
  createContractDraftRecord,
  createDesignConfirmationRecord,
  createPrepaymentIntentRecord,
  createMarketingRequirementRecord,
  designConfirmationFileName,
  editableOfficeDocumentMimeType,
  isMarketingRequirementFile,
  marketingDocumentTemplates,
  parseMarketingRequirementContent,
  prepaymentIntentFileName,
  requirementFileName,
  type MarketingRequirementFormValues,
  type MarketingRequirementRecord,
  type PrepaymentMethod,
  type CurrencyCode,
} from '@/lib/lead-requirements';
import { moduleFileApiClient } from '@/lib/module-file-api-client';
import type { ModuleId } from '@/lib/module-registry';

interface RequirementSummary {
  file: ModuleFileNode;
  record?: MarketingRequirementRecord;
}

interface ConceptSchemeOption extends ConfirmedDesignOptionReference {
  architecturalStyle: string;
  buildingFloorsLabel: string;
  spatialStrategy: string;
  costStrategy: string;
  aiStatus: string;
}

interface LocationOption {
  label: string;
  value: string;
  children?: LocationOption[];
}

type MarketingWorkflowStep = 'inspiration' | 'intake' | 'reference' | 'design';

function loc(label: string, children: LocationOption[] = []): LocationOption {
  return children.length > 0 ? { label, value: label, children } : { label, value: label };
}

const geographyOptions = [
  loc('中国', [
    loc('北京市', [loc('北京市', [loc('东城区'), loc('朝阳区'), loc('海淀区'), loc('通州区')])]),
    loc('天津市', [loc('天津市', [loc('和平区'), loc('滨海新区'), loc('武清区')])]),
    loc('上海市', [loc('上海市', [loc('浦东新区'), loc('黄浦区'), loc('徐汇区'), loc('松江区')])]),
    loc('重庆市', [loc('重庆市', [loc('渝中区'), loc('江北区'), loc('九龙坡区'), loc('两江新区')])]),
    loc('河北省', [loc('石家庄市', [loc('长安区'), loc('裕华区')]), loc('唐山市', [loc('路北区'), loc('曹妃甸区')])]),
    loc('山西省', [loc('太原市', [loc('小店区'), loc('迎泽区')]), loc('大同市', [loc('平城区')])]),
    loc('内蒙古自治区', [loc('呼和浩特市', [loc('新城区'), loc('赛罕区')]), loc('包头市', [loc('昆都仑区')])]),
    loc('辽宁省', [loc('沈阳市', [loc('和平区'), loc('浑南区')]), loc('大连市', [loc('中山区'), loc('金普新区')])]),
    loc('吉林省', [loc('长春市', [loc('南关区'), loc('朝阳区')]), loc('吉林市', [loc('船营区')])]),
    loc('黑龙江省', [loc('哈尔滨市', [loc('道里区'), loc('南岗区')]), loc('齐齐哈尔市', [loc('龙沙区')])]),
    loc('江苏省', [loc('南京市', [loc('玄武区'), loc('江宁区')]), loc('苏州市', [loc('姑苏区'), loc('工业园区')]), loc('无锡市', [loc('滨湖区')])]),
    loc('浙江省', [loc('杭州市', [loc('西湖区', [loc('转塘街道')]), loc('余杭区')]), loc('宁波市', [loc('鄞州区')]), loc('温州市', [loc('鹿城区')])]),
    loc('安徽省', [loc('合肥市', [loc('蜀山区'), loc('包河区')]), loc('芜湖市', [loc('镜湖区')])]),
    loc('福建省', [loc('福州市', [loc('鼓楼区'), loc('仓山区')]), loc('厦门市', [loc('思明区'), loc('湖里区')])]),
    loc('江西省', [loc('南昌市', [loc('东湖区'), loc('红谷滩区')]), loc('赣州市', [loc('章贡区')])]),
    loc('山东省', [loc('济南市', [loc('历下区'), loc('市中区')]), loc('青岛市', [loc('市南区'), loc('崂山区')])]),
    loc('河南省', [loc('郑州市', [loc('金水区'), loc('郑东新区')]), loc('洛阳市', [loc('洛龙区')])]),
    loc('湖北省', [loc('武汉市', [loc('江岸区'), loc('武昌区'), loc('洪山区')]), loc('宜昌市', [loc('西陵区')])]),
    loc('湖南省', [loc('长沙市', [loc('岳麓区'), loc('天心区')]), loc('株洲市', [loc('天元区')])]),
    loc('广东省', [loc('广州市', [loc('天河区', [loc('猎德街道')]), loc('番禺区', [loc('南村镇')]), loc('黄埔区')]), loc('深圳市', [loc('南山区', [loc('粤海街道')]), loc('福田区'), loc('宝安区')]), loc('佛山市', [loc('顺德区')]), loc('东莞市', [loc('松山湖')])]),
    loc('广西壮族自治区', [loc('南宁市', [loc('青秀区'), loc('良庆区')]), loc('柳州市', [loc('城中区')])]),
    loc('海南省', [loc('海口市', [loc('龙华区'), loc('美兰区')]), loc('三亚市', [loc('吉阳区')])]),
    loc('四川省', [loc('成都市', [loc('锦江区'), loc('高新区')]), loc('绵阳市', [loc('涪城区')])]),
    loc('贵州省', [loc('贵阳市', [loc('南明区'), loc('观山湖区')]), loc('遵义市', [loc('红花岗区')])]),
    loc('云南省', [loc('昆明市', [loc('五华区'), loc('官渡区')]), loc('大理白族自治州', [loc('大理市')])]),
    loc('西藏自治区', [loc('拉萨市', [loc('城关区')])]),
    loc('陕西省', [loc('西安市', [loc('雁塔区'), loc('长安区')]), loc('咸阳市', [loc('秦都区')])]),
    loc('甘肃省', [loc('兰州市', [loc('城关区'), loc('七里河区')])]),
    loc('青海省', [loc('西宁市', [loc('城西区'), loc('城北区')])]),
    loc('宁夏回族自治区', [loc('银川市', [loc('兴庆区'), loc('金凤区')])]),
    loc('新疆维吾尔自治区', [loc('乌鲁木齐市', [loc('天山区'), loc('新市区')]), loc('喀什地区', [loc('喀什市')])]),
    loc('香港特别行政区', [loc('香港', [loc('中西区'), loc('九龙城区'), loc('沙田区')])]),
    loc('澳门特别行政区', [loc('澳门', [loc('花地玛堂区'), loc('大堂区')])]),
    loc('台湾省', [loc('台北市', [loc('信义区'), loc('大安区')]), loc('高雄市', [loc('苓雅区')])]),
  ]),
  loc('澳大利亚', [
    loc('西澳大利亚州', [loc('珀斯市', [loc('Perth CBD'), loc('Fremantle'), loc('Cannington')])]),
    loc('新南威尔士州', [loc('悉尼市', [loc('Sydney CBD'), loc('Parramatta')])]),
    loc('维多利亚州', [loc('墨尔本市', [loc('Melbourne CBD'), loc('Docklands')])]),
    loc('昆士兰州', [loc('布里斯班市', [loc('Brisbane CBD'), loc('South Brisbane')])]),
  ]),
  loc('美国', [
    loc('加利福尼亚州', [loc('洛杉矶县', [loc('Los Angeles')]), loc('圣克拉拉县', [loc('San Jose')])]),
    loc('纽约州', [loc('纽约市', [loc('Manhattan'), loc('Brooklyn')])]),
    loc('德克萨斯州', [loc('休斯敦市', [loc('Downtown Houston')]), loc('奥斯汀市', [loc('Downtown Austin')])]),
  ]),
  loc('加拿大', [
    loc('安大略省', [loc('多伦多市', [loc('Downtown Toronto')])]),
    loc('不列颠哥伦比亚省', [loc('温哥华市', [loc('Downtown Vancouver'), loc('Richmond')])]),
  ]),
  loc('英国', [
    loc('英格兰', [loc('伦敦', [loc('Westminster'), loc('Camden')]), loc('曼彻斯特', [loc('City Centre')])]),
    loc('苏格兰', [loc('爱丁堡', [loc('Old Town')])]),
  ]),
  loc('新加坡', [loc('新加坡', [loc('Central Region'), loc('Jurong East'), loc('Tampines')])]),
  loc('阿联酋', [loc('迪拜', [loc('Downtown Dubai'), loc('Business Bay')]), loc('阿布扎比', [loc('Al Reem Island')])]),
] satisfies LocationOption[];

const buildingFloorOptions = [1, 2, 3, 4, 5].map((value) => ({ label: `${value}`, value }));

const currencyOptions: Array<{ label: string; value: CurrencyCode }> = [
  { label: '人民币 CNY', value: 'CNY' },
  { label: '美元 USD', value: 'USD' },
  { label: '欧元 EUR', value: 'EUR' },
  { label: '英镑 GBP', value: 'GBP' },
  { label: '澳元 AUD', value: 'AUD' },
  { label: '加元 CAD', value: 'CAD' },
  { label: '港币 HKD', value: 'HKD' },
  { label: '新加坡元 SGD', value: 'SGD' },
  { label: '日元 JPY', value: 'JPY' },
  { label: '阿联酋迪拉姆 AED', value: 'AED' },
];

const documentTemplateOptions = marketingDocumentTemplates.map((template) => ({
  label: `${template.name} · ${template.description}`,
  value: template.id,
}));

const structureOptions = ['钢结构', '钢筋混凝土', '装配式', '木结构', '砌体结构', '混合结构'].map((value) => ({
  label: value,
  value,
}));

const fireOptions = ['一级', '二级', '三级', '四级'].map((value) => ({ label: value, value }));
const seismicOptions = ['6度', '7度', '8度', '9度'].map((value) => ({ label: value, value }));
const architecturalStyleOptions = [
  '现代简约',
  '新中式',
  '岭南院落',
  '轻奢酒店',
  '工业风',
  '地中海',
  '日式侘寂',
  '欧式坡屋顶',
].map((value) => ({ label: value, value }));
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
        controls={false}
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
      <span className="inline-flex h-8 shrink-0 items-center rounded-e-md border border-l-0 border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-2 arch-type-caption font-medium text-[var(--arch-text-muted)]">
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
  const [activeStep, setActiveStep] = useState<MarketingWorkflowStep>('inspiration');
  const [savedRequirement, setSavedRequirement] = useState<{
    record: MarketingRequirementRecord;
    file: ModuleFileNode;
  } | null>(null);
  const [confirmedScheme, setConfirmedScheme] = useState<ConceptSchemeOption | null>(null);
  const selectedDocumentTemplateId = Form.useWatch('documentTemplateId', form);

  function selectStep(step: MarketingWorkflowStep) {
    setActiveStep(step);
    if (step === 'reference' && !savedRequirement) {
      setStatus('请先完成需求录入,再上传参考图作为方案生成输入。');
    }
    if (step === 'design' && !savedRequirement) {
      setStatus('请先完成需求录入和参考图上传,再开始生成建筑方案。');
    }
  }

  async function submit(values: MarketingRequirementFormValues) {
    setSubmitting(true);
    setStatus('正在写入后端数据库...');
    try {
      const record = createMarketingRequirementRecord(values);
      const content = buildMarketingRequirementDocument(record);
      const node = await moduleFileApiClient.createModuleFile({
        moduleId: 'marketing_service',
        parentId: null,
        name: requirementFileName(record),
        kind: 'file',
        mimeType: editableOfficeDocumentMimeType,
        sizeBytes: new TextEncoder().encode(content).byteLength,
        owner: '市场客服',
        tags: [
          'marketing-requirement',
          'concept-design-input',
          'office-document',
          'editable-document',
          `template:${record.documentTemplate.id}`,
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
      setConfirmedScheme(null);
      setActiveStep('reference');
      setStatus(`已提交设计需求 ${node.name}; 下一步上传参考图,再生成建筑方案供客户比选确认。`);
    } catch (error) {
      setStatus(`保存失败: ${describeError(error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="arch-huly-capture-shell">
      <div className="arch-huly-form-panel">
        <MarketingWorkflowHeader
          activeStep={activeStep}
          onSelectStep={selectStep}
        />

        {activeStep === 'inspiration' ? <MarketingPublicWorksPanel /> : null}

        {activeStep === 'intake' ? (
        <div className="arch-huly-step-card">
          <div className="arch-huly-section-head">
            <HeaderBlock
              title="客户需求录入"
              description="市场客服数据通过后端 CDE 文件接口落库,作为方案设计 AI 生成任务的结构化输入。"
            />
            <span className="arch-huly-status-pill">REQ-INTAKE</span>
          </div>
          <Alert className="arch-huly-alert" type="info" showIcon message={status} />
          <Form
            form={form}
            layout="vertical"
            size="small"
            initialValues={{ budgetCurrency: 'CNY', documentTemplateId: 'standard_requirement' }}
            onFinish={submit}
            className="arch-huly-requirement-form"
          >
            <div className="arch-huly-field-grid">
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
                name="geoLocationPath"
                label="地理位置"
                rules={[{ required: true, message: '请选择项目位置' }]}
              >
                <Cascader
                  options={geographyOptions}
                  placeholder="国家 / 省份 / 地市 / 区县 / 镇街"
                  changeOnSelect
                  showSearch
                />
              </Form.Item>
              <Form.Item name="buildingFloors" label="建筑层数">
                <Select allowClear options={buildingFloorOptions} placeholder="选择建筑层数" />
              </Form.Item>
              <Form.Item name="documentTemplateId" label="业务文档模板">
                <Select options={documentTemplateOptions} placeholder="选择 Office/PDF 模板" />
              </Form.Item>
              {selectedDocumentTemplateId === 'custom' ? (
                <Form.Item name="customTemplateName" label="自定义模板名称">
                  <Input placeholder="例如: 澳州客户报价确认模板.docx / PDF版式模板" />
                </Form.Item>
              ) : null}
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
              <Form.Item name="architecturalStyle" label="建筑风格">
                <Select allowClear options={architecturalStyleOptions} placeholder="选择建筑风格" />
              </Form.Item>
              <Form.Item label="资金预算">
                <div className="grid w-full grid-cols-[minmax(0,1fr)_144px] gap-1">
                  <Form.Item name="budget" noStyle>
                    <InputNumber className="w-full" controls={false} min={0} placeholder="输入金额" />
                  </Form.Item>
                  <Form.Item name="budgetCurrency" noStyle>
                    <Select className="w-full" options={currencyOptions} />
                  </Form.Item>
                </div>
              </Form.Item>
            </div>
            {selectedDocumentTemplateId === 'custom' ? (
              <Form.Item name="customTemplateNotes" label="自定义模板要求">
                <Input.TextArea rows={2} placeholder="模板章节、固定条款、抬头页、签章区、PDF版式或字段占位要求" />
              </Form.Item>
            ) : null}
            <Form.Item name="remarks" label="其它备注">
              <Input.TextArea rows={3} placeholder="偏好、约束、图纸状态、交付时间、审批要求等" />
            </Form.Item>
            <div className="arch-huly-form-actions">
              <span className="arch-muted arch-type-caption">提交后先上传参考图,再生成建筑方案草案供客户比选确认。</span>
              <Button type="primary" htmlType="submit" loading={submitting}>
                提交资料并进入参考图上传
              </Button>
            </div>
          </Form>
        </div>
        ) : null}

        {activeStep === 'reference' ? (
          savedRequirement ? (
          <div className="arch-huly-step-card">
            <ReferenceImageUploadPanel
              requirement={savedRequirement.record}
              onStatus={setStatus}
              onContinue={() => selectStep('design')}
              {...(onAudit ? { onAudit } : {})}
            />
          </div>
          ) : (
            <WorkflowPrerequisitePanel
              title="先完成需求录入"
              description="上传参考图需要绑定客户需求包。先录入姓名、位置、面积、结构和预算后,参考图才会进入同一条 CDE 审计链。"
              actionLabel="去需求录入"
              onAction={() => selectStep('intake')}
            />
          )
        ) : null}

        {activeStep === 'design' ? (
          savedRequirement ? (
          <ConceptSchemePanel
            requirement={savedRequirement.record}
            requirementFile={savedRequirement.file}
            onStatus={setStatus}
            onConfirmed={setConfirmedScheme}
            {...(onAudit ? { onAudit } : {})}
          />
          ) : (
            <WorkflowPrerequisitePanel
              title="先完成需求录入"
              description="开始设计需要客户需求包作为结构化输入。缺少需求时只能给经验建议,不能进入可审计的方案生成链。"
              actionLabel="去需求录入"
              onAction={() => selectStep('intake')}
            />
          )
        ) : null}

        {activeStep === 'design' && savedRequirement && confirmedScheme ? (
          <PrepaymentPanel
            requirement={savedRequirement.record}
            requirementFile={savedRequirement.file}
            confirmedDesignOption={confirmedScheme}
            onStatus={setStatus}
            {...(onAudit ? { onAudit } : {})}
          />
        ) : null}
      </div>
    </section>
  );
}

function MarketingWorkflowHeader({
  activeStep,
  onSelectStep,
}: {
  activeStep: MarketingWorkflowStep;
  onSelectStep: (step: MarketingWorkflowStep) => void;
}) {
  return (
    <section className="arch-huly-workflow-head">
      <div className="arch-huly-section-head">
        <HeaderBlock
          title="灵感来自每一位创作者"
          description="按流程切换浏览灵感、需求录入、上传参考图和开始设计。当前只显示所选入口对应内容。"
        />
        <span className="arch-huly-status-pill">INSPIRATION</span>
      </div>

      <div className="arch-huly-entry-grid">
        <MarketingEntryCard
          icon={<Sparkles className="h-4 w-4" />}
          title="浏览灵感"
          description="公开作品瀑布流,先看别人怎么住。"
          active={activeStep === 'inspiration'}
          onClick={() => onSelectStep('inspiration')}
        />
        <MarketingEntryCard
          icon={<Pencil className="h-4 w-4" />}
          title="需求录入"
          description="录入位置、面积、结构、预算和备注。"
          active={activeStep === 'intake'}
          onClick={() => onSelectStep('intake')}
        />
        <MarketingEntryCard
          icon={<Upload className="h-4 w-4" />}
          title="上传参考"
          description="提交资料后上传风格图,作为方案生成输入。"
          active={activeStep === 'reference'}
          onClick={() => onSelectStep('reference')}
        />
        <MarketingEntryCard
          icon={<Sparkles className="h-4 w-4" />}
          title="开始设计"
          description="生成建筑方案草案,进入客户比选确认。"
          active={activeStep === 'design'}
          onClick={() => onSelectStep('design')}
        />
      </div>
    </section>
  );
}

function MarketingPublicWorksPanel() {
  return (
    <section className="arch-huly-selected-panel">
      <WorksExplorer theme="light" embedded title="公开作品" />
    </section>
  );
}

function MarketingEntryCard({
  icon,
  title,
  description,
  onClick,
  active,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`arch-huly-entry-card ${active ? 'is-active' : ''}`}
    >
      <span className="arch-huly-entry-icon">{icon}</span>
      <span className="arch-huly-entry-text">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </button>
  );
}

function WorkflowPrerequisitePanel({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="arch-huly-step-card">
      <div className="arch-huly-empty-step">
        <HeaderBlock title={title} description={description} />
        <Button type="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </section>
  );
}

function ReferenceImageUploadPanel({
  requirement,
  onAudit,
  onStatus,
  onContinue,
}: {
  requirement: MarketingRequirementRecord;
  onAudit?: (event: ModuleAuditEvent) => void;
  onStatus: (message: string) => void;
  onContinue: () => void;
}) {
  const [uploadedFiles, setUploadedFiles] = useState<ModuleFileNode[]>([]);

  return (
    <div className="arch-huly-reference-upload">
      <div className="arch-huly-section-head">
        <HeaderBlock
          title="上传参考图"
          description={`${requirement.customerName} 的需求已保存。继续上传风格图、平面参考或手绘草图,再进入方案生成。`}
        />
        <span className="arch-huly-status-pill">REFERENCE</span>
      </div>

      <LocalFileUploader
        moduleId="marketing_service"
        parentId={getModuleRootId('marketing_service')}
        accept="image/*,.pdf"
        idleLabel="拖拽参考图到这里或点击上传"
        helperText="支持风格图、手绘草图、平面参考或 PDF,作为后续方案输入"
        tags="local-upload,reference-image,marketing-intake"
        onUploaded={(node) => {
          setUploadedFiles((current) => [node, ...current].slice(0, 6));
          onAudit?.(
            createModuleAuditEvent(
              'reference-image-uploaded',
              'LeadRequirementWorkflowPanel',
              `客户参考图已上传: ${node.name}`,
            ),
          );
          onStatus(`已上传参考图 ${node.name}; 可继续上传或生成建筑方案草案。`);
        }}
      />

      {uploadedFiles.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {uploadedFiles.map((file) => (
            <div key={file.id} className="arch-huly-row-muted flex items-center justify-between gap-3 rounded-md px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <ImagePlus className="h-4 w-4 shrink-0 text-[var(--arch-primary)]" />
                <span className="truncate arch-type-body font-medium arch-text">{file.name}</span>
              </span>
              <Tag className="m-0">参考图</Tag>
            </div>
          ))}
        </div>
      ) : (
        <p className="arch-muted mt-3 arch-type-caption">
          没有参考图也可以继续,但生成结果只能基于文字资料,不能作为专业合规结论。
        </p>
      )}

      <div className="arch-huly-form-actions mt-3">
        <span className="arch-muted arch-type-caption">参考图会作为 CDE 文件和审计证据保留在市场客服模块。</span>
        <Button type="primary" onClick={onContinue}>
          {uploadedFiles.length > 0 ? '继续生成建筑方案' : '跳过参考图并生成方案'}
        </Button>
      </div>
    </div>
  );
}

function ConceptSchemePanel({
  requirement,
  requirementFile,
  onAudit,
  onStatus,
  onConfirmed,
}: {
  requirement: MarketingRequirementRecord;
  requirementFile: ModuleFileNode;
  onAudit?: (event: ModuleAuditEvent) => void;
  onStatus: (message: string) => void;
  onConfirmed: (option: ConceptSchemeOption | null) => void;
}) {
  const [options, setOptions] = useState<ConceptSchemeOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [confirmedOptionId, setConfirmedOptionId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [round, setRound] = useState(0);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === selectedOptionId) ?? null,
    [options, selectedOptionId],
  );

  const generateOptions = useCallback(async () => {
    setGenerating(true);
    onConfirmed(null);
    setConfirmedOptionId(null);
    onStatus(round === 0 ? '正在生成建筑方案草案...' : '正在重新生成不同建筑方案...');
    try {
      const nextRound = round + 1;
      const prompt = [
        buildMarketingRequirementPrompt(requirement),
        '',
        `请生成第 ${nextRound} 轮 3 个可比选建筑方案草案。每个方案必须说明建筑风格、空间组织、成本取向和后续专业复核要求。`,
      ].join('\n');
      const job = await createConceptDesignGenerationJob(requirement, requirementFile, prompt);
      const nextOptions = buildConceptSchemeOptions(requirement, nextRound, job);
      const artifact = await persistConceptSchemeOptions(requirement, requirementFile, nextOptions, job, prompt);
      const optionsWithArtifact = nextOptions.map((option) => ({
        ...option,
        artifactFileId: artifact.id,
      }));
      setOptions(optionsWithArtifact);
      setSelectedOptionId(optionsWithArtifact[0]?.id ?? null);
      setRound(nextRound);
      onAudit?.(
        createModuleAuditEvent(
          'concept-scheme-options-generated',
          'LeadRequirementWorkflowPanel',
          `已生成 ${optionsWithArtifact.length} 个建筑方案草案: ${artifact.name}`,
        ),
      );
      onStatus(`已生成第 ${nextRound} 轮建筑方案草案; 可切换方案或重新生成。`);
    } catch (error) {
      const nextRound = round + 1;
      const fallbackOptions = buildConceptSchemeOptions(requirement, nextRound, null);
      setOptions(fallbackOptions);
      setSelectedOptionId(fallbackOptions[0]?.id ?? null);
      setRound(nextRound);
      onStatus(`AI 生成任务未完成: ${describeError(error)}。已提供待复核的经验方案草案,不能作为专业结论。`);
    } finally {
      setGenerating(false);
    }
  }, [onAudit, onConfirmed, onStatus, requirement, requirementFile, round]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && options.length === 0 && !generating) {
        void generateOptions();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [generateOptions, generating, options.length]);

  async function confirmSelectedOption() {
    if (!selectedOption) {
      onStatus('请先选择一个建筑方案。');
      return;
    }
    setConfirming(true);
    onStatus('正在写入客户确认方案和电子合同草案...');
    try {
      const confirmation = createDesignConfirmationRecord({
        requirement,
        requirementFileId: requirementFile.id,
        selectedOption,
      });
      const confirmationContent = buildDesignConfirmationDocument(confirmation);
      const confirmationFile = await moduleFileApiClient.createModuleFile({
        moduleId: 'marketing_service',
        parentId: null,
        name: designConfirmationFileName(confirmation),
        kind: 'file',
        mimeType: editableOfficeDocumentMimeType,
        sizeBytes: new TextEncoder().encode(confirmationContent).byteLength,
        owner: '市场客服',
        tags: ['design-confirmation', 'customer-confirmed', 'office-document', 'editable-document', 'database-backed', 'professional-review-required'],
        content: confirmationContent,
      });
      const contractDraft = createContractDraftRecord({
        requirement,
        requirementFileId: requirementFile.id,
        confirmation,
        confirmationFileId: confirmationFile.id,
      });
      const contractContent = buildContractDraftDocument(contractDraft);
      const contractFile = await moduleFileApiClient.createModuleFile({
        moduleId: 'marketing_service',
        parentId: null,
        name: contractDraftFileName(contractDraft),
        kind: 'file',
        mimeType: editableOfficeDocumentMimeType,
        sizeBytes: new TextEncoder().encode(contractContent).byteLength,
        owner: '市场客服',
        tags: ['contract-draft', 'electronic-signature-required', 'office-document', 'editable-document', 'database-backed', 'professional-review-required'],
        content: contractContent,
      });
      const confirmedOption: ConceptSchemeOption = {
        ...selectedOption,
        confirmationFileId: confirmationFile.id,
        contractDraftFileId: contractFile.id,
      };
      setConfirmedOptionId(selectedOption.id);
      onConfirmed(confirmedOption);
      onAudit?.(
        createModuleAuditEvent(
          'concept-scheme-option-confirmed',
          'LeadRequirementWorkflowPanel',
          `客户已确认建筑方案并生成合同草案: ${confirmationFile.name} / ${contractFile.name}`,
        ),
      );
      onStatus(`客户已确认 ${selectedOption.title}; 已生成确认记录和电子合同草案,现在可以登记意向定金。`);
    } catch (error) {
      onStatus(`确认方案失败: ${describeError(error)}`);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="rounded-md border border-[var(--arch-border)] p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <HeaderBlock
          title="建筑方案比选"
          description="提交资料后先生成多套建筑方案草案。客户可切换选择、重新生成,确认意向方案后再进入定金流程。"
        />
        <Button onClick={generateOptions} loading={generating}>
          {options.length > 0 ? '重新生成不同方案' : '生成建筑方案'}
        </Button>
      </div>

      <Radio.Group
        className="mt-3 grid w-full gap-2"
        value={selectedOptionId}
        onChange={(event) => setSelectedOptionId(event.target.value as string)}
      >
        {options.map((option) => (
          <Radio.Button
            key={option.id}
            value={option.id}
            className="h-auto w-full rounded-md border border-[var(--arch-border)] px-3 py-2 text-left"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Typography.Text strong>{option.title}</Typography.Text>
                  {confirmedOptionId === option.id ? <Tag color="blue">客户已确认</Tag> : null}
                  <Tag>{option.aiStatus}</Tag>
                </div>
                <p className="arch-muted mt-1 arch-type-caption leading-5">{option.summary}</p>
                <p className="arch-muted mt-1 arch-type-caption leading-5">{option.spatialStrategy}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <Tag>{option.architecturalStyle}</Tag>
                <Tag>{option.buildingFloorsLabel}</Tag>
                <Tag>{option.costStrategy}</Tag>
              </div>
            </div>
          </Radio.Button>
        ))}
      </Radio.Group>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="arch-muted arch-type-caption">
          当前方案仍为草案,正式报审、施工、消防、结构和造价结论必须进入专业复核链。
        </span>
        <Button type="primary" onClick={confirmSelectedOption} disabled={!selectedOption} loading={confirming}>
          客户确认所选方案
        </Button>
      </div>
    </div>
  );
}

function PrepaymentPanel({
  requirement,
  requirementFile,
  confirmedDesignOption,
  onAudit,
  onStatus,
}: {
  requirement: MarketingRequirementRecord;
  requirementFile: ModuleFileNode;
  confirmedDesignOption: ConfirmedDesignOptionReference;
  onAudit?: (event: ModuleAuditEvent) => void;
  onStatus: (message: string) => void;
}) {
  const [form] = Form.useForm<{
    amount: number;
    method: PrepaymentMethod;
    currency: CurrencyCode;
    notes?: string;
  }>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(values: {
    amount: number;
    method: PrepaymentMethod;
    currency: CurrencyCode;
    notes?: string;
  }) {
    setSubmitting(true);
    onStatus('正在创建意向定金支付意向...');
    try {
      const intent = createPrepaymentIntentRecord({
        requirement,
        requirementFileId: requirementFile.id,
        amount: values.amount,
        currency: values.currency,
        method: values.method,
        confirmedDesignOption,
        ...(values.notes ? { notes: values.notes } : {}),
      });
      const content = buildPrepaymentIntentDocument(intent);
      const node = await moduleFileApiClient.createModuleFile({
        moduleId: 'marketing_service',
        parentId: null,
        name: prepaymentIntentFileName(intent),
        kind: 'file',
        mimeType: editableOfficeDocumentMimeType,
        sizeBytes: new TextEncoder().encode(content).byteLength,
        owner: '市场客服',
        tags: ['prepayment-intent', intent.method, 'office-document', 'editable-document', 'database-backed', 'payment-gateway-required'],
        content,
      });
      onAudit?.(
        createModuleAuditEvent(
          'prepayment-intent-created',
          'LeadRequirementWorkflowPanel',
          `意向定金支付意向已写入数据库: ${node.name}`,
        ),
      );
      onStatus(
        `已创建意向定金支付意向 ${node.name}; 支付网关适配器接入后可跳转真实收银台。`,
      );
    } catch (error) {
      onStatus(`意向定金登记失败: ${describeError(error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-md border border-[var(--arch-border)] p-3">
      <HeaderBlock
        title="意向定金"
        description={`客户已确认 ${confirmedDesignOption.title} 后才进入定金流程。未配置网关密钥时只生成数据库记录,不伪造支付成功;电子流程完成后可登记线下合同盖章。`}
      />
      <Form
        form={form}
        layout="vertical"
        size="small"
        className="mt-3"
        initialValues={{
          amount: requirement.budget ? Math.max(Math.round(requirement.budget * 0.1), 1) : 5000,
          currency: requirement.budgetCurrency ?? 'CNY',
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
            <InputNumber className="w-full" controls={false} min={1} placeholder="定金金额" />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
            <Select options={currencyOptions} />
          </Form.Item>
        </div>
        <Form.Item name="method" label="支付方式" rules={[{ required: true }]}>
          <Select options={paymentMethodOptions} />
        </Form.Item>
        <Form.Item name="notes" label="付款备注">
          <Input.TextArea rows={2} placeholder="电子合同编号、电子签章主体、发票抬头、境内/境外支付说明;电子流程完成后可备注线下盖章安排" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting} block>
          生成意向定金支付意向
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
  const [createdArtifactName, setCreatedArtifactName] = useState<string | null>(null);
  const [message, setMessage] = useState('选择一个市场客服 CDE 需求包,创建方案设计 text_to_bim 任务和方案输入工件。');
  const selected = useMemo(
    () => requirements.find((item) => item.file.id === selectedFileId) ?? null,
    [requirements, selectedFileId],
  );
  const selectedRecord = selected?.record ?? null;
  const readiness = selectedRecord ? buildConceptDesignReadiness(selectedRecord) : [];

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage('正在读取市场客服数据库需求包...');
    try {
      const payload = await moduleFileApiClient.listModuleFiles('marketing_service', {
        limit: 500,
      });
      const files = payload.files.filter(isMarketingRequirementFile);
      const summaries = (await Promise.all(
        files.slice(0, 24).map(async (file) => {
          try {
            const content = await moduleFileApiClient.getModuleFileContent(file.id);
            const record = parseMarketingRequirementContent(content.content);
            return record ? { file, record } : { file };
          } catch {
            return { file };
          }
        }),
      )).sort((a, b) => String(b.file.updatedAt).localeCompare(String(a.file.updatedAt)));
      const visibleSummaries = dedupeRequirementSummaries(summaries).slice(0, 5);
      setRequirements(visibleSummaries);
      setSelectedFileId((current) => current ?? visibleSummaries[0]?.file.id ?? null);
      setMessage(
        visibleSummaries.length > 0
          ? `已读取 ${visibleSummaries.length} 个可承接需求包。`
          : '市场客服 CDE 暂无可承接需求包。请先在市场客服模块录入客户需求。',
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
      setCreatedArtifactName(artifact.name);
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
    <section className="flex h-full min-h-[680px] flex-col gap-3 p-3">
      <div className="arch-huly-row rounded-md border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <HeaderBlock
            title="客户需求承接"
            description="从市场客服 CDE 读取需求包,形成方案设计输入、GenerationRouter 任务和可审计 CDE 工件。"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={refresh} loading={loading}>
              刷新需求包
            </Button>
            <Button type="primary" onClick={importAndGenerate} loading={running} disabled={!selectedRecord}>
              生成方案任务
            </Button>
          </div>
        </div>
      </div>
      <Alert type="info" showIcon message={message} />

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="arch-huly-row min-h-0 rounded-md border">
          <div className="border-b arch-border px-4 py-3">
            <p className="arch-primary-text arch-type-caption font-medium">待承接需求</p>
            <p className="arch-muted mt-1 arch-type-caption">
              {loading ? '正在同步...' : `最新 ${requirements.length} 个去重需求包`}
            </p>
          </div>
          <div className="max-h-[520px] overflow-auto p-2">
            {requirements.length > 0 ? (
              <div className="grid gap-2">
                {requirements.map((item) => {
                  const active = item.file.id === selectedFileId;
                  return (
                    <button
                      key={item.file.id}
                      type="button"
                      onClick={() => setSelectedFileId(item.file.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left transition ${
                        active
                          ? 'border-[var(--module-accent)] bg-[var(--module-accent-soft)]'
                          : 'arch-border bg-[var(--arch-surface)] hover:border-[var(--module-accent)]'
                      }`}
                    >
                      <span className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate arch-type-body font-medium arch-text">
                          {item.record?.customerName ?? item.file.name}
                        </span>
                        <span className="shrink-0 rounded border arch-border px-1.5 py-0.5 arch-type-caption arch-muted">
                          CDE
                        </span>
                      </span>
                      <span className="mt-1 block truncate arch-type-caption arch-muted">
                        {item.record
                          ? `${item.record.geoLocation} · ${formatRequirementFloors(item.record)} · ${item.record.buildingStructure ?? '结构待定'}`
                          : item.file.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed arch-border px-6 text-center arch-type-caption arch-muted">
                市场客服模块还没有可承接需求包。
              </div>
            )}
          </div>
        </aside>

        <section className="arch-huly-row min-h-0 rounded-md border p-4">
          {selectedRecord ? (
            <div className="grid h-full min-h-0 content-start gap-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="arch-primary-text arch-type-caption font-medium">当前方案输入</p>
                  <h3 className="mt-1 text-[18px] font-medium leading-7 arch-text">{selectedRecord.customerName}</h3>
                  <p className="arch-muted arch-type-caption">{selected?.file.name}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRecord.aiReadiness.preferredOutputs.map((output) => (
                    <Tag key={output} color="blue">{output}</Tag>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <RequirementFact label="项目位置" value={selectedRecord.geoLocation} />
                <RequirementFact label="建筑规模" value={`${formatRequirementFloors(selectedRecord)} · ${formatArea(selectedRecord)}`} />
                <RequirementFact label="结构/风格" value={`${selectedRecord.buildingStructure ?? '结构待定'} · ${selectedRecord.architecturalStyle ?? selectedRecord.decorationStyle ?? '风格待定'}`} />
                <RequirementFact label="预算" value={formatBudget(selectedRecord)} />
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-md border arch-border bg-[var(--arch-surface-muted)] p-4">
                  <p className="arch-primary-text arch-type-caption font-medium">方案任务将写入</p>
                  <div className="mt-3 grid gap-2">
                    <PipelineRow label="源需求" value={selected?.file.name ?? '-'} />
                    <PipelineRow label="任务类型" value="concept_design / text_to_bim" />
                    <PipelineRow label="执行路径" value="Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver" />
                    <PipelineRow label="输出工件" value="方案生成任务 docx + GenerationJob trace" />
                  </div>
                  {createdArtifactName ? (
                    <p className="mt-3 rounded-md border border-[var(--arch-success)] px-3 py-2 arch-type-caption text-[var(--arch-success)]">
                      已生成: {createdArtifactName}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-md border arch-border bg-[var(--arch-surface)] p-4">
                  <p className="arch-primary-text arch-type-caption font-medium">输入完整性</p>
                  <div className="mt-3 grid gap-2">
                    {readiness.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 arch-type-caption">
                        <span className="arch-text">{item.label}</span>
                        <span className={item.ready ? 'text-[var(--arch-success)]' : 'text-[var(--arch-warning)]'}>
                          {item.ready ? '已具备' : '需补充'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selectedRecord.remarks ? (
                <div className="rounded-md border arch-border bg-[var(--arch-surface-muted)] p-4">
                  <p className="arch-primary-text arch-type-caption font-medium">客户备注</p>
                  <p className="mt-2 arch-type-body leading-6 arch-text">{selectedRecord.remarks}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-md border border-dashed arch-border px-6 text-center">
              <div>
                <p className="arch-text arch-type-body font-medium">没有选中的需求包</p>
                <p className="arch-muted mt-2 max-w-md arch-type-caption leading-5">
                  在市场客服模块保存客户需求后,这里会显示可承接的 CDE 需求包,并可创建方案设计生成任务。
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function dedupeRequirementSummaries(items: RequirementSummary[]): RequirementSummary[] {
  const seen = new Set<string>();
  const result: RequirementSummary[] = [];
  for (const item of items) {
    const key = requirementDedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function requirementDedupeKey(item: RequirementSummary): string {
  const record = item.record;
  if (!record) return item.file.name;
  return [
    record.customerName.trim(),
    record.phone.trim(),
    record.geoLocation.trim(),
    record.buildingFloors ?? record.buildingScale ?? '',
    record.buildingArea ?? '',
  ].join('|');
}

function buildConceptDesignReadiness(record: MarketingRequirementRecord): Array<{ label: string; ready: boolean }> {
  return [
    { label: '客户和联系方式', ready: Boolean(record.customerName && record.phone) },
    { label: '项目位置', ready: Boolean(record.geoLocation) },
    { label: '建筑规模', ready: Boolean(record.buildingArea || record.buildingFloors || record.buildingScale) },
    { label: '结构或风格', ready: Boolean(record.buildingStructure || record.architecturalStyle || record.decorationStyle) },
    { label: '预算边界', ready: typeof record.budget === 'number' && record.budget > 0 },
    { label: 'AI 输出格式', ready: record.aiReadiness.preferredOutputs.length > 0 },
  ];
}

function RequirementFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border arch-border bg-[var(--arch-surface-muted)] p-3">
      <p className="arch-primary-text arch-type-caption">{label}</p>
      <p className="mt-1 truncate arch-type-body font-medium arch-text" title={value}>
        {value}
      </p>
    </div>
  );
}

function PipelineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border arch-border bg-[var(--arch-surface)] px-3 py-2 md:grid-cols-[110px_minmax(0,1fr)]">
      <span className="arch-type-caption arch-muted">{label}</span>
      <span className="min-w-0 truncate arch-type-caption arch-text" title={value}>
        {value}
      </span>
    </div>
  );
}

function formatArea(record: MarketingRequirementRecord): string {
  return typeof record.buildingArea === 'number' ? `${record.buildingArea} m2` : '面积待定';
}

function formatBudget(record: MarketingRequirementRecord): string {
  if (typeof record.budget !== 'number') return '预算待定';
  return `${record.budget.toLocaleString('zh-CN')} ${record.budgetCurrency ?? 'CNY'}`;
}

async function createConceptDesignGenerationJob(
  record: MarketingRequirementRecord,
  sourceFile: ModuleFileNode,
  prompt: string,
): Promise<GenerationJob | null> {
  const created = await generationClient.create({
    moduleId: 'concept_design',
    mode: 'text_to_bim',
    prompt,
    actor: 'marketing-service-scheme-generator',
    constraints: {
      sourceRequirementFileId: sourceFile.id,
      requirement: record,
      outputFormats: record.aiReadiness.preferredOutputs,
      openBimStandard: 'IFC4.3',
      route: 'Planner->Generator->Evaluator->RuleChecker->SchemaValidator->Approver',
      optionCount: 3,
    },
  });
  const planned = await generationClient.plan(created.id, {
    actor: 'marketing-service-scheme-generator',
    comment: 'create architecture options before customer deposit',
  });
  const run = await runGeneration(planned);
  return run ?? planned;
}

function buildConceptSchemeOptions(
  record: MarketingRequirementRecord,
  round: number,
  job: GenerationJob | null,
): ConceptSchemeOption[] {
  const baseStyle = record.architecturalStyle ?? record.decorationStyle ?? '现代简约';
  const floorsLabel = formatRequirementFloors(record);
  const location = record.geoLocation || '项目所在地待定';
  const area = typeof record.buildingArea === 'number' ? `${record.buildingArea} m2` : '面积待定';
  const structure = record.buildingStructure ?? '结构体系待定';
  const variants = [
    {
      suffix: 'A',
      title: `${baseStyle} · 成本均衡方案`,
      summary: `面向 ${location} 的 ${floorsLabel},控制体量和开间,优先平衡造价、施工速度和客户展示效果。`,
      spatialStrategy: `建议采用清晰中轴与可复制标准房型,按 ${area} 和 ${structure} 进行初步空间组织。`,
      costStrategy: '成本均衡',
    },
    {
      suffix: 'B',
      title: `${baseStyle} · 景观体验方案`,
      summary: `强化入口、庭院、露台或公共空间的到访体验,适合民宿、酒店和展示型项目比选。`,
      spatialStrategy: `优先组织景观面、动线和公共活动区,后续需结合红线、朝向、退界和消防条件复核。`,
      costStrategy: '体验优先',
    },
    {
      suffix: 'C',
      title: `${baseStyle} · 快速建造方案`,
      summary: `偏向标准化构件、简化节点和可复制生产,适合重钢/装配式快速交付路径。`,
      spatialStrategy: `优先控制柱网、标准层、运输和吊装边界,为深化设计、制造和施工模块预留接口。`,
      costStrategy: '工期优先',
    },
  ];
  return variants.map((variant) => ({
    id: `scheme-${record.id}-r${round}-${variant.suffix}`,
    title: `第 ${round} 轮方案 ${variant.suffix}: ${variant.title}`,
    architecturalStyle: baseStyle,
    buildingFloorsLabel: floorsLabel,
    summary: variant.summary,
    spatialStrategy: variant.spatialStrategy,
    costStrategy: variant.costStrategy,
    aiStatus: job ? `AI任务 ${job.status}` : '经验草案',
    ...(job?.id ? { generationJobId: job.id } : {}),
  }));
}

function formatRequirementFloors(record: MarketingRequirementRecord): string {
  if (typeof record.buildingFloors === 'number') return `${record.buildingFloors} 层`;
  return record.buildingScale ?? '建筑层数待定';
}

async function persistConceptSchemeOptions(
  record: MarketingRequirementRecord,
  sourceFile: ModuleFileNode,
  options: ConceptSchemeOption[],
  job: GenerationJob | null,
  prompt: string,
): Promise<ModuleFileNode> {
  const payload = {
    schema: 'architoken.concept_design.option_bundle.v1',
    sourceRequirementFileId: sourceFile.id,
    sourceRequirementFileName: sourceFile.name,
    requirement: record,
    generationJobId: job?.id ?? null,
    generationStatus: job?.status ?? 'draft_assist',
    options,
    prompt,
    createdAt: new Date().toISOString(),
  };
  const content = buildConceptSchemeOptionsDocument(payload);
  return moduleFileApiClient.createModuleFile({
    moduleId: 'concept_design',
    parentId: null,
    name: `建筑方案比选-${record.customerName}-${new Date().toISOString().slice(0, 10)}.docx`,
    kind: 'file',
    mimeType: editableOfficeDocumentMimeType,
    sizeBytes: new TextEncoder().encode(content).byteLength,
    owner: '方案设计',
    tags: ['concept-design-options', 'marketing-requirement', 'customer-confirmation-required', 'office-document', 'editable-document', 'database-backed'],
    content,
  });
}

function buildConceptSchemeOptionsDocument(payload: {
  schema: string;
  sourceRequirementFileId: string;
  sourceRequirementFileName: string;
  requirement: MarketingRequirementRecord;
  generationJobId: string | null;
  generationStatus: string;
  options: ConceptSchemeOption[];
  prompt: string;
  createdAt: string;
}): string {
  const optionBlocks = payload.options.map((option) => [
    `<section class="doc-section">`,
    `<h2>${escapeHtml(option.title)}</h2>`,
    '<table><tbody>',
    `<tr><th>建筑风格</th><td>${escapeHtml(option.architecturalStyle)}</td></tr>`,
    `<tr><th>建筑层数</th><td>${escapeHtml(option.buildingFloorsLabel)}</td></tr>`,
    `<tr><th>成本策略</th><td>${escapeHtml(option.costStrategy)}</td></tr>`,
    `<tr><th>AI 状态</th><td>${escapeHtml(option.aiStatus)}</td></tr>`,
    '</tbody></table>',
    `<p>${escapeHtml(option.summary ?? '')}</p>`,
    `<p>${escapeHtml(option.spatialStrategy)}</p>`,
    '</section>',
  ].join('')).join('');
  return [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" />',
    `<title>${escapeHtml(`建筑方案比选 - ${payload.requirement.customerName}`)}</title>`,
    '<style>body{font-family:"Noto Sans SC","Microsoft YaHei",Arial,sans-serif;color:#111827;line-height:1.55;margin:0;padding:32px;background:#fff;}h1{font-size:22px;margin:0 0 6px}.subtitle{color:#64748b;font-size:12px;margin:0 0 24px}.doc-section{margin-top:20px}h2{font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin:0 0 10px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #e5e7eb;padding:8px 10px;text-align:left;vertical-align:top}th{width:180px;background:#f8fafc;color:#475569;font-weight:600}p{font-size:13px;margin:8px 0}</style>',
    '</head><body>',
    `<h1>${escapeHtml(`建筑方案比选 - ${payload.requirement.customerName}`)}</h1>`,
    `<p class="subtitle">${escapeHtml(payload.requirement.geoLocation)} · ${escapeHtml(payload.generationStatus)}</p>`,
    optionBlocks,
    `<section class="doc-section"><h2>专业复核边界</h2><p>当前方案仍为草案,正式报审、结构、消防、造价和施工结论必须进入专业复核链。</p></section>`,
    `<script type="application/json" data-architoken-payload="${escapeHtml(payload.schema)}">${JSON.stringify(payload).replace(/</g, '\\u003c').replace(/<\/script/gi, '<\\/script')}</script>`,
    '</body></html>',
  ].join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  const payload = {
    schema: 'architoken.concept_design.requirement_import.v1',
    sourceRequirementFileId: sourceFile.id,
    sourceRequirementFileName: sourceFile.name,
    requirement: record,
    generationJobId: job.id,
    generationStatus: job.status,
    prompt,
    createdAt: new Date().toISOString(),
  };
  const content = [
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" />',
    `<title>${escapeHtml(`方案生成任务 - ${record.customerName}`)}</title>`,
    '<style>body{font-family:"Noto Sans SC","Microsoft YaHei",Arial,sans-serif;color:#111827;line-height:1.55;margin:0;padding:32px;background:#fff;}h1{font-size:22px;margin:0 0 6px}.subtitle{color:#64748b;font-size:12px;margin:0 0 24px}.doc-section{margin-top:20px}h2{font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin:0 0 10px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #e5e7eb;padding:8px 10px;text-align:left;vertical-align:top}th{width:180px;background:#f8fafc;color:#475569;font-weight:600}pre{white-space:pre-wrap;background:#f8fafc;border:1px solid #e5e7eb;padding:12px;font-size:12px}</style>',
    '</head><body>',
    `<h1>${escapeHtml(`方案生成任务 - ${record.customerName}`)}</h1>`,
    `<p class="subtitle">${escapeHtml(record.geoLocation)} · ${escapeHtml(job.status)}</p>`,
    '<section class="doc-section"><h2>任务信息</h2><table><tbody>',
    `<tr><th>源需求文件</th><td>${escapeHtml(sourceFile.name)}</td></tr>`,
    `<tr><th>生成任务</th><td>${escapeHtml(job.id)}</td></tr>`,
    `<tr><th>任务状态</th><td>${escapeHtml(job.status)}</td></tr>`,
    '</tbody></table></section>',
    `<section class="doc-section"><h2>Prompt</h2><pre>${escapeHtml(prompt)}</pre></section>`,
    `<script type="application/json" data-architoken-payload="${escapeHtml(payload.schema)}">${JSON.stringify(payload).replace(/</g, '\\u003c').replace(/<\/script/gi, '<\\/script')}</script>`,
    '</body></html>',
  ].join('');
  return moduleFileApiClient.createModuleFile({
    moduleId: 'concept_design',
    parentId: null,
    name: `方案生成任务-${record.customerName}-${new Date().toISOString().slice(0, 10)}.docx`,
    kind: 'file',
    mimeType: editableOfficeDocumentMimeType,
    sizeBytes: new TextEncoder().encode(content).byteLength,
    owner: '方案设计',
    tags: ['concept-design-import', 'marketing-requirement', 'text-to-bim', 'office-document', 'editable-document', 'database-backed'],
    content,
  });
}

function HeaderBlock({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="arch-primary-text arch-type-caption font-medium">AI 数据闭环</p>
      <h3 className="arch-text mt-1 arch-type-body font-medium">{title}</h3>
      <p className="arch-muted mt-1 arch-type-caption leading-5">{description}</p>
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
