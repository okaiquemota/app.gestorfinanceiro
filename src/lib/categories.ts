// Categorias de gasto. `emoji` aponta pra /public/emoji/<nome>.webp.

export type Category = { id: string; label: string; emoji: string }

export const CATEGORIES: Category[] = [
  { id: 'moradia', label: 'Moradia', emoji: 'house' },
  { id: 'alimentacao', label: 'Alimentação', emoji: 'cart' },
  { id: 'transporte', label: 'Transporte', emoji: 'car' },
  { id: 'saude', label: 'Saúde', emoji: 'pill' },
  { id: 'educacao', label: 'Educação', emoji: 'education' },
  { id: 'assinaturas', label: 'Assinaturas', emoji: 'tv' },
  { id: 'lazer', label: 'Lazer', emoji: 'party' },
  { id: 'compras', label: 'Compras', emoji: 'shopping' },
  { id: 'familia', label: 'Família', emoji: 'gift' },
  { id: 'dividas', label: 'Dívidas', emoji: 'bank' },
  { id: 'impostos', label: 'Impostos e taxas', emoji: 'receipt' },
  { id: 'trabalho', label: 'Trabalho', emoji: 'briefcase' },
  { id: 'reserva', label: 'Reserva', emoji: 'money-bag' },
  { id: 'outros', label: 'Outros', emoji: 'box' },
]

// Agrupamentos que só aparecem no resumo (não são escolhidos em formulário).
const VIRTUAL: Category[] = [
  { id: 'cartao', label: 'Cartões de crédito', emoji: 'card' },
  { id: 'dia-a-dia', label: 'Dia a dia', emoji: 'coin' },
  { id: 'renda', label: 'Renda', emoji: 'banknote' },
]

const byId = new Map([...CATEGORIES, ...VIRTUAL].map((c) => [c.id, c]))

export const category = (id: string): Category => byId.get(id) ?? byId.get('outros')!

export const GOAL_ICONS = [
  'umbrella', 'money-bag', 'house-garden', 'plane', 'beach', 'car',
  'education', 'gem', 'rocket', 'seedling', 'tools', 'gift', 'phone', 'pet', 'target', 'party',
]

export const GOAL_ICON_LABELS: Record<string, string> = {
  umbrella: 'Guarda-chuva',
  'money-bag': 'Saco de dinheiro',
  'house-garden': 'Casa',
  plane: 'Avião',
  beach: 'Praia',
  car: 'Carro',
  education: 'Formatura',
  gem: 'Joia',
  rocket: 'Foguete',
  seedling: 'Muda de planta',
  tools: 'Ferramentas',
  gift: 'Presente',
  phone: 'Celular',
  pet: 'Pet',
  target: 'Alvo',
  party: 'Festa',
}

export const CARD_COLORS: Record<string, { label: string; bg: string }> = {
  graphite: { label: 'Grafite', bg: 'linear-gradient(135deg, #3a3d45 0%, #17181c 55%, #2a2c33 100%)' },
  blue: { label: 'Azul', bg: 'linear-gradient(135deg, #2f6bf0 0%, #1740b8 100%)' },
  purple: { label: 'Roxo', bg: 'linear-gradient(135deg, #8a3df2 0%, #5a17c9 100%)' },
  orange: { label: 'Laranja', bg: 'linear-gradient(135deg, #f58a1f 0%, #e05d00 100%)' },
  red: { label: 'Vermelho', bg: 'linear-gradient(135deg, #ee3b3b 0%, #b31217 100%)' },
  pink: { label: 'Rosa', bg: 'linear-gradient(135deg, #f0508c 0%, #c2185b 100%)' },
  green: { label: 'Verde', bg: 'linear-gradient(135deg, #17a865 0%, #0b6b45 100%)' },
  gold: { label: 'Dourado', bg: 'linear-gradient(135deg, #c9a24a 0%, #8a6a1c 100%)' },
}
