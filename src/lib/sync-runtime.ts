export const HOOK_PULL = `#!/bin/sh
ROOT=$(git rev-parse --show-toplevel)
exec node "$ROOT/.ruledeck/sync.mjs" pull
`;

export const HOOK_PUSH = `#!/bin/sh
ROOT=$(git rev-parse --show-toplevel)
exec node "$ROOT/.ruledeck/sync.mjs" push
`;
