CREATE TABLE tn_users (
    id CHAR(36) NOT NULL PRIMARY KEY,
    login_identifier VARCHAR(254) NOT NULL UNIQUE,
    password_salt CHAR(32) NOT NULL,
    password_hash CHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tn_sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX tn_sessions_user_expiry_idx (user_id, expires_at),
    CONSTRAINT tn_sessions_user_fk FOREIGN KEY (user_id) REFERENCES tn_users (id) ON DELETE CASCADE
);

CREATE TABLE tn_virtual_accounts (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    balance DECIMAL(14, 2) NOT NULL DEFAULT 30000.00,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT tn_virtual_accounts_user_fk FOREIGN KEY (user_id) REFERENCES tn_users (id) ON DELETE CASCADE,
    CONSTRAINT tn_virtual_accounts_balance_check CHECK (balance >= 0)
);

CREATE TABLE tn_watchlist (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY tn_watchlist_user_symbol_unique (user_id, symbol),
    INDEX tn_watchlist_user_created_idx (user_id, created_at),
    CONSTRAINT tn_watchlist_user_fk FOREIGN KEY (user_id) REFERENCES tn_users (id) ON DELETE CASCADE
);

CREATE TABLE tn_deposits (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    amount DECIMAL(14, 2) NOT NULL,
    is_simulated BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX tn_deposits_user_date_idx (user_id, created_at),
    CONSTRAINT tn_deposits_user_fk FOREIGN KEY (user_id) REFERENCES tn_users (id) ON DELETE CASCADE,
    CONSTRAINT tn_deposits_amount_check CHECK (amount > 0)
);