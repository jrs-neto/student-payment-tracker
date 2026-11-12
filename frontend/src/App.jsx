import React, { useState, useEffect } from 'react';
import { Sun, Moon, Bot } from 'lucide-react';
import AlunosPage from './pages/AlunosPage';
import MensalidadesPage from './pages/MensalidadesPage';
import AssistantPage from './pages/AssistantPage';

export default function App() {
  const [activeTab, setActiveTab] = useState('alunos');

  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme) {
      return savedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) =>
      prevTheme === 'dark' ? 'light' : 'dark'
    );
  };

  const getTabClass = (tab) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab
      ? 'bg-blue-100 dark:bg-[#8B5CF6]/20 text-blue-700 dark:text-[#8B5CF6]'
      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
    }`;

  return (
    <div className="min-h-screen">
      <nav className="bg-white dark:bg-[#1B1428] border-b border-gray-200 dark:border-[#38264F] transition-colors">
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('alunos')}
              className={getTabClass('alunos')}
            >
              Alunos
            </button>

            <button
              onClick={() => setActiveTab('mensalidades')}
              className={getTabClass('mensalidades')}
            >
              Mensalidades
            </button>

            <button
              onClick={() => setActiveTab('assistente')}
              className={getTabClass('assistente')}
            >
              <Bot size={17} />
              Assistente IA
            </button>
          </div>

          <button
            onClick={toggleTheme}
            aria-label={
              theme === 'dark'
                ? 'Mudar para o modo claro'
                : 'Mudar para o modo escuro'
            }
            className="p-2 rounded-lg bg-gray-100 dark:bg-[#38264F] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#4c356b] transition-colors focus:outline-none"
            title={
              theme === 'dark'
                ? 'Alternar para Modo Claro'
                : 'Alternar para Modo Escuro'
            }
          >
            {theme === 'dark' ? (
              <Sun size={20} />
            ) : (
              <Moon size={20} />
            )}
          </button>
        </div>
      </nav>

      <main>
        {activeTab === 'alunos' && <AlunosPage />}

        {activeTab === 'mensalidades' && <MensalidadesPage />}

        {activeTab === 'assistente' && <AssistantPage />}
      </main>
    </div>
  );
}