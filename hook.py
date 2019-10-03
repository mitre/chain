from plugins.chain.app.chain_api import ChainApi

name = 'Chain'
description = 'Adds a REST API for chain mode, along with GUI configuration'
address = '/plugin/chain/gui'


async def initialize(app, services):
    chain_api = ChainApi(services)
    app.router.add_static('/chain', 'plugins/chain/static/', append_version=True)
    app.router.add_route('GET', '/plugin/chain/gui', chain_api.landing)
    app.router.add_route('*', '/plugin/chain/full', chain_api.rest_full)
    app.router.add_route('*', '/plugin/chain/rest', chain_api.rest_api)
    app.router.add_route('PUT', '/plugin/chain/operation/state', chain_api.rest_state_control)
    app.router.add_route('PUT', '/plugin/chain/agents/trust', chain_api.rest_reset_trust)
    app.router.add_route('PUT', '/plugin/chain/operation/{operation_id}', chain_api.rest_update_operation)
