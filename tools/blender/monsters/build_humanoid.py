"""build_humanoid.py — the `humanoid` base on the hero rig: the Grinning Company and the Tidebound cult
(docs/06-MONSTERS.md §3.1, §3.3, §3.5; tools/blender/README.md → Monsters).

Run:  blender -b -P tools/blender/monsters/build_humanoid.py -- [--quick] [--no-render] [--no-export] [--only id,id]
Opens art/build/hero_species.blend (humanoid_lib.Session), builds every variant, renders the review set into
art/renders/monsters/humanoid/, saves art/build/monsters_humanoid.blend, writes client/public/models/monsters/
humanoid.glb and merges the variants into manifest.json.

Every variant is the hero body (decimated, culled to what its costume leaves visible, skin in slot 4 unless the
monster's main colour is its skin) under a costume of gear_loft pieces (`costume_lib`) and/or re-used hero gear, with
rigid props skinned to their bones. Costume sets:
- **bandit A** (Cutpurse, Crossbowman, Netter, Hexer): a crude hood and short pointed capelet, a leather jerkin over
  a dirty shirt, bracers, trousers, rough boots, belt and sash; the face behind a white half-mask with a painted grin
  (the Hexer: a cracked full mask in bone with one green glowing eye). Props: dagger + purse; crossbow + bolt quiver;
  gaff hook + coiled net; bone fetishes.
- **bandit B** (Bruiser, 1.25, brute bone scales): the Blade's F mail (hauberk, chausses, boots) rusted, a mail hood,
  a full grin-mask; a studded club.
- **bandit C** (Captain Vexa Marrow): a scarlet frock coat with brass buttons over a white shirt, dark breeches, tall
  boots, long dark hair, the lacquered grin-mask pushed up on her brow; a cutlass and a throwing knife.
- **cult A** (Acolyte, Blade): the Mender's F robe and cowl re-dyed wet grey, barefoot; the Acolyte's sea-green
  stole and a great conch at the belt; the Blade's sewn mouth and two boat-hooks.
- **cult B** (Flagellant): shirtless (raw skin), a grey penitent's hood and breeches, wrapped in barbed chain, a
  hooked length of chain trailing from the right hand.
- **cult C** (Drowner, 1.3): the Warden's F plate in lead grey under a riveted brass diving-bell helm with glass
  ports, lead weights at the belt; an anchor maul.
- **crone** (Brine Hag): salt-white skin, gaunt and long-limbed (bone scales, a hunch), a torn drowned-blue dress,
  long grey hair, a crown of brine pearls, claws, a salt pouch.
- **cult D** (Sister Naesa): phase 1 the Mender's robe and cowl in pearl white sewn with pearls and a conch staff;
  phase 2 the shroud torn, the arms become two tentacles, 1.28.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import costume_lib as C  # noqa: E402
import humanoid_lib as H  # noqa: E402
from common import BUILD, args, log, save_blend  # noqa: E402

ARGS = args()
QUICK = bool(ARGS.get('quick'))
ONLY = set(ARGS['only'].split(',')) if ARGS.get('only') else None
BASE = 'humanoid'
L = H.L
D = math.radians
V = Vector
S0, S1, S2, EYE, SKIN, INK, CL1, CL2, LEA, MET, TRIM, GLOW, WOOD, BONE, GEM, CL3 = range(16)
KEEP = ('hair_long.broad', 'hair_shaggy.broad', 'hair_tied.broad')


def part_copy(sess, src, name, slot_map=None, drop_faces=None, ratio=None, props=None):
    """A copy of a species part from the source blend (hair) as a monster piece: keys gone, slots re-mapped."""
    ob = bpy.data.objects[src]
    me = ob.data.copy()
    new = bpy.data.objects.new(name, me)
    H.collection(H.COL).objects.link(new)
    new.parent = sess.rig
    am = new.modifiers.new('Armature', 'ARMATURE')
    am.object = sess.rig
    if me.shape_keys:
        new.shape_key_clear()
    me.materials.clear()
    codes = H.toon.vertex_codes(me)
    if slot_map:
        H.toon.set_vertex_codes(me, slots=[slot_map.get(s, s) for s, _ in codes], regions=[0] * len(codes))
    if ratio:
        H.decimate_piece(new, ratio)
    return sess.register(new, name, props or {})


# ====================================================================== bandit sets
def bandit_A(sess, K, vid, S, coat_hem=0.86, glow_eye=None, full_mask=False, mask_slot=None, lips=None):
    """The bandit A costume for one variant: returns (outfit object, head object). S maps roles to slots:
    hood, jerkin, mask, sash, shirt, trousers, leather, metal."""
    parts = []
    parts += C.trousers(sess, K, S['trousers'])
    parts += C.boots(sess, K, S['leather'], cuff=None, top=0.3)
    parts += C.sleeves(sess, K, S['shirt'], t_end=0.98)
    parts += C.bracers(sess, K, S['leather'])
    parts.append(C.jerkin(sess, K, S['jerkin'], hem=coat_hem, ragged=0.03 if coat_hem < 0.8 else 0.0,
                          seam=S.get('seam'), studs=S.get('studs')))
    parts.append(C.belt(sess, K, S['leather'], S['metal']))
    if S.get('sash') is not None:
        parts += C.sash(sess, K, S['sash'], z=1.035, knot_side=1)
    parts.append(C.capelet(sess, K, S['hood']))
    outfit = sess.make('humanoid_%s_outfit' % vid, parts, {'variant': vid, 'piece': 'outfit'})
    hp = [C.hood(sess, K, S['hood'], INK, open_c=-10.0 if not full_mask else -8.0, open_a=36.0, open_w=62.0)]
    if full_mask:
        top = [(0, 30.0), (30, 26.0), (55, 18.0), (75, 10.0)]
        mpart, Cs = C.face_mask(sess, K, mask_slot, top=top, eyes=(-14.0, 2.0, 12.0, 38.0), eye_slot=INK,
                                glow_eye=glow_eye, rows=8)
    else:
        mpart, Cs = C.face_mask(sess, K, S['mask'])
    hp.append(mpart)
    hp.append(C.grin(sess, K, INK, S['mask'] if not full_mask else mask_slot, lips=lips, C=Cs))
    head = sess.make('humanoid_%s_head' % vid, hp, {'variant': vid, 'piece': 'head'})
    return outfit, head


def body_for(sess, vid, covers, skin=SKIN, eye=INK, ratio=0.2, face=None, keep=None, cut=None, paint=None, drop=(),
             keep_regions=()):
    """The variant's body: decimated, cut, culled under its covers (regions a re-used hero piece hides by itself go
    outright, plus `drop`), painted."""
    b = sess.body_copy('humanoid_%s_body' % vid, ratio=ratio, face=face)
    n0 = H.tris_of(b)
    if cut:
        H.cut_faces(b, cut)
    drop_r = set(drop)
    for c in covers:
        drop_r.update(sess.hides.get(c.name, []))
    if covers:
        H.cull_hidden(b, covers, keep=keep, drop_regions=drop_r, keep_regions=keep_regions)
    log('body %s: %d -> %d tris (dropped regions %s)' % (vid, n0, H.tris_of(b), sorted(drop_r)))
    H.paint(b, skin, eye, paint)
    return sess.register(b, 'humanoid_%s_body' % vid, {'variant': vid, 'piece': 'body'})


def props_for(sess, vid, entries):
    """Rigid props as one object: entries [(kit in world space, bone)]."""
    return sess.multi('humanoid_%s_props' % vid, entries, {'variant': vid, 'piece': 'props'})


def held(sess, src, socket, slot_map=None, M=None):
    """A hero weapon's kit placed at a socket's rest position (world space) and the bone it rides."""
    before = set(bpy.data.objects)
    with bpy.data.libraries.load(H.WEAPONS_BLEND, link=False) as (s, d):
        d.objects = [src]
    ob = d.objects[0]
    for o in set(bpy.data.objects) - before:
        if o is not ob:
            bpy.data.objects.remove(o, do_unlink=True)
    me = ob.data
    codes = H.toon.vertex_codes(me)
    k = H.Kit()
    k.verts = [v.co.copy() for v in me.vertices]
    k.faces = [tuple(p.vertices) for p in me.polygons]
    for p in me.polygons:
        ss = [codes[v][0] for v in p.vertices]
        s_ = max(set(ss), key=ss.count)
        k.slots.append((slot_map or {}).get(s_, s_))
    bpy.data.objects.remove(ob, do_unlink=True)
    if M is not None:
        k.transform(M)
    k.transform(sess.socket(socket))
    return k, sess.sockets[socket].parent_bone


def own(sess, kit, socket):
    k = kit.copy()
    k.transform(sess.socket(socket))
    return k, sess.sockets[socket].parent_bone


def v_cutpurse(sess, K):
    S = dict(hood=S0, jerkin=S0, mask=S1, sash=S2, shirt=CL2, trousers=CL1, leather=LEA, metal=MET)
    outfit, head = bandit_A(sess, K, 'cutpurse', S, lips=S2)
    body = body_for(sess, 'cutpurse', [outfit, head])
    pr = [held(sess, 'wpn_dagger_F', 'Socket_HandR'), (C.hang(sess, V((-0.175, -0.06, 0.95)), C.purse(LEA, S2)), 'Hips')]
    return [body, outfit, head, props_for(sess, 'cutpurse', pr)]


def v_crossbowman(sess, K):
    S = dict(hood=S0, jerkin=S0, mask=S1, sash=None, shirt=CL2, trousers=CL1, leather=LEA, metal=MET, studs=MET)
    outfit, head = bandit_A(sess, K, 'crossbowman', S, lips=None)
    body = body_for(sess, 'crossbowman', [outfit, head])
    q = C.bolt_quiver(S2, WOOD, MET)
    q.transform(Matrix.Translation(V((-0.19, 0.04, 0.80))) @ Matrix.Rotation(D(-14), 4, 'Y'))
    pr = [held(sess, 'wpn_crossbow_F', 'Socket_HandR'), (q, 'Hips')]
    return [body, outfit, head, props_for(sess, 'crossbowman', pr)]


def v_netter(sess, K):
    S = dict(hood=S2, jerkin=S2, mask=S1, sash=None, shirt=CL2, trousers=CL1, leather=LEA, metal=MET)
    outfit, head = bandit_A(sess, K, 'netter', S, coat_hem=0.66, lips=None)
    body = body_for(sess, 'netter', [outfit, head])
    net = C.net_coil(sess, S0, WOOD)

    def w_net(p):
        s = H.smoothstep(1.02, 1.32, p.z)
        return {'UpperChest': s, 'Hips': 1 - s}
    nk = sess.rigid('humanoid_netter_net', net, weights=w_net, props={'variant': 'netter', 'piece': 'net'})
    pr = [own(sess, C.gaff(WOOD, MET), 'Socket_HandR')]
    return [body, outfit, head, nk, props_for(sess, 'netter', pr)]


def v_hexer(sess, K):
    S = dict(hood=S1, jerkin=S1, mask=S0, sash=None, shirt=CL2, trousers=CL1, leather=LEA, metal=MET)
    outfit, head = bandit_A(sess, K, 'hexer', S, full_mask=True, mask_slot=S0, glow_eye=1)
    body = body_for(sess, 'hexer', [outfit, head])
    f1 = C.fetishes(S0, LEA)
    f1.transform(Matrix.Translation(V((0.0, -0.13, 0.96))))
    f2 = C.fetishes(S0, LEA)
    f2.transform(Matrix.Translation(V((0.0, -0.118, 1.37))) @ Matrix.Scale(0.8, 4))
    # the glowing eye: a green gem standing proud of the mask's left eye (round 2: the painted eye hid at 3/4 views)
    ge = H.Kit()
    ge.sphere(K.head.pt(D(-6), D(25), 0.012), 0.017, 8, 5, GLOW, scale=(1.0, 0.75, 1.0))
    f3 = C.fetishes(S0, LEA)
    f3.transform(Matrix.Translation(V((0.17, -0.02, 0.95))) @ Matrix.Rotation(D(80), 4, 'Z') @ Matrix.Scale(0.9, 4))
    pr = [(f1, 'Hips'), (f2, 'UpperChest'), (f3, 'Hips'), (ge, 'Head')]
    return [body, outfit, head, props_for(sess, 'hexer', pr)]


def v_bruiser(sess, K):
    mail = {9: S0, 8: S2, 7: CL2}
    chest = sess.reuse('blade', 'gear_blade_chest_F.broad', 'humanoid_bruiser_hauberk', slot_map=mail,
                       props={'variant': 'bruiser', 'piece': 'hauberk'})
    legs = sess.reuse('blade', 'gear_blade_legs_F.broad', 'humanoid_bruiser_chausses', slot_map=mail,
                      props={'variant': 'bruiser', 'piece': 'chausses'})
    boots = sess.reuse('blade', 'gear_blade_boots_F.broad', 'humanoid_bruiser_boots', slot_map={8: S2, 9: MET},
                       props={'variant': 'bruiser', 'piece': 'boots'})
    top = [(0, 32.0), (30, 28.0), (55, 20.0), (75, 12.0)]
    hp = [C.hood(sess, K, S0, INK, open_c=-8.0, open_a=40.0, open_w=66.0)]
    mpart, Cs = C.face_mask(sess, K, S1, top=top, eyes=(-14.0, 2.0, 12.0, 38.0), eye_slot=INK, rows=8)
    hp += [mpart, C.grin(sess, K, INK, S1, e_mid=-27.0, half_w=56.0, height=9.0, C=Cs)]
    head = sess.make('humanoid_bruiser_head', hp, {'variant': 'bruiser', 'piece': 'head'})
    body = body_for(sess, 'bruiser', [chest, legs, boots, head])
    pr = [own(sess, C.club(WOOD, MET), 'Socket_HandR')]
    return [body, chest, legs, boots, head, props_for(sess, 'bruiser', pr)]


VEXA_FACE = {'face_jaw_narrow': 1.0, 'face_cheek_high': 0.8, 'face_eye_big': 0.55, 'face_brow_raise': 0.5,
             'face_chin_long': 0.15, 'face_nose_long': 0.0}


def v_vexa(sess, K):
    parts = []
    parts += C.trousers(sess, K, CL1)
    parts += C.boots(sess, K, LEA, cuff=LEA, top=0.06)
    parts += C.sleeves(sess, K, S0, t_end=1.02, farm_end=0.9, cuff=S2, off=0.013)
    # the shirt front shows in the coat's V
    T = K.torso
    sh = L.Grid()
    ths = [D(a) for a in (-30, -15, 0, 15, 30)]
    sh.rows([[T.pt(K.tz(z), th, 0.008) for th in ths] for z in (1.44, 1.36, 1.26, 1.16, 1.06)], CL2)
    parts.append(L.Part('shirt', K.fg.piece('shirt', sh, K.f_torso), smooth=2, clear=0.006))
    parts.append(C.jerkin(sess, K, S0, hem=0.88, front_open=26.0, edge=S2, key='coat',
                          off_fn=lambda z: 0.016 if z > 1.1 else (0.014 if z > 0.97 else 0.02)))
    parts += C.coat_skirt(sess, K, S0, CL1, z_top=0.93, z_bot=0.52, trim=S2)
    parts.append(C.belt(sess, K, LEA, S2, z=0.985))
    # brass buttons down both edges of the opening
    bg = L.Grid()
    for z in (1.34, 1.26, 1.18, 1.10):
        vh = 26.0 * L.smoothstep(1.06, 1.42, z) + 6
        for sgn in (1, -1):
            th = D(sgn * vh)
            bg.stud(T.pt(K.tz(z), th, 0.02), T.dir(th), 0.009, S2)
    parts.append(L.Part('buttons', K.fg.piece('buttons', bg, K.f_torso), allow=SPINE_B, smooth=1, clear=0.018,
                        over=('coat',), gap=0.003))
    outfit = sess.make('humanoid_vexa_outfit', parts, {'variant': 'vexa', 'piece': 'outfit'})
    hair = part_copy(sess, 'hair_long.broad', 'humanoid_vexa_hair', slot_map={2: CL3},
                     props={'variant': 'vexa', 'piece': 'hair'})
    # the lacquered grin-mask pushed up on her brow: a full mask turned up over the forehead
    top = [(0, 30.0), (30, 26.0), (55, 18.0), (75, 10.0)]
    mpart, Cs = C.face_mask(sess, K, S1, top=top, eyes=(-14.0, 2.0, 12.0, 38.0), eye_slot=INK, rows=7, off=0.0,
                            key='mask')
    gpart = C.grin(sess, K, INK, S1, lips=S0, C=Cs, off=0.002)
    piv = V((0.0, -0.02, 1.70))
    M = Matrix.Translation(piv + V((0, 0.012, 0.05))) @ Matrix.Rotation(D(-78), 4, 'X') @ Matrix.Translation(-piv)
    for pt in (mpart, gpart):
        for i, s in enumerate(pt.piece.src):
            if s[0] == 'bind':
                pt.piece.src[i] = ('bind', s[1], M @ s[2], s[3])
    mask = sess.make('humanoid_vexa_mask', [mpart, gpart], {'variant': 'vexa', 'piece': 'mask'})
    body = body_for(sess, 'vexa', [outfit, hair], ratio=0.36, face=VEXA_FACE)
    cut, bone = own(sess, C.cutlass(MET, S2, LEA), 'Socket_HandR')
    knife, bone2 = held(sess, 'wpn_throwingKnife_S', 'Socket_HandL', slot_map={10: S2, 11: S2, 14: S2})
    pr = [(cut, bone), (knife, bone2)]
    return [body, outfit, hair, mask, props_for(sess, 'vexa', pr)]


SPINE_B = ['Hips', 'Spine', 'Chest', 'UpperChest']


# ====================================================================== the cult
def no_cords(c, s, bone):
    """The Mender's rope belt keeps its knot but loses the cords hanging to the hem (round 1: they read as stripes)."""
    return s == 8 and c.z < 0.93


