# MCP App runtime

Internal source, bundled into Workbench and Example. It is not a separately
installed runtime or an extension framework. Run `npm ci` here before building
either plugin from source. The plugins' delivered archives remain independent.

## Contract declared before implementation

| Owner               | Fixed for its lifetime                                                                            | Commands and terminal behavior                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HostSession         | Instance identity, app declaration, supported actions, timeouts, callbacks, observed capabilities | Connect once, invoke, dispose. Closed/unavailable/incompatible sessions cannot reconnect. Create a new instance. Late completions cannot publish. Dispatched message failures are uncertain unless explicitly rejected. |
| ScopedRegistry      | Count/byte/age limits, scope policy, disposal callback                                            | Create, resolve for caller, list caller's entries, release, close. Missing hosted identity fails. Local scope must be declared by the trusted adapter. IDs do not grant authority.                                      |
| Recorder / LogStore | Event schema, masking and retention policy, session identity                                      | Append frozen observations; expire whole interaction groups by class. Background observations cannot evict user actions. Metadata is persisted automatically; one interaction's payload requires explicit capture.      |
| Poller              | Interval, maximum backoff, visibility source, task                                                | One read at a time. Stop aborts the read and removes timer/listener. Hidden pages do no background reads.                                                                                                               |

Definitions are detached and deeply frozen plain data. Callers cannot replace
handlers or reach an SDK App. Mutable state is private; public snapshots are
detached. Runtime policies may evolve in a versioned release, not by changing an
active instance. Product modules keep domain validation, draft recovery, report
revision adoption and display decisions.

The SDK adapter is the only shared host-protocol dependency. Tests use the same
session interface with a controlled adapter; browser tests also run the actual SDK
bridge. Wire IDs remain source-local. Explicit interaction/call IDs correlate only
the boundaries that actually propagate them.

Startup log pruning affects only recognized inactive session directories under
the configured app log root. It retains eight inactive sessions for seven days;
active processes are excluded. Metadata rotates at 2 MiB per source. Explicit
captures are limited to eight files of 2 MiB per session. No automatic payload
capture, source reread, conversation message or uncertain-effect retry occurs.

The independently distributed starter keeps a smaller teaching contract: no
background domain polling and one 250-event budget. Its generated-app behavior
tests and CI own verification; the skill delivery lock owns file integrity.
