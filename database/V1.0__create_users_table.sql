-- V1.0__create_users_table.sql
-- Criação da tabela de usuários e conta legada.

BEGIN;

CREATE TABLE public.users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    google_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMP WITH TIME ZONE
);

-- Cria a conta legada.
-- O PostgreSQL gera automaticamente o ID.

INSERT INTO public.users (
    name,
    email,
    password_hash
)
VALUES (
    'Administrador Legado',
    'legado@studenttracker.local',
    NULL
);

-- Confirma que a conta foi criada corretamente.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.users
        WHERE email = 'legado@studenttracker.local'
          AND password_hash IS NULL
          AND claimed_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Falha na criação da conta legada.';
    END IF;
END $$;

COMMIT;