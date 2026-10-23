import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { PROTOCOL_VERSION } from "./definition.ts";

const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
async function files(root: string, prefix = ""): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(resolve(root, prefix), {
    withFileTypes: true,
  })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...(await files(root, path)));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}
/** Source identity is a build input. Emitted-byte identity is a separate receipt. */
export async function sharedFingerprint(): Promise<string> {
  const root = resolve(import.meta.dirname, "..");
  const entries = [
    ...(await files(root, "src")),
    "package.json",
    "package-lock.json",
  ];
  return sha(
    (
      await Promise.all(
        entries.map(
          async (path) =>
            `${path}\0${sha(await readFile(resolve(root, path)))}`,
        ),
      )
    ).join("\n"),
  );
}
export async function releaseReceipt(
  root: string,
  dist: string,
  build: string,
) {
  let revision: string | null = null,
    dirty: boolean | null = null;
  try {
    revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    dirty = !!execFileSync(
      "git",
      ["status", "--porcelain", "--", ".", "../mcp-app-runtime"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    /* Source archives may carry no Git history; never invent a clean revision. */
  }
  const assets = await Promise.all(
    (await files(dist))
      .filter((path) => path !== "release.json")
      .map(async (path) => {
        const bytes = await readFile(resolve(dist, path));
        return { path, bytes: bytes.length, sha256: sha(bytes) };
      }),
  );
  const receipt = {
    version: 1,
    protocol: PROTOCOL_VERSION,
    source: { revision, dirty },
    build,
    lockSha256: sha(await readFile(resolve(root, "package-lock.json"))),
    sharedInputSha256: await sharedFingerprint(),
    assets,
  };
  await writeFile(
    resolve(dist, "release.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  return receipt;
}
