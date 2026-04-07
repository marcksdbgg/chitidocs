/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  FileText, 
  Search, 
  PlusCircle, 
  LogOut, 
  User as UserIcon,
  Loader2,
  School,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Components
import Dashboard from './components/Dashboard';
import MesaDePartes from './components/MesaDePartes';
import DocumentSearch from './components/DocumentSearch';
import TramiteList from './components/TramiteList';
import UserManagement from './components/UserManagement';
import DocumentLibrary from './components/DocumentLibrary';
import { FolderUp } from 'lucide-react';

type View = 'dashboard' | 'mesa-de-partes' | 'search' | 'tramites' | 'users' | 'library';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Get or create user profile
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          const defaultRole = currentUser.email === 'mark.romero.dev@gmail.com' ? 'director' : 'auditor';
          const newUser = {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            role: defaultRole,
            photoURL: currentUser.photoURL
          };
          await setDoc(userRef, newUser);
          setUserRole(defaultRole);
        } else {
          setUserRole(userSnap.data().role);
        }
        setUser(currentUser);
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = () => signOut(auth);
  const isBasicRole = userRole === 'auditor';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <School className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">EduDoc Perú</h1>
          <p className="text-slate-500 mb-8">Sistema de Gestión Documental Inteligente para Instituciones Educativas</p>
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-all shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Ingresar con Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (isBasicRole) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Acceso pendiente de asignación</h1>
          <p className="text-slate-600 mb-6">
            Tu cuenta fue creada con rol básico y no tiene acceso operativo aún. El Director debe asignarte un rol para habilitar módulos del sistema.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-slate-700"><span className="font-semibold">Usuario:</span> {user.email}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold">Rol actual:</span> {userRole}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all text-sm font-medium border border-slate-200"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tramites', label: 'Trámites', icon: FileText },
    { id: 'search', label: 'Búsqueda IA', icon: Search },
    { id: 'library', label: 'Biblioteca', icon: FolderUp },
    ...(['director', 'subdirector', 'mesa_partes', 'secretaria'].includes(userRole || '') ? [
      { id: 'mesa-de-partes', label: 'Mesa de Partes', icon: PlusCircle }
    ] : []),
    ...(['superadmin', 'director'].includes(userRole || '') ? [
      { id: 'users', label: 'Usuarios', icon: Users }
    ] : [])
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <School className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-lg">EduDoc</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                activeView === item.id 
                  ? "bg-blue-50 text-blue-600" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="w-full h-full p-2 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 capitalize">{userRole}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="text-lg font-bold text-slate-900 capitalize">
            {navItems.find(i => i.id === activeView)?.label}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
              IE 2024 - UGEL 03
            </span>
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeView === 'dashboard' && <Dashboard userRole={userRole} onNavigateToTramites={() => setActiveView('tramites')} />}
              {activeView === 'tramites' && <TramiteList userRole={userRole} userId={user.uid} />}
              {activeView === 'search' && <DocumentSearch />}
              {activeView === 'library' && <DocumentLibrary />}
              {activeView === 'mesa-de-partes' && <MesaDePartes />}
              {activeView === 'users' && <UserManagement />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
