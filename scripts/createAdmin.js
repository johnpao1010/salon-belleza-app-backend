const { User } = require('../src/models');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const createAdmin = async () => {
  try {
    console.log('Iniciando creación de usuario administrador...');
    
    const adminData = {
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@salonbelleza.com',
      password: await bcrypt.hash('Admin123!', 12), // Cambia esta contraseña después
      phone: '1234567890',
      role: 'admin',
      is_active: true,
      email_verified: true
    };
    
    console.log('Verificando si ya existe un administrador...');
    const existingAdmin = await User.findOne({ where: { email: adminData.email } });
    
    if (existingAdmin) {
      console.log('⚠️  Ya existe un usuario administrador con este correo electrónico.');
      console.log('Datos del administrador existente:', {
        id: existingAdmin.id,
        email: existingAdmin.email,
        role: existingAdmin.role,
        is_active: existingAdmin.is_active
      });
    } else {
      console.log('Creando nuevo usuario administrador...');
      const admin = await User.create(adminData);
      console.log('✅ Usuario administrador creado exitosamente!');
      console.log({
        id: admin.id,
        email: admin.email,
        role: admin.role,
        is_active: admin.is_active
      });
    }
  } catch (error) {
    console.error('❌ Error al crear el usuario administrador:', error.message);
    if (error.errors) {
      console.error('Errores de validación:', error.errors.map(e => e.message));
    }
  } finally {
    // Cerrar la conexión a la base de datos
    const sequelize = require('../src/config/database');
    await sequelize.close();
    console.log('Conexión a la base de datos cerrada.');
  }
};

// Ejecutar el script
createAdmin().then(() => {
  console.log('Proceso completado.');
  process.exit();
});
