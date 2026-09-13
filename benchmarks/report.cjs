/** @module benchmarks/report Records worker outcomes and preserves incomplete benchmark evidence. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { platform, arch } = require('node:os');
const { randomUUID } = require('node:crypto');

/**
 * Summarize raw observations using median and p95, without deleting outliers.
 * @param {number[]} values - Measured durations in milliseconds.
 * @returns {object} Sample count and distribution summaries in milliseconds.
 */
function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return { samples: sorted.length, medianMs: sorted.length % 2 ? sorted[middle] :
    (sorted[middle - 1] + sorted[middle]) / 2,
  p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], minMs: sorted[0], maxMs: sorted.at(-1) };
}

/**
 * Owns one bounded benchmark report from worker results through durable summaries.
 * Raw process output is retained for diagnostics only and released with this instance.
 */
class BenchmarkReport {
  /**
   * Initialize a report without executing workers or touching the filesystem.
   * @param {object} report - Metadata, completed runs and comparisons for one invocation.
   * @param {string} outputDirectory - Destination for timestamped benchmark artifacts.
   */
  constructor(report, outputDirectory) {
    this.report = report;
    this.outputDirectory = outputDirectory;
    this.processes = [];
  }

  /**
   * Record a real worker result, preserving its output before parsing or rejecting it.
   * @param {import('node:child_process').SpawnSyncReturns<string>} child - Worker outcome.
   * @param {object} context - Engine, process index, elapsed milliseconds and timeout budget.
   * @returns {void} Appends a parsed run on success.
   * @throws {Error} When execution or JSON parsing fails, with the original cause and diagnostic path.
   */
  recordWorker(child, context) {
    const outcome = { ...context, exitCode: child.status, signal: child.signal,
      error: child.error ? { code: child.error.code, message: child.error.message } : null,
      stdout: child.stdout, stderr: child.stderr };
    this.processes.push(outcome);
    let stage = 'worker-execution';
    try {
      if (child.error || child.status !== 0) throw child.error ?? new Error(child.stderr);
      stage = 'worker-json';
      this.report.runs.push(JSON.parse(child.stdout));
    } catch (error) {
      this.fail(error, { ...outcome, stage });
    }
  }

  /**
   * Compare outputs, summarize samples and persist complete JSON/Markdown artifacts.
   * @returns {{jsonPath: string, table: string[]}} Durable JSON path and printable comparison table.
   * @throws {Error} When aggregation, rendering or persistence fails, preserving available evidence.
   */
  finish() {
    const report = this.report;
    const outputDirectory = this.outputDirectory;
    let context = { stage: 'output-comparison' };
    try {
      for (const workload of report.runs[0].workloads) {
        context = { stage: 'output-comparison', workload: workload.name, rows: workload.rows };
        const engines = {};
        const hashes = report.runs.map((run) => run.workloads.find((entry) => entry.name === workload.name && entry.rows === workload.rows).outputHash);
        assert.ok(hashes.every((hash) => hash === hashes[0]), `Benchmark output mismatch: ${workload.name}/${workload.rows}`);
        context.stage = 'sample-summary';
        for (const engine of ['jsdom', 'rustdom']) {
          const values = report.runs.filter((run) => run.engine === engine).flatMap((run) =>
            run.workloads.find((entry) => entry.name === workload.name && entry.rows === workload.rows).samplesMs);
          engines[engine] = summarize(values);
        }
        report.comparisons.push({ workload: workload.name, rows: workload.rows, ...engines,
          speedup: engines.jsdom.medianMs / engines.rustdom.medianMs });
      }
      context = { stage: 'summary-render' };
      const table = ['| Operación | Filas | jsdom mediana (ms) | rustdom mediana (ms) | Ratio |',
        '|---|---:|---:|---:|---:|', ...report.comparisons.map((entry) =>
          `| ${entry.workload} | ${entry.rows} | ${entry.jsdom.medianMs.toFixed(3)} | ${entry.rustdom.medianMs.toFixed(3)} | ${entry.speedup.toFixed(2)}x |`)];
      const markdown = `# Benchmark ${report.capturedAt}\n\n` +
        `Node ${report.node}; jsdom ${report.jsdom}; ${report.machine.cpu}; ${report.machine.release}.\n\n` +
        table.join('\n') + '\n\nRatio = mediana jsdom / mediana rustdom. Mayor que 1 favorece rustdom.\n' +
        '\nCada fila contiene 18 muestras en dos procesos por motor, con tres warmups por proceso.\n' +
        'Se excluyen carga de módulos, preparación, validación y limpieza. La memoria guardada en JSON es posterior a GC; no es memoria pico.\n' +
        'Los documentos con scripts usan el parser original. Árbol, consultas compatibles y serialización HTML ejecutan Rust; wrappers y Web APIs reutilizan jsdom.\n';
      context = { stage: 'report-write' };
      mkdirSync(outputDirectory, { recursive: true });
      const basename = `${new Date().toISOString().replaceAll(':', '-')}-${platform()}-${arch()}`;
      const jsonPath = `${outputDirectory}/${basename}.json`;
      writeFileSync(`${outputDirectory}/${basename}.md`, markdown);
      // Completion is published only after comparison and summary rendering succeeded.
      writeFileSync(jsonPath, `${JSON.stringify({ ...report, complete: true }, null, 2)}\n`);
      report.complete = true;
      return { jsonPath, table };
    } catch (error) {
      this.fail(error, context);
    }
  }

  /**
   * Save all available evidence before propagating a failed report stage.
   * @param {Error} error - Original failure, retained as the thrown error's cause.
   * @param {object} context - Stage and optional worker/workload coordinates.
   * @returns {never} Always throws after attempting diagnostic persistence.
   * @throws {Error} Includes the diagnostic path or both original and persistence failures.
   */
  fail(error, context) {
    const report = this.report;
    report.complete = false;
    report.processes = this.processes;
    report.failure = { ...context, cause: { name: error.name, code: error.code, message: error.message } };
    const failurePath = `${this.outputDirectory}/${new Date().toISOString().replaceAll(':', '-')}-${platform()}-${arch()}-${randomUUID()}-failed.json`;
    try {
      mkdirSync(this.outputDirectory, { recursive: true });
      writeFileSync(failurePath, `${JSON.stringify(report, null, 2)}\n`);
    } catch (diagnosticError) {
      throw new AggregateError([error, diagnosticError],
        `Benchmark ${context.stage} failed; diagnostic could not be saved: ${failurePath}`, { cause: error });
    }
    throw new Error(`Benchmark ${context.stage} failed` +
      (context.engine ? ` for ${context.engine} process ${context.processIndex}; budget ${context.timeoutMs} ms` : '') +
      `; diagnostic: ${failurePath}`, { cause: error });
  }
}

module.exports = { BenchmarkReport };
