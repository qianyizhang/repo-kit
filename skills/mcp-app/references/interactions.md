# Interaction contracts

## A tool is a published operation

An MCP tool can wrap a domain/server operation, but the relationship need not be
one-to-one. An opening tool also links a UI resource; a host message is a different
protocol method. Inventory tools from the actual registration source, including
app-only tools. For each show name, purpose, input/output schemas, caller visibility,
authorization checks, side effects, scope/limits, source owner and an example.
App-only visibility and read-only annotations describe intent; server validation
and access control enforce authority. Avoid a generic read-anything tool.

Keep panel data and model-visible data distinct. Opening a panel returns its
identity and small status, not its entire dataset. Reading a selected paragraph,
listing records and obtaining provenance are separate bounded operations. Tool
results containing `isError: true` are errors even when transport succeeded.

## Send

1. Freeze the user's exact text and explicitly selected context. Whitespace can
   determine whether a draft is empty without rewriting the submitted text.
2. Show the destination and attachment scope. Start with attachment off. A plain
   greeting has no source lookup, evidence ID, hidden context update or read-tool
   instruction. Context can include a short excerpt and stable revision/ID; source
   bodies and provenance stay behind exact scoped reads.
3. Record that exact request before invoking the adapter. Disable concurrent sends.
   Keep editing available if useful, but identify drafts with a revision counter.
4. Clear only the revision that was acknowledged. Rejection preserves the draft.
   Timeout/disconnect after dispatch means delivery uncertain; preserve the payload
   and do not retry automatically. A new user action may begin a deliberate retry.
5. Record the observed result. Explain what is still unknown. Main conversation
   messages are not implicitly cancellable from a panel.

| State           | Evidence                                            | Safe wording                                               |
| --------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Ready           | Local draft exists                                  | Ready to send                                              |
| Sending         | Adapter invoked; no result                          | Sending to this conversation                               |
| Accepted        | Host acknowledged `ui/message`                      | Accepted by host; reply not observed                       |
| Rejected        | Host returned an explicit rejection                 | Message rejected; draft kept                               |
| Uncertain       | Dispatch occurred; outcome unavailable              | Delivery uncertain; check the conversation before retrying |
| Unavailable     | No message capability or connection before dispatch | Conversation unavailable; copy the message                 |
| Answered        | Matching assistant reply actually received          | Answer received                                            |
| Applied / Saved | Effect owner's acknowledgment                       | Changes applied / saved                                    |

Keep transport connection, message delivery and document dirty/save state separate.
Only offer Answered/Applied/Saved when the app has evidence for that state.

## Lifecycle and standalone operation

State exactly what Close, Cancel, Disconnect and Stop control. App teardown can
stop local timers and pending reads; it does not prove cancellation of a host turn
or server job. Protect callbacks from an old panel/context. Settings reads should
declare any connection they start; separate independently connected helpers.

Use one domain implementation and view with HTTP and host adapters. Standalone
users can browse/edit/save the same domain data where supported. Conversation-only
actions expose a clear unavailable state plus useful copy/export. A hosted
connection failure must stay a hosted failure, not silently switch to a simulation.

Fixtures can simulate acknowledgment, rejection and timeout, but display their
mode and destination. Keep fixture control code out of production bundles.

Primary protocol references: [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
and [official SDK/specification](https://github.com/modelcontextprotocol/ext-apps).
The starter pins its tested SDK versions; verify those APIs before an upgrade.
