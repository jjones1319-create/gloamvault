"""export_hero.py — the hero .glb files the client loads (tools/blender/README.md §Exports).

Run:  blender -b art/build/hero_body.blend -P tools/blender/hero/export_hero.py -- [--check] [--body-only]

Reads art/build/hero_species.blend instead when it exists (the species pass's build: the same body with its species
and face shape keys, plus the parts), unless --body-only is given.

hero_<frame>.glb (frame = broad | slight): the armature `Rig` (65 bones), the body `Body` (COLOR_0 palette slots and
regions, skinned, morph targets: the five species keys and the twelve face keys), every part — `hair_crop`,
`brows_soft`, `spc_dwarf_beard`, `spc_draconid_tail` … (each skinned to `Rig`, its morph targets the species keys of
the species that may wear it plus the face keys on head parts; custom properties `family`, `variant`, `species`,
`hides` as node extras) — and the sockets, with the frame suffix stripped from every name so both files read the same
to the client. `--check` re-imports each file and prints what it holds.
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'lib'))
from common import BUILD, MODELS, REPO, args, log  # noqa: E402
from export import export_glb, prepare_for_export, reimport_report, validate  # noqa: E402

ARGS = args()
OUT = os.path.join(MODELS, 'hero')
FRAMES = ('broad', 'slight')
SPECIES_BLEND = os.path.join(BUILD, 'hero_species.blend')


def open_source():
    """Switches to hero_species.blend when it exists (it holds everything hero_body.blend does, and more)."""
    if ARGS.get('body_only') or not os.path.exists(SPECIES_BLEND):
        return
    cur = os.path.normcase(os.path.abspath(bpy.data.filepath)) if bpy.data.filepath else ''
    if cur != os.path.normcase(os.path.abspath(SPECIES_BLEND)):
        bpy.ops.wm.open_mainfile(filepath=SPECIES_BLEND)
    log('source', os.path.relpath(SPECIES_BLEND, REPO))


def frame_objects(frame):
    arm = bpy.data.objects['Rig_' + frame]
    body = bpy.data.objects['Body_' + frame]
    sockets = [o for o in bpy.data.objects if o.name.startswith('Socket_') and o.name.endswith('.' + frame)]
    parts = sorted((o for o in bpy.data.objects if o.type == 'MESH' and o.get('family') and o.name.endswith('.' + frame)),
                   key=lambda o: o.name)
    return arm, body, sockets, parts


def morph_lines(meshes):
    out = []
    for o in meshes:
        kb = o.data.shape_keys.key_blocks if o.data.shape_keys else []
        names = [k.name for k in kb][1:]
        out.append('- %s: %d morph targets%s' % (o.name, len(names), (' (' + ', '.join(names) + ')') if names and o.name == 'Body' else ''))
    return out


def export_frame(frame):
    arm, body, sockets, parts = frame_objects(frame)
    objs = [arm, body] + parts + sockets
    prepare_for_export(objs)
    renames = [(o, o.name) for o in objs] + [(o.data, o.data.name) for o in [body] + parts]
    # shape keys survive the exporter's "apply modifiers" path as long as only Armature modifiers remain (checked in
    # Blender 5.2): prepare_for_export has removed the outlines, so warn if anything else is left
    leftover = ['%s:%s' % (o.name, m.type) for o in objs if o.type == 'MESH' for m in o.modifiers if m.type != 'ARMATURE']
    if leftover:
        log('WARNING modifiers left on export (morph targets may be dropped):', ', '.join(leftover))
    try:
        # strip the frame from the names so both files read the same (one .blend holds both frames)
        stripped = ['Rig', 'Body'] + [p.name.rsplit('.', 1)[0] for p in parts]
        for o in [o for o in bpy.data.objects if o.name in stripped]:
            o.name = o.name + '.tmp'
        for me in [m for m in bpy.data.meshes if m.name in stripped]:
            me.name = me.name + '.tmp'
        arm.name = 'Rig'
        body.name = 'Body'
        body.data.name = 'Body'
        for p in parts:
            base = p.name.rsplit('.', 1)[0]
            p.name = base
            p.data.name = base
        for s in sockets:
            s.name = s.name.rsplit('.', 1)[0]
        lines = validate([body] + parts, arm) + morph_lines([body] + parts)
        kb = export_glb(os.path.join(OUT, 'hero_%s.glb' % frame), objs)
    finally:
        for o, n in renames:
            o.name = n
    return kb, lines


def main():
    open_source()
    sizes = {}
    report = []
    for f in FRAMES:
        kb, lines = export_frame(f)
        sizes[f] = kb
        report += ['## hero_%s.glb (%.1f KB)' % (f, kb)] + lines
    for line in report:
        log(line)
    if ARGS.get('check'):
        for f in FRAMES:
            for line in reimport_report(os.path.join(OUT, 'hero_%s.glb' % f)):
                log(line)


main()
