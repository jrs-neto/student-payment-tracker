# API de Controle de Mensalidades Escolares

Backend para gerenciamento de alunos, meses de referência e registros de mensalidades escolares, desenvolvido com Node.js, Express e PostgreSQL sem ORM.

## 🚀 Requisitos e Tecnologias

* **Node.js** (v18+ recomendado)
* **PostgreSQL**
* **ES Modules** (`"type": "module"` no `package.json`)

---

## ⚙️ Configuração do Ambiente e Execução

### 1. Instalação de Dependências

No diretório do projeto backend, execute:

```bash
npm install
```

### 2. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do backend configurando as credenciais de acesso ao PostgreSQL e a porta do servidor:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=nome_do_banco
```

### 3. Executando o Servidor

```bash
# Modo de desenvolvimento
npm run dev

# Modo de produção
npm start
```

O servidor estará ativo em `http://localhost:3000`.

---

## 📌 Convenções e Regras Globais

* **Formato de Datas:** As datas civis são mantidas no formato `YYYY-MM-DD` sem deslocamentos de fuso horário.
* **Status do Registro Mensal:** Calculado dinamicamente:
  * `Pago`: quando `is_paid = true`.
  * `Pendente`: quando `is_paid = false` e a data de vencimento (`due_date`) é maior ou igual à data atual no fuso `America/Sao_Paulo`.
  * `Atrasado`: quando `is_paid = false` e a data de vencimento (`due_date`) é menor que a data atual em `America/Sao_Paulo`.
* **Valores Monetários:** Armazenados como `NUMERIC(10,2)` (máximo de 8 dígitos inteiros e 2 decimais).

---

## 📑 Endpoints da API

### 👨‍🎓 Módulo de Alunos (`/api/students`)

#### 1. Listar Alunos
Retorna todos os alunos cadastrados no sistema.

* **Método:** `GET`
* **Rota:** `/api/students`
* **Resposta de Sucesso (`200 OK`):**
```json
[
  {
    "id": 1,
    "name": "João da Silva",
    "guardian_name": "Maria da Silva",
    "guardian_email": "maria@email.com",
    "is_active": true,
    "created_at": "2026-10-25T17:19:30.064Z"
  }
]
```

#### 2. Consultar Aluno por ID
Retorna os dados detalhados de um aluno específico.

* **Método:** `GET`
* **Rota:** `/api/students/:id`
* **Resposta de Sucesso (`200 OK`):**
```json
{
  "id": 1,
  "name": "João da Silva",
  "guardian_name": "Maria da Silva",
  "guardian_email": "maria@email.com",
  "is_active": true,
  "created_at": "2026-10-25T17:19:30.064Z"
}
```

#### 3. Cadastrar Aluno
Cadastra um novo aluno na base de dados. Por padrão, novos alunos são criados como ativos (`is_active: true`).

* **Método:** `POST`
* **Rota:** `/api/students`
* **Corpo da Requisição (`Body`):**
```json
{
  "name": "João da Silva",
  "guardian_name": "Maria da Silva",
  "guardian_email": "maria@email.com"
}
```
* **Resposta de Sucesso (`201 Created`):**
```json
{
  "id": 1,
  "name": "João da Silva",
  "guardian_name": "Maria da Silva",
  "guardian_email": "maria@email.com",
  "is_active": true,
  "created_at": "2026-10-25T17:19:30.064Z"
}
```

#### 4. Atualizar Aluno
Edita os dados cadastrais (`name`, `guardian_name`, `guardian_email`) de um aluno.

* **Método:** `PUT`
* **Rota:** `/api/students/:id`
* **Corpo da Requisição (`Body`):**
```json
{
  "name": "João da Silva Xavier",
  "guardian_name": "Maria da Silva Xavier",
  "guardian_email": "maria.xavier@email.com"
}
```
* **Resposta de Sucesso (`200 OK`):**
```json
{
  "id": 1,
  "name": "João da Silva Xavier",
  "guardian_name": "Maria da Silva Xavier",
  "guardian_email": "maria.xavier@email.com",
  "is_active": true,
  "created_at": "2026-10-25T17:19:30.064Z"
}
```

#### 5. Alternar Status de Atividade do Aluno
Ativa ou desativa o cadastro de um aluno (`is_active`).

* **Método:** `PATCH`
* **Rota:** `/api/students/:id/status`
* **Corpo da Requisição (`Body`):**
```json
{
  "is_active": false
}
```
* **Resposta de Sucesso (`200 OK`):**
```json
{
  "id": 1,
  "name": "João da Silva Xavier",
  "guardian_name": "Maria da Silva Xavier",
  "guardian_email": "maria.xavier@email.com",
  "is_active": false,
  "created_at": "2026-10-25T17:19:30.064Z"
}
```

---

### 📅 Módulo de Meses e Mensalidades (`/api/months`)

#### 6. Listar Meses de Referência
Retorna a lista de todos os meses cadastrados ordenados cronologicamente por ano e mês.

* **Método:** `GET`
* **Rota:** `/api/months`
* **Resposta de Sucesso (`200 OK`):**
```json
[
  {
    "id": 1,
    "year": 2026,
    "month": 10,
    "created_at": "2026-10-25T17:19:30.064Z"
  },
  {
    "id": 2,
    "year": 2026,
    "month": 11,
    "created_at": "2026-10-28T15:57:58.704Z"
  }
]
```

