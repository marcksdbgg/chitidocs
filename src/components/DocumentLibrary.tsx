import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { 
  FileText, 
  Search, 
  UploadCloud, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  FolderUp,
  Filter,
  Download,
  ShieldAlert,
  Calendar,
  User,
  HardDrive
} from 'lucide-react';
import { analyzeDocument } from '../services/geminiService';
import { uploadToR2 } from '../services/storageService';
import { Documento } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import DrivePicker, { DriveFile } from './DrivePicker';

export default function DocumentLibrary() {
  const [documents, setDocuments] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('todos');
  
  // Import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ total: 0, current: 0, currentFile: '', success: 0, failed: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drive state
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'documents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Documento)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const connectDrive = async () => {
    if (isConnectingDrive) return;
    setIsConnectingDrive(true);
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.readonly');
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (token) {
        setDriveToken(token);
        setShowDrivePicker(true);
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        console.error("Drive connection failed: popup blocked", error);
        alert("El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio e inténtalo de nuevo.");
      } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // User cancelled or closed the popup, ignore silently
      } else {
        console.error("Drive connection failed", error);
        alert("Error al conectar con Google Drive. Asegúrate de dar los permisos necesarios.");
      }
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const downloadDriveFile = async (file: DriveFile, token: string): Promise<{blob: Blob, mimeType: string, name: string}> => {
    const isGoogleWorkspace = file.mimeType.startsWith('application/vnd.google-apps.');
    let url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
    let expectedMimeType = file.mimeType;
    let finalName = file.name;

    if (isGoogleWorkspace) {
      expectedMimeType = 'application/pdf';
      url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=application/pdf`;
      finalName = `${file.name}.pdf`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to download file: ${errText}`);
    }

    const blob = await response.blob();
    return { blob, mimeType: expectedMimeType, name: finalName };
  };

  const handleDriveImport = async (selectedDriveFiles: DriveFile[]) => {
    setShowDrivePicker(false);
    if (!selectedDriveFiles || selectedDriveFiles.length === 0) return;

    setImporting(true);
    setImportProgress({ total: selectedDriveFiles.length, current: 0, currentFile: '', success: 0, failed: 0 });

    for (let i = 0; i < selectedDriveFiles.length; i++) {
      const driveFile = selectedDriveFiles[i];
      setImportProgress(p => ({ ...p, current: i + 1, currentFile: driveFile.name }));

      try {
        const { blob, mimeType, name } = await downloadDriveFile(driveFile, driveToken!);
        
        if (blob.size > 10 * 1024 * 1024) {
             console.warn(`File ${name} is too large`);
             setImportProgress(p => ({ ...p, failed: p.failed + 1 }));
             continue;
        }

        const file = new File([blob], name, { type: mimeType });
        const r2Url = await uploadToR2(file);
        const base64 = await fileToBase64(file);
        const metadata = await analyzeDocument(base64, file.type, file.name);

        await addDoc(collection(db, 'documents'), {
          fileName: file.name,
          fileUrl: r2Url,
          fileType: file.type,
          metadata: metadata || {
            title: file.name,
            type: 'Otro',
            date: new Date().toISOString()
          },
          uploadedById: auth.currentUser?.uid,
          createdAt: serverTimestamp(),
          originalPath: `Google Drive/${driveFile.name}`
        });

        setImportProgress(p => ({ ...p, success: p.success + 1 }));
      } catch (error) {
        console.error(`Error importing ${driveFile.name}:`, error);
        setImportProgress(p => ({ ...p, failed: p.failed + 1 }));
      }
    }

    setImporting(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    setImportProgress({ total: files.length, current: 0, currentFile: '', success: 0, failed: 0 });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setImportProgress(p => ({ ...p, current: i + 1, currentFile: file.name }));

      try {
        // Skip files larger than 10MB to avoid Gemini payload limits
        if (file.size > 10 * 1024 * 1024) {
             console.warn(`File ${file.name} is too large`);
             setImportProgress(p => ({ ...p, failed: p.failed + 1 }));
             continue;
        }

        const r2Url = await uploadToR2(file);
        const base64 = await fileToBase64(file);
        const metadata = await analyzeDocument(base64, file.type, file.name);

        await addDoc(collection(db, 'documents'), {
          fileName: file.name,
          fileUrl: r2Url,
          fileType: file.type,
          metadata: metadata || {
            title: file.name,
            type: 'Otro',
            date: new Date().toISOString()
          },
          uploadedById: auth.currentUser?.uid,
          createdAt: serverTimestamp(),
          originalPath: file.webkitRelativePath || file.name
        });

        setImportProgress(p => ({ ...p, success: p.success + 1 }));
      } catch (error) {
        console.error(`Error importing ${file.name}:`, error);
        setImportProgress(p => ({ ...p, failed: p.failed + 1 }));
      }
    }

    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = 
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.metadata?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.metadata?.summary?.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesType = filterType === 'todos' || doc.metadata?.type === filterType;
    
    return matchesSearch && matchesType;
  });

  const documentTypes = Array.from(new Set(documents.map(d => d.metadata?.type).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <FolderUp className="w-8 h-8 text-blue-600" /> Biblioteca de Documentos
          </h2>
          <p className="text-slate-500">Gestiona e importa documentos masivamente para indexación con IA.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleBulkImport}
            className="hidden"
            multiple
            // @ts-ignore - webkitdirectory is non-standard but widely supported
            webkitdirectory="true"
            directory="true"
          />
          <button
            onClick={connectDrive}
            disabled={importing || isConnectingDrive}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:bg-slate-100 text-slate-700 font-bold px-6 py-2.5 rounded-xl transition-all shadow-sm"
          >
            {isConnectingDrive ? <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> : <HardDrive className="w-5 h-5 text-blue-600" />}
            {isConnectingDrive ? 'Conectando...' : 'Conectar Drive'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-sm"
          >
            {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
            Importar Local
          </button>
        </div>
      </div>

      {showDrivePicker && driveToken && (
        <DrivePicker 
          token={driveToken} 
          onClose={() => setShowDrivePicker(false)} 
          onImport={handleDriveImport} 
        />
      )}

      {importing && (
        <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              Importando Documentos...
            </h3>
            <span className="text-sm font-bold text-blue-600">
              {importProgress.current} / {importProgress.total}
            </span>
          </div>
          
          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-4 overflow-hidden">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
            ></div>
          </div>
          
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="truncate max-w-[60%]">Procesando: {importProgress.currentFile}</span>
            <div className="flex items-center gap-3">
              <span className="text-emerald-600 font-medium">{importProgress.success} exitosos</span>
              <span className="text-red-500 font-medium">{importProgress.failed} fallidos</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, título o contenido..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
          >
            <option value="todos">Todos los tipos</option>
            {documentTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredDocs.map((doc) => (
              <motion.div 
                key={doc.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition-colors shrink-0">
                    <FileText className="w-5 h-5 text-blue-600 group-hover:text-white" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase truncate max-w-[120px]">
                      {doc.metadata?.type || 'Documento'}
                    </span>
                    {doc.metadata?.isSensitive && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Sensible
                      </span>
                    )}
                  </div>
                </div>
                
                <h4 className="font-bold text-slate-900 mb-1 line-clamp-2" title={doc.metadata?.title || doc.fileName}>
                  {doc.metadata?.title || doc.fileName}
                </h4>
                
                <p className="text-xs text-slate-500 mb-4 line-clamp-2 flex-1">
                  {doc.metadata?.summary || 'Sin resumen disponible'}
                </p>
                
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 mt-auto">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Calendar className="w-3 h-3 shrink-0" /> 
                    <span className="truncate">{doc.metadata?.date || new Date(doc.createdAt?.toDate()).toLocaleDateString() || 'Sin fecha'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <User className="w-3 h-3 shrink-0" /> 
                    <span className="truncate">{doc.metadata?.sender || doc.metadata?.involved?.[0] || 'N/A'}</span>
                  </div>
                </div>
                
                {doc.fileUrl !== 'internal://fut-digital' && (
                  <a 
                    href={doc.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Descargar
                  </a>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          
          {filteredDocs.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400">
              <FolderUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No se encontraron documentos.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
