"""Generate the Mars: Xenowake mobile-ready GLB asset pack and QA renders.

Run with Blender 5.2+:
  blender --background --python tools/blender/generate_assets.py

The models are deliberately geometry-and-material driven. They need no external
texture fetches, remain deterministic, and keep the browser payload small.
"""

from __future__ import annotations

import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "public" / "models"
RENDER_DIR = ROOT / "docs" / "renders"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
RENDER_DIR.mkdir(parents=True, exist_ok=True)

MATERIALS: dict[str, bpy.types.Material] = {}


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def material(
    name: str,
    color: tuple[float, float, float, float],
    metallic: float = 0.0,
    roughness: float = 0.55,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    key = f"{name}:{color}:{metallic}:{roughness}:{emission}:{emission_strength}"
    cached = MATERIALS.get(key)
    if cached:
        return cached
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.diffuse_color = color
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = color
    node.inputs["Metallic"].default_value = metallic
    node.inputs["Roughness"].default_value = roughness
    if emission:
        node.inputs["Emission Color"].default_value = emission
        node.inputs["Emission Strength"].default_value = emission_strength
    MATERIALS[key] = mat
    return mat


def apply_bevel(obj: bpy.types.Object, amount: float = 0.06, segments: int = 2) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new(name="PrecisionBevel", type="BEVEL")
    modifier.width = amount
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def finish(obj: bpy.types.Object, mat: bpy.types.Material, smooth: bool = False) -> bpy.types.Object:
    obj.data.materials.append(mat)
    if smooth and hasattr(obj.data, "polygons"):
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def cube(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.05,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    if bevel > 0:
        apply_bevel(obj, bevel)
    return finish(obj, mat)


def sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    segments: int = 20,
    rings: int = 12,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, smooth=True)


def ico(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    subdivisions: int = 2,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, smooth=subdivisions > 1)


def cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    vertices: int = 12,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
    bevel: float = 0.03,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    if bevel > 0:
        apply_bevel(obj, bevel)
    return finish(obj, mat, smooth=vertices >= 16)


def cone(
    name: str,
    location: tuple[float, float, float],
    radius1: float,
    radius2: float,
    depth: float,
    mat: bpy.types.Material,
    vertices: int = 6,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return finish(obj, mat)


def torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    mat: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    major_segments: int = 32,
    minor_segments: int = 8,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return finish(obj, mat, smooth=True)


def cylinder_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    mat: bpy.types.Material,
    vertices: int = 8,
) -> bpy.types.Object:
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    midpoint = (start_vector + end_vector) * 0.5
    obj = cylinder(name, tuple(midpoint), radius, direction.length, mat, vertices=vertices, bevel=radius * 0.18)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=False)
    obj.select_set(False)
    return obj


