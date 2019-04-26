from plugins.chain.app.chain_api import ChainApi

name = 'Chain'
description = 'Adds a REST API for chain mode, along with GUI configuration'
address = '/plugin/chain/gui'
store = None


async def initialize(app, services):
    chain_api = ChainApi(services.get('data_svc'), services.get('operation_svc'))
    services.get('auth_svc').set_unauthorized_static('/chain', 'plugins/chain/static/', append_version=True)
    services.get('auth_svc').set_authorized_route('GET', '/plugin/chain/gui', chain_api.landing)
    services.get('auth_svc').set_authorized_route('*', '/plugin/chain/rest', chain_api.rest_api)

