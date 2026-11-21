def L(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    c=[x/12.92 if x<=0.03928 else ((x+0.055)/1.055)**2.4 for x in c]
    return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
def cr(a,b):
    la,lb=sorted([L(a),L(b)],reverse=True); return (la+0.05)/(lb+0.05)
def blend(fg,bg,a):
    f=[int(fg[i:i+2],16) for i in (1,3,5)]; b=[int(bg[i:i+2],16) for i in (1,3,5)]
    return '#'+''.join(f'{round(x*a+y*(1-a)):02x}' for x,y in zip(f,b))
light={'ink':'#f6f7fb','surface':'#ffffff','surface2':'#f0f1f6','paper':'#12131a','muted':'#5a5f73','faint':'#646a7e','brass':'#3d2fd1','ok':'#0b6f5b','warn':'#8a5300','danger':'#b42318','lime':'#c8f03c','night':'#1b1650','line':'#e6e8f0','line-strong':'#d3d7e3'}
dark={'ink':'#0f0d26','surface':'#17143a','surface2':'#201c4a','paper':'#f6f7fb','muted':'#a9a6cc','faint':'#908cb8','brass':'#c8f03c','ok':'#3ccf91','warn':'#f5b942','danger':'#f06b5b'}
rows=[]
def chk(theme,fgn,bgn,fg,bg,kind='texto'):
    r=cr(fg,bg); need=3.0 if kind!='texto' else 4.5
    rows.append((theme,fgn,bgn,round(r,2),kind,'PASS' if r>=need else 'FAIL'))
for th,P in (('claro',light),('oscuro (app)',dark)):
    for fg in ('paper','muted','faint','brass','ok','warn','danger'):
        for bg in ('ink','surface','surface2'):
            chk(th,fg,bg,P[fg],P[bg])
# botón primario
chk('claro','surface (texto botón)','brass',light['surface'],light['brass'])
chk('claro','ink/paper sobre lime','lime',light['paper'],light['lime'])
chk('claro','lime (texto) sobre surface','surface',light['lime'],light['surface'])
chk('claro','lime sobre night','night',light['lime'],light['night'])
chk('claro','white/70 sobre night','night',blend('#ffffff','#1b1650',0.7),light['night'])
chk('claro','white/75 sobre negro','#000',blend('#ffffff','#000000',0.75),'#000000')
chk('claro','brass sobre brass/10','brass/10',light['brass'],blend(light['brass'],'#ffffff',0.1))
chk('claro','ok sobre ok/10 (Badge)','ok/10',light['ok'],blend(light['ok'],'#ffffff',0.1))
chk('claro','warn sobre warn/10','warn/10',light['warn'],blend(light['warn'],'#ffffff',0.1))
chk('claro','line-strong (borde input) sobre surface','surface',light['line-strong'],light['surface'],'ui')
chk('claro','line (borde tarjeta) sobre ink','ink',light['line'],light['ink'],'ui')
chk('claro','white sobre sport-basketball','#c2410c','#ffffff','#c2410c')
chk('claro','white sobre sport-athletics','#b45309','#ffffff','#b45309')
chk('claro','white sobre sport-football','#15803d','#ffffff','#15803d')
chk('claro','white/25 dorsal sobre basket','#c2410c',blend('#ffffff','#c2410c',0.25),'#c2410c','deco')
for r in rows: print(' | '.join(map(str,r)))
