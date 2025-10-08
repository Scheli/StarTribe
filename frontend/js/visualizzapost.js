const token = localStorage.getItem("token");

async function PaginaPost(){

    const token = localStorage.getItem("token");

    if (!token) {
        alert("Token mancante. Effettua il login.");
        return;
    }

    try{

        const response = await fetch("http://localhost:8080/api/post", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            },
        });
        if(!response.ok) throw new Error('Errore nella risposta della fetch');

        const post = await response.json();
        const postContainer = document.querySelector('.post-utenti');

        postContainer.innerHTML = '<h3>Post suggeriti:</h3>';

        post.forEach(articolo => {
            const div = document.createElement('div');
            div.classList.add('articolo');
            div.innerHTML = `
                <p><strong>Titolo:</strong> ${articolo.titolo}</p>
                <img src="${articolo.ImmaginePost}">
                <p><strong>descrizione:</strong> ${articolo.descrizione}</p>
                <p><strong>Punteggio:</strong> ${articolo.createdAt}</p>
            `;

            postContainer.appendChild(div);
        });

        

    }catch(error){
        console.error('Errore nel caricamento utenti:', error);
    }
}

document.addEventListener('DOMContentLoaded', PaginaPost);