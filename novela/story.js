/* story.js — Datos de la demo: casa, intro, diálogos.
   Usa {nombre} donde deba aparecer el nombre del jugador.
   Las imágenes por defecto están en assets/locs/ y assets/eva.png.
   El editor puede sustituirlas en el dispositivo (IndexedDB). */
const STORY = {
  title: "Unknown Love",
  version: "0.1"
};

const EDITOR_PIN = "1997";
const SAVE_KEY = "eva_novela_v3";

const HOUSE = {
  start: "cuarto",
  moveCost: 0,
  barsMax: 100,
  startBars: { energia: 70, fuerza: 30, aprendizaje: 30, extra: 0 },
  evaIn: ["cocina", "sala", "cuarto_eva"],
  evaByTime: {
    "mañana": "cocina",
    "tarde": "sala",
    "noche": "cuarto_eva",
    "madrugada": "cuarto_eva"
  },
  locations: [
    {
      id: "cuarto",
      name: "Tu cuarto",
      floor: 2,
      image: "assets/locs/cuarto.jpg",
      look: "Tu cuarto está en orden. La cama, el escritorio y el armario esperan.",
      actions: [
        { id: "dormir", label: "Dormir", energia: 40, text: "Cierras los ojos un rato. El cansancio se va poco a poco." },
        { id: "ejercicio", label: "Hacer ejercicio", kind: "exercise-home", energia: -10, text: "Haces una rutina breve en el cuarto. El cuerpo responde." },
        { id: "gimnasio", label: "Gimnasio", comingSoon: true }
      ]
    },
    {
      id: "pasillo",
      name: "Pasillo (piso 2)",
      floor: 2,
      image: "assets/locs/pasillo.jpg",
      look: "El pasillo conecta las habitaciones. Al fondo, las escaleras bajan al primer piso.",
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
        { id: "estudiar", label: "Estudiar", aprendizaje: 12, energia: -15, text: "Te concentras en los apuntes. Algo queda más claro que antes." },
        { id: "archivo", label: "Consultar el archivo", needAprendizaje: 40, text: "Revisas el archivo con más cuidado. Ahora encaja algo que antes se te escapaba." }
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
      placeholder: true,
      look: "Todavía no hay una foto definitiva de este lugar. Las toallas esperan dobladas en la cesta.",
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
        { id: "entrenar", label: "Entrenar", kind: "exercise-home", energia: -10, text: "Haces una rutina breve al aire libre. El cuerpo responde." },
        { id: "gimnasio", label: "Gimnasio", comingSoon: true }
      ]
    },
    {
      id: "cochera",
      name: "Cochera",
      floor: 1,
      image: "assets/locs/cochera.jpg",
      look: "La cochera está ordenada. Hay espacio de sobra para moverse.",
      actions: [
        { id: "entrenar", label: "Entrenar", kind: "exercise-home", energia: -10, text: "Entrenas junto al banco de trabajo. Sales un poco más firme." }
      ]
    }
  ]
};


/* Zonas clicables por lugar. Coordenadas relativas al fondo (0 a 1).
   Cada puerta es un polígono: points: [[x, y], ...].
   También se admite rect: [x, y, ancho, alto].
   to: id del lugar de destino.
   closed: true no deja pasar (muestra el aviso).
   kind: "back" dibuja una flecha discreta (para el jardín, sin puerta). */
