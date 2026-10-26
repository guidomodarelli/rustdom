"""Execute only independently pinned source bytes; never consult project bytecode caches."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
from types import ModuleType

if sys.flags.optimize:
    raise RuntimeError('Evidence source loading requires non-optimized Python')


def load(root, pins):
    """Authenticate the entire declared code/policy/lock closure before executing its first module.

    The caller must fix both byte sizes and hashes in its reviewed bootstrap.
    It must authenticate this loader's own bytes before compiling this function.
    Policy files are checked before imports and checked again after evaluation.
    """
    root = Path(root)
    if root.is_symlink() or not root.is_dir() or not isinstance(pins,dict) or not pins:
        raise ValueError('Evidence loader requires a physical root and independently fixed pins')
    raw_files = {}
    for relative,pin in pins.items():
        path = PurePosixPath(relative)
        if (path.is_absolute() or path.as_posix() != relative or '\\' in relative
                or any(part in ['', '.', '..'] for part in relative.split('/'))
                or not isinstance(pin,dict) or set(pin) != {'bytes','sha256'}
                or type(pin['bytes']) is not int or pin['bytes'] <= 0
                or not isinstance(pin['sha256'],str) or len(pin['sha256']) != 64
                or any(character not in '0123456789abcdef' for character in pin['sha256'])):
            raise ValueError('Evidence loader pin is not canonical')
        filename = root.joinpath(*path.parts)
        if any(parent.is_symlink() for parent in [filename,*filename.parents]):
            raise ValueError('Evidence loader refuses linked sources or ancestors')
        if filename.stat().st_size != pin['bytes']:
            raise ValueError('Evidence loader source byte count differs: '+relative)
        with filename.open('rb') as reader:
            raw = reader.read(pin['bytes']+1)
        if len(raw) != pin['bytes'] or hashlib.sha256(raw).hexdigest() != pin['sha256']:
            raise ValueError('Evidence loader source digest differs: '+relative)
        raw_files[relative] = raw
    policy = json.loads(raw_files['constants/loader.json'])
    required = set(policy['requiredFiles'])
    optional = set(policy['optionalFiles']) & set(pins)
    if set(pins) != required|optional:
        raise ValueError('Evidence loader pin closure is incomplete or contains undeclared files')
    names = [name for name in policy['moduleOrder'] if name+'.py' in raw_files]
    if any(name in sys.modules for name in names):
        raise ValueError('Evidence loader requires a dedicated process with no preloaded transport aliases')
    modules = {}
    try:
        for name in names:
            filename = root/(name+'.py')
            module = ModuleType(name)
            module.__file__ = str(filename)
            module.__package__ = ''
            sys.modules[name] = module
            modules[name] = module
            exec(compile(raw_files[name+'.py'],str(filename),'exec'),module.__dict__)
        for relative,pin in pins.items():
            if hashlib.sha256((root/relative).read_bytes()).hexdigest() != pin['sha256']:
                raise ValueError('Evidence loader dependency changed during evaluation: '+relative)
    except BaseException:
        for name,module in modules.items():
            if sys.modules.get(name) is module:
                del sys.modules[name]
        raise
    return modules
