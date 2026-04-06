import { useState, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Plus, 
  FileUp, 
  Send, 
  Loader2, 
  CheckCircle2,
  FileText,
  User,
  Hash,
  ShieldAlert,
  Zap,
  ZapOff,
  Keyboard
} from 'lucide-react';
import { analyzeDocument } from '../services/geminiService';
import { uploadToR2 } from '../services/storageService';
import { DocumentMetadata, FUTData } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function MesaDePartes() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [mode, setMode] = useState<'fisico' | 'fut'>('fisico');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    numero: `EXP-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
    asunto: '',
    solicitante: '',
    estado: 'registrado',
    fileUrl: '',
    fileName: '',
    fileType: ''
  });

  const [futData, setFutData] = useState<FUTData>({
    dependencia: '',
    tramiteSolicitado: '',
    nombres: '',
    apellidos: '',
    dni: '',
    domicilio: '',
    telefono: '',
    correo: '',
    fundamentacion: '',
    anexos: ''
  });

  const [analysis, setAnalysis] = useState<DocumentMetadata | null>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setAnalysis(null);

    try {
      // Subida real a Cloudflare R2 (Simulada por ahora)
      const r2Url = await uploadToR2(file);
      
      setFormData(prev => ({ 
        ...prev, 
        fileUrl: r2Url, 
        fileName: file.name,
        fileType: file.type 
      }));

      if (useAI) {
        const base64 = await fileToBase64(file);
        const result = await analyzeDocument(base64, file.type, file.name);
        
        if (result) {
          setAnalysis(result);
          setFormData(prev => ({ 
            ...prev, 
            asunto: result.title || prev.asunto
          }));
        }
      }
    } catch (error) {
      console.error("Upload/Analysis failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFisico = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fileUrl) return;
    
    setLoading(true);
    try {
      const tramiteRef = await addDoc(collection(db, 'tramites'), {
        numero: formData.numero,
        asunto: formData.asunto,
        solicitanteNombre: formData.solicitante,
        estado: formData.estado,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        institucionId: 'IE-DEFAULT'
      });

      await addDoc(collection(db, 'documents'), {
        tramiteId: tramiteRef.id,
        fileName: formData.fileName,
        fileUrl: formData.fileUrl,
        fileType: formData.fileType,
        metadata: analysis || {
          title: formData.asunto,
          type: 'Otro',
          date: new Date().toISOString()
        },
        uploadedById: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setFormData({
          numero: `EXP-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
          asunto: '',
          solicitante: '',
          estado: 'registrado',
          fileUrl: '',
          fileName: '',
          fileType: ''
        });
        setAnalysis(null);
      }, 3000);
    } catch (error) {
      console.error("Error saving tramite:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFUT = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const asuntoFut = futData.tramiteSolicitado || 'FUT Digital';
      const solicitanteFut = `${futData.nombres} ${futData.apellidos}`;
      
      const tramiteRef = await addDoc(collection(db, 'tramites'), {
        numero: formData.numero,
        asunto: asuntoFut,
        solicitanteNombre: solicitanteFut,
        solicitanteDni: futData.dni,
        estado: 'registrado',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        institucionId: 'IE-DEFAULT'
      });

      // Guardamos el FUT como un documento digital
      await addDoc(collection(db, 'documents'), {
        tramiteId: tramiteRef.id,
        fileName: `FUT-${formData.numero}.json`,
        fileUrl: 'internal://fut-digital', // Indicador de que es un FUT nativo
        fileType: 'application/json',
        futData: futData, // Guardamos la data estructurada
        metadata: {
          title: asuntoFut,
          type: 'FUT',
          date: new Date().toISOString(),
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          sender: solicitanteFut,
          recipient: futData.dependencia,
          involved: [solicitanteFut, futData.dependencia],
          summary: futData.fundamentacion.substring(0, 200),
          isSensitive: true // Contiene DNI y datos personales
        },
        uploadedById: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setFutData({
          dependencia: '',
          tramiteSolicitado: '',
          nombres: '',
          apellidos: '',
          dni: '',
          domicilio: '',
          telefono: '',
          correo: '',
          fundamentacion: '',
          anexos: ''
        });
        setFormData(prev => ({...prev, numero: `EXP-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`}));
      }, 3000);
    } catch (error) {
      console.error("Error saving FUT:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mesa de Partes Virtual</h1>
          <p className="text-slate-500">Recepción y digitalización de expedientes</p>
        </div>
        
        <div className="flex bg-white shadow-sm border border-slate-200 p-1 rounded-xl">
          <button
            onClick={() => setMode('fisico')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2",
              mode === 'fisico' ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <FileUp className="w-4 h-4" />
            Doc. Físico
          </button>
          <button
            onClick={() => setMode('fut')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2",
              mode === 'fut' ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <Keyboard className="w-4 h-4" />
            FUT Digital
          </button>
        </div>
      </div>

      {mode === 'fisico' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Plus className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Nuevo Expediente</h2>
                <p className="text-slate-500">Registra un nuevo trámite en la mesa de partes.</p>
              </div>
            </div>
            
            <button
              onClick={() => setUseAI(!useAI)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                useAI ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "bg-slate-100 text-slate-500"
              )}
            >
              {useAI ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              IA {useAI ? 'Activada' : 'Desactivada'}
            </button>
          </div>

          {success ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-12 text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">¡Expediente Registrado!</h3>
              <p className="text-slate-500">El trámite ha sido ingresado correctamente al sistema.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmitFisico} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Hash className="w-4 h-4" /> Número de Expediente
                  </label>
                  <input
                    type="text"
                    value={formData.numero}
                    readOnly
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <User className="w-4 h-4" /> Solicitante / Remitente
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.solicitante}
                    onChange={e => setFormData(p => ({ ...p, solicitante: e.target.value }))}
                    placeholder="Nombre completo o Institución"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Asunto del Trámite
                </label>
                <input
                  type="text"
                  required
                  value={formData.asunto}
                  onChange={e => setFormData(p => ({ ...p, asunto: e.target.value }))}
                  placeholder="Ej. Solicitud de Vacantes 1ro Primaria"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Documento Adjunto</label>
                <div className="relative group">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={cn(
                    "border-2 border-dashed rounded-2xl p-8 transition-all text-center bg-slate-50",
                    formData.fileUrl ? "border-blue-400 bg-blue-50" : "border-slate-200 group-hover:border-blue-400 group-hover:bg-blue-50"
                  )}>
                    {loading ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <p className="text-sm font-medium text-blue-600">
                          {useAI ? 'Analizando documento con IA...' : 'Cargando archivo...'}
                        </p>
                      </div>
                    ) : formData.fileUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="w-10 h-10 text-blue-600" />
                        <p className="text-sm font-bold text-slate-900">Documento Cargado</p>
                        <p className="text-xs text-slate-500">{formData.fileName}</p>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData(p => ({ ...p, fileUrl: '', fileName: '' }));
                            setAnalysis(null);
                          }}
                          className="text-xs text-red-500 font-bold hover:underline mt-2"
                        >
                          Eliminar y cambiar
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <FileUp className="w-10 h-10 text-slate-400 group-hover:text-blue-500" />
                        <div>
                          <p className="text-sm font-bold text-slate-900">Haz clic o arrastra un archivo</p>
                          <p className="text-xs text-slate-500">PDF, JPG o PNG (Máx. 10MB)</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {analysis && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={cn(
                      "rounded-xl p-4 space-y-3 border",
                      analysis.isSensitive ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "flex items-center gap-2 font-bold text-sm",
                        analysis.isSensitive ? "text-red-700" : "text-blue-700"
                      )}>
                        {analysis.isSensitive ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        IA: Información Detectada {analysis.isSensitive && '(Datos Sensibles)'}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">Confianza: {((analysis.confidence || 0) * 100).toFixed(0)}%</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-bold block text-slate-500 uppercase tracking-wider mb-1">Tipo</span>
                        <p className="text-slate-900 font-medium">{analysis.type}</p>
                      </div>
                      <div>
                        <span className="font-bold block text-slate-500 uppercase tracking-wider mb-1">Fecha</span>
                        <p className="text-slate-900 font-medium">{analysis.date}</p>
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-bold block text-xs text-slate-500 uppercase tracking-wider mb-1">Resumen</span>
                      <p className="text-xs text-slate-700 leading-relaxed">{analysis.summary}</p>
                    </div>

                    {analysis.involved && analysis.involved.length > 0 && (
                      <div>
                        <span className="font-bold block text-xs text-slate-500 uppercase tracking-wider mb-1">Involucrados</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {analysis.involved.map((name, i) => (
                            <span key={i} className="bg-white/50 px-2 py-0.5 rounded text-[10px] text-slate-600 border border-slate-200">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading || !formData.fileUrl}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Registrar Expediente
              </button>
            </form>
          )}
        </div>
      ) : (
        /* Formulario FUT Digital */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-3xl mx-auto">
          <div className="border-b border-slate-200 pb-6 mb-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900">FORMATO ÚNICO DE TRÁMITE (FUT)</h2>
            <p className="text-slate-500 mt-2">Llene los datos solicitados con claridad para iniciar el expediente digital.</p>
          </div>

          {success ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-12 text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">¡FUT Registrado!</h3>
              <p className="text-slate-500">El Formato Único de Trámite ha sido ingresado correctamente.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmitFUT} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-bold text-slate-700">1. Dependencia o Autoridad a quien se dirige</label>
                  <input
                    type="text"
                    required
                    value={futData.dependencia}
                    onChange={e => setFutData({...futData, dependencia: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Ej. Director de la I.E. San Juan"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-bold text-slate-700">2. Trámite que solicita</label>
                  <input
                    type="text"
                    required
                    value={futData.tramiteSolicitado}
                    onChange={e => setFutData({...futData, tramiteSolicitado: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Ej. Certificado de Estudios, Justificación de Inasistencia"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">3. Nombres</label>
                  <input
                    type="text"
                    required
                    value={futData.nombres}
                    onChange={e => setFutData({...futData, nombres: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Apellidos</label>
                  <input
                    type="text"
                    required
                    value={futData.apellidos}
                    onChange={e => setFutData({...futData, apellidos: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">DNI / CE</label>
                  <input
                    type="text"
                    required
                    value={futData.dni}
                    onChange={e => setFutData({...futData, dni: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Teléfono</label>
                  <input
                    type="tel"
                    value={futData.telefono}
                    onChange={e => setFutData({...futData, telefono: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-bold text-slate-700">Domicilio</label>
                  <input
                    type="text"
                    value={futData.domicilio}
                    onChange={e => setFutData({...futData, domicilio: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-bold text-slate-700">4. Fundamentación del Pedido</label>
                  <textarea
                    required
                    rows={4}
                    value={futData.fundamentacion}
                    onChange={e => setFutData({...futData, fundamentacion: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                    placeholder="Exponga los motivos de su solicitud..."
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-bold text-slate-700">5. Documentos que se adjuntan (Anexos)</label>
                  <input
                    type="text"
                    value={futData.anexos}
                    onChange={e => setFutData({...futData, anexos: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Ej. Copia de DNI, Recibo de pago"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2"><Send className="w-5 h-5" /> Generar e Ingresar FUT</span>
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
