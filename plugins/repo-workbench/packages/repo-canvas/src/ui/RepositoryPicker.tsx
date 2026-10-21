import { useEffect, useState } from 'react';
import { hosted, repositoryChoices, openRepository } from './host';
import { repositorySchema, type RegisteredRepository } from '../model/contracts';
import { z } from 'zod';
import { ConnectionInfo } from './ConnectionInfo';
import { Icon } from './Icon';
interface Props {
  needsRepository: boolean;
  lookupReason?: string;
  retryingConnection: boolean;
  connectionCheckedAt: string;
  retryConnection: () => Promise<void>;
  load: (recover?: boolean) => Promise<void>;
  error: string;
  setError: (error: string) => void;
}
export function RepositoryPicker({
  needsRepository,
  lookupReason,
  retryingConnection,
  connectionCheckedAt,
  retryConnection,
  load,
  error,
  setError,
}: Props) {
  const [repoPath, setRepoPath] = useState('');
  const [choices, setChoices] = useState<RegisteredRepository[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [repositoryFilter, setRepositoryFilter] = useState('');
  useEffect(() => {
    if (!needsRepository) return;
    let active = true;
    const refresh = async () => {
      try {
        const entries = hosted
          ? await repositoryChoices()
          : await fetch('/api/repositories').then((response) => {
              if (!response.ok) throw new Error('Cannot load registered repositories');
              return response
                .json()
                .then((value: unknown) => z.array(repositorySchema).parse(value));
            });
        if (active) {
          setChoices(entries);
          setCatalogError('');
        }
      } catch (error) {
        if (active) setCatalogError(error instanceof Error ? error.message : String(error));
      } finally {
        if (active) setCatalogLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [needsRepository]);
  async function chooseRepository(path: string) {
    setError('');
    try {
      if (!hosted) {
        const response = await fetch('/api/repositories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        });
        const value: unknown = await response.json();
        if (!response.ok) throw new Error('Cannot add repository');
        const entry = repositorySchema.parse(value);
        location.assign(`/canvas/${entry.id}/`);
        return;
      }
      await openRepository(path);
      await load(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }
  return (
    <div className="loading">
      <div className="brand-mark">▧</div>
      <div className="connection-title">
        <h1>Repo Canvas</h1>
        <ConnectionInfo />
      </div>
      {needsRepository ? (
        <>
          <p className="connection-status" role="status">
            Choose a repository for this canvas.
          </p>
          {error && <p role="alert">{error}</p>}
          {hosted && (
            <div className="connection-lookup">
              <p className="connection-hint" role="status">
                {retryingConnection
                  ? 'Checking this chat’s repository…'
                  : lookupReason === 'missing-chat-metadata'
                    ? 'Codex hasn’t supplied a chat identity. Choose a repository below; we’ll keep checking automatically.'
                    : 'This chat’s repository isn’t available to the app yet. Choose it below, or leave this panel open to connect when it becomes available.'}
                {connectionCheckedAt && !retryingConnection && (
                  <span className="connection-checked">
                    Checked {connectionCheckedAt} · still waiting for workspace context.
                  </span>
                )}
              </p>
              <button
                className="icon-button"
                aria-label="Retry automatic connection"
                title="Retry automatic connection"
                disabled={retryingConnection}
                onClick={() => void retryConnection()}
              >
                <Icon name="refresh" />
              </button>
            </div>
          )}
          <h2 className="repository-heading">Saved repositories</h2>
          <p className="connection-hint">Repositories you open are remembered on this device.</p>
          {catalogLoading && <p role="status">Loading saved repositories…</p>}
          {!catalogLoading && !catalogError && choices.length === 0 && (
            <p>No saved repositories yet. Open a folder below to add the first one.</p>
          )}
          {choices.length > 0 && (
            <label>
              Find a repository
              <input
                type="search"
                value={repositoryFilter}
                onChange={(event) => setRepositoryFilter(event.target.value)}
                placeholder="Name or path"
              />
            </label>
          )}
          {choices.length > 0 && (
            <div className="repository-choices" aria-label="Registered repositories">
              {choices
                .filter((entry) =>
                  `${entry.name} ${entry.path}`
                    .toLowerCase()
                    .includes(repositoryFilter.toLowerCase()),
                )
                .map((entry) => (
                  <button
                    key={entry.id}
                    disabled={!entry.available}
                    onClick={() =>
                      hosted
                        ? void chooseRepository(entry.path)
                        : location.assign(`/canvas/${entry.id}/`)
                    }
                  >
                    <strong>{entry.name}</strong>
                    <code>{entry.path}</code>
                    {!entry.available && <span>Unavailable</span>}
                  </button>
                ))}
            </div>
          )}
          {choices.length > 0 &&
            !choices.some((entry) =>
              `${entry.name} ${entry.path}`.toLowerCase().includes(repositoryFilter.toLowerCase()),
            ) && <p>No repositories match your search.</p>}
          {catalogError && <p role="alert">{catalogError}</p>}
          <details>
            <summary>Add another repository</summary>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void chooseRepository(repoPath.trim());
              }}
            >
              <label>
                Repository path
                <input
                  value={repoPath}
                  onChange={(event) => setRepoPath(event.target.value)}
                  placeholder="/absolute/path/to/repository"
                  required
                />
              </label>
              <button type="submit">Open and remember</button>
            </form>
          </details>
          <p className="connection-hint">
            This list updates automatically. You can also manage it with{' '}
            <code>repo-workbench repos</code>.
          </p>
        </>
      ) : (
        <>
          <p role={error ? 'alert' : undefined}>{error || 'Opening the repository…'}</p>
          {error && <button onClick={() => void load()}>Retry loading map</button>}
        </>
      )}
    </div>
  );
}
