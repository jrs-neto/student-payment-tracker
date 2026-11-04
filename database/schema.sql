-- Criação da tabela de cadastro permanente de alunos (Catálogo base com campos de responsável opcionais)
CREATE TABLE IF NOT EXISTS students (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    guardian_name VARCHAR(150) NULL,
    guardian_email VARCHAR(150) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Criação da tabela de controle dos meses de referência
CREATE TABLE IF NOT EXISTS reference_months (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    year INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Garante que a combinação de ano e mês seja única no sistema
    CONSTRAINT uk_year_month UNIQUE (year, month)
);

-- Criação da tabela de registros individuais de mensalidades
CREATE TABLE IF NOT EXISTS monthly_records (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    reference_month_id INT NOT NULL REFERENCES reference_months(id) ON DELETE RESTRICT,
    student_name VARCHAR(150) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    due_date DATE NOT NULL,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Impede mensalidades duplicadas para o mesmo aluno no mesmo mês de referência
    CONSTRAINT uk_student_reference_month UNIQUE (student_id, reference_month_id)
);

-- Índices úteis para performance em consultas frequentes
CREATE INDEX IF NOT EXISTS idx_monthly_records_month ON monthly_records(reference_month_id);
CREATE INDEX IF NOT EXISTS idx_monthly_records_student ON monthly_records(student_id);