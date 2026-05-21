import "server-only";

import {
  trackrActivitiesResponseSchema,
  trackrActivityAttendanceResponseSchema,
  trackrAttendancePatchPayloadSchema,
  trackrAttendanceUserAddPayloadSchema,
  trackrCreateActivitiesPayloadSchema,
  trackrCreateActivitiesResponseSchema,
  trackrHaCurrencyUnitResponseSchema,
  trackrStatusesResponseSchema,
  trackrUsersQueryPayloadSchema,
  trackrUsersQueryResponseSchema,
  type TrackrAttendancePatchPayload,
  type TrackrAttendanceUserAddPayload,
  type TrackrCreateActivitiesPayload,
  type TrackrUsersQueryPayload,
} from "@/lib/trackr-schema";

const TRACKR_DEFAULT_BASE_URL = "https://app.trackr.gov.sg";
const TRACKR_DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Safari/605.1.15";

export class TrackrError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(
    code: string,
    message: string,
    {
      status = 502,
      details,
    }: {
      status?: number;
      details?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "TrackrError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type TrackrRequestOptions = {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  signal?: AbortSignal;
};

export type TrackrClientOptions = {
  baseUrl?: string;
  cookie?: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
};

function normalizeTrackrCookie(cookie: string) {
  const trimmedCookie = cookie.trim().replace(/^cookie:\s*/i, "");

  if (!trimmedCookie) {
    throw new TrackrError(
      "TRACKR_COOKIE_INVALID",
      "Trackr cookie was empty after normalization.",
      { status: 500 },
    );
  }

  if (trimmedCookie.includes("trackr.sid=") || trimmedCookie.includes("=")) {
    return trimmedCookie;
  }

  return `trackr.sid=${trimmedCookie}`;
}

function getRequiredTrackrCookie() {
  const cookie = process.env.TRACKR_COOKIE;

  if (!cookie) {
    throw new TrackrError(
      "TRACKR_COOKIE_MISSING",
      "Missing required server environment variable TRACKR_COOKIE.",
      { status: 500 },
    );
  }

  return normalizeTrackrCookie(cookie);
}

async function parseTrackrResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as unknown;
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function isHtmlResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("text/html");
}

function isLikelyHtmlDocument(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim().toLowerCase();

  return trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html");
}

function getTrackrFailureMessage(response: Response, parsedResponse: unknown) {
  if (response.status === 401) {
    return "Trackr authentication failed. Refresh your Trackr session cookie and try again.";
  }

  if (
    response.status === 403 &&
    (isHtmlResponse(response) || isLikelyHtmlDocument(parsedResponse))
  ) {
    return "Trackr rejected this server request before it reached the API. In deployment this usually means the hosting IP or region is blocked, so run this route from a Singapore-based server or locally.";
  }

  return (
    extractTrackrErrorMessage(parsedResponse) ??
    `Trackr request failed with status ${response.status}.`
  );
}

export class TrackrClient {
  private readonly baseUrl: string;
  private readonly cookie: string;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;

  constructor({
    baseUrl = TRACKR_DEFAULT_BASE_URL,
    cookie,
    userAgent = TRACKR_DEFAULT_USER_AGENT,
    fetchImpl = fetch,
  }: TrackrClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.cookie = normalizeTrackrCookie(cookie ?? getRequiredTrackrCookie());
    this.userAgent = userAgent;
    this.fetchImpl = fetchImpl;
  }

  async listActivityUnits({
    isPast,
    signal,
  }: {
    isPast?: boolean;
    signal?: AbortSignal;
  } = {}) {
    const response = await this.request("GET", "/api/v1/activities/units", {
      query: {
        isPast,
      },
      signal,
    });

    return trackrActivitiesResponseSchema.parse(response);
  }

  async listActivities({
    isPast,
    signal,
  }: {
    isPast?: boolean;
    signal?: AbortSignal;
  } = {}) {
    return await this.listActivityUnits({
      isPast,
      signal,
    });
  }

  async addAttendanceUsers(
    payload: TrackrAttendanceUserAddPayload,
    { signal }: { signal?: AbortSignal } = {},
  ) {
    const parsedPayload = trackrAttendanceUserAddPayloadSchema.parse(payload);

    return await this.request("POST", "/api/v1/attendance/users", {
      body: parsedPayload,
      signal,
    });
  }

