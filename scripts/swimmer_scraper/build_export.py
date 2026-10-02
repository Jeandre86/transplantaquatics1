"""Offline, source-aware swimming extraction. Produces a review export, never DB writes."""
import hashlib
import json
import re
import unicodedata
from collections import defaultdict, Counter
from pathlib import Path
from datetime import datetime, timezone
from pypdf import PdfReader
from consolidate_identities import consolidate as consolidate_identities

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/swimming'
CACHE = DATA / 'sources'
TIME = r'(?:\d+:)?\d+\.\d{1,3}'
STROKES = r'Freestyle|Backstroke|Breaststroke|Butterfly|Individual Medley|Medley|IM'

def key(s):
    return re.sub(r'[^\w]+', '', unicodedata.normalize('NFKD', s).encode('ascii','ignore').decode().casefold())

def uid(s):
    return hashlib.sha256(s.encode()).hexdigest()[:24]

def clean(s):
    return re.sub(r'\s+', ' ', s).strip()

COUNTRIES = {}
for code, name, aliases in [
 ('GBR','Great Britain',['Great Britain & North Ireland','Great Britain & Northern Ireland','Great Britain & N.Ireland','GB & NI','GB&NI','UK','United Kingdom','Great Britain & NI','GREAT BRIT']),
 ('USA','United States of America',['USA','United States']),('AUS','Australia',[]),('CAN','Canada',[]),('RSA','South Africa',[]),
 ('NIR','Northern Ireland',[]),('GER','Germany',[]),('FRA','France',[]),('ITA','Italy',[]),('ESP','Spain',[]),('POR','Portugal',[]),
 ('HUN','Hungary',[]),('POL','Poland',[]),('NED','Netherlands',[]),('BEL','Belgium',[]),('FIN','Finland',[]),('SWE','Sweden',[]),
 ('DEN','Denmark',[]),('NOR','Norway',[]),('SUI','Switzerland',[]),('AUT','Austria',[]),('IRL','Ireland',[]),('CZE','Czech Republic',['Czechia']),
 ('GRE','Greece',[]),('BUL','Bulgaria',[]),('CRO','Croatia',[]),('SVK','Slovakia',[]),('ISR','Israel',[]),('IND','India',[]),('IRN','Iran',['Islamic Republic of Iran']),
 ('ARG','Argentina',[]),('BRA','Brazil',[]),('COL','Colombia',[]),('MEX','Mexico',[]),('NZL','New Zealand',[]),('THA','Thailand',[]),
 ('JPN','Japan',[]),('CHN','China',[]),('HKG','Hong Kong',[]),('TUR','Turkey',[]),('KOR','Korea',[]),('UGA','Uganda',[]),('NEP','Nepal',[]),
 ('SGP','Singapore',[]),('URU','Uruguay',[]),('ECU','Ecuador',[]),('LUX','Luxembourg',[]),('ROU','Romania',[]),('KEN','Kenya',[])]:
    for alias in [code,name,*aliases]: COUNTRIES[key(alias)] = (name,code)
for alias,target in [('Great Brittan & NI','GBR'),('Great Brittan & N','GBR'),('Hongkong','HKG'),('reland','IRL'),('Uraguay','URU')]:
    COUNTRIES[key(alias)]=COUNTRIES[key(target)]

def country(team, group):
    if key(team) in COUNTRIES: return COUNTRIES[key(team)]
    if group == 'Australia' and re.search(r'NSW|QLD|VIC|ACT|TAS|^WA$|^SA$|Queensland|Victoria|Tasmania|Australia|New South Wales',team,re.I): return ('Australia','AUS')
    # Location of a meet alone is not evidence of nationality.
    return (None,None)

def time_ms(raw):
    if not raw: return None
    s=raw.strip().replace(',', '.')
    if re.fullmatch(r'\d+[.:]\d{2}[.:]\d{2}',s):
        parts=re.split('[.:]',s);s=f'{parts[0]}:{parts[1]}.{parts[2]}'
    if not re.fullmatch(r'(?:\d+:)?\d+(?:\.\d{1,3})?',s): return None
    parts=s.split(':'); seconds=parts[-1].split('.')
    if len(parts)>1 and int(seconds[0])>=60:return None
    value=(int(parts[0])*60000 if len(parts)>1 else 0)+int(seconds[0])*1000+int((seconds[1] if len(seconds)>1 else '').ljust(3,'0'))
    return value if value>0 else None

def event_context(text):
    text=re.sub(r'Breastroke','Breaststroke',text,flags=re.I)
    m=re.search(r'(\d+(?:\s*[x×]\s*\d+)?)\s*(?:(LC|SC)\s*)?(m\.?|Metre|Meter|Yard)s?\s*('+STROKES+')',text,re.I)
    if not m:
        m2=re.search(r'('+STROKES+r')\s+(\d+)m',text,re.I)
        if m2:return event_context(m2[2]+'m '+m2[1])
        return None
    stroke={'im':'Individual Medley','medley':'Individual Medley'}.get(m[4].lower(),m[4].title())
    relay=bool(re.search(r'[x×]|relay|\bteam\b',m[1]+' '+text,re.I))
    if relay and stroke=='Individual Medley':stroke='Medley'
    distance=[int(x) for x in re.findall(r'\d+',m[1])]
    course='SCY' if m[3].lower()=='yard' else 'LCM' if (m[2] or '').upper()=='LC' else 'SCM' if m[2] else None
    gender='Women' if re.search(r'Women|Girls|Female',text,re.I) else 'Men' if re.search(r'\bMen|Boys|Male',text,re.I) else 'Mixed' if 'Mixed' in text else None
    ages=re.findall(r'(\d+)\s*(?:-|to)\s*(\d+)',text)
    age='-'.join(ages[-1]) if ages else None
    if not age:
        a=re.search(r'(\d+)\s*(?:\+|& Over|years and older)',text,re.I)
        if a:age=a[1]+'+'
    return {'event':re.sub(r'\s*[x×]\s*','x',m[1])+('yd ' if course=='SCY' else 'm ')+stroke,
            'distance':__import__('math').prod(distance),'distance_unit':'yards' if course=='SCY' else 'metres',
            'stroke':stroke,'is_relay':relay,'course':course,'gender':gender,'age_group':age}

