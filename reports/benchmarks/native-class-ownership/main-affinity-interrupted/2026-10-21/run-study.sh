set -eu
cache=/mnt/c/Users/guido/ghq/projects/rustdom/.cache
test ! -e "$cache/main-affinity-study-root.txt"
study=$(mktemp -d /home/guido/rustdom-main-affinity-study-XXXXXX)
(set -C; printf '%s\n' "$study" > "$cache/main-affinity-study-root.txt")
cd /mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom
date -u +%FT%TZ > "$study/started-at.txt"
for runtime in node-22 node; do
  executable=/mnt/c/Users/guido/ghq/projects/rustdom/.tools/$runtime/bin/node
  if "$executable" reports/benchmarks/native-class-ownership/main-affinity-experiment.cjs \
    /home/guido/rustdom-native-class-NMmiki /home/guido/rustdom-checkpoint67-reference-0N9EG6 \
    "$study/$runtime" > "$study/$runtime.driver.log" 2>&1; then
    status=0
  else
    status=$?
  fi
  printf '%s\n' "$status" > "$study/$runtime.exit-code.txt"
  printf 'Completed %s exit %s\n' "$runtime" "$status"
  tail -n 8 "$study/$runtime.driver.log"
done
date -u +%FT%TZ > "$study/finished-at.txt"
printf 'Both fixed sequences ended; inspect %s\n' "$study"