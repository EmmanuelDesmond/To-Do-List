CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY UQ_daybook_users_email (email)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX IX_daybook_sessions_user_id (user_id),
  INDEX IX_daybook_sessions_expires_at (expires_at),
  CONSTRAINT FK_daybook_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NULL,
  title VARCHAR(90) NOT NULL,
  category VARCHAR(16) NOT NULL,
  priority VARCHAR(6) NOT NULL DEFAULT 'medium',
  due_at DATETIME NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  is_alerted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX IX_daybook_tasks_owner_id (owner_id),
  INDEX IX_daybook_tasks_created_at (created_at DESC),
  INDEX IX_daybook_tasks_due_at (due_at),
  CONSTRAINT FK_daybook_tasks_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);