def category(text):
    s=text.lower()
    if 'donor' in s and ('family' in s or 'famil' in s):return 'donor_or_donor_family'
    if 'donor' in s:return 'donor'
    if 'champion' in s or 'support' in s:return 'supporter'
    if 'dialysis' in s:return 'dialysis'
    if re.search(r'heart\s*&\s*lung',s):return 'heart_and_lung'
    if any(x in s for x in ['transplant recipient','open transplant','warrior']) or re.match(r'Open-',text):return 'transplant_recipient'
    return 'unspecified'

def pages(meta):
    p=ROOT/meta['file'];out=p.with_suffix('.pages.json')
    if not out.exists():out.write_text(json.dumps([pg.extract_text(extraction_mode='layout') if '/Contents' in pg else '' for pg in PdfReader(p).pages],ensure_ascii=False))
    return json.loads(out.read_text())

def spec(m):
    u=m['url'];id=m['id']
    fixed={
      'a1cb704f30fb046919f4':('WTG',2025,'Dresden','splash','LCM'),
      '24ba1c21404ed827c2aa':('WTG',2023,'Perth','hytek','LCM'),
      '8c6331b411ba0062051b':('WTG',2019,'Newcastle/Gateshead','wtg2019',None),
      'ad8a36eebb378718d31e':('WTG',2017,'Malaga','msl','LCM'),
      '7d2898902f98b7bb3c35':('WTG',2015,'Mar del Plata','scan',None),
      'fc4cd487226f9d06b70f':('WTG',2013,'Durban','scan',None),
      'f551c4dbece135bcec7a':('Britain',2026,'Sheffield','british',None),
      '5bf718e455a5161e1017':('Britain',2025,'Oxford','british',None),
      '1f7379e5282bd6b98ca9':('Britain',2024,'Nottingham','british',None),
      '1ced0ef0865e6d00f867':('Australia',2024,'Canberra','hytek','LCM'),
      'ad3a38e8c3a39e4c7421':('Australia',2026,'Launceston','hytek',None),
      'c3116af3671a83d248b0':('Australia',2026,'Launceston','australian_relays',None),
      '75e3d0c788da0f0b53ad':('Australia',2018,'Gold Coast','hytek','LCM'),
      '409a2aae93a83ba2267c':('USA',2026,'Denver','hytek','SCY'),
      '99a8d7a199ea0e2eb160':('USA',2026,'Denver','hytek','SCY'),
      '4dcb73d43a919bc67d03':('Europe',2010,'Dublin','dublin',None),
      '9a5a861ed0d59b7021b0':('WTG',2005,'London, Ontario','old_book',None),
      '3922ffe957c2752ec3ec':('WTG',2007,'Bangkok','old_book',None),
      '59d72f1169bc93f0ba83':('WTG',2009,'Gold Coast','old_book','LCM'),
    }
    if id in fixed:v=fixed[id]
    elif 'anlisboa.info' in u and 'ResultList' in u:v=('Europe',2024,'Lisbon','splash',None)
    elif '49279/ResultList' in u:v=('Europe',2026,'Arnhem','splash','SCM')
    elif '/s/Nat_' in u:v=('Canada',2026,'Sherbrooke','canada',None)
    else:return None
    return dict(zip(['group','year','location','parser','course'],v),meet_id=f'{v[0].lower()}-{v[1]}')

OBS=[];RELAYS=[];ISSUES=[];COVERAGE=[]

def emit(m,s,ctx,page,line,name,team,raw_time,placing=None,age=None,extra=None):
    name=clean(name)
    if ',' in name and not ctx['is_relay']:
        last,first=name.split(',',1);name=clean(first+' '+last)
    if not name or not any(c.isalpha() for c in name):return None
    co,cc=country(team,s['group'])
    status=raw_time.upper() if raw_time and re.fullmatch(r'DNS|DNF|DQ|DSQ|WDR|SCR|NS|NT|DNC|DNQ|NO SHOW|BYE',raw_time,re.I) else 'OK' if raw_time else 'NOT_REPORTED'
    ms=time_ms(raw_time) if status=='OK' else None
    c=ctx.copy();c['course']=c.get('course') or s['course']
    ref={'source_id':m['id'],'url':m['url'],'page':page,'raw_row':line.strip()}
    flags=[]
    if status=='OK' and ms is None:flags.append('unrecognised_time')
    if ms and c.get('distance') and (ms/c['distance']<150 or ms/c['distance']>15000):flags.append('implausible_time_check_source')
    if not c.get('course'):flags.append('pool_length_not_confirmed')
    result={**c,'meet_id':s['meet_id'],'year':s['year'],'swimmer_name_original':name,'team_original':team,
            'country':co,'country_code':cc,'age_at_meet':int(age) if age and str(age).isdigit() else None,
            'time_original':raw_time,'time_ms':ms,'race_status':status,'placing_original':placing,
            'source_references':[ref],'review_flags':flags,**(extra or {})}
    result.setdefault('competition_category','unspecified')
    result.setdefault('category_original',None)
    result.setdefault('round',None)
    result.setdefault('date',None)
    if c['is_relay']:
        result['team_name']=name;result['members']=[];RELAYS.append(result)
    else:OBS.append(result)
    return result

def parse_british(m,s,pp):
    for p,text in enumerate(pp,1):
        for line in text.splitlines():
            if not line.strip().startswith('Swimming '):continue
            cols=re.split(r'\s{2,}',line.strip())
            if len(cols)<7:ISSUES.append({'source_id':m['id'],'page':p,'raw_row':line,'reason':'british_columns'});continue
            _,event,gender,age,last,first,team,*tail=cols
            ctx=event_context(event)
            if not ctx and 'relay' in event.lower():
                ctx={'event':event,'distance':None,'distance_unit':None,'stroke':None,'is_relay':True,'course':None}
            if not ctx:ISSUES.append({'source_id':m['id'],'page':p,'raw_row':line,'reason':'unknown_event'});continue
            ctx.update(gender={'F':'Women','M':'Men'}.get(gender),age_group=age.replace(' to ','-'),category_original=age,competition_category='unspecified')
            # Position marker NS here accompanies valid times: keep it as a source marker.
            value=tail[-1] if len(tail)>=2 else None
            if value=='NULL':value=None
            result=emit(m,s,ctx,p,line,team if ctx['is_relay'] else first+' '+last,team,value,tail[0] if tail else None,
                 extra={'first_name':first,'last_name':last,'source_columns':cols,'points_original':tail[1] if len(tail)>2 else None})
            if ctx['is_relay'] and result:
                result['members']=[{'name_original':first+' '+last,'swimmer_id':None}]
                result['review_flags'].append('relay_distance_not_reported')