def crystal(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    height: float,
    mat: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    return cone(name, location, radius, 0.0, height, mat, vertices=6, rotation=rotation)


def palette() -> dict[str, bpy.types.Material]:
    return {
        "obsidian": material("ObsidianArmor", (0.025, 0.035, 0.045, 1), 0.78, 0.24),
        "charcoal": material("CharcoalMetal", (0.07, 0.075, 0.085, 1), 0.72, 0.38),
        "ivory": material("DustIvoryCeramic", (0.53, 0.49, 0.40, 1), 0.22, 0.62),
        "bone": material("BoneArmor", (0.70, 0.65, 0.54, 1), 0.12, 0.54),
        "rust": material("MarsRust", (0.46, 0.13, 0.065, 1), 0.12, 0.75),
        "rust_light": material("MarsRustLight", (0.68, 0.25, 0.11, 1), 0.18, 0.66),
        "violet": material("NixVioletSkin", (0.20, 0.12, 0.28, 1), 0.03, 0.46),
        "violet_light": material("NixVioletHighlight", (0.42, 0.28, 0.51, 1), 0.02, 0.4),
        "cloth": material("FrontierCloth", (0.085, 0.07, 0.065, 1), 0.02, 0.94),
        "cyan": material(
            "XeniteCyan", (0.08, 0.70, 0.68, 1), 0.3, 0.18,
            emission=(0.02, 1.0, 0.88, 1), emission_strength=6.0,
        ),
        "cyan_dim": material(
            "XeniteCyanDim", (0.035, 0.20, 0.20, 1), 0.42, 0.28,
            emission=(0.01, 0.34, 0.31, 1), emission_strength=2.0,
        ),
        "red": material(
            "GuardianRed", (0.34, 0.025, 0.012, 1), 0.4, 0.22,
            emission=(1.0, 0.025, 0.008, 1), emission_strength=6.5,
        ),
        "visor": material(
            "AriVisor", (0.035, 0.14, 0.17, 1), 0.74, 0.08,
            emission=(0.015, 0.36, 0.40, 1), emission_strength=1.2,
        ),
        "black": material("RubberSeal", (0.018, 0.018, 0.021, 1), 0.1, 0.88),
        "rock": material("MartianBasalt", (0.16, 0.045, 0.032, 1), 0.08, 0.93),
    }


def build_nix(m: dict[str, bpy.types.Material]) -> None:
    # Feet, legs and layered organic armor.
    for side in (-1, 1):
        x = side * 0.26
        cube(f"NIX_Foot_{side}", (x, -0.09, 0.16), (0.22, 0.42, 0.13), m["obsidian"], bevel=0.07)
        cylinder_between(f"NIX_Shin_{side}", (x, 0.02, 0.32), (x, 0.02, 0.97), 0.15, m["violet"], 10)
        cube(f"NIX_ShinArmor_{side}", (x, -0.13, 0.70), (0.18, 0.12, 0.34), m["bone"], rotation=(side * 0.04, 0, side * 0.02), bevel=0.055)
        sphere(f"NIX_Knee_{side}", (x, -0.02, 1.08), (0.22, 0.18, 0.19), m["charcoal"], 12, 8)
        cylinder_between(f"NIX_Thigh_{side}", (x, 0.02, 1.18), (side * 0.31, 0.02, 1.70), 0.19, m["violet_light"], 10)
        # Arms and shoulder shells.
        cylinder_between(f"NIX_UpperArm_{side}", (side * 0.52, 0, 2.16), (side * 0.68, 0, 1.63), 0.13, m["violet"], 9)
        cylinder_between(f"NIX_Forearm_{side}", (side * 0.68, 0, 1.63), (side * 0.64, -0.05, 1.18), 0.12, m["violet_light"], 9)
        sphere(f"NIX_Hand_{side}", (side * 0.64, -0.06, 1.09), (0.13, 0.10, 0.20), m["violet"], 12, 8)
        sphere(f"NIX_Shoulder_{side}", (side * 0.51, 0.0, 2.19), (0.28, 0.34, 0.18), m["bone"], 12, 8)
        cube(f"NIX_Clavicle_{side}", (side * 0.27, -0.13, 2.16), (0.26, 0.08, 0.11), m["ivory"], rotation=(0, side * 0.12, side * 0.08), bevel=0.045)

    ico("NIX_Pelvis", (0, 0, 1.68), (0.48, 0.31, 0.34), m["obsidian"], 2)
    sphere("NIX_Torso", (0, 0.02, 2.08), (0.48, 0.31, 0.55), m["cloth"], 16, 10)
    cube("NIX_ChestPlate", (0, -0.275, 2.15), (0.34, 0.07, 0.32), m["bone"], bevel=0.085)
    crystal("NIX_ChestCore", (0, -0.36, 2.13), 0.13, 0.32, m["cyan"], rotation=(math.pi / 2, 0, 0))
    cylinder("NIX_Neck", (0, 0, 2.58), 0.18, 0.30, m["charcoal"], 10)
    ico("NIX_Head", (0, -0.015, 2.91), (0.44, 0.36, 0.48), m["violet_light"], 2, rotation=(0.05, 0, 0))
    for side in (-1, 1):
        sphere(f"NIX_Eye_{side}", (side * 0.18, -0.342, 2.98), (0.13, 0.035, 0.075), m["cyan"], 12, 8)
    for index in range(4):
        z = 3.06 - index * 0.12
        cone(f"NIX_Crest_{index}", (0, 0.31 + index * 0.07, z), 0.13 - index * 0.012, 0.02, 0.52, m["violet"], 5, rotation=(0.72, 0, 0))
    ico("NIX_BackCore", (0, 0.36, 2.15), (0.25, 0.16, 0.34), m["cyan_dim"], 1)


def build_ari(m: dict[str, bpy.types.Material]) -> None:
    for side in (-1, 1):
        x = side * 0.23
        cube(f"ARI_Boot_{side}", (x, -0.06, 0.16), (0.23, 0.38, 0.16), m["black"], bevel=0.06)
        cylinder_between(f"ARI_Shin_{side}", (x, 0, 0.30), (x, 0, 0.86), 0.17, m["rust"], 10)
        cube(f"ARI_Knee_{side}", (x, -0.16, 0.91), (0.20, 0.12, 0.13), m["charcoal"], bevel=0.035)
        cylinder_between(f"ARI_Thigh_{side}", (x, 0, 1.02), (side * 0.28, 0, 1.53), 0.20, m["cloth"], 10)
        cylinder_between(f"ARI_UpperArm_{side}", (side * 0.52, 0, 2.06), (side * 0.67, -0.01, 1.56), 0.16, m["rust_light"], 10)
        cylinder_between(f"ARI_Forearm_{side}", (side * 0.67, -0.01, 1.56), (side * 0.62, -0.10, 1.16), 0.14, m["ivory"], 10)
        sphere(f"ARI_Glove_{side}", (side * 0.62, -0.11, 1.08), (0.15, 0.13, 0.18), m["black"], 12, 8)
        cube(f"ARI_Shoulder_{side}", (side * 0.48, -0.01, 2.08), (0.25, 0.30, 0.17), m["ivory"], rotation=(0, side * 0.08, side * 0.06), bevel=0.065)
    ico("ARI_Pelvis", (0, 0, 1.52), (0.46, 0.33, 0.29), m["charcoal"], 2)
    cube("ARI_Torso", (0, 0, 1.94), (0.43, 0.30, 0.47), m["ivory"], bevel=0.11)
    cube("ARI_ChestRig", (0, -0.31, 1.92), (0.31, 0.10, 0.29), m["rust"], bevel=0.045)
    for x in (-0.19, 0, 0.19):
        cube("ARI_RigPouch", (x, -0.43, 1.78), (0.075, 0.055, 0.10), m["charcoal"], bevel=0.02)
    sphere("ARI_Helmet", (0, 0, 2.68), (0.49, 0.45, 0.48), m["ivory"], 20, 12)
    sphere("ARI_Visor", (0, -0.39, 2.70), (0.34, 0.07, 0.25), m["visor"], 18, 10)
    torus("ARI_HelmetSeal", (0, 0, 2.61), 0.43, 0.055, m["charcoal"], rotation=(math.pi / 2, 0, 0), major_segments=20, minor_segments=6)
    cube("ARI_Backpack", (0, 0.40, 1.98), (0.37, 0.18, 0.43), m["charcoal"], bevel=0.075)
    for side in (-1, 1):
        cylinder(f"ARI_Tank_{side}", (side * 0.22, 0.60, 1.98), 0.10, 0.62, m["bone"], 10)
    cylinder("ARI_Antenna", (0.30, 0.46, 2.56), 0.018, 0.85, m["charcoal"], 7)
    sphere("ARI_AntennaTip", (0.30, 0.46, 3.0), (0.05, 0.05, 0.05), m["cyan"], 8, 6)


def build_guardian(m: dict[str, bpy.types.Material]) -> None:
    ico("Guardian_Core", (0, 0, 0), (0.72, 0.56, 0.72), m["obsidian"], 2, rotation=(0.2, 0.1, 0.0))
    ico("Guardian_Eye", (0, -0.56, 0.04), (0.22, 0.08, 0.28), m["red"], 1)
    torus("Guardian_OrbitA", (0, 0, 0), 1.03, 0.075, m["charcoal"], rotation=(math.pi / 2, 0.0, 0.35), major_segments=24, minor_segments=6)
    torus("Guardian_OrbitB", (0, 0, 0), 1.35, 0.055, m["cyan_dim"], rotation=(math.pi / 2, 0.5, -0.35), major_segments=28, minor_segments=6)
    for index in range(6):
        angle = index * math.tau / 6
        x, z = math.cos(angle) * 1.45, math.sin(angle) * 1.45
        ico(f"Guardian_Petal_{index}", (x, 0, z), (0.20, 0.12, 0.48), m["obsidian"], 1, rotation=(0, angle, angle + math.pi / 2))
        crystal(f"Guardian_Glyph_{index}", (x, -0.12, z), 0.055, 0.26, m["cyan"], rotation=(math.pi / 2, 0, angle))
    for side in (-1, 1):
        cone(f"Guardian_Crown_{side}", (side * 0.35, 0.08, 0.84), 0.24, 0.03, 0.86, m["obsidian"], 4, rotation=(0, side * 0.22, -side * 0.25))


def build_crawler(m: dict[str, bpy.types.Material]) -> None:
    ico("Crawler_MainHull", (0, 0.05, 1.34), (1.34, 1.02, 0.64), m["rust"], 2)
    cube("Crawler_ArmorTop", (0, 0.10, 1.73), (1.00, 0.73, 0.18), m["rust_light"], bevel=0.12)
    ico("Crawler_Head", (0, -1.02, 1.22), (0.72, 0.54, 0.44), m["ivory"], 2)
    for side in (-1, 1):
        sphere(f"Crawler_Eye_{side}", (side * 0.28, -1.47, 1.32), (0.12, 0.06, 0.10), m["red"], 10, 7)
    for row, y in enumerate((-0.68, 0.0, 0.68)):
        for side in (-1, 1):
            hip = (side * 0.92, y, 1.30)
            knee = (side * (1.52 + 0.08 * row), y + (row - 1) * 0.10, 0.72)
            foot = (side * (1.78 + 0.10 * row), y + (row - 1) * 0.18, 0.08)
            cylinder_between(f"Crawler_UpperLeg_{row}_{side}", hip, knee, 0.14, m["charcoal"], 8)
            cylinder_between(f"Crawler_LowerLeg_{row}_{side}", knee, foot, 0.11, m["rust_light"], 8)
            sphere(f"Crawler_Joint_{row}_{side}", knee, (0.20, 0.20, 0.20), m["obsidian"], 10, 7)
            cube(f"Crawler_Foot_{row}_{side}", foot, (0.20, 0.30, 0.09), m["black"], bevel=0.04)
    cylinder("Crawler_Spine", (0, 0.62, 1.72), 0.08, 1.10, m["charcoal"], 8, rotation=(math.pi / 2, 0, 0))
    for y in (-0.45, 0, 0.45):
        cone("Crawler_Spike", (0, y, 2.12), 0.13, 0.0, 0.52, m["obsidian"], 5)


def build_beacon(m: dict[str, bpy.types.Material]) -> None:
    cylinder("Beacon_Foundation", (0, 0, 0.45), 4.4, 0.9, m["rock"], 10, bevel=0.08)
    cylinder("Beacon_Base", (0, 0, 1.15), 3.45, 0.65, m["ivory"], 8, bevel=0.09)
    cylinder("Beacon_InnerBase", (0, 0, 1.62), 2.35, 0.55, m["obsidian"], 8, bevel=0.07)
    torus("Beacon_BaseEnergy", (0, 0, 1.92), 2.62, 0.08, m["cyan_dim"], major_segments=32, minor_segments=6)
    for index in range(4):
        angle = index * math.pi / 2 + math.pi / 4
        x, y = math.cos(angle) * 2.0, math.sin(angle) * 2.0
        pylon = cube(
            f"Beacon_Pylon_{index}", (x, y, 7.0), (0.48, 0.65, 5.1), m["ivory"],
            rotation=(0.0, -math.sin(angle) * 0.12, angle), bevel=0.12,
        )
        pylon.rotation_euler.z = angle
        cube(f"Beacon_PylonInset_{index}", (x * 0.93, y * 0.93, 7.4), (0.14, 0.18, 3.7), m["obsidian"], rotation=(0, 0, angle), bevel=0.03)
        crystal(f"Beacon_EnergyStrip_{index}", (x * 0.87, y * 0.87, 7.8), 0.10, 5.9, m["cyan_dim"], rotation=(0, 0, angle))
    crystal("Beacon_XeniteCore", (0, 0, 9.0), 1.05, 10.4, m["cyan"], rotation=(0, 0, math.pi / 4))
    cylinder("Beacon_Crown", (0, 0, 12.95), 1.32, 0.5, m["obsidian"], 8, bevel=0.07)
    for index in range(4):
        angle = index * math.pi / 2
        x, y = math.cos(angle) * 1.15, math.sin(angle) * 1.15
        cone(f"Beacon_CrownFin_{index}", (x, y, 13.8), 0.36, 0.03, 2.2, m["charcoal"], 5, rotation=(0.12 * math.sin(angle), -0.12 * math.cos(angle), angle))


def build_outpost(m: dict[str, bpy.types.Material]) -> None:
    cylinder("Outpost_Foundation", (0, 0, 0.28), 6.8, 0.56, m["rock"], 12, bevel=0.05)
    cylinder("Outpost_Core", (0, 0, 2.45), 4.2, 4.2, m["ivory"], 12, bevel=0.14)
    sphere("Outpost_Dome", (0, 0, 4.12), (3.5, 3.5, 1.35), m["bone"], 24, 12)
    cylinder("Outpost_DomeRing", (0, 0, 3.82), 3.55, 0.34, m["charcoal"], 16, bevel=0.05)
    for index, angle in enumerate((0, math.pi / 2, math.pi, math.pi * 1.5)):
        x, y = math.cos(angle) * 5.0, math.sin(angle) * 5.0
        cube(f"Outpost_Module_{index}", (x, y, 1.72), (2.25 if index % 2 == 0 else 1.65, 1.35, 1.42), m["ivory"], rotation=(0, 0, angle), bevel=0.16)
        cube(f"Outpost_ModuleArmor_{index}", (x, y, 2.12), (2.08 if index % 2 == 0 else 1.48, 1.39, 0.18), m["charcoal"], rotation=(0, 0, angle), bevel=0.06)
        wx, wy = math.cos(angle) * 6.38, math.sin(angle) * 6.38
        cube(f"Outpost_Window_{index}", (wx, wy, 1.93), (0.72, 0.08, 0.34), m["cyan_dim"], rotation=(0, 0, angle), bevel=0.035)
    # Front airlock and ramp face toward -Y.
    cube("Outpost_Airlock", (0, -4.92, 1.62), (1.35, 1.05, 1.42), m["charcoal"], bevel=0.14)
    cube("Outpost_Door", (0, -5.98, 1.60), (0.73, 0.08, 1.02), m["obsidian"], bevel=0.08)
    cube("Outpost_DoorLight", (0, -6.08, 1.65), (0.10, 0.035, 0.72), m["cyan"], bevel=0.025)
    for step in range(4):
        cube("Outpost_RampStep", (0, -6.45 - step * 0.38, 0.78 - step * 0.16), (1.15, 0.25, 0.09), m["charcoal"], bevel=0.025)
    cylinder("Outpost_AntennaMast", (0.65, 0.5, 6.35), 0.09, 4.2, m["charcoal"], 8)
    sphere("Outpost_AntennaNode", (0.65, 0.5, 8.45), (0.24, 0.24, 0.24), m["cyan"], 10, 7)
    for side in (-1, 1):
        cylinder(f"Outpost_Tank_{side}", (side * 3.35, 2.0, 1.05), 0.55, 2.0, m["rust"], 12, rotation=(0, math.pi / 2, 0), bevel=0.07)


def build_portal(m: dict[str, bpy.types.Material]) -> None:
    radius = 5.65
    for index in range(28):
        if index in (3, 4, 15, 16, 17):
            continue
        angle = index * math.tau / 28
        x = math.cos(angle) * radius
        z = math.sin(angle) * radius
        cube(
            f"Portal_Segment_{index}", (x, 0, z), (0.73, 0.60, 0.34),
            m["obsidian"] if index % 3 else m["charcoal"], rotation=(0, -angle, 0), bevel=0.09,
        )
        if index % 2 == 0:
            cube(f"Portal_Glyph_{index}", (x, -0.61, z), (0.30, 0.05, 0.08), m["cyan_dim"], rotation=(0, -angle, 0), bevel=0.018)
    for index in range(14):
        angle = index * math.tau / 14
        x, z = math.cos(angle) * 4.93, math.sin(angle) * 4.93
        cube(f"Portal_Inner_{index}", (x, -0.06, z), (0.42, 0.29, 0.16), m["cyan_dim"], rotation=(0, -angle, 0), bevel=0.05)
    # Broken supports and rubble sit around the ring's bottom (-5.65 local Z).
    for index, (x, y, z, s) in enumerate((
        (-4.8, 0.3, -6.1, 0.75), (-3.3, -0.2, -6.8, 0.62), (3.2, 0.1, -6.9, 0.85),
        (4.7, -0.35, -6.0, 0.70), (0.7, 0.6, -7.0, 0.55), (-1.4, -0.4, -6.9, 0.46),
    )):
        ico(f"Portal_Rubble_{index}", (x, y, z), (s, s * 0.65, s * 0.45), m["rock"], 1, rotation=(index * 0.3, index * 0.5, 0.2))


def build_xenite(m: dict[str, bpy.types.Material]) -> None:
    for index, (x, y, h, r, tilt) in enumerate((
        (0.0, 0.0, 2.9, 0.50, 0.0), (-0.62, 0.05, 1.95, 0.36, -0.18),
        (0.63, 0.12, 2.25, 0.40, 0.20), (-0.33, 0.42, 1.45, 0.29, -0.12),
        (0.38, -0.44, 1.35, 0.27, 0.13), (0.88, 0.44, 1.10, 0.22, 0.20),
    )):
        crystal(f"Xenite_Crystal_{index}", (x, y, h * 0.5), r, h, m["cyan"], rotation=(tilt, tilt * 0.4, index * 0.42))
    for index, (x, y, s) in enumerate(((-0.7, -0.35, 0.45), (0.65, -0.3, 0.42), (-0.2, 0.48, 0.38), (0.3, 0.38, 0.32))):
        ico(f"Xenite_BaseRock_{index}", (x, y, 0.15), (s, s * 0.75, s * 0.48), m["rock"], 1, rotation=(0.2 * index, 0.3 * index, 0.1))


def build_rock(m: dict[str, bpy.types.Material]) -> None:
    formations = (
        (0, 0, 1.8, 1.35, 3.6, 0.0), (-1.05, 0.18, 1.25, 0.85, 2.5, -0.22),
        (1.05, 0.10, 1.45, 0.95, 2.9, 0.19), (-0.52, -0.55, 0.72, 0.65, 1.45, -0.12),
        (0.63, -0.58, 0.60, 0.58, 1.20, 0.15),
    )
    for index, (x, y, z, radius, height, tilt) in enumerate(formations):
        cone(f"Rock_Spire_{index}", (x, y, z), radius, radius * 0.08, height, m["rust" if index % 2 else "rock"], 6, rotation=(tilt, tilt * 0.5, index * 0.55))
    for index in range(6):
        angle = index * 1.8
        ico(f"Rock_Rubble_{index}", (math.cos(angle) * 1.45, math.sin(angle) * 0.8, 0.18), (0.45, 0.35, 0.25), m["rust"], 1, rotation=(angle, angle * 0.4, 0.2))


def build_shuttle(m: dict[str, bpy.types.Material]) -> None:
    cylinder("Shuttle_Hull", (0, 0, 1.25), 1.35, 7.8, m["charcoal"], 8, rotation=(0, math.pi / 2, 0), scale=(1, 0.74, 1), bevel=0.12)
    cone("Shuttle_Nose", (4.45, 0, 1.25), 1.35, 0.12, 2.0, m["ivory"], 8, rotation=(0, math.pi / 2, 0))
    cube("Shuttle_Cockpit", (3.15, -0.84, 1.63), (0.95, 0.12, 0.48), m["visor"], rotation=(0, 0.18, 0), bevel=0.09)
    for side in (-1, 1):
        cube(f"Shuttle_Wing_{side}", (-0.25, side * 2.45, 0.92), (2.65, 1.65, 0.16), m["obsidian"], rotation=(0, side * 0.06, side * 0.18), bevel=0.08)
        cylinder(f"Shuttle_Engine_{side}", (-3.85, side * 0.72, 1.25), 0.52, 1.45, m["rust"], 10, rotation=(0, math.pi / 2, 0), bevel=0.06)
        cylinder(f"Shuttle_EngineGlow_{side}", (-4.60, side * 0.72, 1.25), 0.36, 0.08, m["cyan_dim"], 10, rotation=(0, math.pi / 2, 0), bevel=0.0)
    cube("Shuttle_BrokenPanel", (-1.8, -1.35, 0.62), (1.3, 0.72, 0.12), m["rust_light"], rotation=(0.1, 0.35, -0.32), bevel=0.05)
    for index in range(4):
        ico(f"Shuttle_Debris_{index}", (-3.4 + index * 1.2, 2.4 + (index % 2) * 0.55, 0.22), (0.50, 0.32, 0.24), m["charcoal"], 1, rotation=(index, index * 0.7, 0.3))


def join_model(asset_name: str) -> bpy.types.Object:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    model = bpy.context.object
    model.name = asset_name
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return model


def export_glb(asset_name: str) -> Path:
    path = MODEL_DIR / f"{asset_name}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_visible=True,
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
    )
    return path


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview(asset_name: str, camera: tuple[float, float, float], target: tuple[float, float, float], floor_z: float) -> Path:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 560
    scene.render.resolution_y = 560
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = str(RENDER_DIR / f"{asset_name}.png")
    scene.render.resolution_percentage = 100
    scene.view_settings.look = "AgX - Medium High Contrast"

    world = scene.world or bpy.data.worlds.new("XenowakeWorld")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.018, 0.008, 0.006, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.32

    preview_ground = material("PreviewGround", (0.20, 0.045, 0.022, 1), 0.0, 0.94)
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, floor_z))
    ground = bpy.context.object
    ground.name = "PreviewGround"
    ground.data.materials.append(preview_ground)

    bpy.ops.object.light_add(type="AREA", location=(-6, -8, target[2] + 8))
    key = bpy.context.object
    key.name = "WarmKey"
    key.data.energy = 1450
    key.data.shape = "DISK"
    key.data.size = 6
    key.data.color = (1.0, 0.36, 0.18)
    look_at(key, target)

    bpy.ops.object.light_add(type="AREA", location=(7, 3, target[2] + 4))
    rim = bpy.context.object
    rim.name = "CyanRim"
    rim.data.energy = 980
    rim.data.size = 4
    rim.data.color = (0.05, 1.0, 0.82)
    look_at(rim, target)

    bpy.ops.object.light_add(type="AREA", location=(0, 5, target[2] + 9))
    fill = bpy.context.object
    fill.name = "SoftFill"
    fill.data.energy = 700
    fill.data.size = 7
    fill.data.color = (1.0, 0.75, 0.56)
    look_at(fill, target)

    bpy.ops.object.camera_add(location=camera)
    cam = bpy.context.object
    cam.name = "PreviewCamera"
    cam.data.lens = 52
    look_at(cam, target)
    scene.camera = cam
    bpy.ops.render.render(write_still=True)
    return Path(scene.render.filepath)


