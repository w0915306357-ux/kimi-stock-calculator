import { useState, useCallback } from "react";
import { Plus, Trash2, PackageSearch, ChevronDown, ChevronUp, Info, Copy, Check, MessageSquare } from "lucide-react";

interface Item {
  id: string;
  name: string;
  stock: string;
  sales: string;
  targetRatio: string;
}

interface CalcResult {
  salesRatio: number;
  effectiveTargetRatio: number;
  suggestedRestock: number;
  postStock: number;
  postRatio: number;
  diff: number;
  stockMonths: number;
}

type StockStatus = "缺貨風險" | "偏低" | "健康" | "略高" | "偏高" | "—";

const PERIOD_OPTIONS = [
  { label: "7天", value: 7 },
  { label: "30天", value: 30 },
  { label: "60天", value: 60 },
  { label: "90天", value: 90 },
];

function getStockStatus(months: number, hasSales: boolean): StockStatus {
  if (!hasSales) return "—";
  if (months < 1) return "缺貨風險";
  if (months < 2) return "偏低";
  if (months < 4) return "健康";
  if (months < 6) return "略高";
  return "偏高";
}

const STOCK_STATUS_STYLE: Record<StockStatus, { bg: string; text: string; dot: string }> = {
  "缺貨風險": { bg: "bg-red-50 border-red-200",    text: "text-red-700",    dot: "bg-red-500"    },
  "偏低":     { bg: "bg-amber-50 border-amber-200", text: "text-amber-700",  dot: "bg-amber-500"  },
  "健康":     { bg: "bg-green-50 border-green-200", text: "text-green-700",  dot: "bg-green-500"  },
  "略高":     { bg: "bg-sky-50 border-sky-200",     text: "text-sky-700",    dot: "bg-sky-500"    },
  "偏高":     { bg: "bg-orange-50 border-orange-200",text: "text-orange-700",dot: "bg-orange-500" },
  "—":        { bg: "bg-gray-50 border-gray-200",   text: "text-gray-400",   dot: "bg-gray-300"   },
};

function getDiffStyle(diff: number): { color: string; bg: string } {
  const abs = Math.abs(diff * 100);
  if (abs <= 3)  return { color: "text-green-600",  bg: "bg-green-50"  };
  if (abs <= 7)  return { color: "text-amber-600",  bg: "bg-amber-50"  };
  return         { color: "text-red-600",    bg: "bg-red-50"    };
}

function largestRemainderRound(values: number[], total: number): number[] {
  const floors = values.map((v) => Math.floor(v));
  const remainder = total - floors.reduce((a, b) => a + b, 0);
  const remainders = values.map((v, i) => ({ i, r: v - floors[i] }));
  remainders.sort((a, b) => b.r - a.r);
  const result = [...floors];
  for (let k = 0; k < remainder; k++) result[remainders[k].i] += 1;
  return result;
}

