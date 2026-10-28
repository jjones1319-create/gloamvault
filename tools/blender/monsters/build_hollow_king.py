"""build_hollow_king.py — the `hollow-king` base on the hero rig: the Hollow King and his throne (docs/06-MONSTERS.md
§3.4, §3.5; tools/blender/README.md → Monsters).

Run:  blender -b -P tools/blender/monsters/build_hollow_king.py -- [--quick] [--no-render] [--no-export]
Opens art/build/hero_species.blend (humanoid_lib.Session), builds the King and the throne, renders the review set
into art/renders/monsters/hollow-king/, saves art/build/monsters_hollow-king.blend, writes client/public/models/
monsters/hollow-king.glb and merges the entry into manifest.json.

The King (2.0: 3.6 m standing): the Warden's S plate gone barnacle-black with dark iron rims and drowned-blue glow
lines, a tattered royal tabard, a closed helm with a lit visor and water running from it, a crown of iron and coral,
a tattered royal cape, chains across the chest and hanging from shackles at both wrists, barnacle crusts, the Hollow
Blade (the hero greatsword S re-forged dark, coral and blue). His **throne** is a rigid prop (no skin): an iron seat
on a plinth with a tall spiked back, armrests, chains wrapped round it and run down into the water to floor rings,
coral and barnacles; and the **column** it rises on in phase 2. Both are modelled at the King's unscaled size: the
client scales them with the King (`scale`) and sets them at his origin. Phase 1 holds the seated pose (`poseHold` on
the legs and arms, `hipsOffset` for the pelvis) over the hero Idle.
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
BASE = 'hollow-king'
D = math.radians
V = Vector
S0, S1, S2, PALE, SKIN, INK, CL1, CL2, LEA, MET, TRIM, GLOW, WOOD, BONE, GEM, CL3 = range(16)

SEATED = {'Hips.loc': (0.0, -0.40, -0.03),
          'LeftUpperLeg': (88, 0, -6), 'RightUpperLeg': (88, 0, 6),
          'LeftLowerLeg': (-88, 0, 0), 'RightLowerLeg': (-88, 0, 0),
          'LeftFoot': (4, 0, 0), 'RightFoot': (4, 0, 0),
          'LeftUpperArm': (28, 0, -18), 'LeftLowerArm': (70, 0, 0), 'LeftHand': (0, 0, 0),
          'RightUpperArm': (28, 0, 18), 'RightLowerArm': (70, 0, 0), 'RightHand': (0, 0, 0)}


def king_helm(plate, rim, glow, water):
    """A closed helm with a lit visor slit and water running down from it (on Head)."""
    k = H.Kit()
    cy = -0.02
    prof = [(0.12, 1.50), (0.126, 1.55), (0.129, 1.60), (0.13, 1.627), (0.13, 1.655), (0.128, 1.70), (0.12, 1.755),
            (0.098, 1.80)]
    n = 18
    rings = []
    for r, z in prof:
        rings.append([V((math.sin(2 * math.pi * q / n) * r * 0.97, cy - math.cos(2 * math.pi * q / n) * r * 1.14, z))
                      for q in range(n)])

    def ang(jq):
        return abs(((jq + 0.5) * 360 / n + 180) % 360 - 180)

    def sl(i, jq):
        if i == 3 and ang(jq) < 54:
            return glow
        if i in (0, 6):
            return rim
        return plate
    for q in range(n):
        if abs((q * 360 / n + 180) % 360 - 180) < 54:
            for i in (3, 4):
                p = rings[i][q]
                rings[i][q] = V((p.x * 0.975, (p.y - cy) * 0.955 + cy, p.z))
    k.rings(rings, sl, True, cap0=None, cap1=V((0, cy, 1.815)))
    inner = [V((p.x * 0.88, (p.y - cy) * 0.88 + cy, p.z + 0.012)) for p in rings[0]]
    k.rings([rings[0], inner], INK, True, flip=True)
    # water running down from the visor over the face-plate
    # (round 1: four even drips read as the bars of a portcullis visor — three, uneven, thinner)
    for q, (x, ln) in enumerate(((-0.055, 0.09), (-0.008, 0.14), (0.05, 0.07))):
        y0 = cy - 0.146 + 0.9 * x * x
        top = V((x, y0 - 0.004, 1.626))
        k.tube([top, top + V((0.0, -0.004, -ln * 0.45)), top + V((0.003 * (1 - 2 * (q % 2)), -0.002, -ln))],
               [0.0045, 0.0032, 0.001], 3, water, 'flat', 'apex')
    return k


def crown(iron, coral, n=10):
    """A crown of iron and coral: an iron band round the helm's brow with branching coral rising from it."""
    k = H.Kit()
    cy = -0.02
    rings = []
    for z, s in ((1.70, 1.0), (1.745, 1.0)):
        rings.append([V((math.sin(2 * math.pi * q / 20) * 0.136 * s, cy - math.cos(2 * math.pi * q / 20) * 0.155 * s, z))
                      for q in range(20)])
    k.rings(rings, iron, True)
    for q in range(n):
        a = 2 * math.pi * (q + 0.5) / n
        out = V((math.sin(a), -math.cos(a), 0.0))
        base = V((math.sin(a) * 0.14, cy - math.cos(a) * 0.158, 1.735))
        h = 0.10 if math.cos(a) > 0.3 else 0.07
        tip = base + out * 0.03 + V((0, 0, h))
        k.tube([base, base + out * 0.012 + V((0, 0, h * 0.55)), tip], [0.011, 0.008, 0.004], 4, coral, 'flat', 'apex')
        side = out.cross(V((0, 0, 1))).normalized()
        mid = base + out * 0.012 + V((0, 0, h * 0.5))
        k.tube([mid, mid + side * 0.025 + V((0, 0, h * 0.3))], [0.006, 0.003], 4, coral, 'flat', 'apex')
    return k