def parse_hytek(m,s,pp):
    ctx=None;last=None
    for p,text in enumerate(pp,1):
        if s['group']=='WTG' and s['year']==2023 and not 115<=p<=137:continue
        for line in text.splitlines():
            st=line.strip()
            if re.match(r'(?:\.+)?Event\s+\d+',st,re.I):
                new=event_context(st)
                if new:
                    ctx={**new,'event_number':re.search(r'Event\s+(\d+)',st,re.I)[1],'category_original':st,'competition_category':category(st),'round':'final'}
                    if 'Division' in st:ctx['category_original']=st
                    last=None
                else:ctx=None
                continue
            if not ctx:continue
            match=re.match(r'^\s*(\d+|---|--)\s+(.+)$',line)
            if match:
                cols=re.split(r'\s{2,}',match[2].strip())
                # Common layouts: name | age | team | seed | finish, or name | age team | finish.
                name=cols.pop(0) if cols else '';age=None
                if cols and re.fullmatch(r'\d{1,2}',cols[0]):age=cols.pop(0)
                elif cols and re.match(r'^\d{1,2} ',cols[0]):age,cols[0]=cols[0].split(' ',1)
                if not cols:continue
                team=cols.pop(0)
                if re.fullmatch(TIME+r'|NT|DNS|DQ|NS',team):
                    cols.insert(0,team);team=''
                # Some narrow reports have age attached to the name.
                am=re.match(r'^(.*?)\s+(\d{1,2})$',name)
                if am and not age:name,age=am.groups()
                vals=[x for cell in cols for x in cell.split() if re.fullmatch(TIME+r'|DNS|DNF|DQ|NS|NT|SCR|DSQ',x.rstrip('R*'))]
                if not vals:
                    ISSUES.append({'source_id':m['id'],'page':p,'raw_row':st,'reason':'hytek_row_not_parsed'});continue
                last=emit(m,s,ctx,p,line,name,team,vals[-1].rstrip('R*'),match[1],age,{'source_columns':cols,'seed_time_original':vals[0] if len(vals)>1 else None})
                if last and not team:last['review_flags'].append('missing_team_check_source')
            elif last and re.match(r'^(?:\d+:)?\d+\.\d',st):
                last.setdefault('split_rows_original',[]).append(st)
            elif last and ctx['is_relay'] and re.search(r'\d\)',st):last.setdefault('member_rows_original',[]).append(st)

def parse_splash(m,s,pp):
    ctx=None;last=None;skip_all=False
    for p,text in enumerate(pp,1):
        for line in text.splitlines():
            st=line.strip()
            if re.match(r'Event\s+\d+',st):
                new=event_context(st)
                if new:
                    num=re.search(r'Event\s+(\d+)',st)[1]
                    if not ctx or ctx.get('event_number')!=num:
                        ctx={**new,'event_number':num,'competition_category':'unspecified','category_original':None,'round':'timed_final'};skip_all=False
                    # Continuation headers sometimes contain the current age/category.
                    if new.get('age_group'):ctx['age_group']=new['age_group']
                    if 'Open-All' in st:skip_all=True
                last=None;continue
            if not ctx:continue
            date=re.match(r'(\d{1,2})[./](\d{1,2})[./](\d{4})\s*-',st)
            if date:ctx['date']=f'{date[3]}-{int(date[2]):02}-{int(date[1]):02}';continue
            if st in ('All-in','Open-All') or ('Event ' in st and 'Open-All' in st):skip_all=True;continue
            if re.search(r'years|\byo\b',st) and not re.match(r'^\d+\.',st) and (re.search(r'\d\s*-\s*\d',st) or 'older' in st):
                ctx['category_original']=st;ctx['competition_category']=category(st)
                ag=re.search(r'(\d+)\s*-\s*(\d+)',st)
                ctx['age_group']=ag[1]+'-'+ag[2] if ag else (re.search(r'\d+',st)[0]+'+' if re.search(r'\d+',st) else None)
                skip_all=False;last=None;continue
            if skip_all:continue
            match=re.match(r'^\s*(\d+\.|DNS|DSQ|DQ|WDR|DNF)\s+(.+)$',line)
            if not match and last and not ctx['is_relay']:
                cells=re.split(r'\s{2,}',st)
                if len(cells)>=3 and country(cells[1],s['group'])[0] and time_ms(cells[2]):
                    # SPLASH leaves the rank blank for a tied placing.
                    match=re.match(r'^(\d+\.)\s+(.+)$',str(last['placing_original'])+' '+st)
            if match:
                cols=re.split(r'\s{2,}',match[2].strip());name=cols.pop(0);age=None
                if s['group']=='WTG':
                    if cols and cols[0].isdigit():age=cols.pop(0)
                    if not cols:continue
                    team=cols.pop(0)
                    if cols and cols[0].isdigit():age=cols.pop(0)
                elif s['year']==2026:
                    # Nationality and club may have only a single space separating them.
                    if cols and re.match(r'^[A-Z]{3}\s',cols[0]):_,team=cols.pop(0).split(None,1)
                    else:
                        if cols and re.fullmatch('[A-Z]{3}',cols[0]):cols.pop(0)
                        team=cols.pop(0) if cols else ''
                    if cols:cols.pop(0) # entry time; never treat it as a result
                else:
                    # The Lisbon YB values are inconsistent with the age categories;
                    # retain them as source data rather than inventing a birth year.
                    if cols and cols[0].isdigit():cols.pop(0)
                    team=cols.pop(0) if cols else ''
                status=match[1] if not match[1].endswith('.') else None
                raw=status or (cols[0].split()[0] if cols else None)
                last=emit(m,s,ctx,p,line,name,team,raw,match[1],age,{'additional_columns_original':cols[1:]})
            elif last and 'WORLD TRANSPLANT GAMES RECORD' in st:last['record_annotation_original']=st
            elif last and re.search(r'\d+m:',st):last.setdefault('split_rows_original',[]).append(st)
            elif last and ctx['is_relay'] and st and not re.search(r'Splash|Registered|Page|Online|Rank|Place|Time|Points',st):
                last.setdefault('member_rows_original',[]).append(st)
            elif re.search(TIME,st) and not re.search(r'Splash|Registered|Points|Time|Record|WORLD|Dresden,|^Date:|^Session No\.|\d+m:|^\d+[./]\d+[./]',st):
                ISSUES.append({'source_id':m['id'],'page':p,'raw_row':st,'reason':'splash_unmatched_row'})

