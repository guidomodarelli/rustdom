set -eu
cache=/mnt/c/Users/guido/ghq/projects/rustdom/.cache
test ! -e "$cache/main-affinity-v2-study-root.txt"
cd /mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom
python3 - <<'PY'
import pathlib,json,re,hashlib
cache=pathlib.Path('/mnt/c/Users/guido/ghq/projects/rustdom/.cache')
proof=json.loads((cache/'main-affinity-v2-preflight-2c92c82d.json').read_text())
receipt=json.loads((cache/'main-affinity-v2-clean-review-6325872955.json').read_text())
assert receipt['user']['login']=='chatgpt-codex-connector[bot]'
assert "Didn't find any major issues" in receipt['body']
reviewed=re.search(r'Reviewed commit:\*\* `([0-9a-f]+)`',receipt['body']).group(1)
assert proof['methodCommit'].startswith(reviewed)
base=pathlib.Path('reports/benchmarks/native-class-ownership')
for file in proof['methods']:
    data=(base/file['path']).read_bytes()
    assert len(data)==file['bytes'] and hashlib.sha256(data).hexdigest()==file['sha256'],file['path']
print(json.dumps({'cleanReviewReceipt':receipt['id'],'methodSourcesVerified':len(proof['methods']),'methodHead':proof['methodCommit']}))
PY
study=$(mktemp -d /home/guido/rustdom-main-affinity-v2-study-XXXXXX)
(set -C; printf '%s\n' "$study" > "$cache/main-affinity-v2-study-root.txt")
cp "$cache/main-affinity-v2-preflight-2c92c82d.json" "$study/before-performance.json"
cp "$cache/main-affinity-v2-clean-review-6325872955.json" "$study/clean-review.json"
cp "$cache/run-main-affinity-v2-study.sh" "$study/run-study.sh"
date -u +%FT%TZ > "$study/started-at.txt"
all_accepted=1
for runtime in node-22 node; do
  executable=/mnt/c/Users/guido/ghq/projects/rustdom/.tools/$runtime/bin/node
  if "$executable" reports/benchmarks/native-class-ownership/main-affinity-experiment.cjs \
    /home/guido/rustdom-native-class-NMmiki /home/guido/rustdom-checkpoint67-reference-0N9EG6 \
    "$study/$runtime" > "$study/$runtime.driver.log" 2>&1; then
    runtime_exit=0
  else
    runtime_exit=$?
    all_accepted=0
  fi
  printf '%s\n' "$runtime_exit" > "$study/$runtime.exit-code.txt"
  printf 'Completed %s exit %s\n' "$runtime" "$runtime_exit"
  tail -n 8 "$study/$runtime.driver.log"
done
date -u +%FT%TZ > "$study/finished-at.txt"
printf 'Both fixed sequences ended; inspect %s\n' "$study"
if [ "$all_accepted" -ne 1 ]; then exit 1; fi