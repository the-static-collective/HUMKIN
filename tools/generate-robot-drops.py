#!/usr/bin/env python3
"""HUMKIN Robot Desk v2 — three independent offline TTS engines, three audio
finishes, four timeless-humor levels. Human-reviewed DRAFTS ONLY.

No cloud TTS, impersonation, private inputs, published tracks or broadcast writes.
A generated voice may be a robot, but the joke should work without electricity.
"""
import argparse
from collections import Counter
import datetime as dt
import hashlib
import html
import json
from pathlib import Path
import random
import re
import shutil
import subprocess
import tempfile

# Editorial taxonomy is *not* an age, community, belief or demographic score.
# "plain" is universal hospitality and daily work; humor gets stranger gradually.
LEVELS = ("plain", "wry", "strange", "cosmic")
FINISHES = ("wire", "warm", "clear")
ENGINES = ("espeak", "flite", "festival")

# slug / spoken original line / absurdity / family / station role.
# Deliberately intelligible across generations: bread, neighbors, chairs,
# cows, weather, belonging, work and gentle human contradictions.
BANK = [
 ("neighbor-soup","A neighbor brought soup. We have been promoted to friends.","plain","neighbors","character"),
 ("bread-box","The key was in the bread box. Again. Everything is all right.","plain","kitchen","station_id"),
 ("three-brooms","We own three brooms. Not one of them has swept the floor.","plain","chores","character"),
 ("last-pancake","Nobody wanted the last pancake. So it stayed for breakfast.","plain","kitchen","character"),
 ("rooster-sleep","The rooster started early. The hens voted to sleep in.","plain","farm","character"),
 ("extra-chair","HUMKIN RADIO. There's an extra chair at the table. Pull it up.","plain","neighbors","station_id"),
 ("good-wood","The wood was wet. The fire took its time. So did we.","plain","hearth","station_id"),
 ("one-more-song","The kettle has boiled. The work can wait one more song.","plain","kitchen","station_id"),
 ("quiet-gift","Someone left the porch light on. Nobody asked who.","plain","neighbors","character"),
 ("proper-hat","The hat was upside down. We wore it anyway.","wry","clothing","character"),
 ("committee-broom","The committee on sweeping has agreed to meet after the sweeping.","wry","chores","character"),
 ("hay-meeting","A meeting was held in the hayloft. The hay was absent.","wry","farm","character"),
 ("goose-refused","We asked the goose for directions. It has declined to comment.","wry","farm","character"),
 ("two-mugs","HUMKIN RADIO. Two mugs, one kettle, and a very long argument over who asked first.","wry","kitchen","station_id"),
 ("chair-vote","The chairs voted on whether to move. The motion did not carry.","wry","furniture","character"),
 ("ladder-report","The ladder has been inspected. The inspector is still up there.","wry","chores","character"),
 ("cake-judges","We held a contest for the best cake. The judges ate the results.","wry","kitchen","character"),
 ("counting-eggs","The eggs have been counted twice. The hens disagree.","wry","farm","character"),
 ("cow-apology","The cow issued a formal apology. Nobody remembers what for.","strange","farm","character"),
 ("wooden-spoon","The wooden spoon has resigned from the soup. It would like to stir elsewhere.","strange","kitchen","character"),
 ("barn-visitor","The barn has asked to be treated as a guest. It has always lived here.","strange","farm","character"),
 ("chair-needs-chair","The chair has requested a chair to sit on. We are considering it.","strange","furniture","character"),
 ("lost-tuesday","We found the missing day behind a sack of flour. It was still fresh.","strange","kitchen","character"),
 ("boots-union","HUMKIN RADIO. The boots have formed a union. They refuse to walk alone.","strange","clothing","station_id"),
 ("quiet-committee","The committee on silence has made an announcement. It was well received.","strange","records","character"),
 ("supper-clock","The supper bell rang at breakfast. Everybody came anyway.","strange","kitchen","character"),
 ("fence-argument","The fence has taken both sides of an argument. This is normal for a fence.","strange","farm","character"),
 ("moon-invoice","The moon sent the barn a bill for light. The barn requested a candle.","cosmic","farm","character"),
 ("wind-hat","The wind has resigned. The hats have never been happier.","cosmic","clothing","character"),
 ("future-bread","Tomorrow came by looking for bread. We told it to come back yesterday.","cosmic","kitchen","character"),
 ("north-south","The north wind and the south wind shook hands. The house fell quiet.","cosmic","hearth","character"),
 ("patient-mountain","HUMKIN RADIO. The mountain has been waiting for us. It says there is no hurry.","cosmic","earth","station_id"),
 ("oldest-chair","This chair has witnessed a thousand dinners. It remembers the pie.","cosmic","furniture","character"),
 ("universe-chores","The universe asked what we were making. We said supper. It stayed.","cosmic","kitchen","character"),
 ("stars-garden","The stars planted a garden in the dark. The weeds look magnificent.","cosmic","earth","character"),
 ("kingdom-soup","The king asked for riches. The cook brought soup. Nobody complained.","cosmic","kitchen","character"),
]
assert len({x[0] for x in BANK}) == len(BANK), "Script slugs must be unique"

