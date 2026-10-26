/** @file Coordinates a prospective one-shot diagnostic; capture remains disabled until the full method is registered. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const policy = require('./constants/protocol.json');
const settings = require('../constants/current-ownership.cjs');
const source = require('../shared-fixture-study/study.cjs');
const original = require('../current-ownership-experiment.cjs');
const sampler = require('../current-ownership-worker.cjs');
const { execute } = require('../jsdom-telemetry/run.cjs');
const { plan } = require('./schedule.cjs');
const { analyzeProcess } = require('./analyze.cjs');
const { annotate } = require('./worker.cjs');
const repository = path.resolve(__dirname, '../../../..');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const write = (filename, value) => fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');

/** Bind capture/replay to the actual published checkout, not merely self-declared file metadata. */
function requireSourceCheckout(sourceCommit) {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' });
  assert.equal(head.status, 0); assert.equal(head.stdout.trim(), sourceCommit, 'Native telemetry: checkout differs from the declared source commit');
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: repository, encoding: 'utf8' });
  assert.equal(status.status, 0); assert.equal(status.stdout.trim(), '', 'Native telemetry: capture/replay requires a clean published checkout');
}

/** Enumerate the generated tree without following links or permitting hidden dependency overlays. */
function derivedFileNames(directory, prefix = '') {
  const names = [];
  for (const fileEntry of fs.readdirSync(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${fileEntry.name}` : fileEntry.name;
    if (fileEntry.isDirectory()) names.push(...derivedFileNames(directory, relative));
    else {
      assert.ok(fileEntry.isFile(), 'Native telemetry: derived entries must be regular files'); names.push(relative);
    }
  }
  return names.sort();
}

/** Pin new code, its registered derivations and every reused non-frozen dependency. */
function sourceFiles() {
  const names = [...policy.methodFiles.map((name) => path.relative(repository, path.join(__dirname, name)).split(path.sep).join('/')),
    ...Object.values(policy.registeredCodeMaps), policy.workflow, policy.contractsWorkflow,
    'reports/benchmarks/native-class-ownership/jsdom-telemetry/prepare.py',
    'reports/benchmarks/native-class-ownership/jsdom-telemetry/worker.cjs',
    'reports/benchmarks/native-class-ownership/jsdom-telemetry-results/39959175058/transport.json',
    'reports/benchmarks/native-class-ownership/jsdom-telemetry-results/39959175058/tools/extract-current-ownership-result.py',
    'reports/validation/native-class-ownership/shared-fixture-worker/replay.py',
    'reports/validation/native-class-ownership/shared-fixture-worker/derived/base-preparation.json'];
  return { ...source.sourceFiles(), ...Object.fromEntries(names.map((name) => [name, hash(path.join(repository, name))])) };
}

/** A reviewed receipt binds executable/config bytes; generated metadata alone cannot redefine them. */
function verifyDerived(directory, receipt, mode) {
  directory = fs.realpathSync(directory);
  const registered = read(path.join(repository, policy.registeredCodeMaps[mode]));
  assert.equal(registered.revision, policy.revision); assert.equal(registered.mode, mode);
  assert.equal(registered.measurementExecuted, false); assert.equal(registered.captureAuthorized, false);
  assert.deepEqual(derivedFileNames(directory), [...registered.fileNames, 'preparation.json'].sort());
  assert.deepEqual(read(path.join(directory, 'preparation.json')), receipt);
  assert.equal(receipt.revision, policy.revision); assert.equal(receipt.mode, mode);
  assert.equal(receipt.captureImplemented, policy.captureImplemented); assert.equal(receipt.workerImplemented, true);
  assert.equal(receipt.measurementExecuted, false); assert.equal(receipt.performanceAccepted, null);
  assert.equal(receipt.sourceHarnessSha256, policy.sourceHarnessSha256); assert.equal(receipt.verifiedSourceFiles, 434);
  assert.equal(receipt.qualifiedSamplerSha256, policy.qualifiedSamplerSha256);
  assert.equal(receipt.samplerAfterSha256, registered.codeFiles['harness/benchmarks/worker.cjs']);
  assert.deepEqual(Object.keys(receipt.derivedFiles).sort(), registered.fileNames);
  for (const [name, expected] of Object.entries(registered.codeFiles)) assert.equal(receipt.derivedFiles[name], expected, name);
  for (const [name, expected] of Object.entries(receipt.derivedFiles)) {
    assert.ok(!path.isAbsolute(name) && !name.split(/[\\/]/).includes('..'), 'Native telemetry: unsafe derived file name');
    const filename = path.join(directory, name);
    assert.ok(fs.lstatSync(filename).isFile(), 'Native telemetry: derived entries must be regular files');
    assert.equal(fs.realpathSync(filename), filename, 'Native telemetry: derived paths must not redirect module resolution');
    assert.equal(hash(filename), expected, name);
  }
  assert.deepEqual(read(path.join(directory, 'protocol.json')), { ...policy, mode });
  return receipt;
}

/** Authenticate the original compiled packages and immutable harness without running any operation. */
function preflight(preparation) {
  const checked = source.preflight(preparation);
  assert.equal(policy.workerTimeoutMs, require('../jsdom-telemetry/constants/protocol.json').workerTimeoutMs);
  assert.equal(policy.runtimeProbeTimeoutMs, require('../shared-fixture-study/constants/protocol.json').runtimeProbeTimeoutMs);
  assert.deepEqual(policy.nodeFlagsByMode, require('../jsdom-telemetry/constants/protocol.json').nodeFlagsByMode);
  assert.equal(policy.sourceSamplerRevision, settings.revision);
  return { ...checked, revision: policy.revision, diagnosticOnly: true, performanceAccepted: null,
    captureImplemented: policy.captureImplemented, files: sourceFiles(), plannedProcesses: plan(repository).length };
}

/** Verify raw provenance before reusing the original public behavior and finite resource contract. */
function validateProcess(directory, manifest, input, observed, derivationSha256, context) {
  const report = read(path.join(directory, 'report.json'));
  const raw = read(path.join(directory, 'report.json.source.json'));
  const telemetry = read(path.join(directory, 'report.json.telemetry.json'));
  for (const [name, expected] of [['revision', policy.revision], ['purpose', policy.purpose], ['diagnosticOnly', true],
    ['accepted', null], ['gateReevaluated', false], ['complete', true], ['mode', input.mode], ['engine', input.engine],
    ['pid', observed.pid], ['node', input.node], ['derivationSha256', derivationSha256]]) assert.equal(telemetry[name], expected, name);
  assert.equal(telemetry.hostedRunId, context.hostedRunId); assert.equal(telemetry.runAttempt, 1); assert.equal(telemetry.sourceCommit, context.sourceCommit);
  assert.equal(telemetry.failures, undefined); assert.equal(telemetry.observerDisconnected, true);
  assert.deepEqual([telemetry.start?.filename, telemetry.end?.filename], policy.clockNames);
  for (const name of ['connected', 'started', 'stopped', 'disabled']) assert.equal(telemetry.profiler[name], input.mode === 'cpu', name);
  assert.equal(telemetry.profiler.disconnected, true);
  const sourceReportSha256 = hash(path.join(directory, 'report.json.source.json'));
  assert.equal(telemetry.sourceReportSha256, sourceReportSha256); assert.equal(telemetry.sourceSamplerRevision, settings.revision);
  assert.deepEqual(report, annotate(raw, policy, sourceReportSha256, telemetry.integration));
  assert.deepEqual(raw.execArgv, [...sampler.workerArguments(input.position), ...policy.nodeFlagsByMode[input.mode]]);
  original.validateWorker({ ...raw, execArgv: sampler.workerArguments(input.position) }, manifest,
    { ...input, pid: observed.pid, node: input.node });
  const reference = read(path.join(repository, 'reports/benchmarks/native-class-ownership/current-source-results/39921160254/original-verification.json'));
  const expected = reference.results.find((entry) => entry.node === input.node).summaries.AA.find((entry) => entry.key === policy.workload);
  assert.equal(raw.batches[0].outputHash, expected.outputHash);
  const fixtures = (settings.warmupSamples + settings.measuredSamples) * (1 + settings.withinRealmWarmupRounds);
  assert.deepEqual(telemetry.integration, { mutationCreated: fixtures, mutationSharedMethods: fixtures, deliveryCreated: 0, deliverySharedMethods: 0 });
  return { ...analyzeProcess(directory, { engine: input.engine, reportRevision: policy.revision, telemetryRevision: policy.revision }),
    startupRandomProbe: [...raw.randomProbe] };
}

/** Require one complete seeded engine/label group; observer modes are intentionally kept separate. */
function validateProbeGroup(entries) {
  assert.equal(entries.length, settings.engines.length * settings.labels.length);
  assert.deepEqual(new Set(entries.map((entry) => `${entry.engine}/${entry.label}`)),
    new Set(settings.engines.flatMap((engine) => settings.labels.map((label) => `${engine}/${label}`))));
  for (const entry of entries) {
    for (const name of ['node', 'mode', 'phase', 'position']) assert.equal(entry[name], entries[0][name]);
    assert.equal(entry.probe.length, settings.v8SeedProbeSamples);
    assert.deepEqual(entry.probe, entries[0].probe, 'Native telemetry: observed startup RNG differs within a fixed diagnostic group');
  }
}

/** Validate every fixed seed group, without combining CPU and JIT treatment contexts. */
function validateSeedGroups(entries) {
  const nodes = [...new Set(entries.map((entry) => entry.node))];
  assert.ok(nodes.length > 0 && nodes.every((node) => policy.nodeVersions.includes(node)));
  assert.equal(entries.length, nodes.length * policy.plannedProcessesPerNode);
  for (const node of nodes) for (const mode of policy.modes) for (const phase of settings.phases) {
    for (let position = 0; position < settings.workerCount; position++) {
      validateProbeGroup(entries.filter((entry) => entry.node === node && entry.mode === mode && entry.phase === phase && entry.position === position));
    }
  }
}

/** Recompute every per-process diagnostic with current reviewed code; archived scripts are never loaded. */
function verify(directory) {
  const index = read(path.join(directory, 'index.json'));
  assert.equal(index.revision, policy.revision); assert.equal(index.purpose, policy.purpose);
  assert.equal(index.complete, true); assert.equal(index.failure, undefined);
  assert.equal(index.diagnosticOnly, true); assert.equal(index.runAttempt, 1);
  assert.match(index.hostedRunId, /^\d+$/); assert.match(index.sourceCommit, /^[a-f0-9]{40}$/);
  requireSourceCheckout(index.sourceCommit);
  assert.equal(index.performanceAccepted, null); assert.equal(index.gateReevaluated, false);
  const reviewed = publication(); assert.deepEqual(index.sourceFiles, reviewed.files);
  assert.deepEqual(read(path.join(directory, 'publication.json')), { ...reviewed, publishedSourceCommit: index.sourceCommit });
  for (const [name, expected] of Object.entries(reviewed.files)) assert.equal(hash(path.join(directory, 'method', name)), expected);
  const harness = original.captureHarness(); assert.deepEqual(index.harness, harness);
  assert.deepEqual(index.manifest.preparationBefore, require('../constants/current-ownership-study.cjs').preparation.identity);
  assert.deepEqual(read(path.join(directory, 'manifest.json')), index.manifest);
  assert.deepEqual(read(path.join(directory, 'source-manifest.json')), { commit: index.sourceCommit, harnessSha256: harness.sha256, files: harness.files });
  assert.deepEqual(index.runtimes.map((entry) => entry.node), policy.nodeVersions);
  for (const runtime of index.runtimes) assert.equal(runtime.sha256, require('../constants/current-ownership.json').runtimeExecutableHashes[runtime.node]);
  const inputs = plan(repository); assert.equal(index.processes.length, inputs.length);
  const totals = { processes: 0, warmupSpans: 0, measuredSpans: 0, windows: 0, documents: 0, firstUnclearStates: 0,
    finalClearStates: 0, cpuProfiles: 0, jitLogs: 0 };
  const seedEntries = [];
  for (const mode of policy.modes) {
    const root = path.join(directory, `derived-${mode}`); const receipt = read(path.join(root, 'preparation.json'));
    assert.equal(hash(path.join(root, 'preparation.json')), index.derivationSha256[mode]);
    assert.equal(receipt.sourceManifestSha256, hash(path.join(directory, 'source-manifest.json')));
    verifyDerived(root, receipt, mode);
  }
  for (const [ordinal, entry] of index.processes.entries()) {
    assert.deepEqual(entry.input, inputs[ordinal]); assert.equal(entry.exitCode, 0); assert.equal(entry.signal, null); assert.equal(entry.error, null);
    assert.equal(entry.node, entry.input.node);
    const root = path.join(directory, String(ordinal).padStart(4, '0'));
    assert.deepEqual(Object.keys(entry.files).sort(), ['analysis.json', 'report.json', 'report.json.source.json', 'report.json.telemetry.json',
      'stderr.log', 'stdout.log', entry.input.mode === 'cpu' ? 'cpu.cpuprofile' : 'v8.log'].sort());
    for (const [name, expected] of Object.entries(entry.files)) {
      assert.equal(path.basename(name), name); assert.equal(hash(path.join(root, name)), expected);
    }
    const analysis = validateProcess(root, index.manifest, entry.input, entry, index.derivationSha256[entry.input.mode], index);
    assert.deepEqual(read(path.join(root, 'analysis.json')), analysis);
    seedEntries.push({ ...entry.input, probe: analysis.startupRandomProbe });
    totals.processes++; totals.warmupSpans += settings.warmupSamples; totals.measuredSpans += settings.measuredSamples;
    totals.windows += analysis.trackedOwners.window; totals.documents += analysis.trackedOwners.document;
    totals.finalClearStates += settings.requiredClearRounds;
    totals.firstUnclearStates += Number(!analysis.cleanupTrace[0].clear);
    totals.cpuProfiles += Number(entry.input.mode === 'cpu'); totals.jitLogs += Number(entry.input.mode === 'jit');
  }
  validateSeedGroups(seedEntries);
  assert.deepEqual(index.parentMemory.map((entry) => entry.stage), ['before-workers', ...policy.nodeVersions.map((node) => `after-${node}`)]);
  for (const entry of index.parentMemory) for (const name of ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers']) {
    assert.ok(Number.isFinite(entry.state[name]) && entry.state[name] >= 0);
  }
  return { revision: policy.revision, verified: true, complete: true, diagnosticOnly: true,
    sourceCommit: index.sourceCommit, hostedRunId: index.hostedRunId, runAttempt: 1,
    performanceAccepted: null, gateReevaluated: false, ...totals };
}

/** Require a published zero-finding receipt over this complete method before any capture. */
function publication() {
  const receipt = read(path.join(repository, policy.publicationReceipt));
  assert.equal(receipt.revision, policy.revision);
  assert.equal(receipt.actionableFindings, 0); assert.deepEqual(receipt.files, sourceFiles());
  return receipt;
}

/** Fixed one-shot execution; failures retain all available partials and never enter a retry path. */
function run(preparation, output, sourceCommit, nodes) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Native telemetry: capture requires the declared hosted runner');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'Native telemetry: repeated attempts are forbidden');
  assert.equal(policy.captureImplemented, true, 'Native telemetry: complete capture method is not enabled');
  const deadline = performance.now() + policy.captureBudgetMs;
  assert.match(process.env.GITHUB_RUN_ID ?? '', /^\d+$/);
  assert.equal(process.env.NATIVE_TELEMETRY_SOURCE_COMMIT, sourceCommit);
  const event = read(process.env.GITHUB_EVENT_PATH);
  assert.equal(event.action, 'labeled'); assert.equal(event.label.name, policy.label); assert.equal(event.pull_request.head.sha, sourceCommit);
  assert.equal(event.pull_request.number, policy.pullRequestNumber);
  requireSourceCheckout(sourceCommit);
  publication(); const checked = preflight(preparation); const runtimes = source.runtimeIdentities(nodes);
  output = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
  for (const input of [repository, preparation]) {
    const root = fs.realpathSync(input);
    assert.ok(output !== root && !output.startsWith(root + path.sep) && !root.startsWith(output + path.sep));
  }
  fs.mkdirSync(output);
  const index = { revision: policy.revision, purpose: policy.purpose, diagnosticOnly: true, performanceAccepted: null,
    gateReevaluated: false, complete: false, sourceCommit, hostedRunId: process.env.GITHUB_RUN_ID, runAttempt: 1,
    sourceFiles: checked.files, harness: checked.harness, manifest: checked.manifest, runtimes, derivationSha256: {},
    machine: { cpus: os.cpus(), platform: os.platform(), release: os.release(), totalMemory: os.totalmem() },
    startedAt: new Date().toISOString(), processes: [], parentMemory: [] };
  const save = () => write(path.join(output, 'index.json'), index); save();
  try {
    for (const [name, expected] of Object.entries(checked.files)) {
      const target = path.join(output, 'method', name); fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(repository, name), target); assert.equal(hash(target), expected);
    }
    write(path.join(output, 'manifest.json'), checked.manifest);
    write(path.join(output, 'publication.json'), { ...publication(), publishedSourceCommit: sourceCommit });
    write(path.join(output, 'source-manifest.json'), { commit: sourceCommit, harnessSha256: checked.harness.sha256, files: checked.harness.files });
    for (const mode of policy.modes) {
      const root = path.join(output, `derived-${mode}`);
      const derived = spawnSync('python3', ['-B', path.join(__dirname, 'prepare.py'), repository, path.join(output, 'source-manifest.json'), root, mode], { encoding: 'utf8' });
      fs.writeFileSync(path.join(output, `derive-${mode}.stdout.log`), derived.stdout ?? ''); fs.writeFileSync(path.join(output, `derive-${mode}.stderr.log`), derived.stderr ?? '');
      assert.equal(derived.status, 0, derived.stderr); verifyDerived(root, read(path.join(root, 'preparation.json')), mode);
      index.derivationSha256[mode] = hash(path.join(root, 'preparation.json')); save();
    }
    const unchanged = () => {
      assert.deepEqual(sourceFiles(), checked.files); assert.deepEqual(original.captureHarness(), checked.harness);
      assert.deepEqual(original.inspectPreparation(preparation), checked.manifest.preparationBefore);
      for (const runtime of runtimes) assert.equal(hash(runtime.executable), runtime.sha256);
      for (const mode of policy.modes) {
        const root = path.join(output, `derived-${mode}`); assert.equal(hash(path.join(root, 'preparation.json')), index.derivationSha256[mode]);
        verifyDerived(root, read(path.join(root, 'preparation.json')), mode);
      }
    };
    unchanged(); index.parentMemory.push({ stage: 'before-workers', state: process.memoryUsage() }); save();
    const inputs = plan(repository);
    for (const runtime of runtimes) {
      const seedEntries = [];
      const commands = inputs.map((input, ordinal) => ({ input, ordinal })).filter((entry) => entry.input.node === runtime.node).map(({ input, ordinal }) => ({
        input, node: input.node, directory: path.join(output, String(ordinal).padStart(4, '0')),
        argv: [runtime.executable, ...sampler.workerArguments(input.position), ...policy.nodeFlagsByMode[input.mode],
          path.join(output, `derived-${input.mode}/worker.cjs`), path.join(output, 'manifest.json'), input.phase, input.engine,
          String(input.position), input.label, path.join(output, String(ordinal).padStart(4, '0'), 'report.json'), String(input.rowIndex)] }));
      for (const command of commands) {
        assert.ok(performance.now() + policy.workerTimeoutMs < deadline, 'Native telemetry: declared capture budget exhausted; preserve the prefix without retry');
        execute([command], index, output, (entry) => {
          const analysis = validateProcess(entry.directory, index.manifest, entry.input, entry, index.derivationSha256[entry.input.mode], index);
          write(path.join(entry.directory, 'analysis.json'), analysis);
          seedEntries.push({ ...entry.input, probe: analysis.startupRandomProbe });
          if (seedEntries.length % (settings.engines.length * settings.labels.length) === 0) {
            validateProbeGroup(seedEntries.slice(-settings.engines.length * settings.labels.length));
          }
        });
      }
      validateSeedGroups(seedEntries);
      unchanged(); index.parentMemory.push({ stage: `after-${runtime.node}`, state: process.memoryUsage() }); save();
    }
    index.complete = true; save(); return verify(output);
  } catch (error) { index.complete = false; index.failure = { message: error.message, stack: error.stack }; throw error; }
  finally { index.finishedAt = new Date().toISOString(); save(); }
}
if (require.main === module) {
  try {
    const [mode, ...args] = process.argv.slice(2);
    if (mode === '--preflight') { assert.equal(args.length, 1); console.log(JSON.stringify(preflight(args[0]), null, 2)); }
    else if (mode === '--verify') { assert.equal(args.length, 1); console.log(JSON.stringify(verify(args[0]), null, 2)); }
    else { assert.equal(mode, '--capture'); assert.equal(args.length, 5); console.log(JSON.stringify(run(args[0], args[1], args[2], args.slice(3)), null, 2)); }
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { sourceFiles, preflight, publication, verifyDerived, validateProcess, validateProbeGroup, validateSeedGroups, verify, run };