  async listStatuses({ signal }: { signal?: AbortSignal } = {}) {
    const response = await this.request("GET", "/api/v1/statuses", {
      signal,
    });

    return trackrStatusesResponseSchema.parse(response);
  }

  async getActivityAttendance(
    activityId: string,
    { signal }: { signal?: AbortSignal } = {},
  ) {
    const response = await this.request(
      "GET",
      `/api/v1/attendance/activities/${activityId}`,
      {
        signal,
      },
    );

    return trackrActivityAttendanceResponseSchema.parse(response);
  }

  async patchActivityAttendance(
    payload: TrackrAttendancePatchPayload,
    { signal }: { signal?: AbortSignal } = {},
  ) {
    const parsedPayload = trackrAttendancePatchPayloadSchema.parse(payload);
    return await this.request("PATCH", "/api/v1/attendance/units", {
      body: parsedPayload,
      signal,
    });
  }

  async queryUsers(
    payload: TrackrUsersQueryPayload,
    { signal }: { signal?: AbortSignal } = {},
  ) {
    const parsedPayload = trackrUsersQueryPayloadSchema.parse(payload);
    const response = await this.request("POST", "/api/v1/users/query", {
      body: parsedPayload,
      signal,
    });

    return trackrUsersQueryResponseSchema.parse(response);
  }

  async createActivities(
    payload: TrackrCreateActivitiesPayload,
    { signal }: { signal?: AbortSignal } = {},
  ) {
    const parsedPayload = trackrCreateActivitiesPayloadSchema.parse(payload);
    const response = await this.request("POST", "/api/v1/activities", {
      body: parsedPayload,
      signal,
    });

    return trackrCreateActivitiesResponseSchema.parse(response);
  }

  async getHaCurrencyUnit(
    unitId: string,
    { signal }: { signal?: AbortSignal } = {},
  ) {
    const response = await this.request(
      "GET",
      `/api/v1/currencies/ha/units/${unitId}`,
      {
        signal,
      },
    );

    return trackrHaCurrencyUnitResponseSchema.parse(response);
  }

  async getJson<TResponse>(
    path: string,
    options: Omit<TrackrRequestOptions, "body"> = {},
  ) {
    return (await this.request("GET", path, options)) as TResponse;
  }

  async postJson<TResponse>(
    path: string,
    body: unknown,
    options: Omit<TrackrRequestOptions, "body"> = {},
  ) {
    return (await this.request("POST", path, {
      ...options,
      body,
    })) as TResponse;
  }

  async patchJson<TResponse>(
    path: string,
    body: unknown,
    options: Omit<TrackrRequestOptions, "body"> = {},
  ) {
    return (await this.request("PATCH", path, {
      ...options,
      body,
    })) as TResponse;
  }

  private async request(
    method: "GET" | "POST" | "PATCH",
    path: string,
    { query, body, signal }: TrackrRequestOptions = {},
  ) {
    const url = new URL(path, this.baseUrl);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) {
          continue;
        }

        url.searchParams.set(key, String(value));
      }
    }

    const response = await this.fetchImpl(url.toString(), {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-SG,en-GB;q=0.9,en;q=0.8",
        Origin: this.baseUrl,
        Referer: `${this.baseUrl}/`,
        "User-Agent": this.userAgent,
        Cookie: this.cookie,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    const parsedResponse = await parseTrackrResponse(response);

    if (!response.ok) {
      const message = getTrackrFailureMessage(response, parsedResponse);

      throw new TrackrError("TRACKR_REQUEST_FAILED", message, {
        status: response.status,
        details: parsedResponse,
      });
    }

    return parsedResponse;
  }
}

function extractTrackrErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") {
    return typeof value === "string" && value.trim() ? value : null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }

  if (
    record.error &&
    typeof record.error === "object" &&
    "message" in record.error &&
    typeof (record.error as { message?: unknown }).message === "string"
  ) {
    return (record.error as { message: string }).message;
  }

  return null;
}

export function createTrackrClient(options: TrackrClientOptions = {}) {
  return new TrackrClient(options);
}

export function getTrackrClient() {
  return createTrackrClient();
}
