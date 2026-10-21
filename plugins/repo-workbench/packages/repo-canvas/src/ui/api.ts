import { hosted, hostTool } from './host';
import { contracts, parseOutput, type Arguments, type Output } from '../model/contracts';
export type { Session } from '../model/contracts';
import { operations, type Operation } from '../model/operations';
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
  const base = location.pathname.startsWith('/canvas/')
    ? location.pathname.replace(/\/?$/, '/')
    : '/';
  const response = await fetch(`${base}api/${path}${query.size ? `?${query}` : ''}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Repo-Canvas-Token': token } : {}),
    },
    body: method === 'GET' ? undefined : JSON.stringify(args),
  });
  const result: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      result && typeof result === 'object' && 'error' in result
        ? String(result.error)
        : `Request failed (${response.status})`,
    );
  return parseOutput(action, result);
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
