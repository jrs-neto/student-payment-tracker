import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function AlunoModal({ isOpen, onClose, onSuccess, alunoParaEditar, apiClient = api }) {
  const [name, setName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isEditing = Boolean(alunoParaEditar);

  useEffect(() => {
    if (alunoParaEditar) {
      setName(alunoParaEditar.name || '');
      setGuardianName(alunoParaEditar.guardian_name || '');
      setGuardianEmail(alunoParaEditar.guardian_email || '');
    } else {
      setName('');
      setGuardianName('');
      setGuardianEmail('');
    }
    setError(null);
  }, [alunoParaEditar, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        name,
        guardian_name: guardianName.trim() ? guardianName : null,
        guardian_email: guardianEmail.trim() ? guardianEmail : null,
      };

      if (isEditing) {
        await apiClient.put(`/students/${alunoParaEditar.id}`, payload);
      } else {
        await apiClient.post('/students', payload);
      }

      onSuccess(isEditing ? 'Aluno atualizado com sucesso!' : 'Aluno cadastrado com sucesso!');
      onClose();
    } catch (err) {
      console.error('Erro ao salvar aluno:', err);
      const backendMessage = err.response?.data?.error?.message || err.response?.data?.message;
      setError(backendMessage || 'Não foi possível salvar o aluno. Verifique os dados preenchidos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 transition-colors duration-200">
      <div className="bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-color)] rounded-xl shadow-2xl max-w-md w-full p-6 transition-colors duration-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {isEditing ? 'Editar Aluno' : 'Cadastrar Novo Aluno'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold transition-colors"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-950/60 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg mb-4 text-sm shadow-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nome do Aluno *</label>
            <input
              type="text"
              required
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6] placeholder-gray-400 dark:placeholder-gray-500 text-sm transition-colors"
              placeholder="Ex: João da Silva"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nome do Responsável</label>
            <input
              type="text"
              maxLength={150}
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              className="w-full bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6] placeholder-gray-400 dark:placeholder-gray-500 text-sm transition-colors"
              placeholder="Ex: Maria da Silva (Opcional)"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">E-mail do Responsável</label>
            <input
              type="email"
              maxLength={150}
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              className="w-full bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#8B5CF6] placeholder-gray-400 dark:placeholder-gray-500 text-sm transition-colors"
              placeholder="Ex: maria@email.com (Opcional)"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-[#38264F]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? 'A salvar...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
