"""
create_obsidian_vault.py

Run inside Blender:
  blender --background --python blender/create_obsidian_vault.py -- /absolute/path/obsidian-vault.glb

Creates a production-direction GLB scaffold for a black-on-black vault artifact:
- obsidian rounded core
- smoked-glass outer shell
- black chrome inset seams
- hidden near-invisible 4626 mark
- weighted normals and bevel modifiers
- separate material slots: core, shell, bevels/seams, hidden glow

This script intentionally creates a restrained, premium model. It is not meant to
look bright in Blender; the web/R3F scene should reveal it with rim lights.
"""
from __future__ import annotations

import math
import os
import sys
from typing import Iterable, Tuple

import bpy
from mathutils import Vector

Vec3 = Tuple[float, float, float]


def argv_output_path() -> str:
    """Return output path passed after --, or a sane default beside this file."""
    if "--" in sys.argv:
        tail = sys.argv[sys.argv.index("--") + 1 :]
        if tail:
            return os.path.abspath(tail[0])
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "../assets/models/obsidian-vault.glb"))


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def set_principled(mat: bpy.types.Material, values: dict) -> None:
    """Set Principled BSDF inputs defensively across Blender 3.x/4.x naming."""
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if not bsdf:
        return
    aliases = {
        "base_color": ("Base Color",),
        "metallic": ("Metallic",),
        "roughness": ("Roughness",),
        "alpha": ("Alpha",),
        "ior": ("IOR",),
        "transmission": ("Transmission Weight", "Transmission"),
        "emission_color": ("Emission Color", "Emission"),
        "emission_strength": ("Emission Strength",),
        "coat_weight": ("Coat Weight", "Clearcoat"),
        "coat_roughness": ("Coat Roughness", "Clearcoat Roughness"),
    }
    for key, names in aliases.items():
        if key not in values:
            continue
        for name in names:
            if name in bsdf.inputs:
                bsdf.inputs[name].default_value = values[key]
                break


def make_mat(name: str, values: dict, blend: bool = False) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    set_principled(mat, values)
    if blend:
        mat.blend_method = "BLEND"
        mat.use_screen_refraction = True
        mat.show_transparent_back = True
        mat.alpha_threshold = 0.01
    return mat


def enable_auto_smooth(obj: bpy.types.Object, angle_deg: float = 180.0) -> None:
    """Bevel harden_normals + weighted normals require smooth + auto smooth first."""
    mesh = obj.data
    if not isinstance(mesh, bpy.types.Mesh):
        return
    prev_active = bpy.context.view_layer.objects.active
    prev_selected = obj.select_get()
    try:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        # shade_smooth() must run before use_auto_smooth — on Blender 4.x the op clears auto smooth.
        bpy.ops.object.shade_smooth()
    except Exception:
        for poly in mesh.polygons:
            poly.use_smooth = True
    finally:
        obj.select_set(prev_selected)
        if prev_active is not None:
            bpy.context.view_layer.objects.active = prev_active
    if hasattr(mesh, "use_auto_smooth"):
        mesh.use_auto_smooth = True
        mesh.auto_smooth_angle = math.radians(angle_deg)


def add_beveled_cube(
    name: str,
    size: Vec3,
    location: Vec3,
    material: bpy.types.Material,
    bevel: float,
    segments: int,
    apply_modifiers: bool = False,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)

    # Auto smooth must be enabled before bevel / weighted-normal modifiers evaluate.
    enable_auto_smooth(obj)

    bevel_mod = obj.modifiers.new(f"{name}_micro_bevel", "BEVEL")
    bevel_mod.width = bevel
    bevel_mod.segments = segments
    bevel_mod.affect = "EDGES"
    bevel_mod.harden_normals = True

    weighted = obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    weighted.keep_sharp = True

    if apply_modifiers:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=bevel_mod.name)
        bpy.ops.object.modifier_apply(modifier=weighted.name)
        obj.select_set(False)
    return obj


def create_bar(name: str, loc: Vec3, scale: Vec3, rot: Vec3, mat: bpy.types.Material, glow: bool = False) -> bpy.types.Object:
    obj = add_beveled_cube(
        name=name,
        size=scale,
        location=loc,
        material=mat,
        bevel=0.006 if glow else 0.012,
        segments=4,
        apply_modifiers=False,
    )
    obj.rotation_euler = rot
    return obj


