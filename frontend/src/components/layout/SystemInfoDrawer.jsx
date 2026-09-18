import { API_TARGET_LABEL } from "../../lib/config.js";
import { providerLabel } from "../../lib/format.js";
import { Drawer } from "../ui/Overlay.jsx";
import { LiveTag, SimTag } from "../intelligence/Atoms.jsx";
import { Card, MiniLabel, Note, SectionTitle, TagRow } from "../ui/Primitives.jsx";

/* System & sources panel.
 *
 * Ported from `renderSystemInfo()`. Technical detail deliberately lives here
 * rather than in the header, so the main surface stays about the intelligence.
 *
 * One addition: the resolved API target is shown. With the frontend now deployable
 * separately from the backend, "which backend am I actually talking to?" is a
 * question worth being able to answer without opening devtools.
 */

function Row({ label, value, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft py-1.5 text-[12.5px] last:border-b-0">
      <span className="capitalize text-ink-3">{label}</span>
      <span
        className={
          tone === "ok"
            ? "font-bold text-brand-green"
            : tone === "warn"
              ? "font-bold text-brand-yellow"
              : "font-semibold"
        }
      >
        {value}
      </span>
    </div>
  );
}

export function SystemInfoDrawer({ open, onClose, tools, error }) {
  const caps = tools?.capabilities || {};
  const llm = caps.llm || {};
  const keyed = caps.keyed_sources || {};

  return (
    <Drawer open={open} onClose={onClose} title="System & Sources">
      {error ? (
        <Card accent="red" className="nb-a-bg">
          <MiniLabel>Backend unreachable</MiniLabel>
          <p className="text-[13px]">{error}</p>
          <Note>
            Target: <span className="font-mono">{API_TARGET_LABEL}</span>
          </Note>
        </Card>
      ) : null}

      {!tools && !error ? (
        <p className="text-[13px] text-ink-3">Loading capability report…</p>
      ) : null}

      {tools ? (
        <div className="space-y-6">
          <section>
            <SectionTitle>Connection</SectionTitle>
            <Row label="API target" value={<span className="font-mono text-[11px]">{API_TARGET_LABEL}</span>} />
            <Row label="App version" value={tools.version || "—"} />
            <Row
              label="simulation mode"
              value={tools.simulation_mode ? "on" : "off"}
              tone={tools.simulation_mode ? "warn" : "ok"}
            />
          </section>

          <section>
            <SectionTitle>Reasoning engine</SectionTitle>
            <Row
              label="Mode"
              value={llm.live ? "AI model" : "built-in deterministic reasoner"}
              tone={llm.live ? "ok" : "warn"}
            />
            <Row label="Provider" value={llm.provider || "—"} />
            <Row
              label="Model"
              value={<span className="font-mono text-[11px]">{llm.model || "—"}</span>}
            />
            {!llm.live ? (
              <Note>
                No AI credential is active, so planning, tool selection and
                prioritization run on the deterministic reasoner. The agent still
                reasons — it just says so honestly.
              </Note>
            ) : null}
          </section>

          <section>
            <SectionTitle>Agent tools ({(tools.usable || []).length})</SectionTitle>
            <div className="space-y-2">
              {(tools.tools || []).map((tool) => (
                <Card key={tool.name || tool.display_name} className="bg-bg-2">
                  <b className="block text-[13px] font-bold">{tool.display_name}</b>
                  <p className="mb-2 mt-1 text-[11.5px] text-ink-3">
                    {tool.when_to_use}
                  </p>
                  <TagRow>
                    {(tool.providers_live || []).map((p) => (
                      <span key={p} className="contents">
                        <LiveTag />
                        <span className="text-[11px] font-semibold">
                          {providerLabel(p)}
                        </span>
                      </span>
                    ))}
                    {(tool.providers_simulated || []).map((p) => (
                      <span key={p} className="contents">
                        <SimTag on />
                        <span className="text-[11px] font-semibold text-ink-3">
                          {providerLabel(p)}
                        </span>
                      </span>
                    ))}
                  </TagRow>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle>Source credentials</SectionTitle>
            {Object.entries(keyed).map(([k, v]) => (
              <Row
                key={k}
                label={k.replace(/_/g, " ")}
                value={v ? "configured" : "not set — simulated"}
                tone={v ? "ok" : "warn"}
              />
            ))}
          </section>

          {caps.keyless_sources?.length ? (
            <section>
              <SectionTitle>Live with no key</SectionTitle>
              <TagRow>
                {caps.keyless_sources.map((s) => (
                  <span
                    key={s}
                    className="border-2 border-line bg-brand-green-bg px-1.5 py-0.5 text-[11px] font-semibold text-brand-green"
                  >
                    {providerLabel(s)}
                  </span>
                ))}
              </TagRow>
            </section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
