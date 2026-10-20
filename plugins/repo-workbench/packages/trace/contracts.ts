export type * from '../session-review/src/model/contracts.ts';
import type {
  EvidenceRef,
  Stage,
  CaseSpec,
  DocumentRef,
} from '../session-review/src/model/contracts.ts';

export function record(value: unknown, label = 'record'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Expected ${label} object`);
  return value as Record<string, unknown>;
}
export function optionalRecord(value: unknown, label?: string) {
  return value == null ? {} : record(value, label);
}
export function list(value: unknown, label = 'list'): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Expected ${label} array`);
  return value;
}
export function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`Expected ${label} string`);
  return value;
}
export function identity(value: unknown, label: string) {
  const result = text(value, label);
  if (!result) throw new Error(`Missing ${label}`);
  return result;
}
export function optionalText(value: unknown, label: string): string | undefined {
  return value == null ? undefined : text(value, label);
}
export function optionalNumber(value: unknown, label: string): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`Expected finite ${label}`);
  return value;
}
export function texts(value: unknown, label: string): string[] {
  return list(value, label).map((item) => text(item, label));
}
const stringMap = (value: unknown, label: string): Record<string, string> =>
  Object.fromEntries(
    Object.entries(record(value, label)).map(([key, value]) => [key, text(value, label)]),
  );

function reference(value: unknown): EvidenceRef {
  const item = record(value, 'evidence reference');
  return {
    thread: identity(item.thread, 'reference thread'),
    turn: identity(item.turn, 'reference turn'),
    event: identity(item.event, 'reference event'),
    role: text(item.role, 'reference role'),
    ...(item.roles === undefined ? {} : { roles: texts(item.roles, 'reference roles') }),
  };
}
function references(value: unknown, label: string): EvidenceRef[] {
  if (!Array.isArray(value)) throw new Error(`Missing evidence references: ${label}`);
  return value.map(reference);
}
function parseStage(value: unknown): Stage {
  const item = record(value, 'stage');
  const result: Stage = {
    ...item,
    title: identity(item.title, 'stage title'),
    turn: identity(item.turn, 'stage turn'),
    evidence: references(item.evidence, 'stage'),
  };
  for (const key of [
    'id',
    'thread',
    'anchor',
    'subject',
    'sourceKey',
    'status',
    'question',
    'change',
    'finding',
    'lesson',
    'comparison',
  ] as const)
    if (item[key] !== undefined) result[key] = text(item[key], key);
  for (const key of ['capture', 'fallbackCapture', 'source'] as const)
    if (item[key] !== undefined) result[key] = item[key] === null ? null : text(item[key], key);
  for (const key of [
    'captures',
    'captureSubjects',
    'sources',
    'sourceFiles',
    'subjects',
    'limits',
  ] as const)
    if (item[key] !== undefined) result[key] = texts(item[key], key);
  if (item.anchorRef !== undefined) result.anchorRef = reference(item.anchorRef);
  if (item.sourceKeys !== undefined) result.sourceKeys = stringMap(item.sourceKeys, 'sourceKeys');
  if (item.actors !== undefined)
    result.actors = list(item.actors, 'actors').map((value) => {
      const actor = record(value, 'actor');
      return {
        threadId: text(actor.threadId, 'actor threadId'),
        role: text(actor.role, 'actor role'),
        contribution: optionalText(actor.contribution, 'contribution'),
        evidence: references(actor.evidence ?? [], 'actor'),
      };
    });
  if (item.assessments !== undefined)
    result.assessments = list(item.assessments, 'assessments').map((value) => {
      const assessment = record(value, 'assessment');
      return {
        criterion: text(assessment.criterion, 'criterion'),
        subject: text(assessment.subject, 'subject'),
        assessment: text(assessment.assessment, 'assessment'),
        actor: text(assessment.actor, 'actor'),
        basis: text(assessment.basis, 'basis'),
        evidence: references(assessment.evidence, 'assessment'),
        note: optionalText(assessment.note, 'note'),
      };
    });
  if (item.signals !== undefined)
    result.signals = list(item.signals, 'signals').map((value) => {
      const signal = record(value, 'signal');
      return {
        note: text(signal.note, 'signal note'),
        evidence: references(signal.evidence, 'signal'),
      };
    });
  if (item.artifactEvidence !== undefined)
    result.artifactEvidence = Object.fromEntries(
      Object.entries(record(item.artifactEvidence, 'artifactEvidence')).map(([subject, value]) => {
        const refs = record(value, 'artifact refs');
        return [
          subject,
          {
            producedBy: references(refs.producedBy ?? [], 'artifact'),
            inspectedBy: references(refs.inspectedBy ?? [], 'artifact'),
          },
        ];
      }),
    );
  if (item.artifactProvenance !== undefined)
    result.artifactProvenance = Object.fromEntries(
      Object.entries(record(item.artifactProvenance, 'artifactProvenance')).map(
        ([subject, value]) => {
          const provenance = record(value, 'provenance');
          const flags: { cameraKnown?: boolean; lightingKnown?: boolean } = {};
          for (const key of ['cameraKnown', 'lightingKnown'] as const) {
            if (provenance[key] === undefined) continue;
            if (typeof provenance[key] !== 'boolean') throw new Error(`Expected boolean ${key}`);
            flags[key] = provenance[key];
          }
          return [
            subject,
            { ...flags, sourcePairing: optionalText(provenance.sourcePairing, 'sourcePairing') },
          ];
        },
      ),
    );
  return result;
}
export function parseCase(value: unknown): CaseSpec {
  const item = record(value, 'case');
  return {
    title: identity(item.title, 'case title'),
    assetRoot: optionalText(item.assetRoot, 'assetRoot'),
    captureSubjects:
      item.captureSubjects === undefined
        ? undefined
        : texts(item.captureSubjects, 'captureSubjects'),
    captureViews:
      item.captureViews === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(record(item.captureViews, 'captureViews')).map(([name, patterns]) => [
              name,
              texts(patterns, 'capture view filenames'),
            ]),
          ),
    subtitle: optionalText(item.subtitle, 'subtitle'),
    outcome: optionalText(item.outcome, 'outcome'),
    threads: list(item.threads, 'threads').map((value) => {
      const thread = record(value, 'source thread');
      return {
        id: identity(thread.id, 'thread id'),
        role: optionalText(thread.role, 'role'),
        parent: optionalText(thread.parent, 'parent'),
      };
    }),
    stages: list(item.stages, 'stages').map(parseStage),
    ...(item.documents === undefined
      ? {}
      : {
          documents: list(item.documents, 'documents').map((value): DocumentRef => {
            if (typeof value === 'string') return value;
            const document = record(value, 'document');
            const path = text(document.path, 'document path');
            const revision = text(document.revision, 'document revision');
            if (!/^[0-9a-f]{40}$/.test(revision))
              throw new Error('Expected full Git commit revision');
            if (
              !path ||
              path.includes('\\') ||
              path.includes(':') ||
              /[\x00-\x1f]/.test(path) ||
              path.split('/').some((part) => !part || part === '.' || part === '..')
            )
              throw new Error('Expected repository-relative document path');
            return { path, revision };
          }),
        }),
    ...(item.sourceKeys === undefined
      ? {}
      : { sourceKeys: stringMap(item.sourceKeys, 'sourceKeys') }),
    ...(item.sourceSubjects === undefined
      ? {}
      : { sourceSubjects: stringMap(item.sourceSubjects, 'sourceSubjects') }),
  };
}
