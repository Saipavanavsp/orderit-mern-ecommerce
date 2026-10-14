import { useState } from 'react';
import { ProductImage } from './ProductCard.jsx';

export function ImageGallery({ images = [], name }) {
  const [active, setActive] = useState(0);
  const current = images[active] || images[0];
  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row">
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto md:flex-col" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                className={`h-16 w-16 shrink-0 rounded border bg-white p-1 ${i === active ? 'border-primary ring-2 ring-primary/20' : 'border-line'}`}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === active}
              >
                <ProductImage src={img.url} alt="" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="card flex aspect-square flex-1 items-center justify-center bg-white p-6">
        <ProductImage src={current?.url} alt={current?.alt || name} />
      </div>
    </div>
  );
}
