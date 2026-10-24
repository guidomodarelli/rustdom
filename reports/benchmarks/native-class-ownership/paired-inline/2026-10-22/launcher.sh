set -u
study_root=$1
harness=$2
driver=$harness/reports/benchmarks/native-class-ownership/paired-inline-experiment.cjs
tools_root=/mnt/c/Users/guido/ghq/projects/rustdom/.tools
cd "$harness" || exit 2
test -f "$study_root/provenance.json" || exit 2
test -f "$study_root/review-receipt.json" || exit 2
"$tools_root/node-22/bin/node" -e 'const fs=require("node:fs");fs.writeFileSync(process.argv[1],JSON.stringify({startedAt:new Date().toISOString()})+"\n",{flag:"wx"});' "$study_root/started.json" || exit 2
for runtime in node-22 node; do
  label=node-22
  if test "$runtime" = node; then label=node-24; fi
  "$tools_root/$runtime/bin/node" "$driver" "$study_root/runtime-manifest.json" "$study_root/$label" "$study_root/provenance.json" > "$study_root/$label.launch.log" 2> "$study_root/$label.launch.stderr.log"
  result=$?
  case "$result" in
    0|1) ;;
    *) exit "$result" ;;
  esac
  "$tools_root/$runtime/bin/node" -e 'const fs=require("node:fs");const index=JSON.parse(fs.readFileSync(process.argv[1]));if(!index.complete)process.exit(2);console.log(JSON.stringify({node:index.node,complete:index.complete,accepted:index.accepted}));' "$study_root/$label/index.json" || exit 2
done
"$tools_root/node/bin/node" "$driver" --verify-set "$study_root/node-22" "$study_root/node-24" > "$study_root/verification.json" || exit 2
"$tools_root/node/bin/node" -e 'const fs=require("node:fs");const result=JSON.parse(fs.readFileSync(process.argv[1]));fs.writeFileSync(process.argv[2],JSON.stringify({finishedAt:new Date().toISOString(),accepted:result.accepted})+"\n",{flag:"wx"});console.log(JSON.stringify({verified:result.verified,accepted:result.accepted}));if(!result.accepted)process.exit(1);' "$study_root/verification.json" "$study_root/finished.json"
