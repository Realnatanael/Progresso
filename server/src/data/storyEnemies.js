/**
 * Oponentes do Modo História. `element` define fraqueza (ciclo Fogo > Vento > Raio > Terra > Água > Fogo).
 * `moves` rodam em ciclo; o próximo golpe é mostrado antes do jogador agir.
 * `power` é o dano base (multiplicado por atk, variação e defesa).
 */
export const ENEMIES = {
  rival: {
    name: 'Daichi',
    title: 'Rival da Academia',
    sprite: 'rival',
    element: 'wind',
    hp: 40,
    atk: 1,
    moves: [
      { name: 'Soco rápido', power: 5 },
      { name: 'Chute giratório', power: 7 },
      { name: 'Fuuton: Rajada Curta', power: 8, element: 'wind' },
    ],
  },
  kakashi: {
    name: 'Kakashi',
    title: 'Sensei Jounin',
    sprite: 'jounin',
    element: null,
    hp: 400,
    atk: 1,
    stunResist: 0.5,
    moves: [
      { name: 'Chute leve', power: 6 },
      { name: 'Golpe de kunai', power: 8 },
      { name: 'Substituição e chute', power: 10 },
    ],
  },
  bandit: {
    name: 'Bandidos da Estrada',
    title: 'Emboscada',
    sprite: 'bandit',
    element: 'earth',
    hp: 72,
    atk: 1,
    moves: [
      { name: 'Golpe de espada', power: 8 },
      { name: 'Chuva de kunai', power: 10 },
      { name: 'Investida bruta', power: 12 },
    ],
  },
  swordsman: {
    name: 'Zabuza',
    title: 'Demônio da Névoa',
    sprite: 'swordsman',
    element: 'water',
    hp: 115,
    atk: 1,
    moves: [
      { name: 'Corte da Kubikiribōchō', power: 12 },
      { name: 'Suiton: Clone d’Água', power: 10, element: 'water' },
      { name: 'Suiton: Dragão d’Água', power: 16, element: 'water' },
    ],
  },
  serpent: {
    name: 'Orochimaru',
    title: 'Ninja desconhecido',
    sprite: 'serpent',
    element: 'earth',
    hp: 500,
    atk: 1,
    stunResist: 0.6,
    moves: [
      { name: 'Mordida de serpente', power: 13 },
      { name: 'Aura assassina', power: 12, fx: 'genjutsu' },
      { name: 'Doton: Rio de Lama', power: 17, element: 'earth' },
    ],
  },
  kunoichi: {
    name: 'Temari',
    title: 'Vila da Areia',
    sprite: 'kunoichi',
    element: 'wind',
    hp: 140,
    atk: 1.1,
    moves: [
      { name: 'Golpe de leque', power: 11 },
      { name: 'Fuuton: Lâmina de Vento', power: 14, element: 'wind' },
      { name: 'Fuuton: Grande Tempestade', power: 18, element: 'wind' },
    ],
  },
  sand: {
    name: 'Gaara',
    title: 'Finalista da Areia',
    sprite: 'sand',
    element: 'earth',
    hp: 150,
    atk: 1,
    enrage: true,
    moves: [
      { name: 'Soco de areia', power: 13 },
      { name: 'Tsunami de Areia', power: 17, element: 'earth' },
      { name: 'Caixão de Areia', power: 22, element: 'earth' },
    ],
  },
  'kakashi-exam': {
    name: 'Kakashi',
    title: 'Avaliador Jounin',
    sprite: 'jounin',
    element: 'lightning',
    hp: 300,
    atk: 1.1,
    moves: [
      { name: 'Golpe de kunai', power: 15 },
      { name: 'Raiton: Raikiri', power: 24, element: 'lightning' },
      { name: 'Substituição e chute', power: 17 },
    ],
  },
  shadow: {
    name: 'Nukenin Escarlate',
    title: 'Renegado de rank S',
    sprite: 'shadow',
    element: 'fire',
    hp: 320,
    atk: 1,
    enrage: true,
    stunResist: 0.4,
    moves: [
      { name: 'Genjutsu ocular', power: 17, fx: 'genjutsu' },
      { name: 'Katon: Grande Bola de Fogo', power: 24, element: 'fire' },
      { name: 'Chamas Negras', power: 30, element: 'fire' },
    ],
  },
};
