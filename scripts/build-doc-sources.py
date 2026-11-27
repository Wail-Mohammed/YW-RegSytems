from pathlib import Path
import html,json,math
root=Path(__file__).resolve().parents[1];docs=root/'docs'
nodes=[
 {'name':'departments','x':40,'y':100,'w':250,'fields':['PK department_id','UQ name']},
 {'name':'instructors','x':40,'y':370,'w':280,'fields':['PK instructor_id','FK department_id','UQ email']},
 {'name':'courses','x':410,'y':100,'w':290,'fields':['PK course_id','FK department_id','UQ course_code']},
 {'name':'course_prerequisites','x':820,'y':100,'w':350,'fields':['PK/FK course_id (dependent)','PK/FK prerequisite_id (required)','PK = (course_id, prerequisite_id)']},
 {'name':'terms','x':40,'y':700,'w':250,'fields':['PK term_id','UQ (name, year)']},
 {'name':'sections','x':450,'y':430,'w':340,'fields':['PK section_id','FK course_id','FK instructor_id','FK term_id','UQ (course_id, term_id,','    section_number)']},
 {'name':'registrations','x':880,'y':330,'w':340,'fields':['PK registration_id','FK student_id','FK section_id','UQ (student_id, section_id)']},
 {'name':'waitlist_entries','x':880,'y':740,'w':340,'fields':['PK/FK student_id','PK/FK section_id','PK = (student_id, section_id)']},
 {'name':'students','x':1310,'y':490,'w':290,'fields':['PK student_id','UQ email','major (optional text)']},
 {'name':'student_holds','x':1310,'y':100,'w':290,'fields':['PK hold_id','FK student_id']},
]
for n in nodes:n['h']=48+len(n['fields'])*25
edges=[
 ('departments','courses',[[290,150],[410,150]],'contains',350,128),
 ('departments','instructors',[[165,198],[165,370]],'employs',210,285),
 ('courses','sections',[[550,223],[550,430]],'offers',590,325),
 ('instructors','sections',[[320,430],[385,430],[385,500],[450,500]],'teaches',382,410),
 ('terms','sections',[[290,750],[370,750],[370,580],[450,580]],'schedules',365,685),
 ('courses','course_prerequisites',[[700,135],[820,135]],'dependent',760,118),
 ('courses','course_prerequisites',[[700,195],[820,195]],'required',760,230),
 ('sections','registrations',[[790,470],[835,470],[835,385],[880,385]],'receives',832,360),
 ('sections','waitlist_entries',[[790,580],[830,580],[830,790],[880,790]],'queues',825,700),
 ('students','registrations',[[1310,520],[1260,520],[1260,420],[1220,420]],'registers',1260,385),
 ('students','waitlist_entries',[[1310,590],[1260,590],[1260,790],[1220,790]],'waitlists',1285,710),
 ('students','student_holds',[[1455,490],[1455,198]],'has holds',1505,350),
]
relationships=[]
for parent,child,points,label,lx,ly in edges:
 relationships.append({'parent':parent,'child':child,'points':points,'label':label,'lx':lx,'ly':ly,'startCardinality':'1','endCardinality':'0..N'})
diagram={'width':1660,'height':1030,'nodes':nodes,'edges':relationships}
(docs/'er-diagram.json').write_text(json.dumps(diagram,indent=2))
svg=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1660 1030" role="img" aria-labelledby="title desc">',
 '<title id="title">College Course Registration: clarified ER relationship constraints</title>',
 '<desc id="desc">Crow\'s Foot notation. Every child belongs to exactly one parent; each parent may have zero or many children. Two separately labeled roles resolve the recursive course prerequisite relationship.</desc>',
 '<rect width="1660" height="1030" fill="#fafaf7"/>',
 '<style>text{font-family:Arial,Helvetica,sans-serif;fill:#183f39}.table{font-size:20px;font-weight:700}.field{font-size:16px}.rel{font-size:15px;paint-order:stroke;stroke:#fafaf7;stroke-width:5;stroke-linejoin:round}.edge{fill:none;stroke:#557e73;stroke-width:2}.mark{fill:none;stroke:#234e42;stroke-width:2}</style>',
 '<text x="40" y="44" font-size="27" font-weight="bold">College Course Registration — clarified relationship constraints</text>']
def line(x1,y1,x2,y2,cls='mark'):
 return f'<line class="{cls}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"/>'
def marker(point,inside,many):
 x,y=point;dx,dy=inside[0]-x,inside[1]-y;length=math.hypot(dx,dy);dx/=length;dy/=length;px,py=-dy,dx
 def p(t,s=0):return x+dx*t+px*s,y+dy*t+py*s
 if many:
  a=p(19)
  for s in [-8,0,8]:svg.append(line(*a,*p(3,s)))
  cx,cy=p(30);svg.append(f'<circle class="mark" cx="{cx}" cy="{cy}" r="4.5" style="fill:#fafaf7"/>')
 else:
  for t in [9,16]:svg.append(line(*p(t,-8),*p(t,8)))
for e in relationships:
 svg.append('<polyline class="edge" points="'+' '.join(f'{x},{y}' for x,y in e['points'])+'"/>')
for n in nodes:
 x,y,w,h=n['x'],n['y'],n['w'],n['h'];svg.extend([f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="white" stroke="#426e60" stroke-width="1.8"/>',f'<rect x="{x+1}" y="{y+1}" width="{w-2}" height="35" rx="5" fill="#e4eee7"/>',f'<text class="table" x="{x+12}" y="{y+25}">{n["name"]}</text>'])
 for i,f in enumerate(n['fields']):svg.append(f'<text class="field" x="{x+12}" y="{y+61+25*i}">{html.escape(f)}</text>')
for e in relationships:
 marker(e['points'][0],e['points'][1],False);marker(e['points'][-1],e['points'][-2],True)
 svg.append(f'<text class="rel" text-anchor="middle" x="{e["lx"]}" y="{e["ly"]}">{html.escape(e["label"])}</text>')
svg.extend(['<text x="40" y="950" font-size="19" font-weight="bold">Read both ends: || = exactly one (1..1); circle + crow\'s foot = zero or many (0..N).</text>',
 '<text x="40" y="980" font-size="17">Each association row has mandatory parent references. A parent can exist without any child rows. See RELATIONSHIPS.md for all 12 rules.</text>',
 '<text x="40" y="1008" font-size="16">PK = primary key; FK = foreign key; UQ = unique key. All attributes and composite unique constraints appear in sql/schema.sql.</text>','</svg>'])
(docs/'er-diagram.svg').write_text('\n'.join(svg))
# Keep the editable Mermaid source consistent with the actual SQL attributes.
p=docs/'er-diagram.mmd';s=p.read_text();needle='        varchar email UK\n    }\n    instructors'
if needle in s:s=s.replace(needle,'        varchar email UK\n        varchar major "optional; one free-text value"\n    }\n    instructors')
p.write_text(s)
print('Updated ER JSON, SVG, and Mermaid source.')
