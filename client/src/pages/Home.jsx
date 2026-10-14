import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { catalogApi, aiApi } from '../services/index.js';
import { useAsync, useDocumentTitle } from '../hooks/index.js';
import { ProductRail, ProductImage } from '../components/ProductCard.jsx';
import { ErrorState, GridSkeleton } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';

const PERKS = [
  { icon: 'truck', title: 'Free delivery', text: 'On orders above ₹999' },
  { icon: 'refresh', title: '7-day returns', text: 'Hassle-free pickups' },
  { icon: 'shield', title: 'Secure payments', text: 'Razorpay & cash on delivery' },
  { icon: 'chat', title: 'Shopping assistant', text: 'Ask for recommendations' },
];

function Hero({ product }) {
  return (
    <section className="border-b border-line bg-surface">
      <div className="container-page grid items-center gap-8 py-10 md:grid-cols-2 md:py-14">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">This week at OrderIt</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-fg sm:text-4xl">
            The tech and essentials you use every day, priced fairly.
          </h1>
          <p className="mt-4 max-w-lg text-muted">
            Phones, laptops, TVs, kitchen appliances and wardrobe staples from brands you know. Compare specifications, read
            verified reviews and check out in a minute.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/products" className="btn-primary px-5 py-2.5">Shop all products</Link>
            <Link to="/products?minDiscount=20&sort=discount" className="btn-outline px-5 py-2.5">See today’s deals</Link>
          </div>
        </motion.div>
        {product && (
          <Link to={`/product/${product.slug}`} className="card group flex items-center gap-6 p-6">
            <div className="h-48 w-40 shrink-0 bg-white sm:h-56 sm:w-48">
              <ProductImage src={product.images?.[0]?.url} alt={product.name} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Featured · {product.brand?.name}</p>
              <p className="mt-2 line-clamp-3 font-semibold text-fg group-hover:text-primary">{product.name}</p>
              <p className="mt-3 text-2xl font-semibold text-fg">₹{product.price.toLocaleString('en-IN')}</p>
              {product.discountPercent > 0 && <p className="text-sm text-success">{product.discountPercent}% below MRP</p>}
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}

function ForYou() {
  const user = useSelector((s) => s.auth.user);
  const { data } = useAsync(() => (user ? aiApi.forMe().then((r) => r.data.products) : Promise.resolve([])), [user?._id]);
  return <ProductRail title="Recommended for you" products={data} />;
}

export default function Home() {
  useDocumentTitle('Shop electronics, appliances & fashion');
  const { data, loading, error, reload } = useAsync(() => catalogApi.home().then((r) => r.data), []);

  return (
    <>
      <Hero product={data?.featured?.[0]} />
      <div className="container-page">
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PERKS.map((p) => (
            <div key={p.title} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
              <Icon name={p.icon} className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold text-fg">{p.title}</p>
                <p className="text-xs text-muted">{p.text}</p>
              </div>
            </div>
          ))}
        </section>

        {error && <div className="mt-10"><ErrorState message={error} onRetry={reload} /></div>}
        {loading && <div className="mt-10"><GridSkeleton count={8} /></div>}

        {data && (
          <>
            <section className="mt-10">
              <h2 className="mb-4 text-xl font-semibold text-fg">Shop by category</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {data.categories.map((c) => (
                  <Link key={c._id} to={`/category/${c.slug}`} className="card group flex flex-col items-center p-4 text-center hover:border-primary">
                    <div className="mb-3 h-20 w-20 bg-white p-1">
                      <ProductImage src={c.image} alt={c.name} />
                    </div>
                    <p className="text-sm font-medium text-fg group-hover:text-primary">{c.name}</p>
                    <p className="text-xs text-muted">{c.productCount} products</p>
                  </Link>
                ))}
              </div>
            </section>
            <ProductRail title="Featured picks" products={data.featured} to="/products?featured=true" />
            <ProductRail title="Deals of the day" products={data.deals} to="/products?minDiscount=20&sort=discount" />
            <ForYou />
            <ProductRail title="New arrivals" products={data.newArrivals} to="/products?sort=newest" />
            <ProductRail title="Top rated" products={data.topRated} to="/products?sort=rating" />
          </>
        )}
      </div>
    </>
  );
}
