"""Exercise the real Python forwarding boundary without replacing a platform or internal dependency."""
import json
import runpy
import sys
from pathlib import Path

source = Path(__file__).resolve().parent
node, destination, receipt = sys.argv[1:]
invoke = runpy.run_path(str(source / 'export.py'))['run_invoker']
child, interrupted_by = invoke([node, str(source / 'cancellation-invoker.cjs'), destination, receipt], sys.stdout, sys.stderr)
Path(destination, 'outer-cancellation.json').write_text(json.dumps({'exitCode': child.returncode, 'interruptedBy': interrupted_by}) + '\n')
raise SystemExit(1 if interrupted_by else child.returncode)
