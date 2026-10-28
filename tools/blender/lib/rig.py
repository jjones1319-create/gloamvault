"""rig.py — the one Gloamvault hero skeleton (05-SPECIES §5, 11-ART-PIPELINE §2) and the pose/action helpers.

65 bones with Unity-Humanoid / Mixamo names: 54 deform bones of the body (with the two eyes) and 11 optional chain
bones every export carries so every .glb binds to one skeleton (Tail_01..04, Ear_L/R, Beard_01..02, Hair_01..03).
A-pose rest. Every bone's local Y runs head → tail and its local Z faces the character's front (−Y in Blender), so
in pose space +X bends a bone forward (fingers: curls them into the palm), +Y twists it, +Z swings it toward the
character's right (mirrored on the right side: `mirrored()` negates Y and Z). The upper arms rotate in ZYX order
(flex, twist about the flexed bone, swing), everything else XYZ — Ascend's convention, so its pose tables port.

Sockets are empties parented to bones (exported as glTF nodes under the joints): weapons, shields and props attach to
them with an identity local transform. A weapon is modelled with its grip at the origin and its blade or shaft along
+Y; a socket's +Y points the way a held blade points.
"""
import math

import bpy
from mathutils import Euler, Matrix, Vector

FINGERS = ('Thumb', 'Index', 'Middle', 'Ring', 'Little')
PHALANGES = ('Proximal', 'Intermediate', 'Distal')


def _side(pre):
    out = [
        (pre + 'Shoulder', 'UpperChest'),
        (pre + 'UpperArm', pre + 'Shoulder'),
        (pre + 'LowerArm', pre + 'UpperArm'),
        (pre + 'Hand', pre + 'LowerArm'),
    ]
    for f in FINGERS:
        parent = pre + 'Hand'
        for p in PHALANGES:
            out.append((pre + f + p, parent))
            parent = pre + f + p
    return out


def _leg(pre):
    return [
        (pre + 'UpperLeg', 'Hips'),
        (pre + 'LowerLeg', pre + 'UpperLeg'),
        (pre + 'Foot', pre + 'LowerLeg'),
        (pre + 'Toes', pre + 'Foot'),
    ]


BODY_BONES = (
    [('Hips', None), ('Spine', 'Hips'), ('Chest', 'Spine'), ('UpperChest', 'Chest'), ('Neck', 'UpperChest'), ('Head', 'Neck'),
     ('LeftEye', 'Head'), ('RightEye', 'Head')]
    + _side('Left') + _side('Right') + _leg('Left') + _leg('Right')
)
CHAIN_BONES = [
    ('Tail_01', 'Hips'), ('Tail_02', 'Tail_01'), ('Tail_03', 'Tail_02'), ('Tail_04', 'Tail_03'),
    ('Ear_L', 'Head'), ('Ear_R', 'Head'),
    ('Beard_01', 'Head'), ('Beard_02', 'Beard_01'),
    ('Hair_01', 'Head'), ('Hair_02', 'Hair_01'), ('Hair_03', 'Hair_02'),
]
ALL_BONES = BODY_BONES + CHAIN_BONES
PARENT = dict(ALL_BONES)
assert len(BODY_BONES) == 54 and len(ALL_BONES) == 65, (len(BODY_BONES), len(ALL_BONES))

SOCKETS = ('Socket_HandR', 'Socket_HandL', 'Socket_Head', 'Socket_Back', 'Socket_Belt', 'Socket_Neck', 'Socket_Mouth', 'Socket_Pet')
FWD = Vector((0, -1, 0))
UP = Vector((0, 0, 1))