const DOORS = {
  pasillo: [
    { id: "cuarto", to: "cuarto", label: "Tu cuarto", points: [[0.068, 0.00], [0.178, 0.015], [0.180, 0.875], [0.062, 0.90]] },
    { id: "bano", to: "bano", label: "Baño", points: [[0.228, 0.155], [0.290, 0.185], [0.292, 0.80], [0.226, 0.815]] },
    { id: "escaleras", to: "escaleras", label: "Escaleras", points: [[0.412, 0.465], [0.598, 0.465], [0.598, 0.725], [0.412, 0.725]] },
    { id: "cuarto_eva", to: "cuarto_eva", label: "Cuarto de Eva", points: [[0.625, 0.215], [0.670, 0.215], [0.672, 0.73], [0.623, 0.73]] },
    { id: "estudio", to: "estudio", label: "Estudio", points: [[0.688, 0.168], [0.752, 0.152], [0.758, 0.785], [0.686, 0.75]] },
    { id: "cerrado", to: null, closed: true, label: "Cerrado por ahora", points: [[0.790, 0.03], [0.922, 0.00], [0.938, 0.90], [0.788, 0.90]] }
  ],
  cuarto: [
    { id: "pasillo", to: "pasillo", label: "Pasillo", points: [[0.800, 0.04], [0.905, 0.04], [0.910, 0.84], [0.798, 0.84]] }
  ],
  cuarto_eva: [
    { id: "pasillo", to: "pasillo", label: "Pasillo", points: [[0.072, 0.00], [0.158, 0.00], [0.160, 0.86], [0.068, 0.88]] }
  ],
  bano: [
    { id: "pasillo", to: "pasillo", label: "Pasillo", points: [[0.775, 0.00], [0.895, 0.00], [0.905, 0.88], [0.772, 0.88]] }
  ],
  estudio: [
    { id: "pasillo", to: "pasillo", label: "Pasillo", points: [[0.070, 0.00], [0.162, 0.00], [0.165, 0.86], [0.065, 0.88]] }
  ],
  escaleras: [
    { id: "pasillo", to: "pasillo", label: "Pasillo (piso 2)", points: [[0.385, 0.00], [0.555, 0.00], [0.530, 0.26], [0.725, 0.34], [0.725, 0.825], [0.488, 0.825], [0.500, 0.36], [0.455, 0.26]] },
    { id: "lavanderia", to: "lavanderia", label: "Lavandería", points: [[0.375, 0.475], [0.465, 0.475], [0.465, 0.835], [0.375, 0.835]] },
    { id: "sala", to: "sala", label: "Sala", points: [[0.748, 0.92], [0.748, 0.22], [0.765, 0.08], [0.820, 0.015], [0.875, 0.08], [0.895, 0.22], [0.898, 0.92]] }
  ],
  sala: [
    { id: "escaleras", to: "escaleras", label: "Escaleras", points: [[0.075, 0.86], [0.072, 0.20], [0.090, 0.08], [0.125, 0.025], [0.165, 0.025], [0.200, 0.08], [0.215, 0.20], [0.218, 0.86]] },
    { id: "jardin", to: "jardin", label: "Jardín y piscina", points: [[0.548, 0.225], [0.698, 0.225], [0.698, 0.66], [0.548, 0.66]] },
    { id: "cocina", to: "cocina", label: "Cocina", points: [[0.748, 0.18], [0.828, 0.18], [0.828, 0.80], [0.748, 0.80]] },
    { id: "cochera", to: "cochera", label: "Cochera", points: [[0.838, 0.02], [0.925, 0.00], [0.938, 0.92], [0.838, 0.90]] }
  ],
  cocina: [
    { id: "sala", to: "sala", label: "Sala", points: [[0.072, 0.06], [0.175, 0.06], [0.178, 0.88], [0.068, 0.90]] }
  ],
  cochera: [
    { id: "sala", to: "sala", label: "Sala", points: [[0.052, 0.06], [0.195, 0.06], [0.198, 0.83], [0.050, 0.83]] }
  ],
  jardin: [
    { id: "sala", to: "sala", label: "Volver a la sala", kind: "back", points: [[0.28, 0.86], [0.72, 0.86], [0.72, 0.995], [0.28, 0.995]] }
  ],
  lavanderia: [
    { id: "escaleras", to: "escaleras", label: "Escaleras", points: [[0.500, 0.08], [0.608, 0.08], [0.608, 0.675], [0.500, 0.675]] }
  ]
};

const TASKS = [
  { id: "hablar-eva-cocina", text: "Habla con Eva en la cocina", when: { type: "talk", location: "cocina" } },
  { id: "ejercicio-una", text: "Haz ejercicio una vez", when: { type: "action", kind: "exercise-home" } },
  { id: "visitar-estudio", text: "Entra al estudio", when: { type: "enter", location: "estudio" } }
];

