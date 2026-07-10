import { chmod, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  canonicalizeMac,
  fetchDisplay,
  fetchSetup,
  generateMac,
  isCompleteState,
  LarapaperClientError,
  loadState,
  nextSetupRetryDelayMs,
  parseConfig,
  provisionDeviceOnce,
  provisionDeviceWithRetry,
  resolveDeviceMac,
  resolveMacAndState,
  saveState,
  type BridgeState,
  type CompleteState,
  type Config,
  type FetchImpl,
} from "./larapaper-bridge";

const withTempDir = async <T>(callback: (directory: string) => Promise<T>): Promise<T> => {
  const directory = await mkdtemp(join(tmpdir(), "larapaper-bridge-test-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const baseEnv = (): Record<string, string | undefined> => ({
  LARAPAPER_BASE_URL: "https://example.test",
});

describe("parseConfig", () => {
  test("requires a nonempty base URL", () => {
    expect(() => parseConfig({})).toThrow(/LARAPAPER_BASE_URL/);
    expect(() => parseConfig({ LARAPAPER_BASE_URL: "" })).toThrow(
      /LARAPAPER_BASE_URL/,
    );
    expect(() => parseConfig({ LARAPAPER_BASE_URL: " \t" })).toThrow(
      /LARAPAPER_BASE_URL/,
    );
  });

  test("rejects invalid base URL forms", () => {
    for (const value of [
      "https://user:pass@example.test",
      "https://example.test?query=1",
      "https://example.test#fragment",
      "ftp://example.test",
      "/relative/path",
      "https:example.test",
    ]) {
      expect(() => parseConfig({ LARAPAPER_BASE_URL: value })).toThrow(
        /LARAPAPER_BASE_URL/,
      );
    }
  });

  test("normalizes trailing slashes and preserves pathname prefixes", () => {
    expect(parseConfig({ LARAPAPER_BASE_URL: "https://example.test" }).baseUrl).toBe(
      "https://example.test/",
    );
    expect(
      parseConfig({ LARAPAPER_BASE_URL: "https://example.test////" }).baseUrl,
    ).toBe("https://example.test/");
    expect(
      parseConfig({ LARAPAPER_BASE_URL: "https://example.test/bridge/api///" }).baseUrl,
    ).toBe("https://example.test/bridge/api/");
  });

  test("uses defaults when defaulted variables are unset", () => {
    const config = parseConfig(baseEnv());

    expect(config.stateFile).toBe(".task/larapaper-bridge-state.json");
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(8787);
    expect(config.minPollSeconds).toBe(60);
    expect(config.maxStaleSeconds).toBe(3600);
    expect(config.maxImageBytes).toBe(10_485_760);
    expect(config.imageBaseUrl).toBeUndefined();
    expect(config.deviceMac).toBeUndefined();
    expect(config.auth).toEqual({ enabled: false });
  });

  test("uses defaults when defaulted variables are empty", () => {
    const config = parseConfig({
      ...baseEnv(),
      LARAPAPER_IMAGE_BASE_URL: "",
      LARAPAPER_BRIDGE_DEVICE_MAC: "",
      LARAPAPER_BRIDGE_STATE_FILE: "",
      LARAPAPER_BRIDGE_HOST: "",
      LARAPAPER_BRIDGE_PORT: "",
      LARAPAPER_BRIDGE_MIN_POLL_SECONDS: "",
      LARAPAPER_BRIDGE_MAX_STALE_SECONDS: "",
      LARAPAPER_BRIDGE_MAX_IMAGE_BYTES: "",
      LARAPAPER_BRIDGE_BASIC_AUTH_USER: "",
      LARAPAPER_BRIDGE_BASIC_AUTH_PASS: "",
    });

    expect(config.stateFile).toBe(".task/larapaper-bridge-state.json");
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(8787);
    expect(config.minPollSeconds).toBe(60);
    expect(config.maxStaleSeconds).toBe(3600);
    expect(config.maxImageBytes).toBe(10_485_760);
    expect(config.imageBaseUrl).toBeUndefined();
    expect(config.deviceMac).toBeUndefined();
    expect(config.auth).toEqual({ enabled: false });
  });

  test("honors valid overrides for every field", () => {
    const config = parseConfig({
      LARAPAPER_BASE_URL: "https://example.test/bridge/",
      LARAPAPER_IMAGE_BASE_URL: "http://cdn.example.test:8080/assets?cache=1",
      LARAPAPER_BRIDGE_DEVICE_MAC: " aa:bb:cc:dd:ee:ff ",
      LARAPAPER_BRIDGE_STATE_FILE: " /var/lib/bridge/state.json ",
      LARAPAPER_BRIDGE_HOST: " 0.0.0.0 ",
      LARAPAPER_BRIDGE_PORT: "65535",
      LARAPAPER_BRIDGE_MIN_POLL_SECONDS: "1.5",
      LARAPAPER_BRIDGE_MAX_STALE_SECONDS: "7200",
      LARAPAPER_BRIDGE_MAX_IMAGE_BYTES: "123456",
      LARAPAPER_BRIDGE_BASIC_AUTH_USER: "bridge-user",
      LARAPAPER_BRIDGE_BASIC_AUTH_PASS: "bridge-pass",
    });

    expect(config).toEqual({
      baseUrl: "https://example.test/bridge/",
      imageBaseUrl: "http://cdn.example.test:8080",
      deviceMac: "aa:bb:cc:dd:ee:ff",
      stateFile: "/var/lib/bridge/state.json",
      host: "0.0.0.0",
      port: 65535,
      minPollSeconds: 1.5,
      maxStaleSeconds: 7200,
      maxImageBytes: 123456,
      auth: { enabled: true, user: "bridge-user", pass: "bridge-pass" },
    });
  });

  test("trims the device MAC without validating its format", () => {
    expect(
      parseConfig({
        ...baseEnv(),
        LARAPAPER_BRIDGE_DEVICE_MAC: "  not-a-mac  ",
      }).deviceMac,
    ).toBe("not-a-mac");
  });

  test("normalizes empty image base URL and device MAC to undefined", () => {
    const config = parseConfig({
      ...baseEnv(),
      LARAPAPER_IMAGE_BASE_URL: " \t",
      LARAPAPER_BRIDGE_DEVICE_MAC: " ",
    });

    expect(config.imageBaseUrl).toBeUndefined();
    expect(config.deviceMac).toBeUndefined();
  });

  test("validates image base URL while ignoring its path and query", () => {
    expect(
      parseConfig({
        ...baseEnv(),
        LARAPAPER_IMAGE_BASE_URL: "https://cdn.example.test/images?size=large",
      }).imageBaseUrl,
    ).toBe("https://cdn.example.test");

    for (const value of [
      "ftp://cdn.example.test",
      "https://user:pass@cdn.example.test",
      "https://cdn.example.test#fragment",
      "/relative/path",
    ]) {
      expect(() =>
        parseConfig({ ...baseEnv(), LARAPAPER_IMAGE_BASE_URL: value }),
      ).toThrow(/LARAPAPER_IMAGE_BASE_URL/);
    }
  });

  test("rejects invalid ports", () => {
    for (const value of ["0", "65536", "-1", "1.5", "not-a-number"]) {
      expect(() =>
        parseConfig({ ...baseEnv(), LARAPAPER_BRIDGE_PORT: value }),
      ).toThrow(/LARAPAPER_BRIDGE_PORT/);
    }
  });

  test("requires a finite positive minimum poll interval and accepts decimals", () => {
    expect(
      parseConfig({ ...baseEnv(), LARAPAPER_BRIDGE_MIN_POLL_SECONDS: "1.5" })
        .minPollSeconds,
    ).toBe(1.5);

    for (const value of ["0", "-1", "NaN", "Infinity", "-Infinity"]) {
      expect(() =>
        parseConfig({
          ...baseEnv(),
          LARAPAPER_BRIDGE_MIN_POLL_SECONDS: value,
        }),
      ).toThrow(/LARAPAPER_BRIDGE_MIN_POLL_SECONDS/);
    }
  });

  test("requires positive integer stale and image limits", () => {
    for (const name of [
      "LARAPAPER_BRIDGE_MAX_STALE_SECONDS",
      "LARAPAPER_BRIDGE_MAX_IMAGE_BYTES",
    ] as const) {
      for (const value of ["0", "-1", "1.5", "NaN", "Infinity"]) {
        expect(() => parseConfig({ ...baseEnv(), [name]: value })).toThrow(
          new RegExp(name),
        );
      }
    }
  });

  test("requires a nonblank custom state path", () => {
    expect(
      parseConfig({ ...baseEnv(), LARAPAPER_BRIDGE_STATE_FILE: "  " }).stateFile,
    ).toBe(".task/larapaper-bridge-state.json");
    expect(
      parseConfig({
        ...baseEnv(),
        LARAPAPER_BRIDGE_STATE_FILE: " /tmp/bridge-state.json ",
      }).stateFile,
    ).toBe("/tmp/bridge-state.json");
  });

  test("enables auth only when both credentials are set", () => {
    expect(
      parseConfig({
        ...baseEnv(),
        LARAPAPER_BRIDGE_BASIC_AUTH_USER: "user",
        LARAPAPER_BRIDGE_BASIC_AUTH_PASS: "pass",
      }).auth,
    ).toEqual({ enabled: true, user: "user", pass: "pass" });

    expect(() =>
      parseConfig({
        ...baseEnv(),
        LARAPAPER_BRIDGE_BASIC_AUTH_USER: "user",
      }),
    ).toThrow(/LARAPAPER_BRIDGE_BASIC_AUTH/);
    expect(() =>
      parseConfig({
        ...baseEnv(),
        LARAPAPER_BRIDGE_BASIC_AUTH_PASS: "pass",
      }),
    ).toThrow(/LARAPAPER_BRIDGE_BASIC_AUTH/);
  });

  test("preserves nonempty auth values exactly", () => {
    expect(
      parseConfig({
        ...baseEnv(),
        LARAPAPER_BRIDGE_BASIC_AUTH_USER: " user ",
        LARAPAPER_BRIDGE_BASIC_AUTH_PASS: " pass with spaces ",
      }).auth,
    ).toEqual({
      enabled: true,
      user: " user ",
      pass: " pass with spaces ",
    });
  });
});

describe("canonicalizeMac", () => {
  test("uppercases a valid six-octet MAC", () => {
    expect(canonicalizeMac("aa:bb:0c:dd:ee:ff")).toBe("AA:BB:0C:DD:EE:FF");
  });

  test("rejects wrong octet counts", () => {
    for (const value of ["aa:bb:cc:dd:ee", "aa:bb:cc:dd:ee:ff:00", "aabbccddeeff"]) {
      expect(() => canonicalizeMac(value)).toThrow(/Invalid MAC address/);
    }
  });

  test("rejects non-hexadecimal characters", () => {
    expect(() => canonicalizeMac("aa:bb:cc:dd:ee:gg")).toThrow(/Invalid MAC address/);
  });

  test("rejects delimiters other than colons", () => {
    for (const value of ["aa-bb-cc-dd-ee-ff", "aa.bb.cc.dd.ee.ff", "aa:bb-cc:dd:ee:ff"]) {
      expect(() => canonicalizeMac(value)).toThrow(/Invalid MAC address/);
    }
  });
});

describe("generateMac", () => {
  test("generates uppercase locally administered unicast MACs", () => {
    for (let index = 0; index < 12; index += 1) {
      const mac = generateMac();
      expect(mac).toMatch(/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/);
      const firstOctet = Number.parseInt(mac.slice(0, 2), 16);
      expect(firstOctet & 0x02).toBe(0x02);
      expect(firstOctet & 0x01).toBe(0);
    }
  });
});

describe("resolveDeviceMac", () => {
  test("canonicalizes a configured MAC", () => {
    expect(resolveDeviceMac("aa:bb:cc:dd:ee:ff")).toBe("AA:BB:CC:DD:EE:FF");
  });

  test("rejects a malformed configured MAC", () => {
    expect(() => resolveDeviceMac("not-a-mac")).toThrow(/Invalid MAC address/);
  });

  test("generates a MAC when no configured MAC is provided", () => {
    expect(resolveDeviceMac(undefined)).toMatch(/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/);
  });
});

describe("loadState/saveState", () => {
  test("returns undefined when the state file does not exist", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      await expect(loadState(stateFilePath, "AA:BB:CC:DD:EE:FF")).resolves.toBeUndefined();
    });
  });

  test("round-trips pending and complete state", async () => {
    await withTempDir(async (directory) => {
      const expectedMac = "AA:BB:CC:DD:EE:FF";
      const pendingPath = join(directory, "pending.json");
      const pending: BridgeState = { version: 1, mac: expectedMac };
      await saveState(pendingPath, pending);
      await expect(loadState(pendingPath, expectedMac)).resolves.toEqual(pending);
      expect(isCompleteState(pending)).toBe(false);

      const completePath = join(directory, "complete.json");
      const complete: BridgeState = {
        version: 1,
        mac: expectedMac,
        api_key: "api-key",
        friendly_id: "friendly-id",
      };
      await saveState(completePath, complete);
      const loadedComplete = await loadState(completePath, expectedMac);
      expect(loadedComplete).toEqual(complete);
      if (loadedComplete === undefined) throw new Error("complete state did not load");
      expect(isCompleteState(loadedComplete)).toBe(true);
    });
  });

  test("rejects malformed JSON", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      await writeFile(stateFilePath, "{not-json", { encoding: "utf8", mode: 0o600 });
      await chmod(stateFilePath, 0o600);
      await expect(loadState(stateFilePath, "AA:BB:CC:DD:EE:FF")).rejects.toThrow(
        /Malformed state file/,
      );
    });
  });

  test("rejects missing and unsupported versions", async () => {
    await withTempDir(async (directory) => {
      const expectedMac = "AA:BB:CC:DD:EE:FF";
      for (const [name, state] of [
        ["missing-version", { mac: expectedMac }],
        ["unsupported-version", { version: 2, mac: expectedMac }],
      ] as const) {
        const stateFilePath = join(directory, `${name}.json`);
        await writeFile(stateFilePath, JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
        await chmod(stateFilePath, 0o600);
        await expect(loadState(stateFilePath, expectedMac)).rejects.toThrow(/version mismatch/i);
      }
    });
  });

  test("rejects credential-only and partial credential state", async () => {
    await withTempDir(async (directory) => {
      const expectedMac = "AA:BB:CC:DD:EE:FF";
      for (const [name, state] of [
        ["api-only", { version: 1, mac: expectedMac, api_key: "api-key" }],
        ["friendly-only", { version: 1, mac: expectedMac, friendly_id: "friendly-id" }],
      ] as const) {
        const stateFilePath = join(directory, `${name}.json`);
        await writeFile(stateFilePath, JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
        await chmod(stateFilePath, 0o600);
        await expect(loadState(stateFilePath, expectedMac)).rejects.toThrow(
          /provided together/,
        );
      }
    });
  });

  test("rejects unknown extra keys", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const state = { version: 1, mac: "AA:BB:CC:DD:EE:FF", extra: true };
      await writeFile(stateFilePath, JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
      await chmod(stateFilePath, 0o600);
      await expect(loadState(stateFilePath, state.mac)).rejects.toThrow(/exactly/);
    });
  });

  test("rejects malformed persisted MACs and environment mismatches", async () => {
    await withTempDir(async (directory) => {
      const malformedPath = join(directory, "malformed-mac.json");
      await writeFile(
        malformedPath,
        JSON.stringify({ version: 1, mac: "not-a-mac" }),
        { encoding: "utf8", mode: 0o600 },
      );
      await chmod(malformedPath, 0o600);
      await expect(loadState(malformedPath, "AA:BB:CC:DD:EE:FF")).rejects.toThrow(
        /Invalid MAC address/,
      );

      const mismatchPath = join(directory, "mismatch.json");
      await writeFile(
        mismatchPath,
        JSON.stringify({ version: 1, mac: "AA:BB:CC:DD:EE:FF" }),
        { encoding: "utf8", mode: 0o600 },
      );
      await chmod(mismatchPath, 0o600);
      await expect(loadState(mismatchPath, "11:22:33:44:55:66")).rejects.toThrow(
        /Environment\/state MAC mismatch/,
      );
    });
  });

  test("rejects group/world-readable state with chmod-600 remediation", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "permissive.json");
      await writeFile(
        stateFilePath,
        JSON.stringify({ version: 1, mac: "AA:BB:CC:DD:EE:FF" }),
        { encoding: "utf8", mode: 0o644 },
      );
      await chmod(stateFilePath, 0o644);
      await expect(loadState(stateFilePath, "AA:BB:CC:DD:EE:FF")).rejects.toThrow(
        /chmod 600/,
      );
    });
  });

  test("creates parent directories, persists mode 0600, and leaves no temp file", async () => {
    await withTempDir(async (directory) => {
      const parentDirectory = join(directory, "nested", "state");
      const stateFilePath = join(parentDirectory, "state.json");
      const state: BridgeState = { version: 1, mac: "AA:BB:CC:DD:EE:FF" };
      await saveState(stateFilePath, state);

      const metadata = await stat(stateFilePath);
      expect(metadata.mode & 0o777).toBe(0o600);
      await expect(loadState(stateFilePath, state.mac)).resolves.toEqual(state);
      expect(await readdir(parentDirectory)).toEqual(["state.json"]);
    });
  });

  test("atomically replaces existing state and leaves no temp file", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const pending: BridgeState = { version: 1, mac: "AA:BB:CC:DD:EE:FF" };
      await saveState(stateFilePath, pending);

      const complete: BridgeState = {
        version: 1,
        mac: "AA:BB:CC:DD:EE:FF",
        api_key: "api-key",
        friendly_id: "friendly-id",
      };
      await saveState(stateFilePath, complete);

      const metadata = await stat(stateFilePath);
      expect(metadata.mode & 0o777).toBe(0o600);
      await expect(loadState(stateFilePath, complete.mac)).resolves.toEqual(complete);
      expect(await readdir(directory)).toEqual(["state.json"]);
    });
  });
});

