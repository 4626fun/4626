"""
Create an Ethereum-inspired obsidian vault artifact and export it as GLB.

Run:
  blender --background --python blender/create_ethereum_obsidian_vault.py -- \
    ../assets/models/ethereum-obsidian-vault.glb

The generated scene uses named parent groups and keyframes so the GLB can be:
1. exported with an embedded opening animation, or
2. controlled in React Three Fiber / vault.js by driving the named parts from scroll progress.
"""

import bpy
import math
import os
import sys
from mathutils import Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEX_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "assets", "textures", "vault"))

def arg_output_path():
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1:]
        if args:
            return os.path.abspath(args[0])
    return os.path.abspath(os.path.join(SCRIPT_DIR, "..", "assets", "models", "ethereum-obsidian-vault.glb"))

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

def load_image(filename, srgb=True):
    path = os.path.join(TEX_DIR, filename)
    if not os.path.isfile(path):
        print(f"Texture missing (skipped): {path}")
        return None
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
    return img

def link_image(bsdf, socket_names, image, factor=1.0):
    if not image:
        return
    node_tree = bsdf.id_data
    nodes = node_tree.nodes
    links = node_tree.links
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.interpolation = "Smart"
    for name in socket_names:
        if name in bsdf.inputs:
            if factor != 1.0 and name in ("Roughness", "Metallic"):
                mul = nodes.new("ShaderNodeMath")
                mul.operation = "MULTIPLY"
                mul.inputs[1].default_value = factor
                links.new(tex.outputs["Color"], mul.inputs[0])
                links.new(mul.outputs["Value"], bsdf.inputs[name])
            else:
                links.new(tex.outputs["Color"], bsdf.inputs[name])
            break

def make_mat(name, color, metallic=0.0, roughness=0.35, alpha=1.0, emission=None, emission_strength=0.0,
             basecolor_img=None, roughness_img=None, emissive_img=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = color
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
        if emission and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emission
        if emission and "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
        link_image(bsdf, ("Base Color",), basecolor_img)
        link_image(bsdf, ("Roughness",), roughness_img, factor=0.85)
        if emissive_img and "Emission Color" in bsdf.inputs:
            link_image(bsdf, ("Emission Color",), emissive_img)
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = max(emission_strength, 0.12)
    if alpha < 1:
        mat.blend_method = "BLEND"
        mat.use_screen_refraction = True
        mat.show_transparent_back = True
    return mat

tex_base = load_image("obsidian_gold_veins_basecolor.png", srgb=True)
tex_rough = load_image("obsidian_micro_roughness.png", srgb=False)
tex_emissive = load_image("obsidian_gold_veins_emissive.png", srgb=True)

def create_prism_object(name, poly_xz, depth_y, mat, parent=None):
    cx = sum(p[0] for p in poly_xz) / len(poly_xz)
    cz = sum(p[1] for p in poly_xz) / len(poly_xz)
    verts = []
    for x, z in poly_xz:
        verts.append((x - cx, -depth_y / 2, z - cz))
    for x, z in poly_xz:
        verts.append((x - cx, depth_y / 2, z - cz))

    n = len(poly_xz)
    faces = []
    for i in range(1, n - 1):
        faces.append((0, i, i + 1))
    for i in range(1, n - 1):
        faces.append((n, n + i + 1, n + i))
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))

    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = (cx, 0, cz)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)

    bevel = obj.modifiers.new("micro_bevels", "BEVEL")
    bevel.width = 0.018
    bevel.segments = 2
    bevel.affect = "EDGES"

    weighted = obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    weighted.keep_sharp = True

    if parent:
        obj.parent = parent

    return obj

def create_bar(name, p1, p2, width, depth_y, mat, parent=None):
    x1, z1 = p1
    x2, z2 = p2
    vx, vz = x2 - x1, z2 - z1
    length = math.sqrt(vx * vx + vz * vz)
    nx, nz = -vz / length, vx / length
    poly = [
        (x1 + nx * width / 2, z1 + nz * width / 2),
        (x2 + nx * width / 2, z2 + nz * width / 2),
        (x2 - nx * width / 2, z2 - nz * width / 2),
        (x1 - nx * width / 2, z1 - nz * width / 2),
    ]
    return create_prism_object(name, poly, depth_y, mat, parent)

