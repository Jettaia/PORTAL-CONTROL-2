set -euo pipefail
docker create --name chapa-staging-proof --user 0 --network jetta-chapa-db \
 --mount type=bind,src=/opt/jetta-chapa/data/bootstrap,dst=/run/bootstrap,readonly \
 --mount type=bind,src=/opt/jetta-chapa/release/production,dst=/app/production,readonly \
 jetta-chapa:verified node production/verify-staging.mjs >/dev/null
docker network connect --ip 10.203.88.2 jetta-chapa-edge chapa-staging-proof
docker start -a chapa-staging-proof
status=$(docker inspect --format '{{.State.ExitCode}}' chapa-staging-proof)
docker rm chapa-staging-proof >/dev/null
exit "$status"
