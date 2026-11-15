# Behavior atlas authoring

Use this scaffold for an interactive state/route review. Keep the capture-based
UI anatomy review when the question concerns actual screen arrangement. The
atlas is a behavioral projection; it does not replace current screenshots.

1. Read the repository's instructions, architecture and UI/state owners. Choose a
   named behavior scope and pin its source revision. Inspect the owning state,
   command and persistence code. Identify user-visible
   states, direct actions, system events, blocked conditions and explicit outcomes.
   Keep distinctions needed for drafts, retries, permissions and uncertain results.
   Reconcile each modeled transition with its handler and each outcome with its
   persistence/result branch. Record relative source paths and useful line numbers
   on the state/transition; name uninspected surfaces in coverage. This step is done
   when every included action has a source owner or is explicitly a proposal.
2. Write a v1 JSON IR using the [working example](../assets/behavior-atlas/example.json)
   and [contract](../assets/behavior-atlas/README.md#author-the-ir). Add source
   locations, baseline revision and named coverage gaps. Use stable IDs and labels
   meaningful to the reviewer. Do not put renderer code or executable guards in IR.
   Supply fixed `preview` content for the modeled app states. Keep fixture data
   free of secrets and live inputs. Use the bounded screen blocks and overlays in
   the contract for visible structure, and reference transition IDs in action
   blocks. The agent edits the IR; renderer changes are a separate scaffold task. Give states distinct IDs when retained context
   changes their available actions or Cancel destination; a label alone is not a
   state identity. Use an app adapter when those distinctions cannot be represented
   faithfully in the graph.

   Author major `journeys` as explicit transition sequences, including failure,
   retry and recovery. Mark meaningful `outcome` states separately from terminal
   states. Add `comparisons` only for an actual proposal with a shared start/end;
   mark its new transitions `proposed` so exploration cannot silently use them.

3. Generate into a new local review directory:

   ```sh
   python3 /path/to/ui-discussion/scripts/scaffold_atlas.py \
     --target /absolute/review/scaffold --input /absolute/review/atlas.json
   node /absolute/review/scaffold/build.ts --input /absolute/review/scaffold/example.json --check
   node /absolute/review/scaffold/build.ts \
     --input /absolute/review/scaffold/example.json --out /absolute/review/atlas.html
   ```

   Schema validation must pass before rendering. Keep authored major journeys
   in discovery order; do not replace recovery routes with shortest paths.

4. Inspect the rendered routes. Replay consequential paths against the source
   model or real app before treating them as verified. Preserve the difference
   between a simulated graph, a source-backed adapter and live acceptance.
   Check both major views, disabled alternatives in Journey, next-action guards
   in Exploration, repeated visits, outcome capture, custom trace loops and the
   independent comparison cursors when a proposal exists. Keep inspection separate
   from navigation and the companion passive. Completion requires the model's
   included scope and its named exclusions to match the source and exercised flows.

For an existing app simulation, use the scaffold's documented adapter interface.
The app owns availability and effects; the scaffold owns validation, layout and
rendering. Shared styling handles current-state cues, immediate routes, inactive
planes, reduced motion and pause. Keep product-specific facts downstream.

## Updating a model

Re-read changed source owners and update the same IR. Keep IDs for the same facts;
add a distinct state when retained context changes behavior. Rebuild with explicit
`--replace` only for the named generated HTML. Runtime code stays scaffold-owned.
A proposal is a separate authored journey plus comparison; retain the original
sequence and mark new edges `proposed`. Do not mark a screenshot or simulated
fixture as live application evidence. The scaffold performs no automatic repository
scan, model-provider call or product action; the agent's source analysis creates IR.
