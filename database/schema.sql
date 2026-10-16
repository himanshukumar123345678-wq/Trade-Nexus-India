CREATE TABLE IF NOT EXISTS trades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    stock_name VARCHAR(100) NOT NULL,
    transaction_type VARCHAR(10) NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    trade_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT trades_type_check CHECK (transaction_type IN ('BUY', 'SELL')),
    CONSTRAINT trades_quantity_check CHECK (quantity > 0),
    CONSTRAINT trades_price_check CHECK (price > 0),
    INDEX trades_user_date_idx (user_id, trade_date),
    INDEX trades_stock_date_idx (stock_name, trade_date)
);
