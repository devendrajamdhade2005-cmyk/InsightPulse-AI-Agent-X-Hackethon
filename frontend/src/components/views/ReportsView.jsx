import { useCallback, useState } from "react";
import * as api from "../../lib/api.js";
import { toolHuman } from "../../lib/format.js";
import { cx } from "../../lib/accents.js";
import { FullScreenModal } from "../ui/Overlay.jsx";
import { Button, EmptyState, Panel, PanelHead } from "../ui/Primitives.jsx";
import { LoadingPanel } from "../ui/Loading.jsx";
import { FileText } from "../icons/index.jsx";
import { Report3D } from "../reports/Report3D.jsx";
import { useRun } from "../../state/RunProvider.jsx";

/* Report export.
 *
 * Built from the completed run — no searches are repeated to produce a document,
 * which is why the report id is cached on the run and reused across formats.
 */

export function ReportsView({ onScrollToSearch }) {
  const { run, hasRun, report, setReport, insights } = useRun();

  const [status, setStatus] = useState("");
  const [tone, setTone] = useState("");
  const [preview, setPreview] = useState(null); // { reportId, url } | null
  const [previewError, setPreviewError] = useState("");
  const [frameLoaded, setFrameLoaded] = useState(false);

  const ensureReport = useCallback(
    async ({ force = false } = {}) => {
      if (!run) throw new Error("run a scan first");
      if (report && !force) return report;
      setStatus(force ? "Regenerating…" : "Building report…");
      setTone("busy");
      const data = await api.generateReport(run.run_id, { force });
      setReport(data.report);
      setStatus(
        `Report ${data.report.report_id} ready${data.cached ? " (cached)" : ""}.`,
      );
      setTone("ok");
      return data.report;
    },
    [run, report, setReport],
  );

  const download = useCallback(
    async (format) => {
      try {
        const r = await ensureReport();
        setStatus(`Preparing ${format.toUpperCase()}…`);
        setTone("busy");
        await api.downloadReport(r.report_id, format);
        setStatus(`${format.toUpperCase()} downloaded.`);
        setTone("ok");
      } catch (err) {
        setStatus(`Could not complete: ${err.message}`);
        setTone("err");
      }
    },
    [ensureReport],
  );

  const openPreview = useCallback(
    async ({ force = false } = {}) => {
      setPreviewError("");
      setFrameLoaded(false);
      setPreview({ reportId: "", url: "" });
      try {
        const r = await ensureReport({ force });
        setPreview({
          reportId: r.report_id,
          url: api.reportPreviewUrl(r.report_id),
        });
      } catch (err) {
        setPreviewError(`Could not build the report: ${err.message}`);
      }
    },
    [ensureReport],
  );

  if (!hasRun) {
    return (
      <EmptyState
        icon={FileText}
        title="No scan to report on yet"
        body="Run an intelligence scan and a full professional document can be generated from it."
        action={<Button onClick={onScrollToSearch}>Run Intelligence Scan</Button>}
      />
    );
  }

  const m = run.metrics || {};
  const facts = [
    ["Tracking goal", run.goal],
    ["Run ID", <span className="font-mono text-[11.5px]">{run.run_id}</span>],
    [
      "Tools used",
      (m.tools_used || []).map((t) => toolHuman(t)).join(", ") || "—",
    ],
    [
      "Data",
      m.simulated_data_used
        ? "includes clearly-labelled simulated findings"
        : "all findings from live sources",
    ],
  ];

  return (
    <>
      <Panel>
        <PanelHead
          eyebrow="Deliverable"
          title="Intelligence Report"
          sub={`A complete professional document built from this scan — ${insights.length} prioritized insight(s), the agent's execution trail, ${m.findings_total || 0} detailed finding(s), sources and caveats.`}
        />

        <dl className="mb-4 grid gap-2.5 md:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k} className="border-2 border-line-soft bg-bg-2 px-3 py-2">
              <dt className="nb-label">{k}</dt>
              <dd className="mt-1 break-words text-[13px] text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>

        <Report3D
          pageCount={Math.max(13, 10 + Math.ceil((m.findings_total || 0) / 6))}
          busy={tone === "busy"}
          reportId={report?.report_id}
          onPreview={() => openPreview()}
          onDownload={download}
          onRegenerate={() => openPreview({ force: true })}
        />

        {status ? (
          <p
            aria-live="polite"
            className={cx(
              "mt-3 border-2 px-3 py-2 text-[12.5px] font-semibold",
              tone === "busy" && "border-brand-blue bg-brand-blue-bg text-brand-blue",
              tone === "ok" && "border-brand-green bg-brand-green-bg text-brand-green",
              tone === "err" && "border-brand-red bg-brand-red-bg text-brand-red",
            )}
          >
            {status}
          </p>
        ) : null}
      </Panel>

      <FullScreenModal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title="Intelligence Report"
        meta={preview?.reportId}
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openPreview({ force: true })}
            >
              Generate again
            </Button>
            <Button size="sm" onClick={() => download("pdf")}>
              Download PDF
            </Button>
          </>
        }
      >
        {!frameLoaded || previewError ? (
          <div className="absolute inset-0 grid place-items-center bg-bg px-6 text-center">
            {previewError ? (
              <p className="text-[14px] font-semibold text-brand-red">
                {previewError}
              </p>
            ) : (
              <LoadingPanel
                label="Building your report"
                sub="Assembling seven sections from this scan"
              />
            )}
          </div>
        ) : null}
        {preview?.url ? (
          <iframe
            key={preview.url}
            src={preview.url}
            title="Report preview"
            onLoad={() => setFrameLoaded(true)}
            className="h-full w-full"
          />
        ) : null}
      </FullScreenModal>
    </>
  );
}
