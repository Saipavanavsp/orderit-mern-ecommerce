// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useCallback, useRef, useState } from 'react';
import { orderApi } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { Modal } from '../components/Modal.jsx';
import { Button } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { formatAmount } from '../utils/format.js';

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/**
 * Online payment flow. Razorpay test mode when the server has keys, otherwise a clearly labelled
 * simulator. In both cases the server verifies the HMAC signature before marking the order paid.
 * Returns { pay(order) => Promise<'paid'|'failed'|'dismissed'>, paymentModal }.
 */
export function usePayment() {
  const [sim, setSim] = useState(null); // { order, session }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resolver = useRef(null);

  const finish = (result) => {
    setSim(null);
    setBusy(false);
    setError('');
    resolver.current?.(result);
  };

  const pay = useCallback(async (order) => {
    const session = (await orderApi.createPayment(order._id)).data;
    if (session.mode === 'simulation') {
      return new Promise((resolve) => {
        resolver.current = resolve;
        setSim({ order, session });
      });
    }
    if (!(await loadRazorpay())) throw new Error('Could not load Razorpay checkout. Check your connection.');
    return new Promise((resolve) => {
      const rzp = new window.Razorpay({
        key: session.keyId,
        amount: session.amount,
        currency: session.currency,
        order_id: session.providerOrderId,
        name: 'OrderIt',
        description: `Order ${session.orderNumber}`,
        prefill: session.prefill,
        theme: { color: '#3B6FB6' },
        handler: async (resp) => {
          try {
            await orderApi.pay(order._id, {
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
            });
            resolve('paid');
          } catch {
            resolve('failed');
          }
        },
        modal: { ondismiss: () => resolve('dismissed') },
      });
      rzp.on('payment.failed', () => resolve('failed'));
      rzp.open();
    });
  }, []);

  const simulate = async (outcome) => {
    setBusy(true);
    setError('');
    try {
      const result = (await orderApi.simulatePayment({ orderId: sim.order._id, providerOrderId: sim.session.providerOrderId, outcome })).data;
      if (result.status !== 'authorized') return finish('failed');
      await orderApi.pay(sim.order._id, result);
      return finish('paid');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      return undefined;
    }
  };

  const paymentModal = (
    <Modal open={Boolean(sim)} onClose={() => !busy && finish('dismissed')} title="Test payment" size="sm">
      {sim && (
        <>
          <div className="rounded-lg border border-line bg-subtle p-4 text-sm">
            <p className="text-muted">Order {sim.session.orderNumber}</p>
            <p className="mt-1 text-2xl font-semibold text-fg">{formatAmount(sim.session.amount / 100)}</p>
          </div>
          <p className="mt-3 flex gap-2 text-xs text-muted">
            <Icon name="info" className="h-4 w-4 shrink-0" />
            Razorpay keys are not configured, so this simulates the gateway. The server still verifies a signed payment before confirming your order.
          </p>
          {error && <p className="field-error">{error}</p>}
          <div className="mt-5 flex flex-col gap-2">
            <Button className="btn-primary py-2.5" loading={busy} onClick={() => simulate('success')}>Pay {formatAmount(sim.session.amount / 100)}</Button>
            <button type="button" className="btn-outline" disabled={busy} onClick={() => simulate('failure')}>Simulate a failed payment</button>
          </div>
        </>
      )}
    </Modal>
  );

  return { pay, paymentModal };
}
