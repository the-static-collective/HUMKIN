#!/usr/bin/env python3
"""Read-only Radio House source/branch report. No broadcast or cloud writes."""
import argparse
import json
import os
from pathlib import Path
import re
import sys
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SHA = re.compile(r"^[0-9a-f]{40}$")
REPO = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def api(url):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "humkin-radio-house-pulse"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = "Bearer " + token
    with urlopen(Request(url, headers=headers), timeout=20) as response:
        return json.load(response)


def paged(url, query=""):
    items = []
    for page in range(1, 26):
        joiner = "&" if "?" in url else "?"
        part = api(url + joiner + query + ("&" if query else "") + f"per_page=100&page={page}")
        if not isinstance(part, list):
            raise ValueError("GitHub pagination returned non-array; refusing partial census")
        items.extend(part)
        if len(part) < 100:
            return items
    raise ValueError("GitHub page cap reached; refusing partial census")


def github_snapshot(repo):
    if not REPO.fullmatch(repo):
        raise ValueError("Invalid owner/repo")
    base = "https://api.github.com/repos/" + repo
    main = api(base + "/commits/main")
    branches = paged(base + "/branches")
    pulls = paged(base + "/pulls", "state=open")
    return {
        "repository": repo, "coverage": "complete",
        "main_sha": main["sha"], "main_event_at": main["commit"]["committer"]["date"],
        "branches": [{"name": b["name"], "sha": b["commit"]["sha"]} for b in branches],
        "open_prs": [{"number": p["number"], "title": p["title"],
                      "head": p["head"]["ref"],
                      "head_repo": (p["head"].get("repo") or {}).get("full_name", ""),
                      "base": p["base"]["ref"]} for p in pulls]
    }


def cell(value):
    return str(value).replace("|", r"\|").replace("\n", " ").replace("\r", " ").replace(chr(96), "'")


def validate(snapshot, evidence):
    if not isinstance(snapshot, dict) or snapshot.get("coverage") != "complete":
        raise ValueError("Only complete branch/PR snapshots can generate reports")
    if not REPO.fullmatch(str(snapshot.get("repository", ""))) or not SHA.fullmatch(str(snapshot.get("main_sha", ""))):
        raise ValueError("Invalid source identity")
    if not isinstance(snapshot.get("branches"), list) or not isinstance(snapshot.get("open_prs"), list):
        raise ValueError("Missing branch or PR collection")
    seen = set()
    for b in snapshot["branches"]:
        if not b["name"] or b["name"] in seen or not SHA.fullmatch(str(b["sha"])):
            raise ValueError("Invalid or duplicate branch")
        seen.add(b["name"])
    nums = set()
    for pr in snapshot["open_prs"]:
        if not isinstance(pr.get("number"), int) or pr["number"] in nums or not pr.get("head"):
            raise ValueError("Invalid or duplicate PR")
        nums.add(pr["number"])
    if evidence.get("schema") != "humkin.radiohouse.source-leads/v1":
        raise ValueError("Unsupported evidence manifest")
    for c in evidence["components"]:
        path = c["path"]
        if not path or path.startswith("/") or ".." in Path(path).parts:
            raise ValueError("Unsafe relative source path")


