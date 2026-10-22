/** Public trace data and authored case contracts. Unrecognized source payloads stay excluded. */
export interface EvidenceRef {
  thread: string;
  turn: string;
  event: string;
  role: string;
  roles?: string[];
}
export interface ResolvedRef extends EvidenceRef {
  key: string;
  roles: string[];
}
export interface TraceEvent {
  id: string;
  threadId: string;
  turnId: string;
  ordinal: number;
  role: string;
  status: string;
  paths: string[];
  relatedThreads: string[];
  sourceType?: string;
  sourceTruncated: boolean;
  kind:
    | 'ask'
    | 'compaction'
    | 'wait'
    | 'request'
    | 'goal'
    | 'auto-review'
    | 'message'
    | 'command'
    | 'edit'
    | 'image'
    | 'reference'
    | 'delegation';
  title: string;
  text: string;
  output?: string;
  exitCode?: number | null;
  durationMs?: number;
  preview: string;
  displayTruncated: boolean;
  key: string;
  sourcePath?: string;
  sourceLine?: number;
  timestamp?: string;
  callId?: string;
  /** Verified relation to a recorded invocation; source records remain independently addressable. */
  parentCall?: string;
  /** Count only when the wrapper syntax proves one direct parallel batch. */
  parallelCalls?: number;
  sequentialCalls?: number;
  questions?: Array<{
    id: string;
    title: string;
    options: Array<{ label: string; description?: string }>;
  }>;
  questionResult?: { delivered?: boolean; answers?: Record<string, string[]> };
  web?: {
    query: string;
    targets: string[];
    results: Array<{ title: string; url: string; snippet: string }>;
  };
  compaction?: { window?: number; startedAt?: number; completedAt?: number };
  threadRead?: ThreadRead;
  imageUrls?: string[];
  messagePhase?: 'commentary' | 'final_answer';
  /** Local server only: bounded preview with byte-pinned, on-demand content. */
  body?: {
    sources: Array<{ offset: number; bytes: number; sha256: string }>;
    textLength: number;
    outputLength?: number;
    imageCount: number;
  };
}
export interface ThreadRead {
  id: string;
  title: string;
  status: string;
  hasMore: boolean;
  limited: boolean;
  turns: Array<{
    id: string;
    status: string;
    request: string;
    response: string;
    final: boolean;
    activities: number;
  }>;
}
export interface Omission {
  type: string;
  count: number;
  refs: Array<Omit<EvidenceRef, 'role' | 'roles'> & { ordinal: number }>;
}
export interface TraceThread {
  id: string;
  title: string;
  role: string;
  parent?: string;
  purpose?: 'auto-review';
  source: {
    encoding?: 'zstd';
    storedBytes?: number;
    name: string;
    format: string;
    version: number;
    rawSchemaVersion: number;
    path?: string;
    sha256?: string;
    bytes?: number;
    lines?: number;
  };
  coverage: {
    totalItems: number;
    normalizedItems: number;
    unsupportedItems: Omission[];
    excludedItems: Omission[];
    truncatedItems: number;
    displayTruncatedItems: number;
  };
  turns: Array<{
    id: string;
    threadId: string;
    startedAt?: number;
    completedAt?: number;
    elapsedMs?: number;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      cachedInputTokens: number;
      responses: number;
    };
    events: TraceEvent[];
  }>;
}
export interface Actor {
  threadId: string;
  role: string;
  contribution?: string;
  evidence?: EvidenceRef[];
}
export interface Assessment {
  criterion: string;
  subject: string;
  assessment: string;
  actor: string;
  basis: string;
  evidence: EvidenceRef[];
  note?: string;
}
export interface Stage {
  // Authored story metadata is retained as unknown, never treated as executable instructions.
  [key: string]: unknown;
  id?: string;
  title: string;
  status?: string;
  question?: string;
  change?: string;
  finding?: string;
  lesson?: string;
  comparison?: string;
  turn: string;
  thread?: string;
  anchor?: string;
  anchorRef?: EvidenceRef;
  evidence: EvidenceRef[];
  actors?: Actor[];
  assessments?: Assessment[];
  signals?: Array<{ note: string; evidence: EvidenceRef[] }>;
  artifactEvidence?: Record<string, { producedBy?: EvidenceRef[]; inspectedBy?: EvidenceRef[] }>;
  artifactProvenance?: Record<
    string,
    {
      sourcePairing?: string;
      cameraKnown?: boolean;
      lightingKnown?: boolean;
    }
  >;
  capture?: string | null;
  fallbackCapture?: string | null;
  captures?: string[];
  captureSubjects?: string[];
  source?: string | null;
  sources?: string[];
  sourceFiles?: string[];
  sourceKey?: string;
  sourceKeys?: Record<string, string>;
  subject?: string;
  subjects?: string[];
  limits?: string[];
}
export type DocumentRef = string | { path: string; revision: string };
export interface CaseSpec {
  assetRoot?: string;
  captureSubjects?: string[];
  captureViews?: Record<string, string[]>;
  title: string;
  subtitle?: string;
  outcome?: string;
  threads: Array<{ id: string; role?: string; parent?: string }>;
  stages: Stage[];
  documents?: DocumentRef[];
  sourceKeys?: Record<string, string>;
  sourceSubjects?: Record<string, string>;
}
export interface MediaRecord {
  path: string;
  url: string;
  sha256: string;
  bytes: number;
}
export interface SourceRecord {
  name: string;
  path: string;
  sourceKey: string;
  subject?: string;
  sha256: string;
  text: string;
  diff: { fromStage: number; text: string } | null;
}
export interface BuildOptions {
  root?: string;
  input?: string;
  output?: string;
  spec: unknown;
}

