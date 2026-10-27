// El "cerebro" del agente: recibe un mensaje y devuelve el texto de respuesta
// (o null para no contestar). Por ahora es una respuesta fija de prueba.
export async function reply({ name, type, text }) {
  if (type !== "text") {
    return "Por ahora solo puedo leer mensajes de texto. ✍️";
  }
  const saludo = name ? `¡Hola, ${name}!` : "¡Hola!";
  return `${saludo} Recibí tu mensaje: "${text}"`;
}