def robe_pieces(sess, vid, cls, robe_map, hood_map, ratio=0.72, drop=None, hood_drop=None):
    robe = sess.reuse(cls, 'gear_%s_chest_F.broad' % cls, 'humanoid_%s_robe' % vid, slot_map=robe_map, drop=drop,
                      ratio=ratio, props={'variant': vid, 'piece': 'robe'})
    hood = None
    if hood_map is not None:
        hood = sess.reuse(cls, 'gear_%s_helmet_F.broad' % cls, 'humanoid_%s_cowl' % vid, slot_map=hood_map,
                          drop=hood_drop, ratio=ratio, props={'variant': vid, 'piece': 'cowl'})
    return robe, hood


def v_acolyte(sess, K):
    robe, cowl = robe_pieces(sess, 'acolyte', 'mender', {6: S0, 7: S1, 8: LEA, 15: S1}, {6: S0, 7: S1, 8: LEA}, drop=no_cords)
    body = body_for(sess, 'acolyte', [robe, cowl], drop=('thighs',))
    c = C.conch(S2, CL3, 1.25)
    c.transform(Matrix.Translation(V((-0.19, -0.06, 0.86))) @ Matrix.Rotation(D(-75), 4, 'Y') @ Matrix.Rotation(D(20), 4, 'Z'))
    cord = H.Kit()
    cord.tube([V((-0.15, -0.08, 0.97)), V((-0.18, -0.07, 0.92))], 0.004, 3, LEA, None, None)
    pr = [(c, 'Hips'), (cord, 'Hips')]
    return [body, robe, cowl, props_for(sess, 'acolyte', pr)]


