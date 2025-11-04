const token = localStorage.getItem("token");

async function resJsonSafe(res) {
    try { return await res.json(); }
    catch { return { success: false, message: 'Errore JSON' }; }
}

// Popup helper (sanitized) - reuse the safe popup used in profilo.js when available
function showPopup({ title = '', text = '', duration = 1500 } = {}) {
    if (window.safeDom && window.safeDom.createSafeElement) {
        const overlay = window.safeDom.createSafeElement('div', { className: 'welcome-overlay' });
        const popupDiv = window.safeDom.createSafeElement('div', { className: 'welcome-popup' });
        const logo = window.safeDom.createSafeElement('img', {
            className: 'welcome-logo',
            src: '/frontend/assets/logo.png'
        });
        logo.alt = 'Logo';
        const titleElement = window.safeDom.createSafeElement('h2', {}, title);
        const textElement = window.safeDom.createSafeElement('p', {}, text);
        const loadingBar = window.safeDom.createSafeElement('div', { className: 'loading-bar' });
        const loadingFill = window.safeDom.createSafeElement('div', { className: 'loading-fill' });
        loadingBar.appendChild(loadingFill);
        popupDiv.append(logo, titleElement, textElement, loadingBar);
        overlay.appendChild(popupDiv);
        document.body.appendChild(overlay);
        setTimeout(() => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.5s ease';
            setTimeout(() => overlay.remove(), 600);
        }, duration);
    } else {
        // fallback simple alert if safeDom not available
        try { alert((title ? title + '\n' : '') + (text || '')) } catch (e) { console.log(title, text); }
    }
}

async function PaginaPost() {
    const token = localStorage.getItem("token");

    if (!token) {
        showPopup({ title: 'Errore', text: (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText('Token mancante. Effettua il login.') : 'Token mancante. Effettua il login.', duration: 1800 });
        return;
    }

    try {
        const response = await fetch("http://localhost:8080/api/post", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            },
        });

        if (!response.ok) throw new Error('Errore nella risposta della fetch');

        const posts = await response.json(); 
        console.log("Post ricevuti dal server:", posts);

        posts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        const postContainer = document.querySelector('.post-utenti');
        if (!postContainer) {
            console.error("Elemento .post-container non trovato nel DOM");
            return;
        }

        const listaPost = document.getElementById('listaPost');
        const searchInput = document.getElementById('cercaPost');

        function mostraPost(filtrati) {
            listaPost.innerHTML = '';

            if (filtrati.length === 0) {
                listaPost.innerHTML = '<p>Nessun post trovato.</p>';
                return;
            }

            filtrati.forEach(articolo => {
                const div = document.createElement('div');
                div.classList.add('articolo');
                div.innerHTML = `
                    <div class="autore">
                        ${articolo.autoreImmagine ? `<img src="${articolo.autoreImmagine}" alt="Avatar">` : ''}
                        <span>${articolo.autoreNome}</span>
                    </div>
                    <p><strong>Titolo:</strong> ${articolo.titolo}</p>
                    ${articolo.ImmaginePost ? `<img src="${articolo.ImmaginePost}" alt="Immagine post">` : ''}
                    <p><strong>Descrizione:</strong> ${articolo.descrizione}</p>
                    <p><strong>Data di pubblicazione:</strong> ${new Date(articolo.createdAt).toLocaleString()}</p>
                `;
                listaPost.appendChild(div);
            });
        }

        mostraPost(posts);

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const filtrati = posts.filter(post => post.titolo.toLowerCase().includes(query));
            mostraPost(filtrati);
        });

    } catch (error) {
        console.error('Errore nel caricamento post:', error);
        showPopup({ title: 'Errore', text: (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(error.message || 'Errore nel caricamento post') : (error.message || 'Errore nel caricamento post') });
    }
}

document.addEventListener("DOMContentLoaded", PaginaPost);