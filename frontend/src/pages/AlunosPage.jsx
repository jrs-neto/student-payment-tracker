import React, { useEffect, useState } from 'react';
import {
  UserPlus,
  Edit3,
  UserCheck,
  UserX,
  ChevronRight,
  ChevronDown,
  Users
} from 'lucide-react';
import api from '../services/api';
import AlunoModal from '../components/AlunoModal';

export default function AlunosPage() {
  const [alunos, setAlunos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alunoEmEdicao, setAlunoEmEdicao] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [inactiveOpen, setInactiveOpen] = useState(false);

  async function fetchAlunos() {
    try {
      setError(null);
      setLoading(true);
      const response = await api.get('/students');
      const data = Array.isArray(response.data) ? response.data : [];
      setAlunos(data);
    } catch (err) {
      console.error('Erro ao buscar alunos:', err);
      setError('Não foi possível carregar a lista de alunos. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAlunos();
  }, []);

  function handleOpenCreateModal() {
    setAlunoEmEdicao(null);
    setIsModalOpen(true);
  }

  function handleOpenEditModal(aluno) {
    setAlunoEmEdicao(aluno);
    setIsModalOpen(true);
  }

  async function handleToggleStatus(aluno) {
    try {
      setError(null);
      const novoStatus = aluno.is_active === false ? true : false;
      await api.patch(`/students/${aluno.id}/status`, { is_active: novoStatus });
      const statusTexto = novoStatus ? 'ativado' : 'inativado';
      setSuccessMessage(`Aluno ${statusTexto} com sucesso!`);
      fetchAlunos();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao alterar status do aluno:', err);
      const backendMessage = err.response?.data?.error?.message || err.response?.data?.message;
      setError(backendMessage || 'Não foi possível alterar o status do aluno.');
    }
  }

  function handleSuccessOperation(message) {
    setSuccessMessage(message);
    fetchAlunos();
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  // Função auxiliar para ordenar alfabeticamente considerando acentos da língua portuguesa
  const ordenarPorNome = (a, b) => {
    const nomeA = a.name || '';
    const nomeB = b.name || '';
    return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'accent' });
  };

  const activeAlunos = alunos.filter((aluno) => aluno.is_active !== false).sort(ordenarPorNome);
  const inactiveAlunos = alunos.filter((aluno) => aluno.is_active === false).sort(ordenarPorNome);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        {/* Cabeçalho */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Users className="text-blue-600 dark:text-[#8B5CF6]" size={28} />
              Controle de Alunos
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Lista de alunos registados no sistema</p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] text-white px-4 py-2 rounded-lg text-sm font-medium shadow transition"
          >
            <UserPlus size={16} />
            Novo Aluno
          </button>
        </header>

        {/* Mensagem de Sucesso */}
        {successMessage && (
          <div className="bg-green-100 dark:bg-green-900/40 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg mb-4 text-sm shadow-sm" role="alert">
            {successMessage}
          </div>
        )}

        {/* Estado de Carregamento */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">A carregar alunos...</p>
          </div>
        )}

        {/* Mensagem de Erro */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-4 shadow-sm" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Estado Vazio */}
        {!loading && !error && alunos.length === 0 && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">Nenhum aluno cadastrado no momento.</p>
          </div>
        )}

        {/* Conteúdo Principal (Alunos Ativos e Inativos) */}
        {!loading && !error && alunos.length > 0 && (
          <>
            {/* Tabela de Alunos Ativos */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-md rounded-lg overflow-hidden mb-8">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-[#38264F]">
                  <thead className="bg-gray-50 dark:bg-[#151021]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Responsável</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">E-mail do Responsável</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Situação</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-[#38264F]">
                    {activeAlunos.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                          Nenhum aluno ativo no momento.
                        </td>
                      </tr>
                    ) : (
                      activeAlunos.map((aluno) => (
                        <tr key={aluno.id} className="hover:bg-gray-50 dark:hover:bg-[#231935] transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                            {aluno.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {aluno.guardian_name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {aluno.guardian_email || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
                              Ativo
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <button
                              onClick={() => handleOpenEditModal(aluno)}
                              className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-md text-xs font-semibold transition"
                            >
                              <Edit3 size={14} />
                              Editar
                            </button>
                            <button
                              onClick={() => handleToggleStatus(aluno)}
                              className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-md text-xs font-semibold transition"
                            >
                              <UserX size={14} />
                              Inativar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Seção Recolhível de Alunos Inativos */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-md rounded-lg overflow-hidden">
              <button
                onClick={() => setInactiveOpen(!inactiveOpen)}
                className="w-full px-6 py-4 bg-gray-100 dark:bg-[#151021] hover:bg-gray-200 dark:hover:bg-[#231935] flex items-center justify-between text-left text-sm font-semibold text-gray-700 dark:text-gray-200 transition focus:outline-none"
              >
                <span className="flex items-center gap-2">
                  {inactiveOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  Inativos ({inactiveAlunos.length})
                </span>
              </button>

              {inactiveOpen && (
                <div className="overflow-x-auto border-t border-[var(--border-color)]">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-[#38264F]">
                    <thead className="bg-gray-50 dark:bg-[#151021]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Responsável</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">E-mail do Responsável</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Situação</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-[#38264F]">
                      {inactiveAlunos.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400 bg-[var(--bg-surface)]">
                            Nenhum aluno inativo.
                          </td>
                        </tr>
                      ) : (
                        inactiveAlunos.map((aluno) => (
                          <tr key={aluno.id} className="bg-gray-100 dark:bg-[#1B1428] text-gray-900 dark:text-gray-100 hover:bg-gray-200/70 dark:hover:bg-[#231935] transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                              {aluno.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                              {aluno.guardian_name || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                              {aluno.guardian_email || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-900">
                                Inativo
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                              <button
                                onClick={() => handleOpenEditModal(aluno)}
                                className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200 bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-700/50 px-3 py-1.5 rounded-md text-xs font-semibold transition"
                              >
                                <Edit3 size={14} />
                                Editar
                              </button>
                              <button
                                onClick={() => handleToggleStatus(aluno)}
                                className="inline-flex items-center gap-1 text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-200 bg-green-100 dark:bg-green-900/50 border border-indigo-300 dark:border-indigo-700/50 px-3 py-1.5 rounded-md text-xs font-semibold transition"
                              >
                                <UserCheck size={14} />
                                Ativar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal de Aluno (Cadastro/Edição) */}
        <AlunoModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSuccessOperation}
          alunoParaEditar={alunoEmEdicao}
        />
      </div>
    </div>
  );
}