const testConfig = (overrides: Partial<Config> = {}): Config => ({
  ...parseConfig(baseEnv()),
  ...overrides,
});

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("resolveMacAndState", () => {
  test("generates a MAC when no MAC is configured and no state exists", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const { mac, state } = await resolveMacAndState(undefined, stateFilePath);
      expect(mac).toMatch(/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/);
      expect(state).toBeUndefined();
    });
  });

  test("reuses a previously generated MAC from persisted state across restarts", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const pending: BridgeState = { version: 1, mac: generateMac() };
      await saveState(stateFilePath, pending);

      const { mac, state } = await resolveMacAndState(undefined, stateFilePath);
      expect(mac).toBe(pending.mac);
      expect(state).toEqual(pending);
    });
  });

  test("validates a configured MAC against existing persisted state", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const configuredMac = "AA:BB:CC:DD:EE:FF";
      await saveState(stateFilePath, { version: 1, mac: configuredMac });

      await expect(
        resolveMacAndState("11:22:33:44:55:66", stateFilePath),
      ).rejects.toThrow(/Environment\/state MAC mismatch/);

      const { mac } = await resolveMacAndState(configuredMac, stateFilePath);
      expect(mac).toBe(configuredMac);
    });
  });

  test("accepts a configured MAC when no state exists yet", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const { mac, state } = await resolveMacAndState("AA:BB:CC:DD:EE:FF", stateFilePath);
      expect(mac).toBe("AA:BB:CC:DD:EE:FF");
      expect(state).toBeUndefined();
    });
  });
});

