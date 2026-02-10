// State for invoice linking
let currentTicketIdForInvoice = null;
let currentEmpresaIdForInvoice = null;

async function createInvoiceForTicket(ticketId) {
    try {
        // 1. Get ticket details to check for empresa
        const response = await fetch(`/api/tickets/${ticketId}`);
        if (!response.ok) throw new Error('No se pudo obtener la información del ticket');
        const ticket = await response.json();

        currentTicketIdForInvoice = ticketId;
        currentEmpresaIdForInvoice = ticket.empresa_id;

        // 2. If ticket has an empresa, check for draft invoices
        if (currentEmpresaIdForInvoice) {
            const draftResponse = await fetch(`/api/empresas/${currentEmpresaIdForInvoice}/invoices/draft`);
            if (draftResponse.ok) {
                const drafts = await draftResponse.json();
                if (drafts.length > 0) {
                    // Show modal to choose between new or append
                    showLinkInvoiceModal(drafts);
                    return;
                }
            }
        }

        // 3. Fallback to default (create new) if no empresa or no drafts
        const userConfirmed = await showConfirm('¿Está seguro de que desea crear una factura para este ticket? Se utilizarán las horas y materiales registrados.', 'Crear Factura');
        if (!userConfirmed) return;

        await executeCreateInvoice(ticketId);

    } catch (error) {
        console.error('Error in createInvoiceForTicket:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

async function executeCreateInvoice(ticketId, targetInvoiceId = null) {
    try {
        const response = await fetch(`/api/tickets/${ticketId}/invoices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
            body: JSON.stringify({
                iva_percent: 21,
                targetInvoiceId: targetInvoiceId
            })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error);
        }

        const msg = targetInvoiceId ? `Conceptos añadidos a la factura ${targetInvoiceId}` : `Factura ${result.invoiceId} creada exitosamente.`;
        showNotification(msg, 'success');
        viewTicket(ticketId); // Recargar los detalles del ticket para mostrar la nueva factura

    } catch (error) {
        console.error('Error executing invoice operation:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

function showLinkInvoiceModal(drafts) {
    const modal = document.getElementById('linkInvoiceModal');
    const select = document.getElementById('targetInvoiceIdSelect');

    // Reset options
    select.innerHTML = '';
    drafts.forEach(d => {
        const option = document.createElement('option');
        option.value = d.factura_id;
        option.textContent = `${d.factura_id} - ${d.cliente_nombre} (${d.total.toFixed(2)} €)`;
        select.appendChild(option);
    });

    // Reset radio buttons
    document.querySelector('input[name="invoiceOption"][value="new"]').checked = true;
    toggleInvoiceSelect(false);

    modal.style.display = 'block';
}

function closeLinkInvoiceModal() {
    document.getElementById('linkInvoiceModal').style.display = 'none';
}

function toggleInvoiceSelect(show) {
    document.getElementById('targetInvoiceSelectContainer').style.display = show ? 'block' : 'none';
}

async function confirmCreateOrAppendInvoice() {
    const option = document.querySelector('input[name="invoiceOption"]:checked').value;
    let targetInvoiceId = null;

    if (option === 'append') {
        targetInvoiceId = document.getElementById('targetInvoiceIdSelect').value;
        if (!targetInvoiceId) {
            showNotification('Debe seleccionar una factura de destino', 'warning');
            return;
        }
    } else {
        const confirmed = await showConfirm('¿Crear una nueva factura independiente para este ticket?', 'Nueva Factura');
        if (!confirmed) return;
    }

    closeLinkInvoiceModal();
    await executeCreateInvoice(currentTicketIdForInvoice, targetInvoiceId);
}

async function viewInvoice(invoiceId) {
    try {
        const response = await fetch(`/api/invoices/${invoiceId}`);
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error);
        }
        const invoice = await response.json();

        const itemsHtml = invoice.items.map(item => `
                    <tr>
                        <td>${item.concepto}</td>
                        <td>${item.descripcion || ''}</td>
                        <td style="text-align: right;">${item.cantidad}</td>
                        <td style="text-align: right;">${item.precio_unitario.toFixed(2)} €</td>
                        <td style="text-align: right;">${item.total.toFixed(2)} €</td>
                    </tr>
                `).join('');

        const detailsHtml = `
                    <div class="invoice-premium-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; border-bottom: 2px solid #2563eb; padding-bottom: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="background: #2563eb; color: white; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                                <i class="fas fa-building"></i>
                            </div>
                            <div>
                                <h2 style="margin: 0; font-size: 1.5rem; color: #1e40af; letter-spacing: -0.02em;">${invoice.emisor_nombre || 'FONT MULTISERVEIS'}</h2>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <h1 style="margin: 0; font-size: 2.2rem; color: #e5e7eb; font-weight: 900; line-height: 1; letter-spacing: 0.1em;">FACTURA</h1>
                            <div style="margin-top: 0.5rem; font-family: monospace; font-size: 1.1rem; color: #1e40af; font-weight: bold;">
                                ${invoice.factura_id}
                            </div>
                        </div>
                    </div>

                    <div class="invoice-addresses-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; margin-bottom: 2rem;">
                        <div class="address-box">
                            <h4 style="text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.1em; color: #2563eb; margin: 0 0 0.75rem 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.4rem;">Información del Emisor</h4>
                            <div style="font-size: 0.9rem; line-height: 1.6; color: #334155;">
                                <strong style="color: #1e293b; font-size: 1rem;">${invoice.emisor_nombre || 'FONT MULTISERVEIS'}</strong><br>
                                CIF: ${invoice.emisor_cif || '-'}<br>
                                ${invoice.emisor_direccion || 'C/ Ejemplo, 123, 08001 Barcelona'}<br>
                                ${invoice.emisor_telefono ? `<i class="fas fa-phone" style="font-size: 0.8rem; opacity: 0.7;"></i> ${invoice.emisor_telefono}<br>` : ''}
                                ${invoice.emisor_email ? `<i class="fas fa-envelope" style="font-size: 0.8rem; opacity: 0.7;"></i> ${invoice.emisor_email}` : ''}
                            </div>
                        </div>
                        <div class="address-box">
                            <h4 style="text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.1em; color: #2563eb; margin: 0 0 0.75rem 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.4rem;">Información del Cliente</h4>
                            <div style="font-size: 0.9rem; line-height: 1.6; color: #334155;">
                                <strong style="color: #1e293b; font-size: 1rem;">${invoice.cliente_nombre}</strong><br>
                                ${invoice.cliente_cif ? `CIF/NIF: ${invoice.cliente_cif}<br>` : ''}
                                ${invoice.cliente_direccion ? `${invoice.cliente_direccion}<br>` : ''}
                                ${invoice.cliente_telefono ? `<i class="fas fa-phone" style="font-size: 0.8rem; opacity: 0.7;"></i> ${invoice.cliente_telefono}<br>` : ''}
                                <i class="fas fa-envelope" style="font-size: 0.8rem; opacity: 0.7;"></i> ${invoice.cliente_email}<br>
                                ${invoice.rectifica_factura_id ? `<div style="margin-top: 0.5rem; padding: 0.5rem; background: #fee2e2; color: #991b1b; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">RECUPIERA: ${invoice.rectifica_factura_id}</div>` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="invoice-meta-strip" style="display: flex; justify-content: space-between; background: #f8fafc; padding: 1rem 1.5rem; border-radius: 8px; margin-bottom: 2rem; border: 1px solid #e2e8f0;">
                        <div style="display: flex; gap: 3rem;">
                            <div>
                                <span style="font-size: 0.7rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Fecha Emisión</span>
                                <div style="font-weight: 600; color: #1e293b;">${new Date(invoice.fecha_emision).toLocaleDateString('es-ES')}</div>
                            </div>
                            <div>
                                <span style="font-size: 0.7rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Vencimiento</span>
                                <div style="font-weight: 600; color: #1e293b;">${new Date(new Date(invoice.fecha_emision).getTime() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES')}</div>
                            </div>
                        </div>
                        <div>
                            <span style="font-size: 0.7rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Estado</span>
                            <div><span class="badge badge-${invoice.estado}" style="text-transform: uppercase; padding: 4px 12px; font-weight: 800; font-size: 0.7rem;">${invoice.estado}</span></div>
                        </div>
                    </div>
                    <div style="margin-top: 2rem;">
                        <h4 style="margin-bottom: 1rem;">Conceptos</h4>
                        <table class="users-table">
                            <thead>
                                <tr>
                                    <th>Concepto</th>
                                    <th>Descripción</th>
                                    <th style="text-align: right;">Cantidad</th>
                                    <th style="text-align: right;">P. Unit.</th>
                                    <th style="text-align: right;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>
                    </div>
                    <div style="margin-top: 2rem; display: flex; flex-direction: column; align-items: center; gap: 2rem;">
                    <div class="invoice-summary-section" style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 3rem; border-top: 2px solid #f1f5f9; padding-top: 2rem;">
                <div class="verifactu-container-centered" style="${invoice.hash ? 'margin: 0; text-align: left;' : 'display: none;'}">
                    <div class="verifactu-badge">
                        <i class="fas fa-check-circle"></i> VERI*FACTU
                    </div>
                    <div class="verifactu-content" style="flex-direction: row; align-items: center; gap: 1.5rem;">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/v1/qr/v1/verificar?id=${invoice.factura_id}&nif=${invoice.emisor_cif}&fecha=${invoice.fecha_emision.substring(0, 10)}&total=${invoice.total}&hash=${invoice.hash.substring(0, 8).toUpperCase()}`)}" alt="QR Veri*Factu" class="verifactu-qr" style="width: 80px; height: 80px; margin: 0;">
                        <div class="verifactu-hash" style="border: none; background: transparent; padding: 0;">
                            <strong style="font-size: 0.7rem; color: #64748b; text-transform: uppercase;">Huella Digital</strong><br>
                            <span style="font-family: monospace; font-size: 1.2rem; font-weight: bold; color: #1e293b;">${invoice.hash.substring(0, 8).toUpperCase()}</span>
                        </div>
                    </div>
                    <div class="verifactu-footer" style="text-align: left;">
                        Verificación rápida mediante código QR o huella AEAT
                    </div>
                </div>
                
                <div class="invoice-totals-box" style="min-width: 300px; background: #1e40af; color: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(30, 64, 175, 0.2);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.95rem; opacity: 0.9;">
                        <span>Subtotal Base</span>
                        <span>${invoice.subtotal.toFixed(2)} €</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 0.95rem; opacity: 0.9;">
                        <span>IVA Aplicado (21%)</span>
                        <span>${invoice.iva.toFixed(2)} €</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 1rem;">
                        <span style="font-weight: 600; font-size: 1.1rem;">TOTAL FACTURA</span>
                        <span style="font-size: 1.8rem; font-weight: 900;">${invoice.total.toFixed(2)} €</span>
                    </div>
                </div>
            </div>
                    </div>
            <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end; border-top: 1px solid #e5e7eb; padding-top: 1.5rem;" class="no-print">
                ${invoice.presentada === 1 && !invoice.factura_id.startsWith('ABO-') ? `
                    <button class="btn" style="background: #ef4444;" onclick="handleCreateAbono(${invoice.id})">
                        <i class="fas fa-undo"></i> Crear Factura de Abono
                    </button>
                ` : ''}
                <button class="btn" style="background: #3b82f6;" onclick="printInvoice()">
                    <i class="fas fa-print"></i> Imprimir Factura
                </button>
            </div>
        `;

        document.getElementById('invoiceDetails').innerHTML = detailsHtml;

        // Apply saved format preference
        const savedFormat = sessionStorage.getItem('invoice_format_preference') || 'standard';
        const formatSelector = document.getElementById('invoiceFormatSelector');
        if (formatSelector) {
            formatSelector.value = savedFormat;
            updateInvoiceFormat(savedFormat);
        }

        document.getElementById('invoiceModal').classList.add('active');

    } catch (error) {
        console.error('Error viewing invoice:', error);
        showNotification('Error al ver la factura: ' + error.message, 'error');
    }
}

function closeInvoiceModal() {
    document.getElementById('invoiceModal').classList.remove('active');
}

function printInvoice() {
    window.print();
}

/**
 * Updates the invoice layout format (standard or compact)
 * @param {string} format - 'standard' or 'compact'
 */
function updateInvoiceFormat(format) {
    const detailsContainer = document.getElementById('invoiceDetails');
    if (!detailsContainer) return;

    if (format === 'compact') {
        detailsContainer.classList.add('invoice-compact');
    } else {
        detailsContainer.classList.remove('invoice-compact');
    }

    // Persist preference in session
    sessionStorage.setItem('invoice_format_preference', format);
}
// ==================== MODERN NOTIFICATION SYSTEM ====================

// Create notification container on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('notificationContainer')) {
        const container = document.createElement('div');
        container.id = 'notificationContainer';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
});

/**
 * Show a modern notification
 * @param {string} message - The message to display
 * @param {string} type - Type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in ms (0 = manual close only)
 * @param {string} title - Optional title
 */
function showNotification(message, type = 'info', duration = 5000, title = '') {
    const container = document.getElementById('notificationContainer') || (() => {
        const c = document.createElement('div');
        c.id = 'notificationContainer';
        c.className = 'notification-container';
        document.body.appendChild(c);
        return c;
    })();

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    const titles = {
        success: title || 'Éxito',
        error: title || 'Error',
        warning: title || 'Advertencia',
        info: title || 'Información'
    };

    const notification = document.createElement('div');
    notification.className = `notification ${type} `;
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas ${icons[type]}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${titles[type]}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
        `;

    container.appendChild(notification);

    // Auto-remove after duration (only if duration is greater than 0)
    if (duration !== 0 && duration > 0) {
        setTimeout(() => {
            notification.classList.add('hiding');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    return notification;
}

// ==================== END NOTIFICATION SYSTEM ====================

/**
 * Show a custom modern confirmation dialog
 * @param {string} message - The message to display
 * @param {string} title - The title of the dialog
 * @returns {Promise<boolean>} - Resolves to true if OK, false if Cancel
 */
function showConfirm(message, title = 'Confirmar Acción') {
    return new Promise((resolve) => {
        let overlay = document.getElementById('confirmOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'confirmOverlay';
            overlay.className = 'confirm-overlay';
            overlay.innerHTML = `
            <div class="confirm-modal">
                    <div class="confirm-title" id="confirmTitle"></div>
                    <div class="confirm-message" id="confirmMessage"></div>
                    <div class="confirm-buttons">
                        <button class="confirm-btn confirm-btn-cancel" id="confirmCancelBtn">Cancelar</button>
                        <button class="confirm-btn confirm-btn-ok" id="confirmOkBtn">Confirmar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;

        const okBtn = document.getElementById('confirmOkBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        const cleanup = (result) => {
            overlay.classList.remove('active');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            setTimeout(() => resolve(result), 200);
        };

        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);

        overlay.classList.add('active');
    });
}

let csrfToken = '';

// Fetch CSRF token
async function fetchCsrfToken() {
    try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        csrfToken = data.csrfToken;
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
    }
}
let allTickets = [];
let filteredTickets = [];
let currentFilter = 'todos';
let currentServicioFilter = 'todos';
let currentPrioridadFilter = 'todos';

let currentUserRole = null;
let isAdmin = false;

// Load tickets on page load (ensure CSRF token and session are ready first)
document.addEventListener('DOMContentLoaded', async () => {
    await fetchCsrfToken();
    await checkUserRole();
    await loadServices(); // To populate dropdowns
    await loadEmpresas(); // To populate empresas dropdowns
    await loadTickets();
    setupEventListeners();
});

// Check current user role
async function checkUserRole() {
    try {
        const response = await fetch('/api/session');
        const session = await response.json();

        currentUserRole = session.rol;
        isAdmin = session.isAdmin;

        applyPermissions();
    } catch (error) {
        console.error('Error checking user role:', error);
    }
}

// Apply permissions based on user role
function applyPermissions() {
    if (!isAdmin) {
        // Ocultar botones de admin
        const archivedBtn = document.querySelector('button[onclick*="loadArchivedTickets"]');
        if (archivedBtn) {
            archivedBtn.style.display = 'none';
        }

        // Ocultar todos los botones de delete
        document.querySelectorAll('.btn-delete').forEach(btn => btn.style.display = 'none');
        document.querySelectorAll('.btn-delete-note').forEach(btn => btn.style.display = 'none');

        // Ocultar botones en la tabla de usuarios
        document.querySelectorAll('button[onclick*="deleteUser"]').forEach(btn => btn.style.display = 'none');
        document.querySelectorAll('button[onclick*="editUser"]').forEach(btn => btn.style.display = 'none');
        document.querySelectorAll('button[onclick*="deleteService"]').forEach(btn => btn.style.display = 'none');
        document.querySelectorAll('button[onclick*="editService"]').forEach(btn => btn.style.display = 'none');
    }
}

// ==================== USERS PANEL ====================
function toggleUsersPanel() {
    const panel = document.getElementById('usersPanel');
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        loadUsers();
    }
}

