import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Users, 
  Shield, 
  UserCog, 
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile, UserRole } from '../types';

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('email', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateRole = async (uid: string, newRole: UserRole) => {
    try {
      if (!auth.currentUser?.uid) {
        throw new Error('Usuario no autenticado');
      }
      const previousUser = users.find(u => u.uid === uid);
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      await addDoc(collection(db, 'audit_logs'), {
        type: 'user_role_changed',
        targetUserId: uid,
        before: { role: previousUser?.role || null },
        after: { role: newRole },
        actorId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating role:", error);
      alert('No se pudo actualizar el rol del usuario.');
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" /> Administración de Usuarios
          </h2>
          <p className="text-slate-500">Gestiona los permisos y roles del personal de la institución.</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o correo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Correo</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rol Actual</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map((user) => (
              <tr key={user.uid} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName} referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Users className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <span className="font-bold text-slate-900">{user.displayName}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    user.role === 'director' ? "bg-red-100 text-red-700" :
                    user.role === 'secretaria' ? "bg-blue-100 text-blue-700" :
                    "bg-emerald-100 text-emerald-700"
                  )}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <select 
                      value={user.role}
                      onChange={(e) => updateRole(user.uid, e.target.value as UserRole)}
                      className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="docente">Docente</option>
                      <option value="secretaria">Secretaria</option>
                      <option value="mesa_partes">Mesa de Partes</option>
                      <option value="jefe_area">Jefe de Área</option>
                      <option value="subdirector">Subdirector</option>
                      <option value="director">Director</option>
                      <option value="auditor">Auditor</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredUsers.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            <UserCog className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No se encontraron usuarios que coincidan con la búsqueda.</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 flex items-start gap-4">
        <Shield className="w-6 h-6 text-blue-600 shrink-0" />
        <div>
          <h4 className="font-bold text-blue-900 text-sm mb-1">Seguridad de Roles</h4>
          <p className="text-xs text-blue-700 leading-relaxed">
            Los cambios de rol son instantáneos. Asegúrate de verificar la identidad del personal antes de otorgar permisos de <strong>Director</strong> o <strong>Secretaria</strong>, ya que estos roles tienen acceso a la Mesa de Partes y eliminación de documentos.
          </p>
        </div>
      </div>
    </div>
  );
}
