// components/database-manager/UpstreamResourceConsole.tsx
// License: Apache-2.0
//
// Apache-2.0 adapted source boundary:
// - Headlamp ResourceTable/ActionButton/NameValueTable primitives:
//   https://github.com/headlamp-k8s/headlamp
// - KubeSphere v3.4.1 ListResult and query pagination model:
//   https://github.com/kubesphere/kubesphere/tree/v3.4.1
"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type MouseEventHandler,
  type ReactNode,
  useMemo,
  useState,
} from "react";
import { Button, Empty, Tooltip } from "@/components/pan-ui";

export type UpstreamResourceValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export interface UpstreamListResult<T> {
  items: T[];
  totalItems: number;
}

export interface UpstreamQueryState {
  page: number;
  limit: number;
  offset: number;
  sortBy?: string;
  ascending?: boolean;
  name?: string;
}

export interface UpstreamResourceTableColumn<T> {
  id: string;
  label: string;
  width?: string;
  show?: boolean;
  className?: string;
  getValue: (item: T) => UpstreamResourceValue;
  render?: (item: T) => ReactNode;
}

export interface UpstreamResourceAction<T> {
  id: string;
  description: string | ((item: T) => string);
  longDescription?: string | ((item: T) => string);
  icon?: ReactNode;
  danger?: boolean | ((item: T) => boolean);
  primary?: boolean | ((item: T) => boolean);
  disabled?: (item: T) => boolean;
  onClick: (item: T) => void;
}

export interface UpstreamNameValueTableRow {
  name: ReactNode;
  value?: ReactNode;
  hide?: boolean | ((value: ReactNode) => boolean);
  valueFullRow?: boolean;
  withHighlightStyle?: boolean;
}

export function makeKubeSphereQueryState({
  page = 1,
  limit,
  sortBy,
  ascending = false,
  name,
}: {
  page?: number;
  limit: number;
  sortBy?: string;
  ascending?: boolean;
  name?: string;
}): UpstreamQueryState {
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    ascending,
    ...(sortBy !== undefined ? { sortBy } : {}),
    ...(name !== undefined ? { name } : {}),
  };
}

export function makeKubeSphereListResult<T>(
  items: T[],
  totalItems = items.length,
): UpstreamListResult<T> {
  return { items, totalItems };
}

export function UpstreamActionButton({
  description,
  longDescription,
  icon,
  onClick,
  danger,
  primary,
  disabled,
  className,
}: {
  description: string;
  longDescription?: string;
  icon?: ReactNode;
  onClick?: MouseEventHandler<HTMLElement>;
  danger?: boolean;
  primary?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Tooltip title={longDescription ?? description}>
      <Button
        size="small"
        type={primary ? "primary" : "default"}
        {...(danger !== undefined ? { danger } : {})}
        {...(disabled !== undefined ? { disabled } : {})}
        {...(icon !== undefined ? { icon } : {})}
        {...(onClick !== undefined ? { onClick } : {})}
        {...(className !== undefined ? { className } : {})}
      >
        {description}
      </Button>
    </Tooltip>
  );
}

