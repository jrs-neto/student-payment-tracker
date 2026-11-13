import React, { useEffect, useState, useRef } from 'react';
import {
  Trash2,
  Plus,
  Copy,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Check,
  X,
  CreditCard,
  FileText,
  Edit3,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';
import api from '../services/api';

const nomesMeses = {
  1: 'Janeiro',
  2: 'Fevereiro',
  3: 'Março',
  4: 'Abril',
  5: 'Maio',
  6: 'Junho',
  7: 'Julho',
  8: 'Agosto',
  9: 'Setembro',
  10: 'Outubro',
  11: 'Novembro',
  12: 'Dezembro'
};

export default function MensalidadesPage() {
  const [months, setMonths] = useState([]);
  const [loadingMonths, setLoadingMonths] = useState(true);
  const [errorMonths, setErrorMonths] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(null);
  const [expandedYear, setExpandedYear] = useState(null);

  const [records, setRecords] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [errorRecords, setErrorRecords] = useState(null);

  // Estado para o resumo financeiro do mês
  const [summary, setSummary] = useState({
    total_expected: 0,
    total_paid: 0,
    total_pending: 0
  });

  // Estados para gerir a ação na tabela (pagamento ou exclusão)
  const [updatingRecordId, setUpdatingRecordId] = useState(null);
  const [updatingActionType, setUpdatingActionType] = useState(null); // 'payment' | 'delete'
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Estados para o formulário de cadastro de mensalidade
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeStudents, setActiveStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Estados para o modal de edição de mensalidade
  const [showEditModal, setShowEditModal] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [isUpdatingRecord, setIsUpdatingRecord] = useState(false);
  const [editFormError, setEditFormError] = useState(null);

  // Estados para o modal de cópia de meses ("Criar próximo mês")
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceId, setCopySourceId] = useState('');
  const [copyTargetMonth, setCopyTargetMonth] = useState('');
  const [copyTargetYear, setCopyTargetYear] = useState('');
  const [isCopying, setIsCopying] = useState(false);
  const [copyError, setCopyError] = useState(null);

  // Estados para exclusão do mês de referência
  const [isDeleteMonthModalOpen, setIsDeleteMonthModalOpen] = useState(false);
  const [isDeletingMonth, setIsDeletingMonth] = useState(false);

  // Referência para guardar o ID do mês atualmente selecionado (evita closures desatualizadas)
  const selectedMonthIdRef = useRef(null);

  // Estado e efeito para atualizar automaticamente os registros ao retornar à aba ou na virada do dia (America/Sao_Paulo)
  const lastDateRef = useRef(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())
  );

  const normalizeText = (value) =>
    String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');

  const filteredRecords = records.filter((record) =>
    normalizeText(record.student_name).includes(normalizeText(studentSearch))
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedMonthIdRef.current) {
        const currentDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(new Date());

        lastDateRef.current = currentDate;
        fetchRecordsData(selectedMonthIdRef.current);
      }
    };

    const intervalId = setInterval(() => {
      const currentDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());

      if (currentDate !== lastDateRef.current) {
        lastDateRef.current = currentDate;
        if (selectedMonthIdRef.current) {
          fetchRecordsData(selectedMonthIdRef.current);
        }
      }
    }, 60000); // Verifica a cada 1 minuto se o dia mudou

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    async function fetchMonths() {
      try {
        setErrorMonths(null);
        setLoadingMonths(true);
        const response = await api.get('/months');
        const data = Array.isArray(response.data) ? response.data : [];
        setMonths(data);

        if (data.length > 0) {
          // Ordena explicitamente do mais recente para o mais antigo para encontrar o mês mais recente
          const sorted = [...data].sort((a, b) => {
            if (Number(b.year) !== Number(a.year)) {
              return Number(b.year) - Number(a.year);
            }
            return Number(b.month) - Number(a.month);
          });

          const mostRecent = sorted[0];
          setSelectedMonth(mostRecent);
          selectedMonthIdRef.current = mostRecent.id;
          setExpandedYear(String(mostRecent.year));
        }
      } catch (err) {
        console.error('Erro ao buscar meses de referência:', err);
        setErrorMonths('Não foi possível carregar os meses de referência. Verifique se o backend está rodando.');
      } finally {
        setLoadingMonths(false);
      }
    }

    fetchMonths();
  }, []);

  // Função reutilizável para buscar registros e o resumo do mês selecionado
  async function fetchRecordsData(monthId, checkIsMounted = () => true) {
    if (!monthId) return;

    try {
      setErrorRecords(null);
      setLoadingRecords(true);
      const response = await api.get(`/months/${monthId}/records`);

      if (checkIsMounted() && selectedMonthIdRef.current === monthId) {
        const recordsData = response.data?.records;
        const summaryData = response.data?.summary;

        setRecords(Array.isArray(recordsData) ? recordsData : []);
        setSummary({
          total_expected: Number(summaryData?.total_expected) || 0,
          total_paid: Number(summaryData?.total_paid) || 0,
          total_pending: Number(summaryData?.total_pending) || 0
        });
      }
    } catch (err) {
      if (checkIsMounted() && selectedMonthIdRef.current === monthId) {
        console.error('Erro ao buscar registros do mês:', err);
        setErrorRecords('Não foi possível carregar as mensalidades deste mês.');
        setRecords([]);
        setSummary({
          total_expected: 0,
          total_paid: 0,
          total_pending: 0
        });
      }
    } finally {
      if (checkIsMounted() && selectedMonthIdRef.current === monthId) {
        setLoadingRecords(false);
      }
    }
  }

  useEffect(() => {
    if (!selectedMonth) return;

    selectedMonthIdRef.current = selectedMonth.id;
    let isMounted = true;

    fetchRecordsData(selectedMonth.id, () => isMounted);

    return () => {
      isMounted = false;
    };
  }, [selectedMonth]);

  // Busca alunos ativos ao abrir o formulário
  useEffect(() => {
    if (!showAddModal) return;

    async function fetchStudents() {
      try {
        setLoadingStudents(true);
        const response = await api.get('/students');
        const data = Array.isArray(response.data) ? response.data : [];
        const sortedStudents = data
          .filter((student) => student.is_active === true)
          .sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', 'pt-BR', {
              sensitivity: 'base'
            })
          );

        setActiveStudents(sortedStudents);
      } catch (err) {
        console.error('Erro ao buscar alunos:', err);
        setActiveStudents([]);
      } finally {
        setLoadingStudents(false);
      }
    }

    fetchStudents();
  }, [showAddModal]);

  async function handleAddRecord() {
    setFormError(null);

    if (!newStudentId) {
      setFormError('Selecione um aluno válido.');
      return;
    }

    const numericAmount = Number(newAmount);
    if (!newAmount || isNaN(numericAmount) || numericAmount <= 0) {
      setFormError('Informe um valor maior que zero.');
      return;
    }

    if (!newDueDate) {
      setFormError('Informe o dia do vencimento.');
      return;
    }

    const numericDay = Number(newDueDate);
    if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) {
      setFormError('O dia do vencimento deve ser um número inteiro entre 1 e 31.');
      return;
    }

    const maxDaysInMonth = new Date(Date.UTC(selectedMonth.year, selectedMonth.month, 0)).getUTCDate();
    if (numericDay > maxDaysInMonth) {
      setFormError(`O mês selecionado possui apenas ${maxDaysInMonth} dias.`);
      return;
    }

    const formattedYear = selectedMonth.year;
    const formattedMonth = String(selectedMonth.month).padStart(2, '0');
    const formattedDay = String(numericDay).padStart(2, '0');
    const fullDueDate = `${formattedYear}-${formattedMonth}-${formattedDay}`;

    const selectedStudent = activeStudents.find(
      (student) => String(student.id) === String(newStudentId)
    );
    const studentName = selectedStudent ? selectedStudent.name : '';

    if (!selectedStudent) {
      setFormError('Selecione um aluno válido.');
      return;
    }

    const payload = {
      student_id: Number(newStudentId),
      student_name: studentName,
      amount: String(newAmount),
      due_date: fullDueDate,
    };

    const monthIdAtStart = selectedMonthIdRef.current;
    setIsSaving(true);

    try {
      await api.post(`/months/${selectedMonth.id}/records`, payload);

      if (selectedMonthIdRef.current === monthIdAtStart) {
        await fetchRecordsData(selectedMonth.id);

        setNewStudentId('');
        setNewAmount('');
        setNewDueDate('');
        setShowAddModal(false);

        setActionMessage('Mensalidade cadastrada com sucesso.');
        setTimeout(() => {
          setActionMessage(null);
        }, 4000);
      }
    } catch (err) {
      console.error('Erro ao salvar nova mensalidade:', err);
      const status = err.response?.status;
      const errorMessage = err.response?.data?.error?.message || err.response?.data?.message;

      if (status === 409) {
        setFormError('Este aluno já possui um registro neste mês de referência.');
      } else if (errorMessage) {
        setFormError(errorMessage);
      } else {
        setFormError('Não foi possível salvar a mensalidade. Verifique os dados e tente novamente.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateRecord() {
    setEditFormError(null);

    const numericAmount = Number(editAmount);
    if (!editAmount || isNaN(numericAmount) || numericAmount <= 0) {
      setEditFormError('Informe um valor maior que zero.');
      return;
    }

    if (!editDueDate) {
      setEditFormError('Informe o dia do vencimento.');
      return;
    }

    const numericDay = Number(editDueDate);
    if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) {
      setEditFormError('O dia do vencimento deve ser um número inteiro entre 1 e 31.');
      return;
    }

    const maxDaysInMonth = new Date(Date.UTC(selectedMonth.year, selectedMonth.month, 0)).getUTCDate();
    if (numericDay > maxDaysInMonth) {
      setEditFormError(`O mês selecionado possui apenas ${maxDaysInMonth} dias.`);
      return;
    }

    const formattedYear = selectedMonth.year;
    const formattedMonth = String(selectedMonth.month).padStart(2, '0');
    const formattedDay = String(numericDay).padStart(2, '0');
    const fullDueDate = `${formattedYear}-${formattedMonth}-${formattedDay}`;

    const payload = {
      amount: String(editAmount),
      due_date: fullDueDate,
    };

    const monthIdAtStart = selectedMonthIdRef.current;
    setIsUpdatingRecord(true);

    try {
      await api.put(`/months/records/${recordToEdit.id}`, payload);

      if (selectedMonthIdRef.current === monthIdAtStart) {
        await fetchRecordsData(selectedMonth.id);

        setShowEditModal(false);
        setRecordToEdit(null);
        setEditAmount('');
        setEditDueDate('');

        setActionMessage('Mensalidade atualizada com sucesso.');
        setTimeout(() => {
          setActionMessage(null);
        }, 4000);
      }
    } catch (err) {
      console.error('Erro ao atualizar mensalidade:', err);
      const errorMessage = err.response?.data?.error?.message || err.response?.data?.message;
      setEditFormError(errorMessage || 'Não foi possível atualizar a mensalidade. Verifique os dados e tente novamente.');
    } finally {
      setIsUpdatingRecord(false);
    }
  }

  async function handleCopyMonth() {
    setCopyError(null);

    if (!copySourceId) {
      setCopyError('Selecione o mês de origem.');
      return;
    }

    if (!copyTargetMonth || !copyTargetYear) {
      setCopyError('Informe o mês e o ano de destino.');
      return;
    }

    const tMonth = Number(copyTargetMonth);
    const tYear = Number(copyTargetYear);

    const monthExists = months.some(
      (m) => Number(m.month) === tMonth && Number(m.year) === tYear
    );

    if (monthExists) {
      setCopyError('Já existe um mês de referência cadastrado para este período.');
      return;
    }

    const payload = {
      source_reference_id: Number(copySourceId),
      target_year: tYear,
      target_month: tMonth,
    };

    setIsCopying(true);

    try {
      const response = await api.post('/months/copy', payload);
      const newMonth = response.data?.target_reference_month;

      const monthsResponse = await api.get('/months');
      const updatedMonths = Array.isArray(monthsResponse.data) ? monthsResponse.data : [];
      setMonths(updatedMonths);

      setShowCopyModal(false);
      setCopySourceId('');
      setCopyTargetMonth('');
      setCopyTargetYear('');

      const targetCreatedMonth = updatedMonths.find(
        (m) => Number(m.month) === tMonth && Number(m.year) === tYear
      ) || newMonth;

      if (targetCreatedMonth && targetCreatedMonth.id) {
        setSelectedMonth(targetCreatedMonth);
        selectedMonthIdRef.current = targetCreatedMonth.id;
        setExpandedYear(String(targetCreatedMonth.year));
      }

      setActionMessage('Mês de referência criado e mensalidades copiadas com sucesso.');
      setTimeout(() => {
        setActionMessage(null);
      }, 4000);
    } catch (err) {
      console.error('Erro ao copiar mês:', err);
      const errorMessage = err.response?.data?.error?.message || err.response?.data?.message;
      setCopyError(errorMessage || 'Não foi possível copiar o mês. Verifique os dados e tente novamente.');
    } finally {
      setIsCopying(false);
    }
  }

  async function handleDeleteMonth() {
    if (!selectedMonth) return;

    setIsDeletingMonth(true);
    setActionError(null);
    setActionMessage(null);

    try {
      await api.delete(`/months/${selectedMonth.id}`);

      setActionMessage('Mês de referência e mensalidades excluídos com sucesso.');
      setTimeout(() => {
        setActionMessage(null);
      }, 4000);

      const monthsResponse = await api.get('/months');
      const updatedMonths = Array.isArray(monthsResponse.data) ? monthsResponse.data : [];
      setMonths(updatedMonths);

      if (updatedMonths.length > 0) {
        const sorted = [...updatedMonths].sort((a, b) => {
          if (Number(b.year) !== Number(a.year)) {
            return Number(b.year) - Number(a.year);
          }
          return Number(b.month) - Number(a.month);
        });
        const mostRecent = sorted[0];
        setSelectedMonth(mostRecent);
        selectedMonthIdRef.current = mostRecent.id;
        setExpandedYear(String(mostRecent.year));
      } else {
        setSelectedMonth(null);
        selectedMonthIdRef.current = null;
        setExpandedYear(null);
        setRecords([]);
        setSummary({
          total_expected: 0,
          total_paid: 0,
          total_pending: 0
        });
      }
    } catch (err) {
      console.error('Erro ao excluir o mês de referência:', err);
      const errorMessage = err.response?.data?.error?.message || err.response?.data?.message;
      setActionError(errorMessage || 'Não foi possível excluir o mês de referência.');
    } finally {
      setIsDeletingMonth(false);
      setIsDeleteMonthModalOpen(false);
    }
  }

  function handleSelectMonth(month) {
    if (selectedMonth?.id !== month.id) {
      setSelectedMonth(month);
      selectedMonthIdRef.current = month.id;
      setExpandedYear(String(month.year));
      setRecords([]);
      setSummary({
        total_expected: 0,
        total_paid: 0,
        total_pending: 0
      });
      setActionMessage(null);
      setActionError(null);
    }
  }

  function handleToggleYear(yearStr) {
    setExpandedYear(prev => (prev === yearStr ? null : yearStr));
  }

  async function handleTogglePayment(record) {
    if (updatingRecordId !== null) return;

    const monthIdAtStart = selectedMonthIdRef.current;
    const nextIsPaid = !Boolean(record.is_paid);

    setUpdatingRecordId(record.id);
    setUpdatingActionType('payment');
    setActionMessage(null);
    setActionError(null);

    try {
      await api.patch(`/months/records/${record.id}/payment`, {
        is_paid: nextIsPaid
      });

      if (selectedMonthIdRef.current === monthIdAtStart) {
        await fetchRecordsData(selectedMonth.id);

        setActionMessage(
          nextIsPaid
            ? `Mensalidade de ${record.student_name} marcada como paga com sucesso.`
            : `Mensalidade de ${record.student_name} marcada como pendente.`
        );

        setTimeout(() => {
          setActionMessage(null);
        }, 4000);
      }
    } catch (err) {
      if (selectedMonthIdRef.current === monthIdAtStart) {
        console.error('Erro ao atualizar status de pagamento:', err);
        setActionError('Não foi possível atualizar o status de pagamento. Tente novamente.');
      }
    } finally {
      setUpdatingRecordId(null);
      setUpdatingActionType(null);
    }
  }

  async function handleDeleteRecord(record) {
    const confirmed = window.confirm(`Deseja realmente excluir a mensalidade do aluno ${record.student_name}?`);
    if (!confirmed) return;

    if (updatingRecordId !== null) return;

    const monthIdAtStart = selectedMonthIdRef.current;
    setUpdatingRecordId(record.id);
    setUpdatingActionType('delete');
    setActionMessage(null);
    setActionError(null);

    try {
      await api.delete(`/months/records/${record.id}`);

      if (selectedMonthIdRef.current === monthIdAtStart) {
        await fetchRecordsData(selectedMonthIdRef.current);

        setActionMessage(`Mensalidade de ${record.student_name} excluída com sucesso.`);
        setTimeout(() => {
          setActionMessage(null);
        }, 4000);
      }
    } catch (err) {
      if (selectedMonthIdRef.current === monthIdAtStart) {
        console.error('Erro ao excluir mensalidade:', err);
        setActionError('Não foi possível excluir a mensalidade. Tente novamente.');
      }
    } finally {
      setUpdatingRecordId(null);
      setUpdatingActionType(null);
    }
  }

  function formatCurrency(value) {
    const numericValue = Number(value) || 0;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numericValue);
  }

  function formatDate(dateString) {
    if (!dateString) return '-';
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  }

  function getStatusBadgeStyle(status) {
    switch (status) {
      case 'Pago':
        return 'bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800';
      case 'Pendente':
        return 'bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800';
      case 'Atrasado':
        return 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        {/* Cabeçalho */}
        <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <CreditCard className="text-blue-600 dark:text-[#8B5CF6]" size={28} />
              Controle de Mensalidades
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Selecione um mês de referência para gerir os pagamentos</p>
          </div>
          <button
            onClick={() => {
              setShowCopyModal(true);
              setCopyError(null);
              if (selectedMonth) setCopySourceId(String(selectedMonth.id));
            }}
            className="flex items-center gap-2 cursor-pointer bg-blue-600 hover:bg-blue-700 dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-sm self-start md:self-auto"
          >
            <Copy size={16} />
            Criar próximo mês
          </button>
        </header>

        {/* Modal / Bloco de Cópia de Mês */}
        {showCopyModal && (
          <div className="mb-8 p-5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-md">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Copy size={18} className="text-blue-600 dark:text-[#8B5CF6]" />
              Criar Próximo Mês (Copiar Registros)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mês de Origem</label>
                <select
                  value={copySourceId}
                  onChange={(e) => setCopySourceId(e.target.value)}
                  className="w-full bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6]"
                >
                  <option value="">Selecione a origem...</option>
                  {months.map((m) => (
                    <option key={m.id} value={m.id}>
                      {nomesMeses[m.month]} de {m.year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mês de Destino</label>
                <select
                  value={copyTargetMonth}
                  onChange={(e) => setCopyTargetMonth(e.target.value)}
                  className="w-full bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6]"
                >
                  <option value="">Selecione o mês...</option>
                  {Object.entries(nomesMeses).map(([num, name]) => (
                    <option key={num} value={num}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Ano de Destino</label>
                <input
                  type="number"
                  placeholder="Ex: 2026"
                  value={copyTargetYear}
                  onChange={(e) => setCopyTargetYear(e.target.value)}
                  className="w-full bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6]"
                />
              </div>
            </div>

            {copyError && (
              <div className="bg-red-100 dark:bg-red-950/60 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg mb-4 text-xs flex items-center gap-2" role="alert">
                <AlertCircle size={14} />
                <span>{copyError}</span>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowCopyModal(false);
                  setCopyError(null);
                }}
                disabled={isCopying}
                className="px-4 py-2 bg-gray-200 cursor-pointer dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCopyMonth}
                disabled={isCopying}
                className={`px-4 py-2 bg-emerald-600 cursor-pointer hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition ${isCopying ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              >
                {isCopying ? 'A criar...' : 'Confirmar Cópia'}
              </button>
            </div>
          </div>
        )}

        {loadingMonths && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">A carregar meses de referência...</p>
          </div>
        )}

        {errorMonths && (
          <div className="bg-red-100 dark:bg-red-950/60 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-4 text-sm shadow-sm" role="alert">
            <span className="block sm:inline">{errorMonths}</span>
          </div>
        )}

        {!loadingMonths && !errorMonths && months.length === 0 && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">Nenhum mês de referência cadastrado no momento.</p>
          </div>
        )}

        {!loadingMonths && !errorMonths && months.length > 0 && (() => {
          // Agrupa os meses por ano
          const groupedMonths = months.reduce((acc, month) => {
            const year = month.year;
            if (!acc[year]) {
              acc[year] = [];
            }
            acc[year].push(month);
            return acc;
          }, {});

          // Ordena os anos em ordem decrescente (ex: 2027, 2026...)
          const sortedYears = Object.keys(groupedMonths).sort((a, b) => Number(b) - Number(a));

          return (
            <div className="space-y-4 mb-8">
              {sortedYears.map((year) => {
                const isExpanded = expandedYear === year;
                const yearMonths = groupedMonths[year].sort((a, b) => Number(a.month) - Number(b.month));

                return (
                  <div key={year} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-sm overflow-hidden transition">
                    {/* Cabeçalho do Ano (Accordion Clicável) */}
                    <button
                      type="button"
                      onClick={() => handleToggleYear(year)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-[#151021] hover:bg-gray-100 dark:hover:bg-[#1e1530] transition text-left focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6]"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar size={20} className="text-blue-600 dark:text-[#8B5CF6]" />
                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Ano {year}</span>
                        <span className="text-xs font-semibold bg-blue-100 dark:bg-[#8B5CF6]/20 text-blue-800 dark:text-[#8B5CF6] px-2.5 py-0.5 rounded-full">
                          {yearMonths.length} {yearMonths.length === 1 ? 'mês' : 'meses'}
                        </span>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </button>

                    {/* Conteúdo Expansível do Ano (Meses) */}
                    {isExpanded && (
                      <div className="p-4 border-t border-[var(--border-color)] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {yearMonths.map((month) => {
                          const isSelected = selectedMonth?.id === month.id;
                          return (
                            <div
                              key={month.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleSelectMonth(month)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleSelectMonth(month);
                                }
                              }}
                              className={`rounded-lg shadow-sm p-4 border-2 cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6] ${isSelected
                                ? 'bg-blue-50/50 dark:bg-[#8B5CF6]/10 border-blue-600 dark:border-[#8B5CF6] ring-2 ring-blue-100 dark:ring-[#8B5CF6]/20'
                                : 'bg-[var(--bg-main)] border-[var(--border-color)] hover:border-gray-300 dark:hover:border-gray-700'
                                }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-semibold text-blue-600 dark:text-[#8B5CF6] uppercase tracking-wide">
                                  Referência
                                </span>
                                {isSelected && (
                                  <span className="bg-blue-600 dark:bg-[#8B5CF6] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                                    Selecionado
                                  </span>
                                )}
                              </div>
                              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                {nomesMeses[month.month] || `Mês ${month.month}`}
                              </h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Clique para visualizar registros.
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Seção de Registros / Tabela de Mensalidades do Mês Selecionado */}
        {selectedMonth && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-md rounded-lg overflow-hidden p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FileText className="text-blue-600 dark:text-[#8B5CF6]" size={22} />
                Mensalidades de {nomesMeses[selectedMonth.month]} de {selectedMonth.year}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsDeleteMonthModalOpen(true)}
                  disabled={isDeletingMonth}
                  className="flex items-center gap-1.5 cursor-pointer bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-sm font-semibold transition shadow-sm border border-red-200 dark:border-red-900"
                  title="Excluir mês selecionado"
                >
                  <Trash2 size={16} />
                  <span>Excluir mês</span>
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-sm"
                >
                  <Plus size={16} />
                  Adicionar mensalidade
                </button>
              </div>
            </div>

            {/* Modal de Confirmação de Exclusão do Mês */}
            {isDeleteMonthModalOpen && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg max-w-md w-full p-6 shadow-xl">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Confirmar Exclusão do Mês</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                    Tem certeza de que deseja excluir o mês de referência de <strong>{nomesMeses[selectedMonth.month]} de {selectedMonth.year}</strong> e <strong>todas as mensalidades vinculadas a ele</strong>? Esta ação é irreversível.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setIsDeleteMonthModalOpen(false)}
                      disabled={isDeletingMonth}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleDeleteMonth}
                      disabled={isDeletingMonth}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
                    >
                      {isDeletingMonth ? 'A excluir...' : 'Confirmar Exclusão'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Formulário de cadastro de mensalidade */}
            {showAddModal && (
              <div className="mb-6 p-4 bg-[var(--bg-main)] rounded-lg border border-[var(--border-color)] shadow-inner">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Plus size={18} className="text-blue-600 dark:text-[#8B5CF6]" />
                  Nova Mensalidade
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Aluno Ativo</label>
                    <select
                      value={newStudentId}
                      onChange={(e) => setNewStudentId(e.target.value)}
                      disabled={loadingStudents}
                      className="w-full bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6]"
                    >
                      <option value="">{loadingStudents ? 'Carregando alunos...' : 'Selecione um aluno...'}</option>
                      {activeStudents.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      className="w-full bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Dia do vencimento</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="Ex: 10"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6]"
                    />
                  </div>
                </div>

                {formError && (
                  <div className="bg-red-100 dark:bg-red-950/60 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg mb-4 text-xs flex items-center gap-2" role="alert">
                    <AlertCircle size={14} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setFormError(null);
                      setNewStudentId('');
                      setNewAmount('');
                      setNewDueDate('');
                    }}
                    disabled={isSaving}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-lg transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRecord}
                    disabled={isSaving}
                    className={`px-4 py-2 bg-blue-600 cursor-pointer hover:bg-blue-700 dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] text-white text-sm font-semibold rounded-lg transition ${isSaving ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                  >
                    {isSaving ? 'A salvar...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {/* Modal de Edição de Mensalidade */}
            {showEditModal && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg max-w-lg w-full p-6 shadow-xl">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Edit3 size={18} className="text-blue-600 cursor-pointer dark:text-[#8B5CF6]" />
                    Editar Mensalidade - {recordToEdit?.student_name}
                  </h3>

                  <div className="space-y-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Aluno (Somente leitura)</label>
                      <input
                        type="text"
                        disabled
                        value={recordToEdit?.student_name || ''}
                        className="w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-[var(--border-color)] rounded-lg p-2.5 text-sm cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Valor (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-full bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Dia do vencimento ({nomesMeses[selectedMonth.month]} de {selectedMonth.year})
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="Ex: 15"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="w-full bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6]"
                      />
                    </div>
                  </div>

                  {editFormError && (
                    <div className="bg-red-100 dark:bg-red-950/60 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg mb-4 text-xs flex items-center gap-2" role="alert">
                      <AlertCircle size={14} />
                      <span>{editFormError}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setRecordToEdit(null);
                        setEditAmount('');
                        setEditDueDate('');
                        setEditFormError(null);
                      }}
                      disabled={isUpdatingRecord}
                      className="px-4 py-2 bg-gray-200 cursor-pointer dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateRecord}
                      disabled={isUpdatingRecord}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 cursor-pointer dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] text-white rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-50"
                    >
                      {isUpdatingRecord ? 'A guardar...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mensagens de feedback globais da ação */}
            {actionMessage && (
              <div className="bg-green-100 dark:bg-green-950/60 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg mb-4 text-sm shadow-sm flex items-center gap-2" role="alert">
                <CheckCircle2 size={16} />
                <span className="block sm:inline">{actionMessage}</span>
              </div>
            )}

            {actionError && (
              <div className="bg-red-100 dark:bg-red-950/60 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-4 text-sm shadow-sm flex items-center gap-2" role="alert">
                <AlertCircle size={16} />
                <span className="block sm:inline">{actionError}</span>
              </div>
            )}

            {!loadingRecords && !errorRecords && records.length > 0 && (
              <div className="mb-4 max-w-md relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Pesquisar aluno..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6]"
                />
              </div>
            )}

            {loadingRecords && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 text-sm">A carregar registros de mensalidades...</p>
              </div>
            )}

            {errorRecords && (
              <div className="bg-red-100 dark:bg-red-950/60 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-4 text-sm shadow-sm" role="alert">
                <span className="block sm:inline">{errorRecords}</span>
              </div>
            )}

            {!loadingRecords && !errorRecords && records.length === 0 && (
              <div className="text-center py-8 bg-[var(--bg-main)] rounded-lg border border-dashed border-[var(--border-color)]">
                <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum registro de mensalidade encontrado para este mês.</p>
              </div>
            )}

            {!loadingRecords && !errorRecords && records.length > 0 && (
              <div className="overflow-x-auto border border-[var(--border-color)] rounded-lg mb-6">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-[#38264F]">
                  <thead className="bg-gray-50 dark:bg-[#151021]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome do Aluno</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data de Vencimento</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Situação</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--bg-surface)] divide-y divide-gray-200 dark:divide-[#38264F]">
                    {filteredRecords.length > 0 ? filteredRecords.map((record, index) => {
                      const isRowUpdating = updatingRecordId === record.id;
                      const isAnyUpdating = updatingRecordId !== null;
                      const isPaid = Boolean(record.is_paid);

                      const isPaymentUpdating = isRowUpdating && updatingActionType === 'payment';
                      const isDeleteUpdating = isRowUpdating && updatingActionType === 'delete';

                      return (
                        <tr key={record.id || index} className="hover:bg-gray-50 dark:hover:bg-[#231935] transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                            {record.student_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                            {formatCurrency(record.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                            {formatDate(record.due_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeStyle(record.status)}`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex items-center justify-end space-x-2">
                            {/* Botão de Edição */}
                            <button
                              onClick={() => {
                                setRecordToEdit(record);
                                setEditAmount(record.amount);
                                const dayPart = record.due_date ? record.due_date.split('-')[2] : '';
                                setEditDueDate(dayPart ? String(Number(dayPart)) : '');
                                setEditFormError(null);
                                setShowEditModal(true);
                              }}
                              disabled={isAnyUpdating}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 transition"
                              title="Editar mensalidade"
                            >
                              <Edit3 size={13} />
                              Editar
                            </button>

                            {/* Botão de Alternar Pagamento */}
                            <button
                              onClick={() => handleTogglePayment(record)}
                              disabled={isAnyUpdating}
                              className={`inline-flex items-center gap-1 cursor-pointer px-3 py-1.5 rounded-md text-xs font-semibold transition ${isPaid
                                ? 'bg-yellow-50 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800'
                                : 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800'
                                } ${isAnyUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {isPaymentUpdating ? (
                                'A atualizar...'
                              ) : isPaid ? (
                                <>
                                  <X size={13} />
                                  Marcar como pendente
                                </>
                              ) : (
                                <>
                                  <Check size={13} />
                                  Marcar como pago
                                </>
                              )}
                            </button>

                            {/* Botão de Exclusão */}
                            <button
                              onClick={() => handleDeleteRecord(record)}
                              disabled={isAnyUpdating}
                              className={`inline-flex items-center gap-1 cursor-pointer px-3 py-1.5 rounded-md text-xs font-semibold bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900 transition ${isAnyUpdating ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                              <Trash2 size={13} />
                              {isDeleteUpdating ? 'A excluir...' : 'Excluir'}
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                          Nenhum aluno encontrado para essa pesquisa.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cards de Resumo Financeiro */}
            {!loadingRecords && !errorRecords && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {/* Total Previsto */}
                <div className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg shadow-sm p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Total previsto
                    </span>
                    <DollarSign className="text-blue-600 dark:text-[#8B5CF6]" size={20} />
                  </div>
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(summary.total_expected)}
                  </span>
                </div>

                {/* Total Recebido */}
                <div className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg shadow-sm p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">
                      Total recebido
                    </span>
                    <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
                  </div>
                  <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(summary.total_paid)}
                  </span>
                </div>

                {/* Total Pendente */}
                <div className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg shadow-sm p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                      Total pendente
                    </span>
                    <Clock className="text-amber-600 dark:text-amber-400" size={20} />
                  </div>
                  <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                    {formatCurrency(summary.total_pending)}
                  </span>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}