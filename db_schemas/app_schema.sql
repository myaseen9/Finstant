-- Application Users Database Schema

CREATE TABLE IF NOT EXISTS app_user (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    cognito_sub_id TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    designation TEXT,
    is_active BOOLEAN DEFAULT True,
    created_at TIMESTAMP DEFAULT now(),
    role TEXT
);


CREATE TABLE IF NOT EXISTS user_sheet_access (
    user_id INTEGER,
    sheet_name TEXT,
    PRIMARY KEY (user_id, sheet_name)
);

CREATE TABLE IF NOT EXISTS chat_session (
    id TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES app_user(id) ON DELETE CASCADE,
    title TEXT,
    deleted_by_user BOOLEAN DEFAULT False,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS file_upload (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_message (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES chat_session(id) ON DELETE CASCADE,
    role TEXT,
    content TEXT,
    created_at TIMESTAMP DEFAULT now()
);
