"""build_sentinel.py — the `sentinel` base on the hero rig: the Vault Sentinel (docs/06-MONSTERS.md §3.3, §3.5;
tools/blender/README.md → Monsters).

Run:  blender -b -P tools/blender/monsters/build_sentinel.py -- [--quick] [--no-render] [--no-export]
Opens art/build/hero_species.blend (humanoid_lib.Session), builds the variant, renders the review set into
art/renders/monsters/sentinel/, saves art/build/monsters_sentinel.blend, writes client/public/models/monsters/
sentinel.glb and merges the variant into manifest.json.

A verdigris bronze statue-knight, 2.4 m (1.3): the Warden's S plate (cuirass with pauldrons, tassets and cuisses,
greaves and sabatons, gauntlets) cast in verdigris with bronze rims and its tabard left off, a tall bucket helm with a
glowing T-visor and a bronze crest, a blue crystal core set in the chest in a bronze mount, a dark core body showing in
the gaps, water running from the elbows and knees, a halberd (two-handed, Socket_HandR).
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import humanoid_lib as H  # noqa: E402
from common import BUILD, args, log, save_blend  # noqa: E402

ARGS = args()
QUICK = bool(ARGS.get('quick'))
BASE = 'sentinel'
D = math.radians
V = Vector
S0, S1, S2, WATER, SKIN, INK, CL1, CL2, LEA, MET, TRIM, GLOW, WOOD, BONE, GEM, CL3 = range(16)


def bucket_helm(plate, rim, glow, crest):
    """A tall flat-topped bucket helm with a glowing T-shaped visor (eyes and a nose slot) and a bronze crest."""
    k = H.Kit()
    cy = -0.02
    prof = [(0.122, 1.49), (0.128, 1.545), (0.131, 1.60), (0.132, 1.626), (0.132, 1.656), (0.130, 1.70), (0.124, 1.76),
            (0.11, 1.81)]
    n = 18
    rings = []
    for r, z in prof:
        rings.append([V((math.sin(2 * math.pi * q / n) * r * 0.97, cy - math.cos(2 * math.pi * q / n) * r * 1.12, z))
                      for q in range(n)])

    def ang(jq):
        return abs(((jq + 0.5) * 360 / n + 180) % 360 - 180)

    def sl(i, jq):
        a = ang(jq)
        if i == 3 and a < 56:
            return glow
        if i in (1, 2) and a < 11:
            return glow
        if i in (0, 6):
            return rim
        return plate
    for q in range(n):
        if ang(q) < 56:
            for i in (3, 4):
                p = rings[i][q]
                rings[i][q] = V((p.x * 0.975, (p.y - cy) * 0.96 + cy, p.z))
    k.rings(rings, sl, True, cap0=None, cap1=V((0, cy, 1.82)))
    inner = [V((p.x * 0.88, (p.y - cy) * 0.88 + cy, p.z + 0.012)) for p in rings[0]]
    k.rings([rings[0], inner], INK, True, flip=True)
    # the crest: a flat bronze fin front to back over the crown (round 1: a tube read as a carrying handle)
    fin = [V((-0.13, 0.0, 0)), V((-0.10, 0.05, 0)), V((-0.02, 0.095, 0)), V((0.08, 0.10, 0)), V((0.15, 0.06, 0)),
           V((0.16, 0.0, 0))]
    k.slab(fin, 0.014, crest, origin=V((0, cy, 1.805)), x=V((0, 1, 0)), y=V((0, 0, 1)))
    return k


def core_crystal(gem, mount, centre):
    """The chest core: a blue crystal (a long bipyramid) in a bronze ring mount, facing forward."""
    k = H.Kit()
    c = V(centre)
    fwd = V((0, -1, 0))
    ring = []
    for q in range(6):
        a = 2 * math.pi * q / 6
        ring.append(c + V((math.cos(a) * 0.032, 0.0, math.sin(a) * 0.05)))
    tip = c + fwd * 0.04
    b = len(k.verts)
    k.verts += ring + [tip]
    ip = b + 6
    for q in range(6):
        q2 = (q + 1) % 6
        k.faces.append((b + q, b + q2, ip))
        k.slots.append(gem)
    # orient: faces looking away from a point behind the crystal
    back = c - fwd * 0.03
    for i in range(len(k.faces) - 6, len(k.faces)):
        f = k.faces[i]
        pts = [k.verts[j] for j in f]
        nrm = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        if nrm.dot(sum(pts, V((0, 0, 0))) / 3 - back) < 0:
            k.faces[i] = tuple(reversed(f))
    k.torus(c + fwd * 0.004, fwd, 0.062, 0.011, 10, 4, mount)
    for q in range(4):
        a = math.pi / 4 + q * math.pi / 2
        p = c + V((math.cos(a) * 0.062, -0.006, math.sin(a) * 0.062))
        k.cone(p, p + V((math.cos(a) * 0.035, -0.004, math.sin(a) * 0.035)), 0.012, 4, mount)
    return k


def halberd(shaft, blade, spike):
    """A halberd (socket space: the shaft along +Y): an axe blade, a back hook and a long spike."""
    k = H.Kit()
    k.lathe([(0.02, -0.75), (0.019, 1.02)], 6, shaft, axis=V((0, 1, 0)), cap0='flat', cap1='flat')
    k.lathe([(0.026, 0.92), (0.026, 1.00)], 6, spike, axis=V((0, 1, 0)), cap0='flat', cap1='flat')
    k.cone(V((0, 1.0, 0)), V((0, 1.32, 0)), 0.024, 4, spike)
    # the axe blade on the +Z side (forward of the knuckles), edges in the YZ plane
    outline = [V((0.0, 0.0, 0)), V((0.08, -0.06, 0)), V((0.2, -0.1, 0)), V((0.25, 0.04, 0)), V((0.22, 0.2, 0)),
               V((0.1, 0.16, 0)), V((0.0, 0.12, 0))]
    k.slab(outline, 0.016, blade, origin=V((0, 0.92, 0.02)), x=V((0, 0, 1)), y=V((0, 1, 0)))
    hook = [V((0, 0.96, -0.02)), V((0, 0.98, -0.1)), V((0, 1.06, -0.16)), V((0, 1.12, -0.15))]
    k.tube(hook, [0.014, 0.012, 0.009, 0.003], 4, spike, 'flat', 'apex')
    k.lathe([(0.03, -0.78), (0.022, -0.70)], 6, spike, axis=V((0, 1, 0)), cap0='flat', cap1='flat')
    return k


def drips(sess, slot):
    """Water running from the elbows and knees: thin tapering streams (entries for Session.multi)."""
    out = []
    for pre, sgn in (('Left', 1), ('Right', -1)):
        for bone, at, lean in (('LowerArm', 0.05, V((0.02 * sgn, -0.01, 0))), ('LowerLeg', 0.04, V((0.0, -0.035, 0)))):
            a, b = sess.joint(pre + bone), sess.joint(pre + bone, 'tail')
            p = a + (b - a) * at + lean + V((0.045 * sgn, -0.035, 0.0))
            k = H.Kit()
            for q, dx in enumerate((-0.012, 0.012)):
                start = p + V((dx, 0, 0))
                k.tube([start, start + V((0, -0.01, -0.12)), start + V((0.004, -0.014, -0.26))], [0.007, 0.005, 0.0015],
                       3, slot, 'flat', 'apex')
            out.append((k, pre + bone))
    return out


VARIANTS = [
    dict(id='vault-sentinel', scale=1.3,
         colors=H.palette('#4f9a86', '#a8743a', '#5fd0ff', iris='#9fd8e8', ink='#0d1418', glow='#5fd0ff', gem='#7fe0ff',
                          metal='#a8743a', leather='#6b4a2a', wood='#5a4630', trim='#a8743a'),
         clipMap={'Attack1': 'Attack_Heavy', 'Attack2': 'Guard', 'Ward': 'Guard', 'Pulse': 'Roar'}),
]


def build(sess):
    pl = {6: S0, 10: S1, 11: GLOW, 8: S1}
    chest = sess.reuse('warden', 'gear_warden_chest_S.broad', 'sentinel_vault_chest', slot_map=pl, drop_slots=(7, 15),
                       props={'variant': 'vault', 'piece': 'chest'})
    legs = sess.reuse('warden', 'gear_warden_legs_S.broad', 'sentinel_vault_legs', slot_map=pl,
                      props={'variant': 'vault', 'piece': 'legs'})
    boots = sess.reuse('warden', 'gear_warden_boots_S.broad', 'sentinel_vault_boots', slot_map=pl,
                       props={'variant': 'vault', 'piece': 'boots'})
    gloves = sess.reuse('warden', 'gear_warden_gloves_S.broad', 'sentinel_vault_gloves', slot_map=pl,
                        props={'variant': 'vault', 'piece': 'gloves'})
    helm = sess.rigid('sentinel_vault_helm', bucket_helm(S0, S1, GLOW, S1), bone='Head',
                      props={'variant': 'vault', 'piece': 'helm'})
    core = sess.rigid('sentinel_vault_core', core_crystal(GEM, S1, V((0.0, -0.165, 1.26))), bone='UpperChest',
                      props={'variant': 'vault', 'piece': 'core'})
    body = sess.body_copy('sentinel_vault_inner', ratio=0.2)
    H.cull_hidden(body, [chest, legs, boots, gloves, helm])
    H.paint(body, INK, INK)
    sess.register(body, 'sentinel_vault_inner', {'variant': 'vault', 'piece': 'inner'})
    hal = H.Kit().extend(halberd(WOOD, S1, S1))
    hal.transform(sess.socket('Socket_HandR'))
    props = sess.multi('sentinel_vault_props', [(hal, 'RightHand')] + drips(sess, WATER),
                       {'variant': 'vault', 'piece': 'props'})
    return {'vault-sentinel': [body, chest, legs, boots, gloves, helm, core, props]}


def height_of(objs, v):
    z = 0.0
    for ob in objs:
        for vv in ob.data.vertices:
            z = max(z, (ob.matrix_world @ vv.co).z)
    return z * v['scale']


def main():
    sess = H.Session(BASE)
    parts = build(sess)
    vs = []
    for v in VARIANTS:
        v = dict(v, base=BASE, objs=parts[v['id']])
        v['tris'] = sum(H.tris_of(o) for o in v['objs'])
        v['height'] = height_of(v['objs'], v)
        vs.append(v)
        log('%s: %d tris, %.2f m, parts %s' % (v['id'], v['tris'], v['height'], [o.name for o in v['objs']]))
    if not ARGS.get('no_render'):
        rv = H.Review(sess, quick=QUICK)
        for v in vs:
            rv.look(v['objs'], v['id'], v['colors'])
        rv.lineup([(None, [])] + [(v, v['objs']) for v in vs], 'lineup.png', max(v['height'] for v in vs) + 0.1)
        for v in vs:
            rv.card(v, v['objs'], 'card_%s.png' % v['id'])
        rv.heads(vs, 'heads.png')
        for v in vs:
            rv.strip(v, v['objs'], H.strip_frames(v), 'clips_%s.png' % v['id'])
        H.poke_lines(rv, vs)
    H.L.rest(sess.rig)
    save_blend(os.path.join(BUILD, 'monsters_%s.blend' % BASE))
    if not ARGS.get('no_export'):
        objs = [o for v in vs for o in v['objs']]
        for o in objs:
            o['tris'] = H.tris_of(o)
            o['monsters'] = [v['id'] for v in vs if o in v['objs']]
        kb = H.export_base(sess, objs)
        H.write_manifest({v['id']: H.manifest_entry(v, [o.name for o in v['objs']], sess.rig) for v in vs})
        log('sentinel.glb %.1f KB' % kb)
        H.reimport_check(BASE)


main()
