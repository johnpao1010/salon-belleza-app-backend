const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendWelcomeEmail(user) {
    try {
      const welcomeEmail = this.getWelcomeTemplate(user);
      
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: '¡Bienvenido a Salón Belleza! 🌟',
        html: welcomeEmail,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Correo de bienvenida enviado a ${user.email}`);
    } catch (error) {
      console.error('Error al enviar correo de bienvenida:', error);
      // No lanzar el error para no interrumpir el registro
    }
  }

  getWelcomeTemplate(user) {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Bienvenido a Salón Belleza!</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
          }
          .header {
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 0 0 10px 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .benefit {
            background-color: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 25px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
          .emoji {
            font-size: 1.2em;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>¡Bienvenido a Salón Belleza! 💅✨</h1>
          <p>Estamos emocionados de tenerte con nosotros</p>
        </div>
        
        <div class="content">
          <p>¡Hola <strong>${user.first_name} ${user.last_name}</strong>!</p>
          <p>Gracias por registrarte en Salón Belleza. Tu cuenta ha sido creada exitosamente y ya puedes comenzar a disfrutar de todos nuestros servicios.</p>
          
          <h2>🎉 Beneficios de usar nuestro sistema:</h2>
          
          <div class="benefit">
            <h3><span class="emoji">📅</span> Agendamiento Fácil</h3>
            <p>Reserva tus citas desde cualquier lugar y en cualquier momento. Solo necesitas unos pocos clics para agendar tu próximo tratamiento de belleza.</p>
          </div>
          
          <div class="benefit">
            <h3><span class="emoji">💇‍♀️</span> Variedad de Servicios</h3>
            <p>Accede a nuestra completa gama de servicios: cortes de cabello, tratamientos faciales, manicura, pedicura y mucho más.</p>
          </div>
          
          <div class="benefit">
            <h3><span class="emoji">⏰</span> Gestión de Tiempo</h3>
            <p>Visualiza los horarios disponibles de nuestros especialistas y elige el momento que mejor se adapte a tu rutina.</p>
          </div>
          
          <div class="benefit">
            <h3><span class="emoji">📱</span> Recordatorios Automáticos</h3>
            <p>Recibe notificaciones sobre tus próximas citas para que nunca olvides tus appointments.</p>
          </div>
          
          <div class="benefit">
            <h3><span class="emoji">💳</span> Pagos Seguros</h3>
            <p>Realiza tus pagos de forma segura y rápida a través de nuestra plataforma.</p>
          </div>
          
          <h2>🚀 ¿Cómo empezar?</h2>
          <ol>
            <li>Inicia sesión en tu cuenta</li>
            <li>Explora nuestros servicios disponibles</li>
            <li>Elige el tratamiento que deseas</li>
            <li>Selecciona tu especialista preferido</li>
            <li>Agenda tu cita en el horario que mejor te convenga</li>
          </ol>
          
          <div style="text-align: center;">
            <a href="#" class="cta-button">Comenzar a Agendar</a>
          </div>
          
          <p>Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos. Estamos aquí para ayudarte a lucir y sentirte espectacular.</p>
          
          <div class="footer">
            <p>Con cariño,<br>El equipo de Salón Belleza 💖</p>
            <p><small>Este es un correo automático, por favor no responder a esta dirección.</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();