def cape(sess, K, cloth, trim):
    """A tattered royal cape from the shoulders to the backs of the knees, its hem torn in points, bound to the body
    (the upper arms move it at most a third)."""
    import gear_loft as L
    T = K.torso
    cols = [100, 118, 136, 152, 168, 180, 192, 208, 224, 242, 260]
    rows = []
    for i, (z, off) in enumerate(((1.45, 0.03), (1.36, 0.045), (1.20, 0.06), (1.0, 0.075), (0.80, 0.09), (0.58, 0.10))):
        row = []
        for q, c in enumerate(cols):
            th = D(c)
            zz = z
            if i == 5:
                zz = z - (0.07 if q % 2 else 0.0) - 0.03 * math.sin(q * 1.9)
            p = T.pt(K.tz(max(zz, 0.52)), th, off)
            if zz < 0.95:
                # below the waist the cape hangs straight down behind the legs
                q_ = T.pt(K.tz(0.95), th, off)
                p = V((p.x * 0.9 + q_.x * 0.1, max(p.y, q_.y) + (0.95 - zz) * 0.12, zz))
            row.append(p)
        rows.append(row)
    g = L.Grid()
    g.rows(rows, lambda i, j: trim if i == 0 else cloth, orient=V((0, -0.05, 1.1)))
    part = L.Part('cape', sess.fg.piece('cape', g, K.f_torso), allow=['Hips', 'Spine', 'Chest', 'UpperChest',
                                                                     'LeftShoulder', 'RightShoulder', 'LeftUpperArm',
                                                                     'RightUpperArm'],
                  smooth=4, clear=0.02, over=('hollow-king_king_chest',), gap=0.012, reach=0.08,
                  cap={'LeftUpperArm': 0.3, 'RightUpperArm': 0.3})
    return [part]