const INTRO = {
  id: "intro",
  name: "Introducción",
  image: "assets/locs/cuarto.jpg",
  lines: [
    { speaker: "", moment: "noche", text: "La casa de Eva te recibe en silencio, {nombre}. Afuera ya es de noche." },
    { who: "Eva", speaker: "Eva", expr: "feliz", text: "El cuarto del fondo es tuyo. Descansa, recorre la casa cuando quieras. Si me necesitas, suele encontrarme en la cocina o en la sala." },
    { speaker: "", moment: "madrugada", text: "Dejas la maleta junto a la cama. Es casi madrugada. Mañana puedes estudiar, entrenar o simplemente mirar alrededor." }
  ]
};

const EXPRESSIONS = ["neutral", "enojada", "feliz", "triste", "enamorada"];
const EXPR_LABELS = {
  neutral: "Neutral",
  enojada: "Enojada",
  feliz: "Feliz",
  triste: "Triste",
  enamorada: "Enamorada"
};

const CHARACTERS = {
  eva: {
    id: "eva",
    name: "Eva",
    expressions: {
      neutral: "assets/eva/neutral.png",
      enojada: "assets/eva/enojada.png",
      feliz: "assets/eva/feliz.png",
      triste: "assets/eva/triste.png",
      enamorada: "assets/eva/enamorada.png"
    }
  }
};

function exprAsset(charId, expr) {
  const ch = CHARACTERS[charId];
  if (!ch) return "";
  return ch.expressions[expr] || ch.expressions.neutral || "";
}

function mediaKey(charId, expr) {
  return charId + "-" + (expr || "neutral");
}

const EVA = {
  id: "eva",
  name: "Eva",
  image: "assets/eva/neutral.png",
  talk: {
    cocina: {
      start: "saludo",
      nodes: {
        saludo: {
          lines: [
            { who: "Eva", expr: "neutral", text: "Hola, {nombre}. Te estaba esperando un poco." },
            { who: "Eva", expr: "feliz", text: "Me alegra verte. Con alguien más, la casa se siente menos quieta." },
            { who: "Eva", expr: "triste", text: "Aunque, cuando se hace de noche, a veces se nota demasiado el silencio." }
          ],
          choices: [
            { text: "No es para tanto. Deja de dramatizar.", next: "enojo" },
            { text: "Si quieres, puedo quedarme un rato.", next: "cariño" }
          ]
        },
        enojo: {
          lines: [
            { who: "Eva", expr: "enojada", text: "¿Dramatizar? No te pedí que me consolaras, {nombre}. Solo estaba hablando." },
            { who: "Eva", expr: "enojada", text: "Bueno. Ya estás aquí. Mejor no insistas en eso." }
          ]
        },
        cariño: {
          lines: [
            { who: "Eva", expr: "enamorada", text: "Ah… no tenías que decirlo así. Se me suben un poco los colores." },
            { who: "Eva", expr: "feliz", text: "Gracias. Si te parece, después nos sentamos un rato en la sala." }
          ]
        }
      }
    },
    sala: {
      start: "luz",
      nodes: {
        luz: {
          lines: [
            { who: "Eva", expr: "feliz", text: "Me gusta esta hora, cuando el sol se apoya en el jardín." },
            { who: "Eva", expr: "neutral", text: "¿Cómo te sientes en la casa, {nombre}? Todavía puedes tomarte el día con calma." }
          ]
        }
      }
    },
    cuarto_eva: {
      start: "pasa",
      nodes: {
        pasa: {
          lines: [
            { who: "Eva", expr: "neutral", text: "Ah, {nombre}. Pasa, no te quedes en la puerta." },
            { who: "Eva", expr: "feliz", text: "No hay mucho que ver, lo sé. A veces trabajo aquí cuando quiero pensar en silencio." }
          ]
        }
      }
    }
  }
};


