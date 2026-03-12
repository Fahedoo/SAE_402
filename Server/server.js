const express = require('express');
const path = require('path');
const app = express();

// Servir les fichiers statiques depuis public/
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});