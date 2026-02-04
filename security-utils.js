const validator = require('validator');

/**
 * Sanitiza una cadena de texto escapando HTML y eliminando espacios
 * @param {string} input - Texto a sanitizar
 * @returns {string} - Texto sanitizado
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    // Escapar HTML para prevenir XSS
    let sanitized = validator.escape(input);

    // Trim espacios
    sanitized = sanitized.trim();

    return sanitized;
}

/**
 * Sanitiza recursivamente un objeto
 * @param {object} obj - Objeto a sanitizar
 * @returns {object} - Objeto sanitizado
 */
function sanitizeObject(obj) {
    const sanitized = {};
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            sanitized[key] = sanitizeInput(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            sanitized[key] = sanitizeObject(obj[key]);
        } else {
            sanitized[key] = obj[key];
        }
    }
    return sanitized;
}

/**
 * Valida la fortaleza de una contraseña
 * @param {string} password - Contraseña a validar
 * @returns {object} - {valid: boolean, errors: string[]}
 */
function validatePasswordStrength(password) {
    const errors = [];

    if (password.length < 12) {
        errors.push('La contraseña debe tener al menos 12 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Debe contener al menos una letra mayúscula');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Debe contener al menos una letra minúscula');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Debe contener al menos un número');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Debe contener al menos un carácter especial');
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Valida un email
 * @param {string} email - Email a validar
 * @returns {boolean}
 */
function validateEmail(email) {
    return validator.isEmail(email);
}

/**
 * Valida un teléfono (formato español)
 * @param {string} phone - Teléfono a validar
 * @returns {boolean}
 */
function validatePhone(phone) {
    // Acepta formatos: 654892803, +34654892803, 34654892803
    return /^(\+34|34)?[6-9][0-9]{8}$/.test(phone.replace(/\s/g, ''));
}

module.exports = {
    sanitizeInput,
    sanitizeObject,
    validatePasswordStrength,
    validateEmail,
    validatePhone
};
