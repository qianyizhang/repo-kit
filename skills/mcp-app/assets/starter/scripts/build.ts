import { build } from "rolldown";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile, lstat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, ".."),
  hash = createHash("sha256");
for (const directory of ["src", "scripts"]) {
  for (const file of (await readdir(resolve(root, directory))).sort()) {
    hash
      .update(`${directory}/${file}`)
      .update(await readFile(resolve(root, directory, file)));
  }
}
hash.update(await readFile(resolve(root, "package.json")));
hash.update(
  await readFile(resolve(root, "package-lock.json")).catch(
    () => "lockfile absent",
  ),
);
const fingerprint = hash.digest("hex").slice(0, 12),
  dist = resolve(root, "dist");
if ((await lstat(dist).catch(() => undefined))?.isSymbolicLink())
  throw new Error("Symlinked dist");
await mkdir(dist, { recursive: true });
async function bundle(entry: string, platform: "browser" | "node") {
  const result = await build({
    input: resolve(root, entry),
    write: false,
    platform,
    external: [/^node:/],
    transform: { define: { APP_BUILD: JSON.stringify(fingerprint) } },
    output: {
      format: platform === "browser" ? "iife" : "esm",
      codeSplitting: false,
      ...(platform === "node"
        ? {
            banner:
              "import {createRequire as starterRequire} from 'node:module'; const require=starterRequire(import.meta.url);",
          }
        : {}),
    },
  });
  const chunk = result.output.find((item) => item.type === "chunk");
  if (!chunk || chunk.type !== "chunk") throw new Error("Missing bundle");
  return chunk.code;
}
const app = await bundle("src/app.ts", "browser");
const html = (await readFile(resolve(root, "src/app.html"), "utf8")).replace(
  "/* SCRIPT */",
  () => app.replace(/<\/script/gi, "<\\/script"),
);
await writeFile(resolve(dist, "app.html"), html);
for (const name of ["server", "web"])
  await writeFile(
    resolve(dist, `${name}.mjs`),
    await bundle(`src/${name}.ts`, "node"),
  );
// The fixture host is test-only and never included in the app resource or server.
await writeFile(
  resolve(dist, "test-host.js"),
  await bundle("tests/host.ts", "browser"),
);
console.log(`Built __APP_ID__ ${fingerprint}`);
