import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
let listener: any, store: Record<string, any>;
const tabs = {
  create: vi.fn(async () => ({ id: 1 })),
  get: vi.fn(async () => ({ status: "complete" })),
  onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
};
const execute = vi.fn(async () => [
  { result: { status: "uncertain", message: "No confirmation" } },
]);
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  store = {};
  vi.stubGlobal("chrome", {
    runtime: {
      onMessage: {
        addListener: (fn: any) => {
          listener = fn;
        },
      },
    },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (values: any) => {
          Object.assign(store, values);
        },
        remove: async (key: string) => {
          delete store[key];
        },
      },
    },
    tabs,
    scripting: { executeScript: execute },
  });
  // @ts-expect-error Chrome extension is intentionally plain JavaScript.
  await import("../browserpilot/background.js");
});
afterEach(() => vi.unstubAllGlobals());
const job = {
  version: 1,
  status: "approved",
  draftId: "d1",
  username: "createe",
  permalink: "https://www.instagram.com/p/test/",
  text: "Putt happens.",
};
async function send(data: any) {
  const result = await new Promise<any>((resolve) =>
    listener({ action: "placeApproved", job: data }, {}, resolve),
  );
  await Promise.resolve();
  await Promise.resolve();
  return result;
}
describe("persistent duplicate protection in Chrome pilot", () => {
  it("refuses unapproved data without opening a tab", async () => {
    expect((await send({ ...job, status: "draft" })).status).toBe("blocked");
    expect(tabs.create).not.toHaveBeenCalled();
  });
  it("refuses a non-Instagram target", async () => {
    expect(
      (await send({ ...job, permalink: "https://evil.test/p/test/" })).status,
    ).toBe("blocked");
    expect(tabs.create).not.toHaveBeenCalled();
  });
  it("persists ambiguous outcomes and never opens a second attempt for the same draft", async () => {
    expect((await send(job)).status).toBe("uncertain");
    expect(store["draft:d1"].status).toBe("uncertain");
    expect(store.active).toBeUndefined();
    expect((await send(job)).status).toBe("blocked");
    expect(tabs.create).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