export function UpstreamNameValueTable({
  rows,
  compact = false,
  className = "",
}: {
  rows: UpstreamNameValueTableRow[];
  compact?: boolean;
  className?: string;
}) {
  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        if (typeof row.hide === "function") return !row.hide(row.value);
        return !row.hide;
      }),
    [rows],
  );

  return (
    <dl
      className={[
        "overflow-hidden rounded-md border border-slate-100 bg-white",
        compact ? "text-xs" : "text-sm",
        className,
      ].join(" ")}
    >
      {visibleRows.map((row, index) => {
        const last = index === visibleRows.length - 1;
        const highlight = row.withHighlightStyle
          ? "bg-slate-50 font-medium text-slate-950"
          : "";
        return (
          <div
            key={index}
            className={[
              "grid min-w-0",
              compact
                ? "grid-cols-[96px_minmax(0,1fr)]"
                : "grid-cols-[180px_minmax(0,1fr)]",
              row.valueFullRow ? "grid-cols-1" : "",
              last ? "" : "border-b border-slate-100",
            ].join(" ")}
          >
            <dt
              className={[
                "min-w-0 px-3 py-2 text-slate-500",
                row.valueFullRow ? "border-b border-slate-100" : "",
                highlight,
              ].join(" ")}
            >
              {row.name}
            </dt>
            {row.valueFullRow ? null : (
              <dd
                className={[
                  "min-w-0 px-3 py-2 font-mono text-slate-800 [overflow-wrap:anywhere]",
                  highlight,
                ].join(" ")}
              >
                {renderNameValue(row.value)}
              </dd>
            )}
            {row.valueFullRow ? (
              <dd className="min-w-0 px-3 py-2 text-slate-800 [overflow-wrap:anywhere]">
                {renderNameValue(row.value)}
              </dd>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}

export function UpstreamResourceTable<T>({
  id,
  result,
  query,
  columns,
  rowKey,
  rowTestId,
  selectedKey,
  onSelect,
  onOpen,
  actions = [],
  actionsMode = "column",
  emptyText = "没有资源",
  className = "",
  onRowContextMenu,
  onBackgroundContextMenu,
}: {
  id: string;
  result: UpstreamListResult<T>;
  query: UpstreamQueryState;
  columns: Array<UpstreamResourceTableColumn<T>>;
  rowKey: (item: T) => string;
  rowTestId?: (item: T) => string;
  selectedKey?: string | null;
  onSelect?: (item: T) => void;
  onOpen?: (item: T) => void;
  actions?: Array<UpstreamResourceAction<T>>;
  actionsMode?: "column" | "popover";
  emptyText?: string;
  className?: string;
  onRowContextMenu?: (item: T, event: ReactMouseEvent<HTMLElement>) => void;
  onBackgroundContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void;
}) {
  const [actionMenu, setActionMenu] = useState<{
    key: string;
    x: number;
    y: number;
    item: T;
  } | null>(null);
  const visibleColumns = columns.filter((column) => column.show !== false);
  const items = useMemo(() => {
    const name = query.name?.trim().toLowerCase();
    if (!name) return result.items;
    return result.items.filter((item) =>
      visibleColumns.some((column) =>
        String(column.getValue(item) ?? "")
          .toLowerCase()
          .includes(name),
      ),
    );
  }, [query.name, result.items, visibleColumns]);

  if (items.length === 0) {
    return (
      <div
        className="rounded-md border border-slate-100 bg-white"
        onContextMenu={onBackgroundContextMenu}
        data-upstream-table-id={id}
      >
        <Empty className="py-10" description={emptyText} />
      </div>
    );
  }

  return (
    <div
      className={[
        "overflow-hidden rounded-md border border-slate-100 bg-white",
        className,
      ].join(" ")}
      onClick={() => setActionMenu(null)}
      onContextMenu={(event) => {
        setActionMenu(null);
        onBackgroundContextMenu?.(event);
      }}
      data-upstream-table-id={id}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  className="px-3 py-2 font-medium"
                  style={{ width: column.width }}
                >
                  {column.label}
                </th>
              ))}
              {actions.length > 0 && actionsMode === "column" ? (
                <th className="w-[92px] px-2 py-2 text-right font-medium">
                  操作
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const key = rowKey(item);
              const selected = selectedKey === key;
              return (
                <tr
                  key={key}
                  role="button"
                  tabIndex={0}
                  data-testid={rowTestId?.(item)}
                  className={[
                    "cursor-pointer bg-white transition hover:bg-emerald-50/60",
                    selected ? "bg-emerald-50" : "",
                  ].join(" ")}
                  onClick={(event) => {
                    if (actions.length > 0 && actionsMode === "popover") {
                      event.stopPropagation();
                      onSelect?.(item);
                      setActionMenu({
                        key,
                        x: event.clientX,
                        y: event.clientY,
                        item,
                      });
                      return;
                    }
                    onSelect?.(item);
                    onOpen?.(item);
                  }}
                  onDoubleClick={() => {
                    onSelect?.(item);
                    onOpen?.(item);
                  }}
                  onContextMenu={(event) => {
                    event.stopPropagation();
                    if (onRowContextMenu) {
                      onRowContextMenu(item, event);
                      return;
                    }
                    if (actions.length > 0 && actionsMode === "popover") {
                      event.preventDefault();
                      onSelect?.(item);
                      setActionMenu({
                        key,
                        x: event.clientX,
                        y: event.clientY,
                        item,
                      });
                      return;
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect?.(item);
                      onOpen?.(item);
                    }
                  }}
                >
                  {visibleColumns.map((column) => (
                    <td
                      key={`${key}:${column.id}`}
                      className={[
                        "px-3 py-2 align-top",
                        column.className ?? "",
                      ].join(" ")}
                    >
                      {column.render
                        ? column.render(item)
                        : renderTableValue(column.getValue(item))}
                    </td>
                  ))}
                  {actions.length > 0 && actionsMode === "column" ? (
                    <td className="px-2 py-2 text-right align-top">
                      <div className="inline-flex flex-nowrap justify-end gap-1">
                        {actions.map((action) => (
                          <UpstreamActionButton
                            key={`${key}:${action.id}`}
                            description={resolveActionString(
                              action.description,
                              item,
                            )}
                            {...(action.longDescription !== undefined
                              ? {
                                  longDescription: resolveActionString(
                                    action.longDescription,
                                    item,
                                  ),
                                }
                              : {})}
                            {...(action.icon !== undefined
                              ? { icon: action.icon }
                              : {})}
                            {...(action.danger !== undefined
                              ? {
                                  danger: resolveActionBoolean(
                                    action.danger,
                                    item,
                                  ),
                                }
                              : {})}
                            {...(action.primary !== undefined
                              ? {
                                  primary: resolveActionBoolean(
                                    action.primary,
                                    item,
                                  ),
                                }
                              : {})}
                            disabled={action.disabled?.(item) ?? false}
                            onClick={(event) => {
                              event.stopPropagation();
                              action.onClick(item);
                            }}
                          />
                        ))}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {actionMenu && actionsMode === "popover" ? (
        <div
          className="fixed z-[80] w-52 rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl"
          style={{
            left: clampViewportPosition(actionMenu.x, 220, "x"),
            top: clampViewportPosition(actionMenu.y, 180, "y"),
          }}
          role="menu"
          aria-label="资源操作"
          data-testid={`${id}-action-popover`}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {actions.map((action) => {
            const disabled = action.disabled?.(actionMenu.item) ?? false;
            const danger =
              action.danger !== undefined
                ? resolveActionBoolean(action.danger, actionMenu.item)
                : false;
            const primary =
              action.primary !== undefined
                ? resolveActionBoolean(action.primary, actionMenu.item)
                : false;
            return (
              <button
                key={`${actionMenu.key}:${action.id}`}
                type="button"
                role="menuitem"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  action.onClick(actionMenu.item);
                  setActionMenu(null);
                }}
                className={[
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition",
                  disabled
                    ? "cursor-not-allowed text-slate-300"
                    : "hover:bg-slate-50",
                  danger ? "text-rose-600 hover:bg-rose-50" : "",
                  primary && !danger ? "text-blue-700 hover:bg-blue-50" : "",
                ].join(" ")}
              >
                {action.icon ? (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {action.icon}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate">
                  {resolveActionString(action.description, actionMenu.item)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">
        <span>
          {items.length} / {result.totalItems} 资源
        </span>
        {query.sortBy ? (
          <span>
            按 {query.sortBy} {query.ascending ? "升序" : "降序"}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function renderNameValue(value: ReactNode) {
  if (typeof value === "undefined" || value === null) return "无";
  if (Array.isArray(value)) {
    return (
      <span className="inline-flex min-w-0 flex-wrap gap-1">
        {value.map((item, index) => (
          <span key={index}>{item}</span>
        ))}
      </span>
    );
  }
  return value;
}

function resolveActionString<T>(
  value: string | ((item: T) => string),
  item: T,
): string {
  return typeof value === "function" ? value(item) : value;
}

function resolveActionBoolean<T>(
  value: boolean | ((item: T) => boolean),
  item: T,
): boolean {
  return typeof value === "function" ? value(item) : value;
}

function clampViewportPosition(
  value: number,
  panelSize: number,
  axis: "x" | "y",
): number {
  if (typeof window === "undefined") return value;
  const viewportSize = axis === "x" ? window.innerWidth : window.innerHeight;
  return Math.max(8, Math.min(value, viewportSize - panelSize - 8));
}

function renderTableValue(value: UpstreamResourceValue) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || typeof value === "undefined") return "无";
  return String(value);
}
