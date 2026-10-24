"""Verify every byte of the completed original study without running measurements."""
from pathlib import Path
import hashlib
import json
import lzma
import tarfile


def read_json(filename):
    return json.loads(filename.read_bytes())


def digest_file(filename):
    digest = hashlib.sha256()
    with filename.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main():
    directory = Path(__file__).resolve().parent
    receipt = read_json(directory / "receipt.json")
    archive = read_json(directory / "archive.json")
    raw = read_json(directory / "raw-files.json")
    files = {entry["path"]: entry for entry in read_json(directory / "files.json")}
    assert receipt["complete"] and receipt["verified"] and receipt["accepted"] is False
    assert digest_file(directory / "raw-files.json") == receipt["rawManifestSha256"]
    assert archive["archiveSha256"] == receipt["archiveSha256"]
    for name, entry in files.items():
        filename = (directory / name).resolve()
        assert filename.is_relative_to(directory)
        assert filename.stat().st_size == entry["bytes"]
        assert digest_file(filename) == entry["sha256"], name
    filename = (directory / archive["filename"]).resolve()
    assert filename.is_relative_to(directory)
    assert filename.stat().st_size == archive["archiveBytes"] == receipt["archiveBytes"]
    assert digest_file(filename) == archive["archiveSha256"]
    with lzma.open(filename, "rb") as combined:
        digest = hashlib.sha256()
        total = 0
        for block in iter(lambda: combined.read(8 * 1024 * 1024), b""):
            digest.update(block)
            total += len(block)
        assert total == archive["tarBytes"] == receipt["uncompressedTarBytes"]
        assert digest.hexdigest() == archive["tarSha256"] == receipt["uncompressedTarSha256"]
    seen = set()
    with tarfile.open(filename, mode="r|xz") as source:
        for member in source:
            assert member.isfile() and member.name.startswith(archive["prefix"])
            name = member.name.removeprefix(archive["prefix"])
            assert name in raw and name not in seen
            seen.add(name)
            content_digest = hashlib.sha256()
            length = 0
            with source.extractfile(member) as stream:
                for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
                    content_digest.update(block)
                    length += len(block)
            assert length == raw[name]["bytes"] and content_digest.hexdigest() == raw[name]["sha256"], name
    assert seen == set(raw) and len(seen) == receipt["regularFiles"]
    execution = read_json(directory / "execution.json")
    verification = read_json(directory / "verification.json")
    assert execution["complete"] and execution["accepted"] is False
    assert verification["verified"] and verification["backgroundAffinityVerified"] and verification["accepted"] is False
    assert read_json(directory / "verification.process.json")["exitCode"] == 0
    summary = read_json(directory / "summary.json")
    assert len(summary["cells"]) == 32 and summary["workers"] == 2048
    assert sum(entry["jsdomControlViolation"] for entry in summary["cells"]) == 13
    assert sum(entry["rustNumericViolation"] for entry in summary["cells"]) == 1
    print(json.dumps({"archiveVerified": True, "sourceFiles": len(raw),
                      "workers": 2048, "measuredDurations": 18432,
                      "measurementExecuted": False, "accepted": False}))


if __name__ == "__main__":
    main()
