'use client';

// Minimal backend integration lab for Phase 4 runtime readiness.
// License: Apache-2.0

import { useState } from 'react';
import { ARCHITOKEN_API_BASE_URL, setBackendRequestContext } from '@/lib/backend-api';
import { activeModuleIds } from '@/lib/module-registry';
import { artifactClient, type Artifact } from '@/lib/artifact-client';
import { generationClient, type GenerationJob } from '@/lib/generation-client';
import {
  moduleCatalogClient,
  type ModuleCatalogResponse,
} from '@/lib/module-catalog-client';
import {
  runtimeCapabilitiesClient,
  type RuntimeCapabilities,
} from '@/lib/runtime-capabilities';
import {
  viewerCommandClient,
  type ViewerAdapterCommand,
} from '@/lib/viewer-command-client';

type RunState = 'idle' | 'loading' | 'error';

function describeError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    return JSON.stringify(error, null, 2);
  }
  return error instanceof Error ? error.message : String(error);
}

export default function ApiLabPage() {
  const [tenantId, setTenantId] = useState('dev-tenant');
  const [projectId, setProjectId] = useState('dev-project');
  const [actor, setActor] = useState('frontend-api-lab');
  const [rolesText, setRolesText] = useState('admin');
  const [capabilities, setCapabilities] = useState<RuntimeCapabilities | null>(null);
  const [moduleCatalog, setModuleCatalog] = useState<ModuleCatalogResponse | null>(null);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [viewerCommand, setViewerCommand] = useState<ViewerAdapterCommand | null>(null);
  const [runState, setRunState] = useState<RunState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const appendLog = (message: string) => {
    setLog((current) => [`${new Date().toISOString()} ${message}`, ...current].slice(0, 12));
  };

  const applyContext = () => {
    setBackendRequestContext({
      tenantId,
      projectId,
      actor,
      roles: rolesText
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean),
      requestId: `api-lab-${actor}`,
      correlationId: `api-lab-${tenantId}-${projectId}`,
    });
  };

  const loadCapabilities = async () => {
    applyContext();
    setRunState('loading');
    setErrorMessage(null);
    try {
      const nextCapabilities = await runtimeCapabilitiesClient.get();
      setCapabilities(nextCapabilities);
      appendLog(`capabilities loaded: ${nextCapabilities.generation.modes.length} modes`);
      setRunState('idle');
    } catch (error) {
      const message = describeError(error);
      setErrorMessage(message);
      appendLog(`capabilities failed: ${message}`);
      setRunState('error');
    }
  };

  const loadModuleCatalog = async () => {
    applyContext();
    setRunState('loading');
    setErrorMessage(null);
    try {
      const nextCatalog = await moduleCatalogClient.list();
      setModuleCatalog(nextCatalog);
      appendLog(`module catalog loaded: ${nextCatalog.modules.length}/${nextCatalog.total}`);
      setRunState('idle');
    } catch (error) {
      const message = describeError(error);
      setErrorMessage(message);
      appendLog(`module catalog failed: ${message}`);
      setRunState('error');
    }
  };

  const runGenerationSequence = async () => {
    applyContext();
    setRunState('loading');
    setErrorMessage(null);
    try {
      const created = await generationClient.create({
        moduleId: 'digital_twin',
        mode: 'model_to_lightweight_scene',
        prompt: 'Create a local preview lightweight scene with property index and identity map.',
        actor,
      });
      appendLog(`job created: ${created.id}`);

      const planned = await generationClient.plan(created.id, {
        actor,
        comment: 'plan from API lab',
      });
      appendLog(`job planned: ${planned.status}`);

      const run = await generationClient.run(planned.id, {
        actor,
        comment: 'run local generator',
      });
      appendLog(`job run: ${run.status}`);

      const reviewed = await generationClient.review(run.id, {
        reviewer: actor,
        decision: 'approved',
        comment: 'review accepted in API lab',
      });
      appendLog(`job reviewed: ${reviewed.status}`);

      const approved = await generationClient.approve(reviewed.id, {
        actor,
        comment: 'approve generated preview artifacts',
      });
      setJob(approved);
      appendLog(`job approved: ${approved.status}`);

      const artifactPage = await artifactClient.list({ sourceJobId: approved.id });
      setArtifacts(artifactPage.artifacts);
      appendLog(`artifacts listed: ${artifactPage.artifacts.length}`);
      setRunState('idle');
    } catch (error) {
      const message = describeError(error);
      setErrorMessage(message);
      appendLog(`generation failed: ${message}`);
      setRunState('error');
    }
  };

  const submitViewerCommand = async () => {
    applyContext();
    const artifact = artifacts[0];
    if (!artifact) {
      appendLog('viewer command skipped: run generation first');
      return;
    }

    setRunState('loading');
    setErrorMessage(null);
    try {
      const created = await viewerCommandClient.create({
        adapter: artifact.artifactMetadata.viewerAdapterHint ?? 'threejs',
        command: 'set_color',
        artifactId: artifact.id,
        elementIds: ['architoken:demo:001'],
        arguments: { color: '#ff6600' },
        actor,
      });
      appendLog(`viewer command created: ${created.id}`);

      const acked = await viewerCommandClient.ack(created.id, {
        actor,
        status: 'executed',
        comment: 'dev console executed command contract',
        result: { rendered: false, backendContractOnly: true },
      });
      setViewerCommand(acked);
      appendLog(`viewer command acked: ${acked.status}`);
      setRunState('idle');
    } catch (error) {
      const message = describeError(error);
      setErrorMessage(message);
      appendLog(`viewer command failed: ${message}`);
      setRunState('error');
    }
  };

  const frontendModuleIds: string[] = Array.from(activeModuleIds);
  const backendModuleIds: string[] = moduleCatalog?.modules.map((module) => module.id) ?? [];

  const frontendModuleIdSet = new Set(frontendModuleIds);
  const backendModuleIdSet = new Set(backendModuleIds);

  const catalogSameOrder =
    moduleCatalog !== null &&
    frontendModuleIds.length === backendModuleIds.length &&
    frontendModuleIds.every((moduleId, index) => moduleId === backendModuleIds[index]);
  const frontendOnlyModuleIds = frontendModuleIds.filter(
    (moduleId) => !backendModuleIdSet.has(moduleId),
  );
  const backendOnlyModuleIds = backendModuleIds.filter(
    (moduleId) => !frontendModuleIdSet.has(moduleId),
  );

  return (
    <main className="min-h-screen bg-[var(--arch-bg)] px-6 py-8 text-[var(--arch-text)]">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="arch-surface rounded-[var(--arch-radius)] border p-6">
          <p className="arch-muted text-sm">
            Phase 6 Durable Store + RBAC
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Backend API Lab</h1>
          <p className="arch-muted mt-3 max-w-3xl">
            Minimal fetch-based integration page for runtime capabilities, generation,
            standalone artifacts, and auditable viewer commands.
          </p>
          <p className="mt-3 font-mono text-sm">API base: {ARCHITOKEN_API_BASE_URL}</p>
        </header>

        <section className="arch-surface rounded-[var(--arch-radius)] border p-5">
          <h2 className="text-xl font-semibold">请求上下文</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="text-sm">
              <span className="arch-muted block">Tenant</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-black"
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="arch-muted block">Project</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-black"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="arch-muted block">Actor</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-black"
                value={actor}
                onChange={(event) => setActor(event.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="arch-muted block">Roles</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-black"
                value={rolesText}
                onChange={(event) => setRolesText(event.target.value)}
              />
            </label>
          </div>
          <p className="arch-muted mt-3 text-sm">
            Requests send X-Tenant-Id, X-Project-Id, X-Actor, X-Roles, X-Request-Id, and
            X-Correlation-Id headers through the shared backend-api client.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <button className="arch-btn rounded-lg px-5 py-4 text-left" onClick={loadCapabilities}>
            Load runtime capabilities
          </button>
          <button className="arch-btn rounded-lg px-5 py-4 text-left" onClick={loadModuleCatalog}>
            Load module catalog
          </button>
          <button
            className="arch-btn rounded-lg px-5 py-4 text-left"
            onClick={runGenerationSequence}
          >
            Create, run, review, approve generation
          </button>
          <button className="arch-btn rounded-lg px-5 py-4 text-left" onClick={submitViewerCommand}>
            Submit viewer command
          </button>
        </div>

        {runState === 'error' ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-semibold">Last API call failed.</p>
            <pre className="mt-2 whitespace-pre-wrap text-sm">
              {errorMessage ?? 'Check the log and backend process.'}
            </pre>
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="arch-surface rounded-[var(--arch-radius)] border p-5">
            <h2 className="text-xl font-semibold">Runtime</h2>
            <p className="arch-muted mt-2 text-sm">
              Capability status: {capabilities ? 'loaded' : runState === 'loading' ? 'loading' : 'not loaded'}
            </p>
            <p className="arch-muted mt-2 text-sm">
              Context: {tenantId}/{projectId} as {actor} [{rolesText}]
            </p>
            <p className="arch-muted mt-2 text-sm">
              Modules: {capabilities?.activeModuleIds.join(', ') ?? 'not loaded'}
            </p>
            <p className="arch-muted mt-2 text-sm">
              Module catalog:{' '}
              {moduleCatalog
                ? `${moduleCatalog.modules.length}/${moduleCatalog.total}`
                : 'not loaded'}
            </p>
            <p className="arch-muted mt-2 text-sm">
              Catalog/frontend same order:{' '}
              {moduleCatalog ? (catalogSameOrder ? 'true' : 'false') : 'not loaded'}
            </p>
            <p className="arch-muted mt-2 text-sm">
              Frontend only:{' '}
              {moduleCatalog ? frontendOnlyModuleIds.join(', ') || 'none' : 'not loaded'}
            </p>
            <p className="arch-muted mt-2 text-sm">
              Backend only:{' '}
              {moduleCatalog ? backendOnlyModuleIds.join(', ') || 'none' : 'not loaded'}
            </p>
            <p className="arch-muted mt-2 text-sm">
              Modes: {capabilities?.generation.modes.length ?? 0}; artifacts:{' '}
              {capabilities?.generation.artifactKinds.length ?? 0}; storage:{' '}
              {capabilities?.storage.providers.join(', ') ?? 'unknown'}
            </p>
            <p className="arch-muted mt-2 text-sm">
              Store boundary:{' '}
              {capabilities?.storeCapabilities.inMemoryOnly ? 'in-memory deterministic' : 'unknown'}
            </p>
          </article>

          <article className="arch-surface rounded-[var(--arch-radius)] border p-5">
            <h2 className="text-xl font-semibold">Generation</h2>
            <p className="arch-muted mt-2 text-sm">Job: {job?.id ?? 'none'}</p>
            <p className="arch-muted mt-2 text-sm">Status: {job?.status ?? 'not started'}</p>
            <p className="arch-muted mt-2 text-sm">Artifact: {artifacts[0]?.id ?? 'none'}</p>
            <p className="arch-muted mt-2 text-sm">Artifacts: {artifacts.length}</p>
          </article>

          <article className="arch-surface rounded-[var(--arch-radius)] border p-5">
            <h2 className="text-xl font-semibold">Artifacts</h2>
            <div className="mt-3 space-y-2">
              {artifacts.map((artifact) => (
                <div key={artifact.id} className="rounded-lg border border-[var(--arch-border)] p-3">
                  <p className="font-mono text-xs">{artifact.id}</p>
                  <p className="arch-muted text-sm">
                    {artifact.kind} · {artifact.status} · {artifact.artifactMetadata.mimeType}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="arch-surface rounded-[var(--arch-radius)] border p-5">
            <h2 className="text-xl font-semibold">Viewer Command</h2>
            <p className="arch-muted mt-2 text-sm">Command: {viewerCommand?.id ?? 'none'}</p>
            <p className="arch-muted mt-2 text-sm">Status: {viewerCommand?.status ?? 'not sent'}</p>
            <p className="arch-muted mt-2 text-sm">
              This page validates the backend command contract only; it does not load a proprietary
              viewer.
            </p>
          </article>
        </section>

        <section className="arch-surface rounded-[var(--arch-radius)] border p-5">
          <h2 className="text-xl font-semibold">Log</h2>
          <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-black/80 p-4 text-sm text-green-100">
            {log.length > 0 ? log.join('\n') : 'No calls yet.'}
          </pre>
        </section>
      </section>
    </main>
  );
}
