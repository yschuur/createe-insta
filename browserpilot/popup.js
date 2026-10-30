let job;
const $ = (id) => document.getElementById(id);
function valid() {
  $("place").disabled = !job || !$("consent").checked;
}
$("file").addEventListener("change", async () => {
  job = null;
  $("consent").checked = false;
  valid();
  try {
    const file = $("file").files[0];
    if (!file || file.size > 15000)
      throw new Error("Ongeldig of te groot bestand.");
    const input = JSON.parse(await file.text());
    if (
      input.version !== 1 ||
      input.status !== "approved" ||
      !input.username ||
      typeof input.text !== "string"
    )
      throw new Error(
        "Exporteer eerst een goedgekeurde reactie vanuit CREATEE.",
      );
    job = input;
    $("account").textContent =
      `Account: @${job.username}\nPost: ${job.permalink}`;
    $("preview").value = job.text;
    $("result").textContent = "Controleer account en tekst voordat je start.";
  } catch (error) {
    $("result").textContent = error.message;
  }
  valid();
});
$("consent").addEventListener("change", valid);
$("place").addEventListener("click", async () => {
  $("place").disabled = true;
  $("result").textContent =
    "Instagram wordt geopend. De pilot kan tot een minuut duren. Controleer de uitkomst via dit extensie-icoon.";
  try {
    const result = await chrome.runtime.sendMessage({
      action: "placeApproved",
      job,
    });
    $("result").textContent = result.message;
  } catch {
    $("result").textContent =
      "Geen resultaat ontvangen. Controleer Instagram zelf; start niet opnieuw.";
  }
});
chrome.storage.local.get(["latest", "active"]).then(({ latest, active }) => {
  if (active)
    $("result").textContent =
      "Er loopt al een poging. Controleer de Instagram-tab; start niet opnieuw.";
  else if (latest) $("result").textContent = latest.message;
});
