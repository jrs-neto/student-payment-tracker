-- V4.0__secure_monthly_records.sql

BEGIN;

DO $$
DECLARE
    legacy_id INTEGER;
    orphan_count BIGINT;
    mismatch_count BIGINT;
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

    -- Verifica referências inválidas.
    SELECT COUNT(*)
    INTO orphan_count
    FROM public.monthly_records mr
    LEFT JOIN public.students s
        ON s.id = mr.student_id
    LEFT JOIN public.reference_months rm
        ON rm.id = mr.reference_month_id
    WHERE s.id IS NULL
       OR rm.id IS NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION
            'Existem % mensalidades com referências inválidas.',
            orphan_count;
    END IF;

    -- Verifica se aluno e mês pertencem ao mesmo usuário.
    SELECT COUNT(*)
    INTO mismatch_count
    FROM public.monthly_records mr
    JOIN public.students s
        ON s.id = mr.student_id
    JOIN public.reference_months rm
        ON rm.id = mr.reference_month_id
    WHERE s.user_id IS DISTINCT FROM rm.user_id;

    IF mismatch_count > 0 THEN
        RAISE EXCEPTION
            'Existem % mensalidades com aluno e mês de usuários diferentes.',
            mismatch_count;
    END IF;

    -- Adiciona user_id.
    ALTER TABLE public.monthly_records
        ADD COLUMN user_id INTEGER;

    -- Obtém o proprietário através do mês de referência.
    UPDATE public.monthly_records mr
    SET user_id = rm.user_id
    FROM public.reference_months rm
    WHERE rm.id = mr.reference_month_id;

    -- Auditoria final do preenchimento.
    SELECT COUNT(*)
    INTO mismatch_count
    FROM public.monthly_records mr
    JOIN public.students s
        ON s.id = mr.student_id
    JOIN public.reference_months rm
        ON rm.id = mr.reference_month_id
    WHERE mr.user_id IS NULL
       OR mr.user_id IS DISTINCT FROM s.user_id
       OR mr.user_id IS DISTINCT FROM rm.user_id;

    IF mismatch_count > 0 THEN
        RAISE EXCEPTION
            'Existem % mensalidades com inconsistências de propriedade.',
            mismatch_count;
    END IF;

    ALTER TABLE public.monthly_records
        ALTER COLUMN user_id SET NOT NULL;

    -- DEFAULT temporário para compatibilidade durante a transição.
    EXECUTE format(
        'ALTER TABLE public.monthly_records ALTER COLUMN user_id SET DEFAULT %s',
        legacy_id
    );

    -- FK simples para usuários.
    ALTER TABLE public.monthly_records
        ADD CONSTRAINT fk_monthly_records_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE RESTRICT;

    -- Remove as duas FKs simples originais.
    ALTER TABLE public.monthly_records
        DROP CONSTRAINT monthly_records_reference_month_id_fkey;

    ALTER TABLE public.monthly_records
        DROP CONSTRAINT monthly_records_student_id_fkey;

    -- FK composta: mensalidade e mês devem pertencer ao mesmo usuário.
    ALTER TABLE public.monthly_records
        ADD CONSTRAINT fk_monthly_reference_composed
        FOREIGN KEY (reference_month_id, user_id)
        REFERENCES public.reference_months(id, user_id)
        ON DELETE RESTRICT;

    -- FK composta: mensalidade e aluno devem pertencer ao mesmo usuário.
    ALTER TABLE public.monthly_records
        ADD CONSTRAINT fk_monthly_student_composed
        FOREIGN KEY (student_id, user_id)
        REFERENCES public.students(id, user_id)
        ON DELETE RESTRICT;

    CREATE INDEX idx_monthly_records_user_id
        ON public.monthly_records(user_id);

    CREATE INDEX idx_monthly_records_reference_user
        ON public.monthly_records(reference_month_id, user_id);

    CREATE INDEX idx_monthly_records_student_user
        ON public.monthly_records(student_id, user_id);

END $$;

COMMIT;