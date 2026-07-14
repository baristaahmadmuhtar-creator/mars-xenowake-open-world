"""Import and audit every Xenowake GLB with Blender's production importer."""

from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "public" / "models"
MAX_FILE_BYTES = 500_000


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def audit(path: Path) -> tuple[int, int, int, Vector]:
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"{path.name}: no mesh data")

    vertex_count = 0
    triangle_count = 0
    materials: set[str] = set()
    minimum = Vector((float("inf"),) * 3)
    maximum = Vector((float("-inf"),) * 3)
    for obj in meshes:
        mesh = obj.data
        mesh.calc_loop_triangles()
        vertex_count += len(mesh.vertices)
        triangle_count += len(mesh.loop_triangles)
        materials.update(slot.material.name for slot in obj.material_slots if slot.material)
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            minimum.x = min(minimum.x, point.x)
            minimum.y = min(minimum.y, point.y)
            minimum.z = min(minimum.z, point.z)
            maximum.x = max(maximum.x, point.x)
            maximum.y = max(maximum.y, point.y)
            maximum.z = max(maximum.z, point.z)

    if vertex_count == 0 or triangle_count == 0:
        raise RuntimeError(f"{path.name}: empty geometry")
    if path.stat().st_size > MAX_FILE_BYTES:
        raise RuntimeError(f"{path.name}: exceeds {MAX_FILE_BYTES} byte mobile budget")
    dimensions = maximum - minimum
    if min(dimensions) <= 0:
        raise RuntimeError(f"{path.name}: invalid bounds {tuple(dimensions)}")
    return vertex_count, triangle_count, len(materials), dimensions


def main() -> None:
    paths = sorted(MODEL_DIR.glob("*.glb"))
    if len(paths) != 10:
        raise RuntimeError(f"Expected 10 GLB assets, found {len(paths)}")
    total_triangles = 0
    for path in paths:
        vertices, triangles, materials, dimensions = audit(path)
        total_triangles += triangles
        print(
            f"VALID {path.name:<24} "
            f"vertices={vertices:<6} triangles={triangles:<6} materials={materials:<2} "
            f"bounds={dimensions.x:.2f}x{dimensions.y:.2f}x{dimensions.z:.2f} "
            f"bytes={path.stat().st_size}"
        )
    print(f"ASSET AUDIT PASSED: 10 files, {total_triangles} triangles")


if __name__ == "__main__":
    main()
