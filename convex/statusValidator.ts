import { v, type VLiteral } from "convex/values";

import { STATUS_VALUES, type Status } from "../src/lib/constants";

const statusLiterals = STATUS_VALUES.map((status) => v.literal(status)) as [
  VLiteral<Status>,
  VLiteral<Status>,
  ...VLiteral<Status>[],
];

export const statusValidator = v.union(...statusLiterals);
