/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");
const trees = require("../../../tests/fixtures/trackr-attendance-unit-trees.json");

// Synthetic identities; tree fields match the response observed on 2026-10-21.
http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const json = (status, body) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  };

  if (request.method === "GET" && url.pathname === "/api/v1/attendance/units/trees") {
    json(200, trees);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/v1/users/query") {
    const expected = [trees.subtrees[0].id, trees.subtrees[0].children[0].id].sort();
    const actual = request.body?.unitIds?.slice().sort();

    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      json(400, { message: "Query must include the root and nested attendance units." });
      return;
    }

    json(200, {
      users: [{
        id: "33333333-3333-4333-8333-333333333333",
        name: "Test user",
        units: [{ id: trees.subtrees[0].children[0].id, name: "Test subunit" }],
      }],
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/attendance/activities/44444444-4444-4444-8444-444444444444") {
    json(200, {
      attendances: [{
        id: 1,
        user: { id: "33333333-3333-4333-8333-333333333333", name: "Test user" },
        status: { id: 1, name: "Present" },
      }],
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/statuses") {
    json(200, { statuses: [{ id: 1, name: "Present" }] });
    return;
  }

  json(501, { message: "Endpoint is outside this regression simulation." });
}).listen(process.env.PORT || 4901);
