import subprocess, re, csv, sys
pdf=sys.argv[1]; out=sys.argv[2]
n=int(re.search(r'Pages:\s+(\d+)',subprocess.run(['pdfinfo',pdf],capture_output=True,text=True).stdout).group(1))
SIZE=re.compile(r'\d.*\b(gramos?|gr|g|kg|kilos?|libras?|ml|mililitros|miligramos|litros?|lt|cm|mts?|metros|onzas|oz|cc)\b',re.I)
PACK=re.compile(r'^(individual|pague|lleve|display|paquete|caja|bolsa|x ?\d|\d+ ?(unidades|und|uds|piezas|pares|rollos|sobres|tiras))',re.I)
rows=[]; seccion=''
for p in range(1,n+1):
    t=subprocess.run(['pdftotext','-f',str(p),'-l',str(p),'-layout',pdf,'-'],capture_output=True,text=True).stdout
    blocks=[];cur=[]
    for ln in t.split('\n'):
        if ln.strip()=='' :
            if cur: blocks.append(cur);cur=[]
            continue
        if '❖' not in ln:
            s=ln.strip()
            if len(s)>3 and len(s)<40 and not cur: seccion=s
            continue
        cur.append(ln)
    if cur: blocks.append(cur)
    for b in blocks:
        cols=[m.start() for m in re.finditer('❖',b[0])]
        items=[[] for _ in cols]
        for ln in b:
            for m in re.finditer('❖',ln):
                end=ln.find('❖',m.start()+1); end=len(ln) if end<0 else end
                txt=ln[m.start()+1:end].strip()
                if not txt: continue
                i=min(range(len(cols)),key=lambda k:abs(cols[k]-m.start()))
                items[i].append(txt)
        for it in items:
            if not it: continue
            nombre=it[0]; resto=it[1:]
            pres=[x for x in resto if SIZE.search(x) and not PACK.match(x)]
            emp=[x for x in resto if PACK.match(x)]
            otros=[x for x in resto if x not in pres and x not in emp]
            rows.append(dict(pagina=p,seccion_pdf=seccion,nombre=nombre,marca_o_detalle=' | '.join(otros),presentacion=' | '.join(pres),empaque=' | '.join(emp),texto_original=' / '.join(it)))
with open(out,'w',newline='',encoding='utf-8-sig') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0].keys()));w.writeheader();w.writerows(rows)
print(len(rows))
