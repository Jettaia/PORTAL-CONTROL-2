import unittest
from edge_config import add_chapa_route
class Edge(unittest.TestCase):
 def test_domain_reference_in_another_proxy_is_preserved(self):
  original="app.jettatransportes.com.br {\n handle { reverse_proxy previous:3000 }\n}\nwww.ciadm.com.br {\n reverse_proxy https://app.jettatransportes.com.br {\n  header_up Host app.jettatransportes.com.br\n }\n}\n"
  result=add_chapa_route(original)
  self.assertEqual(result.count('handle /chapa/*'),1)
  self.assertIn('reverse_proxy https://app.jettatransportes.com.br {\n  header_up',result)
  self.assertIn('handle { reverse_proxy previous:3000 }',result)
 def test_existing_route_refused(self):
  with self.assertRaises(RuntimeError):add_chapa_route('app.jettatransportes.com.br {\n handle /chapa {}\n}')
if __name__=='__main__':unittest.main()
