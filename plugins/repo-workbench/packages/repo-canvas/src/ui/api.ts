import { hosted, hostTool } from './host';
import { contracts, parseOutput, type Arguments, type Output } from '../model/contracts';
export type { Session } from '../model/contracts';
import { operations, type Operation } from '../model/operations';
import { AppDiagnostics, plainMessageFlow } from '../../../diagnostics/client';
import { BUILD, VERSION } from '../model/build';
let localToken: string | undefined;
function basePath() {
  return location.pathname.startsWith('/canvas/') ? location.pathname.replace(/\/?$/, '/') : '/';
}
export const standaloneInspection = new AppDiagnostics({
  name: 'Repo Canvas',
  version: VERSION,
  build: BUILD,
  mode: 'standalone',
  info: () => ({
    connection: localToken ? 'local HTTP connected' : 'waiting for local state',
    conversation: 'unavailable; use the hosted app to send',
    localRequestClosure: 'Does not cancel a Codex turn',
  }),
  flows: [plainMessageFlow],
});
standaloneInspection.remote = async (name, args) => {
  if (!localToken) throw new Error('Local session is not connected');
  const response = await fetch(`${basePath()}api/diagnostics/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Repo-Canvas-Token': localToken },
    body: JSON.stringify(args),
  });
  const value: unknown = await response.json();
  if (!response.ok) throw new Error('Local diagnostics request failed');
  return value;
};
export async function request<K extends Operation>(
  action: K,
  token: string | undefined,
  ...parameters: Arguments<K>
): Promise<Output<K>> {
  const args = contracts[action].input.parse(parameters[0] ?? {});
  if (hosted) return hostTool(action, args as import('../model/contracts').Input<K>);
  const { method, path } = operations[action];
  const query = new URLSearchParams();
  if (method === 'GET')
    for (const [key, value] of Object.entries(args)) query.set(key, String(value));
  const base = basePath();
  if (token) localToken = token;
  return standaloneInspection.observe(action, args, async () => {
    const response = await fetch(`${base}api/${path}${query.size ? `?${query}` : ''}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Repo-Canvas-Token': token } : {}),
      },
      body: method === 'GET' ? undefined : JSON.stringify(args),
    });
    const result: unknown = await response.json();
    if (
      action === 'state' &&
      result &&
      typeof result === 'object' &&
      'token' in result &&
      typeof result.token === 'string'
    )
      localToken = result.token;
    if (!response.ok)
      throw new Error(
        result && typeof result === 'object' && 'error' in result
          ? String(result.error)
          : `Request failed (${response.status})`,
      );
    return parseOutput(action, result);
  });
}
export function download(value: unknown, filename = 'architecture.json') {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