def sewn_mouth(slot):
    """Stitches across the lips (on Head): five X's of thread."""
    k = H.Kit()
    for q in range(5):
        x = -0.024 + 0.012 * q
        y = -0.168 + 21.0 * x * x
        for sgn in (1, -1):
            a = V((x - 0.0045, y, 1.561 + 0.0085 * sgn))
            b = V((x + 0.0045, y, 1.561 - 0.0085 * sgn))
            d = (b - a).normalized()
            k.box((a + b) / 2 + V((0, -0.003, 0)), d * ((b - a).length / 2), V((0, 0.0015, 0)),
                  d.cross(V((0, 1, 0))).normalized() * 0.0016, slot)
    k.box(V((0.0, -0.17, 1.561)), V((0.028, 0, 0)), V((0, 0.0015, 0)), V((0, 0, 0.0014)), slot)
    return k


def v_blade(sess, K):
    robe, cowl = robe_pieces(sess, 'blade', 'mender', {6: S0, 7: CL1, 8: LEA, 15: CL1}, {6: S0, 7: CL1, 8: LEA}, drop=no_cords)
    body = body_for(sess, 'blade', [robe, cowl], drop=('thighs',))
    pr = [own(sess, C.boat_hook(WOOD, S1), 'Socket_HandR'), own(sess, C.boat_hook(WOOD, S1), 'Socket_HandL'),
          (sewn_mouth(S2), 'Head')]
    return [body, robe, cowl, props_for(sess, 'blade', pr)]


