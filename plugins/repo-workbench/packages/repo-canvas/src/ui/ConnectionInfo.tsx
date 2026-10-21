import { useEffect, useState } from 'react';
import { connectionStatus, connectionDiagnostics, hosted } from './host';
import { download } from './api';
import { Icon } from './Icon';

export function ConnectionInfo() {
  const [info, setInfo] = useState(connectionStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [copyFallback, setCopyFallback] = useState('');
  useEffect(() => {
    const changed = () => setInfo(connectionStatus());
    window.addEventListener('repo-canvas-connection', changed);
    return () => window.removeEventListener('repo-canvas-connection', changed);
  }, []);
  async function refresh(exportLog = false) {
    setBusy(true);
    setCopyStatus('');
    setCopyFallback('');
    const report = await connectionDiagnostics();
    const server = report.server;
    setError(server && 'error' in server ? (server.error ?? '') : '');
    setInfo({ ...connectionStatus(), ...(server && 'version' in server ? { server } : {}) });
    if (exportLog) download(report, 'repo-canvas-diagnostics.json');
    setBusy(false);
  }
  if (!hosted) return null;
  const server = info.server;
  const mismatch = server && (server.version !== info.uiVersion || server.build !== info.uiBuild);
  async function copy() {
    const text = [
      'Repo Canvas · Connection',
      `Panel: ${info.uiVersion} · ${info.uiBuild}`,
      `Server: ${server ? `${server.version} · ${server.build}` : 'Unavailable'}`,
      `Started: ${server?.startedAt ?? '—'}`,
      `Process: ${server?.pid ?? '—'}`,
      `Server instance: ${server?.serverId ?? '—'}`,
      `Repository: ${info.repository ?? 'Not selected'}`,
      `Binding: ${info.binding ?? 'Not connected'}`,
      `Chat: ${info.threadId ?? 'Not provided by host'}`,
      `Context: ${info.contextId ?? '—'}`,
      `Log file: ${server?.file ?? 'Memory only'}`,
      ...(info.reason ? [`Lookup: ${info.reason}`] : []),
      ...(error ? [`Error: ${error}`] : []),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyFallback('');
      setCopyStatus('Copied connection details.');
    } catch {
      setCopyFallback(text);
      setCopyStatus('Clipboard unavailable here. Copy the selected details below.');
    }
  }
  return (
    <details
      className="connection-info"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}
      onToggle={(event) => {
        if (event.currentTarget.open) void refresh();
      }}
    >
      <summary aria-label="Connection information" title="Connection information">
        <Icon name="info" />
      </summary>
      <div role="region" aria-label="Connection information">
        <div className="connection-info-heading">
          <strong>Connection</strong>
          <div className="connection-actions">
            <button
              className="icon-button"
              aria-label="Copy connection details"
              title="Copy connection details"
              onClick={() => void copy()}
            >
              <Icon name={copyStatus.startsWith('Copied') ? 'check' : 'copy'} />
            </button>
            <button
              className="icon-button"
              aria-label="Refresh status"
              title="Refresh status"
              disabled={busy}
              onClick={() => void refresh()}
            >
              <Icon name="refresh" />
            </button>
            <button
              className="icon-button"
              aria-label="Download connection log"
              title="Download connection log"
              disabled={busy}
              onClick={() => void refresh(true)}
            >
              <Icon name="download" />
            </button>
          </div>
        </div>
        {copyStatus && <p role="status">{copyStatus}</p>}
        {copyFallback && (
          <textarea
            aria-label="Connection details to copy"
            readOnly
            value={copyFallback}
            ref={(element) => {
              element?.focus();
              element?.select();
            }}
          />
        )}
        <p role={mismatch || error ? 'alert' : 'status'}>
          {error ||
            (mismatch
              ? 'UI and server builds differ. Reopen the panel after refreshing the plugin.'
              : server
                ? 'UI and server builds match.'
                : 'Server information is not available yet.')}
        </p>
        <dl>
          <dt>Panel</dt>
          <dd>
            {info.uiVersion} · <code>{info.uiBuild}</code>
          </dd>
          <dt>Server</dt>
          <dd>
            {server ? (
              <>
                {server.version} · <code>{server.build}</code>
              </>
            ) : (
              'Unavailable'
            )}
          </dd>
          <dt>Started</dt>
          <dd>{server ? new Date(server.startedAt).toLocaleString() : '—'}</dd>
          <dt>Process</dt>
          <dd>{server?.pid ?? '—'}</dd>
          <dt>Server instance</dt>
          <dd>
            <code>{server?.serverId ?? '—'}</code>
          </dd>
          <dt>Repository</dt>
          <dd>
            <code>{info.repository ?? 'Not selected'}</code>
          </dd>
          <dt>Binding</dt>
          <dd>{info.binding ?? 'Not connected'}</dd>
          <dt>Chat</dt>
          <dd>
            <code>{info.threadId ?? 'Not provided by host'}</code>
          </dd>
          <dt>Context</dt>
          <dd>
            <code>{info.contextId ?? '—'}</code>
          </dd>
          <dt>Log file</dt>
          <dd>
            <code>{server?.file ?? 'Memory only'}</code>
            {server?.fileError && <p role="alert">{server.fileError}</p>}
          </dd>
        </dl>
      </div>
    </details>
  );
}