describe("fetchSetup", () => {
  test("sends only the ID header, no redirects, and returns credentials on 2xx", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetchImpl: FetchImpl = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: url.toString(), init });
      return jsonResponse(200, { api_key: "api-key", friendly_id: "friendly-id" });
    }) as FetchImpl;

    const credentials = await fetchSetup(testConfig(), "AA:BB:CC:DD:EE:FF", fetchImpl);
    expect(credentials).toEqual({ api_key: "api-key", friendly_id: "friendly-id" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://example.test/api/setup");
    expect(calls[0]?.init?.headers).toEqual({ ID: "AA:BB:CC:DD:EE:FF" });
    expect(calls[0]?.init?.method).toBe("GET");
    expect(calls[0]?.init?.redirect).toBe("error");
  });

  test("maps a 404 to an actionable assign_new_devices error", async () => {
    const fetchImpl: FetchImpl = (async () => jsonResponse(404, {})) as FetchImpl;
    await expect(fetchSetup(testConfig(), "AA:BB:CC:DD:EE:FF", fetchImpl)).rejects.toMatchObject({
      code: "setup_auto_assign_disabled",
    });
    await expect(fetchSetup(testConfig(), "AA:BB:CC:DD:EE:FF", fetchImpl)).rejects.toThrow(
      /assign_new_devices/,
    );
  });

  test("rejects a non-2xx response, missing credentials, and non-JSON bodies", async () => {
    const badStatus: FetchImpl = (async () => jsonResponse(500, {})) as FetchImpl;
    await expect(fetchSetup(testConfig(), "AA:BB:CC:DD:EE:FF", badStatus)).rejects.toBeInstanceOf(
      LarapaperClientError,
    );

    const missingCredentials: FetchImpl = (async () =>
      jsonResponse(200, { api_key: "", friendly_id: "friendly-id" })) as FetchImpl;
    await expect(
      fetchSetup(testConfig(), "AA:BB:CC:DD:EE:FF", missingCredentials),
    ).rejects.toThrow(/nonempty/);

    const nonJson: FetchImpl = (async () =>
      new Response("not json", { status: 200 })) as FetchImpl;
    await expect(fetchSetup(testConfig(), "AA:BB:CC:DD:EE:FF", nonJson)).rejects.toThrow(
      /not valid JSON/,
    );
  });

  test("aborts after the 10-second timeout", async () => {
    const fetchImpl: FetchImpl = (async (_url: string | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as FetchImpl;

    const start = Date.now();
    await expect(fetchSetup(testConfig(), "AA:BB:CC:DD:EE:FF", fetchImpl)).rejects.toBeInstanceOf(
      LarapaperClientError,
    );
    expect(Date.now() - start).toBeGreaterThanOrEqual(9_000);
  }, 15_000);

  test("does not leak underlying error details in the thrown message", async () => {
    const fetchImpl: FetchImpl = (async () => {
      throw new Error("connect failed Access-Token=SECRET_TOKEN body=SECRET_BODY");
    }) as FetchImpl;

    await expect(fetchSetup(testConfig(), "AA:BB:CC:DD:EE:FF", fetchImpl)).rejects.not.toThrow(
      /SECRET_TOKEN|SECRET_BODY/,
    );
  });

  test("aborts a hanging response body within the 10-second timeout", async () => {
    const fetchImpl: FetchImpl = (async (_url: string | URL, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
        },
      });
      return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
    }) as FetchImpl;

    const start = Date.now();
    await expect(fetchSetup(testConfig(), "AA:BB:CC:DD:EE:FF", fetchImpl)).rejects.toBeInstanceOf(
      LarapaperClientError,
    );
    expect(Date.now() - start).toBeGreaterThanOrEqual(9_000);
    expect(Date.now() - start).toBeLessThan(15_000);
  }, 20_000);
});