def chain_wraps(sess, K, slot, alt):
    """Barbed chain wound round the torso and the upper arms: bands whose cells alternate chain and shadow, with
    barbs."""
    T = K.torso
    g = L.Grid()
    for th0, th1, z0, z1 in ((-60, 300, 1.36, 1.02), (60, 420, 1.32, 1.12)):
        n = 26
        pts = [(H.lerp(z0, z1, q / (n - 1)), D(H.lerp(th0, th1, q / (n - 1)))) for q in range(n)]
        rows = [[T.pt(K.tz(z + dz), th, o) for z, th in pts] for dz, o in ((-0.016, 0.011), (0.0, 0.017), (0.016, 0.011))]
        sg = L.Grid()
        sg.rows(rows, lambda i, j: slot if j % 2 == 0 else alt)
        g.extend(sg)
        for q in range(1, n, 3):
            z, th = pts[q]
            g.stud(T.pt(K.tz(z), th, 0.018), T.dir(th), 0.008, slot)
    parts = [L.Part('chains', K.fg.piece('chains', g, K.f_torso), allow=SPINE_B, smooth=2, clear=0.012)]
    for sign in (1, -1):
        A = K.uarm
        ths = L.circle(10)
        rr = band_rows_spiral(A, ths, 0.15, 0.75, 1.5)
        ag = L.Grid()
        ag.rows(rr, lambda i, j: slot if j % 2 == 0 else alt)
        sel = K.side(sign, ['upperArms', 'chest'], xmin=0.12)
        parts.append(L.Part('armchain_%d' % sign, K.fg.piece('armchain_%d' % sign, C.mirror_for(sign, ag), sel),
                            smooth=1, clear=0.012))
    return parts