def build_armature(name, joints, collection=None):
    """
    joints: bone name → (head, tail, roll_target) in world space (roll_target: the direction local Z should face).
    Every bone of ALL_BONES must be present. Returns the armature object, in OBJECT mode.
    """
    missing = [b for b, _ in ALL_BONES if b not in joints]
    if missing:
        raise RuntimeError('joints missing: %s' % missing)
    arm = bpy.data.armatures.new(name)
    ob = bpy.data.objects.new(name, arm)
    (collection or bpy.context.scene.collection).objects.link(ob)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    ebs = {}
    for bname, parent in ALL_BONES:
        head, tail, roll = joints[bname]
        eb = arm.edit_bones.new(bname)
        eb.head = Vector(head)
        eb.tail = Vector(tail)
        if parent:
            eb.parent = ebs[parent]
            eb.use_connect = False
        eb.align_roll(Vector(roll))
        eb.use_deform = True
        ebs[bname] = eb
    bpy.ops.object.mode_set(mode='POSE')
    for pb in ob.pose.bones:
        pb.rotation_mode = 'ZYX' if 'UpperArm' in pb.name else 'XYZ'
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.display_type = 'OCTAHEDRAL'
    ob.show_in_front = True
    return ob


def add_socket(arm_ob, name, bone, location, y_axis, z_axis=None):
    """An empty parented to `bone`, at `location` (world), with its +Y along y_axis (and +Z as close to z_axis as possible)."""
    y = Vector(y_axis).normalized()
    z = Vector(z_axis if z_axis is not None else FWD)
    x = y.cross(z)
    if x.length < 1e-6:
        z = Vector((0, 0, 1)) if abs(y.z) < 0.9 else Vector((1, 0, 0))
        x = y.cross(z)
    x.normalize()
    z = x.cross(y).normalized()
    mat = Matrix((x, y, z)).transposed().to_4x4()
    mat.translation = Vector(location)
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'ARROWS'
    e.empty_display_size = 0.06
    (arm_ob.users_collection[0] if arm_ob.users_collection else bpy.context.scene.collection).objects.link(e)
    e.parent = arm_ob
    e.parent_type = 'BONE'
    e.parent_bone = bone
    b = arm_ob.data.bones[bone]
    bone_world = arm_ob.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))
    e.matrix_parent_inverse = bone_world.inverted()
    e.matrix_world = mat
    return e


# ------------------------------------------------------------------ poses and actions
def mirrored(pose):
    """Left* entries copied to Right* (and back) with Y and Z negated, where the other side is absent."""
    out = dict(pose)
    for k, v in pose.items():
        if k.endswith('.loc'):
            continue
        for a, b in (('Left', 'Right'), ('Right', 'Left')):
            if k.startswith(a):
                k2 = b + k[len(a):]
                if k2 not in pose:
                    out[k2] = (v[0], -v[1], -v[2])
    return out


def key_pose(arm_ob, frame, pose):
    """Keys every pose bone at `frame`: rotation in degrees (pose[name]), Hips location (pose['Hips.loc'] = (left, up, forward) m)."""
    for pb in arm_ob.pose.bones:
        rot = pose.get(pb.name, (0, 0, 0))
        pb.rotation_euler = Euler([math.radians(a) for a in rot], pb.rotation_mode)
        pb.keyframe_insert('rotation_euler', frame=frame)
        if pb.name == 'Hips':
            loc = pose.get('Hips.loc', (0, 0, 0))
            # bone space of Hips: X = character left/right (mirrors world X), Y = up along the bone, Z = forward
            pb.location = (loc[0], loc[1], loc[2])
            pb.keyframe_insert('location', frame=frame)


def make_action(arm_ob, name, keys, fps=30, loop=False):
    """keys: [(seconds, pose dict)] → an Action (fake user, use_cyclic for loops) assigned through a slot."""
    act = bpy.data.actions.new(name)
    if not arm_ob.animation_data:
        arm_ob.animation_data_create()
    arm_ob.animation_data.action = act
    for t, pose in keys:
        key_pose(arm_ob, round(t * fps), pose)
    act.use_frame_range = True
    act.frame_start = 0
    act.frame_end = max(1, round(keys[-1][0] * fps))
    act.use_cyclic = loop
    act['loop'] = loop
    act.use_fake_user = True
    return act


def rest_pose(arm_ob):
    for pb in arm_ob.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
