import ts from 'typescript';
import { createHash } from 'node:crypto';
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const stable = (value: Json): string =>
  value && typeof value === 'object'
    ? Array.isArray(value)
      ? '[' + value.map(stable).join(',') + ']'
      : '{' +
        Object.keys(value)
          .sort()
          .map((key) => JSON.stringify(key) + ':' + stable(value[key]))
          .join(',') +
        '}'
    : JSON.stringify(value);
export function toolSignature(name: string, args: unknown): string | undefined {
  if (!/^mcp__/.test(name) || args === undefined) return undefined;
  return createHash('sha256')
    .update(name.replace(/\./g, '_') + '\n' + stable(args as Json))
    .digest('hex');
}
/** A literal-only syntax reader: no evaluation, interpolation, identifiers, spreads or getters. */
export function literal(node: ts.Expression): Json | undefined {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  )
    return -Number(node.operand.text);
  if (ts.isArrayLiteralExpression(node)) {
    const values = node.elements.map((item) => literal(item));
    return values.some((value) => value === undefined) ? undefined : (values as Json[]);
  }
  if (ts.isObjectLiteralExpression(node)) {
    const entries: [string, Json][] = [];
    for (const property of node.properties) {
      if (
        !ts.isPropertyAssignment(property) ||
        (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))
      )
        return undefined;
      const value = literal(property.initializer);
      if (value === undefined) return undefined;
      entries.push([property.name.text, value]);
    }
    return Object.fromEntries(entries);
  }
  return undefined;
}
export function toolSignatures(text: string, name: string): string[] {
  if (text.length > 200000) return [];
  if (name.startsWith('mcp__')) {
    try {
      const signature = toolSignature(name, JSON.parse(text));
      return signature ? [signature] : [];
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
  const signatures = new Set<string>();
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'tools' &&
      node.arguments[0]
    ) {
      const args = literal(node.arguments[0]);
      const signature = toolSignature(node.expression.name.text, args);
      if (signature) signatures.add(signature);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...signatures];
}

export type DynamicTool = { name: string; known: Record<string, Json> };
export function wrapperTools(text: string): {
  dynamic: DynamicTool[];
  parallelCalls?: number;
  sequentialCalls?: number;
} {
  if (text.length > 200000) return { dynamic: [] };
  const file = ts.createSourceFile(
    'trace.js',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const dynamic: DynamicTool[] = [],
    calls: ts.CallExpression[] = [],
    batches: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression)
    ) {
      if (node.expression.expression.text === 'tools') {
        calls.push(node);
        const name = node.expression.name.text;
        if (
          name.startsWith('mcp__') &&
          node.arguments[0] &&
          literal(node.arguments[0]) === undefined
        ) {
          const known: Record<string, Json> = {};
          if (ts.isObjectLiteralExpression(node.arguments[0])) {
            for (const p of node.arguments[0].properties) {
              if (
                ts.isPropertyAssignment(p) &&
                (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
              ) {
                const value = literal(p.initializer);
                if (value !== undefined) known[p.name.text] = value;
              }
            }
          }
          dynamic.push({ name, known });
        }
      }
      if (
        node.expression.expression.text === 'Promise' &&
        ['all', 'allSettled'].includes(node.expression.name.text)
      )
        batches.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  const batch = batches.length === 1 ? batches[0].arguments[0] : undefined;
  // Only a direct array of calls proves the exact parallel count; other wrappers keep an execution count.
  let parallelCalls =
    batch &&
    ts.isArrayLiteralExpression(batch) &&
    batch.elements.length > 1 &&
    batch.elements.length === calls.length &&
    batch.elements.every((e) => ts.isCallExpression(e) && calls.includes(e))
      ? batch.elements.length
      : undefined;
  if (
    !parallelCalls &&
    batch &&
    ts.isCallExpression(batch) &&
    ts.isPropertyAccessExpression(batch.expression) &&
    batch.expression.name.text === 'map' &&
    ts.isIdentifier(batch.expression.expression) &&
    calls.length === 1
  ) {
    const collection = batch.expression.expression.text,
      callback = batch.arguments[0];
    let references = 0,
      length: number | undefined;
    function scan(node: ts.Node) {
      if (ts.isIdentifier(node) && node.text === collection) references++;
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === collection &&
        ts.isVariableDeclarationList(node.parent) &&
        node.parent.flags & ts.NodeFlags.Const &&
        node.initializer &&
        ts.isArrayLiteralExpression(node.initializer) &&
        literal(node.initializer) !== undefined
      )
        length = node.initializer.elements.length;
      ts.forEachChild(node, scan);
    }
    scan(file);
    if (
      references === 2 &&
      length &&
      length > 1 &&
      callback &&
      ts.isArrowFunction(callback) &&
      (ts.isAwaitExpression(callback.body) ? callback.body.expression : callback.body) === calls[0]
    )
      parallelCalls = length;
  }
  // Only individually awaited calls in distinct top-level statements establish sequential execution.
  const statements = calls.map((call) => {
    if (!ts.isAwaitExpression(call.parent)) return undefined;
    let node: ts.Node = call.parent;
    while (node.parent !== file) {
      if (
        !node.parent ||
        ts.isFunctionLike(node.parent) ||
        ts.isIterationStatement(node.parent, false) ||
        ts.isIfStatement(node.parent) ||
        ts.isConditionalExpression(node.parent)
      )
        return undefined;
      node = node.parent;
    }
    return ts.isExpressionStatement(node) || ts.isVariableStatement(node) ? node : undefined;
  });
  const sequentialCalls =
    !batches.length &&
    calls.length > 1 &&
    statements.every(Boolean) &&
    new Set(statements).size === calls.length
      ? calls.length
      : undefined;
  return { dynamic, parallelCalls, sequentialCalls };
}
export function matchesDynamicTool(calls: DynamicTool[], native: { name: string; args: unknown }) {
  if (!native.args || typeof native.args !== 'object' || Array.isArray(native.args)) return false;
  const args = native.args as Record<string, Json>;
  return calls.some(
    (call) =>
      call.name === native.name &&
      Object.entries(call.known).every(
        ([key, value]) => args[key] !== undefined && stable(args[key]) === stable(value),
      ),
  );
}
