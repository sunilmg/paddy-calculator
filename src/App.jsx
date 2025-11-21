import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

function formatCurrencyEquals(num) {
  // Format number with commas and exactly 2 decimals, then replace '.' with '='
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

  // Synchronously load initial state from localStorage to avoid setState-in-effect
  const _initial = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  })();
  // customer info
  const todayStr = new Date().toISOString().slice(0, 10);
  const [customerName, setCustomerName] = useState(_initial.customerName ?? "");
  const [date, setDate] = useState(_initial.date ?? todayStr);

  const [totalWeight, setTotalWeight] = useState(_initial.totalWeight ?? ""); // kg
  const [bags, setBags] = useState(_initial.bags ?? "");
  const [ratePerQuintal, setRatePerQuintal] = useState(
    _initial.ratePerQuintal ?? ""
  ); // per 100kg
  const [labourPerBag, setLabourPerBag] = useState(_initial.labourPerBag ?? "");
  const [adjustments, setAdjustments] = useState(_initial.adjustments ?? []); // {id, label, amount}
  const [printPosition, setPrintPosition] = useState("top-right");
  const rootRef = useRef(null);

  // Persist values on change
  useEffect(() => {
    const toStore = {
      totalWeight,
      bags,
      ratePerQuintal,
      labourPerBag,
      adjustments,
      customerName,
      date,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // ignore storage errors
    }
  }, [
    totalWeight,
    bags,
    ratePerQuintal,
    labourPerBag,
    adjustments,
    customerName,
    date,
  ]);

  const addBorrow = () => {
    setAdjustments((s) => [
      ...s,
      {
        id: Date.now() + Math.random(),
        label: "Borrow",
        amount: "",
        sign: "-",
      },
    ]);
  };

  const clearAll = () => {
    const ok = window.confirm("Clear all inputs and stored data?");
    if (!ok) return;
    setTotalWeight("");
    setBags("");
    setRatePerQuintal("");
    setLabourPerBag("");
    setAdjustments([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const updateAdjustment = (id, key, val) => {
    setAdjustments((s) =>
      s.map((a) => (a.id === id ? { ...a, [key]: val } : a))
    );
  };

  const removeAdjustment = (id) =>
    setAdjustments((s) => s.filter((a) => a.id !== id));

  const numeric = (v) => {
    const n = parseFloat(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const computed = useMemo(() => {
    const W = numeric(totalWeight);
    const B = Math.max(0, Math.floor(numeric(bags)));
    const rate = numeric(ratePerQuintal);
    const labour = numeric(labourPerBag);

    const tarePerBag = 2; // 2 KP (2 kg per bag)
    const totalTare = B * tarePerBag;
    const netWeight = Math.max(0, W - totalTare);

    // amount is per quintal (100kg): (netWeight / 100) * rate
    const amount = (netWeight / 100) * rate;

    const labourCharge = B * labour;

    // adjustments may be '+' (add) or '-' (subtract)
    const adjSigned = adjustments.reduce(
      (acc, a) =>
        acc + (a.sign === "+" ? numeric(a.amount) : -numeric(a.amount)),
      0
    );

    // By default adjustments affect final as signed values: final = amount - labour + adjSigned
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
  }, [totalWeight, bags, ratePerQuintal, labourPerBag, adjustments]);

  // Print handling: prepare scaled print in selected quadrant
  const prepareAndPrint = () => {
    const root = rootRef.current || document.querySelector(".app-root");
    if (!root) return;
    // set attribute so print CSS positions the .print-target
    root.setAttribute("data-print", printPosition);

    // compute scale to fit the .print-wrapper into target area (quadrant or full)
    const wrapper = root.querySelector(".print-target .print-wrapper");
    if (wrapper) {
      // available space depends on selected printPosition: for 'full' use full
      // viewport minus margins, otherwise use a quadrant (half width/height)
      let availWidth;
      let availHeight;
      if (printPosition === "full") {
        availWidth = Math.max(200, window.innerWidth - 40);
        availHeight = Math.max(200, window.innerHeight - 40);
      } else {
        availWidth = Math.max(200, window.innerWidth * 0.5 - 40);
        availHeight = Math.max(200, window.innerHeight * 0.5 - 40);
      }
      // natural size
      const rect = wrapper.getBoundingClientRect();
      // desired scale to fill quadrant (may be >1 for upscaling)
      const desired = Math.max(
        0.1,
        Math.min(
          3,
          availWidth / Math.max(1, rect.width),
          availHeight / Math.max(1, rect.height)
        )
      );

      if (desired > 1) {
        // Prefer font-size based scaling for crisper upscaling. Cap font-scale to 2.5x
        const fontScale = Math.min(2.5, desired);
        root.style.setProperty("--print-font-scale", String(fontScale));
        root.style.setProperty("--print-scale", "1");
      } else {
        // For downscale, use transform scale
        root.style.setProperty("--print-font-scale", "1");
        root.style.setProperty("--print-scale", String(desired));
      }
    } else {
      root.style.setProperty("--print-font-scale", "1");
      root.style.setProperty("--print-scale", "1");
    }

    // small delay to let styles apply
    setTimeout(() => {
      window.print();
      // cleanup after print dialog closes
      const cleanup = () => {
        try {
          root.removeAttribute("data-print");
          root.style.removeProperty("--print-scale");
          root.style.removeProperty("--print-font-scale");
        } catch (_ignore) {
          void _ignore;
        }
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
    }, 120);
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
              />
            </label>

            <label>
              Bags count
              <input
                inputMode="numeric"
                value={bags}
                onChange={(e) => setBags(e.target.value)}
                placeholder="e.g. 10"
              />
            </label>
          </div>

          <div className="row">
            <label>
              Rate per quintal (per 100kg)
              <input
                inputMode="decimal"
                value={ratePerQuintal}
                onChange={(e) => setRatePerQuintal(e.target.value)}
                placeholder="e.g. 1500"
              />
            </label>

            <label>
              Labour per bag
              <input
                inputMode="decimal"
                value={labourPerBag}
                onChange={(e) => setLabourPerBag(e.target.value)}
                placeholder="e.g. 20"
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

            {adjustments.length === 0 && (
              <p className="muted">
                No borrow entries. Click "Add Borrow" to include amounts to
                subtract.
              </p>
            )}

            {adjustments.map((a) => (
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
                <button
                  className="btn danger small"
                  onClick={() => removeAdjustment(a.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
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
                Print Summary
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

                <div className="pl-row">
                  <div className="pl-left">
                    {computed.W.toFixed(2)} kg - {computed.B} bags
                  </div>
                  <div className="pl-right"> </div>
                </div>

                <div className="pl-row">
                  <div className="pl-left">
                    {computed.totalTare} - 2 KP ({computed.B} × 2)
                  </div>
                </div>

                <div className="pl-sep" />

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
                  <div className="pl-left">
                    {formatCurrencyEquals(
                      computed.amount - computed.labourCharge
                    )}
                  </div>
                </div>

                {adjustments.map((a, idx) => (
                  <div key={a.id}>
                    <div className="pl-row adj-line">
                      <div className="pl-left">
                        {a.sign === "+" ? "+ " : "- "}
                        {a.label}
                      </div>
                      <div className="pl-right">
                        {(a.sign === "+" ? "+ " : "- ") +
                          formatCurrencyEquals(parseFloat(a.amount) || 0)}
                      </div>
                    </div>
                    <div className="pl-sep" />
                    <div className="pl-row running">
                      <div className="pl-left">
                        {formatCurrencyEquals(
                          (idx === 0
                            ? computed.amount - computed.labourCharge
                            : undefined) ?? 0
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="pl-sep" />

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
              <div className="line small" key={a.id}>
                <span>
                  {a.sign === "+" ? "+ " : "- "}
                  {a.label}
                </span>
                <span>
                  {a.sign === "+" ? "+ " : "- "}
                  {formatCurrencyEquals(parseFloat(a.amount) || 0)}
                </span>
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
