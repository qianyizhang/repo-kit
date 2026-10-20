import type { EvidenceRef, ResolvedRef, Stage, TraceThread } from './contracts.ts';
import { eventKey } from './normalize.ts';

export const evidenceRoles = [
  'request',
  'feedback',
  'plan',
  'action',
  'edit',
  'artifact',
  'inspection',
  'verification',
  'assessment',
  'handoff',
  'other',
];
const actorRoles = ['requester', 'maker', 'reviewer', 'parent', 'delegated_worker', 'verifier'];
const statuses = [
  'issue',
  'improved',
  'passed',
  'accepted',
  'rejected',
  'not_checked',
  'unresolved',
  'unknown',
  'unrecorded',
];
export function createEvidenceResolver(threads: TraceThread[]) {
  const byThread = new Map(threads.map((t) => [t.id, t]));
  if (byThread.size !== threads.length) throw new Error('Duplicate thread identity');
  return (refs: EvidenceRef[], context = 'episode') => {
    if (!Array.isArray(refs)) throw new Error(`Missing evidence references: ${context}`);
    const unique = new Map<string, ResolvedRef>();
    for (const ref of refs) {
      const thread = byThread.get(ref.thread);
      if (!thread) throw new Error(`Unknown evidence thread ${ref.thread}: ${context}`);
      const turn = thread.turns.find((t) => t.id === ref.turn);
      if (!turn) throw new Error(`Unknown evidence turn ${ref.turn}: ${context}`);
      const event = turn.events.find((e) => e.id === ref.event);
      if (!event) throw new Error(`Unknown or excluded evidence event ${ref.event}: ${context}`);
      const roles = ref.roles ?? [ref.role];
      if (!roles.length || roles.some((r) => !evidenceRoles.includes(r)))
        throw new Error(`Invalid evidence role: ${context}`);
      const key = eventKey(ref),
        prior = unique.get(key);
      unique.set(key, {
        thread: ref.thread,
        turn: ref.turn,
        event: ref.event,
        role: ref.role,
        key,
        roles: [...new Set([...(prior?.roles ?? []), ...roles])],
      });
    }
    return [...unique.values()];
  };
}
export function episodeModel(
  stage: Stage & { id: string },
  threads: TraceThread[],
  resolveRefs: ReturnType<typeof createEvidenceResolver>,
) {
  const context = stage.title;
  const evidence = resolveRefs(stage.evidence, context);
  const actors = (stage.actors ?? []).map((a) => {
    if (!threads.some((t) => t.id === a.threadId) || !actorRoles.includes(a.role))
      throw new Error(`Invalid episode actor: ${context}`);
    return { ...a, evidence: resolveRefs(a.evidence ?? [], context) };
  });
  const assessments = (stage.assessments ?? []).map((a, i) => {
    if (
      !a.criterion ||
      !a.subject ||
      !statuses.includes(a.assessment) ||
      !a.actor ||
      !['reviewer', 'user', 'verification', 'maker', 'record_limit'].includes(a.basis)
    )
      throw new Error(`Invalid criterion assessment: ${context}`);
    const refs = resolveRefs(a.evidence, context);
    if (!refs.length && !['unknown', 'unrecorded', 'not_checked'].includes(a.assessment))
      throw new Error(`Assessment needs evidence: ${context}`);
    if (!refs.length && !a.note)
      throw new Error(`Missing assessment needs a limit note: ${context}`);
    return { ...a, id: `${stage.id}:assessment:${i}`, evidence: refs };
  });
  const signals = (stage.signals ?? []).map((s) => {
    const refs = resolveRefs(s.evidence, context);
    if (!s.note || !refs.length) throw new Error(`Signal needs evidence: ${context}`);
    return { ...s, evidence: refs };
  });
  const artifactEvidence = Object.fromEntries(
    Object.entries(stage.artifactEvidence ?? {}).map(([subject, refs]) => [
      subject,
      {
        producedBy: resolveRefs(refs.producedBy ?? [], context),
        inspectedBy: resolveRefs(refs.inspectedBy ?? [], context),
      },
    ]),
  );
  const all = resolveRefs(
    [
      ...evidence,
      ...actors.flatMap((a) => a.evidence),
      ...assessments.flatMap((a) => a.evidence),
      ...signals.flatMap((s) => s.evidence),
      ...Object.values(artifactEvidence).flatMap((v) => [...v.producedBy, ...v.inspectedBy]),
    ],
    context,
  );
  const eventMap = new Map(
    threads.flatMap((t) => t.turns.flatMap((t) => t.events)).map((e) => [e.key, e]),
  );
  const eventFor = (key: string) => {
    const event = eventMap.get(key);
    if (!event) throw new Error(`Missing resolved event: ${key}`);
    return event;
  };
  const selected = all.map((r) => eventFor(r.key));
  const facts = {
    commands: selected.filter((e) => e.kind === 'command').length,
    fileEdits: selected.filter((e) => e.kind === 'edit').length,
    imageInspections: selected.filter((e) => e.kind === 'image').length,
    relatedThreads: [...new Set(selected.flatMap((e) => e.relatedThreads))],
    verificationCommands: all.filter(
      (r) => r.roles.includes('verification') && eventFor(r.key).kind === 'command',
    ).length,
    changedFiles: [...new Set(selected.filter((e) => e.kind === 'edit').flatMap((e) => e.paths))],
  };
  return { evidence: all, actors, assessments, signals, artifactEvidence, facts };
}
