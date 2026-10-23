import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

async function files(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return (
    await Promise.all(
      entries
        .filter(
          (e) =>
            !["node_modules", "dist", ".cache", "test-results"].includes(
              e.name,
            ),
        )
        .map((e) =>
          e.isDirectory()
            ? files(resolve(root, e.name))
            : [resolve(root, e.name)],
        ),
    )
  ).flat();
}
void test("product entrypoints use the shared SDK lifetime and have no copied event/store owners", async () => {
  const plugins = resolve(import.meta.dirname, "../..");
  for (const product of ["repo-workbench/packages", "example-mcp-app/src"]) {
    for (const path of await files(resolve(plugins, product))) {
      if (
        !/\.tsx?$/.test(path) ||
        /\.(test|spec)\./.test(path) ||
        /fixture/.test(path)
      )
        continue;
      const code = await readFile(path, "utf8");
      assert.doesNotMatch(
        code,
        /\bnew App\s*\(/,
        `${path}: host lifetime must have one owner`,
      );
      assert.doesNotMatch(
        code,
        /export class (Recorder|LogStore)\b/,
        `${path}: diagnostic policy must have one owner`,
      );
    }
  }
});
void test("the standalone starter adaptation is pinned rather than a silent policy copy", async () => {
  const root = resolve(import.meta.dirname, "../../..");
  const manifest = JSON.parse(
    await readFile(
      resolve(root, "skills/mcp-app/assets/starter-policy.json"),
      "utf8",
    ),
  ) as { files: Record<string, string> };
  for (const [path, digest] of Object.entries(manifest.files)) {
    const bytes = await readFile(
      resolve(root, "skills/mcp-app/assets/starter", path),
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      digest,
      `${path}: review the starter adaptation and update its receipt`,
    );
  }
});
