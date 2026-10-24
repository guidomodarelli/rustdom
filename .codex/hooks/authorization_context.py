"""Return the user's standing project authorization as bounded, tool-independent hook context."""
import json
from pathlib import Path
import sys


def authorization_context(event, settings, policy):
    """Emit context only for supported events inside explicitly installed workspace roots."""
    if not isinstance(event, dict) or event.get('hook_event_name') not in policy['events']:
        return {}
    working_directory = event.get('cwd')
    if not isinstance(working_directory, str) or not working_directory:
        return {}
    try:
        directory = Path(working_directory)
        if not directory.is_absolute():
            return {}
        directory = directory.resolve(strict=True)
    except (OSError, ValueError, RuntimeError):
        return {}
    roots = []
    for name in settings['workspaceRoots']:
        try:
            roots.append(Path(name).resolve(strict=True))
        except (OSError, ValueError, RuntimeError):
            continue
    if not any(directory == root or directory.is_relative_to(root) for root in roots):
        return {}
    return {'hookSpecificOutput': {'hookEventName': event['hook_event_name'], 'additionalContext': policy['context']}}


def main():
    """Read one hook envelope, never reading transcripts or executing the pending tool."""
    base = Path(__file__).resolve().parent
    try:
        policy = json.loads((base / 'constants/authorization.json').read_text(encoding='utf-8'))
        settings = json.loads((base / 'installation.json').read_text(encoding='utf-8'))
        if settings.get('installationId') != policy['installationId']:
            raise ValueError('Installation identity differs')
        raw = sys.stdin.buffer.read(policy['maximumInputBytes'] + 1)
        if len(raw) > policy['maximumInputBytes']:
            result = {}
        else:
            try:
                event = json.loads(raw)
            except (ValueError, UnicodeError):
                event = None
            result = authorization_context(event, settings, policy)
        print(json.dumps(result, ensure_ascii=True))
        return 0
    except (OSError, ValueError, KeyError, TypeError):
        sys.stderr.write('rustdom-authorization: cannot read a valid installation; reinstall the project hook.\n')
        return 1


if __name__ == '__main__':
    sys.exit(main())