def parse_2019(m,s,pp):
    ctx=None;last=None
    for p,text in enumerate(pp,1):
        if not 107<=p<=139:continue
        for line in text.splitlines():
            st=line.strip()
            if st.startswith('EVENT '):
                ctx=event_context(st.replace('/', '-'))
                if ctx:ctx.update(event_number=re.search(r'EVENT (\d+)',st)[1],category_original=st,competition_category=category(st))
                continue
            if not ctx:continue
            subgroup=re.match(r'(\d+)/(\d+) Yrs Age Group',st)
            if subgroup:ctx['age_group']=subgroup[1]+'-'+subgroup[2];continue
            if ctx['is_relay']:
                rm=re.match(r'^(\d+)\.\s+(.+?)\s{2,}(.+?)\s{2,}('+TIME+r'|DQ|DNS|DNF)(.*)$',st)
                if rm:emit(m,s,ctx,p,line,rm[2],rm[3],rm[4],rm[1],extra={'split_rows_original':[rm[5].strip()]});continue
            mt=re.match(r'^(\d+)\.\s*(.*?)\s+(\d{1,2})\s{2,}(.+?)\s{2,}('+TIME+r'|DQ|DNS|DNF)(.*)$',st)
            if mt:
                last=emit(m,s,ctx,p,line,mt[2],mt[4],mt[5],mt[1],None,{'source_age_column_original':mt[3],'annotation_original':mt[6].strip() or None})
            elif re.match(r'^\d+\.',st):ISSUES.append({'source_id':m['id'],'page':p,'raw_row':st,'reason':'wtg2019_unmatched_row'})

def parse_canada(m,s,pp):
    ctx=None
    for p,text in enumerate(pp,1):
        for line in text.splitlines():
            st=line.strip()
            event=re.search(r'(\d+)\s*m\s*(libre|brasse|dos|papillon|QNI|Medley)',st,re.I)
            if event:
                ctx=event_context(event[1]+'m '+{'libre':'Freestyle','brasse':'Breaststroke','dos':'Backstroke','papillon':'Butterfly','qni':'Individual Medley','medley':'Individual Medley'}[event[2].lower()])
                ctx['gender']='Women' if re.search('FEMMES|FILLES',st,re.I) else 'Men' if re.search('HOMMES|GARÇONS',st,re.I) else None
                ctx['discipline']='triathlon_swim_leg' if 'TRIATHLON' in st else 'pool_swimming'
                continue
            if not ctx:continue
            mt=re.match(r'^(.*?)\s*(\d{1,2}/\d{1,2}/\d{4})\s+([A-Z]+_\d+)\s+([A-Z]+)\s+(.+)$',st)
            if mt:
                ns=re.split(r'\s{2,}',mt[1]);name=' '.join(ns);tail=re.split(r'\s{2,}',mt[5]);cat=mt[3]
                ctx['category_original']=cat;ctx['competition_category']='unspecified'
                ctx['gender']='Women' if 'W' in cat else 'Men' if 'M' in cat else ctx.get('gender')
                ctx['age_group']=cat.split('_')[1]+' (source category code)'
                result=emit(m,s,ctx,p,line,name,mt[4],tail[0],extra={'birth_year':int(mt[2].split('/')[-1]),'medal_original':tail[-1] if len(tail)>1 else None})
                if result and re.fullmatch(r'\d+:\d{2}',tail[0]):
                    result['time_ms']=time_ms(tail[0].replace(':','.'))
                    result['time_format']='seconds:hundredths (Canadian result sheet)'
                    result['review_flags']=[f for f in result['review_flags'] if f!='unrecognised_time']
            elif re.search(r'\d+/\d+/\d+',st):ISSUES.append({'source_id':m['id'],'page':p,'raw_row':st,'reason':'canada_unmatched_row'})

def age_bounds(r):
    if r.get('birth_year'):return (r['birth_year'],r['birth_year'])
    if r.get('age_at_meet') is not None:return (r['year']-r['age_at_meet']-1,r['year']-r['age_at_meet'])
    m=re.fullmatch(r'(\d+)-(\d+)',r.get('age_group') or '')
    if m:return (r['year']-int(m[2])-1,r['year']-int(m[1]))
    return None

def reference_key(ref):
    return (str(ref.get('source_id') or ''), str(ref.get('page') or ''), str(ref.get('raw_row') or ''))

def parse_dublin(m,s,pp):
    ctx=None
    for p,text in enumerate(pp,1):
        if not 53<=p<=59:continue
        for line in text.splitlines():
            st=line.strip()
            if re.match(r'^\d+m ',st):
                expanded=re.sub(r'\bFree\b','Freestyle',st)
                expanded=re.sub(r'\bBack\b','Backstroke',expanded)
                expanded=re.sub(r'\bBreast\b','Breaststroke',expanded)
                expanded=re.sub(r'\bFly\b','Butterfly',expanded)
                ctx=event_context(expanded);continue
            if not ctx:continue
            if re.search(r'Transplant|Dialysis',st):
                ctx['category_original']=st;ctx['competition_category']='dialysis' if 'Dialysis' in st else 'transplant_recipient'
                ctx['age_group']=st.split()[0];continue
            c=re.split(r'\s{2,}',st)
            if len(c)>=5 and c[0].isdigit():emit(m,s,ctx,p,line,c[1]+' '+c[2],c[3],c[4],c[0])

