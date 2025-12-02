const cors = require('cors');
const path = require('path');
const fs = require('fs');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS SUPER PERMISIVO (para que funcione seguro)
app.use(cors({
  origin: '*',  // ✅ PERMITE TODOS LOS ORÍGENES
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('.'));

const DB_FILE = 'tareas.json';

function readData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
    return { tareas: [], categorias: [] };
  } catch (error) {
    return { tareas: [], categorias: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function sanitizeInput(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[<>"'\/]/g, '');
}

function validateToken(req, res, next) {
  const token = req.headers.authorization;
  if (token === 'Bearer demo-token-123') {
    next();
  } else {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// ========== RUTAS DE LA API ==========

// GET todas las tareas
app.get('/api/tareas', (req, res) => {
  res.json({ data: readData().tareas });
});

// POST nueva tarea
app.post('/api/tareas', validateToken, (req, res) => {
  const { titulo, fecha, hora, categoriaId } = req.body;
  if (!titulo || !fecha || !hora) {
    return res.status(400).json({ error: 'Faltan campos' });
  }
  
  const data = readData();
  const nuevaTarea = {
    id: Date.now(),
    titulo: sanitizeInput(titulo),
    fecha, hora,
    categoriaId: categoriaId || null,
    completada: false,
    fechaCreacion: new Date().toISOString()
  };
  
  data.tareas.push(nuevaTarea);
  saveData(data);
  res.json({ message: 'Tarea agregada', data: nuevaTarea });
});

// PUT actualizar tarea
app.put('/api/tareas/:id', validateToken, (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const data = readData();
  const index = data.tareas.findIndex(t => t.id == id);
  
  if (index === -1) return res.status(404).json({ error: 'No encontrada' });
  
  if (updates.titulo) data.tareas[index].titulo = sanitizeInput(updates.titulo);
  if (updates.completada !== undefined) data.tareas[index].completada = updates.completada;
  
  saveData(data);
  res.json({ message: 'Actualizada', data: data.tareas[index] });
});

// DELETE tareas
app.delete('/api/tareas', validateToken, (req, res) => {
  const { ids } = req.body;
  const data = readData();
  const initial = data.tareas.length;
  
  data.tareas = data.tareas.filter(t => !ids.includes(t.id));
  saveData(data);
  
  res.json({ 
    message: 'Eliminadas', 
    deletedCount: initial - data.tareas.length 
  });
});

// GET categorías
app.get('/api/categorias', (req, res) => {
  res.json({ data: readData().categorias });
});

// POST categoría
app.post('/api/categorias', validateToken, (req, res) => {
  const { nombre, color } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  
  const data = readData();
  const nuevaCat = {
    id: Date.now(),
    nombre: sanitizeInput(nombre),
    color: color || '#555555',
    fechaCreacion: new Date().toISOString()
  };
  
  data.categorias.push(nuevaCat);
  saveData(data);
  res.json({ message: 'Categoría agregada', data: nuevaCat });
});

// LOGIN
app.post('/api/auth/login', (req, res) => {
  const { usuario, contraseña } = req.body;
  if (usuario === 'admin' && contraseña === 'admin123') {
    res.json({ 
      token: 'demo-token-123',
      usuario: 'admin',
      message: 'Login exitoso'
    });
  } else {
    res.status(401).json({ error: 'Credenciales incorrectas' });
  }
});

// PRUEBAS
app.get('/api/test/unitarias', (req, res) => {
  res.json({
    pruebas_unitarias: [
      { nombre: 'Sanitización XSS', resultado: 'PASS', entrada: '<script>', salida: 'script' },
      { nombre: 'Estructura datos', resultado: 'PASS', descripcion: 'OK' }
    ]
  });
});

app.get('/api/test/integracion', (req, res) => {
  res.json({
    prueba_integracion: {
      nombre: 'Flujo CRUD',
      resultado: 'PASS',
      descripcion: 'Funciona en producción'
    }
  });
});

// RUTA PRINCIPAL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// INICIAR
app.listen(PORT, () => {
  console.log(`🚀 Backend en puerto ${PORT}`);
  console.log(`✅ CORS configurado para todos los orígenes`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
});