def band_rows_spiral(A, ths, t0, t1, turns):
    n = int(len(ths) * turns) + 1
    out = [[], [], []]
    for q in range(n):
        s = q / (n - 1)
        th = 2 * math.pi * turns * s
        t = H.lerp(t0, t1, s)
        for k, (dt, o) in enumerate(((-0.04, 0.012), (0.0, 0.018), (0.04, 0.012))):
            out[k].append(A.pt(t + dt, th, o))
    return out


def v_flagellant(sess, K):
    parts = []
    parts += C.trousers(sess, K, S2, shin_end=0.85)
    parts += chain_wraps(sess, K, S1, INK)
    outfit = sess.make('humanoid_flagellant_outfit', parts, {'variant': 'flagellant', 'piece': 'outfit'})
    head = sess.make('humanoid_flagellant_hood', [C.hood(sess, K, S2, INK, open_c=-14.0, open_a=34.0, open_w=56.0, point=0.06)],
                     {'variant': 'flagellant', 'piece': 'hood'})
    wounds = lambda c, n, region, kind: (INK if (kind == 0 and region in (2, 3) and abs(math.sin(c.z * 61 + c.x * 23)) < 0.12 and c.y > 0.02) else None)  # noqa: E731
    body = body_for(sess, 'flagellant', [outfit, head], skin=S0, paint=wounds)
    # the trailing chain: from the right fist down to the floor and a hook at its end (rigid on the hand)
    S = sess.socket('Socket_HandR')
    o = S.translation
    ch = H.Kit()
    pts = [o + V((0, 0, -0.02)), o + V((0.0, -0.05, -0.30)), o + V((0.0, -0.12, -0.62)), o + V((0.0, -0.30, -0.80))]
    ch.chain(pts, 0.07, 0.0075, S1, n_major=5, n_minor=3)
    end = pts[-1]
    ch.tube([end, end + V((0, -0.06, 0.0)), end + V((0, -0.09, 0.05)), end + V((0, -0.06, 0.09))],
            [0.01, 0.009, 0.007, 0.003], 5, MET, 'flat', 'apex')
    pr = [(ch, 'RightHand')]
    return [body, outfit, head, props_for(sess, 'flagellant', pr)]


def v_drowner(sess, K):
    pl = {9: S1, 7: CL1, 15: CL2}
    chest = sess.reuse('warden', 'gear_warden_chest_F.broad', 'humanoid_drowner_chest', slot_map=pl,
                       props={'variant': 'drowner', 'piece': 'chest'})
    legs = sess.reuse('warden', 'gear_warden_legs_F.broad', 'humanoid_drowner_legs', slot_map=pl,
                      props={'variant': 'drowner', 'piece': 'legs'})
    boots = sess.reuse('warden', 'gear_warden_boots_F.broad', 'humanoid_drowner_boots', slot_map=pl,
                       props={'variant': 'drowner', 'piece': 'boots'})
    gloves = sess.reuse('warden', 'gear_warden_gloves_F.broad', 'humanoid_drowner_gloves', slot_map=pl,
                        props={'variant': 'drowner', 'piece': 'gloves'})
    helm = sess.rigid('humanoid_drowner_helm', C.bell_helm(S0, GEM, TRIM, S1), bone='Head',
                      props={'variant': 'drowner', 'piece': 'helm'})
    body = body_for(sess, 'drowner', [chest, legs, boots, gloves, helm])
    w = H.Kit()
    for q, a in enumerate((-120, -60, 60, 120)):
        ar = D(a)
        p = V((math.sin(ar) * 0.17, -math.cos(ar) * 0.13 + 0.01, 0.86))
        w.box(p, V((0.022, 0, 0)), V((0, 0.012, 0)), V((0, 0, 0.035)), S1)
        w.tube([p + V((0, 0, 0.035)), p + V((0, 0, 0.09))], 0.004, 3, LEA, None, None)
    pr = [own(sess, C.anchor_maul(WOOD, S1, S0), 'Socket_HandR'), (w, 'Hips')]
    return [body, chest, legs, boots, gloves, helm, props_for(sess, 'drowner', pr)]


