cat > "$RUNNER_TEMP/shared-fixtures/results/pipeline-negative.cjs" <<'JS'
const { test } = require('node:test');
const assert = require('node:assert/strict');
test('expected pipeline failure', () => assert.fail('Controlled failure for shell propagation'));
JS
set +e
node --test --test-reporter=tap "$RUNNER_TEMP/shared-fixtures/results/pipeline-negative.cjs" 2>&1 | tee "$RUNNER_TEMP/shared-fixtures/results/pipeline-negative.log"
observed_status=$?
set -e
if [ "$observed_status" -ne 1 ]; then
  echo "::error::El pipeline ocultó el fallo de node --test: exit $observed_status"
  exit 1
fi
grep -q '^not ok 1 - expected pipeline failure' "$RUNNER_TEMP/shared-fixtures/results/pipeline-negative.log"
printf '{"expectedExitCode":1,"observedExitCode":%s}\n' "$observed_status" > "$RUNNER_TEMP/shared-fixtures/results/pipeline-status.json"