async function loadUsers() {
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Cargando...</td></tr>';

    try {
        const response = await fetch('/api/usuarios');
        if (!response.ok) throw new Error('No se pudieron cargar los usuarios.');

        const users = await response.json();

        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay usuarios.</td></tr>';
            return;
        }

        tableBody.innerHTML = users.map(user => `
            <tr>
                        <td>${user.username}</td>
                        <td>${user.nombre_completo || '-'}</td>
                        <td>${user.email || '-'}</td>
                        <td><span class="badge badge-${user.rol}">${user.rol}</span></td>
                        <td><span class="badge ${user.activo ? 'badge-active' : 'badge-inactive'}">${user.activo ? 'Activo' : 'Inactivo'}</span></td>
                        <td>${user.ultimo_acceso ? new Date(user.ultimo_acceso).toLocaleString('es-ES') : 'Nunca'}</td>
                        <td class="user-actions">
                            <button class="btn-icon btn-edit" onclick='editUser(${JSON.stringify(user)})'><i class="fas fa-edit"></i></button>
                        </td>
                </tr>
            `).join('');

        applyPermissions();

    } catch (error) {
        console.error('Error loading users:', error);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">${error.message}</td></tr>`;
    }
}

function showUserForm() {
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('formTitle').textContent = 'Nuevo Usuario';
    document.getElementById('userFormContainer').style.display = 'block';
    document.getElementById('password').setAttribute('required', 'required');
}

function cancelUserForm() {
    document.getElementById('userFormContainer').style.display = 'none';
    document.getElementById('userForm').reset();
}

function editUser(user) {
    cancelUserForm(); // Reset form first
    document.getElementById('userId').value = user.id;
    document.getElementById('username').value = user.username;
    document.getElementById('nombreCompleto').value = user.nombre_completo || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('rol').value = user.rol;
    document.getElementById('activo').value = user.activo ? '1' : '0';
    document.getElementById('formTitle').textContent = 'Editar Usuario';
    document.getElementById('password').removeAttribute('required');
    document.getElementById('userFormContainer').style.display = 'block';
}


// ==================== SERVICES PANEL ====================

function toggleServicesPanel() {
    const panel = document.getElementById('servicesPanel');
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        loadServices();
    }
}

async function loadServices() {
    const tableBody = document.getElementById('servicesTableBody');
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Cargando...</td></tr>';

    try {
        const response = await fetch('/api/servicios');
        if (!response.ok) throw new Error('No se pudieron cargar los servicios.');

        const services = await response.json();

        // Populate dropdowns
        const serviceDropdowns = [
            document.getElementById('filterServicio'),
            document.getElementById('editTicketServicio'),
            document.getElementById('createTicketServicio')
        ];

        serviceDropdowns.forEach(dropdown => {
            // Clear existing options except the first one ('Todos')
            while (dropdown.options.length > 1) {
                dropdown.remove(1);
            }
            services.forEach(service => {
                if (service.activo) {
                    dropdown.add(new Option(service.nombre, service.codigo));
                }
            });
        });

        if (services.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay servicios definidos.</td></tr>';
            return;
        }

        tableBody.innerHTML = services.map(service => `
            <tr>
                        <td>${service.codigo}</td>
                        <td>${service.nombre}</td>
                        <td>${service.descripcion || '-'}</td>
                        <td><span class="badge ${service.activo ? 'badge-active' : 'badge-inactive'}">${service.activo ? 'Activo' : 'Inactivo'}</span></td>
                        <td class="user-actions">
                            <button class="btn-icon btn-edit" onclick='editService(${JSON.stringify(service)})'><i class="fas fa-edit"></i></button>
                            <button class="btn-icon btn-delete" onclick="deleteService(${service.id})"><i class="fas fa-trash"></i></button>
                        </td>
                </tr>
            `).join('');

        applyPermissions();

    } catch (error) {
        console.error('Error loading services:', error);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">${error.message}</td></tr>`;
    }
}

function showServiceForm() {
    document.getElementById('serviceForm').reset();
    document.getElementById('serviceId').value = '';
    document.getElementById('serviceFormTitle').textContent = 'Nuevo Servicio';
    document.getElementById('serviceFormContainer').style.display = 'block';
}

function cancelServiceForm() {
    document.getElementById('serviceFormContainer').style.display = 'none';
    document.getElementById('serviceForm').reset();
}

function editService(service) {
    cancelServiceForm();
    document.getElementById('serviceId').value = service.id;
    document.getElementById('serviceCode').value = service.codigo;
    document.getElementById('serviceName').value = service.nombre;
    document.getElementById('serviceDescription').value = service.descripcion || '';
    document.getElementById('serviceActive').value = service.activo ? '1' : '0';
    document.getElementById('serviceFormTitle').textContent = 'Editar Servicio';
    document.getElementById('serviceFormContainer').style.display = 'block';
}

async function saveService(event) {
    event.preventDefault();
    const serviceId = document.getElementById('serviceId').value;
    const url = serviceId ? `/api/servicios/${serviceId}` : '/api/servicios';
    const method = serviceId ? 'PUT' : 'POST';

    const serviceCode = document.getElementById('serviceCode').value;
    const serviceName = document.getElementById('serviceName').value;
    const serviceDescription = document.getElementById('serviceDescription').value;
    const serviceActive = document.getElementById('serviceActive').value;

    if (!serviceCode || !serviceName || serviceActive === '') {
        showNotification('Por favor complete todos los campos obligatorios del servicio', 'warning');
        return;
    }

    const serviceData = {
        codigo: serviceCode,
        nombre: serviceName,
        descripcion: serviceDescription,
        activo: serviceActive,
        _csrf: csrfToken
    };

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serviceData)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        showNotification(`Servicio ${serviceId ? 'actualizado' : 'creado'} exitosamente.`, 'success');
        cancelServiceForm();
        loadServices();

    } catch (error) {
        console.error('Error saving service:', error);
        showNotification('Error al guardar servicio: ' + error.message, 'error');
    }
}

async function deleteService(id) {
    const userConfirmed = await showConfirm('¿Está seguro de que desea eliminar este servicio?', 'Eliminar Servicio');
    if (!userConfirmed) return;
    try {
        const response = await fetch(`/api/servicios/${id}`, { method: 'DELETE', headers: { 'csrf-token': csrfToken } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        showNotification('Servicio eliminado exitosamente.', 'success');
        loadServices();

    } catch (error) {
        console.error('Error deleting service:', error);
        showNotification('Error al eliminar servicio: ' + error.message, 'error');
    }
}

// ==================== MATERIALS PANEL ====================

function toggleMaterialsPanel() {
    const panel = document.getElementById('materialsPanel');
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        loadMaterials();
    }
}

async function loadMaterials() {
    const tableBody = document.getElementById('materialsTableBody');
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Cargando...</td></tr>';

    try {
        const response = await fetch('/api/materiales');
        if (!response.ok) throw new Error('No se pudieron cargar los materiales.');

        const materials = await response.json();

        if (materials.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay materiales definidos.</td></tr>';
            return;
        }

        tableBody.innerHTML = materials.map(material => `
            <tr>
                        <td>${material.nombre}</td>
                        <td>${material.descripcion || '-'}</td>
                        <td>${(material.precio || 0).toFixed(2)} €</td>
                        <td><span class="badge ${material.activo ? 'badge-active' : 'badge-inactive'}">${material.activo ? 'Activo' : 'Inactivo'}</span></td>
                        <td class="user-actions">
                            <button class="btn-icon btn-edit" onclick='editMaterial(${JSON.stringify(material)})'><i class="fas fa-edit"></i></button>
                            <button class="btn-icon btn-delete" onclick="deleteMaterial(${material.id})"><i class="fas fa-trash"></i></button>
                        </td>
                </tr>
            `).join('');

        applyPermissions();

    } catch (error) {
        console.error('Error loading materials:', error);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">${error.message}</td></tr>`;
    }
}

function showMaterialForm() {
    document.getElementById('materialForm').reset();
    document.getElementById('materialId').value = '';
    document.getElementById('materialFormTitle').textContent = 'Nuevo Material';
    document.getElementById('materialFormContainer').style.display = 'block';
}

function cancelMaterialForm() {
    document.getElementById('materialFormContainer').style.display = 'none';
    document.getElementById('materialForm').reset();
}

function editMaterial(material) {
    cancelMaterialForm();
    document.getElementById('materialId').value = material.id;
    document.getElementById('materialName').value = material.nombre;
    document.getElementById('materialDescription').value = material.descripcion || '';
    document.getElementById('materialPrice').value = material.precio || 0;
    document.getElementById('materialActive').value = material.activo ? '1' : '0';
    document.getElementById('materialFormTitle').textContent = 'Editar Material';
    document.getElementById('materialFormContainer').style.display = 'block';
}

async function saveMaterial(event) {
    event.preventDefault();
    const materialId = document.getElementById('materialId').value;
    const url = materialId ? `/api/materiales/${materialId}` : '/api/materiales';
    const method = materialId ? 'PUT' : 'POST';

    const materialName = document.getElementById('materialName').value;
    const materialPrice = parseFloat(document.getElementById('materialPrice').value);
    const materialActive = document.getElementById('materialActive').value;

    if (!materialName || isNaN(materialPrice) || materialActive === '') {
        showNotification('Por favor complete todos los campos obligatorios del material', 'warning');
        return;
    }

    const materialData = {
        nombre: materialName,
        descripcion: document.getElementById('materialDescription').value,
        precio: materialPrice,
        activo: materialActive,
        _csrf: csrfToken
    };

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(materialData)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        showNotification(`Material ${materialId ? 'actualizado' : 'creado'} exitosamente.`, 'success');
        cancelMaterialForm();
        loadMaterials();

    } catch (error) {
        console.error('Error saving material:', error);
        showNotification('Error al guardar material: ' + error.message, 'error');
    }
}

async function deleteMaterial(id) {
    const userConfirmed = await showConfirm('¿Está seguro de que desea eliminar este material? Si está en uso en algún ticket, no podrá ser eliminado.', 'Eliminar Material');
    if (!userConfirmed) return;
    try {
        const response = await fetch(`/api/materiales/${id}`, { method: 'DELETE', headers: { 'csrf-token': csrfToken } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        showNotification('Material eliminado exitosamente.', 'success');
        loadMaterials();

    } catch (error) {
        console.error('Error deleting material:', error);
        showNotification('Error al eliminar material: ' + error.message, 'error');
    }
}

// ==================== EMPRESAS PANEL ====================

function toggleEmpresasPanel() {
    const panel = document.getElementById('empresasPanel');
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        loadEmpresas();
    }
}

async function loadEmpresas() {
    const tableBody = document.getElementById('empresasTableBody');
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Cargando...</td></tr>';

    try {
        const response = await fetch('/api/empresas');
        if (!response.ok) throw new Error('No se pudieron cargar las empresas.');

        const empresas = await response.json();

        // Populate dropdowns
        const empresaDropdowns = [
            document.getElementById('editTicketEmpresa'),
            document.getElementById('createTicketEmpresa')
        ];

        empresaDropdowns.forEach(dropdown => {
            // Clear existing options except the first one ('Sin empresa')
            while (dropdown.options.length > 1) {
                dropdown.remove(1);
            }
            empresas.forEach(empresa => {
                if (empresa.activo) {
                    dropdown.add(new Option(empresa.nombre, empresa.id));
                }
            });
        });

        if (empresas.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay empresas definidas.</td></tr>';
            return;
        }


        tableBody.innerHTML = empresas.map(empresa => `
            <tr>
                        <td>${empresa.nombre}</td>
                        <td>${empresa.cif || '-'}</td>
                        <td>${empresa.direccion || '-'}</td>
                        <td>${empresa.telefono || '-'}</td>
                        <td>${empresa.email || '-'}</td>
                        <td>
                            <span class="badge ${empresa.activo ? 'badge-active' : 'badge-inactive'}">${empresa.activo ? 'Activa' : 'Inactiva'}</span>
                            <br>
                            <span class="badge ${empresa.verifactu ? 'badge-active' : 'badge-inactive'}" style="margin-top: 5px; font-size: 0.7rem;">
                                <i class="fas ${empresa.verifactu ? 'fa-check-circle' : 'fa-times-circle'}"></i> Veri*Factu
                            </span>
                        </td>
                        <td class="user-actions">
                            <button class="btn-icon btn-edit" onclick='editEmpresa(${JSON.stringify(empresa)})'><i class="fas fa-edit"></i></button>
                            <button class="btn-icon btn-delete" onclick="deleteEmpresa(${empresa.id})"><i class="fas fa-trash"></i></button>
                        </td>
                </tr>
            `).join('');

        applyPermissions();

    } catch (error) {
        console.error('Error loading empresas:', error);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">${error.message}</td></tr>`;
    }
}

// ==================== FACTURACIÓN PANEL ====================

function toggleFacturacionPanel() {
    const panel = document.getElementById('facturacionPanel');
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        showFacturacionForm();
    }
}

