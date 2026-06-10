// components/pan-ui.tsx - PanUI web primitives for ArchIToken.
// License: Apache-2.0
"use client";

import {
  cloneElement,
  createContext,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type FormEvent,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type Key,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/insome/ui/cn";

type PrimitiveSize = "small" | "middle" | "large";
type PrimitiveTone =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "blue"
  | "green"
  | "gold"
  | "red"
  | "cyan";

function sizeClass(size?: PrimitiveSize): string {
  if (size === "small") return "min-h-7 px-2 text-xs";
  if (size === "large") return "min-h-10 px-4 text-sm";
  return "min-h-8 px-3 text-sm";
}

function toneClass(tone?: PrimitiveTone | string): string {
  switch (tone) {
    case "primary":
    case "blue":
      return "border-[var(--arch-primary)] bg-[var(--arch-primary)] text-white hover:brightness-95";
    case "success":
    case "green":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "warning":
    case "gold":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "error":
    case "red":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "cyan":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "info":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-[var(--arch-border)] bg-[var(--arch-surface)] text-[var(--arch-text)] hover:bg-[var(--arch-surface-muted)]";
  }
}

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  type?: "default" | "primary" | "text" | "link";
  htmlType?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  size?: PrimitiveSize;
  danger?: boolean;
  block?: boolean;
  icon?: ReactNode;
  href?: string;
  loading?: boolean;
  shape?: "default" | "circle" | "round" | string;
  target?: AnchorHTMLAttributes<HTMLAnchorElement>["target"];
  rel?: string;
  download?: AnchorHTMLAttributes<HTMLAnchorElement>["download"];
}

export function Button({
  type = "default",
  htmlType = "button",
  size,
  danger,
  block,
  icon,
  href,
  loading,
  shape,
  target,
  rel,
  download,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseClass = cn(
    "arch-ui-button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border font-medium transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arch-primary)] focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    sizeClass(size),
    shape === "circle" ? "aspect-square rounded-full px-0" : shape === "round" ? "rounded-full" : "rounded-md",
    type === "primary"
      ? toneClass(danger ? "error" : "primary")
      : type === "text" || type === "link"
        ? "border-transparent bg-transparent text-[var(--arch-text)] hover:bg-[var(--arch-huly-hover-bg)]"
        : toneClass(danger ? "error" : "default"),
    block ? "w-full" : null,
    className,
  );

  if (href) {
    return (
      <a
        className={baseClass}
        download={download}
        href={href}
        rel={rel}
        target={target}
        aria-disabled={disabled || loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {children}
      </a>
    );
  }

  return (
    <button className={baseClass} disabled={disabled || loading} type={htmlType} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  color?: PrimitiveTone | string;
  icon?: ReactNode;
}

export function Tag({ color, icon, className, children, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        toneClass(color),
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

export function Tooltip({
  title,
  children,
}: {
  title?: ReactNode;
  children: ReactNode;
  placement?: string;
}) {
  const text = typeof title === "string" ? title : undefined;
  return (
    <span className="contents" title={text}>
      {children}
    </span>
  );
}

export function Empty({
  description = "暂无数据",
  className,
}: {
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-4 py-8 text-center text-sm text-[var(--arch-text-muted)]",
        className,
      )}
    >
      {description}
    </div>
  );
}

export function Spin({
  tip,
  size,
  children,
}: {
  tip?: ReactNode;
  size?: PrimitiveSize;
  children?: ReactNode;
}) {
  if (children) return <>{children}</>;
  return (
    <div className="inline-flex items-center justify-center gap-2 text-sm text-[var(--arch-text-muted)]">
      <Loader2
        className={cn("animate-spin", size === "small" ? "h-4 w-4" : "h-5 w-5")}
      />
      {tip ? <span>{tip}</span> : null}
    </div>
  );
}

export function Progress({
  percent = 0,
  showInfo = true,
  className,
}: {
  percent?: number;
  showInfo?: boolean;
  size?: PrimitiveSize | number;
  status?: string;
  strokeColor?: string;
  className?: string;
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--arch-huly-row-bg)]">
        <div
          className="h-full rounded-full bg-[var(--arch-primary)] transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      {showInfo ? (
        <span className="w-10 text-right text-xs text-[var(--arch-text-muted)]">
          {value}%
        </span>
      ) : null}
    </div>
  );
}

