-- Schema extracted from finstant

CREATE TABLE file_upload (
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    filename text NOT NULL,
    file_hash text,
    size_bytes integer NOT NULL,
    status text NOT NULL DEFAULT 'Ingesting'::text CHECK (status IN ('Ingesting', 'Completed', 'Error', 'Replaced')),
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_user (
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    role text NOT NULL DEFAULT 'user'::text CHECK (role IN ('admin', 'user', 'superadmin')),
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    designation text NOT NULL DEFAULT 'User'::text,
    is_active boolean NOT NULL DEFAULT true,
    profile_picture text
);

CREATE TABLE chat_session (
    id text NOT NULL PRIMARY KEY,
    user_id integer NOT NULL,
    title text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_by_user boolean DEFAULT false,
    CONSTRAINT fk_chat_session_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE TABLE chat_message (
    id text NOT NULL PRIMARY KEY,
    session_id text NOT NULL,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_message_session FOREIGN KEY (session_id) REFERENCES chat_session(id) ON DELETE CASCADE
);

CREATE TABLE audit_log (
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL,
    query_text text,
    parameters text,
    step integer,
    timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_log_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE TABLE sessions (
    id text NOT NULL PRIMARY KEY,
    user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

-- Indexes for performance on Foreign Key columns
CREATE INDEX idx_chat_session_user_id ON chat_session(user_id);
CREATE INDEX idx_chat_message_session_id ON chat_message(session_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);