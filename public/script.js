// Mobile menu toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});

// Close menu when clicking on a link
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
    });
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Form submission
const ticketForm = document.getElementById('ticketForm');
const mensaje = document.getElementById('mensaje');

// Get CSRF token before form submission
let csrfToken = '';
async function getCsrfToken() {
    try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        csrfToken = data.csrfToken;
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
    }
}

// Fetch CSRF token on page load
document.addEventListener('DOMContentLoaded', getCsrfToken);

ticketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form data
    const formData = {
        nombre: document.getElementById('nombre').value,
        email: document.getElementById('email').value,
        telefono: document.getElementById('telefono').value,
        servicio: document.getElementById('servicio').value,
        prioridad: document.getElementById('prioridad').value,
        descripcion: document.getElementById('descripcion').value
    };

    // Disable submit button
    const submitBtn = ticketForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    try {
        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'csrf-token': csrfToken
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            // Crear múltiples enlaces de WhatsApp
            const whatsappConsulta = `https://wa.me/34624620893?text=Hola,%20tengo%20el%20ticket%20${data.ticketId}%20y%20necesito%20consultar%20el%20estado`;
            const whatsappCierre = `https://wa.me/34624620893?text=Hola,%20tengo%20el%20ticket%20${data.ticketId}%20y%20ya%20está%20resuelto.%20Por%20favor,%20pueden%20cerrarlo`;
            const whatsappGeneral = `https://wa.me/34624620893?text=Hola,%20tengo%20una%20consulta%20sobre%20mi%20ticket%20${data.ticketId}`;
            
            mensaje.className = 'mensaje exito';
            mensaje.innerHTML = `
                <i class="fas fa-check-circle"></i> 
                ¡Ticket creado exitosamente! 
                <br>Nº de Ticket: <strong>${data.ticketId}</strong>
                <br><small>Guarde este número para futuras consultas</small>
                <br>Recibirá un email de confirmación en breve.
                <div style="margin-top: 20px; padding: 20px; background: linear-gradient(135deg, #25d366, #128c7e); border-radius: 10px;">
                    <p style="color: white; margin: 0 0 15px 0; font-weight: bold; font-size: 1.1rem;">
                        <i class="fab fa-whatsapp"></i> Opciones de WhatsApp
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <a href="${whatsappConsulta}" 
                           target="_blank"
                           style="display: block; background: white; color: #128c7e; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; text-align: center;">
                            📊 Consultar Estado del Ticket
                        </a>
                        <a href="${whatsappCierre}" 
                           target="_blank"
                           style="display: block; background: rgba(255,255,255,0.9); color: #128c7e; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; text-align: center;">
                            ✅ Solicitar Cierre del Ticket
                        </a>
                        <a href="${whatsappGeneral}" 
                           target="_blank"
                           style="display: block; background: rgba(255,255,255,0.8); color: #128c7e; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; text-align: center;">
                            💬 Consulta General
                        </a>
                    </div>
                </div>
            `;
            ticketForm.reset();
        } else {
            throw new Error(data.error || 'Error al crear el ticket');
        }
    } catch (error) {
        mensaje.className = 'mensaje error';
        mensaje.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i> 
            ${error.message}
        `;
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Solicitud';
        
        // Scroll to message
        mensaje.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Clear message after 10 seconds
        setTimeout(() => {
            mensaje.className = 'mensaje';
        }, 10000);
    }
});

// Add active state to navbar on scroll
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    } else {
        navbar.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    }
});
