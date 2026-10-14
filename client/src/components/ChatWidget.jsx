import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon.jsx';
import { Spinner } from './ui.jsx';
import { aiApi } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { formatPrice } from '../utils/format.js';

const STARTERS = ['Phone under 20000 with good camera', 'Best rated headphones', 'What is your return policy?', 'Any coupon codes?'];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am the ShopVerse Assistant. I can find products from our catalogue and answer questions about delivery, returns and payments.' },
  ]);
  const listRef = useRef(null);
  const { pathname } = useLocation();
  const productSlug = pathname.startsWith('/product/') ? pathname.split('/')[2] : undefined;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text) => {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      // Only role/content go to the server; the greeting is UI-only.
      const history = next.slice(1).map(({ role, content: c }) => ({ role, content: c })).slice(-10);
      const res = await aiApi.chat(history, productSlug);
      setMessages((m) => [...m, { role: 'assistant', content: res.data.reply, products: res.data.products }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: errorMessage(err, 'Sorry, I could not answer that right now.'), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-white shadow-pop hover:bg-primary-700 md:bottom-6"
        aria-expanded={open}
        aria-controls="assistant-panel"
      >
        <Icon name={open ? 'x' : 'chat'} className="h-5 w-5" />
        <span className="hidden sm:inline">{open ? 'Close' : 'Ask ShopVerse Assistant'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.section
            id="assistant-panel"
            aria-label="ShopVerse Assistant"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-36 right-4 z-40 flex h-[min(560px,70vh)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-pop md:bottom-20"
          >
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary"><Icon name="chat" className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-semibold text-fg">ShopVerse Assistant</p>
                <p className="text-xs text-muted">Recommends only products we sell</p>
              </div>
            </header>
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                  <div className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-primary text-white' : m.error ? 'bg-danger-50 text-danger' : 'bg-subtle text-fg'}`}>
                    {m.content}
                  </div>
                  {m.products?.length > 0 && (
                    <ul className="mt-2 space-y-2">
                      {m.products.map((p) => (
                        <li key={p._id}>
                          <Link to={`/product/${p.slug}`} className="flex items-center gap-3 rounded-lg border border-line p-2 hover:bg-subtle">
                            <img src={p.image} alt="" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded bg-white object-contain" />
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 text-xs text-fg">{p.name}</span>
                              <span className="text-sm font-semibold text-fg">{formatPrice(p.price)}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted"><Spinner className="h-4 w-4" /> Looking through the catalogue…</div>
              )}
              {messages.length === 1 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {STARTERS.map((s) => (
                    <button key={s} type="button" className="chip hover:bg-subtle" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              )}
            </div>
            <form
              className="flex gap-2 border-t border-line p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <label htmlFor="assistant-input" className="sr-only">Message</label>
              <input id="assistant-input" className="input" value={input} maxLength={1000} onChange={(e) => setInput(e.target.value)} placeholder="Ask about a product…" />
              <button type="submit" className="btn-primary px-3" disabled={busy || !input.trim()} aria-label="Send">
                <Icon name="send" className="h-4 w-4" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
