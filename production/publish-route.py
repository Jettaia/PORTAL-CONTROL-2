"""Run on the VPS after verified release. Preserve shared edge rollback files."""
from pathlib import Path
import subprocess,os
root=Path('/opt/jetta-chapa')
caddy=Path('/opt/move-public-edge/Caddyfile')
compose=Path('/opt/move-public-edge/compose.yaml')
before=caddy.read_text();before_compose=compose.read_text()
if 'handle /chapa' in before:raise RuntimeError('Chapa route already exists; review before changing')
marker='app.jettatransportes.com.br {'
if before.count(marker)!=1:raise RuntimeError('Ambiguous host configuration')
block="""
    # Portal Control: isolated prefix and private upstream.
    handle /chapa {
        redir /chapa/ 308
    }
    handle /chapa/* {
        reverse_proxy chapa-api:3211
    }
"""
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
 with target.open('x') as f:f.write(text)
 os.chmod(target,0o600)
try:
 subprocess.run(['docker','network','connect','--ip','10.203.88.2','jetta-chapa-edge','move-public-edge-caddy-1'],check=True)
 compose.write_text(after_compose)
 subprocess.run(['docker','compose','-f',str(compose),'config','--quiet'],check=True)
 # Preserve the inode of the bind-mounted Caddyfile.
 caddy.write_text(before.replace(marker,marker+block))
 subprocess.run(['docker','exec','move-public-edge-caddy-1','caddy','validate','--config','/etc/caddy/Caddyfile'],check=True)
 subprocess.run(['docker','exec','move-public-edge-caddy-1','caddy','reload','--config','/etc/caddy/Caddyfile'],check=True)
 print('CHAPA_ROUTE_PUBLISHED')
except Exception:
 caddy.write_text(before);compose.write_text(before_compose)
 subprocess.run(['docker','exec','move-public-edge-caddy-1','caddy','reload','--config','/etc/caddy/Caddyfile'],check=False)
 raise
