# Fuentes oficiales: cómo se conecta la plataforma

**Principio:** la plataforma **enlaza y verifica**; no copia datos de terceros. Ninguna de estas fuentes ofrece hoy una API pública con licencia para un uso comercial como el nuestro.

| Fuente | Qué hay | Por qué no se copia | Cómo se conecta hoy |
|---|---|---|---|
| FIBA | Fichas de jugador públicas (`fiba.basketball/en/players/<id>-<nombre>`) y directorio de las 50 federaciones europeas | Sus condiciones prohíben duplicar o redistribuir contenido. Los datos de partido se licencian con Genius Sports | Reconocemos las fichas FIBA que añade el atleta, buscamos su nombre en FIBA y enlazamos la página oficial de su federación |
| Federaciones nacionales (50 de FIBA Europa) | Fichas y estadísticas de ligas nacionales | Cada una tiene sus condiciones; los datos son de la federación | Registro en `src/content/official-sources.ts`, con la página de FIBA de cada federación. La web propia está comprobada para España (feb.es) y Francia (ffbb.com); las demás las añade Operaciones al verificarlas |
| NCAA | Estadísticas oficiales en stats.ncaa.org | Sus condiciones prohíben reproducir contenido sin permiso escrito | Reconocimiento de enlaces y búsqueda del nombre en stats.ncaa.org |
| ESPN | Fichas de jugador | Sin API pública desde 2014 | Reconocimiento de enlaces y búsqueda |
| EuroLeague | Fichas y estadísticas de la Euroliga y la EuroCup | Uso de datos solo con permiso | Reconocimiento de enlaces y búsqueda |

## Dónde se ve

- **Passport del atleta:** cada enlace oficial muestra su fuente («Ficha en FIBA», «Federación (España)») y la etiqueta «Fuente oficial».
- **Ficha 360 del agente → Resumen:**
  - el panel «Fuentes oficiales» muestra los enlaces oficiales del atleta, cada uno como verificado o sin verificar;
  - y botones para buscar su nombre en su federación, FIBA, NCAA, ESPN y EuroLeague.
- **Operaciones → Verificación → Enlaces por verificar:** indica si el enlace es de una fuente oficial o no, para verificar más rápido.
- **Formulario de enlaces:** pide al atleta su ficha de la federación, FIBA, NCAA o Euroliga.

## «Fuente oficial» y «Verificado»

Son dos cosas distintas:
- **Fuente oficial:** el enlace es de un sitio oficial. Se calcula solo y no se deja engañar por dominios parecidos.
- **Verificado:** Operaciones ha comprobado que esa ficha es de ese atleta.

## Para tener datos oficiales dentro de la app (siguiente paso de negocio)

1. **Baloncesto europeo:** licencia con Genius Sports (FIBA LiveStats) o acuerdo con una federación. Lo más asequible para empezar es la FBCV o la FEB.
2. **NCAA:** permiso escrito de la NCAA o un proveedor con licencia.
3. **Al firmar,** se añade un conector por proveedor que guarda las estadísticas vinculadas al Passport, siempre con el consentimiento del atleta y con la fuente indicada.