def chains(sess, iron):
    """[(kit, bone)]: a chain across the chest from the left shoulder to the right hip, shackles with hanging chain
    at both wrists."""
    out = []
    k = H.Kit()
    k.chain([V((0.17, -0.10, 1.41)), V((0.08, -0.175, 1.30)), V((-0.04, -0.19, 1.15)), V((-0.15, -0.15, 1.0))], 0.06,
            0.0075, iron)
    out.append((k, 'Chest'))
    for pre, sgn in (('Left', 1), ('Right', -1)):
        a, b = sess.joint(pre + 'LowerArm'), sess.joint(pre + 'LowerArm', 'tail')
        ax = (b - a).normalized()
        c = a + (b - a) * 0.86
        k = H.Kit()
        k.lathe([(0.052, -0.022), (0.056, -0.012), (0.056, 0.012), (0.052, 0.022)], 10, iron, axis=ax, centre=c,
                cap0=None, cap1=None)
        start = c + V((0.0, 0.0, -0.04))
        k.chain([start, start + V((0.01 * sgn, -0.02, -0.14)), start + V((0.02 * sgn, -0.01, -0.30))], 0.055, 0.007, iron)
        out.append((k, pre + 'LowerArm'))
    return out


def barnacle_kit(spots, slot):
    k = H.Kit()
    for ci, (c, n, cnt) in enumerate(spots):
        c, n = V(c), V(n).normalized()
        t1 = n.orthogonal().normalized()
        t2 = n.cross(t1)
        for q in range(cnt):
            a = q * 2.399 + ci
            r = 0.02 + 0.012 * (q % 3)
            p = c + (t1 * math.cos(a) + t2 * math.sin(a)) * r * (0.5 + 0.5 * (q % 2))
            h = 0.02 + 0.006 * ((q + ci) % 3)
            k.lathe([(0.016 - 0.002 * (q % 3), 0.0), (0.008, h)], 5, slot, axis=n, centre=p - n * 0.004, cap0=None,
                    cap1='flat')
    return k


# ====================================================================== the throne (rigid, unskinned)
def throne(iron, dark, coral, pale, glow):
    """The chained iron throne at the King's unscaled size (the client scales it with him): seat top at 0.40 m,
    the back rising to 1.75 m, spikes, armrests, a plinth with a step, chains to floor rings, coral and barnacles."""
    k = H.Kit()
    # plinth and step
    k.box(V((0, -0.03, 0.15)), V((0.36, 0, 0)), V((0, 0.29, 0)), V((0, 0, 0.15)), dark)
    k.box(V((0, -0.38, 0.045)), V((0.40, 0, 0)), V((0, 0.07, 0)), V((0, 0, 0.045)), dark)
    # seat
    k.box(V((0, -0.05, 0.35)), V((0.32, 0, 0)), V((0, 0.24, 0)), V((0, 0, 0.05)), iron)
    # back: a tapering slab with a pointed top and a rim
    out = [V((-0.32, 0.0, 0)), V((0.32, 0.0, 0)), V((0.30, 0.9, 0)), V((0.24, 1.18, 0)), V((0.0, 1.38, 0)),
           V((-0.24, 1.18, 0)), V((-0.30, 0.9, 0))]
    k.slab(out, 0.07, iron, rim_slot=dark, origin=V((0, 0.215, 0.40)), x=V((1, 0, 0)), y=V((0, 0, 1)))
    # a glowing rune down the back's face
    for q in range(4):
        z = 0.62 + 0.2 * q
        k.box(V((0, 0.176, z)), V((0.018 + 0.008 * (q % 2), 0, 0)), V((0, 0.003, 0)), V((0, 0, 0.05)), glow)
    # spikes along the top of the back
    for x, z, h in ((-0.27, 1.32, 0.16), (-0.13, 1.62, 0.2), (0.0, 1.80, 0.24), (0.13, 1.62, 0.2), (0.27, 1.32, 0.16)):
        k.cone(V((x, 0.215, z - 0.04)), V((x * 1.15, 0.215, z + h)), 0.04, 4, dark)
    # armrests on posts
    for sgn in (1, -1):
        k.box(V((0.36 * sgn, -0.02, 0.55)), V((0.05, 0, 0)), V((0, 0.24, 0)), V((0, 0, 0.035)), iron)
        k.box(V((0.36 * sgn, -0.22, 0.45)), V((0.04, 0, 0)), V((0, 0.04, 0)), V((0, 0, 0.10)), dark)
        k.sphere(V((0.36 * sgn, -0.24, 0.6)), 0.05, 8, 4, iron)
    # chains: from the back's shoulders round the front of the plinth and down to rings on the floor
    for sgn in (1, -1):
        k.chain([V((0.30 * sgn, 0.24, 1.1)), V((0.40 * sgn, 0.1, 0.8)), V((0.42 * sgn, -0.2, 0.42)),
                 V((0.55 * sgn, -0.45, 0.12)), V((0.62 * sgn, -0.6, 0.02))], 0.07, 0.009, iron)
        k.torus(V((0.63 * sgn, -0.62, 0.012)), V((0, 0, 1)), 0.05, 0.012, 10, 4, iron)
    k.chain([V((-0.36, -0.33, 0.27)), V((-0.12, -0.36, 0.20)), V((0.12, -0.36, 0.20)), V((0.36, -0.33, 0.27))], 0.07,
            0.009, iron)
    # coral on the back's upper corners, barnacles on the plinth
    for sgn in (1, -1):
        base = V((0.27 * sgn, 0.25, 1.12))
        for q in range(3):
            d = V((0.4 * sgn + 0.2 * q * sgn, 0.3, 1.0)).normalized()
            k.tube([base, base + d * 0.08, base + d * 0.13 + V((0, 0, 0.05))], [0.016, 0.011, 0.004], 4, coral, 'flat', 'apex')
    k.extend(barnacle_kit([((0.25, -0.32, 0.22), (0.2, -1, 0.1), 6), ((-0.3, -0.3, 0.12), (-0.3, -1, 0), 5),
                           ((0.36, 0.1, 0.25), (1, 0, 0), 4), ((-0.36, 0.05, 0.3), (-1, 0, 0.1), 4)], pale))
    return k


