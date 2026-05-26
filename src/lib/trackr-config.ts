import type {
  TrackrAttendanceUnitTree,
  TrackrAttendanceUnitTreesResponse,
  TrackrUnit,
} from "@/lib/trackr-schema";

function compareTrackrUnits(left: TrackrUnit, right: TrackrUnit) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function addAttendanceUnitTreeUnits(
  tree: TrackrAttendanceUnitTree,
  unitsById: Map<string, TrackrUnit>,
) {
  unitsById.set(tree.id, {
    id: tree.id,
    name: tree.name,
  });

  for (const child of tree.children) {
    addAttendanceUnitTreeUnits(child, unitsById);
  }
}

export function getTrackrAttendanceUnitsFromTrees(
  treesResponse: TrackrAttendanceUnitTreesResponse,
) {
  const unitsById = new Map<string, TrackrUnit>();

  for (const subtree of treesResponse.subtrees) {
    addAttendanceUnitTreeUnits(subtree, unitsById);
  }

  return Array.from(unitsById.values()).sort(compareTrackrUnits);
}
