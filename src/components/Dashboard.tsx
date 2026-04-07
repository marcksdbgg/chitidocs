import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp
} from 'lucide-react';

export default function Dashboard({ userRole }: { userRole: string | null }) {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    observed: 0,
    recent: [] as any[]
  });

  useEffect(() => {
    const q = query(collection(db, 'tramites'), orderBy('createdAt', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const pending = docs.filter((d: any) => !['resuelto', 'archivado', 'improcedente', 'rechazado', 'cancelado'].includes(d.estado)).length;
      const completed = docs.filter((d: any) => d.estado === 'resuelto').length;
      const observed = docs.filter((d: any) => d.estado === 'observado').length;
      
      setStats({
        total: docs.length,
        pending,
        completed,
        observed,
        recent: docs.slice(0, 5)
      });
    });

    return () => unsubscribe();
  }, []);

  const statCards = [
    { label: 'Total Expedientes', value: stats.total, icon: FileText, color: 'bg-blue-500' },
    { label: 'En Evaluación', value: stats.pending, icon: Clock, color: 'bg-amber-500' },
    { label: 'Resueltos', value: stats.completed, icon: CheckCircle2, color: 'bg-emerald-500' },
    { label: 'Observados', value: stats.observed, icon: AlertCircle, color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-xl`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <TrendingUp className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Trámites Recientes</h3>
            <button className="text-blue-600 text-sm font-semibold hover:underline">Ver todos</button>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.recent.map((tramite) => (
              <div key={tramite.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{tramite.asunto}</p>
                    <p className="text-xs text-slate-500">Exp. {tramite.numero} • {tramite.solicitanteNombre}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                  tramite.estado === 'resuelto' ? 'bg-emerald-100 text-emerald-700' :
                  tramite.estado === 'en_evaluacion' ? 'bg-blue-100 text-blue-700' :
                  tramite.estado === 'observado' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {tramite.estado.replace('_', ' ')}
                </span>
              </div>
            ))}
            {stats.recent.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                No hay trámites registrados recientemente.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6">Resumen de Actividad</h3>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-2 h-12 bg-blue-500 rounded-full" />
              <div>
                <p className="text-sm font-bold text-slate-900">Auditoría UGEL</p>
                <p className="text-xs text-slate-500">Próxima semana - Preparar documentos</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-2 h-12 bg-emerald-500 rounded-full" />
              <div>
                <p className="text-sm font-bold text-slate-900">Cierre de Mes</p>
                <p className="text-xs text-slate-500">95% de trámites atendidos</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