def keyframe_group(obj, frame, loc=None, rot=None, scale=None):
    bpy.context.scene.frame_set(frame)
    if loc is not None:
        obj.location = loc
        obj.keyframe_insert("location", frame=frame)
    if rot is not None:
        obj.rotation_euler = rot
        obj.keyframe_insert("rotation_euler", frame=frame)
    if scale is not None:
        obj.scale = scale
        obj.keyframe_insert("scale", frame=frame)

clear_scene()

mat_obsidian = make_mat(
    "mat_obsidian_black_core", (0.005, 0.005, 0.008, 1),
    metallic=0.88, roughness=0.32,
    basecolor_img=tex_base, roughness_img=tex_rough,
)
mat_glass = make_mat("mat_smoked_black_glass_shell", (0.014, 0.018, 0.024, 0.42), metallic=0.0, roughness=0.06, alpha=0.38)
mat_chrome = make_mat("mat_black_chrome_bevels", (0.002, 0.002, 0.003, 1), metallic=1.0, roughness=0.14)
mat_dlc = make_mat(
    "mat_dlc_titanium_panels", (0.012, 0.012, 0.014, 1),
    metallic=0.86, roughness=0.34,
    roughness_img=tex_rough,
)
mat_glow = make_mat(
    "mat_subtle_amber_internal_glow", (0.85, 0.38, 0.075, 1),
    metallic=0.0, roughness=0.18,
    emission=(1.0, 0.42, 0.08, 1), emission_strength=0.28,
    emissive_img=tex_emissive,
)

# Parent groups for scroll or timeline-driven opening.
top_group = bpy.data.objects.new("Vault_TopHalf_scroll_open_group", None)
bottom_group = bpy.data.objects.new("Vault_BottomHalf_scroll_open_group", None)
center_group = bpy.data.objects.new("Vault_CenterMechanism_group", None)
for group in (top_group, bottom_group, center_group):
    bpy.context.collection.objects.link(group)

T = (0.0, 2.55)
B = (0.0, -2.55)
Ltop = (-1.18, 0.26)
Rtop = (1.18, 0.26)
Lbot = (-1.18, -0.26)
Rbot = (1.18, -0.26)
CtopL = (-0.19, 0.22)
CtopR = (0.19, 0.22)
CbotL = (-0.19, -0.22)
CbotR = (0.19, -0.22)

# Top and bottom faceted halves.
create_prism_object("top_left_obsidian_facet", [T, Ltop, CtopL], 0.18, mat_obsidian, top_group)
create_prism_object("top_right_obsidian_facet", [T, CtopR, Rtop], 0.18, mat_obsidian, top_group)
create_prism_object("top_center_dlc_spine", [T, (0.24,0.22), (0.10,0.05), (-0.10,0.05), (-0.24,0.22)], 0.18, mat_dlc, top_group)
create_prism_object("bottom_left_obsidian_facet", [CbotL, Lbot, B], 0.18, mat_obsidian, bottom_group)
create_prism_object("bottom_right_obsidian_facet", [Rbot, CbotR, B], 0.18, mat_obsidian, bottom_group)
create_prism_object("bottom_center_dlc_spine", [(-0.10,-0.05), (0.10,-0.05), (0.24,-0.22), B, (-0.24,-0.22)], 0.18, mat_dlc, bottom_group)

# Smoked glass skins.
create_prism_object("top_left_smoked_glass_shell", [T, Ltop, CtopL], 0.035, mat_glass, top_group)
create_prism_object("top_right_smoked_glass_shell", [T, CtopR, Rtop], 0.035, mat_glass, top_group)
create_prism_object("bottom_left_smoked_glass_shell", [CbotL, Lbot, B], 0.035, mat_glass, bottom_group)
create_prism_object("bottom_right_smoked_glass_shell", [Rbot, CbotR, B], 0.035, mat_glass, bottom_group)

