import { AppDiagnostics, plainMessageFlow } from '../diagnostics/client.ts';
import { BUILD, VERSION } from '../repo-canvas/src/model/build.ts';
let instance: AppDiagnostics | undefined;
export function standaloneReportInspection(name: string) {
  if (instance) return instance;
  const nonce = document.querySelector<HTMLMetaElement>(
    'meta[name="workbench-diagnostics"]',
  )?.content;
  instance = new AppDiagnostics({
    name,
    version: VERSION,
    build: BUILD,
    mode: nonce ? 'standalone' : 'offline',
    info: () => ({
      conversation: 'No host; no messages are sent from this standalone view',
      source: nonce
        ? 'Local read-only report service'
        : 'Exported document; no background server or disk logger',
      serverCoverage:
        'HTTP status metadata only; decoded source reads are inspected at the app boundary',
    }),
    flows: [
      plainMessageFlow,
      {
        name: 'Standalone source read · fixture',
        steps: [
          'User selects one recorded action',
          'App → Local server: exact event/revision/text-range request',
          'Local server → App: bounded source text',
          'No conversation or model is called',
        ],
        request: { event: 'selected-event', revision: 'captured-source-sha', offset: 0 },
        reads: ['Only the selected event and requested text range'],
      },
    ],
  });
  if (nonce)
    instance.remote = async (name, args) => {
      const response = await fetch(`/diagnostics/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Workbench-Diagnostics': nonce },
        body: JSON.stringify(args),
      });
      if (!response.ok) throw new Error(`Diagnostics HTTP ${response.status}`);
      return response.json();
    };
  return instance;
}