def column(stone, rim):
    k = H.Kit()
    k.lathe([(0.46, 0.0), (0.42, 0.06), (0.36, 0.1), (0.36, 0.92), (0.42, 0.96), (0.46, 1.0)], 12, stone,
            axis=V((0, 0, 1)), centre=V((0, -0.03, -1.0)), cap0=None, cap1='flat')
    return k


VARIANTS = [
    dict(id='hollow-king', scale=2.0,
         colors=H.palette('#1f2226', '#e0703a', '#5fc8ff', iris='#9fd8e8', ink='#0a0c10', glow='#5fc8ff', gem='#8fe0ff',
                          metal='#3a3f45', leather='#2a2420', cloth1='#2b2236', cloth2='#4a3b5c', cloth3='#1a1620',
                          trim='#8a7440', wood='#3a3029'),
         clipMap={'Attack1': 'Attack_Heavy', 'Attack2': 'Attack_Light', 'Attack3': 'Attack_Dual', 'Verdict': 'Cast',
                  'Grip': 'Attack_Light', 'Undertow': 'Roar', 'Snuff': 'Cast', 'Rise': 'Revive', 'Move': 'Walk'}),
]


def build(sess, K):
    def ragged(c, s, bone):
        return s in (7, 15) and c.z < 0.62 + 0.10 * (0.5 + 0.5 * math.sin(c.x * 91.0 + c.y * 33.0))
    pl = {6: S0, 10: MET, 11: GLOW, 8: LEA, 7: CL1, 15: CL2}
    chest = sess.reuse('warden', 'gear_warden_chest_S.broad', 'hollow-king_king_chest', slot_map=pl, drop=ragged,
                       props={'variant': 'king', 'piece': 'chest'})
    legs = sess.reuse('warden', 'gear_warden_legs_S.broad', 'hollow-king_king_legs', slot_map=pl,
                      props={'variant': 'king', 'piece': 'legs'})
    boots = sess.reuse('warden', 'gear_warden_boots_S.broad', 'hollow-king_king_boots', slot_map=pl,
                       props={'variant': 'king', 'piece': 'boots'})
    gloves = sess.reuse('warden', 'gear_warden_gloves_S.broad', 'hollow-king_king_gloves', slot_map=pl,
                        props={'variant': 'king', 'piece': 'gloves'})
    cp = sess.make('hollow-king_king_cape', cape(sess, K, CL1, TRIM), {'variant': 'king', 'piece': 'cape'})
    hk = H.Kit().extend(king_helm(S0, MET, GLOW, PALE))
    hk.extend(crown(MET, S1))
    helm = sess.rigid('hollow-king_king_helm', hk, bone='Head', props={'variant': 'king', 'piece': 'helm'})
    body = sess.body_copy('hollow-king_king_inner', ratio=0.2)
    H.cull_hidden(body, [chest, legs, boots, gloves, helm, cp])
    H.paint(body, INK, INK)
    sess.register(body, 'hollow-king_king_inner', {'variant': 'king', 'piece': 'inner'})
    sw_k, sw_bone = None, 'RightHand'
    sword = sess.weapon('wpn_greatsword_S', 'hollow-king_king_sword', 'Socket_HandR',
                        slot_map={9: MET, 10: S1, 14: GLOW, 11: GLOW, 8: LEA}, props={'variant': 'king', 'piece': 'sword'})
    spots = [((0.21, -0.02, 1.47), (0.5, -0.2, 1.0), 6), ((-0.22, 0.02, 1.46), (-0.5, 0.1, 1.0), 6),
             ((0.11, -0.13, 0.62), (0.4, -1.0, 0.0), 5), ((-0.1, 0.12, 1.1), (-0.2, 1.0, 0.2), 5)]
    barn = sess.make('hollow-king_king_barnacles', [sess.bound('barnacles', barnacle_kit(spots, PALE), orient='body',
                                                               smooth=2, clear=0.02)],
                     {'variant': 'king', 'piece': 'barnacles'})
    ch = sess.multi('hollow-king_king_chains', chains(sess, MET), {'variant': 'king', 'piece': 'chains'})
    king = [body, chest, legs, boots, gloves, cp, helm, sword, barn, ch]
    # the throne and the column: rigid props, no skin
    th = []
    for name, kit in (('hollow-king_throne_seat', throne(MET, S0, S1, PALE, GLOW)), ('hollow-king_throne_column', column(S0, MET))):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in kit.verts], [], [tuple(f) for f in kit.faces])
        me.update()
        ob = bpy.data.objects.new(name, me)
        H.collection(H.COL).objects.link(ob)
        H.toon.set_vertex_codes(me, slots=[0] * len(me.vertices), regions=[0] * len(me.vertices))
        H.toon.split_by_face_slots(ob, list(kit.slots))
        H.set_angle_normals(ob.data, 35)
        sess.register(ob, name, {'variant': 'throne', 'piece': name.split('_')[-1], 'kind_prop': 'throne',
                                 'rigid': True})
        th.append(ob)
    return king, th


