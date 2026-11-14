-- V3.0__add_user_id_to_reference_months.sql

BEGIN;

DO $$
DECLARE
    legacy_id INTEGER;
    invalid_count BIGINT;
BEGIN
    SELECT id
    INTO legacy_id
    FROM public.users
    WHERE email = 'legado@studenttracker.local'
      AND password_hash IS NULL
      AND claimed_at IS NULL;

    IF legacy_id IS NULL THEN
        RAISE EXCEPTION 'Conta legada não encontrada ou já reivindicada.';
    END IF;

    ALTER TABLE public.reference_months
        ADD COLUMN user_id INTEGER;

    UPDATE public.reference_months
    SET user_id = legacy_id;

    SELECT COUNT(*)
    INTO invalid_count
    FROM public.reference_months
    WHERE user_id IS NULL
       OR user_id <> legacy_id;

    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Existem meses com user_id inválido.';
    END IF;

    ALTER TABLE public.reference_months
        ALTER COLUMN user_id SET NOT NULL;

    -- DEFAULT temporário para compatibilidade durante a transição.
    EXECUTE format(
        'ALTER TABLE public.reference_months ALTER COLUMN user_id SET DEFAULT %s',
        legacy_id
    );

    ALTER TABLE public.reference_months
        ADD CONSTRAINT fk_reference_months_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE RESTRICT;

    -- Remove a unicidade global de ano e mês.
    ALTER TABLE public.reference_months
        DROP CONSTRAINT uk_year_month;

    -- Cada usuário poderá ter seu próprio registro do mesmo mês.
    ALTER TABLE public.reference_months
        ADD CONSTRAINT uk_user_year_month
        UNIQUE (user_id, year, month);

    -- Chave composta para as mensalidades.
    ALTER TABLE public.reference_months
        ADD CONSTRAINT uq_reference_id_user
        UNIQUE (id, user_id);

    CREATE INDEX idx_reference_months_user_id
        ON public.reference_months(user_id);

END $$;

COMMIT;