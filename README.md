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

`JWT_SECRET` es obligatorio: el servidor no arranca sin él.

Para recuperar la contraseña se envía un enlace por correo (SendGrid) que vence en 1 hora y sirve una sola vez. Requiere `SENDGRID_API_KEY`, `EMAIL_FROM` y `FRONTEND_URL`, la URL pública del panel web (por ejemplo `https://estilistafront.onrender.com`).

4. Iniciar el servidor
```
npm run dev
```
Al arrancar se aplican las migraciones pendientes de `src/database/migrations`.

## Migraciones

El esquema se maneja con migraciones (Umzug, formato sequelize-cli), no con `sequelize.sync`.
```
npm run migrate          # aplica migraciones pendientes
npm run migrate:undo     # revierte la última
npm run migrate:status   # lista ejecutadas y pendientes
```
Para un cambio de esquema, agrega un archivo `src/database/migrations/YYYYMMDDHHMMSS-descripcion.js` con `up(queryInterface, Sequelize)` y `down(...)`.

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

## Establecimientos (multi-salón)

Todos los salones comparten la misma base de datos. Cada servicio y cita tiene `business_id`, y los usuarios se asocian a un salón con `business_members` (`owner`, `admin` o `employee`). Los clientes son globales y pueden reservar en cualquier salón.

- El salón activo se envía con el header `X-Business-Id` (o `?business_id=`). Si el usuario pertenece a un solo salón y no envía el header, se usa ese salón.
- `users.role = 'admin'` queda como administrador de la plataforma y puede gestionar cualquier salón.
- Endpoints: `GET /api/v1/businesses`, `GET /api/v1/businesses/:idOrSlug`, `GET /api/v1/businesses/mine`, `POST /api/v1/businesses` (quien lo crea queda como `owner`), `PATCH /api/v1/businesses/:id`, y `GET|POST /api/v1/businesses/:id/members`, `PATCH|DELETE /api/v1/businesses/:id/members/:userId`.
- El horario (`opening_time`, `closing_time`) y la zona horaria (`timezone`) salen de cada salón.