async function showFacturacionForm() {
    const content = document.getElementById('facturacionContent');

    // Load all active tickets
    try {
        const response = await fetch('/api/tickets');
        const tickets = await response.json();
        const activeTickets = tickets.filter(t => t.estado !== 'completado');

        content.innerHTML = `
            <div style="background: #f9fafb; padding: 1.5rem; border-radius: 10px;">
                <h3 style="margin-bottom: 1rem;">Seleccionar Tickets para Facturación</h3>
                
                <div id="ticketsCheckboxList" style="max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                    ${activeTickets.map(ticket => `
                        <label style="display: flex; align-items: center; padding: 0.5rem; cursor: pointer; border-radius: 5px; hover: background #f0f0f0;">
                            <input type="checkbox" class="ticket-checkbox" value="${ticket.ticket_id}" data-cliente="${ticket.nombre}" data-email="${ticket.email}">
                            <span style="margin-left: 0.5rem; flex: 1;">
                                <strong>${ticket.ticket_id}</strong> - ${ticket.nombre} (${ticket.email})
                            </span>
                        </label>
                    `).join('')}
                </div>

                <button onclick="generateInvoicePreview()" class="btn" style="background: #10b981; padding: 0.75rem 1.5rem; width: 100%; cursor: pointer;">
                    <i class="fas fa-arrow-right"></i> Siguiente: Ver Detalles
                </button>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div style="color: red;">Error al cargar tickets: ${error.message}</div>`;
    }
}

async function generateInvoicePreview() {
    const checkboxes = document.querySelectorAll('.ticket-checkbox:checked');
    const ticketIds = Array.from(checkboxes).map(cb => cb.value);

    if (ticketIds.length === 0) {
        showNotification('Por favor selecciona al menos un ticket', 'error');
        return;
    }

    try {
        const response = await fetch('/api/invoices/tickets-summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'csrf-token': csrfToken
            },
            body: JSON.stringify({ ticket_ids: ticketIds })
        });

        const tickets = await response.json();
        showInvoiceEditor(tickets, ticketIds);
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

function showInvoiceEditor(tickets, ticketIds) {
    const content = document.getElementById('facturacionContent');

    let totalHoras = 0;
    let totalMateriales = 0;
    let htmlItems = '';

    tickets.forEach(ticket => {
        totalHoras += parseFloat(ticket.total_horas) || 0;
        totalMateriales += parseFloat(ticket.total_materiales) || 0;

        htmlItems += `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 0.75rem;">${ticket.ticket_id}</td>
                <td style="padding: 0.75rem;">${ticket.nombre}</td>
                <td style="padding: 0.75rem;">
                    <input type="number" class="item-horas-oficiales" data-ticket="${ticket.ticket_id}" placeholder="0" style="width: 60px; padding: 0.3rem; border: 1px solid #ddd; border-radius: 4px;">
                    <small style="color: #666;"> h. oficial</small>
                </td>
                <td style="padding: 0.75rem;">
                    <input type="number" class="item-horas-ayudante" data-ticket="${ticket.ticket_id}" placeholder="0" style="width: 60px; padding: 0.3rem; border: 1px solid #ddd; border-radius: 4px;">
                    <small style="color: #666;"> h. ayudante</small>
                </td>
                <td style="padding: 0.75rem;">
                    <input type="number" class="item-precio-oficial" data-ticket="${ticket.ticket_id}" placeholder="0.00" style="width: 70px; padding: 0.3rem; border: 1px solid #ddd; border-radius: 4px;">
                    <small style="color: #666;"> €/h</small>
                </td>
                <td style="padding: 0.75rem;">
                    <input type="number" class="item-precio-ayudante" data-ticket="${ticket.ticket_id}" placeholder="0.00" style="width: 70px; padding: 0.3rem; border: 1px solid #ddd; border-radius: 4px;">
                    <small style="color: #666;"> €/h</small>
                </td>
                <td style="padding: 0.75rem; text-align: right;">
                    <span class="item-subtotal" data-ticket="${ticket.ticket_id}">0.00 €</span>
                </td>
            </tr>
        `;
    });

    const firstTicket = tickets[0];

    content.innerHTML = `
        <div style="background: #f9fafb; padding: 1.5rem; border-radius: 10px;">
            <h3 style="margin-bottom: 1rem;">Editor de Factura</h3>
            
            <form onsubmit="event.preventDefault(); procesarFactura('${ticketIds.join("','")}');">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div>
                        <label>Cliente</label>
                        <input type="text" id="invoiceCliente" value="${firstTicket.nombre}" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div>
                        <label>Email</label>
                        <input type="email" id="invoiceEmail" value="${firstTicket.email}" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                </div>

                <div style="margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;">Detalles por Ticket</h4>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead style="background: #e5e7eb;">
                            <tr>
                                <th style="padding: 0.75rem; text-align: left;">Ticket</th>
                                <th style="padding: 0.75rem; text-align: left;">Cliente</th>
                                <th style="padding: 0.75rem; text-align: left;">H. Oficial</th>
                                <th style="padding: 0.75rem; text-align: left;">H. Ayudante</th>
                                <th style="padding: 0.75rem; text-align: left;">€ Oficial</th>
                                <th style="padding: 0.75rem; text-align: left;">€ Ayudante</th>
                                <th style="padding: 0.75rem; text-align: right;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody id="invoiceItemsBody">
                            ${htmlItems}
                        </tbody>
                    </table>
                </div>

                <div style="background: #f0f9ff; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #3b82f6;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <p style="color: #666; font-size: 0.9rem;">Total Horas Detectadas</p>
                            <p style="font-size: 1.3rem; font-weight: bold;">${totalHoras.toFixed(2)} h</p>
                        </div>
                        <div>
                            <p style="color: #666; font-size: 0.9rem;">Total Materiales Detectados</p>
                            <p style="font-size: 1.3rem; font-weight: bold;">${totalMateriales.toFixed(2)} €</p>
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button type="button" onclick="toggleFacturacionPanel()" class="btn" style="background: #6b7280; flex: 1; padding: 0.75rem;">Cancelar</button>
                    <button type="submit" class="btn" style="background: #10b981; flex: 1; padding: 0.75rem;">
                        <i class="fas fa-check"></i> Generar Factura
                    </button>
                </div>
            </form>
        </div>
    `;

    // Add event listeners for calculations
    document.querySelectorAll('.item-horas-oficiales, .item-horas-ayudante, .item-precio-oficial, .item-precio-ayudante').forEach(input => {
        input.addEventListener('change', recalcularSubtotal);
    });
}

function recalcularSubtotal() {
    document.querySelectorAll('.item-subtotal').forEach(elem => {
        const ticketId = elem.dataset.ticket;
        const horasOficial = parseFloat(document.querySelector(`.item-horas-oficiales[data-ticket="${ticketId}"]`).value) || 0;
        const horasAyudante = parseFloat(document.querySelector(`.item-horas-ayudante[data-ticket="${ticketId}"]`).value) || 0;
        const precioOficial = parseFloat(document.querySelector(`.item-precio-oficial[data-ticket="${ticketId}"]`).value) || 0;
        const precioAyudante = parseFloat(document.querySelector(`.item-precio-ayudante[data-ticket="${ticketId}"]`).value) || 0;

        const subtotal = (horasOficial * precioOficial) + (horasAyudante * precioAyudante);
        elem.textContent = subtotal.toFixed(2) + ' €';
    });
}

async function procesarFactura(ticketIds) {
    const cliente = document.getElementById('invoiceCliente').value;
    const email = document.getElementById('invoiceEmail').value;

    if (!cliente || !email) {
        showNotification('Por favor completa los datos del cliente', 'error');
        return;
    }

    const items = [];
    document.querySelectorAll('.item-subtotal').forEach(elem => {
        const ticketId = elem.dataset.ticket;
        const horasOficial = parseFloat(document.querySelector(`.item-horas-oficiales[data-ticket="${ticketId}"]`).value) || 0;
        const horasAyudante = parseFloat(document.querySelector(`.item-horas-ayudante[data-ticket="${ticketId}"]`).value) || 0;
        const precioOficial = parseFloat(document.querySelector(`.item-precio-oficial[data-ticket="${ticketId}"]`).value) || 0;
        const precioAyudante = parseFloat(document.querySelector(`.item-precio-ayudante[data-ticket="${ticketId}"]`).value) || 0;

        const subtotal = (horasOficial * precioOficial) + (horasAyudante * precioAyudante);

        if (horasOficial > 0 || horasAyudante > 0) {
            items.push({
                concepto: 'Servicios profesionales',
                descripcion: `${ticketId} - Oficial: ${horasOficial}h, Ayudante: ${horasAyudante}h`,
                cantidad: 1,
                precio_unitario: subtotal,
                total: subtotal
            });
        }
    });

    if (items.length === 0) {
        showNotification('Por favor ingresa al menos una línea de factura', 'error');
        return;
    }

    try {
        const response = await fetch('/api/invoices/multi-ticket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'csrf-token': csrfToken
            },
            body: JSON.stringify({
                ticket_ids: ticketIds.split(','),
                cliente_nombre: cliente,
                cliente_email: email,
                fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                items: items,
                empresa_id: null
            })
        });

        const result = await response.json();

        if (response.ok) {
            showNotification(`Factura ${result.invoiceId} creada exitosamente con ${result.ticketCount} ticket(s)`, 'success');
            toggleFacturacionPanel();
            loadTickets();
        } else {
            showNotification('Error: ' + (result.error || 'Error desconocido'), 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al procesar factura: ' + error.message, 'error');
    }
}


function showEmpresaForm() {
    document.getElementById('empresaForm').reset();
    document.getElementById('empresaId').value = '';
    document.getElementById('empresaFormTitle').textContent = 'Nueva Empresa';
    document.getElementById('empresaFormContainer').style.display = 'block';
}

function cancelEmpresaForm() {
    document.getElementById('empresaFormContainer').style.display = 'none';
    document.getElementById('empresaForm').reset();
}

function editEmpresa(empresa) {
    cancelEmpresaForm();
    document.getElementById('empresaId').value = empresa.id;
    document.getElementById('empresaNombre').value = empresa.nombre;
    document.getElementById('empresaCif').value = empresa.cif || '';
    document.getElementById('empresaDireccion').value = empresa.direccion || '';
    document.getElementById('empresaTelefono').value = empresa.telefono || '';
    document.getElementById('empresaEmail').value = empresa.email || '';
    document.getElementById('empresaActive').value = empresa.activo ? '1' : '0';
    document.getElementById('empresaVerifactu').checked = empresa.verifactu === 1;
    document.getElementById('empresaFormTitle').textContent = 'Editar Empresa';
    document.getElementById('empresaFormContainer').style.display = 'block';
}

async function saveEmpresa(event) {
    event.preventDefault();
    const empresaId = document.getElementById('empresaId').value;
    const url = empresaId ? `/api/empresas/${empresaId}` : '/api/empresas';
    const method = empresaId ? 'PUT' : 'POST';

    const empresaNombre = document.getElementById('empresaNombre').value;
    const empresaActive = document.getElementById('empresaActive').value;

    if (!empresaNombre || empresaActive === '') {
        showNotification('El nombre de la empresa y su estado son obligatorios', 'warning');
        return;
    }

    const empresaData = {
        nombre: empresaNombre,
        cif: document.getElementById('empresaCif').value,
        direccion: document.getElementById('empresaDireccion').value,
        telefono: document.getElementById('empresaTelefono').value,
        email: document.getElementById('empresaEmail').value,
        activo: parseInt(empresaActive),
        verifactu: document.getElementById('empresaVerifactu').checked ? 1 : 0,
        _csrf: csrfToken
    };

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
            body: JSON.stringify(empresaData)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        showNotification(`Empresa ${empresaId ? 'actualizada' : 'creada'} exitosamente.`, 'success');
        cancelEmpresaForm();
        loadEmpresas();

    } catch (error) {
        console.error('Error saving empresa:', error);
        showNotification('Error al guardar empresa: ' + error.message, 'error');
    }
}

async function deleteEmpresa(id) {
    const userConfirmed = await showConfirm(
        '¿Está seguro de que desea eliminar esta empresa? La empresa se desactivará para preservar el historial de tickets y facturas existentes, pero no aparecerá en nuevas selecciones.',
        'Eliminar Empresa'
    );
    if (!userConfirmed) return;
    try {
        const response = await fetch(`/api/empresas/${id}`, { method: 'DELETE', headers: { 'csrf-token': csrfToken } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        showNotification('Empresa eliminada exitosamente.', 'success');
        loadEmpresas();

    } catch (error) {
        console.error('Error deleting empresa:', error);
        showNotification('Error al eliminar empresa: ' + error.message, 'error');
    }
}


function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            filterTickets();
        });
    });

    // Servicio filter
    document.getElementById('filterServicio').addEventListener('change', (e) => {
        currentServicioFilter = e.target.value;
        filterTickets();
    });

    // Prioridad filter
    document.getElementById('filterPrioridad').addEventListener('change', (e) => {
        currentPrioridadFilter = e.target.value;
        filterTickets();
    });

    // Search box
    document.getElementById('searchBox').addEventListener('input', (e) => {
        searchTickets(e.target.value);
    });
}

async function loadTickets() {
    try {
        const response = await fetch('/api/tickets');

        // Verificar si la sesión expiró
        if (response.status === 401) {
            showNotification('Su sesión ha expirado. Por favor, inicie sesión nuevamente.', 'warning');
            window.location.href = '/login';
            return;
        }

        allTickets = await response.json();
        updateStatistics();
        filterTickets();
    } catch (error) {
        console.error('Error loading tickets:', error);
        document.getElementById('ticketsTableContainer').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error al cargar los tickets</p>
            </div>
            `;
    }
}

// Load archived tickets
async function loadArchivedTickets() {
    try {
        const response = await fetch('/api/tickets/archived/list');

        if (response.status === 401) {
            showNotification('Su sesión ha expirado. Por favor, inicie sesión nuevamente.', 'warning');
            window.location.href = '/login';
            return;
        }

        if (response.status === 403) {
            showNotification('Solo administradores pueden ver tickets archivados', 'error');
            return;
        }

        const archivedTickets = await response.json();
        renderArchivedTickets(archivedTickets);
    } catch (error) {
        console.error('Error loading archived tickets:', error);
        document.getElementById('ticketsTableContainer').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error al cargar los tickets archivados</p>
            </div>
            `;
    }
}