def parse_msl(m,s,pp):
    import pdfplumber
    cache=CACHE/(m['id']+'.msl.json')
    if cache.exists():texts=json.loads(cache.read_text())
    else:
        texts={}
        with pdfplumber.open(ROOT/m['file']) as pdf:
            for i in range(211,min(351,len(pdf.pages))):
                t=pdf.pages[i].extract_text() or ''
                if 'Piscina de 50' in t:texts[str(i+1)]=t
        cache.write_text(json.dumps(texts,ensure_ascii=False))
    for p,text in texts.items():
        ctx=event_context(text.splitlines()[0])
        if not ctx:continue
        ctx.update(category_original=text.splitlines()[0],competition_category='unspecified',round=None)
        number=re.search(r'(\d+)\s*-',text.splitlines()[0])
        if number:ctx['event_number']=number[1]
        for line in text.splitlines():
            mt=re.match(r'^(?:(\d+)\s+)?(T\d+)\s+(.+?)\s+((?:19|20)\d{2})\s+(.+?)\s+(.*)$',line)
            if not mt:continue
            # Club names consist of letters, while split distances/points start numerically.
            tail=mt[5]+' '+mt[6]
            cut=re.search(r'\s(?=\d)',tail)
            if not cut:continue
            team=tail[:cut.start()];rest=tail[cut.end():]
            vals=[v for v in rest.split() if re.fullmatch(TIME+r'|BAJ|NP|DES|DVI|DSI|DSA|DLI|RT',v)]
            if not vals:continue
            raw=vals[-1];status={'BAJ':'WDR','NP':'DNS','DES':'DQ','DVI':'DQ','DSI':'DQ','DSA':'DQ','DLI':'DQ','RT':'WDR'}.get(raw,raw)
            result=emit(m,s,ctx,int(p),line,mt[3],team,status,mt[1],extra={'birth_year':int(mt[4]),'source_athlete_identifier':mt[2],'name_order':'source_surname_first','time_source_original':raw})
            if result:result['review_flags'].append('source_name_order_needs_review')

def enrich_names(observations):
    # Reconcile surname-first MSL rows only when the same complete name tokens,
    # country, gender and age evidence identify exactly one later name spelling.
    by_tokens=defaultdict(list)
    for r in observations:
        if not r.get('name_order'):
            by_tokens[(tuple(sorted(key(x) for x in r['swimmer_name_original'].split())),r['country_code'],r['gender'])].append(r)
    for r in observations:
        if r.get('name_order')!='source_surname_first':continue
        b=age_bounds(r)
        matches=[o for o in by_tokens[(tuple(sorted(key(x) for x in r['swimmer_name_original'].split())),r['country_code'],r['gender'])]
                 if age_bounds(o) and max(b[0],age_bounds(o)[0])<=min(b[1],age_bounds(o)[1])]
        names={key(o['swimmer_name_original']):o['swimmer_name_original'] for o in matches}
        if len(names)==1:
            r['source_name_original']=r['swimmer_name_original'];r['swimmer_name_original']=next(iter(names.values()))
            r['review_flags'].remove('source_name_order_needs_review')
            r['name_resolution']='same complete name tokens, country, gender and compatible birth year'

def ocr_rows(cells,tolerance=.005):
    rows=[]
    for c in sorted(cells,key=lambda x:x['y']+x['height']/2):
        cy=c['y']+c['height']/2
        if not rows or abs(rows[-1][0]-cy)>tolerance:rows.append([cy,[]])
        rows[-1][1].append(c)
    return [(y,sorted(c,key=lambda x:x['x'])) for y,c in rows]

def parse_scan(m,s,pp):
    ctx=None
    files=sorted(CACHE.glob(m['id']+'.page-*.ocr.json'),key=lambda p:int(p.name.split('.page-')[1].split('.')[0]))
    for path in files:
        p=int(path.name.split('.page-')[1].split('.')[0])
        if s['year']==2013 and not 72<=p<=90:continue
        if s['year']==2015 and not 98<=p<=126:continue
        cells=json.loads(path.read_text())
        rows=ocr_rows(cells,.005 if s['year']==2013 else .003)
        if s['year']==2015:
            lines=[]
            for y,c in rows:
                line=''
                for token in c:
                    x=int(token['x']*240)
                    line+=' '*max(2,x-len(line))+token['text']
                lines.append(line)
            before=len(OBS);rb=len(RELAYS)
            # Maintain event context across page boundaries by prepending the last header.
            headers=[l for l in lines if re.search(r'Event\s+\d+',l)]
            content=('\n'+ctx+'\n' if ctx else '')+'\n'.join(lines)
            fake=['']*(p-1)+[content]
            parse_hytek(m,s,fake)
            if headers:ctx=headers[-1].strip()
            for r in OBS[before:]+RELAYS[rb:]:
                r['review_flags'].append('ocr_requires_visual_review')
                r['source_references'][0]['extraction_method']='macOS Vision OCR'
            continue
        for y,c in rows:
            if not .19<y<.89:continue
            text=' | '.join(x['text'] for x in c)
            if re.search(r'\b(?:Women|Men|Male|Female)\s+\d+',text,re.I):
                header=text.replace(' - ',' ')
                ctx=event_context(header)
                if ctx:ctx.update(competition_category='unspecified',category_original=header)
                continue
            if not ctx:continue
            def col(a,b):return clean(' '.join(x['text'] for x in c if a<=x['x']<b))
            age=col(0,.13);rank=col(.13,.2);round_name=col(.2,.27);name=col(.27,.52);team=col(.52,.68);value=col(.68,.79)
            if age and re.fullmatch(r'\d+\s*(?:-\s*\d+|\+|& Over)',age):ctx['age_group']=re.sub(r'\s','',age)
            if name and team and value and re.fullmatch(TIME+r'|DQ|DNS|NS|DNF',value):
                ctx['round']='heat' if 'Heat' in round_name else 'final' if 'Final' in round_name else None
                r=emit(m,s,ctx,p,text,name,team,value,rank or None,extra={'medal_original':col(.79,.88) or None,'record_annotation_original':col(.88,1) or None})
                if r:
                    r['review_flags'].append('ocr_requires_visual_review')
                    r['source_references'][0]['extraction_method']='macOS Vision OCR'
                    r['source_references'][0]['ocr_min_confidence']=min(x['confidence'] for x in c)
            elif value and name:ISSUES.append({'source_id':m['id'],'page':p,'raw_row':text,'reason':'ocr_unmatched_row'})

