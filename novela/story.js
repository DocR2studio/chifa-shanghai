/* story.js — Datos de la demo: casa, intro, diálogos.
   Usa {nombre} donde deba aparecer el nombre del jugador.
   Las imágenes por defecto están en assets/locs/ y assets/eva.png.
   El editor puede sustituirlas en el dispositivo (IndexedDB). */
const STORY = {
  title: "Título del juego",
  version: "0.1"
};

const EDITOR_PIN = "1997";
const SAVE_KEY = "eva_novela_v3";

const HOUSE = {
  start: "cuarto",
  moveCost: 5,
  barsMax: 100,
  startBars: { energia: 70, fuerza: 30, aprendizaje: 30 },
  evaIn: ["cocina", "sala", "cuarto_eva"],
  locations: [
    {
      id: "cuarto",
      name: "Tu cuarto",
      floor: 2,
      image: "assets/locs/cuarto.jpg",
      look: "Tu cuarto está en orden. La luz de la tarde entra en silencio.",
      actions: [
        { id: "dormir", label: "Dormir", energia: 40, text: "Cierras los ojos un rato. El cansancio se va poco a poco." }
      ]
    },
    {
      id: "pasillo",
      name: "Pasillo (piso 2)",
      floor: 2,
      image: "assets/locs/pasillo.jpg",
      look: "El pasillo conecta las habitaciones. Al fondo, la luz del jardín.",
      actions: [
        { id: "observar", label: "Observar", text: "Las puertas están cerradas. Se oye apenas el viento en los árboles." }
      ]
    },
    {
      id: "cuarto_eva",
      name: "Cuarto de Eva",
      floor: 2,
      image: "assets/locs/cuarto-eva.jpg",
      look: "El cuarto de Eva es sencillo y luminoso. Hay libros junto a la ventana.",
      actions: [
        { id: "mirar", label: "Mirar alrededor", text: "Todo está en su sitio. Un cuaderno cerrado descansa sobre el tocador." }
      ]
    },
    {
      id: "estudio",
      name: "Estudio",
      floor: 2,
      image: "assets/locs/estudio.jpg",
      look: "El estudio huele a papel y madera. Hay una mesa lista para trabajar.",
      actions: [
        { id: "estudiar", label: "Estudiar", aprendizaje: 12, energia: -15, text: "Te concentras en los apuntes. Algo queda más claro que antes." }
      ]
    },
    {
      id: "bano",
      name: "Baño",
      floor: 2,
      image: "assets/locs/bano.jpg",
      look: "El baño está vacío y en silencio. Las toallas están dobladas.",
      actions: [
        { id: "asearse", label: "Asearse", energia: 8, text: "El agua fría te despeja. Te sientes un poco más despierto." }
      ]
    },
    {
      id: "escaleras",
      name: "Escaleras",
      floor: 0,
      image: "assets/locs/escaleras.jpg",
      look: "Las escaleras unen los dos pisos. El sol dibuja rayas en la madera.",
      actions: [
        { id: "observar", label: "Observar", text: "Desde aquí se ve el jardín a través del ventanal." }
      ]
    },
    {
      id: "cocina",
      name: "Cocina",
      floor: 1,
      image: "assets/locs/cocina.jpg",
      look: "La cocina está cálida y ordenada. Hay fruta sobre la isla.",
      actions: [
        { id: "comer", label: "Comer", energia: 25, text: "Preparas algo sencillo. La energía vuelve poco a poco." }
      ]
    },
    {
      id: "lavanderia",
      name: "Lavandería",
      floor: 1,
      image: "assets/locs/lavanderia.jpg",
      look: "La lavandería está limpia. Las toallas esperan dobladas en la cesta.",
      actions: [
        { id: "ordenar", label: "Ordenar", text: "Doblas lo que había suelto. No es mucho, pero queda mejor." }
      ]
    },
    {
      id: "sala",
      name: "Sala",
      floor: 1,
      image: "assets/locs/sala.jpg",
      look: "La sala se llena de luz dorada. El jardín se ve enorme detrás del cristal.",
      actions: [
        { id: "descansar", label: "Descansar", energia: 10, text: "Te sientas un momento en el sofá. El silencio no estorba." }
      ]
    },
    {
      id: "jardin",
      name: "Jardín y piscina",
      floor: 1,
      image: "assets/locs/jardin.jpg",
      look: "El jardín está quieto. El agua de la piscina refleja los árboles.",
      actions: [
        { id: "entrenar", label: "Entrenar", fuerza: 12, energia: -15, text: "Haces una rutina breve al aire libre. El cuerpo responde." }
      ]
    },
    {
      id: "cochera",
      name: "Cochera",
      floor: 1,
      image: "assets/locs/cochera.jpg",
      look: "La cochera está ordenada. Hay espacio de sobra para moverse.",
      actions: [
        { id: "entrenar", label: "Entrenar", fuerza: 12, energia: -15, text: "Entrenas junto al banco de trabajo. Sales un poco más firme." }
      ]
    }
  ]
};

const INTRO = {
  id: "intro",
  name: "Introducción",
  image: "assets/locs/cuarto.jpg",
  lines: [
    { speaker: "", text: "La casa de Eva te recibe en silencio, {nombre}. La luz de la tarde entra por los ventanales." },
    { speaker: "Eva", text: "El cuarto del fondo es tuyo. Descansa, recorre la casa cuando quieras. Si me necesitas, suele encontrarme en la cocina o en la sala." },
    { speaker: "", text: "Dejas la maleta junto a la cama. Hoy puedes estudiar, entrenar o simplemente mirar alrededor." }
  ]
};

const EVA = {
  id: "eva",
  name: "Eva",
  image: "assets/eva.png",
  talk: {
    cocina: [
      { speaker: "Eva", text: "Hola, {nombre}. Si tienes hambre, sirve lo que quieras. La casa también es tuya mientras estés aquí." },
      { speaker: "Eva", text: "Yo suelo quedarme por aquí a esta hora. No molestes si me ves pensando en voz baja, ¿sí?" }
    ],
    sala: [
      { speaker: "Eva", text: "Me gusta esta hora, cuando el sol se apoya en el jardín." },
      { speaker: "Eva", text: "¿Cómo te sientes en la casa, {nombre}? Todavía puedes tomarte el día con calma." }
    ],
    cuarto_eva: [
      { speaker: "Eva", text: "Ah, {nombre}. Pasa, no te quedes en la puerta." },
      { speaker: "Eva", text: "No hay mucho que ver, lo sé. A veces trabajo aquí cuando no quiero que me interrumpan… excepto tú, claro." }
    ]
  }
};

function locById(id) {
  return HOUSE.locations.find((l) => l.id === id) || null;
}

function fillName(text, name) {
  return String(text || "").replace(/\{nombre\}/g, name || "tú");
}

const EDITOR_ITEMS = [
  { id: "intro", name: "Introducción", kind: "intro", defaultImage: INTRO.image },
  { id: "eva", name: "Eva (personaje)", kind: "sprite", defaultImage: EVA.image },
  ...HOUSE.locations.map((l) => ({
    id: l.id,
    name: l.name,
    kind: "location",
    defaultImage: l.image
  }))
];
