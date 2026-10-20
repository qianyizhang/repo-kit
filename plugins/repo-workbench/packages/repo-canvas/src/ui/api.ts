import { hosted, hostTool } from './host';
import type { Snapshot } from '../model/document';
import { operations, type Operation } from '../model/operations';
export type Session = Snapshot & { token: string; plugin: string };
export async function request<T>(
  action: Operation,
  token?: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (hosted) return hostTool<T>(action, args);
  const { method, path } = operations[action];
  const query = new URLSearchParams();
  if (method === 'GET')
    for (const [key, value] of Object.entries(args)) query.set(key, String(value));
  const response = await fetch(`/api/${path}${query.size ? `?${query}` : ''}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Repo-Canvas-Token': token } : {}),
    },
    body: method === 'GET' ? undefined : JSON.stringify(args),
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status})`);
  return result;
}
export function download(value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'architecture.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