function renderArchivedTickets(tickets) {
    const container = document.getElementById('ticketsTableContainer');

    if (tickets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-archive"></i>
                <p>No hay tickets archivados</p>
            </div>
            `;
        return;
    }

    const servicios = {
        'construccion': 'Construcción',
        'reparacion': 'Reparación',
        'obras': 'Obras',
        'fugas': 'Búsqueda de Fugas',
        'fontaneria': 'Fontanería',
        'electricidad': 'Electricidad'
    };

    const html = `
            <table>
                    <thead>
                        <tr>
                            <th>Ticket ID</th>
                            <th>Cliente</th>
                            <th>Servicio</th>
                            <th>Prioridad</th>
                            <th>Estado</th>
                            <th>Archivado Por</th>
                            <th>Fecha Archivado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tickets.map(ticket => `
                            <tr>
                                <td><strong>${ticket.ticket_id}</strong></td>
                                <td>${ticket.nombre}</td>
                                <td>${servicios[ticket.servicio] || ticket.servicio}</td>
                                <td><span class="badge badge-${ticket.prioridad}">${ticket.prioridad}</span></td>
                                <td><span class="badge badge-${ticket.estado}">${ticket.estado.replace('_', ' ')}</span></td>
                                <td>${ticket.usuario_archivado || '-'}</td>
                                <td>${new Date(ticket.fecha_archivado).toLocaleString('es-ES')}</td>
                                <td>
                                    <div class="action-btns">
                                        <button class="btn-small btn-restore" onclick="restoreTicket('${ticket.ticket_id}')" style="background: #10b981;">
                                            <i class="fas fa-undo"></i> Restaurar
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

    container.innerHTML = html;
    applyPermissions();
}

function updateStatistics() {
    document.getElementById('stat-total').textContent = allTickets.length;
    document.getElementById('stat-pendiente').textContent =
        allTickets.filter(t => t.estado === 'pendiente').length;
    document.getElementById('stat-en-proceso').textContent =
        allTickets.filter(t => t.estado === 'en_proceso').length;
    document.getElementById('stat-resuelto').textContent =
        allTickets.filter(t => t.estado === 'resuelto').length;
}

function filterTickets() {
    filteredTickets = allTickets;

    // Filter by status
    if (currentFilter !== 'todos') {
        filteredTickets = filteredTickets.filter(t => t.estado === currentFilter);
    }

    // Filter by service
    if (currentServicioFilter !== 'todos') {
        filteredTickets = filteredTickets.filter(t => t.servicio === currentServicioFilter);
    }

    // Filter by priority
    if (currentPrioridadFilter !== 'todos') {
        filteredTickets = filteredTickets.filter(t => t.prioridad === currentPrioridadFilter);
    }

    renderTicketsTable();
}

function searchTickets(query) {
    const lowerQuery = query.toLowerCase();
    filteredTickets = allTickets.filter(t =>
        t.ticket_id.toLowerCase().includes(lowerQuery) ||
        t.nombre.toLowerCase().includes(lowerQuery) ||
        t.email.toLowerCase().includes(lowerQuery) ||
        t.descripcion.toLowerCase().includes(lowerQuery)
    );
    renderTicketsTable();
}

function renderTicketsTable() {
    const container = document.getElementById('ticketsTableContainer');

    if (filteredTickets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No hay tickets para mostrar</p>
            </div>
            `;
        applyPermissions();
        return;
    }

    const servicios = {
        'construccion': 'Construcción',
        'reparacion': 'Reparación',
        'obras': 'Obras',
        'fugas': 'Búsqueda de Fugas'
    };

    const html = `
            <div class="table-responsive">
                <table class="tickets-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Cliente</th>
                            <th>Técnico</th>
                            <th>Servicio</th>
                            <th>Prioridad</th>
                            <th>Estado</th>
                            <th>Fecha</th>
                            <th class="no-print">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredTickets.map(ticket => `
                            <tr>
                                <td><span class="id-badge">${ticket.ticket_id.split('-').pop()}</span></td>
                                <td><strong>${ticket.nombre}</strong></td>
                                <td>
                                    ${ticket.tecnico_asignado ?
            `<span class="tecnico-badge"><i class="fas fa-user-gear"></i> ${ticket.tecnico_asignado}</span>` :
            '<span class="tecnico-none">Sin asignar</span>'}
                                </td>
                                <td>${servicios[ticket.servicio] || ticket.servicio}</td>
                                <td><span class="badge badge-${ticket.prioridad}">${ticket.prioridad}</span></td>
                                <td><span class="badge badge-${ticket.estado}">${ticket.estado.replace('_', ' ')}</span></td>
                                <td>${new Date(ticket.fecha_creacion).toLocaleDateString('es-ES')}</td>
                                <td class="no-print">
                                    <div class="action-btns">
                                        <button class="btn-action btn-view" title="Ver" onclick="viewTicket('${ticket.ticket_id}')">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn-action btn-edit" title="Editar" onclick="editTicket('${ticket.ticket_id}')">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn-action btn-delete" title="Borrar" onclick="deleteTicket('${ticket.ticket_id}')">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                        <button class="btn-action btn-whatsapp" title="WhatsApp" onclick="openWhatsApp('${ticket.telefono}', '${ticket.ticket_id}', '${ticket.nombre}')">
                                            <i class="fab fa-whatsapp"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            `;

    container.innerHTML = html;
    applyPermissions();
}

async function viewTicket(ticketId) {
    try {
        const [
            ticketResponse,
            notesResponse,
            whatsappResponse,
            horasResponse,
            materialsResponse,
            usersResponse,
            allMaterialsResponse,
            empresasResponse,
            invoicesResponse
        ] = await Promise.all([
            fetch(`/api/tickets/${ticketId}`),
            fetch(`/api/tickets/${ticketId}/notes`),
            fetch(`/api/tickets/${ticketId}/whatsapp`),
            fetch(`/api/tickets/${ticketId}/horas`),
            fetch(`/api/tickets/${ticketId}/materiales`),
            fetch('/api/usuarios'), // For technician dropdown
            fetch('/api/materiales'), // For materials dropdown
            fetch('/api/empresas'), // For empresas
            fetch(`/api/tickets/${ticketId}/invoices`) // For invoices
        ]);

        if (!ticketResponse.ok) {
            const errorData = await ticketResponse.json();
            throw new Error(errorData.error || 'Ticket no encontrado');
        }

        const ticket = await ticketResponse.json();
        const notes = notesResponse.ok ? await notesResponse.json() : [];
        const whatsappContacts = whatsappResponse.ok ? await whatsappResponse.json() : [];
        const horasData = horasResponse.ok ? await horasResponse.json() : { total: 0, horas: [], porTecnico: [] };
        const ticketMaterials = materialsResponse.ok ? await materialsResponse.json() : [];
        const users = usersResponse.ok ? await usersResponse.json() : [];
        const allMaterials = allMaterialsResponse.ok ? await allMaterialsResponse.json() : [];
        const empresas = empresasResponse.ok ? await empresasResponse.json() : [];
        const invoices = invoicesResponse.ok ? await invoicesResponse.json() : [];
        const clientsResponse = await fetch('/api/clientes');
        const allClientsList = clientsResponse.ok ? await clientsResponse.json() : [];

        const matchedClient = allClientsList.find(c =>
            (ticket.email && c.email && c.email.trim().toLowerCase() === ticket.email.trim().toLowerCase()) ||
            (ticket.nombre && c.nombre && c.nombre.trim().toLowerCase() === ticket.nombre.trim().toLowerCase())
        );

        const hasClientDetails = matchedClient && matchedClient.cif && matchedClient.direccion;

        let clientBillingInfoHtml = '';
        if (matchedClient) {
            clientBillingInfoHtml = `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 1rem; margin-top: 1rem; border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <div style="color: #64748b; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.025em;">
                            Datos del Cliente (Facturación)
                        </div>
                        <button class="btn" style="background: #e2e8f0; color: #1e293b; padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="showBillingDataModal('${ticket.ticket_id}', '${matchedClient.cif || ''}', '${matchedClient.direccion || ''}')">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                    </div>
                    <div style="font-size: 0.9rem; color: #1e293b;">
                        <div style="margin-bottom: 0.25rem;"><strong>Nombre:</strong> ${matchedClient.nombre}</div>
                        <div style="margin-bottom: 0.25rem;"><strong>CIF:</strong> ${matchedClient.cif || '<span style="color: #f97316;">Falta CIF</span>'}</div>
                        <div><strong>Dirección:</strong> ${matchedClient.direccion || '<span style="color: #f97316;">Falta Dirección</span>'}</div>
                    </div>
                    ${!hasClientDetails ? `
                        <div style="margin-top: 0.75rem; padding: 0.5rem; background: #fff7ed; border-radius: 4px; color: #c2410c; font-size: 0.8rem; display: flex; align-items: center; gap: 0.4rem;">
                            <i class="fas fa-exclamation-circle"></i> Faltan datos obligatorios para facturar
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            clientBillingInfoHtml = `
                <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 1rem; margin-top: 1rem; border-radius: 4px;">
                    <p style="color: #c2410c; margin: 0; font-size: 0.875rem;">
                        El cliente no está registrado. Se necesita Nombre, CIF y Dirección para facturar.
                    </p>
                    <button class="btn" style="background: #f97316; margin-top: 0.75rem; width: 100%; font-size: 0.875rem;" onclick="showBillingDataModal('${ticket.ticket_id}', '', '')">
                        <i class="fas fa-plus"></i> Registrar Datos de Facturación
                    </button>
                </div>
            `;
        }

        const operatives = users.filter(u => u.rol === 'tecnico' && u.activo);

        const serviciosMapping = {
            'construccion': 'Construcción',
            'reparacion': 'Reparación',
            'obras': 'Obras',
            'fugas': 'Búsqueda de Fugas',
            'fontaneria': 'Fontanería',
            'electricidad': 'Electricidad'
        };

        const getServiceLabel = (service) => {
            if (!service) return 'No especificado';
            // Try to match lowercase slug
            const slug = service.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return serviciosMapping[slug] || service;
        };

        const notesHtml = notes.length > 0 ? notes.map(note => `
                    <div class="note-item">
                        <div class="note-header">
                            <div>
                                <strong>${note.autor}</strong>
                                <span>${new Date(note.fecha_creacion).toLocaleString('es-ES')}</span>
                            </div>
                            <button class="btn-delete-note" onclick="deleteNoteFromTicket(${note.id}, '${ticket.ticket_id}')" title="Eliminar nota">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="note-text">${note.nota}</div>
                    </div>
                `).join('') : '<p style="color: #6b7280;">No hay notas aún</p>';

        const horasHtml = horasData.horas && horasData.horas.length > 0 ? horasData.horas.map(hora => `
                    <div class="note-item" style="border-left-color: #f59e0b;">
                        <div class="note-header">
                            <div>
                                <strong>${hora.tecnico_nombre}</strong>
                                <span>- ${hora.horas}h</span>
                                <small>${new Date(hora.fecha_registro).toLocaleString('es-ES')}</small>
                            </div>
                            <button class="btn-delete-note" onclick="deleteHoraTrabajo(${hora.id}, '${ticket.ticket_id}')" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        ${hora.descripcion ? `<div class="note-text">${hora.descripcion}</div>` : ''}
                    </div>
                `).join('') : '<p style="color: #6b7280;">Sin registros de horas</p>';

        const resumenHoras = horasData.porTecnico && horasData.porTecnico.length > 0 ? horasData.porTecnico.map(t => `
                    <div style="padding: 0.5rem; background: #f3f4f6; border-radius: 4px; margin-bottom: 0.5rem;">
                        <strong>${t.tecnico_nombre}:</strong> ${t.total_horas}h (${t.registros} registro${t.registros > 1 ? 's' : ''})
                    </div>
                `).join('') : '';

        const materialsHtml = ticketMaterials.length > 0 ? ticketMaterials.map(mat => `
                     <div class="note-item" style="border-left-color: #8b5cf6;">
                        <div class="note-header">
                            <div>
                                <strong>${mat.nombre}</strong>
                                <span>x ${mat.cantidad}</span>
                                <span>@ ${mat.precio_unitario.toFixed(2)} €</span>
                                <strong>= ${(mat.cantidad * mat.precio_unitario).toFixed(2)} €</strong>
                            </div>
                            <button class="btn-delete-note" onclick="removeMaterialFromTicket(${mat.id}, '${ticket.ticket_id}')" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('') : '<p style="color: #6b7280;">Sin materiales registrados</p>';
        const totalMaterialCost = ticketMaterials.reduce((acc, mat) => acc + (mat.cantidad * mat.precio_unitario), 0);

        const whatsappHistoryHtml = whatsappContacts.length > 0 ? whatsappContacts.map(contact => `
                    <div class="whatsapp-contact-item">
                        <strong>${contact.enviado_por}</strong> contactó al cliente
                        ${contact.mensaje ? `<br>Mensaje: "${contact.mensaje}"` : ''}
                        <br><small>${new Date(contact.fecha_contacto).toLocaleString('es-ES')}</small>
                    </div>
                `).join('') : '<p style="color: rgba(255,255,255,0.7); font-size: 0.9rem;">No hay contactos previos</p>';

        const invoicesHtml = invoices.length > 0 ? invoices.map(inv => `
                    <div class="note-item" style="border-left-color: #059669;">
                        <div class="note-header">
                            <div>
                                <strong>${inv.factura_id}</strong>
                                <span>- Total: ${inv.total.toFixed(2)} €</span>
                                <small>${new Date(inv.fecha_emision).toLocaleDateString('es-ES')}</small>
                            </div>
                            <button class="btn-small btn-view" onclick="viewInvoice('${inv.factura_id}')">
                                <i class="fas fa-eye"></i> Ver
                            </button>
                            ${!inv.bloqueada ? `
                            <button class="btn-small btn-edit" onclick="editInvoice('${inv.factura_id}')">
                                <i class="fas fa-edit"></i> Editar
                            </button>` : ''}
                        </div>
                    </div>
                `).join('') : '<p style="color: #6b7280;">No hay facturas para este ticket</p>';

        document.getElementById('ticketDetails').innerHTML = `
                    <div class="detail-row">
                        <div class="detail-label">Ticket ID</div>
                        <div><strong>${ticket.ticket_id}</strong></div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Cliente</div>
                        <div>${ticket.nombre}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Email</div>
                        <div>${ticket.email}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Teléfono</div>
                        <div>${ticket.telefono}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Dirección</div>
                        <div>${ticket.direccion || 'No especificada'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Servicio</div>
                        <div>${getServiceLabel(ticket.servicio)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Empresa</div>
                        <div>
                            ${(() => {
                const empresa = ticket.empresa_id ? empresas.find(e => e.id === ticket.empresa_id) : null;
                const empresaNombre = empresa ? empresa.nombre : 'Sin empresa asignada';
                return `<strong>${empresaNombre}</strong> ${isAdmin ? `<button class="btn" style="background: #6366f1; margin-left: 1rem; padding: 0.3rem 0.8rem; font-size: 0.875rem;" onclick="showTransferirEmpresaModal('${ticket.ticket_id}', ${ticket.empresa_id || 'null'}, '${empresaNombre.replace(/'/g, "\\'")}')">
                                <i class="fas fa-exchange-alt"></i> Transferir
                            </button>` : ''}`;
            })()}
                        </div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Prioridad</div>
                        <div><span class="badge badge-${ticket.prioridad}">${ticket.prioridad}</span></div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Descripción</div>
                        <div>${ticket.descripcion}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Fecha de Creación</div>
                        <div>${new Date(ticket.fecha_creacion).toLocaleString('es-ES')}</div>
                    </div>

                    <div class="whatsapp-section">
                        <h3><i class="fab fa-whatsapp"></i> Contactar por WhatsApp</h3>
                        <div class="whatsapp-templates">
                            <button class="template-btn" onclick="setWhatsAppMessage('Hola ${ticket.nombre}, somos del servicio técnico. Hemos recibido tu solicitud ${ticket.ticket_id} sobre ${getServiceLabel(ticket.servicio)}. ¿En qué momento podemos visitarte?')">
                                📅 Solicitar visita
                            </button>
                            <button class="template-btn" onclick="setWhatsAppMessage('Hola ${ticket.nombre}, te informamos que estamos trabajando en tu caso ${ticket.ticket_id}. Te mantendremos informado del progreso.')">
                                🔧 Actualización de estado
                            </button>
                            <button class="template-btn" onclick="setWhatsAppMessage('Hola ${ticket.nombre}, tu caso ${ticket.ticket_id} ha sido resuelto. ¿Podrías confirmar que todo funciona correctamente?')">
                                ✅ Caso resuelto
                            </button>
                            <button class="template-btn" onclick="setWhatsAppMessage('Hola ${ticket.nombre}, necesitamos más información sobre tu caso ${ticket.ticket_id}. ¿Podrías proporcionarnos más detalles?')">
                                ℹ️ Solicitar información
                            </button>
                        </div>
                        <textarea class="custom-message" id="whatsappMessage" placeholder="Escribe un mensaje personalizado o selecciona una plantilla..."></textarea>
                        <input type="text" id="tecnicoWhatsApp" placeholder="Tu nombre (técnico)" value="${sessionStorage.getItem('username') || ''}" style="width: 100%; padding: 0.75rem; border: 2px solid rgba(255,255,255,0.3); border-radius: 5px; background: rgba(255,255,255,0.2); color: white; margin-bottom: 1rem;">
                        <button class="btn-whatsapp" onclick="sendWhatsApp('${ticket.telefono}', '${ticket.ticket_id}', '${ticket.nombre}')">
                            <i class="fab fa-whatsapp"></i> Abrir WhatsApp y Enviar Mensaje
                        </button>
                        <div class="whatsapp-history">
                            <strong>Historial de Contactos:</strong>
                            <div style="margin-top: 0.5rem;">
                                ${whatsappHistoryHtml}
                            </div>
                        </div>
                    </div>
                    
            <div class="assignment-section">
                <div class="detail-label"><i class="fas fa-calendar-plus"></i> Gestionar Citas</div>
                <button class="btn" style="background: #3b82f6; width: 100%; margin-top: 0.5rem;" onclick="showAddAppointmentModal('${ticket.ticket_id}')">
                    <i class="fas fa-calendar-alt"></i> Agendar Nueva Cita
                </button>
            </div>
            
            <div class="assignment-section">
                        <div class="detail-label"><i class="fas fa-user"></i> Asignar Técnico</div>
                        <select id="tecnicoSelect" class="filter-select" style="width: 100%; margin-top: 0.5rem;">
                            <option value="">Sin asignar</option>
                            ${operatives.map(op => `<option value="${op.username}" ${ticket.tecnico_asignado === op.username ? 'selected' : ''}>${op.nombre_completo || op.username}</option>`).join('')}
                        </select>
                        <button class="btn-update-status" onclick="assignTechnicianToTicket('${ticket.ticket_id}')" style="background: #f59e0b; margin-top: 0.5rem;">
                            <i class="fas fa-user-check"></i> Asignar Técnico
                        </button>
                    </div>
                    
                    <div class="notes-section" style="border-top: 2px solid #f59e0b; background: #fffbeb;">
                        <h3><i class="fas fa-clock"></i> Horas de Trabajo</h3>
                        ${resumenHoras ? `<div style="margin-bottom: 1rem; padding: 1rem; background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
                            <strong>Total Horas: ${horasData.total}h</strong>
                            ${resumenHoras}
                        </div>` : ''}
                        <div style="max-height: 250px; overflow-y: auto; margin-top: 1rem;">
                            ${horasHtml}
                        </div>
                        <div class="add-note-form">
                            <select id="horasTecnicoSelect" class="filter-select" style="width:100%; margin-bottom: 0.5rem;">
                                <option value="">Selecciona técnico</option>
                                ${operatives.map(op => `<option value="${op.id}" data-name="${op.nombre_completo || op.username}">${op.nombre_completo || op.username}</option>`).join('')}
                            </select>
                            <input type="number" id="horasTrabajadas" placeholder="Horas (ej: 1.5)" min="0.25" step="0.25" style="width: 100%;">
                            <textarea id="descripcionHoras" placeholder="Descripción del trabajo realizado..." style="height: 60px;"></textarea>
                            <button class="btn-add-note" onclick="addHorasTrabajo('${ticket.ticket_id}')">
                                <i class="fas fa-plus"></i> Registrar Horas
                            </button>
                        </div>
                    </div>

                    <div class="notes-section" style="border-top: 2px solid #8b5cf6; background: #f5f3ff;">
                        <h3><i class="fas fa-box"></i> Materiales Utilizados</h3>
                        ${totalMaterialCost > 0 ? `<div style="margin-bottom: 1rem; padding: 1rem; background: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 4px;">
                            <strong>Coste Total Materiales: ${totalMaterialCost.toFixed(2)} €</strong>
                        </div>` : ''}
                        <div style="max-height: 250px; overflow-y: auto; margin-top: 1rem;">
                            ${materialsHtml}
                        </div>
                        <div class="add-note-form">
                            <select id="materialSelect" class="filter-select" style="width:100%; margin-bottom: 0.5rem;">
                                <option value="">Selecciona un material</option>
                                ${allMaterials.map(mat => `<option value="${mat.id}">${mat.nombre} (${mat.precio.toFixed(2)} €)</option>`).join('')}
                            </select>
                            <input type="number" id="materialCantidad" placeholder="Cantidad" value="1" min="0.1" step="0.1" style="width: 100%;">
                            <button class="btn-add-note" style="background-color: #8b5cf6" onclick="addMaterialToTicket('${ticket.ticket_id}')">
                                <i class="fas fa-plus"></i> Añadir Material
                            </button>
                        </div>
                    </div>
                    
                    <div class="notes-section" style="border-top: 2px solid #000000; background: #eff6ff;">
                        <h3><i class="fas fa-comment"></i> Notas Internas</h3>
                        <div style="max-height: 300px; overflow-y: auto; margin-top: 1rem;">
                            ${notesHtml}
                        </div>
                        <div class="add-note-form">
                            <input type="text" id="autorNota" placeholder="Tu nombre" value="${sessionStorage.getItem('username') || ''}" style="width: 100%;">
                            <textarea id="nuevaNota" placeholder="Escribe una nota interna..."></textarea>
                            <button class="btn-add-note" onclick="addNote('${ticket.ticket_id}')">
                                <i class="fas fa-plus"></i> Añadir Nota
                            </button>
                        </div>
                    </div>
                    
                    <div class="status-selector">
                        <div class="detail-label">Actualizar Estado</div>
                        <select id="statusSelect">
                            <option value="pendiente" ${ticket.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="en_proceso" ${ticket.estado === 'en_proceso' ? 'selected' : ''}>En Proceso</option>
                            <option value="resuelto" ${ticket.estado === 'resuelto' ? 'selected' : ''}>Resuelto</option>
                            <option value="cerrado" ${ticket.estado === 'cerrado' ? 'selected' : ''}>Cerrado</option>
                        </select>
                        <button class="btn-update-status" onclick="updateTicketStatus('${ticket.ticket_id}')">
                            <i class="fas fa-save"></i> Actualizar Estado
                        </button>
                    </div>

                    <div class="notes-section" style="border-top: 2px solid #065f46; background: #d1fae5;">
                        <h3><i class="fas fa-file-invoice-dollar"></i> Facturación</h3>
                        ${clientBillingInfoHtml}
                        <div id="invoiceList" style="margin-top: 1rem; max-height: 250px; overflow-y: auto;">
                            ${invoicesHtml}
                        </div>
                        <button class="btn-add-note" style="background-color: #065f46" onclick="createInvoiceForTicket('${ticket.ticket_id}')">
                            <i class="fas fa-plus"></i> Crear Factura
                        </button>
                    </div>
                `;

        document.getElementById('ticketModal').classList.add('active');
        applyPermissions();
    } catch (error) {
        console.error('Error loading ticket details:', error);
        showNotification('Error al cargar los detalles del ticket: ' + error.message, 'error');
    }
}

async function updateTicketStatus(ticketId) {
    const newStatus = document.getElementById('statusSelect').value;

    try {
        const response = await fetch(`/api/tickets/${ticketId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json', 'csrf-token': csrfToken
            },
            body: JSON.stringify({ estado: newStatus })
        });

        if (response.ok) {
            showNotification('Estado actualizado correctamente', 'success');
            closeModal();
            loadTickets();
        } else {
            showNotification('Error al actualizar el estado', 'error');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Error al actualizar el estado', 'error');
    }
}

function closeModal() {
    document.getElementById('ticketModal').classList.remove('active');
}

async function addNote(ticketId) {
    const nota = document.getElementById('nuevaNota').value;
    const autor = document.getElementById('autorNota').value;

    if (!nota || !autor) {
        showNotification('Por favor completa todos los campos', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/tickets/${ticketId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
            body: JSON.stringify({ nota, autor })
        });

        if (response.ok) {
            document.getElementById('nuevaNota').value = '';
            document.getElementById('autorNota').value = '';
            viewTicket(ticketId); // Reload ticket to show new note
        } else {
            showNotification('Error al añadir nota', 'error');
        }
    } catch (error) {
        console.error('Error adding note:', error);
        showNotification('Error al añadir nota', 'error');
    }
}

async function deleteNoteFromTicket(noteId) {
    const userConfirmed = await showConfirm('¿Está seguro que desea archivar esta nota? Se ocultará pero podrá recuperarse.', 'Archivar Nota');
    if (!userConfirmed) return;

    try {
        const response = await fetch(`/api/notes/${noteId}`, {
            method: 'DELETE',
            headers: { 'csrf-token': csrfToken }
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Nota archivada exitosamente', 'success');
            // ... load ticket logic ...
        } else if (response.status === 403) {
            showNotification('Solo administradores pueden archivar notas', 'error');
        } else {
            showNotification('Error: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Error al archivar nota: ' + error.message, 'error');
    }
}

// ==================== HORAS DE TRABAJO ====================

async function addHorasTrabajo(ticketId) {
    const tecnicoId = document.getElementById('horasTecnicoSelect').value;
    const tecnicoNombre = document.getElementById('horasTecnicoSelect').options[document.getElementById('horasTecnicoSelect').selectedIndex].dataset.name;
    const horas = parseFloat(document.getElementById('horasTrabajadas').value);
    const descripcion = document.getElementById('descripcionHoras').value;

    if (!tecnicoId || !tecnicoNombre || !horas || horas <= 0) {
        showNotification('Por favor completa todos los campos requeridos', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/tickets/${ticketId}/horas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
            body: JSON.stringify({
                usuarioId: parseInt(tecnicoId),
                tecnicoNombre,
                horas,
                descripcion
            })
        });

        if (response.ok) {
            showNotification('Horas registradas exitosamente', 'success');
            document.getElementById('horasTecnicoSelect').value = '';
            document.getElementById('horasTrabajadas').value = '';
            document.getElementById('descripcionHoras').value = '';
            viewTicket(ticketId);
        } else {
            let errorMsg = 'Error al registrar horas';
            try {
                const result = await response.json();
                errorMsg = result.error || errorMsg;
            } catch (e) {
                console.error('Could not parse error response:', e);
            }
            showNotification(errorMsg, 'error');
        }
    } catch (error) {
        console.error('Error registrando horas:', error);
        showNotification('Error al registrar horas', 'error');
    }
}

async function deleteHoraTrabajo(horaId, ticketId) {
    const userConfirmed = await showConfirm('¿Está seguro que desea eliminar este registro de horas?', 'Eliminar Registro');
    if (!userConfirmed) return;

    try {
        const response = await fetch(`/api/tickets/horas/${horaId}`, {
            method: 'DELETE',
            headers: { 'csrf-token': csrfToken }
        });

        if (response.ok) {
            showNotification('Registro de horas eliminado', 'success');
            viewTicket(ticketId);
        } else if (response.status === 403) {
            showNotification('Solo administradores pueden eliminar registros de horas', 'error');
        } else {
            const result = await response.json();
            showNotification('Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error eliminando horas:', error);
        showNotification('Error al eliminar horas', 'error');
    }
}

// ==================== TICKET MATERIALS ====================

async function addMaterialToTicket(ticketId) {
    const materialId = document.getElementById('materialSelect').value;
    const cantidad = parseFloat(document.getElementById('materialCantidad').value);

    if (!materialId || !cantidad || cantidad <= 0) {
        showNotification('Por favor, selecciona un material y especifica una cantidad válida.', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/tickets/${ticketId}/materiales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
            body: JSON.stringify({ material_id: materialId, cantidad: cantidad })
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error);
        }

        showNotification('Material añadido al ticket.', 'success');
        viewTicket(ticketId); // Refresh the modal

    } catch (error) {
        console.error('Error adding material to ticket:', error);
        showNotification('Error al añadir material: ' + error.message, 'error');
    }
}

async function removeMaterialFromTicket(ticketMaterialId, ticketId) {
    const userConfirmed = await showConfirm('¿Está seguro de que desea eliminar este material del ticket?', 'Eliminar Material');
    if (!userConfirmed) return;
    try {
        const response = await fetch(`/api/tickets/materiales/${ticketMaterialId}`, {
            method: 'DELETE',
            headers: { 'csrf-token': csrfToken }
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error);
        }

        showNotification('Material eliminado del ticket.', 'success');
        viewTicket(ticketId); // Refresh the modal

    } catch (error) {
        console.error('Error removing material from ticket:', error);
        showNotification('Error al eliminar material: ' + error.message, 'error');
    }
}

async function assignTechnicianToTicket(ticketId) {
    const tecnico = document.getElementById('tecnicoSelect').value;

    if (!tecnico) {
        showNotification('Por favor selecciona un técnico', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/tickets/${ticketId}/assign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
            body: JSON.stringify({ tecnico })
        });

        if (response.ok) {
            showNotification('Técnico asignado correctamente', 'success');
            closeModal();
            loadTickets();
        } else {
            showNotification('Error al asignar técnico', 'error');
        }
    } catch (error) {
        console.error('Error assigning technician:', error);
        showNotification('Error al asignar técnico', 'error');
    }
}

function exportToCSV() {
    if (filteredTickets.length === 0) {
        showNotification('No hay tickets para exportar', 'info');
        return;
    }

    const servicios = {
        'construccion': 'Construcción',
        'reparacion': 'Reparación',
        'obras': 'Obras',
        'fugas': 'Búsqueda de Fugas'
    };

    const headers = ['Ticket ID', 'Cliente', 'Email', 'Teléfono', 'Servicio', 'Prioridad', 'Estado', 'Técnico Asignado', 'Descripción', 'Fecha'];
    const rows = filteredTickets.map(ticket => [
        ticket.ticket_id,
        ticket.nombre,
        ticket.email,
        ticket.telefono,
        servicios[ticket.servicio] || ticket.servicio,
        ticket.prioridad,
        ticket.estado,
        ticket.tecnico_asignado || 'No asignado',
        ticket.descripcion.replace(/,/g, ';'),
        new Date(ticket.fecha_creacion).toLocaleString('es-ES')
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tickets_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function setWhatsAppMessage(message) {
    document.getElementById('whatsappMessage').value = message;
}

function formatPhoneNumber(phone) {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, assume it's a national number and add country code
    if (cleaned.startsWith('0')) {
        cleaned = '34' + cleaned.substring(1); // Spain country code
    }

    // If doesn't start with country code, add Spain code
    if (!cleaned.startsWith('34') && cleaned.length < 11) {
        cleaned = '34' + cleaned;
    }

    return cleaned;
}

async function sendWhatsApp(phone, ticketId, clientName) {
    const message = document.getElementById('whatsappMessage').value;
    const tecnico = document.getElementById('tecnicoWhatsApp').value;

    if (!tecnico) {
        showNotification('Por favor ingresa tu nombre', 'warning');
        return;
    }

    const formattedPhone = formatPhoneNumber(phone);
    const encodedMessage = encodeURIComponent(message || `Hola ${clientName}, te contacto por tu ticket ${ticketId}.`);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    // Register contact in database
    try {
        await fetch(`/api/tickets/${ticketId}/whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
            body: JSON.stringify({
                telefono: phone,
                mensaje: message || `Hola ${clientName}, te contacto por tu ticket ${ticketId}.`,
                enviado_por: tecnico
            })
        });
    } catch (error) {
        console.error('Error registering WhatsApp contact:', error);
    }

    // Open WhatsApp
    window.open(whatsappUrl, '_blank');

    // Reload ticket to show new contact
    setTimeout(() => viewTicket(ticketId), 1000);
}

