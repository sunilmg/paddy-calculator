import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

function formatCurrencyEquals(num) {
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num || 0);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return sign + formatted.replace(".", "=");
}

export default function App() {
  const STORAGE_KEY = "paddy-calculator:v1";

  const _initial = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  })();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [customerName, setCustomerName] = useState(_initial.customerName ?? "");
  const [date, setDate] = useState(_initial.date ?? todayStr);

  const [totalWeight, setTotalWeight] = useState(_initial.totalWeight ?? "");
  const [bags, setBags] = useState(_initial.bags ?? "");
  const [ratePerQuintal, setRatePerQuintal] = useState(
    _initial.ratePerQuintal ?? ""
  );
  const [labourPerBag, setLabourPerBag] = useState(_initial.labourPerBag ?? "");
  const [tarePerBag, setTarePerBag] = useState(_initial.tarePerBag ?? 2);
  const [adjustments, setAdjustments] = useState(_initial.adjustments ?? []);
  const [printPosition, setPrintPosition] = useState(
    _initial.printPosition ?? "top-right"
  );
  const [printQueue, setPrintQueue] = useState(_initial.printQueue ?? []);
  const [editingQueueId, setEditingQueueId] = useState(null);
  const [batches, setBatches] = useState(_initial.batches ?? []);

  const rootRef = useRef(null);
  const idCounterRef = useRef(_initial._idCounter ?? 1);

  useEffect(() => {
    const toStore = {
      totalWeight,
      bags,
      batches,
      ratePerQuintal,
      labourPerBag,
      tarePerBag,
      adjustments,
      printQueue,
      customerName,
      date,
      printPosition,
      _idCounter: idCounterRef.current,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // ignore
    }
  }, [
    totalWeight,
    bags,
    batches,
    ratePerQuintal,
    labourPerBag,
    tarePerBag,
    adjustments,
    printQueue,
    customerName,
    date,
    printPosition,
  ]);

  const addBorrow = () => {
    setAdjustments((s) => [
      ...s,
      {
        id: Date.now() + Math.random(),
        label: "Borrow",
        amount: "",
        sign: "-",
        note: "",
      },
    ]);
  };

  const numeric = (v) => {
    const n = parseFloat(String(v || "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const computed = useMemo(() => {
    // Sum primary inputs + any added batches
    const baseW = numeric(totalWeight);
    const baseB = Math.max(0, Math.floor(numeric(bags)));
    const batchesW = (batches || []).reduce(
      (acc, b) => acc + numeric(b.weight),
      0
    );
    const batchesB = (batches || []).reduce(
      (acc, b) => acc + Math.max(0, Math.floor(numeric(b.bags))),
      0
    );
    const W = baseW + batchesW;
    const B = Math.max(0, baseB + batchesB);
    const rate = numeric(ratePerQuintal);
    const labour = numeric(labourPerBag);
    const tareVal = numeric(tarePerBag) || 0;
    const totalTare = B * tareVal;
    const netWeight = Math.max(0, W - totalTare);
    const amount = (netWeight / 100) * rate;
    const labourCharge = B * labour;
    const adjSigned = adjustments.reduce(
      (acc, a) =>
        acc + (a.sign === "+" ? numeric(a.amount) : -numeric(a.amount)),
      0
    );
    const final = amount - labourCharge + adjSigned;
    return {
      W,
      B,
      totalTare,
      netWeight,
      amount,
      labourCharge,
      adjSigned,
      final,
    };
  }, [
    totalWeight,
    bags,
    batches,
    ratePerQuintal,
    labourPerBag,
    tarePerBag,
    adjustments,
  ]);

  const addToPrintQueue = () => {
    if (printQueue.length >= 4) return;
    const id = idCounterRef.current++;
    const snapshot = {
      id,
      customerName,
      date,
      totalWeight,
      bags,
      batches: JSON.parse(JSON.stringify(batches || [])),
      ratePerQuintal,
      labourPerBag,
      tarePerBag,
      adjustments: JSON.parse(JSON.stringify(adjustments || [])),
      computed,
    };
    setPrintQueue((q) => [...q, snapshot]);
  };

  const editQueueItem = (id) => {
    const item = printQueue.find((p) => p.id === id);
    if (!item) return;
    // populate form with queued item values
    setCustomerName(item.customerName ?? "");
    setDate(item.date ?? todayStr);
    setTotalWeight(item.totalWeight ?? "");
    setBags(item.bags ?? "");
    setRatePerQuintal(item.ratePerQuintal ?? "");
    setLabourPerBag(item.labourPerBag ?? "");
    setTarePerBag(item.tarePerBag ?? 2);
    setAdjustments(JSON.parse(JSON.stringify(item.adjustments || [])));
    setBatches(JSON.parse(JSON.stringify(item.batches || [])));
    setEditingQueueId(id);
    // focus the first input for convenience
    try {
      const el =
        document.querySelector('input[placeholder="Customer name"]') ||
        document.querySelector("input");
      if (el) el.focus();
    } catch (e) {
      void e;
    }
  };

  const updateQueueItem = () => {
    if (editingQueueId == null) return;
    setPrintQueue((q) =>
      q.map((it) =>
        it.id === editingQueueId
          ? {
              ...it,
              customerName,
              date,
              totalWeight,
              bags,
              ratePerQuintal,
              labourPerBag,
              tarePerBag,
              adjustments: JSON.parse(JSON.stringify(adjustments || [])),
              batches: JSON.parse(JSON.stringify(batches || [])),
              computed,
            }
          : it
      )
    );
    setEditingQueueId(null);
  };

  const cancelEdit = () => {
    setEditingQueueId(null);
  };

  const removeFromPrintQueue = (id) =>
    setPrintQueue((q) => q.filter((it) => it.id !== id));

  const addBatch = () => {
    // require at least one field
    if (!totalWeight && !bags) return;
    const id = idCounterRef.current++;
    setBatches((s) => [
      ...s,
      { id, weight: totalWeight || "0", bags: bags || "0" },
    ]);
    // clear the current inputs for next batch
    setTotalWeight("");
    setBags("");
  };

  const removeBatch = (id) => setBatches((s) => s.filter((b) => b.id !== id));

  const moveInQueue = (index, dir) => {
    setPrintQueue((q) => {
      const copy = q.slice();
      const newIndex = index + dir;
      if (newIndex < 0 || newIndex >= copy.length) return copy;
      const [item] = copy.splice(index, 1);
      copy.splice(newIndex, 0, item);
      return copy;
    });
  };

  const printQueueAll = () => {
    // Open a dedicated print window containing the queued snapshots laid out
    // into four quadrants. This avoids relying on the app's main document
    // print layout and prevents extra/blank pages caused by browser margins
    // or hidden/visibility rules.
    if (!printQueue || printQueue.length === 0) return;
    openPrintInIframe(printQueue.slice(0, 4), { full: false });
  };

  const clearAll = () => {
    const ok = window.confirm("Clear all inputs and stored data?");
    if (!ok) return;
    setTotalWeight("");
    setBags("");
    setRatePerQuintal("");
    setLabourPerBag("");
    setCustomerName("");
    setDate("");
    setAdjustments([]);
    setBatches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      void err;
    }
  };

  const updateAdjustment = (id, key, val) =>
    setAdjustments((s) =>
      s.map((a) => (a.id === id ? { ...a, [key]: val } : a))
    );
  const removeAdjustment = (id) =>
    setAdjustments((s) => s.filter((a) => a.id !== id));

  const prepareAndPrint = () => {
    // Print a single snapshot using the print window for consistent sizing.
    const single = {
      id: idCounterRef.current++,
      customerName,
      date,
      totalWeight,
      bags,
      ratePerQuintal,
      labourPerBag,
      tarePerBag,
      adjustments: JSON.parse(JSON.stringify(adjustments || [])),
      computed,
    };
    openPrintInIframe([single], {
      full: printPosition === "full",
      position: printPosition,
    });
  };

  // Helper: build HTML for one or more snapshots and print using a hidden
  // iframe in the same window. This avoids popups while keeping the printed
  // layout isolated from the app's DOM and CSS.
  const openPrintInIframe = (snapshots, opts = {}) => {
    const { full = false, position } = opts;

    const css = `
      @page { size: A4; margin: 0; }
      html,body{ margin:0; padding:0; }
      body{ font-family: 'Times New Roman', serif; color:#000 }
      .page{ width:210mm; height:297mm; box-sizing:border-box; padding:10mm; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; grid-template-areas: "b a" "d c"; }
      .quad{ box-sizing:border-box; padding:5mm; overflow:hidden; page-break-inside:avoid; }
      .pos1{ grid-area: a; }
      .pos2{ grid-area: b; }
      .pos3{ grid-area: c; }
      .pos4{ grid-area: d; }
      .print-wrapper{ background:white; padding:8px; border-radius:6px; box-sizing:border-box; height:100%; }
      .print-lines{ padding:8px; line-height:1.4; font-size:14px }
      .pl-row{ display:flex; justify-content:space-between; align-items:center; padding:4px 0 }
      .pl-row.header{ font-weight:800; font-size:16px }
      .pl-sep{ border-top:1px solid #000; height:0; margin:6px 0 }
      .pl-row.amount .pl-left, .pl-row.final .pl-left{ font-weight:800; font-size:16px }
      @media print { body{ -webkit-print-color-adjust:exact; print-color-adjust:exact } }
    `;

    const renderSnapshot = (s) => {
      const W = (s.computed?.W ?? 0).toFixed(2);
      const B = s.computed?.B ?? 0;
      const totalTare = s.computed?.totalTare ?? 0;
      const netWeight = (s.computed?.netWeight ?? 0).toFixed(2);
      const amount = formatCurrencyEquals(s.computed?.amount ?? 0);
      const labourCharge = formatCurrencyEquals(s.computed?.labourCharge ?? 0);
      const final = formatCurrencyEquals(s.computed?.final ?? 0);

      const adjustmentsHtml = (s.adjustments || [])
        .map((a, idx) => {
          // For the first adjustment, render a running subtotal above the borrow

          const running = formatCurrencyEquals(
            (s.computed?.amount || 0) - (s.computed?.labourCharge || 0)
          );
          return `
          <div>
            ${
              idx === 0
                ? `<div class="pl-row running"><div class="pl-left">${running}</div></div>`
                : ""
            }
            
            <div class="pl-row adj-line">
            <div class="pl-left">${
              formatCurrencyEquals(parseFloat(a.amount) || 0) +
              (a.sign === " + " ? " + " : " - ")
            }</div>
            <div class="pl-right">${a.note ? a.note : ""}</div>
             
            </div>
            ${
              s.adjustments.length - 1 === idx
                ? `<div class="pl-sep"></div>`
                : ""
            }
          </div>
        `;
        })
        .join("");

      const batchesHtml = (s.batches || [])
        .map(
          (b) => `
        <div class="pl-row"><div class="pl-left">${formatCurrencyEquals(
          Number(b.weight || 0)
        )} kg - ${b.bags || 0} bags</div></div>
      `
        )
        .join("");

      return `
        <div class="print-wrapper print-format">
          <div class="print-lines">
            <div class="pl-row header"><div class="pl-left">${
              s.customerName || "Customer Name"
            }</div><div class="pl-right">${s.date || ""}</div></div>
            ${batchesHtml}
            <div class="pl-sep"></div>
            <div class="pl-row"><div class="pl-left">${formatCurrencyEquals(
              W
            )} kg - ${B} bags</div></div>
            <div class="pl-row"><div class="pl-left">${formatCurrencyEquals(
              totalTare
            )} kg - ${s.tarePerBag} KP (${B} × ${s.tarePerBag})</div></div>
            <div class="pl-sep"></div>
            <div class="pl-row"><div class="pl-left">${netWeight} × ${
        s.ratePerQuintal || 0
      } Rate</div></div>
            <div class="pl-sep"></div>
            <div class="pl-row amount"><div class="pl-left">${amount}</div></div>
            <div class="pl-row"><div class="pl-left">${labourCharge} - labour charge (${B} × ${
        s.labourPerBag || 0
      })</div></div>
            <div class="pl-sep"></div>

            ${adjustmentsHtml}

            <div class="pl-row final"><div class="pl-left">${final}</div></div>
            <div class="pl-row final"><div class="pl-left">${final}</div></div>

            <div class="pl-sep"></div>
            <div class="pl-row zeros"><div class="pl-left">00000 = 00</div></div>
          </div>
        </div>
      `;
    };

    let bodyHtml = "";
    if (full && snapshots.length > 0) {
      // Full page: render the first snapshot occupying the entire page
      bodyHtml =
        `<div class="page" style="grid-template-areas: 'a a' 'a a';">` +
        `<div class="quad pos1">${renderSnapshot(snapshots[0])}</div>` +
        `</div>`;
    } else if (snapshots.length === 1) {
      // Single snapshot: use position if provided, otherwise default to top-left for queue items
      let targetPos = 2; // Default to top-left (pos2) for single items
      if (position && position !== "full") {
        // Single snapshot with specific position: map position to grid area
        // pos1 = a = top-right, pos2 = b = top-left, pos3 = c = bottom-right, pos4 = d = bottom-left
        // Grid layout: "b a" (top row: left=b, right=a), "d c" (bottom row: left=d, right=c)
        const positionMap = {
          "top-left": 2, // top-left selection → print in top-left (pos2 = grid-area b)
          "top-right": 1, // top-right selection → print in top-right (pos1 = grid-area a)
          "bottom-left": 4, // bottom-left selection → print in bottom-left (pos4 = grid-area d)
          "bottom-right": 3, // bottom-right selection → print in bottom-right (pos3 = grid-area c)
        };
        targetPos = positionMap[position] || 2; // Default to top-left if position not found
      }
      bodyHtml =
        `<div class="page">` +
        `<div class="quad pos${targetPos}">${renderSnapshot(
          snapshots[0]
        )}</div>` +
        `</div>`;
    } else {
      // Build quadrants HTML with custom order: 1st→top-left, 2nd→top-right, 3rd→bottom-left, 4th→bottom-right
      // pos1 = a = top-right, pos2 = b = top-left, pos3 = c = bottom-right, pos4 = d = bottom-left
      // Order: [2, 1, 4, 3] means: idx0→pos2(top-left), idx1→pos1(top-right), idx2→pos4(bottom-left), idx3→pos3(bottom-right)
      const positionOrder = [2, 1, 4, 3];
      const quads = positionOrder
        .map((n, idx) => {
          const snap = snapshots[idx];
          return `<div class="quad pos${n}">${
            snap ? renderSnapshot(snap) : ""
          }</div>`;
        })
        .join("");
      bodyHtml = `<div class="page">${quads}</div>`;
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Print</title><style>${css}</style></head><body>${bodyHtml}</body></html>`;

    // create a hidden iframe in the current document for printing
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "0";
    iframe.style.top = "0";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.border = "0";
    iframe.style.overflow = "hidden";
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const idoc = iframe.contentWindow?.document;
    if (!idoc) {
      // fallback to alert; this should rarely happen
      alert("Printing is not available in this environment.");
      try {
        iframe.remove();
      } catch (err) {
        void err;
      }
      return;
    }
    idoc.open();
    idoc.write(html);
    idoc.close();

    const doPrint = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error("Print failed", err);
      } finally {
        // remove iframe after a short delay to ensure printing started
        setTimeout(() => {
          try {
            iframe.remove();
          } catch (e) {
            void e;
          }
        }, 500);
      }
    };

    // Some browsers need a short delay to render iframe content
    setTimeout(doPrint, 300);
  };
  return (
    <div className="app-root" ref={rootRef}>
      <header>
        <h1>MRS Paddy Calculator</h1>
        <p className="subtitle">
          Calculate net paddy weight, amount, labour & borrow adjustments
        </p>
      </header>

      <main className="calculator">
        <section className="inputs">
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <button className="btn small" onClick={clearAll} type="button">
              Clear All
            </button>
          </div>

          <div className="row">
            <label>
              Customer name
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>

          <div className="row">
            <label>
              Total weight (kg)
              <input
                inputMode="decimal"
                value={totalWeight}
                onChange={(e) => setTotalWeight(e.target.value)}
                placeholder="e.g. 1020"
                type="number"
              />
            </label>
            <label>
              Bags count
              <input
                inputMode="numeric"
                value={bags}
                onChange={(e) => setBags(e.target.value)}
                placeholder="e.g. 10"
                type="number"
              />
            </label>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginTop: 8,
              marginBottom: 8,
            }}
          >
            <button className="btn small" onClick={addBatch} type="button">
              Add
            </button>
            <div style={{ fontSize: 13, color: "#444" }}>
              Added batches: {batches.length}
            </div>
          </div>

          {batches.length > 0 && (
            <div style={{ marginTop: 8, fontFamily: "Times New Roman, serif" }}>
              {batches.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 6,
                    fontSize: 14,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    {formatCurrencyEquals(Number(b.weight || 0))} kg -{" "}
                    {b.bags || 0} bags
                  </div>
                  <div>
                    <button
                      className="btn small"
                      onClick={() => removeBatch(b.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="row">
            <label>
              Rate per quintal
              <input
                inputMode="decimal"
                value={ratePerQuintal}
                onChange={(e) => setRatePerQuintal(e.target.value)}
                placeholder="e.g. 1500"
                type="number"
              />
            </label>
            <label>
              Labour charge
              <input
                inputMode="decimal"
                value={labourPerBag}
                onChange={(e) => setLabourPerBag(e.target.value)}
                placeholder="e.g. 20"
                type="number"
              />
            </label>
          </div>

          <div className="row">
            <label>
              Tare per bag (kg)
              <input
                inputMode="decimal"
                value={tarePerBag}
                onChange={(e) => setTarePerBag(e.target.value)}
                placeholder="2"
                type="number"
              />
            </label>
          </div>

          <div className="adjustments">
            <div className="adjustments-header">
              <h3>Borrow / Adjustments</h3>
              <button className="btn small" onClick={addBorrow} type="button">
                + Add Borrow
              </button>
            </div>

            {adjustments.length === 0 ? (
              <p className="muted">
                No borrow entries. Click "Add Borrow" to include amounts.
              </p>
            ) : (
              adjustments.map((a) => (
                <div className="adj-row" key={a.id}>
                  <select
                    value={a.sign || "-"}
                    onChange={(e) =>
                      updateAdjustment(a.id, "sign", e.target.value)
                    }
                    aria-label="sign"
                  >
                    <option value="-">-</option>
                    <option value="+">+</option>
                  </select>
                  <input
                    className="adj-label"
                    value={a.label}
                    onChange={(e) =>
                      updateAdjustment(a.id, "label", e.target.value)
                    }
                  />
                  <input
                    className="adj-amount"
                    inputMode="decimal"
                    value={a.amount}
                    onChange={(e) =>
                      updateAdjustment(a.id, "amount", e.target.value)
                    }
                    placeholder="0"
                  />
                  <input
                    className="adj-note"
                    value={a.note || ""}
                    onChange={(e) =>
                      updateAdjustment(a.id, "note", e.target.value)
                    }
                    placeholder="Note (optional)"
                  />
                  <button
                    className="btn danger small"
                    onClick={() => removeAdjustment(a.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}

            <div style={{ marginTop: 12, marginBottom: 8 }}>
              {editingQueueId ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn"
                    onClick={updateQueueItem}
                    type="button"
                  >
                    Update Queue Item
                  </button>
                  <button
                    className="btn small"
                    onClick={cancelEdit}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="btn queue"
                  onClick={addToPrintQueue}
                  type="button"
                  disabled={printQueue.length >= 4}
                >
                  Add to Print Queue
                </button>
              )}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>
                  Print Queue ({printQueue.length}/4)
                </div>
                {printQueue.length > 0 ? (
                  <div>
                    {printQueue.map((item, idx) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>
                            {item.customerName || "Customer"}
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            {item.date} — {item.totalWeight || 0} kg •{" "}
                            {item.bags || 0} bags
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                          }}
                        >
                          <button
                            className="btn small"
                            onClick={() => editQueueItem(item.id)}
                            type="button"
                            title="Edit this queued item"
                          >
                            ✎
                          </button>
                          <button
                            className="btn small"
                            onClick={() => moveInQueue(idx, -1)}
                            disabled={idx === 0}
                            type="button"
                          >
                            ↑
                          </button>
                          <button
                            className="btn small"
                            onClick={() => moveInQueue(idx, 1)}
                            disabled={idx === printQueue.length - 1}
                            type="button"
                          >
                            ↓
                          </button>
                          <button
                            className="btn danger small"
                            onClick={() => removeFromPrintQueue(item.id)}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 8 }}>
                      <button
                        className="btn"
                        onClick={printQueueAll}
                        type="button"
                      >
                        Print Queue
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    No items in print queue.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="results">
          <div
            className="print-controls"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <h2 style={{ margin: 0 }}>Summary</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 12, color: "#555" }}>
                Print position
              </label>
              <select
                value={printPosition}
                onChange={(e) => setPrintPosition(e.target.value)}
              >
                <option value="top-left">Top left</option>
                <option value="top-right">Top right</option>
                <option value="bottom-left">Bottom left</option>
                <option value="bottom-right">Bottom right</option>
                <option value="full">Full (entire page)</option>
              </select>
              <button className="btn" onClick={prepareAndPrint} type="button">
                Print
              </button>
            </div>
          </div>

          <div className="print-target">
            <div className="print-wrapper print-format">
              <div className="print-lines">
                <div className="pl-row header">
                  <div className="pl-left">
                    {customerName || "Customer Name"}
                  </div>
                  <div className="pl-right">{date}</div>
                </div>

                {/* Render each added batch as its own line in the on-screen summary
                    then show totals and tare afterwards (matches printed format) */}
                {(batches || []).length > 0 ? (
                  <>
                    {batches.map((b) => (
                      <div className="pl-row" key={b.id}>
                        <div className="pl-left">
                          {formatCurrencyEquals(Number(b.weight || 0))} kg -{" "}
                          {b.bags || 0} bags
                        </div>
                      </div>
                    ))}

                    <div className="pl-sep" />

                    <div className="pl-row">
                      <div className="pl-left">
                        {formatCurrencyEquals(Number(computed.W.toFixed(2)))} kg
                        - {computed.B} bags
                      </div>
                    </div>

                    <div className="pl-row">
                      <div className="pl-left">
                        {formatCurrencyEquals(computed.totalTare)} kg -{" "}
                        {tarePerBag} KP ({computed.B} × {tarePerBag})
                      </div>
                    </div>

                    <div className="pl-sep" />
                  </>
                ) : (
                  <>
                    <div className="pl-row">
                      <div className="pl-left">
                        {computed.W.toFixed(2)} kg - {computed.B} bags
                      </div>
                      <div className="pl-right"> </div>
                    </div>

                    <div className="pl-row">
                      <div className="pl-left">
                        {computed.totalTare} kg - {tarePerBag} KP ({computed.B}{" "}
                        × {tarePerBag})
                      </div>
                    </div>

                    <div className="pl-sep" />
                  </>
                )}

                <div className="pl-row">
                  <div className="pl-left">
                    {computed.netWeight.toFixed(2)} × {ratePerQuintal || 0} Rate
                  </div>
                </div>

                <div className="pl-sep" />

                <div className="pl-row amount">
                  <div className="pl-left">
                    {formatCurrencyEquals(computed.amount)}
                  </div>
                </div>

                <div className="pl-row">
                  <div className="pl-left">
                    {formatCurrencyEquals(computed.labourCharge)} - Labour
                    charge ({computed.B} × {labourPerBag || 0})
                  </div>
                </div>

                <div className="pl-sep" />

                <div className="pl-row after-labour">
                  {/* <div className="pl-left">
                    {formatCurrencyEquals(
                      computed.amount - computed.labourCharge
                    )}
                  </div> */}
                </div>

                {adjustments.map((a, idx) => (
                  <div key={a.id}>
                    {/* For the first adjustment show the running subtotal above the borrow line */}
                    {idx === 0 ? (
                      <div className="pl-row running">
                        <div className="pl-left">
                          {formatCurrencyEquals(
                            (computed.amount || 0) -
                              (computed.labourCharge || 0)
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div className="pl-row adj-line">
                      <div className="pl-left">
                        {formatCurrencyEquals(parseFloat(a.amount) || 0) +
                          (a.sign === " + " ? " + " : " - ")}
                      </div>
                      <div className="">
                        {/* For first adjustment we do not repeat the label; show note if present, otherwise leave empty */}
                        {a.note ? a.note : ""}
                      </div>
                    </div>
                    {adjustments.length - 1 === idx ? (
                      <div className="pl-sep" />
                    ) : null}
                  </div>
                ))}

                <div className="pl-row final">
                  <div className="pl-left">
                    {formatCurrencyEquals(computed.final)}
                  </div>
                </div>
                <div className="pl-row final">
                  <div className="pl-left">
                    {formatCurrencyEquals(computed.final)}
                  </div>
                </div>

                <div className="pl-sep" />

                <div className="pl-row zeros">
                  <div className="pl-left">00000 = 00</div>
                </div>
              </div>
            </div>
          </div>

          <div className="queued-prints" aria-hidden>
            {printQueue.slice(0, 4).map((item, idx) => (
              <div key={item.id} className={`queued-print pos-${idx + 1}`}>
                <div className="print-wrapper print-format">
                  <div className="print-lines">
                    <div className="pl-row header">
                      <div className="pl-left">
                        {item.customerName || "Customer Name"}
                      </div>
                      <div className="pl-right">{item.date}</div>
                    </div>
                    <div className="pl-row">
                      <div className="pl-left">
                        {(item.computed?.W ?? 0).toFixed(2)} kg -{" "}
                        {item.computed?.B ?? 0} bags
                      </div>
                    </div>
                    <div className="pl-row">
                      <div className="pl-left">
                        {item.computed?.totalTare ?? 0} kg - {item.tarePerBag}{" "}
                        KP ({item.computed?.B ?? 0} × {item.tarePerBag})
                      </div>
                    </div>
                    <div className="pl-sep" />
                    <div className="pl-row">
                      <div className="pl-left">
                        {(item.computed?.netWeight ?? 0).toFixed(2)} ×{" "}
                        {item.ratePerQuintal || 0} rate
                      </div>
                    </div>
                    <div className="pl-sep" />
                    <div className="pl-row amount">
                      <div className="pl-left">
                        {formatCurrencyEquals(item.computed?.amount ?? 0)}
                      </div>
                    </div>
                    <div className="pl-row">
                      <div className="pl-left">
                        {formatCurrencyEquals(item.computed?.labourCharge ?? 0)}{" "}
                        - labour charge ({item.computed?.B ?? 0} ×{" "}
                        {item.labourPerBag || 0})
                      </div>
                    </div>
                    <div className="pl-sep" />
                    <div className="pl-row after-labour">
                      <div className="pl-left">
                        {formatCurrencyEquals(
                          (item.computed?.amount ?? 0) -
                            (item.computed?.labourCharge ?? 0)
                        )}
                      </div>
                    </div>
                    {(item.adjustments || []).map((a, j) => (
                      <div key={a.id}>
                        {/* For first adjustment, show running subtotal above then the borrow row */}
                        {j === 0 ? (
                          <div className="pl-row running">
                            <div className="pl-left">
                              {formatCurrencyEquals(
                                (item.computed?.amount ?? 0) -
                                  (item.computed?.labourCharge ?? 0)
                              )}
                            </div>
                          </div>
                        ) : null}

                        <div className="pl-row adj-line">
                          <div className="pl-right">
                            {j === 0
                              ? a.note
                                ? a.note
                                : ""
                              : (a.sign === "+" ? "+ " : "- ") + a.label}
                          </div>
                          <div className="pl-left">
                            {(a.sign === "+" ? "+ " : "- ") +
                              formatCurrencyEquals(parseFloat(a.amount) || 0)}
                          </div>
                        </div>

                        {a.note && j !== 0 ? (
                          <div className="pl-row adj-note-row">
                            <div className="pl-left">{a.note}</div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    <div className="pl-sep" />
                    <div className="pl-row final">
                      <div className="pl-left">
                        {formatCurrencyEquals(item.computed?.final ?? 0)}
                      </div>
                    </div>
                    <div className="pl-sep" />
                    <div className="pl-row zeros">
                      {/* <div className="pl-left">00000 = 00</div> */}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="final-display">
            <div className="line">
              <span>Amount</span>
              <span>{formatCurrencyEquals(computed.amount)}</span>
            </div>
            <div className="line">
              <span>Labour</span>
              <span>- {formatCurrencyEquals(computed.labourCharge)}</span>
            </div>
            {adjustments.map((a) => (
              <div key={a.id}>
                <div className="line small">
                  {a.note ? (
                    <div
                      className="line small note"
                      style={{ color: "#6b7280" }}
                    >
                      <span>{a.note}</span>
                      <span></span>
                    </div>
                  ) : null}
                  <span>
                    {a.sign === "+" ? "+ " : "- "}
                    {formatCurrencyEquals(parseFloat(a.amount) || 0)}
                  </span>
                </div>
              </div>
            ))}
            <div className="separator" />
            <div className="line total">
              <span>Total</span>
              <span>{formatCurrencyEquals(computed.final)}</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="notes">
        <p>
          Net weight clamps at 0 if tare exceeds entered total weight.
          Adjustments are subtracted by default.
        </p>
      </footer>
    </div>
  );
}