def render(snapshot, evidence, root):
    validate(snapshot, evidence)
    repo = snapshot["repository"]
    web = "https://github.com/" + repo
    sha = snapshot["main_sha"]
    branches = {b["name"]: b["sha"] for b in snapshot["branches"]}
    prs = {p["head"]: p for p in snapshot["open_prs"]
           if p.get("head_repo") == repo and p["head"] in branches}
    signal = [
        "# CURRENT SIGNAL — generated source cut", "",
        "> NOT A LIVE AIR CHECK. Source and GitHub metadata only. Cloudflare, R2, Supabase, Acer and real listening devices are NOT CHECKED.", "",
        f"- Repo: [{repo}]({web})",
        f"- Main SHA: [{sha[:12]}]({web}/commit/{sha})",
        f"- Main commit event: {cell(snapshot.get('main_event_at','unknown'))} (not a current field-check time)",
        f"- Visible branch heads: {len(branches)}; open PRs: {len(snapshot['open_prs'])}; pagination: COMPLETE for this repository.",
        "- Source-file presence, merge, deployment, program publication and audio heard are distinct observations.", "",
        "## Source leads (all runtime states NOT CHECKED)", "",
        "| Component | Main source | Runtime/deployment | Device audio | Evidence |",
        "| --- | --- | --- | --- | --- |"
    ]
    for c in evidence["components"]:
        path = c["path"]
        state = "PRESENT (source only)" if (root / path).is_file() else "NOT FOUND at this source cut"
        signal.append(f"| {cell(c['label'])} | [{cell(path)}]({web}/blob/{sha}/{path}) — {state} | NOT CHECKED | NOT CHECKED | [Lead]({c['reference']}) |")
    signal += [
        "", "## Operational boundary", "",
        "- The November 20 two-track Acer-off audio was USER-REPORTED in [Night Shift Receiver 002](NIGHT-SHIFT-RECEIVER-002.md); full 40-song phone/track-boundary proof is not established here.",
        "- The Station Bible and static rotation are historical/subsystem records, not overriding live cloud or transmitter truth.",
        "- No program, recording, permission, cloud pointer or on-air route was changed by this generator.", "",
        "## Next proof", "",
        "Test the reviewed 40-song cloud revision on two devices through several real boundaries with Acer off; compare source, API, listener and rollback receipts.",
        "", "Re-entry: [Radio House](RADIO-HOUSE.md) · [Branch Inventory](BRANCH-INVENTORY.md) · [Continuity](../CONTINUE.md)",
        "", "Generated by garden/radio_house_pulse.py. Do not hand-edit.", ""
    ]
    report = [
        "# BRANCH INVENTORY — generated GitHub source census", "",
        "> Branch names, PR titles and commits are leads, not adopted capabilities or field tests.", "",
        f"- Repo: [{repo}]({web}); main: [{sha[:12]}]({web}/commit/{sha})",
        f"- Branches: {len(branches)}; open PRs: {len(snapshot['open_prs'])}; branch/PR pages: COMPLETE.",
        "- Source bodies, closed PR ancestry, external/private repositories, deployment and devices not examined.", "",
        "## Focused return doors", "",
        "| Branch | SHA | Open same-repo PR | Test question |",
        "| --- | --- | --- | --- |"
    ]
    for item in evidence["focus_branches"]:
        name = item["branch"]
        head = branches.get(name)
        if head:
            pr = prs.get(name)
            relation = f"[#{pr['number']}]({web}/pull/{pr['number']}) → {cell(pr['base'])}" if pr else "No matching open PR"
            report.append(f"| [{cell(name)}]({web}/tree/{name}) | {head[:12]} | {relation} | {cell(item['question'])} |")
        else:
            report.append(f"| {cell(name)} | NOT VISIBLE | Unknown | {cell(item['question'])} |")
    report += ["", "## All visible branch heads", "", "| Branch | SHA | Current open PR relation |", "| --- | --- | --- |"]
    for name, head in sorted(branches.items()):
        pr = prs.get(name)
        relation = f"[#{pr['number']}]({web}/pull/{pr['number']}) (base: {cell(pr['base'])})" if pr else "No matching open PR; UNCLASSIFIED"
        report.append(f"| [{cell(name)}]({web}/tree/{name}) | {head[:12]} | {relation} |")
    report += [
        "", "No PR relation does not mean merged, retired, discarded or useless. Stacked PRs are not presumed on main.",
        "Generated by garden/radio_house_pulse.py. Do not hand-edit.", ""
    ]
    return "\n".join(signal), "\n".join(report)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default="the-static-collective/HUMKIN")
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--snapshot", type=Path, help="offline fixture; no GitHub call")
    parser.add_argument("--signal-out", type=Path)
    parser.add_argument("--branch-out", type=Path)
    args = parser.parse_args(argv)
    root = args.root.resolve()
    evidence = json.loads((root / "garden/radio-house/evidence.json").read_text(encoding="utf-8"))
    snapshot = json.loads(args.snapshot.read_text(encoding="utf-8")) if args.snapshot else github_snapshot(args.repo)
    if snapshot["repository"] != args.repo:
        raise ValueError("Wrong repository in snapshot")
    signal, branches = render(snapshot, evidence, root)
    targets = [(args.signal_out or root / "docs/CURRENT-SIGNAL.md", signal),
               (args.branch_out or root / "docs/BRANCH-INVENTORY.md", branches)]
    for path, body in targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f"Radio House reports NOT updated: {error}", file=sys.stderr)
        sys.exit(1)