def add_face_frame(prefix: str, face: str, half: float, mat: bpy.types.Material, inset: float = 0.52) -> None:
    """Add restrained inset seam bars to one cube face."""
    z = half + 0.006
    length = 1.06
    thick = 0.018
    depth = 0.014
    # Build bars in local front-face coordinates, then map to selected face.
    bars = [
        ((0, inset, z), (length, thick, depth)),
        ((0, -inset, z), (length, thick, depth)),
        ((inset, 0, z), (thick, length, depth)),
        ((-inset, 0, z), (thick, length, depth)),
    ]
    transforms = {
        "front": ((0, 0, 0), lambda p: (p[0], p[1], p[2])),
        "back": ((0, math.pi, 0), lambda p: (-p[0], p[1], -p[2])),
        "right": ((0, math.pi / 2, 0), lambda p: (p[2], p[1], -p[0])),
        "left": ((0, -math.pi / 2, 0), lambda p: (-p[2], p[1], p[0])),
        "top": ((-math.pi / 2, 0, 0), lambda p: (p[0], p[2], -p[1])),
        "bottom": ((math.pi / 2, 0, 0), lambda p: (p[0], -p[2], p[1])),
    }
    rot, mapper = transforms[face]
    for idx, (p, s) in enumerate(bars):
        loc = mapper(p)
        if face in {"right", "left"}:
            size = (s[2], s[1], s[0]) if idx >= 2 else (s[2], s[1], s[0])
        elif face in {"top", "bottom"}:
            size = (s[0], s[2], s[1]) if idx < 2 else (s[0], s[2], s[1])
        else:
            size = s
        create_bar(f"{prefix}_{face}_seam_{idx+1}", loc, size, rot, mat)


def add_hidden_4626(mat: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.object.text_add(location=(0, -0.02, 0.896), rotation=(0, 0, 0))
    text = bpy.context.object
    text.name = "hidden_4626_mark"
    text.data.body = "4626"
    text.data.align_x = "CENTER"
    text.data.align_y = "CENTER"
    text.data.size = 0.18
    text.data.extrude = 0.002
    text.data.bevel_depth = 0.0005
    text.data.materials.append(mat)
    bpy.context.view_layer.objects.active = text
    text.select_set(True)
    bpy.ops.object.convert(target="MESH")
    enable_auto_smooth(bpy.context.object)
    text.select_set(False)
    return bpy.context.object


def apply_mesh_modifiers(obj: bpy.types.Object) -> None:
    """Bake bevel + weighted normals into export geometry."""
    if obj.type != "MESH" or not obj.modifiers:
        return
    # Modifiers were authored with auto smooth already on; do not re-run shade_smooth here
    # (Blender 4.x clears internal auto-smooth state on a second shade_smooth call).
    mesh = obj.data
    if hasattr(mesh, "use_auto_smooth") and not mesh.use_auto_smooth:
        mesh.use_auto_smooth = True
        mesh.auto_smooth_angle = math.radians(180.0)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for mod in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except RuntimeError as exc:
            print(f"WARN: could not apply {mod.name} on {obj.name}: {exc}")
    obj.select_set(False)


def prepare_meshes_for_export() -> None:
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            apply_mesh_modifiers(obj)


def ensure_gltf_numpy() -> None:
    """Ubuntu apt Blender builds often ship glTF export without numpy."""
    try:
        import numpy as np  # noqa: F401
        return
    except ImportError:
        pass

    import subprocess

    print("glTF export requires numpy; installing into Blender's Python...")
    pip_flags = [
        [sys.executable, "-m", "pip", "install", "numpy", "--user"],
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "numpy",
            "--break-system-packages",
        ],
    ]
    last_error: Exception | None = None
    for cmd in pip_flags:
        try:
            subprocess.check_call(cmd)
            import numpy as np  # noqa: F401
            print("numpy installed successfully.")
            return
        except Exception as exc:
            last_error = exc

    raise RuntimeError(
        "glTF export needs numpy in Blender's Python. Run once:\n"
        f"  {sys.executable} -m pip install numpy --break-system-packages\n"
        "Or: sudo apt install python3-numpy"
    ) from last_error


