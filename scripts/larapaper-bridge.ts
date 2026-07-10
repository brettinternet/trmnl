import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type BridgeAuth =
  | { enabled: false }
  | { enabled: true; user: string; pass: string };

export interface Config {
  baseUrl: string;
  imageBaseUrl: string | undefined;
  deviceMac: string | undefined;
  stateFile: string;
  host: string;
  port: number;
  minPollSeconds: number;
  maxStaleSeconds: number;
  maxImageBytes: number;
  auth: BridgeAuth;
}

export type PendingState = { version: 1; mac: string };

export type CompleteState = {
  version: 1;
  mac: string;
  api_key: string;
  friendly_id: string;
};

export type BridgeState = PendingState | CompleteState;

const MAC_PATTERN = /^[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}$/;

export function canonicalizeMac(value: string): string {
  if (typeof value !== "string" || !MAC_PATTERN.test(value)) {
    throw new Error(
      "Invalid MAC address: expected exactly six colon-delimited hexadecimal octets",
    );
  }
  return value.toUpperCase();
}

export function generateMac(): string {
  const bytes = randomBytes(6);
  bytes[0] = (bytes[0] & 0xfc) | 0x02;
  return Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0").toUpperCase(),
  ).join(":");
}

export function resolveDeviceMac(configuredMac: string | undefined): string {
  return configuredMac === undefined
    ? generateMac()
    : canonicalizeMac(configuredMac);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isCompleteState(state: BridgeState): state is CompleteState {
  if (!isRecord(state)) return false;
  return isNonEmptyString(state.api_key) && isNonEmptyString(state.friendly_id);
}

const PENDING_STATE_KEYS = ["mac", "version"];
const COMPLETE_STATE_KEYS = ["api_key", "friendly_id", "mac", "version"];

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    keys.length === sortedExpectedKeys.length &&
    keys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function normalizeState(value: unknown, context: string): BridgeState {
  if (!isRecord(value)) {
    throw new Error(`Invalid state shape in ${context}: expected an object`);
  }

  if (value.version !== 1) {
    throw new Error(`State version mismatch in ${context}: expected version 1`);
  }

  const hasApiKey = Object.prototype.hasOwnProperty.call(value, "api_key");
  const hasFriendlyId = Object.prototype.hasOwnProperty.call(value, "friendly_id");
  if (hasApiKey !== hasFriendlyId) {
    throw new Error(
      `Invalid state shape in ${context}: api_key and friendly_id must be provided together`,
    );
  }

  const expectedKeys = hasApiKey ? COMPLETE_STATE_KEYS : PENDING_STATE_KEYS;
  if (!hasExactKeys(value, expectedKeys)) {
    throw new Error(
      `Invalid state shape in ${context}: expected exactly the pending or complete state keys`,
    );
  }

  if (!isNonEmptyString(value.mac)) {
    throw new Error(`Invalid state MAC in ${context}: mac must be a nonempty string`);
  }
  const mac = canonicalizeMac(value.mac);

  if (!hasApiKey) {
    return { version: 1, mac };
  }

  if (!isNonEmptyString(value.api_key) || !isNonEmptyString(value.friendly_id)) {
    throw new Error(
      `Invalid complete state in ${context}: api_key and friendly_id must be nonempty strings`,
    );
  }

  return {
    version: 1,
    mac,
    api_key: value.api_key,
    friendly_id: value.friendly_id,
  };
}

function hasErrorCode(error: unknown, code: string): boolean {
  return isRecord(error) && error.code === code;
}

async function statStateFile(stateFilePath: string) {
  try {
    return await stat(stateFilePath);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return undefined;
    throw error;
  }
}

export async function loadState(
  stateFilePath: string,
  expectedMac?: string,
): Promise<BridgeState | undefined> {
  const metadata = await statStateFile(stateFilePath);
  if (metadata === undefined) return undefined;

  if ((metadata.mode & 0o077) !== 0) {
    throw new Error(
      `State file ${stateFilePath} is too permissive; run chmod 600 ${stateFilePath}`,
    );
  }

  let contents: string;
  try {
    contents = await readFile(stateFilePath, "utf8");
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return undefined;
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error(`Malformed state file ${stateFilePath}: invalid JSON`);
  }

  const state = normalizeState(parsed, stateFilePath);
  if (expectedMac !== undefined && state.mac !== expectedMac) {
    throw new Error(
      `Environment/state MAC mismatch in ${stateFilePath}: persisted MAC does not match expected MAC`,
    );
  }
  return state;
}

/**
 * Determines the MAC to provision with and returns any existing persisted
 * state for it. A configured MAC is validated against persisted state when
 * state already exists; an unconfigured MAC reuses a previously generated
 * MAC from persisted state instead of generating a new one on every
 * restart, and only generates a fresh MAC when no state exists yet.
 */
export async function resolveMacAndState(
  configuredMac: string | undefined,
  stateFilePath: string,
): Promise<{ mac: string; state: BridgeState | undefined }> {
  const existing = await loadState(stateFilePath);

  if (configuredMac !== undefined) {
    const mac = canonicalizeMac(configuredMac);
    if (existing !== undefined && existing.mac !== mac) {
      throw new Error(
        `Environment/state MAC mismatch in ${stateFilePath}: persisted MAC does not match expected MAC`,
      );
    }
    return { mac, state: existing };
  }

  if (existing !== undefined) {
    return { mac: existing.mac, state: existing };
  }

  return { mac: generateMac(), state: undefined };
}

export async function saveState(
  stateFilePath: string,
  state: BridgeState,
): Promise<void> {
  const normalizedState = normalizeState(state, stateFilePath);
  await mkdir(dirname(stateFilePath), { recursive: true });

  const temporaryPath = `${stateFilePath}.tmp-${randomBytes(16).toString("hex")}`;
  let temporaryFileCreated = true;
  try {
    await writeFile(temporaryPath, JSON.stringify(normalizedState), {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, stateFilePath);
    temporaryFileCreated = false;
  } catch (error) {
    if (temporaryFileCreated) {
      try {
        await unlink(temporaryPath);
      } catch {
        // Best-effort cleanup; preserve the original persistence failure.
      }
    }
    throw error;
  }
}

const DEFAULT_STATE_FILE = ".task/larapaper-bridge-state.json";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8787;
const DEFAULT_MIN_POLL_SECONDS = 60;
const DEFAULT_MAX_STALE_SECONDS = 3600;
const DEFAULT_MAX_IMAGE_BYTES = 10_485_760;

function trimmedValue(
  env: Record<string, string | undefined>,
  name: string,
): string | undefined {
  const raw = env[name];
  if (raw === undefined) return undefined;
  const value = raw.trim();
  return value === "" ? undefined : value;
}

function parseHttpUrl(
  value: string,
  name: string,
  rejectQuery: boolean,
): URL {
  if (!/^https?:\/\/[^/?#\s]+(?:[/?#]|$)/i.test(value)) {
    throw new Error(`${name} must be an absolute HTTP(S) URL`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${name} must use the HTTP or HTTPS protocol`);
  }

  const authority = value.slice(value.indexOf("://") + 3).split(/[/?#]/, 1)[0];
  if (parsed.username !== "" || parsed.password !== "" || authority.includes("@")) {
    throw new Error(`${name} must not include username or password credentials`);
  }

  if (value.includes("#")) {
    throw new Error(`${name} must not include a fragment`);
  }

  if (rejectQuery && value.includes("?")) {
    throw new Error(`${name} must not include a query`);
  }

  return parsed;
}

function readNumber(
  env: Record<string, string | undefined>,
  name: string,
  defaultValue: number,
): number {
  const value = trimmedValue(env, name);
  if (value === undefined) return defaultValue;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a finite positive number`);
  }
  return parsed;
}

function readPositiveInteger(
  env: Record<string, string | undefined>,
  name: string,
  defaultValue: number,
): number {
  const value = trimmedValue(env, name);
  if (value === undefined) return defaultValue;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function readPort(env: Record<string, string | undefined>): number {
  const name = "LARAPAPER_BRIDGE_PORT";
  const value = trimmedValue(env, name);
  if (value === undefined) return DEFAULT_PORT;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return parsed;
}

export function parseConfig(
  env: Record<string, string | undefined>,
): Config {
  const baseValue = trimmedValue(env, "LARAPAPER_BASE_URL");
  if (baseValue === undefined) {
    throw new Error("LARAPAPER_BASE_URL is required and must not be empty");
  }

  const base = parseHttpUrl(baseValue, "LARAPAPER_BASE_URL", true);
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/`;

  const imageValue = trimmedValue(env, "LARAPAPER_IMAGE_BASE_URL");
  const image = imageValue === undefined
    ? undefined
    : parseHttpUrl(imageValue, "LARAPAPER_IMAGE_BASE_URL", false);

  const rawDeviceMac = trimmedValue(env, "LARAPAPER_BRIDGE_DEVICE_MAC");
  const stateFile = trimmedValue(env, "LARAPAPER_BRIDGE_STATE_FILE") ?? DEFAULT_STATE_FILE;
  const host = trimmedValue(env, "LARAPAPER_BRIDGE_HOST") ?? DEFAULT_HOST;
  const user = env.LARAPAPER_BRIDGE_BASIC_AUTH_USER ?? "";
  const pass = env.LARAPAPER_BRIDGE_BASIC_AUTH_PASS ?? "";

  let auth: BridgeAuth;
  if (user === "" && pass === "") {
    auth = { enabled: false };
  } else if (user !== "" && pass !== "") {
    auth = { enabled: true, user, pass };
  } else {
    throw new Error(
      "LARAPAPER_BRIDGE_BASIC_AUTH_USER and LARAPAPER_BRIDGE_BASIC_AUTH_PASS must be provided together",
    );
  }

  return {
    baseUrl: base.toString(),
    imageBaseUrl: image?.origin,
    deviceMac: rawDeviceMac,
    stateFile,
    host,
    port: readPort(env),
    minPollSeconds: readNumber(
      env,
      "LARAPAPER_BRIDGE_MIN_POLL_SECONDS",
      DEFAULT_MIN_POLL_SECONDS,
    ),
    maxStaleSeconds: readPositiveInteger(
      env,
      "LARAPAPER_BRIDGE_MAX_STALE_SECONDS",
      DEFAULT_MAX_STALE_SECONDS,
    ),
    maxImageBytes: readPositiveInteger(
      env,
      "LARAPAPER_BRIDGE_MAX_IMAGE_BYTES",
      DEFAULT_MAX_IMAGE_BYTES,
    ),
    auth,
  };
}

export type LarapaperClientErrorCode =
  | "setup_auto_assign_disabled"
  | "setup_failed"
  | "display_failed"
  | "invalid_display_response";

export class LarapaperClientError extends Error {
  readonly code: LarapaperClientErrorCode;

  constructor(code: LarapaperClientErrorCode, message: string) {
    super(message);
    this.name = "LarapaperClientError";
    this.code = code;
  }
}

export type FetchImpl = typeof fetch;

const SETUP_TIMEOUT_MS = 10_000;

export type SetupCredentials = { api_key: string; friendly_id: string };

/**
 * Performs exactly one GET /api/setup attempt. Sends only the `ID` header
 * (never `Access-Token`), refuses redirects, and enforces a 10-second
 * operation timeout. Callers own retry scheduling.
 */
export async function fetchSetup(
  config: Config,
  mac: string,
  fetchImpl: FetchImpl = fetch,
): Promise<SetupCredentials> {
  const url = new URL("api/setup", config.baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SETUP_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { ID: mac },
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    throw new LarapaperClientError(
      "setup_failed",
      `Larapaper setup request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 404) {
    throw new LarapaperClientError(
      "setup_auto_assign_disabled",
      "Larapaper setup returned 404; enable \"assign_new_devices\" for this account to auto-provision a device",
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw new LarapaperClientError(
      "setup_failed",
      `Larapaper setup returned unexpected status ${response.status}`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new LarapaperClientError("setup_failed", "Larapaper setup response was not valid JSON");
  }

  if (
    !isRecord(body) ||
    !isNonEmptyString(body.api_key) ||
    !isNonEmptyString(body.friendly_id)
  ) {
    throw new LarapaperClientError(
      "setup_failed",
      "Larapaper setup response was missing nonempty api_key/friendly_id",
    );
  }

  return { api_key: body.api_key, friendly_id: body.friendly_id };
}

export const SETUP_RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 60_000] as const;

/**
 * Delay before the Nth setup retry (1-based failure count), following the
 * +5, +10, +20, +40, then +60 seconds repeating pattern.
 */
export function nextSetupRetryDelayMs(failureCount: number): number {
  const index = Math.min(failureCount - 1, SETUP_RETRY_DELAYS_MS.length - 1);
  return SETUP_RETRY_DELAYS_MS[Math.max(index, 0)];
}

/**
 * Provisions the device exactly once: reuses existing complete state
 * without calling setup, otherwise persists pending state for `mac` (if not
 * already persisted) before performing a single setup attempt, then
 * persists and returns complete state on success. Throws
 * `LarapaperClientError` on failure; the existing persisted state (pending,
 * with the same MAC) is left intact so retries preserve identity.
 */
export async function provisionDeviceOnce(
  config: Config,
  mac: string,
  existingState: BridgeState | undefined,
  fetchImpl: FetchImpl = fetch,
): Promise<CompleteState> {
  if (existingState !== undefined && isCompleteState(existingState)) {
    return existingState;
  }

  if (existingState === undefined) {
    await saveState(config.stateFile, { version: 1, mac });
  }

  const credentials = await fetchSetup(config, mac, fetchImpl);
  const complete: CompleteState = { version: 1, mac, ...credentials };
  await saveState(config.stateFile, complete);
  return complete;
}

const DISPLAY_TIMEOUT_MS = 10_000;

/**
 * A successful display result. `imageUrl` is `null` when Larapaper returned
 * a null/empty `image_url`; callers record an image error but still use
 * `effectiveIntervalSeconds` to schedule the next cycle without fetching or
 * retrying an image.
 */
export type DisplayResult = {
  imageUrl: string | null;
  effectiveIntervalSeconds: number;
};

/**
 * Performs exactly one GET /api/display attempt with `ID` and
 * `Access-Token` headers sent exactly once. A finite, positive
 * `refresh_rate` is required; any other rate (missing, non-numeric,
 * non-finite, zero, or negative) rejects the entire result with
 * `invalid_display_response`. `effectiveIntervalSeconds` is
 * `max(refresh_rate, config.minPollSeconds)`. Callers own retry/backoff
 * scheduling; a display failure has no fast retry.
 */
export async function fetchDisplay(
  config: Config,
  state: CompleteState,
  fetchImpl: FetchImpl = fetch,
): Promise<DisplayResult> {
  const url = new URL("api/display", config.baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISPLAY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { ID: state.mac, "Access-Token": state.api_key },
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    throw new LarapaperClientError(
      "display_failed",
      `Larapaper display request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new LarapaperClientError(
      "display_failed",
      `Larapaper display returned unexpected status ${response.status}`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new LarapaperClientError("display_failed", "Larapaper display response was not valid JSON");
  }

  if (!isRecord(body)) {
    throw new LarapaperClientError(
      "invalid_display_response",
      "Larapaper display response was not a JSON object",
    );
  }

  const rate = body.refresh_rate;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new LarapaperClientError(
      "invalid_display_response",
      "Larapaper display response had a missing or invalid refresh_rate",
    );
  }

  const rawImageUrl = body.image_url;
  if (
    rawImageUrl !== null &&
    rawImageUrl !== undefined &&
    typeof rawImageUrl !== "string"
  ) {
    throw new LarapaperClientError(
      "invalid_display_response",
      "Larapaper display response had a non-string image_url",
    );
  }

  const imageUrl = isNonEmptyString(rawImageUrl) ? rawImageUrl : null;

  return {
    imageUrl,
    effectiveIntervalSeconds: Math.max(rate, config.minPollSeconds),
  };
}
