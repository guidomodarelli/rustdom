"""Install scoped context hooks using ordinary user configuration, preserving existing hooks."""
import argparse
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib

def atomic_write(filename, content):
    """Replace an owned file only after its complete replacement has been written."""
    temporary = filename.with_name(filename.name + '.rustdom-' + str(os.getpid()) + '.tmp')
    with temporary.open('xb') as target:
        target.write(content)
    temporary.replace(filename)


def install(repository, codex_directory):
    """Install project-scoped context and merge only this installer's named config block."""
    repository = repository.resolve(strict=True)
    package = json.loads((repository / 'package.json').read_text(encoding='utf-8'))
    source = Path(__file__).resolve().parent
    policy = json.loads((source / 'constants/authorization.json').read_text(encoding='utf-8'))
    begin_marker = policy['configBlockMarkers']['begin']
    end_marker = policy['configBlockMarkers']['end']
    if package.get('name') != policy['packageName']:
        raise ValueError('rustdom-authorization: installer requires the rustdom repository')
    listing = subprocess.check_output(['git', '-c', 'core.quotePath=false', '-C', str(repository),
        'worktree', 'list', '--porcelain'], encoding='utf-8')
    roots = set()
    for line in listing.splitlines():
        if line.startswith('worktree '):
            name = line.removeprefix('worktree ')
            if name.startswith('"'):
                name = ast.literal_eval(name)
            directory = Path(name)
            if directory.is_dir():
                roots.add(str(directory.resolve(strict=True)))
    workspace_roots = sorted(roots)
    if str(repository) not in workspace_roots:
        raise ValueError('rustdom-authorization: source is not a registered worktree')
    codex_directory = codex_directory.expanduser().resolve()
    installed = codex_directory / 'hooks' / 'rustdom-authorization'
    config = (codex_directory / 'config.toml').resolve()
    before = config.read_bytes() if config.exists() else b''
    text = before.decode('utf-8-sig')
    parsed = tomllib.loads(text)
    if installed.exists():
        if not (installed / 'installation.json').is_file():
            raise ValueError('rustdom-authorization: existing installation is not owned by this installer')
        existing = json.loads((installed / 'installation.json').read_text(encoding='utf-8'))
        if existing.get('installationId') != policy['installationId']:
            raise ValueError('rustdom-authorization: existing installation is not owned by this installer')
    command_arguments = [sys.executable, '-X', 'utf8', str(installed / 'authorization_context.py')]
    command = subprocess.list2cmdline(command_arguments) if os.name == 'nt' else shlex.join(command_arguments)
    lines = [begin_marker]
    for event in policy['events']:
        lines += [f'[[hooks.{event}]]', 'matcher = "*"', f'[[hooks.{event}.hooks]]',
            'type = "command"', 'command = ' + json.dumps(command, ensure_ascii=False),
            'commandWindows = ' + json.dumps(command, ensure_ascii=False),
            'timeout = ' + str(policy['hookTimeoutSeconds']), 'statusMessage = "Autorización de rustdom registrada"', '']
    lines.append(end_marker)
    block = '\n'.join(lines)
    if begin_marker in text or end_marker in text:
        if text.count(begin_marker) != 1 or text.count(end_marker) != 1:
            raise ValueError('rustdom-authorization: ambiguous owned configuration markers')
        start = text.index(begin_marker); end = text.index(end_marker) + len(end_marker)
        if end < start:
            raise ValueError('rustdom-authorization: reversed owned configuration markers')
        updated = text[:start] + block + text[end:]
    else:
        updated = text + ('\n\n' if text and not text.endswith('\n\n') else '') + block + '\n'
    after = tomllib.loads(updated)
    # This installer adds context handlers only. Other hooks, policy and trust state remain intact.
    for key, value in parsed.items():
        if key != 'hooks' and after.get(key) != value:
            raise ValueError('rustdom-authorization: unrelated configuration would change')
    for key, value in parsed.get('hooks', {}).items():
        if key not in policy['events'] and after['hooks'].get(key) != value:
            raise ValueError('rustdom-authorization: unrelated hook configuration would change')
    installed.mkdir(parents=True, exist_ok=True)
    (installed / 'constants').mkdir(exist_ok=True)
    backups = installed / 'backups'; backups.mkdir(exist_ok=True)
    changed = before != updated.encode('utf-8')
    if changed and before:
        backup = backups / ('config-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.toml')
        with backup.open('xb') as target:
            target.write(before)
    settings = {'installationId': policy['installationId'], 'workspaceRoots': workspace_roots}
    atomic_write(installed / 'authorization_context.py', (source / 'authorization_context.py').read_bytes())
    atomic_write(installed / 'constants/authorization.json', (source / 'constants/authorization.json').read_bytes())
    atomic_write(installed / 'installation.json', (json.dumps(settings, indent=2) + '\n').encode())
    if (config.read_bytes() if config.exists() else b'') != before:
        raise RuntimeError('rustdom-authorization: configuration changed concurrently; retry installation from the current config')
    if changed:
        atomic_write(config, updated.encode('utf-8'))
    return {'installed': True, 'installationDirectory': str(installed), 'workspaceRoots': len(workspace_roots),
        'events': policy['events'], 'configChanged': changed, 'hookTrustModified': False,
        'contextScriptSha256': hashlib.sha256((installed / 'authorization_context.py').read_bytes()).hexdigest()}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repository', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--codex-directory', type=Path, default=Path(os.environ.get('CODEX_HOME') or Path.home() / '.codex'))
    arguments = parser.parse_args()
    print(json.dumps(install(arguments.repository, arguments.codex_directory)))
