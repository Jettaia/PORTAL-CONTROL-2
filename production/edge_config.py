import re
def add_chapa_route(before):
    marker='app.jettatransportes.com.br {'
    if 'handle /chapa' in before:raise RuntimeError('Chapa route already exists')
    pattern=r'(?m)^'+re.escape(marker)+r'$'
    if len(re.findall(pattern,before))!=1:raise RuntimeError('Ambiguous host configuration')
    block="""
    # Portal Control: isolated prefix and private upstream.
    handle /chapa {
        redir /chapa/ 308
    }
    handle /chapa/* {
        reverse_proxy chapa-api:3211
    }
"""
    return re.sub(pattern,lambda _:marker+block,before,count=1)