export interface SegmentedOption<T extends string | number = string> {
  label: ReactNode;
  value: T;
  disabled?: boolean;
}

export function Segmented<T extends string | number = string>({
  options,
  value,
  onChange,
  className,
  block,
}: {
  options: Array<SegmentedOption<T> | T>;
  value?: T | null | undefined;
  onChange?: (value: T) => void;
  size?: PrimitiveSize;
  className?: string;
  block?: boolean;
}) {
  const normalized = options.map((option) =>
    typeof option === "object"
      ? option
      : ({ label: String(option), value: option } satisfies SegmentedOption<T>),
  );
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] p-1",
        block ? "flex w-full" : null,
        className,
      )}
    >
      {normalized.map((option) => (
        <button
          key={String(option.value)}
          className={cn(
            "rounded px-2 py-1 text-xs font-medium transition",
            option.value === value
              ? "bg-[var(--arch-surface)] text-[var(--arch-text)] shadow-sm"
              : "text-[var(--arch-text-muted)] hover:text-[var(--arch-text)]",
          )}
          disabled={option.disabled}
          type="button"
          onClick={() => onChange?.(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export interface ArchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  size?: PrimitiveSize;
  prefix?: ReactNode;
  variant?: "borderless" | "outlined";
  allowClear?: boolean;
  onPressEnter?: () => void;
}

function inputClass({
  size,
  variant,
  className,
}: {
  size?: PrimitiveSize | undefined;
  variant?: string | undefined;
  className?: string | undefined;
}) {
  return cn(
    "w-full rounded-md border bg-[var(--arch-surface)] text-sm text-[var(--arch-text)] outline-none transition placeholder:text-[var(--arch-text-muted)]",
    "focus:border-[var(--arch-primary)] focus:ring-1 focus:ring-[var(--arch-primary)] disabled:cursor-not-allowed disabled:opacity-50",
    size === "small" ? "h-7 px-2" : size === "large" ? "h-10 px-3" : "h-8 px-2.5",
    variant === "borderless" ? "border-transparent bg-transparent shadow-none" : "border-[var(--arch-border)]",
    className,
  );
}

export function Input({
  size,
  prefix,
  variant,
  onPressEnter,
  className,
  onKeyDown,
  ...props
}: ArchInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.key === "Enter") onPressEnter?.();
  };
  if (prefix) {
    return (
      <span className="relative block">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--arch-text-muted)]">
          {prefix}
        </span>
        <input
          className={inputClass({
            size,
            variant,
            className: cn("pl-8", className),
          })}
          onKeyDown={handleKeyDown}
          {...props}
        />
      </span>
    );
  }
  return (
    <input
      className={inputClass({ size, variant, className })}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

Input.TextArea = function TextArea({
  className,
  rows = 3,
  autoSize,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  autoSize?: boolean | { minRows?: number; maxRows?: number };
}) {
  const resolvedRows =
    typeof autoSize === "object" && autoSize.minRows ? autoSize.minRows : rows;
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)] px-2.5 py-2 text-sm text-[var(--arch-text)] outline-none transition placeholder:text-[var(--arch-text-muted)] focus:border-[var(--arch-primary)] focus:ring-1 focus:ring-[var(--arch-primary)]",
        className,
      )}
      rows={resolvedRows}
      {...props}
    />
  );
};

export interface InputNumberProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size"> {
  value?: number | string | null;
  onChange?: (value: number | null) => void;
  size?: PrimitiveSize;
  controls?: boolean;
}

export function InputNumber({
  value,
  onChange,
  className,
  size,
  min,
  max,
  step,
  ...props
}: InputNumberProps) {
  return (
    <input
      className={inputClass({ size, className })}
      max={max}
      min={min}
      step={step}
      type="number"
      value={value ?? ""}
      onChange={(event) => {
        const next = event.target.value;
        onChange?.(next === "" ? null : Number(next));
      }}
      {...props}
    />
  );
}

export interface SelectOption<T extends string | number = string> {
  label: ReactNode;
  value: T;
  disabled?: boolean;
}