def height_of(objs, scale):
    z = 0.0
    for ob in objs:
        for vv in ob.data.vertices:
            z = max(z, (ob.matrix_world @ vv.co).z)
    return z * scale


def main():
    sess = H.Session(BASE)
    K = sess.K
    king, th = build(sess, K)
    v = dict(VARIANTS[0], base=BASE, objs=king)
    v['tris'] = sum(H.tris_of(o) for o in king)
    v['height'] = height_of(king, v['scale'])
    seat, col = th
    tt = H.tris_of(seat) + H.tris_of(col)
    log('%s: %d tris (+ throne %d, column %d), %.2f m' % (v['id'], v['tris'], H.tris_of(seat), H.tris_of(col), v['height']))
    seated = dict(v, id='hollow-king (seated, phase 1)', poseHold=SEATED, objs=king + [seat])
    if not ARGS.get('no_render'):
        rv = H.Review(sess, quick=QUICK)
        rv.look(king, 'king', v['colors'])
        rv.look(th, 'king', v['colors'])
        s = v['scale']
        seat.scale = (s, s, s)
        col.scale = (s, s, s)
        seat.hide_render = True
        col.hide_render = True
        seated['height'] = height_of([seat], s)
        rv.lineup([(None, []), (seated, seated['objs']), (v, king)], 'lineup.png', max(v['height'], seated['height']) + 0.15)
        rv.card(seated, seated['objs'], 'card_seated.png')
        rv.card(v, king, 'card_risen.png')
        rv.heads([v], 'heads.png')
        rv.strip(v, king, H.strip_frames(v), 'clips_hollow-king.png')
        H.poke_lines(rv, [v])
        # the throne alone, and risen on its column
        rv.show([seat, col])
        col.location = (0, 0, 0)
        seat.location = (0, 0, 0)
        rv.cell_camera(6.2, az=30, el=18, fill=1.0)
        rv.st.shot('throne.png')
        seat.location = (0, 0, 1.0 * s)
        col.location = (0, 0, 1.0 * s)
        rv.st.shot('throne_risen.png')
        seat.location = col.location = (0, 0, 0)
        seat.scale = col.scale = (1, 1, 1)
    H.L.rest(sess.rig)
    save_blend(os.path.join(BUILD, 'monsters_%s.blend' % BASE))
    if not ARGS.get('no_export'):
        for o in king:
            o['tris'] = H.tris_of(o)
            o['monsters'] = ['hollow-king']
        for o in th:
            o['tris'] = H.tris_of(o)
            o['monsters'] = ['hollow-king']
        kb = H.export_base(sess, king + th)
        e = H.manifest_entry(v, [o.name for o in king], sess.rig)
        # the seated pelvis offset measured in the rig's own space and given in glTF axes (x, z, −y) at scale 1
        rig = sess.rig
        H.L.rest(rig)
        h0 = rig.matrix_world @ rig.pose.bones['Hips'].head
        rig.pose.bones['Hips'].location = SEATED['Hips.loc']
        bpy.context.view_layer.update()
        h1 = rig.matrix_world @ rig.pose.bones['Hips'].head
        H.L.rest(rig)
        dlt = h1 - h0
        hips_gltf = [round(dlt.x, 4), round(dlt.z, 4), round(-dlt.y, 4)]
        seat_q = {}
        for b, rot in SEATED.items():
            if b == 'Hips.loc':
                continue
            seat_q[b] = H.gltf_quat(rot, sess.rig.pose.bones[b].rotation_mode)
        e['props'] = {'throne': {'parts': [seat.name], 'column': col.name, 'rigid': True, 'scaleWithMonster': True,
                                 'seatHeight': 0.40, 'columnHeight': 1.0,
                                 'note': 'unskinned, at the King\'s unscaled size: scale with `scale`, place at his origin; '
                                         'phase 2 raises the throne by columnHeight×scale on the column'}}
        e['phases'] = {
            '1': {'name': 'the Seated King', 'pose': 'seated', 'poseHold': seat_q,
                  'hipsOffset': hips_gltf,
                  'note': 'hold these joints (poseHold, as everywhere: joint.quaternion = rest × q) over the hero Idle '
                          'and add hipsOffset to the Hips joint position — glTF axes, metres at scale 1 (multiply by '
                          'the monster scale with the rest of the rig); the throne seat then sits under him'},
            '2': {'name': 'the Guard Wakes', 'pose': 'standing', 'note': 'the throne rises on its column; he stands'},
            '3': {'name': 'the Tide Comes In', 'clipSpeed': 1.2},
        }
        H.write_manifest({'hollow-king': e})
        log('hollow-king.glb %.1f KB' % kb)
        H.reimport_check(BASE)


main()
