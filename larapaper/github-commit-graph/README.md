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

To test the exact request shape LaraPaper sends, run:

```sh
task github:test-polling-request USERNAME=octocat
```

If local auth works but LaraPaper returns `401` or `403`, re-paste the raw token value into the imported recipe's `github_token` field with no quotes, whitespace, or `Bearer` prefix. `.env` is only used by the local test tasks; LaraPaper does not read this repository's `.env`.

If editing the polling headers directly in LaraPaper's UI, use colon syntax:

```text
Authorization: Bearer {{ github_token }}
Content-Type: application/json
Accept: application/vnd.github+json
User-Agent: trmnl-larapaper-recipe
X-GitHub-Api-Version: 2022-11-28
```

Use the same colon-delimited header format in `src/settings.yaml`; LaraPaper's runtime parser only reads colon-delimited header lines.

For a persistent `403` on LaraPaper:

- Confirm the imported plugin has the same token value as `.env`.
- Re-import the recipe if `src/settings.yaml` changed after the plugin was created.
- Use a valid unexpired token that can call GitHub GraphQL. If a fine-grained token fails, retry with a classic PAT using `public_repo`.
- Check whether the LaraPaper server IP is GitHub rate-limited or blocked for outbound requests.
