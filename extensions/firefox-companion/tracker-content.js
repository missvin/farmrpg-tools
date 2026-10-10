(() => {
  "use strict";
  const F = globalThis.FarmCapture;
  const terminal = new Set(["applied", "duplicate", "rejected"]);
  let pending = false;
  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== browser.runtime.id || sender.url !== browser.runtime.getURL("_generated_background_page.html") || window.top !== window || location.origin !== F.TRACKER || message?.type !== "deliver-capture") return;
    if (pending) return Promise.resolve({state: "waiting", message: "Another transfer is still pending in this tracker tab."});
    const envelope = message.envelope;
    let requestId;
    try {
      if (!envelope || envelope.channel !== F.CHANNEL || envelope.version !== 1 || envelope.sender !== "farmrpg-tools-firefox" || typeof envelope.body !== "string" || envelope.body.length > 5_000_000 || !/^[a-f0-9]{64}$/.test(envelope.signature)) throw new Error();
      requestId = JSON.parse(envelope.body).requestId;
      if (typeof requestId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)) throw new Error();
    } catch { return Promise.resolve({state: "rejected", message: "Invalid signed transfer."}); }
    pending = true;
    return new Promise(resolve => {
      let messageText = "No tracker acknowledgment. Open the tracker, enable pairing, and retry saved capture.";
      const finish = result => {
        clearTimeout(timer);
        window.removeEventListener("message", onAck);
        pending = false;
        resolve(result);
      };
      const onAck = event => {
        if (event.origin !== F.TRACKER || event.source !== window || !F.validAck(event.data, requestId)) return;
        const ack = event.data;
        if (ack.state === "applied" && (!ack.receipt || ack.receipt.captureId !== JSON.parse(envelope.body).capture.captureId)) return;
        messageText = ack.message;
        if (terminal.has(ack.state)) finish({state: ack.state, message: ack.message, receipt: ack.receipt, warnings: Array.isArray(ack.warnings) ? ack.warnings.filter(w => typeof w === "string").slice(0, 20) : []});
      };
      const timer = setTimeout(() => finish({state: "waiting", message: messageText + " Application is not confirmed."}), 20000);
      window.addEventListener("message", onAck);
      try { window.postMessage(envelope, F.TRACKER); }
      catch { finish({state: "rejected", message: "Firefox tracker relay failed. No application confirmed."}); }
    });
  });
})();
