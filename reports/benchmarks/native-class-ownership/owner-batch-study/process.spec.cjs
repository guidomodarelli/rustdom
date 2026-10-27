/** @file Real process lifecycle contracts: raw streams, controlled errors, timeout and cancellation of the complete owned tree. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, after } = require('node:test');
const { execute } = require('./process.cjs');
const policy = require('./constants/process.json');
const root = process.env[policy.testOutputEnvironment] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'owner-batch-process-'));
if (!fs.existsSync(root)) fs.mkdirSync(root);
const records = [];
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));

/** Observe termination independently; a zombie has exited and cannot execute more work, but is reported explicitly. */
function state(pid) {
  try {
    const raw = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    return raw.slice(raw.lastIndexOf(')') + 2).split(' ')[0];
  } catch (error) { if (error.code === 'ENOENT') return 'absent'; throw error; }
}
test('a real command preserves raw stdout/stderr and its independently observed exit', async () => {
  const directory = path.join(root, 'success');
  const record = await execute([process.execPath, '-e', "process.stdout.write('output\\n');process.stderr.write('diagnostic\\n')"],
    directory, { timeoutMs: policy.abortTestTimeoutMs });
  records.push(record); assert.equal(record.exitCode, 0); assert.equal(record.complete, true);
  assert.equal(record.timedOut, false); assert.equal(record.cancelled, false);
  assert.equal(fs.readFileSync(path.join(directory, policy.stdoutFile), 'utf8'), 'output\n');
  assert.equal(fs.readFileSync(path.join(directory, policy.stderrFile), 'utf8'), 'diagnostic\n');
  assert.deepEqual(read(path.join(directory, policy.commandFile)), record);
});
test('a nonexistent executable preserves controlled spawn failure and existing evidence is never overwritten', async () => {
  const directory = path.join(root, 'missing');
  const record = await execute([path.join(root, 'no-such-executable')], directory, { timeoutMs: policy.testTimeoutMs });
  records.push(record); assert.equal(record.complete, true); assert.notEqual(record.exitCode, 0);
  assert.match(record.failure.message, /ENOENT/);
  const raw = fs.readFileSync(path.join(directory, policy.commandFile));
  await assert.rejects(execute([process.execPath, '-e', 'process.exit(0)'], directory, { timeoutMs: policy.testTimeoutMs }));
  assert.deepEqual(fs.readFileSync(path.join(directory, policy.commandFile)), raw);
});
test('a real infinite child is killed at the declared deadline with terminal diagnostics', async () => {
  const record = await execute([process.execPath, '-e', 'setInterval(() => {}, 1000)'], path.join(root, 'timeout'),
    { timeoutMs: policy.testTimeoutMs });
  records.push(record); assert.equal(record.timedOut, true); assert.equal(record.signal, policy.killSignal);
  assert.equal(record.processGroupTerminationAttempted, true);
  assert.ok(['absent', 'Z', 'X'].includes(state(record.pid)));
});
test('cancellation terminates both genuinely started members of the owned process group', async () => {
  const ready = path.join(root, 'tree-ready.json'); const controller = new AbortController();
  const running = execute([process.execPath, path.join(__dirname, 'fixtures/process-tree.cjs'), ready], path.join(root, 'cancelled'),
    { timeoutMs: policy.abortTestTimeoutMs, signal: controller.signal });
  const deadline = Date.now() + policy.readyTimeoutMs;
  while (!fs.existsSync(ready) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, policy.readyPollIntervalMs));
  try { assert.ok(fs.existsSync(ready), 'The genuine process tree never signaled readiness'); }
  finally { controller.abort(); }
  const record = await running; records.push(record); assert.equal(record.cancelled, true);
  assert.equal(record.processGroupTerminationObserved, true);
  assert.ok(record.observedProcessGroupMembers.every((member) => ['Z', 'X'].includes(member.state)));
  const members = read(ready); assert.equal(members.parent, record.pid);
  for (const pid of Object.values(members)) assert.ok(['absent', 'Z', 'X'].includes(state(pid)), 'Owned child is still running: ' + pid);
  record.observedTerminalStates = Object.fromEntries(Object.values(members).map((pid) => [pid, state(pid)]));
});
test('cancellation before launch creates no process or evidence directory', async () => {
  const controller = new AbortController(); controller.abort('before-launch'); const directory = path.join(root, 'never-started');
  await assert.rejects(execute([process.execPath, '-e', 'process.exit(0)'], directory,
    { timeoutMs: policy.testTimeoutMs, signal: controller.signal }));
  assert.equal(fs.existsSync(directory), false);
});
test('a successful parent cannot leave a genuinely running grandchild behind', async () => {
  const ready = path.join(root, 'orphan-ready.json');
  const record = await execute([process.execPath, path.join(__dirname, 'fixtures/process-tree.cjs'), ready, 'exit-parent'],
    path.join(root, 'orphan-cleanup'), { timeoutMs: policy.abortTestTimeoutMs });
  records.push(record); assert.equal(record.exitCode, 0); assert.equal(record.leftoverProcessGroupDetected, true);
  assert.equal(record.processGroupTerminationSucceeded, true);
  assert.equal(record.processGroupTerminationObserved, true);
  const members = read(ready); assert.equal(members.parent, record.pid);
  assert.ok(['absent', 'Z', 'X'].includes(state(members.child)));
});
after(() => fs.writeFileSync(path.join(root, 'observations.json'), JSON.stringify({ node: process.version,
  records, newDOMExecuted: false, newPerformanceSamples: false, performanceAccepted: null }, null, 2) + '\n'));
