type ParadeStatePrimaryComparableRecord = {
  status: string;
  customStatus?: string;
  createdAt: number;
  updatedAt: number;
};

type CompanyOutBucket =
  | "MC"
  | "EX_STAY_IN"
  | "HOSPITALISED"
  | "RSO"
  | "OFF"
  | "LEAVE"
  | "DB"
  | "BOOKED_OUT"
  | "OTHERS";

const PRIMARY_BUCKET_PRECEDENCE: Record<CompanyOutBucket, number> = {
  HOSPITALISED: 0,
  MC: 1,
  RSO: 2,
  EX_STAY_IN: 3,
  LEAVE: 4,
  OFF: 5,
  DB: 6,
  BOOKED_OUT: 7,
  OTHERS: 8,
};

function normalizeComparableText(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function formatParadeStateStatusLabel(status: string, customStatus?: string) {
  if (normalizeComparableText(status) === "OTHERS") {
    const normalizedCustomStatus = customStatus?.trim().replace(/\s+/g, " ");
    return normalizedCustomStatus || "Others";
  }

  return status.trim().replace(/\s+/g, " ");
}

export function getCompanyBucketForParadeStateStatus(
  status: string,
): CompanyOutBucket {
  switch (normalizeComparableText(status)) {
    case "HOSPITALISED":
      return "HOSPITALISED";
    case "MC":
      return "MC";
    case "RSO":
      return "RSO";
    case "EX STAY IN":
      return "EX_STAY_IN";
    case "LEAVE":
      return "LEAVE";
    case "OFF":
      return "OFF";
    case "DB":
      return "DB";
    case "BOOKED OUT":
      return "BOOKED_OUT";
    default:
      return "OTHERS";
  }
}

export function compareParadeStatePrimaryRecords<
  T extends ParadeStatePrimaryComparableRecord,
>(left: T, right: T) {
  const bucketDelta =
    PRIMARY_BUCKET_PRECEDENCE[
      getCompanyBucketForParadeStateStatus(left.status)
    ] -
    PRIMARY_BUCKET_PRECEDENCE[
      getCompanyBucketForParadeStateStatus(right.status)
    ];

  if (bucketDelta !== 0) {
    return bucketDelta;
  }

  if (right.createdAt !== left.createdAt) {
    return right.createdAt - left.createdAt;
  }

  if (right.updatedAt !== left.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }

  return 0;
}

export function pickPrimaryParadeStateRecord<
  T extends ParadeStatePrimaryComparableRecord,
>(records: T[]) {
  return [...records].sort(compareParadeStatePrimaryRecords)[0] ?? null;
}
