import { useState } from "react";
import { StageDot } from "../../components/StageBadge";
import { percent, type Funnel } from "../../lib/analytics";
import { STAGE_META } from "../../lib/stages";

export function FunnelChart({ funnel }: { funnel: Funnel }) {
  const [table, setTable] = useState(false);
  const base = Math.max(funnel.total, 1);

  return (
    <div className="chart">
      {table ? (
        <table className="data-table">
          <caption className="visually-hidden">Applications that reached each stage</caption>
          <thead>
            <tr>
              <th scope="col">Stage</th>
              <th scope="col">Reached</th>
              <th scope="col">Of all</th>
              <th scope="col">From previous</th>
            </tr>
          </thead>
          <tbody>
            {funnel.steps.map((step, i) => (
              <tr key={step.stage}>
                <th scope="row">{STAGE_META[step.stage].label}</th>
                <td className="num">{step.count}</td>
                <td className="num">{percent(step.count, funnel.total)}%</td>
                <td className="num">
                  {i === 0 ? "—" : `${percent(step.count, funnel.steps[i - 1].count)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ol className="funnel">
          {funnel.steps.map((step, i) => {
            const share = percent(step.count, funnel.total);
            const prev = funnel.steps[i - 1];
            const conversion = prev ? percent(step.count, prev.count) : null;
            const tip = `${STAGE_META[step.stage].label}: ${step.count} of ${funnel.total} applications (${share}%)`;
            return (
              <li key={step.stage} className="funnel__row">
                {conversion !== null && (
                  <span className="funnel__conversion num" aria-hidden="true">
                    ↳ {conversion}% moved on
                  </span>
                )}
                <div className="funnel__label">
                  <StageDot stage={step.stage} />
                  {STAGE_META[step.stage].label}
                </div>
                <div className="funnel__track" tabIndex={0} aria-label={tip} data-tip={tip}>
                  <div
                    className={`funnel__bar ${step.count === 0 ? "is-empty" : ""}`}
                    style={{
                      width: `${Math.max((step.count / base) * 100, step.count ? 2 : 0)}%`,
                      ["--i" as string]: i,
                    }}
                  />
                </div>
                <div className="funnel__value num">
                  <strong>{step.count}</strong>
                  <span>{share}%</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="chart__foot">
        {funnel.rejected > 0 && (
          <p className="chart__note">
            <StageDot stage="rejected" /> {funnel.rejected} closed as rejected along the way
          </p>
        )}
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
