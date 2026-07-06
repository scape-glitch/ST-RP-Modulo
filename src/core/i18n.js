export const LANGS = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
];

const STRINGS = {
  ru: {
    subtitle: 'Модульные RP-инструменты для SillyTavern',
    enabled: 'Включено',
    language: 'Язык',
    profile: 'Connection Profile',
    model: 'Модель',
    unknownModel: 'неизвестная модель',
    noProfiles: 'Нет доступных Connection Profiles',
    deckStyle: 'Стиль карт',
  },
  en: {
    subtitle: 'Modular roleplay helpers for SillyTavern',
    enabled: 'Enabled',
    language: 'Language',
    profile: 'Connection Profile',
    model: 'Model',
    unknownModel: 'unknown model',
    noProfiles: 'No Connection Profiles available',
    deckStyle: 'Card style',
  },
};

export function t(key, lang = 'ru') {
  return STRINGS[lang]?.[key] || STRINGS.en[key] || key;
}

export function moduleDisplayName(id, lang = 'ru') {
  const names = {
    metrics: { ru: 'Metrics', en: 'Metrics' },
    tarot: { ru: 'Tarot', en: 'Tarot' },
    comments: { ru: 'Comments', en: 'Comments' },
    infoblock: { ru: 'Info Block', en: 'Info Block' },
    wallet: { ru: 'Wallet', en: 'Wallet' },
    html_creator: { ru: 'HTML Creator', en: 'HTML Creator' },
  };
  return names[id]?.[lang] || names[id]?.en || id;
}