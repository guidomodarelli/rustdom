"""Extract an authenticated ownership tar into a fresh directory without unsafe links or paths."""
import json
import pathlib
import posixpath
import sys
import tarfile
import tempfile

filename, prefix = sys.argv[1:3]
assert prefix == "independent-order"
allowed = {prefix + "/prepared/ownership-build/packages/" + label + "/node_modules": "../../node_modules"
           for label in ["A0", "A1", "B", "J0", "J1"]}
allowed[prefix + "/prepared/ownership-build/node_modules/.bin/tldts"] = "../tldts/bin/cli.js"
with tarfile.open(filename, "r:gz") as archive:
    members = archive.getmembers()
    names = set()
    links = {}
    for member in members:
        name = pathlib.PurePosixPath(member.name)
        assert not name.is_absolute() and ".." not in name.parts and "\\" not in member.name
        assert name.parts[0] == prefix
        normalized = name.as_posix()
        assert normalized not in names, normalized
        names.add(normalized)
        assert member.isfile() or member.isdir() or member.issym(), normalized
        if member.issym():
            assert allowed.get(normalized) == member.linkname, normalized
            target = posixpath.normpath(posixpath.join(str(name.parent), member.linkname))
            assert target.startswith(prefix + "/"), target
            links[normalized] = member.linkname
    for name in names:
        assert not any(name.startswith(link + "/") for link in links), name
    destination = pathlib.Path(tempfile.mkdtemp(prefix="rustdom-ownership-results-"))
    archive.extractall(destination, members=members, filter="tar")
print(json.dumps({"root": str(destination), "prefix": prefix, "entries": len(members),
                  "links": links, "partialPreparationLinks": len(links) != len(allowed)}))
