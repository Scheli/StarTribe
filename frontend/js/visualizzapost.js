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

        const postContainer = document.querySelector('.post-container');
        if (!postContainer) {
            console.error("Elemento .post-container non trovato nel DOM");
            return;
        }

        // ensure container is empty
        while (postContainer.firstChild) postContainer.removeChild(postContainer.firstChild);

        // title
        const title = document.createElement('div'); title.className = 'posts-title'; title.textContent = 'Post suggeriti';
        postContainer.appendChild(title);

        // render each post using the post-card structure
        posts.forEach(articolo => {
            const article = document.createElement('article'); article.className = 'post-card';

            // header
            const header = document.createElement('header'); header.className = 'post-header';
            const avatar = document.createElement('img');
            avatar.src = (articolo.autoreImmagine && (/^https?:\/\//i.test(articolo.autoreImmagine) || articolo.autoreImmagine.startsWith('/'))) ? articolo.autoreImmagine : '/frontend/assets/default-pfp.jpg';
            avatar.alt = (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(articolo.autoreNome || '') : (articolo.autoreNome || '');
            const authorInfo = document.createElement('div'); authorInfo.className = 'post-author-info';
            const authorName = document.createElement('div'); authorName.className = 'post-author-name'; authorName.textContent = (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(articolo.autoreNome || '') : (articolo.autoreNome || '');
            const timeEl = document.createElement('time'); timeEl.className = 'post-date'; timeEl.textContent = articolo.createdAt ? new Date(articolo.createdAt).toLocaleDateString('it-IT') : '';
            authorInfo.append(authorName, timeEl);
            header.append(avatar, authorInfo);
            article.appendChild(header);

            // image
            if (articolo.ImmaginePost && (/^https?:\/\//i.test(articolo.ImmaginePost) || articolo.ImmaginePost.startsWith('/'))) {
                const imgWrap = document.createElement('div'); imgWrap.className = 'post-image-container';
                const pimg = document.createElement('img'); pimg.className = 'post-image'; pimg.src = articolo.ImmaginePost; pimg.alt = (articolo.titolo || '');
                imgWrap.appendChild(pimg); article.appendChild(imgWrap);
            }

            // details
            const details = document.createElement('div'); details.className = 'post-details';
            const h3 = document.createElement('h3'); h3.className = 'post-title'; h3.textContent = (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(articolo.titolo || '') : (articolo.titolo || '');
            const ptxt = document.createElement('p'); ptxt.className = 'post-text'; ptxt.textContent = (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(articolo.descrizione || '') : (articolo.descrizione || '');
            details.append(h3, ptxt); article.appendChild(details);

                        // footer (like action)
                        const footer = document.createElement('footer'); footer.className = 'post-footer';
                        const actions = document.createElement('div'); actions.className = 'post-actions';
                        // always add a like button (show count if available)
                        {
                                const likeBtn = document.createElement('button'); likeBtn.className = 'like-button';
                                const star = document.createElement('span'); star.className = 'like-icon';
                                // create SVG star via DOM
                                const svgNS = 'http://www.w3.org/2000/svg';
                                const svgEl = document.createElementNS(svgNS, 'svg');
                                svgEl.setAttribute('aria-hidden', 'true'); svgEl.setAttribute('width', '18'); svgEl.setAttribute('height', '18');
                                svgEl.setAttribute('viewBox', '0 0 24 24'); svgEl.setAttribute('fill', 'currentColor');
                                const path = document.createElementNS(svgNS, 'path');
                                path.setAttribute('d', 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z');
                                svgEl.appendChild(path); star.appendChild(svgEl);
                                // visual like button with count (client-side only)
                                const cnt = document.createElement('span'); cnt.className = 'like-count';
                                const likeCountVal = parseInt(typeof articolo.likes !== 'undefined' ? articolo.likes : (articolo.likeCount || articolo.likesCount || 0), 10) || 0;
                                cnt.textContent = String(likeCountVal);
                                likeBtn.append(star, cnt);

                                // initial liked state if API provides it (visual only)
                                const initiallyLiked = Boolean(articolo.liked || articolo.likedByMe || articolo.isLiked || articolo.myLike);
                                if (initiallyLiked) likeBtn.classList.add('liked');

                                // click handler: purely visual (toggle count + animation)
                                likeBtn.addEventListener('click', function () {
                                    const isNow = this.classList.toggle('liked');
                                    const c = this.querySelector('.like-count');
                                    const n = parseInt(c.textContent, 10) || 0;
                                    c.textContent = String(isNow ? n + 1 : Math.max(0, n - 1));
                                    this.classList.add('pop');
                                    setTimeout(() => this.classList.remove('pop'), 420);
                                });

                                actions.appendChild(likeBtn);
                        }
                        footer.appendChild(actions); article.appendChild(footer);

            postContainer.appendChild(article);
        });

    } catch (error) {
        console.error('Errore nel caricamento post:', error);
        showPopup({ title: 'Errore', text: (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(error.message || 'Errore nel caricamento post') : (error.message || 'Errore nel caricamento post') });
    }
}

document.addEventListener("DOMContentLoaded", PaginaPost);
