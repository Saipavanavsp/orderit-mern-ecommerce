// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchWishlist } from '../store/wishlistSlice.js';
import { useDocumentTitle } from '../hooks/index.js';
import { ProductGrid } from '../components/ProductCard.jsx';
import { Breadcrumbs, EmptyState, GridSkeleton } from '../components/ui.jsx';

export default function Wishlist() {
  useDocumentTitle('Wishlist');
  const dispatch = useDispatch();
  const { products, loaded } = useSelector((s) => s.wishlist);

  useEffect(() => {
    dispatch(fetchWishlist());
  }, [dispatch]);

  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: 'Wishlist' }]} />
      <h1 className="mb-5 text-2xl font-semibold text-fg">Wishlist {loaded && <span className="text-base font-normal text-muted">({products.length})</span>}</h1>
      {!loaded && <GridSkeleton count={4} />}
      {loaded && products.length === 0 && (
        <EmptyState icon="heart" title="Your wishlist is empty" message="Tap the heart on any product to save it for later." action={<Link to="/products" className="btn-primary">Explore products</Link>} />
      )}
      {loaded && products.length > 0 && <ProductGrid products={products} />}
    </div>
  );
}
