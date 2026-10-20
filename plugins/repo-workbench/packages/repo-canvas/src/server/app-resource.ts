import { asset } from '../../../runtime/assets.ts';
export const APP_URI = 'ui://repo-canvas/workbench-v2.html';
let resource: Promise<string> | undefined;
/** A prebuilt self-contained resource. Installed runtimes need no Vite or React packages. */
export function appResource(): Promise<string> {
  return (resource ??= asset('canvas.html').then((html) =>
    html.replace('<head>', '<head><meta name="repo-canvas-mcp-app" content="true">'),
  ));
}
