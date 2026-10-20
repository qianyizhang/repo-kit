import { parse, type TomlTable } from 'smol-toml';
import { isDeepStrictEqual } from 'node:util';

export function configuration(text: string): TomlTable {
  try {
    return parse(text, { integersAsBigInt: true });
  } catch {
    // Config can contain credentials: never echo parser source excerpts.
    throw new Error('Cannot parse Codex configuration. Repair its TOML before running setup.');
  }
}
function table(value: unknown): TomlTable {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Date)
    throw new Error('Expected a TOML table for plugin configuration.');
  return value as TomlTable;
}
export function workbenchPlugins(config: TomlTable): string[] {
  return Object.keys(config.plugins === undefined ? {} : table(config.plugins)).filter((id) =>
    id.startsWith('repo-workbench@'),
  );
}
/** Preserve source text; validate the complete semantic delta before returning a patch. */
export function projectConfig(text: string, plugin: string, peers: string[]): string {
  const expected = configuration(text);
  const plugins = expected.plugins === undefined ? configuration('') : table(expected.plugins);
  expected.plugins = plugins;
  let result = text;
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  for (const id of [...new Set([...peers.filter((id) => id !== plugin), plugin])]) {
    const enabled = id === plugin;
    const previous = plugins[id] === undefined ? configuration('') : table(plugins[id]);
    if (previous.enabled === enabled) continue;
    previous.enabled = enabled;
    plugins[id] = previous;
    const headers = [...result.matchAll(/^[ \t]*\[(?!\[)[^\r\n]+\][ \t]*(?:#[^\r\n]*)?$/gm)];
    const header = headers.find((match) => {
      try {
        const parsed = configuration(match[0] + '\n__workbench_header__ = true');
        const value = table(table(parsed.plugins)[id]);
        return value.__workbench_header__ === true;
      } catch {
        return false;
      }
    });
    if (header) {
      const start = header.index + header[0].length;
      const end = headers.find((next) => next.index > header.index)?.index ?? result.length;
      const body = result.slice(start, end);
      const assignment =
        /^([ \t]*(?:enabled|"enabled"|'enabled')[ \t]*=[ \t]*)(?:true|false)([ \t]*(?:#[^\r\n]*)?)(?=\r?$)/m;
      const edited = assignment.test(body)
        ? body.replace(
            assignment,
            (_, prefix: string, suffix: string) => `${prefix}${enabled}${suffix}`,
          )
        : `${newline}enabled = ${enabled}${body || newline}`;
      result = result.slice(0, start) + edited + result.slice(end);
    } else {
      result += `${result && !result.endsWith('\n') ? newline : ''}${newline}[plugins.${JSON.stringify(id)}]${newline}enabled = ${enabled}${newline}`;
    }
  }
  try {
    if (isDeepStrictEqual(configuration(result), expected)) return result;
  } catch {
    // Unsupported inline/dotted/multiline layouts must not be rewritten heuristically.
  }
  throw new Error(
    'Cannot safely edit plugin enablement. Use separate [plugins."NAME@MARKETPLACE"] tables with an enabled boolean, then rerun setup. No configuration was written.',
  );
}
