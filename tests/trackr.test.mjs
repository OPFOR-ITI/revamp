import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";

// Resolve the same server-only marker and source aliases that Next.js supplies.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return nextResolve(
        new URL("../node_modules/next/dist/compiled/server-only/empty.js", import.meta.url).href,
        context,
      );
    }

    if (specifier.startsWith("@/")) {
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href,
        context,
      );
    }

    if (specifier === "next/server") {
      return nextResolve(new URL("../node_modules/next/server.js", import.meta.url).href, context);
    }

    return nextResolve(specifier, context);
  },
});

const { trackrAttendanceUnitTreesResponseSchema } = await import("../src/lib/trackr-schema.ts");
const { getTrackrAttendanceUnitsFromTrees } = await import("../src/lib/trackr-config.ts");
const fixture = JSON.parse(await readFile(new URL("./fixtures/trackr-attendance-unit-trees.json", import.meta.url), "utf8"));

test("current Trackr trees retain eligible-member counts and all nested units", () => {
  const parsed = trackrAttendanceUnitTreesResponseSchema.parse(fixture);

  assert.equal(parsed.subtrees[0].stats.numDirectAndEligibleMembers, 0);
  assert.equal(parsed.subtrees[0].children[0].stats.numDirectAndEligibleMembers, 1);
  assert.equal(parsed.subtrees[0].stats.numDirectMembers, undefined);
  assert.deepEqual(
    getTrackrAttendanceUnitsFromTrees(parsed).map((unit) => unit.id).sort(),
    [fixture.subtrees[0].id, fixture.subtrees[0].children[0].id].sort(),
  );
});

test("legacy Trackr trees still accept numDirectMembers", () => {
  const legacy = structuredClone(fixture);
  const root = legacy.subtrees[0];

  for (const node of [root, ...root.children]) {
    node.stats.numDirectMembers = node.stats.numDirectAndEligibleMembers;
    delete node.stats.numDirectAndEligibleMembers;
  }

  const parsed = trackrAttendanceUnitTreesResponseSchema.parse(legacy);
  assert.equal(parsed.subtrees[0].children[0].stats.numDirectMembers, 1);
});

test("trees without optional stats still supply attendance units", () => {
  const tree = structuredClone(fixture);
  delete tree.subtrees[0].stats;
  delete tree.subtrees[0].children[0].stats;
  assert.equal(getTrackrAttendanceUnitsFromTrees(trackrAttendanceUnitTreesResponseSchema.parse(tree)).length, 2);
});

test("renamed and legacy counters remain nonnegative integers when supplied", () => {
  for (const field of ["numDirectMembers", "numDirectAndEligibleMembers"]) {
    for (const value of [-1, 1.5, "1", null]) {
      const invalid = structuredClone(fixture);
      invalid.subtrees[0].children[0].stats[field] = value;
      assert.equal(trackrAttendanceUnitTreesResponseSchema.safeParse(invalid).success, false, `${field}=${value}`);
    }
  }
});

test("malformed unit ids and required cumulative stats are still rejected", () => {
  const invalid = structuredClone(fixture);
  invalid.subtrees[0].children[0].id = "invalid-id";
  assert.equal(trackrAttendanceUnitTreesResponseSchema.safeParse(invalid).success, false);

  const missing = structuredClone(fixture);
  delete missing.subtrees[0].stats.numCumulativeMembers;
  assert.equal(trackrAttendanceUnitTreesResponseSchema.safeParse(missing).success, false);
});

test("attendance review returns users and attendance through real HTTP", {
  skip: !process.env.TRACKR_SIMULATION_URL,
}, async () => {
  const { POST } = await import("../src/app/api/trackr/attendance/review/route.ts");
  const realFetch = globalThis.fetch;

  // Change only HTTP routing. Every response comes from the running simulation.
  globalThis.fetch = (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://app.trackr.gov.sg");
    return realFetch(new URL(url.pathname + url.search, process.env.TRACKR_SIMULATION_URL), {
      ...init,
      headers: { ...init.headers, "x-mock-slug": "trackr" },
    });
  };

  try {
    const response = await POST(new Request("http://localhost/api/trackr/attendance/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cookie: "trackr.sid=synthetic-test-session",
        activityId: "44444444-4444-4444-8444-444444444444",
      }),
    }));
    const body = await response.json();

    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(body.queriedUnitCount, 2);
    assert.equal(body.queriedUserCount, 1);
    assert.equal(body.attendanceRows.length, 1);
    assert.equal(body.attendanceRows[0].name, "Test user");
    assert.equal(body.attendanceRows[0].currentStatusName, "Present");
  } finally {
    globalThis.fetch = realFetch;
  }
});
