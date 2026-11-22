/**
 * Arte oficial de League of Legends para la portada.
 *
 * Se sirve desde Data Dragon, el CDN público de Riot Games para proyectos de la comunidad. La política de
 * Riot («Legal Jibber Jabber») permite usar su arte en proyectos de fans siempre que se muestre su aviso
 * (`common.notAffiliated`, en el pie) y no se dé a entender que Riot respalda el proyecto. Son las
 * ilustraciones de las *skins* de los Mundiales: comparten la luz azul noche y oro de la marca.
 *
 * Todas miden 1215 × 717. Si se cambia el origen, hay que cambiar también `img-src` en `next.config.mjs`.
 */
const SPLASH = "https://ddragon.leagueoflegends.com/cdn/img/champion/splash";

export const ART_WIDTH = 1215;
export const ART_HEIGHT = 717;

export interface Art {
  src: string;
  /** Texto alternativo para cuando la imagen aporta contenido (las de fondo van con `alt=""`). */
  alt: string;
}

function splash(key: string, alt: string): Art {
  return { src: `${SPLASH}/${key}.jpg`, alt };
}

export const ART = {
  hero: splash("Viego_37", "Viego del Mundial 2024 sentado en su trono"),
  rewards: splash("Ashe_9", "Ashe del Mundial 2017 tensando el arco"),
  close: splash("Khazix_11", "Kha'Zix del Mundial 2018"),
  steps: [
    splash("Kalista_2", "Kalista del Mundial 2015"),
    splash("Ryze_11", "Ryze del Mundial 2019"),
    splash("Shyvana_5", "Shyvana del Mundial 2014"),
    splash("JarvanIV_30", "Jarvan IV del Mundial 2021"),
  ],
} as const;