def parse_old_book(m,s,pp):
    import pdfplumber
    cache=CACHE/(m['id']+'.plain.json')
    if cache.exists():texts=json.loads(cache.read_text())
    else:
        with pdfplumber.open(ROOT/m['file']) as doc:texts=[pg.extract_text() or '' for pg in doc.pages]
        cache.write_text(json.dumps(texts,ensure_ascii=False))
    ctx=None
    for p,text in enumerate(texts,1):
        if s['year']==2005 and not 60<=p<=77:continue
        if s['year']==2007 and 'Swimming' not in text:ctx=None;continue
        if s['year']==2009 and 'SWIMMING' not in text:ctx=None;continue
        for line in text.splitlines():
            # Headers must name a stroke and a competition category; ignore record notes.
            ec=event_context(line)
            if ec and re.search(r'Female|Male|Women|Men|Girls|Boys',line,re.I):
                ctx={**ec,'category_original':line,'competition_category':'unspecified','round':'final' if s['year'] in (2005,2009) else None}
                # The 2005 book omits Relay from this header; four numbered members follow each team.
                if s['year']==2005 and p==77 and line=='Male 200m Freestyle Final':ctx['is_relay']=True
                continue
            if not ctx:continue
            if ctx['is_relay'] and re.match(r'^1\)',line) and RELAYS and RELAYS[-1]['source_references'][0]['source_id']==m['id']:
                RELAYS[-1].setdefault('member_rows_original',[]).append(line);continue
            if ctx['is_relay']:
                pattern=(r'^(Gold|Silver|Bronze|\d+(?:st|nd|rd|th) Place)\s*[-–]\s*(.*?)\s+('+TIME+r'|DQ|DNS|NS)\s*$' if s['year']==2005 else r'^(\d+(?:st|nd|rd|th)?)\s+(.+?)\s+([\d.:]+|DQ|DNS|NS|Bye)\s*(?:\*{0,2})\s*(?:Gold|Silver|Bronze)?$')
                relay=re.match(pattern,line)
                if relay:
                    team=re.sub(r'\s+TEAM$|\s+[ABCD]$','',relay[2],flags=re.I)
                    emit(m,s,ctx,p,line,relay[2],team,relay[3],relay[1]);continue
            if s['year']==2005:
                mt=re.match(r'^(Gold|Silver|Bronze|\d+(?:st|nd|rd|th) Place(?: \(no medal\))?)\s*[-–]\s*(.*?)\s*[-–]\s*(.*?)\s+('+TIME+r'|DQ|DNS|NS)\s*$',line)
                if mt:emit(m,s,ctx,p,line,mt[2],mt[3],mt[4],mt[1],extra={'medal_original':mt[1] if mt[1] in ('Gold','Silver','Bronze') else None})
                elif re.match(r'Gold|Silver|Bronze|\d+(?:st|nd|rd|th) Place',line):ISSUES.append({'source_id':m['id'],'page':p,'raw_row':line,'reason':'old_book_row'})
            elif s['year']==2007:
                mt=re.match(r'^(\d+)\s+(.+?)\s*:\s*(.+?)\s+([\d.:]+|DQ|DNS|NS|Bye)\s*(\*{0,2})(?:\s+(Gold|Silver|Bronze))?$',line)
                if mt:emit(m,s,ctx,p,line,mt[2],mt[3],mt[4],mt[1],extra={'medal_original':mt[6],'record_annotation_original':mt[5] or None})
                elif re.match(r'^\d+\s+\D',line):ISSUES.append({'source_id':m['id'],'page':p,'raw_row':line,'reason':'old_book_row'})
            else:
                mt=re.match(r'^(\d+(?:st|nd|rd|th)|---)\s+(.+?)\s+(\d{1,2})\s+(.+?)\s+((?:'+TIME+r'|DQ|DNS|NS|DNF)(?:\s+.*)?)$',line)
                if mt:
                    vals=re.findall(TIME+r'|DQ|DNS|NS|DNF',mt[5]);last=emit(m,s,ctx,p,line,mt[2],mt[4],vals[-1],mt[1],mt[3])
                    if len(vals)>1:
                        last['preliminary_time_original']=vals[0]
                elif re.match(r'^(\d+(?:st|nd|rd|th)|---)\s+',line):ISSUES.append({'source_id':m['id'],'page':p,'raw_row':line,'reason':'old_book_row'})

