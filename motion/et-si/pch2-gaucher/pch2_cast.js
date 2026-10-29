// Les personnages de l'épisode (nouveaux : la règle « personnages différents à chaque épisode »).
(function () {
  const HERO = { body: 'enfant', spec: { hair: 'afro', freckles: false }, top: 'hoodie', bottom: 'jean',
    pal: { skin: '#8A5A3C', hair: '#1A110C', top: '#F28C38', bottom: '#2F3F66', shoe: '#FBFAF6', shoeAcc: '#4FA3CF', iris: '#3B2418', string: '#FFF6E6', accent: '#4FA3CF' } };
  const VOISIN = { body: 'enfant', spec: { hair: 'court' }, top: 'tee', sleeve: 'court', bottom: 'jean',
    pal: { skin: '#F2C9AC', hair: '#E3B94F', top: '#5FB57A', bottom: '#3F5888', iris: '#4FA3CF', shoe: '#E5483D' } };
  const PROF = { body: 'adulte', spec: { hair: 'chignon', lash: true, glasses: '#7A3A2A' }, top: 'pull', bottom: 'jupe',
    pal: { skin: '#E8B48E', hair: '#5A2E1E', top: '#4E7CC2', bottom: '#33384A', iris: '#3B2418', shoe: '#5A2E1E' } };
  const MAMIE = { body: 'age', spec: { hair: 'chignon', lash: true, glasses: '#8A6A9A' }, top: 'robe', bottom: 'robe',
    pal: { skin: '#E9BFA0', hair: '#D9D6D2', top: '#A97CC9', shoe: '#5A4A5A', socks: '#E9BFA0', iris: '#5A6A7A' } };
  const ELEVE1 = { body: 'enfant', spec: { hair: 'queue', lash: true }, top: 'tee', bottom: 'jean', pal: { skin: '#F0C8A8', hair: '#B5532A', top: '#F28CB1', bottom: '#3F5888' } };
  const ELEVE2 = { body: 'enfant', spec: { hair: 'casquette' }, top: 'hoodie', bottom: 'jogging', pal: { skin: '#C98E62', hair: '#24160F', top: '#7FB7BE', bottom: '#4B4E63', accent: '#26262E' } };
  window.CAST = { HERO, VOISIN, PROF, MAMIE, ELEVE1, ELEVE2 };
})();