export interface SelectProps<T extends string | number = string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "size"> {
  value?: T | null | undefined;
  options?: Array<SelectOption<T>>;
  onChange?: (value: T) => void;
  allowClear?: boolean;
  popupMatchSelectWidth?: boolean;
  placeholder?: string;
  showSearch?: boolean;
  optionFilterProp?: string;
  variant?: string;
  size?: PrimitiveSize;
}

export function Select<T extends string | number = string>({
  value,
  options = [],
  onChange,
  allowClear,
  className,
  size,
  placeholder,
  popupMatchSelectWidth: _popupMatchSelectWidth,
  showSearch: _showSearch,
  optionFilterProp: _optionFilterProp,
  variant: _variant,
  ...props
}: SelectProps<T>) {
  void _popupMatchSelectWidth;
  void _showSearch;
  void _optionFilterProp;
  void _variant;

  return (
    <select
      className={inputClass({ size, className })}
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(event) => onChange?.(event.target.value as T)}
      {...props}
    >
      {placeholder || allowClear ? <option value="">{placeholder ?? "未选择"}</option> : null}
      {options.map((option) => (
        <option
          key={String(option.value)}
          disabled={option.disabled}
          value={String(option.value)}
        >
          {typeof option.label === "string" ? option.label : String(option.value)}
        </option>
      ))}
    </select>
  );
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className,
}: {
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <input
      className={cn("w-full accent-[var(--arch-primary)]", className)}
      max={max}
      min={min}
      step={step}
      type="range"
      value={value ?? min}
      onChange={(event) => onChange?.(Number(event.target.value))}
    />
  );
}

export function Switch({
  checked,
  onChange,
  className,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  size?: PrimitiveSize;
}) {
  return (
    <button
      aria-pressed={checked}
      className={cn(
        "relative h-5 w-9 rounded-full border border-[var(--arch-border)] transition",
        checked ? "bg-[var(--arch-primary)]" : "bg-[var(--arch-huly-row-bg)]",
        className,
      )}
      type="button"
      onClick={() => onChange?.(!checked)}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
          checked ? "left-4" : "left-0.5",
        )}
      />
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  className,
}: {
  checked?: boolean;
  onChange?: (event: { target: { checked: boolean } }) => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <input
        checked={checked}
        className="accent-[var(--arch-primary)]"
        type="checkbox"
        onChange={(event) => onChange?.({ target: { checked: event.target.checked } })}
      />
      {children}
    </label>
  );
}

type ColumnRender<T> = {
  bivariantHack(value: unknown, record: T, index: number): ReactNode;
}["bivariantHack"];

export interface ColumnType<T> {
  title?: ReactNode;
  dataIndex?: keyof T | string;
  key?: string;
  width?: number | string;
  render?: ColumnRender<T>;
}

export type ColumnsType<T> = Array<ColumnType<T>>;

