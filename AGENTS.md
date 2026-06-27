# AGENTS.md

This repo holds TRMNL recipes (plugins) targeting [Larapaper](https://github.com/usetrmnl/larapaper), a self-hosted Laravel BYOS/BYOD server for [TRMNL](https://docs.trmnl.com/go/diy/byos) e-ink devices. Recipes render screens server-side; import a recipe directory as a Larapaper plugin archive.

- Be terse.
- Recipes live in `larapaper/<recipe>/` with `README.md`, `src/settings.yaml`, and one template.
- Keep root setup in `Taskfile.dist.yaml`, `.taskfiles/`, `mise.toml`, and `lefthook.yaml`.
- Never commit `.env`.
- Use `bun`/`bunx` when JS tooling is needed.
- Use `mise exec <tool> -- <cmd>` for mise-managed tools.
- Use `rg`, `fd`, and `ast-grep` before slower or fragile search/edit tools.
- Do not push or open PRs unless explicitly asked.
