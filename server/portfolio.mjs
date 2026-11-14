export function calculateHoldings(trades) {
  const holdings = {};
  let realizedPnL = 0;

  for (const trade of trades) {
    const symbol = trade.stock_name;
    const quantity = Number(trade.quantity);
    const price = Number(trade.price);
    if (!symbol || !Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
      throw new Error('Saved trade history contains invalid order data.');
    }

    const existing = holdings[symbol];
    if (trade.transaction_type === 'BUY') {
      const nextQuantity = (existing?.qty || 0) + quantity;
      holdings[symbol] = {
        qty: nextQuantity,
        avgPrice: existing
          ? (existing.qty * existing.avgPrice + quantity * price) / nextQuantity
          : price,
      };
    } else if (trade.transaction_type === 'SELL') {
      if (!existing || existing.qty < quantity) {
        throw new Error('Saved trade history contains a sell order without sufficient holdings.');
      }
      realizedPnL += (price - existing.avgPrice) * quantity;
      const remaining = existing.qty - quantity;
      if (remaining === 0) {
        delete holdings[symbol];
      } else {
        holdings[symbol] = { ...existing, qty: remaining };
      }
    } else {
      throw new Error('Saved trade history contains an unsupported order type.');
    }
  }

  return { holdings, realizedPnL };
}

export function validatePaperOrder(order, cash, holdings) {
  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    throw new Error('Order details are invalid.');
  }

  const symbol = typeof order.stockName === 'string' ? order.stockName.trim().toUpperCase() : '';
  const side = typeof order.type === 'string' ? order.type.trim().toUpperCase() : '';
  const quantity = Number(order.quantity);
  const price = Number(order.price);

  if (!/^[A-Z0-9.^&=_-]{1,32}(?:\.(?:NS|BO))?$/.test(symbol)) {
    throw new Error('Choose a valid NSE or BSE stock symbol.');
  }
  if (!['BUY', 'SELL'].includes(side)) {
    throw new Error('Choose BUY or SELL.');
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2147483647) {
    throw new Error('Quantity must be a positive whole number.');
  }
  if (!Number.isFinite(price) || price <= 0 || price > 99999999.99) {
    throw new Error('A valid current market price is required.');
  }

  const priceCents = Math.round(price * 100);
  const totalCents = priceCents * quantity;
  if (!Number.isSafeInteger(totalCents)) {
    throw new Error('Order value is too large.');
  }
  if (side === 'BUY' && totalCents > Math.round(Number(cash) * 100)) {
    throw new Error('Insufficient virtual cash for this order.');
  }
  if (side === 'SELL' && (!holdings[symbol] || holdings[symbol].qty < quantity)) {
    throw new Error('You do not own enough shares to place this sell order.');
  }

  return { symbol, side, quantity, price: priceCents / 100, total: totalCents / 100 };
}
