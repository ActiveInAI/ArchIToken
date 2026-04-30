'use client';

// Minimal backend integration lab for Phase 4 runtime readiness.
// License: Apache-2.0

import { useState } from 'react';
import { ARCHITOKEN_API_BASE_URL } from '@/lib/backend-api';
import { artifactClient, type Artifact } from '@/lib/artifact-client';
import { generationClient, type GenerationJob } from '@/lib/generation-client';
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
    return String((error as { error: unknown }).error);
  }
  return error instanceof Error ? error.message : String(error);
}

export default function ApiLabPage() {
  const [capabilities, setCapabilities] = useState<RuntimeCapabilities | null>(null);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [viewerCommand, setViewerCommand] = useState<ViewerAdapterCommand | null>(null);
  const [runState, setRunState] = useState<RunState>('idle');
  const [log, setLog] = useState<string[]>([]);

  const appendLog = (message: string) => {
    setLog((current) => [`${new Date().toISOString()} ${message}`, ...current].slice(0, 12));
  };

  const loadCapabilities = async () => {
    setRunState('loading');
    try {
      const nextCapabilities = await runtimeCapabilitiesClient.get();
      setCapabilities(nextCapabilities);
      appendLog(`capabilities loaded: ${nextCapabilities.generation.modes.length} modes`);
      setRunState('idle');
    } catch (error) {
      appendLog(`capabilities failed: ${describeError(error)}`);
      setRunState('error');
    }
  };

  const runGenerationSequence = async () => {
    setRunState('loading');
    try {
      const created = await generationClient.create({
        moduleId: 'digital_twin',
        mode: 'model_to_lightweight_scene',
        prompt: 'Create a local preview lightweight scene with property index and identity map.',
        actor: 'frontend-api-lab',
      });
      appendLog(`job created: ${created.id}`);

      const planned = await generationClient.plan(created.id, {
        actor: 'frontend-api-lab',
        comment: 'plan from API lab',
      });
      appendLog(`job planned: ${planned.status}`);

      const run = await generationClient.run(planned.id, {
        actor: 'frontend-api-lab',
        comment: 'run local mock generator',
      });
      appendLog(`job run: ${run.status}`);

      const reviewed = await generationClient.review(run.id, {
        reviewer: 'frontend-api-lab',
        decision: 'approved',
        comment: 'review accepted in API lab',
      });
      appendLog(`job reviewed: ${reviewed.status}`);

      const approved = await generationClient.approve(reviewed.id, {
        actor: 'frontend-api-lab',
        comment: 'approve generated preview artifacts',
      });
      setJob(approved);
      appendLog(`job approved: ${approved.status}`);

      const artifactPage = await artifactClient.list({ sourceJobId: approved.id });
      setArtifacts(artifactPage.artifacts);
      appendLog(`artifacts listed: ${artifactPage.artifacts.length}`);
      setRunState('idle');
    } catch (error) {
      appendLog(`generation failed: ${describeError(error)}`);
      setRunState('error');
    }
  };

  const submitViewerCommand = async () => {
    const artifact = artifacts[0];
    if (!artifact) {
      appendLog('viewer command skipped: run generation first');
      return;
    }

    setRunState('loading');
    try {
      const created = await viewerCommandClient.create({
        adapter: artifact.artifactMetadata.viewerAdapterHint ?? 'threejs',
        command: 'set_color',
        artifactId: artifact.id,
        elementIds: ['architoken:demo:001'],
        arguments: { color: '#ff6600' },
        actor: 'frontend-api-lab',
      });
      appendLog(`viewer command created: ${created.id}`);

      const acked = await viewerCommandClient.ack(created.id, {
        actor: 'frontend-api-lab',
        status: 'executed',
        comment: 'dev console acknowledged command contract',
        result: { rendered: false, backendContractOnly: true },
      });
      setViewerCommand(acked);
      appendLog(`viewer command acked: ${acked.status}`);
      setRunState('idle');
    } catch (error) {
      appendLog(`viewer command failed: ${describeError(error)}`);
      setRunState('error');
    }
  };

  return (
    <main className="min-h-screen bg-[var(--arch-bg)] px-6 py-8 text-[var(--arch-text)]">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="arch-surface rounded-[var(--arch-radius)] border p-6">
          <p className="arch-muted text-sm uppercase tracking-[0.24em]">
            Phase 4 Runtime Readiness
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Backend API Lab</h1>
          <p className="arch-muted mt-3 max-w-3xl">
            Minimal fetch-based integration page for runtime capabilities, generation,
            standalone artifacts, and auditable viewer commands.
          </p>
          <p className="mt-3 font-mono text-sm">API base: {ARCHITOKEN_API_BASE_URL}</p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <button className="arch-btn rounded-2xl px-5 py-4 text-left" onClick={loadCapabilities}>
            Load runtime capabilities
          </button>
          <button
            className="arch-btn rounded-2xl px-5 py-4 text-left"
            onClick={runGenerationSequence}
          >
            Create, run, review, approve generation
          </button>
          <button className="arch-btn rounded-2xl px-5 py-4 text-left" onClick={submitViewerCommand}>
            Submit viewer command
          </button>
        </div>

        {runState === 'error' ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            Last API call failed. Check the log and backend process.
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="arch-surface rounded-[var(--arch-radius)] border p-5">
            <h2 className="text-xl font-semibold">Runtime</h2>
            <p className="arch-muted mt-2 text-sm">
              Modules: {capabilities?.activeModuleIds.join(', ') ?? 'not loaded'}
            </p>
            <p className="arch-muted mt-2 text-sm">
              Modes: {capabilities?.generation.modes.length ?? 0}; artifacts:{' '}
              {capabilities?.generation.artifactKinds.length ?? 0}; storage:{' '}
              {capabilities?.storage.providers.join(', ') ?? 'unknown'}
            </p>
          </article>

          <article className="arch-surface rounded-[var(--arch-radius)] border p-5">
            <h2 className="text-xl font-semibold">Generation</h2>
            <p className="arch-muted mt-2 text-sm">Job: {job?.id ?? 'none'}</p>
            <p className="arch-muted mt-2 text-sm">Status: {job?.status ?? 'not started'}</p>
            <p className="arch-muted mt-2 text-sm">Artifacts: {artifacts.length}</p>
          </article>

          <article className="arch-surface rounded-[var(--arch-radius)] border p-5">
            <h2 className="text-xl font-semibold">Artifacts</h2>
            <div className="mt-3 space-y-2">
              {artifacts.map((artifact) => (
                <div key={artifact.id} className="rounded-xl border border-[var(--arch-border)] p-3">
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
          <pre className="mt-3 max-h-72 overflow-auto rounded-2xl bg-black/80 p-4 text-sm text-green-100">
            {log.length > 0 ? log.join('\n') : 'No calls yet.'}
          </pre>
        </section>
      </section>
    </main>
  );
}
