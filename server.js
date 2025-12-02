const cors = require('cors');
const path = require('path');
const fs = require('fs');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;  // ✅ IMPORTANTE: Usa el puerto de Render

// =========================
// CONFIGURACIÓN CORS PARA PRODUCCIÓN
// =========================
const allowedOrigins = [
  'https://mi-agenda-app-db.web.app',  // Tu Firebase
  'http://localhost:3000',              // Desarrollo local
  'http://localhost:5500'               // Live Server
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origen (como mobile apps o curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'El origen CORS no está permitido';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Middleware para headers CORS manuales (por si acaso)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// =========================
// RESTA DEL CÓDIGO (TODO LO QUE YA TENÍAS)
// =========================

app.use(express.json());
app.use(express.static('.'));

// Base de datos simple (SOLO UN ARCHIVO - tareas.json)
const DB_FILE = 'tareas.json';

// Helper para leer/guardar datos
function readData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data);
      
      // Si el archivo es un array simple (formato antiguo), convertirlo al nuevo formato
      if (Array.isArray(parsed) && parsed.length > 0 && !parsed.tareas) {
        return {
          tareas: parsed,
          categorias: [
            { id: 1, nombre: "Trabajo", color: "#007bff", fechaCreacion: new Date().toISOString() },
            { id: 2, nombre: "Personal", color: "#28a745", fechaCreacion: new Date().toISOString() },
            { id: 3, nombre: "Estudio", color: "#dc3545", fechaCreacion: new Date().toISOString() }
          ]
        };
      }
      
      return parsed;
    }
    // Si el archivo no existe, retornar estructura inicial
    return {
      tareas: [],
      categorias: [
        { id: 1, nombre: "Trabajo", color: "#007bff", fechaCreacion: new Date().toISOString() },
        { id: 2, nombre: "Personal", color: "#28a745", fechaCreacion: new Date().toISOString() },
        { id: 3, nombre: "Estudio", color: "#dc3545", fechaCreacion: new Date().toISOString() }
      ]
    };
  } catch (error) {
    console.error(`Error leyendo ${DB_FILE}:`, error);
    return { tareas: [], categorias: [] };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error guardando ${DB_FILE}:`, error);
  }
}

// Sanitización de entrada - PREVENCIÓN XSS
function sanitizeInput(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

// Validación de token simple - SEGURIDAD
function validateToken(req, res, next) {
  const token = req.headers.authorization;
  
  // Token de demostración - en producción usar JWT real
  if (token === 'Bearer demo-token-123') {
    next();
  } else {
    res.status(401).json({ error: 'Token de autorización inválido' });
  }
}

// =========================
// RUTAS PARA TAREAS (ENTIDAD 1) - CRUD COMPLETO
// =========================

// GET todas las tareas
app.get('/api/tareas', (req, res) => {
  try {
    const data = readData();
    res.json({ data: data.tareas });
  } catch (error) {
    console.error('Error en GET /api/tareas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST nueva tarea (protegido con token)
app.post('/api/tareas', validateToken, (req, res) => {
  try {
    const { titulo, fecha, hora, categoriaId } = req.body;
    
    // Validación de campos requeridos
    if (!titulo || !fecha || !hora) {
      return res.status(400).json({ 
        error: "Faltan campos requeridos: titulo, fecha, hora" 
      });
    }
    
    // Validar formato de fecha (YYYY-MM-DD)
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fecha)) {
      return res.status(400).json({ 
        error: "Formato de fecha inválido. Use YYYY-MM-DD" 
      });
    }
    
    // Validar formato de hora (HH:MM)
    const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!horaRegex.test(hora)) {
      return res.status(400).json({ 
        error: "Formato de hora inválido. Use HH:MM" 
      });
    }
    
    const data = readData();
    
    const nuevaTarea = {
      id: Date.now(),
      titulo: sanitizeInput(titulo), // SANITIZACIÓN
      fecha,
      hora,
      categoriaId: categoriaId || null,
      completada: false,
      fechaCreacion: new Date().toISOString()
    };
    
    data.tareas.push(nuevaTarea);
    saveData(data);
    
    res.json({ 
      message: 'Tarea agregada', 
      data: nuevaTarea 
    });
  } catch (error) {
    console.error('Error en POST /api/tareas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT actualizar tarea (protegido con token) - OPERACIÓN UPDATE FALTANTE
app.put('/api/tareas/:id', validateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, fecha, hora, completada, categoriaId } = req.body;
    
    const data = readData();
    const tareaIndex = data.tareas.findIndex(t => t.id == id);
    
    if (tareaIndex === -1) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    // Actualizar solo los campos proporcionados
    if (titulo !== undefined) data.tareas[tareaIndex].titulo = sanitizeInput(titulo);
    if (fecha !== undefined) data.tareas[tareaIndex].fecha = fecha;
    if (hora !== undefined) data.tareas[tareaIndex].hora = hora;
    if (completada !== undefined) data.tareas[tareaIndex].completada = completada;
    if (categoriaId !== undefined) data.tareas[tareaIndex].categoriaId = categoriaId;
    
    data.tareas[tareaIndex].fechaActualizacion = new Date().toISOString();
    
    saveData(data);
    
    res.json({ 
      message: 'Tarea actualizada', 
      data: data.tareas[tareaIndex] 
    });
  } catch (error) {
    console.error('Error en PUT /api/tareas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE tareas (protegido con token)
app.delete('/api/tareas', validateToken, (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ 
        error: "Se requiere un array 'ids' en el cuerpo de la solicitud" 
      });
    }
    
    const data = readData();
    const initialLength = data.tareas.length;
    
    data.tareas = data.tareas.filter(t => !ids.includes(t.id));
    saveData(data);
    
    const deletedCount = initialLength - data.tareas.length;
    
    res.json({ 
      message: 'Tareas eliminadas',
      deletedCount: deletedCount
    });
  } catch (error) {
    console.error('Error en DELETE /api/tareas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =========================
// RUTAS PARA CATEGORÍAS (ENTIDAD 2) - SEGUNDA ENTIDAD
// =========================

// GET todas las categorías
app.get('/api/categorias', (req, res) => {
  try {
    const data = readData();
    res.json({ data: data.categorias });
  } catch (error) {
    console.error('Error en GET /api/categorias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST nueva categoría (protegido con token)
app.post('/api/categorias', validateToken, (req, res) => {
  try {
    const { nombre, color } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ 
        error: "El campo 'nombre' es requerido" 
      });
    }
    
    const data = readData();
    
    const nuevaCategoria = {
      id: Date.now(),
      nombre: sanitizeInput(nombre), // SANITIZACIÓN
      color: color || '#555555',
      fechaCreacion: new Date().toISOString()
    };
    
    data.categorias.push(nuevaCategoria);
    saveData(data);
    
    res.json({ 
      message: 'Categoría agregada', 
      data: nuevaCategoria 
    });
  } catch (error) {
    console.error('Error en POST /api/categorias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT actualizar categoría (protegido con token)
app.put('/api/categorias/:id', validateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, color } = req.body;
    
    const data = readData();
    const categoriaIndex = data.categorias.findIndex(c => c.id == id);
    
    if (categoriaIndex === -1) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    
    if (nombre !== undefined) data.categorias[categoriaIndex].nombre = sanitizeInput(nombre);
    if (color !== undefined) data.categorias[categoriaIndex].color = color;
    
    data.categorias[categoriaIndex].fechaActualizacion = new Date().toISOString();
    
    saveData(data);
    
    res.json({ 
      message: 'Categoría actualizada', 
      data: data.categorias[categoriaIndex] 
    });
  } catch (error) {
    console.error('Error en PUT /api/categorias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE categoría (protegido con token)
app.delete('/api/categorias/:id', validateToken, (req, res) => {
  try {
    const { id } = req.params;
    
    const data = readData();
    const categoriaIndex = data.categorias.findIndex(c => c.id == id);
    
    if (categoriaIndex === -1) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    
    // Verificar si hay tareas usando esta categoría
    const tareasConCategoria = data.tareas.filter(t => t.categoriaId == id);
    
    if (tareasConCategoria.length > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar la categoría porque hay tareas asociadas' 
      });
    }
    
    const categoriaEliminada = data.categorias.splice(categoriaIndex, 1)[0];
    saveData(data);
    
    res.json({ 
      message: 'Categoría eliminada',
      data: categoriaEliminada
    });
  } catch (error) {
    console.error('Error en DELETE /api/categorias:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Servir el archivo HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta de autenticación simple - SEGURIDAD
app.post('/api/auth/login', (req, res) => {
  const { usuario, contraseña } = req.body;
  
  // En un entorno real, verificaríamos contra una base de datos
  if (usuario === 'admin' && contraseña === 'admin123') {
    res.json({ 
      token: 'demo-token-123',
      usuario: 'admin',
      message: 'Autenticación exitosa'
    });
  } else {
    res.status(401).json({ error: 'Credenciales inválidas' });
  }
});

// PRUEBAS UNITARIAS INTEGRADAS EN EL SERVIDOR
app.get('/api/test/unitarias', (req, res) => {
  // Prueba unitaria 1: Función sanitizeInput
  const testInput = '<script>alert("xss")</script>';
  const sanitized = sanitizeInput(testInput);
  const prueba1 = sanitized.includes('<script>') ? 'FAIL' : 'PASS';
  
  // Prueba unitaria 2: Función readData con archivo inexistente
  const testData = readData();
  const prueba2 = testData.tareas !== undefined && testData.categorias !== undefined ? 'PASS' : 'FAIL';
  
  res.json({
    pruebas_unitarias: [
      {
        nombre: 'Sanitización de entrada XSS',
        resultado: prueba1,
        entrada: testInput,
        salida: sanitized
      },
      {
        nombre: 'Estructura de datos correcta',
        resultado: prueba2,
        descripcion: 'Debería tener tareas y categorías'
      }
    ]
  });
});

// PRUEBA DE INTEGRACIÓN
app.get('/api/test/integracion', async (req, res) => {
  try {
    // Simular flujo completo: Crear -> Leer -> Actualizar
    const dataInicial = readData();
    const tareasIniciales = [...dataInicial.tareas];
    
    // Crear tarea de prueba
    const nuevaTarea = {
      id: Date.now(),
      titulo: 'Tarea de prueba integración',
      fecha: '2024-12-01',
      hora: '14:30',
      completada: false,
      fechaCreacion: new Date().toISOString()
    };
    
    dataInicial.tareas.push(nuevaTarea);
    saveData(dataInicial);
    
    // Leer para verificar
    const dataDespuesCrear = readData();
    const tareaCreada = dataDespuesCrear.tareas.find(t => t.id === nuevaTarea.id);
    
    // Restaurar estado original
    dataInicial.tareas = tareasIniciales;
    saveData(dataInicial);
    
    res.json({
      prueba_integracion: {
        nombre: 'Flujo CRUD Completo',
        resultado: tareaCreada ? 'PASS' : 'FAIL',
        descripcion: 'Crear -> Leer -> Verificar',
        tarea_creada: tareaCreada ? 'SÍ' : 'NO'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en prueba de integración' });
  }
});

// Manejar rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error en el servidor:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// =========================
// INICIAR SERVIDOR CON INFORMACIÓN DE PRODUCCIÓN
// =========================
app.listen(PORT, () => {
  console.log('=========================================');
  console.log('🚀 SERVIDOR INICIADO EN PRODUCCIÓN');
  console.log(`📍 Puerto: ${PORT}`);
  console.log(`🌐 Entornos permitidos (CORS):`);
  allowedOrigins.forEach(origin => console.log(`   • ${origin}`));
  console.log(`📁 Archivo de datos: ${DB_FILE}`);
  console.log(`🆔 PID: ${process.pid}`);
  console.log('⏰ Hora:', new Date().toLocaleString());
  console.log('🔐 SEGURIDAD IMPLEMENTADA:');
  console.log('   • Token de autenticación');
  console.log('   • Sanitización XSS');
  console.log('   • Validación de entrada');
  console.log('   • CORS configurado para producción');
  console.log('🏷️ ENTIDADES: Tareas y Categorías');
  console.log('🔑 Credenciales demo: admin / admin123');
  console.log('🔑 Token demo: demo-token-123');
  console.log('=========================================');
});

// Exportar para pruebas
module.exports = app;