#!/usr/bin/env python3
"""HUMKIN catalogue mapping (offline, optional metadata, no automatic airtime).

Input: a crate manifest created by humkin-radio-batch.py plus optional human
notes CSV/JSON, sidecar Suno details, or embedded audio tags in the manifest.
Output: candidate tags with provenance and local review cases. None of these
candidates authorize publication. Requires only the Python standard library.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

SCHEMA="humkin.catalog.candidates/v1"
PUBLIC_SCHEMA="humkin.radio.enrichment/v1"
SHA=re.compile(r"^[0-9a-f]{64}$")
# Deliberately small and inspectable. A style prompt is evidence about a
# creator's intention, not an audio classifier's proof of the recording.
VOCAB={
 "genre":{
  "jazz":["jazz","swing","bebop","bossa nova"],
  "blues":["blues","delta blues","chicago blues"],
  "soul":["soul","neo soul","gospel soul"],
  "rnb":["r&b","rnb","rhythm and blues"],
  "hip-hop":["hip hop","hip-hop","rap","boom bap","trap"],
  "rock":["rock","indie rock","alternative rock","punk"],
  "metal":["metal","heavy metal","doom metal"],
  "folk":["folk","americana","bluegrass","singer songwriter"],
  "country":["country","honky tonk"],
  "electronic":["electronic","electronica","edm","house","techno","dance music"],
  "ambient":["ambient","drone music","soundscape"],
  "classical":["classical","orchestral","chamber music"],
  "pop":["pop","synth pop","dream pop"],
  "reggae":["reggae","dub","ska"],
  "latin":["salsa","cumbia","bachata","latin jazz"],
  "gospel":["gospel","worship music","spiritual"],
  "spoken-word":["spoken word","interview","radio drama","podcast","monologue"]
 },
 "mood":{
  "warm":["warm","warmth","comforting"],
  "playful":["playful","whimsical","humorous","comedy"],
  "somber":["somber","melancholic","sad","mourning"],
  "hopeful":["hopeful","uplifting","optimistic"],
  "tense":["tense","anxious","ominous","suspense"],
  "intimate":["intimate","whispered","tender"],
  "energetic":["energetic","upbeat","driving","high energy"],
  "dreamlike":["dreamlike","dreamy","ethereal","surreal"]
 },
 "texture":{
  "acoustic":["acoustic","unplugged","fingerpicked"],
  "synth":["synth","synthesizer","analog synth"],
  "orchestral":["orchestra","strings","brass section"],
  "lo-fi":["lo-fi","lofi","tape hiss","cassette"],
  "live":["live performance","live recording","audience"],
  "vocal":["vocals","sung","choir","harmonies"],
  "instrumental":["instrumental","no vocals"],
  "percussive":["percussion","drum solo","rhythmic"]
 }
}
SOURCES=(("human_tags",5),("suno_style",3),("embedded_style",2),("embedded_genre",2),("folder_genre",1),("human_description",2))
MAX_TRACKS=50000
def bounded(value,limit=2000):
    return re.sub(r"[\x00-\x08\x0b-\x1f]"," ",str(value or ""))[:limit].strip()
def tokenize(value):
    return re.sub(r"[\s_/-]+"," ",bounded(value).casefold())
def has_phrase(haystack,needle):
    h=tokenize(haystack).replace("&"," and ")
    n=tokenize(needle).replace("&"," and ")
    # Keep ampersand spellings such as R&B as a second, literal pass.
    literal=re.search(r"(?<!\w)"+re.escape(needle.casefold())+r"(?!\w)",bounded(haystack).casefold())
    return bool(literal or re.search(r"(?<!\w)"+re.escape(n)+r"(?!\w)",h))
def parse_tags(value):
    if isinstance(value,list):return [bounded(x,80) for x in value if bounded(x,80)]
    return [bounded(x,80) for x in re.split("[;,|]",bounded(value,1000)) if bounded(x,80)]
def map_styles(row,notes):
    evidence={
      "human_tags":", ".join(parse_tags(notes.get("tags",""))),
      "suno_style":bounded(notes.get("suno_style") or notes.get("style") or row.get("suno_style"),2000),
      "embedded_style":bounded(row.get("embedded_style"),1500),
      "embedded_genre":bounded(row.get("embedded_genre"),240),
      "folder_genre":bounded(row.get("folder_genre"),240),
      "human_description":bounded(notes.get("human_description") or notes.get("description") or row.get("human_description"),2000)
    }
    scores=defaultdict(lambda:{"score":0,"evidence":[]})
    for source,weight in SOURCES:
        text=evidence[source]
        for family,values in VOCAB.items():
            for label,terms in values.items():
                matches=[term for term in terms if has_phrase(text,term)]
                if not matches:continue
                code=family+":"+label
                slot=scores[code]
                slot["score"]+=weight
                slot["evidence"].append({"source":source,"term":matches[0]})
    tags=[{"tag":code,"score":min(s["score"],10),"evidence":s["evidence"],
           "status":"candidate"} for code,s in scores.items()]
    tags.sort(key=lambda x:(-x["score"],x["tag"]))
    return tags[:32],evidence
def load_notes(path):
    if not path:return []
    path=Path(path)
    if path.suffix.casefold()==".csv":
        with path.open(newline="",encoding="utf-8-sig") as fp:return list(csv.DictReader(fp))
    data=json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data,dict):data=data.get("tracks",[])
    if not isinstance(data,list):raise ValueError("Notes must contain an array of track records")
    return data
def best_notes(row,all_notes):
    # Only identifiers anchored in file bytes or an exact path/filename.
    # Do not conflate two identically named recordings if their paths differ.
    keys=("mp3_sha256","source_sha256","source_path","filename")
    for key in keys:
        value=row.get(key)
        if not value:continue
        matches=[n for n in all_notes if str(n.get(key) or "")==str(value)]
        if len(matches)==1:return matches[0],key
        if len(matches)>1:return {},"ambiguous:"+key
    return {},"none"
def family_candidates(records):
    by_title=defaultdict(list)
    by_source=defaultdict(list)
    for row in records:
        slug=re.sub(r"[^a-z0-9]+","",row["title"].casefold())
        if slug:by_title[slug].append(row)
        if row["source_sha256"]:by_source[row["source_sha256"]].append(row)
    for row in records:
        suspects=set()
        for similar in by_title.get(re.sub(r"[^a-z0-9]+","",row["title"].casefold()),[]):
            if similar["mp3_sha256"]!=row["mp3_sha256"] and abs(float(similar["duration_seconds"])-float(row["duration_seconds"]))<45:
                suspects.add(similar["mp3_sha256"])
        for exact in by_source.get(row["source_sha256"],[]) if row["source_sha256"] else []:
            if exact["mp3_sha256"]!=row["mp3_sha256"]:suspects.add(exact["mp3_sha256"])
        row["possible_family_hashes"]=sorted(suspects)[:50]
        row["family_status"]="candidate_only" if suspects else "none"
def build_candidates(manifest,notes=()):
    if len(manifest.get("tracks",[]))>MAX_TRACKS:raise ValueError("Crate too large")
    out=[];seen=set()
    for t in manifest.get("tracks",[]):
        digest=str(t.get("mp3_sha256") or "").lower()
        if not SHA.fullmatch(digest):continue
        if digest in seen:continue
        seen.add(digest)
        note,matched_on=best_notes(t,notes)
        tags,evidence=map_styles(t,note)
        record={
          "mp3_sha256":digest,
          "source_sha256":str(t.get("source_sha256") or ""),
          "source_path":bounded(t.get("source_path"),500),
          "filename":bounded(t.get("filename"),250),
          "title":bounded(t.get("title"),160),
          "artist":bounded(t.get("artist"),160),
          "album":bounded(t.get("album"),160),
          "duration_seconds":float(t.get("duration_seconds") or 0),
          "suno_id":bounded(note.get("suno_id") or t.get("suno_id"),120),
          "suno_style":evidence["suno_style"],
          "human_description":evidence["human_description"],
          "suggestions":tags,
          "metadata_provenance":{"notes_match":matched_on,
            "sources":[s for s,v in evidence.items() if v]},
          "approved_for_tag_publication":False,
          "family_status":"none",
          "possible_family_hashes":[]
        }
        out.append(record)
    family_candidates(out)
    return {"schema":SCHEMA,
      "notice":"Local hypotheses, not verified audio labels or authorization to broadcast.",
      "source":"humkin-radio-batch manifest + optional owner notes",
      "tracks":out}
def motif_cases(candidate_pack):
    cases=[]
    for row in candidate_pack["tracks"]:
        genres=[s for s in row["suggestions"] if s["tag"].startswith("genre:")]
        if len(genres)<2:continue
        top=genres[:3]
        # A useful question, NOT a claim the native MOTIF package has run.
        cases.append({"schema":"motif.reason-case/v1",
          "question":"Which style description best fits '"+row["title"]+"'?",
          "goal":"Ask the human to distinguish genre labels before publishing a station rule.",
          "context":"HUMKIN local metadata proposal; candidate text only. Native MOTIF NOT_RUN.",
          "hypotheses":[{"id":x["tag"].replace(":","-"),
                         "predictions":{"human_review":"unknown","listen_excerpt":"unknown"},
                         "plan":"Inspect evidence: "+", ".join(e["source"] for e in x["evidence"])}
                        for x in top],
          "tests":[{"id":"human_review","cost":0.1,"risk":0},
                   {"id":"listen_excerpt","cost":0.2,"risk":0}],
          "reports":[],"humkin_track_sha256":row["mp3_sha256"]})
    return cases[:500]
def main():
    p=argparse.ArgumentParser(description="Map optional Suno styles and human notes into reviewable radio tags")
    p.add_argument("manifest",type=Path,help="humkin-crate-manifest.json from the existing batch converter")
    p.add_argument("--notes",type=Path,help="Optional CSV or JSON with mp3_sha256/source_sha256/source_path/filename + suno_style/human_description/tags")
    p.add_argument("--out",type=Path,default=Path("humkin-catalog-candidates.json"))
    args=p.parse_args()
    data=json.loads(args.manifest.read_text(encoding="utf-8"))
    pack=build_candidates(data,load_notes(args.notes))
    args.out.write_text(json.dumps(pack,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    cases=motif_cases(pack)
    questions=args.out.with_name(args.out.stem+"-motif-questions.json")
    questions.write_text(json.dumps({"status":"NOT_RUN","cases":cases},indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(f"{len(pack['tracks'])} candidates, {sum(bool(x['suggestions']) for x in pack['tracks'])} with suggested tags, {len(cases)} disputed-style questions")
    print("Review locally in TOWER catalogue desk; NOTHING has been published or uploaded.")
if __name__=="__main__":main()
