// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useState } from 'react';
import { dashboardApi, orderApi, productApi } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { useAsync, useDocumentTitle } from '../hooks/index.js';
import { useToast } from '../context/contexts.js';
import { ChartCard, CountBarChart, RankedBarChart, RevenueChart } from '../charts/Charts.jsx';
import { Button, ErrorState, PageHeader, StatCard } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { formatPrice } from '../utils/format.js';

const RANGES = [
  [7, 'day', 'Last 7 days'],
  [30, 'day', 'Last 30 days'],
  [90, 'day', 'Last 90 days'],
  [365, 'month', 'Last 12 months'],
];

export default function Analytics() {
  useDocumentTitle('Sales analytics');
  const toast = useToast();
  const [range, setRange] = useState(1);
  const [exporting, setExporting] = useState('');
  const [days, groupBy] = RANGES[range];
  const sales = useAsync(() => dashboardApi.sales({ days, groupBy }).then((r) => r.data.series), [days, groupBy]);
  const extra = useAsync(() => Promise.all([dashboardApi.categories(), dashboardApi.topProducts(10), dashboardApi.breakdowns()]).then(([c, t, b]) => ({ categories: c.data.categories, top: t.data.products, ...b.data })), []);

  const series = sales.data || [];
  const revenue = series.reduce((s, d) => s + d.revenue, 0);
  const orders = series.reduce((s, d) => s + d.orders, 0);
  const items = series.reduce((s, d) => s + d.items, 0);

  const exportCsv = async (kind) => {
    setExporting(kind);
    try {
      if (kind === 'orders') await orderApi.exportCsv();
      else await productApi.exportCsv();
      toast.success(`${kind === 'orders' ? 'Orders' : 'Products'} CSV downloaded`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting('');
    }
  };

  return (
    <>
      <PageHeader
        title="Sales analytics"
        subtitle="Revenue counts paid orders only."
        actions={
          <>
            <Button className="btn-outline" loading={exporting === 'orders'} onClick={() => exportCsv('orders')}><Icon name="download" className="h-4 w-4" /> Orders CSV</Button>
            <Button className="btn-outline" loading={exporting === 'products'} onClick={() => exportCsv('products')}><Icon name="download" className="h-4 w-4" /> Products CSV</Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Date range">
        {RANGES.map(([, , label], i) => (
          <button key={label} type="button" aria-pressed={range === i} onClick={() => setRange(i)} className={`chip ${range === i ? 'border-primary bg-primary text-white' : 'hover:bg-subtle'}`}>{label}</button>
        ))}
      </div>
      {sales.error && <ErrorState message={sales.error} onRetry={sales.reload} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="rupee" label="Revenue" value={formatPrice(revenue)} />
        <StatCard icon="package" tone="secondary" label="Paid orders" value={orders} sub={orders ? `AOV ${formatPrice(revenue / orders)}` : undefined} />
        <StatCard icon="layers" label="Units sold" value={items} />
      </div>
      <div className="mt-6 space-y-6">
        <ChartCard title={`Revenue · ${RANGES[range][2].toLowerCase()}`} rows={series} columns={[{ label: 'Period', value: (r) => r.date }, { label: 'Revenue', value: (r) => formatPrice(r.revenue) }, { label: 'Orders', value: (r) => r.orders }]}>
          {sales.loading ? <div className="skeleton h-72" /> : <RevenueChart data={series} height={300} />}
        </ChartCard>
        <ChartCard title="Paid orders" rows={series} columns={[{ label: 'Period', value: (r) => r.date }, { label: 'Orders', value: (r) => r.orders }]}>
          {sales.loading ? <div className="skeleton h-60" /> : <CountBarChart data={series} dataKey="orders" name="Orders" />}
        </ChartCard>
        {extra.data && (
          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard title="Revenue by category" rows={extra.data.categories} columns={[{ label: 'Category', value: (r) => r.category }, { label: 'Units', value: (r) => r.units }, { label: 'Revenue', value: (r) => formatPrice(r.revenue) }]}>
              <RankedBarChart data={extra.data.categories} labelKey="category" valueKey="revenue" name="Revenue" format={formatPrice} />
            </ChartCard>
            <ChartCard title="Top 10 products" rows={extra.data.top} columns={[{ label: 'Product', value: (r) => r.name }, { label: 'Units', value: (r) => r.unitsSold }, { label: 'Revenue', value: (r) => formatPrice(r.revenue) }]}>
              <RankedBarChart data={extra.data.top} labelKey="name" valueKey="unitsSold" name="Units sold" />
            </ChartCard>
            <ChartCard title="Payment methods (non-cancelled orders)" rows={extra.data.paymentMethods} columns={[{ label: 'Method', value: (r) => r.method }, { label: 'Orders', value: (r) => r.count }, { label: 'Value', value: (r) => formatPrice(r.value) }]}>
              <RankedBarChart data={extra.data.paymentMethods.map((p) => ({ ...p, label: p.method === 'cod' ? 'Cash on delivery' : 'Online (Razorpay)' }))} labelKey="label" valueKey="count" name="Orders" />
            </ChartCard>
          </div>
        )}
      </div>
    </>
  );
}
