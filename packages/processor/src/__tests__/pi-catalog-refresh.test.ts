import { describe, expect, it } from "vitest";
import { PI_MODEL_REFRESH_TIMEOUT_MS, piCatalogRefreshOptions } from "../agents/pi-sdk.js";

describe("piCatalogRefreshOptions", () => {
  it("refreshes online with the bounded timeout by default", () => {
    expect(piCatalogRefreshOptions({})).toEqual({
      allowModelNetwork: true,
      modelRefreshTimeoutMs: PI_MODEL_REFRESH_TIMEOUT_MS,
    });
  });

  it("stays offline when PI_OFFLINE is set", () => {
    expect(piCatalogRefreshOptions({ PI_OFFLINE: "1" })).toEqual({
      allowModelNetwork: false,
      modelRefreshTimeoutMs: PI_MODEL_REFRESH_TIMEOUT_MS,
    });
  });
});
