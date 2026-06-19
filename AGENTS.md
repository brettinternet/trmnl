# AGENTS.md

- Be terse.
- Recipes live in `larapaper/<recipe>/` with `README.md`, `src/settings.yaml`, and one template.
- Keep root setup in `Taskfile.dist.yaml`, `.taskfiles/`, `mise.toml`, and `lefthook.yaml`.
- Never commit `.env`.
- Use `bun`/`bunx` when JS tooling is needed.
- Use `mise exec <tool> -- <cmd>` for mise-managed tools.
- Use `rg`, `fd`, and `ast-grep` before slower or fragile search/edit tools.
- Do not push or open PRs unless explicitly asked.
