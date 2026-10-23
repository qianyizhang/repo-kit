import {
  AppBridge,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
const frame = document.querySelector<HTMLIFrameElement>("iframe")!;
const target = frame.contentWindow!;
const nonce = document.querySelector<HTMLMetaElement>(
  "meta[name=fixture-nonce]",
)!.content;
const limited = new URLSearchParams(location.search).has("limited");
const bridge = new AppBridge(
  null,
  { name: "Fixture host; no model", version: "1" },
  {
    serverTools: {},
    ...(limited ? {} : { message: { text: {} } }),
  },
  { hostContext: { theme: "light", displayMode: "inline" } },
);
const messages: unknown[] = [],
  calls: string[] = [];
async function post(path: string, value: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-fixture-nonce": nonce },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`Fixture HTTP ${response.status}`);
  return response.json();
}
bridge.oncalltool = async (params) => {
  calls.push(params.name);
  document.getElementById("calls")!.textContent = JSON.stringify(calls);
  return CallToolResultSchema.parse(await post("/tool", params));
};
bridge.onmessage = async (params) => {
  messages.push(params);
  document.getElementById("messages")!.textContent = JSON.stringify(messages);
  const mode = document.querySelector<HTMLSelectElement>("#mode")!.value;
  if (mode === "slow" || mode === "timeout")
    await new Promise((resolve) =>
      setTimeout(resolve, mode === "slow" ? 600 : 5000),
    );
  return mode === "reject" ? { isError: true } : {};
};
document.getElementById("teardown")!.onclick = () => {
  void bridge.teardownResource({});
};
document.getElementById("theme")!.onclick = () =>
  bridge.setHostContext({ theme: "dark" });
async function start() {
  await bridge.connect(new PostMessageTransport(target, target));
  const html = await (await fetch("/app")).text();
  frame.srcdoc = html.replace(
    "<head>",
    `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'">`,
  );
}
void start().catch((error) => {
  document.getElementById("messages")!.textContent = String(error);
});
