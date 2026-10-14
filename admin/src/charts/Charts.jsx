// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../context/contexts.js';
import { compactINR, formatPrice } from '../utils/format.js';

// Series color is a validated single step per theme (see src/index.css --chart).
function useChartColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const rgb = (v) => `rgb(${css.getPropertyValue(v).trim().split(' ').join(',')})`;
    return {
      series: css.getPropertyValue('--chart').trim() || '#3b6fb6',
      grid: css.getPropertyValue('--grid').trim() || '#e2e8f0',
      muted: rgb('--muted'),
      fg: rgb('--fg'),
      surface: rgb('--surface'),
      line: rgb('--line'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

const shortDate = (d) => {
  if (/^\d{4}-\d{2}$/.test(d)) return new Date(`${d}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

function TooltipBox({ active, payload, label, format, labelFormat = (l) => l }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-medium text-fg">{labelFormat(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold text-fg">{format(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** Card with a Chart / Table toggle so the data is never colour- or chart-only. */
export function ChartCard({ title, subtitle, rows, columns, children, actions }) {
  const [view, setView] = useState('chart');
  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-fg">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <div className="inline-flex rounded border border-line text-xs" role="group" aria-label={`${title} view`}>
            {['chart', 'table'].map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={`px-2.5 py-1 capitalize ${view === v ? 'bg-subtle font-medium text-fg' : 'text-muted'}`}>{v}</button>
            ))}
          </div>
        </div>
      </div>
      {view === 'chart' ? (
        children
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="table">
            <thead><tr>{columns.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{columns.map((c) => <td key={c.label}>{c.value(r)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RevenueChart({ data, height = 280 }) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: c.muted, fontSize: 12 }} axisLine={{ stroke: c.line }} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={compactINR} tick={{ fill: c.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
        <Tooltip cursor={{ stroke: c.muted, strokeDasharray: '3 3' }} content={<TooltipBox format={formatPrice} labelFormat={shortDate} />} />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke={c.series} strokeWidth={2} fill={c.series} fillOpacity={0.12} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CountBarChart({ data, dataKey, name, height = 240 }) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: c.muted, fontSize: 12 }} axisLine={{ stroke: c.line }} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={{ fill: c.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip cursor={{ fill: c.grid, fillOpacity: 0.5 }} content={<TooltipBox format={(v) => v} labelFormat={shortDate} />} />
        <Bar dataKey={dataKey} name={name} fill={c.series} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal ranked bars with direct value labels (categories, top products, statuses). */
export function RankedBarChart({ data, labelKey, valueKey, name, format = (v) => v, height }) {
  const c = useChartColors();
  const h = height || Math.max(160, data.length * 36 + 16);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide domain={[0, 'dataMax']} />
        <YAxis type="category" dataKey={labelKey} width={140} tick={{ fill: c.fg, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => (String(v).length > 20 ? `${String(v).slice(0, 19)}…` : v)} />
        <Tooltip cursor={{ fill: c.grid, fillOpacity: 0.5 }} content={<TooltipBox format={format} />} />
        <Bar dataKey={valueKey} name={name} fill={c.series} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
          <LabelList dataKey={valueKey} position="right" formatter={format} style={{ fill: c.fg, fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
