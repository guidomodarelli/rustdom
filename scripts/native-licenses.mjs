/** @file Preserves native dependency licenses and exact source-download references with binary artifacts. */
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Copy license notices from the actual locked Cargo dependency graph.
 * @param {string} destination - License directory inside the package staging area.
 * @returns {Promise<void>} Complete notices plus exact upstream source references.
 */
export async function preserveNativeLicenses(destination) {
  const result = spawnSync('cargo', ['metadata', '--locked', '--format-version=1'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Native license collection failed: ${result.stderr}`);
  const packages = JSON.parse(result.stdout).packages.filter((entry) => entry.source);
  await mkdir(destination, { recursive: true });
  const notices = ['# Native dependency notices', '',
    'These unmodified dependencies are compiled into rustdom. Exact source archives and license expressions follow.',
    'License files available in each locked crate are included alongside this notice.', ''];
  for (const entry of packages.sort((left, right) => left.name.localeCompare(right.name))) {
    const source = dirname(entry.manifest_path);
    const name = `${entry.name}-${entry.version}`;
    notices.push(`- ${name}: ${entry.license || 'See included license file'}; source: https://crates.io/api/v1/crates/${entry.name}/${entry.version}/download`);
    const licenses = (await readdir(source, { withFileTypes: true }))
      .filter((file) => file.isFile() && /^(licen[cs]e|copying|notice)(\.|-|$)/i.test(file.name));
    if (entry.license_file && !licenses.some((file) => file.name === entry.license_file)) {
      await mkdir(join(destination, name), { recursive: true });
      await copyFile(join(source, entry.license_file), join(destination, name, 'LICENSE-declared'));
    }
    if (licenses.length) await mkdir(join(destination, name), { recursive: true });
    for (const file of licenses) await copyFile(join(source, file.name), join(destination, name, file.name));
  }
  await writeFile(join(destination, 'NOTICE.md'), `${notices.join('\n')}\n`);
}
