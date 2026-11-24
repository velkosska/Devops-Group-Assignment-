import { useState } from "react";
import { StageDot } from "../../components/StageBadge";
import type { StageDuration } from "../../lib/analytics";
import { formatDays, slowestStage } from "../../lib/headline";
import { STAGE_META } from "../../lib/stages";

const NO_DATA = "No data yet";

export function TimeInStageChart({ durations }: { durations: StageDuration[] }) {
  const [table, setTable] = useState(false);
  const max = Math.max(...durations.map((d) => d.medianDays ?? 0), 1);
  const slowest = slowestStage(durations);

  return (
    <div className="chart">
      {table ? (
        <table className="data-table">
          <caption className="visually-hidden">Median days spent in each stage</caption>
          <thead>
            <tr>
              <th scope="col">Stage</th>
              <th scope="col">Median time</th>
            </tr>
          </thead>
          <tbody>
            {durations.map((d) => (
              <tr key={d.stage}>
                <th scope="row">{STAGE_META[d.stage].label}</th>
                <td className="num">
                  {d.medianDays === null ? NO_DATA : formatDays(d.medianDays)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ol className="bars">
          {durations.map((d, i) => {
            const tip =
              d.medianDays === null
                ? `${STAGE_META[d.stage].label}: no data yet`
                : `${STAGE_META[d.stage].label}: median ${formatDays(d.medianDays)}`;
            return (
              <li
                key={d.stage}
                className={`bars__row ${slowest?.stage === d.stage ? "is-highlight" : ""}`}
              >
                <div className="bars__label">
                  <StageDot stage={d.stage} />
                  {STAGE_META[d.stage].label}
                </div>
                <div className="bars__track" tabIndex={0} aria-label={tip} data-tip={tip}>
                  {d.medianDays !== null && (
                    <div
                      className="bars__bar"
                      style={{
                        width: `${Math.max((d.medianDays / max) * 100, 2)}%`,
                        ["--i" as string]: i,
                      }}
                    />
                  )}
                </div>
                <div className="bars__value num">
                  {d.medianDays === null ? NO_DATA : formatDays(d.medianDays)}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="chart__foot">
        <p className="chart__note">Median time before an application moves on</p>
        <button
          type="button"
          className="text-link text-link--muted chart__toggle"
          onClick={() => setTable((t) => !t)}
          aria-pressed={table}
        >
          {table ? "Show chart" : "Show as table"}
        </button>
      </div>
    </div>
  );
}