function openWhatsApp(phone, ticketId, clientName) {
    const formattedPhone = formatPhoneNumber(phone);
    const message = `Hola ${clientName}, te contacto por tu ticket ${ticketId}. ¿En qué puedo ayudarte?`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
}

// Edit ticket
async function editTicket(ticketId) {
    try {
        const response = await fetch(`/api/tickets/${ticketId}`);
        const ticket = await response.json();

        const servicios = {
            'reparacion': 'Reparación de Equipos',
            'redes': 'Montaje de Redes',
            'impresoras': 'Soporte de Impresoras',
            'seguridad': 'Seguridad Informática',
            'errores': 'Detección de Errores',
            'soporte': 'Soporte Técnico General',
            'desarrollo_app': 'Programación de Aplicaciones Personalizadas',
            'desarrollo_web': 'Desarrollo de Entornos Web'
        };

        document.getElementById('editTicketId').value = ticketId;
        document.getElementById('editTicketNombre').value = ticket.nombre;
        document.getElementById('editTicketEmail').value = ticket.email;
        document.getElementById('editTicketTelefono').value = ticket.telefono;
        document.getElementById('editTicketDireccion').value = ticket.direccion || '';
        document.getElementById('editTicketServicio').value = ticket.servicio;
        document.getElementById('editTicketEmpresa').value = ticket.empresa_id || '';
        document.getElementById('editTicketPrioridad').value = ticket.prioridad;
        document.getElementById('editTicketEstado').value = ticket.estado;
        document.getElementById('editTicketTecnico').value = ticket.tecnico_asignado || '';
        document.getElementById('editTicketDescripcion').value = ticket.descripcion;

        document.getElementById('editTicketModal').style.display = 'block';
    } catch (error) {
        showNotification('Error al cargar el ticket: ' + error.message, 'error');
    }
}

