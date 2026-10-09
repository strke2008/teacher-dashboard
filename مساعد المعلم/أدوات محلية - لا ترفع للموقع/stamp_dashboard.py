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
    if s2 != s: open(p, 'w', encoding='utf-8').write(s2); print(folder, 'updated')
    else: print(folder, 'no change')
