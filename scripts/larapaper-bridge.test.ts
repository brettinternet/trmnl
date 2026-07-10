import { chmod, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  canonicalizeMac,
  generateMac,
  isCompleteState,
  loadState,
  parseConfig,
  resolveDeviceMac,
  saveState,
  type BridgeState,
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