describe("nextSetupRetryDelayMs", () => {
  test("follows the +5, +10, +20, +40, then +60 seconds repeating pattern", () => {
    expect(nextSetupRetryDelayMs(1)).toBe(5_000);
    expect(nextSetupRetryDelayMs(2)).toBe(10_000);
    expect(nextSetupRetryDelayMs(3)).toBe(20_000);
    expect(nextSetupRetryDelayMs(4)).toBe(40_000);
    expect(nextSetupRetryDelayMs(5)).toBe(60_000);
    expect(nextSetupRetryDelayMs(6)).toBe(60_000);
    expect(nextSetupRetryDelayMs(100)).toBe(60_000);
  });
});

describe("provisionDeviceOnce", () => {
  test("persists pending state before calling setup, then complete state after success", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const config = testConfig({ stateFile: stateFilePath });
      const mac = "AA:BB:CC:DD:EE:FF";

      let stateDuringCall: BridgeState | undefined;
      const fetchImpl: FetchImpl = (async () => {
        stateDuringCall = await loadState(stateFilePath, mac);
        return jsonResponse(200, { api_key: "api-key", friendly_id: "friendly-id" });
      }) as FetchImpl;

      const complete = await provisionDeviceOnce(config, mac, undefined, fetchImpl);
      expect(stateDuringCall).toEqual({ version: 1, mac });
      expect(complete).toEqual({
        version: 1,
        mac,
        api_key: "api-key",
        friendly_id: "friendly-id",
      });
      await expect(loadState(stateFilePath, mac)).resolves.toEqual(complete);
    });
  });

  test("reuses existing complete state without calling setup", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const config = testConfig({ stateFile: stateFilePath });
      const complete: BridgeState = {
        version: 1,
        mac: "AA:BB:CC:DD:EE:FF",
        api_key: "api-key",
        friendly_id: "friendly-id",
      };

      let calls = 0;
      const fetchImpl: FetchImpl = (async () => {
        calls += 1;
        return jsonResponse(200, { api_key: "unused", friendly_id: "unused" });
      }) as FetchImpl;

      const result = await provisionDeviceOnce(config, complete.mac, complete, fetchImpl);
      expect(result).toEqual(complete);
      expect(calls).toBe(0);
    });
  });

  test("preserves the same MAC in pending state across a failed setup attempt and retry", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const config = testConfig({ stateFile: stateFilePath });
      const mac = "AA:BB:CC:DD:EE:FF";

      const failing: FetchImpl = (async () => jsonResponse(500, {})) as FetchImpl;
      await expect(provisionDeviceOnce(config, mac, undefined, failing)).rejects.toBeInstanceOf(
        LarapaperClientError,
      );

      const pendingAfterFailure = await loadState(stateFilePath, mac);
      expect(pendingAfterFailure).toEqual({ version: 1, mac });

      const succeeding: FetchImpl = (async () =>
        jsonResponse(200, { api_key: "api-key", friendly_id: "friendly-id" })) as FetchImpl;
      const complete = await provisionDeviceOnce(config, mac, pendingAfterFailure, succeeding);
      expect(complete).toEqual({
        version: 1,
        mac,
        api_key: "api-key",
        friendly_id: "friendly-id",
      });
    });
  });

  test("surfaces a setup 404 as an actionable assign_new_devices error", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const config = testConfig({ stateFile: stateFilePath });
      const notFound: FetchImpl = (async () => jsonResponse(404, {})) as FetchImpl;

      await expect(
        provisionDeviceOnce(config, "AA:BB:CC:DD:EE:FF", undefined, notFound),
      ).rejects.toMatchObject({ code: "setup_auto_assign_disabled" });
      await expect(
        provisionDeviceOnce(config, "AA:BB:CC:DD:EE:FF", undefined, notFound),
      ).rejects.toThrow(/assign_new_devices/);
    });
  });

  test("rejects a stale existingState whose MAC does not match the requested MAC", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const config = testConfig({ stateFile: stateFilePath });
      const stale: BridgeState = { version: 1, mac: "11:22:33:44:55:66" };
      const fetchImpl: FetchImpl = (async () =>
        jsonResponse(200, { api_key: "api-key", friendly_id: "friendly-id" })) as FetchImpl;

      await expect(
        provisionDeviceOnce(config, "AA:BB:CC:DD:EE:FF", stale, fetchImpl),
      ).rejects.toThrow(/does not match/);
    });
  });
});

