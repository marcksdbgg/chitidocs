# EduDoc Perú - Sistema de Gestión Documental Inteligente

EduDoc Perú es una plataforma moderna de gestión documental diseñada específicamente para instituciones educativas. Utiliza Inteligencia Artificial para automatizar la clasificación, extracción de metadatos y búsqueda de documentos, optimizando los flujos de trabajo administrativos.

## Características Principales

*   **Mesa de Partes Virtual:** Registro digital de trámites y expedientes.
*   **Análisis con IA (Gemini):** Extracción automática de metadatos (remitente, asunto, fechas, tipo de documento) a partir de PDFs e imágenes.
*   **Búsqueda Semántica (RAG):** Búsqueda inteligente de documentos utilizando lenguaje natural.
*   **Integración con Google Drive:** Importación directa de archivos desde la nube institucional o personal.
*   **Gestión de Roles (RBAC):** Control de acceso estricto basado en roles (Director, Mesa de Partes, Docente, etc.).
*   **Dashboard en Tiempo Real:** Estadísticas y seguimiento del estado de los trámites en vivo.

## Stack Tecnológico

*   **Frontend:** React 18, TypeScript, Vite.
*   **Estilos:** Tailwind CSS, Lucide React, Motion (Framer Motion).
*   **Backend & Base de Datos:** Firebase (Auth, Firestore).
*   **Almacenamiento:** Cloudflare R2.
*   **Inteligencia Artificial:** Google Gemini API (`@google/genai`).

## Estructura de Roles

El sistema maneja los siguientes roles, protegidos tanto en la interfaz de usuario como en las reglas de seguridad de Firestore:

*   **Superadmin / Director:** Acceso total al sistema, gestión de usuarios y eliminación de registros.
*   **Mesa de Partes / Subdirector / Secretaria:** Creación y actualización de trámites y documentos.
*   **Docente / Jefe de Área:** Visualización de documentos y actualización de trámites asignados a su persona.

## Configuración y Despliegue

### Requisitos Previos
*   Node.js (v18+)
*   Proyecto en Firebase (Firestore, Authentication con Google habilitado).
*   Bucket en Cloudflare R2.
*   API Key de Google Gemini.
*   API de Google Drive habilitada en Google Cloud Console.

### Variables de Entorno (`.env`)
Debes configurar las siguientes variables de entorno:
```env
GEMINI_API_KEY="tu_api_key_de_gemini"
VITE_R2_ACCOUNT_ID="tu_account_id"
VITE_R2_ACCESS_KEY_ID="tu_access_key"
VITE_R2_SECRET_ACCESS_KEY="tu_secret_key"
VITE_R2_BUCKET_NAME="nombre_del_bucket"
VITE_R2_PUBLIC_URL="url_publica_del_bucket"
```

### Instalación
1. Clona el repositorio.
2. Instala las dependencias: `npm install`
3. Inicia el servidor de desarrollo: `npm run dev`

## Documentación para Desarrolladores
Para entender la arquitectura interna, flujos de datos y directrices de desarrollo, por favor consulta el archivo [AGENTS.md](./AGENTS.md).
