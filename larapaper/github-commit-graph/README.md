# GitHub Commit Graph for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

## Files

- `src/settings.yaml` declares the polling request and configurable fields.
- `src/full.blade.php` renders the TRMNL-compatible Blade view.

## Configuration

Set these fields after import:

- `username`: GitHub username to display.
- `github_token`: GitHub token used for the GraphQL request.

The token needs access to GitHub's GraphQL API. Public contribution data does not require private repo access. Use a valid unexpired token:

- fine-grained PAT: public repository read access is enough.
- classic PAT: `public_repo` is enough if selecting repo scopes.

## Token Check

Put `GITHUB_TOKEN=...` in `.env`, then run:

```sh
task github:test-token USERNAME=octocat
```

If local auth works but LaraPaper returns `401`, re-paste the raw token value into the recipe field with no quotes or `Bearer` prefix. `.env` is only used by the local test task; LaraPaper uses the imported recipe's `github_token` field.
