"""Operator SSH transport; credentials stay in ignored env.txt."""
import argparse, base64, hashlib, os, re, sys
from pathlib import Path
sys.path.insert(0, os.path.join(os.environ.get('TEMP', '/tmp'), 'jetta-deploy-tools'))
import paramiko
ROOT = Path(__file__).resolve().parent.parent
class PinnedHost(paramiko.MissingHostKeyPolicy):
    def missing_host_key(self, client, hostname, key):
        fp = base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip('=')
        if fp != 'rg28ihrG2jP59jV5Jqem0t7cUTb5qyr76on1XQDSAfE':
            raise RuntimeError('Unexpected VPS SSH identity')
def connect():
    values = (ROOT / 'env.txt').read_text(encoding='utf-8-sig')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(PinnedHost())
    host = re.search(r'^IP:[ \t]*(\S+)', values, re.M)[1]
    password = re.search(r'^Senha root VPS:[ \t]*(.+)', values, re.M)[1].strip()
    client.connect(host, username='root', password=password, timeout=20, look_for_keys=False, allow_agent=False)
    return client
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--command')
    parser.add_argument('--script')
    parser.add_argument('--upload', nargs=2)
    parser.add_argument('--download', nargs=2)
    args = parser.parse_args()
    with connect() as client:
        if args.upload or args.download:
            with client.open_sftp() as sftp:
                if args.upload:
                    local, remote = args.upload
                    sftp.put(local, remote)
                    sftp.chmod(remote, 0o600)
                else:
                    remote, local = args.download
                    sftp.get(remote, local)
            print('TRANSFER_OK')
        else:
            stdin, stdout, stderr = client.exec_command(args.command or 'bash -se', timeout=1800)
            if args.script:
                stdin.write(Path(args.script).read_text(encoding='utf-8'))
                stdin.channel.shutdown_write()
            for line in stdout:
                print(line, end='', flush=True)
            errors = stderr.read().decode(errors='replace')
            if errors:
                print(errors, file=sys.stderr, end='')
            sys.exit(stdout.channel.recv_exit_status())
if __name__ == '__main__':
    main()