/** Browser delivery contract. Recorded evidence exists independently of authored curation. */
export interface Capture extends MediaRecord {
  subject: string;
  angle: string;
}
export interface Artifact {
  id: string;
  subject: string;
  stageId: string;
  stageIndex: number;
  captures: Capture[];
  sources: Omit<SourceRecord, 'text' | 'diff'>[];
  producedBy: ResolvedRef[];
  inspectedBy: ResolvedRef[];
  provenance: { sourcePairing: string; cameraKnown: boolean; lightingKnown: boolean };
  limits: string[];
}
export interface ReviewAssessment extends Assessment {
  id: string;
  artifactId: string;
  evidence: ResolvedRef[];
}
export interface Episode extends Omit<
  Stage,
  'captures' | 'sources' | 'actors' | 'assessments' | 'signals' | 'evidence'
> {
  id: string;
  index: number;
  title: string;
  turn: string;
  threadId: string;
  anchorId: string;
  status?: string;
  question?: string;
  change?: string;
  finding?: string;
  lesson?: string;
  comparison?: string;
  subject?: string;
  limits?: string[];
  quote: string;
  anchorRef: EvidenceRef;
  captures: Capture[];
  sources: SourceRecord[];
  artifacts: string[];
  evidence: ResolvedRef[];
  actors: Array<Actor & { evidence: ResolvedRef[] }>;
  assessments: ReviewAssessment[];
  signals: Array<{ note: string; evidence: ResolvedRef[] }>;
  facts: {
    commands: number;
    fileEdits: number;
    imageInspections: number;
    verificationCommands: number;
    changedFiles: string[];
    relatedThreads: string[];
  };
}
export interface ReviewDocument {
  version: number;
  title: string;
  subtitle?: string;
  outcome?: string;
  collectedAt: string;
  inputs: Array<{ threadId: string; sha256: string }>;
  threads: TraceThread[];
  curation?: { episodes: Episode[]; artifacts: Artifact[] };
  documents: Array<{ path: string; revision?: string; text: string; sha256: string }>;
  media: MediaRecord[];
  /** Absent in a self-contained export. */
  delivery?: { kind: 'local'; session: string };
}
export type RecordedTurn = TraceThread['turns'][number];
