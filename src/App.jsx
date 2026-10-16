
import React, { useEffect, useMemo, useState } from 'react';

const calculateMovingAverage = (prices, period) =>
  prices.map((_, index) => {
    if (index < period - 1) return null;
    const window = prices.slice(index - period + 1, index + 1);
    return window.reduce((total, price) => total + price, 0) / period;
  });

const calculateRsi = (prices, period) => {
  const values = Array(prices.length).fill(null);
  if (prices.length <= period) return values;

  let averageGain = 0;
  let averageLoss = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = prices[index] - prices[index - 1];
    averageGain += Math.max(change, 0);
    averageLoss += Math.max(-change, 0);
  }
  averageGain /= period;
  averageLoss /= period;

  const getRsi = () => {
    if (averageGain === 0 && averageLoss === 0) return 50;
    if (averageLoss === 0) return 100;
    if (averageGain === 0) return 0;
    const relativeStrength = averageGain / averageLoss;
    return 100 - 100 / (1 + relativeStrength);
  };

  values[period] = getRsi();
  for (let index = period + 1; index < prices.length; index += 1) {
    const change = prices[index] - prices[index - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
    values[index] = getRsi();
  }

  return values;
};

export default function TradeNexusIndia() {
  const initialStocks = [
    {
      symbol: 'RELIANCE',
      company: 'Reliance Industries Ltd',
      price: 3125.5,
    },
    {
      symbol: 'TCS',
      company: 'Tata Consultancy Services',
      price: 4578.2,
    },
    {
      symbol: 'INFY',
      company: 'Infosys Ltd',
      price: 1936.8,
    },
    {
      symbol: 'HDFCBANK',
      company: 'HDFC Bank Ltd',
      price: 1812.4,
    },
    {
      symbol: 'ICICIBANK',
      company: 'ICICI Bank Ltd',
      price: 1425.3,
    },
    {
      symbol: 'SBIN',
      company: 'State Bank of India',
      price: 925.75,
    },
  ];

  const [user, setUser] = useState(() =>
    localStorage.getItem('tradeNexusUser')
  );
  const [loginMethod, setLoginMethod] = useState('email');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [stocks, setStocks] = useState(initialStocks);
  const [priceHistory, setPriceHistory] = useState(() =>
    Object.fromEntries(
      initialStocks.map((stock, stockIndex) => [
        stock.symbol,
        Array.from({ length: 20 }, (_, pointIndex) => {
          const progress = pointIndex / 19;
          const wave = Math.sin(pointIndex * 0.8 + stockIndex) * 0.003;
          return Number((stock.price * (1 + wave * (1 - progress))).toFixed(2));
        }),
      ])
    )
  );
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim();
  const [shareSearchResults, setShareSearchResults] = useState([]);
  const [shareSearchStatus, setShareSearchStatus] = useState('idle');
  const [selectedShare, setSelectedShare] = useState(null);
  const [shareDetails, setShareDetails] = useState(null);
  const [shareDetailsStatus, setShareDetailsStatus] = useState('idle');
  const [marketCap, setMarketCap] = useState(null);
  const [marketCapStatus, setMarketCapStatus] = useState('idle');
  const [marketPrices, setMarketPrices] = useState({});
  const [shareChartRange, setShareChartRange] = useState('1d');
  const [shareChartHoverIndex, setShareChartHoverIndex] = useState(null);
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  const [showRsi, setShowRsi] = useState(false);
  const [cash, setCash] = useState(30000);
  const [holdings, setHoldings] = useState({});
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [modal, setModal] = useState(null);
  const [tradeError, setTradeError] = useState(null);
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [pnlHistory, setPnlHistory] = useState(() =>
    Array.from({ length: 12 }, (_, index) => ({
      time: Date.now() - (11 - index) * 1500,
      realized: 0,
      unrealized: 0,
    }))
  );
  const [hoveredPnlIndex, setHoveredPnlIndex] = useState(null);
  const [showRealized, setShowRealized] = useState(true);
  const [showUnrealized, setShowUnrealized] = useState(true);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setOrdersError(null);
      return undefined;
    }

    const controller = new AbortController();
    const loadOrders = async () => {
      setOrdersError(null);
      try {
        const response = await fetch(
          `/api/trades?userId=${encodeURIComponent(user)}`,
          { signal: controller.signal }
        );
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Could not load your trades.');
        }

        const loadedOrders = result.map((trade) => ({
          id: trade.id,
          side: trade.transaction_type,
          symbol: trade.stock_name,
          qty: trade.quantity,
          price: Number(trade.price),
          total: Number(trade.price) * trade.quantity,
          pnl: 0,
          time: new Date(trade.trade_date).toLocaleString(),
        }));
        setOrders((currentOrders) => {
          const loadedIds = new Set(loadedOrders.map((order) => String(order.id)));
          const recentOrders = currentOrders.filter(
            (order) => !loadedIds.has(String(order.id))
          );
          return [...recentOrders, ...loadedOrders];
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          setOrdersError(error.message || 'Could not load your trades.');
        }
      }
    };

    loadOrders();
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setStocks((prev) =>
        prev.map((s) => ({
          ...s,
          price: Number(
            (s.price + (Math.random() - 0.5) * s.price * 0.003).toFixed(2)
          ),
        }))
      );
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setPriceHistory((previous) =>
      Object.fromEntries(
        stocks.map((stock) => [
          stock.symbol,
          [...(previous[stock.symbol] || []), stock.price].slice(-24),
        ])
      )
    );
  }, [stocks]);

  useEffect(() => {
    const query = normalizedSearch;
    if (query.length < 2) {
      setShareSearchResults([]);
      setShareSearchStatus('idle');
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setShareSearchStatus('loading');
      try {
        const response = await fetch(
          `/api/yahoo/search?q=${encodeURIComponent(query)}&quotesCount=25&newsCount=0`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Stock search failed (${response.status})`);
        }

        const data = await response.json();
        const results = (data.quotes || [])
          .filter(
            (quote) =>
              quote.quoteType === 'EQUITY' &&
              /\.(NS|BO)$/i.test(quote.symbol || '')
          )
          .filter(
            (quote, index, entries) =>
              entries.findIndex((entry) => entry.symbol === quote.symbol) === index
          );

        if (!controller.signal.aborted) {
          setShareSearchResults(results);
          setShareSearchStatus(results.length ? 'ready' : 'empty');
        }
      } catch (error) {
        if (!controller.signal.aborted && error.name !== 'AbortError') {
          setShareSearchResults([]);
          setShareSearchStatus('error');
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedSearch]);

  useEffect(() => {
    if (!selectedShare) {
      setShareDetails(null);
      setShareDetailsStatus('idle');
      return undefined;
    }

    const controller = new AbortController();
    const intervalByRange = {
      '1d': '5m',
      '5d': '15m',
      '1mo': '1d',
      '1y': '1wk',
    };

    const loadDetails = async () => {
      setShareDetailsStatus('loading');
      setShareDetails(null);
      try {
        const response = await fetch(
          `/api/yahoo/chart/${encodeURIComponent(selectedShare.symbol)}?range=${shareChartRange}&interval=${intervalByRange[shareChartRange]}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Share details failed (${response.status})`);
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];
        if (!result?.meta) {
          throw new Error(data.chart?.error?.description || 'No quote details were returned.');
        }

        const indicators = result.indicators?.quote?.[0] || {};
        const series = (result.timestamp || [])
          .map((timestamp, index) => ({
            time: timestamp,
            price: indicators.close?.[index],
            open: indicators.open?.[index],
            high: indicators.high?.[index],
            low: indicators.low?.[index],
            volume: indicators.volume?.[index],
          }))
          .filter((point) => Number.isFinite(point.price));
        const latestPrice = Number.isFinite(result.meta.regularMarketPrice)
          ? result.meta.regularMarketPrice
          : series[series.length - 1]?.price;
        if (Number.isFinite(latestPrice)) {
          setMarketPrices((previous) => ({
            ...previous,
            [selectedShare.symbol]: latestPrice,
          }));
        }
        setShareDetails({ meta: result.meta, series });
        setShareDetailsStatus('ready');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setShareDetailsStatus('error');
        }
      }
    };

    loadDetails();
    return () => controller.abort();
  }, [selectedShare, shareChartRange]);

  useEffect(() => {
    if (!selectedShare) {
      setMarketCap(null);
      setMarketCapStatus('idle');
      return undefined;
    }

    const controller = new AbortController();
    const currentTime = Math.floor(Date.now() / 1000);
    const loadMarketCap = async () => {
      setMarketCap(null);
      setMarketCapStatus('loading');
      try {
        const response = await fetch(
          `/api/yahoo/fundamentals/${encodeURIComponent(selectedShare.symbol)}?type=trailingMarketCap&merge=false&period1=${currentTime - 2 * 365 * 24 * 60 * 60}&period2=${currentTime + 24 * 60 * 60}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Market capitalization request failed (${response.status})`);
        }

        const fundamentals = await response.json();
        const result = fundamentals.timeseries?.result?.find(
          (item) => item.meta?.type?.includes('trailingMarketCap')
        );
        const values = result?.trailingMarketCap || [];
        const latest = values[values.length - 1];
        if (!latest?.reportedValue) {
          setMarketCapStatus('unavailable');
          return;
        }

        setMarketCap({
          formatted: latest.reportedValue.fmt,
          currency: latest.currencyCode,
          date: latest.asOfDate,
        });
        setMarketCapStatus('ready');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setMarketCapStatus('unavailable');
        }
      }
    };

    loadMarketCap();
    return () => controller.abort();
  }, [selectedShare]);

  const filteredStocks = useMemo(() => {
    const searchTerm = normalizedSearch.toLowerCase();
    if (!searchTerm) {
      return stocks;
    }

    return stocks.filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(searchTerm) ||
        stock.company.toLowerCase().includes(searchTerm)
    );
  }, [normalizedSearch, stocks]);

  const unrealizedPnL = Object.entries(holdings).reduce((total, [symbol, h]) => {
    const currentPrice = stocks.find((s) => s.symbol === symbol)?.price ?? marketPrices[symbol];
    if (!Number.isFinite(currentPrice)) return total;

    return total + (currentPrice - h.avgPrice) * h.qty;
  }, 0);

  const realizedPnL = orders.reduce((sum, o) => sum + (o.pnl || 0), 0);
  const totalPnL = realizedPnL + unrealizedPnL;

  useEffect(() => {
    setPnlHistory((previous) => {
      const lastPoint = previous[previous.length - 1];
      if (
        lastPoint?.realized === realizedPnL &&
        lastPoint?.unrealized === unrealizedPnL
      ) {
        return previous;
      }

      return [
        ...previous,
        { time: Date.now(), realized: realizedPnL, unrealized: unrealizedPnL },
      ].slice(-36);
    });
  }, [realizedPnL, unrealizedPnL]);

  const pnlChart = {
    width: 720,
    height: 220,
    paddingX: 58,
    paddingY: 18,
  };
  const pnlValues = pnlHistory.flatMap((point) => [point.realized, point.unrealized]);
  const pnlMagnitude = Math.max(...pnlValues.map(Math.abs), 0);
  const pnlAxisMax = pnlMagnitude > 0 ? pnlMagnitude * 1.15 : 100;
  const pnlAxisMin = -pnlAxisMax;
  const pnlRange = pnlAxisMax - pnlAxisMin;
  const pnlPlotHeight = pnlChart.height - pnlChart.paddingY * 2;
  const pnlPlotWidth = pnlChart.width - pnlChart.paddingX * 2;
  const getPnlY = (value) =>
    pnlChart.paddingY + ((pnlAxisMax - value) / pnlRange) * pnlPlotHeight;
  const getPnlPoints = (key) =>
    pnlHistory
      .map((point, index) => {
        const x =
          pnlChart.paddingX +
          (index / Math.max(pnlHistory.length - 1, 1)) * pnlPlotWidth;
        return `${x},${getPnlY(point[key])}`;
      })
      .join(' ');
  const formatPnlAxisValue = (value) =>
    value.toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: pnlAxisMax < 100 ? 1 : 0,
    });

  const handlePnlPointerMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerRatio = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width)
    );
    const chartRatio = Math.max(
      0,
      Math.min(
        1,
        (pointerRatio * pnlChart.width - pnlChart.paddingX) / pnlPlotWidth
      )
    );
    setHoveredPnlIndex(
      Math.round(chartRatio * Math.max(pnlHistory.length - 1, 0))
    );
  };

  const shareSeries = shareDetails?.series || [];
  const shareChart = { width: 720, height: 190, paddingX: 8, paddingY: 12 };
  const sharePrices = shareSeries.map((point) => point.price);
  const movingAverage = calculateMovingAverage(sharePrices, 20);
  const rsiValues = calculateRsi(sharePrices, 14);
  const shareChartValues = [
    ...sharePrices,
    ...(showMovingAverage ? movingAverage.filter(Number.isFinite) : []),
  ];
  const sharePriceMin = Math.min(...shareChartValues);
  const sharePriceMax = Math.max(...shareChartValues);
  const sharePriceRange = sharePriceMax - sharePriceMin || sharePriceMax * 0.01 || 1;
  const shareChartWidth = shareChart.width - shareChart.paddingX * 2;
  const shareChartHeight = shareChart.height - shareChart.paddingY * 2;
  const shareChartPoints = shareSeries
    .map((point, index) => {
      const x =
        shareChart.paddingX +
        (index / Math.max(shareSeries.length - 1, 1)) * shareChartWidth;
      const y =
        shareChart.paddingY +
        ((sharePriceMax - point.price) / sharePriceRange) * shareChartHeight;
      return `${x},${y}`;
    })
    .join(' ');
  const movingAveragePoints = movingAverage
    .map((value, index) => {
      if (!Number.isFinite(value)) return null;
      const x =
        shareChart.paddingX +
        (index / Math.max(shareSeries.length - 1, 1)) * shareChartWidth;
      const y =
        shareChart.paddingY +
        ((sharePriceMax - value) / sharePriceRange) * shareChartHeight;
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(' ');
  const shareChartArea = shareChartPoints
    ? `${shareChart.paddingX},${shareChart.height - shareChart.paddingY} ${shareChartPoints} ${shareChart.width - shareChart.paddingX},${shareChart.height - shareChart.paddingY}`
    : '';

  const handleShareChartPointerMove = (event) => {
    if (shareSeries.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width)
    );
    setShareChartHoverIndex(
      Math.round(ratio * Math.max(shareSeries.length - 1, 0))
    );
  };

  const handleLogin = (event) => {
    event.preventDefault();
    const signedInUser = loginIdentifier.trim();
    localStorage.setItem('tradeNexusUser', signedInUser);
    setUser(signedInUser);
  };

  const handleStockSearchChange = (value) => {
    const nextValue = value.trimStart();
    setSearch(nextValue);
    setShareSearchResults([]);
    setShareSearchStatus(nextValue.length >= 2 ? 'loading' : 'idle');
    setSelectedShare(null);
    setShareChartHoverIndex(null);
  };

  const confirmOrder = async () => {
    if (!modal || tradeSubmitting) return;
    const { side, stock, qty } = modal;
    const total = stock.price * qty;
    let tradePnl = 0;

    if (side === 'BUY') {
      if (cash < total) {
        setTradeError('Insufficient balance.');
        return;
      }
    }

    if (side === 'SELL') {
      const holding = holdings[stock.symbol];

      if (!holding || holding.qty < qty) {
        setTradeError('Not enough shares available.');
        return;
      }

      const pnl = (stock.price - holding.avgPrice) * qty;
      tradePnl = pnl;
    }

    setTradeSubmitting(true);
    setTradeError(null);
    try {
      const response = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: user,
          stockName: stock.company || stock.symbol,
          type: side,
          quantity: qty,
          price: stock.price,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Could not save this trade.');
      }

      if (side === 'BUY') {
        setCash((value) => value - total);
        setHoldings((previous) => {
          const existing = previous[stock.symbol];
          if (!existing) {
            return {
              ...previous,
              [stock.symbol]: { qty, avgPrice: stock.price },
            };
          }

          const newQty = existing.qty + qty;
          const avgPrice =
            (existing.qty * existing.avgPrice + qty * stock.price) / newQty;
          return {
            ...previous,
            [stock.symbol]: { qty: newQty, avgPrice },
          };
        });
      } else {
        setCash((value) => value + total);
        setHoldings((previous) => {
          const remainingQuantity = previous[stock.symbol].qty - qty;
          if (remainingQuantity === 0) {
            const updatedHoldings = { ...previous };
            delete updatedHoldings[stock.symbol];
            return updatedHoldings;
          }
          return {
            ...previous,
            [stock.symbol]: {
              ...previous[stock.symbol],
              qty: remainingQuantity,
            },
          };
        });
      }

      setMarketPrices((previous) => ({
        ...previous,
        [stock.symbol]: stock.price,
      }));

      const order = {
        id: result.id,
        side: result.transaction_type,
        symbol: result.stock_name,
        qty: result.quantity,
        price: Number(result.price),
        pnl: tradePnl,
        total: Number(result.price) * result.quantity,
        time: new Date(result.trade_date).toLocaleString(),
      };

      setOrders((previous) => [order, ...previous]);
      setSuccess(order);
      setModal(null);
    } catch (error) {
      setTradeError(error.message || 'Could not save this trade.');
    } finally {
      setTradeSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="app-container login-container">
        <section className="login-card">
          <header className="login-brand">
            <span className="login-brand-mark" aria-hidden="true">T</span>
            <div>
              <p className="eyebrow">PAPER TRADING • NSE</p>
              <h1>TradeNexus <span>India</span></h1>
            </div>
          </header>

          <div className="login-intro">
            <h2>Welcome back</h2>
            <p>Sign in to follow the market and manage your portfolio.</p>
          </div>

          <div className="login-methods" role="tablist" aria-label="Choose sign-in method">
            <button
              type="button"
              role="tab"
              aria-selected={loginMethod === 'email'}
              className={`login-method ${loginMethod === 'email' ? 'active' : ''}`}
              onClick={() => {
                setLoginMethod('email');
                setLoginIdentifier('');
              }}
            >
              Email
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={loginMethod === 'mobile'}
              className={`login-method ${loginMethod === 'mobile' ? 'active' : ''}`}
              onClick={() => {
                setLoginMethod('mobile');
                setLoginIdentifier('');
              }}
            >
              Mobile number
            </button>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="login-identifier">
              {loginMethod === 'email' ? 'Email address' : 'Mobile number'}
            </label>
            <input
              id="login-identifier"
              type={loginMethod === 'email' ? 'email' : 'tel'}
              inputMode={loginMethod === 'email' ? 'email' : 'numeric'}
              autoComplete={loginMethod === 'email' ? 'email' : 'tel'}
              pattern={loginMethod === 'mobile' ? '[0-9]{7,15}' : undefined}
              placeholder={loginMethod === 'email' ? 'you@example.com' : '9876543210'}
              value={loginIdentifier}
              onChange={(event) => setLoginIdentifier(event.target.value)}
              required
            />

            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              required
            />

            <button className="login-submit" type="submit">Sign in</button>
          </form>

          <p className="login-demo-note">Demo app: any valid email or mobile number and password will continue.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="dashboard">
        <header className="app-header">
          <div>
            <p className="eyebrow">PAPER TRADING • NSE</p>
            <h1>TradeNexus <span>India</span></h1>
            <p className="header-subtitle">Your market, at a glance</p>
          </div>

          <button
            className="logout-button"
            onClick={() => {
              localStorage.removeItem('tradeNexusUser');
              setUser(null);
            }}
          >
            Logout
          </button>
        </header>

        <section className="metrics-grid" aria-label="Portfolio summary">
          <div className="metric-card metric-cash">
            <span className="metric-label">Available cash</span>
            <div className="metric-value">₹{cash.toFixed(0)}</div>
          </div>

          <div className="metric-card metric-realized">
            <span className="metric-label">Realized P&amp;L</span>
            <div className="metric-value">₹{realizedPnL.toFixed(0)}</div>
          </div>

          <div className="metric-card metric-unrealized">
            <span className="metric-label">Unrealized P&amp;L</span>
            <div className="metric-value">₹{unrealizedPnL.toFixed(0)}</div>
          </div>

          <div className={`metric-card ${totalPnL >= 0 ? 'metric-positive' : 'metric-negative'}`}>
            <span className="metric-label">Total P&amp;L</span>
            <div className="metric-value">₹{totalPnL.toFixed(0)}</div>
          </div>
        </section>

        <section className="pnl-panel" aria-labelledby="pnl-chart-title">
          <div className="pnl-panel-heading">
            <div>
              <p className="eyebrow">PORTFOLIO PERFORMANCE</p>
              <h2 id="pnl-chart-title">Profit &amp; loss</h2>
              <p className="pnl-chart-description">Gross P&amp;L combines realized results from closed trades and unrealized changes in open shares.</p>
            </div>
            <span className="pnl-chart-note">SIMULATED</span>
          </div>

          <div className="pnl-chart-toolbar">
            <div className="pnl-chart-legend" aria-label="Toggle chart lines">
              <button
                type="button"
                className={`pnl-legend-button realized-legend ${showRealized ? 'selected' : ''}`}
                aria-pressed={showRealized}
                onClick={() => {
                  if (!showRealized || showUnrealized) setShowRealized(!showRealized);
                }}
              >
                <span className="legend-swatch" aria-hidden="true" />
                Realized P&amp;L
              </button>
              <button
                type="button"
                className={`pnl-legend-button unrealized-legend ${showUnrealized ? 'selected' : ''}`}
                aria-pressed={showUnrealized}
                onClick={() => {
                  if (!showUnrealized || showRealized) setShowUnrealized(!showUnrealized);
                }}
              >
                <span className="legend-swatch" aria-hidden="true" />
                Unrealized P&amp;L
              </button>
            </div>
            <div className="pnl-hover-summary" aria-live="polite">
              <span>{hoveredPnlIndex === null ? 'Current' : 'Point'} values</span>
              {hoveredPnlIndex !== null && pnlHistory[hoveredPnlIndex] && (
                <time>{new Date(pnlHistory[hoveredPnlIndex].time).toLocaleTimeString()}</time>
              )}
              <strong>Realized ₹{(pnlHistory[hoveredPnlIndex ?? pnlHistory.length - 1]?.realized ?? realizedPnL).toFixed(0)}</strong>
              <strong>Unrealized ₹{(pnlHistory[hoveredPnlIndex ?? pnlHistory.length - 1]?.unrealized ?? unrealizedPnL).toFixed(0)}</strong>
            </div>
          </div>

          <div
            className="pnl-chart-wrap"
            onPointerMove={handlePnlPointerMove}
            onPointerLeave={() => setHoveredPnlIndex(null)}
          >
            <svg
              className="pnl-chart-svg"
              viewBox={`0 0 ${pnlChart.width} ${pnlChart.height}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Interactive chart comparing realized and unrealized simulated profit and loss over recent updates"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = pnlChart.paddingY + ratio * pnlPlotHeight;
                const value = pnlAxisMax - ratio * pnlRange;
                return (
                  <g key={ratio}>
                    <line
                      className={Math.abs(value) < pnlAxisMax * 0.001 ? 'pnl-zero-gridline' : 'pnl-gridline'}
                      x1={pnlChart.paddingX}
                      x2={pnlChart.width - pnlChart.paddingX}
                      y1={y}
                      y2={y}
                    />
                    <text className="pnl-axis-label" x={pnlChart.paddingX - 8} y={y + 4} textAnchor="end">
                      {formatPnlAxisValue(value)}
                    </text>
                  </g>
                );
              })}
              {hoveredPnlIndex !== null && (
                <line
                  className="pnl-hover-line"
                  x1={pnlChart.paddingX + (hoveredPnlIndex / Math.max(pnlHistory.length - 1, 1)) * pnlPlotWidth}
                  x2={pnlChart.paddingX + (hoveredPnlIndex / Math.max(pnlHistory.length - 1, 1)) * pnlPlotWidth}
                  y1={pnlChart.paddingY}
                  y2={pnlChart.height - pnlChart.paddingY}
                />
              )}
              {showRealized && (
                <polyline className="pnl-line realized-line" points={getPnlPoints('realized')} />
              )}
              {showUnrealized && (
                <polyline className="pnl-line unrealized-line" points={getPnlPoints('unrealized')} />
              )}
              {showRealized && (
                <circle
                  className="pnl-point realized-point"
                  cx={pnlChart.width - pnlChart.paddingX}
                  cy={getPnlY(realizedPnL)}
                  r="5.5"
                />
              )}
              {showUnrealized && (
                <circle
                  className="pnl-point unrealized-point"
                  cx={pnlChart.width - pnlChart.paddingX}
                  cy={getPnlY(unrealizedPnL)}
                  r="3.2"
                />
              )}
              {hoveredPnlIndex !== null && showRealized && (
                <circle
                  className="pnl-point realized-point"
                  cx={pnlChart.paddingX + (hoveredPnlIndex / Math.max(pnlHistory.length - 1, 1)) * pnlPlotWidth}
                  cy={getPnlY(pnlHistory[hoveredPnlIndex].realized)}
                  r="5"
                />
              )}
              {hoveredPnlIndex !== null && showUnrealized && (
                <circle
                  className="pnl-point unrealized-point"
                  cx={pnlChart.paddingX + (hoveredPnlIndex / Math.max(pnlHistory.length - 1, 1)) * pnlPlotWidth}
                  cy={getPnlY(pnlHistory[hoveredPnlIndex].unrealized)}
                  r="5"
                />
              )}
            </svg>
            <div className="pnl-time-labels">
              <span>Earlier updates</span>
              <span>Latest</span>
            </div>
          </div>
          <p className="pnl-chart-footnote">The chart starts at ₹0 and updates as your trades and positions change. Hover to inspect values; positive values are gains and negative values are losses.</p>
        </section>

        <label className="search-panel">
          <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            className="search-input"
            type="search"
            aria-label="Search stocks"
            placeholder="Search any NSE/BSE share..."
            value={search}
            onChange={(event) => handleStockSearchChange(event.target.value)}
          />
          <span className="search-hint">NSE / BSE</span>
        </label>

        {normalizedSearch.length > 0 && normalizedSearch.length < 2 && (
          <p className="lookup-message search-status-message">Enter at least 2 characters to search.</p>
        )}
        {normalizedSearch.length >= 2 && (
          <section className="market-search-results" aria-label="NSE and BSE search results">
            <div className="market-search-results-heading">
              <strong>NSE/BSE market matches</strong>
              {shareSearchStatus === 'loading' && <span>Searching…</span>}
            </div>
            {shareSearchStatus === 'empty' && (
              <p className="lookup-message">No NSE/BSE listings found for “{normalizedSearch}”.</p>
            )}
            {shareSearchStatus === 'error' && (
              <p className="lookup-message lookup-error">Could not load NSE/BSE results. Please try again.</p>
            )}
            {shareSearchResults.length > 0 && (
              <div className="lookup-results">
                {shareSearchResults.map((result) => (
                  <button
                    type="button"
                    key={result.symbol}
                    className={`lookup-result ${selectedShare?.symbol === result.symbol ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedShare(result);
                      setShareChartRange('1d');
                      setShareChartHoverIndex(null);
                    }}
                  >
                    <span>
                      <strong>{result.symbol.replace(/\.(NS|BO)$/i, '')}</strong>
                      <small>{result.longname || result.shortname || result.symbol}</small>
                    </span>
                    <span className="lookup-result-exchange">{result.exchDisp || 'India'}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {selectedShare && (
        <section className="share-lookup-panel" aria-labelledby="share-lookup-title">
          <div className="share-lookup-heading">
            <div>
              <p className="eyebrow">SELECTED MARKET SHARE</p>
              <h2 id="share-lookup-title">Company details &amp; chart</h2>
              <p>Quote information, technical indicators and historical performance for the selected NSE/BSE listing.</p>
            </div>
            <span className="lookup-source-badge">Yahoo Finance data</span>
          </div>

          {selectedShare && (
            <div className="share-details-card">
              <div className="share-details-header">
                <div>
                  <span className="share-details-symbol">{selectedShare.symbol.replace(/\.(NS|BO)$/i, '')}</span>
                  <h3>{shareDetails?.meta.longName || selectedShare.longname || selectedShare.shortname}</h3>
                  <p>{shareDetails?.meta.fullExchangeName || selectedShare.exchDisp} · {selectedShare.quoteType || 'Equity'}</p>
                </div>
                <button
                  type="button"
                  className="lookup-close-button"
                  aria-label="Close share details"
                  onClick={() => {
                    setSelectedShare(null);
                    setShareChartHoverIndex(null);
                  }}
                >
                  ×
                </button>
              </div>

              {shareDetailsStatus === 'loading' && <p className="lookup-message">Loading quote and trading details…</p>}
              {shareDetailsStatus === 'error' && (
                <p className="lookup-message lookup-error">Could not load quote details for this share. Please try again later.</p>
              )}
              {shareDetailsStatus === 'ready' && shareDetails && (() => {
                const { meta } = shareDetails;
                const hoveredPoint = shareSeries[shareChartHoverIndex ?? shareSeries.length - 1];
                const quotePrice = Number.isFinite(meta.regularMarketPrice)
                  ? meta.regularMarketPrice
                  : shareSeries[shareSeries.length - 1]?.price;
                const priceChange = meta.fulldayChange ?? (quotePrice - meta.previousClose);
                const changePercent = meta.regularMarketChangePercent ?? meta.fulldayChangePercent;
                const positiveChange = priceChange >= 0;
                const currency = meta.currency || 'INR';
                const formatCurrency = (value) =>
                  Number.isFinite(value)
                    ? value.toLocaleString('en-IN', {
                        style: 'currency',
                        currency,
                        maximumFractionDigits: 2,
                      })
                    : '—';
                const formatNumber = (value) =>
                  Number.isFinite(value) ? value.toLocaleString('en-IN') : '—';
                const lineX = shareChart.paddingX +
                  ((shareChartHoverIndex ?? shareSeries.length - 1) / Math.max(shareSeries.length - 1, 1)) * shareChartWidth;
                const lineY = hoveredPoint
                  ? shareChart.paddingY + ((sharePriceMax - hoveredPoint.price) / sharePriceRange) * shareChartHeight
                  : 0;
                const hoveredRsi = rsiValues[shareChartHoverIndex ?? shareSeries.length - 1];
                const latestRsi = rsiValues[rsiValues.length - 1];
                const rsiChart = { width: 720, height: 120, paddingX: 8, paddingY: 10 };
                const rsiChartHeight = rsiChart.height - rsiChart.paddingY * 2;
                const rsiPoints = rsiValues
                  .map((value, index) => {
                    if (!Number.isFinite(value)) return null;
                    const x =
                      rsiChart.paddingX +
                      (index / Math.max(shareSeries.length - 1, 1)) *
                        (rsiChart.width - rsiChart.paddingX * 2);
                    const y =
                      rsiChart.paddingY + ((100 - value) / 100) * rsiChartHeight;
                    return `${x},${y}`;
                  })
                  .filter(Boolean)
                  .join(' ');
                const rsiY = (value) =>
                  rsiChart.paddingY + ((100 - value) / 100) * rsiChartHeight;

                return (
                  <>
                    <div className="share-quote-main">
                      <div>
                        <strong>{formatCurrency(quotePrice)}</strong>
                        <span className={`share-change ${positiveChange ? 'positive' : 'negative'}`}>
                          {positiveChange ? '▲' : '▼'} {formatCurrency(Math.abs(priceChange))} ({Number.isFinite(changePercent) ? `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%` : '—'})
                        </span>
                      </div>
                      <span className="share-quote-time">
                        Quote time: {meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toLocaleString() : 'Not provided'}
                      </span>
                    </div>

                    <div className="share-data-grid">
                      <div><span>Previous close</span><strong>{formatCurrency(meta.previousClose)}</strong></div>
                      <div><span>Day range</span><strong>{formatCurrency(meta.regularMarketDayLow)} – {formatCurrency(meta.regularMarketDayHigh)}</strong></div>
                      <div><span>52-week range</span><strong>{formatCurrency(meta.fiftyTwoWeekLow)} – {formatCurrency(meta.fiftyTwoWeekHigh)}</strong></div>
                      <div><span>Volume</span><strong>{formatNumber(meta.regularMarketVolume)}</strong></div>
                      <div>
                        <span>Market capitalization{marketCap?.date ? ` · ${marketCap.date}` : ''}</span>
                        <strong>
                          {marketCap
                            ? `${marketCap.currency === 'INR' ? '₹' : ''}${marketCap.formatted}`
                            : marketCapStatus === 'loading'
                              ? 'Loading…'
                              : 'Not available'}
                        </strong>
                      </div>
                      <div><span>Sector</span><strong>{selectedShare.sectorDisp || selectedShare.sector || '—'}</strong></div>
                      <div><span>Industry</span><strong>{selectedShare.industryDisp || selectedShare.industry || '—'}</strong></div>
                    </div>

                    <div className="share-chart-heading">
                      <h4>Price history</h4>
                      <div className="share-range-buttons" aria-label="Price history range">
                        {[
                          ['1d', '1D'],
                          ['5d', '5D'],
                          ['1mo', '1M'],
                          ['1y', '1Y'],
                        ].map(([range, label]) => (
                          <button
                            type="button"
                            key={range}
                            className={shareChartRange === range ? 'active' : ''}
                            aria-pressed={shareChartRange === range}
                            onClick={() => {
                              setShareChartRange(range);
                              setShareChartHoverIndex(null);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="share-indicator-controls" aria-label="Technical indicators">
                      <span>Indicators</span>
                      <button
                        type="button"
                        className={`indicator-toggle moving-average-toggle ${showMovingAverage ? 'active' : ''}`}
                        aria-pressed={showMovingAverage}
                        onClick={() => setShowMovingAverage((visible) => !visible)}
                      >
                        <span className="indicator-swatch sma-swatch" aria-hidden="true" />
                        SMA 20
                      </button>
                      <button
                        type="button"
                        className={`indicator-toggle rsi-toggle ${showRsi ? 'active' : ''}`}
                        aria-pressed={showRsi}
                        onClick={() => setShowRsi((visible) => !visible)}
                      >
                        <span className="indicator-swatch rsi-swatch" aria-hidden="true" />
                        RSI 14
                      </button>
                    </div>
                    <div
                      className="share-history-chart"
                      onPointerMove={handleShareChartPointerMove}
                      onPointerLeave={() => setShareChartHoverIndex(null)}
                    >
                      {shareSeries.length > 1 ? (
                        <svg
                          viewBox={`0 0 ${shareChart.width} ${shareChart.height}`}
                          preserveAspectRatio="none"
                          role="img"
                          aria-label={`${selectedShare.symbol} share price history`}
                        >
                          <line
                            className="share-chart-gridline"
                            x1="0"
                            x2={shareChart.width}
                            y1={shareChart.height / 2}
                            y2={shareChart.height / 2}
                          />
                          <polygon className="share-history-area" points={shareChartArea} />
                          <polyline className="share-history-line" points={shareChartPoints} />
                          {showMovingAverage && movingAverage.filter(Number.isFinite).length > 1 && (
                            <polyline className="share-moving-average-line" points={movingAveragePoints} />
                          )}
                          {shareChartHoverIndex !== null && hoveredPoint && (
                            <>
                              <line className="share-chart-crosshair" x1={lineX} x2={lineX} y1="0" y2={shareChart.height} />
                              <circle className="share-chart-dot" cx={lineX} cy={lineY} r="5" />
                            </>
                          )}
                        </svg>
                      ) : (
                        <p className="lookup-message">Price history is not available for this period.</p>
                      )}
                      {hoveredPoint && (
                        <div className="share-history-tooltip" aria-live="polite">
                          <strong>{formatCurrency(hoveredPoint.price)}</strong>
                          <span>{new Date(hoveredPoint.time * 1000).toLocaleString()}</span>
                          {showMovingAverage && Number.isFinite(movingAverage[shareChartHoverIndex ?? shareSeries.length - 1]) && (
                            <span className="tooltip-sma">SMA 20: {formatCurrency(movingAverage[shareChartHoverIndex ?? shareSeries.length - 1])}</span>
                          )}
                          {showRsi && Number.isFinite(hoveredRsi) && (
                            <span className="tooltip-rsi">RSI 14: {hoveredRsi.toFixed(1)}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {showMovingAverage && movingAverage.filter(Number.isFinite).length < 2 && (
                      <p className="indicator-message">SMA 20 needs at least 20 price points. Select a longer chart range.</p>
                    )}
                    {showRsi && (
                      <div className="rsi-indicator-panel">
                        <div className="rsi-indicator-heading">
                          <div>
                            <h4>Relative Strength Index (14)</h4>
                            <span>Momentum indicator · scale 0–100</span>
                          </div>
                          {Number.isFinite(latestRsi) && (
                            <div className={`rsi-reading ${latestRsi >= 70 ? 'overbought' : latestRsi <= 30 ? 'oversold' : 'neutral'}`}>
                              <strong>{latestRsi.toFixed(1)}</strong>
                              <span>{latestRsi >= 70 ? 'Potentially overbought' : latestRsi <= 30 ? 'Potentially oversold' : 'Neutral range'}</span>
                            </div>
                          )}
                        </div>
                        {Number.isFinite(latestRsi) ? (
                          <svg
                            className="rsi-chart"
                            viewBox={`0 0 ${rsiChart.width} ${rsiChart.height}`}
                            preserveAspectRatio="none"
                            role="img"
                            aria-label={`RSI 14 chart, latest value ${latestRsi.toFixed(1)}`}
                          >
                            <line className="rsi-threshold-line" x1={rsiChart.paddingX} x2={rsiChart.width - rsiChart.paddingX} y1={rsiY(70)} y2={rsiY(70)} />
                            <line className="rsi-midline" x1={rsiChart.paddingX} x2={rsiChart.width - rsiChart.paddingX} y1={rsiY(50)} y2={rsiY(50)} />
                            <line className="rsi-threshold-line" x1={rsiChart.paddingX} x2={rsiChart.width - rsiChart.paddingX} y1={rsiY(30)} y2={rsiY(30)} />
                            <text className="rsi-axis-label" x={rsiChart.width - rsiChart.paddingX} y={rsiY(70) - 3} textAnchor="end">70</text>
                            <text className="rsi-axis-label" x={rsiChart.width - rsiChart.paddingX} y={rsiY(30) - 3} textAnchor="end">30</text>
                            <polyline className="rsi-line" points={rsiPoints} />
                            {Number.isFinite(hoveredRsi) && shareChartHoverIndex !== null && (
                              <circle
                                className="rsi-point"
                                cx={rsiChart.paddingX + (shareChartHoverIndex / Math.max(shareSeries.length - 1, 1)) * (rsiChart.width - rsiChart.paddingX * 2)}
                                cy={rsiY(hoveredRsi)}
                                r="4"
                              />
                            )}
                          </svg>
                        ) : (
                          <p className="indicator-message">RSI 14 needs at least 15 price points. Select a longer chart range.</p>
                        )}
                        <p className="rsi-disclaimer">RSI is a historical momentum measure, not a guarantee or a buy/sell recommendation.</p>
                      </div>
                    )}

                    {hoveredPoint && (
                      <div className="share-candle-details">
                        <span>Open <strong>{formatCurrency(hoveredPoint.open)}</strong></span>
                        <span>High <strong>{formatCurrency(hoveredPoint.high)}</strong></span>
                        <span>Low <strong>{formatCurrency(hoveredPoint.low)}</strong></span>
                        <span>Volume <strong>{formatNumber(hoveredPoint.volume)}</strong></span>
                      </div>
                    )}
                    <p className="share-data-disclaimer">Market information provided by Yahoo Finance; values may be delayed. Shown for information only, not as investment advice.</p>
                  </>
                );
              })()}
            </div>
          )}
        </section>
        )}

        <main className="content-grid">
          <section className="market-section" aria-label="Stocks">
            <div className="section-heading">
              <div>
                <p className="eyebrow">LIVE WATCHLIST + MARKET SEARCH</p>
                <h2>Explore stocks</h2>
              </div>
              <span className="stock-count">
                {filteredStocks.length + (selectedShare && shareDetailsStatus === 'ready' ? 1 : 0)} symbols
              </span>
            </div>
            {selectedShare && shareDetailsStatus === 'ready' && shareDetails && (() => {
              const { meta } = shareDetails;
              const quotePrice = Number.isFinite(meta.regularMarketPrice)
                ? meta.regularMarketPrice
                : shareSeries[shareSeries.length - 1]?.price;
              const qty = quantities[selectedShare.symbol] ?? 1;
              const holdingQuantity = holdings[selectedShare.symbol]?.qty ?? 0;
              const company = meta.longName || selectedShare.longname || selectedShare.shortname;
              const stock = { symbol: selectedShare.symbol, company, price: quotePrice };
              const currency = meta.currency || 'INR';
              const priceChange = meta.regularMarketChange ?? meta.fulldayChange;
              const changePercent = meta.regularMarketChangePercent ?? meta.fulldayChangePercent;
              const formatMarketValue = (value) =>
                Number.isFinite(value)
                  ? value.toLocaleString('en-IN', {
                      style: 'currency',
                      currency,
                      maximumFractionDigits: 2,
                    })
                  : '—';

              return (
                <article className="stock-card market-search-stock-card">
                  <div className="stock-card-heading">
                    <div>
                      <div className="stock-symbol">{selectedShare.symbol.replace(/\.(NS|BO)$/i, '')}</div>
                      <div className="stock-company">{company}</div>
                      <div className="market-search-exchange">
                        {meta.fullExchangeName || selectedShare.exchDisp || 'NSE/BSE'} · Live market lookup
                      </div>
                    </div>
                    <div>
                      <div className="stock-price">{formatMarketValue(quotePrice)}</div>
                      <div className={`share-change market-stock-change ${Number.isFinite(priceChange) ? (priceChange >= 0 ? 'positive' : 'negative') : ''}`}>
                        {Number.isFinite(priceChange) ? `${priceChange >= 0 ? '+' : '−'}${formatMarketValue(Math.abs(priceChange))}` : '—'}
                        {Number.isFinite(changePercent) ? ` (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="share-data-grid market-search-facts">
                    <div><span>Previous close</span><strong>{formatMarketValue(meta.previousClose)}</strong></div>
                    <div><span>Day range</span><strong>{formatMarketValue(meta.regularMarketDayLow)} – {formatMarketValue(meta.regularMarketDayHigh)}</strong></div>
                    <div><span>52-week range</span><strong>{formatMarketValue(meta.fiftyTwoWeekLow)} – {formatMarketValue(meta.fiftyTwoWeekHigh)}</strong></div>
                    <div><span>Volume</span><strong>{Number.isFinite(meta.regularMarketVolume) ? meta.regularMarketVolume.toLocaleString('en-IN') : '—'}</strong></div>
                    <div>
                      <span>Market capitalization</span>
                      <strong>
                        {marketCap
                          ? `${marketCap.currency === 'INR' ? '₹' : ''}${marketCap.formatted}`
                          : marketCapStatus === 'loading' ? 'Loading…' : 'Not available'}
                      </strong>
                    </div>
                    <div><span>Sector / Industry</span><strong>{selectedShare.sectorDisp || selectedShare.sector || '—'} / {selectedShare.industryDisp || selectedShare.industry || '—'}</strong></div>
                  </div>

                  <div className="quantity-area">
                    <div className="quantity-control">
                      <button
                        type="button"
                        aria-label={`Decrease ${selectedShare.symbol} quantity`}
                        className="quantity-button quantity-decrease"
                        onClick={() => setQuantities((previous) => ({
                          ...previous,
                          [selectedShare.symbol]: Math.max(1, qty - 1),
                        }))}
                      >
                        −
                      </button>
                      <div className="quantity-box">
                        <span className="quantity-value">{qty}</span>
                        <span className="quantity-unit">shares</span>
                      </div>
                      <button
                        type="button"
                        aria-label={`Increase ${selectedShare.symbol} quantity`}
                        className="quantity-button quantity-increase"
                        onClick={() => setQuantities((previous) => ({
                          ...previous,
                          [selectedShare.symbol]: qty + 1,
                        }))}
                      >
                        +
                      </button>
                    </div>
                    <div className="estimated-total">
                      Estimated total
                      <strong>{formatMarketValue(quotePrice * qty)}</strong>
                    </div>
                    <div className="trade-actions">
                      <button
                        type="button"
                        className="trade-button buy-button"
                        disabled={!Number.isFinite(quotePrice) || quotePrice <= 0}
                        onClick={() => {
                          setTradeError(null);
                          setModal({ side: 'BUY', stock, qty });
                        }}
                      >
                        ↗ Buy
                      </button>
                      <button
                        type="button"
                        className="trade-button sell-button"
                        disabled={!Number.isFinite(quotePrice) || quotePrice <= 0 || holdingQuantity < qty}
                        onClick={() => {
                          setTradeError(null);
                          setModal({ side: 'SELL', stock, qty });
                        }}
                      >
                        ↘ Sell
                      </button>
                    </div>
                  </div>
                  <p className="market-stock-quote-time">
                    Quote time: {meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toLocaleString() : 'Not provided'}
                  </p>
                  <p className="share-data-disclaimer">Market quote may be delayed. This search card uses market data; watchlist prices remain simulated.</p>
                </article>
              );
            })()}
            {selectedShare && shareDetailsStatus === 'loading' && (
              <p className="lookup-message">Loading market details for {selectedShare.symbol}…</p>
            )}
            {filteredStocks.map((stock) => {
              const qty = quantities[stock.symbol] ?? 1;
              const history = priceHistory[stock.symbol] || [stock.price];
              const firstPrice = history[0];
              const lastPrice = history[history.length - 1];
              const trendPercent = firstPrice ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
              const trendUp = trendPercent >= 0;
              const chartWidth = 320;
              const chartHeight = 64;
              const historyMin = Math.min(...history);
              const historyMax = Math.max(...history);
              const historyRange = historyMax - historyMin || historyMax * 0.01 || 1;
              const chartPoints = history.map((price, index) => {
                const x = (index / Math.max(history.length - 1, 1)) * chartWidth;
                const y = chartHeight - ((price - historyMin) / historyRange) * (chartHeight - 10) - 5;
                return `${x},${y}`;
              });
              const chartLine = chartPoints.join(' ');
              const chartArea = `0,${chartHeight} ${chartLine} ${chartWidth},${chartHeight}`;

              return (
                <article key={stock.symbol} className="stock-card">
                  <div className="stock-card-heading">
                    <div>
                      <div className="stock-symbol">{stock.symbol}</div>
                      <div className="stock-company">{stock.company}</div>
                    </div>

                    <div className="stock-price">₹{stock.price.toFixed(2)}</div>
                  </div>

                  <div className={`price-chart ${trendUp ? 'trend-up' : 'trend-down'}`}>
                    <div className="chart-caption">
                      <span>Recent simulated trend</span>
                      <strong>
                        <span aria-hidden="true">{trendUp ? '↗' : '↘'}</span>
                        {trendUp ? '+' : ''}{trendPercent.toFixed(2)}%
                      </strong>
                    </div>
                    <svg
                      className="trend-chart"
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      preserveAspectRatio="none"
                      role="img"
                      aria-label={`${stock.symbol} simulated price chart, ${trendUp ? 'up' : 'down'} ${Math.abs(trendPercent).toFixed(2)} percent`}
                    >
                      <polygon className="chart-area" points={chartArea} />
                      <polyline className="chart-line" points={chartLine} />
                    </svg>
                    <div className="chart-axis">
                      <span>Earlier</span>
                      <span>Now</span>
                    </div>
                  </div>

                  <div className="quantity-area">
                    <div className="quantity-control">
                      <button
                        type="button"
                        aria-label={`Decrease ${stock.symbol} quantity`}
                        onClick={() =>
                          setQuantities({
                            ...quantities,
                            [stock.symbol]: Math.max(1, qty - 1),
                          })
                        }
                        className="quantity-button quantity-decrease"
                      >
                        −
                      </button>

                      <div className="quantity-box">
                        <span className="quantity-value">{qty}</span>
                        <span className="quantity-unit">shares</span>
                      </div>

                      <button
                        type="button"
                        aria-label={`Increase ${stock.symbol} quantity`}
                        onClick={() =>
                          setQuantities({
                            ...quantities,
                            [stock.symbol]: qty + 1,
                          })
                        }
                        className="quantity-button quantity-increase"
                      >
                        +
                      </button>
                    </div>

                    <div className="minimum-note">Minimum order: 1 share</div>
                    <div className="estimated-total">Estimated total <strong>₹{(stock.price * qty).toFixed(2)}</strong></div>
                  </div>

                  <div className="trade-actions">
                    <button
                      className="trade-button buy-button"
                      onClick={() => {
                        setTradeError(null);
                        setModal({ side: 'BUY', stock, qty });
                      }}
                    >
                      <span aria-hidden="true">↗</span>
                      Buy
                    </button>

                    <button
                      className="trade-button sell-button"
                      onClick={() => {
                        setTradeError(null);
                        setModal({ side: 'SELL', stock, qty });
                      }}
                    >
                      <span aria-hidden="true">↘</span>
                      Sell
                    </button>
                  </div>
                </article>
              );
            })}
            {filteredStocks.length === 0 && normalizedSearch.length === 1 && (
              <div className="empty-state">No watchlist shares match “{normalizedSearch}”. Enter at least 2 characters to search the full NSE/BSE market.</div>
            )}
          </section>

          <aside className="portfolio-section">
            <section className="side-panel">
              <div className="section-heading compact-heading">
                <div>
                  <p className="eyebrow">YOUR POSITIONS</p>
                  <h2>Holdings</h2>
                </div>
                <span className="panel-icon holdings-icon" aria-hidden="true">▦</span>
              </div>

              {Object.entries(holdings).map(([symbol, h]) => (
                <div key={symbol} className="holding-row">
                  <span className="holding-symbol">{symbol}</span>
                  <span className="holding-quantity">{h.qty} shares</span>
                </div>
              ))}
              {Object.keys(holdings).length === 0 && <p className="empty-panel">Your holdings will appear here.</p>}
            </section>

            <section className="side-panel">
              <div className="section-heading compact-heading">
                <div>
                  <p className="eyebrow">RECENT ACTIVITY</p>
                  <h2>Orders</h2>
                </div>
                <span className="panel-icon orders-icon" aria-hidden="true">↗</span>
              </div>

              {ordersError && <p className="order-error" role="alert">{ordersError}</p>}
              {orders.map((o) => (
                <div key={o.id} className="order-row">
                  <span className={`order-side ${o.side === 'BUY' ? 'order-buy' : 'order-sell'}`}>{o.side}</span>
                  <span className="order-details">{o.symbol} · {o.qty} shares</span>
                  <span className="order-total">₹{o.total.toFixed(0)}</span>
                </div>
              ))}
              {orders.length === 0 && <p className="empty-panel">Your confirmed orders will appear here.</p>}
            </section>
          </aside>
        </main>

        {modal && (
          <div className="order-dialog-backdrop">
            <div className="order-dialog" role="dialog" aria-modal="true" aria-labelledby="order-dialog-title">
              <p className="eyebrow">REVIEW TRADE</p>
              <h2 id="order-dialog-title">Confirm {modal.side === 'BUY' ? 'Buy' : 'Sell'} Order</h2>

              <div className="order-summary">
                <div><span>Side</span><strong className={modal.side === 'BUY' ? 'summary-buy' : 'summary-sell'}>{modal.side}</strong></div>
                <div><span>Stock</span><strong>{modal.stock.symbol}</strong></div>
                <div><span>Quantity</span><strong>{modal.qty} shares</strong></div>
                <div className="summary-total"><span>Estimated total</span><strong>₹{(modal.stock.price * modal.qty).toFixed(2)}</strong></div>
              </div>

              {tradeError && <p className="order-error" role="alert">{tradeError}</p>}

              <div className="dialog-actions">
                <button className="dialog-button cancel-order-button" onClick={() => setModal(null)} disabled={tradeSubmitting}>
                  Cancel
                </button>

                <button className="dialog-button confirm-order-button" onClick={confirmOrder} disabled={tradeSubmitting}>
                  {tradeSubmitting ? 'Saving…' : `Confirm ${modal.side === 'BUY' ? 'Buy' : 'Sell'}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="order-dialog-backdrop">
            <div className="success-dialog" role="dialog" aria-modal="true" aria-labelledby="success-dialog-title">
              <div className="success-check" aria-hidden="true">✓</div>

              <p className="eyebrow success-eyebrow">TRADE COMPLETE</p>
              <h2 id="success-dialog-title">Order Successful</h2>

              <p className="success-details">{success.side} {success.symbol} <span>·</span> {success.qty} shares</p>
              <p className="success-total">₹{success.total.toFixed(2)}</p>

              <button className="success-done-button" onClick={() => setSuccess(null)}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
