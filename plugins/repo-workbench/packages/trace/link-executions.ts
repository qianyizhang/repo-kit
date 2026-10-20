import { matchesDynamicTool, type DynamicTool } from './tool-signatures.ts';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import type { TraceEvent } from './contracts.ts';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
/** Extract literal exec_command arguments without executing any trace code. Dynamic expressions stay unlinked. */
export function commandHashes(text: string, name: string): string[] {
  if (text.length > 200000) return [];
  if (/exec_command$/.test(name)) {
    try {
      const args = JSON.parse(text) as { cmd?: unknown };
      return typeof args.cmd === 'string' ? [hash(args.cmd)] : [];
    } catch {
      return [];
    }
  }
  if (!/(^|[.])exec$/.test(name)) return [];
  const file = ts.createSourceFile(
    'trace.js',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const found = new Set<string>();
  // A common batch shape uses a literal const array and a direct map callback.
  // Require only the declaration and map reference, so mutation/aliasing stays unlinked.
  const arrays = new Map<string, string[]>();
  const references = new Map<string, number>();
  function scan(node: ts.Node) {
    if (ts.isIdentifier(node)) references.set(node.text, (references.get(node.text) ?? 0) + 1);
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer) &&
      ts.isVariableDeclarationList(node.parent) &&
      node.parent.flags & ts.NodeFlags.Const &&
      node.initializer.elements.every(ts.isStringLiteralLike)
    )
      arrays.set(
        node.name.text,
        node.initializer.elements.map((item) => (item as ts.StringLiteralLike).text),
      );
    ts.forEachChild(node, scan);
  }
  scan(file);
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'map' &&
      ts.isIdentifier(node.expression.expression) &&
      references.get(node.expression.expression.text) === 2
    ) {
      const values = arrays.get(node.expression.expression.text),
        callback = node.arguments[0];
      if (
        values &&
        callback &&
        ts.isArrowFunction(callback) &&
        callback.parameters.length === 1 &&
        ts.isIdentifier(callback.parameters[0].name)
      ) {
        const body = ts.isAwaitExpression(callback.body) ? callback.body.expression : callback.body;
        if (
          ts.isCallExpression(body) &&
          ts.isPropertyAccessExpression(body.expression) &&
          ts.isIdentifier(body.expression.expression) &&
          body.expression.expression.text === 'tools' &&
          body.expression.name.text === 'exec_command' &&
          body.arguments[0] &&
          ts.isObjectLiteralExpression(body.arguments[0])
        ) {
          const parameter = callback.parameters[0].name.text;
          const command = body.arguments[0].properties.find(
            (property) =>
              (ts.isShorthandPropertyAssignment(property) &&
                property.name.text === 'cmd' &&
                parameter === 'cmd') ||
              (ts.isPropertyAssignment(property) &&
                ts.isIdentifier(property.name) &&
                property.name.text === 'cmd' &&
                ts.isIdentifier(property.initializer) &&
                property.initializer.text === parameter),
          );
          if (
            command &&
            body.arguments[0].properties.every((property) => !ts.isSpreadAssignment(property))
          )
            values.forEach((value) => found.add(hash(value)));
        }
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'exec_command' &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      for (const property of node.arguments[0].properties)
        if (
          ts.isPropertyAssignment(property) &&
          ((ts.isIdentifier(property.name) && property.name.text === 'cmd') ||
            (ts.isStringLiteral(property.name) && property.name.text === 'cmd')) &&
          ts.isStringLiteralLike(property.initializer)
        )
          found.add(hash(property.initializer.text));
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...found];
}
export function executionCommand(argv: unknown): string {
  if (typeof argv === 'string') return argv;
  if (!Array.isArray(argv) || !argv.every((arg) => typeof arg === 'string')) return '';
  return argv.length >= 3 && ['-lc', '-c'].includes(String(argv[1]))
    ? String(argv[2])
    : JSON.stringify(argv);
}
export type ExecutionLink = {
  event: TraceEvent;
  commands: string[];
  tools?: string[];
  dynamicTools?: DynamicTool[];
  nativeTool?: { name: string; args: unknown };
  nativeId?: string;
  startedAt?: number;
};
/** Only unambiguous literal commands begun after a same-turn call, or explicit native call IDs, establish a link. */
export function linkExecutions(records: ExecutionLink[]): void {
  const calls = records.filter(
    ({ event }) =>
      /\/(function_call|custom_tool_call)$/.test(event.sourceType ?? '') && event.callId,
  );
  const results = records.filter(({ event }) =>
    /\/(function_call_output|custom_tool_call_output)$/.test(event.sourceType ?? ''),
  );
  for (const record of records) {
    if (!record.nativeId) continue;
    const candidates = calls.filter(
      (call) =>
        call.event.threadId === record.event.threadId &&
        call.event.turnId === record.event.turnId &&
        (call.event.sourceLine ?? 0) < (record.event.sourceLine ?? 0) &&
        (record.nativeId === call.event.callId ||
          record.commands.some((cmd) => call.commands.includes(cmd)) ||
          record.tools?.some((tool) => call.tools?.includes(tool)) ||
          (record.nativeTool &&
            matchesDynamicTool(call.dynamicTools ?? [], record.nativeTool) &&
            results.some(
              ({ event }) =>
                event.threadId === call.event.threadId &&
                event.turnId === call.event.turnId &&
                event.callId === call.event.callId &&
                event.ordinal > record.event.ordinal,
            ))) &&
        (record.startedAt === undefined ||
          !call.event.timestamp ||
          Date.parse(call.event.timestamp) <= record.startedAt) &&
        (!record.tools?.length ||
          !results.some(
            ({ event }) =>
              event.threadId === call.event.threadId &&
              event.turnId === call.event.turnId &&
              event.callId === call.event.callId &&
              event.ordinal > call.event.ordinal &&
              (record.startedAt !== undefined && event.timestamp
                ? Date.parse(event.timestamp) < record.startedAt
                : event.ordinal < record.event.ordinal),
          )),
    );
    const exact = candidates.filter((call) => call.event.callId === record.nativeId);
    // Known start time chooses the most recent preceding invocation. Without timing, ambiguity remains visible.
    const candidate =
      exact.length === 1
        ? exact[0]
        : record.startedAt !== undefined && !record.tools?.length
          ? candidates.at(-1)
          : candidates.length === 1
            ? candidates[0]
            : undefined;
    if (candidate) record.event.parentCall = candidate.event.key;
  }
}
export function nativeCommandHash(argv: unknown): string[] {
  const cmd = executionCommand(argv);
  return cmd ? [hash(cmd)] : [];
}
