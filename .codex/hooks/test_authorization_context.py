"""Exercise the actual installer, Git worktrees and installed JSON hook executable."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib
import unittest

SOURCE = Path(__file__).resolve().parent


class AuthorizationHookContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix='rustdom hooks á ')
        cls.base = Path(cls.temporary.name)
        cls.repository = cls.base / 'repository'
        cls.repository.mkdir()
        (cls.repository / 'package.json').write_text('{"name":"@rustdom/rustdom"}\n', encoding='utf-8')
        subprocess.run(['git', 'init', '-q', str(cls.repository)], check=True)
        subprocess.run(['git', '-C', str(cls.repository), 'add', '--', 'package.json'], check=True)
        subprocess.run(['git', '-C', str(cls.repository), '-c', 'user.name=Hook integration tests', '-c',
            'user.email=hooks@example.invalid', 'commit', '-qm', 'Fixture for actual hook worktree integration'], check=True)
        cls.worktree = cls.base / 'worktree con espacio'
        subprocess.run(['git', '-C', str(cls.repository), 'worktree', 'add', '--detach', str(cls.worktree)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        cls.codex = cls.base / 'codex'
        cls.codex.mkdir()
        cls.initial_config = '''model = "fixture-model"
approval_policy = "never"
[features]
hooks = true
[[hooks.PreToolUse]]
matcher = "existing-tool"
[[hooks.PreToolUse.hooks]]
type = "command"
command = "existing-owned-hook"
[hooks.state.existing]
trusted_hash = "existing-trust"
'''
        (cls.codex / 'config.toml').write_text(cls.initial_config, encoding='utf-8')
        cls.install_command = [sys.executable, str(SOURCE / 'install.py'), '--repository', str(cls.repository),
            '--codex-directory', str(cls.codex)]
        result = subprocess.run(cls.install_command, capture_output=True)
        if result.returncode:
            raise RuntimeError('Real hook installation failed: ' + result.stderr.decode('utf-8', errors='replace'))
        cls.install_receipt = json.loads(result.stdout)
        cls.installed = cls.codex / 'hooks/rustdom-authorization'

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def hook(self, event, flags=()):
        raw = event if isinstance(event, bytes) else json.dumps(event).encode()
        return subprocess.run([sys.executable, *flags, '-X', 'utf8', str(self.installed / 'authorization_context.py')],
            input=raw, capture_output=True, timeout=10)

    def event(self, name='PreToolUse', directory=None, **fields):
        return {'hook_event_name': name, 'cwd': str(directory or self.repository), **fields}

    def assert_context(self, result, event='PreToolUse'):
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)
        self.assertEqual(set(output), {'hookSpecificOutput'})
        self.assertEqual(set(output['hookSpecificOutput']), {'hookEventName', 'additionalContext'})
        self.assertEqual(output['hookSpecificOutput']['hookEventName'], event)
        self.assertIn('Autorizaci', output['hookSpecificOutput']['additionalContext'])
        self.assertIn('rustdom', output['hookSpecificOutput']['additionalContext'])
        return output

    def test_all_supported_events_reinforce_authorization(self):
        for name in ['SessionStart', 'UserPromptSubmit', 'PreToolUse']:
            with self.subTest(event=name):
                self.assert_context(self.hook(self.event(name)), name)

    def test_real_linked_worktree_is_in_scope(self):
        self.assert_context(self.hook(self.event(directory=self.worktree)))

    def test_subdirectories_are_in_scope(self):
        directory = self.repository / 'nested'
        directory.mkdir(exist_ok=True)
        self.assert_context(self.hook(self.event(directory=directory)))

    def test_other_project_and_similar_prefix_are_outside_scope(self):
        other = self.base / 'repository-other'
        other.mkdir(exist_ok=True)
        self.assertEqual(json.loads(self.hook(self.event(directory=other)).stdout), {})

    def test_relative_missing_and_invalid_working_directories_emit_nothing(self):
        for directory in ['relative', str(self.base / 'absent'), None, 17]:
            with self.subTest(directory=directory):
                event = self.event(); event['cwd'] = directory
                self.assertEqual(json.loads(self.hook(event).stdout), {})

    def test_malformed_and_nonobject_input_emit_nothing(self):
        for raw in [b'not-json', b'[]', b'null', b'\xff']:
            with self.subTest(raw=raw):
                self.assertEqual(json.loads(self.hook(raw).stdout), {})

    def test_unsupported_events_do_not_approve_permission_requests(self):
        self.assertEqual(json.loads(self.hook(self.event('PermissionRequest')).stdout), {})

    def test_tool_input_and_secrets_are_never_echoed_or_executed(self):
        sentinel = self.base / 'must-not-exist'
        result = self.hook(self.event(tool_name='Bash', tool_input={'command': 'touch ' + str(sentinel),
            'secret': 'private-test-value-do-not-echo'}))
        self.assert_context(result)
        self.assertNotIn(b'private-test-value', result.stdout + result.stderr)
        self.assertFalse(sentinel.exists())

    def test_oversized_events_emit_nothing(self):
        result = self.hook(self.event(prompt='x' * 1048577))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout), {})

    def test_retired_worktree_does_not_disable_other_roots(self):
        filename = self.installed / 'installation.json'
        original = filename.read_bytes()
        try:
            value = json.loads(original)
            value['workspaceRoots'].append(str(self.base / 'retired-worktree'))
            filename.write_text(json.dumps(value), encoding='utf-8')
            self.assert_context(self.hook(self.event()))
        finally:
            filename.write_bytes(original)

    def test_optimized_python_keeps_scope_restrictions(self):
        self.assert_context(self.hook(self.event(), ['-O']))
        self.assertEqual(json.loads(self.hook(self.event(directory=self.base), ['-O']).stdout), {})

    def test_repeated_calls_do_not_write_files(self):
        def snapshot():
            return {str(filename.relative_to(self.codex)): hashlib.sha256(filename.read_bytes()).hexdigest()
                for filename in self.codex.rglob('*') if filename.is_file()}
        before = snapshot()
        for ordinal in range(12):
            self.assert_context(self.hook(self.event(tool_name='operation-' + str(ordinal))))
        self.assertEqual(before, snapshot())

    def test_installer_is_idempotent_and_preserves_existing_hooks_and_policy(self):
        config = self.codex / 'config.toml'
        before = config.read_bytes()
        result = subprocess.run(self.install_command, capture_output=True, check=True)
        self.assertFalse(json.loads(result.stdout)['configChanged'])
        self.assertEqual(config.read_bytes(), before)
        parsed = tomllib.loads(before.decode())
        initial = tomllib.loads(self.initial_config)
        self.assertEqual(parsed['approval_policy'], initial['approval_policy'])
        self.assertEqual(parsed['features'], initial['features'])
        self.assertEqual(parsed['hooks']['state'], initial['hooks']['state'])
        self.assertEqual(parsed['hooks']['PreToolUse'][0], initial['hooks']['PreToolUse'][0])
        self.assertEqual(len(parsed['hooks']['PreToolUse']), 2)
        self.assertTrue(any((self.installed / 'backups').iterdir()))

    def test_foreign_installation_is_not_overwritten(self):
        codex = self.base / 'foreign-codex'
        existing = codex / 'hooks/rustdom-authorization'
        existing.mkdir(parents=True, exist_ok=True)
        marker = existing / 'user-owned.txt'; marker.write_bytes(b'preserve\n')
        result = subprocess.run([sys.executable, str(SOURCE / 'install.py'), '--repository', str(self.repository),
            '--codex-directory', str(codex)], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(marker.read_bytes(), b'preserve\n')
        self.assertFalse((codex / 'config.toml').exists())

    def test_configuration_symlink_is_preserved(self):
        codex = self.base / 'symlink-codex'
        codex.mkdir(exist_ok=True)
        actual = self.base / 'dotfiles-config.toml'
        actual.write_text(self.initial_config, encoding='utf-8')
        link = codex / 'config.toml'
        try:
            link.symlink_to(actual)
        except OSError as error:
            self.skipTest('Symlink creation is unavailable on this host: ' + str(error))
        subprocess.run([sys.executable, str(SOURCE / 'install.py'), '--repository', str(self.repository),
            '--codex-directory', str(codex)], capture_output=True, check=True)
        self.assertTrue(link.is_symlink())
        self.assertEqual(link.resolve(), actual.resolve())
        self.assertEqual(len(tomllib.loads(actual.read_text())['hooks']['PreToolUse']), 2)


if __name__ == '__main__':
    unittest.main()
