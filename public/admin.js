async function createInvoiceForTicket(ticketId) {
            if (!confirm('¿Está seguro de que desea crear una factura para este ticket? Se utilizarán las horas y materiales registrados.')) {
                return;
            }

            try {
                const response = await fetch(`/api/tickets/${ticketId}/invoices`, {
                    method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
                    body: JSON.stringify({ iva_percent: 21 }) 
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error);
                }

                alert(`Factura ${result.invoiceId} creada exitosamente.`);
                viewTicket(ticketId); // Recargar los detalles del ticket para mostrar la nueva factura

            } catch (error) {
                console.error('Error creating invoice:', error);
                alert('Error al crear la factura: ' + error.message);
            }
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
                    <div class="detail-row">
                        <div class="detail-label">Factura ID</div>
                        <div><strong>${invoice.factura_id}</strong></div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Cliente</div>
                        <div>${invoice.cliente_nombre}</div>
                    </div>
                     <div class="detail-row">
                        <div class="detail-label">Email</div>
                        <div>${invoice.cliente_email}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Fecha de Emisión</div>
                        <div>${new Date(invoice.fecha_emision).toLocaleDateString('es-ES')}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Estado</div>
                        <div><span class="badge badge-${invoice.estado}">${invoice.estado}</span></div>
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
                    <div style="margin-top: 2rem; text-align: right;">
                        <div style="font-size: 1.1rem;"><strong>Subtotal:</strong> ${invoice.subtotal.toFixed(2)} €</div>
                        <div style="font-size: 1.1rem;"><strong>IVA:</strong> ${invoice.iva.toFixed(2)} €</div>
                        <div style="font-size: 1.5rem; font-weight: bold; margin-top: 0.5rem;">Total: ${invoice.total.toFixed(2)} €</div>
                    </div>
                `;

                document.getElementById('invoiceDetails').innerHTML = detailsHtml;
                document.getElementById('invoiceModal').classList.add('active');

            } catch (error) {
                console.error('Error viewing invoice:', error);
                alert('Error al ver la factura: ' + error.message);
            }
        }

        function closeInvoiceModal() {
            document.getElementById('invoiceModal').classList.remove('active');
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
                        } catch (error) {
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

        async function saveUser(event) {
            event.preventDefault();
            const userId = document.getElementById('userId').value;
            const url = userId ? `/api/usuarios/${userId}` : '/api/usuarios';
            const method = userId ? 'PUT' : 'POST';

            const userData = {
                username: document.getElementById('username').value,
                nombre_completo: document.getElementById('nombreCompleto').value,
                email: document.getElementById('email').value,
                rol: document.getElementById('rol').value,
                activo: document.getElementById('activo').value,
                _csrf: csrfToken
            };

            const password = document.getElementById('password').value;
            if (password) {
                userData.password = password;
            }

            if (!userId && !password) {
                alert('La contraseña es obligatoria para nuevos usuarios.');
                return;
            }

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error);

                alert(`Usuario ${userId ? 'actualizado' : 'creado'} exitosamente.`);
                cancelUserForm();
                loadUsers();

            } catch (error) {
                console.error('Error saving user:', error);
                alert('Error al guardar usuario: ' + error.message);
            }
        }
        
        async function deleteUser(id) {
            if (!confirm('¿Está seguro de que desea eliminar este usuario? Esta acción no se puede deshacer.')) {
                return;
            }
            try {
                const response = await fetch(`/api/usuarios/${id}`, { method: 'DELETE', headers: { 'csrf-token': csrfToken } });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                
                alert('Usuario eliminado exitosamente.');
                loadUsers();

            } catch (error) {
                console.error('Error deleting user:', error);
                alert('Error al eliminar usuario: ' + error.message);
            }
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

            const serviceData = {
                codigo: document.getElementById('serviceCode').value,
                nombre: document.getElementById('serviceName').value,
                descripcion: document.getElementById('serviceDescription').value,
                activo: document.getElementById('serviceActive').value,
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

                alert(`Servicio ${serviceId ? 'actualizado' : 'creado'} exitosamente.`);
                cancelServiceForm();
                loadServices();

            } catch (error) {
                console.error('Error saving service:', error);
                alert('Error al guardar servicio: ' + error.message);
            }
        }

        async function deleteService(id) {
            if (!confirm('¿Está seguro de que desea eliminar este servicio?')) {
                return;
            }
            try {
                const response = await fetch(`/api/servicios/${id}`, { method: 'DELETE', headers: { 'csrf-token': csrfToken } });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                
                alert('Servicio eliminado exitosamente.');
                loadServices();

            } catch (error) {
                console.error('Error deleting service:', error);
                alert('Error al eliminar servicio: ' + error.message);
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

            const materialData = {
                nombre: document.getElementById('materialName').value,
                descripcion: document.getElementById('materialDescription').value,
                precio: parseFloat(document.getElementById('materialPrice').value),
                activo: document.getElementById('materialActive').value,
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

                alert(`Material ${materialId ? 'actualizado' : 'creado'} exitosamente.`);
                cancelMaterialForm();
                loadMaterials();

            } catch (error) {
                console.error('Error saving material:', error);
                alert('Error al guardar material: ' + error.message);
            }
        }

        async function deleteMaterial(id) {
            if (!confirm('¿Está seguro de que desea eliminar este material? Si está en uso en algún ticket, no podrá ser eliminado.')) {
                return;
            }
            try {
                const response = await fetch(`/api/materiales/${id}`, { method: 'DELETE', headers: { 'csrf-token': csrfToken } });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                
                alert('Material eliminado exitosamente.');
                loadMaterials();

            } catch (error) {
                console.error('Error deleting material:', error);
                alert('Error al eliminar material: ' + error.message);
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
                        <td><span class="badge ${empresa.activo ? 'badge-active' : 'badge-inactive'}">${empresa.activo ? 'Activa' : 'Inactiva'}</span></td>
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
            document.getElementById('empresaFormTitle').textContent = 'Editar Empresa';
            document.getElementById('empresaFormContainer').style.display = 'block';
        }

        async function saveEmpresa(event) {
            event.preventDefault();
            const empresaId = document.getElementById('empresaId').value;
            const url = empresaId ? `/api/empresas/${empresaId}` : '/api/empresas';
            const method = empresaId ? 'PUT' : 'POST';

            const empresaData = {
                nombre: document.getElementById('empresaNombre').value,
                cif: document.getElementById('empresaCif').value,
                direccion: document.getElementById('empresaDireccion').value,
                telefono: document.getElementById('empresaTelefono').value,
                email: document.getElementById('empresaEmail').value,
                activo: document.getElementById('empresaActive').value,
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

                alert(`Empresa ${empresaId ? 'actualizada' : 'creada'} exitosamente.`);
                cancelEmpresaForm();
                loadEmpresas();

            } catch (error) {
                console.error('Error saving empresa:', error);
                alert('Error al guardar empresa: ' + error.message);
            }
        }

        async function deleteEmpresa(id) {
            if (!confirm('¿Está seguro de que desea eliminar esta empresa? Los tickets asociados quedarán sin empresa.')) {
                return;
            }
            try {
                const response = await fetch(`/api/empresas/${id}`, { method: 'DELETE', headers: { 'csrf-token': csrfToken } });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                
                alert('Empresa eliminada exitosamente.');
                loadEmpresas();

            } catch (error) {
                console.error('Error deleting empresa:', error);
                alert('Error al eliminar empresa: ' + error.message);
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
                    alert('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
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
                    alert('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
                    window.location.href = '/login';
                    return;
                }
                
                if (response.status === 403) {
                    alert('Solo administradores pueden ver tickets archivados');
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
                'reparacion': 'Reparación',
                'redes': 'Redes',
                'impresoras': 'Impresoras',
                'seguridad': 'Seguridad',
                'errores': 'Errores',
                'soporte': 'Soporte'
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
                'reparacion': 'Reparación',
                'redes': 'Redes',
                'impresoras': 'Impresoras',
                'seguridad': 'Seguridad',
                'errores': 'Errores',
                'soporte': 'Soporte'
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
                            <th>Fecha</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredTickets.map(ticket => `
                            <tr>
                                <td><strong>${ticket.ticket_id}</strong></td>
                                <td>
                                    ${ticket.nombre}
                                    ${ticket.tecnico_asignado ? `<br><small style="color: #2563eb;"><i class="fas fa-user"></i> ${ticket.tecnico_asignado}</small>` : ''}
                                </td>
                                <td>${servicios[ticket.servicio] || ticket.servicio}</td>
                                <td><span class="badge badge-${ticket.prioridad}">${ticket.prioridad}</span></td>
                                <td><span class="badge badge-${ticket.estado}">${ticket.estado.replace('_', ' ')}</span></td>
                                <td>${new Date(ticket.fecha_creacion).toLocaleDateString('es-ES')}</td>
                                <td>
                                    <div class="action-btns">
                                        <button class="btn-small btn-view" onclick="viewTicket('${ticket.ticket_id}')">
                                            <i class="fas fa-eye"></i> Ver
                                        </button>
                                        <button class="btn-small btn-edit" onclick="editTicket('${ticket.ticket_id}')">
                                            <i class="fas fa-edit"></i> Editar
                                        </button>
                                        <button class="btn-small btn-delete" onclick="deleteTicket('${ticket.ticket_id}')">
                                            <i class="fas fa-trash"></i> Borrar
                                        </button>
                                        <button class="btn-whatsapp-quick" onclick="openWhatsApp('${ticket.telefono}', '${ticket.ticket_id}', '${ticket.nombre}')">
                                            <i class="fab fa-whatsapp"></i>
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
                    empresasResponse
                ] = await Promise.all([
                    fetch(`/api/tickets/${ticketId}`),
                    fetch(`/api/tickets/${ticketId}/notes`),
                    fetch(`/api/tickets/${ticketId}/whatsapp`),
                    fetch(`/api/tickets/${ticketId}/horas`),
                    fetch(`/api/tickets/${ticketId}/materiales`),
                    fetch('/api/usuarios'), // For technician dropdown
                    fetch('/api/materiales'), // For materials dropdown
                    fetch('/api/empresas') // For empresas
                ]);
                
                const ticket = await ticketResponse.json();
                const notes = await notesResponse.json();
                const whatsappContacts = await whatsappResponse.json();
                const horasData = await horasResponse.json();
                const ticketMaterials = await materialsResponse.json();
                const users = await usersResponse.json();
                const allMaterials = await allMaterialsResponse.json();
                const empresas = await empresasResponse.json();

                const operatives = users.filter(u => u.rol === 'tecnico' && u.activo);
                
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
                        <div class="detail-label">Servicio</div>
                        <div>${servicios[ticket.servicio]}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Empresa</div>
                        <div>
                            ${ticket.empresa_id ? (() => {
                                const empresa = empresas.find(e => e.id === ticket.empresa_id);
                                return empresa ? `<strong>${empresa.nombre}</strong>` : 'Sin empresa';
                            })() : 'Sin empresa'}
                            ${isAdmin ? `<button class="btn" style="background: #6366f1; margin-left: 1rem; padding: 0.3rem 0.8rem; font-size: 0.875rem;" onclick="showTransferirEmpresaModal('${ticket.ticket_id}', ${ticket.empresa_id || 'null'})">
                                <i class="fas fa-exchange-alt"></i> Transferir
                            </button>` : ''}
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
                            <button class="template-btn" onclick="setWhatsAppMessage('Hola ${ticket.nombre}, somos del servicio técnico. Hemos recibido tu solicitud ${ticket.ticket_id} sobre ${servicios[ticket.servicio]}. ¿En qué momento podemos visitarte?')">
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
                    
                    <div class="notes-section" style="border-top: 2px solid #3b82f6; background: #eff6ff;">
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
                        <div id="invoiceList" style="margin-top: 1rem;">
                            <!-- Las facturas se cargarán aquí -->
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
                alert('Error al cargar los detalles del ticket: ' + error.message);
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
                    alert('Estado actualizado correctamente');
                    closeModal();
                    loadTickets();
                } else {
                    alert('Error al actualizar el estado');
                }
            } catch (error) {
                console.error('Error updating status:', error);
                alert('Error al actualizar el estado');
            }
        }

        function closeModal() {
            document.getElementById('ticketModal').classList.remove('active');
        }

        async function addNote(ticketId) {
            const nota = document.getElementById('nuevaNota').value;
            const autor = document.getElementById('autorNota').value;
            
            if (!nota || !autor) {
                alert('Por favor completa todos los campos');
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
                    alert('Error al añadir nota');
                }
            } catch (error) {
                console.error('Error adding note:', error);
                alert('Error al añadir nota');
            }
        }

        // Delete note
        async function deleteNoteFromTicket(noteId) {
            if (!confirm('¿Está seguro que desea archivar esta nota? Se oculará pero podrá recuperarse.')) {
                return;
            }
            
            try {
                const response = await fetch(`/api/notes/${noteId}`, {
                    method: 'DELETE',
                    headers: { 'csrf-token': csrfToken }
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('Nota archivada exitosamente');
                    // Reload the current ticket
                    const ticketId = document.querySelector('input[type="hidden"][id*="ticket"]')?.value;
                    if (ticketId) {
                        viewTicket(ticketId);
                    }
                } else if (response.status === 403) {
                    alert('Solo administradores pueden archivar notas');
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error al archivar nota: ' + error.message);
            }
        }

        // ==================== HORAS DE TRABAJO ====================

        async function addHorasTrabajo(ticketId) {
            const tecnicoId = document.getElementById('tecnicoId').value;
            const tecnicoNombre = document.getElementById('tecnicoNombre').value;
            const horas = parseFloat(document.getElementById('horasTrabajadas').value);
            const descripcion = document.getElementById('descripcionHoras').value;
            
            if (!tecnicoId || !tecnicoNombre || !horas || horas <= 0) {
                alert('Por favor completa todos los campos requeridos');
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
                    alert('Horas registradas exitosamente');
                    document.getElementById('tecnicoId').value = '';
                    document.getElementById('tecnicoNombre').value = '';
                    document.getElementById('horasTrabajadas').value = '';
                    document.getElementById('descripcionHoras').value = '';
                    viewTicket(ticketId);
                } else {
                    const result = await response.json();
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                console.error('Error registrando horas:', error);
                alert('Error al registrar horas');
            }
        }

        async function deleteHoraTrabajo(horaId, ticketId) {
            if (!confirm('¿Está seguro que desea eliminar este registro de horas?')) {
                return;
            }
            
            try {
                const response = await fetch(`/api/tickets/horas/${horaId}`, {
                    method: 'DELETE',
                    headers: { 'csrf-token': csrfToken }
                });
                
                if (response.ok) {
                    alert('Registro de horas eliminado');
                    viewTicket(ticketId);
                } else if (response.status === 403) {
                    alert('Solo administradores pueden eliminar registros de horas');
                } else {
                    const result = await response.json();
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                console.error('Error eliminando horas:', error);
                alert('Error al eliminar horas');
            }
        }

        // ==================== TICKET MATERIALS ====================

        async function addMaterialToTicket(ticketId) {
            const materialId = document.getElementById('materialSelect').value;
            const cantidad = parseFloat(document.getElementById('materialCantidad').value);

            if (!materialId || !cantidad || cantidad <= 0) {
                alert('Por favor, selecciona un material y especifica una cantidad válida.');
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
                
                alert('Material añadido al ticket.');
                viewTicket(ticketId); // Refresh the modal

            } catch (error) {
                console.error('Error adding material to ticket:', error);
                alert('Error al añadir material: ' + error.message);
            }
        }

        async function removeMaterialFromTicket(ticketMaterialId, ticketId) {
            if (!confirm('¿Está seguro de que desea eliminar este material del ticket?')) {
                return;
            }
            try {
                const response = await fetch(`/api/tickets/materiales/${ticketMaterialId}`, {
                    method: 'DELETE',
                    headers: { 'csrf-token': csrfToken }
                });

                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.error);
                }
                
                alert('Material eliminado del ticket.');
                viewTicket(ticketId); // Refresh the modal

            } catch (error) {
                console.error('Error removing material from ticket:', error);
                alert('Error al eliminar material: ' + error.message);
            }
        }

        async function assignTechnicianToTicket(ticketId) {
            const tecnico = document.getElementById('tecnicoSelect').value;
            
            if (!tecnico) {
                alert('Por favor selecciona un técnico');
                return;
            }
            
            try {
                const response = await fetch(`/api/tickets/${ticketId}/assign`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
                    body: JSON.stringify({ tecnico })
                });
                
                if (response.ok) {
                    alert('Técnico asignado correctamente');
                    closeModal();
                    loadTickets();
                } else {
                    alert('Error al asignar técnico');
                }
            } catch (error) {
                console.error('Error assigning technician:', error);
                alert('Error al asignar técnico');
            }
        }

        function exportToCSV() {
            if (filteredTickets.length === 0) {
                alert('No hay tickets para exportar');
                return;
            }

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
                alert('Por favor ingresa tu nombre');
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
                document.getElementById('editTicketServicio').value = ticket.servicio;
                document.getElementById('editTicketEmpresa').value = ticket.empresa_id || '';
                document.getElementById('editTicketPrioridad').value = ticket.prioridad;
                document.getElementById('editTicketEstado').value = ticket.estado;
                document.getElementById('editTicketTecnico').value = ticket.tecnico_asignado || '';
                document.getElementById('editTicketDescripcion').value = ticket.descripcion;
                
                document.getElementById('editTicketModal').style.display = 'block';
            } catch (error) {
                alert('Error al cargar el ticket: ' + error.message);
            }
        }

        // Save edited ticket
        async function saveTicketEdit() {
            const ticketId = document.getElementById('editTicketId').value;
            const empresaId = document.getElementById('editTicketEmpresa').value;
            
            const ticketData = {
                nombre: document.getElementById('editTicketNombre').value,
                email: document.getElementById('editTicketEmail').value,
                telefono: document.getElementById('editTicketTelefono').value,
                servicio: document.getElementById('editTicketServicio').value,
                empresa_id: empresaId ? parseInt(empresaId) : null,
                prioridad: document.getElementById('editTicketPrioridad').value,
                estado: document.getElementById('editTicketEstado').value,
                tecnico_asignado: document.getElementById('editTicketTecnico').value,
                descripcion: document.getElementById('editTicketDescripcion').value
            };
            
            try {
                const response = await fetch(`/api/tickets/${ticketId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
                    body: JSON.stringify(ticketData)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('Ticket actualizado exitosamente');
                    document.getElementById('editTicketModal').style.display = 'none';
                    loadTickets();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error al actualizar ticket: ' + error.message);
            }
        }

        // Archive ticket (soft delete)
        async function deleteTicket(ticketId) {
            if (!confirm(`¿Está seguro que desea archivar el ticket ${ticketId}? Se ocultará pero podrá recuperarse.`)) {
                return;
            }
            
            try {
                const response = await fetch(`/api/tickets/${ticketId}`, {
                    method: 'DELETE',
                    headers: { 'csrf-token': csrfToken }
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('Ticket archivado exitosamente');
                    loadTickets();
                } else if (response.status === 403) {
                    alert('Solo administradores pueden archivar tickets');
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error al archivar ticket: ' + error.message);
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
                    alert('Ticket restaurado exitosamente');
                    loadArchivedTickets();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error al restaurar ticket: ' + error.message);
            }
        }

        // Auto-refresh every 30 seconds
        setInterval(loadTickets, 30000);

        // Logout function
        async function logout() {
            if (confirm('¿Está seguro que desea cerrar sesión?')) {
                try {
                    await fetch('/api/logout', { method: 'POST', headers: { 'csrf-token': csrfToken } });
                    window.location.href = '/login';
                } catch (error) {
                    console.error('Error al cerrar sesión:', error);
                    window.location.href = '/login';
                }
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
            
            const ticketData = {
                nombre: document.getElementById('createTicketNombre').value,
                email: document.getElementById('createTicketEmail').value,
                telefono: document.getElementById('createTicketTelefono').value,
                servicio: document.getElementById('createTicketServicio').value,
                empresa_id: empresaId ? parseInt(empresaId) : null,
                prioridad: document.getElementById('createTicketPrioridad').value,
                descripcion: document.getElementById('createTicketDescripcion').value
            };
            
            try {
                const response = await fetch('/api/tickets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'csrf-token': csrfToken },
                    body: JSON.stringify(ticketData)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('Ticket creado exitosamente: ' + result.ticketId);
                    document.getElementById('createTicketModal').style.display = 'none';
                    // Clear form
                    document.getElementById('createTicketNombre').value = '';
                    document.getElementById('createTicketEmail').value = '';
                    document.getElementById('createTicketTelefono').value = '';
                    document.getElementById('createTicketServicio').value = '';
                    document.getElementById('createTicketPrioridad').value = 'media';
                    document.getElementById('createTicketDescripcion').value = '';
                    loadTickets();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error al crear ticket: ' + error.message);
            }
        }

        window.onclick = function(event) {
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
                            <div style="display: flex; gap: 0.5rem;">
                                <button onclick="downloadBackup('${backup.name}')" class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                                    <i class="fas fa-download"></i> Descargar
                                </button>
                                <button onclick="deleteBackup('${backup.name}')" class="btn-danger" style="padding: 0.5rem 1rem; font-size: 0.875rem; background: #ef4444; border: none; color: white; border-radius: 5px; cursor: pointer;">
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

        async function createBackupNow() {
            if (!confirm('¿Crear una copia de seguridad ahora?')) return;
            
            try {
                const btn = event.target;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';
                
                const response = await fetch('/api/backups/create', { method: 'POST', headers: { 'csrf-token': csrfToken } });
                const data = await response.json();
                
                if (data.success) {
                    alert('✅ Backup creado: ' + data.backup.name);
                    loadBackups();
                } else {
                    alert('❌ Error: ' + data.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            } finally {
                const btn = event.target;
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-plus"></i> Crear Backup Ahora';
            }
        }

        function downloadBackup(filename) {
            const link = document.createElement('a');
            link.href = `/api/backups/download/${filename}`;
            link.download = filename;
            link.click();
        }

        async function deleteBackup(filename) {
            if (!confirm(`¿Eliminar el backup ${filename}?`)) return;
            
            try {
                const response = await fetch(`/api/backups/${filename}`, { method: 'DELETE', headers: { 'csrf-token': csrfToken } });
                const data = await response.json();
                
                if (data.success) {
                    alert('✅ Backup eliminado');
                    loadBackups();
                } else {
                    alert('❌ Error: ' + data.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }

        async function uploadBackup(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            if (!file.name.endsWith('.tar.gz')) {
                alert('❌ El archivo debe ser .tar.gz');
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
                    alert(`✅ Backup subido: ${file.name}\n\nPara restaurar, ejecuta en el servidor: node restore.js`);
                    loadBackups();
                } else {
                    alert('❌ Error: ' + data.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
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
                            <td colspan="7" style="text-align: center; padding: 2rem; color: #6b7280;">
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
                alert('Error al cargar usuarios');
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
                document.getElementById('rol').value = user.rol;
                document.getElementById('activo').value = user.activo;
            } else {
                title.textContent = 'Nuevo Usuario';
                form.reset();
                document.getElementById('username').disabled = false;
                document.getElementById('password').required = true;
                document.getElementById('activo').value = '1';
                document.getElementById('rol').value = 'tecnico';
            }
        }

        function cancelUserForm() {
            document.getElementById('userFormContainer').style.display = 'none';
            document.getElementById('userForm').reset();
        }

        async function saveUser(event) {
            event.preventDefault();
            
            const userId = document.getElementById('userId').value;
            const data = {
                username: document.getElementById('username').value,
                password: document.getElementById('password').value,
                nombre_completo: document.getElementById('nombreCompleto').value,
                email: document.getElementById('email').value,
                rol: document.getElementById('rol').value,
                activo: parseInt(document.getElementById('activo').value)
            };
            
            // Si no hay contraseña en edición, no enviarla
            if (userId && !data.password) {
                delete data.password;
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
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert(result.message || 'Usuario guardado exitosamente');
                    cancelUserForm();
                    loadUsers();
                } else {
                    alert(result.error || 'Error al guardar usuario');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al guardar usuario');
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
                alert('Error al cargar usuario');
            }
        }

        async function deleteUser(id, username) {
            if (!confirm(`¿Estás seguro de eliminar al usuario "${username}"?`)) {
                return;
            }
            
            try {
                const response = await fetch(`/api/usuarios/${id}`, {
                    method: 'DELETE',
                    headers: { 'csrf-token': csrfToken }
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert(result.message || 'Usuario eliminado exitosamente');
                    loadUsers();
                } else {
                    alert(result.error || 'Error al eliminar usuario');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al eliminar usuario');
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
                alert('Error al cargar empresas');
            }
        }

        function closeTransferEmpresaModal() {
            document.getElementById('transferEmpresaModal').style.display = 'none';
            document.getElementById('targetEmpresaId').value = '';
            document.getElementById('transferTicketId').value = '';
        }

        async function transferirTicketEmpresa() {
            const ticketId = document.getElementById('transferTicketId').value;
            const nuevaEmpresaId = document.getElementById('targetEmpresaId').value;
            
            if (!nuevaEmpresaId) {
                alert('Por favor selecciona una empresa destino');
                return;
            }
            
            try {
                const response = await fetch(`/api/tickets/${ticketId}/transferir-empresa`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'csrf-token': csrfToken
                    },
                    body: JSON.stringify({ nuevaEmpresaId: parseInt(nuevaEmpresaId) })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert(result.message || 'Ticket transferido exitosamente');
                    closeTransferEmpresaModal();
                    closeModal();
                    loadTickets(); // Refresh tickets list
                } else {
                    alert(result.error || 'Error al transferir ticket');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al transferir ticket');
            }
        }
