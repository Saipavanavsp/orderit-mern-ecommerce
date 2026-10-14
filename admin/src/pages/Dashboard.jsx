import { Link } from 'react-router-dom';
import { dashboardApi } from '../services/index.js';
import { useAsync, useDocumentTitle } from '../hooks/index.js';
import { ChartCard, CountBarChart, RankedBarChart, RevenueChart } from '../charts/Charts.jsx';
import { ErrorState, PageHeader, StatCard, StatusBadge, Thumb } from '../components/ui.jsx';
import { ORDER_STATUS_STYLES, capitalize, formatDate, formatPrice } from '../utils/format.js';

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { data, loading, error, reload } = useAsync(() => dashboardApi.dashboard().then((r) => r.data), []);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24" />)}</div>
        <div className="skeleton h-80" />
      </div>
    );
  }

  const { stats, sales, topProducts, statusBreakdown, recentOrders, lowStockProducts } = data;
  const last30 = sales.reduce((s, d) => s + d.revenue, 0);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Store performance at a glance (paid orders, Indian Standard Time)." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="rupee" label="Total revenue" value={formatPrice(stats.revenue)} sub={`${formatPrice(stats.todayRevenue)} today · AOV ${formatPrice(stats.averageOrderValue)}`} />
        <StatCard icon="package" tone="secondary" label="Orders" value={stats.orders.toLocaleString('en-IN')} sub={`${stats.pendingOrders} awaiting fulfilment`} />
        <StatCard icon="users" label="Customers" value={stats.users.toLocaleString('en-IN')} sub={`${stats.pendingReviews} reviews to moderate`} />
        <StatCard icon="layers" tone={stats.lowStock + stats.outOfStock > 0 ? 'warning' : 'secondary'} label="Active products" value={stats.products} sub={`${stats.lowStock} low stock · ${stats.outOfStock} out of stock`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard
            title="Revenue, last 30 days"
            subtitle={`${formatPrice(last30)} from paid orders`}
            rows={sales}
            columns={[{ label: 'Date', value: (r) => r.date }, { label: 'Revenue', value: (r) => formatPrice(r.revenue) }, { label: 'Orders', value: (r) => r.orders }]}
          >
            <RevenueChart data={sales} />
          </ChartCard>
        </div>
        <ChartCard
          title="Orders by status"
          rows={statusBreakdown}
          columns={[{ label: 'Status', value: (r) => capitalize(r.status) }, { label: 'Orders', value: (r) => r.count }]}
        >
          <RankedBarChart data={statusBreakdown.map((s) => ({ ...s, label: capitalize(s.status) })).sort((a, b) => b.count - a.count)} labelKey="label" valueKey="count" name="Orders" />
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartCard title="Paid orders per day" rows={sales} columns={[{ label: 'Date', value: (r) => r.date }, { label: 'Orders', value: (r) => r.orders }]}>
          <CountBarChart data={sales} dataKey="orders" name="Orders" />
        </ChartCard>
        <ChartCard title="Top products by revenue" rows={topProducts} columns={[{ label: 'Product', value: (r) => r.name }, { label: 'Units', value: (r) => r.unitsSold }, { label: 'Revenue', value: (r) => formatPrice(r.revenue) }]}>
          {topProducts.length ? <RankedBarChart data={topProducts} labelKey="name" valueKey="revenue" name="Revenue" format={formatPrice} /> : <p className="py-10 text-center text-sm text-muted">No paid orders yet.</p>}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-semibold text-fg">Recent orders</h2>
            <Link to="/orders" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o._id}>
                    <td><Link to={`/orders/${o._id}`} className="font-medium text-primary hover:underline">#{o.orderNumber}</Link></td>
                    <td>{o.user?.name}</td>
                    <td className="text-muted">{formatDate(o.createdAt)}</td>
                    <td>{formatPrice(o.totalPrice)}</td>
                    <td><StatusBadge status={o.status} styles={ORDER_STATUS_STYLES} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-fg">Low-stock alerts</h2>
            <Link to="/inventory" className="text-sm text-primary hover:underline">Inventory</Link>
          </div>
          {lowStockProducts.length === 0 && <p className="text-sm text-muted">All products are well stocked.</p>}
          <ul className="space-y-3">
            {lowStockProducts.map((p) => (
              <li key={p._id} className="flex items-center gap-3 text-sm">
                <Thumb src={p.images?.[0]?.url} />
                <span className="line-clamp-2 flex-1 text-fg">{p.name}</span>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${p.stock === 0 ? 'bg-danger-50 text-danger' : 'bg-warning-50 text-warning'}`}>{p.stock === 0 ? 'Out' : `${p.stock} left`}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
