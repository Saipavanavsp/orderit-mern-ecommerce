// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { shopApi } from '../services/index.js';
import { errorMessage, fieldErrors } from '../services/api.js';
import { useAsync } from '../hooks/index.js';
import { useToast } from '../context/contexts.js';
import { Button, Field, Pagination, RatingStars } from './ui.jsx';
import { Icon } from './Icon.jsx';
import { formatDate } from '../utils/format.js';

function ReviewForm({ productId, onDone }) {
  const [form, setForm] = useState({ rating: 0, title: '', comment: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.rating) errs.rating = 'Choose a rating';
    if (form.comment.trim().length < 10) errs.comment = 'Write at least 10 characters';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const res = await shopApi.createReview(productId, form);
      toast.success(res.message);
      onDone();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-4" noValidate>
      <Field label="Your rating" error={errors.rating}>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={form.rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setForm({ ...form, rating: n })}>
              <Icon name="star" filled className={`h-7 w-7 ${n <= form.rating ? 'text-secondary' : 'text-line'}`} />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Title (optional)" id="r-title">
        <input id="r-title" className="input" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </Field>
      <Field label="Your review" id="r-comment" error={errors.comment}>
        <textarea id="r-comment" rows={4} className="input" maxLength={2000} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="What did you like or dislike? How are you using it?" />
      </Field>
      <Button type="submit" loading={saving}>Submit review</Button>
    </form>
  );
}

export function Reviews({ product }) {
  const user = useSelector((s) => s.auth.user);
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [writing, setWriting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { data, loading } = useAsync(() => shopApi.reviews(product._id, { page, sort, limit: 5 }), [product._id, page, sort]);
  const dist = data?.data.distribution || {};
  const total = Object.values(dist).reduce((a, b) => a + b, 0);

  return (
    <section id="reviews" className="mt-12">
      <h2 className="mb-4 text-xl font-semibold text-fg">Ratings &amp; reviews</h2>
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-semibold text-fg">{product.rating ? product.rating.toFixed(1) : '–'}</span>
            <div>
              <RatingStars value={product.rating} />
              <p className="text-sm text-muted">{product.numReviews} review{product.numReviews === 1 ? '' : 's'}</p>
            </div>
          </div>
          <ul className="mt-4 space-y-1.5">
            {[5, 4, 3, 2, 1].map((r) => (
              <li key={r} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-muted">{r}★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                  <span className="block h-full rounded-full bg-secondary" style={{ width: total ? `${(dist[r] / total) * 100}%` : 0 }} />
                </span>
                <span className="w-8 text-right text-muted">{dist[r] || 0}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            {submitted ? (
              <p className="rounded-lg bg-success-50 p-3 text-sm text-success">Thanks! Your review is awaiting moderation.</p>
            ) : user ? (
              <button type="button" className="btn-outline w-full" onClick={() => setWriting((w) => !w)}>
                <Icon name="edit" className="h-4 w-4" /> {writing ? 'Cancel' : 'Write a review'}
              </button>
            ) : (
              <Link to={`/login?redirect=${encodeURIComponent(location.pathname)}`} className="btn-outline w-full">Log in to write a review</Link>
            )}
          </div>
        </div>
        <div className="space-y-4">
          {writing && !submitted && (
            <ReviewForm
              productId={product._id}
              onDone={() => {
                setWriting(false);
                setSubmitted(true);
              }}
            />
          )}
          {total > 0 && (
            <div className="flex justify-end">
              <label htmlFor="review-sort" className="sr-only">Sort reviews</label>
              <select id="review-sort" className="input w-auto" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                <option value="newest">Newest</option>
                <option value="highest">Highest rated</option>
                <option value="lowest">Lowest rated</option>
              </select>
            </div>
          )}
          {loading && <div className="skeleton h-24 w-full" />}
          {!loading && data?.data.reviews.length === 0 && <p className="text-sm text-muted">No reviews yet. Be the first to share your experience.</p>}
          {data?.data.reviews.map((r) => (
            <article key={r._id} className="border-b border-line pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <RatingStars value={r.rating} size="h-3.5 w-3.5" />
                {r.title && <h3 className="font-medium text-fg">{r.title}</h3>}
              </div>
              <p className="mt-2 text-sm text-fg">{r.comment}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{r.user?.name || 'Customer'}</span>·<span>{formatDate(r.createdAt)}</span>
                {r.isVerifiedPurchase && <span className="inline-flex items-center gap-1 text-success"><Icon name="check" className="h-3.5 w-3.5" /> Verified purchase</span>}
              </p>
            </article>
          ))}
          <Pagination page={page} pages={data?.meta?.pages} onChange={setPage} />
        </div>
      </div>
    </section>
  );
}