function calcResults(
  items: Item[],
  totalRestock: number,
  observationDays: number
): CalcResult[] {
  const stocks = items.map((it) => Math.max(0, parseFloat(it.stock) || 0));
  const salesArr = items.map((it) => Math.max(0, parseFloat(it.sales) || 0));
  const totalSales = salesArr.reduce((a, b) => a + b, 0);
  const totalCurrentStock = stocks.reduce((a, b) => a + b, 0);
  const totalPostStock = totalCurrentStock + totalRestock;

  const salesRatios = salesArr.map((s) => (totalSales > 0 ? s / totalSales : 0));

  const manualTargets = items.map((it) => {
    const v = parseFloat(it.targetRatio);
    return !isNaN(v) && it.targetRatio.trim() !== "" ? v / 100 : null;
  });
  const sumManual = manualTargets.reduce((a, v) => (v !== null ? a + v : a), 0);
  const remaining = Math.max(0, 1 - sumManual);
  const totalAutoSales = salesRatios.reduce(
    (a, r, i) => (manualTargets[i] === null ? a + r : a), 0
  );
  const effectiveTargets = manualTargets.map((mt, i) => {
    if (mt !== null) return mt;
    if (totalAutoSales === 0) return remaining / items.length;
    return (salesRatios[i] / totalAutoSales) * remaining;
  });

  const clamped = new Array(items.length).fill(false);
  let rawRestocks = effectiveTargets.map((t, i) => t * totalPostStock - stocks[i]);

  for (let iter = 0; iter < items.length; iter++) {
    let anyNegative = false;
    for (let i = 0; i < rawRestocks.length; i++) {
      if (!clamped[i] && rawRestocks[i] < 0) { clamped[i] = true; anyNegative = true; }
    }
    if (!anyNegative) break;
    const clampedStockSum = stocks.reduce((a, s, i) => (clamped[i] ? a + s : a), 0);
    const unclampedTargetSum = effectiveTargets.reduce((a, t, i) => (!clamped[i] ? a + t : a), 0);
    const availablePostStock = totalPostStock - clampedStockSum;
    rawRestocks = rawRestocks.map((_, i) => {
      if (clamped[i]) return 0;
      if (unclampedTargetSum === 0) return 0;
      return (effectiveTargets[i] / unclampedTargetSum) * availablePostStock - stocks[i];
    });
  }

  rawRestocks = rawRestocks.map((r) => Math.max(0, r));
  const sumRaw = rawRestocks.reduce((a, b) => a + b, 0);
  if (sumRaw > 0) rawRestocks = rawRestocks.map((r) => (r / sumRaw) * totalRestock);
  else rawRestocks = rawRestocks.map(() => totalRestock / items.length);

  const intRestocks = largestRemainderRound(rawRestocks, Math.round(totalRestock));
  const postStocks = stocks.map((s, i) => s + intRestocks[i]);
  const totalPost = postStocks.reduce((a, b) => a + b, 0);

  return items.map((_, i) => {
    const postRatio = totalPost > 0 ? postStocks[i] / totalPost : 0;
    const monthlyAvgSales = salesArr[i] > 0 ? (salesArr[i] / observationDays) * 30 : 0;
    const stockMonths = monthlyAvgSales > 0 ? postStocks[i] / monthlyAvgSales : 0;
    return {
      salesRatio: salesRatios[i],
      effectiveTargetRatio: effectiveTargets[i],
      suggestedRestock: intRestocks[i],
      postStock: postStocks[i],
      postRatio,
      diff: postRatio - effectiveTargets[i],
      stockMonths,
    };
  });
}

