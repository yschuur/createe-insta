import { runApprovedComment } from "./automation.js";
let accepting = false;
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action !== "placeApproved") return;
  if (accepting) {
    sendResponse({ status: "blocked", message: "Er loopt al een poging." });
    return;
  }
  accepting = true;
  (async () => {
    const job = message.job;
    if (
      job?.version !== 1 ||
      job.status !== "approved" ||
      typeof job.draftId !== "string" ||
      !job.draftId ||
      typeof job.text !== "string" ||
      !job.text.trim() ||
      job.text.length > 1000 ||
      !/^[A-Za-z0-9._]{1,30}$/.test(job.username || "")
    )
      throw new Error("Gebruik een goedgekeurd exportbestand uit CREATEE.");
    const url = new URL(job.permalink);
    if (
      url.origin !== "https://www.instagram.com" ||
      !/^\/(p|reel)\/[\w-]+\/$/.test(url.pathname) ||
      url.search ||
      url.hash
    )
      throw new Error("Ongeldige Instagram-postlink.");
    const { active } = await chrome.storage.local.get("active");
    if (active)
      throw new Error(
        "Er loopt al een plaatsingspoging. Controleer de eerder geopende Instagram-tab; de pilot start geen tweede poging.",
      );
    const key = "draft:" + job.draftId;
    const previous = (await chrome.storage.local.get(key))[key];
    if (previous && previous.status !== "blocked")
      throw new Error(
        "Deze reactie is eerder verwerkt of de uitkomst is onzeker. Controleer Instagram zelf om dubbele reacties te voorkomen.",
      );
    await chrome.storage.local.set({
      active: job.draftId,
      [key]: { status: "reserved", at: new Date().toISOString() },
    });
    try {
      const tab = await chrome.tabs.create({ url: url.href, active: true });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          reject(
            new Error(
              "Pagina laden duurde te lang. Controleer de geopende post.",
            ),
          );
        }, 25000);
        const listener = (id, change) => {
          if (id === tab.id && change.status === "complete") {
            clearTimeout(timer);
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        chrome.tabs.get(tab.id).then((current) => {
          if (current.status === "complete") {
            clearTimeout(timer);
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        });
      });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: runApprovedComment,
        args: [job],
      });
      const result = results[0]?.result || {
        status: "uncertain",
        message:
          "Geen betrouwbaar resultaat ontvangen. Controleer de post zelf.",
      };
      await chrome.storage.local.set({
        [key]: { ...result, at: new Date().toISOString() },
        latest: result,
      });
      return result;
    } catch (error) {
      const result = { status: "uncertain", message: error.message };
      await chrome.storage.local.set({ [key]: result, latest: result });
      return result;
    } finally {
      await chrome.storage.local.remove("active");
    }
  })()
    .then(sendResponse, (error) =>
      sendResponse({ status: "blocked", message: error.message }),
    )
    .finally(() => {
      accepting = false;
    });
  return true;
});
