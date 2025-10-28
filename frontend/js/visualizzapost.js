const token = localStorage.getItem("token");

async function PaginaPost() {
    const token = localStorage.getItem("token");

    if (!token) {
        alert("Token mancante. Effettua il login.");
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

        const postContainer = document.querySelector('.post-utenti');
        if (!postContainer) {
            console.error("Elemento .post-utenti non trovato nel DOM");
            return;
        }

        postContainer.innerHTML = '<h3>Post suggeriti:</h3>';

        posts.forEach(articolo => {
            const div = document.createElement('div');
            div.classList.add('articolo');
            div.innerHTML = `
                <div class="autore">
                    ${articolo.autoreImmagine ? `<img src="${articolo.autoreImmagine}" alt="Avatar">` : ''}
                    <span>${articolo.autoreNome}</span>
                </div>
                <p><strong>Titolo:</strong> ${articolo.titolo}</p>
                <img src="${articolo.ImmaginePost}" alt="Immagine post">
                <p><strong>Descrizione:</strong> ${articolo.descrizione}</p>
                <p><strong>Data di pubblicazione:</strong> ${articolo.createdAt}</p>
            `;
            postContainer.appendChild(div);
        });

    } catch (error) {
        console.error('Errore nel caricamento post:', error);
    }
}

document.addEventListener("DOMContentLoaded", PaginaPost);
