/** @file Runs one real validation process and preserves output, exit status, signal and startup errors. */
import { spawn } from 'node:child_process';

/**
 * Execute a gate without turning abnormal termination into an ambiguous exit code.
 * @param {string} command - Executable passed directly to Node's process API.
 * @param {string[]} args - Arguments, without shell interpolation.
 * @returns {Promise<{exitCode: number|null, signal: string|null, spawnError: object|null, output: string}>} Complete observed outcome.
 */
export async function runValidationProcess(command, args) {
  let output = '';
  let spawnError = null;
  const outcome = await new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { stdio: ['inherit', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ exitCode: null, signal: null, spawnError: { name: error.name, code: error.code, message: error.message } });
      return;
    }
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (data) => { output += data; process.stdout.write(data); });
    child.stderr.on('data', (data) => { output += data; process.stderr.write(data); });
    child.once('error', (error) => { spawnError = { name: error.name, code: error.code, message: error.message }; });
    child.once('close', (exitCode, signal) => resolve({ exitCode, signal, spawnError }));
  });
  return { ...outcome, output };
}
