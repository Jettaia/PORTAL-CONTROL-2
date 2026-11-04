import importlib.util
from pathlib import Path
import tempfile, unittest, os
spec=importlib.util.spec_from_file_location('prune',Path(__file__).with_name('prune-backups.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Backups(unittest.TestCase):
 def test_retains_newest_and_only_generated_files(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);(p/'keep.txt').write_text('keep')
   for n in range(10):
    f=p/f'chapa-{n}T.bak.cms';f.write_bytes(b'123');os.utime(f,(n+100,n+100))
   result=m.prune_backups(p,max_files=3,max_bytes=8)
   self.assertEqual(result,{'kept':2,'bytes':6,'removed':8})
   self.assertEqual(sorted(x.name for x in p.iterdir()),['chapa-8T.bak.cms','chapa-9T.bak.cms','keep.txt'])
 def test_oversized_newest_preserves_all(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);(p/'chapa-1T.bak.cms').write_bytes(b'12345')
   with self.assertRaises(RuntimeError):m.prune_backups(p,max_bytes=3)
   self.assertEqual((p/'chapa-1T.bak.cms').read_bytes(),b'12345')
if __name__=='__main__':unittest.main()
