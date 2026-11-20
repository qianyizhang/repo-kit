# Blender

| Work | Use |
| --- | --- |
| Visual exploration where each result determines the next edit | **Blender MCP.** Work in a scratch scene. Change one variable at a time and inspect matched views. Read exact Blender values when the scene summary rounds away relevant differences. |
| Known operations, parameter sweeps, exports and verification | **Headless Blender.** Use the project's recipe and Blender version. Batch known operations in one process when practical. |

- **Handoff** · Carry accepted edits into the owning recipe or editable source. Replay from clean inputs and verify the actual output through the project's normal checks.
- **Headless Blender on this Mac** · Request command-specific approval to run outside the Codex command sandbox on the first attempt. Blender 5.2.3 can crash during Metal initialization inside the sandbox.
- **Skills** · Use the project's review guidance by default. Consider individual [Blender Skills](https://github.com/arjun988/blender-skills) such as `lookdev` or `qa-review` when the same review steps recur across projects.

## Local MCP setup

The default setup uses the server and its matching Blender add-on. The tested pair is Blender 5.2.3 with [MCP for Blender 2.3.1](https://pypi.org/project/mcp-for-blender/2.3.1/). If `codex mcp get blender` already shows your server, start at step 3.

1. Install the pinned server with `uv`, then install its add-on. The last command prints the absolute path to use in Codex.

   ```sh
   uv tool install mcp-for-blender==2.3.1
   blender_mcp="$(uv tool dir --bin)/mcp-for-blender"
   "$blender_mcp" install-addon
   printf '%s\n' "$blender_mcp"
   ```

2. Add a [Codex STDIO server](https://developers.openai.com/codex/mcp) named `blender` with the printed command and environment variables `BLENDER_HOST=localhost`, `BLENDER_MCP_SAFE_MODE=1` and `DISABLE_TELEMETRY=true`.
3. In Blender Preferences → Add-ons, enable **Interface: MCP for Blender**. Open **MCP for Blender** in the 3D Viewport sidebar and check that its localhost listener is running. Start it there if needed.
4. In a fresh Codex chat, inspect a scratch scene and request a preview. Setup passes when the call returns scene objects and an image. If Codex discovers the tools and inspection fails, check the Blender window and sidebar listener.
