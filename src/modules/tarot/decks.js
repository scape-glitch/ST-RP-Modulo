export const CARD_NAMES = [
  'The Fool','The Magician','The High Priestess','The Empress','The Emperor','The Hierophant','The Lovers','The Chariot','Strength','The Hermit','Wheel of Fortune','Justice','The Hanged Man','Death','Temperance','The Devil','The Tower','The Star','The Moon','The Sun','Judgement','The World',
  'Ace of Cups','Two of Cups','Three of Cups','Four of Cups','Five of Cups','Six of Cups','Seven of Cups','Eight of Cups','Nine of Cups','Ten of Cups','Page of Cups','Knight of Cups','Queen of Cups','King of Cups',
  'Ace of Rings','Two of Rings','Three of Rings','Four of Rings','Five of Rings','Six of Rings','Seven of Rings','Eight of Rings','Nine of Rings','Ten of Rings','Page of Rings','Knight of Rings','Queen of Rings','King of Rings',
  'Ace of Wands','Two of Wands','Three of Wands','Four of Wands','Five of Wands','Six of Wands','Seven of Wands','Eight of Wands','Nine of Wands','Ten of Wands','Page of Wands','Knight of Wands','Queen of Wands','King of Wands',
  'Ace of Swords','Two of Swords','Three of Swords','Four of Swords','Five of Swords','Six of Swords','Seven of Swords','Eight of Swords','Nine of Swords','Ten of Swords','Page of Swords','Knight of Swords','Queen of Swords','King of Swords'
];

export const DECKS = {
  classic: { label: 'classic', back: 'https://i.postimg.cc/sDkXdzRm/Back.jpg', className: 'rpsuite-tarot-classic', accent: '#d8b4fe', urls: {} },
  alternate: { label: 'alternate', back: 'https://i.postimg.cc/P5r70zpX/Card-back.webp', className: 'rpsuite-tarot-alternate', accent: '#f472b6', urls: {} },
};

export function getDeck(style = 'classic') { return DECKS[style] || DECKS.classic; }
export function getCardImage(cardName, style = 'classic') { return getDeck(style).urls?.[cardName] || getDeck(style).back; }