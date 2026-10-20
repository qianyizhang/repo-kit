export const element = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing ${id}`);
  return e as T;
};
export const compact = (n: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
export const exact = (n: number) => n.toLocaleString('en');
export const money = (n: number) =>
  n > 0 && n < 0.000001
    ? '<$0.000001'
    : '$' +
      n.toLocaleString('en', {
        minimumFractionDigits: 2,
        maximumFractionDigits: n < 0.01 ? 6 : 2,
      });
export const input = (id: string) => element<HTMLInputElement | HTMLSelectElement>(id);
export const set = (id: string, text: string) => {
  element(id).textContent = text;
};
export const node = (tag: string, text = '', className = '') => {
  const e = document.createElement(tag);
  e.textContent = text;
  e.className = className;
  return e;
};
export const shortProject = (p: string) =>
  p.split(/[\\/]/).filter(Boolean).slice(-2).join('/') || p;
export const share = (n: number | null) => (n === null ? '—' : (n * 100).toFixed(1) + '%');
export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function group<T>(records: T[], key: (r: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const r of records) {
    const k = key(r);
    const rows = result.get(k);
    if (rows) rows.push(r);
    else result.set(k, [r]);
  }
  return result;
}
