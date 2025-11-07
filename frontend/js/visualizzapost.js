const token = localStorage.getItem("token");

async function resJsonSafe(res) {
  try { return await res.json(); }
  catch { return { success: false, message: 'Errore JSON' }; }
}

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
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Errore nella risposta della fetch');

    const posts = await response.json();
    console.log("Post ricevuti dal server:", posts);

    // Ordina dal più recente al più vecchio
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const listaPost = document.getElementById('listaPost');
    const searchInput = document.getElementById('cercaPost');

    // Escape semplice per prevenire XSS nelle parti interpolate
    function escapeHtml(unsafe) {
      if (unsafe === null || unsafe === undefined) return '';
      return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
    // Crea il card di un post
    function creaCardPost(articolo) {
      const div = document.createElement('div');
      div.classList.add('articolo');
      const autoreDiv = document.createElement('div');
      autoreDiv.classList.add('autore');
      if (articolo.autoreImmagine) {
        const img = document.createElement('img');
        img.src = articolo.autoreImmagine;
        img.alt = 'Avatar';
        autoreDiv.appendChild(img);
      }
      const span = document.createElement('span');
      span.textContent = articolo.autoreNome || 'Utente';
      autoreDiv.appendChild(span);

      // titolo, immagine, descrizione, data
      const titoloP = document.createElement('p');
      titoloP.innerHTML = `<strong>Titolo:</strong> ${escapeHtml(articolo.titolo || '')}`;

      const imgHtml = articolo.ImmaginePost ? (() => {
        const imgEl = document.createElement('img');
        imgEl.src = articolo.ImmaginePost;
        imgEl.alt = 'Immagine post';
        imgEl.classList.add('post-image');
        return imgEl;
      })() : null;

      const descrP = document.createElement('p');
      descrP.innerHTML = `<strong>Descrizione:</strong> ${escapeHtml(articolo.descrizione || '')}`;

      const dataP = document.createElement('p');
      dataP.innerHTML = `<strong>Data di pubblicazione:</strong> ${escapeHtml(articolo.createdAt || '')}`;

      // sezione azioni (like)
      const actionsDiv = document.createElement('div');
      actionsDiv.classList.add('post-actions');

      const likeBtn = document.createElement('button');
      likeBtn.classList.add('like-button');
      if (articolo.likedByMe) likeBtn.classList.add('liked');
      likeBtn.setAttribute('data-postid', articolo._id || '');
      likeBtn.setAttribute('aria-pressed', articolo.likedByMe ? 'true' : 'false');

      const starSpan = document.createElement('span');
      starSpan.classList.add('star');
      starSpan.textContent = articolo.likedByMe ? '★' : '☆';

      const countSpan = document.createElement('span');
      countSpan.classList.add('like-count');
      countSpan.textContent = String(articolo.likesCount || 0);

      likeBtn.appendChild(starSpan);
      likeBtn.appendChild(countSpan);

      actionsDiv.appendChild(likeBtn);

      // assemblaggio del card
      div.appendChild(autoreDiv);
      div.appendChild(titoloP);
      if (imgHtml) div.appendChild(imgHtml);
      div.appendChild(descrP);
      div.appendChild(dataP);
      div.appendChild(actionsDiv);

      return div;
    }

    function mostraPost(filtrati) {
      listaPost.innerHTML = '';
      if (filtrati.length === 0) {
        listaPost.innerHTML = '<p>Nessun post trovato.</p>';
        return;
      }
      filtrati.forEach(articolo => {
        const card = creaCardPost(articolo);
        listaPost.appendChild(card);
      });
    }

    // Delegazione evento per i pulsanti like
    listaPost.addEventListener('click', async (event) => {
      const btn = event.target.closest('.like-button');
      if (!btn) return;

      const postId = btn.getAttribute('data-postid');
      if (!postId) return;

      const starSpan = btn.querySelector('.star');
      const countSpan = btn.querySelector('.like-count');
      const currentlyLiked = btn.classList.contains('liked');

      try {
        const endpoint = currentlyLiked ? '/api/unlike' : '/api/like';
        const res = await fetch(`http://localhost:8080${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ postId })
        });

        const data = await resJsonSafe(res);
        if (!res.ok) {
          throw new Error(data?.message || 'Errore nella richiesta like');
        }

        // aggiorna contatore (usa likesCount dal backend se presente)
        let newCount = (data && typeof data.likesCount === 'number')
          ? data.likesCount
          : parseInt(countSpan.textContent || '0', 10) + (currentlyLiked ? -1 : 1);

        if (currentlyLiked) {
          btn.classList.remove('liked');
          btn.setAttribute('aria-pressed', 'false');
          starSpan.textContent = '☆';
        } else {
          btn.classList.add('liked');
          btn.setAttribute('aria-pressed', 'true');
          starSpan.textContent = '★';
        }
        countSpan.textContent = String(newCount);
      } catch (err) {
        console.error('Errore toggling like:', err);
        showPopup({ title: 'Errore', text: err.message || 'Errore like' });
      }
    });

    mostraPost(posts);

    searchInput.addEventListener('input', () => {
      const query = (searchInput.value || '').toLowerCase();
      const filtrati = posts.filter(post => (post.titolo || '').toLowerCase().includes(query));
      mostraPost(filtrati);
    });

  } catch (error) {
    console.error('Errore nel caricamento post:', error);
    showPopup({ title: 'Errore', text: (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(error.message || 'Errore nel caricamento post') : (error.message || 'Errore nel caricamento post') });
  }
}

document.addEventListener("DOMContentLoaded", PaginaPost);