# Bevel/frame bars.
for name, p1, p2, w, parent in [
    ("top_left_outer_black_chrome_bevel", T, Ltop, 0.065, top_group),
    ("top_right_outer_black_chrome_bevel", T, Rtop, 0.065, top_group),
    ("bottom_left_outer_black_chrome_bevel", B, Lbot, 0.065, bottom_group),
    ("bottom_right_outer_black_chrome_bevel", B, Rbot, 0.065, bottom_group),
    ("top_left_inner_black_chrome_bevel", Ltop, CtopL, 0.055, top_group),
    ("top_right_inner_black_chrome_bevel", CtopR, Rtop, 0.055, top_group),
    ("bottom_left_inner_black_chrome_bevel", Lbot, CbotL, 0.055, bottom_group),
    ("bottom_right_inner_black_chrome_bevel", CbotR, Rbot, 0.055, bottom_group),
]:
    create_bar(name, p1, p2, w, 0.20, mat_chrome, parent)

create_bar("seam_upper_black_chrome_lip", (-1.24, 0.085), (1.24, 0.085), 0.05, 0.035, mat_chrome, center_group)
create_bar("seam_lower_black_chrome_lip", (-1.24, -0.085), (1.24, -0.085), 0.05, 0.035, mat_chrome, center_group)
create_bar("seam_subtle_amber_light_line", (-1.24, 0.0), (1.24, 0.0), 0.024, 0.035, mat_glow, center_group)
create_prism_object("inner_core_reveal_diamond_low_emission", [(0.0,0.38),(0.42,0.0),(0.0,-0.38),(-0.42,0.0)], 0.08, mat_glow, center_group)

# Add a few tiny gold vein marks as very thin bars.
for idx, (p1, p2) in enumerate([
    ((-0.74,0.52), (-0.58,0.88)), ((-0.58,0.88), (-0.39,1.08)),
    ((0.70,0.48), (0.57,0.82)), ((0.57,0.82), (0.34,1.10)),
    ((-0.70,-0.52), (-0.52,-0.90)), ((0.70,-0.52), (0.52,-0.90)),
]):
    parent = top_group if p1[1] > 0 else bottom_group
    create_bar(f"barely_visible_gold_vein_{idx:02d}", p1, p2, 0.010, 0.012, mat_glow, parent)

# Camera and lights.
bpy.ops.object.light_add(type="AREA", location=(-3.5, -3.0, 3.4))
bpy.context.object.name = "thin_cool_rim_light"
bpy.context.object.data.energy = 420
bpy.context.object.data.size = 3.0

bpy.ops.object.light_add(type="POINT", location=(0, -1.2, 0.1))
bpy.context.object.name = "subtle_inner_amber_light"
bpy.context.object.data.energy = 60
bpy.context.object.data.color = (1.0, 0.55, 0.18)

bpy.ops.object.camera_add(location=(0, -6.1, 0.22), rotation=(math.radians(88), 0, 0))
bpy.context.scene.camera = bpy.context.object
bpy.context.object.name = "hero_camera"

# Timeline opening animation. R3F can ignore this and use scroll-driven transforms instead.
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 120
keyframe_group(top_group, 1, loc=(0,0,0), rot=(0,0,0))
keyframe_group(bottom_group, 1, loc=(0,0,0), rot=(0,0,0))
keyframe_group(center_group, 1, loc=(0,0,0), scale=(1,1,1))
keyframe_group(top_group, 120, loc=(0,0.22,0.42), rot=(math.radians(-2.5),0,0))
keyframe_group(bottom_group, 120, loc=(0,0.22,-0.42), rot=(math.radians(2.5),0,0))
keyframe_group(center_group, 120, loc=(0,-0.04,0), scale=(1.0,1.0,1.28))

# Color management for local previews.
bpy.context.scene.view_settings.view_transform = "Filmic"
bpy.context.scene.view_settings.look = "Medium High Contrast"
bpy.context.scene.view_settings.exposure = -0.45
bpy.context.scene.view_settings.gamma = 1.0

# Web runtime supplies its own camera/lights — keep GLB geometry + materials only.
for obj_name in ("thin_cool_rim_light", "subtle_inner_amber_light", "hero_camera"):
    obj = bpy.data.objects.get(obj_name)
    if obj:
        bpy.data.objects.remove(obj, do_unlink=True)

output = arg_output_path()
os.makedirs(os.path.dirname(output), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=output,
    export_format="GLB",
    export_apply=False,
    export_animations=True,
    export_frame_range=True,
    export_frame_step=1,
    export_force_sampling=True,
    export_materials="EXPORT",
    export_yup=True,
)
print(f"Exported Ethereum-inspired obsidian vault GLB to: {output}")