#### 7. Copiar Registros entre Meses
Cria o mês de destino (se não existir) e duplica todos os registros existentes no mês de origem de forma transacional. Reajusta os vencimentos para o mês/ano de destino (respeitando o último dia do mês) e define todos os novos registros como não pagos (`is_paid = false`).

* **Método:** `POST`
* **Rota:** `/api/months/copy`
* **Corpo da Requisição (`Body`):**
```json
{
  "source_reference_id": 1,
  "target_year": 2026,
  "target_month": 11
}
```
* **Resposta de Sucesso (`201 Created`):**
```json
{
  "message": "Registros copiados com sucesso.",
  "target_reference_month": {
    "id": 2,
    "year": 2026,
    "month": 11,
    "created_at": "2026-10-28T15:57:58.704Z"
  },
  "copied_count": 1
}
```

#### 8. Listar Registros Mensais e Resumo Financeiro
Retorna os detalhes do mês de referência, o resumo financeiro (`total_expected`, `total_paid`, `total_pending`) e os registros das mensalidades.

* **Método:** `GET`
* **Rota:** `/api/months/:reference_id/records`
* **Resposta de Sucesso (`200 OK`):**
```json
{
  "reference_month": {
    "id": 1,
    "year": 2026,
    "month": 10,
    "created_at": "2026-10-25T17:19:30.064Z"
  },
  "summary": {
    "total_expected": "150.00",
    "total_paid": "0.00",
    "total_pending": "150.00"
  },
  "records": [
    {
      "id": 1,
      "student_id": 1,
      "reference_month_id": 1,
      "student_name": "João da Silva",
      "amount": "150.00",
      "due_date": "2026-10-10",
      "is_paid": false,
      "created_at": "2026-10-25T17:25:00.000Z",
      "status": "Atrasado"
    }
  ]
}
```

#### 9. Criar Registro Mensal
Adiciona uma nova mensalidade para um aluno **ativo** em um mês de referência específico.

* **Método:** `POST`
* **Rota:** `/api/months/:reference_id/records`
* **Corpo da Requisição (`Body`):**
```json
{
  "student_id": 1,
  "student_name": "João da Silva",
  "amount": "150.00",
  "due_date": "2026-10-10"
}
```
* **Resposta de Sucesso (`201 Created`):**
```json
{
  "id": 1,
  "student_id": 1,
  "reference_month_id": 1,
  "student_name": "João da Silva",
  "amount": "150.00",
  "due_date": "2026-10-10",
  "is_paid": false,
  "created_at": "2026-10-25T17:25:00.000Z",
  "status": "Atrasado"
}
```

#### 10. Atualizar Registro Mensal
Edita os dados de um registro de mensalidade (`student_name`, `amount`, `due_date`).

* **Método:** `PUT`
* **Rota:** `/api/months/records/:id`
* **Corpo da Requisição (`Body`):**
```json
{
  "student_name": "João da Silva Xavier",
  "amount": "160.00",
  "due_date": "2026-10-15"
}
```
* **Resposta de Sucesso (`200 OK`):**
```json
{
  "id": 1,
  "student_id": 1,
  "reference_month_id": 1,
  "student_name": "João da Silva Xavier",
  "amount": "160.00",
  "due_date": "2026-10-15",
  "is_paid": false,
  "created_at": "2026-10-25T17:25:00.000Z",
  "status": "Atrasado"
}
```

#### 11. Atualizar Status de Pagamento
Altera exclusivamente o estado de pagamento de um registro de mensalidade (`is_paid`).

* **Método:** `PATCH`
* **Rota:** `/api/months/records/:id/payment`
* **Corpo da Requisição (`Body`):**
```json
{
  "is_paid": true
}
```
* **Resposta de Sucesso (`200 OK`):**
```json
{
  "id": 1,
  "student_id": 1,
  "reference_month_id": 1,
  "student_name": "João da Silva Xavier",
  "amount": "160.00",
  "due_date": "2026-10-15",
  "is_paid": true,
  "created_at": "2026-10-25T17:25:00.000Z",
  "status": "Pago"
}
```

#### 12. Excluir Registro Mensal
Remove um registro de mensalidade da base de dados.

* **Método:** `DELETE`
* **Rota:** `/api/months/records/:id`
* **Resposta de Sucesso (`200 OK`):**
```json
{
  "id": 1,
  "student_id": 1,
  "reference_month_id": 1,
  "student_name": "João da Silva Xavier",
  "amount": "160.00",
  "due_date": "2026-10-15",
  "is_paid": true,
  "created_at": "2026-10-25T17:25:00.000Z",
  "status": "Pago"
}
```

---

## ⚠️ Tratamento e Formato de Erros

O middleware centralizado (`errorHandler.js`) devolve respostas de erro estruturadas sob o objeto `error`:

```json
{
  "error": {
    "status": 400,
    "message": "Descrição exata do erro ocorrido."
  }
}
```

### Principais Códigos HTTP e Tratamentos

* **`400 Bad Request`**: Disparado quando ocorre envio de campos não permitidos no payload, IDs inválidos, valores fora das faixas aceitas, datas malformadas, JSON sintaticamente incorreto ou tentativa de vincular aluno inativo a uma mensalidade.
* **`404 Not Found`**: Disparado quando o recurso solicitado (aluno, mês de referência ou registro de mensalidade) não é encontrado na base de dados.
* **`409 Conflict`**: Disparado em caso de violação de restrições de unicidade (ex.: aluno já cadastrado no mesmo mês de referência ou tentativa de copiar para um mês de destino já existente).
* **`500 Internal Server Error`**: Disparado em falhas não tratadas ou exceções internas do servidor/banco de dados.