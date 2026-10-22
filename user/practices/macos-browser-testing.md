# Browser tests on this Mac

- Use the repo harness and a disposable profile. Launch Chrome/Chrome for Testing
  outside the restricted command sandbox with approved execution
  (`sandbox_permissions: require_escalated`). Keep other checks sandboxed.
- On permission, LaunchServices or WindowServer failure, inspect the first error,
  stop unchanged retries and report blocked verification. Headless mode and
  `--no-sandbox` cannot remove the outer restriction.
- Leave personal profiles and unrelated browsers untouched. Use a startup guard
  when a failed launch would otherwise repeat across tests.
