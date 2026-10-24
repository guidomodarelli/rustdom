import json, os, pathlib, subprocess, time

repo = pathlib.Path(__file__).resolve().parent.parent
output = repo / 'reports/validation/wpt-ci-isolation'
output.mkdir(exist_ok=False)
tools = pathlib.Path('C:/Users/guido/ghq/projects/rustdom/.tools/node-win')
nodes = {'node-22': tools / 'node-v22.12.0-win-x64/node.exe',
         'node-24': tools / 'node-v24.22.1-win-x64/node.exe'}
commands = [
    ('node-22-diagnostics', nodes['node-22'], ['--test', 'tests/wpt-diagnostics.spec.cjs']),
    ('node-22-wpt', nodes['node-22'], ['--test', 'tests/wpt/fixture-process.spec.cjs']),
    ('node-24-compat', nodes['node-24'],
     [str(nodes['node-24'].parent / 'node_modules/npm/bin/npm-cli.js'), 'run', 'test:compat']),
]
for label, node, arguments in commands:
    environment = dict(os.environ)
    environment['PATH'] = str(node.parent) + os.pathsep + environment['PATH']
    command = [str(node), *arguments]
    record = {'command': command, 'cwd': str(repo), 'startedAt': time.time()}
    with (output / f'{label}.stdout.log').open('xb') as stdout, (output / f'{label}.stderr.log').open('xb') as stderr:
        child = subprocess.Popen(command, cwd=repo, env=environment, stdout=stdout, stderr=stderr)
        record['pid'] = child.pid
        (output / f'{label}.process.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
        print(f'START {label} pid={child.pid}', flush=True)
        record['exitCode'] = child.wait()
    record['finishedAt'] = time.time()
    (output / f'{label}.process.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    print(f'END {label} exit={record["exitCode"]}', flush=True)
    if record['exitCode'] != 0:
        raise SystemExit(record['exitCode'])
