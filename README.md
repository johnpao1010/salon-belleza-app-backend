# Salon de Belleza - Sistema de Agendamiento de Citas

Este proyecto es un sistema de agendamiento de citas para un salón de belleza, desarrollado con Node.js, Express, y Sequelize para PostgreSQL.

## Características

- Autenticación de usuarios (registro e inicio de sesión)
- Gestión de citas (crear, ver, actualizar, cancelar)
- Gestión de servicios (uñas, cabello, maquillaje)
- Gestión de empleados/estilistas
- API RESTful

## Requisitos

- Node.js
- PostgreSQL
- npm

## Instalación

1. Clonar el repositorio
```
git clone <repositorio>
```

2. Instalar dependencias
```
npm install
```

3. Configurar variables de entorno
Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:
```
DB_NAME=salon_belleza_db
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_HOST=localhost
DB_PORT=5432
JWT_SECRET=tu_secreto_jwt
JWT_EXPIRATION=24h
```

4. Iniciar el servidor
```
npm run dev
```

## Estructura del Proyecto

```
src/
  ├── config/       # Configuración de base de datos
  ├── controllers/  # Controladores para manejar las solicitudes
  ├── middlewares/  # Middlewares (autenticación, validación)
  ├── models/       # Modelos de Sequelize
  ├── routes/       # Rutas de la API
  └── app.js        # Punto de entrada de la aplicación
```

## API Endpoints

### Autenticación
- `POST /api/auth/register`: Registrar un nuevo usuario
- `POST /api/auth/login`: Iniciar sesión

### Servicios
- `GET /api/services`: Obtener todos los servicios
- `GET /api/services/:id`: Obtener un servicio específico

### Citas
- `GET /api/appointments`: Obtener todas las citas (requiere autenticación)
- `POST /api/appointments`: Crear una nueva cita (requiere autenticación)
- `GET /api/appointments/:id`: Obtener una cita específica (requiere autenticación)
- `PUT /api/appointments/:id`: Actualizar una cita (requiere autenticación)
- `DELETE /api/appointments/:id`: Cancelar una cita (requiere autenticación)

### Empleados/Estilistas
- `GET /api/stylists`: Obtener todos los estilistas
- `GET /api/stylists/:id`: Obtener un estilista específico