describe("fetchDisplay", () => {
  const completeState: CompleteState = {
    version: 1,
    mac: "AA:BB:CC:DD:EE:FF",
    api_key: "api-key",
    friendly_id: "friendly-id",
  };

  test("sends ID and Access-Token exactly once, no redirects, at the correct URL", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetchImpl: FetchImpl = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: url.toString(), init });
      return jsonResponse(200, { image_url: "https://example.test/img.png", refresh_rate: 120 });
    }) as FetchImpl;

    const result = await fetchDisplay(testConfig(), completeState, fetchImpl);
    expect(result).toEqual({ imageUrl: "https://example.test/img.png", effectiveIntervalSeconds: 120 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://example.test/api/display");
    expect(calls[0]?.init?.headers).toEqual({ ID: "AA:BB:CC:DD:EE:FF", "Access-Token": "api-key" });
    expect(calls[0]?.init?.method).toBe("GET");
    expect(calls[0]?.init?.redirect).toBe("error");
  });

  test("preserves a configured base URL pathname prefix", async () => {
    const calls: string[] = [];
    const fetchImpl: FetchImpl = (async (url: string | URL) => {
      calls.push(url.toString());
      return jsonResponse(200, { image_url: null, refresh_rate: 60 });
    }) as FetchImpl;

    const config = testConfig({ baseUrl: "https://example.test/prefix/" });
    await fetchDisplay(config, completeState, fetchImpl);
    expect(calls[0]).toBe("https://example.test/prefix/api/display");
  });

  test("clamps effectiveIntervalSeconds to the configured minimum", async () => {
    const fetchImpl: FetchImpl = (async () =>
      jsonResponse(200, { image_url: "https://example.test/img.png", refresh_rate: 5 })) as FetchImpl;

    const config = testConfig({ minPollSeconds: 60 });
    const result = await fetchDisplay(config, completeState, fetchImpl);
    expect(result.effectiveIntervalSeconds).toBe(60);
  });

  test("uses the server rate when it exceeds the configured minimum", async () => {
    const fetchImpl: FetchImpl = (async () =>
      jsonResponse(200, { image_url: "https://example.test/img.png", refresh_rate: 900 })) as FetchImpl;

    const config = testConfig({ minPollSeconds: 60 });
    const result = await fetchDisplay(config, completeState, fetchImpl);
    expect(result.effectiveIntervalSeconds).toBe(900);
  });

  test("treats null or empty image_url as a valid result with no image error thrown", async () => {
    const nullImage: FetchImpl = (async () =>
      jsonResponse(200, { image_url: null, refresh_rate: 120 })) as FetchImpl;
    await expect(fetchDisplay(testConfig(), completeState, nullImage)).resolves.toEqual({
      imageUrl: null,
      effectiveIntervalSeconds: 120,
    });

    const emptyImage: FetchImpl = (async () =>
      jsonResponse(200, { image_url: "", refresh_rate: 120 })) as FetchImpl;
    await expect(fetchDisplay(testConfig(), completeState, emptyImage)).resolves.toEqual({
      imageUrl: null,
      effectiveIntervalSeconds: 120,
    });

    const missingImage: FetchImpl = (async () =>
      jsonResponse(200, { refresh_rate: 120 })) as FetchImpl;
    await expect(fetchDisplay(testConfig(), completeState, missingImage)).resolves.toEqual({
      imageUrl: null,
      effectiveIntervalSeconds: 120,
    });
  });

  test("rejects a missing, non-numeric, zero, negative, or non-finite refresh_rate", async () => {
    for (const rate of [undefined, "120", 0, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
      const body: Record<string, unknown> = { image_url: "https://example.test/img.png" };
      if (rate !== undefined) body.refresh_rate = rate;
      const fetchImpl: FetchImpl = (async () => jsonResponse(200, body)) as FetchImpl;
      await expect(fetchDisplay(testConfig(), completeState, fetchImpl)).rejects.toMatchObject({
        code: "invalid_display_response",
      });
    }
  });

  test("rejects a non-string image_url", async () => {
    const fetchImpl: FetchImpl = (async () =>
      jsonResponse(200, { image_url: 42, refresh_rate: 120 })) as FetchImpl;
    await expect(fetchDisplay(testConfig(), completeState, fetchImpl)).rejects.toMatchObject({
      code: "invalid_display_response",
    });
  });

  test("rejects a non-2xx response and non-JSON body as display_failed", async () => {
    const badStatus: FetchImpl = (async () => jsonResponse(500, {})) as FetchImpl;
    await expect(fetchDisplay(testConfig(), completeState, badStatus)).rejects.toMatchObject({
      code: "display_failed",
    });

    const nonJson: FetchImpl = (async () => new Response("not json", { status: 200 })) as FetchImpl;
    await expect(fetchDisplay(testConfig(), completeState, nonJson)).rejects.toMatchObject({
      code: "display_failed",
    });
  });

  test("has no fast retry: callers must schedule their own next attempt", async () => {
    let calls = 0;
    const fetchImpl: FetchImpl = (async () => {
      calls += 1;
      return jsonResponse(500, {});
    }) as FetchImpl;

    await expect(fetchDisplay(testConfig(), completeState, fetchImpl)).rejects.toBeInstanceOf(
      LarapaperClientError,
    );
    expect(calls).toBe(1);
  });

  test("aborts after the 10-second timeout", async () => {
    const fetchImpl: FetchImpl = (async (_url: string | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as FetchImpl;

    const start = Date.now();
    await expect(fetchDisplay(testConfig(), completeState, fetchImpl)).rejects.toBeInstanceOf(
      LarapaperClientError,
    );
    expect(Date.now() - start).toBeGreaterThanOrEqual(9_000);
  }, 15_000);

  test("does not leak underlying error details in the thrown message", async () => {
    const fetchImpl: FetchImpl = (async () => {
      throw new Error("connect failed Access-Token=SECRET_TOKEN body=SECRET_BODY");
    }) as FetchImpl;

    await expect(fetchDisplay(testConfig(), completeState, fetchImpl)).rejects.not.toThrow(
      /SECRET_TOKEN|SECRET_BODY/,
    );
  });

  test("aborts a hanging response body within the 10-second timeout", async () => {
    const fetchImpl: FetchImpl = (async (_url: string | URL, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
        },
      });
      return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
    }) as FetchImpl;

    const start = Date.now();
    await expect(fetchDisplay(testConfig(), completeState, fetchImpl)).rejects.toBeInstanceOf(
      LarapaperClientError,
    );
    expect(Date.now() - start).toBeGreaterThanOrEqual(9_000);
    expect(Date.now() - start).toBeLessThan(15_000);
  }, 20_000);
});

