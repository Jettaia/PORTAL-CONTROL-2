"""Run on the VPS after verified release. Preserve shared edge rollback files."""
from pathlib import Path
import subprocess,os,json,re
from edge_config import add_chapa_route
root=Path('/opt/jetta-chapa')
caddy=Path('/opt/move-public-edge/Caddyfile')
compose=Path('/opt/move-public-edge/compose.yaml')
before=caddy.read_text();before_compose=compose.read_text()
after_caddy=add_chapa_route(before)
old_networks="""    networks:
      - public
      - preparation
      - gestao-edge
      - painel-jetta-public-edge
"""
new_networks="""    networks:
      public: {}
      preparation: {}
      gestao-edge: {}
      painel-jetta-public-edge: {}
      jetta-chapa-edge:
        ipv4_address: 10.203.88.2
"""
if before_compose.count(old_networks)!=1:raise RuntimeError('Unexpected edge compose network layout')
after_compose=before_compose.replace(old_networks,new_networks).replace('\nvolumes:\n','\n  jetta-chapa-edge:\n    external: true\n    name: jetta-chapa-edge\nvolumes:\n')
for name,text in [('caddy-before.conf',before),('caddy-compose-before.yaml',before_compose)]:
 target=root/name
 if target.exists():
  if target.read_text()!=text:raise RuntimeError('Rollback snapshot differs; refusing overwrite')
 else:
  with target.open('x') as f:f.write(text)
  os.chmod(target,0o600)
reload_cmd=['docker','exec','move-public-edge-caddy-1','caddy','reload','--config','/etc/caddy/Caddyfile']
if re.search(r'(?m)^\s*admin off\s*$',before):
 cmd=json.loads(subprocess.check_output(['docker','inspect','move-public-edge-caddy-1','--format','{{json .Config.Cmd}}'],text=True))
 if cmd[:2]!=['caddy','run'] or '--resume' in cmd:raise RuntimeError('Signal reload requires file-based caddy run')
 reload_cmd=['docker','kill','--signal=USR1','move-public-edge-caddy-1']
try:
 networks=json.loads(subprocess.check_output(['docker','inspect','move-public-edge-caddy-1','--format','{{json .NetworkSettings.Networks}}'],text=True))
 if 'jetta-chapa-edge' in networks:
  if networks['jetta-chapa-edge']['IPAddress']!='10.203.88.2':raise RuntimeError('Unexpected proxy IP')
 else:subprocess.run(['docker','network','connect','--ip','10.203.88.2','jetta-chapa-edge','move-public-edge-caddy-1'],check=True)
 compose.write_text(after_compose)
 subprocess.run(['docker','compose','-f',str(compose),'config','--quiet'],check=True)
 # Preserve the inode of the bind-mounted Caddyfile.
 caddy.write_text(after_caddy)
 subprocess.run(['docker','exec','move-public-edge-caddy-1','caddy','validate','--config','/etc/caddy/Caddyfile'],check=True)
 subprocess.run(reload_cmd,check=True)
 print('CHAPA_ROUTE_PUBLISHED')
except Exception:
 caddy.write_text(before);compose.write_text(before_compose)
 subprocess.run(reload_cmd,check=False)
 raise
