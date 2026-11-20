#!/usr/bin/env python3
"""Screen sanity gate: checks pixels, not full UI correctness."""
import sys
from PIL import Image

im=Image.open(sys.argv[1]).convert("RGB")
if im.width < 250 or im.height < 400:
    raise SystemExit("Screenshot missing/too small")

pixels=list(im.resize((120, 240)).getdata())
buckets={tuple(v//24 for v in rgb) for rgb in pixels}
dark=sum(1 for rgb in pixels if max(rgb)<180)/len(pixels)
nearwhite=sum(1 for rgb in pixels if min(rgb)>245)/len(pixels)
print(f"Android launch screenshot: {im.width}x{im.height}, "
      f"distinct coarse colours={len(buckets)}, "
      f"dark={dark:.3%}, near-white={nearwhite:.3%}")

# A blank/solid screen can compile; fail fast until a human reviews real art.
if len(buckets)<12 or dark<0.01 or nearwhite>0.98:
    raise SystemExit("Screen failed nonblank/nonwhite visual sanity gate")
