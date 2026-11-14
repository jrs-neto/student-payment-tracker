-- V5.0__audit_and_remove_defaults.sql

BEGIN;

DO $$
DECLARE
    t RECORD;
    expected_default INTEGER;
    actual_default TEXT;
    parsed_default INTEGER;
    source_attnums SMALLINT[];
    target_attnums SMALLINT[];
    constraint_ok BOOLEAN;
    missing_count INTEGER;
BEGIN

    -- 1. Confirma a existência das três colunas user_id.
    SELECT COUNT(*)
    INTO missing_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
          'students',
          'reference_months',
          'monthly_records'
      )
      AND column_name = 'user_id'
      AND data_type = 'integer'
      AND is_nullable = 'NO';

    IF missing_count <> 3 THEN
        RAISE EXCEPTION
            'V5 abortada: as três colunas user_id não existem ou não estão NOT NULL.';
    END IF;

    -- 2. Confirma a existência e a definição das três FKs simples.
    FOR t IN
        SELECT *
        FROM (
            VALUES
                ('students', 'users'),
                ('reference_months', 'users'),
                ('monthly_records', 'users')
        ) AS expected(source_table, target_table)
    LOOP
        SELECT
            ARRAY(
                SELECT a.attnum
                FROM pg_attribute a
                WHERE a.attrelid = to_regclass('public.' || t.source_table)
                  AND a.attname = 'user_id'
                  AND NOT a.attisdropped
            )::SMALLINT[],
            ARRAY(
                SELECT a.attnum
                FROM pg_attribute a
                WHERE a.attrelid = to_regclass('public.' || t.target_table)
                  AND a.attname = 'id'
                  AND NOT a.attisdropped
            )::SMALLINT[]
        INTO source_attnums, target_attnums;

        SELECT EXISTS (
            SELECT 1
            FROM pg_constraint c
            WHERE c.conrelid = to_regclass('public.' || t.source_table)
              AND c.confrelid = to_regclass('public.' || t.target_table)
              AND c.contype = 'f'
              AND c.conkey = source_attnums
              AND c.confkey = target_attnums
              AND c.confdeltype = 'r'
              AND c.convalidated
        )
        INTO constraint_ok;

        IF NOT constraint_ok THEN
            RAISE EXCEPTION
                'V5 abortada: FK incorreta ou ausente em %.user_id.',
                t.source_table;
        END IF;
    END LOOP;

    -- 3. Confirma as duas FKs compostas.
    FOR t IN
        SELECT *
        FROM (
            VALUES
                (
                    'monthly_records',
                    'reference_months',
                    ARRAY['reference_month_id', 'user_id']::TEXT[],
                    ARRAY['id', 'user_id']::TEXT[]
                ),
                (
                    'monthly_records',
                    'students',
                    ARRAY['student_id', 'user_id']::TEXT[],
                    ARRAY['id', 'user_id']::TEXT[]
                )
        ) AS expected(source_table, target_table, source_columns, target_columns)
    LOOP
        SELECT ARRAY(
            SELECT a.attnum
            FROM unnest(t.source_columns) WITH ORDINALITY AS u(column_name, position)
            JOIN pg_attribute a
              ON a.attrelid = to_regclass('public.' || t.source_table)
             AND a.attname = u.column_name
             AND NOT a.attisdropped
            ORDER BY u.position
        )::SMALLINT[]
        INTO source_attnums;

        SELECT ARRAY(
            SELECT a.attnum
            FROM unnest(t.target_columns) WITH ORDINALITY AS u(column_name, position)
            JOIN pg_attribute a
              ON a.attrelid = to_regclass('public.' || t.target_table)
             AND a.attname = u.column_name
             AND NOT a.attisdropped
            ORDER BY u.position
        )::SMALLINT[]
        INTO target_attnums;

        SELECT EXISTS (
            SELECT 1
            FROM pg_constraint c
            WHERE c.conrelid = to_regclass('public.' || t.source_table)
              AND c.confrelid = to_regclass('public.' || t.target_table)
              AND c.contype = 'f'
              AND c.conkey = source_attnums
              AND c.confkey = target_attnums
              AND c.confdeltype = 'r'
              AND c.convalidated
        )
        INTO constraint_ok;

        IF NOT constraint_ok THEN
            RAISE EXCEPTION
                'V5 abortada: FK composta incorreta entre % e %.',
                t.source_table,
                t.target_table;
        END IF;
    END LOOP;

    -- 4. Confirma as três UNIQUEs necessárias.
    FOR t IN
        SELECT *
        FROM (
            VALUES
                (
                    'students',
                    ARRAY['id', 'user_id']::TEXT[]
                ),
                (
                    'reference_months',
                    ARRAY['id', 'user_id']::TEXT[]
                ),
                (
                    'reference_months',
                    ARRAY['user_id', 'year', 'month']::TEXT[]
                )
        ) AS expected(source_table, source_columns)
    LOOP
        SELECT ARRAY(
            SELECT a.attnum
            FROM unnest(t.source_columns) WITH ORDINALITY AS u(column_name, position)
            JOIN pg_attribute a
              ON a.attrelid = to_regclass('public.' || t.source_table)
             AND a.attname = u.column_name
             AND NOT a.attisdropped
            ORDER BY u.position
        )::SMALLINT[]
        INTO source_attnums;

        SELECT EXISTS (
            SELECT 1
            FROM pg_constraint c
            WHERE c.conrelid = to_regclass('public.' || t.source_table)
              AND c.contype = 'u'
              AND c.conkey = source_attnums
              AND c.convalidated
        )
        INTO constraint_ok;

        IF NOT constraint_ok THEN
            RAISE EXCEPTION
                'V5 abortada: UNIQUE incorreta ou ausente em public.%.',
                t.source_table;
        END IF;
    END LOOP;

    -- 5. Confirma que a UNIQUE global antiga foi removida.
    IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = 'public.reference_months'::REGCLASS
          AND c.contype = 'u'
          AND c.conkey = ARRAY[
              (
                  SELECT attnum
                  FROM pg_attribute
                  WHERE attrelid = 'public.reference_months'::REGCLASS
                    AND attname = 'year'
                    AND NOT attisdropped
              ),
              (
                  SELECT attnum
                  FROM pg_attribute
                  WHERE attrelid = 'public.reference_months'::REGCLASS
                    AND attname = 'month'
                    AND NOT attisdropped
              )
          ]::SMALLINT[]
    ) THEN
        RAISE EXCEPTION
            'V5 abortada: a UNIQUE global (year, month) ainda existe.';
    END IF;

    -- 6. Confirma que todos os registros pertencem a usuários válidos.
    IF EXISTS (
        SELECT 1
        FROM public.students s
        LEFT JOIN public.users u ON u.id = s.user_id
        WHERE u.id IS NULL

        UNION ALL

        SELECT 1
        FROM public.reference_months rm
        LEFT JOIN public.users u ON u.id = rm.user_id
        WHERE u.id IS NULL

        UNION ALL

        SELECT 1
        FROM public.monthly_records mr
        LEFT JOIN public.users u ON u.id = mr.user_id
        WHERE u.id IS NULL
    ) THEN
        RAISE EXCEPTION
            'V5 abortada: existem registros associados a usuários inexistentes.';
    END IF;

    -- 7. Confirma que os três defaults temporários existem,
    -- são inteiros válidos e apontam para o mesmo usuário.
    expected_default := NULL;

    FOR t IN
        SELECT unnest(ARRAY[
            'students',
            'reference_months',
            'monthly_records'
        ]) AS table_name
    LOOP
        SELECT pg_get_expr(d.adbin, d.adrelid)
        INTO actual_default
        FROM pg_attribute a
        JOIN pg_attrdef d
          ON d.adrelid = a.attrelid
         AND d.adnum = a.attnum
        WHERE a.attrelid = to_regclass('public.' || t.table_name)
          AND a.attname = 'user_id'
          AND NOT a.attisdropped;

        IF actual_default IS NULL
           OR actual_default !~ '^[0-9]+$' THEN
            RAISE EXCEPTION
                'V5 abortada: default ausente ou inesperado em public.%.user_id.',
                t.table_name;
        END IF;

        parsed_default := actual_default::INTEGER;

        IF expected_default IS NULL THEN
            expected_default := parsed_default;
        ELSIF parsed_default <> expected_default THEN
            RAISE EXCEPTION
                'V5 abortada: os defaults das três tabelas não apontam para o mesmo usuário.';
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = expected_default
    ) THEN
        RAISE EXCEPTION
            'V5 abortada: o usuário associado aos defaults não existe.';
    END IF;

END $$;

-- 8. Remove os defaults temporários.
ALTER TABLE public.students
    ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE public.reference_months
    ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE public.monthly_records
    ALTER COLUMN user_id DROP DEFAULT;

COMMIT;