# Scout List

Scout List is a small, private-by-default shopping researcher. The public
GitHub Pages repository contains only the interface and a safe demo fixture.
The owner’s real list and weekly recommendations live in a separate private
repository at `data/shopping.json`.

## Local development

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
```

The browser starts in demo mode. Connect a fine-grained GitHub PAT with
Contents: read and write access to the fixed private data repository to load
and save the real list. Tokens are kept in memory by default, or in the
selected browser storage after explicit consent.

## Weekly research

The local Temporal worker should invoke the research command with
`SHOPPING_LIST_DATA_REPO` pointing at the private checkout:

```sh
SHOPPING_LIST_DATA_REPO=/absolute/path/to/shopping-list-data pnpm research:weekly
```

The command reads the canonical list, asks Codex to research each active item,
validates the structured response, writes the private JSON atomically and
commits/pushes only the private data repository. Retailer links, price dates,
review evidence and confidence are retained with every recommendation so a
future deterministic retailer adapter can replace the broad research step.

## Privacy boundary

```text
public Pages shell -> optional owner PAT -> fixed private repo (browser)
local Temporal schedule -> Codex SDK -> private data repo -> Pages reader
```

No private list item, price, source URL or token belongs in the public Pages
artifact.
