import {memberName,spaceName,isSpaceCredential} from '../shared/spaces.js';
import {normalizeTheme} from './themes.js';
import {resolveVisual,VISUAL_PRESETS} from './visual-presets.js';
/** Couleurs des cinq thèmes Voti, communes à l'écran et au PDF. */
export const CARD_THEMES=Object.freeze({
  pop:{background:'#fdfbff',ink:'#25334b',muted:'#566077',accent:'#684397',soft:'#eee7f7',line:'#d7cfe3'},
  nature:{background:'#fbfdf9',ink:'#263b35',muted:'#53685e',accent:'#286449',soft:'#e4f0e5',line:'#c8d9cc'},
  douceur:{background:'#fffafb',ink:'#34374e',muted:'#646076',accent:'#72528e',soft:'#f0e9f5',line:'#ddd1e1'},
  dark:{background:'#202638',ink:'#f2f2fa',muted:'#bdc7df',accent:'#c9aff0',soft:'#37334f',line:'#4d5974'},
  minimal:{background:'#fafbfc',ink:'#273443',muted:'#566372',accent:'#3f536b',soft:'#e8edf3',line:'#ccd5df'}
});
export function memberCardModel(card,catalog=VISUAL_PRESETS){
  if(!isSpaceCredential(card.credential,'member'))throw new Error('Carte Voti invalide.');
  const cardTheme=normalizeTheme(card.cardTheme),groups=(card.groups??[]).map((g,i)=>({name:spaceName(typeof g==='string'?g:g.name),visual:card.visualDisplayOptions?.groups===false?null:resolveVisual('group',card.groupVisualIds?.[i]??g.visualId,catalog)}));
  return{credential:card.credential,memberDisplayName:memberName(card.memberDisplayName??card.displayName),spaceName:spaceName(card.spaceName),groups,cardTheme,colors:CARD_THEMES[cardTheme],memberVisual:card.visualDisplayOptions?.member===false?null:resolveVisual('member',card.memberVisualId,catalog),label:'Ma carte individuelle',instruction:'Garde cette carte pour toi.'};
}