def group_swimmers(observations):
    groups=defaultdict(list);swimmers=[];reviews=[]
    for r in sorted(observations,key=lambda r:(r['year'],r['meet_id'],key(r['swimmer_name_original']),r['event'])):
        nk=key(r['swimmer_name_original']);candidates=groups[nk];bounds=age_bounds(r)
        compatible=[]
        for sw in candidates:
            same_country=r['country_code'] and r['country_code']==sw['country_code']
            same_team=key(r['team_original']) in sw['_team_keys'] and bool(r['team_original'])
            if not (same_country or same_team):continue
            if r['gender'] and sw['gender'] and r['gender']!=sw['gender']:continue
            b=sw['_bounds']
            if b and bounds:
                # Age bands are event data. Convert them to possible birth-year
                # ranges and merge across age progression only when those ranges
                # still overlap.
                if max(b[0],bounds[0])>min(b[1],bounds[1]):continue
            elif not any(x['meet_id']==r['meet_id'] for x in sw['results']):
                # An older source may omit age. Cross-meet matching is allowed
                # only with the same exact country, gender and team, and only
                # when exactly one prior identity satisfies these signals.
                same_country=r['country_code'] and r['country_code']==sw['country_code']
                same_team=key(r['team_original']) in sw['_team_keys'] and bool(r['team_original'])
                if not (same_country and same_team and bounds != sw['_bounds'] and (bounds is None or sw['_bounds'] is None)):continue
            compatible.append(sw)
        if len(compatible)==1:sw=compatible[0]
        else:
            sw={'id':'swimmer-'+uid(nk+'|'+str(r['country_code'])+'|'+r['team_original']+'|'+str(bounds)+'|'+str(len(candidates))),
                'display_name':r['swimmer_name_original'],'name_variants':[],'country':r['country'],'country_code':r['country_code'],'gender':r['gender'],
                'claim_status':'unclaimed','database_athlete_id':None,'date_of_birth':None,'transplant_type':None,'results':[],
                '_bounds':bounds,'_team_keys':set(),'identity_review_required':bool(candidates)}
            if candidates:
                reviews.append({'type':'same_name_uncertain_identity','name':r['swimmer_name_original'],'swimmer_ids':[x['id'] for x in candidates]+[sw['id']]})
                for c in candidates:c['identity_review_required']=True
            groups[nk].append(sw);swimmers.append(sw)
        if bounds and sw['_bounds']:sw['_bounds']=(max(bounds[0],sw['_bounds'][0]),min(bounds[1],sw['_bounds'][1]))
        elif bounds:sw['_bounds']=bounds
        sw['_team_keys'].add(key(r['team_original']))
        if r['swimmer_name_original'] not in sw['name_variants']:sw['name_variants'].append(r['swimmer_name_original'])
        rk=uid('|'.join(str(r.get(x)) for x in ['meet_id','event_number','event','gender','age_group','competition_category','round','time_original','race_status']))
        existing=next((x for x in sw['results'] if x['id']=='result-'+rk),None)
        if existing:existing['source_references'].extend(ref for ref in r['source_references'] if ref not in existing['source_references'])
        else:r['id']='result-'+rk;sw['results'].append(r)
    # Result IDs also include swimmer identity so equal times are not duplicate IDs.
    for sw in swimmers:
        for r in sw['results']:r['id']='result-'+uid(sw['id']+'|'+r['id'])
        sw['categories']=sorted({r['competition_category'] for r in sw['results']})
        sw['teams']=sorted({r['team_original'] for r in sw['results'] if r['team_original']})
        sw['years']=sorted({r['year'] for r in sw['results']})
        sw['result_count']=len(sw['results'])
        sw['source_ids']=sorted({ref['source_id'] for r in sw['results'] for ref in r['source_references']})
        del sw['_bounds'];del sw['_team_keys']
    return sorted(swimmers,key=lambda s:(key(s['display_name']),s['id'])),reviews

def parse_australian_relays(m,s,pp):
    ctx=None;active=None
    def flush():
        if not active:return
        r=emit(m,s,active['ctx'],active['page'],'\n'.join(active['rows']),active['team'],active['team'],active['time'],extra={'lane':active['lane']})
        if r:r['members']=[{'name_original':n,'swimmer_id':None} for n in active['names']]
    for p,text in enumerate(pp,1):
        for line in text.splitlines():
            st=line.strip()
            if not st:continue
            header=re.search(r'(\d+)\s*[xX]\s*(\d+)\s+(Medley|Freestyle)',st)
            if header:
                flush();active=None;ctx=event_context(f'{header[1]}x{header[2]}m {header[3]} Relay');continue
            lane=re.match(r'Lane\s+(\d+)\s*[-–]\s*(\S+)\s+(Mixed|Male|Female)\s+(.*)',st)
            if lane and ctx:
                flush();active={'ctx':{**ctx,'gender':{'Male':'Men','Female':'Women','Mixed':'Mixed'}[lane[3]],'category_original':lane[4],'competition_category':category(lane[4])},'page':p,'lane':lane[1],'team':lane[2],'time':None,'rows':[st],'names':[]};continue
            if active:
                active['rows'].append(st)
                tm=re.search(TIME,st)
                if tm:active['time']=tm[0];st=clean(st[:tm.start()])
                if st and re.fullmatch(r"[\w .,'’\-]+",st):active['names'].append(st)
    flush()


def finalise_relays(swimmers):
    """Keep team performances separate; only link a member when evidence is unique."""
    lookup=defaultdict(list)
    for sw in swimmers:
        for name in sw['name_variants']:lookup[key(name)].append(sw)
    merged={}
    for r in RELAYS:
        members=r.get('members',[])
        for line in r.get('member_rows_original',[]):
            if re.search(r'\d\)',line):
                for part in re.split(r'\d\)\s*',line)[1:]:
                    match=re.fullmatch(r'(.*?)\s+([MW])(\d{1,2})',part.strip())
                    name=clean(match[1] if match else part)
                    if ',' in name:
                        last,first=name.split(',',1);name=clean(first+' '+last)
                    member={'name_original':name,'swimmer_id':None}
                    if match:member.update(age_at_meet=int(match[3]),gender='Men' if match[2]=='M' else 'Women')
                    members.append(member)
            else:
                # Splash member rows alternate a name with a two-digit source age/YB.
                for match in re.finditer(r'([A-Za-zÀ-ž][A-Za-zÀ-ž .,’\-]+?)\s+(\d{1,2})(?:\s+('+TIME+r'))?(?=\s{2,}|$)',line):
                    member={'name_original':clean(match[1]),'source_age_or_year_original':match[2],'swimmer_id':None}
                    if match[3]:member['split_time_original']=match[3]
                    members.append(member)
        dedup={}
        for member in members:
            name=member['name_original'];possible=[]
            for sw in lookup[key(name)]:
                if any(x['meet_id']==r['meet_id'] and (x['country_code'] and x['country_code']==r['country_code'] or x['team_original']==r['team_original']) for x in sw['results']):possible.append(sw)
            possible={sw['id']:sw for sw in possible}
            if len(possible)==1:member['swimmer_id']=next(iter(possible))
            else:member['identity_review_required']=True
            dedup[key(name)]=member
        r['members']=list(dedup.values())
        if not r['members']:r['review_flags'].append('relay_members_not_extracted')
        identity='|'.join(str(r.get(k)) for k in ['meet_id','event_number','event','team_name','gender','age_group','competition_category','round','time_original','lane'])
        r['id']='relay-'+uid(identity)
        if r['id'] in merged:
            prev=merged[r['id']]
            prev['source_references'].extend(ref for ref in r['source_references'] if ref not in prev['source_references'])
            existing={key(x['name_original']) for x in prev['members']}
            prev['members'].extend(x for x in r['members'] if key(x['name_original']) not in existing)
        else:merged[r['id']]=r
    return list(merged.values())