def setup_scene() -> None:
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 128
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.world.color = (0.0, 0.0, 0.0)

    bpy.ops.object.light_add(type="AREA", location=(-3.0, 2.3, -2.6), rotation=(math.radians(62), 0, math.radians(-38)))
    rim = bpy.context.object
    rim.name = "thin_cool_rim_softbox"
    rim.data.energy = 420
    rim.data.size = 1.3

    bpy.ops.object.light_add(type="AREA", location=(2.2, -1.2, 2.8), rotation=(math.radians(115), 0, math.radians(42)))
    low = bpy.context.object
    low.name = "low_warm_micro_edge"
    low.data.energy = 45
    low.data.size = 2.2

    bpy.ops.object.camera_add(location=(0.0, 0.28, 5.6), rotation=(math.radians(86.5), 0, 0))
    cam = bpy.context.object
    bpy.context.scene.camera = cam
    cam.name = "hero_camera"
    cam.data.lens = 78
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = 5.5
    cam.data.dof.aperture_fstop = 8


def export_glb(path: str) -> None:
    ensure_gltf_numpy()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    kwargs = dict(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_apply=False,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_colors=True,
        export_cameras=False,
        export_lights=False,
    )
    # Draco is opt-in — apt Blender often lacks libextern_draco.so.
    use_draco = os.environ.get("OBSIDIAN_VAULT_GLTF_DRACO", "").strip() == "1"
    if use_draco:
        try:
            bpy.ops.export_scene.gltf(
                **kwargs,
                export_draco_mesh_compression_enable=True,
                export_draco_mesh_compression_level=6,
                export_draco_position_quantization=14,
                export_draco_normal_quantization=10,
                export_draco_texcoord_quantization=12,
            )
            return
        except Exception as exc:
            print(f"WARN: Draco export failed ({exc}); exporting uncompressed GLB.")

    bpy.ops.export_scene.gltf(**kwargs)


def main() -> None:
    clean_scene()

    obsidian_core = make_mat(
        "M_obsidian_core_near_black",
        {
            "base_color": (0.002, 0.002, 0.006, 1.0),
            "metallic": 0.82,
            "roughness": 0.30,
            "alpha": 1.0,
            "coat_weight": 0.95,
            "coat_roughness": 0.16,
            "ior": 1.55,
        },
    )
    smoked_shell = make_mat(
        "M_smoked_glass_shell_low_alpha",
        {
            "base_color": (0.0, 0.0, 0.012, 0.28),
            "metallic": 0.0,
            "roughness": 0.055,
            "alpha": 0.28,
            "transmission": 0.18,
            "ior": 1.48,
            "coat_weight": 1.0,
            "coat_roughness": 0.06,
        },
        blend=True,
    )
    black_chrome = make_mat(
        "M_black_chrome_micro_edges",
        {
            "base_color": (0.006, 0.006, 0.008, 1.0),
            "metallic": 0.96,
            "roughness": 0.18,
            "alpha": 1.0,
            "coat_weight": 1.0,
            "coat_roughness": 0.1,
        },
    )
    hidden_glow = make_mat(
        "M_hidden_seam_emission_barely_on",
        {
            "base_color": (0.002, 0.003, 0.004, 1.0),
            "metallic": 0.0,
            "roughness": 0.4,
            "alpha": 1.0,
            "emission_color": (0.018, 0.023, 0.032, 1.0),
            "emission_strength": 0.025,
        },
    )

    core = add_beveled_cube("obsidian_vault_core", (1.72, 1.72, 1.72), (0, 0, 0), obsidian_core, 0.115, 18)
    core["role"] = "core"

    shell = add_beveled_cube("smoked_glass_outer_shell", (1.82, 1.82, 1.82), (0, 0, 0), smoked_shell, 0.145, 24)
    shell["role"] = "shell"
    shell.display_type = "TEXTURED"

    for face in ("front", "right", "top"):
        add_face_frame("vault", face, 0.866, black_chrome)
    for face in ("back", "left", "bottom"):
        add_face_frame("vault_secondary", face, 0.866, hidden_glow, inset=0.50)

    mark = add_hidden_4626(hidden_glow)
    mark["role"] = "hidden_mark"

    inner = add_beveled_cube("inner_shadow_mass", (1.42, 1.42, 1.42), (0, 0, 0), obsidian_core, 0.08, 10)
    inner.scale = (0.985, 0.985, 0.985)
    inner["role"] = "inner_shadow"

    setup_scene()
    prepare_meshes_for_export()

    output = argv_output_path()
    export_glb(output)
    print(f"Exported obsidian vault GLB: {output}")


if __name__ == "__main__":
    main()
