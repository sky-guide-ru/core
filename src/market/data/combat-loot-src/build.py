import json,re,sys,os
# Запуск: python3 build.py ../combat-loot.json (из этой папки). База имён — items-ru.
HERE=os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
DB=os.environ.get('ITEMS_RU') or os.path.join(HERE,'../../../items-ru/data/items-ru.json')
items=json.load(open(DB))
byname={}
for k,v in items.items():
    n=(v.get('nameEn') or '').lower()
    if n and n not in byname: byname[n]=k
    elif n and ';' not in k and ';' in byname[n]: byname[n]=k
ROM={'I':1,'II':2,'III':3,'IV':4,'V':5,'VI':6,'VII':7}
ULT={'Last Stand':'ULTIMATE_LAST_STAND','Ultimate Wise':'ULTIMATE_WISE','Wisdom':'ULTIMATE_WISDOM','One For All':'ULTIMATE_ONE_FOR_ALL','Soul Eater':'ULTIMATE_SOUL_EATER','Rend':'ULTIMATE_REND','Fatal Tempo':'ULTIMATE_FATAL_TEMPO','Inferno':'ULTIMATE_INFERNO','Duplex':'ULTIMATE_REITERATE'}
OVR={"Necron's Handle":'NECRON_HANDLE','Implosion':'IMPLOSION_SCROLL','Shadow Warp':'SHADOW_WARP_SCROLL','Wither Shield':'WITHER_SHIELD_SCROLL',
 'Master Skull':None,'Spirit Pet':'SPIRIT;4','Wither Helmet':'WITHER_HELMET','Wither Chestplate':'WITHER_CHESTPLATE','Wither Leggings':'WITHER_LEGGINGS','Wither Boots':'WITHER_BOOTS',
 'Crimson Essence':'ESSENCE_CRIMSON','Kuudra Teeth':'KUUDRA_TEETH','Heavy Pearl':'HEAVY_PEARL','Revenant Shard':'SHARD_REVENANT',
 'Wisp\'s Ice-Flavored Water I Splash Potion':None,'Grizzly Salmon':'GRIZZLY_BAIT','Ender Pearl':'ENDER_PEARL','Rough Sapphire Gemstone':'ROUGH_SAPPHIRE_GEM','Rough Topaz Gemstone':'ROUGH_TOPAZ_GEM','Rough Ruby Gemstone':'ROUGH_RUBY_GEM','Rough Jade Gemstone':'ROUGH_JADE_GEM','Flawed Opal Gemstone':'FLAWED_OPAL_GEM',
 'Summoning Eye':'SUMMONING_EYE','Auto Recombobulator':'AUTO_RECOMBOBULATOR','Tentacle Dye':'DYE_TENTACLE','Necron Dye':'DYE_NECRON'}
miss=[]
def rid(name):
    if name in OVR: return OVR[name]
    m=re.match(r'BOOK:(.+) ([IV]+)$',name)
    if m:
        b,l=m.group(1),ROM[m.group(2)]
        base=ULT.get(b) or b.upper().replace(' ','_').replace("'",'')
        k=f'{base};{l}'
        if k not in items: miss.append(name)
        return f'ENCHANTMENT_{base}_{l}'
    m=re.match(r'(.+) Shard$',name)
    if m: return 'SHARD_'+m.group(1).upper().replace(' ','_')
    m=re.match(r'(.+) Rune$',name)
    if m:
        k=byname.get((name+' I').lower())
        if k: return k
    k=byname.get(name.lower())
    if not k: miss.append(name)
    return k
def qty(s):
    s=s.strip()
    if s in('-',''): return None
    m=re.match(r'^(\d+)-(\d+)$',s)
    return (int(m.group(1))+int(m.group(2)))/2 if m else float(s)
def pct(s):
    s=s.strip().replace('%','')
    return None if s in('-','') else round(float(s)/100,8)
out={'$comment':'Таблицы дропа боевого контента с hypixel-skyblock.fandom.com (выгрузка 23.11.2026): слееры (Revenant_Horror, Tarantula_Broodfather, Sven_Packmaster, Voidgloom_Seraph, Inferno_Demonlord), сундуки данжей (Dungeon_Reward_Chest/Loot, колонка S+; только Obsidian и Bedrock, без дешёвых книг и дисков), сундук Kuudra (Kuudra/Loot, платный сундук), мобы (шаблон Mob Drops Table). Шансы базовые, без Magic Find и RNG-метра. qty — среднее количество, lvl — уровень слеера для дропа, cost — цена открытия сундука.',
     'slayers':{},'dungeons':{},'kuudra':{},'mobs':{}}
cur=None
for line in open('slayers.txt'):
    line=line.rstrip('\n')
    if not line: continue
    if line.startswith('#'):
        k,c=line[1:].split('|'); cur=k; out['slayers'][k]={'cost':[int(x) for x in c.split(',')],'drops':[]}; continue
    name,rest=line.split(' ~ '); parts=[p.strip() for p in rest.split(';')]
    T=len(out['slayers'][cur]['cost'])
    lvl=parts[0]; q=parts[1:1+T]; ch=parts[1+T:1+2*T]
    assert len(ch)==T,(line,len(ch))
    i=rid(name)
    if not i: continue
    out['slayers'][cur]['drops'].append({'id':i,'name':name.replace('BOOK:','Enchanted Book '),'lvl':0 if lvl=='-' else int(lvl),'qty':[qty(x) for x in q],'chance':[pct(x) for x in ch]})
for line in open('dungeons.txt'):
    line=line.strip()
    if line.startswith('@'):
        f,c=line[1:].split('|'); cur=out['dungeons'].setdefault(f,{}).setdefault(c,[]); continue
    n,p,c=line.split('|'); i=rid(n)
    if i: cur.append({'id':i,'name':n.replace('BOOK:','Enchanted Book '),'chance':round(float(p)/100,6),'cost':int(c)})
for line in open('kuudra.txt'):
    line=line.strip()
    if line.startswith('@'):
        t,key=line[1:].split('|'); cur={'key':key,'drops':[]}; out['kuudra'][t]=cur; continue
    n,slot,p=line.split('|'); q=1
    m=re.match(r'^([\d.]+) (.+)$',n)
    if m: q=float(m.group(1)); n=m.group(2)
    if n=='ARMOR':
        cur['drops'].append({'armor':True,'chance':round(float(p)/100,6),'slot':int(slot)}); continue
    i=rid(n)
    if i: cur['drops'].append({'id':i,'name':n.replace('BOOK:','Enchanted Book '),'qty':q,'slot':int(slot),'chance':round(float(p)/100,6)})
for line in open('mobs.txt'):
    line=line.strip()
    if line.startswith('@'): cur=out['mobs'].setdefault(line[1:],[]); continue
    n,q,p=line.split('|'); i=rid(n)
    if i: cur.append({'id':i,'name':n,'qty':float(q),'chance':float(p)})
json.dump(out,open(sys.argv[1],'w'),ensure_ascii=False,indent=0)
print('MISSING',sorted(set(miss)))