def run(command, *, input_text=None):
    subprocess.run(command, input=input_text, text=input_text is not None,
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

def probe(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error",
      "-show_entries", "format=duration", "-of",
      "default=noprint_wrappers=1:nokey=1", str(path)], text=True).strip())

def engine_available(engine):
    return shutil.which({"espeak":"espeak", "flite":"flite", "festival":"text2wave"}[engine]) is not None

def available_engines(selection):
    if selection == "auto":
        chosen = [e for e in ENGINES if engine_available(e)]
    else:
        chosen = [e.strip() for e in selection.split(",") if e.strip()]
        if not chosen or len(chosen)!=len(set(chosen)) or not set(chosen)<=set(ENGINES):
            raise ValueError("Engines must be unique names from: "+", ".join(ENGINES))
        missing = [e for e in chosen if not engine_available(e)]
        if missing:
            raise ValueError("Unavailable requested TTS engines: "+", ".join(missing))
    if not chosen:
        raise ValueError("Install at least one supported offline TTS engine")
    return chosen

def speak(engine, script, wav):
    if engine == "espeak":
        run(["espeak", "-ven-us", "-s", "149", "-p", "36", "-a", "160", "-w", str(wav), script])
    elif engine == "flite":
        run(["flite", "-voice", "kal", "-t", script, "-o", str(wav)])
    elif engine == "festival":
        run(["text2wave", "-o", str(wav)], input_text=script+"\n")
    else:
        raise ValueError("Unknown TTS engine: "+str(engine))

def finish_audio(wav, dest, finish):
    # Sonic finish only. No radio hiss baked into a dry cart: radio has its own
    # atmospheric layer, and clean Shuffle must stay clean.
    setting = {
      "wire": ("highpass=f=340,lowpass=f=2850,acompressor=threshold=-21dB:ratio=2.5:attack=8:release=120",
               "22050", "48k"),
      "warm": ("highpass=f=160,lowpass=f=6400,acompressor=threshold=-20dB:ratio=2:attack=9:release=130",
               "32000", "96k"),
      "clear": ("highpass=f=90,lowpass=f=10000,acompressor=threshold=-24dB:ratio=1.5:attack=12:release=150",
               "44100", "128k"),
    }
    chain, rate, bitrate = setting[finish]
    length = probe(wav)
    if not (0.6 <= length <= 25):
        raise ValueError("Spoken cart outside 0.6–25s review range")
    chain += f",afade=t=in:st=0:d=0.04,afade=t=out:st={max(0,length-.28):.3f}:d=0.25,alimiter=limit=0.92"
    run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
         "-i", str(wav), "-af", chain, "-ar", rate, "-ac", "1", "-b:a", bitrate, str(dest)])
    return round(probe(dest), 3)

def public_inventory():
    """Only count pinned public source files; never inspect private listener data."""
    try:
        config = json.loads(Path("fm/rotation.json").read_text(encoding="utf-8"))
        carts = json.loads(Path("fm/air-carts.json").read_text(encoding="utf-8"))
        if not isinstance(config.get("tracks"), list) or not isinstance(carts.get("carts"),list):
            return []
        songs, count = len(config["tracks"]), len(carts["carts"])
        # Plain arithmetic plus fictional follow-up, not a live service claim.
        return [
          ("song-ledger",f"The song ledger holds {songs} records. The cupboard wants one.",
           "wry","records","station_id"),
          ("cart-ledger",f"The field shelf holds {count} recordings. The broom has requested an audition.",
           "strange","records","character")
        ]
    except (OSError, ValueError, TypeError):
        return []

def select_scripts(seed, count, level, inventory):
    r = random.Random(int.from_bytes(hashlib.sha256(seed.encode()).digest()[:8],"big"))
    pool = BANK + (public_inventory() if inventory else [])
    if level != "mix":
        pool = [x for x in pool if x[2] == level]
        if count > len(pool): raise ValueError("Not enough scripts for this humor level")
        return r.sample(pool, count)
    by_level = {k: [x for x in pool if x[2] == k] for k in LEVELS}
    for k in LEVELS:r.shuffle(by_level[k])
    selected = []
    # Guarantees broad humor coverage before expanding a tier.
    for i in range(count):
        candidates = [k for k in LEVELS if by_level[k]]
        if not candidates: raise ValueError("Not enough scripts for requested count")
        count_by_level = Counter(x[2] for x in selected)
        smallest = min(count_by_level[k] for k in candidates)
        least = [k for k in candidates if count_by_level[k]==smallest]
        chosen = r.choice(least)
        selected.append(by_level[chosen].pop())
    return selected

