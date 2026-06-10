#!/usr/bin/env node

const HOST_BRIDGE_URL =
  process.env.ARCHITOKEN_HOST_BRIDGE_URL ||
  process.env.PANAI_ARCHITOKEN_HOST_BRIDGE_URL ||
  "http://127.0.0.1:3000/api/panai/host";

const serverInfo = {
  name: "architoken-host-bridge",
  version: "1.0.0",
};

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
};

const moduleIdSchema = {
  type: "object",
  additionalProperties: false,
  required: ["moduleId"],
  properties: {
    moduleId: {
      type: "string",
      description: "ArchIToken module id, for example planning_management.",
    },
  },
};

const createFolderSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      description:
        "Folder name. If omitted or equal to 新建一个文件夹, the Host Bridge creates 新建文件夹.",
    },
    moduleId: {
      type: "string",
      description:
        "Optional ArchIToken module id. Defaults to the current workbench module context.",
    },
    parentId: {
      type: "string",
      description:
        "Optional parent folder id. Defaults to the current workbench folder context.",
    },
  },
};

const tools = [
  {
    name: "panai_architoken_host_manifest",
    description:
      "Read the ArchIToken direct Host Bridge manifest. This is PanAI's direct-control entrypoint and does not embed any UI.",
    inputSchema: jsonSchema,
  },
  {
    name: "panai_architoken_host_get_module",
    description:
      "Read one ArchIToken module payload through the direct Host Bridge.",
    inputSchema: moduleIdSchema,
  },
  {
    name: "panai_architoken_host_navigate_module",
    description: "Resolve an ArchIToken module route for direct navigation.",
    inputSchema: moduleIdSchema,
  },
  {
    name: "panai_architoken_host_list_files",
    description: "List CDE files for one ArchIToken module.",
    inputSchema: moduleIdSchema,
  },
  {
    name: "panai_architoken_host_snapshot",
    description: "Read a CDE snapshot for one ArchIToken module.",
    inputSchema: moduleIdSchema,
  },
  {
    name: "panai_architoken_host_create_folder",
    description:
      "Create a real ArchIToken CDE folder through the direct Host Bridge. Use this when the user asks to 新建文件夹 or 创建目录 in the current ArchIToken module.",
    inputSchema: createFolderSchema,
  },
  {
    name: "panai_architoken_host_run_artifact_action",
    description:
      "Run a governed ArchIToken artifact action through WorkflowRouter/ToolRouter boundaries.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["moduleId", "fileId", "actionId"],
      properties: {
        moduleId: { type: "string" },
        fileId: { type: "string" },
        actionId: {
          type: "string",
          enum: [
            "generate",
            "evaluate",
            "rule_check",
            "schema_validate",
            "approve",
            "archive",
          ],
        },
      },
    },
  },
  {
    name: "panai_architoken_host_create_audit_event",
    description:
      "Create an ArchIToken module audit event through the direct Host Bridge.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["moduleId", "summary"],
      properties: {
        moduleId: { type: "string" },
        summary: { type: "string" },
        actor: { type: "string" },
      },
    },
  },
  {
    name: "panai_architoken_host_command",
    description:
      "Run a supported raw Host Bridge command with explicit JSON arguments.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["command"],
      properties: {
        command: {
          type: "string",
          enum: [
            "manifest",
            "get_module",
            "navigate_module",
            "list_files",
            "snapshot",
            "set_context",
            "create_folder",
            "poll_events",
            "run_artifact_action",
            "create_audit_event",
          ],
        },
        moduleId: { type: "string" },
        parentId: { type: "string" },
        name: { type: "string" },
        since: { type: "number" },
        fileId: { type: "string" },
        actionId: { type: "string" },
        summary: { type: "string" },
        actor: { type: "string" },
      },
    },
  },
];

const toolCommands = new Map([
  ["panai_architoken_host_get_module", "get_module"],
  ["panai_architoken_host_navigate_module", "navigate_module"],
  ["panai_architoken_host_list_files", "list_files"],
  ["panai_architoken_host_snapshot", "snapshot"],
  ["panai_architoken_host_create_folder", "create_folder"],
  ["panai_architoken_host_run_artifact_action", "run_artifact_action"],
  ["panai_architoken_host_create_audit_event", "create_audit_event"],
]);

async function callHostBridge(name, args) {
  if (name === "panai_architoken_host_manifest") {
    return request("GET");
  }

  const command =
    name === "panai_architoken_host_command"
      ? args.command
      : toolCommands.get(name);
  if (!command) {
    throw new Error(`Unknown ArchIToken Host Bridge tool: ${name}`);
  }

  return request("POST", { command, ...args });
}

async function request(method, body) {
  const response = await fetch(HOST_BRIDGE_URL, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(
      `ArchIToken Host Bridge ${response.status}: ${
        typeof payload === "string" ? payload : JSON.stringify(payload)
      }`,
    );
  }

  return payload;
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function error(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(message) {
  if (!message || typeof message !== "object") {
    return;
  }

  const { id, method, params } = message;
  const hasId = id !== undefined && id !== null;

  try {
    if (method === "initialize") {
      result(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo,
      });
      return;
    }

    if (method === "notifications/initialized") {
      return;
    }

    if (method === "ping") {
      result(id, {});
      return;
    }

    if (method === "tools/list") {
      result(id, { tools });
      return;
    }

    if (method === "tools/call") {
      const name = params?.name;
      const args = params?.arguments || {};
      const payload = await callHostBridge(name, args);
      result(id, {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        isError: false,
      });
      return;
    }

    if (hasId) {
      error(id, -32601, `Unsupported method: ${method}`);
    }
  } catch (err) {
    if (hasId) {
      error(id, -32000, err instanceof Error ? err.message : String(err));
    }
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex !== -1) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line) {
      try {
        void handle(JSON.parse(line));
      } catch (err) {
        error(null, -32700, err instanceof Error ? err.message : String(err));
      }
    }
    newlineIndex = buffer.indexOf("\n");
  }
});

process.stdin.on("end", () => {
  if (buffer.trim()) {
    try {
      void handle(JSON.parse(buffer.trim()));
    } catch (err) {
      error(null, -32700, err instanceof Error ? err.message : String(err));
    }
  }
});
