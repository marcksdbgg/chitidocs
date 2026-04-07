import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, doc, getDocs, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  User,
  ArrowRight,
  MoreVertical,
  Filter,
  Search,
  ChevronRight,
  Loader2,
  Download,
  ShieldAlert
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Documento } from '../types';

export default function TramiteList({ userRole, userId }: { userRole: string | null, userId: string }) {
  const [tramites, setTramites] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');
  const [selectedTramite, setSelectedTramite] = useState<any | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<Documento[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'tramites'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTramites(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // Fetch users for assignment
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchUsers();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedTramite) {
      setSelectedDocuments([]);
      return;
    }

    setLoadingDocs(true);
    const q = query(collection(db, 'documents'), where('tramiteId', '==', selectedTramite.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSelectedDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Documento)));
      setLoadingDocs(false);
    });

    return () => unsubscribe();
  }, [selectedTramite]);

  const updateStatus = async (tramiteId: string, newStatus: string) => {
    const current = tramites.find(t => t.id === tramiteId);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'tramites', tramiteId), {
        estado: newStatus,
        updatedAt: serverTimestamp()
      });
      batch.set(doc(collection(db, 'audit_logs')), {
        type: 'tramite_status_changed',
        tramiteId,
        before: { estado: current?.estado || null },
        after: { estado: newStatus },
        actorId: userId,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('No se pudo actualizar el estado del trámite.');
    }
  };

  const assignTo = async (tramiteId: string, assignedUserId: string) => {
    const current = tramites.find(t => t.id === tramiteId);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'tramites', tramiteId), {
        asignadoAId: assignedUserId,
        // Al derivar, el flujo institucional considera el trámite en estado "derivado".
        estado: 'derivado',
        updatedAt: serverTimestamp()
      });
      batch.set(doc(collection(db, 'audit_logs')), {
        type: 'tramite_assigned',
        tramiteId,
        before: { asignadoAId: current?.asignadoAId || null },
        after: { asignadoAId: assignedUserId },
        actorId: userId,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      console.error('Error assigning tramite:', error);
      alert('No se pudo derivar el trámite.');
    }
  };

  const filteredTramites = tramites.filter(t => {
    if (filter === 'todos') return true;
    if (filter === 'mis-tramites') return t.asignadoAId === userId;
    return t.estado === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {['todos', 'registrado', 'derivado', 'en_evaluacion', 'observado', 'resuelto', 'archivado', 'mis-tramites'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all",
                filter === f 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {f.replace('-', ' ').replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar expediente..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {filteredTramites.map((tramite) => (
            <div 
              key={tramite.id} 
              onClick={() => setSelectedTramite(tramite)}
              className={cn(
                "bg-white p-6 rounded-2xl border transition-all cursor-pointer group",
                selectedTramite?.id === tramite.id ? "border-blue-500 ring-4 ring-blue-50 shadow-md" : "border-slate-200 hover:border-blue-300 shadow-sm"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    tramite.estado === 'resuelto' ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
                  )}>
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{tramite.asunto}</h4>
                    <p className="text-xs text-slate-500 font-mono">EXP: {tramite.numero} • {tramite.solicitanteNombre}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider",
                  tramite.estado === 'resuelto' ? "bg-emerald-100 text-emerald-700" :
                  tramite.estado === 'en_evaluacion' ? "bg-blue-100 text-blue-700" :
                  tramite.estado === 'observado' ? "bg-amber-100 text-amber-700" :
                  "bg-slate-100 text-slate-700"
                )}>
                  {tramite.estado.replace('_', ' ')}
                </span>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <User className="w-3.5 h-3.5" /> 
                  Asignado a: {users.find(u => u.id === tramite.asignadoAId)?.displayName || 'Sin asignar'}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
          {filteredTramites.length === 0 && (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400">
              No hay trámites que coincidan con el filtro.
            </div>
          )}
        </div>

        <div className="space-y-6">
          {selectedTramite ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-24">
              <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" /> Gestión de Trámite
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-3 block">Actualizar Estado</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['en_evaluacion', 'observado', 'resuelto', 'archivado'].map(s => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selectedTramite.id, s)}
                        className={cn(
                          "px-3 py-2 rounded-lg text-xs font-bold transition-all border",
                          selectedTramite.estado === s 
                            ? "bg-blue-600 text-white border-blue-600" 
                            : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                        )}
                      >
                        {s.replace('_', ' ').toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {['director', 'subdirector', 'mesa_partes', 'secretaria', 'jefe_area'].includes(userRole || '') && (
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-3 block">Derivar a Docente / Responsable</label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      onChange={(e) => assignTo(selectedTramite.id, e.target.value)}
                      value={selectedTramite.asignadoAId || ''}
                    >
                      <option value="">Seleccionar Responsable</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.displayName} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Documentos Adjuntos */}
                <div className="pt-6 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-400 uppercase mb-3 block">Documentos Adjuntos</label>
                  {loadingDocs ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
                  ) : selectedDocuments.length > 0 ? (
                    <div className="space-y-3">
                      {selectedDocuments.map(doc => (
                        <div key={doc.id} className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 font-medium text-slate-700">
                              <FileText className="w-4 h-4 text-blue-500" />
                              <span className="truncate max-w-[150px]">{doc.fileName}</span>
                            </div>
                            {doc.fileUrl !== 'internal://fut-digital' && (
                              <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">
                                <Download className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                          
                          {doc.metadata?.isSensitive && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded mb-2 w-fit">
                              <ShieldAlert className="w-3 h-3" /> Contiene datos sensibles
                            </div>
                          )}

                          {doc.futData ? (
                            <div className="text-xs text-slate-600 space-y-1 mt-2 bg-white p-2 rounded border border-slate-100">
                              <p><span className="font-bold">FUT Digital</span></p>
                              <p><span className="font-semibold">DNI:</span> {doc.futData.dni}</p>
                              <p><span className="font-semibold">Tel:</span> {doc.futData.telefono}</p>
                              <p><span className="font-semibold">Fundamentación:</span> {doc.futData.fundamentacion}</p>
                            </div>
                          ) : doc.metadata && (
                            <div className="text-xs text-slate-500 line-clamp-2 mt-1">
                              {doc.metadata.summary}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No hay documentos adjuntos.</p>
                  )}
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-2 italic">Última actualización: {new Date(selectedTramite.updatedAt || selectedTramite.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 rounded-2xl border border-blue-100 p-8 text-center text-blue-600">
              <AlertCircle className="w-10 h-10 mx-auto mb-4 opacity-50" />
              <p className="text-sm font-bold">Selecciona un trámite para ver detalles y gestionar acciones.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
