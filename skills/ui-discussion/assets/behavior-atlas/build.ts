import {
  readFile,
  writeFile,
  mkdir,
  lstat,
  rename,
  rm,
  realpath,
} from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { stripTypeScriptTypes } from "node:module";
import { readIR } from "./schema.ts";
import { escapeText } from "./renderer.ts";
const home = dirname(fileURLToPath(import.meta.url));
const modules = [
  "schema",
  "layout",
  "landscape",
  "renderer",
  "workbench",
  "screen",
  "viewer",
];
const strip = (source: string) =>
  stripTypeScriptTypes(source, { mode: "strip" });
export async function buildPage(value: unknown): Promise<string> {
  const ir = readIR(value),
    parts = await Promise.all(
      modules.map((name) => readFile(join(home, `${name}.ts`), "utf8")),
    );
  const runtime = parts
    .map((part) =>
      strip(part)
        .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm, "")
        .replace(/^export\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];?\s*/gm, ""),
    )
    .join("\n");
  const styles = (
    await Promise.all(
      ["landscape.css", "screen.css", "viewer.css"].map((name) =>
        readFile(join(home, name), "utf8"),
      ),
    )
  ).join("\n");
  const data = JSON.stringify(ir).replace(/</g, "\\u003c");
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeText(ir.title)}</title><style>${styles}</style></head><body><div id="atlas-root"></div><script type="application/json" id="atlas-data">${data}</script><script type="module">${runtime}</script></body></html>\n`;
}
async function safeParent(path: string): Promise<void> {
  for (let p = resolve(path); ; p = dirname(p)) {
    const stat = await lstat(p).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    });
    if (stat?.isSymbolicLink()) {
      const systemAlias =
        process.platform === "darwin" &&
        ["/var", "/tmp"].includes(p) &&
        (await realpath(p)) === `/private${p}`;
      if (!systemAlias) throw new Error(`Refusing symlink destination: ${p}`);
    }
    if (p === dirname(p)) break;
  }
}
export async function writeOutput(
  path: string,
  content: string,
  replace = false,
): Promise<void> {
  await safeParent(path);
  const old = await lstat(path).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  });
  if (old && (!replace || !old.isFile()))
    throw new Error(
      `Output exists: ${path}; choose a new path or use --replace for a file`,
    );
  await mkdir(dirname(path), { recursive: true });
  if (!replace) {
    await writeFile(path, content, { flag: "wx" });
    return;
  }
  const stage = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(stage, content, { flag: "wx" });
    await rename(stage, path);
  } finally {
    await rm(stage, { force: true });
  }
}
export async function writeRuntime(
  directory: string,
  replace = false,
): Promise<void> {
  await safeParent(directory);
  await mkdir(directory, { recursive: true });
  const files: Array<{ name: string; content: string }> = [];
  for (const name of modules.filter((name) => name !== "viewer")) {
    const source = await readFile(join(home, `${name}.ts`), "utf8"),
      header = `// Generated from the repo-kit behavior-atlas scaffold; edit its canonical ${name}.ts.\n`;
    files.push({ name: `${name}.ts`, content: header + source });
    files.push({
      name: `${name}.js`,
      content:
        header +
        strip(source).replace(
          /from (['"])\.\/([a-z]+)\.ts\1/g,
          'from "./$2.js"',
        ),
    });
  }
  files.push({
    name: "atlas.css",
    content: (
      await Promise.all(
        ["landscape.css", "screen.css"].map((name) =>
          readFile(join(home, name), "utf8"),
        ),
      )
    ).join("\n"),
  });
  // Validate every destination before writing any of this runtime generation.
  for (const file of files) {
    const path = join(directory, file.name);
    await safeParent(path);
    const exists = await lstat(path).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    });
    if (exists && (!replace || !exists.isFile()))
      throw new Error(`Runtime output exists: ${path}`);
  }
  for (const file of files)
    await writeOutput(join(directory, file.name), file.content, replace);
}
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      out: { type: "string" },
      check: { type: "boolean" },
      "runtime-out": { type: "string" },
      replace: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "Node 24.21+: node build.ts --input atlas.json [--check | --out atlas.html] [--runtime-out DIR] [--replace]\nThe JSON IR is data; it never imports or executes user code. --runtime-out emits browser modules for an existing app adapter. --replace explicitly replaces named generated files.",
    );
    return;
  }
  const ir = values.input
    ? readIR(JSON.parse(await readFile(resolve(values.input), "utf8")))
    : undefined;
  if (ir && !values.out && !values.check)
    throw new Error("Give --out or --check with --input");
  if (values["runtime-out"])
    await writeRuntime(resolve(values["runtime-out"]), values.replace);
  if (ir) {
    if (values.out)
      await writeOutput(
        resolve(values.out),
        await buildPage(ir),
        values.replace,
      );
    else
      console.log(
        `${ir.states.length} states, ${ir.transitions.length} transitions: valid IR v1`,
      );
  } else if (!values["runtime-out"])
    throw new Error("Give --input or --runtime-out. See --help.");
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(
      `behavior-atlas: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
