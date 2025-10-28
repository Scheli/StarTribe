// Funzione per sanitizzare il testo e prevenire XSS
function sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.textContent;
}

// Funzione per creare elementi DOM in modo sicuro
function createSafeElement(tag, attributes = {}, textContent = '') {
    const element = document.createElement(tag);
    
    // Sanitizza e imposta gli attributi sicuri
    Object.keys(attributes).forEach(key => {
        if (key === 'className') {
            element.className = attributes[key];
        } else if (key === 'src' && tag === 'img') {
            // Verifica che src sia un URL valido e relativo al dominio
            if (attributes[key].startsWith('/')) {
                element.setAttribute(key, attributes[key]);
            }
        }
    });
    
    // Imposta il testo sanitizzato
    if (textContent) {
        element.textContent = sanitizeText(textContent);
    }
    
    return element;
}

// Esporta le funzioni
window.safeDom = {
    sanitizeText,
    createSafeElement
};