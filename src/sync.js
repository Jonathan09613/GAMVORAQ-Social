// Similarity is a transparent recommendation, never a rating of a person's worth.
export function compatibility(me,other,myGames=[],theirGames=[]){
  const a=new Set(myGames.map(String)), b=new Set(theirGames.map(String));
  const shared=[...a].filter(x=>b.has(x));let points=15; const why=[];
  if(shared.length){points+=Math.min(42,shared.length*14);why.push(`${shared.length} ${shared.length === 1 ? 'juego' : 'juegos'} en común`);}
  if(me.play_style&&other.play_style&&me.play_style===other.play_style){points+=14;why.push('mismo estilo');}
  if(me.platform&&other.platform&&me.platform===other.platform){points+=10;why.push('misma plataforma');}
  if(me.mic_preference&&other.mic_preference&&me.mic_preference===other.mic_preference){points+=9;why.push('preferencia de voz compatible');}
  if(me.schedule&&other.schedule&&me.schedule===other.schedule){points+=10;why.push('horario similar');}
  if(why.length===0)why.push('puedes descubrir algo nuevo');
  return {score:Math.min(100,points),why,shared};
}
