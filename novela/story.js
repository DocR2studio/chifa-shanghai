/* story.js — Datos de la demo: casa, intro, diálogos.
   Usa {nombre} donde deba aparecer el nombre del jugador.
   Las imágenes por defecto están en assets/locs/, assets/eva-full.png, assets/eva-close.png y assets/eva2/.
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
      look: "Las dos máquinas descansan junto al tanque. En el estante están el detergente y un balde; las cajas quedan apiladas a un lado.",
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
    { id: "cuarto", to: "cuarto", label: "Tu cuarto", points: [[0.0969, 0.0111], [0.2109, 0.1083], [0.2125, 0.9986], [0.0961, 0.9986]] },
    { id: "bano", to: "bano", label: "Baño", points: [[0.25, 0.1639], [0.3078, 0.2167], [0.3078, 0.7639], [0.25, 0.8194]] },
    { id: "escaleras", to: "escaleras", label: "Escaleras", points: [[0.4125, 0.4917], [0.5906, 0.4917], [0.5906, 0.725], [0.4125, 0.725]] },
    { id: "cuarto_eva", to: "cuarto_eva", label: "Cuarto de Eva", points: [[0.6406, 0.2417], [0.6687, 0.2222], [0.6687, 0.7333], [0.6406, 0.7361]] },
    { id: "estudio", to: "estudio", label: "Estudio", points: [[0.6859, 0.2083], [0.7422, 0.1597], [0.7422, 0.8194], [0.6859, 0.7639]] },
    { id: "cerrado", to: null, closed: true, label: "Cerrado por ahora", points: [[0.7688, 0.0528], [0.8812, 0.0111], [0.8828, 0.9986], [0.7688, 0.9472]] }
  ],
  cuarto: [
    { id: "pasillo", to: "pasillo", label: "Pasillo", points: [[0.8063, 0.0806], [0.9141, 0.0389], [0.9156, 0.8139], [0.8063, 0.7667]] }
  ],
  cuarto_eva: [
    { id: "pasillo", to: "pasillo", label: "Pasillo", points: [[0.0688, 0.0167], [0.1961, 0.1042], [0.1969, 0.8917], [0.0688, 0.975]] }
  ],
  bano: [
    { id: "pasillo", to: "pasillo", label: "Pasillo", points: [[0.775, 0.1056], [0.9016, 0.0083], [0.9031, 0.9972], [0.775, 0.8917]] }
  ],
  estudio: [
    { id: "pasillo", to: "pasillo", label: "Pasillo", points: [[0.0672, 0.0194], [0.1953, 0.1111], [0.1969, 0.8917], [0.0672, 0.9792]] }
  ],
  escaleras: [
    { id: "pasillo", to: "pasillo", label: "Pasillo (piso 2)", points: [[0.3719, 0.0], [0.4359, 0.0], [0.5016, 0.3444], [0.6656, 0.4889], [0.6781, 0.5417], [0.6906, 0.5972], [0.7016, 0.6528], [0.7125, 0.7083], [0.7227, 0.7639], [0.7266, 0.8556], [0.4828, 0.8556], [0.4859, 0.75], [0.4906, 0.3472], [0.4336, 0.4306], [0.3906, 0.1667]] },
    { id: "lavanderia", to: "lavanderia", label: "Lavandería", points: [[0.375, 0.5111], [0.475, 0.5111], [0.475, 0.8472], [0.375, 0.8472]] },
    { id: "sala", to: "sala", label: "Sala", points: [[0.8203, 0.9139], [0.8203, 0.2431], [0.8266, 0.1319], [0.8375, 0.0625], [0.8594, 0.0278], [0.8812, 0.0625], [0.8922, 0.1319], [0.8969, 0.2431], [0.8969, 0.9972]] }
  ],
  sala: [
    { id: "escaleras", to: "escaleras", label: "Escaleras", points: [[0.0922, 0.9056], [0.0922, 0.2333], [0.0953, 0.1389], [0.1094, 0.0694], [0.1328, 0.0333], [0.1562, 0.0222], [0.1836, 0.0444], [0.2016, 0.0972], [0.2094, 0.1806], [0.2109, 0.2778], [0.2109, 0.9236]] },
    { id: "jardin", to: "jardin", label: "Jardín y piscina", points: [[0.5312, 0.2083], [0.7047, 0.2083], [0.7047, 0.6417], [0.5312, 0.6417]] },
    { id: "cocina", to: "cocina", label: "Cocina", points: [[0.7406, 0.1833], [0.8078, 0.15], [0.8078, 0.7611], [0.7406, 0.7417]] },
    { id: "cochera", to: "cochera", label: "Cochera", points: [[0.8187, 0.1], [0.9359, 0.0139], [0.9375, 0.9792], [0.8187, 0.8917]] }
  ],
  cocina: [
    { id: "sala", to: "sala", label: "Sala", points: [[0.0859, 0.075], [0.1797, 0.1639], [0.1797, 0.9056], [0.0859, 0.975]] }
  ],
  cochera: [
    { id: "sala", to: "sala", label: "Sala", points: [[0.0625, 0.0694], [0.2109, 0.1028], [0.2125, 0.8333], [0.0625, 0.8778]] }
  ],
  jardin: [
    { id: "sala", to: "sala", label: "Volver a la sala", kind: "back", points: [[0.2797, 0.8597], [0.7203, 0.8597], [0.7203, 0.9944], [0.2797, 0.9944]] }
  ],
  lavanderia: [
    { id: "escaleras", to: "escaleras", label: "Escaleras", kind: "back", points: [[0.12, 0.80], [0.88, 0.80], [0.88, 0.905], [0.12, 0.905]] }
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

const EXPRESSIONS = ["neutral", "feliz", "triste", "molesta", "sonrojada", "nerviosa"];
const EXPR_LABELS = {
  neutral: "Neutral",
  feliz: "Feliz",
  triste: "Triste",
  molesta: "Molesta",
  sonrojada: "Sonrojada",
  nerviosa: "Nerviosa",
  enojada: "Molesta",
  enamorada: "Sonrojada"
};

/* Retratos de diálogo: soltar PNG en assets/eva2/<archivo>. Si falta el archivo, se usa eva-close.png. */
const EVA_EXPR_DIR = "assets/eva2/";
const EVA_EXPR_FALLBACK = "assets/eva-close.png";
const EVA_EXPR_MAP = {
  neutral: "neutral.png",
  enojada: "molesta.png",
  molesta: "molesta.png",
  feliz: "feliz.png",
  triste: "triste.png",
  enamorada: "sonrojada.png",
  sonrojada: "sonrojada.png",
  nerviosa: "nerviosa.png"
};

