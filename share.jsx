import React, { useEffect, useState } from "react";

export default function TradeNexusIndia() {
  const initialStocks = [
    {
      symbol: "RELIANCE",
      company: "Reliance Industries Ltd",
      price: 3125.5,
    },
    {
      symbol: "TCS",
      company: "Tata Consultancy Services",
      price: 4578.2,
    },
    {
      symbol: "INFY",
      company: "Infosys Ltd",
      price: 1936.8,
    },
    {
      symbol: "HDFCBANK",
      company: "HDFC Bank Ltd",
      price: 1812.4,
    },
    {
      symbol: "ICICIBANK",
      company: "ICICI Bank Ltd",
      price: 1425.3,
    },
    {
      symbol: "SBIN",
      company: "State Bank of India",
      price: 925.75,
    },
  ];

  const [loggedIn, setLoggedIn] = useState(true);
  const [stocks, setStocks] = useState(initialStocks);
  const [search, setSearch] = useState("");
  const [cash, setCash] = useState(500000);
  const [holdings, setHoldings] = useState({});
  const [orders, setOrders] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [modal, setModal] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setStocks((prev) =>
        prev.map((s) => ({
          ...s,
          price: Number(
            (
              s.price +
              (Math.random() - 0.5) * s.price * 0.003
            ).toFixed(2)
          ),
        }))
      );
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  const filteredStocks = stocks.filter(
    (s) =>
      s.symbol.toLowerCase().includes(search.toLowerCase()) ||
      s.company.toLowerCase().includes(search.toLowerCase())
  );

  const unrealizedPnL = Object.entries(holdings).reduce(
    (total, [symbol, h]) => {
      const stock = stocks.find((s) => s.symbol === symbol);
      if (!stock) return total;

      return (
        total +
        (stock.price - h.avgPrice) *
          h.qty
      );
    },
    0
  );

  const realizedPnL = orders.reduce(
    (sum, o) => sum + (o.pnl || 0),
    0
  );

  const totalPnL =
    realizedPnL + unrealizedPnL;

  const confirmOrder = () => {
    const { side, stock, qty } = modal;

    const total =
      stock.price * qty;

    if (side === "BUY") {
      if (cash < total) {
        alert("Insufficient balance");
        return;
      }

      setCash((v) => v - total);

      setHoldings((prev) => {
        const existing =
          prev[stock.symbol];

        if (!existing) {
          return {
            ...prev,
            [stock.symbol]: {
              qty,
              avgPrice: stock.price,
            },
          };
        }

        const newQty =
          existing.qty + qty;

        const avg =
          (
            existing.qty *
              existing.avgPrice +
            qty * stock.price
          ) /
          newQty;

        return {
          ...prev,
          [stock.symbol]: {
            qty: newQty,
            avgPrice: avg,
          },
        };
      });
    }

    if (side === "SELL") {
      const holding =
        holdings[stock.symbol];

      if (
        !holding ||
        holding.qty < qty
      ) {
        alert(
          "Not enough shares available"
        );
        return;
      }

      const pnl =
        (stock.price -
          holding.avgPrice) *
        qty;

      setCash((v) => v + total);

      setHoldings((prev) => ({
        ...prev,
        [stock.symbol]: {
          qty:
            holding.qty - qty,
          avgPrice:
            holding.avgPrice,
        },
      }));

      modal.pnl = pnl;
    }

    const order = {
      id: Date.now(),
      side,
      symbol: stock.symbol,
      qty,
      price: stock.price,
      pnl: modal.pnl || 0,
      total,
      time:
        new Date().toLocaleString(),
    };

    setOrders((p) => [
      order,
      ...p,
    ]);

    setSuccess(order);
    setModal(null);
  };

  if (!loggedIn) {
    return (
      <main className="relative min-h-screen overflow-hidden flex items-center justify-center bg-slate-950 px-4 py-12 text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-900/50 via-slate-950 to-slate-950"
        />
        <div
          aria-hidden="true"
          className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-blue-600/25 blur-3xl"
        />

        <section className="relative w-full max-w-md rounded-3xl border border-white/15 bg-white/[0.08] p-8 shadow-2xl shadow-blue-950/40 backdrop-blur-xl sm:p-10">
          <div className="mb-8">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-xl font-bold text-cyan-200">
              T
            </div>
            <p className="mb-2 text-sm font-medium tracking-[0.2em] text-cyan-200/80">
              TRADENEXUS INDIA
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome back
            </h1>
            <p className="mt-3 leading-relaxed text-slate-300">
              Sign in to pick up where you left off and keep your portfolio in view.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
            <p className="text-sm text-slate-300">
              Ready to explore the markets?
            </p>
            <button
              onClick={() =>
                setLoggedIn(true)
              }
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-8 py-3.5 font-semibold text-white shadow-[0_0_24px_rgba(59,130,246,0.35)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_34px_rgba(34,211,238,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
            >
              Sign in
            </button>
            <p className="mt-4 text-center text-xs text-slate-400">
              Demo access · No account required
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-blue-900 text-white rounded-3xl p-5 mb-4 flex justify-between">
          <h1 className="text-2xl font-bold">
            TradeNexus India
          </h1>

          <button
            onClick={() =>
              setLoggedIn(false)
            }
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-xl p-4 shadow">
            Cash
            <div className="font-bold">
              ₹{cash.toFixed(0)}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow text-green-600">
            Realized
            <div className="font-bold">
              ₹
              {realizedPnL.toFixed(
                0
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow text-blue-600">
            Unrealized
            <div className="font-bold">
              ₹
              {unrealizedPnL.toFixed(
                0
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow">
            Total P&L
            <div className="font-bold">
              ₹{totalPnL.toFixed(0)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4 shadow">
          <input
            className="w-full border rounded-xl p-3"
            placeholder="Search stocks..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            {filteredStocks.map(
              (stock) => {
                const qty =
                  quantities[
                    stock.symbol
                  ] || 30;

                return (
                  <div
                    key={
                      stock.symbol
                    }
                    className="bg-white rounded-2xl p-4 mb-4 shadow"
                  >
                    <div className="flex justify-between">
                      <div>
                        <div className="font-bold">
                          {
                            stock.symbol
                          }
                        </div>

                        <div className="text-sm text-gray-500">
                          {
                            stock.company
                          }
                        </div>
                      </div>

                      <div className="font-bold text-lg">
                        ₹
                        {
                          stock.price
                        }
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-center items-center gap-3">

                        <button
                          onClick={() =>
                            setQuantities({
                              ...quantities,
                              [stock.symbol]:
                                Math.max(
                                  30,
                                  qty -
                                    10
                                ),
                            })
                          }
                          className="h-10 w-10 rounded-full bg-red-100 text-red-600"
                        >
                          -
                        </button>

                        <div className="border rounded-xl px-6 py-2 font-bold">
                          {qty}
                        </div>

                        <button
                          onClick={() =>
                            setQuantities({
                              ...quantities,
                              [stock.symbol]:
                                qty +
                                10,
                            })
                          }
                          className="h-10 w-10 rounded-full bg-green-100 text-green-600"
                        >
                          +
                        </button>

                      </div>

                      <div className="text-center text-xs mt-2 text-gray-500">
                        Minimum
                        30
                        shares
                      </div>

                      <div className="text-center font-semibold mt-2">
                        ₹
                        {(
                          stock.price *
                          qty
                        ).toFixed(
                          2
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <button
                        className="bg-green-600 text-white rounded-xl py-2"
                        onClick={() =>
                          setModal({
                            side: "BUY",
                            stock,
                            qty,
                          })
                        }
                      >
                        Buy
                      </button>

                      <button
                        className="bg-red-600 text-white rounded-xl py-2"
                        onClick={() =>
                          setModal({
                            side: "SELL",
                            stock,
                            qty,
                          })
                        }
                      >
                        Sell
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>

          <div>
            <div className="bg-white rounded-2xl p-4 shadow mb-4">
              <h2 className="font-bold mb-3">
                Holdings
              </h2>

              {Object.entries(
                holdings
              ).map(
                ([symbol, h]) => (
                  <div
                    key={symbol}
                    className="border-b py-2"
                  >
                    {symbol} ·{" "}
                    {h.qty} shares
                  </div>
                )
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow">
              <h2 className="font-bold mb-3">
                Orders
              </h2>

              {orders.map(
                (o) => (
                  <div
                    key={o.id}
                    className="border-b py-2 text-sm"
                  >
                    {o.side}{" "}
                    {o.symbol}
                    {" · "}
                    {o.qty}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {modal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md">
              <h2 className="font-bold text-xl mb-4">
                Confirm
                Order
              </h2>

              <p>
                Type:
                {
                  modal.side
                }
              </p>
              <p>
                Stock:
                {
                  modal.stock
                    .symbol
                }
              </p>
              <p>
                Qty:
                {modal.qty}
              </p>

              <div className="flex gap-2 mt-4">
                <button
                  className="flex-1 bg-gray-300 rounded-xl py-2"
                  onClick={() =>
                    setModal(
                      null
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  className="flex-1 bg-blue-600 text-white rounded-xl py-2"
                  onClick={
                    confirmOrder
                  }
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 text-center w-full max-w-md">
              <div className="text-5xl text-green-600">
                ✓
              </div>

              <h2 className="font-bold text-xl mt-2">
                Order
                Successful
              </h2>

              <p className="mt-2">
                {
                  success.side
                }{" "}
                {
                  success.symbol
                }
              </p>

              <button
                className="mt-4 bg-green-600 text-white px-6 py-2 rounded-xl"
                onClick={() =>
                  setSuccess(
                    null
                  )
                }
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}