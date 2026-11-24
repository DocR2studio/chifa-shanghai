/* story.js — Historia de demostración (romance y misterio).
   Para reemplazar el contenido, edita este archivo.
   Cada escena admite:
     name        Nombre que aparece en las partidas guardadas
     bg          Clase CSS de fondo (bg-rain, bg-cafe, bg-tension, bg-dawn, bg-alone)
     background  Ruta a una imagen (opcional). Si no carga, se usa el degradado de bg.
     video       Ruta a un video de fondo (opcional). El motor usa <video> automáticamente.
     lines       { speaker, text } — speaker vacío = narrador (sin placa de nombre)
     next        Id de la siguiente escena
     choices     [{ text, next }] — si está presente, se muestra al terminar las líneas
     end         true = final de una ruta
*/
const STORY = {
  title: "Título del juego",
  version: "0.1",
  start: "cafe_lluvia",
  scenes: {
    cafe_lluvia: {
      name: "Café bajo la lluvia",
      bg: "bg-rain",
      background: "assets/portada.jpg",
      lines: [
        { speaker: "", text: "La ciudad duerme bajo una lluvia fina. Las luces del café parpadean al otro lado de la calle." },
        { speaker: "Tú", text: "Dije que no volvería a este lugar." },
        { speaker: "Elena", text: "Y, aun así, aquí estás." }
      ],
      next: "la_noticia"
    },
    la_noticia: {
      name: "Una noticia",
      bg: "bg-cafe",
      lines: [
        { speaker: "Elena", text: "Lo viste en el periódico, ¿verdad? El hombre del callejón." },
        { speaker: "Tú", text: "La policía dice que fue un robo. Tú no lo crees." },
        { speaker: "Elena", text: "Alguien lo conocía. Alguien de aquí." },
        { speaker: "", text: "Elena desliza un sobre sobre la mesa. Está sin abrir." }
      ],
      next: "la_decision"
    },
    la_decision: {
      name: "La decisión",
      bg: "bg-tension",
      lines: [
        { speaker: "Elena", text: "Si lo abrimos, ya no hay vuelta atrás." },
        { speaker: "Elena", text: "Si te vas ahora, puedo entenderlo. No te lo voy a reclamar." },
        { speaker: "", text: "El sobre permanece entre los dos. La lluvia golpea el ventanal." }
      ],
      choices: [
        { text: "Quédate. Lo abrimos juntos.", next: "final_juntos" },
        { text: "Necesito pensarlo. Me iré solo.", next: "final_solo" }
      ]
    },
    final_juntos: {
      name: "Final: El sobre",
      bg: "bg-dawn",
      end: true,
      lines: [
        { speaker: "", text: "Dentro hay una fotografía mojada y una dirección escrita a mano." },
        { speaker: "Elena", text: "Entonces empezamos esta noche." },
        { speaker: "Tú", text: "Juntos. Hasta el final." }
      ]
    },
    final_solo: {
      name: "Final: La lluvia",
      bg: "bg-alone",
      end: true,
      lines: [
        { speaker: "", text: "Dejas el sobre sobre la mesa. La puerta del café se cierra a tu espalda." },
        { speaker: "Tú", text: "Si hay una verdad, la encontraré a mi modo." },
        { speaker: "", text: "Afuera, la lluvia no ha dejado de caer." }
      ]
    }
  }
};