const CHARACTERS = {
  eva: {
    id: "eva",
    name: "Eva",
    expressions: Object.fromEntries(
      Object.keys(EVA_EXPR_MAP).map((k) => [k, EVA_EXPR_DIR + EVA_EXPR_MAP[k]])
    )
  }
};

function exprAsset(charId, expr) {
  expr = expr || "neutral";
  if (charId === "eva") {
    const file = EVA_EXPR_MAP[expr] || EVA_EXPR_MAP.neutral;
    return file ? EVA_EXPR_DIR + file : EVA_EXPR_FALLBACK;
  }
  const ch = CHARACTERS[charId];
  if (!ch) return "";
  return (ch.expressions && (ch.expressions[expr] || ch.expressions.neutral)) || "";
}

function mediaKey(charId, expr) {
  return charId + "-" + (expr || "neutral");
}

const EVA = {
  id: "eva",
  name: "Eva",
  image: EVA_EXPR_FALLBACK,
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


const EVA_MENU = {
  fullImage: "assets/eva-full.png",
  closeImage: "assets/eva2/neutral.png",
  options: [
    { id: "hablar", label: "Hablar" },
    { id: "regalar", label: "Regalar" },
    { id: "peticion", label: "Petición" },
    { id: "accion", label: "Acción" },
    { id: "olvidalo", label: "Olvídalo" }
  ],
  peticion: {
    scene: "eva-peticion",
    options: [
      { id: "agua", label: "¿Me alcanzas un vaso de agua?", need: 0,
        ok: { expr: "neutral", eva: "Claro. Espera un momento.", vinculo: 2 } },
      { id: "compania", label: "¿Puedo quedarme un rato más?", need: 30,
        ok: { expr: "feliz", eva: "Sí. No me molesta.", vinculo: 6, afecto: 2 },
        locked: { expr: "molesta", eva: "Todavía no te conozco tanto, {nombre}. No insistas.", paciencia: -8 } },
      { id: "personal", label: "¿Puedo preguntarte algo personal?", need: 80,
        ok: { expr: "nerviosa", eva: "Depende de la pregunta. Pero… está bien, pregunta.", vinculo: 8, confianza: 4 },
        locked: { expr: "triste", eva: "Eso es demasiado pronto. No estoy lista para esa conversación.", paciencia: -10 } }
    ]
  },
  accion: {
    scene: "eva-accion",
    options: [
      { id: "ayudar", label: "Ayudar un poco en la casa", need: 0,
        ok: { expr: "feliz", eva: "Si quieres, puedes recoger esas tazas. Se agradece.", vinculo: 5, afecto: 1 } },
      { id: "masajes", label: "Masajes", need: 0,
        ok: { expr: "feliz", eva: "Está bien. Con calma, un rato nada más." } },
      { id: "acercarte", label: "Acercarte un poco más", need: 50,
        ok: { expr: "sonrojada", eva: "Está bien… no te vayas más lejos, entonces.", vinculo: 8, afecto: 3 },
        locked: { expr: "molesta", eva: "¿Qué haces? Dame un poco de espacio.", paciencia: -12 } },
      { id: "mano", label: "Ofrecerle la mano", need: 90,
        ok: { expr: "sonrojada", eva: "…Está bien. Solo un momento.", vinculo: 12, afecto: 5, confianza: 6 },
        locked: { expr: "triste", eva: "No. Eso no, {nombre}. Todavía no.", paciencia: -14 } }
    ]
  },
  noGift: {
    expr: "neutral",
    text: "No tienes nada que pueda aceptar ahora, {nombre}."
  },
  giftOk: {
    expr: "feliz",
    text: "Gracias, {nombre}. Lo voy a guardar."
  },
  /* x = centro, y = pies, h = altura, en coordenadas 0-1 del fondo 16:9. */
  place: {
    cocina: { x: 0.40, y: 0.885, h: 0.62 },
    sala: { x: 0.30, y: 0.885, h: 0.60 },
    cuarto_eva: { x: 0.46, y: 0.885, h: 0.62 }
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
  { id: "cuaderno", name: "Cuaderno", example: true, desc: "Objeto de ejemplo. Todavía no se usa." },
  {
    id: "te",
    name: "Una caja de té",
    gift: true,
    need: 0,
    desc: "Un detalle sencillo, siempre se puede ofrecer.",
    ok: { expr: "feliz", eva: "Qué detalle. Lo voy a preparar después.", vinculo: 6, afecto: 2 }
  },
  {
    id: "flores",
    name: "Flores del jardín",
    gift: true,
    need: 40,
    desc: "Un ramo improvisado. Se desbloquea con más Confianzas.",
    ok: { expr: "feliz", eva: "Están bonitas. Gracias, {nombre}.", vinculo: 10, afecto: 4, confianza: 3 },
    locked: { expr: "nerviosa", eva: "No hacía falta. Me tomas por sorpresa… y no sé si ya es momento.", paciencia: -6 }
  },
  {
    id: "carta",
    name: "Una nota",
    gift: true,
    need: 80,
    desc: "Unas líneas escritas a mano. Pide más Confianzas.",
    ok: { expr: "sonrojada", eva: "La voy a leer con calma. Gracias por tomarte el tiempo.", vinculo: 14, afecto: 6, confianza: 6 },
    locked: { expr: "triste", eva: "Guárdala. Todavía no estoy lista para algo así.", paciencia: -8 }
  }
];


const EVA_INFO = {
  image: "assets/eva-info.png",
  fields: [
    { label: "Nombre", value: "Eva" },
    { label: "Apellido", value: "Dallas" },
    { label: "Estatura", value: "1.71 m" },
    { label: "Edad", value: "35 años" },
    { label: "Hijas", value: "1" },
    { label: "Estado", value: "Casada" }
  ],
  /* Nombres editables aquí y en el editor (lápiz). Vinculo y Confianzas son placeholders. */
  bars: [
    { id: "rosa", color: "#e56b9a", min: 0, max: 250, name: "Vinculo" },
    { id: "morada", color: "#8a5cf6", min: 0, max: 250, name: "Confianzas" },
    { id: "roja", color: "#e23b3b", min: -100, max: 0, name: "Paciencia" }
  ],
  startBars: { rosa: 0, morada: 0, roja: 0 },
  startAfecto: 10,
  afectoMin: -50,
  afectoMax: 200
};

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
    avatar: "assets/eva-perfil.png",
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

/* Hablar: Elogiar y Charlar. reactions se eligen por el corazón (afecto). */
const EVA_HABLAR = {
  options: [
    { id: "elogiar", label: "Elogiar" },
    { id: "charlar", label: "Charlar" }
  ],
  backLabel: "Volver",
  elogiar: [
    {
      id: "o1",
      label: "Eres hermosa",
      player: "Eres hermosa.",
      eva: "Gracias… no hace falta que lo repitas tanto, {nombre}.",
      posExpr: "feliz",
      effects: {
        BASE: { afecto: 4, paciencia: -15, rosa: 6, morada: 0, seq: ["feliz", "sonrojada", "neutral"] },
        T50: { afecto: 6, paciencia: -10, rosa: 8, morada: 0, seq: ["feliz", "sonrojada", "feliz"] },
        T100: { afecto: 8, paciencia: -5, rosa: 10, morada: 0, seq: ["feliz", "sonrojada", "feliz"] },
        MAX: { afecto: 10, paciencia: -3, rosa: 12, morada: 2, seq: ["feliz", "sonrojada", "feliz"] }
      }
    },
    {
      id: "o2",
      label: "Quisiera una esposa como tú",
      player: "Quisiera una esposa como tú.",
      eva: "No digas eso a la ligera, {nombre}.",
      posExpr: "sonrojada",
      effects: {
        BASE: { afecto: 8, paciencia: -22, rosa: 10, morada: 0, seq: ["sonrojada", "feliz", "neutral"] },
        T50: { afecto: 12, paciencia: -15, rosa: 12, morada: 2, seq: ["sonrojada", "feliz", "feliz"] },
        T100: { afecto: 15, paciencia: -8, rosa: 14, morada: 4, seq: ["feliz", "sonrojada", "feliz"] },
        MAX: { afecto: 18, paciencia: -5, rosa: 16, morada: 6, seq: ["feliz", "sonrojada", "feliz"] }
      }
    },
    {
      id: "o3",
      label: "Opción 3 (21 letras).",
      player: "Opción 3 (21 letras).",
      eva: "No sé muy bien qué quieres decir con eso.",
      posExpr: "neutral",
      effects: {
        BASE: { afecto: -8, paciencia: -35, rosa: 4, morada: 8, seq: ["nerviosa", "triste", "neutral"] },
        T50: { afecto: -2, paciencia: -25, rosa: 6, morada: 12, seq: ["nerviosa", "sonrojada", "neutral"] },
        T100: { afecto: 5, paciencia: -15, rosa: 8, morada: 15, seq: ["sonrojada", "feliz", "feliz"] },
        MAX: { afecto: 12, paciencia: -8, rosa: 10, morada: 18, seq: ["sonrojada", "feliz", "feliz"] }
      }
    },
    {
      id: "o4",
      label: "Opción 4 (23 letras)...",
      player: "Opción 4 (23 letras)...",
      eva: "Eso no me hace gracia, {nombre}.",
      posExpr: "neutral",
      effects: {
        BASE: { afecto: -22, paciencia: -55, rosa: 2, morada: 12, seq: ["molesta", "triste", "neutral"] },
        T50: { afecto: -12, paciencia: -40, rosa: 4, morada: 16, seq: ["nerviosa", "triste", "neutral"] },
        T100: { afecto: -5, paciencia: -25, rosa: 6, morada: 20, seq: ["nerviosa", "sonrojada", "feliz"] },
        MAX: { afecto: 5, paciencia: -12, rosa: 8, morada: 25, seq: ["sonrojada", "feliz", "feliz"] }
      }
    },
    {
      id: "o5",
      label: "Opción 5: 17 let.",
      player: "Opción 5: 17 let.",
      eva: "¿Se puede saber qué pretendes?",
      posExpr: "neutral",
      effects: {
        BASE: { afecto: -40, paciencia: -75, rosa: 0, morada: 15, seq: ["molesta", "triste", "neutral"] },
        T50: { afecto: -25, paciencia: -55, rosa: 2, morada: 20, seq: ["triste", "molesta", "triste"] },
        T100: { afecto: -12, paciencia: -35, rosa: 4, morada: 25, seq: ["nerviosa", "sonrojada", "feliz"] },
        MAX: { afecto: 0, paciencia: -18, rosa: 6, morada: 30, seq: ["nerviosa", "sonrojada", "feliz"] }
      }
    }
  ],
  charlar: [
    {
      id: "dia",
      label: "El día",
      player: "¿Cómo va tu día, Eva?",
      reactions: [
        { maxAfecto: 19, expr: "triste", eva: "Igual que siempre. No hay mucho que contar.", vinculo: 1 },
        { maxAfecto: 100, expr: "feliz", eva: "Tranquilo, la verdad. Me viene bien tener compañía un rato.", vinculo: 6, afecto: 2 }
      ]
    },
    {
      id: "casa",
      label: "La casa",
      player: "Esta casa tiene un aire particular. ¿Hace mucho que vives aquí?",
      reactions: [
        { maxAfecto: 29, expr: "molesta", eva: "No voy a hablar de eso ahora, {nombre}. No te metas tanto.", paciencia: -10 },
        { maxAfecto: 59, expr: "nerviosa", eva: "Hace un tiempo, sí. Mejor lo dejamos para otro día.", vinculo: 3 },
        { maxAfecto: 100, expr: "neutral", eva: "Sí, ya lleva años. A veces siento que me conoce mejor de lo que yo la conozco.", vinculo: 8, afecto: 2 }
      ]
    },
    {
      id: "silencio",
      label: "El silencio",
      player: "Cuando se hace de noche, el silencio aquí se siente distinto.",
      reactions: [
        { maxAfecto: 39, expr: "triste", eva: "Lo sé. Por eso a veces dejo una luz encendida.", vinculo: 2, afecto: 1 },
        { maxAfecto: 100, expr: "feliz", eva: "Sí… aunque contigo se nota menos. Gracias por quedarte un rato.", vinculo: 9, afecto: 3 }
      ]
    }
  ]
};

/* Elogiar: se usa el umbral más alto que se cumpla (MAX > T100 > T50 > BASE). */
const EVA_ELOGIAR_TIERS = [
  { id: "MAX", corazon: 200, rosa: 250, morada: 250 },
  { id: "T100", corazon: 100, rosa: 100, morada: 100 },
  { id: "T50", corazon: 50, rosa: 50, morada: 50 },
  { id: "BASE" }
];

/* Secuencia de reacción de Elogiar: primera, segunda y resto (ms). */
const EVA_ELOGIAR_SEQ = {
  firstMs: 1200,
  secondMs: 1200
};

/* Expresión tras Elogiar o al tocar a Eva. */
const EVA_EXPR_RULES = {
  halfBars: 125,
  fullBars: 250,
  low: { tristeAt: -20, molestaAt: -40 },
  mid: { tristeAt: -30, molestaAt: -40 },
  full: { tristeFrom: -1, neverMolesta: true },
  pacienciaAbs: 80
};

const EVA_DELTA_LABELS = {
  afecto: "Corazón",
  paciencia: "Paciencia",
  rosa: "Rosa",
  morada: "Morada"
};

/* Recuperar Paciencia: suma hacia 0 (la barra se vacía). Si el corazón llega a heartBonusAt, se suma heartBonus. */
const EVA_PACIENCIA_RECOVERY = {
  room: 30,
  masajes: 50,
  ayudar: 20,
  heartBonus: 70,
  heartBonusAt: 100
};

const EVA_RULES = {
  warningAt: -80,
  kickAt: -100,
  warning: {
    expr: "molesta",
    text: "Estoy perdiendo la paciencia, {nombre}. Si sigues así, voy a pedirte que te vayas de la casa."
  },
  kick: {
    title: "Eva te echó de la casa",
    note: "Se acabó la paciencia. Por ahora, no puedes quedarte aquí.",
    button: "Volver al título"
  }
};

/* Escenas sin imagen por defecto: en el editor aparecen en negro con «Agregar foto». */
const EDITOR_SCENES = [
  { id: "eva-peticion", name: "Eva Petición", kind: "scene" },
  { id: "eva-accion", name: "Eva Acción", kind: "scene" },
  { id: "eva-regalo", name: "Regalo", kind: "scene" }
];

const STORY_PATCH_KEY = "eva_novela_story_v16";

function editableStory() {
  return JSON.parse(JSON.stringify({
    bars: (EVA_INFO.bars || []).map((b) => ({ id: b.id, name: b.name || "", color: b.color, max: b.max, min: b.min })),
    afectoMin: EVA_INFO.afectoMin,
    afectoMax: EVA_INFO.afectoMax,
    elogiarTiers: EVA_ELOGIAR_TIERS,
    elogiarSeq: EVA_ELOGIAR_SEQ,
    exprRules: EVA_EXPR_RULES,
    deltaLabels: EVA_DELTA_LABELS,
    fields: EVA_INFO.fields || [],
    menuOptions: EVA_MENU.options || [],
    hablar: {
      options: EVA_HABLAR.options || [],
      backLabel: EVA_HABLAR.backLabel || "Volver",
      elogiar: EVA_HABLAR.elogiar || [],
      charlar: EVA_HABLAR.charlar || []
    },
    peticion: EVA_MENU.peticion,
    accion: EVA_MENU.accion,
    noGift: EVA_MENU.noGift,
    giftOk: EVA_MENU.giftOk,
    rules: EVA_RULES,
    pacienciaRecovery: EVA_PACIENCIA_RECOVERY,
    inventory: DEFAULT_INVENTORY
  }));
}

function applyEditableStory(data) {
  if (!data || typeof data !== "object") return;
  if (Array.isArray(data.bars)) {
    data.bars.forEach((src) => {
      const b = (EVA_INFO.bars || []).find((x) => x.id === src.id);
      if (!b) return;
      if (src.name != null) b.name = String(src.name);
      if (src.max != null) b.max = src.max;
      if (src.min != null) b.min = src.min;
    });
  }
  if (data.afectoMin != null) EVA_INFO.afectoMin = data.afectoMin;
  if (data.afectoMax != null) EVA_INFO.afectoMax = data.afectoMax;
  if (Array.isArray(data.elogiarTiers) && typeof EVA_ELOGIAR_TIERS !== "undefined") {
    EVA_ELOGIAR_TIERS.length = 0;
    data.elogiarTiers.forEach((x) => EVA_ELOGIAR_TIERS.push(x));
  }
  if (data.elogiarSeq && typeof EVA_ELOGIAR_SEQ !== "undefined") Object.assign(EVA_ELOGIAR_SEQ, data.elogiarSeq);
  if (data.exprRules && typeof EVA_EXPR_RULES !== "undefined") Object.assign(EVA_EXPR_RULES, data.exprRules);
  if (data.deltaLabels && typeof EVA_DELTA_LABELS !== "undefined") Object.assign(EVA_DELTA_LABELS, data.deltaLabels);
  if (Array.isArray(data.fields)) EVA_INFO.fields = data.fields;
  if (Array.isArray(data.menuOptions)) EVA_MENU.options = data.menuOptions;
  if (data.hablar) {
    if (Array.isArray(data.hablar.options)) EVA_HABLAR.options = data.hablar.options;
    if (data.hablar.backLabel) EVA_HABLAR.backLabel = data.hablar.backLabel;
    if (Array.isArray(data.hablar.elogiar)) EVA_HABLAR.elogiar = data.hablar.elogiar;
    if (Array.isArray(data.hablar.charlar)) EVA_HABLAR.charlar = data.hablar.charlar;
  }
  if (data.peticion) EVA_MENU.peticion = data.peticion;
  if (data.accion) EVA_MENU.accion = data.accion;
  if (data.noGift) EVA_MENU.noGift = data.noGift;
  if (data.giftOk) EVA_MENU.giftOk = data.giftOk;
  if (data.rules) Object.assign(EVA_RULES, data.rules);
  if (data.pacienciaRecovery && typeof EVA_PACIENCIA_RECOVERY !== "undefined") Object.assign(EVA_PACIENCIA_RECOVERY, data.pacienciaRecovery);
  if (Array.isArray(data.inventory)) {
    DEFAULT_INVENTORY.length = 0;
    data.inventory.forEach((it) => DEFAULT_INVENTORY.push(it));
  }
}

function loadStoryPatch() {
  try {
    const raw = localStorage.getItem(STORY_PATCH_KEY);
    if (raw) applyEditableStory(JSON.parse(raw));
  } catch (e) { /* ignore */ }
}

function saveStoryPatch() {
  try {
    localStorage.setItem(STORY_PATCH_KEY, JSON.stringify(editableStory()));
  } catch (e) { /* ignore */ }
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
  ...EDITOR_SCENES.map((s) => ({
    id: s.id,
    name: s.name,
    kind: "scene",
    defaultImage: ""
  })),
  ...HOUSE.locations.map((l) => ({
    id: l.id,
    name: l.name,
    kind: "location",
    defaultImage: l.image
  }))
];
