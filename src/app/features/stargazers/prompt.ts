const KEY = "stargazer-prompt-seen";
// Donde el almacenamiento está bloqueado, recordarlo solo durante esta carga de la página.
let seenHere = false;

/** Si el aviso de estrellas ya se mostró, o si se visitó la página de estrellas, en este dispositivo. */
export function promptSeen() {
  try {
    return seenHere || localStorage.getItem(KEY) === "1";
  } catch {
    return seenHere;
  }
}

export function markPromptSeen() {
  seenHere = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Almacenamiento bloqueado: alcanza con la bandera del módulo de arriba.
  }
}