// Save edited ticket
async function saveTicketEdit() {
    const ticketId = document.getElementById('editTicketId').value;
    const empresaId = document.getElementById('editTicketEmpresa').value;

    const nombre = document.getElementById('editTicketNombre').value;
    const email = document.getElementById('editTicketEmail').value;
    const telefono = document.getElementById('editTicketTelefono').value;
    const direccion = document.getElementById('editTicketDireccion').value;
    const servicio = document.getElementById('editTicketServicio').value;
    const descripcion = document.getElementById('editTicketDescripcion').value;

    if (!nombre || !email || !telefono || !servicio || !descripcion) {
        showNotification('Por favor complete todos los campos obligatorios del ticket', 'warning');
        return;
    }

    const ticketData = {
        nombre,
        email,
        telefono,
        direccion,
        servicio,
        empresa_id: empresaId ? parseInt(empresaId) : null,
        prioridad: document.getElementById('editTicketPrioridad').value,
        estado: document.getElementById('editTicketEstado').value,
        tecnico_asignado: document.getElementById('editTicketTecnico').value,
        descripcion
    };

    try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
            body: JSON.stringify(ticketData)
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Ticket actualizado exitosamente', 'success');
            document.getElementById('editTicketModal').style.display = 'none';
            loadTickets();
        } else {
            showNotification('Error: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Error al actualizar ticket: ' + error.message, 'error');
    }
}

// Archive ticket (soft delete)
async function deleteTicket(ticketId) {
    const userConfirmed = await showConfirm(`¿Está seguro que desea archivar el ticket ${ticketId}? Se ocultará pero podrá recuperarse.`, 'Archivar Ticket');
    if (!userConfirmed) return;

    try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
            method: 'DELETE',
            headers: { 'csrf-token': csrfToken }
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Ticket archivado exitosamente', 'success');
            loadTickets();
        } else if (response.status === 403) {
            showNotification('Solo administradores pueden archivar tickets', 'error');
        } else {
            showNotification('Error: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Error al archivar ticket: ' + error.message, 'error');
    }
}

