# Browser tests on this Mac

- **Launch** · Use the repo harness with a disposable profile. Launch Chrome or Chrome for Testing outside the restricted command sandbox using approved execution (`sandbox_permissions: require_escalated`). Keep other checks sandboxed and personal profiles/browsers untouched.
- **Failure** · On permission, LaunchServices or WindowServer errors, inspect the first failure, stop unchanged retries and report blocked verification. Headless and `--no-sandbox` are still subject to the outer restriction. Use a startup guard when a launch failure would repeat across tests.