describe("provisionDeviceWithRetry", () => {
  test("retries setup failures at +5, +10, +20, +40, then +60 seconds using injected sleep", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const config = testConfig({ stateFile: stateFilePath });
      const mac = "AA:BB:CC:DD:EE:FF";

      let calls = 0;
      const fetchImpl: FetchImpl = (async () => {
        calls += 1;
        if (calls <= 6) return jsonResponse(500, {});
        return jsonResponse(200, { api_key: "api-key", friendly_id: "friendly-id" });
      }) as FetchImpl;

      const delays: number[] = [];
      const sleep = async (ms: number) => {
        delays.push(ms);
      };

      const complete = await provisionDeviceWithRetry(config, mac, undefined, fetchImpl, sleep);
      expect(complete).toEqual({ version: 1, mac, api_key: "api-key", friendly_id: "friendly-id" });
      expect(calls).toBe(7);
      expect(delays).toEqual([5_000, 10_000, 20_000, 40_000, 60_000, 60_000]);
    });
  });

  test("retries an actionable setup 404 rather than propagating it immediately", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const config = testConfig({ stateFile: stateFilePath });
      const mac = "AA:BB:CC:DD:EE:FF";

      let calls = 0;
      const fetchImpl: FetchImpl = (async () => {
        calls += 1;
        if (calls === 1) return jsonResponse(404, {});
        return jsonResponse(200, { api_key: "api-key", friendly_id: "friendly-id" });
      }) as FetchImpl;

      const delays: number[] = [];
      const complete = await provisionDeviceWithRetry(config, mac, undefined, fetchImpl, async (ms) => {
        delays.push(ms);
      });
      expect(complete).toEqual({ version: 1, mac, api_key: "api-key", friendly_id: "friendly-id" });
      expect(calls).toBe(2);
      expect(delays).toEqual([5_000]);
    });
  });

  test("preserves the same MAC in pending state across retries and reuses complete state without retrying", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const config = testConfig({ stateFile: stateFilePath });
      const mac = "AA:BB:CC:DD:EE:FF";

      let calls = 0;
      const fetchImpl: FetchImpl = (async () => {
        calls += 1;
        if (calls === 1) return jsonResponse(500, {});
        return jsonResponse(200, { api_key: "api-key", friendly_id: "friendly-id" });
      }) as FetchImpl;

      await provisionDeviceWithRetry(config, mac, undefined, fetchImpl, async () => {});
      await expect(loadState(stateFilePath, mac)).resolves.toEqual({
        version: 1,
        mac,
        api_key: "api-key",
        friendly_id: "friendly-id",
      });

      calls = 0;
      const complete = await loadState(stateFilePath, mac);
      const shouldNotCall: FetchImpl = (async () => {
        calls += 1;
        return jsonResponse(500, {});
      }) as FetchImpl;
      const reused = await provisionDeviceWithRetry(config, mac, complete, shouldNotCall, async () => {});
      expect(reused).toEqual(complete);
      expect(calls).toBe(0);
    });
  });

  test("propagates a non-LarapaperClientError failure immediately without retry", async () => {
    await withTempDir(async (directory) => {
      const stateFilePath = join(directory, "state.json");
      const config = testConfig({ stateFile: stateFilePath });
      const stale: BridgeState = { version: 1, mac: "11:22:33:44:55:66" };
      const fetchImpl: FetchImpl = (async () =>
        jsonResponse(200, { api_key: "api-key", friendly_id: "friendly-id" })) as FetchImpl;

      let sleepCalls = 0;
      await expect(
        provisionDeviceWithRetry(config, "AA:BB:CC:DD:EE:FF", stale, fetchImpl, async () => {
          sleepCalls += 1;
        }),
      ).rejects.toThrow(/does not match/);
      expect(sleepCalls).toBe(0);
    });
  });
});
