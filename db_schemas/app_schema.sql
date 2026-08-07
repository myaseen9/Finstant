-- Schema extracted from finstant

CREATE TABLE file_upload (
    id SERIAL PRIMARY KEY,
    filename text NOT NULL,
    file_hash text,
    size_bytes integer NOT NULL,
    status text NOT NULL DEFAULT 'Ingesting'::text,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_message (
    id text NOT NULL,
    session_id text,
    role text,
    content text,
    created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE chat_session (
    id text NOT NULL,
    user_id integer,
    title text,
    created_at timestamp without time zone DEFAULT now(),
    deleted_by_user boolean DEFAULT false
);

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id integer,
    query_text text,
    parameters text,
    step integer,
    timestamp timestamp without time zone DEFAULT now()
);

CREATE TABLE sessions (
    id text NOT NULL,
    user_id integer,
    created_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone
);

CREATE TABLE app_user (
    id SERIAL PRIMARY KEY,
    username text NOT NULL,
    password_hash text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    role text NOT NULL DEFAULT 'user'::text,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    designation text NOT NULL DEFAULT 'User'::text,
    is_active boolean NOT NULL DEFAULT true,
    profile_picture text
);

