"""يحدّث أرقام الإصدار (?v=) في index.html للوحة التحكم وبوابة الطالب بعد تعديل أي ملف css/js.
التشغيل: python3 stamp_dashboard.py   (من أي مكان)"""
import re, hashlib, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
for folder in ('teacher-dashboard', 'student-portal'):
    D = os.path.join(ROOT, folder); p = os.path.join(D, 'index.html'); s = open(p, encoding='utf-8').read()
    def ver(m):
        f = m.group(2)
        try: h = hashlib.sha1(open(os.path.join(D, f), encoding='utf-8').read().encode()).hexdigest()[:8]
        except FileNotFoundError: return m.group(0)
        return f'{m.group(1)}{f}?v={h}"'
    s2 = re.sub(r'((?:href|src)=")((?:js/)?[\w.\-]+\.(?:css|js))\?v=[0-9a-f]+"', ver, s)
    # 🏷️ رقم إصدار اللوحة الظاهر للمعلم (v1.0.N): يزيد 1 مع أي تعديل في الصفحة أو أي ملف css/js.
    #    data-code = بصمة المحتوى (بها يُعرف التغيير)، ولا تظهر للمعلم
    if folder == 'teacher-dashboard':
        mv = re.search(r'<meta name="app-version" content="(\d+)\.(\d+)\.(\d+)" data-code="([0-9a-f]{4})"/>', s2)
        body = re.sub(r'<meta name="app-version"[^>]*/>\n?', '', s2)
        code = hashlib.sha1(body.encode()).hexdigest()[:4]
        if not mv or mv.group(4) != code:
            a, b, n = (int(mv.group(1)), int(mv.group(2)), int(mv.group(3)) + 1) if mv else (1, 0, 1)
            tag = f'<meta name="app-version" content="{a}.{b}.{n}" data-code="{code}"/>'
            s2 = re.sub(r'<meta name="app-version"[^>]*/>', tag, s2) if 'name="app-version"' in s2 else s2.replace('<meta content="مساعد المعلم" name="apple-mobile-web-app-title"/>', '<meta content="مساعد المعلم" name="apple-mobile-web-app-title"/>\n' + tag, 1)
    if s2 != s: open(p, 'w', encoding='utf-8').write(s2); print(folder, 'updated')
    else: print(folder, 'no change')