function pct(v: number) { return (v * 100).toFixed(1) + "%"; }
function pctSigned(v: number) {
  const s = (v * 100).toFixed(1);
  return v >= 0 ? "+" + s + "%" : s + "%";
}
function fmt(v: number, decimals = 1) {
  return v.toLocaleString("zh-TW", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtInt(v: number) { return v.toLocaleString("zh-TW", { maximumFractionDigits: 0 }); }
function fmtMonths(v: number) { return v === 0 ? "—" : fmt(v, 1) + " 月"; }

let nextId = 1;
function makeId() { return String(nextId++); }

const defaultItems: Item[] = [
  { id: makeId(), name: "", stock: "", sales: "", targetRatio: "" },
];

const SAMPLE_DATA = [
  { name: "款式 A", stock: "30", sales: "50", targetRatio: "" },
  { name: "款式 B", stock: "20", sales: "35", targetRatio: "" },
  { name: "款式 C", stock: "50", sales: "115", targetRatio: "" },
];

export default function Calculator() {
  const [items, setItems] = useState<Item[]>(defaultItems);
  const [totalRestock, setTotalRestock] = useState("");
  const [observationDays, setObservationDays] = useState(30);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [productName, setProductName] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  const totalRestockNum = Math.max(0, parseFloat(totalRestock) || 0);
  const hasData = totalRestockNum > 0 && items.some((it) => parseFloat(it.sales) > 0);
  const results = hasData ? calcResults(items, totalRestockNum, observationDays) : null;

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { id: makeId(), name: "", stock: "", sales: "", targetRatio: "" },
    ]);
  }, []);

  const loadSample = useCallback(() => {
    setItems(SAMPLE_DATA.map((d) => ({ id: makeId(), ...d })));
    setTotalRestock("100");
  }, []);

  const resetAll = useCallback(() => {
    setItems([{ id: makeId(), name: "", stock: "", sales: "", targetRatio: "" }]);
    setTotalRestock("");
    setProductName("");
    setNote("");
    setExpandedRows(new Set());
  }, []);

  const buildLineMessage = useCallback(() => {
    const lines: string[] = [];
    if (productName.trim()) lines.push(productName.trim(), "");
    lines.push("您好，以下為本次採購數量：", "");
    if (results) {
      items.forEach((item, i) => {
        const qty = results[i].suggestedRestock;
        if (qty > 0) {
          const label = item.name.trim() || `款式 ${i + 1}`;
          lines.push(`${label}：${qty} 件`);
        }
      });
    }
    lines.push("", "再麻煩確認，謝謝。");
    if (note.trim()) lines.push("", `備註：${note.trim()}`);
    return lines.join("\n");
  }, [productName, note, items, results]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(buildLineMessage()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [buildLineMessage]);
  const removeItem = useCallback((id: string) => setItems((prev) => prev.filter((it) => it.id !== id)), []);
  const updateItem = useCallback((id: string, field: keyof Item, value: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  }, []);
  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalManual = items.reduce((acc, it) => {
    const v = parseFloat(it.targetRatio);
    return !isNaN(v) && it.targetRatio.trim() !== "" ? acc + v : acc;
  }, 0);
  const ratioWarning = totalManual > 100;
  const totalSuggestedRestock = results ? results.reduce((a, r) => a + r.suggestedRestock, 0) : 0;
  const totalCurrentStock = items.reduce((a, it) => a + Math.max(0, parseFloat(it.stock) || 0), 0);
  const totalPostStockAfterRestock = totalCurrentStock + totalSuggestedRestock;
  const salesLabel = `近期銷售（${observationDays}天）`;

  return (
    <div className="min-h-screen bg-[hsl(210,20%,97%)]">
      {/* Header */}
      <header className="bg-[hsl(215,30%,18%)] text-white px-4 py-4 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center gap-2.5">
          <PackageSearch className="w-5 h-5 text-[hsl(210,80%,70%)] flex-shrink-0" />
          <div>
            <p className="text-[10px] tracking-widest text-[hsl(210,15%,65%)] uppercase font-medium leading-none mb-1">Kimi極美職人</p>
            <h1 className="text-base font-semibold leading-tight">補貨比例計算工具</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 py-5 space-y-4">
        {/* Settings card */}
        <div className="bg-white rounded-lg border border-[hsl(214,20%,90%)] shadow-sm p-4 space-y-4">
          {/* 商品名稱 + 備註 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[hsl(215,15%,45%)] uppercase tracking-wider mb-2">商品名稱</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="例：KINUJO Silk Premium Dryer"
                className="w-full border border-[hsl(214,20%,88%)] rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(215,70%,42%)] focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[hsl(215,15%,45%)] uppercase tracking-wider mb-2">
                備註 <span className="normal-case font-normal text-[hsl(215,15%,60%)]">（選填）</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例：618補貨、日本追加、新品首批"
                className="w-full border border-[hsl(214,20%,88%)] rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(215,70%,42%)] focus:border-transparent transition"
              />
            </div>
          </div>
          <div className="border-t border-[hsl(214,20%,92%)]" />
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,45%)] uppercase tracking-wider mb-2">銷售觀察期間</label>
            <div className="flex gap-2">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setObservationDays(opt.value)}
                  className={
                    "flex-1 py-2 rounded-md text-sm font-medium border transition-all " +
                    (observationDays === opt.value
                      ? "bg-[hsl(215,70%,42%)] text-white border-[hsl(215,70%,38%)] shadow-sm"
                      : "bg-white text-[hsl(215,20%,40%)] border-[hsl(214,20%,88%)] hover:border-[hsl(215,70%,50%)] hover:text-[hsl(215,70%,42%)]")
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-[hsl(215,15%,55%)]">
              「近期銷售」代表此觀察期間內的實際銷售數量，庫存月數將換算為月平均銷量。
            </p>
          </div>
          <div className="border-t border-[hsl(214,20%,92%)]" />
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,45%)] uppercase tracking-wider mb-2">本次預計補貨總量</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" value={totalRestock}
                onChange={(e) => setTotalRestock(e.target.value)}
                placeholder="輸入補貨總件數"
                className="flex-1 border border-[hsl(214,20%,88%)] rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(215,70%,42%)] focus:border-transparent transition"
              />
              <span className="text-sm text-[hsl(215,15%,52%)]">件</span>
            </div>
          </div>
        </div>

        {ratioWarning && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            目標占比加總已超過 100%（目前 {totalManual.toFixed(1)}%），請重新調整。
          </div>
        )}

        {/* Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-[hsl(215,15%,45%)] uppercase tracking-wider">款式 / 顏色清單</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={resetAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[hsl(214,20%,88%)] text-xs font-medium text-[hsl(215,15%,55%)] hover:border-red-300 hover:text-red-600 transition-all"
              >
                重置全部
              </button>
              <button
                onClick={loadSample}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[hsl(215,15%,72%)] text-xs font-medium text-[hsl(215,15%,45%)] hover:border-[hsl(215,70%,42%)] hover:text-[hsl(215,70%,42%)] transition-all"
              >
                載入範例資料
              </button>
              <button onClick={addItem} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[hsl(215,70%,42%)] text-xs font-medium text-[hsl(215,70%,42%)] hover:bg-[hsl(215,70%,42%)] hover:text-white transition-all">
                <Plus className="w-3.5 h-3.5" />新增款式
              </button>
            </div>
          </div>

          {items.map((item, idx) => {
            const result = results?.[idx];
            const isExpanded = expandedRows.has(item.id);
            const hasSales = parseFloat(item.sales) > 0;
            const status = result ? getStockStatus(result.stockMonths, hasSales) : null;
            const statusStyle = status ? STOCK_STATUS_STYLE[status] : null;
            const diffStyle = result ? getDiffStyle(result.diff) : null;

            return (
              <div key={item.id} className="bg-white rounded-lg border border-[hsl(214,20%,90%)] shadow-sm overflow-hidden">
                {/* Inputs */}
                <div className="p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[hsl(215,70%,42%)] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text" value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      placeholder="款式名稱"
                      className="flex-1 text-sm font-semibold border-0 border-b border-[hsl(214,20%,88%)] px-0 py-1 focus:outline-none focus:border-[hsl(215,70%,42%)] bg-transparent transition"
                    />
                    {items.length > 1 && (
                      <button onClick={() => removeItem(item.id)} className="text-[hsl(215,15%,65%)] hover:text-[hsl(0,72%,52%)] transition-colors flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-[hsl(215,15%,52%)] mb-1.5">現有庫存</label>
                      <input type="number" min="0" value={item.stock} onChange={(e) => updateItem(item.id, "stock", e.target.value)} placeholder="0"
                        className="w-full border border-[hsl(214,20%,88%)] rounded-md px-2 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[hsl(215,70%,42%)] focus:border-transparent transition" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[hsl(215,15%,52%)] mb-1.5 truncate">{salesLabel}</label>
                      <input type="number" min="0" value={item.sales} onChange={(e) => updateItem(item.id, "sales", e.target.value)} placeholder="0"
                        className="w-full border border-[hsl(214,20%,88%)] rounded-md px-2 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[hsl(215,70%,42%)] focus:border-transparent transition" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <label className="text-[10px] font-medium text-[hsl(215,15%,52%)]">目標占比 %</label>
                        {item.targetRatio.trim() === "" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-[hsl(215,80%,94%)] text-[hsl(215,70%,42%)] border border-[hsl(215,60%,85%)]">
                            AUTO
                          </span>
                        )}
                        {item.targetRatio.trim() !== "" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-[hsl(35,90%,94%)] text-[hsl(35,75%,42%)] border border-[hsl(35,60%,85%)]">
                            手動
                          </span>
                        )}
                      </div>
                      <input type="number" min="0" max="100" step="0.1" value={item.targetRatio} onChange={(e) => updateItem(item.id, "targetRatio", e.target.value)} placeholder="自動（依銷售比例）"
                        className={
                          "w-full border rounded-md px-2 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:border-transparent transition " +
                          (item.targetRatio.trim() === ""
                            ? "border-[hsl(215,60%,85%)] bg-[hsl(215,80%,98%)] text-[hsl(215,15%,52%)] focus:ring-[hsl(215,70%,42%)]"
                            : "border-[hsl(35,60%,80%)] bg-[hsl(35,90%,98%)] text-[hsl(35,60%,30%)] focus:ring-[hsl(35,70%,50%)]")
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Result */}
                {result && statusStyle && diffStyle && (
                  <div className="border-t border-[hsl(214,20%,92%)]">
                    {/* KPI + metrics bar */}
                    <div
                      className="flex items-stretch gap-0 cursor-pointer select-none"
                      onClick={() => toggleExpand(item.id)}
                    >
                      {/* 建議補貨 KPI — highlighted left panel */}
                      <div className="flex flex-col items-center justify-center px-4 py-3 bg-[hsl(215,70%,42%)] text-white min-w-[80px] flex-shrink-0">
                        <p className="text-[9px] font-semibold uppercase tracking-widest opacity-80 mb-0.5">建議補貨</p>
                        <p className="text-2xl font-extrabold leading-none tabular-nums">
                          {fmtInt(result.suggestedRestock)}
                        </p>
                        <p className="text-[9px] opacity-70 mt-0.5">件</p>
                      </div>

                      {/* Secondary metrics */}
                      <div className="flex-1 flex items-center justify-between px-3 py-3 bg-[hsl(210,20%,98%)]">
                        <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
                          <MetricCell label="補貨後庫存" value={fmtInt(result.postStock)} color="text-[hsl(215,25%,20%)] font-semibold" />
                          <MetricCell label="補貨後占比" value={pct(result.postRatio)} color="text-[hsl(160,55%,35%)] font-semibold" />
                          <MetricCell
                            label="差異值"
                            value={pctSigned(result.diff)}
                            color={"font-semibold " + diffStyle.color}
                          />
                          <div className="text-center">
                            <div className="inline-flex items-center gap-0.5 mb-1">
                              <p className="text-[10px] text-[hsl(215,15%,52%)]">庫存狀態</p>
                              <InfoTooltip />
                            </div>
                            <div><StatusBadge status={status!} style={statusStyle} /></div>
                          </div>
                        </div>
                        <button className="text-[hsl(215,15%,60%)] flex-shrink-0 ml-2">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 bg-[hsl(210,20%,98%)] border-t border-[hsl(214,20%,93%)]">
                        <DetailRow label="銷售占比" value={pct(result.salesRatio)} />
                        <DetailRow label="目標補貨占比" value={pct(result.effectiveTargetRatio)} highlight />
                        <DetailRow label="建議補貨量" value={fmtInt(result.suggestedRestock) + " 件"} highlight />
                        <DetailRow label="補貨後庫存" value={fmtInt(result.postStock) + " 件"} />
                        <DetailRow label="補貨後占比" value={pct(result.postRatio)} good />
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-[10px] text-[hsl(215,15%,52%)]">差異值</span>
                          <span className={"text-xs font-semibold " + diffStyle.color}>
                            {pctSigned(result.diff)}
                          </span>
                        </div>
                        <DetailRow
                          label="月平均銷量（換算）"
                          value={hasSales ? fmt((parseFloat(item.sales) / observationDays) * 30, 1) + " 件/月" : "—"}
                        />
                        <DetailRow label="庫存月數" value={fmtMonths(result.stockMonths)} />
                        <div className="flex items-center justify-between py-0.5 col-span-2">
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-[hsl(215,15%,52%)]">
                            庫存狀態<InfoTooltip />
                          </span>
                          <StatusBadge status={status!} style={statusStyle} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary table */}
        {results && (
          <div className="bg-[hsl(215,30%,18%)] text-white rounded-lg p-4 shadow-md">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[hsl(210,15%,65%)] mb-3">補貨彙總</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <SummaryCard label="原始總庫存" value={fmtInt(totalCurrentStock) + " 件"} />
              <SummaryCard label="預計補貨總量" value={fmtInt(totalRestockNum) + " 件"} />
              <SummaryCard label="補貨後總庫存" value={fmtInt(totalPostStockAfterRestock) + " 件"} accent />
              <SummaryCard label="建議補貨加總" value={fmtInt(totalSuggestedRestock) + " 件"} match={Math.round(totalRestockNum) === totalSuggestedRestock} />
              <SummaryCard label="款式數量" value={items.length + " 款"} />
              <SummaryCard label="銷售觀察期間" value={observationDays + " 天"} />
            </div>

            <div className="mt-4 overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs min-w-[680px]">
                <thead>
                  <tr className="text-[hsl(210,15%,55%)] border-b border-[hsl(215,25%,28%)]">
                    <th className="text-left pb-2 font-medium">款式</th>
                    <th className="text-right pb-2 font-medium">銷售占比</th>
                    <th className="text-right pb-2 font-medium">目標占比</th>
                    <th className="text-right pb-2 font-medium">建議補貨</th>
                    <th className="text-right pb-2 font-medium">補貨後占比</th>
                    <th className="text-right pb-2 font-medium">差異值</th>
                    <th className="text-right pb-2 font-medium">庫存月數</th>
                    <th className="text-right pb-2 font-medium">
                      <span className="inline-flex items-center justify-end gap-1">庫存狀態<InfoTooltip dark /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const r = results[i];
                    const hasSales = parseFloat(item.sales) > 0;
                    const status = getStockStatus(r.stockMonths, hasSales);
                    const ss = STOCK_STATUS_STYLE[status];
                    const ds = getDiffStyle(r.diff);
                    return (
                      <tr key={item.id} className="border-b border-[hsl(215,25%,24%)] last:border-0">
                        <td className="py-2 font-medium pr-3 max-w-[90px] truncate">{item.name || `款式 ${i + 1}`}</td>
                        <td className="py-2 text-right text-[hsl(210,15%,70%)]">{pct(r.salesRatio)}</td>
                        <td className="py-2 text-right text-[hsl(210,15%,70%)]">{pct(r.effectiveTargetRatio)}</td>
                        <td className="py-2 text-right font-bold text-[hsl(210,80%,72%)]">{fmtInt(r.suggestedRestock)}</td>
                        <td className="py-2 text-right text-[hsl(160,60%,60%)]">{pct(r.postRatio)}</td>
                        <td className={"py-2 text-right font-semibold " + ds.color}>{pctSigned(r.diff)}</td>
                        <td className="py-2 text-right text-[hsl(210,15%,70%)]">{fmtMonths(r.stockMonths)}</td>
                        <td className="py-2 text-right">
                          <span className={"inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border " + ss.bg + " " + ss.text}>
                            <span className={"w-1.5 h-1.5 rounded-full flex-shrink-0 " + ss.dot} />
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="text-[hsl(210,15%,65%)] border-t border-[hsl(215,25%,28%)]">
                    <td className="pt-2 font-semibold">合計</td>
                    <td className="pt-2 text-right">{pct(results.reduce((a, r) => a + r.salesRatio, 0))}</td>
                    <td className="pt-2 text-right">{pct(results.reduce((a, r) => a + r.effectiveTargetRatio, 0))}</td>
                    <td className="pt-2 text-right font-bold text-[hsl(210,80%,72%)]">{fmtInt(totalSuggestedRestock)}</td>
                    <td className="pt-2 text-right text-[hsl(160,60%,60%)]">{pct(results.reduce((a, r) => a + r.postRatio, 0))}</td>
                    <td className="pt-2 text-right">—</td>
                    <td className="pt-2 text-right">—</td>
                    <td className="pt-2 text-right">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* LINE 採購輸出 */}
        {results && (
          <div className="bg-white rounded-lg border border-[hsl(214,20%,90%)] shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[hsl(215,70%,42%)]" />
                <h2 className="text-xs font-semibold text-[hsl(215,15%,45%)] uppercase tracking-wider">採購輸出</h2>
              </div>
              <button
                onClick={handleCopy}
                className={
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all " +
                  (copied
                    ? "bg-green-50 border-green-300 text-green-700"
                    : "border-[hsl(215,70%,42%)] text-[hsl(215,70%,42%)] hover:bg-[hsl(215,70%,42%)] hover:text-white")
                }
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "已複製" : "複製訊息"}
              </button>
            </div>
            <pre className="bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,90%)] rounded-md px-4 py-3 text-sm text-[hsl(215,25%,20%)] whitespace-pre-wrap font-sans leading-relaxed select-all">
              {buildLineMessage()}
            </pre>
          </div>
        )}

        {!hasData && (
          <div className="text-center text-sm text-[hsl(215,15%,60%)] py-6">
            請輸入補貨總量與各款式近期銷售，系統將自動計算建議補貨量。
          </div>
        )}

        <footer className="text-center text-xs text-[hsl(215,15%,60%)] pb-4 space-y-0.5">
          <p>補貨邏輯：以「補貨後庫存占比」貼近目標占比為原則，整數分配採最大餘數法。</p>
          <p>庫存月數 = 補貨後庫存 ÷ 月平均銷量（觀察期換算）｜差異值 = 補貨後占比 − 目標占比</p>
        </footer>
      </main>
    </div>
  );
}

const STOCK_CRITERIA = [
  { range: "< 1 月",  label: "缺貨風險", color: "text-red-400"    },
  { range: "1 ~ 2 月", label: "偏低",   color: "text-amber-400"  },
  { range: "2 ~ 4 月", label: "健康",   color: "text-green-400"  },
  { range: "4 ~ 6 月", label: "略高",   color: "text-sky-400"    },
  { range: "> 6 月",  label: "偏高",   color: "text-orange-400" },
];

function InfoTooltip({ dark }: { dark?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setVisible((v) => !v); }}
        className={
          "inline-flex items-center transition-colors " +
          (dark
            ? "text-[hsl(210,15%,48%)] hover:text-[hsl(210,15%,72%)]"
            : "text-[hsl(215,15%,62%)] hover:text-[hsl(215,70%,42%)]")
        }
        aria-label="庫存狀態說明"
      >
        <Info className="w-3 h-3" />
      </button>

      {visible && (
        <div className="absolute z-50 bottom-full right-0 mb-2 w-48 rounded-lg bg-[hsl(215,40%,10%)] border border-[hsl(215,25%,28%)] shadow-2xl px-3 py-2.5 pointer-events-none">
          {/* Arrow */}
          <div className="absolute -bottom-1.5 right-2 w-3 h-3 bg-[hsl(215,40%,10%)] border-r border-b border-[hsl(215,25%,28%)] rotate-45" />
          <p className="text-[10px] font-semibold text-[hsl(210,15%,70%)] mb-2 pb-1.5 border-b border-[hsl(215,25%,25%)]">
            庫存狀態依「庫存月數」判定
          </p>
          <div className="space-y-1.5">
            {STOCK_CRITERIA.map(({ range, label, color }) => (
              <div key={range} className="flex items-center justify-between gap-3">
                <span className="text-[10px] text-[hsl(210,15%,55%)] tabular-nums">{range}</span>
                <span className={"text-[10px] font-semibold " + color}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-[hsl(215,15%,52%)]">{label}</p>
      <p className={"text-sm " + color}>{value}</p>
    </div>
  );
}

function StatusBadge({
  status,
  style,
}: {
  status: StockStatus;
  style: { bg: string; text: string; dot: string };
}) {
  return (
    <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border " + style.bg + " " + style.text}>
      <span className={"w-1.5 h-1.5 rounded-full flex-shrink-0 " + style.dot} />
      {status}
    </span>
  );
}

function DetailRow({ label, value, highlight, good }: { label: string; value: string; highlight?: boolean; good?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-[hsl(215,15%,52%)]">{label}</span>
      <span className={"text-xs font-semibold " + (highlight ? "text-[hsl(215,70%,42%)]" : good ? "text-[hsl(160,55%,38%)]" : "text-[hsl(215,25%,20%)]")}>
        {value}
      </span>
    </div>
  );
}

function SummaryCard({ label, value, match, accent }: { label: string; value: string; match?: boolean; accent?: boolean }) {
  return (
    <div className={accent ? "rounded-md px-3 py-2 bg-[hsl(215,25%,26%)] border border-[hsl(215,25%,34%)]" : ""}>
      <p className="text-[10px] text-[hsl(210,15%,55%)] mb-0.5">{label}</p>
      <p className={
        "font-bold " +
        (accent
          ? "text-lg text-[hsl(160,60%,65%)]"
          : "text-base " + (match === true ? "text-[hsl(160,60%,60%)]" : match === false ? "text-[hsl(35,80%,65%)]" : "text-white"))
      }>
        {value}
      </p>
    </div>
  );
}