ASSETS = {
    "nix-alien": (build_nix, (6.4, -8.8, 4.6), (0, 0, 1.55), -0.03),
    "ari-scout": (build_ari, (6.4, -8.8, 4.6), (0, 0, 1.52), -0.03),
    "guardian-drone": (build_guardian, (5.3, -7.2, 3.6), (0, 0, 0.0), -1.72),
    "mars-crawler": (build_crawler, (6.8, -8.8, 4.6), (0, 0, 1.0), -0.03),
    "signal-beacon": (build_beacon, (18.5, -22.0, 14.2), (0, 0, 6.7), -0.03),
    "frontier-outpost": (build_outpost, (16.5, -20.5, 11.6), (0, 0, 2.4), -0.03),
    "crash-portal": (build_portal, (13.8, -18.0, 7.6), (0, 0, -0.5), -7.2),
    "xenite-cluster": (build_xenite, (5.4, -7.2, 4.0), (0, 0, 1.25), -0.03),
    "martian-rock": (build_rock, (6.5, -8.4, 4.5), (0, 0, 1.45), -0.03),
    "wrecked-shuttle": (build_shuttle, (11.6, -14.5, 8.0), (0, 0, 1.0), -0.03),
}


def main() -> None:
    generated: list[tuple[str, Path, Path]] = []
    for asset_name, (builder, camera, target, floor_z) in ASSETS.items():
        clear_scene()
        MATERIALS.clear()
        mats = palette()
        builder(mats)
        join_model(asset_name)
        glb_path = export_glb(asset_name)
        render_path = render_preview(asset_name, camera, target, floor_z)
        generated.append((asset_name, glb_path, render_path))
        print(f"GENERATED {asset_name}: {glb_path.stat().st_size} bytes")

    print("\nXENOWAKE ASSET PACK COMPLETE")
    for name, glb_path, render_path in generated:
        print(f"- {name}: {glb_path.relative_to(ROOT)} | {render_path.relative_to(ROOT)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ASSET PIPELINE FAILED: {exc}", file=sys.stderr)
        raise