def v_hag(sess, K):
    def ragged(c, s, bone):
        return c.z < 0.40 + 0.09 * (0.5 + 0.5 * math.sin(c.x * 83.0 + c.y * 41.0))
    # not decimated: welding the Arcanist robe's seams also welded its slit linings to the cloth and left vertices shared
    # across slots (round 3: colour gradients down the front); undecimated it still fits the 4.5k budget
    robe, _ = robe_pieces(sess, 'hag', 'arcanist', {6: S1, 7: S1, 8: LEA}, None, ratio=None, drop=ragged)
    hair = part_copy(sess, 'hair_long.broad', 'humanoid_hag_hair', slot_map={2: CL3}, props={'variant': 'hag', 'piece': 'hair'})
    f_c = H.RadialField(sess, {'Spine': -0.18, 'Chest': -0.12, 'UpperChest': -0.06, 'Neck': -0.2,
                              'LeftUpperArm': -0.25, 'RightUpperArm': -0.25, 'LeftLowerArm': -0.22, 'RightLowerArm': -0.22,
                              'LeftUpperLeg': -0.18, 'RightUpperLeg': -0.18, 'LeftLowerLeg': -0.15, 'RightLowerLeg': -0.15})
    body = body_for(sess, 'hag', [robe, hair], skin=S0, eye=GLOW, drop=('thighs',),
                    face={'face_chin_long': 1.0, 'face_nose_long': 1.0, 'face_cheek_high': 0.8, 'face_jaw_narrow': 0.8,
                          'face_eye_narrow': 0.6})
    for o in (body, robe, hair):
        H.add_field_key(o, 'var_crone', f_c)
    crown = C.pearl_circlet(MET, S2, GEM, r=(0.118, 0.134), z=1.72)
    claws = []
    for pre in ('Left', 'Right'):
        for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Little'):
            bn = pre + f + 'Distal'
            a, b = sess.joint(bn), sess.joint(bn, 'tail')
            d = (b - a).normalized()
            k = H.Kit()
            k.cone(b - d * 0.006, b + d * 0.034 + V((0, -0.006, -0.004)), 0.0065, 4, BONE)
            claws.append((k, bn))
    pouch = C.purse(EYE, LEA)
    pouch.transform(Matrix.Translation(V((0.18, -0.05, 0.93))))
    pr = [(crown, 'Head'), (pouch, 'Hips')] + claws
    return [body, robe, hair, props_for(sess, 'hag', pr)]


def pearls_on(sess, K, slot, gem):
    """Pearls sewn on the shroud: along the stole's edges and round the cowl's opening (bound to the torso)."""
    T = K.torso
    k = H.Kit()
    for z in (1.36, 1.28, 1.20, 1.12, 1.04, 0.96, 0.88, 0.80, 0.72):
        for sgn in (1, -1):
            th = D(sgn * 16)
            p = T.pt(K.tz(z), th, 0.03 + 0.012 * L.smoothstep(1.0, 0.7, z))
            k.sphere(p, 0.011, 6, 4, gem if (z * 100) % 16 < 8 else slot)
    return [sess.bound('pearls', k, fidx=K.f_torso, orient='body', allow=SPINE_B + ['LeftUpperLeg', 'RightUpperLeg'],
                       smooth=2, clear=0.0, cap={'LeftUpperLeg': 0.4, 'RightUpperLeg': 0.4})]


