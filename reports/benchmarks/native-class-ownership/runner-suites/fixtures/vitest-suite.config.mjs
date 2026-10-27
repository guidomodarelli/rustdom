/** @file Preserves the original test projects and redirects only their cache directory. */
import settings from './suite-settings.json' with { type: 'json' };
import regular from './vitest.config.mjs';
import virtualMachine from './vitest.vm.config.mjs';
const configuration = process.env[settings.runnerEnvironment] === 'vitest-vm' ? virtualMachine : regular;
export default { ...configuration, cacheDir: process.env[settings.cacheEnvironment] };
