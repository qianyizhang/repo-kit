PYTHON ?= $(if $(wildcard .venv/bin/python),.venv/bin/python,python3.12)
RUFF_PATHS := scripts template/scripts tests .codex/skills/maintain-repo-kit/scripts \
	skills/mcp-app/scripts skills/ui-discussion/scripts

.PHONY: ci-check check-source test lint setup-check check-npm-install

ci-check: check-source test lint

check-source:
	$(PYTHON) scripts/skills.py check --source-only

test:
	$(PYTHON) -m unittest discover -s tests -v

lint:
	$(PYTHON) -m ruff format --check --config template/ruff_base.toml $(RUFF_PATHS)
	$(PYTHON) -m ruff check --config template/ruff_base.toml $(RUFF_PATHS)

setup-check:
	$(PYTHON) -m pip install ruff==0.16.3

check-npm-install:
	$(PYTHON) scripts/check_npm_install.py --revision HEAD