def v_naesa(sess, K):
    robe, cowl = robe_pieces(sess, 'naesa', 'mender', {6: S0, 7: S1, 8: S2, 15: S1}, {6: S0, 7: S1, 8: S2}, ratio=0.85,
                             drop=no_cords)
    pearls = sess.make('humanoid_naesa_pearls', pearls_on(sess, K, EYE, GEM), {'variant': 'naesa', 'piece': 'pearls'})
    face = {'face_jaw_narrow': 1.0, 'face_cheek_high': 0.9, 'face_eye_big': 0.4, 'face_chin_long': 0.4}
    body = body_for(sess, 'naesa', [robe, cowl], ratio=0.3, face=face, drop=('thighs',))
    staff, bone = own(sess, C.conch_staff(WOOD, S0, CL3, EYE), 'Socket_HandR')
    p1 = [body, robe, cowl, pearls, props_for(sess, 'naesa', [(staff, bone)])]
    # phase 2: the shroud torn (no sleeves, a ragged hem), the arms gone into two tentacles
    def torn(c, s, bone):
        return no_cords(c, s, bone) or ('Arm' in bone or 'Hand' in bone) or c.z < 0.42 + 0.12 * (0.5 + 0.5 * math.sin(c.x * 71 + c.y * 29))
    robe2 = sess.reuse('mender', 'gear_mender_chest_F.broad', 'humanoid_naesa2_robe', slot_map={6: S0, 7: S1, 8: S2, 15: S1},
                       drop=torn, ratio=0.85, props={'variant': 'naesa2', 'piece': 'robe'})
    arms = []
    for sign in (1, -1):
        k, wfn = C.tentacle_arm(sess, sign, S2, EYE, INK, extra=0.6, r0=0.062)
        arms.append(sess.rigid('humanoid_naesa2_tentacle_%s' % ('L' if sign > 0 else 'R'), k, weights=wfn,
                               props={'variant': 'naesa2', 'piece': 'tentacle'}))
    body2 = body_for(sess, 'naesa2', [robe2, cowl] + arms, ratio=0.3, face=face, drop=('thighs',),
                     cut=lambda c, region, bone: region in (4, 5, 6) or ('Arm' in bone) or ('Hand' in bone) or
                     any(f in bone for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Little')))
    p2 = [body2, robe2, cowl, pearls] + arms
    return p1, p2


# ====================================================================== the variant table
FIX = dict(ink='#17121a', leather='#4a3426', metal='#7f858c', cloth1='#3b3a40', cloth2='#8c8273', wood='#6a4a2e',
           bone='#e3d6b4')


def pal(main, second, accent, **over):
    d = dict(FIX)
    d.update(over)
    return H.palette(main, second, accent, **d)


VARIANTS = [
    dict(id='grinning-cutpurse', build=v_cutpurse, scale=1.0,
         colors=pal('#5c4a32', '#f1ece4', '#9b1c1c', sclera='#c99a78'),
         clipMap={'Flee': 'Run'}),
    dict(id='grinning-crossbowman', build=v_crossbowman, scale=1.0,
         colors=pal('#5c4a32', '#f1ece4', '#b3261e', sclera='#c08f6c'),
         boneScales={'chest': 1.05, 'upperChest': 1.05, 'shoulder': 1.04},
         clipMap={'Attack1': 'Shoot', 'Reload': 'Interact'}),
    dict(id='grinning-netter', build=v_netter, scale=1.0,
         colors=pal('#6b7a80', '#f1ece4', '#1c1c1c', sclera='#c99a78', cloth1='#4a4038'),
         boneScales={'upperLeg': 1.06, 'lowerLeg': 1.07, 'upperArm': 1.05, 'lowerArm': 1.06, 'chest': 0.96},
         clipMap={'Attack1': 'Attack_Light', 'Attack2': 'Attack_Light', 'Throw': 'Attack_Heavy', 'Reload': 'Interact'}),
    dict(id='grinning-hexer', build=v_hexer, scale=1.0,
         colors=pal('#e6dcc3', '#2a2a2a', '#39ff6a', sclera='#b48c6c', glow='#39ff6a', cloth1='#2f2b2a'),
         poseAdd={'Spine': (14, 0, 0), 'Chest': (8, 0, 0), 'Neck': (-14, 0, 0), 'Head': (-8, 0, 0)},
         clipMap={'Attack1': 'Cast', 'Attack2': 'Cast', 'Cast': 'Cast'}),
    dict(id='grinning-bruiser', build=v_bruiser, scale=1.25,
         colors=pal('#8a4b2a', '#f1ece4', '#3a2a1e', sclera='#b98a68', metal='#6b6560'),
         boneScales={'chest': 1.1, 'upperChest': 1.12, 'shoulder': 1.1, 'upperArm': 1.1, 'lowerArm': 1.1, 'hand': 1.18,
                     'neck': 1.08, 'head': 0.92},
         clipMap={'Attack1': 'Attack_Heavy', 'Attack2': 'Attack_Heavy', 'Taunt': 'Roar'}),
    dict(id='captain-vexa-marrow', build=v_vexa, scale=1.0,
         colors=pal('#9b1c1c', '#f1ece4', '#b08d57', sclera='#d7a585', cloth1='#2b2430', cloth2='#ebe6dc',
                    leather='#3b2a20', metal='#b9c0c8', cloth3='#3a1d17'),
         clipMap={'Attack1': 'Attack_Light', 'Attack2': 'Attack_Dual', 'CoinFlip': 'Victory', 'Riposte': 'Attack_Dual',
                  'Kick': 'Attack_Heavy'}),
    dict(id='tidebound-acolyte', build=v_acolyte, scale=1.0,
         colors=pal('#7f8a8c', '#3f8f7a', '#f0ece4', sclera='#b9a28e', cloth3='#e9b9b0'),
         clipMap={'Attack1': 'Cast', 'Attack2': 'Cast', 'Cast': 'Cast'}),
    dict(id='tidebound-blade', build=v_blade, scale=1.0,
         colors=pal('#7f8a8c', '#8b4a2b', '#3d5aa8', sclera='#b9a28e', cloth1='#5f696b'),
         clipMap={'Attack1': 'Attack_Dual', 'Attack2': 'Attack_Light', 'DualAttack': 'Attack_Dual'}),
    dict(id='tidebound-flagellant', build=v_flagellant, scale=1.0,
         colors=pal('#d9968a', '#8b4a2b', '#7d868a', ink='#2a0f0f'),
         clipMap={'Attack1': 'Attack_Heavy', 'Attack2': 'Attack_Light', 'Throw': 'Attack_Heavy', 'Pull': 'Interact'}),
    dict(id='tidebound-drowner', build=v_drowner, scale=1.3,
         colors=pal('#5f8f7a', '#6d7277', '#d8efe6', sclera='#b9a28e', gem='#d8efe6', trim='#8a7a4a', cloth1='#5f696b',
                    cloth2='#4c5456'),
         clipMap={'Attack1': 'Attack_Heavy', 'Attack2': 'Attack_Heavy', 'Maul': 'Attack_Heavy', 'Toll': 'Roar',
                  'Hold': 'Guard'}),
    dict(id='brine-hag', build=v_hag, scale=1.0,
         colors=pal('#e3e6e0', '#3a5a7a', '#e8b4b8', glow='#ff9fb0', gem='#ffc4cf', cloth3='#46524c', metal='#9aa3a8',
                    iris='#f2efe6'),
         shapes={'var_crone': 1.0},
         boneScales={'upperArm': 1.12, 'lowerArm': 1.22, 'hand': 1.2, 'fingers': 1.25, 'upperLeg': 1.04, 'lowerLeg': 1.06,
                     'neck': 1.08},
         poseAdd={'Spine': (16, 0, 0), 'Chest': (10, 0, 0), 'UpperChest': (8, 0, 0), 'Neck': (-18, 0, 0), 'Head': (-12, 0, 0)},
         clipMap={'Attack1': 'Cast', 'Attack2': 'Attack_Light', 'Cast': 'Cast', 'Cackle': 'Roar'}),
    dict(id='sister-naesa', build=v_naesa, scale=1.0,
         colors=pal('#f2eee6', '#3a5a7a', '#4f7a4a', sclera='#d9c4b4', gem='#bfeaff', iris='#f4efe6', cloth3='#e9b9b0'),
         clipMap={'Attack1': 'Cast', 'Attack2': 'Cast', 'Cast': 'Cast', 'Call': 'Cast', 'Ascend': 'Roar',
                  'Embrace': 'Attack_Heavy', 'Undertow': 'Roar'}),
]


def height_of(objs, v):
    z = 0.0
    for ob in objs:
        for vv in ob.data.vertices:
            z = max(z, (ob.matrix_world @ vv.co).z)
    return z * v['scale'] * (v.get('boneScales') or {}).get('root', 1.0)


def apply_shapes(objs, shapes, on=True):
    for ob in objs:
        sk = ob.data.shape_keys
        if not sk:
            continue
        for k, w in shapes.items():
            kb = sk.key_blocks.get(k)
            if kb:
                kb.value = w if on else 0.0


def main():
    sess = H.Session(BASE, keep_parts=KEEP)
    K = sess.K
    vs = []
    for v in VARIANTS:
        if ONLY and v['id'] not in ONLY:
            continue
        v = dict(v)
        v['base'] = BASE
        res = v['build'](sess, K)
        if v['id'] == 'sister-naesa':
            p1, p2 = res
            v['objs'] = p1
            v2 = dict(v, id='sister-naesa (phase 2)', objs=p2, scale=1.28)
            v2['tris'] = sum(H.tris_of(o) for o in p2)
            v2['height'] = height_of(p2, v2)
            v['phases'] = {'2': {'parts': [o.name for o in p2], 'scale': 1.28, 'tris': v2['tris'],
                                 'note': 'Ascension: the shroud torn, the arms become tentacles'}}
            v['tris'] = sum(H.tris_of(o) for o in p1)
            v['height'] = height_of(p1, v)
            vs.append(v)
            vs.append(v2)
            continue
        v['objs'] = res
        v['tris'] = sum(H.tris_of(o) for o in res)
        v['height'] = height_of(res, v)
        vs.append(v)
    for v in vs:
        log('%s: %d tris, %.2f m, parts %s' % (v['id'], v['tris'], v['height'], [o.name for o in v['objs']]))
    if not ARGS.get('no_render'):
        rv = H.Review(sess, quick=QUICK)
        for v in vs:
            rv.look(v['objs'], v['id'], v['colors'])
        hmax = max(v['height'] for v in vs) + 0.1
        groups = [vs[:6], vs[6:]] if len(vs) > 7 else [vs]
        for gi, grp in enumerate(groups):
            for v in grp:
                apply_shapes(v['objs'], v.get('shapes', {}))
            rv.lineup([(None, [])] + [(v, v['objs']) for v in grp], 'lineup_%d.png' % (gi + 1), hmax)
            for v in grp:
                apply_shapes(v['objs'], v.get('shapes', {}), on=False)
        cards = []
        for v in vs:
            apply_shapes(v['objs'], v.get('shapes', {}))
            p, small = rv.card(v, v['objs'], 'card_%s.png' % v['id'].replace(' ', '_').replace('(', '').replace(')', ''))
            cards.append(small)
            apply_shapes(v['objs'], v.get('shapes', {}), on=False)
        from render import grid_sheet
        grid_sheet(cards, os.path.join(rv.out, 'read200_all.png'), cols=min(7, len(cards)))
        for gi, grp in enumerate(groups):
            for v in grp:
                apply_shapes(v['objs'], v.get('shapes', {}))
            rv.heads(grp, 'heads_%d.png' % (gi + 1))
            for v in grp:
                apply_shapes(v['objs'], v.get('shapes', {}), on=False)
        pokes = []
        for v in vs:
            apply_shapes(v['objs'], v.get('shapes', {}))
            rv.strip(v, v['objs'], H.strip_frames(v), 'clips_%s.png' % v['id'].replace(' ', '_').replace('(', '').replace(')', ''))
            pokes += H.poke_lines(rv, [v])
            apply_shapes(v['objs'], v.get('shapes', {}), on=False)
        H.write_log_lines(os.path.join(BUILD, 'monsters_humanoid_pokes.txt'), pokes)
    H.L.rest(sess.rig)
    save_blend(os.path.join(BUILD, 'monsters_%s.blend' % BASE))
    if not ARGS.get('no_export') and not ONLY:
        objs = []
        for v in vs:
            for o in v['objs']:
                if o not in objs:
                    objs.append(o)
        for o in objs:
            o['tris'] = H.tris_of(o)
            o['monsters'] = [v['id'] for v in vs if o in v['objs']]
        kb = H.export_base(sess, objs)
        entries = {}
        for v in vs:
            if 'phase 2' in v['id']:
                continue
            entries[v['id']] = H.manifest_entry(v, [o.name for o in v['objs']], sess.rig)
        H.write_manifest(entries)
        log('humanoid.glb %.1f KB' % kb)
        H.reimport_check(BASE)


main()
