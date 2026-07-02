// ============================================================
// seed-data.js
// Copia exacta de la carta que ya tenías escrita en carta.html,
// lista para importarse UNA SOLA VEZ a Firestore desde admin.html
// (botón "Importar carta actual"). Después de importar, todo se
// administra desde el panel, no hace falta tocar este archivo de nuevo.
// ============================================================

export const PLATOS_SEED = [
  // ---- CARNES Y A LO POBRE ----
  { nombre: "Lomo a lo Pobre", precio: "$16.900", descripcion: "Lomo a la plancha, papas fritas, cebolla caramelizada y dos huevos fritos.", categoria: "carnes", imagenURL: "https://images.unsplash.com/photo-1544025162-811114215b36?q=80&w=400", orden: 1 },
  { nombre: "Trutro a lo Pobre", precio: "$11.900", descripcion: "Trutro de pollo, papas fritas, cebolla caramelizada y dos huevos fritos.", categoria: "carnes", imagenURL: "https://images.unsplash.com/photo-1544025162-811114215b36?q=80&w=400", orden: 2 },
  { nombre: "Chuleta Ahumada a lo Pobre", precio: "$14.850", descripcion: "Doble chuleta a la plancha, papas fritas, cebolla caramelizada y dos huevos fritos.", categoria: "carnes", imagenURL: "https://images.unsplash.com/photo-1544025162-811114215b36?q=80&w=400", orden: 3 },
  { nombre: "Pechuga Deshuesada a lo Pobre", precio: "$14.850", descripcion: "Pechuga a la plancha, papas fritas, cebolla caramelizada y dos huevos fritos.", categoria: "carnes", imagenURL: "https://images.unsplash.com/photo-1544025162-811114215b36?q=80&w=400", orden: 4 },
  { nombre: "Suprema Napolitana a lo Pobre", precio: "$15.900", descripcion: "Pechuga apanada con salsa, queso, papas fritas, cebolla y huevos.", categoria: "carnes", imagenURL: "https://images.unsplash.com/photo-1544025162-811114215b36?q=80&w=400", orden: 5 },
  { nombre: "Plateada a lo Pobre", precio: "$16.900", descripcion: "Plateada a la cacerola, papas fritas, cebolla caramelizada y dos huevos fritos.", categoria: "carnes", imagenURL: "https://images.unsplash.com/photo-1544025162-811114215b36?q=80&w=400", orden: 6 },
  { nombre: "Costillar Baby Ribs a lo Pobre", precio: "$20.900", descripcion: "Costillar en su salsa al horno, papas fritas, cebolla y huevos fritos.", categoria: "carnes", imagenURL: "https://images.unsplash.com/photo-1544025162-811114215b36?q=80&w=400", orden: 7 },
  { nombre: "Trutro con Agregado", precio: "$7.900", descripcion: "Trutro de pollo con agregado a elección.", categoria: "carnes", imagenURL: "https://images.unsplash.com/photo-1544025162-811114215b36?q=80&w=400", orden: 8 },
  { nombre: "Pechuga con Agregado", precio: "$10.900", descripcion: "Pechuga a la plancha con agregado a elección.", categoria: "carnes", imagenURL: "https://images.unsplash.com/photo-1544025162-811114215b36?q=80&w=400", orden: 9 },
  { nombre: "Chuleta Ahumada con Agregado", precio: "$10.900", descripcion: "Doble chuleta a la plancha con agregado a elección.", categoria: "carnes", imagenURL: "https://images.unsplash.com/photo-1544025162-811114215b36?q=80&w=400", orden: 10 },
  { nombre: "Plateada al Vino Tinto con Agregado", precio: "$13.900", descripcion: "Cocinada a fuego lento con agregado a elección.", categoria: "carnes", imagenURL: "https://images.unsplash.com/photo-1544025162-811114215b36?q=80&w=400", orden: 11 },
  { nombre: "Lomo con Agregado", precio: "$14.000", descripcion: "Lomo a la plancha con agregado a elección.", categoria: "carnes", imagenURL: "https://images.unsplash.com/photo-1544025162-811114215b36?q=80&w=400", orden: 12 },
  { nombre: "Costillar Baby Ribs con Agregado", precio: "$15.900", descripcion: "Costillar al horno con agregado a elección.", categoria: "carnes", imagenURL: "https://images.unsplash.com/photo-1544025162-811114215b36?q=80&w=400", orden: 13 },

  // ---- DEL MAR ----
  { nombre: "Merluza Frita a lo Pobre", precio: "$16.000", descripcion: "Doble merluza, papas fritas, cebolla caramelizada y dos huevos fritos.", categoria: "mar", imagenURL: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=400", orden: 14 },
  { nombre: "Atún a lo Pobre", precio: "$17.900", descripcion: "Atún a la plancha (mantequilla o sésamo), papas fritas, cebolla y huevos fritos.", categoria: "mar", imagenURL: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=400", orden: 15 },
  { nombre: "Salmón a lo Pobre", precio: "$18.900", descripcion: "Salmón a la plancha o mantequilla, papas fritas, cebolla y huevos fritos.", categoria: "mar", imagenURL: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=400", orden: 16 },
  { nombre: "Reineta a lo Pobre", precio: "$19.900", descripcion: "Reineta a la plancha o frita, papas fritas, cebolla y huevos fritos.", categoria: "mar", imagenURL: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=400", orden: 17 },
  { nombre: "Merluza Frita con Agregado", precio: "$13.900", descripcion: "Doble merluza con agregado a elección.", categoria: "mar", imagenURL: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=400", orden: 18 },
  { nombre: "Atún con Agregado", precio: "$14.900", descripcion: "Atún a la plancha (mantequilla o sésamo) con agregado a elección.", categoria: "mar", imagenURL: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=400", orden: 19 },
  { nombre: "Salmón con Agregado", precio: "$14.900", descripcion: "Salmón a la plancha o mantequilla con agregado.", categoria: "mar", imagenURL: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=400", orden: 20 },
  { nombre: "Reineta con Agregado", precio: "$15.900", descripcion: "Reineta frita o a la plancha con agregado.", categoria: "mar", imagenURL: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=400", orden: 21 },
  { nombre: "Chupe de Locos", precio: "$15.900", descripcion: "Preparado con locos frescos, gratinado al horno.", categoria: "mar", imagenURL: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=400", orden: 22 },
  { nombre: "Pastel de Jaiba", precio: "$16.900", descripcion: "Preparado con jaiba fresca, cubierto de queso fundido.", categoria: "mar", imagenURL: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=400", orden: 23 },
  { nombre: "Paila Marina", precio: "$16.900", descripcion: "Aromático caldo de mariscos surtidos con toque de cilantro.", categoria: "mar", imagenURL: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=400", orden: 24 },

  // ---- PLATOS TRADICIONALES ----
  { nombre: "Pastel de Choclo", precio: "$13.900", descripcion: "Base de pino, pollo a la plancha, huevo, aceituna y pastelera de choclo.", categoria: "fondos", imagenURL: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400", orden: 25 },
  { nombre: "Cazuela de Vacuno", precio: "$12.000", descripcion: "Con plateada, papa, zapallo, choclo, porotos verdes y cilantro.", categoria: "fondos", imagenURL: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400", orden: 26 },
  { nombre: "Lomo Tetera", precio: "$14.000", descripcion: "Acompañado de arroz y papas fritas, coronado con salsa de alcaparras.", categoria: "fondos", imagenURL: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400", orden: 27 },
  { nombre: "Guatitas con Agregado", precio: "$8.950", descripcion: "Italianas o a la jardinera con salsa de tomate casera.", categoria: "fondos", imagenURL: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400", orden: 28 },
  { nombre: "Chorrillana Individual", precio: "$11.900", descripcion: "Tradicional: carne, cebolla caramelizada, chorizo y huevo frito.", categoria: "fondos", imagenURL: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400", orden: 29 },
  { nombre: "Lasagna Mixta", precio: "$13.900", descripcion: "Con salsa boloñesa, bechamel, masa casera y queso.", categoria: "fondos", imagenURL: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400", orden: 30 },
  { nombre: "Ravioles Caseros", precio: "$13.900", descripcion: "De mechada o pollo espinaca con salsa a elección.", categoria: "fondos", imagenURL: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400", orden: 31 },
  { nombre: "Suprema Napolitana", precio: "$14.000", descripcion: "Pollo apanado, salsa de tomate y queso gratinado.", categoria: "fondos", imagenURL: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400", orden: 32 },
  { nombre: "Opciones Vegetarianas", precio: "Desde $3.800", descripcion: "Panaché verduras ($3.800), Falafel ($6.900), Chorrillana Vegetariana ($11.500).", categoria: "fondos", imagenURL: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400", orden: 33 },

  // ---- ENTRADAS Y ENSALADAS ----
  { nombre: "Consomé Casero", precio: "$1.800", descripcion: "", categoria: "entradas", imagenURL: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=400", orden: 34 },
  { nombre: "Camarones al Pilpil", precio: "$8.900", descripcion: "En aceite de oliva, ajo, ají cacho de cabra, servido en greda.", categoria: "entradas", imagenURL: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=400", orden: 35 },
  { nombre: "Entrada de Locos (4 un.)", precio: "$16.900", descripcion: "Acompañado de mayonesa casera y pebre.", categoria: "entradas", imagenURL: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=400", orden: 36 },
  { nombre: "Ostiones o Machas Parmesana", precio: "$14.900", descripcion: "Con crema, queso y pimienta, gratinados al horno.", categoria: "entradas", imagenURL: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=400", orden: 37 },
  { nombre: "Ensalada Surtida", precio: "Desde $3.200", descripcion: "Ensalada con contenido de lechuga y palta.", categoria: "entradas", imagenURL: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=400", orden: 38 },
  { nombre: "Ensalada Tetera", precio: "$5.000", descripcion: "Lechuga servida en tetera.", categoria: "entradas", imagenURL: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=400", orden: 39 },

  // ---- GUARNICIONES ----
  { nombre: "Papas Fritas Individuales", precio: "$3.200", descripcion: "", categoria: "guarniciones", imagenURL: "https://images.unsplash.com/photo-1585032849925-15ff480e0c8b?q=80&w=400", orden: 40 },
  { nombre: "Papas Fritas Familiares", precio: "$6.000", descripcion: "", categoria: "guarniciones", imagenURL: "https://images.unsplash.com/photo-1585032849925-15ff480e0c8b?q=80&w=400", orden: 41 },
  { nombre: "Otros Acompañamientos", precio: "Varios", descripcion: "Arroz ($2.200), Puré ($2.500), Papas Mayo ($2.500), Papas Salteadas ($3.000), Papas a la crema ($3.800).", categoria: "guarniciones", imagenURL: "https://images.unsplash.com/photo-1585032849925-15ff480e0c8b?q=80&w=400", orden: 42 },

  // ---- MENÚ NIÑOS ----
  { nombre: "Salchipapas", precio: "$6.500", descripcion: "", categoria: "ninos", imagenURL: "https://images.unsplash.com/photo-1628840042765-356cda07504e?q=80&w=400", orden: 43 },
  { nombre: "Nuggets con Papas Fritas", precio: "$6.500", descripcion: "", categoria: "ninos", imagenURL: "https://images.unsplash.com/photo-1562967914-608f82629710?q=80&w=400", orden: 44 },
  { nombre: "Filetes con Papas Fritas", precio: "$6.500", descripcion: "", categoria: "ninos", imagenURL: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?q=80&w=400", orden: 45 },

  // ---- POSTRES ----
  { nombre: "Leche Asada", precio: "$4.000", descripcion: "", categoria: "postres", imagenURL: "https://images.unsplash.com/photo-1551024506-0cb4a1cb1cdd?q=80&w=400", orden: 46 },
  { nombre: "Copas de Helado / Durazno", precio: "$4.000+", descripcion: "", categoria: "postres", imagenURL: "https://images.unsplash.com/photo-1551024506-0cb4a1cb1cdd?q=80&w=400", orden: 47 },
  { nombre: "Cheesecake de Maracuyá", precio: "$4.500", descripcion: "", categoria: "postres", imagenURL: "https://images.unsplash.com/photo-1551024506-0cb4a1cb1cdd?q=80&w=400", orden: 48 },
  { nombre: "Tiramisú", precio: "$4.800", descripcion: "", categoria: "postres", imagenURL: "https://images.unsplash.com/photo-1551024506-0cb4a1cb1cdd?q=80&w=400", orden: 49 },
  { nombre: "Postre Tetera / Papayas", precio: "Desde $4.800", descripcion: "", categoria: "postres", imagenURL: "https://images.unsplash.com/photo-1551024506-0cb4a1cb1cdd?q=80&w=400", orden: 50 },
];

export const BEBIDAS_SEED = [
  // ---- Aperitivos y Cócteles ----
  { nombre: "Pisco Sour Tradicional", precio: "$3.500", subcategoria: "Aperitivos y Cócteles", orden: 1 },
  { nombre: "Vaina Chilena", precio: "$4.000", subcategoria: "Aperitivos y Cócteles", orden: 2 },
  { nombre: "Amaretto Sour / Mango / Chardonnay", precio: "$4.500", subcategoria: "Aperitivos y Cócteles", orden: 3 },
  { nombre: "Sour Sabores", precio: "$4.800", subcategoria: "Aperitivos y Cócteles", orden: 4 },
  { nombre: "Aperol Spritz", precio: "$5.800", subcategoria: "Aperitivos y Cócteles", orden: 5 },
  { nombre: "Ramazzotti", precio: "$5.800", subcategoria: "Aperitivos y Cócteles", orden: 6 },

  // ---- Vinos Blancos y Tintos ----
  { nombre: "Copa de Vino (Tinto o Blanco)", precio: "$2.800", subcategoria: "Vinos Blancos y Tintos", orden: 7 },
  { nombre: "Botellín Carmen / 120", precio: "$3.000", subcategoria: "Vinos Blancos y Tintos", orden: 8 },
  { nombre: "Gato 3/4", precio: "$7.000", subcategoria: "Vinos Blancos y Tintos", orden: 9 },
  { nombre: "Undurraga / Carmen 3/4", precio: "$7.500", subcategoria: "Vinos Blancos y Tintos", orden: 10 },
  { nombre: "Misiones de Rengo", precio: "$8.500", subcategoria: "Vinos Blancos y Tintos", orden: 11 },
  { nombre: "Vino Obeja Negra", precio: "$9.800", subcategoria: "Vinos Blancos y Tintos", orden: 12 },
  { nombre: "Casillero Red Blend", precio: "$14.900", subcategoria: "Vinos Blancos y Tintos", orden: 13 },
  { nombre: "Toro de Piedra", precio: "$19.000", subcategoria: "Vinos Blancos y Tintos", orden: 14 },
  { nombre: "Descorche de Vino", precio: "$5.000", subcategoria: "Vinos Blancos y Tintos", orden: 15 },

  // ---- Cervezas ----
  { nombre: "Botellín Cristal / Stella Artois", precio: "$1.500", subcategoria: "Cervezas", orden: 16 },
  { nombre: "Botellín Heineken / Kross / Kunstmann", precio: "$3.200", subcategoria: "Cervezas", orden: 17 },
  { nombre: "Cerveza Litro (Cristal / Escudo)", precio: "$4.000", subcategoria: "Cervezas", orden: 18 },
  { nombre: "Cerveza Litro (Heineken / Royal)", precio: "$4.800", subcategoria: "Cervezas", orden: 19 },
  { nombre: "Base Michelada", precio: "$1.800", subcategoria: "Cervezas", orden: 20 },

  // ---- Sin Alcohol & Cafetería ----
  { nombre: "Agua (Con o Sin Gas)", precio: "$2.200", subcategoria: "Sin Alcohol & Cafetería", orden: 21 },
  { nombre: "Jugo Natural / Limonada Tradicional", precio: "$3.500", subcategoria: "Sin Alcohol & Cafetería", orden: 22 },
  { nombre: "Limonada Menta Jengibre con Miel", precio: "$4.800", subcategoria: "Sin Alcohol & Cafetería", orden: 23 },
  { nombre: "Taza de Té / Agua de Hierbas", precio: "$1.500", subcategoria: "Sin Alcohol & Cafetería", orden: 24 },
  { nombre: "Café Espresso en Grano", precio: "$2.500", subcategoria: "Sin Alcohol & Cafetería", orden: 25 },
  { nombre: "Café Americano / Latte / Capuccino", precio: "$3.500", subcategoria: "Sin Alcohol & Cafetería", orden: 26 },
];
