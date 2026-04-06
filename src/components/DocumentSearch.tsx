import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { 
  Search, 
  Loader2, 
  FileText, 
  Calendar, 
  User, 
  Tag,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { smartSearchRAG } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';

export default function DocumentSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [allDocs, setAllDocs] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'documents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllDocs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setHasSearched(true);
    
    // Use Gemini for smart search with RAG
    const relevantDocs = await smartSearchRAG(searchTerm, allDocs);
    
    setResults(relevantDocs);
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold text-slate-900 flex items-center justify-center gap-3">
          <Sparkles className="w-8 h-8 text-blue-600" /> Búsqueda Inteligente
        </h2>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Busca libremente entre toda la documentación del colegio. 
          Prueba con: "Asistencias 1ro A marzo 2024" o "Memorandums del profe Julio".
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative group">
        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
          <Search className="w-6 h-6 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="¿Qué documento estás buscando?"
          className="w-full pl-16 pr-32 py-5 bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-lg"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-3 top-3 bottom-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold px-8 rounded-2xl transition-all flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}
        </button>
      </form>

      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-20 gap-4"
            >
              <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
              <p className="text-slate-500 font-medium">La IA está analizando los documentos...</p>
            </motion.div>
          ) : hasSearched ? (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {results.map((doc) => (
                <div key={doc.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                      <FileText className="w-6 h-6 text-blue-600 group-hover:text-white" />
                    </div>
                    <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full uppercase">
                      {doc.metadata?.type || 'Documento'}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">{doc.metadata?.title || doc.fileName}</h4>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-4">{doc.metadata?.summary || 'Sin resumen disponible'}</p>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5" /> {doc.metadata?.date || 'Sin fecha'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <User className="w-3.5 h-3.5" /> {doc.metadata?.involved?.[0] || 'N/A'}
                    </div>
                  </div>
                  
                  {doc.fileUrl !== 'internal://fut-digital' && (
                    <a 
                      href={doc.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-6 w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Ver Documento <ArrowRight className="w-4 h-4" />
                    </a>
                  )}
                  {doc.fileUrl === 'internal://fut-digital' && (
                    <div className="mt-6 w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-slate-600 bg-slate-50 rounded-lg border border-slate-200">
                      FUT Digital Registrado
                    </div>
                  )}
                </div>
              ))}
              {results.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">No se encontraron documentos</h3>
                  <p className="text-slate-500">Intenta con otros términos de búsqueda.</p>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60 grayscale">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 h-48 animate-pulse" />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
