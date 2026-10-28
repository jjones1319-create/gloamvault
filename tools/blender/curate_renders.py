"""curate_renders.py — the review renders that go into git, small (D-109).

Run:  blender -b -P tools/blender/curate_renders.py

A build round writes hundreds of full-size PNGs to `art/renders/` (git-ignored: ~300 MB after Phase 5). This keeps
the ones a reviewer needs — contact sheets, lineups, pose sheets, head sheets, gear sheets and the 200-px phone reads —
as JPEGs at most 1,600 px wide in `art/review/`, mirroring the folder layout (~10 MB). Re-run it after every round.
"""
import fnmatch
import os
import sys

import bpy

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
from common import ART, log  # noqa: E402

SRC = os.path.join(ART, 'renders')
DST = os.path.join(ART, 'review')
KEEP = ('*_200.png', '*200*.png', 'read*.png', '*sheet*.png', 'lineup*.png', 'poses*.png', 'heads_*.png',
        'gallery_*.png', 'skeleton_*.png', 'species*.png', 'Guard_Shield.png', 'card_*.png', 'set_S_broad.png',
        'reimport_check.png', 'closeups.png', 'mixed_tiers.png', 'fight_*.png', 'lineup.png', 'kit_sheet*.png', 'template_*.png',
        '*_phone.png', 'cards.png', 'heads*.png', 'throne*.png', 'naesa_attach.png')
MAX_W = 1600


def wanted(name):
    return any(fnmatch.fnmatch(name, p) for p in KEEP) and not name.startswith('_')


def main():
    sc = bpy.context.scene
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.quality = 82
    sc.render.image_settings.color_mode = 'RGB'
    n, total = 0, 0
    for root, _dirs, files in os.walk(SRC):
        if os.sep + 'history' in root or os.sep + '_tmp' in root:
            continue
        for f in sorted(files):
            if not f.endswith('.png') or not wanted(f):
                continue
            src = os.path.join(root, f)
            rel = os.path.relpath(src, SRC)
            dst = os.path.join(DST, os.path.splitext(rel)[0] + '.jpg')
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            img = bpy.data.images.load(src)
            w, h = img.size
            if w > MAX_W:
                img.scale(MAX_W, max(1, round(h * MAX_W / w)))
            img.save_render(dst, scene=sc)
            bpy.data.images.remove(img)
            n += 1
            total += os.path.getsize(dst)
    log('curated %d renders → art/review (%.1f MB)' % (n, total / 1e6))


main()
