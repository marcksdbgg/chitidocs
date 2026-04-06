export type UserRole = 
  | 'superadmin' 
  | 'director' 
  | 'subdirector' 
  | 'mesa_partes' 
  | 'secretaria' 
  | 'jefe_area' 
  | 'docente' 
  | 'auditor';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  institutionId?: string;
  areaId?: string;
}

export type TramiteStatus = 
  | 'borrador' 
  | 'presentado' 
  | 'registrado' 
  | 'derivado' 
  | 'en_evaluacion' 
  | 'observado' 
  | 'en_subsanacion' 
  | 'subsanado' 
  | 'resuelto' 
  | 'notificado' 
  | 'archivado'
  | 'improcedente'
  | 'rechazado'
  | 'cancelado';

export type TipoTramite = 
  | 'solicitud_interna'
  | 'solicitud_director'
  | 'tramite_administrativo'
  | 'licencia_permiso'
  | 'constancia_certificado'
  | 'asunto_estudiantil'
  | 'mesa_partes_externa'
  | 'expediente_ugel'
  | 'otro';

export type TipoDocumento = 
  | 'FUT' 
  | 'Resolución Directoral (RD)' 
  | 'Memorando' 
  | 'Oficio' 
  | 'Informe' 
  | 'Acta de Evaluación' 
  | 'Nómina de Matrícula' 
  | 'Registro de Asistencia' 
  | 'Otro';

export interface Expediente {
  id: string;
  numero: string; // Ej: EXP-2024-0001
  tipo?: TipoTramite;
  asunto: string;
  estado: TramiteStatus;
  solicitanteNombre: string;
  solicitanteDni?: string;
  asignadoAId?: string; // UID del responsable principal
  responsablesIds?: string[]; // Múltiples responsables
  areaDestinoId?: string;
  institucionId?: string;
  createdAt: any;
  updatedAt: any;
  fechaVencimiento?: any;
  prioridad?: 'baja' | 'media' | 'alta';
}

export interface DocumentMetadata {
  title?: string;
  type?: TipoDocumento | string;
  date?: string;
  year?: number;
  month?: number;
  sender?: string;
  recipient?: string;
  studentName?: string;
  teacherName?: string;
  grade?: string;
  section?: string;
  involved?: string[];
  summary?: string;
  isSensitive?: boolean;
  confidence?: number;
  embedding?: number[]; // Vector para búsqueda semántica RAG
  physicalLocation?: string; // Ej: Archivo Central, Estante A, Caja 3
}

export interface FUTData {
  dependencia: string;
  tramiteSolicitado: string;
  nombres: string;
  apellidos: string;
  dni: string;
  domicilio: string;
  telefono: string;
  correo: string;
  fundamentacion: string;
  anexos: string;
}

export interface Documento {
  id: string;
  expedienteId: string;
  tramiteId?: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  metadata: DocumentMetadata;
  futData?: FUTData;
  uploadedById: string;
  createdAt: any;
}
