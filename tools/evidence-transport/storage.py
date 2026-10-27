"""Admit bounded transport copies using current filesystem and Linux memory observations."""
import json
from pathlib import Path
import shutil

POLICY = json.loads((Path(__file__).resolve().parent/'constants/coordinator.json').read_bytes())


def require_capacity(directory, bytes_to_add):
    """This is an operational admission snapshot, not a peak-memory measurement or science budget."""
    if type(bytes_to_add) is not int or bytes_to_add < 0:
        raise ValueError('Artifact storage admission requires a non-negative byte count')
    free = shutil.disk_usage(directory).free
    available = None
    for line in Path('/proc/meminfo').read_text().splitlines():
        name,_,value = line.partition(':')
        if name == 'MemAvailable':
            available = int(value.split()[0])*1024
    if available is None or min(free,available) < bytes_to_add+POLICY['storageSafetyReserveBytes']:
        raise OSError('Insufficient current storage/RAM for this artifact operation; existing originals retained')
    return {'filesystemFreeBytes':free,'memoryAvailableBytes':available,'additionalBytes':bytes_to_add,
        'reserveBytes':POLICY['storageSafetyReserveBytes'],'peakMemoryMeasured':False}