export function Table<T extends object>({
  columns,
  dataSource,
  rowKey,
  className,
  rowClassName,
  onRow,
  expandable,
}: {
  columns: ColumnsType<T>;
  dataSource: T[];
  rowKey?: keyof T | ((record: T) => string);
  pagination?: boolean | object;
  size?: PrimitiveSize;
  scroll?: object;
  className?: string;
  expandable?: {
    expandedRowKeys?: Key[];
    onExpandedRowsChange?: (keys: Key[]) => void;
    expandedRowRender?: (record: T, index: number) => ReactNode;
  };
  rowClassName?: (record: T, index: number) => string;
  onRow?: (record: T, index: number) => HTMLAttributes<HTMLTableRowElement>;
}) {
  const keyOf = (record: T, index: number) => {
    if (typeof rowKey === "function") return rowKey(record);
    if (rowKey) return String(record[rowKey]);
    return String(index);
  };

  return (
    <div className={cn("w-full overflow-auto rounded-md border border-[var(--arch-border)]", className)}>
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-[var(--arch-surface-muted)] text-xs font-semibold text-[var(--arch-text-muted)]">
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.key ?? String(column.dataIndex ?? index)}
                className="border-b border-[var(--arch-border)] px-3 py-2"
                style={column.width ? { width: column.width } : undefined}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource.map((record, rowIndex) => {
            const rowProps = onRow?.(record, rowIndex) ?? {};
            const key = keyOf(record, rowIndex);
            const expanded =
              expandable?.expandedRowKeys?.map(String).includes(String(key)) ?? false;
            return (
              <Fragment key={key}>
                <tr
                  {...rowProps}
                  className={cn(
                    "border-b border-[var(--arch-border)] last:border-0",
                    rowClassName?.(record, rowIndex),
                    rowProps.className,
                  )}
                >
                  {columns.map((column, columnIndex) => {
                    const value = column.dataIndex
                      ? (record as Record<string, unknown>)[String(column.dataIndex)]
                      : undefined;
                    return (
                      <td
                        key={column.key ?? String(column.dataIndex ?? columnIndex)}
                        className="px-3 py-2 align-top text-[var(--arch-text)]"
                      >
                        {column.render ? column.render(value, record, rowIndex) : (value as ReactNode)}
                      </td>
                    );
                  })}
                </tr>
                {expanded && expandable?.expandedRowRender ? (
                  <tr key={`${key}-expanded`}>
                    <td className="px-3 py-3" colSpan={columns.length}>
                      {expandable.expandedRowRender(record, rowIndex)}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Alert({
  type = "info",
  showIcon,
  message,
  description,
  className,
}: {
  type?: "success" | "info" | "warning" | "error";
  showIcon?: boolean;
  message?: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  const Icon =
    type === "success" ? CheckCircle2 : type === "info" ? Info : AlertCircle;
  return (
    <div
      className={cn(
        "flex gap-2 rounded-md border px-3 py-2 text-sm",
        toneClass(type),
        className,
      )}
    >
      {showIcon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" /> : null}
      <div className="min-w-0">
        {message ? <div className="font-medium">{message}</div> : null}
        {description ? <div className="mt-1 text-xs opacity-80">{description}</div> : null}
      </div>
    </div>
  );
}

export function Badge({
  count,
  dot,
  color,
  text,
  children,
  className,
}: {
  count?: ReactNode;
  dot?: boolean;
  color?: string;
  status?: string;
  text?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const marker = dot ? (
    <span
      className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
      style={{ background: color ?? "var(--arch-danger)" }}
    />
  ) : count !== undefined ? (
    <span className="absolute -right-2 -top-2 rounded-full bg-[var(--arch-danger)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
      {count}
    </span>
  ) : null;
  return (
    <span className={cn("relative inline-flex items-center gap-1", className)}>
      {children}
      {marker}
      {text ? <span className="text-xs text-[var(--arch-text-muted)]">{text}</span> : null}
    </span>
  );
}

export function QRCode({
  value,
  size = 180,
  bordered = true,
  color = "#000",
  className,
}: {
  value: string;
  size?: number;
  icon?: string;
  bordered?: boolean;
  color?: string;
  className?: string;
}) {
  const bits = useMemo(() => {
    let hash = 2166136261;
    for (const char of value) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return Array.from({ length: 21 * 21 }, (_, index) => {
      const marker =
        (index % 21 < 6 && Math.floor(index / 21) < 6) ||
        (index % 21 > 14 && Math.floor(index / 21) < 6) ||
        (index % 21 < 6 && Math.floor(index / 21) > 14);
      return marker || ((hash >> index % 24) + index * 13) % 7 < 3;
    });
  }, [value]);
  return (
    <div
      aria-label={value}
      className={cn(
        "grid rounded-md bg-white p-2",
        bordered ? "border border-[var(--arch-border)]" : null,
        className,
      )}
      style={{
        gridTemplateColumns: "repeat(21, minmax(0, 1fr))",
        height: size,
        width: size,
      }}
    >
      {bits.map((filled, index) => (
        <span key={index} style={{ background: filled ? color : "#fff" }} />
      ))}
    </div>
  );
}

type FormStore = Record<string, unknown>;
type FormSubscriber = () => void;

export interface FormInstance<T extends object = Record<string, unknown>> {
  getFieldsValue: () => T;
  getFieldValue: <K extends keyof T & string>(name: K) => T[K] | undefined;
  setFieldValue: <K extends keyof T & string>(name: K, value: T[K] | undefined) => void;
  setFieldsValue: (values: Partial<T>) => void;
  resetFields: () => void;
  subscribe: (subscriber: FormSubscriber) => () => void;
}

function createFormInstance<T extends object>(): FormInstance<T> {
  let initialValues: FormStore = {};
  let values: FormStore = {};
  const subscribers = new Set<FormSubscriber>();
  const notify = () => subscribers.forEach((subscriber) => subscriber());
  return {
    getFieldsValue: () => ({ ...values }) as T,
    getFieldValue: (name) => values[name] as T[typeof name] | undefined,
    setFieldValue: (name, value) => {
      values = { ...values, [name]: value };
      notify();
    },
    setFieldsValue: (next) => {
      values = { ...values, ...(next as FormStore) };
      initialValues = { ...initialValues, ...(next as FormStore) };
      notify();
    },
    resetFields: () => {
      values = { ...initialValues };
      notify();
    },
    subscribe: (subscriber) => {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
  };
}

const FormContext = createContext<FormInstance<object> | null>(null);

function useProvidedForm<T extends object>(form?: FormInstance<T>) {
  const [fallback] = useState(() => createFormInstance<T>());
  return form ?? fallback;
}

function FormRoot<T extends object = Record<string, unknown>>({
  form,
  initialValues,
  onFinish,
  className,
  children,
}: {
  form?: FormInstance<T>;
  layout?: "vertical" | "horizontal";
  size?: PrimitiveSize;
  initialValues?: Partial<T>;
  onFinish?: (values: T) => void | Promise<void>;
  className?: string;
  children?: ReactNode;
}) {
  const currentForm = useProvidedForm(form);
  useEffect(() => {
    if (initialValues) currentForm.setFieldsValue(initialValues);
  }, [currentForm, initialValues]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onFinish?.(currentForm.getFieldsValue());
  }

  return (
    <FormContext.Provider value={currentForm as unknown as FormInstance<object>}>
      <form className={className} onSubmit={submit}>
        {children}
      </form>
    </FormContext.Provider>
  );
}

function FormItem<T extends object = Record<string, unknown>>({
  name,
  label,
  noStyle,
  children,
}: {
  name?: keyof T & string;
  label?: ReactNode;
  rules?: Array<{ required?: boolean; message?: string }>;
  noStyle?: boolean;
  children?: ReactNode;
}) {
  const form = useContext(FormContext) as FormInstance<T> | null;
  const [, setVersion] = useState(0);
  useEffect(() => form?.subscribe(() => setVersion((version) => version + 1)), [form]);

  const child =
    name && form && children && typeof children === "object" && "props" in children
      ? cloneFormChild(children as ReactElement, form, name)
      : children;

  if (noStyle) return <>{child}</>;
  return (
    <label className="grid gap-1.5 text-sm">
      {label ? <span className="font-medium text-[var(--arch-text)]">{label}</span> : null}
      {child}
    </label>
  );
}

function cloneFormChild<T extends object>(
  child: ReactElement,
  form: FormInstance<T>,
  name: keyof T & string,
) {
  const value = form.getFieldValue(name);
  type FormChildProps = {
    value?: unknown;
    onChange?: (next: unknown) => void;
  };
  const typedChild = child as ReactElement<FormChildProps>;
  return cloneElement(typedChild, {
    value: value ?? typedChild.props.value,
    onChange: (next: unknown) => {
      typedChild.props.onChange?.(next);
      if (next && typeof next === "object" && "target" in next) {
        const event = next as { target?: { value?: unknown; checked?: unknown } };
        form.setFieldValue(
          name,
          (event.target?.value ?? event.target?.checked) as T[typeof name],
        );
        return;
      }
      form.setFieldValue(name, next as T[typeof name]);
    },
  });
}

function useForm<T extends object = Record<string, unknown>>() {
  const [form] = useState(() => createFormInstance<T>());
  return [form] as const;
}

function useWatch<T extends object, K extends keyof T & string>(
  name: K,
  form: FormInstance<T>,
) {
  const [value, setValue] = useState(() => form.getFieldValue(name));
  useEffect(
    () =>
      form.subscribe(() => {
        setValue(form.getFieldValue(name));
      }),
    [form, name],
  );
  return value;
}

export const Form = Object.assign(FormRoot, {
  Item: FormItem,
  useForm,
  useWatch,
});

export type CascaderProps<T> = {
  loadData?: (selectedOptions: T[]) => void;
};

function flattenOptions<T extends { label: ReactNode; value: string; children?: T[] }>(
  options: T[],
  prefix: string[] = [],
): Array<{ label: string; value: string }> {
  return options.flatMap((option) => {
    const label = [...prefix, String(option.label)];
    if (!option.children?.length) {
      return [{ label: label.join(" / "), value: [...prefix, option.value].join("/") }];
    }
    return flattenOptions(option.children, label);
  });
}

export function Cascader<T extends { label: ReactNode; value: string; children?: T[] }>({
  options,
  onChange,
  placeholder,
  className,
}: {
  options: T[];
  loadData?: (selectedOptions: T[]) => void;
  placeholder?: string;
  changeOnSelect?: boolean;
  displayRender?: (labels: string[]) => string;
  value?: string[];
  onChange?: (value: string[]) => void;
  className?: string;
}) {
  const flattened = useMemo(() => flattenOptions(options), [options]);
  return (
    <select
      className={inputClass({ className })}
      onChange={(event) => onChange?.(event.target.value.split("/").filter(Boolean))}
    >
      <option value="">{placeholder ?? "请选择"}</option>
      {flattened.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

const RadioContext = createContext<{
  value?: string | number | null;
  onChange?: (event: { target: { value: string | number | null } }) => void;
} | null>(null);

function RadioGroup({
  value,
  onChange,
  children,
  className,
}: {
  value?: string | number | null;
  onChange?: (event: { target: { value: string | number | null } }) => void;
  children?: ReactNode;
  className?: string;
}) {
  const contextValue = {
    ...(value !== undefined ? { value } : {}),
    ...(onChange ? { onChange } : {}),
  };
  return (
    <RadioContext.Provider value={contextValue}>
      <div className={cn("grid gap-2", className)}>{children}</div>
    </RadioContext.Provider>
  );
}

function RadioButton({
  value,
  children,
  className,
}: {
  value: string | number;
  children?: ReactNode;
  className?: string;
}) {
  const context = useContext(RadioContext);
  const selected = context?.value === value;
  return (
    <button
      className={cn(
        "rounded-md border p-3 text-left transition",
        selected
          ? "border-[var(--arch-primary)] bg-[var(--arch-primary-soft)]"
          : "border-[var(--arch-border)] bg-[var(--arch-surface)] hover:bg-[var(--arch-surface-muted)]",
        className,
      )}
      type="button"
      onClick={() => context?.onChange?.({ target: { value } })}
    >
      {children}
    </button>
  );
}

export const Radio = {
  Group: RadioGroup,
  Button: RadioButton,
};

function SpaceRoot({
  children,
  className,
  direction,
  wrap,
}: {
  children?: ReactNode;
  className?: string;
  direction?: "horizontal" | "vertical";
  size?: PrimitiveSize | number;
  wrap?: boolean;
}) {
  return (
    <div
      className={cn(
        direction === "vertical" ? "grid gap-2" : "inline-flex items-center gap-2",
        wrap ? "flex-wrap" : null,
        className,
      )}
    >
      {children}
    </div>
  );
}

function SpaceCompact({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <div className={cn("inline-flex", className)}>{children}</div>;
}

export const Space = Object.assign(SpaceRoot, {
  Compact: SpaceCompact,
});

export const Typography = {
  Text({
    strong,
    code,
    type,
    children,
    className,
  }: {
    strong?: boolean;
    code?: boolean;
    type?: "secondary" | "success" | "warning" | "danger" | string;
    children?: ReactNode;
    className?: string;
  }) {
    return (
      <span
        className={cn(
          strong ? "font-semibold" : null,
          code ? "rounded bg-[var(--arch-surface-muted)] px-1 font-mono text-xs" : null,
          type === "secondary" ? "text-[var(--arch-text-muted)]" : null,
          type === "success" ? "text-emerald-700" : null,
          type === "warning" ? "text-amber-700" : null,
          type === "danger" ? "text-rose-700" : null,
          className,
        )}
      >
        {children}
      </span>
    );
  },
};

export const panUiRuntime = {
  id: "pan_ui",
  stack: "React 19 + Next.js 16 + Tailwind tokens + Radix-ready primitives",
  mobileTarget: "React Native parity through shared tokens and prop contracts",
} as const;
