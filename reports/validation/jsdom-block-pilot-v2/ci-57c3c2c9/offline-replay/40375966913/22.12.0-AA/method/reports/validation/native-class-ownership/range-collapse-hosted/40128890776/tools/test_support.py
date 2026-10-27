"""Create and remove only a verified caller-owned temporary fixture directory."""
import contextlib
import json
from pathlib import Path
import shutil
import tempfile

SETTINGS = json.loads((Path(__file__).parent / 'constants/testing.json').read_text())


@contextlib.contextmanager
def owned_temporary():
    parent = Path(tempfile.gettempdir()).resolve(strict=True)
    directory = Path(tempfile.mkdtemp(prefix=SETTINGS['temporaryDirectoryPrefix'], dir=parent)).resolve(strict=True)
    try:
        yield directory
    finally:
        assert directory.resolve(strict=True) == directory and directory.parent == parent
        assert not directory.is_symlink() and not getattr(directory, 'is_junction', lambda: False)()
        assert directory.name.startswith(SETTINGS['temporaryDirectoryPrefix'])
        shutil.rmtree(directory)