const TIMES = ["mañana", "tarde", "noche", "madrugada"];
const TIME_LABELS = {
  "mañana": "Mañana",
  "tarde": "Tarde",
  "noche": "Noche",
  "madrugada": "Madrugada"
};
const ACTIVITIES_PER_TIME = 4;
const SETTINGS_KEY = "eva_novela_settings";

const DEFAULT_INVENTORY = [
  { id: "llaves", name: "Llaves", example: true, desc: "Objeto de ejemplo. Todavía no se usa." },
  { id: "cuaderno", name: "Cuaderno", example: true, desc: "Objeto de ejemplo. Todavía no se usa." }
];

const CODEX = {
  eva: {
    name: "Eva",
    text: "Dueña de la casa. Tranquila y atenta, a veces se queda pensando más de la cuenta. Conoce este lugar mejor de lo que cuenta."
  },
  player: {
    name: "{nombre}",
    text: "Acabas de llegar a la casa de Eva. Todavía estás conociendo las habitaciones y el ritmo de los días."
  }
};

const SCENES = [];


const CHATS = [
  {
    id: "eva",
    name: "Eva",
    avatar: "assets/eva/avatar.png",
    start: "saludo",
    nodes: {
      saludo: {
        incoming: [
          "¿Ya te acomodaste en el cuarto?",
          "Si necesitas algo, avísame. Estoy por la casa."
        ],
        replies: [
          { text: "Sí, gracias. El cuarto está bien.", next: "agrado" },
          { text: "Todavía estoy mirando un poco la casa.", next: "explorar" },
          { text: "¿Dónde estás ahora?", next: "donde" }
        ]
      },
      agrado: {
        incoming: [
          "Me alegra. Si quieres, más tarde te preparo algo sencillo."
        ],
        replies: [
          { text: "Suena bien, gracias.", next: "cierre_ok" },
          { text: "No te preocupes, yo me organizo.", next: "cierre_solo" }
        ]
      },
      explorar: {
        incoming: [
          "Tómate el tiempo que quieras. La casa es un poco grande al principio."
        ],
        replies: [
          { text: "Voy a recorrerla con calma.", next: "cierre_ok" },
          { text: "Si me pierdo, te aviso.", next: "cierre_ok" }
        ]
      },
      donde: {
        incoming: [
          "En la cocina, por ahora. Cuando quieras pasar, la puerta está abierta."
        ],
        replies: [
          { text: "En un rato te busco.", next: "cierre_ok" },
          { text: "Gracias, después te escribo.", next: "cierre_solo" }
        ]
      },
      cierre_ok: {
        incoming: ["De acuerdo. Aquí estaré."],
        replies: []
      },
      cierre_solo: {
        incoming: ["Como prefieras. Cualquier cosa, escríbeme."],
        replies: []
      }
    }
  }
];

function chatById(id) {
  return (CHATS || []).find((c) => c.id === id) || null;
}

function emptyChatState() {
  const out = {};
  (CHATS || []).forEach((c) => {
    out[c.id] = { node: c.start, history: [], started: false, draft: -1 };
  });
  return out;
}

function exampleInventory() {
  return DEFAULT_INVENTORY.map((it) => Object.assign({}, it));
}

function evaAt(moment, phase) {
  if (phase === "intro") return HOUSE.start;
  const map = HOUSE.evaByTime || {};
  return map[moment] || "sala";
}

function locById(id) {
  return HOUSE.locations.find((l) => l.id === id) || null;
}

function fillName(text, name) {
  return String(text || "").replace(/\{nombre\}/g, name || "tú");
}

const EDITOR_ITEMS = [
  { id: "intro", name: "Introducción", kind: "intro", defaultImage: INTRO.image },
  ...EXPRESSIONS.map((expr) => ({
    id: mediaKey("eva", expr),
    name: "Eva · " + EXPR_LABELS[expr],
    kind: "expression",
    character: "eva",
    expr,
    defaultImage: exprAsset("eva", expr)
  })),
  ...HOUSE.locations.map((l) => ({
    id: l.id,
    name: l.name,
    kind: "location",
    defaultImage: l.image
  }))
];
