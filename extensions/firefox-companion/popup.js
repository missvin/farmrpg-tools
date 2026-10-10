(() => {
  "use strict";
  const status = document.getElementById("status");
  const key = document.getElementById("key");
  let busy = false;
  function render(result) {
    document.getElementById("paired").textContent = result.paired ? "Pairing key saved on this Firefox profile." : "Not paired.";
    status.textContent = (result.status?.message || "No status available.") + (result.status?.warnings?.length ? " Warnings: " + result.status.warnings.join("; ") : "");
    status.setAttribute("role", result.status?.state === "rejected" ? "alert" : "status");
    document.getElementById("last").textContent = result.lastAppliedAt ? "Last confirmed application: " + new Date(result.lastAppliedAt).toLocaleString() : "No confirmed tracker application yet.";
    const list = document.getElementById("saved");
    list.replaceChildren();
    for (const capture of result.captures || []) {
      const li = document.createElement("li");
      li.append(capture.section + ": " + capture.rows + " rows, " + new Date(capture.observedAt).toLocaleString() + " ");
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Retry saved " + capture.section;
      retry.addEventListener("click", () => run({type: "retry", section: capture.section}));
      li.append(retry);
      list.append(li);
    }
  }
  async function run(message) {
    if (busy) return;
    busy = true;
    document.querySelectorAll("button").forEach(button => { button.disabled = true; });
    status.setAttribute("role", "status");
    status.textContent = message.type === "capture" ? "Reading and waiting for application…" : "Working…";
    try { render(await browser.runtime.sendMessage(message)); }
    catch { status.setAttribute("role", "alert"); status.textContent = "Companion unavailable. Reopen this popup or reload the temporary extension. No application confirmed."; }
    finally { busy = false; document.querySelectorAll("button").forEach(button => { button.disabled = false; }); }
  }
  document.getElementById("pair-form").addEventListener("submit", event => {
    event.preventDefault();
    const value = key.value.trim();
    key.value = "";
    run({type: "pair", key: value});
  });
  document.getElementById("capture").addEventListener("click", () => run({type: "capture"}));
  document.getElementById("disconnect").addEventListener("click", () => run({type: "disconnect"}));
  run({type: "status"});
})();
