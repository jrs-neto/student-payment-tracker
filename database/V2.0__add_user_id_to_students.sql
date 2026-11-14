-- V2.0__add_user_id_to_students.sql

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

    -- Adiciona a coluna inicialmente permitindo NULL.
    ALTER TABLE public.students
        ADD COLUMN user_id INTEGER;

    -- Associa todos os alunos existentes à conta legada.
    UPDATE public.students
    SET user_id = legacy_id;

    -- Auditoria.
    SELECT COUNT(*)
    INTO invalid_count
    FROM public.students
    WHERE user_id IS NULL
       OR user_id <> legacy_id;

    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Existem alunos com user_id inválido.';
    END IF;

    ALTER TABLE public.students
        ALTER COLUMN user_id SET NOT NULL;

    -- DEFAULT temporário para compatibilidade durante a transição.
    EXECUTE format(
        'ALTER TABLE public.students ALTER COLUMN user_id SET DEFAULT %s',
        legacy_id
    );

    -- FK para usuários.
    ALTER TABLE public.students
        ADD CONSTRAINT fk_students_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE RESTRICT;

    -- Chave composta necessária para a FK das mensalidades.
    ALTER TABLE public.students
        ADD CONSTRAINT uq_student_id_user
        UNIQUE (id, user_id);

    CREATE INDEX idx_students_user_id
        ON public.students(user_id);

END $$;

COMMIT;