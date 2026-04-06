import { useState, useEffect } from 'react';
import { Folder, File as FileIcon, ChevronRight, Loader2, CheckSquare, Square, X, Search, HardDrive } from 'lucide-react';
import { cn } from '../lib/utils';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
}

interface DrivePickerProps {
  token: string;
  onClose: () => void;
  onImport: (files: DriveFile[]) => void;
}

export default function DrivePicker({ token, onClose, onImport }: DrivePickerProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFolder, setCurrentFolder] = useState<{id: string, name: string}>({ id: 'root', name: 'Mi Unidad' });
  const [folderHistory, setFolderHistory] = useState<{id: string, name: string}[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFiles = async (folderId: string, query: string = '') => {
    setLoading(true);
    setError(null);
    try {
      let q = `'${folderId}' in parents and trashed=false`;
      if (query) {
        q = `name contains '${query}' and trashed=false`;
      }

      const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,iconLink)&orderBy=folder,name&pageSize=100`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errData = await response.json();
        console.error("Drive API Error:", errData);
        let errorMessage = errData.error?.message || 'Failed to fetch drive files';
        if (errorMessage.includes('has not been used in project') || errorMessage.includes('is disabled')) {
          errorMessage = 'La API de Google Drive no está habilitada en tu proyecto de Firebase/Google Cloud. Debes habilitarla en la consola de Google Cloud para usar esta función.';
        } else if (errData.error?.status === 'PERMISSION_DENIED') {
          errorMessage = 'Permiso denegado. Asegúrate de haber marcado la casilla para dar acceso a Google Drive al iniciar sesión.';
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err: any) {
      console.error("Error fetching drive files", err);
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchFiles(currentFolder.id, searchQuery);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [currentFolder, searchQuery]);

  const handleNavigate = (folder: DriveFile) => {
    if (searchQuery) setSearchQuery(''); // Clear search when navigating
    setFolderHistory([...folderHistory, currentFolder]);
    setCurrentFolder({ id: folder.id, name: folder.name });
  };

  const handleNavigateBack = (index: number) => {
    if (searchQuery) setSearchQuery('');
    if (index === -1) {
      setCurrentFolder({ id: 'root', name: 'Mi Unidad' });
      setFolderHistory([]);
    } else {
      setCurrentFolder(folderHistory[index]);
      setFolderHistory(folderHistory.slice(0, index + 1));
    }
  };

  const toggleSelection = (file: DriveFile) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(file.id)) {
      newSelection.delete(file.id);
    } else {
      newSelection.add(file.id);
    }
    setSelectedFiles(newSelection);
  };

  const selectAll = () => {
    const importableFiles = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    if (selectedFiles.size === importableFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(importableFiles.map(f => f.id)));
    }
  };

  const handleImport = () => {
    const filesToImport = files.filter(f => selectedFiles.has(f.id));
    onImport(filesToImport);
  };

  const importableFilesCount = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Google Drive</h2>
              <p className="text-xs text-slate-500">Selecciona los documentos a importar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm overflow-x-auto pb-1 sm:pb-0">
            <button 
              onClick={() => handleNavigateBack(-1)}
              className={cn("hover:text-blue-600 whitespace-nowrap transition-colors", folderHistory.length === 0 ? "font-bold text-slate-900" : "text-slate-500")}
            >
              Mi Unidad
            </button>
            {folderHistory.map((folder, idx) => (
              <div key={folder.id} className="flex items-center gap-1">
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                <button 
                  onClick={() => handleNavigateBack(idx)}
                  className="text-slate-500 hover:text-blue-600 whitespace-nowrap transition-colors"
                >
                  {folder.name}
                </button>
              </div>
            ))}
            {folderHistory.length > 0 && (
              <div className="flex items-center gap-1">
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-bold text-slate-900 whitespace-nowrap">{currentFolder.name}</span>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar en Drive..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white border focus:border-blue-500 rounded-xl text-sm outline-none transition-all"
            />
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-2 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
              <p>Cargando archivos...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-500">
              <p className="font-bold mb-2">Error al cargar archivos</p>
              <p className="text-sm text-red-400 text-center max-w-md">{error}</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Folder className="w-12 h-12 mb-4 opacity-20" />
              <p>Esta carpeta está vacía o no hay resultados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-2">
              {files.map((file) => {
                const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                const isSelected = selectedFiles.has(file.id);

                return (
                  <div 
                    key={file.id}
                    onClick={() => isFolder ? handleNavigate(file) : toggleSelection(file)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none",
                      isFolder ? "bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm" : 
                      isSelected ? "bg-blue-50 border-blue-400 ring-1 ring-blue-400" : "bg-white border-slate-200 hover:border-blue-300"
                    )}
                  >
                    {!isFolder && (
                      <div className="shrink-0">
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                    )}
                    
                    <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                      {file.iconLink ? (
                        <img src={file.iconLink} alt="" className="w-6 h-6" referrerPolicy="no-referrer" />
                      ) : isFolder ? (
                        <Folder className="w-6 h-6 text-slate-400" />
                      ) : (
                        <FileIcon className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate" title={file.name}>
                        {file.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={selectAll}
              disabled={importableFilesCount === 0}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedFiles.size === importableFilesCount && importableFilesCount > 0 ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            <span className="text-sm text-slate-500">
              {selectedFiles.size} archivos seleccionados
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleImport}
              disabled={selectedFiles.size === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl transition-all shadow-sm"
            >
              Importar ({selectedFiles.size})
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