def source_inventory():
    result=[]
    for path in sorted(CACHE.glob('*.meta.json')):
        m=json.loads(path.read_text())
        item={k:v for k,v in m.items() if k not in ('links','error')}
        if m.get('error'):item['error']=m['error']
        if 'security' in m.get('title','').lower():item['status']='blocked_by_site_security_page'
        item['extracted']=bool(spec(m))
        result.append(item)
    return result

def main():
    previous_path=DATA/'swimmers.json'
    old_swimmer_by_ref=defaultdict(set)
    if previous_path.exists():
        try:
            previous=json.loads(previous_path.read_text())
            for old_swimmer in previous.get('swimmers',[]):
                old_source_keys=[old_swimmer['id'], *old_swimmer.get('source_key_aliases',[])]
                for old_result in old_swimmer.get('results',[]):
                    for ref in old_result.get('source_references',[]):
                        old_swimmer_by_ref[reference_key(ref)].update(old_source_keys)
        except (OSError,ValueError,KeyError):
            old_swimmer_by_ref=defaultdict(set)
    OBS.clear();RELAYS.clear();ISSUES.clear();COVERAGE.clear()
    sources=[];meets={}
    for p in sorted(CACHE.glob('*.meta.json')):
        m=json.loads(p.read_text());s=spec(m)
        if not s:continue
        sources.append({k:v for k,v in m.items() if k!='links'})
        meets[s['meet_id']]={k:v for k,v in s.items() if k!='parser'}
        if m['status']!='downloaded':continue
        pp=pages(m);before=len(OBS);relay_before=len(RELAYS);issue_before=len(ISSUES)
        parser={'australian_relays':parse_australian_relays,'british':parse_british,'hytek':parse_hytek,'splash':parse_splash,'wtg2019':parse_2019,'canada':parse_canada,'dublin':parse_dublin,'msl':parse_msl,'scan':parse_scan,'old_book':parse_old_book}.get(s['parser'])
        if parser:parser(m,s,pp)
        COVERAGE.append({'source_id':m['id'],**s,'pages':len(pp),'individual_observations':len(OBS)-before,'relay_observations':len(RELAYS)-relay_before,
                         'unparsed_rows':len(ISSUES)-issue_before,'status':'pending_ocr' if s['parser']=='scan' and not list(CACHE.glob(m['id']+'.page-*.ocr.json')) else 'extracted_needs_review' if parser else 'pending_specialist_parser'})
        print(m['id'],s['group'],s['year'],len(OBS)-before,len(RELAYS)-relay_before,flush=True)
    enrich_names(OBS)
    swimmers,reviews=group_swimmers(OBS)
    # Preserve IDs from the previous export as aliases so an already-started
    # database import can consolidate unclaimed profiles without orphaning
    # their historical result rows.
    new_swimmer_by_ref=defaultdict(set)
    for swimmer in swimmers:
        for result in swimmer['results']:
            for ref in result.get('source_references',[]):
                new_swimmer_by_ref[reference_key(ref)].add(swimmer['id'])
        swimmer['source_key_aliases']=[]
    old_to_new=defaultdict(set)
    for ref,old_source_keys in old_swimmer_by_ref.items():
        new_ids=new_swimmer_by_ref.get(ref,set())
        if len(new_ids)==1:
            new_id=next(iter(new_ids))
            for old_id in old_source_keys:
                if new_id!=old_id:old_to_new[old_id].add(new_id)
    new_by_id={swimmer['id']:swimmer for swimmer in swimmers}
    for old_id,new_ids in old_to_new.items():
        if len(new_ids)==1:
            new_id=next(iter(new_ids))
            new_by_id[new_id]['source_key_aliases'].append(old_id)
        elif len(new_ids)>1:
            reviews.append({'type':'legacy_profile_split_review','name':next((s['display_name'] for s in swimmers if s['id'] in new_ids),None),'swimmer_ids':sorted(new_ids),'legacy_source_key':old_id})
    for swimmer in swimmers:swimmer['source_key_aliases']=sorted(set(swimmer['source_key_aliases']))
    swimmers,reviews,automatic_merges=consolidate_identities(swimmers)
    relays=finalise_relays(swimmers)
    inventory=source_inventory()
    source_groups=[{'group':group,'years_extracted':sorted({c['year'] for c in COVERAGE if c['group']==group and c['individual_observations']}),'coverage_status':'partial' if group!='South Africa' else 'blocked_no_results_extracted','notes':'Historical coverage is not exhaustive.' if group!='South Africa' else 'Official source returned a security page; no bypass attempted.'} for group in ['WTG','Australia','USA','Canada','Britain','South Africa','Europe']]
    out={'schema_version':1,'metadata':{'title':'Historical transplant swimming — review export','generated_at':datetime.now(timezone.utc).isoformat(),
        'scope':'All seven approved source groups, all discoverable historical results, all categories','coverage_status':'partial','ready_for_database_import':False,
        'identity_policy':'Exact normalised name, country, gender, matching team and compatible inferred birth-year ranges. Missing-age profiles may attach only to a unique known-age identity. Ambiguous and conflicting identities remain separate and flagged.',
        'identity_consolidation':{'automatic_merges':automatic_merges,'review_required_profiles':sum(bool(swimmer.get('identity_review_required')) for swimmer in swimmers)},
        'notes':['No database writes have been made.','Unknown fields remain null; competition categories are not inferred medical histories.','A listed result is not an officially verified result or verified account owner.','Source pool length, time anomalies, and ambiguous identities require review.']},
        'summary':{'swimmers':len(swimmers),'individual_results':sum(s['result_count'] for s in swimmers),'relay_results':len(relays),'identity_reviews':len(reviews),'unparsed_rows':len(ISSUES)},
        'source_groups':source_groups,'source_inventory':inventory,'meets':list(meets.values()),'sources':sources,'coverage':COVERAGE,'swimmers':swimmers,'relay_results':relays,'identity_review':reviews,'unparsed_rows':ISSUES}
    (DATA/'swimmers.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    (DATA/'review-summary.json').write_text(json.dumps({'metadata':out['metadata'],'summary':out['summary'],'source_groups':source_groups,'coverage':COVERAGE,'review_flag_counts':dict(Counter(f for sw in swimmers for r in sw['results'] for f in r['review_flags']))},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(out['summary']))

if __name__=='__main__':main()
