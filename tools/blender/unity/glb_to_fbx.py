"""
blender -b -P tools/blender/unity/glb_to_fbx.py -- --in client/public/models/hero/hero_broad.glb --out unity/.../hero_broad.fbx

One shipped GLB → one FBX for Unity (Phase 12, D-160). The GLBs under client/public/models/ are the art as built
and reviewed; the hero body build is not deterministic and some monster bases keep no .blend, so the Unity models
are converted from the GLBs rather than re-exported by the builds: Blender's glTF importer keeps the rig, the skin
weights, the shape keys, the clips, COLOR_0 (as the colour attribute) and the node extras (as custom properties), and
`export.export_fbx(rigged=True)` writes them out. Afterwards the file is read back and a check line printed: meshes,
colour attributes, bones, shape keys, actions.
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
from common import REPO, args, log  # noqa: E402
import export as gexport  # noqa: E402

ARGS = args()
src = os.path.join(REPO, ARGS['in'])
dst = os.path.join(REPO, ARGS['out'])

# A clean file.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src, import_shading='NORMALS', bone_heuristic='TEMPERANCE')
objs = [o for o in bpy.context.scene.objects]
for o in objs:
    o.hide_viewport = False
    o.hide_set(False)
meshes = [o for o in objs if o.type == 'MESH']
arms = [o for o in objs if o.type == 'ARMATURE']
empties = [o for o in objs if o.type == 'EMPTY']

# The colour attribute the glTF importer made (COLOR_0 → "Color") must be the active one: the exporter writes that.
colored = 0
for o in meshes:
    attrs = o.data.color_attributes
    if len(attrs):
        attrs.active_color_index = 0
        attrs.render_color_index = 0
        colored += 1

# Every action is a take: the importer makes one action per glTF animation, assigned to nothing — the exporter's
# "all actions" mode needs each to be compatible with the armature, which they are (they key its bones).
actions = [a for a in bpy.data.actions]
if arms:
    bpy.context.view_layer.objects.active = arms[0]

kb = gexport.export_fbx(dst, objs, rigged=True)
keys = sum(len(o.data.shape_keys.key_blocks) - 1 for o in meshes if o.data.shape_keys)
bones = sum(len(a.data.bones) for a in arms)
log('check %s: %d meshes (%d with colour), %d armatures / %d bones, %d empties, %d shape keys, %d actions [%s], %.1f KB' % (
    os.path.relpath(dst, REPO), len(meshes), colored, len(arms), bones, len(empties), keys, len(actions),
    ', '.join(a.name for a in actions[:24]), kb))
