# Scout List agent guide

- `demo/shopping.json` is safe bundled fixture data only.
- `data/shopping.json` is the local development copy of the private contract;
  the deployed Pages build must never contain personal list data.
- The fixed private repository identity belongs in `src/lib/repository.ts` and
  is not user-selectable.
- Tokens must never be placed in source, URLs, logs or generated assets.
- The Codex research output is untrusted until schema validation succeeds.
- Every GitHub write must use the current file SHA; silent overwrite is not
  allowed.
- Keep retailer links and review evidence source-grounded. Do not present a
  recommendation without a source URL and an observed-at timestamp.
