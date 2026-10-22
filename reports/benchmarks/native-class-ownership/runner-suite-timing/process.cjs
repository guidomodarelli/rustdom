/** @file Times real child execution and preserves resource reports and failed outputs. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const settings = require('./constants/study.json');

/** Keep the measured launcher and its replay contract identical. */
function launcherArgv(command) {
  return [settings.timeExecutable, '--quiet', '--format', settings.resourceFormat,
    '--output', path.posix.join(command.directory, 'resources.json'), ...command.argv];
}

/** Record one whole CLI, keeping bookkeeping and JSON interpretation outside its clock. */
function execute(command, index, save) {
  fs.mkdirSync(command.directory, { recursive: true });
  const entry = { selection: command.selection, argv: command.argv, cwd: command.cwd,
    directory: command.directory, startedAt: new Date().toISOString(), complete: false };
  index.processes.push(entry); save();
  const resources = path.join(command.directory, 'resources.json');
  const argv = launcherArgv(command);
  entry.launcherArgv = argv;
  let stdout; let stderr; let result;
  try {
    stdout = fs.openSync(path.join(command.directory, 'suite.stdout.log'), 'wx');
    stderr = fs.openSync(path.join(command.directory, 'suite.stderr.log'), 'wx');
    const start = process.hrtime.bigint();
    result = spawnSync(argv[0], argv.slice(1), { cwd: command.cwd, stdio: ['ignore', stdout, stderr],
      env: { ...process.env, PATH: `${path.dirname(command.argv[0])}${path.delimiter}${process.env.PATH ?? ''}`,
        CI: '1', FORCE_COLOR: '0', LC_ALL: 'C', ...command.environment } });
    entry.elapsedNs = String(process.hrtime.bigint() - start);
    entry.elapsedMs = Number(entry.elapsedNs) / 1e6;
  } finally {
    if (stdout !== undefined) fs.closeSync(stdout);
    if (stderr !== undefined) fs.closeSync(stderr);
  }
  Object.assign(entry, { launcherPid: result.pid, exitCode: result.status, signal: result.signal, finishedAt: new Date().toISOString() });
  if (result.error) entry.spawnError = { message: result.error.message, code: result.error.code };
  const timing = Object.fromEntries([...settings.timingFields, 'spawnError'].filter((name) => Object.hasOwn(entry, name)).map((name) => [name, entry[name]]));
  fs.writeFileSync(path.join(command.directory, 'timing.json'), `${JSON.stringify(timing, null, 2)}\n`, { flag: 'wx' });
  save();
  if (result.error || result.status !== 0) throw new Error(`Suite timing: process failed, exit=${result.status}, signal=${result.signal}; ${command.directory}`, { cause: result.error });
  entry.resources = JSON.parse(fs.readFileSync(resources, 'utf8'));
  if (entry.resources.exitStatus !== 0 || !(entry.resources.maxRssKiB > 0)) throw new Error(`Suite timing: invalid resource outcome in ${resources}`);
  save();
  return entry;
}

/** Stop on process or inspection failure; never retry or launch a later selection. */
function runCommands(commands, index, save, inspect) {
  for (const command of commands) {
    const entry = execute(command, index, save);
    entry.result = inspect(entry); entry.complete = true; save();
  }
}
module.exports = { launcherArgv, execute, runCommands };