def html_index(manifest):
    cards=[]
    for item in manifest["items"]:
        tag=html.escape(item["absurdity"])
        description=f"{item['engine'].upper()} / {item['finish'].upper()} / {tag.upper()}"
        group=html.escape(item["group"])
        cards.append(
          '<article class="card" data-level="'+tag+'"><div class="badge">'+
          html.escape(description)+'</div><h3>'+html.escape(item["slug"].replace("-"," "))+
          '</h3><p>'+html.escape(item["script"])+'</p><audio controls preload="none" src="'+
          html.escape(item["file"],quote=True)+'"></audio><small>'+str(item["seconds"])+
          ' s · '+group+' · review only</small></article>'
        )
    return """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>HUMKIN — Robot Desk Audition</title>
<style>body{font-family:system-ui;background:#fff8e9;color:#271d42;max-width:1080px;margin:0 auto;padding:19px}
h1{font-size:clamp(2rem,7vw,4rem);line-height:.98}p{line-height:1.45}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:12px}
.card{border:3px solid #271d42;border-radius:10px;padding:15px;background:#fff;box-shadow:4px 5px #271d42}
.badge{font-size:.73rem;letter-spacing:.06em;font-weight:800;color:#5f386e}audio{width:100%;margin:10px 0}
small{display:block;color:#605a62}h3{text-transform:capitalize;margin:12px 0}
</style></head><body><h1>THE ROBOT DESK</h1>
<p>Original, deliberately odd computer voices. Audio finishes are WIRE, WARM and CLEAR.
Comedy travels from PLAIN to WRY to STRANGE to COSMIC. Same joke, different hardware:
comparison cuts are marked A/B. No public broadcast, no uploads, no automatic publishing.</p>
<main>"""+"".join(cards)+"""</main><p>All recordings require human review before airplay.
This page works without a connection if kept with its MP3 files.</p></body></html>"""

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--seed", default=None, help="Reproducible batch label; ISO week by default")
    p.add_argument("--count",type=int,default=12,help="Distinct jokes, excluding comparisons")
    p.add_argument("--out",default="robot-auditions")
    p.add_argument("--engines",default="auto",help="auto or espeak,flite,festival")
    p.add_argument("--absurdity",choices=("mix",)+LEVELS,default="mix")
    p.add_argument("--finish",choices=("mix",)+FINISHES,default="mix")
    p.add_argument("--compare",action="store_true",help="Add 3x3 generator/finish A/B of one timeless joke")
    p.add_argument("--no-inventory",action="store_true",help="Only evergreen scripts")
    a=p.parse_args()
    if not (1<=a.count<=len(BANK)+2):p.error("Count must be between 1 and script bank size")
    if not all(shutil.which(x) for x in ("ffmpeg","ffprobe")):p.error("ffmpeg and ffprobe required")
    try: engines=available_engines(a.engines)
    except ValueError as e:p.error(str(e))
    seed=a.seed or dt.datetime.now(dt.timezone.utc).strftime("%G-W%V")
    try: chosen=select_scripts(seed,a.count,a.absurdity,not a.no_inventory)
    except ValueError as e:p.error(str(e))
    out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
    manifest={"schema":"humkin.radio.robot-drops/v2","seed":seed,
      "status":"DRAFT / HUMAN REVIEW / NOT ON AIR","engines":engines,
      "finishes":list(FINISHES),"humor_levels":list(LEVELS),
      "editorial_notes":"Comedy about universal human foibles, not at the expense of a faith, ethnicity, age or community.",
      "signal_notes":"No radio static baked in. No radio, Supabase or publishing writes.","items":[]}
    def render(script_tuple,engine,finish,number,group):
        slug,script,level,family,role=script_tuple
        safe_seed=re.sub(r"[^a-zA-Z0-9_-]+","-",seed)[:48] or "batch"
        name=f"robot-{safe_seed}-{number:02d}-{level}-{engine}-{finish}-{slug}.mp3"
        with tempfile.TemporaryDirectory() as tmp:
            wav=Path(tmp)/"voice.wav"
            speak(engine,script,wav)
            duration=finish_audio(wav,out/name,finish)
        file=out/name
        manifest["items"].append({"file":name,"slug":slug,"script":script,
            "absurdity":level,"family":family,"role":role,"engine":engine,
            "finish":finish,"group":group,"seconds":duration,
            "bytes":file.stat().st_size,"sha256":hashlib.sha256(file.read_bytes()).hexdigest(),
            "approval":"REVIEW REQUIRED — unpublished"})
    for i,row in enumerate(chosen):
        engine=engines[i%len(engines)]
        finish=a.finish if a.finish!="mix" else FINISHES[(i//len(engines))%len(FINISHES)]
        render(row,engine,finish,i+1,"weekly-original")
    if a.compare:
        # The same *evergreen* script through all available voices and finishes.
        # This is an honest apples-to-apples sonic A/B, not more random jokes.
        common=next(x for x in BANK if x[0]=="extra-chair")
        for engine in engines:
            for finish in FINISHES:
                render(common,engine,finish,len(manifest["items"])+1,"comparison")
    (out/"audition-manifest.json").write_text(
        json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    (out/"LISTEN-HERE.html").write_text(html_index(manifest),encoding="utf-8")
    print(f"ROBOT DESK: {len(manifest['items'])} private voice drafts; engines: {', '.join(engines)}; listen at {out/'LISTEN-HERE.html'}")

if __name__=="__main__":
    main()