// Restore ticket from archive
async function restoreTicket(ticketId) {
    try {
        const response = await fetch(`/api/tickets/${ticketId}/restore`, {
            method: 'POST',
            headers: { 'csrf-token': csrfToken }
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Ticket restaurado exitosamente', 'success');
            loadArchivedTickets();
        } else {
            showNotification('Error: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Error al restaurar ticket: ' + error.message, 'error');
    }
}

// Auto-refresh every 30 seconds
setInterval(loadTickets, 30000);

// Logout function
async function logout() {
    const userConfirmed = await showConfirm('¿Está seguro que desea cerrar sesión?', 'Cerrar Sesión');
    if (userConfirmed) {
        try {
            await fetch('/api/logout', { method: 'POST', headers: { 'csrf-token': csrfToken } });

            // Mostrar mensaje de éxito temporal
            const logoutBtn = document.querySelector('button[onclick="logout()"]');
            const originalContent = logoutBtn.innerHTML;
            logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cerrando...';
            logoutBtn.disabled = true;

            showNotification('Sesión cerrada correctamente. Volviendo al login...', 'success');
            window.location.href = '/login';
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            window.location.href = '/login';
        }
    }
}

// Mobile menu toggle function
function toggleMobileMenu() {
    const nav = document.getElementById('headerNav');
    if (nav) {
        nav.classList.toggle('active');
    }
}

// Close modal functions
function closeEditTicketModal() {
    document.getElementById('editTicketModal').style.display = 'none';
}

function closeCreateTicketModal() {
    document.getElementById('createTicketModal').style.display = 'none';
}

function openCreateTicketModal() {
    document.getElementById('createTicketModal').style.display = 'block';
}

// Create new ticket
async function saveNewTicket() {
    const empresaId = document.getElementById('createTicketEmpresa').value;

    const nombre = document.getElementById('createTicketNombre').value;
    const email = document.getElementById('createTicketEmail').value;
    const telefono = document.getElementById('createTicketTelefono').value;
    const direccion = document.getElementById('createTicketDireccion').value;
    const servicio = document.getElementById('createTicketServicio').value;
    const descripcion = document.getElementById('createTicketDescripcion').value;

    if (!nombre || !email || !telefono || !servicio || !descripcion) {
        showNotification('Por favor complete todos los campos obligatorios para el nuevo ticket', 'warning');
        return;
    }

    const ticketData = {
        nombre,
        email,
        telefono,
        direccion,
        servicio,
        empresa_id: empresaId ? parseInt(empresaId) : null,
        prioridad: document.getElementById('createTicketPrioridad').value,
        descripcion
    };

    try {
        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
            body: JSON.stringify(ticketData)
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Ticket creado exitosamente: ' + result.ticketId, 'success');
            document.getElementById('createTicketModal').style.display = 'none';
            // ... reset form logic ...
            loadTickets();
        } else {
            showNotification('Error: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Error al crear ticket: ' + error.message, 'error');
    }
}

window.onclick = function (event) {
    const ticketModal = document.getElementById('editTicketModal');
    const createModal = document.getElementById('createTicketModal');
    if (event.target === ticketModal) {
        ticketModal.style.display = 'none';
    }
    if (event.target === createModal) {
        createModal.style.display = 'none';
    }
}

// ==================== GESTIÓN DE USUARIOS ====================

function toggleUsersPanel() {
    const panel = document.getElementById('usersPanel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        loadUsers();
    }
}

function toggleBackupsPanel() {
    const panel = document.getElementById('backupsPanel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        loadBackups();
    }
}

async function loadBackups() {
    try {
        const response = await fetch('/api/backups');
        const data = await response.json();
        const backupsList = document.getElementById('backupsList');

        if (!data.backups || data.backups.length === 0) {
            backupsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">No hay backups disponibles</div>';
            return;
        }

        backupsList.innerHTML = data.backups.map(backup => `
                    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; background: white;">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <h4 style="margin: 0 0 0.5rem 0;">📦 ${backup.name}</h4>
                                <p style="margin: 0 0 0.25rem 0; font-size: 0.875rem; color: #6b7280;">
                                    <strong>Tamaño:</strong> ${backup.sizeReadable}
                                </p>
                                <p style="margin: 0; font-size: 0.875rem; color: #6b7280;">
                                    <strong>Fecha:</strong> ${backup.createdReadable}
                                </p>
                            </div>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                <button onclick="downloadBackup('${backup.name}')" class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                                    <i class="fas fa-download"></i> Descargar
                                </button>
                                <button onclick="restoreBackup('${backup.name}')" class="btn-warning" style="padding: 0.5rem 1rem; font-size: 0.875rem; background: #f59e0b; border: none; color: white; border-radius: 5px; cursor: pointer;">
                                    <i class="fas fa-undo"></i> Restaurar
                                </button>
                                <button onclick="deleteBackup('${backup.name}', event)" class="btn-danger" style="padding: 0.5rem 1rem; font-size: 0.875rem; background: #ef4444; border: none; color: white; border-radius: 5px; cursor: pointer;">
                                    <i class="fas fa-trash"></i> Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
    } catch (error) {
        console.error('Error cargando backups:', error);
        document.getElementById('backupsList').innerHTML = '<div style="color: #ef4444;">Error al cargar backups</div>';
    }
}

async function createBackupNow(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const userConfirmed = await showConfirm('¿Deseas crear una copia de seguridad de todos los datos ahora?', 'Crear Backup');
    if (!userConfirmed) return;

    const btn = event ? event.currentTarget : null;

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';
        }

        console.log('[createBackupNow] CSRF Token:', csrfToken);

        const response = await fetch('/api/backups/create', { method: 'POST', headers: { 'csrf-token': csrfToken } });

        console.log('[createBackupNow] Response status:', response.status);

        const data = await response.json();

        // Add delay before showing result
        await new Promise(resolve => setTimeout(resolve, 300));

        if (data.success) {
            const message = `Archivo: ${data.backup.name}\nTamaño: ${data.backup.sizeReadable}\n\n${data.note || ''}`;
            showNotification(message, 'success', 0, 'Backup Creado');

            // Auto-descargar el backup generado
            downloadBackup(data.backup.name);

            loadBackups();
        } else {
            showNotification(data.error || 'Error desconocido', 'error', 0);
        }
    } catch (error) {
        console.error('[createBackupNow] Error:', error);
        showNotification('Error al crear backup: ' + error.message, 'error', 0);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plus"></i> Crear Backup Ahora';
        }
    }
}

function downloadBackup(filename) {
    const link = document.createElement('a');
    link.href = `/api/backups/download/${filename}`;
    link.download = filename;
    link.click();
}

async function restoreBackup(filename) {
    const userConfirmed = await showConfirm(`¿Estás seguro de que deseas restaurar el backup "${filename}"? Esta acción reemplazará todos los datos actuales de la sesión.`, 'Restaurar Backup');
    if (!userConfirmed) return;

    try {
        const response = await fetch(`/api/backups/restore/${filename}`, {
            method: 'POST',
            headers: { 'csrf-token': csrfToken }
        });
        const data = await response.json();

        if (data.success) {
            showNotification('✅ Backup restaurado exitosamente. Recargando...', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification('❌ Error: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Error al restaurar: ' + error.message, 'error');
    }
}

async function deleteBackup(filename, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const userConfirmed = await showConfirm(`¿Estás seguro de que deseas eliminar permanentemente el backup "${filename}"?`, 'Eliminar Backup');
    if (!userConfirmed) return;

    try {
        const response = await fetch(`/api/backups/${filename}`, { method: 'DELETE', headers: { 'csrf-token': csrfToken } });
        const data = await response.json();

        await new Promise(resolve => setTimeout(resolve, 100));

        if (data.success) {
            showNotification('✅ Backup eliminado', 'success');
            loadBackups();
        } else {
            showNotification('❌ Error: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function uploadBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
        showNotification('❌ El archivo debe ser .json', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('backupFile', file);

    try {
        const response = await fetch('/api/backups/restore', {
            method: 'POST',
            headers: { 'csrf-token': csrfToken },
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            showNotification(`✅ Backup restaurado exitosamente: ${file.name}. Recargando...`, 'success', 0);
            setTimeout(() => location.reload(), 1500);
        } else {
            showNotification('❌ Error: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }

    // Limpiar input
    document.getElementById('backupFileInput').value = '';
}

async function loadUsers() {
    try {
        const response = await fetch('/api/usuarios');
        const users = await response.json();

        const tbody = document.getElementById('usersTableBody');

        if (users.length === 0) {
            tbody.innerHTML = `
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 2rem; color: #6b7280;">
                                No hay usuarios registrados
                            </td>
                        </tr>
                    `;
            applyPermissions();
            return;
        }

        tbody.innerHTML = users.map(user => `
                    <tr>
                        <td><strong>${user.username}</strong></td>
                        <td>${user.nombre_completo || '-'}</td>
                        <td>${user.email || '-'}</td>
                        <td>${user.whatsapp || '-'}</td>
                        <td>
                            <span class="badge badge-${user.rol === 'admin' ? 'admin' : 'tecnico'}">
                                ${user.rol === 'admin' ? 'Administrador' : 'Técnico'}
                            </span>
                        </td>
                        <td>
                            <span class="badge badge-${user.activo ? 'active' : 'inactive'}">
                                ${user.activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </td>
                        <td>${user.ultimo_acceso ? new Date(user.ultimo_acceso).toLocaleString('es-ES') : 'Nunca'}</td>
                        <td>
                            <div class="user-actions">
                                <button class="btn-icon btn-edit" onclick="editUser(${user.id})" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon btn-delete" onclick="deleteUser(${user.id}, '${user.username}')" title="Eliminar">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
        applyPermissions();
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        showNotification('Error al cargar usuarios', 'error');
    }
}

function showUserForm(user = null) {
    const container = document.getElementById('userFormContainer');
    const form = document.getElementById('userForm');
    const title = document.getElementById('formTitle');

    container.style.display = 'block';

    if (user) {
        title.textContent = 'Editar Usuario';
        document.getElementById('userId').value = user.id;
        document.getElementById('username').value = user.username;
        document.getElementById('username').disabled = true;
        document.getElementById('password').value = '';
        document.getElementById('password').required = false;
        document.getElementById('nombreCompleto').value = user.nombre_completo || '';
        document.getElementById('email').value = user.email || '';
        document.getElementById('whatsapp').value = user.whatsapp || '';
        document.getElementById('rol').value = user.rol;
        document.getElementById('activo').value = user.activo;
    } else {
        title.textContent = 'Nuevo Usuario';
        form.reset();
        document.getElementById('userId').value = ''; // Ensure ID is cleared for new user
        document.getElementById('username').disabled = false;
        document.getElementById('password').required = true;
        document.getElementById('nombreCompleto').value = '';
        document.getElementById('email').value = '';
        document.getElementById('whatsapp').value = '';
        document.getElementById('rol').value = 'tecnico';
        document.getElementById('activo').value = '1';
    }
}

function cancelUserForm() {
    document.getElementById('userFormContainer').style.display = 'none';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
}

async function saveUser(event) {
    event.preventDefault();

    const userId = document.getElementById('userId').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rol = document.getElementById('rol').value;
    const activoVal = document.getElementById('activo').value;

    if (!username || (!userId && !password) || !rol || activoVal === '') {
        showNotification('Por favor complete el usuario, la contraseña y el rol', 'warning');
        return;
    }

    const nombre_completo = document.getElementById('nombreCompleto').value;
    const email = document.getElementById('email').value;
    const whatsapp = document.getElementById('whatsapp').value;
    const activo = parseInt(activoVal);

    const userData = { username, nombre_completo, email, whatsapp, rol, activo };

    // Si no hay contraseña en edición, no enviarla
    if (userId && !password) {
        // Do nothing, password won't be included in userData if not provided
    } else {
        userData.password = password;
    }

    try {
        const url = userId ? `/api/usuarios/${userId}` : '/api/usuarios';
        const method = userId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'csrf-token': csrfToken
            },
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        await new Promise(resolve => setTimeout(resolve, 100));

        if (response.ok) {
            showNotification(result.message || 'Usuario guardado exitosamente', 'success');
            cancelUserForm();
            loadUsers();
        } else {
            // Show detailed error message
            let errorMsg = result.error || 'Error al guardar usuario';

            // If there are password validation details, show them
            if (result.details && Array.isArray(result.details)) {
                errorMsg += ':\n' + result.details.join('\n');
            }

            showNotification(errorMsg, 'error', 0);
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al guardar usuario', 'error');
    }
}

async function editUser(id) {
    try {
        const response = await fetch('/api/usuarios');
        const users = await response.json();
        const user = users.find(u => u.id === id);

        if (user) {
            showUserForm(user);
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al cargar usuario', 'error');
    }
}

async function deleteUser(id, username) {
    const userConfirmed = await showConfirm(`¿Estás seguro de eliminar al usuario "${username}"?`, 'Eliminar Usuario');
    if (!userConfirmed) return;

    try {
        const response = await fetch(`/api/usuarios/${id}`, {
            method: 'DELETE',
            headers: { 'csrf-token': csrfToken }
        });

        const result = await response.json();

        // Add delay before showing result
        await new Promise(resolve => setTimeout(resolve, 100));

        if (response.ok) {
            showNotification(result.message || 'Usuario eliminado exitosamente', 'success');
            loadUsers();
        } else {
            showNotification(result.error || 'Error al eliminar usuario', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al eliminar usuario', 'error');
    }
}

// Transfer Empresa Modal Functions
async function showTransferirEmpresaModal(ticketId, currentEmpresaId, currentEmpresaName) {
    try {
        // Load empresas for the dropdown
        const response = await fetch('/api/empresas');
        const empresas = await response.json();

        // Set current empresa info
        document.getElementById('currentEmpresaName').value = currentEmpresaName || 'Sin empresa asignada';
        document.getElementById('transferTicketId').value = ticketId;

        // Populate empresa dropdown (exclude current empresa)
        const targetSelect = document.getElementById('targetEmpresaId');
        targetSelect.innerHTML = '<option value="">Seleccionar empresa...</option>';

        empresas.forEach(empresa => {
            if (empresa.activo && empresa.id !== currentEmpresaId) {
                const option = document.createElement('option');
                option.value = empresa.id;
                option.textContent = empresa.nombre;
                targetSelect.appendChild(option);
            }
        });

        // Show modal
        document.getElementById('transferEmpresaModal').style.display = 'flex';
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al cargar empresas', 'error');
    }
}

function closeTransferEmpresaModal() {
    const modal = document.getElementById('transferEmpresaModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('targetEmpresaId').value = '';
        document.getElementById('transferTicketId').value = '';
    }
}

async function transferirTicketEmpresa() {
    const ticketId = document.getElementById('transferTicketId').value;
    const nuevaEmpresaId = document.getElementById('targetEmpresaId').value;

    if (!nuevaEmpresaId) {
        showNotification('Por favor selecciona una empresa destino', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/tickets/${ticketId}/transferir-empresa`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'csrf-token': csrfToken
            },
            body: JSON.stringify({ empresa_id: parseInt(nuevaEmpresaId) })
        });

        const result = await response.json();

        if (response.ok) {
            showNotification(result.message || 'Ticket transferido exitosamente', 'success');
            closeTransferEmpresaModal();
            setTimeout(() => {
                closeModal();
                loadTickets(); // Refresh tickets list
            }, 100);
        } else {
            showNotification(result.error || 'Error al transferir ticket', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al transferir ticket', 'error');
    }
}

// Calendar Panel Functions
function toggleCalendarPanel() {
    const panel = document.getElementById('calendarPanel');
    if (panel.style.display === 'none') {
        // Hide other panels
        document.getElementById('usersPanel').style.display = 'none';
        document.getElementById('backupsPanel').style.display = 'none';
        document.getElementById('servicesPanel').style.display = 'none';
        document.getElementById('materialsPanel').style.display = 'none';
        document.getElementById('empresasPanel').style.display = 'none';
        document.getElementById('clientesPanel').style.display = 'none';

        panel.style.display = 'block';
        loadAppointments();
        populateAppoTechnicianFilter();
    } else {
        panel.style.display = 'none';
    }
}

async function loadAppointments() {
    const calendarView = document.getElementById('calendarView');
    calendarView.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando agenda...</div>';

    try {
        const response = await fetch('/api/appointments', {
            headers: { 'csrf-token': csrfToken }
        });
        let appointments = await response.json();

        // Apply filters
        const technicianId = document.getElementById('filterAppoTecnico').value;
        const fechaInicio = document.getElementById('filterAppoFechaInicio').value;
        const fechaFin = document.getElementById('filterAppoFechaFin').value;

        if (technicianId) {
            appointments = appointments.filter(a => a.tecnico_id == technicianId);
        }

        if (fechaInicio) {
            const start = new Date(fechaInicio);
            start.setHours(0, 0, 0, 0);
            appointments = appointments.filter(a => new Date(a.fecha_cita) >= start);
        }

        if (fechaFin) {
            const end = new Date(fechaFin);
            end.setHours(23, 59, 59, 999);
            appointments = appointments.filter(a => new Date(a.fecha_cita) <= end);
        }

        if (appointments.length === 0) {
            calendarView.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">No hay citas programadas</div>';
            return;
        }

        const html = `
            <table class="users-table">
                <thead>
                    <tr>
                        <th>Fecha y Hora</th>
                        <th>Cliente</th>
                        <th>Técnico</th>
                        <th>Descripción</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${appointments.map(cita => `
                        <tr>
                            <td><strong>${new Date(cita.fecha_cita).toLocaleString('es-ES')}</strong></td>
                            <td>${cita.cliente_nombre}</td>
                            <td>${cita.tecnico_nombre || 'Asignado'}</td>
                            <td>${cita.descripcion || '-'}</td>
                            <td><span class="badge badge-${cita.estado}">${cita.estado}</span></td>
                            <td>
                                <div style="display: flex; gap: 0.5rem;">
                                    <button class="btn-sm" onclick="showTicketFromAppointment('${cita.ticket_id}')" title="Ver Ticket">
                                        <i class="fas fa-external-link-alt"></i>
                                    </button>
                                    ${currentUserRole === 'admin' ? `
                                        <button class="btn-sm" style="background-color: #ef4444;" onclick="deleteAppointment(${cita.id})" title="Eliminar">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        calendarView.innerHTML = html;
    } catch (error) {
        console.error('Error:', error);
        calendarView.innerHTML = '<div class="error">Error al cargar la agenda</div>';
    }
}

function showTicketFromAppointment(ticketId) {
    console.log('Opening ticket from appointment:', ticketId);
    if (!ticketId || ticketId === 'undefined') {
        showNotification('ID de ticket no válido en la cita', 'error');
        return;
    }
    toggleCalendarPanel();
    viewTicket(ticketId);
}

async function deleteAppointment(id) {
    const userConfirmed = await showConfirm('¿Seguro que deseas eliminar esta cita?', 'Eliminar Cita');
    if (!userConfirmed) return;

    try {
        const response = await fetch(`/api/appointments/${id}`, {
            method: 'DELETE',
            headers: { 'csrf-token': csrfToken }
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        if (response.ok) {
            loadAppointments();
        } else {
            showNotification('Error al eliminar cita', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al eliminar cita', 'error');
    }
}

async function populateAppoTechnicianFilter() {
    const select = document.getElementById('filterAppoTecnico');
    if (select.options.length > 1) return; // Already populated

    try {
        const response = await fetch('/api/usuarios');
        const users = await response.json();
        const technicians = users.filter(u => u.activo);

        technicians.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.nombre_completo || t.username;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error populating technicians filter:', error);
    }
}

async function exportAppointmentsCSV() {
    try {
        const response = await fetch('/api/appointments', {
            headers: { 'csrf-token': csrfToken }
        });
        const appointments = await response.json();

        if (appointments.length === 0) {
            showNotification('No hay citas para exportar', 'warning');
            return;
        }

        let csv = 'Fecha;Hora;Cliente;Tecnico;Descripcion;Estado\r\n';
        appointments.forEach(cita => {
            const date = new Date(cita.fecha_cita);
            const fechaStr = date.toLocaleDateString('es-ES');
            const horaStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

            csv += `"${fechaStr}";"${horaStr}";"${cita.cliente_nombre.replace(/"/g, '""')}";"${(cita.tecnico_nombre || 'Sin asignar').replace(/"/g, '""')}";"${(cita.descripcion || '').replace(/"/g, '""')}";"${cita.estado}"\r\n`;
        });

        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Agenda_Citas_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showNotification('Error al exportar agenda', 'error');
    }
}

function printAppointmentsAgenda() {
    const calendarView = document.getElementById('calendarView');
    const table = calendarView.querySelector('table');

    if (!table) {
        showNotification('No hay datos en la agenda para imprimir', 'warning');
        return;
    }

    const printWindow = window.open('', '_blank');
    const dateStr = new Date().toLocaleDateString('es-ES');

    printWindow.document.write(`
        <html>
            <head>
                <title>Agenda de Citas - FONT MULTISERVEIS</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 30px; }
                    .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
                    h1 { margin: 0; font-size: 20px; }
                    .date { color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #f3f4f6; text-align: left; padding: 12px; border: 1px solid #e5e7eb; font-weight: 600; }
                    td { padding: 12px; border: 1px solid #e5e7eb; vertical-align: top; }
                    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
                    .badge-pendiente { background: #fef3c7; color: #92400e; }
                    .badge-en_proceso { background: #dbeafe; color: #1e40af; }
                    .badge-resuelto { background: #d1fae5; color: #065f46; }
                    @media print {
                        @page { size: A4; margin: 1cm; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">FONT MULTISERVEIS</div>
                    <div>
                        <h1>AGENDA DE CITAS</h1>
                        <div class="date">${dateStr}</div>
                    </div>
                </div>
                ${table.outerHTML}
                <div style="margin-top: 40px; text-align: center; color: #999; font-size: 12px;">
                    © 2026 FONT MULTISERVEIS - Documento generado automáticamente
                </div>
            </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Hide actions column in print
    const rows = printWindow.document.querySelectorAll('tr');
    rows.forEach(row => {
        if (row.cells.length > 0) {
            row.deleteCell(-1); // Remove last column (Actions)
        }
    });

    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

// Appointment Creation Functions
async function showAddAppointmentModal(ticketId) {
    try {
        const response = await fetch('/api/usuarios');
        const users = await response.json();
        const technicians = users.filter(u => u.activo);


        const modalHtml = `
            <div id="appointmentModal" class="modal active">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Agendar Nueva Cita</h2>
                        <button class="close-modal" onclick="closeAppointmentModal()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <form onsubmit="event.preventDefault(); saveAppointment();">
                            <input type="hidden" id="appoTicketId" value="${ticketId}">
                            <div class="form-group">
                                <label>Técnico *</label>
                                <select id="appoTecnicoId" required>
                                    <option value="">Seleccionar técnico...</option>
                                    ${technicians.map(t => `<option value="${t.id}">${t.nombre_completo || t.username}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Fecha y Hora *</label>
                                <input type="datetime-local" id="appoFecha" required>
                            </div>
                            <div class="form-group">
                                <label>Descripción / Notas</label>
                                <textarea id="appoDescripcion" rows="3" placeholder="Detalles de la visita..."></textarea>
                            </div>
                            <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
                                <button type="button" class="btn" style="background: #6b7280;" onclick="closeAppointmentModal()">Cancelar</button>
                                <button type="submit" class="btn" style="background: #3b82f6;">
                                    <i class="fas fa-save"></i> Guardar y Notificar WhatsApp
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        let modalContainer = document.getElementById('tempModalContainer');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'tempModalContainer';
            document.body.appendChild(modalContainer);
        }
        modalContainer.innerHTML = modalHtml;

    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al cargar técnicos', 'error');
    }
}

function closeAppointmentModal() {
    const modal = document.getElementById('appointmentModal');
    if (modal) modal.remove();
}

async function saveAppointment() {
    const ticket_id = document.getElementById('appoTicketId').value;
    const tecnico_id = document.getElementById('appoTecnicoId').value;
    const fecha_cita = document.getElementById('appoFecha').value;
    const descripcion = document.getElementById('appoDescripcion').value;

    if (!tecnico_id || !fecha_cita) {
        showNotification('Por favor complete el técnico y la fecha', 'warning');
        return;
    }

    try {
        const response = await fetch('/api/appointments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'csrf-token': csrfToken
            },
            body: JSON.stringify({
                ticket_id,
                tecnico_id,
                fecha_cita,
                descripcion,
                _csrf: csrfToken
            })
        });

        if (response.ok) {
            showNotification('Cita agendada y notificación WhatsApp enviada al técnico.', 'success');
            closeAppointmentModal();
            loadAppointments(); // Refresh calendar if open
        } else {
            const err = await response.json();
            showNotification('Error: ' + err.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al guardar la cita', 'error');
    }
}

// ==================== FACTURAS MANAGEMENT ====================

function toggleFacturasPanel() {
    const panel = document.getElementById('facturasPanel');
    const isVisible = panel.style.display !== 'none';

    // Hide all other panels
    document.querySelectorAll('.users-panel, .services-panel, .materials-panel, .calendar-panel, #clientesPanel').forEach(p => {
        if (p.id !== 'facturasPanel') p.style.display = 'none';
    });

    if (isVisible) {
        panel.style.display = 'none';
    } else {
        panel.style.display = 'block';
        loadFacturas();
    }
}

async function loadFacturas() {
    try {
        const response = await fetch('/api/facturas', {
            headers: { 'csrf-token': csrfToken }
        });
        const facturas = await response.json();

        const tableBody = document.getElementById('facturasTableBody');

        if (facturas.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: #6b7280;">
                        No hay facturas registradas
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = facturas.map(factura => {
            const hasVerifactu = factura.hash ? true : false;
            const isPresentada = factura.presentada === 1;
            const isBloqueada = factura.bloqueada === 1;

            // Estado badge
            let estadoBadge = '';
            if (factura.estado === 'pagada') {
                estadoBadge = '<span class="badge badge-active">Pagada</span>';
            } else if (factura.estado === 'anulada') {
                estadoBadge = '<span class="badge badge-inactive">Anulada</span>';
            } else {
                estadoBadge = '<span class="badge" style="background: #f59e0b;">Pendiente</span>';
            }

            // Veri*Factu badge
            const verifactuBadge = hasVerifactu
                ? '<span class="badge badge-active"><i class="fas fa-check-circle"></i> Sí</span>'
                : '<span class="badge badge-inactive"><i class="fas fa-times-circle"></i> No</span>';

            // Presentada badge
            const presentadaBadge = isPresentada
                ? '<span class="badge badge-active"><i class="fas fa-lock"></i> Sí</span>'
                : '<span class="badge badge-inactive">No</span>';

            let actionButtons = `
                <button class="btn-icon btn-view" onclick="viewInvoice('${factura.factura_id}')" title="Ver factura">
                    <i class="fas fa-eye"></i>
                </button>
            `;

            if (!isBloqueada) {
                actionButtons += `
                    <button class="btn-icon btn-edit" onclick="editInvoice('${factura.factura_id}')" title="Editar factura">
                        <i class="fas fa-edit"></i>
                    </button>
                `;
            }

            if (!isBloqueada) {
                actionButtons += `
                    <button class="btn-icon btn-delete" onclick="deleteFactura('${factura.factura_id}')" title="Eliminar factura">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
            } else {
                actionButtons += `
                    <button class="btn-icon" style="background: #9ca3af; cursor: not-allowed;" disabled title="Factura bloqueada">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
            }

            if (hasVerifactu && !isPresentada) {
                actionButtons += `
                    <button class="btn-icon" style="background: #dc2626;" onclick="presentarFactura('${factura.factura_id}')" title="Presentar factura">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                `;
            }

            return `
                <tr style="${isBloqueada ? 'background: #f9fafb;' : ''}">
                    <td style="font-family: monospace; font-weight: 600;">
                        ${factura.factura_id}
                        ${isBloqueada ? '<i class="fas fa-lock" style="color: #dc2626; margin-left: 0.5rem;" title="Bloqueada"></i>' : ''}
                    </td>
                    <td>${factura.ticket_id}</td>
                    <td>${factura.cliente_nombre || '-'}</td>
                    <td>${factura.empresa_nombre || '-'}</td>
                    <td style="font-weight: 600;">${factura.total.toFixed(2)} €</td>
                    <td>${estadoBadge}</td>
                    <td>${verifactuBadge}</td>
                    <td>${presentadaBadge}</td>
                    <td class="user-actions">${actionButtons}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading facturas:', error);
        showNotification('Error al cargar las facturas', 'error');
    }
}

function presentarFactura(facturaId) {
    document.getElementById('facturaIdToPresent').value = facturaId;
    document.getElementById('confirmFacturaId').value = '';
    document.getElementById('presentarFacturaModal').style.display = 'block';
}

function closePresentarFacturaModal() {
    document.getElementById('presentarFacturaModal').style.display = 'none';
    document.getElementById('confirmFacturaId').value = '';
    document.getElementById('facturaIdToPresent').value = '';
}

async function confirmarPresentacion() {
    const facturaId = document.getElementById('facturaIdToPresent').value;
    const confirmId = document.getElementById('confirmFacturaId').value.trim();

    if (confirmId !== facturaId) {
        showNotification('❌ El número de factura no coincide. Por favor, escríbelo correctamente.', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/facturas/${facturaId}/presentar`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'csrf-token': csrfToken
            }
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('✅ Factura presentada y bloqueada exitosamente. Ya no puede ser modificada ni eliminada.', 'success', 0);
            closePresentarFacturaModal();
            loadFacturas();
        } else {
            showNotification('❌ Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error presentando factura:', error);
        showNotification('Error al presentar la factura', 'error');
    }
}

async function deleteFactura(facturaId) {
    const userConfirmed = await showConfirm(`¿Estás seguro de que deseas eliminar la factura ${facturaId}?\n\nEsta acción no se puede deshacer.`, 'Eliminar Factura');
    if (!userConfirmed) return;

    try {
        const response = await fetch(`/api/facturas/${facturaId}`, {
            method: 'DELETE',
            headers: {
                'csrf-token': csrfToken
            }
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('✅ Factura eliminada exitosamente', 'success');
            loadFacturas();
        } else {
            showNotification('❌ Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error eliminando factura:', error);
        showNotification('Error al eliminar la factura', 'error');
    }
}

async function editInvoice(invoiceId) {
    try {
        const response = await fetch(`/api/invoices/${invoiceId}`, {
            headers: { 'csrf-token': csrfToken }
        });
        const invoice = await response.json();

        if (invoice.bloqueada === 1) {
            showNotification('❌ Esta factura está bloqueada y no se puede editar', 'error');
            return;
        }

        // Fill form
        document.getElementById('editInvoiceId').value = invoice.id;
        document.getElementById('editInvoiceFacturaId').value = invoice.factura_id;
        document.getElementById('editInvoiceCliente').value = invoice.cliente_nombre || '';
        document.getElementById('editInvoiceEmail').value = invoice.cliente_email || '';
        document.getElementById('editInvoiceEstado').value = invoice.estado || 'borrador';

        if (invoice.fecha_vencimiento) {
            document.getElementById('editInvoiceVencimiento').value = new Date(invoice.fecha_vencimiento).toISOString().split('T')[0];
        } else {
            document.getElementById('editInvoiceVencimiento').value = '';
        }

        // Clear and fill items
        const itemsBody = document.getElementById('editInvoiceItemsBody');
        itemsBody.innerHTML = '';

        if (invoice.items && invoice.items.length > 0) {
            invoice.items.forEach(item => addInvoiceItemRow(item));
        } else {
            addInvoiceItemRow(); // Add one empty row if no items
        }

        calculateEditInvoiceTotals();
        document.getElementById('editInvoiceModal').classList.add('active');
    } catch (error) {
        console.error('Error loading invoice for edit:', error);
        showNotification('Error al cargar la factura para editar', 'error');
    }
}

function closeEditInvoiceModal() {
    document.getElementById('editInvoiceModal').classList.remove('active');
}

function addInvoiceItemRow(item = null) {
    const tbody = document.getElementById('editInvoiceItemsBody');
    const row = document.createElement('tr');

    row.innerHTML = `
        <td><input type="text" class="item-concepto" value="${item ? item.concepto : ''}" placeholder="Concepto" required style="width: 100%;"></td>
        <td><input type="text" class="item-descripcion" value="${item ? (item.descripcion || '') : ''}" placeholder="Descripción" style="width: 100%;"></td>
        <td><input type="number" class="item-cantidad" value="${item ? item.cantidad : 1}" min="0.1" step="0.1" onchange="calculateEditInvoiceTotals()" style="width: 100%;"></td>
        <td><input type="number" class="item-precio" value="${item ? item.precio_unitario : 0}" min="0" step="0.01" onchange="calculateEditInvoiceTotals()" style="width: 100%;"></td>
        <td class="item-total" style="font-weight: 600;">${item ? (item.cantidad * item.precio_unitario).toFixed(2) : '0.00'} €</td>
        <td>
            <button type="button" class="btn-small btn-delete" onclick="this.closest('tr').remove(); calculateEditInvoiceTotals();" title="Quitar ítem">
                <i class="fas fa-times"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);
}

function calculateEditInvoiceTotals() {
    const rows = document.querySelectorAll('#editInvoiceItemsBody tr');
    let subtotal = 0;

    rows.forEach(row => {
        const cant = parseFloat(row.querySelector('.item-cantidad').value) || 0;
        const precio = parseFloat(row.querySelector('.item-precio').value) || 0;
        const total = cant * precio;

        row.querySelector('.item-total').textContent = total.toFixed(2) + ' €';
        subtotal += total;
    });

    const iva = subtotal * 0.21;
    const total = subtotal + iva;

    document.getElementById('editInvoiceSubtotal').textContent = subtotal.toFixed(2);
    document.getElementById('editInvoiceIVA').textContent = iva.toFixed(2);
    document.getElementById('editInvoiceTotal').textContent = total.toFixed(2);
}

async function saveInvoiceEdit() {
    const id = document.getElementById('editInvoiceId').value;
    const items = [];
    const rows = document.querySelectorAll('#editInvoiceItemsBody tr');

    rows.forEach(row => {
        const concepto = row.querySelector('.item-concepto').value.trim();
        if (concepto) {
            items.push({
                concepto: concepto,
                descripcion: row.querySelector('.item-descripcion').value.trim(),
                cantidad: parseFloat(row.querySelector('.item-cantidad').value) || 0,
                precio_unitario: parseFloat(row.querySelector('.item-precio').value) || 0
            });
        }
    });

    if (items.length === 0) {
        showNotification('❌ La factura debe tener al menos un ítem con concepto', 'warning');
        return;
    }

    const data = {
        cliente_nombre: document.getElementById('editInvoiceCliente').value.trim(),
        cliente_email: document.getElementById('editInvoiceEmail').value.trim(),
        fecha_vencimiento: document.getElementById('editInvoiceVencimiento').value,
        estado: document.getElementById('editInvoiceEstado').value,
        items: items
    };

    try {
        const response = await fetch(`/api/facturas/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'csrf-token': csrfToken
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('✅ Factura actualizada correctamente', 'success');
            closeEditInvoiceModal();
            loadFacturas();
            // Also refresh ticket view if open
            if (document.getElementById('ticketModal').classList.contains('active')) {
                const ticketId = document.querySelector('#ticketDetails strong').textContent;
                viewTicket(ticketId);
            }
        } else {
            showNotification('❌ Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error saving invoice edit:', error);
        showNotification('Error al guardar los cambios de la factura', 'error');
    }
}

// ==================== CLIENTES MANAGEMENT ====================

function toggleClientesPanel() {
    const panel = document.getElementById('clientesPanel');
    const isVisible = panel.style.display !== 'none';

    // Hide all other panels
    document.querySelectorAll('.users-panel, .services-panel, .materials-panel, .calendar-panel, #facturasPanel').forEach(p => {
        if (p.id !== 'clientesPanel') p.style.display = 'none';
    });

    if (isVisible) {
        panel.style.display = 'none';
    } else {
        panel.style.display = 'block';
        loadClientes();
    }
}

async function loadClientes() {
    try {
        const response = await fetch('/api/clientes', {
            headers: { 'csrf-token': csrfToken }
        });
        const clientes = await response.json();
        const tbody = document.getElementById('clientesTableBody');
        tbody.innerHTML = '';

        if (clientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No hay clientes registrados</td></tr>';
            return;
        }

        clientes.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.nombre}</td>
                <td>${c.email || '-'}</td>
                <td>${c.telefono || '-'}</td>
                <td>${c.cif || '-'}</td>
                <td>${c.empresa_id || 'Particular'}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon btn-edit" onclick="editCliente(${c.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="deleteCliente(${c.id})" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading clients:', error);
        showNotification('Error al cargar clientes', 'error');
    }
}

async function loadEmpresasForClientes() {
    try {
        const response = await fetch('/api/empresas', {
            headers: { 'csrf-token': csrfToken }
        });
        const empresas = await response.json();
        const select = document.getElementById('clienteEmpresaId');
        if (!select) return;

        select.innerHTML = '<option value="">Ninguna</option>';
        empresas.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.id;
            opt.textContent = e.nombre;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('Error loading empresas for clients:', error);
    }
}

function showAddClienteModal() {
    document.getElementById('clienteModalTitle').textContent = 'Añadir Cliente';
    document.getElementById('editClienteId').value = '';
    document.getElementById('clienteForm').reset();
    loadEmpresasForClientes();
    document.getElementById('clienteModal').style.display = 'block';
}

function closeClienteModal() {
    document.getElementById('clienteModal').style.display = 'none';
}

async function saveCliente(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('editClienteId').value;
    const data = {
        nombre: document.getElementById('clienteNombre').value,
        email: document.getElementById('clienteEmail').value,
        telefono: document.getElementById('clienteTelefono').value,
        direccion: document.getElementById('clienteDireccion').value,
        cif: document.getElementById('clienteCIF').value,
        empresa_id: document.getElementById('clienteEmpresaId').value || null
    };

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/clientes/${id}` : '/api/clientes';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showNotification(id ? 'Cliente actualizado correctamente' : 'Cliente creado correctamente', 'success');
            closeClienteModal();
            loadClientes();
        } else {
            const err = await response.json();
            showNotification('Error: ' + err.error, 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function editCliente(id) {
    try {
        const response = await fetch(`/api/clientes/${id}`, {
            headers: { 'csrf-token': csrfToken }
        });
        const c = await response.json();

        document.getElementById('clienteModalTitle').textContent = 'Editar Cliente';
        document.getElementById('editClienteId').value = c.id;
        document.getElementById('clienteNombre').value = c.nombre;
        document.getElementById('clienteEmail').value = c.email || '';
        document.getElementById('clienteTelefono').value = c.telefono || '';
        document.getElementById('clienteDireccion').value = c.direccion || '';
        document.getElementById('clienteCIF').value = c.cif || '';

        await loadEmpresasForClientes();
        document.getElementById('clienteEmpresaId').value = c.empresa_id || '';

        document.getElementById('clienteModal').style.display = 'block';
    } catch (error) {
        showNotification('Error al cargar datos del cliente', 'error');
    }
}

async function deleteCliente(id) {
    const confirmed = await showConfirm('¿Estás seguro de que deseas eliminar este cliente?', 'Eliminar Cliente');
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/clientes/${id}`, {
            method: 'DELETE',
            headers: { 'csrf-token': csrfToken }
        });
        if (response.ok) {
            showNotification('Cliente eliminado correctamente', 'success');
            loadClientes();
        } else {
            const err = await response.json();
            showNotification('Error: ' + err.error, 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}


function showBillingDataModal(ticketId, currentCIF, currentDireccion) {
    document.getElementById('billingDataTicketId').value = ticketId;
    document.getElementById('billingDataCIF').value = currentCIF || '';
    document.getElementById('billingDataDireccion').value = currentDireccion || '';
    document.getElementById('billingDataModal').style.display = 'block';
}

function closeBillingDataModal() {
    document.getElementById('billingDataModal').style.display = 'none';
}

async function saveBillingDataUpdate() {
    const ticketId = document.getElementById('billingDataTicketId').value;
    const cif = document.getElementById('billingDataCIF').value;
    const direccion = document.getElementById('billingDataDireccion').value;

    if (!cif || !direccion) {
        showNotification('CIF y Dirección son obligatorios', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/tickets/${ticketId}/client-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
            body: JSON.stringify({ cif, direccion })
        });

        if (response.ok) {
            showNotification('Datos de facturación actualizados', 'success');
            closeBillingDataModal();
            viewTicket(ticketId); // Refresh view
        } else {
            const error = await response.json();
            showNotification('Error: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Error in billing data update:', error);
        showNotification('Error al actualizar los datos', 'error');
    }
}

async function handleCreateAbono(invoiceId) {
    const confirmed = await showConfirm(
        '¿Estás seguro de que deseas crear una factura de abono para rectificar esta factura? Se generará un nuevo registro con cantidades negativas.',
        'Crear Factura de Abono'
    );

    if (!confirmed) return;

    try {
        const response = await fetch(`/api/facturas/${invoiceId}/abono`, {
            method: 'POST',
            headers: {
                'csrf-token': csrfToken
            }
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Factura de abono creada exitosamente', 'success');
            // View the new invoice
            viewInvoice(result.invoiceId);
        } else {
            showNotification(result.error || 'Error al crear factura de abono', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al crear factura de abono', 'error');
    }
}
