import manifest from '../../../../package.json' with { type: 'json' };
// Overridden for both the UI and server by the packaging build.
declare const WORKBENCH_BUILD: string;
export const BUILD = typeof WORKBENCH_BUILD === 'string' ? WORKBENCH_BUILD : 'source';
export const VERSION = manifest.version;
